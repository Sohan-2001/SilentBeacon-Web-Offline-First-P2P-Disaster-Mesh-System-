// SilentBeacon Ultra-Clean Navbar (Zero-Overflow, Immune to Screen Narrowing)
import React from 'react';
import { 
  Menu, 
  Radio, 
  Sun, 
  Moon, 
  Volume2, 
  VolumeX
} from 'lucide-react';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isSirenActive: boolean;
  onSilenceSiren: () => void;
  onOpenDrawer: () => void;
  onTestSiren: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isDarkMode,
  onToggleTheme,
  isSirenActive,
  onSilenceSiren,
  onOpenDrawer,
  onTestSiren
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-850 px-3 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        
        {/* Left: Hamburger Menu + Brand Logo + Title */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            onClick={onOpenDrawer}
            title="Open Menu"
            className="p-2 -ml-1 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors flex-shrink-0"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div className="flex items-center space-x-2 min-w-0">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-md shadow-red-600/30 flex-shrink-0">
              <Radio className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                  SilentBeacon
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/40">
                  OFFLINE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Only Essential Controls (Day/Night & Emergency Siren) */}
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {/* Day / Night Mode Toggle */}
          <button
            onClick={onToggleTheme}
            title={isDarkMode ? 'Switch to Day Mode (Light)' : 'Switch to Night Mode (Dark)'}
            className="p-2 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
            aria-label="Toggle Day / Night Mode"
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700" />
            )}
          </button>

          {/* Siren Action */}
          {isSirenActive ? (
            <button
              onClick={onSilenceSiren}
              className="px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-1 animate-pulse shadow-md shadow-red-600/40"
            >
              <VolumeX className="w-4 h-4" />
              <span>SILENCE</span>
            </button>
          ) : (
            <button
              onClick={onTestSiren}
              title="Test Acoustic Siren"
              className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
