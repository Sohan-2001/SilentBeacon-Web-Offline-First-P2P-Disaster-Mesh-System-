// SilentBeacon Autonomous Critical Alarm Banner
import React from 'react';
import { AlertTriangle, Navigation, VolumeX, ShieldAlert, Users } from 'lucide-react';
import { DistressTicket } from '../types';

interface EmergencyAlertBannerProps {
  criticalTicket: DistressTicket;
  onSilence: () => void;
  onNavigateToRadar: (ticket: DistressTicket) => void;
}

export const EmergencyAlertBanner: React.FC<EmergencyAlertBannerProps> = ({
  criticalTicket,
  onSilence,
  onNavigateToRadar
}) => {
  return (
    <div className="relative z-30 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-2xl border-b-2 border-red-400 emergency-strobe-overlay transition-all">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Warning & Victim info */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="p-2 bg-white/20 rounded-xl flex-shrink-0 animate-bounce">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded text-white border border-white/20">
                CRITICAL SOS DETECTED
              </span>
              <span className="text-xs text-red-100 font-medium">
                Hop #{criticalTicket.hopCount}
              </span>
            </div>
            <h4 className="font-bold text-sm sm:text-base leading-snug mt-0.5 line-clamp-1">
              {criticalTicket.title}
            </h4>
            <div className="flex items-center space-x-3 text-xs text-red-100">
              <span>By {criticalTicket.authorName}</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Users className="w-3.5 h-3.5 inline" />
                <span>{criticalTicket.casualties} {criticalTicket.casualties === 1 ? 'victim' : 'victims'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => onNavigateToRadar(criticalTicket)}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white text-red-700 hover:bg-red-50 font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5"
          >
            <Navigation className="w-4 h-4" />
            <span>Rescue Radar</span>
          </button>

          <button
            onClick={onSilence}
            className="px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white font-semibold text-xs border border-white/20 transition-colors flex items-center justify-center space-x-1"
          >
            <VolumeX className="w-4 h-4" />
            <span>Silence</span>
          </button>
        </div>
      </div>
    </div>
  );
};
