// SilentBeacon Ultra-Simple & Elderly-Accessible SOS Broadcast
import React, { useState } from 'react';
import { 
  AlertOctagon, 
  MapPin, 
  Cross, 
  Droplet, 
  Send, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { TicketCategory, TicketUrgency, TicketStatus, GeoLocation } from '../types';

interface SOSBroadcastViewProps {
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  onBroadcastSOS: (ticketData: {
    urgency: TicketUrgency;
    category: TicketCategory;
    title: string;
    description: string;
    casualties: number;
    location: GeoLocation;
    contactInfo?: string;
    status: TicketStatus;
  }) => Promise<void>;
  onSuccessNavigateToFeed: () => void;
}

export const SOSBroadcastView: React.FC<SOSBroadcastViewProps> = ({
  currentLocation,
  onBroadcastSOS,
  onSuccessNavigateToFeed
}) => {
  const [selectedQuickType, setSelectedQuickType] = useState<'trapped' | 'medical' | 'water' | 'other'>('trapped');
  const [casualties, setCasualties] = useState<number>(1);
  const [landmarkNote, setLandmarkNote] = useState<string>('');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<boolean>(false);

  // Big, friendly, 1-tap emergency choices
  const quickTypes = [
    {
      key: 'trapped' as const,
      label: 'Trapped / Danger',
      sublabel: 'Debris collapse, rising flood water',
      urgency: 'CRITICAL' as TicketUrgency,
      category: 'TRAPPED' as TicketCategory,
      defaultTitle: 'Victim trapped / in immediate danger',
      icon: AlertOctagon,
      bg: 'bg-red-600 hover:bg-red-500 text-white border-red-600',
      activeRing: 'ring-4 ring-red-300 dark:ring-red-900/60'
    },
    {
      key: 'medical' as const,
      label: 'Medical Emergency',
      sublabel: 'Severe injury, insulin / medication needed',
      urgency: 'CRITICAL' as TicketUrgency,
      category: 'MEDICAL' as TicketCategory,
      defaultTitle: 'Urgent medical trauma / medication required',
      icon: Cross,
      bg: 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600',
      activeRing: 'ring-4 ring-rose-300 dark:ring-rose-900/60'
    },
    {
      key: 'water' as const,
      label: 'Food & Clean Water',
      sublabel: 'No drinking water, stranded family',
      urgency: 'HIGH' as TicketUrgency,
      category: 'WATER_FOOD' as TicketCategory,
      defaultTitle: 'Stranded family without potable drinking water',
      icon: Droplet,
      bg: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-600',
      activeRing: 'ring-4 ring-sky-300 dark:ring-sky-900/60'
    }
  ];

  const handleQuickSend = async () => {
    setIsSubmitting(true);
    try {
      const selected = quickTypes.find((t) => t.key === selectedQuickType) || quickTypes[0];
      const title = customTitle.trim() || selected.defaultTitle;

      const location: GeoLocation = {
        latitude: currentLocation ? currentLocation.latitude : 22.5726,
        longitude: currentLocation ? currentLocation.longitude : 88.3639,
        accuracy: currentLocation ? currentLocation.accuracy : 15,
        landmark: landmarkNote.trim() || undefined
      };

      await onBroadcastSOS({
        urgency: selected.urgency,
        category: selected.category,
        title,
        description: landmarkNote.trim() ? `Note: ${landmarkNote.trim()}` : 'SOS signal sent via 1-tap emergency beacon.',
        casualties,
        location,
        status: 'OPEN'
      });

      setBroadcastSuccess(true);
      setTimeout(() => {
        setBroadcastSuccess(false);
        onSuccessNavigateToFeed();
      }, 1600);
    } catch (err) {
      console.error('Failed to broadcast SOS:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {broadcastSuccess ? (
        <div className="p-8 sm:p-10 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-3xl text-center space-y-3 animate-fade-in shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
          <h3 className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100">
            Help Signal Broadcasted!
          </h3>
          <p className="text-sm text-emerald-800 dark:text-emerald-300 max-w-md mx-auto leading-relaxed">
            Your location has been sent to all nearby phones over Bluetooth, Wi-Fi, and sound waves. Stay calm, help is on the way.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-5">
          {/* Header Title */}
          <div>
            <span className="text-[11px] font-black tracking-wider uppercase text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-3 py-1 rounded-full border border-red-200 dark:border-red-900/60 inline-block mb-2">
              Step 1: What do you need?
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Choose your emergency:
            </h2>
          </div>

          {/* 3 Giant, Unmistakable Choice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickTypes.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedQuickType === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedQuickType(item.key)}
                  className={`p-4 sm:p-5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? `${item.bg} ${item.activeRing} shadow-md scale-[1.02]`
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-base sm:text-lg leading-tight mb-1">
                      {item.label}
                    </h3>
                    <p className={`text-xs ${isSelected ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                      {item.sublabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Simple Casualties Counter & Optional Landmark */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                How many people need help?
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setCasualties(Math.max(1, casualties - 1))}
                  className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl font-bold flex items-center justify-center shadow-sm"
                >
                  -
                </button>
                <div className="flex-1 text-center font-mono font-black text-2xl text-slate-900 dark:text-white">
                  {casualties} {casualties === 1 ? 'Person' : 'People'}
                </div>
                <button
                  type="button"
                  onClick={() => setCasualties(casualties + 1)}
                  className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl font-bold flex items-center justify-center shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Room / Floor / Landmark (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 2nd floor, red roof, near water tank"
                value={landmarkNote}
                onChange={(e) => setLandmarkNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-red-500 font-medium"
              />
            </div>
          </div>

          {/* GPS Auto Status */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center space-x-1.5 font-medium">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>
                {currentLocation
                  ? `Location Locked (±${Math.round(currentLocation.accuracy)}m)`
                  : 'Acquiring offline GPS lock...'}
              </span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Zero internet needed
            </span>
          </div>

          {/* GIANT RED BROADCAST BUTTON (Even an old man can clearly tap this!) */}
          <button
            type="button"
            onClick={handleQuickSend}
            disabled={isSubmitting}
            className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-base sm:text-lg shadow-xl shadow-red-600/30 transition-all flex items-center justify-center space-x-3 active:scale-[0.99]"
          >
            <Send className="w-6 h-6 animate-pulse" />
            <span>
              {isSubmitting ? 'BROADCASTING SOS SIGNAL...' : 'SEND SOS HELP SIGNAL NOW'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
