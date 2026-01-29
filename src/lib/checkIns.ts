import { supabase } from './supabase';
import { getCurrentUserId } from './auth/getCurrentUserId';
import { hasVibeUsersRow } from './vibeUsers';
import { AGE_RANGES, type AgeRange, isValidAgeRange } from '../constants/ageRanges';

// ============================================
// VIBE SCORE MAPPING
// ============================================

/**
 * Maps UI vibe string labels to integer values for the database.
 * The database `vibe_score` column expects an integer.
 */
export const VIBE_SCORE_TO_INT: Record<string, number> = {
  hot: 3,
  good: 2,
  ok: 1,
  quiet: 0,
};

/**
 * Converts a vibe score (string or number) to an integer for the database.
 * - If already a number, returns it as-is.
 * - If a string like "hot", "good", etc., maps it to the corresponding integer.
 * - Returns null if the value is undefined/null or unrecognized.
 */
function vibeScoreToInt(vibeScore: string | number | undefined | null): number | null {
  if (vibeScore === undefined || vibeScore === null) {
    return null;
  }
  if (typeof vibeScore === 'number') {
    return vibeScore;
  }
  // It's a string - look up in the map
  const mapped = VIBE_SCORE_TO_INT[vibeScore];
  return mapped !== undefined ? mapped : null;
}

// ============================================
// TYPES
// ============================================

/**
 * Represents an external place from a provider like Google Places.
 * Used to create or match a venue in our database.
 */
export type ExternalPlace = {
  externalPlaceId: string;   // e.g. Google Places ID
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  category?: string;         // bar, pub, nightclub, etc.
  source?: string;           // default "google_places"
};

/**
 * Represents a venue in our database (public.venues).
 */
export type Venue = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  external_place_id: string | null;
  source: string | null;
  category: string | null;
  is_verified: boolean;
  created_at: string;
};

/**
 * Payload for creating a new check-in.
 * Note: userId is derived from auth.uid() internally for security.
 */
export type CheckInPayload = {
  venueId: string;
  intent: string;              // e.g. "solo", "party", "with_friends"
  vibeScore?: string | number; // e.g. "hot", "good", "ok", "quiet" or numeric
  relationshipStatus?: string | null;
  onsIntent?: string | null;
  gender?: string | null;
  ageBand?: AgeRange | string | null; // Must match AGE_RANGES values
  timestamp?: string;          // optional override, otherwise use now()
};

// Legacy type for backwards compatibility (userId passed but ignored)
export type CheckInPayloadLegacy = CheckInPayload & {
  userId?: string; // Deprecated: user_id is derived from auth.uid()
};

// ============================================
// ERROR CLASS
// ============================================

export class CheckInError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CheckInError';
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ensures a venue exists in our database for the given external place.
 * 
 * - If a venue with this external_place_id already exists, returns it.
 * - If not, creates a new venue and returns it.
 * 
 * @param externalPlace - The external place data (e.g. from Google Places)
 * @returns The existing or newly created venue
 * @throws CheckInError if Supabase is not configured or query fails
 */
export async function ensureVenueForExternalPlace(
  externalPlace: ExternalPlace
): Promise<Venue> {
  if (!supabase) {
    throw new CheckInError('Supabase is not configured. Cannot manage venues.');
  }

  const { externalPlaceId, name, address, city, lat, lng, category, source } = externalPlace;

  // 1) Check if a venue with this external_place_id already exists
  const { data: existingVenue, error: selectError } = await supabase
    .from('venues')
    .select('*')
    .eq('external_place_id', externalPlaceId)
    .maybeSingle();

  if (selectError) {
    throw new CheckInError(
      `Failed to check for existing venue: ${selectError.message}`,
      selectError
    );
  }

  // 2) If venue exists, return it
  if (existingVenue) {
    return mapDbRowToVenue(existingVenue);
  }

  // 3) Insert new venue
  const { data: newVenue, error: insertError } = await supabase
    .from('venues')
    .insert({
      name,
      address: address ?? null,
      city: city ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      external_place_id: externalPlaceId,
      source: source ?? 'google_places',
      category: category ?? null,
      is_verified: false,
    })
    .select()
    .single();

  if (insertError) {
    throw new CheckInError(
      `Failed to create venue: ${insertError.message}`,
      insertError
    );
  }

  if (!newVenue) {
    throw new CheckInError('Failed to create venue: No data returned');
  }

  return mapDbRowToVenue(newVenue);
}

/**
 * Creates a new check-in in the database.
 * 
 * IMPORTANT: This function:
 * 1. Uses auth.uid() for user_id (not caller-provided)
 * 2. Requires user to have completed onboarding (vibe_users row exists)
 * 3. Validates age_band against AGE_RANGES constant
 * 
 * @param payload - The check-in data
 * @throws CheckInError if not authenticated, onboarding incomplete, or insert fails
 */
