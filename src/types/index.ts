// ============================================
// VENUE TYPES
// ============================================

export interface Venue {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: VenueCategory;
  createdAt: string;
}

export type VenueCategory = 'bar' | 'club' | 'lounge' | 'pub' | 'rooftop';

export const VENUE_CATEGORY_LABELS: Record<VenueCategory, string> = {
  bar: 'Bar',
  club: 'Club',
  lounge: 'Lounge',
  pub: 'Pub',
  rooftop: 'Rooftop',
};

// ============================================
// CHECK-IN TYPES
// ============================================

// Re-export AgeBand and Gender types for convenience
export type { AgeBand, Gender } from '../hooks/useProfile';

export interface CheckIn {
  id: string;
  venueId: string;
  timestamp: string;
  vibeScore: VibeScore;
  intent: Intent;
  relationshipStatus: RelationshipStatus | null;
  onsIntent: OnsIntent | null;
  gender: import('../hooks/useProfile').Gender | null;
  ageBand: import('../hooks/useProfile').AgeBand | null;
  createdAt: string;
}

/**
 * Vibe Score represents the energy/atmosphere at a venue
 * - hot: Place is on fire, peak energy (weight: 1.0)
 * - good: Great vibe, solid night (weight: 0.75)
 * - ok: Decent, nothing special (weight: 0.5)
 * - quiet: Low energy, empty-ish (weight: 0.25)
 */
export type VibeScore = 'hot' | 'good' | 'ok' | 'quiet';

export const VIBE_SCORE_LABELS: Record<VibeScore, string> = {
  hot: '🔥 Hot',
  good: '✨ Good',
  ok: '👍 OK',
  quiet: '😴 Quiet',
};

export const VIBE_SCORE_COLORS: Record<VibeScore, string> = {
  hot: 'bg-red-100 text-red-700',
  good: 'bg-orange-100 text-orange-700',
  ok: 'bg-yellow-100 text-yellow-700',
  quiet: 'bg-slate-100 text-slate-600',
};

/**
 * Heatmap weight multiplier based on vibe score
 * Higher weight = more intense heat on the map
 */
export const VIBE_SCORE_WEIGHT: Record<VibeScore, number> = {
  hot: 1.0,
  good: 0.75,
  ok: 0.5,
  quiet: 0.25,
};

/**
 * Intent represents what the user is looking for tonight
 */
export type Intent = 'party' | 'chill' | 'date_night' | 'with_friends' | 'solo';

export const INTENT_LABELS: Record<Intent, string> = {
  party: '🎉 Party',
  chill: '😌 Chill',
  date_night: '💕 Date Night',
  with_friends: '👯 With Friends',
  solo: '🎧 Solo',
};

export const INTENT_OPTIONS: Intent[] = ['party', 'chill', 'date_night', 'with_friends', 'solo'];

// Short labels for badges
export const INTENT_SHORT_LABELS: Record<Intent, string> = {
  party: 'Party',
  chill: 'Chill',
  date_night: 'Date',
  with_friends: 'Venner',
  solo: 'Solo',
};

// ============================================
// RELATIONSHIP STATUS TYPES
// ============================================

export type RelationshipStatus =
  | 'single'
  | 'in_relationship'
  | 'complicated'
  | 'prefer_not_to_say';

export const RELATIONSHIP_STATUS_LABELS: Record<RelationshipStatus, string> = {
  single: 'Singel',
  in_relationship: 'I et forhold',
  complicated: 'Det er komplisert',
  prefer_not_to_say: 'Foretrekker å ikke si',
};

// ============================================
// ONS INTENT TYPES
// ============================================

export type OnsIntent =
  | 'open'
  | 'maybe'
  | 'not_interested'
  | 'prefer_not_to_say';

export const ONS_INTENT_LABELS: Record<OnsIntent, string> = {
  open: 'Ja',
  maybe: 'Kanskje',
  not_interested: 'Nei',
  prefer_not_to_say: 'Foretrekker å ikke si',
};

// ============================================
// VENUE WITH STATS (computed)
// ============================================

export interface VenueWithStats extends Venue {
  checkInCount: number;
  dominantVibe: VibeScore | null;
  heatScore: number; // 0-100, computed from checkins
  // Single stats
  singleCount: number;
  statusCount: number;
  singleRatio: number | null;
  // ONS stats
  onsOpenCount: number;
  onsAnsweredCount: number;
  onsRatio: number | null;
}

// ============================================
// TIME WINDOW TYPE
// ============================================

export type TimeWindow = 60 | 120 | 180;

// ============================================
// HEATMAP MODE TYPE
// ============================================

// Heatmap 2.0: Added 'party' and 'chill' modes
export type HeatmapMode = 'activity' | 'single' | 'ons' | 'ons_boost' | 'party' | 'chill';

// ============================================
// SORT MODE TYPE
// ============================================

export type SortMode = 'activity' | 'single' | 'ons';

// ============================================
// HEATMAP DATA POINT
// ============================================

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number; // 0-1, based on vibe score and recency
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate time decay factor for heatmap weight
 * More recent check-ins have higher weight
 * @param timestamp - Check-in timestamp
 * @param maxAgeMinutes - Maximum age to consider (default: 60 min)
 * @returns Weight between 0 and 1
 */
export function calculateRecencyWeight(timestamp: string, maxAgeMinutes: number = 60): number {
  const ageMs = Date.now() - new Date(timestamp).getTime();
  const ageMinutes = ageMs / (1000 * 60);
  
  if (ageMinutes >= maxAgeMinutes) return 0;
  
  // Linear decay: newest = 1, oldest = 0
  return 1 - (ageMinutes / maxAgeMinutes);
}

/**
 * Calculate combined heatmap weight for a check-in
 * Combines vibe score weight with recency decay
 */
export function calculateHeatmapWeight(checkIn: CheckIn, maxAgeMinutes: number = 60): number {
  const vibeWeight = VIBE_SCORE_WEIGHT[checkIn.vibeScore];
  const recencyWeight = calculateRecencyWeight(checkIn.timestamp, maxAgeMinutes);
  
  // Combined weight: vibe matters more, recency provides decay
  return vibeWeight * (0.5 + 0.5 * recencyWeight);
}

/**
 * Get display label for vibe score
 */
export function getVibeScoreLabel(score: VibeScore): string {
  return VIBE_SCORE_LABELS[score];
}

/**
 * Get CSS class for vibe score badge
 */
export function getVibeScoreColor(score: VibeScore): string {
  return VIBE_SCORE_COLORS[score];
}

/**
 * Filter check-ins by time window
 */
export function filterCheckInsByTime(checkIns: CheckIn[], timeWindowMinutes: TimeWindow): CheckIn[] {
  const cutoff = Date.now() - timeWindowMinutes * 60 * 1000;
  return checkIns.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
}
