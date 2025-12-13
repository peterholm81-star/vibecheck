// ============================================
// MAPBOX CONFIGURATION
// ============================================

/**
 * Mapbox access token (required)
 * Must be set in environment variables: VITE_MAPBOX_TOKEN
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Warn if token is missing (helps catch misconfiguration early)
if (!MAPBOX_TOKEN) {
  console.warn('[Mapbox] VITE_MAPBOX_TOKEN is not set. Map will not load correctly.');
}

/**
 * Map style URL
 * Uses custom style from env, or falls back to Mapbox dark theme
 */
export const MAP_STYLE =
  import.meta.env.VITE_MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/dark-v11';

/**
 * Default map center (Trondheim sentrum)
 * 
 * TODO: In the future, the map should center on the user's current location
 * when they log in, using the browser's Geolocation API.
 */
export const DEFAULT_CENTER: [number, number] = [10.3950, 63.4305];

/**
 * Default zoom level
 * - 12: City overview
 * - 14: Neighborhood level
 * - 16: Street level
 */
export const DEFAULT_ZOOM = 13;

// ============================================
// 3D CAMERA CONFIGURATION
// ============================================

/**
 * Zoom boundaries for 2D/3D transition
 * Below START_ZOOM: completely flat 2D
 * Above FULL_ZOOM: full 3D perspective
 * Between: linear interpolation
 */
export const PITCH_3D_START_ZOOM = 13;
export const PITCH_3D_FULL_ZOOM = 16;

/**
 * Pitch values (camera tilt)
 * 0 = looking straight down (2D)
 * 60 = tilted perspective (3D)
 */
export const PITCH_2D = 0;
export const PITCH_3D_MAX = 60;

/**
 * Bearing values (camera rotation)
 * 0 = north up
 * -20 = slightly rotated for depth
 */
export const BEARING_2D = 0;
export const BEARING_3D = -20;

/**
 * Toggle for 3D buildings (extrusions)
 */
export const ENABLE_3D_BUILDINGS = true;

/**
 * Zoom threshold for showing venue markers
 * Below this zoom, only heatmap is visible
 * Above this zoom, venue markers appear
 */
export const MARKER_ZOOM_THRESHOLD = 14;

// ============================================
// HEATMAP LAYER CONFIGURATION
// ============================================

/**
 * Heatmap color gradient (from cool to hot)
 * Values are: [stop, red, green, blue, alpha]
 * 
 * Color progression:
 * 0.0 = transparent (no heat)
 * 0.2 = blue (low activity)
 * 0.4 = cyan (moderate)
 * 0.6 = yellow (good activity)
 * 0.8 = orange (high activity)
 * 1.0 = red (on fire!)
 */
export const HEATMAP_COLORS = [
  'interpolate',
  ['linear'],
  ['heatmap-density'],
  0, 'rgba(0, 0, 0, 0)',
  0.1, 'rgba(103, 58, 183, 0.4)',   // violet (quiet)
  0.3, 'rgba(33, 150, 243, 0.6)',   // blue (ok)
  0.5, 'rgba(76, 175, 80, 0.7)',    // green (warming up)
  0.7, 'rgba(255, 193, 7, 0.8)',    // yellow (good)
  0.85, 'rgba(255, 87, 34, 0.9)',   // orange (hot)
  1.0, 'rgba(244, 67, 54, 1)',      // red (on fire)
];

/**
 * Heatmap radius in pixels
 * Controls how far the heat spreads from each point
 * Increases with zoom to maintain visual consistency
 */
export const HEATMAP_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 15,   // At zoom 10, radius is 15px
  12, 25,   // At zoom 12, radius is 25px
  14, 40,   // At zoom 14, radius is 40px
  16, 60,   // At zoom 16, radius is 60px
];

/**
 * Heatmap intensity based on zoom
 * Higher intensity at lower zoom to compensate for smaller radius
 */
export const HEATMAP_INTENSITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10, 1.5,
  12, 1.2,
  14, 1.0,
  16, 0.8,
];

/**
 * Heatmap opacity based on zoom
 * Fades out at high zoom when markers become visible
 */
export const HEATMAP_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  13, 1,
  15, 0.6,
  17, 0.3,
];


