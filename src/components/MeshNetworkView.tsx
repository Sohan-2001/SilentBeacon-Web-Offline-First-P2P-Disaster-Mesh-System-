// SilentBeacon Multi-Modal P2P Mesh Network Hub & Topology Inspector
import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  Radio, 
  QrCode, 
  Volume2, 
  Nfc, 
  CheckCircle, 
  Activity, 
  Users, 
  Terminal, 
  Mic, 
  Camera 
} from 'lucide-react';
import { PeerNode, MeshEventLog, DistressTicket } from '../types';
import { WebRTCManager } from '../services/webrtc';
import { AudioModem } from '../services/audioModem';
import { NFCService } from '../services/nfc';

interface MeshNetworkViewProps {
  nodeId: string;
  nodeName: string;
  lamport: number;
  peers: PeerNode[];
  logs: MeshEventLog[];
  webrtcManager: WebRTCManager | null;
  audioModem: AudioModem | null;
  nfcService: NFCService | null;
  tickets: DistressTicket[];
  onOpenQRModal: (mode: 'display' | 'scan', title: string, data?: string, onScanned?: (data: string) => void) => void;
  onTransmitAcoustic: (ticket: DistressTicket) => void;
}

export const MeshNetworkView: React.FC<MeshNetworkViewProps> = ({
  nodeId,
  nodeName,
  lamport,
  peers,
  logs,
  webrtcManager,
  audioModem,
  nfcService,
  tickets,
  onOpenQRModal,
  onTransmitAcoustic
}) => {
  const [isAcousticListening, setIsAcousticListening] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'transports' | 'peers' | 'logs'>('transports');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Toggle Acoustic Listening
  const handleToggleAcousticListen = async () => {
    if (!audioModem) return;
    if (isAcousticListening) {
      audioModem.stopListening();
      setIsAcousticListening(false);
    } else {
      const ok = await audioModem.startListening();
      setIsAcousticListening(ok);
    }
  };

  // Air-Gapped Optical QR Handshake Handlers
  const handleInitiateOffer = async () => {
    if (!webrtcManager) return;
    try {
      const { offerPayload } = await webrtcManager.createOffer();
      onOpenQRModal('display', 'Air-Gapped Mesh Offer QR', offerPayload);
    } catch (err: any) {
      alert('Failed to create offer: ' + err.message);
    }
  };

  const handleScanOfferAndAnswer = async () => {
    if (!webrtcManager) return;
    onOpenQRModal('scan', 'Scan Peer Offer QR', undefined, async (scannedOffer) => {
      try {
        const { answerPayload } = await webrtcManager.acceptOfferAndCreateAnswer(scannedOffer);
        setTimeout(() => {
          onOpenQRModal('display', 'Show Answer QR to Peer', answerPayload);
        }, 300);
      } catch (err: any) {
        alert('Failed to process offer: ' + err.message);
      }
    });
  };

  const handleScanAnswer = async () => {
    if (!webrtcManager) return;
    onOpenQRModal('scan', 'Scan Peer Answer QR', undefined, async (scannedAnswer) => {
      try {
        await webrtcManager.finalizeAnswer('', scannedAnswer);
        alert('Air-gapped handshake complete! P2P socket connected.');
      } catch (err: any) {
        alert('Failed to finalize answer: ' + err.message);
      }
    });
  };

  // Start NFC Scan
  const handleNFCScan = async () => {
    if (!nfcService) return;
    const ok = await nfcService.startScan();
    if (ok) {
      alert('NFC active: Tap devices together to beam distress tickets.');
    } else {
      alert('Web NFC not supported on this browser/platform. Use QR or Acoustic modem instead.');
    }
  };

  // Topology Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw local node in center
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', cx, cy + 3);

      // Connected peers in orbit
      const activePeers = peers.filter((p) => p.status === 'connected');
      const numPeers = Math.max(1, activePeers.length);
      const orbitRadius = 75;

      // Orbit track
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.2)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, orbitRadius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      angle += 0.008;

      activePeers.forEach((p, idx) => {
        const theta = angle + (idx * 2 * Math.PI) / numPeers;
        const px = cx + orbitRadius * Math.cos(theta);
        const py = cy + orbitRadius * Math.sin(theta);

        // Link line
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Traveling gossip packet dot
        const packetDist = (Math.sin(angle * 3 + idx) + 1) / 2;
        const dotX = cx + (px - cx) * packetDist;
        const dotY = cy + (py - cy) * packetDist;
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, 2 * Math.PI);
        ctx.fill();

        // Peer circle
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.fillText(p.name.slice(0, 6), px, py + 18);
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [peers]);

  return (
    <div className="space-y-4 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
              Dual-Radio & Optical P2P Mesh Hub
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Zero-internet local store-and-forward epidemic gossip layer.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 font-bold">
            Node: {nodeName}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 font-bold">
            Lamport: {lamport}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('transports')}
          className={`pb-2.5 px-4 border-b-2 transition-colors ${
            activeTab === 'transports'
              ? 'border-sky-500 text-sky-600 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Physical Transports
        </button>
        <button
          onClick={() => setActiveTab('peers')}
          className={`pb-2.5 px-4 border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'peers'
              ? 'border-sky-500 text-sky-600 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <span>Active Peers ({peers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2.5 px-4 border-b-2 transition-colors flex items-center space-x-1.5 ${
            activeTab === 'logs'
              ? 'border-sky-500 text-sky-600 dark:text-white'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Gossip Event Log</span>
        </button>
      </div>

      {/* TAB 1: TRANSPORTS */}
      {activeTab === 'transports' && (
        <div className="space-y-4">
          {/* Channel A: Air-Gapped Optical QR Handshake */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-sky-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Channel 1: Optical QR Handshake (WebRTC)
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/40 font-bold">
                Zero Infrastructure
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Establish a direct, high-bandwidth WebRTC data socket between two devices by exchanging SDP offers/answers through camera screen scans.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={handleInitiateOffer}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-sky-500" />
                <span>1. Show Offer QR</span>
              </button>

              <button
                onClick={handleScanOfferAndAnswer}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-amber-500" />
                <span>2. Scan & Answer</span>
              </button>

              <button
                onClick={handleScanAnswer}
                className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>3. Finalize Answer</span>
              </button>
            </div>
          </div>

          {/* Channel B: Acoustic Audio Modem */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Channel 2: Acoustic Sound Modem (Audio FSK)
                </h3>
              </div>
              <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                isAcousticListening
                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {isAcousticListening ? 'Mic Listening' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transmit and decode distress beacons completely over physical air space using audio tone frequency modulation (FSK). Zero radio pairing needed.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleToggleAcousticListen}
                className={`py-2 px-3.5 rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition-colors ${
                  isAcousticListening
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isAcousticListening ? 'Stop Mic Decoder' : 'Start Acoustic Decoder'}</span>
              </button>

              {tickets.length > 0 && (
                <button
                  onClick={() => onTransmitAcoustic(tickets[0])}
                  className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center space-x-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Chirp Top SOS Signal</span>
                </button>
              )}
            </div>
          </div>

          {/* Channel C: Web NFC */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Nfc className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Channel 3: Web NFC Tap-to-Sync
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-bold">
                Android Chrome
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Touch two Android phones together back-to-back to instantly transfer distress tickets and vector clock digests.
            </p>

            <button
              onClick={handleNFCScan}
              className="py-2 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center space-x-1.5 transition-colors"
            >
              <Nfc className="w-3.5 h-3.5 text-indigo-500" />
              <span>Arm NFC Reader</span>
            </button>
          </div>

          {/* Live Topology Canvas */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 dark:text-slate-200 flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>Live Epidemic Mesh Topology</span>
              </span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                {peers.filter((p) => p.status === 'connected').length} active sockets
              </span>
            </div>

            <div className="w-full h-44 bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-850 flex items-center justify-center">
              <canvas ref={canvasRef} width={340} height={176} className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PEERS */}
      {activeTab === 'peers' && (
        <div className="space-y-3">
          {peers.length === 0 ? (
            <div className="text-center py-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-1 shadow-sm">
              <Users className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No peers connected yet</p>
              <p className="text-[11px]">
                Open this app in a second browser window or scan a peer's QR code to connect.
              </p>
            </div>
          ) : (
            peers.map((peer) => (
              <div
                key={peer.id}
                className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{peer.name}</span>
                    <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {peer.transport.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-2 font-mono">
                    <span>ID: {peer.id.slice(0, 10)}</span>
                    <span>•</span>
                    <span>Last Seen: {Math.round((Date.now() - peer.lastSeen) / 1000)}s ago</span>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      peer.status === 'connected'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {peer.status}
                  </span>
                  <div className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-bold">
                    {peer.syncedTicketsCount} gossips synced
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-slate-400 text-center py-6">No logs recorded yet.</div>
          ) : (
            logs.map((log) => {
              let typeColor = 'text-slate-500';
              if (log.type === 'CRITICAL_ALARM') typeColor = 'text-red-600 dark:text-red-400 font-bold';
              else if (log.type === 'CRDT_MERGE') typeColor = 'text-emerald-600 dark:text-emerald-400';
              else if (log.type === 'HANDSHAKE') typeColor = 'text-cyan-600 dark:text-cyan-400';
              else if (log.type === 'SYNC') typeColor = 'text-amber-600 dark:text-amber-400';

              return (
                <div key={log.id} className="border-b border-slate-200 dark:border-slate-900 pb-1.5 last:border-0">
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`uppercase font-bold ${typeColor}`}>[{log.type}]</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-[11px] mt-0.5 leading-snug">
                    {log.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
