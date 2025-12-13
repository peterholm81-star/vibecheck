import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import DOMPurify from 'dompurify';
import type { Venue, CheckIn, TimeWindow, HeatmapMode, Intent, VenueCategory } from '../types';
import type { AgeBand } from '../hooks/useProfile';
import { generateHeatmapData } from '../mocks/venues';
import { useCityName } from '../hooks/useCityName';
import { useProfile } from '../hooks/useProfile';
import { useVenueHeatmap, getHeatmapColor, getHeatmapGlow, HEATMAP_MODE_COLORS, type HeatmapVenue, type HeatmapVenueMode } from '../hooks/useVenueHeatmap';
import { useNotificationSession, type NotificationSessionFilters } from '../hooks/useNotificationSession';
import { useIsMobile } from '../hooks/useIsMobile';
import { updateLastSeen } from '../lib/vibeUsers';
import { useCityVenues, VenuePoint, CityStatus } from '../hooks/useCityVenues';
import { getCityRadius } from '../config/cityRadius';
import {
  MAPBOX_TOKEN,
  MAP_STYLE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  PITCH_2D,
  PITCH_3D_MAX,
  PITCH_3D_START_ZOOM,
  PITCH_3D_FULL_ZOOM,
  BEARING_2D,
  BEARING_3D,
  ENABLE_3D_BUILDINGS,
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
// SMART MARKER SYSTEM: Zoom-basert markør-visning
// ============================================

/**
 * Marker-modus basert på zoom-nivå:
 * - 'none': Kun heatmap, ingen markører (oversiktsnivå)
 * - 'recommended': Få utvalgte venues med høyest aktivitet
 * - 'extended': Flere venues, men med hard cap
 */
type MarkerMode = 'none' | 'recommended' | 'extended';

// Zoom-grenser for marker-moduser
const ZOOM_THRESHOLD_RECOMMENDED = 12.5; // Under dette: ingen markører
const ZOOM_THRESHOLD_EXTENDED = 14.5;    // Over dette: flere markører

// Maksimalt antall markører per modus
const MAX_MARKERS_RECOMMENDED = 8;
const MAX_MARKERS_EXTENDED = 25;

/**
 * Beregn marker-modus fra zoom-nivå
 */
function getMarkerMode(zoom: number): MarkerMode {
  if (zoom < ZOOM_THRESHOLD_RECOMMENDED) return 'none';
  if (zoom < ZOOM_THRESHOLD_EXTENDED) return 'recommended';
  return 'extended';
}

/**
 * Velg hvilke venues som skal vises som markører basert på aktivitet og modus.
 * Prioriterer venues med høyest aktivitet (totalCheckins fra heatmap).
 */
function selectMarkerVenues<T extends { id: string }>(
  allVenues: T[],
  heatmapMap: Map<string, HeatmapVenue>,
  markerMode: MarkerMode
): T[] {
  if (markerMode === 'none') {
    return [];
  }

  const maxCount = markerMode === 'recommended' ? MAX_MARKERS_RECOMMENDED : MAX_MARKERS_EXTENDED;

  // Sorter venues etter aktivitet (totalCheckins fra heatmap, høyest først)
  const sorted = [...allVenues].sort((a, b) => {
    const aData = heatmapMap.get(a.id);
    const bData = heatmapMap.get(b.id);
    const aCheckins = aData?.totalCheckins ?? 0;
    const bCheckins = bData?.totalCheckins ?? 0;
    return bCheckins - aCheckins; // Descending
  });

  return sorted.slice(0, maxCount);
}

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
    
    // Heatmap 2.0: Party mode - vibrant yellow/gold gradient
    case 'party':
      return [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(254, 240, 138, 0.4)',
        0.4, 'rgba(253, 224, 71, 0.6)',
        0.6, 'rgba(250, 204, 21, 0.8)',
        0.8, 'rgba(234, 179, 8, 0.9)',
        1, 'rgba(202, 138, 4, 1)',
      ] as mapboxgl.Expression;
    
    // Heatmap 2.0: Chill mode - cool blue gradient
    case 'chill':
      return [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(0, 0, 0, 0)',
        0.2, 'rgba(191, 219, 254, 0.4)',
        0.4, 'rgba(147, 197, 253, 0.6)',
        0.6, 'rgba(96, 165, 250, 0.8)',
        0.8, 'rgba(59, 130, 246, 0.9)',
        1, 'rgba(37, 99, 235, 1)',
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
  // Navigation props
  isNavigating?: boolean;
  navigationTarget?: Venue | null;
  navigationUserLocation?: { lat: number; lng: number } | null;
  routeGeoJson?: GeoJSON.FeatureCollection | null;
  navigationInfo?: { distanceMeters: number; durationSeconds: number } | null;
  onStopNavigation?: () => void;
  // Arrival detection props
  navigationArrivalState?: 'idle' | 'ready' | 'shown' | 'done';
  onArrivalPromptShown?: () => void;
  onDismissArrivalPrompt?: () => void;
  onConfirmArrivalCheckIn?: () => void;
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
  // Navigation props
  isNavigating = false,
  navigationTarget = null,
  navigationUserLocation = null,
  routeGeoJson = null,
  navigationInfo = null,
  onStopNavigation,
  // Arrival detection props
  navigationArrivalState = 'idle',
  onArrivalPromptShown,
  onDismissArrivalPrompt,
  onConfirmArrivalCheckIn,
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

  // Calculate appropriate radius for the city
  const cityRadiusKm = effectiveCityName ? getCityRadius(effectiveCityName) : 10;

  // Fetch venues from Edge Function based on city
  const {
    venues: edgeFunctionVenues,
    loading: venuesLoading,
    error: venuesError,
    cityId: resolvedCityId,
    cityCenter,
    cityStatus,
    detectedCityName,
    usingFallback,
    cityName: resolvedCityName,
  } = useCityVenues({
    cityName: effectiveCityName,
    userLat: userPosition?.lat ?? DEFAULT_CENTER[1],
    userLon: userPosition?.lon ?? DEFAULT_CENTER[0],
    radiusKm: cityRadiusKm,
    nightlifeOnly: true,
    enabled: !!userPosition && !!effectiveCityName,
    useNearestCity: true,
    useFallback: true,
  });
  
  // DEBUG: Log city resolution
  useEffect(() => {
    console.log("[MapView] localPrefs.favoriteCity:", localPrefs.favoriteCity);
    console.log("[MapView] effectiveCityName:", effectiveCityName);
    console.log("[MapView] resolvedCityName:", resolvedCityName);
    console.log("[MapView] cityCenter:", cityCenter);
  }, [localPrefs.favoriteCity, effectiveCityName, resolvedCityName, cityCenter]);
  
  // Fly map to city center when city changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !cityCenter) return;
    
    console.log("[MapView] Flying to city center:", cityCenter);
    map.current.flyTo({
      center: [cityCenter.lon, cityCenter.lat],
      zoom: 13,
      duration: 1500,
    });
  }, [mapLoaded, cityCenter]);

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

  // ============================================
  // SMART MARKER SYSTEM: Zoom-basert utvalg
  // ============================================
  
  // Beregn marker-modus fra nåværende zoom
  const markerMode = useMemo<MarkerMode>(() => {
    return getMarkerMode(currentZoom);
  }, [currentZoom]);

  // Lag en Map for rask oppslag av heatmap-data per venue
  const heatmapMap = useMemo(() => {
    const map = new Map<string, HeatmapVenue>();
    heatmapVenues.forEach(v => map.set(v.id, v));
    return map;
  }, [heatmapVenues]);

  // Velg hvilke venues som skal vises som markører (basert på zoom og aktivitet)
  const markerVenues = useMemo(() => {
    return selectMarkerVenues(venues, heatmapMap, markerMode);
  }, [venues, heatmapMap, markerMode]);

  // Debug-logging for marker-systemet
  useEffect(() => {
    console.log('[MapView] Marker-modus', {
      zoomLevel: currentZoom.toFixed(1),
      markerMode,
      totalVenues: venues.length,
      markerCount: markerVenues.length,
    });
  }, [currentZoom, markerMode, venues.length, markerVenues.length]);

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
    const data = generateHeatmapData(venues, checkIns, timeWindowMinutes, heatmapMode);
    
    // DEBUG: Log heatmap data generation
    if (process.env.NODE_ENV === 'development') {
      console.log('[MapView] Generating heatmap:');
      console.log('  - Venues:', venues.length);
      console.log('  - Check-ins:', checkIns.length);
      console.log('  - Heatmap points:', data.length);
    }
    
    return data;
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
        // Heatmap 2.0: Party and Chill modes use partyRatio and chillRatio from venue_stats_recent
        else if (heatmapMode === 'party' && venue.partyRatio > 0.2) {
          weight = Math.min(1, venue.partyRatio * 2);
        } else if (heatmapMode === 'chill' && venue.chillRatio > 0.2) {
          weight = Math.min(1, venue.chillRatio * 2);
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

  // ============================================
  // DYNAMIC 3D VIEW: Adjusts pitch/bearing based on zoom
  // ============================================
  
  // Track last applied pitch/bearing to avoid unnecessary updates
  const lastPitchRef = useRef<number>(PITCH_2D);
  const lastBearingRef = useRef<number>(BEARING_2D);
  
  /**
   * Updates camera pitch and bearing based on current zoom level.
   * - Low zoom: flat 2D view
   * - High zoom: tilted 3D perspective
   * - Navigation mode: extra tilt for immersion
   * - Uses epsilon check to avoid micro-updates for smoother performance
   */
  const updateViewForZoom = (mapInstance: mapboxgl.Map, navigating: boolean) => {
    const z = mapInstance.getZoom();
    const EPSILON = 0.1; // Only update if change > 0.1 degrees

    let targetPitch: number;
    let targetBearing: number;

    // Below start zoom: completely flat 2D
    if (z <= PITCH_3D_START_ZOOM) {
      targetPitch = PITCH_2D;
      targetBearing = BEARING_2D;
    }
    // Above full zoom: maximum 3D
    else if (z >= PITCH_3D_FULL_ZOOM) {
      targetPitch = navigating ? Math.max(50, PITCH_3D_MAX) : PITCH_3D_MAX;
      targetBearing = BEARING_3D;
    }
    // Between: linear interpolation
    else {
      const t = (z - PITCH_3D_START_ZOOM) / (PITCH_3D_FULL_ZOOM - PITCH_3D_START_ZOOM);
      targetPitch = PITCH_2D + t * (PITCH_3D_MAX - PITCH_2D);
      targetBearing = BEARING_2D + t * (BEARING_3D - BEARING_2D);

      // Navigation boost: ensure minimum pitch of 45° when navigating
      if (navigating) {
        targetPitch = Math.max(45, targetPitch);
      }
    }

    // Only update if change exceeds epsilon (smoother, less stuttering)
    const pitchDelta = Math.abs(targetPitch - lastPitchRef.current);
    const bearingDelta = Math.abs(targetBearing - lastBearingRef.current);

    if (pitchDelta > EPSILON) {
      mapInstance.setPitch(targetPitch);
      lastPitchRef.current = targetPitch;
    }

    if (bearingDelta > EPSILON) {
      mapInstance.setBearing(targetBearing);
      lastBearingRef.current = targetBearing;
    }

    // Debug logging (uncomment to troubleshoot)
    // console.log('[Zoom debug]', z.toFixed(2), targetPitch.toFixed(1), targetBearing.toFixed(1));
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: PITCH_2D,      // Start flat, will adjust based on zoom
      bearing: BEARING_2D,
      antialias: true,
      attributionControl: false,
    });

    // Global error handler for map errors
    map.current.on('error', (e) => {
      console.error('[Mapbox error]', e && e.error);
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

    // Continuous zoom handler: updates both zoom state AND pitch/bearing in real-time
    const handleZoom = () => {
      if (!map.current) return;
      setCurrentZoom(map.current.getZoom());
      updateViewForZoom(map.current, isNavigating);
    };
    map.current.on('zoom', handleZoom);

    // Wait for map to load before adding layers
    map.current.on('load', () => {
      if (!map.current) return;

      // Set initial view based on current zoom
      updateViewForZoom(map.current, isNavigating);

      // Configure 3D lighting for better depth perception
      try {
        map.current.setLight({
          anchor: 'viewport',
          color: '#ffe6cc',
          intensity: 0.4,
        });
      } catch (e) {
        console.warn('[Mapbox 3D] Could not set lighting:', e);
      }

      // Add 3D buildings layer if enabled
      if (ENABLE_3D_BUILDINGS) {
        try {
          const style = map.current.getStyle();
          const layers = style?.layers || [];

          // Find first label layer to insert 3D buildings underneath
          const labelLayer = layers.find(
            (layer) =>
              layer.type === 'symbol' &&
              layer.layout &&
              (layer.layout as Record<string, unknown>)['text-field']
          );
          const labelLayerId = labelLayer?.id;

          // Only add if not already present
          if (!map.current.getLayer('3d-buildings')) {
            map.current.addLayer(
              {
                id: '3d-buildings',
                source: 'composite',
                'source-layer': 'building',
                filter: ['==', 'extrude', 'true'],
                type: 'fill-extrusion',
                minzoom: 15,
                paint: {
                  'fill-extrusion-color': '#a9b3c5',
                  'fill-extrusion-height': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    15,
                    0,
                    15.05,
                    ['get', 'height'],
                  ],
                  'fill-extrusion-base': ['get', 'min_height'],
                  'fill-extrusion-opacity': 0.85,
                },
              },
              labelLayerId
            );
          }
        } catch (e) {
          console.warn('[Mapbox 3D] Could not add 3D buildings:', e);
        }
      }

      // Add user position glow layers
      try {
        if (!map.current.getSource('user-position')) {
          map.current.addSource('user-position', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          // Outer glow
          map.current.addLayer({
            id: 'user-position-glow',
            type: 'circle',
            source: 'user-position',
            paint: {
              'circle-radius': 30,
              'circle-color': 'rgba(0, 255, 255, 0.2)',
              'circle-blur': 0.7,
            },
          });

          // Core dot
          map.current.addLayer({
            id: 'user-position-core',
            type: 'circle',
            source: 'user-position',
            paint: {
              'circle-radius': 6,
              'circle-color': 'rgba(0, 255, 255, 0.9)',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.5,
            },
          });
        }
      } catch (e) {
        console.warn('[Mapbox 3D] Could not add user position layers:', e);
      }

      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.off('zoom', handleZoom);
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update user position glow when position changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('user-position') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (!userPosition) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [userPosition.lon, userPosition.lat],
          },
          properties: {},
        },
      ],
    });
  }, [mapLoaded, userPosition]);

  // Update pitch/bearing when navigation mode changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    updateViewForZoom(map.current, isNavigating);
  }, [mapLoaded, isNavigating]);

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
  // SMART MARKER SYSTEM: Bruker markerVenues (zoom-basert utvalg) i stedet for alle venues
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Smart marker system: Hvis markerMode er 'none', vis ingen markører
    if (markerMode === 'none') return;

    // Calculate check-in counts per venue for the badge (legacy fallback)
    const venueCounts = new Map<string, number>();
    checkIns.forEach(c => {
      venueCounts.set(c.venueId, (venueCounts.get(c.venueId) || 0) + 1);
    });

    // Create markers kun for utvalgte venues (basert på zoom og aktivitet)
    markerVenues.forEach(venue => {
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

      // Build popup HTML and sanitize to prevent XSS
      const popupHtml = `
        <div class="venue-popup">
          <div class="venue-popup-name">${venue.name ?? ''}</div>
          <div class="venue-popup-address">${venue.address ?? ''}</div>
          ${statsHtml}
        </div>
      `;
      const sanitizedPopupHtml = DOMPurify.sanitize(popupHtml);

      // Create popup with sanitized HTML
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
      }).setHTML(sanitizedPopupHtml);

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
  }, [mapLoaded, markerMode, markerVenues, checkIns, heatmapMap, onVenueClick]);

  // ============================================
  // RESIZE MAP WHEN ENTERING/EXITING NAVIGATION MODE
  // ============================================
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    // Give the CSS a moment to apply, then resize the map
    const timeoutId = setTimeout(() => {
      map.current?.resize();
      console.log('[MapView] Resized map for navigation mode:', isNavigating);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [mapLoaded, isNavigating]);

  // ============================================
  // NAVIGATION ROUTE LAYER
  // ============================================
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    
    const sourceId = 'navigation-route-source';
    const layerId = 'navigation-route-layer';
    
    // Remove existing layer and source
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }
    
    // If not navigating or no route, just clean up
    if (!isNavigating || !routeGeoJson) {
      return;
    }
    
    console.log('[MapView] Adding navigation route layer');
    
    // Add route source
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: routeGeoJson,
    });
    
    // Add route line layer (on top of everything)
    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#10b981', // Emerald-500
        'line-width': 6,
        'line-opacity': 0.9,
      },
    });
    
    // Fit map to show route
    if (navigationUserLocation && navigationTarget?.latitude && navigationTarget?.longitude) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([navigationUserLocation.lng, navigationUserLocation.lat]);
      bounds.extend([navigationTarget.longitude, navigationTarget.latitude]);
      
      map.current.fitBounds(bounds, {
        padding: { top: 100, bottom: 150, left: 50, right: 50 },
        maxZoom: 16,
      });
    }
    
  }, [mapLoaded, isNavigating, routeGeoJson, navigationUserLocation, navigationTarget]);

  // ============================================
  // ARRIVAL PROMPT - Trigger when ready
  // ============================================
  useEffect(() => {
    if (!isNavigating) return;
    if (navigationArrivalState === 'ready') {
      onArrivalPromptShown?.();
    }
  }, [isNavigating, navigationArrivalState, onArrivalPromptShown]);

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
    <div className={`flex-1 relative rounded-xl overflow-hidden ${isNavigating ? 'navigation-mode-active' : ''}`}>
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* ============================================
          NAVIGATION OVERLAY
          Shows when navigation is active
          Clean navigation UI: exit button top-left, X button top-right
          ============================================ */}
      {isNavigating && (
        <>
          {/* Navigation controls - positioned at top for easy access */}
          {onStopNavigation && navigationArrivalState !== 'shown' && (
            <div className="absolute top-0 left-0 right-0 z-50">
              {/* Safe area padding for iOS notch */}
              <div className="flex items-start justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                {/* Exit navigation button - top left */}
                <button
                  onClick={onStopNavigation}
                  className="bg-slate-900/95 hover:bg-slate-800 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-slate-700/50 shadow-lg text-white font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Avslutt
                </button>
                
                {/* Navigation info - center (only shows when route calculated) */}
                {navigationInfo ? (
                  <div className="bg-emerald-900/95 backdrop-blur-sm px-4 py-2 rounded-xl border border-emerald-700/50 shadow-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-100 font-bold">
                        {Math.round(navigationInfo.durationSeconds / 60)} min
                      </span>
                      <span className="text-emerald-500">•</span>
                      <span className="text-emerald-200">
                        {navigationInfo.distanceMeters >= 1000 
                          ? `${(navigationInfo.distanceMeters / 1000).toFixed(1)} km`
                          : `${Math.round(navigationInfo.distanceMeters)} m`
                        }
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-xl">
                    <span className="text-slate-300 text-sm">Beregner rute...</span>
                  </div>
                )}
                
                {/* X button - top right */}
                <button
                  onClick={onStopNavigation}
                  className="w-10 h-10 bg-slate-900/95 hover:bg-red-600 backdrop-blur-sm rounded-full border border-slate-700/50 shadow-lg flex items-center justify-center transition-colors"
                  title="Lukk navigasjon"
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Destination name - below controls */}
              {navigationTarget && (
                <div className="flex justify-center -mt-1 pb-2">
                  <div className="bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <p className="text-white text-sm font-medium">
                      → {navigationTarget.name}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Arrival prompt popup */}
          {navigationTarget && navigationArrivalState === 'shown' && (
            <div className="navigation-arrival-modal">
              <div className="navigation-arrival-modal__content">
                <p className="text-white text-sm text-center">
                  Du er fremme på <strong className="text-emerald-400">{navigationTarget.name}</strong>
                  <br />
                  <span className="text-slate-300">Vil du sjekke inn?</span>
                </p>
                <div className="navigation-arrival-modal__buttons">
                  <button
                    type="button"
                    onClick={onDismissArrivalPrompt}
                    className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    Ikke nå
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmArrivalCheckIn}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Sjekk inn nå
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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

      {/* City not supported banner - shows when using fallback city */}
      {usingFallback && detectedCityName && resolvedCityName && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30 max-w-sm mx-4">
          <div className="bg-amber-900/90 backdrop-blur-sm px-4 py-3 rounded-xl border border-amber-700/50 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-200">
                  VibeCheck er ikke lansert i {detectedCityName} ennå
                </p>
                <p className="text-xs text-amber-300/80 mt-1">
                  Kartet viser {resolvedCityName} som eksempel. Vi jobber med å utvide til flere byer!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          RESPONSIVE MAP OVERLAYS
          Shows different UI on mobile vs desktop
          HIDDEN during navigation mode to keep map clean
          ============================================ */}
      {!isNavigating && (
        <>
          {isMobile ? (
            <>
              {/* MOBILE LAYOUT */}
              
              {/* TODO: MobileTopBar temporarily hidden to reduce map clutter
              <MobileTopBar
                cityName={effectiveCityName}
                activeVenueCount={activeVenueCount}
                totalCheckins={totalRecentCheckins || checkIns.length}
                isLoading={heatmapLoading}
              />
              */}

              {/* Notification toggle button (top right) - kept visible */}
              <LiveAlertsToggle
                isActive={!!activeSessionId}
                isLoading={isActivating || isDeactivating}
                isDisabled={!profile?.allowNotifications}
                onToggle={handleMobileNotificationToggle}
              />

              {/* ONS mode indicator (small pill, bottom right) */}
              <OnsIndicator heatmapMode={heatmapMode} />

              {/* TODO: InfoButton temporarily hidden to reduce map clutter
              <InfoButton
                cityName={effectiveCityName}
                activeVenueCount={activeVenueCount}
                totalCheckins={totalRecentCheckins || checkIns.length}
                heatmapMode={heatmapMode}
                hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
              />
              */}
            </>
          ) : (
            <>
              {/* DESKTOP LAYOUT - Original full-featured panels */}
              
              {/* TODO: DesktopCityInfo temporarily hidden to reduce map clutter
              <DesktopCityInfo
                cityName={effectiveCityName}
                activeVenueCount={activeVenueCount}
                totalCheckins={totalRecentCheckins || checkIns.length}
                isLoading={heatmapLoading}
                hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
              />
              */}

              {/* Live notifications panel (top right) - kept visible */}
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

              {/* TODO: InfoButton temporarily hidden to reduce map clutter
              <InfoButton
                cityName={effectiveCityName}
                activeVenueCount={activeVenueCount}
                totalCheckins={totalRecentCheckins || checkIns.length}
                heatmapMode={heatmapMode}
                hasFavoriteCity={localPrefs.favoriteCity !== 'auto'}
              />
              */}
            </>
          )}
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
