import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, RefreshCw } from 'lucide-react';
import type { Venue, CheckIn, TimeWindow, HeatmapMode } from '../types';
import { generateHeatmapData } from '../mocks/venues';
import { useCityName } from '../hooks/useCityName';
import { useProfile } from '../hooks/useProfile';
import { useVenueHeatmap, getHeatmapColor, getHeatmapGlow, HEATMAP_MODE_COLORS, type HeatmapVenue, type HeatmapVenueMode } from '../hooks/useVenueHeatmap';
import {
  MAPBOX_TOKEN,
  MAP_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MARKER_ZOOM_THRESHOLD,
  HEATMAP_COLORS,
  HEATMAP_RADIUS,
  HEATMAP_INTENSITY,
  HEATMAP_OPACITY,
} from '../config/map';

// Set Mapbox access token
mapboxgl.accessToken = MAPBOX_TOKEN;

// ============================================
// HEATMAP 2.0: Mode-based color schemes
// ============================================

/**
 * Get heatmap color expression based on the selected mode.
 * Each mode has a distinct color gradient.
 */
function getModeHeatmapColors(mode: HeatmapMode): mapboxgl.Expression {
  switch (mode) {
    case 'single':
      // Pink/warm gradient for singles
      return [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(254, 205, 211, 0.4)',
        0.4, 'rgba(251, 146, 60, 0.6)',
        0.6, 'rgba(249, 115, 22, 0.8)',
        0.8, 'rgba(234, 88, 12, 0.9)',
        1, 'rgba(220, 38, 38, 1)',
      ] as mapboxgl.Expression;
    
    case 'ons':
      // Hot red gradient for ONS
      return [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(254, 202, 202, 0.4)',
        0.4, 'rgba(252, 165, 165, 0.6)',
        0.6, 'rgba(248, 113, 113, 0.8)',
        0.8, 'rgba(239, 68, 68, 0.9)',
        1, 'rgba(185, 28, 28, 1)',
      ] as mapboxgl.Expression;
    
    case 'ons_boost':
      // Intense red/crimson for ONS boost
      return [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(254, 178, 178, 0.5)',
        0.4, 'rgba(248, 113, 113, 0.7)',
        0.6, 'rgba(239, 68, 68, 0.85)',
        0.8, 'rgba(220, 38, 38, 0.95)',
        1, 'rgba(153, 27, 27, 1)',
      ] as mapboxgl.Expression;
    
    case 'activity':
    default:
      // Default multi-color gradient (cool to hot)
      return HEATMAP_COLORS as mapboxgl.Expression;
  }
}

/**
 * Get marker background gradient based on mode and intensity.
 */
function getMarkerColorForMode(mode: HeatmapVenueMode, intensity: number): string {
  const colors = HEATMAP_MODE_COLORS[mode];
  
  // For low intensity, use a more muted version
  if (intensity < 0.3) {
    return `linear-gradient(135deg, ${colors.primary}80 0%, ${colors.primary}60 100%)`;
  }
  
  return colors.gradient;
}

/**
 * Build popup stats HTML based on heatmap data.
 */
function buildPopupStats(heatmapData: HeatmapVenue | undefined, fallbackCount: number): string {
  if (!heatmapData || heatmapData.totalCheckins === 0) {
    if (fallbackCount > 0) {
      return `<div class="venue-popup-stats">${fallbackCount} check-in${fallbackCount !== 1 ? 's' : ''}</div>`;
    }
    return '<div class="venue-popup-stats" style="color: #94a3b8;">Ingen nylige check-ins</div>';
  }

  const { totalCheckins, singleRatio, onsRatio, partyRatio, chillRatio, mode } = heatmapData;
  
  // Format percentages
  const formatPct = (ratio: number) => Math.round(ratio * 100);
  
  // Build stats line
  const statParts: string[] = [];
  
  if (singleRatio >= 0.3) {
    statParts.push(`💘 ${formatPct(singleRatio)}% single`);
  }
  if (onsRatio >= 0.2) {
    statParts.push(`🔥 ${formatPct(onsRatio)}% ONS`);
  }
  if (partyRatio >= 0.3) {
    statParts.push(`🎉 ${formatPct(partyRatio)}% party`);
  }
  if (chillRatio >= 0.3) {
    statParts.push(`😌 ${formatPct(chillRatio)}% chill`);
  }

  const modeColor = getHeatmapColor(mode);
  
  return `
    <div class="venue-popup-stats" style="color: ${modeColor};">
      ${totalCheckins} check-in${totalCheckins !== 1 ? 's' : ''} (90 min)
    </div>
    ${statParts.length > 0 ? `<div class="venue-popup-details">${statParts.join(' • ')}</div>` : ''}
  `;
}

interface MapViewProps {
  venues: Venue[];
  checkIns: CheckIn[];
  timeWindowMinutes: TimeWindow;
  heatmapMode: HeatmapMode;
  onVenueClick: (venueId: string) => void;
}

