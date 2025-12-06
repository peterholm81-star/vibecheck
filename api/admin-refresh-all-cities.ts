/**
 * API Route: Batch refresh venues for all cities
 * 
 * This endpoint iterates through all cities in the database and calls
 * the fetch_venues_for_city Edge Function for each one.
 * 
 * Protected by ADMIN_DASHBOARD_PIN (same as admin-stats).
 * 
 * POST /api/admin-refresh-all-cities
 * Headers: x-admin-pin: <pin>
 * Body: { includeCafeRestaurant?: boolean }
 * 
 * Returns: { successCount, failedCount, results: [...] }
 */

import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

// City radius defaults (should match src/config/cityRadius.ts)
const CITY_RADIUS_KM: Record<string, number> = {
  'Oslo': 45,
  'Bergen': 25,
  'Trondheim': 20,
  'Stavanger': 20,
  'Kristiansand': 15,
  'Tromsø': 15,
  'Drammen': 15,
  'Fredrikstad': 12,
  'Sandnes': 15,
  'Sarpsborg': 12,
  'Porsgrunn': 12,
  'Skien': 12,
  'Ålesund': 15,
  'Sandefjord': 12,
  'Tønsberg': 12,
  'Moss': 10,
  'Haugesund': 12,
  'Bodø': 12,
  'Hamar': 12,
  'Larvik': 10,
  'Lillehammer': 10,
  'Gjøvik': 10,
  'Molde': 10,
  'Harstad': 10,
  'Narvik': 8,
  'Alta': 10,
  'Arendal': 10,
  'Grimstad': 8,
  'Halden': 8,
  'Kongsberg': 8,
};

const DEFAULT_RADIUS_KM = 10;

function getCityRadius(cityName: string): number {
  return CITY_RADIUS_KM[cityName] ?? DEFAULT_RADIUS_KM;
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Detect error code from error message for structured error handling
 */
function detectErrorCode(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('504')) {
    return 'OVERPASS_TIMEOUT';
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('429') || lowerMessage.includes('too many')) {
    return 'OVERPASS_RATE_LIMIT';
  }
  if (lowerMessage.includes('502') || lowerMessage.includes('503') || lowerMessage.includes('bad gateway')) {
    return 'OVERPASS_UNAVAILABLE';
  }
  if (lowerMessage.includes('database') || lowerMessage.includes('insert') || lowerMessage.includes('supabase')) {
    return 'SUPABASE_ERROR';
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'NETWORK_ERROR';
  }
  
  return 'UNKNOWN';
}

interface CityResult {
  cityId: number;
  cityName: string;
  status: 'success' | 'error';
  inserted?: number;
  radiusKm?: number;
  error?: string;
  errorCode?: string; // For structured error mapping
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check admin PIN
  const adminPin = process.env.ADMIN_DASHBOARD_PIN;
  if (!adminPin) {
    console.error('[admin-refresh-all-cities] ADMIN_DASHBOARD_PIN not configured');
    return new Response(
      JSON.stringify({ error: 'Admin not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const clientPin = req.headers.get('x-admin-pin');
  if (!clientPin || clientPin !== adminPin) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get Supabase client with service role key
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[admin-refresh-all-cities] Missing Supabase credentials');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const includeCafeRestaurant = body.includeCafeRestaurant ?? false;

    console.log('[admin-refresh-all-cities] Starting batch refresh...');

    // Fetch all cities
    const { data: cities, error: citiesError } = await supabase
      .from('cities')
      .select('id, name, country_code')
      .order('name');

    if (citiesError) {
      console.error('[admin-refresh-all-cities] Error fetching cities:', citiesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cities' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!cities || cities.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No cities found in database' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-refresh-all-cities] Found ${cities.length} cities to process`);

    const results: CityResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Process each city sequentially with delay to avoid overwhelming Overpass
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      const radiusKm = getCityRadius(city.name);

      console.log(`[admin-refresh-all-cities] Processing ${i + 1}/${cities.length}: ${city.name} (radius: ${radiusKm}km)`);

      try {
        // Call the Edge Function for this city
        const { data, error } = await supabase.functions.invoke('fetch_venues_for_city', {
          body: {
            cityId: city.id,
            radiusKm,
            includeCafeRestaurant,
          },
        });

        if (error) {
          const errorMessage = error.message || 'Unknown error';
          const errorCode = detectErrorCode(errorMessage);
          
          console.error(`[admin-refresh-all-cities] Error for ${city.name}:`, { errorCode, errorMessage });
          results.push({
            cityId: city.id,
            cityName: city.name,
            status: 'error',
            radiusKm,
            error: errorMessage,
            errorCode,
          });
          failedCount++;
        } else {
          const inserted = data?.inserted ?? 0;
          console.log(`[admin-refresh-all-cities] ${city.name}: inserted ${inserted} venues`);
          results.push({
            cityId: city.id,
            cityName: city.name,
            status: 'success',
            inserted,
            radiusKm,
          });
          successCount++;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const errorCode = detectErrorCode(errorMessage);
        
        console.error(`[admin-refresh-all-cities] Exception for ${city.name}:`, { errorCode, errorMessage, err });
        results.push({
          cityId: city.id,
          cityName: city.name,
          status: 'error',
          radiusKm,
          error: errorMessage,
          errorCode,
        });
        failedCount++;
      }

      // Add delay between cities to avoid overwhelming Overpass API
      // Skip delay after the last city
      if (i < cities.length - 1) {
        await delay(500); // 500ms delay between each city
      }
    }

    console.log(`[admin-refresh-all-cities] Batch complete: ${successCount} success, ${failedCount} failed`);

    // Calculate total venues inserted
    const totalInserted = results
      .filter(r => r.status === 'success')
      .reduce((sum, r) => sum + (r.inserted ?? 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        totalCities: cities.length,
        successCount,
        failedCount,
        totalVenuesInserted: totalInserted,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[admin-refresh-all-cities] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

