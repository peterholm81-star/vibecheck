import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MOCK_VENUES, MOCK_CHECKINS } from '../mocks/venues';
import type { Venue, CheckIn, VibeScore, Intent, RelationshipStatus, OnsIntent } from '../types';
import type { Gender, AgeBand } from '../hooks/useProfile';

// ============================================
// SIMULATED NETWORK DELAY (for realistic UX)
// ============================================

const MOCK_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// GET ALL VENUES
// ============================================

export async function getVenues(): Promise<{ data: Venue[] | null; error: string | null }> {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('name');

      if (error) throw error;

      const venues: Venue[] = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        category: row.category,
        createdAt: row.created_at,
      }));

      return { data: venues, error: null };
    }

    // Use mock data
    await delay(MOCK_DELAY_MS);
    return { data: MOCK_VENUES, error: null };
  } catch (err) {
    console.error('Error fetching venues:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch venues',
    };
  }
}

// ============================================
// GET VENUE BY ID
// ============================================

export async function getVenueById(
  id: string
): Promise<{ data: Venue | null; error: string | null }> {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const venue: Venue = {
        id: data.id,
        name: data.name,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        category: data.category,
        createdAt: data.created_at,
      };

      return { data: venue, error: null };
    }

    // Use mock data
    await delay(MOCK_DELAY_MS);
    const venue = MOCK_VENUES.find((v) => v.id === id) || null;

    if (!venue) {
      return { data: null, error: 'Venue not found' };
    }

    return { data: venue, error: null };
  } catch (err) {
    console.error('Error fetching venue:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch venue',
    };
  }
}

// ============================================
// GET ALL CHECK-INS (fetches all, filtering done in frontend)
// ============================================

export async function getRecentCheckIns(): Promise<{
  data: CheckIn[] | null;
  error: string | null;
}> {
  try {
    if (isSupabaseConfigured && supabase) {
      // Fetch last 3 hours of data (max window)
      const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();

      // DEBUG: Log time filter
      if (process.env.NODE_ENV === 'development') {
        console.log('[getRecentCheckIns] Current time (ISO):', new Date().toISOString());
        console.log('[getRecentCheckIns] Filter cutoff (3h ago):', threeHoursAgo);
      }

      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .gte('created_at', threeHoursAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // DEBUG: Log fetched data
      if (process.env.NODE_ENV === 'development') {
        console.log('[getRecentCheckIns] Fetched rows from check_ins:', data?.length ?? 0);
        if (data && data.length > 0) {
          console.log('[getRecentCheckIns] First check-in:', data[0].created_at, data[0].venue_id);
          console.log('[getRecentCheckIns] Last check-in:', data[data.length - 1].created_at);
        }
      }

      const checkIns: CheckIn[] = (data || []).map((row) => ({
        id: row.id,
        venueId: row.venue_id,
        timestamp: row.created_at,
        vibeScore: row.vibe_score as VibeScore,
        intent: row.intent as Intent,
        relationshipStatus: row.relationship_status as RelationshipStatus | null,
        onsIntent: row.ons_intent as OnsIntent | null,
        gender: row.gender as Gender | null,
        ageBand: row.age_band as AgeBand | null,
        createdAt: row.created_at,
      }));

      return { data: checkIns, error: null };
    }

    // Use mock data (get all, filtering done in frontend)
    await delay(MOCK_DELAY_MS);
    const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000);
    const recentCheckIns = MOCK_CHECKINS.filter(
      (c) => new Date(c.timestamp) >= threeHoursAgo
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { data: recentCheckIns, error: null };
  } catch (err) {
    console.error('Error fetching check-ins:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch check-ins',
    };
  }
}

// ============================================
// SUBMIT CHECK-IN
// ============================================

export async function submitCheckIn(
  venueId: string,
  vibeScore: VibeScore,
  intent: Intent,
  relationshipStatus: RelationshipStatus | null = null,
  onsIntent: OnsIntent | null = null,
  gender: Gender | null = null,
  ageBand: AgeBand | null = null
): Promise<{ data: CheckIn | null; error: string | null }> {
  try {
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('check_ins')
        .insert({
          venue_id: venueId,
          vibe_score: vibeScore,
          intent,
          relationship_status: relationshipStatus,
          ons_intent: onsIntent,
          gender: gender,
          age_band: ageBand,
        })
        .select()
        .single();

      if (error) throw error;

      const checkIn: CheckIn = {
        id: data.id,
        venueId: data.venue_id,
        timestamp: data.created_at,
        vibeScore: data.vibe_score as VibeScore,
        intent: data.intent as Intent,
        relationshipStatus: data.relationship_status as RelationshipStatus | null,
        onsIntent: data.ons_intent as OnsIntent | null,
        gender: data.gender as Gender | null,
        ageBand: data.age_band as AgeBand | null,
        createdAt: data.created_at,
      };

      return { data: checkIn, error: null };
    }

    // Mock: create a fake check-in
    await delay(MOCK_DELAY_MS);
    const newCheckIn: CheckIn = {
      id: `mock-${Date.now()}`,
      venueId,
      vibeScore,
      intent,
      relationshipStatus,
      onsIntent,
      gender,
      ageBand,
      timestamp,
      createdAt: timestamp,
    };

    // Add to mock data (in-memory only)
    MOCK_CHECKINS.unshift(newCheckIn);

    return { data: newCheckIn, error: null };
  } catch (err) {
    console.error('Error submitting check-in:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to submit check-in',
    };
  }
}

