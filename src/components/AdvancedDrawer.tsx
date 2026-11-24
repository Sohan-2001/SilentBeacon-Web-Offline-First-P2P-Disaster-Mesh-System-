// SilentBeacon Google-Style Navigation Drawer for Advanced Tools & Settings
import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  BookOpen, 
  HeartPulse, 
  Database, 
  User, 
  Radio, 
  Shield,
  Zap,
  Wifi,
  Clock
} from 'lucide-react';

import { MeshNetworkView } from './MeshNetworkView';
import { DisasterToolsView } from './DisasterToolsView';
import { PeerNode, MeshEventLog, DistressTicket } from '../types';
import { WebRTCManager } from '../services/webrtc';
import { AudioModem } from '../services/audioModem';
import { NFCService } from '../services/nfc';

interface AdvancedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  onUpdateNodeName: (name: string) => void;
  lamport: number;
  vectorClock: Record<string, number>;
  peers: PeerNode[];
  logs: MeshEventLog[];
  tickets: DistressTicket[];
  isTorchActive: boolean;
  onToggleTorch: () => void;
  webrtcManager: WebRTCManager | null;
  audioModem: AudioModem | null;
  nfcService: NFCService | null;
  onOpenQRModal: (mode: 'display' | 'scan', title: string, data?: string, onScanned?: (data: string) => void) => void;
  onTransmitAcoustic: (ticket: DistressTicket) => void;
  onBroadcastTriageTicket: (ticket: any) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export type DrawerSection = 'mesh' | 'tools' | 'settings' | 'about';

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  onUpdateNodeName,
  lamport,
  vectorClock,
  peers,
  logs,
  tickets,
  isTorchActive,
  onToggleTorch,
  webrtcManager,
  audioModem,
  nfcService,
  onOpenQRModal,
  onTransmitAcoustic,
  onBroadcastTriageTicket,
  onRefreshData
}) => {
  const [activeSection, setActiveSection] = useState<DrawerSection>('mesh');
  const [editingName, setEditingName] = useState<string>(nodeName);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const connectedPeers = peers.filter(p => p.status === 'connected');

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingName.trim()) {
      onUpdateNodeName(editingName.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const navItems: { key: DrawerSection; label: string; icon: any; badge?: number }[] = [
    { key: 'mesh', label: 'P2P Mesh Network', icon: Share2, badge: connectedPeers.length },
    { key: 'tools', label: 'Triage & Survival Guide', icon: HeartPulse },
    { key: 'settings', label: 'Device & Storage', icon: User },
    { key: 'about', label: 'About SilentBeacon', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" 
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-xl sm:max-w-2xl bg-white dark:bg-[#000000] text-slate-800 dark:text-slate-100 h-full flex flex-col shadow-2xl border-r border-slate-200 dark:border-slate-850 z-10 overflow-hidden">
        
        {/* Drawer Header (Google-style) */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-md shadow-red-600/30">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Advanced Menu</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                P2P Radio, Diagnostics & Field Tools
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Utilities Bar (Flashlight, Connected Peers, Node Clocks) */}
        <div className="p-3.5 bg-slate-100 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          {/* Flashlight toggle */}
          <button
            onClick={onToggleTorch}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border font-bold transition-all ${
              isTorchActive
                ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300 shadow-sm'
                : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Zap className={`w-4 h-4 ${isTorchActive ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{isTorchActive ? 'Flashlight ON' : 'Turn On Flashlight'}</span>
          </button>

          {/* Quick Node & Peer stats */}
          <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center space-x-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-500 inline" />
              <span className="font-bold text-slate-700 dark:text-slate-200">{connectedPeers.length} Peers</span>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-cyan-500 inline" />
              <span>L-{lamport}</span>
            </span>
          </div>
        </div>

        {/* Navigation Pills (Google style horizontal segmented tabs) */}
        <div className="flex items-center space-x-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar bg-slate-50 dark:bg-slate-950/40">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-[#000000]">
          {activeSection === 'mesh' && (
            <MeshNetworkView
              nodeId={nodeId}
              nodeName={nodeName}
              lamport={lamport}
              peers={peers}
              logs={logs}
              webrtcManager={webrtcManager}
              audioModem={audioModem}
              nfcService={nfcService}
              tickets={tickets}
              onOpenQRModal={onOpenQRModal}
              onTransmitAcoustic={onTransmitAcoustic}
            />
          )}

          {activeSection === 'tools' && (
            <DisasterToolsView
              nodeId={nodeId}
              nodeName={nodeName}
              lamport={lamport}
              vectorClock={vectorClock}
              tickets={tickets}
              onBroadcastTriageTicket={onBroadcastTriageTicket}
              onRefreshData={onRefreshData}
            />
          )}

          {activeSection === 'settings' && (
            <div className="max-w-md mx-auto space-y-5 animate-fade-in">
              {/* Node Identity Form */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                  <User className="w-4 h-4 text-sky-500" />
                  <span>Responder / Node Identity</span>
                </h3>

                <form onSubmit={handleSaveName} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Node Call Sign / Name
                    </label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="e.g. Volunteer-Unit-3"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>

                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 space-y-1 pt-1">
                    <div>Hardware Unique ID: <span className="font-bold text-slate-700 dark:text-slate-200">{nodeId}</span></div>
                    <div>Monotonic Lamport Clock: <span className="font-bold text-emerald-600 dark:text-emerald-400">L-{lamport}</span></div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors shadow-sm"
                  >
                    {isSaved ? '✓ Call Sign Updated!' : 'Save Call Sign'}
                  </button>
                </form>
              </div>

              {/* Offline Storage Status */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 text-xs">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-500" />
                  <span>Local-First IndexedDB Storage</span>
                </h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  All distress signals, peer state, and CRDT clocks are stored strictly on this device's persistent browser storage. No cloud dependencies.
                </p>
                <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{tickets.length}</div>
                    <div className="text-[10px] text-slate-400">Stored Incidents</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{peers.length}</div>
                    <div className="text-[10px] text-slate-400">Mesh Peer Records</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'about' && (
            <div className="max-w-md mx-auto space-y-4 text-xs animate-fade-in text-slate-600 dark:text-slate-400">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  SilentBeacon Disaster Coordination System
                </h3>
                <p className="leading-relaxed">
                  Originally engineered for the global <strong>Code for Change Hackathon</strong>, SilentBeacon eliminates reliance on cellular towers, fiber backbones, and external power infrastructure.
                </p>
                <p className="leading-relaxed">
                  Using <strong>WebRTC DataChannels</strong>, <strong>Acoustic Audio Modems</strong>, and <strong>Conflict-Free Replicated Data Types (CRDTs)</strong>, tickets physically hop from phone to phone as people move across the disaster zone.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white block">Offline Installation:</span>
                <p>
                  To use this offline, tap <strong>"Add to Home Screen"</strong> in your mobile browser. Once installed, it boots and runs seamlessly in Airplane Mode.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
