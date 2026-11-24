// SilentBeacon Disaster Emergency Toolkit (Google-Style Clean Responsive Design)
import React, { useState } from 'react';
import { 
  HeartPulse, 
  BookOpen, 
  Database, 
  Download, 
  Upload, 
  Cross 
} from 'lucide-react';
import { DistressTicket, TriageCategory } from '../types';
import * as db from '../services/db';

interface DisasterToolsViewProps {
  nodeId: string;
  nodeName: string;
  lamport: number;
  vectorClock: Record<string, number>;
  tickets: DistressTicket[];
  onBroadcastTriageTicket: (ticket: any) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const DisasterToolsView: React.FC<DisasterToolsViewProps> = ({
  nodeId,
  nodeName,
  lamport,
  vectorClock,
  tickets,
  onBroadcastTriageTicket,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'triage' | 'survival' | 'crdt' | 'export'>('triage');

  // START Triage State
  const [ableToWalk, setAbleToWalk] = useState<boolean | null>(null);
  const [breathingSpontaneous, setBreathingSpontaneous] = useState<boolean | null>(null);
  const [respiratoryRateOver30, setRespiratoryRateOver30] = useState<boolean | null>(null);
  const [radialPulsePresent, setRadialPulsePresent] = useState<boolean | null>(null);
  const [followsCommands, setFollowsCommands] = useState<boolean | null>(null);

  // Calculate START triage
  let calculatedTriage: { category: TriageCategory; label: string; color: string; desc: string } | null = null;

  if (ableToWalk === true) {
    calculatedTriage = {
      category: 'MINOR',
      label: 'GREEN: MINOR',
      color: 'bg-emerald-600 text-white',
      desc: 'Walking wounded. Stable condition, can wait for care.'
    };
  } else if (ableToWalk === false) {
    if (breathingSpontaneous === false) {
      calculatedTriage = {
        category: 'DECEASED',
        label: 'BLACK: DECEASED / EXPECTANT',
        color: 'bg-slate-800 text-slate-200 border border-slate-700',
        desc: 'No spontaneous breathing even after airway reposition.'
      };
    } else if (breathingSpontaneous === true) {
      if (respiratoryRateOver30 === true) {
        calculatedTriage = {
          category: 'IMMEDIATE',
          label: 'RED: IMMEDIATE (CRITICAL)',
          color: 'bg-red-600 text-white animate-pulse',
          desc: 'Tachypnea (>30 breaths/min). Life-threatening compromise.'
        };
      } else if (respiratoryRateOver30 === false) {
        if (radialPulsePresent === false) {
          calculatedTriage = {
            category: 'IMMEDIATE',
            label: 'RED: IMMEDIATE (CRITICAL)',
            color: 'bg-red-600 text-white animate-pulse',
            desc: 'Absent radial pulse or capillary refill > 2 sec. Severe shock.'
          };
        } else if (radialPulsePresent === true) {
          if (followsCommands === false) {
            calculatedTriage = {
              category: 'IMMEDIATE',
              label: 'RED: IMMEDIATE (CRITICAL)',
              color: 'bg-red-600 text-white animate-pulse',
              desc: 'Altered mental status. Cannot follow simple commands.'
            };
          } else if (followsCommands === true) {
            calculatedTriage = {
              category: 'DELAYED',
              label: 'YELLOW: DELAYED',
              color: 'bg-amber-600 text-white',
              desc: 'Serious injury requiring medical care, but stable vitals.'
            };
          }
        }
      }
    }
  }

  const handleBroadcastFromTriage = async () => {
    if (!calculatedTriage) return;
    const isCritical = calculatedTriage.category === 'IMMEDIATE';
    await onBroadcastTriageTicket({
      urgency: isCritical ? 'CRITICAL' : calculatedTriage.category === 'DELAYED' ? 'HIGH' : 'LOW',
      category: 'MEDICAL',
      status: 'OPEN',
      title: `START Triage: ${calculatedTriage.label} casualty`,
      description: `Evaluated via START algorithm: ${calculatedTriage.desc}`,
      casualties: 1,
      location: {
        latitude: 22.5726,
        longitude: 88.3639,
        accuracy: 20,
        landmark: 'Field Triage Point'
      }
    });
    alert('Distress ticket posted with verified START Triage classification!');
  };

  // Export JSON file
  const handleExportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      nodeId,
      nodeName,
      lamport,
      vectorClock,
      ticketsCount: tickets.length,
      tickets
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silentbeacon_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON file
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.tickets && Array.isArray(data.tickets)) {
          await db.saveTicketsBatch(data.tickets);
          await onRefreshData();
          alert(`Successfully imported ${data.tickets.length} distress tickets from file!`);
        }
      } catch (err: any) {
        alert('Invalid JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Sub-tab navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('triage')}
          className={`p-2.5 rounded-xl border text-center transition-all ${
            activeSubTab === 'triage'
              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500 text-rose-700 dark:text-rose-300 shadow-sm font-bold'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          START Triage
        </button>
        <button
          onClick={() => setActiveSubTab('survival')}
          className={`p-2.5 rounded-xl border text-center transition-all ${
            activeSubTab === 'survival'
              ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm font-bold'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          Survival Manual
        </button>
        <button
          onClick={() => setActiveSubTab('crdt')}
          className={`p-2.5 rounded-xl border text-center transition-all ${
            activeSubTab === 'crdt'
              ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-500 text-cyan-700 dark:text-cyan-300 shadow-sm font-bold'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          CRDT Clocks
        </button>
        <button
          onClick={() => setActiveSubTab('export')}
          className={`p-2.5 rounded-xl border text-center transition-all ${
            activeSubTab === 'export'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-sm font-bold'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          Relief Export
        </button>
      </div>

      {/* SUBTAB: START TRIAGE */}
      {activeSubTab === 'triage' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <HeartPulse className="w-5 h-5 text-rose-500" />
              <span>START Rapid Field Triage Algorithm</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Standard disaster medical triage protocol: Respiration, Perfusion, and Mental status (RPM).
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {/* Step 1: Walking */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                1. Can the patient walk?
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setAbleToWalk(true)}
                  className={`flex-1 py-2 rounded-lg border font-bold ${
                    ableToWalk === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  YES (Able to walk)
                </button>
                <button
                  onClick={() => setAbleToWalk(false)}
                  className={`flex-1 py-2 rounded-lg border font-bold ${
                    ableToWalk === false ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  NO (Immobile)
                </button>
              </div>
            </div>

            {/* Step 2: Spontaneous breathing */}
            {ableToWalk === false && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fade-in">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                  2. Spontaneous breathing (after repositioning airway)?
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setBreathingSpontaneous(true)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      breathingSpontaneous === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    YES (Breathing)
                  </button>
                  <button
                    onClick={() => setBreathingSpontaneous(false)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      breathingSpontaneous === false ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    NO (Apneic)
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Respiratory rate */}
            {ableToWalk === false && breathingSpontaneous === true && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fade-in">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                  3. Respiratory rate above 30 breaths / min?
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setRespiratoryRateOver30(true)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      respiratoryRateOver30 === true ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    YES (&gt; 30 / min)
                  </button>
                  <button
                    onClick={() => setRespiratoryRateOver30(false)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      respiratoryRateOver30 === false ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    NO (&lt; 30 / min)
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Radial pulse */}
            {ableToWalk === false && breathingSpontaneous === true && respiratoryRateOver30 === false && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fade-in">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                  4. Radial pulse present? (Capillary refill &lt; 2s)
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setRadialPulsePresent(true)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      radialPulsePresent === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    YES (Pulse present)
                  </button>
                  <button
                    onClick={() => setRadialPulsePresent(false)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      radialPulsePresent === false ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    NO (Absent / Weak)
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Follows commands */}
            {ableToWalk === false && breathingSpontaneous === true && respiratoryRateOver30 === false && radialPulsePresent === true && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fade-in">
                <span className="font-semibold text-slate-800 dark:text-slate-300 block">
                  5. Follows simple commands? (e.g. "Squeeze my hand")
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setFollowsCommands(true)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      followsCommands === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    YES (Follows commands)
                  </button>
                  <button
                    onClick={() => setFollowsCommands(false)}
                    className={`flex-1 py-2 rounded-lg border font-bold ${
                      followsCommands === false ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    NO (Unresponsive / Shock)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Result Card */}
          {calculatedTriage && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Calculated Triage Tag:
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${calculatedTriage.color}`}>
                  {calculatedTriage.label}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">{calculatedTriage.desc}</p>
              <button
                onClick={handleBroadcastFromTriage}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-1.5"
              >
                <Cross className="w-4 h-4" />
                <span>Broadcast Triage Distress Signal to Mesh</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB: SURVIVAL MANUAL */}
      {activeSubTab === 'survival' && (
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-sky-500" />
              <span>Offline Disaster Survival Protocol</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Field survival guidelines cached inside browser memory.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <h4 className="font-bold text-sky-700 dark:text-sky-300">1. Emergency Water Purification</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>Boiling:</strong> Bring water to a vigorous rolling boil for at least 1 minute (3 minutes at high altitude).
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>Household Bleach (Unscented 6-8.25%):</strong> Add 2 drops per liter (or 8 drops per gallon). Stir and let stand 30 minutes before drinking.
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>SODIS (Solar Disinfection):</strong> Fill clear PET plastic bottles and lay in direct sunlight for 6 hours.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <h4 className="font-bold text-rose-700 dark:text-rose-300">2. Severe Bleeding Control & Tourniquet</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • Apply firm direct pressure with clean cloth.
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • Place tourniquet 2-3 inches above the wound (never over a joint). Tighten windlass until bleeding stops completely. Note time placed on victim's forehead ("TK 14:30").
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 text-xs">
            <h4 className="font-bold text-amber-700 dark:text-amber-300">3. Earthquake & Building Collapse Protocol</h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>If trapped under debris:</strong> Cover mouth with fabric to avoid inhaling dust. Do not light matches (risk of ruptured gas mains).
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              • <strong>Acoustic Signaling:</strong> Tap rhythmically on pipes or walls with a stone or metal object (3 taps: SOS). Rescuers use listening geophones.
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB: CRDT & CLOCKS */}
      {activeSubTab === 'crdt' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200">Local Node Identifier</span>
            <span className="text-cyan-700 dark:text-cyan-400 font-bold">{nodeId}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200">Monotonic Lamport Clock</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">{lamport}</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="font-bold text-slate-800 dark:text-slate-300 block">Vector Clock State:</span>
            <pre className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-800 dark:text-slate-300 overflow-x-auto">
              {JSON.stringify(vectorClock, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* SUBTAB: EXPORT / IMPORT */}
      {activeSubTab === 'export' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Relief Squad Interoperability (Air-Gap Data Drop)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export and import full mesh snapshots via USB flash drive, SD card, or local Wi-Fi drop for military, UN, or NGO disaster teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleExportData}
              className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export {tickets.length} Incidents (.json)</span>
            </button>

            <label className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Import Relief Dataset</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