// ============================================
// PEAK TIMES FOR VENUE
// ============================================

export interface PeakHour {
  hour: number;          // 0-23
  dow: number;           // 0-6 (0 = søndag)
  checkinCount: number;
}

export async function getPeakTimesForVenue(
  venueId: string
): Promise<{ data: PeakHour[] | null; error: string | null }> {
  try {
    if (isSupabaseConfigured && supabase) {
      // Try to use the view first
      const { data, error } = await supabase
        .from('venue_hourly_activity')
        .select('*')
        .eq('venue_id', venueId);

      if (error) {
        // If view doesn't exist, fall back to aggregating check_ins
        console.warn('venue_hourly_activity view not found, using fallback');
        return getPeakTimesFromCheckIns(venueId);
      }

      const peakHours: PeakHour[] = (data || []).map((row) => ({
        hour: Number(row.hour),
        dow: Number(row.dow),
        checkinCount: Number(row.checkin_count),
      }));

      return { data: peakHours, error: null };
    }

    // Use mock data - aggregate from MOCK_CHECKINS
    return getPeakTimesFromCheckIns(venueId);
  } catch (err) {
    console.error('Error fetching peak times:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to fetch peak times',
    };
  }
}

// Fallback: aggregate check-ins in memory
async function getPeakTimesFromCheckIns(
  venueId: string
): Promise<{ data: PeakHour[] | null; error: string | null }> {
  await delay(MOCK_DELAY_MS);

  const venueCheckIns = MOCK_CHECKINS.filter((c) => c.venueId === venueId);
  
  // Group by dow + hour
  const hourlyMap = new Map<string, { dow: number; hour: number; count: number }>();
  
  venueCheckIns.forEach((checkIn) => {
    const date = new Date(checkIn.createdAt);
    const dow = date.getDay(); // 0 = Sunday
    const hour = date.getHours();
    const key = `${dow}-${hour}`;
    
    const existing = hourlyMap.get(key) || { dow, hour, count: 0 };
    existing.count++;
    hourlyMap.set(key, existing);
  });

  const peakHours: PeakHour[] = Array.from(hourlyMap.values()).map((item) => ({
    hour: item.hour,
    dow: item.dow,
    checkinCount: item.count,
  }));

  return { data: peakHours, error: null };
}

// ============================================
// EDGE FUNCTION API - Venues for City
// ============================================

export type FetchVenuesForCityParams = {
  cityId: number;
  radiusKm: number;
  includeCafeRestaurant?: boolean;
};

export type GetVenuesForCityParams = {
  cityId: number;
  userLat: number;
  userLon: number;
  radiusKm?: number;
  nightlifeOnly?: boolean;
  includeCafeRestaurant?: boolean;
  limit?: number;
};

export type VenueWithDistance = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string | null;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  distance_km: number;
};

export type FetchVenuesResponse = {
  city: {
    id: number;
    name: string;
    country_code: string | null;
    center_lat: number;
    center_lon: number;
  };
  requested_radius_km: number;
  include_cafe_restaurant: boolean;
  inserted: number;
  venues_sample: Array<{
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    category: string | null;
    is_nightlife: boolean;
  }>;
};

export type GetVenuesResponse = {
  city: {
    id: number;
    name: string;
    country_code: string;
    center_lat: number;
    center_lon: number;
  };
  venues: VenueWithDistance[];
};

/**
 * Kaller den tunge Edge Function som oppdaterer venues-tabellen
 * ved å hente data fra OpenStreetMap/Overpass API.
 */
export async function refreshVenuesForCity(
  params: FetchVenuesForCityParams
): Promise<FetchVenuesResponse> {
  const { cityId, radiusKm, includeCafeRestaurant = false } = params;

  const { data, error } = await supabase.functions.invoke(
    "fetch_venues_for_city",
    {
      body: {
        cityId,
        radiusKm,
        includeCafeRestaurant,
      },
    }
  );

  if (error) {
    console.error("refreshVenuesForCity error", error);
    throw error;
  }

  return data as FetchVenuesResponse;
}

/**
 * Leser venues via den lette Edge Function.
 * Returnerer venues innenfor en gitt radius fra brukerens posisjon.
 */
export async function getVenuesForCity(
  params: GetVenuesForCityParams
): Promise<GetVenuesResponse> {
  const {
    cityId,
    userLat,
    userLon,
    radiusKm = 5,
    nightlifeOnly = true,
    includeCafeRestaurant = false,
    limit = 200,
  } = params;

  const { data, error } = await supabase.functions.invoke(
    "get_venues_for_city",
    {
      body: {
        cityId,
        userLat,
        userLon,
        radiusKm,
        nightlifeOnly,
        includeCafeRestaurant,
        limit,
      },
    }
  );

  if (error) {
    console.error("getVenuesForCity error", error);
    throw error;
  }

  return data as GetVenuesResponse;
}