// SilentBeacon Tactical Rescue Radar & Offline Vector Map (Google-Style Clean Responsive Design)
import React, { useEffect, useState, useRef } from 'react';
import { 
  Compass, 
  Navigation, 
  MapPin, 
  Volume2, 
  VolumeX, 
  LocateFixed,
  Layers
} from 'lucide-react';
import { DistressTicket } from '../types';
import { calculateBearing, calculateDistanceMeters, formatDistance } from '../utils/geo';

interface TacticalRadarViewProps {
  tickets: DistressTicket[];
  selectedTicket: DistressTicket | null;
  onSelectTicket: (ticket: DistressTicket) => void;
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  currentHeading: number | null; // 0 to 360 degrees
  onPlayRadarPing: (distanceMeters: number) => void;
  isDarkMode?: boolean;
}

export const TacticalRadarView: React.FC<TacticalRadarViewProps> = ({
  tickets,
  selectedTicket,
  onSelectTicket,
  currentLocation,
  currentHeading,
  onPlayRadarPing,
  isDarkMode = true
}) => {
  const [activeTicket, setActiveTicket] = useState<DistressTicket | null>(selectedTicket);
  const [isAudioPingActive, setIsAudioPingActive] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (selectedTicket) {
      setActiveTicket(selectedTicket);
    } else if (!activeTicket && tickets.length > 0) {
      setActiveTicket(tickets[0]);
    }
  }, [selectedTicket, tickets]);

  // Audio sonar ping loop
  useEffect(() => {
    if (!isAudioPingActive || !activeTicket || !currentLocation) return;

    const meters = calculateDistanceMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      activeTicket.location.latitude,
      activeTicket.location.longitude
    );

    const intervalMs = Math.max(350, Math.min(2200, meters * 4));

    const intervalId = setInterval(() => {
      onPlayRadarPing(meters);
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [isAudioPingActive, activeTicket, currentLocation, onPlayRadarPing]);

  // Compute metrics
  let distanceMeters = 0;
  let targetBearing = 0;
  let relativeAngle = 0;

  if (currentLocation && activeTicket) {
    distanceMeters = calculateDistanceMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      activeTicket.location.latitude,
      activeTicket.location.longitude
    );
    targetBearing = calculateBearing(
      currentLocation.latitude,
      currentLocation.longitude,
      activeTicket.location.latitude,
      activeTicket.location.longitude
    );

    const compass = currentHeading ?? 0;
    relativeAngle = (targetBearing - compass + 360) % 360;
  }

  // Draw Offline Vector Tactical Map Canvas with Day & Night support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 28;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Concentric range circles
    const rings = [40, 80, 120, 160];
    const ringDistances = ['50m', '100m', '250m', '500m'];

    rings.forEach((r, idx) => {
      ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = isDarkMode ? 'rgba(148, 163, 184, 0.6)' : 'rgba(71, 85, 105, 0.8)';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(ringDistances[idx], centerX + r - 22, centerY - 4);
    });

    // Crosshairs
    ctx.strokeStyle = isDarkMode ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.25)';
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Center point (You / Rescuer)
    ctx.fillStyle = isDarkMode ? '#06b6d4' : '#0284c7';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = isDarkMode ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
    ctx.stroke();

    // Plot tickets
    if (currentLocation) {
      const maxRangeMeters = 600;
      const scale = (height / 2 - 20) / maxRangeMeters;

      tickets.forEach((t) => {
        const d = calculateDistanceMeters(
          currentLocation.latitude,
          currentLocation.longitude,
          t.location.latitude,
          t.location.longitude
        );
        const b = calculateBearing(
          currentLocation.latitude,
          currentLocation.longitude,
          t.location.latitude,
          t.location.longitude
        );

        const headingOffset = (b - (currentHeading ?? 0) - 90) * (Math.PI / 180);
        const clampedDist = Math.min(d, maxRangeMeters);
        const px = centerX + clampedDist * scale * Math.cos(headingOffset);
        const py = centerY + clampedDist * scale * Math.sin(headingOffset);

        const isTarget = activeTicket?.id === t.id;

        let color = '#0284c7';
        if (t.urgency === 'CRITICAL') color = '#dc2626';
        else if (t.urgency === 'HIGH') color = '#d97706';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, isTarget ? 7 : 5, 0, 2 * Math.PI);
        ctx.fill();

        if (isTarget) {
          ctx.strokeStyle = isDarkMode ? '#ffffff' : '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, 11, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }
  }, [currentLocation, currentHeading, tickets, activeTicket, isDarkMode]);

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Target Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-2.5 min-w-0">
          <LocateFixed className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Radar Target Lock
            </span>
            <select
              value={activeTicket?.id || ''}
              onChange={(e) => {
                const found = tickets.find((t) => t.id === e.target.value);
                if (found) {
                  setActiveTicket(found);
                  onSelectTicket(found);
                }
              }}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate focus:outline-none cursor-pointer max-w-[200px] sm:max-w-md"
            >
              {tickets.map((t) => (
                <option key={t.id} value={t.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  [{t.urgency}] {t.title.slice(0, 32)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sonar Ping Audio Toggle */}
        <button
          onClick={() => setIsAudioPingActive(!isAudioPingActive)}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center space-x-1.5 transition-all ${
            isAudioPingActive
              ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-sm animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {isAudioPingActive ? <Volume2 className="w-3.5 h-3.5 text-cyan-500" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span>Sonar Ping</span>
        </button>
      </div>

      {/* Responsive Grid for Radar Instrument & Vector Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Instrument HUD */}
        <div className="relative bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-850 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center overflow-hidden">
          {/* Compass & Heading Metrics */}
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-700 dark:text-cyan-400 font-bold mb-4">
            <Compass className="w-4 h-4" />
            <span>Heading: {currentHeading !== null ? `${currentHeading}°` : 'Calibrating...'}</span>
            <span>•</span>
            <span>Target: {targetBearing}°</span>
          </div>

          {/* Directional Rescue Arrow Circle */}
          <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-full bg-slate-50 dark:bg-slate-950 border-2 border-cyan-400 dark:border-cyan-600 shadow-inner flex items-center justify-center">
            {/* Cardinal points */}
            <span className="absolute top-2.5 text-[11px] font-black text-cyan-700 dark:text-cyan-400">N</span>
            <span className="absolute bottom-2.5 text-[11px] font-bold text-slate-400">S</span>
            <span className="absolute right-2.5 text-[11px] font-bold text-slate-400">E</span>
            <span className="absolute left-2.5 text-[11px] font-bold text-slate-400">W</span>

            {/* Dynamic Rotating Direction Arrow */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
              style={{ transform: `rotate(${relativeAngle}deg)` }}
            >
              <div className="flex flex-col items-center">
                <Navigation
                  className={`w-12 h-12 sm:w-16 sm:h-16 ${
                    activeTicket?.urgency === 'CRITICAL' 
                      ? 'text-red-600 fill-red-600' 
                      : 'text-cyan-600 dark:text-cyan-400 fill-cyan-600 dark:fill-cyan-400'
                  } filter drop-shadow-md`}
                />
                <div className="w-1.5 h-10 bg-gradient-to-t from-transparent to-cyan-500 opacity-60 rounded-full" />
              </div>
            </div>
          </div>

          {/* Distance Readout */}
          <div className="text-center mt-4">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              {formatDistance(distanceMeters)}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Distance to Target Victim
            </span>
          </div>

          {activeTicket && (
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left w-full mt-4 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-900 dark:text-slate-200 truncate">{activeTicket.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-bold">
                  {activeTicket.urgency}
                </span>
              </div>
              {activeTicket.location.landmark && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span className="truncate">{activeTicket.location.landmark}</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Offline 2D Vector Tactical Map */}
        <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-850 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 dark:text-slate-200 flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Offline Tactical Grid Map</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              {tickets.length} incidents plotted
            </span>
          </div>

          <div className="relative aspect-square max-h-72 w-full bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-850 flex items-center justify-center my-auto">
            <canvas
              ref={canvasRef}
              width={340}
              height={340}
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-850">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                <span>You</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                <span>Critical</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>High</span>
              </span>
            </div>
            <span>Max Radius: 500m</span>
          </div>
        </div>
      </div>
    </div>
  );
};
