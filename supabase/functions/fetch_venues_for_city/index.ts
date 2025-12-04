/**
 * Supabase Edge Function: fetch_venues_for_city
 * 
 * Henter venues fra OpenStreetMap (Overpass API) og lagrer dem i `venues`-tabellen.
 * Sletter først eksisterende OSM-venues for byen, deretter legger inn nye.
 * 
 * ============================================
 * HVORDAN KALLE FRA FRONTEND (React):
 * ============================================
 * 
 * const response = await fetch(
 *   `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch_venues_for_city`,
 *   {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json',
 *       'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
 *     },
 *     body: JSON.stringify({
 *       cityId: 1,
 *       radiusKm: 5,                  // optional, default 5
 *       includeCafeRestaurant: false, // optional, default false
 *     }),
 *   }
 * );
 * 
 * const data = await response.json();
 * // data.city = { id, name, country_code, center_lat, center_lon }
 * // data.inserted = number of venues inserted
 * // data.venues_sample = first 5 inserted venues
 * 
 * ============================================
 * EXAMPLE REQUEST BODY (for Supabase Dashboard):
 * ============================================
 * {
 *   "cityId": 1,
 *   "radiusKm": 3,
 *   "includeCafeRestaurant": true
 * }
 * 
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================
// TYPES
// ============================================

interface RequestBody {
  cityId: number;
  radiusKm?: number;
  includeCafeRestaurant?: boolean;
}

interface CityRow {
  id: number;
  name: string;
  country_code: string;
  center_lat: number;
  center_lon: number;
}

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    amenity?: string;
    'addr:street'?: string;
    'addr:housenumber'?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OSMElement[];
}

interface VenueInsert {
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  city: string;
  city_id: number;
  category: string;
  is_nightlife: boolean;
  is_default_in_list: boolean;
  is_verified: boolean;
  osm_id: number;
  osm_source: string;
  source: string;
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
// HELPER FUNCTIONS
// ============================================

function isNightlifeCategory(amenity: string): boolean {
  return ['bar', 'pub', 'nightclub'].includes(amenity);
}

function buildAddress(tags: OSMElement['tags']): string | null {
  if (!tags) return null;
  const street = tags['addr:street'] ?? '';
  const housenumber = tags['addr:housenumber'] ?? '';
  const address = `${street} ${housenumber}`.trim();
  return address || null;
}

function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusMeters: number,
  includeCafeRestaurant: boolean
): string {
  const amenities = includeCafeRestaurant
    ? 'bar|pub|nightclub|restaurant|cafe'
    : 'bar|pub|nightclub';

  return `
[out:json][timeout:60];
(
  node["amenity"~"${amenities}"](around:${radiusMeters},${lat},${lon});
  way["amenity"~"${amenities}"](around:${radiusMeters},${lat},${lon});
  relation["amenity"~"${amenities}"](around:${radiusMeters},${lat},${lon});
);
out center;
`.trim();
}

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
    const { cityId } = body;

    if (cityId === undefined || cityId === null || typeof cityId !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid required field: cityId (must be a number)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set defaults
    const radiusKm = body.radiusKm ?? 5;
    const includeCafeRestaurant = body.includeCafeRestaurant ?? false;

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
        JSON.stringify({ error: 'City not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const city = cityData as CityRow;

    // ============================================
    // 2. Build and execute Overpass query
    // ============================================
    const radiusMeters = radiusKm * 1000;
    const overpassQuery = buildOverpassQuery(
      city.center_lat,
      city.center_lon,
      radiusMeters,
      includeCafeRestaurant
    );

    console.log('Overpass query:', overpassQuery);

    let overpassData: OverpassResponse;
    try {
      const overpassResponse = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
      });

      if (!overpassResponse.ok) {
        const errorText = await overpassResponse.text();
        console.error('Overpass API error:', overpassResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: 'Overpass request failed', 
            details: `Status ${overpassResponse.status}: ${errorText.substring(0, 200)}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      overpassData = await overpassResponse.json();
    } catch (fetchError) {
      console.error('Overpass fetch error:', fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Overpass request failed', 
          details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Overpass returned ${overpassData.elements?.length ?? 0} elements`);

    // ============================================
    // 3. Delete existing OSM venues for this city
    // ============================================
    const { error: deleteError } = await supabase
      .from('venues')
      .delete()
      .eq('city_id', city.id)
      .eq('osm_source', 'overpass');

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete existing OSM venues', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 4. Map OSM elements to venue records
    // ============================================
    const venuesToInsert: VenueInsert[] = [];

    for (const element of overpassData.elements || []) {
      // Get coordinates
      let lat: number | undefined;
      let lon: number | undefined;

      if (element.type === 'node') {
        lat = element.lat;
        lon = element.lon;
      } else if (element.center) {
        lat = element.center.lat;
        lon = element.center.lon;
      }

      // Skip if no coordinates
      if (lat === undefined || lon === undefined) {
        console.log(`Skipping element ${element.id} (${element.type}): no coordinates`);
        continue;
      }

      const tags = element.tags || {};
      const amenity = tags.amenity || 'unknown';

      // Build venue name
      const name = tags.name || `${amenity.charAt(0).toUpperCase() + amenity.slice(1)} #${element.id}`;

      const venue: VenueInsert = {
        name,
        address: buildAddress(tags),
        latitude: lat,
        longitude: lon,
        city: city.name,
        city_id: city.id,
        category: amenity,
        is_nightlife: isNightlifeCategory(amenity),
        is_default_in_list: false,
        is_verified: false,
        osm_id: element.id,
        osm_source: 'overpass',
        source: 'overpass',
      };

      venuesToInsert.push(venue);
    }

    console.log(`Mapped ${venuesToInsert.length} venues to insert`);

    // ============================================
    // 5. Insert venues (if any)
    // ============================================
    let insertedVenues: VenueInsert[] = [];

    if (venuesToInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('venues')
        .insert(venuesToInsert)
        .select();

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to insert venues', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      insertedVenues = insertedData || [];
    }

    // ============================================
    // 6. Build response
    // ============================================
    const response = {
      city: {
        id: city.id,
        name: city.name,
        country_code: city.country_code,
        center_lat: city.center_lat,
        center_lon: city.center_lon,
      },
      inserted: venuesToInsert.length,
      venues_sample: insertedVenues.slice(0, 5),
    };

    console.log(`Successfully inserted ${venuesToInsert.length} venues for ${city.name}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

