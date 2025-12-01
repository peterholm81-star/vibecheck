import { useState } from 'react';
import { MapPin, Bell, BellOff, RefreshCw, ChevronUp, ChevronDown, Info, ZoomIn } from 'lucide-react';
import type { HeatmapMode } from '../../types';

// ============================================
// MOBILE-FRIENDLY MAP OVERLAY COMPONENTS
// ============================================
// These components show different UI on mobile vs desktop:
// - Mobile: Small, minimal overlays that don't block the map
// - Desktop: Full-featured panels with all information visible
// ============================================

// ============================================
// 1. MOBILE TOP BAR
// A slim bar at the top showing the city name
// ============================================

interface MobileTopBarProps {
  cityName: string;
  activeVenueCount: number;
  totalCheckins: number;
  isLoading?: boolean;
}

export function MobileTopBar({
  cityName,
  activeVenueCount,
  totalCheckins,
  isLoading = false,
}: MobileTopBarProps) {
  return (
    <div className="absolute top-2 left-2 right-14 flex items-center gap-2 z-10">
      {/* City name pill */}
      <div className="bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5">
        <MapPin size={12} className="text-violet-400" />
        <span className="text-xs font-semibold text-white truncate">
          {cityName}
        </span>
        {isLoading && <RefreshCw size={10} className="text-violet-400 animate-spin" />}
      </div>
      
      {/* Stats pill - shows venue/checkin count */}
      <div className="bg-slate-900/80 backdrop-blur-sm rounded-full px-2 py-1.5 shadow-lg">
        <span className="text-[10px] text-slate-300">
          {activeVenueCount} steder • {totalCheckins} 📍
        </span>
      </div>
    </div>
  );
}

// ============================================
// 2. DESKTOP CITY INFO BOX
// The full info panel shown on desktop (top left)
// ============================================

interface DesktopCityInfoProps {
  cityName: string;
  activeVenueCount: number;
  totalCheckins: number;
  isLoading?: boolean;
  hasFavoriteCity?: boolean;
}

