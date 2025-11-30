/**
 * ============================================
 * UPDATE VENUES FROM GOOGLE PLACES API
 * ============================================
 * 
 * This script updates existing venues in the `public.venues` table
 * with coordinates and metadata from Google Places API (New).
 * 
 * Prerequisites:
 * - Environment variables set in .env.local:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - GOOGLE_PLACES_API_KEY
 * 
 * Usage:
 *   npm run update:venues:google
 * 
 * What it does:
 * 1. Fetches all venues where lat/lng are NULL
 * 2. For each venue, searches Google Places API
 * 3. Updates the venue with coordinates and metadata
 * 
 * Note: This script runs in Node.js, not in the browser.
 * It uses the SERVICE ROLE key which has elevated privileges.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

// Also try .env if .env.local doesn't exist
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ============================================
// CONFIGURATION
// ============================================

const BATCH_SIZE = 20; // Number of venues to fetch at a time
const API_DELAY_MS = 300; // Delay between API calls to respect quotas
const DEFAULT_CITY = 'Trondheim'; // Assume venues are in Trondheim

// ============================================
// TYPES
// ============================================

/**
 * Venue row from the database.
 * Some fields may be null if not yet populated.
 */
interface VenueRow {
  id: string;
  name: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  external_place_id?: string | null;
  source?: string | null;
  category?: string | null;
}

/**
 * Google Places API response structure (Places API New)
 */
interface GooglePlacesResponse {
  places?: GooglePlace[];
}

interface GooglePlace {
  id: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
}

/**
 * Fields to update in the venue
 */
interface VenueUpdate {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  external_place_id?: string;
  source?: string;
  category?: string;
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

function validateEnvironment(): void {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!GOOGLE_PLACES_API_KEY) {
    missing.push('GOOGLE_PLACES_API_KEY');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => console.error(`   - ${varName}`));
    console.error('\nMake sure these are set in .env.local or .env');
    process.exit(1);
  }
}

// ============================================
// SUPABASE CLIENT
// ============================================

