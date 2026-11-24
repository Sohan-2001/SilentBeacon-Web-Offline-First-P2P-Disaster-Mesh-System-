// SilentBeacon Material 3 Bottom Navigation Bar (Mobile only)
import React from 'react';
import { Radio, ListFilter, Compass, Menu } from 'lucide-react';

export type ActiveTab = 'sos' | 'feed' | 'radar';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenDrawer: () => void;
  openTicketsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  openTicketsCount
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-850 px-4 py-2 transition-colors">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 items-center">
        {/* Tab 1: Distress Feed */}
        <button
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'feed'
              ? 'text-sky-600 dark:text-sky-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ListFilter className="w-5 h-5" />
            {openTicketsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-bold">
                {openTicketsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1">Signals</span>
        </button>

        {/* Tab 2: Broadcast SOS (Primary Center Button) */}
        <button
          onClick={() => onSelectTab('sos')}
          className="flex flex-col items-center justify-center py-0.5 group"
        >
          <div className={`p-2.5 rounded-full transition-all shadow-md ${
            activeTab === 'sos'
              ? 'bg-red-600 text-white shadow-red-600/40 scale-105'
              : 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800/40'
          }`}>
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <span className={`text-[10px] mt-1 font-bold ${
            activeTab === 'sos' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
          }`}>
            SOS
          </span>
        </button>

        {/* Tab 3: Rescue Radar */}
        <button
          onClick={() => onSelectTab('radar')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'radar'
              ? 'text-cyan-600 dark:text-cyan-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-1">Radar</span>
        </button>

        {/* Tab 4: Hamburger Drawer Toggle */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </div>
    </nav>
  );
};