export function MapView({ venues, checkIns, timeWindowMinutes, heatmapMode, onVenueClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const cityName = useCityName();
  const { localPrefs } = useProfile();

  // Heatmap 2.0: Use the new venue heatmap hook for real scores
  const { heatmapVenues, isLoading: heatmapLoading, refresh: refreshHeatmap } = useVenueHeatmap();

  // Use favorite city from profile if set, otherwise use geolocation
  const effectiveCityName = localPrefs.favoriteCity !== 'auto' ? localPrefs.favoriteCity : cityName;

  // Generate heatmap data from check-ins based on current mode
  // This is used as fallback/legacy data
  const heatmapData = useMemo(() => {
    return generateHeatmapData(venues, checkIns, timeWindowMinutes, heatmapMode);
  }, [venues, checkIns, timeWindowMinutes, heatmapMode]);
  
  // Heatmap 2.0: Convert heatmapVenues to GeoJSON with mode-aware weights
  const heatmapVenueGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => {
    // Filter venues based on the selected mode
    const filteredVenues = heatmapVenues.filter(v => v.totalCheckins > 0);
    
    return {
      type: 'FeatureCollection',
      features: filteredVenues.map((venue, index) => {
        // Calculate weight based on mode
        let weight = venue.intensity;
        
        // Boost weight based on selected heatmap mode
        if (heatmapMode === 'single' && venue.singleRatio > 0.3) {
          weight = Math.min(1, venue.singleRatio * 1.5);
        } else if (heatmapMode === 'ons' && venue.onsRatio > 0.2) {
          weight = Math.min(1, venue.onsRatio * 2);
        } else if (heatmapMode === 'ons_boost' && venue.onsRatio > 0.3) {
          weight = Math.min(1, venue.onsRatio * 2.5);
        }
        
        return {
          type: 'Feature',
          properties: {
            weight,
            mode: venue.mode,
            name: venue.name,
            totalCheckins: venue.totalCheckins,
          },
          geometry: {
            type: 'Point',
            coordinates: [venue.lng, venue.lat],
          },
          id: index,
        };
      }),
    };
  }, [heatmapVenues, heatmapMode]);

  // Convert heatmap points to GeoJSON
  const heatmapGeoJSON = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: heatmapData.map((point, index) => ({
      type: 'Feature',
      properties: {
        weight: point.weight,
      },
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
      id: index,
    })),
  }), [heatmapData]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    // Add minimal attribution
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    // Track zoom level for marker visibility
    map.current.on('zoom', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    // Wait for map to load before adding layers
    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add/update heatmap layer when map is loaded and data changes
  // Heatmap 2.0: Now uses heatmapVenueGeoJSON from the new hook
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'checkins-heat';
    const layerId = 'checkins-heat-layer';

    // Remove existing layer and source if they exist
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    // Determine which data source to use
    // Use Heatmap 2.0 data if available, otherwise fall back to legacy
    const geoData = heatmapVenueGeoJSON.features.length > 0 ? heatmapVenueGeoJSON : heatmapGeoJSON;

    // Add new source
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: geoData,
    });

    // Select color scheme based on heatmap mode
    const modeColors = getModeHeatmapColors(heatmapMode);

    // Add heatmap layer
    // The heatmap visualizes check-in density and intensity
    map.current.addLayer({
      id: layerId,
      type: 'heatmap',
      source: sourceId,
      paint: {
        // Weight based on check-in's calculated weight property
        // Higher weight = more heat contribution
        'heatmap-weight': ['get', 'weight'],
        
        // Heatmap intensity increases with zoom
        // This compensates for the visual effect of zooming
        'heatmap-intensity': HEATMAP_INTENSITY as mapboxgl.Expression,
        
        // Color gradient based on mode
        'heatmap-color': modeColors as mapboxgl.Expression,
        
        // Radius of influence per point
        // Increases with zoom for consistent visual coverage
        'heatmap-radius': HEATMAP_RADIUS as mapboxgl.Expression,
        
        // Fade heatmap at high zoom when markers appear
        'heatmap-opacity': HEATMAP_OPACITY as mapboxgl.Expression,
      },
    });
  }, [mapLoaded, heatmapVenueGeoJSON, heatmapGeoJSON, heatmapMode]);

  // Add/remove venue markers based on zoom level
  // Heatmap 2.0: Now uses heatmapVenues with mode-based colors
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Only show markers above threshold zoom
    if (currentZoom < MARKER_ZOOM_THRESHOLD) return;

    // Create a map of heatmap data for quick lookup
    const heatmapMap = new Map<string, HeatmapVenue>();
    heatmapVenues.forEach(v => heatmapMap.set(v.id, v));

    // Calculate check-in counts per venue for the badge (legacy fallback)
    const venueCounts = new Map<string, number>();
    checkIns.forEach(c => {
      venueCounts.set(c.venueId, (venueCounts.get(c.venueId) || 0) + 1);
    });

    // Create markers for each venue
    venues.forEach(venue => {
      // Get heatmap data for this venue
      const heatmapData = heatmapMap.get(venue.id);
      const count = heatmapData?.totalCheckins ?? venueCounts.get(venue.id) ?? 0;
      const mode = heatmapData?.mode ?? 'neutral';
      const intensity = heatmapData?.intensity ?? 0;
      
      // Get color based on mode
      const markerColor = getMarkerColorForMode(mode, intensity);
      const glowColor = getHeatmapGlow(mode);
      
      // Create marker element with mode-based styling
      const el = document.createElement('div');
      el.className = 'venue-marker';
      el.innerHTML = `
        <div class="venue-marker-inner">
          <div class="venue-marker-icon" style="background: ${markerColor}; box-shadow: 0 4px 12px ${glowColor};">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          ${count > 0 ? `<div class="venue-marker-badge" style="background: ${getHeatmapColor(mode)};">${count}</div>` : ''}
        </div>
      `;

      // Build popup content with stats
      const statsHtml = buildPopupStats(heatmapData, count);

      // Create popup
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(`
        <div class="venue-popup">
          <div class="venue-popup-name">${venue.name}</div>
          <div class="venue-popup-address">${venue.address}</div>
          ${statsHtml}
        </div>
      `);

      // Create marker
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([venue.longitude, venue.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      // Show popup on hover
      el.addEventListener('mouseenter', () => {
        popup.addTo(map.current!);
      });
      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      // Handle click
      el.addEventListener('click', () => {
        onVenueClick(venue.id);
      });

      markersRef.current.push(marker);
    });
  }, [mapLoaded, currentZoom, venues, checkIns, heatmapVenues, onVenueClick]);

  // Calculate active venues count
  // Heatmap 2.0: Prefer heatmapVenues data if available
  const activeVenueCount = useMemo(() => {
    // Use heatmapVenues if we have data
    const activeFromHeatmap = heatmapVenues.filter(v => v.totalCheckins > 0).length;
    if (activeFromHeatmap > 0) {
      return activeFromHeatmap;
    }
    // Fallback to legacy count
    const activeVenues = new Set(checkIns.map(c => c.venueId));
    return activeVenues.size;
  }, [heatmapVenues, checkIns]);

  // Total check-ins from heatmap data
  const totalRecentCheckins = useMemo(() => {
    return heatmapVenues.reduce((sum, v) => sum + v.totalCheckins, 0);
  }, [heatmapVenues]);

  return (
    <div className="flex-1 relative rounded-xl overflow-hidden">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Info overlay - top left */}
      <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-3 shadow-lg z-10">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <MapPin size={14} className="text-violet-400" />
          {effectiveCityName} Nightlife
          {heatmapLoading && <RefreshCw size={12} className="text-violet-400 animate-spin" />}
        </h2>
        <p className="text-xs text-slate-300 mt-0.5">
          {activeVenueCount} active venue{activeVenueCount !== 1 ? 's' : ''} • {totalRecentCheckins || checkIns.length} check-in{(totalRecentCheckins || checkIns.length) !== 1 ? 's' : ''} (90 min)
        </p>
        
        {/* Favorite city indicator */}
        {localPrefs.favoriteCity !== 'auto' && (
          <div className="mt-2 pt-2 border-t border-slate-700">
            <span className="text-[11px] text-slate-400">
              Favorittby aktiv (endre i Profil)
            </span>
          </div>
        )}
      </div>

      {/* Legend - bottom left */}
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

      {/* Zoom hint */}
      {currentZoom < MARKER_ZOOM_THRESHOLD && (
        <div className="absolute bottom-8 right-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg z-10">
          <p className="text-xs text-slate-300">Zoom in to see venues</p>
        </div>
      )}

      {/* Custom marker styles */}
      <style>{`
        .venue-marker {
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .venue-marker:hover {
          transform: scale(1.15);
          z-index: 100;
        }
        .venue-marker-inner {
          position: relative;
        }
        .venue-marker-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
          border: 2px solid white;
        }
        .venue-marker-icon svg {
          transform: rotate(45deg);
          color: white;
          width: 16px;
          height: 16px;
        }
        .venue-marker-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 2px solid white;
        }
        .venue-popup {
          padding: 4px;
        }
        .venue-popup-name {
          font-weight: 600;
          font-size: 14px;
          color: #1e293b;
        }
        .venue-popup-address {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .venue-popup-stats {
          font-size: 11px;
          color: #7c3aed;
          font-weight: 500;
          margin-top: 4px;
        }
        .venue-popup-details {
          font-size: 10px;
          color: #64748b;
          margin-top: 4px;
          line-height: 1.4;
        }
        .mapboxgl-popup-content {
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .mapboxgl-popup-tip {
          border-top-color: white;
        }
      `}</style>
    </div>
  );
}
