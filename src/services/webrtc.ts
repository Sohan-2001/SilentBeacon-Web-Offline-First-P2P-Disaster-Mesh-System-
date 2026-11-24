// SilentBeacon WebRTC Peer-to-Peer Manager with Air-Gapped QR Handshake
import { GossipMessage, PeerNode } from '../types';

export interface WebRTCConnectionHandlers {
  onMessage: (peerId: string, msg: GossipMessage) => void;
  onStateChange: (peerId: string, state: 'connected' | 'handshaking' | 'disconnected') => void;
  onError: (peerId: string, error: any) => void;
}

export class WebRTCManager {
  private peers: Map<string, { pc: RTCPeerConnection; dc: RTCDataChannel | null; node: PeerNode }> = new Map();
  private localNodeId: string;
  private localNodeName: string;
  private handlers: WebRTCConnectionHandlers;

  // Configuration for local ad-hoc / zero-internet peer connections
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      // Standard public fallback in case local internet briefly exists,
      // but WebRTC works over local hotspot/LAN without external STUN
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  constructor(localNodeId: string, localNodeName: string, handlers: WebRTCConnectionHandlers) {
    this.localNodeId = localNodeId;
    this.localNodeName = localNodeName;
    this.handlers = handlers;
  }

  /**
   * Generates an SDP Offer for Air-Gapped QR pairing
   */
  public async createOffer(): Promise<{
    offerPayload: string;
    pc: RTCPeerConnection;
    sessionId: string;
  }> {
    const pc = new RTCPeerConnection(this.rtcConfig);
    const sessionId = 'peer-' + Math.random().toString(36).substring(2, 8);

    const dc = pc.createDataChannel('silentbeacon-mesh', {
      ordered: true
    });

    this.setupDataChannel(sessionId, dc);
    this.setupPeerConnection(sessionId, pc);

    this.peers.set(sessionId, {
      pc,
      dc,
      node: {
        id: sessionId,
        name: 'Peer-' + sessionId.slice(-4),
        transport: 'webrtc',
        status: 'handshaking',
        lastSeen: Date.now(),
        vectorClock: {},
        syncedTicketsCount: 0
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Wait for ICE candidate gathering so all local IPs are in the SDP payload
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        // Timeout safeguard
        setTimeout(() => resolve(), 1200);
      }
    });

    const payload = JSON.stringify({
      t: 'OFFER',
      fromId: this.localNodeId,
      fromName: this.localNodeName,
      sdp: pc.localDescription?.sdp
    });

    return {
      offerPayload: payload,
      pc,
      sessionId
    };
  }

  /**
   * Accepts an SDP Offer (from scanning QR code) and generates an SDP Answer
   */
  public async acceptOfferAndCreateAnswer(offerPayloadStr: string): Promise<{
    answerPayload: string;
    sessionId: string;
  }> {
    const data = JSON.parse(offerPayloadStr);
    const peerNodeId = data.fromId || 'peer-' + Math.random().toString(36).substring(2, 8);
    const peerNodeName = data.fromName || 'Peer-' + peerNodeId.slice(-4);

    const pc = new RTCPeerConnection(this.rtcConfig);

    pc.ondatachannel = (event) => {
      this.setupDataChannel(peerNodeId, event.channel);
      const peer = this.peers.get(peerNodeId);
      if (peer) {
        peer.dc = event.channel;
      }
    };

    this.setupPeerConnection(peerNodeId, pc);

    this.peers.set(peerNodeId, {
      pc,
      dc: null,
      node: {
        id: peerNodeId,
        name: peerNodeName,
        transport: 'webrtc',
        status: 'handshaking',
        lastSeen: Date.now(),
        vectorClock: {},
        syncedTicketsCount: 0
      }
    });

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Wait for ICE candidates
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
        setTimeout(() => resolve(), 1200);
      }
    });

    const answerPayload = JSON.stringify({
      t: 'ANSWER',
      fromId: this.localNodeId,
      fromName: this.localNodeName,
      sdp: pc.localDescription?.sdp
    });

    return {
      answerPayload,
      sessionId: peerNodeId
    };
  }

  /**
   * Finalizes the handshake when Offer creator scans the Answer QR code
   */
  public async finalizeAnswer(sessionId: string, answerPayloadStr: string): Promise<void> {
    const data = JSON.parse(answerPayloadStr);
    const peer = this.peers.get(sessionId);
    if (!peer) {
      // Find any peer in handshaking state
      for (const [id, p] of this.peers.entries()) {
        if (p.node.status === 'handshaking') {
          await p.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
          p.node.name = data.fromName || p.node.name;
          return;
        }
      }
      throw new Error('No pending peer connection found to finalize.');
    }

    await peer.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
    peer.node.name = data.fromName || peer.node.name;
  }

  private setupPeerConnection(peerId: string, pc: RTCPeerConnection) {
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.handlers.onStateChange(peerId, 'connected');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        this.handlers.onStateChange(peerId, 'disconnected');
      }
    };
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.node.status = 'connected';
        peer.node.lastSeen = Date.now();
      }
      this.handlers.onStateChange(peerId, 'connected');
    };

    dc.onclose = () => {
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.node.status = 'disconnected';
      }
      this.handlers.onStateChange(peerId, 'disconnected');
    };

    dc.onmessage = (event) => {
      try {
        const msg: GossipMessage = JSON.parse(event.data);
        const peer = this.peers.get(peerId);
        if (peer) {
          peer.node.lastSeen = Date.now();
          peer.node.vectorClock = msg.vectorClock;
        }
        this.handlers.onMessage(peerId, msg);
      } catch (err) {
        console.error('Failed to parse WebRTC mesh message:', err);
      }
    };

    dc.onerror = (err) => {
      this.handlers.onError(peerId, err);
    };
  }

  /**
   * Sends a message to a specific peer over WebRTC
   */
  public send(peerId: string, msg: GossipMessage): boolean {
    const peer = this.peers.get(peerId);
    if (peer && peer.dc && peer.dc.readyState === 'open') {
      peer.dc.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /**
   * Broadcasts a message to all connected WebRTC peers
   */
  public broadcast(msg: GossipMessage): number {
    let sentCount = 0;
    const jsonStr = JSON.stringify(msg);
    for (const peer of this.peers.values()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        peer.dc.send(jsonStr);
        sentCount++;
      }
    }
    return sentCount;
  }

  public getConnectedPeers(): PeerNode[] {
    const list: PeerNode[] = [];
    for (const peer of this.peers.values()) {
      if (peer.dc && peer.dc.readyState === 'open') {
        list.push(peer.node);
      }
    }
    return list;
  }

  public disconnectAll(): void {
    for (const peer of this.peers.values()) {
      try {
        if (peer.dc) peer.dc.close();
        peer.pc.close();
      } catch {}
    }
    this.peers.clear();
  }
}
