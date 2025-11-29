import { supabase } from './supabase';

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
 */
export type CheckInPayload = {
  userId: string;
  venueId: string;
  intent: string;              // e.g. "solo", "party", "with_friends"
  vibeScore?: string | number; // e.g. "hot", "good", "ok", "quiet" or numeric
  relationshipStatus?: string | null;
  onsIntent?: string | null;
  gender?: string | null;
  ageBand?: string | null;
  timestamp?: string;          // optional override, otherwise use now()
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
 * @param payload - The check-in data
 * @throws CheckInError if Supabase is not configured or insert fails
 */
export async function createCheckIn(payload: CheckInPayload): Promise<void> {
  if (!supabase) {
    throw new CheckInError('Supabase is not configured. Cannot create check-in.');
  }

  const {
    userId,
    venueId,
    intent,
    vibeScore,
    relationshipStatus,
    onsIntent,
    gender,
    ageBand,
    timestamp,
  } = payload;

  // Map payload fields to database columns explicitly
  // Convert vibeScore string (e.g. "hot") to integer for the database
  const insertData = {
    user_id: userId,
    venue_id: venueId,
    intent: intent,
    vibe_score: vibeScoreToInt(vibeScore),
    relationship_status: relationshipStatus ?? null,
    ons_intent: onsIntent ?? null,
    gender: gender ?? null,
    age_band: ageBand ?? null,
    created_at: timestamp ?? new Date().toISOString(),
  };

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
 * 2. Creates the check-in record
 * 
 * @param userId - The ID of the user checking in
 * @param externalPlace - The place data from external provider
 * @param intent - What the user is looking for (e.g. "party", "chill")
 * @param extra - Additional optional check-in data
 * @throws CheckInError if any step fails
 * 
 * @example
 * ```ts
 * // From a mobile check-in screen:
 * await checkInWithExternalPlace(
 *   currentUser.id,
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
 *     vibeScore: 4,
 *     relationshipStatus: 'single',
 *     onsIntent: 'maybe',
 *     gender: 'male',
 *     ageBand: '25_30',
 *   }
 * );
 * ```
 */
export async function checkInWithExternalPlace(
  userId: string,
  externalPlace: ExternalPlace,
  intent: string,
  extra?: {
    vibeScore?: string | number;  // e.g. "hot", "good", "ok", "quiet" or numeric
    relationshipStatus?: string | null;
    onsIntent?: string | null;
    gender?: string | null;
    ageBand?: string | null;
    timestamp?: string;
  }
): Promise<void> {
  // 1) Ensure venue exists (creates it if needed)
  const venue = await ensureVenueForExternalPlace(externalPlace);

  // 2) Create the check-in
  await createCheckIn({
    userId,
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