function createSupabaseAdmin(): SupabaseClient {
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================
// HELPER: Map Google Place types to our category
// ============================================

/**
 * Maps Google Places types array to our category string.
 * 
 * Google Places types are UPPER_SNAKE_CASE like "NIGHT_CLUB", "BAR", etc.
 * We convert them to lowercase snake_case for our database.
 */
function mapTypesToCategory(types: string[]): string {
  // Normalize types to uppercase for comparison
  const upperTypes = types.map((t) => t.toUpperCase());

  if (upperTypes.includes('NIGHT_CLUB')) {
    return 'night_club';
  }
  if (upperTypes.includes('BAR')) {
    return 'bar';
  }
  if (upperTypes.includes('RESTAURANT')) {
    return 'restaurant';
  }
  if (upperTypes.includes('CAFE')) {
    return 'cafe';
  }
  if (upperTypes.includes('PUB')) {
    return 'pub';
  }

  // Fallback: use first type lowercased, or 'other'
  if (types.length > 0) {
    return types[0].toLowerCase();
  }
  return 'other';
}

// ============================================
// HELPER: Delay function
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// GOOGLE PLACES API: Text Search
// ============================================

/**
 * Searches Google Places API for a venue by name and city.
 * Uses the Places API (New) Text Search endpoint.
 * 
 * @param venueName - The name of the venue to search for
 * @returns The first matching place, or null if not found
 */
async function searchGooglePlaces(venueName: string): Promise<GooglePlace | null> {
  const query = `${venueName}, ${DEFAULT_CITY}, Norway`;
  const url = 'https://places.googleapis.com/v1/places:searchText';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY!,
        // Field mask to limit the response payload
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ⚠️ Google API error (${response.status}): ${errorText}`);
      return null;
    }

    const data: GooglePlacesResponse = await response.json();

    // Check if we got any results
    if (!data.places || data.places.length === 0) {
      console.log(`   ℹ️ No Google Places results for: "${venueName}"`);
      return null;
    }

    // Return the first (best) match
    return data.places[0];
  } catch (error) {
    console.error(`   ❌ Error calling Google Places API:`, error);
    return null;
  }
}

// ============================================
// MAIN: Update venues
// ============================================

async function updateVenuesFromGooglePlaces(): Promise<void> {
  console.log('🚀 Starting venue update from Google Places API\n');

  // Initialize Supabase client
  const supabase = createSupabaseAdmin();
  console.log('✅ Supabase client initialized\n');

  // Statistics
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Fetch venues in batches
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Query venues where lat/lng are NULL
    console.log(`📥 Fetching venues (offset: ${offset}, limit: ${BATCH_SIZE})...`);
    
    const { data: venues, error } = await supabase
      .from('venues')
      .select('*')
      .or('lat.is.null,lng.is.null')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Error fetching venues:', error.message);
      process.exit(1);
    }

    if (!venues || venues.length === 0) {
      if (offset === 0) {
        console.log('\n✅ No venues need updating (all have coordinates)');
      }
      hasMore = false;
      break;
    }

    console.log(`   Found ${venues.length} venues to process\n`);

    // Process each venue
    for (const venue of venues as VenueRow[]) {
      totalProcessed++;
      const venueNum = totalProcessed.toString().padStart(3, ' ');

      // Skip if name is missing
      if (!venue.name || venue.name.trim() === '') {
        console.log(`[${venueNum}] ⏭️ Skipping venue ${venue.id}: No name`);
        totalSkipped++;
        continue;
      }

      console.log(`[${venueNum}] 🔍 Processing: "${venue.name}"`);

      // Search Google Places
      const place = await searchGooglePlaces(venue.name);

      if (!place) {
        totalSkipped++;
        continue;
      }

      // Extract data from the place
      const latitude = place.location?.latitude;
      const longitude = place.location?.longitude;

      if (latitude === undefined || longitude === undefined) {
        console.log(`   ⚠️ No coordinates in Google Places response`);
        totalSkipped++;
        continue;
      }

      // Build update object
      const updateFields: VenueUpdate = {
        lat: latitude,
        lng: longitude,
        latitude: latitude,
        longitude: longitude,
        external_place_id: place.id,
      };

      // Only update address if currently null
      if (!venue.address && place.formattedAddress) {
        updateFields.address = place.formattedAddress;
      }

      // Only update city if currently null
      if (!venue.city) {
        updateFields.city = DEFAULT_CITY;
      }

      // Only update source if currently null
      if (!venue.source) {
        updateFields.source = 'google_places';
      }

      // Map category from Google types
      if (place.types && place.types.length > 0) {
        updateFields.category = mapTypesToCategory(place.types);
      }

      // Update the venue in Supabase
      const { error: updateError } = await supabase
        .from('venues')
        .update(updateFields)
        .eq('id', venue.id);

      if (updateError) {
        console.error(`   ❌ Error updating venue: ${updateError.message}`);
        totalErrors++;
        continue;
      }

      // Success!
      console.log(`   ✅ Updated: lat=${latitude.toFixed(6)}, lng=${longitude.toFixed(6)}, category=${updateFields.category || 'unchanged'}`);
      totalUpdated++;

      // Delay to respect API quotas
      await delay(API_DELAY_MS);
    }

    // Move to next batch
    offset += BATCH_SIZE;
    
    // If we got fewer than BATCH_SIZE, we've reached the end
    if (venues.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Successfully updated: ${totalUpdated}`);
  console.log(`   Skipped (no match/no name): ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);
  console.log('='.repeat(50));

  if (totalErrors > 0) {
    console.log('\n⚠️ Some venues had errors. Check the logs above.');
    process.exit(1);
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

// ============================================
// RUN
// ============================================

// Validate environment first
validateEnvironment();

// Run the main function
updateVenuesFromGooglePlaces().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

