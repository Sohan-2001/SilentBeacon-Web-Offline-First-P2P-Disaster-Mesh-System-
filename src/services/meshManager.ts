// SilentBeacon Central Epidemic Gossip & Multi-Modal Mesh Orchestrator
import { DistressTicket, GossipMessage, MeshEventLog, PeerNode, TicketSummary } from '../types';
import { CRDTEngine } from './crdt';
import { WebRTCManager } from './webrtc';
import { AudioModem, AcousticPacket } from './audioModem';
import { NFCService } from './nfc';
import * as db from './db';

export interface MeshEventCallbacks {
  onTicketsUpdated: (tickets: DistressTicket[]) => void;
  onPeersUpdated: (peers: PeerNode[]) => void;
  onLogAdded: (log: MeshEventLog) => void;
  onCriticalAlarmTrigger: (ticket: DistressTicket) => void;
}

export class MeshNetworkManager {
  private nodeId: string = '';
  private nodeName: string = '';
  private crdt: CRDTEngine | null = null;
  private webrtc: WebRTCManager | null = null;
  private audioModem: AudioModem | null = null;
  private nfc: NFCService | null = null;
  private broadcastChan: BroadcastChannel | null = null;
  private callbacks: MeshEventCallbacks;
  private knownPeers: Map<string, PeerNode> = new Map();
  private gossipTimer: any = null;
  private isInitialized: boolean = false;

  constructor(callbacks: MeshEventCallbacks) {
    this.callbacks = callbacks;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // Load or generate identity
    const identity = await db.getNodeIdentity();
    this.nodeId = identity.nodeId;
    this.nodeName = identity.nodeName;

    // Initialize CRDT Engine
    this.crdt = new CRDTEngine(
      this.nodeId,
      this.nodeName,
      identity.lamport,
      identity.vectorClock
    );

    // Initialize WebRTC
    this.webrtc = new WebRTCManager(this.nodeId, this.nodeName, {
      onMessage: (peerId, msg) => this.handleIncomingMessage(peerId, msg, 'webrtc'),
      onStateChange: (peerId, state) => this.handlePeerStateChange(peerId, state, 'webrtc'),
      onError: (peerId, err) => this.logEvent('ERROR', `WebRTC error with ${peerId}: ${err?.message || err}`)
    });

    // Initialize BroadcastChannel for multi-tab / local browser communication
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChan = new BroadcastChannel('silentbeacon-mesh-channel');
      this.broadcastChan.onmessage = (event) => {
        try {
          const msg: GossipMessage = event.data;
          if (msg && msg.senderId && msg.senderId !== this.nodeId) {
            this.handleIncomingMessage(msg.senderId, msg, 'broadcast');
          }
        } catch (e) {
          console.error('BroadcastChannel message error:', e);
        }
      };
    }

    // Initialize Acoustic Modem
    this.audioModem = new AudioModem((packet) => this.handleAcousticPacket(packet));

    // Initialize NFC
    this.nfc = new NFCService((ticket) => this.handleNFCTicket(ticket));

    // Start background gossip sweep every 8 seconds
    this.gossipTimer = setInterval(() => {
      this.sendGossipHeartbeat();
    }, 8000);

    this.isInitialized = true;
    await this.logEvent('DISCOVERY', `Node ${this.nodeName} (${this.nodeId}) online in offline-first mesh mode.`);
    
    // Broadcast presence to local peers
    this.sendGossipHeartbeat();
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getNodeName(): string {
    return this.nodeName;
  }

  public getCRDTEngine(): CRDTEngine | null {
    return this.crdt;
  }

  public getWebRTCManager(): WebRTCManager | null {
    return this.webrtc;
  }

  public getAudioModem(): AudioModem | null {
    return this.audioModem;
  }

  public getNFCService(): NFCService | null {
    return this.nfc;
  }

