// SilentBeacon Reactive Distress Feed & Incident Triage (Google-Style Clean Responsive Design)
import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  MapPin, 
  Navigation, 
  QrCode, 
  Radio, 
  Search, 
  UserCheck, 
  Users, 
  Volume2, 
  Flame,
  Droplet,
  Home,
  Cross,
  AlertOctagon
} from 'lucide-react';
import { DistressTicket, TicketCategory, TicketStatus, TicketUrgency } from '../types';
import { calculateBearing, calculateDistanceMeters, formatDistance } from '../utils/geo';

interface DistressFeedViewProps {
  tickets: DistressTicket[];
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  onUpdateStatus: (ticketId: string, status: TicketStatus, note?: string) => Promise<void>;
  onNavigateToRadar: (ticket: DistressTicket) => void;
  onTransmitAcoustic: (ticket: DistressTicket) => void;
  onShowTicketQR: (ticket: DistressTicket) => void;
}

export const DistressFeedView: React.FC<DistressFeedViewProps> = ({
  tickets,
  currentLocation,
  onUpdateStatus,
  onNavigateToRadar,
  onTransmitAcoustic,
  onShowTicketQR
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<TicketUrgency | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | 'ALL'>('ALL');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  const filteredTickets = tickets.filter((t) => {
    if (selectedUrgency !== 'ALL' && t.urgency !== selectedUrgency) return false;
    if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchAuthor = t.authorName.toLowerCase().includes(q);
      const matchLandmark = t.location.landmark?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchAuthor && !matchLandmark) return false;
    }
    return true;
  });

  const getUrgencyBadge = (urgency: TicketUrgency) => {
    switch (urgency) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white animate-pulse shadow-sm">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700/60">
            MEDIUM
          </span>
        );
      case 'LOW':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            LOW
          </span>
        );
    }
  };

  const getCategoryIcon = (category: TicketCategory) => {
    switch (category) {
      case 'MEDICAL':
        return <Cross className="w-3.5 h-3.5 text-rose-500" />;
      case 'TRAPPED':
        return <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />;
      case 'WATER_FOOD':
        return <Droplet className="w-3.5 h-3.5 text-sky-500" />;
      case 'SHELTER':
        return <Home className="w-3.5 h-3.5 text-indigo-500" />;
      case 'FIRE_HAZARD':
        return <Flame className="w-3.5 h-3.5 text-orange-500" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Search & Filter Bar (Google-style clean search) */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search signals, casualties, landmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 shadow-sm transition-all"
          />
        </div>

        {/* Urgency and Status Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((u) => (
            <button
              key={u}
              onClick={() => setSelectedUrgency(u)}
              className={`px-3.5 py-1.5 rounded-full border font-semibold text-xs whitespace-nowrap transition-all ${
                selectedUrgency === u
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {u === 'ALL' ? 'All Urgencies' : u}
            </button>
          ))}

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {(['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`px-3.5 py-1.5 rounded-full border font-semibold text-xs whitespace-nowrap transition-all ${
                selectedStatus === s
                  ? 'bg-sky-600 dark:bg-sky-500 text-white border-transparent shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {s === 'ALL' ? 'All Status' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket Count & Mesh Gossip Status */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <span className="font-medium">{filteredTickets.length} Disaster Signals Active</span>
        <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local CRDT Sync</span>
        </span>
      </div>

      {/* Ticket List */}
      {filteredTickets.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-2 shadow-sm">
          <Radio className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No signals match current filter</p>
          <p className="text-xs">
            Broadcast an emergency beacon or sync with nearby peer devices.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket.id;

            // Distance calculation
            let distanceStr = '';
            let bearingStr = '';
            if (currentLocation && ticket.location) {
              const meters = calculateDistanceMeters(
                currentLocation.latitude,
                currentLocation.longitude,
                ticket.location.latitude,
                ticket.location.longitude
              );
              const bearing = calculateBearing(
                currentLocation.latitude,
                currentLocation.longitude,
                ticket.location.latitude,
                ticket.location.longitude
              );
              distanceStr = formatDistance(meters);
              bearingStr = `${bearing}°`;
            }

            return (
              <div
                key={ticket.id}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  ticket.status === 'RESOLVED'
                    ? 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-850 opacity-75'
                    : ticket.urgency === 'CRITICAL'
                    ? 'bg-white dark:bg-slate-900 border-red-300 dark:border-red-900/60 shadow-md shadow-red-500/5'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
                }`}
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                  className="p-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {getUrgencyBadge(ticket.urgency)}

                      <span className="flex items-center space-x-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                        {getCategoryIcon(ticket.category)}
                        <span>{ticket.category.replace('_', ' ')}</span>
                      </span>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {ticket.hopCount === 0 ? 'Origin' : `${ticket.hopCount} Hops`}
                      </span>

                      <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                        L-{ticket.lamportTimestamp}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        ticket.status === 'OPEN'
                          ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/40'
                          : ticket.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                      }`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 mt-2 leading-snug">
                    {ticket.title}
                  </h3>

                  {ticket.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {ticket.description}
                    </p>
                  )}

                  {/* Metadata line */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1 font-medium">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ticket.casualties} {ticket.casualties === 1 ? 'casualty' : 'casualties'}</span>
                      </span>
                      <span>By {ticket.authorName}</span>
                    </div>

                    {distanceStr && (
                      <span className="font-mono text-cyan-700 dark:text-cyan-400 font-bold flex items-center space-x-1">
                        <Navigation className="w-3 h-3 rotate-45 inline" />
                        <span>{distanceStr} ({bearingStr})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Action Drawer */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-3 animate-fade-in">
                    {/* Location detail */}
                    <div className="text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <span>
                          Coordinates: {ticket.location.latitude.toFixed(5)}, {ticket.location.longitude.toFixed(5)}
                        </span>
                      </div>
                      {ticket.location.landmark && (
                        <p className="text-slate-600 dark:text-slate-400 text-xs pl-5">
                          Landmark: {ticket.location.landmark}
                        </p>
                      )}
                      {ticket.contactInfo && (
                        <p className="text-amber-700 dark:text-amber-400 text-xs pl-5 font-medium">
                          Contact / Radio Channel: {ticket.contactInfo}
                        </p>
                      )}
                    </div>

                    {/* Assigned Rescuer Info */}
                    {ticket.assignedRescuer && (
                      <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-2.5 rounded-xl text-amber-800 dark:text-amber-300 flex items-center space-x-1.5 font-medium">
                        <UserCheck className="w-4 h-4 flex-shrink-0" />
                        <span>Assigned Rescuer: {ticket.assignedRescuer.name}</span>
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      {/* Navigate to Radar */}
                      <button
                        onClick={() => onNavigateToRadar(ticket)}
                        className="py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Rescue Radar</span>
                      </button>

                      {/* Transmit Acoustic */}
                      <button
                        onClick={() => onTransmitAcoustic(ticket)}
                        className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-500" />
                        <span>Acoustic Chirp</span>
                      </button>

                      {/* Share QR */}
                      <button
                        onClick={() => onShowTicketQR(ticket)}
                        className="py-2.5 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5 text-sky-500" />
                        <span>Share QR</span>
                      </button>

                      {/* Claim or Resolve */}
                      {ticket.status === 'OPEN' ? (
                        <button
                          onClick={() => onUpdateStatus(ticket.id, 'IN_PROGRESS', 'Rescuer dispatched')}
                          className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Claim Rescue</span>
                        </button>
                      ) : ticket.status === 'IN_PROGRESS' ? (
                        <button
                          onClick={() => onUpdateStatus(ticket.id, 'RESOLVED', 'Rescued and stabilized')}
                          className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Mark Resolved</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateStatus(ticket.id, 'OPEN', 'Re-opened')}
                          className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1"
                        >
                          <span>Re-open</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