export async function createCheckIn(payload: CheckInPayload | CheckInPayloadLegacy): Promise<void> {
  if (!supabase) {
    throw new CheckInError('Supabase is not configured. Cannot create check-in.');
  }

  // 1. Get user_id from auth.uid() (ignore any userId in payload)
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new CheckInError('Not authenticated. Please sign in.');
  }

  // 2. Guard: Require vibe_users row (onboarding complete)
  const hasProfile = await hasVibeUsersRow();
  if (!hasProfile) {
    throw new CheckInError('Onboarding not complete. Please complete onboarding first.');
  }

  const {
    venueId,
    intent,
    vibeScore,
    relationshipStatus,
    onsIntent,
    gender,
    ageBand,
    timestamp,
  } = payload;

  // 3. Validate age_band against allowed values
  let validatedAgeBand: string | null = null;
  if (ageBand) {
    if (isValidAgeRange(ageBand)) {
      validatedAgeBand = ageBand;
    } else {
      console.warn(`[CheckIn] Invalid age_band "${ageBand}", must be one of: ${AGE_RANGES.join(', ')}`);
      // Don't fail, just nullify invalid values
      validatedAgeBand = null;
    }
  }

  // Map payload fields to database columns explicitly
  // Convert vibeScore string (e.g. "hot") to integer for the database
  const insertData = {
    user_id: userId, // Always use auth.uid()
    venue_id: venueId,
    intent: intent,
    vibe_score: vibeScoreToInt(vibeScore),
    relationship_status: relationshipStatus ?? null,
    ons_intent: onsIntent ?? null,
    gender: gender ?? null,
    age_band: validatedAgeBand,
    created_at: timestamp ?? new Date().toISOString(),
  };

  console.log('[CheckIn] Creating check-in:', { userId, venueId, intent, ageBand: validatedAgeBand });

  const { error } = await supabase
    .from('check_ins')
    .insert(insertData);

  if (error) {
    throw new CheckInError(
      `Failed to create check-in: ${error.message}`,
      error
    );
  }
}

/**
 * High-level convenience function for checking in at an external place.
 * 
 * 1. Ensures the venue exists (creates it if needed)
 * 2. Creates the check-in record (user_id comes from auth.uid())
 * 
 * Note: userId parameter is deprecated and ignored. User ID is derived from auth.uid().
 * 
 * @param _userId - DEPRECATED: ignored, user_id comes from auth.uid()
 * @param externalPlace - The place data from external provider
 * @param intent - What the user is looking for (e.g. "party", "chill")
 * @param extra - Additional optional check-in data
 * @throws CheckInError if not authenticated, onboarding incomplete, or any step fails
 * 
 * @example
 * ```ts
 * // From a mobile check-in screen:
 * await checkInWithExternalPlace(
 *   null, // userId ignored
 *   {
 *     externalPlaceId: googlePlace.place_id,
 *     name: googlePlace.name,
 *     address: googlePlace.formatted_address,
 *     city: googlePlace.city,
 *     lat: googlePlace.geometry.location.lat,
 *     lng: googlePlace.geometry.location.lng,
 *     category: 'bar',
 *   },
 *   'party',
 *   {
 *     vibeScore: 'good',
 *     relationshipStatus: 'single',
 *     onsIntent: 'maybe',
 *     gender: 'male',
 *     ageBand: '25–34', // Must match AGE_RANGES
 *   }
 * );
 * ```
 */
export async function checkInWithExternalPlace(
  _userId: string | null, // Deprecated: ignored
  externalPlace: ExternalPlace,
  intent: string,
  extra?: {
    vibeScore?: string | number;  // e.g. "hot", "good", "ok", "quiet" or numeric
    relationshipStatus?: string | null;
    onsIntent?: string | null;
    gender?: string | null;
    ageBand?: AgeRange | string | null;
    timestamp?: string;
  }
): Promise<void> {
  // 1) Ensure venue exists (creates it if needed)
  const venue = await ensureVenueForExternalPlace(externalPlace);

  // 2) Create the check-in (user_id comes from auth.uid() inside createCheckIn)
  await createCheckIn({
    venueId: venue.id,
    intent,
    vibeScore: extra?.vibeScore,
    relationshipStatus: extra?.relationshipStatus,
    onsIntent: extra?.onsIntent,
    gender: extra?.gender,
    ageBand: extra?.ageBand,
    timestamp: extra?.timestamp,
  });
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Maps a database row to a Venue type.
 * Handles potential column name differences.
 */
function mapDbRowToVenue(row: Record<string, unknown>): Venue {
  return {
    id: row.id as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    city: (row.city as string) ?? null,
    lat: (row.lat as number) ?? (row.latitude as number) ?? null,
    lng: (row.lng as number) ?? (row.longitude as number) ?? null,
    external_place_id: (row.external_place_id as string) ?? null,
    source: (row.source as string) ?? null,
    category: (row.category as string) ?? null,
    is_verified: (row.is_verified as boolean) ?? false,
    created_at: row.created_at as string,
  };
}