  /**
   * Post a new distress ticket or update existing ticket locally
   */
  public async postTicket(
    ticketData: Omit<
      DistressTicket,
      'id' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt' | 'lamportTimestamp' | 'vectorClock' | 'hopCount' | 'relayHistory' | 'comments'
    >
  ): Promise<DistressTicket> {
    if (!this.crdt) throw new Error('Mesh not initialized');

    const lamport = this.crdt.tick();
    const now = Date.now();
    const id = 'TICKET-' + now + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const newTicket: DistressTicket = {
      ...ticketData,
      id,
      authorId: this.nodeId,
      authorName: this.nodeName,
      createdAt: now,
      updatedAt: now,
      lamportTimestamp: lamport,
      vectorClock: this.crdt.getVectorClock(),
      hopCount: 0,
      relayHistory: [this.nodeId],
      comments: []
    };

    await db.saveTicket(newTicket);
    await db.saveClocks(this.crdt.getLamport(), this.crdt.getVectorClock());

    await this.logEvent(
      'CRDT_MERGE',
      `Created distress ticket: [${newTicket.urgency}] ${newTicket.title} (Lamport: ${lamport})`
    );

    // Refresh tickets in UI
    const allTickets = await db.getAllTickets();
    this.callbacks.onTicketsUpdated(allTickets);

    // Immediately flood/broadcast to mesh
    this.broadcastGossipMessage({
      type: newTicket.urgency === 'CRITICAL' ? 'CRITICAL_ALERT' : 'DELTA_RESP',
      senderId: this.nodeId,
      senderName: this.nodeName,
      lamport,
      vectorClock: this.crdt.getVectorClock(),
      timestamp: now,
      payload: [newTicket]
    });

    // If critical urgency, trigger local alarm as well
    if (newTicket.urgency === 'CRITICAL' && newTicket.status === 'OPEN') {
      this.callbacks.onCriticalAlarmTrigger(newTicket);
    }

    return newTicket;
  }

  /**
   * Update status (e.g. OPEN -> IN_PROGRESS -> RESOLVED) or claim ticket
   */
  public async updateTicketStatus(ticketId: string, newStatus: DistressTicket['status'], note?: string): Promise<DistressTicket | null> {
    if (!this.crdt) return null;
    const existing = await db.getTicketById(ticketId);
    if (!existing) return null;

    const lamport = this.crdt.tick();
    const now = Date.now();

    const comments = [...existing.comments];
    if (note) {
      comments.push({
        id: 'c-' + now + '-' + Math.random().toString(36).substring(2, 6),
        authorId: this.nodeId,
        authorName: this.nodeName,
        text: note,
        timestamp: now,
        lamport
      });
    }

    const updated: DistressTicket = {
      ...existing,
      status: newStatus,
      updatedAt: now,
      lamportTimestamp: lamport,
      vectorClock: {
        ...existing.vectorClock,
        [this.nodeId]: lamport
      },
      comments,
      assignedRescuer: newStatus === 'IN_PROGRESS' ? {
        id: this.nodeId,
        name: this.nodeName,
        assignedAt: now
      } : existing.assignedRescuer
    };

    await db.saveTicket(updated);
    await db.saveClocks(this.crdt.getLamport(), this.crdt.getVectorClock());

    await this.logEvent(
      'CRDT_MERGE',
      `Updated ticket ${updated.id.slice(0, 8)} status to ${newStatus} (Lamport: ${lamport})`
    );

    const all = await db.getAllTickets();
    this.callbacks.onTicketsUpdated(all);

    // Propagate state update
    this.broadcastGossipMessage({
      type: 'DELTA_RESP',
      senderId: this.nodeId,
      senderName: this.nodeName,
      lamport,
      vectorClock: this.crdt.getVectorClock(),
      timestamp: now,
      payload: [updated]
    });

    return updated;
  }

