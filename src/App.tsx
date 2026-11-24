// SilentBeacon - 100% Offline P2P Emergency Mesh System (Elderly-Friendly & Clean Design)
import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  ListFilter, 
  Compass, 
  Zap, 
  Menu
} from 'lucide-react';

import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';
import { EmergencyAlertBanner } from './components/EmergencyAlertBanner';
import { SOSBroadcastView } from './components/SOSBroadcastView';
import { DistressFeedView } from './components/DistressFeedView';
import { TacticalRadarView } from './components/TacticalRadarView';
import { AdvancedDrawer } from './components/AdvancedDrawer';
import { QRModal } from './components/QRModal';

import { DistressTicket, PeerNode, MeshEventLog, TicketStatus, TicketUrgency, TicketCategory, GeoLocation } from './types';
import { HardwareManager, HardwareState } from './services/hardware';
import { MeshNetworkManager } from './services/meshManager';
import * as db from './services/db';

export function App() {
  // Day / Night mode theme (persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('silentbeacon_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return true;
    }
  });

  // Main screen 3 primary views: 'sos' | 'feed' | 'radar'
  const [activeTab, setActiveTab] = useState<ActiveTab>('sos');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Mesh & Tickets state
  const [tickets, setTickets] = useState<DistressTicket[]>([]);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [logs, setLogs] = useState<MeshEventLog[]>([]);
  const [nodeId, setNodeId] = useState<string>('');
  const [nodeName, setNodeName] = useState<string>('');
  const [lamport, setLamport] = useState<number>(0);
  const [vectorClock, setVectorClock] = useState<Record<string, number>>({});
  
  // Hardware state
  const [hardwareState, setHardwareState] = useState<HardwareState>({
    isSirenActive: false,
    isTorchActive: false,
    isWakeLocked: false,
    currentHeading: null,
    currentLocation: null
  });

  // Critical Alarm & Navigation state
  const [criticalTicket, setCriticalTicket] = useState<DistressTicket | null>(null);
  const [selectedRadarTicket, setSelectedRadarTicket] = useState<DistressTicket | null>(null);

  // QR Modal
  const [qrModal, setQrModal] = useState<{
    isOpen: boolean;
    mode: 'display' | 'scan';
    title: string;
    data?: string;
    onScanned?: (data: string) => void;
  }>({
    isOpen: false,
    mode: 'display',
    title: ''
  });

  // Manager refs
  const hardwareRef = useRef<HardwareManager | null>(null);
  const meshRef = useRef<MeshNetworkManager | null>(null);

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      try { localStorage.setItem('silentbeacon_theme', 'dark'); } catch {}
    } else {
      root.classList.remove('dark');
      try { localStorage.setItem('silentbeacon_theme', 'light'); } catch {}
    }
  }, [isDarkMode]);

  useEffect(() => {
    // 1. Initialize Hardware Manager
    const hw = new HardwareManager((state) => {
      setHardwareState(state);
    });
    hardwareRef.current = hw;
    hw.startLocationTracking();
    hw.startOrientationTracking();

    // 2. Initialize Mesh Network Manager
    const mesh = new MeshNetworkManager({
      onTicketsUpdated: (updatedTickets) => {
        setTickets(updatedTickets);
      },
      onPeersUpdated: (updatedPeers) => {
        setPeers(updatedPeers);
      },
      onLogAdded: (newLog) => {
        setLogs((prev) => [newLog, ...prev.slice(0, 150)]);
      },
      onCriticalAlarmTrigger: (ticket) => {
        setCriticalTicket(ticket);
        hw.triggerCriticalSiren();
      }
    });
    meshRef.current = mesh;

    async function bootstrap() {
      await mesh.init();
      setNodeId(mesh.getNodeId());
      setNodeName(mesh.getNodeName());
      if (mesh.getCRDTEngine()) {
        setLamport(mesh.getCRDTEngine()!.getLamport());
        setVectorClock(mesh.getCRDTEngine()!.getVectorClock());
      }

      // Check existing tickets in IndexedDB
      let existing = await db.getAllTickets();
      if (existing.length === 0) {
        const baseLat = 22.5726;
        const baseLng = 88.3639;

        await mesh.postTicket({
          urgency: 'CRITICAL',
          category: 'TRAPPED',
          status: 'OPEN',
          title: '3 people trapped under collapsed roof beam',
          description: 'Concrete slab fell. Oxygen low. Extraction jack needed.',
          casualties: 3,
          location: {
            latitude: baseLat + 0.0012,
            longitude: baseLng + 0.0009,
            accuracy: 8,
            landmark: 'Blue building, Ground Floor'
          },
          contactInfo: 'VHF Ch 14'
        });

        await mesh.postTicket({
          urgency: 'HIGH',
          category: 'MEDICAL',
          status: 'OPEN',
          title: 'Diabetic patient needs urgent cold-chain insulin',
          description: 'Type 1 diabetic patient showing severe weakness.',
          casualties: 1,
          location: {
            latitude: baseLat - 0.0015,
            longitude: baseLng + 0.0018,
            accuracy: 12,
            landmark: 'House #14 near Sector 3'
          },
          contactInfo: 'Channel 7 UHF'
        });

        await mesh.postTicket({
          urgency: 'MEDIUM',
          category: 'WATER_FOOD',
          status: 'OPEN',
          title: 'Flood water rising, 8 people stranded on roof',
          description: 'Need clean drinking water and evacuation.',
          casualties: 8,
          location: {
            latitude: baseLat + 0.0025,
            longitude: baseLng - 0.0014,
            accuracy: 15,
            landmark: 'Community Hall Rooftop'
          }
        });

        existing = await db.getAllTickets();
      }

      setTickets(existing);
      const allLogs = await db.getAllLogs();
      setLogs(allLogs);
      setPeers(mesh.getKnownPeers());
    }

    bootstrap();

    return () => {
      hw.cleanup();
      mesh.cleanup();
    };
  }, []);

  // Sync Lamport clock from engine periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (meshRef.current?.getCRDTEngine()) {
        setLamport(meshRef.current.getCRDTEngine()!.getLamport());
        setVectorClock(meshRef.current.getCRDTEngine()!.getVectorClock());
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Broadcast SOS
  const handleBroadcastSOS = async (ticketData: {
    urgency: TicketUrgency;
    category: TicketCategory;
    title: string;
    description: string;
    casualties: number;
    location: GeoLocation;
    contactInfo?: string;
    status: TicketStatus;
  }) => {
    if (!meshRef.current) return;
    await meshRef.current.postTicket(ticketData);
    hardwareRef.current?.vibrateFeedback('success');
  };

  // Update Status
  const handleUpdateTicketStatus = async (ticketId: string, status: TicketStatus, note?: string) => {
    if (!meshRef.current) return;
    await meshRef.current.updateTicketStatus(ticketId, status, note);
    hardwareRef.current?.vibrateFeedback('tap');
  };

  // Update Node Name
  const handleUpdateNodeName = async (name: string) => {
    await db.saveNodeIdentity(name);
    setNodeName(name);
  };

  // Silence Siren
  const handleSilenceSiren = () => {
    hardwareRef.current?.stopCriticalSiren();
    setCriticalTicket(null);
  };

  // Test Siren
  const handleTestSiren = () => {
    if (hardwareState.isSirenActive) {
      hardwareRef.current?.stopCriticalSiren();
    } else {
      hardwareRef.current?.triggerCriticalSiren();
    }
  };

  // Toggle Torch
  const handleToggleTorch = () => {
    hardwareRef.current?.toggleTorch();
  };

  // Acoustic Chirp transmission
  const handleTransmitAcoustic = async (ticket: DistressTicket) => {
    if (!meshRef.current?.getAudioModem()) return;
    try {
      hardwareRef.current?.vibrateFeedback('alert');
      await meshRef.current.getAudioModem()!.transmitPacket({
        type: 'SOS_BEACON',
        id: ticket.id,
        urgency: ticket.urgency,
        category: ticket.category,
        casualties: ticket.casualties,
        lat: ticket.location.latitude,
        lng: ticket.location.longitude,
        lamport: ticket.lamportTimestamp,
        checksum: 1
      });
      alert('Acoustic distress beacon chirp transmitted through speaker!');
    } catch (err: any) {
      alert('Acoustic transmission error: ' + err.message);
    }
  };

  // Open ticket in Tactical Radar
  const handleNavigateToRadar = (ticket: DistressTicket) => {
    setSelectedRadarTicket(ticket);
    setActiveTab('radar');
  };

  // Show ticket compressed QR
  const handleShowTicketQR = (ticket: DistressTicket) => {
    const compactTicket = JSON.stringify({
      t: 'SB_TICKET',
      i: ticket.id,
      u: ticket.urgency,
      c: ticket.casualties,
      tit: ticket.title,
      lt: ticket.location.latitude,
      lg: ticket.location.longitude,
      lp: ticket.lamportTimestamp
    });
    setQrModal({
      isOpen: true,
      mode: 'display',
      title: `Air-Gap QR: ${ticket.title.slice(0, 24)}`,
      data: compactTicket
    });
  };

  const openTicketsCount = tickets.filter((t) => t.status === 'OPEN').length;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#000000] text-slate-100 tactical-grid-dark' : 'bg-[#f8fafc] text-slate-900 tactical-grid-light'} flex flex-col font-sans transition-colors duration-200 select-none`}>
      {/* Zero-Overflow Minimal Navbar */}
      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        isSirenActive={hardwareState.isSirenActive}
        onSilenceSiren={handleSilenceSiren}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onTestSiren={handleTestSiren}
      />

      {/* Autonomous Critical Broadcast Siren Banner */}
      {criticalTicket && hardwareState.isSirenActive && (
        <EmergencyAlertBanner
          criticalTicket={criticalTicket}
          onSilence={handleSilenceSiren}
          onNavigateToRadar={handleNavigateToRadar}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-12 space-y-4">
        
        {/* FOUR MAIN ACTIONS (Extremely Clean & Friendly for Anyone) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Action 1: Send SOS */}
          <button
            onClick={() => {
              setActiveTab('sos');
              hardwareRef.current?.vibrateFeedback('tap');
            }}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
              activeTab === 'sos'
                ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'sos' ? 'bg-white/20' : 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'}`}>
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xs sm:text-sm truncate">1. Send SOS</span>
              <span className={`text-[10px] hidden sm:block ${activeTab === 'sos' ? 'text-white/80' : 'text-slate-400'}`}>
                Ask for help
              </span>
            </div>
          </button>

          {/* Action 2: Nearby Signals */}
          <button
            onClick={() => {
              setActiveTab('feed');
              hardwareRef.current?.vibrateFeedback('tap');
            }}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
              activeTab === 'feed'
                ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'feed' ? 'bg-white/20' : 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'}`}>
              <ListFilter className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xs sm:text-sm truncate">
                2. Signals ({openTicketsCount})
              </span>
              <span className={`text-[10px] hidden sm:block ${activeTab === 'feed' ? 'text-white/80' : 'text-slate-400'}`}>
                See who needs help
              </span>
            </div>
          </button>

          {/* Action 3: Compass Radar */}
          <button
            onClick={() => {
              setActiveTab('radar');
              hardwareRef.current?.vibrateFeedback('tap');
            }}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
              activeTab === 'radar'
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-600/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${activeTab === 'radar' ? 'bg-white/20' : 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400'}`}>
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xs sm:text-sm truncate">3. Compass</span>
              <span className={`text-[10px] hidden sm:block ${activeTab === 'radar' ? 'text-white/80' : 'text-slate-400'}`}>
                Point to victim
              </span>
            </div>
          </button>

          {/* Action 4: Emergency Flashlight Toggle */}
          <button
            onClick={() => {
              handleToggleTorch();
              hardwareRef.current?.vibrateFeedback('alert');
            }}
            className={`p-3 sm:p-4 rounded-2xl border text-left transition-all flex items-center space-x-3 ${
              hardwareState.isTorchActive
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
            }`}
          >
            <div className={`p-2 rounded-xl flex-shrink-0 ${hardwareState.isTorchActive ? 'bg-white/20' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-500'}`}>
              <Zap className={`w-5 h-5 ${hardwareState.isTorchActive ? 'fill-white text-white' : ''}`} />
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xs sm:text-sm truncate">
                {hardwareState.isTorchActive ? 'Light: ON' : '4. Flashlight'}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:block">
                For dark rooms
              </span>
            </div>
          </button>
        </div>

        {/* ACTIVE PRIMARY VIEW CONTENT */}
        <div className="pt-2">
          {activeTab === 'sos' && (
            <div className="max-w-2xl mx-auto">
              <SOSBroadcastView
                currentLocation={hardwareState.currentLocation}
                onBroadcastSOS={handleBroadcastSOS}
                onSuccessNavigateToFeed={() => setActiveTab('feed')}
              />
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="max-w-3xl mx-auto">
              <DistressFeedView
                tickets={tickets}
                currentLocation={hardwareState.currentLocation}
                onUpdateStatus={handleUpdateTicketStatus}
                onNavigateToRadar={handleNavigateToRadar}
                onTransmitAcoustic={handleTransmitAcoustic}
                onShowTicketQR={handleShowTicketQR}
              />
            </div>
          )}

          {activeTab === 'radar' && (
            <div className="max-w-3xl mx-auto">
              <TacticalRadarView
                tickets={tickets}
                selectedTicket={selectedRadarTicket}
                onSelectTicket={(t) => setSelectedRadarTicket(t)}
                currentLocation={hardwareState.currentLocation}
                currentHeading={hardwareState.currentHeading}
                onPlayRadarPing={(dist) => hardwareRef.current?.playRadarPing(dist)}
                isDarkMode={isDarkMode}
              />
            </div>
          )}
        </div>

      </main>

      {/* Mobile Bottom Navigation Bar (Hidden on desktop) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          hardwareRef.current?.vibrateFeedback('tap');
        }}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        openTicketsCount={openTicketsCount}
      />

      {/* Advanced Google-Style Drawer (for P2P Mesh Transports, Triage & Survival Tools) */}
      <AdvancedDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        nodeId={nodeId}
        nodeName={nodeName}
        onUpdateNodeName={handleUpdateNodeName}
        lamport={lamport}
        vectorClock={vectorClock}
        peers={peers}
        logs={logs}
        tickets={tickets}
        isTorchActive={hardwareState.isTorchActive}
        onToggleTorch={handleToggleTorch}
        webrtcManager={meshRef.current?.getWebRTCManager() || null}
        audioModem={meshRef.current?.getAudioModem() || null}
        nfcService={meshRef.current?.getNFCService() || null}
        onOpenQRModal={(mode, title, data, onScanned) => {
          setQrModal({
            isOpen: true,
            mode,
            title,
            data,
            onScanned
          });
        }}
        onTransmitAcoustic={handleTransmitAcoustic}
        onBroadcastTriageTicket={handleBroadcastSOS}
        onRefreshData={async () => {
          const all = await db.getAllTickets();
          setTickets(all);
        }}
      />

      {/* Air-Gap QR Modal */}
      {qrModal.isOpen && (
        <QRModal
          mode={qrModal.mode}
          title={qrModal.title}
          dataToDisplay={qrModal.data}
          onScanned={qrModal.onScanned}
          onClose={() => setQrModal({ ...qrModal, isOpen: false })}
        />
      )}
    </div>
  );
}

export default App;