export function DesktopCityInfo({
  cityName,
  activeVenueCount,
  totalCheckins,
  isLoading = false,
  hasFavoriteCity = false,
}: DesktopCityInfoProps) {
  return (
    <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg z-10">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <MapPin size={14} className="text-violet-400" />
        {cityName} Nightlife
        {isLoading && <RefreshCw size={12} className="text-violet-400 animate-spin" />}
      </h2>
      <p className="text-xs text-slate-300 mt-0.5">
        {activeVenueCount} active venue{activeVenueCount !== 1 ? 's' : ''} • {totalCheckins} check-in{totalCheckins !== 1 ? 's' : ''} (90 min)
      </p>
      
      {/* Favorite city indicator */}
      {hasFavoriteCity && (
        <div className="mt-2 pt-2 border-t border-slate-700">
          <span className="text-[11px] text-slate-400">
            Favorittby aktiv (endre i Profil)
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// 3. LIVE ALERTS TOGGLE (Mobile)
// A small icon button for mobile that toggles notifications
// ============================================

interface LiveAlertsToggleProps {
  isActive: boolean;
  isLoading: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

export function LiveAlertsToggle({
  isActive,
  isLoading,
  isDisabled,
  onToggle,
}: LiveAlertsToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isLoading || isDisabled}
      className={`absolute top-2 right-2 z-10 w-9 h-9 rounded-full shadow-lg flex items-center justify-center transition-all ${
        isActive
          ? 'bg-amber-500 text-white'
          : isDisabled
          ? 'bg-slate-700/80 text-slate-500 cursor-not-allowed'
          : 'bg-slate-900/90 text-slate-400 hover:text-white'
      }`}
      title={isActive ? 'Varsler aktive' : 'Aktiver varsler'}
    >
      {isLoading ? (
        <RefreshCw size={16} className="animate-spin" />
      ) : isActive ? (
        <Bell size={16} />
      ) : (
        <BellOff size={16} />
      )}
    </button>
  );
}

// ============================================
// 4. DESKTOP LIVE ALERTS PANEL
// The full notification panel shown on desktop
// ============================================

interface DesktopLiveAlertsPanelProps {
  isActive: boolean;
  isActivating: boolean;
  isDeactivating: boolean;
  isNotificationsEnabled: boolean;
  error: string | null;
  onToggle: (enabled: boolean) => void;
}

export function DesktopLiveAlertsPanel({
  isActive,
  isActivating,
  isDeactivating,
  isNotificationsEnabled,
  error,
  onToggle,
}: DesktopLiveAlertsPanelProps) {
  const isLoading = isActivating || isDeactivating;

  return (
    <div className="absolute top-4 right-14 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg z-10 max-w-[280px]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Bell size={14} className="text-amber-400" />
          ) : (
            <BellOff size={14} className="text-slate-500" />
          )}
          <span className="text-sm font-semibold text-white">
            Live-varsler
          </span>
        </div>
        
        {/* Toggle switch */}
        <label className="relative cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={isLoading || !isNotificationsEnabled}
            className="sr-only peer"
          />
          <div className={`w-9 h-5 rounded-full transition-colors ${
            !isNotificationsEnabled 
              ? 'bg-slate-700 cursor-not-allowed' 
              : 'bg-slate-600 peer-checked:bg-amber-500 peer-focus:ring-2 peer-focus:ring-amber-500/50'
          }`}></div>
          <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            isActive ? 'translate-x-4' : ''
          } ${!isNotificationsEnabled ? 'opacity-50' : ''}`}></div>
        </label>
      </div>
      
      {/* Description / Status */}
      <div className="mt-2">
        {!isNotificationsEnabled ? (
          <p className="text-[11px] text-amber-400">
            Slå på varsler i "Min profil" for å bruke denne funksjonen.
          </p>
        ) : isActive ? (
          <p className="text-[11px] text-emerald-400">
            ✅ Aktiv! Vi varsler deg når steder blir hot.
          </p>
        ) : (
          <p className="text-[11px] text-slate-400">
            Vi følger filtrene dine og kan varsle deg når steder matcher.
          </p>
        )}
        
        {/* Loading state */}
        {isLoading && (
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" />
            {isActivating ? 'Starter...' : 'Stopper...'}
          </p>
        )}
        
        {/* Error state */}
        {error && (
          <p className="text-[11px] text-red-400 mt-1">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// 5. ONS INDICATOR (Mobile)
// A small chip/pill showing the current heatmap mode
// ============================================

interface OnsIndicatorProps {
  heatmapMode: HeatmapMode;
}

export function OnsIndicator({ heatmapMode }: OnsIndicatorProps) {
  // Only show for special modes, not for default 'activity'
  if (heatmapMode === 'activity') return null;

  const modeConfig: Record<HeatmapMode, { label: string; emoji: string; color: string }> = {
    activity: { label: '', emoji: '', color: '' },
    single: { label: 'Single', emoji: '💘', color: 'bg-pink-500/80' },
    ons: { label: 'ONS', emoji: '🔥', color: 'bg-orange-500/80' },
    ons_boost: { label: 'Boost', emoji: '🚀', color: 'bg-red-500/80' },
  };

  const config = modeConfig[heatmapMode];

  return (
    <div className={`absolute bottom-16 left-2 z-10 ${config.color} backdrop-blur-sm rounded-full px-2.5 py-1 shadow-lg`}>
      <span className="text-[10px] font-medium text-white flex items-center gap-1">
        <span>{config.emoji}</span>
        {config.label}
      </span>
    </div>
  );
}

// ============================================
// 6. LEGEND (Desktop)
// Full legend shown on desktop (bottom left)
// ============================================

interface DesktopLegendProps {
  heatmapMode: HeatmapMode;
}

export function DesktopLegend({ heatmapMode }: DesktopLegendProps) {
  return (
    <div className="absolute bottom-8 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg z-10">
      <div className="text-xs font-medium text-slate-300 mb-2">
        {heatmapMode === 'activity' && 'Aktivitetsnivå'}
        {heatmapMode === 'single' && '💘 Single-tetthet'}
        {heatmapMode === 'ons' && '🔥 ONS-åpenhet'}
        {heatmapMode === 'ons_boost' && '🚀 ONS Boost Score'}
      </div>
      <div className="flex items-center gap-1">
        <div className="w-12 h-2 rounded-full" style={{
          background: heatmapMode === 'single'
            ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(236, 72, 153, 0.6), rgba(244, 63, 94, 0.9))'
            : heatmapMode === 'ons'
            ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(249, 115, 22, 0.6), rgba(239, 68, 68, 0.9))'
            : heatmapMode === 'ons_boost'
            ? 'linear-gradient(to right, rgba(249, 115, 22, 0.3), rgba(239, 68, 68, 0.6), rgba(220, 38, 38, 1))'
            : 'linear-gradient(to right, rgba(103, 58, 183, 0.7), rgba(33, 150, 243, 0.8), rgba(76, 175, 80, 0.9), rgba(255, 193, 7, 0.9), rgba(255, 87, 34, 1), rgba(244, 67, 54, 1))'
        }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>{heatmapMode === 'activity' ? 'Stille' : 'Lite'}</span>
        <span>
          {heatmapMode === 'activity' && '🔥 Hot'}
          {heatmapMode === 'single' && '💘 Mye'}
          {heatmapMode === 'ons' && '🔥 Mye'}
          {heatmapMode === 'ons_boost' && '🚀 Boost'}
        </span>
      </div>
    </div>
  );
}

// ============================================
// 7. ZOOM HINT
// Shows when zoomed out - mobile gets a small version
// ============================================

interface ZoomHintProps {
  isMobile: boolean;
}

export function ZoomHint({ isMobile }: ZoomHintProps) {
  if (isMobile) {
    // Mobile: Very small hint at bottom
    return (
      <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg z-10">
        <span className="text-[10px] text-slate-300 flex items-center gap-1">
          <ZoomIn size={10} />
          Zoom for steder
        </span>
      </div>
    );
  }

  // Desktop: Larger hint
  return (
    <div className="absolute bottom-8 right-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-10">
      <p className="text-xs text-slate-300">Zoom in to see venues</p>
    </div>
  );
}

// ============================================
// 8. MOBILE INFO SHEET
// A collapsible bottom sheet for detailed info on mobile
// ============================================

interface MobileInfoSheetProps {
  cityName: string;
  activeVenueCount: number;
  totalCheckins: number;
  heatmapMode: HeatmapMode;
  isNotificationsActive: boolean;
  isNotificationsEnabled: boolean;
  onNotificationsToggle: () => void;
  hasFavoriteCity: boolean;
}

export function MobileInfoSheet({
  cityName,
  activeVenueCount,
  totalCheckins,
  heatmapMode,
  isNotificationsActive,
  isNotificationsEnabled,
  onNotificationsToggle,
  hasFavoriteCity,
}: MobileInfoSheetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle button - fixed at bottom left */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-2 left-2 z-20 bg-slate-900/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1.5"
      >
        <Info size={12} className="text-violet-400" />
        <span className="text-[10px] font-medium text-slate-300">Info</span>
        {isOpen ? (
          <ChevronDown size={10} className="text-slate-400" />
        ) : (
          <ChevronUp size={10} className="text-slate-400" />
        )}
      </button>

      {/* Sheet content - slides up when open */}
      {isOpen && (
        <div className="absolute bottom-12 left-2 right-2 z-20 bg-slate-900/95 backdrop-blur-md rounded-lg shadow-xl border border-slate-700/50 overflow-hidden animate-slide-up">
          <div className="p-3 space-y-3">
            {/* City info */}
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin size={12} className="text-violet-400" />
                {cityName} Nightlife
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeVenueCount} aktive steder • {totalCheckins} check-ins (90 min)
              </p>
              {hasFavoriteCity && (
                <p className="text-[10px] text-slate-500 mt-1">
                  📍 Favorittby aktiv
                </p>
              )}
            </div>

            {/* Current mode */}
            <div className="pt-2 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Modus</span>
              <p className="text-xs text-slate-300">
                {heatmapMode === 'activity' && '📊 Aktivitetsnivå'}
                {heatmapMode === 'single' && '💘 Single-tetthet'}
                {heatmapMode === 'ons' && '🔥 ONS-åpenhet'}
                {heatmapMode === 'ons_boost' && '🚀 ONS Boost'}
              </p>
            </div>

            {/* Notifications status */}
            <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Varsler</span>
                <p className="text-xs text-slate-300">
                  {!isNotificationsEnabled 
                    ? '❌ Slå på i profil'
                    : isNotificationsActive 
                    ? '✅ Aktive' 
                    : '⏸️ Av'}
                </p>
              </div>
              {isNotificationsEnabled && (
                <button
                  onClick={onNotificationsToggle}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                    isNotificationsActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                      : 'bg-slate-700 text-slate-400 border border-slate-600'
                  }`}
                >
                  {isNotificationsActive ? 'Slå av' : 'Slå på'}
                </button>
              )}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-slate-700/50">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide mb-1 block">Forklaring</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 rounded-full" style={{
                  background: heatmapMode === 'single'
                    ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(236, 72, 153, 0.6), rgba(244, 63, 94, 0.9))'
                    : heatmapMode === 'ons'
                    ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(249, 115, 22, 0.6), rgba(239, 68, 68, 0.9))'
                    : heatmapMode === 'ons_boost'
                    ? 'linear-gradient(to right, rgba(249, 115, 22, 0.3), rgba(239, 68, 68, 0.6), rgba(220, 38, 38, 1))'
                    : 'linear-gradient(to right, rgba(103, 58, 183, 0.7), rgba(33, 150, 243, 0.8), rgba(76, 175, 80, 0.9), rgba(255, 193, 7, 0.9), rgba(255, 87, 34, 1), rgba(244, 67, 54, 1))'
                }} />
                <span className="text-[10px] text-slate-400">
                  {heatmapMode === 'activity' ? 'Stille → Hot' : 'Lite → Mye'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