  /**
   * Process incoming Epidemic Gossip Message from any transport
   */
  private async handleIncomingMessage(
    senderId: string,
    msg: GossipMessage,
    transport: 'webrtc' | 'broadcast' | 'acoustic' | 'nfc'
  ): Promise<void> {
    if (!this.crdt) return;

    // Track or update peer in active registry
    this.updatePeerRecord(senderId, msg.senderName, transport, msg.vectorClock);

    switch (msg.type) {
      case 'PING': {
        // Reply with PONG and our digest
        const tickets = await db.getAllTickets();
        const digest = this.crdt.generateDigest(tickets);
        this.sendMessageToPeer(senderId, {
          type: 'PONG',
          senderId: this.nodeId,
          senderName: this.nodeName,
          lamport: this.crdt.getLamport(),
          vectorClock: this.crdt.getVectorClock(),
          timestamp: Date.now(),
          payload: digest
        }, transport);
        break;
      }

      case 'PONG':
      case 'DIGEST_RESP': {
        // Remote sent its ticket digest (Phase 1)
        const remoteDigest: TicketSummary[] = msg.payload || [];
        const localTickets = await db.getAllTickets();
        const diff = this.crdt.computeGossipDiff(localTickets, remoteDigest);

        // If remote has tickets we need, request them (Phase 2)
        if (diff.ticketsToRequest.length > 0) {
          this.sendMessageToPeer(senderId, {
            type: 'DELTA_REQ',
            senderId: this.nodeId,
            senderName: this.nodeName,
            lamport: this.crdt.getLamport(),
            vectorClock: this.crdt.getVectorClock(),
            timestamp: Date.now(),
            payload: diff.ticketsToRequest
          }, transport);
        }

        // If we have tickets remote needs, offer/send them
        if (diff.ticketsToOffer.length > 0) {
          this.sendMessageToPeer(senderId, {
            type: 'DELTA_RESP',
            senderId: this.nodeId,
            senderName: this.nodeName,
            lamport: this.crdt.getLamport(),
            vectorClock: this.crdt.getVectorClock(),
            timestamp: Date.now(),
            payload: diff.ticketsToOffer
          }, transport);
        }
        break;
      }

      case 'DIGEST_REQ': {
        // Remote wants our digest
        const tickets = await db.getAllTickets();
        const digest = this.crdt.generateDigest(tickets);
        this.sendMessageToPeer(senderId, {
          type: 'DIGEST_RESP',
          senderId: this.nodeId,
          senderName: this.nodeName,
          lamport: this.crdt.getLamport(),
          vectorClock: this.crdt.getVectorClock(),
          timestamp: Date.now(),
          payload: digest
        }, transport);
        break;
      }

      case 'DELTA_REQ': {
        // Remote specifically requests tickets with given IDs
        const requestedIds: string[] = msg.payload || [];
        const ticketsToSend: DistressTicket[] = [];
        for (const id of requestedIds) {
          const t = await db.getTicketById(id);
          if (t) ticketsToSend.push(t);
        }

        if (ticketsToSend.length > 0) {
          this.sendMessageToPeer(senderId, {
            type: 'DELTA_RESP',
            senderId: this.nodeId,
            senderName: this.nodeName,
            lamport: this.crdt.getLamport(),
            vectorClock: this.crdt.getVectorClock(),
            timestamp: Date.now(),
            payload: ticketsToSend
          }, transport);
        }
        break;
      }

      case 'CRITICAL_ALERT':
      case 'DELTA_RESP': {
        // Actual tickets received! Merge via CRDT
        const incomingTickets: DistressTicket[] = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
        let anyAlarms = false;
        let alarmTicket: DistressTicket | null = null;
        let ticketsChanged = false;

        for (const incoming of incomingTickets) {
          if (!incoming || !incoming.id) continue;
          const local = await db.getTicketById(incoming.id);
          const mergeResult = this.crdt.mergeTicket(local, incoming);

          if (mergeResult.isUpdated || mergeResult.isNew) {
            await db.saveTicket(mergeResult.result);
            ticketsChanged = true;

            await this.logEvent(
              'CRDT_MERGE',
              `Gossip hop from ${msg.senderName}: Merged ${mergeResult.result.id.slice(0, 8)} [Hops: ${mergeResult.result.hopCount}]`
            );

            if (mergeResult.alarmTriggerNeeded) {
              anyAlarms = true;
              alarmTicket = mergeResult.result;
            }

            // Epidemic Forwarding: propagate to other peers (avoid loops)
            this.forwardTicketToOtherPeers(mergeResult.result, senderId);
          }
        }

        if (ticketsChanged) {
          await db.saveClocks(this.crdt.getLamport(), this.crdt.getVectorClock());
          const all = await db.getAllTickets();
          this.callbacks.onTicketsUpdated(all);
        }

        if (anyAlarms && alarmTicket) {
          await this.logEvent(
            'CRITICAL_ALARM',
            `EMERGENCY SIREN TRIGGERED: Critical SOS received from ${alarmTicket.authorName}`
          );
          this.callbacks.onCriticalAlarmTrigger(alarmTicket);
        }
        break;
      }
    }
  }

