import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ============================================
// TYPES
// ============================================

/**
 * Raw row from the venue_stats_recent view.
 * Contains computed statistics for venues with recent check-ins.
 */
interface VenueStatsRecentRow {
  venue_id: string;
  total_checkins: number;
  activity_score: number;
  single_ratio: number;
  ons_ratio: number;
  party_ratio: number;
  chill_ratio: number;
  last_checkin_at: string;
}

/**
 * Raw venue row from the venues table.
 */
interface VenueRow {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
}

/**
 * Heatmap mode determines the visual representation.
 * - neutral: default gray/muted
 * - singles: warm orange for high single concentration
 * - ons: hot red/pink for ONS-heavy venues
 * - party: vibrant yellow for party vibes
 * - chill: cool blue for relaxed venues
 */
export type HeatmapVenueMode = 'neutral' | 'singles' | 'ons' | 'party' | 'chill';

/**
 * Combined venue data with heatmap statistics.
 * Used by MapView to render the heatmap visualization.
 */
export interface HeatmapVenue {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string | null;

  // Stats from venue_stats_recent view
  totalCheckins: number;
  activityScore: number; // 0-1, normalized
  singleRatio: number;   // 0-1
  onsRatio: number;      // 0-1
  partyRatio: number;    // 0-1
  chillRatio: number;    // 0-1
  lastCheckinAt: string | null;

  // Derived UI helpers
  intensity: number;  // 0-1, used for marker size/opacity
  mode: HeatmapVenueMode;
}

