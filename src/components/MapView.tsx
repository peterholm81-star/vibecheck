import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Venue, CheckIn, TimeWindow, HeatmapMode, Intent, VenueCategory } from '../types';
import type { AgeBand } from '../hooks/useProfile';
import { generateHeatmapData } from '../mocks/venues';
import { useCityName } from '../hooks/useCityName';
import { useProfile } from '../hooks/useProfile';
import { useVenueHeatmap, getHeatmapColor, getHeatmapGlow, HEATMAP_MODE_COLORS, type HeatmapVenue, type HeatmapVenueMode } from '../hooks/useVenueHeatmap';
import { useNotificationSession, type NotificationSessionFilters } from '../hooks/useNotificationSession';
import { useIsMobile } from '../hooks/useIsMobile';
import { updateLastSeen } from '../lib/vibeUsers';
import { useCityVenues, VenuePoint } from '../hooks/useCityVenues';
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

// Import mobile-friendly overlay components
import {
  MobileTopBar,
  DesktopCityInfo,
  LiveAlertsToggle,
  DesktopLiveAlertsPanel,
  OnsIndicator,
  DesktopLegend,
  InfoButton,
} from './map/MapOverlays';

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
  // Filter state for notification sessions
  activeIntents?: Intent[];
  activeAgeBands?: AgeBand[];
  singlesOnly?: boolean;
}

export function MapView({ 
  venues: propsVenues, 
  checkIns, 
  timeWindowMinutes, 
  heatmapMode, 
  onVenueClick,
  activeIntents = [],
  activeAgeBands = [],
  singlesOnly = false,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
  const cityName = useCityName();
  const { profile, localPrefs } = useProfile();
  
  // Detect if we're on a mobile screen (< 768px width)
  const isMobile = useIsMobile();

  // Use favorite city from profile if set, otherwise use geolocation-based name
  const effectiveCityName = localPrefs.favoriteCity !== 'auto' ? localPrefs.favoriteCity : cityName;

  // Get user position for venue fetching
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          // Fallback to default center if geolocation fails
          setUserPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
        }
      );
    } else {
      setUserPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
    }
  }, []);

  // Fetch venues from Edge Function based on city
  const {
    venues: edgeFunctionVenues,
    loading: venuesLoading,
    error: venuesError,
    cityId: resolvedCityId,
  } = useCityVenues({
    cityName: effectiveCityName,
    userLat: userPosition?.lat ?? DEFAULT_CENTER[1],
    userLon: userPosition?.lon ?? DEFAULT_CENTER[0],
    radiusKm: 10,
    nightlifeOnly: true,
    enabled: !!userPosition && !!effectiveCityName,
  });

  // Convert edge function venues to the Venue type expected by the rest of the component
  const convertedEdgeVenues: Venue[] = useMemo(() => {
    return edgeFunctionVenues.map((v: VenuePoint) => ({
      id: v.id,
      name: v.name,
      address: '', // Not available from edge function
      latitude: v.lat,
      longitude: v.lon,
      category: (v.category as VenueCategory) || 'bar',
      createdAt: new Date().toISOString(),
    }));
  }, [edgeFunctionVenues]);

  // Use edge function venues if available and cityId was resolved, otherwise fall back to props
  const venues = useMemo(() => {
    if (resolvedCityId && convertedEdgeVenues.length > 0) {
      return convertedEdgeVenues;
    }
    return propsVenues;
  }, [resolvedCityId, convertedEdgeVenues, propsVenues]);

  // Heatmap 2.0: Use the new venue heatmap hook for real scores
  const { heatmapVenues, isLoading: heatmapLoading, refresh: refreshHeatmap } = useVenueHeatmap();

  // Update last_seen_at in vibe_users when map opens
  // This is a fire-and-forget operation
  useEffect(() => {
    updateLastSeen();
  }, []);

  // Notification session ("Live-varsler for kvelden")
  const {
    activeSessionId,
    isActivating,
    isDeactivating,
    error: notificationError,
    startSession,
    stopSession,
  } = useNotificationSession();

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

    // Add minimal attribution (bottom-left to keep bottom-right clean)
    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    // Add navigation controls (hidden on mobile via CSS)
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

  // Helper function to handle notification toggle
  const handleNotificationToggle = (enabled: boolean) => {
    if (enabled) {
      // Build filters snapshot from current state
      const filters: NotificationSessionFilters = {
        heatmapMode,
        activeIntents,
        activeAgeBands,
        singlesOnly,
        timeWindowMinutes,
      };
      startSession({ filters });
    } else {
      stopSession();
    }
  };

  // Helper for mobile toggle (just toggles the current state)
  const handleMobileNotificationToggle = () => {
    handleNotificationToggle(!activeSessionId);
  };

  return (
    <div className="flex-1 relative rounded-xl overflow-hidden">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Venues loading indicator */}
      {venuesLoading && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50">
            <span className="text-xs text-slate-300">Laster venues...</span>
          </div>
        </div>
      )}

      {/* Venues error indicator */}
      {venuesError && !venuesLoading && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-900/80 backdrop-blur-sm px-4 py-2 rounded-full border border-red-700/50">
            <span className="text-xs text-red-200">{venuesError}</span>
          </div>
        </div>
      )}

      {/* ============================================
          RESPONSIVE MAP OVERLAYS
          Shows different UI on mobile vs desktop
          ============================================ */}

      {isMobile ? (
        <>
          {/* MOBILE LAYOUT */}
          
          {/* Top bar with city name and stats */}
          <MobileTopBar
            cityName={effectiveCityName}
            activeVenueCount={activeVenueCount}
            totalCheckins={totalRecentCheckins || checkIns.length}
            isLoading={heatmapLoading}
          />

          {/* Notification toggle button (top right) */}
          <LiveAlertsToggle
            isActive={!!activeSessionId}
            isLoading={isActivating || isDeactivating}
            isDisabled={!profile?.allowNotifications}
            onToggle={handleMobileNotificationToggle}
          />

          {/* ONS mode indicator (small pill, bottom right) */}
          <OnsIndicator heatmapMode={heatmapMode} />

          {/* Info button (bottom left, above Mapbox logo) */}
          <InfoButton
            cityName={effectiveCityName}
            activeVenueCount={activeVenueCount}
            totalCheckins={totalRecentCheckins || checkIns.length}
            heatmapMode={heatmapMode}
            hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
          />
        </>
      ) : (
        <>
          {/* DESKTOP LAYOUT - Original full-featured panels */}
          
          {/* City info box (top left) */}
          <DesktopCityInfo
            cityName={effectiveCityName}
            activeVenueCount={activeVenueCount}
            totalCheckins={totalRecentCheckins || checkIns.length}
            isLoading={heatmapLoading}
            hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
          />

          {/* Live notifications panel (top right) */}
          <DesktopLiveAlertsPanel
            isActive={!!activeSessionId}
            isActivating={isActivating}
            isDeactivating={isDeactivating}
            isNotificationsEnabled={!!profile?.allowNotifications}
            error={notificationError}
            onToggle={handleNotificationToggle}
          />

          {/* Legend (bottom left) */}
          <DesktopLegend heatmapMode={heatmapMode} />

          {/* Info button (bottom left, above legend) */}
          <InfoButton
            cityName={effectiveCityName}
            activeVenueCount={activeVenueCount}
            totalCheckins={totalRecentCheckins || checkIns.length}
            heatmapMode={heatmapMode}
            hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
          />
        </>
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
