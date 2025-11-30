import { useState } from 'react';
import { Activity, Heart, Flame, Zap, Sparkles, Users, ChevronDown, X } from 'lucide-react';
import type { Intent, HeatmapMode } from '../types';
import { INTENT_LABELS, INTENT_OPTIONS } from '../types';
import type { AgeBand } from '../hooks/useProfile';
import { AGE_BAND_LABELS } from '../utils/venueStats';

// ============================================
// MOBILE FILTERS COMPONENT
// Shows a compact filter bar on mobile with
// expandable panels for each filter group.
// ============================================

// All age bands in order (same as App.tsx)
const AGE_BANDS_ORDER: AgeBand[] = ['18_25', '25_30', '30_35', '35_40', '40_plus'];

// Mode labels for display
const MODE_LABELS: Record<HeatmapMode, string> = {
  activity: 'Aktivitet',
  single: 'Single',
  ons: 'ONS',
  ons_boost: 'ONS Boost',
};

// Mode icons
const MODE_ICONS: Record<HeatmapMode, React.ReactNode> = {
  activity: <Activity size={14} />,
  single: <Heart size={14} />,
  ons: <Flame size={14} />,
  ons_boost: <Zap size={14} />,
};

// Mode colors for active state
const MODE_COLORS: Record<HeatmapMode, string> = {
  activity: 'bg-violet-500/20 text-violet-300 border-violet-500',
  single: 'bg-pink-500/20 text-pink-300 border-pink-500',
  ons: 'bg-orange-500/20 text-orange-300 border-orange-500',
  ons_boost: 'bg-red-500/20 text-red-300 border-red-500',
};

type FilterPanel = 'mode' | 'intent' | 'age' | null;

interface MobileFiltersProps {
  // Mode filter
  heatmapMode: HeatmapMode;
  setHeatmapMode: (mode: HeatmapMode) => void;
  // Intent filter
  activeIntents: Intent[];
  toggleIntent: (intent: Intent) => void;
  clearIntents: () => void;
  // Age filter
  activeAgeBands: AgeBand[];
  toggleAgeBand: (band: AgeBand) => void;
  clearAgeBands: () => void;
  // Filter count for display
  filteredCount: number;
}

export function MobileFilters({
  heatmapMode,
  setHeatmapMode,
  activeIntents,
  toggleIntent,
  clearIntents,
  activeAgeBands,
  toggleAgeBand,
  clearAgeBands,
  filteredCount,
}: MobileFiltersProps) {
  const [activePanel, setActivePanel] = useState<FilterPanel>(null);

  // Get display label for current intent selection
  const getIntentLabel = () => {
    if (activeIntents.length === 0) return 'Alle';
    if (activeIntents.length === 1) return INTENT_LABELS[activeIntents[0]];
    return `${activeIntents.length} valgt`;
  };

  // Get display label for current age selection
  const getAgeLabel = () => {
    if (activeAgeBands.length === 0) return 'Alle';
    if (activeAgeBands.length === 1) return AGE_BAND_LABELS[activeAgeBands[0]];
    return `${activeAgeBands.length} valgt`;
  };

  // Toggle panel open/close
  const handlePanelToggle = (panel: FilterPanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  // Close panel after selection (for mode only, since it's single-select)
  const handleModeSelect = (mode: HeatmapMode) => {
    setHeatmapMode(mode);
    setActivePanel(null);
  };

  // Check if any filters are active
  const hasActiveFilters = activeIntents.length > 0 || activeAgeBands.length > 0;

  return (
    <div className="bg-slate-800/60 border-b border-slate-700">
      {/* Compact Filter Bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Mode Button */}
          <button
            onClick={() => handlePanelToggle('mode')}
            className={`flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              activePanel === 'mode'
                ? 'bg-slate-700 border-slate-500 text-white'
                : 'bg-slate-700/50 border-slate-600 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {MODE_ICONS[heatmapMode]}
              <span className="truncate">{MODE_LABELS[heatmapMode]}</span>
            </span>
            <ChevronDown size={14} className={`transition-transform ${activePanel === 'mode' ? 'rotate-180' : ''}`} />
          </button>

          {/* Intent Button */}
          <button
            onClick={() => handlePanelToggle('intent')}
            className={`flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              activePanel === 'intent'
                ? 'bg-slate-700 border-slate-500 text-white'
                : activeIntents.length > 0
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-700/50 border-slate-600 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} />
              <span className="truncate">{getIntentLabel()}</span>
            </span>
            <ChevronDown size={14} className={`transition-transform ${activePanel === 'intent' ? 'rotate-180' : ''}`} />
          </button>

          {/* Age Button */}
          <button
            onClick={() => handlePanelToggle('age')}
            className={`flex-1 flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
              activePanel === 'age'
                ? 'bg-slate-700 border-slate-500 text-white'
                : activeAgeBands.length > 0
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-700/50 border-slate-600 text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              <span className="truncate">{getAgeLabel()}</span>
            </span>
            <ChevronDown size={14} className={`transition-transform ${activePanel === 'age' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter count indicator */}
        {hasActiveFilters && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{filteredCount} check-ins matcher</span>
            <button
              onClick={() => {
                clearIntents();
                clearAgeBands();
              }}
              className="text-slate-400 hover:text-white flex items-center gap-1"
            >
              <X size={12} />
              Nullstill
            </button>
          </div>
        )}
      </div>

      {/* Expandable Panels */}
      {activePanel === 'mode' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {(['activity', 'single', 'ons', 'ons_boost'] as HeatmapMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeSelect(mode)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                  heatmapMode === mode
                    ? MODE_COLORS[mode]
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}
              >
                {MODE_ICONS[mode]}
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'intent' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
          <div className="flex flex-wrap gap-2">
            {/* "Alle" option */}
            <button
              onClick={() => {
                clearIntents();
                setActivePanel(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                activeIntents.length === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500'
              }`}
            >
              Alle
            </button>
            {INTENT_OPTIONS.map((intent) => (
              <button
                key={intent}
                onClick={() => toggleIntent(intent)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  activeIntents.includes(intent)
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500'
                }`}
              >
                {INTENT_LABELS[intent]}
              </button>
            ))}
          </div>
        </div>
      )}

      {activePanel === 'age' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
          <div className="flex flex-wrap gap-2">
            {/* "Alle" option */}
            <button
              onClick={() => {
                clearAgeBands();
                setActivePanel(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                activeAgeBands.length === 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500'
              }`}
            >
              Alle
            </button>
            {AGE_BANDS_ORDER.map((band) => (
              <button
                key={band}
                onClick={() => toggleAgeBand(band)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  activeAgeBands.includes(band)
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500'
                }`}
              >
                {AGE_BAND_LABELS[band]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