  /**
   * Forwards a ticket to other peers, checking relay history to prevent duplicate loops
   */
  private forwardTicketToOtherPeers(ticket: DistressTicket, originPeerId: string): void {
    // Only forward if TTL / hop limit not exceeded
    if (ticket.hopCount > 10) return;

    const forwardMsg: GossipMessage = {
      type: ticket.urgency === 'CRITICAL' ? 'CRITICAL_ALERT' : 'DELTA_RESP',
      senderId: this.nodeId,
      senderName: this.nodeName,
      lamport: this.crdt?.getLamport() || 0,
      vectorClock: this.crdt?.getVectorClock() || {},
      timestamp: Date.now(),
      payload: [ticket]
    };

    // Forward over WebRTC to other peers
    if (this.webrtc) {
      for (const peer of this.webrtc.getConnectedPeers()) {
        if (peer.id !== originPeerId && !ticket.relayHistory.includes(peer.id)) {
          this.webrtc.send(peer.id, forwardMsg);
        }
      }
    }

    // Broadcast on local channel
    if (this.broadcastChan) {
      this.broadcastChan.postMessage(forwardMsg);
    }
  }

  /**
   * Handles ticket received over physical acoustic sound modem
   */
  private async handleAcousticPacket(packet: AcousticPacket): Promise<void> {
    if (!this.crdt) return;
    await this.logEvent(
      'SYNC',
      `Acoustic sound beacon decoded: [${packet.urgency}] ${packet.casualties} casualties (Lamport: ${packet.lamport})`,
      packet
    );

    const syntheticTicket: DistressTicket = {
      id: packet.id,
      authorId: 'ACOUSTIC-PEER',
      authorName: 'Acoustic Beacon',
      urgency: packet.urgency,
      category: 'MEDICAL',
      status: 'OPEN',
      title: `Acoustic SOS: ${packet.casualties} casualty at coordinates`,
      description: `Disaster beacon received over physical sound frequencies without radio.`,
      casualties: packet.casualties,
      location: {
        latitude: packet.lat,
        longitude: packet.lng,
        accuracy: 50,
        landmark: 'Acoustic Sound Beacon Area'
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lamportTimestamp: packet.lamport,
      vectorClock: { ['ACOUSTIC-PEER']: packet.lamport },
      hopCount: 1,
      relayHistory: ['ACOUSTIC-PEER', this.nodeId],
      comments: []
    };

    const local = await db.getTicketById(syntheticTicket.id);
    const merged = this.crdt.mergeTicket(local, syntheticTicket);
    if (merged.isUpdated || merged.isNew) {
      await db.saveTicket(merged.result);
      const all = await db.getAllTickets();
      this.callbacks.onTicketsUpdated(all);

      if (merged.alarmTriggerNeeded) {
        this.callbacks.onCriticalAlarmTrigger(merged.result);
      }
    }
  }

  /**
   * Handles ticket received over NFC tap
   */
  private async handleNFCTicket(ticket: DistressTicket): Promise<void> {
    if (!this.crdt) return;
    await this.logEvent('SYNC', `NFC Tap detected: Syncing ticket ${ticket.id.slice(0, 8)}`);
    const local = await db.getTicketById(ticket.id);
    const merged = this.crdt.mergeTicket(local, ticket);
    if (merged.isUpdated || merged.isNew) {
      await db.saveTicket(merged.result);
      const all = await db.getAllTickets();
      this.callbacks.onTicketsUpdated(all);
      if (merged.alarmTriggerNeeded) {
        this.callbacks.onCriticalAlarmTrigger(merged.result);
      }
    }
  }

  private handlePeerStateChange(peerId: string, state: 'connected' | 'handshaking' | 'disconnected', transport: string) {
    const existing = this.knownPeers.get(peerId);
    if (existing) {
      existing.status = state;
      existing.lastSeen = Date.now();
    }
    this.logEvent(
      state === 'connected' ? 'HANDSHAKE' : 'DISCOVERY',
      `Peer ${peerId} state changed to ${state} (${transport})`
    );
    this.callbacks.onPeersUpdated(Array.from(this.knownPeers.values()));

    if (state === 'connected') {
      // Immediately initiate Phase 1 Epidemic Gossip Handshake
      this.startGossipWithPeer(peerId, transport as any);
    }
  }

  public async startGossipWithPeer(peerId: string, transport: 'webrtc' | 'broadcast'): Promise<void> {
    if (!this.crdt) return;
    const tickets = await db.getAllTickets();
    const digest = this.crdt.generateDigest(tickets);

    const msg: GossipMessage = {
      type: 'DIGEST_REQ',
      senderId: this.nodeId,
      senderName: this.nodeName,
      lamport: this.crdt.getLamport(),
      vectorClock: this.crdt.getVectorClock(),
      timestamp: Date.now(),
      payload: digest
    };

    this.sendMessageToPeer(peerId, msg, transport);
  }

  private sendGossipHeartbeat(): void {
    if (!this.crdt) return;
    // Broadcast heartbeat ping on BroadcastChannel
    if (this.broadcastChan) {
      this.broadcastChan.postMessage({
        type: 'PING',
        senderId: this.nodeId,
        senderName: this.nodeName,
        lamport: this.crdt.getLamport(),
        vectorClock: this.crdt.getVectorClock(),
        timestamp: Date.now()
      } as GossipMessage);
    }

    // Ping WebRTC peers
    if (this.webrtc) {
      this.webrtc.broadcast({
        type: 'PING',
        senderId: this.nodeId,
        senderName: this.nodeName,
        lamport: this.crdt.getLamport(),
        vectorClock: this.crdt.getVectorClock(),
        timestamp: Date.now()
      });
    }
  }

  private sendMessageToPeer(peerId: string, msg: GossipMessage, transport: 'webrtc' | 'broadcast' | 'acoustic' | 'nfc'): void {
    if (transport === 'webrtc' && this.webrtc) {
      this.webrtc.send(peerId, msg);
    } else if (transport === 'broadcast' && this.broadcastChan) {
      this.broadcastChan.postMessage(msg);
    }
  }

  private broadcastGossipMessage(msg: GossipMessage): void {
    if (this.webrtc) {
      this.webrtc.broadcast(msg);
    }
    if (this.broadcastChan) {
      this.broadcastChan.postMessage(msg);
    }
  }

  private updatePeerRecord(id: string, name: string, transport: any, vectorClock: Record<string, number>): void {
    const existing = this.knownPeers.get(id);
    const peer: PeerNode = {
      id,
      name: name || (existing ? existing.name : 'Beacon-' + id.slice(-4)),
      transport: transport || (existing ? existing.transport : 'broadcast'),
      status: 'connected',
      lastSeen: Date.now(),
      vectorClock: vectorClock || {},
      syncedTicketsCount: (existing ? existing.syncedTicketsCount : 0) + 1
    };
    this.knownPeers.set(id, peer);
    this.callbacks.onPeersUpdated(Array.from(this.knownPeers.values()));
  }

  public getKnownPeers(): PeerNode[] {
    return Array.from(this.knownPeers.values());
  }

  private async logEvent(type: MeshEventLog['type'], message: string, details?: any): Promise<void> {
    const log = await db.addLog({
      timestamp: Date.now(),
      type,
      message,
      details
    });
    this.callbacks.onLogAdded(log);
  }

  public cleanup(): void {
    if (this.gossipTimer) clearInterval(this.gossipTimer);
    if (this.webrtc) this.webrtc.disconnectAll();
    if (this.audioModem) this.audioModem.stopListening();
    if (this.nfc) this.nfc.stop();
    if (this.broadcastChan) this.broadcastChan.close();
  }
}
