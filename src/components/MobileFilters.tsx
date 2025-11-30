import { useState } from 'react';
import { Activity, Heart, Flame, Zap, Sparkles, Users, ChevronDown, X, Search } from 'lucide-react';
import type { Intent, HeatmapMode } from '../types';
import { INTENT_LABELS, INTENT_OPTIONS } from '../types';
import type { AgeBand } from '../hooks/useProfile';
import { AGE_BAND_LABELS } from '../utils/venueStats';

// ============================================
// MOBILE FILTERS COMPONENT
// Shows a compact filter bar on mobile with
// expandable panels for each filter group.
// 
// Button labels are ALWAYS the category names:
// "Modus", "Stemning", "Alder"
// Current selection is shown as a sublabel.
// ============================================

// All age bands in order (same as App.tsx)
const AGE_BANDS_ORDER: AgeBand[] = ['18_25', '25_30', '30_35', '35_40', '40_plus'];

// Mode labels for display (Norwegian)
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

  // Get short display label for current mode selection
  const getModeSubLabel = () => MODE_LABELS[heatmapMode];

  // Get short display label for current intent selection
  const getIntentSubLabel = () => {
    if (activeIntents.length === 0) return 'Alle';
    if (activeIntents.length === 1) {
      // Get short version without emoji
      const label = INTENT_LABELS[activeIntents[0]];
      return label.replace(/^[^\s]+\s/, ''); // Remove emoji prefix
    }
    return `${activeIntents.length} valgt`;
  };

  // Get short display label for current age selection
  const getAgeSubLabel = () => {
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

  // Check if any filters are active (non-default)
  const hasActiveFilters = activeIntents.length > 0 || activeAgeBands.length > 0;

  return (
    <div className="bg-slate-800/80 border-b border-slate-700">
      {/* Section Heading */}
      <div className="px-3 pt-2.5 pb-1">
        <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Search size={12} className="text-violet-400" />
          Hva søker du i dag?
        </h3>
      </div>

      {/* Compact Filter Bar - 3 buttons with fixed category labels */}
      <div className="px-3 pb-2.5">
        <div className="flex items-stretch gap-2">
          {/* Modus Button */}
          <button
            onClick={() => handlePanelToggle('mode')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border min-h-[52px] ${
              activePanel === 'mode'
                ? 'bg-slate-700 border-violet-500 text-white'
                : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Modus
              <ChevronDown size={10} className={`transition-transform ${activePanel === 'mode' ? 'rotate-180' : ''}`} />
            </span>
            <span className="flex items-center gap-1 text-xs text-white">
              {MODE_ICONS[heatmapMode]}
              {getModeSubLabel()}
            </span>
          </button>

          {/* Stemning Button */}
          <button
            onClick={() => handlePanelToggle('intent')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border min-h-[52px] ${
              activePanel === 'intent'
                ? 'bg-slate-700 border-emerald-500 text-white'
                : activeIntents.length > 0
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Stemning
              <ChevronDown size={10} className={`transition-transform ${activePanel === 'intent' ? 'rotate-180' : ''}`} />
            </span>
            <span className="flex items-center gap-1 text-xs text-white">
              <Sparkles size={12} />
              {getIntentSubLabel()}
            </span>
          </button>

          {/* Alder Button */}
          <button
            onClick={() => handlePanelToggle('age')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg text-xs font-medium transition-all border min-h-[52px] ${
              activePanel === 'age'
                ? 'bg-slate-700 border-cyan-500 text-white'
                : activeAgeBands.length > 0
                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Alder
              <ChevronDown size={10} className={`transition-transform ${activePanel === 'age' ? 'rotate-180' : ''}`} />
            </span>
            <span className="flex items-center gap-1 text-xs text-white">
              <Users size={12} />
              {getAgeSubLabel()}
            </span>
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
              className="text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 -mr-2"
            >
              <X size={12} />
              Nullstill
            </button>
          </div>
        )}
      </div>

      {/* ============================================
          EXPANDABLE PANELS
          ============================================ */}

      {/* Mode Panel */}
      {activePanel === 'mode' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2.5 bg-slate-800/50">
          <div className="grid grid-cols-2 gap-2">
            {(['activity', 'single', 'ons', 'ons_boost'] as HeatmapMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeSelect(mode)}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all border ${
                  heatmapMode === mode
                    ? MODE_COLORS[mode]
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {MODE_ICONS[mode]}
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Intent Panel */}
      {activePanel === 'intent' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2.5 bg-slate-800/50">
          <div className="flex flex-wrap gap-2">
            {/* "Alle" option */}
            <button
              onClick={() => {
                clearIntents();
                setActivePanel(null);
              }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                activeIntents.length === 0
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              Alle
            </button>
            {INTENT_OPTIONS.map((intent) => (
              <button
                key={intent}
                onClick={() => toggleIntent(intent)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  activeIntents.includes(intent)
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {INTENT_LABELS[intent]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Age Panel */}
      {activePanel === 'age' && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-2.5 bg-slate-800/50">
          <div className="flex flex-wrap gap-2">
            {/* "Alle" option */}
            <button
              onClick={() => {
                clearAgeBands();
                setActivePanel(null);
              }}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                activeAgeBands.length === 0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              Alle
            </button>
            {AGE_BANDS_ORDER.map((band) => (
              <button
                key={band}
                onClick={() => toggleAgeBand(band)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  activeAgeBands.includes(band)
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500 hover:text-slate-300'
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
