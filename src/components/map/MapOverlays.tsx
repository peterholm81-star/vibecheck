import { useState } from 'react';
import { MapPin, Bell, BellOff, RefreshCw, Info, X } from 'lucide-react';
import type { HeatmapMode } from '../../types';

// ============================================
// MAP OVERLAY COMPONENTS
// ============================================
// Clean, minimal overlays that don't block the map.
// Mobile: Small pills/chips positioned to avoid Mapbox controls
// Desktop: Full-featured panels
// ============================================

// ============================================
// 1. MOBILE TOP BAR
// A slim bar at the top showing the city name and stats
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
      
      {/* Stats pill */}
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
        {activeVenueCount} active venue{activeVenueCount !== 1 ? 's' : ''} • {totalCheckins} check-in{totalCheckins !== 1 ? 's' : ''} (siste 3t)
      </p>
      
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
      className={`absolute top-2 right-2 z-10 w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all ${
        isActive
          ? 'bg-amber-500 text-white'
          : isDisabled
          ? 'bg-slate-700/80 text-slate-500 cursor-not-allowed'
          : 'bg-slate-900/90 text-slate-400 hover:text-white'
      }`}
      title={isActive ? 'Varsler aktive' : 'Aktiver varsler'}
    >
      {isLoading ? (
        <RefreshCw size={18} className="animate-spin" />
      ) : isActive ? (
        <Bell size={18} />
      ) : (
        <BellOff size={18} />
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
        
        {isLoading && (
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <RefreshCw size={10} className="animate-spin" />
            {isActivating ? 'Starter...' : 'Stopper...'}
          </p>
        )}
        
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
// A small chip showing the current heatmap mode
// Positioned bottom-right to avoid Mapbox attribution
// ============================================

interface OnsIndicatorProps {
  heatmapMode: HeatmapMode;
}

export function OnsIndicator({ heatmapMode }: OnsIndicatorProps) {
  // Only show for special modes, not for default 'activity'
  if (heatmapMode === 'activity') return null;

  const modeConfig: Record<HeatmapMode, { label: string; emoji: string; color: string }> = {
    activity: { label: '', emoji: '', color: '' },
    single: { label: 'Single', emoji: '💘', color: 'bg-pink-500/90' },
    ons: { label: 'ONS', emoji: '🔥', color: 'bg-orange-500/90' },
    ons_boost: { label: 'Boost', emoji: '🚀', color: 'bg-red-500/90' },
  };

  const config = modeConfig[heatmapMode];

  return (
    <div className={`absolute bottom-3 right-3 z-10 ${config.color} rounded-full px-2.5 py-1 shadow-lg`}>
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
// 7. INFO BUTTON
// A floating button in bottom-left that opens the info panel
// Positioned above the Mapbox logo
// ============================================

interface InfoButtonProps {
  cityName: string;
  activeVenueCount: number;
  totalCheckins: number;
  heatmapMode: HeatmapMode;
  hasFavoriteCity: boolean;
}

export function InfoButton({
  cityName,
  activeVenueCount,
  totalCheckins,
  heatmapMode,
  hasFavoriteCity,
}: InfoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Info button - bottom left, above Mapbox logo */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-7 left-2 z-10 w-9 h-9 bg-slate-900/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-violet-400 hover:text-white hover:bg-slate-800 transition-all"
        title="Vis info"
      >
        <Info size={16} />
      </button>

      {/* Info panel overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          {/* Bottom sheet */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl shadow-xl border-t border-slate-700 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin size={14} className="text-violet-400" />
                {cityName} Nightlife
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Stats */}
              <div>
                <p className="text-sm text-slate-300">
                  {activeVenueCount} aktive steder • {totalCheckins} check-ins
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Siste 3 timer
                </p>
                {hasFavoriteCity && (
                  <p className="text-xs text-violet-400 mt-2">
                    📍 Favorittby aktiv
                  </p>
                )}
              </div>

              {/* Current mode */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Kartmodus</span>
                <p className="text-sm text-slate-300 mt-1">
                  {heatmapMode === 'activity' && '📊 Aktivitetsnivå'}
                  {heatmapMode === 'single' && '💘 Single-tetthet'}
                  {heatmapMode === 'ons' && '🔥 ONS-åpenhet'}
                  {heatmapMode === 'ons_boost' && '🚀 ONS Boost'}
                </p>
              </div>

              {/* Legend */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide mb-2 block">Forklaring</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-3 rounded-full" style={{
                    background: heatmapMode === 'single'
                      ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(236, 72, 153, 0.6), rgba(244, 63, 94, 0.9))'
                      : heatmapMode === 'ons'
                      ? 'linear-gradient(to right, rgba(103, 58, 183, 0.3), rgba(249, 115, 22, 0.6), rgba(239, 68, 68, 0.9))'
                      : heatmapMode === 'ons_boost'
                      ? 'linear-gradient(to right, rgba(249, 115, 22, 0.3), rgba(239, 68, 68, 0.6), rgba(220, 38, 38, 1))'
                      : 'linear-gradient(to right, rgba(103, 58, 183, 0.7), rgba(33, 150, 243, 0.8), rgba(76, 175, 80, 0.9), rgba(255, 193, 7, 0.9), rgba(255, 87, 34, 1), rgba(244, 67, 54, 1))'
                  }} />
                  <span className="text-xs text-slate-400">
                    {heatmapMode === 'activity' ? 'Stille → Hot' : 'Lite → Mye'}
                  </span>
                </div>
              </div>
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-8" />
          </div>
        </div>
      )}
    </>
  );
}
