/**
 * Supabase Edge Function: get_venues_for_city
 * 
 * Henter venues for en gitt by, filtrert på avstand fra brukerens posisjon.
 * 
 * ============================================
 * HVORDAN KALLE FRA FRONTEND (React):
 * ============================================
 * 
 * const response = await fetch(
 *   `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get_venues_for_city`,
 *   {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
 *     },
 *     body: JSON.stringify({
 *       cityId: 1,
 *       userLat: 63.4305,
 *       userLon: 10.3951,
 *       radiusKm: 5,          // optional, default 5
 *       nightlifeOnly: true,  // optional, default true
 *       includeCafeRestaurant: false, // optional, default false
 *       limit: 200,           // optional, default 200
 *     }),
 *   }
 * );
 * 
 * const data = await response.json();
 * // data.city = { id, name, country_code, center_lat, center_lon }
 * // data.venues = [{ id, name, lat, lon, category, is_nightlife, is_default_in_list, distance_km }, ...]
 * 
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================
// TYPES
// ============================================

interface RequestBody {
  cityId: number;
  userLat: number;
  userLon: number;
  radiusKm?: number;
  nightlifeOnly?: boolean;
  includeCafeRestaurant?: boolean;
  limit?: number;
}

interface CityRow {
  id: number;
  name: string;
  country_code: string;
  center_lat: number;
  center_lon: number;
}

interface VenueRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  city_id: number;
}

interface VenueWithDistance {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: string | null;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  distance_km: number;
}

interface SuccessResponse {
  city: {
    id: number;
    name: string;
    country_code: string;
    center_lat: number;
    center_lon: number;
  };
  venues: VenueWithDistance[];
}

// ============================================
// HAVERSINE FORMULA
// Beregner avstand mellom to koordinater i km
// ============================================

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    const { cityId, userLat, userLon } = body;

    if (cityId === undefined || cityId === null || typeof cityId !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required field: cityId (must be a number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userLat === undefined || userLat === null || typeof userLat !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required field: userLat (must be a number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userLon === undefined || userLon === null || typeof userLon !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required field: userLon (must be a number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set defaults
    const radiusKm = body.radiusKm ?? 5;
    const nightlifeOnly = body.nightlifeOnly ?? true;
    const includeCafeRestaurant = body.includeCafeRestaurant ?? false;
    const limit = body.limit ?? 200;

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // ============================================
    // 1. Verify city exists
    // ============================================
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('id, name, country_code, center_lat, center_lon')
      .eq('id', cityId)
      .single();

    if (cityError || !cityData) {
      console.error('City lookup error:', cityError);
      return new Response(
        JSON.stringify({ error: `City with id ${cityId} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const city = cityData as CityRow;

    // ============================================
    // 2. Build venue query
    // ============================================
    let venueQuery = supabase
      .from('venues')
      .select('id, name, latitude, longitude, category, is_nightlife, is_default_in_list, city_id')
      .eq('city_id', cityId);

    // Apply filters based on nightlifeOnly and includeCafeRestaurant
    if (nightlifeOnly) {
      if (includeCafeRestaurant) {
        // is_nightlife = true OR category in ('restaurant', 'cafe')
        venueQuery = venueQuery.or('is_nightlife.eq.true,category.in.(restaurant,cafe)');
      } else {
        // Only nightlife venues
        venueQuery = venueQuery.eq('is_nightlife', true);
      }
    } else {
      if (includeCafeRestaurant) {
        // All venues (no additional filter needed since we're getting all for city)
        // This is the same as no filter
      } else {
        // All categories except restaurant and cafe
        venueQuery = venueQuery.not('category', 'in', '(restaurant,cafe)');
      }
    }

    const { data: venuesData, error: venuesError } = await venueQuery;

    if (venuesError) {
      console.error('Venues query error:', venuesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch venues' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const venues = (venuesData || []) as VenueRow[];

    // ============================================
    // 3. Calculate distances and filter by radius
    // ============================================
    const venuesWithDistance: VenueWithDistance[] = venues
      .map((venue) => {
        const distance = haversineDistance(
          userLat,
          userLon,
          venue.latitude,
          venue.longitude
        );
        return {
          id: venue.id,
          name: venue.name,
          lat: venue.latitude,
          lon: venue.longitude,
          category: venue.category,
          is_nightlife: venue.is_nightlife ?? false,
          is_default_in_list: venue.is_default_in_list ?? false,
          distance_km: Math.round(distance * 1000) / 1000, // Round to 3 decimals
        };
      })
      .filter((venue) => venue.distance_km <= radiusKm);

    // ============================================
    // 4. Sort by distance and limit
    // ============================================
    venuesWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    const limitedVenues = venuesWithDistance.slice(0, limit);

    // ============================================
    // 5. Build response
    // ============================================
    const response: SuccessResponse = {
      city: {
        id: city.id,
        name: city.name,
        country_code: city.country_code,
        center_lat: city.center_lat,
        center_lon: city.center_lon,
      },
      venues: limitedVenues,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