interface UseVenueHeatmapReturn {
  /** Venues with heatmap data, sorted by activity */
  heatmapVenues: HeatmapVenue[];
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Manually refresh the data */
  refresh: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Thresholds for determining heatmap mode.
 * Adjust these to fine-tune when a venue appears in a particular mode.
 */
const MODE_THRESHOLDS = {
  /** ONS ratio threshold - if >= 0.4, venue is in "ons" mode */
  ons: 0.4,
  /** Single ratio threshold - if >= 0.5, venue is in "singles" mode */
  singles: 0.5,
  /** Party ratio threshold - if >= 0.3 and higher than chill, venue is in "party" mode */
  party: 0.3,
  /** Chill ratio threshold - if >= 0.3 and higher than party, venue is in "chill" mode */
  chill: 0.3,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determines the heatmap mode for a venue based on its statistics.
 * 
 * Priority order:
 * 1. ONS (if onsRatio >= 0.4)
 * 2. Singles (if singleRatio >= 0.5)
 * 3. Party (if partyRatio >= 0.3 and partyRatio >= chillRatio)
 * 4. Chill (if chillRatio >= 0.3 and chillRatio > partyRatio)
 * 5. Neutral (fallback)
 * 
 * @param stats - The venue statistics
 * @returns The determined mode
 */
function determineMode(stats: {
  onsRatio: number;
  singleRatio: number;
  partyRatio: number;
  chillRatio: number;
}): HeatmapVenueMode {
  const { onsRatio, singleRatio, partyRatio, chillRatio } = stats;

  // Check ONS first (highest priority for "hot" venues)
  if (onsRatio >= MODE_THRESHOLDS.ons) {
    return 'ons';
  }

  // Check singles
  if (singleRatio >= MODE_THRESHOLDS.singles) {
    return 'singles';
  }

  // Check party vs chill
  if (partyRatio >= MODE_THRESHOLDS.party && partyRatio >= chillRatio) {
    return 'party';
  }

  if (chillRatio >= MODE_THRESHOLDS.chill && chillRatio > partyRatio) {
    return 'chill';
  }

  return 'neutral';
}

/**
 * Extracts latitude from venue row, handling both `lat` and `latitude` columns.
 */
function getLatitude(venue: VenueRow): number | null {
  return venue.lat ?? venue.latitude ?? null;
}

/**
 * Extracts longitude from venue row, handling both `lng` and `longitude` columns.
 */
function getLongitude(venue: VenueRow): number | null {
  return venue.lng ?? venue.longitude ?? null;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook for fetching venue heatmap data.
 * 
 * Combines data from:
 * - `venues` table: id, name, lat, lng, category
 * - `venue_stats_recent` view: activity, single, ONS, party, chill scores
 * 
 * The view uses a 90-minute rolling window for statistics.
 * Activity score is normalized: 0 check-ins = 0, 20+ check-ins = 1.0
 * 
 * @returns Heatmap venues with loading/error state
 */
export function useVenueHeatmap(): UseVenueHeatmapReturn {
  const [heatmapVenues, setHeatmapVenues] = useState<HeatmapVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setError('Supabase not configured');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch venues and stats in parallel
      const [venuesResult, statsResult] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, lat, lng, latitude, longitude, category'),
        supabase
          .from('venue_stats_recent')
          .select('*'),
      ]);

      if (venuesResult.error) {
        throw new Error(`Failed to fetch venues: ${venuesResult.error.message}`);
      }

      if (statsResult.error) {
        // Stats view might not exist yet or be empty - that's OK
        console.warn('Could not fetch venue stats:', statsResult.error.message);
      }

      const venues = (venuesResult.data || []) as VenueRow[];
      const stats = (statsResult.data || []) as VenueStatsRecentRow[];

      // DEBUG: Log fetched data
      if (process.env.NODE_ENV === 'development') {
        console.log('[useVenueHeatmap] Venues fetched:', venues.length);
        console.log('[useVenueHeatmap] Stats from venue_stats_recent:', stats.length);
        if (stats.length > 0) {
          console.log('[useVenueHeatmap] First stat:', stats[0]);
        }
      }

      // Create a map for quick stats lookup
      const statsMap = new Map<string, VenueStatsRecentRow>();
      stats.forEach((s) => statsMap.set(s.venue_id, s));

      // Combine venues with their stats
      const combined: HeatmapVenue[] = [];

      for (const venue of venues) {
        const lat = getLatitude(venue);
        const lng = getLongitude(venue);

        // Skip venues without coordinates
        if (lat === null || lng === null) {
          continue;
        }

        const venueStats = statsMap.get(venue.id);

        // Default values for venues with no recent stats
        const totalCheckins = venueStats?.total_checkins ?? 0;
        const activityScore = venueStats?.activity_score ?? 0;
        const singleRatio = venueStats?.single_ratio ?? 0;
        const onsRatio = venueStats?.ons_ratio ?? 0;
        const partyRatio = venueStats?.party_ratio ?? 0;
        const chillRatio = venueStats?.chill_ratio ?? 0;
        const lastCheckinAt = venueStats?.last_checkin_at ?? null;

        // Derive mode based on stats
        const mode = determineMode({ onsRatio, singleRatio, partyRatio, chillRatio });

        // For v1, intensity is just activity score
        // Can be enhanced later (e.g., weight by mode relevance)
        const intensity = activityScore;

        combined.push({
          id: venue.id,
          name: venue.name,
          lat,
          lng,
          category: venue.category,
          totalCheckins,
          activityScore,
          singleRatio,
          onsRatio,
          partyRatio,
          chillRatio,
          lastCheckinAt,
          intensity,
          mode,
        });
      }

      // Sort by activity (most active first)
      combined.sort((a, b) => b.activityScore - a.activityScore);

      setHeatmapVenues(combined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load heatmap data';
      setError(message);
      console.error('useVenueHeatmap error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    heatmapVenues,
    isLoading,
    error,
    refresh: fetchData,
  };
}

// ============================================
// COLOR HELPERS (for use in MapView)
// ============================================

/**
 * Color configuration for each heatmap mode.
 * Used by MapView to style markers and heatmap layers.
 */
export const HEATMAP_MODE_COLORS: Record<HeatmapVenueMode, {
  primary: string;      // Main color (hex)
  gradient: string;     // CSS gradient for legends
  markerBg: string;     // Marker background (Tailwind-style)
  glowColor: string;    // Glow/shadow color (rgba)
}> = {
  ons: {
    primary: '#ef4444',      // Red
    gradient: 'linear-gradient(135deg, #f97316, #ef4444, #dc2626)',
    markerBg: 'bg-red-500',
    glowColor: 'rgba(239, 68, 68, 0.6)',
  },
  singles: {
    primary: '#f97316',      // Orange
    gradient: 'linear-gradient(135deg, #fbbf24, #f97316, #ea580c)',
    markerBg: 'bg-orange-500',
    glowColor: 'rgba(249, 115, 22, 0.6)',
  },
  party: {
    primary: '#eab308',      // Yellow
    gradient: 'linear-gradient(135deg, #fde047, #eab308, #ca8a04)',
    markerBg: 'bg-yellow-500',
    glowColor: 'rgba(234, 179, 8, 0.6)',
  },
  chill: {
    primary: '#3b82f6',      // Blue
    gradient: 'linear-gradient(135deg, #60a5fa, #3b82f6, #2563eb)',
    markerBg: 'bg-blue-500',
    glowColor: 'rgba(59, 130, 246, 0.6)',
  },
  neutral: {
    primary: '#64748b',      // Slate
    gradient: 'linear-gradient(135deg, #94a3b8, #64748b, #475569)',
    markerBg: 'bg-slate-500',
    glowColor: 'rgba(100, 116, 139, 0.4)',
  },
};

/**
 * Get the primary color for a heatmap mode.
 * @param mode - The heatmap mode
 * @returns Hex color string
 */
export function getHeatmapColor(mode: HeatmapVenueMode): string {
  return HEATMAP_MODE_COLORS[mode].primary;
}

/**
 * Get the glow/shadow color for a heatmap mode.
 * @param mode - The heatmap mode
 * @returns RGBA color string
 */
export function getHeatmapGlow(mode: HeatmapVenueMode): string {
  return HEATMAP_MODE_COLORS[mode].glowColor;
}

