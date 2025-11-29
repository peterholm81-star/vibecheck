import type { Venue, CheckIn, VibeScore, VenueWithStats, HeatmapMode, Gender, AgeBand, Intent } from '../types';
import { INTENT_OPTIONS } from '../types';

/**
 * Calculate statistics for venues based on check-ins
 * This utility is shared between VenueList and MapView
 */

export interface VenueStats {
  checkInCount: number;
  dominantVibe: VibeScore | null;
  heatScore: number;
  // Single stats
  singleCount: number;
  singleTotal: number;
  singleRatio: number | null;
  // ONS stats
  onsOpenCount: number;
  onsTotal: number;
  onsRatio: number | null;
  // Boost score
  boostScore: number;
}

// ============================================
// DEMOGRAPHICS TYPES
// ============================================

export interface DemographicsStats {
  // Gender stats
  malePct: number;
  femalePct: number;
  otherPct: number; // includes 'other' + 'prefer_not_to_say' + null
  maleCount: number;
  femaleCount: number;
  otherCount: number;
  totalGenderResponses: number;
  mostCommonGender: 'male' | 'female' | 'other' | null;
  // Age stats
  ageBandPct: Record<AgeBand, number>;
  ageBandCounts: Record<AgeBand, number>;
  mostCommonAgeBand: AgeBand | null;
  totalAgeResponses: number;
}

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  "18_25": "18–25",
  "25_30": "25–30",
  "30_35": "30–35",
  "35_40": "35–40",
  "40_plus": "40+",
};

export const GENDER_LABELS_NO: Record<'male' | 'female' | 'other', string> = {
  male: "menn",
  female: "kvinner",
  other: "annet",
};

// ============================================
// INTENT DISTRIBUTION TYPES
// ============================================

export interface IntentDistribution {
  party: number;
  chill: number;
  date_night: number;
  with_friends: number;
  solo: number;
  total: number;
  dominantIntent: Intent | null;
  dominantPct: number;
}

export const INTENT_BADGE_LABELS: Record<Intent, string> = {
  party: "Feststemning",
  chill: "Chill stemning",
  date_night: "Date-vibe",
  with_friends: "Vennegjeng",
  solo: "Solo-friendly",
};

/**
 * Calculate intent distribution for a set of check-ins
 */
export function calculateIntentDistribution(checkIns: CheckIn[]): IntentDistribution {
  const counts: Record<Intent, number> = {
    party: 0,
    chill: 0,
    date_night: 0,
    with_friends: 0,
    solo: 0,
  };

  checkIns.forEach((c) => {
    if (c.intent && counts.hasOwnProperty(c.intent)) {
      counts[c.intent]++;
    }
  });

  const total = checkIns.length;
  
  // Find dominant intent
  let dominantIntent: Intent | null = null;
  let maxCount = 0;
  (Object.entries(counts) as [Intent, number][]).forEach(([intent, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantIntent = intent;
    }
  });

  const dominantPct = total > 0 && dominantIntent ? Math.round((counts[dominantIntent] / total) * 100) : 0;

  return {
    party: total > 0 ? Math.round((counts.party / total) * 100) : 0,
    chill: total > 0 ? Math.round((counts.chill / total) * 100) : 0,
    date_night: total > 0 ? Math.round((counts.date_night / total) * 100) : 0,
    with_friends: total > 0 ? Math.round((counts.with_friends / total) * 100) : 0,
    solo: total > 0 ? Math.round((counts.solo / total) * 100) : 0,
    total,
    dominantIntent,
    dominantPct,
  };
}

/**
 * Get combined percentage for selected intents
 */
export function getCombinedIntentPercentage(distribution: IntentDistribution, intents: Intent[]): number {
  if (intents.length === 0 || distribution.total === 0) return 0;
  return intents.reduce((sum, intent) => sum + distribution[intent], 0);
}

// ============================================
// VIBE SCORE VALUES FOR CALCULATIONS
// ============================================

const VIBE_SCORE_VALUES: Record<VibeScore, number> = {
  hot: 1.0,
  good: 0.75,
  ok: 0.5,
  quiet: 0.25,
};

// ============================================
// CALCULATE DEMOGRAPHICS
// ============================================

/**
 * Calculate demographics statistics from check-ins
 * Uses gender and age_band fields from check-ins
 */
export function calculateDemographics(checkIns: CheckIn[]): DemographicsStats {
  // Initialize age band counts
  const ageBandCounts: Record<AgeBand, number> = {
    "18_25": 0,
    "25_30": 0,
    "30_35": 0,
    "35_40": 0,
    "40_plus": 0,
  };

  let maleCount = 0;
  let femaleCount = 0;
  let otherCount = 0;
  let totalGenderResponses = 0;
  let totalAgeResponses = 0;

  checkIns.forEach((c) => {
    // Count gender
    if (c.gender) {
      if (c.gender === 'male') {
        maleCount++;
        totalGenderResponses++;
      } else if (c.gender === 'female') {
        femaleCount++;
        totalGenderResponses++;
      } else if (c.gender === 'other' || c.gender === 'prefer_not_to_say') {
        otherCount++;
        totalGenderResponses++;
      }
    }

    // Count age band
    if (c.ageBand && ageBandCounts.hasOwnProperty(c.ageBand)) {
      totalAgeResponses++;
      ageBandCounts[c.ageBand]++;
    }
  });

  // Calculate gender percentages (should sum to ~100%)
  const malePct = totalGenderResponses > 0 ? Math.round((maleCount / totalGenderResponses) * 100) : 0;
  const femalePct = totalGenderResponses > 0 ? Math.round((femaleCount / totalGenderResponses) * 100) : 0;
  const otherPct = totalGenderResponses > 0 ? Math.round((otherCount / totalGenderResponses) * 100) : 0;

  // Find most common gender
  let mostCommonGender: 'male' | 'female' | 'other' | null = null;
  if (totalGenderResponses > 0) {
    if (femaleCount >= maleCount && femaleCount >= otherCount) {
      mostCommonGender = 'female';
    } else if (maleCount >= femaleCount && maleCount >= otherCount) {
      mostCommonGender = 'male';
    } else {
      mostCommonGender = 'other';
    }
  }

  // Calculate age band percentages
  const ageBandPct: Record<AgeBand, number> = {
    "18_25": totalAgeResponses > 0 ? Math.round((ageBandCounts["18_25"] / totalAgeResponses) * 100) : 0,
    "25_30": totalAgeResponses > 0 ? Math.round((ageBandCounts["25_30"] / totalAgeResponses) * 100) : 0,
    "30_35": totalAgeResponses > 0 ? Math.round((ageBandCounts["30_35"] / totalAgeResponses) * 100) : 0,
    "35_40": totalAgeResponses > 0 ? Math.round((ageBandCounts["35_40"] / totalAgeResponses) * 100) : 0,
    "40_plus": totalAgeResponses > 0 ? Math.round((ageBandCounts["40_plus"] / totalAgeResponses) * 100) : 0,
  };

  // Find most common age band
  let mostCommonAgeBand: AgeBand | null = null;
  let maxAgeBandCount = 0;
  (Object.entries(ageBandCounts) as [AgeBand, number][]).forEach(([band, count]) => {
    if (count > maxAgeBandCount) {
      maxAgeBandCount = count;
      mostCommonAgeBand = band;
    }
  });

  return {
    malePct,
    femalePct,
    otherPct,
    maleCount,
    femaleCount,
    otherCount,
    totalGenderResponses,
    mostCommonGender,
    ageBandPct,
    ageBandCounts,
    mostCommonAgeBand,
    totalAgeResponses,
  };
}

/**
 * Get the percentage of check-ins in a specific age band for a venue
 */
export function getAgeBandPercentage(demographics: DemographicsStats, ageBand: AgeBand | null): number {
  if (!ageBand || demographics.totalAgeResponses === 0) return 0;
  return demographics.ageBandPct[ageBand] || 0;
}

// ============================================
// CALCULATE VENUE STATS
// ============================================

/**
 * Calculate stats for a single venue based on its check-ins
 */
export function calculateVenueStats(checkIns: CheckIn[]): VenueStats {
  const vibes: Record<VibeScore, number> = { hot: 0, good: 0, ok: 0, quiet: 0 };
  let singleCount = 0;
  let singleTotal = 0;
  let onsOpenCount = 0;
  let onsTotal = 0;
  let totalVibeScore = 0;

  checkIns.forEach((c) => {
    vibes[c.vibeScore]++;
    totalVibeScore += VIBE_SCORE_VALUES[c.vibeScore];

    // Track relationship status
    if (c.relationshipStatus !== null) {
      singleTotal++;
      if (c.relationshipStatus === 'single') {
        singleCount++;
      }
    }

    // Track ONS intent
    if (c.onsIntent !== null) {
      onsTotal++;
      if (c.onsIntent === 'open' || c.onsIntent === 'maybe') {
        onsOpenCount++;
      }
    }
  });

  // Find dominant vibe
  let dominantVibe: VibeScore | null = null;
  let maxCount = 0;
  (Object.entries(vibes) as [VibeScore, number][]).forEach(([vibe, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantVibe = vibe;
    }
  });

  // Calculate ratios
  const singleRatio = singleTotal > 0 ? singleCount / singleTotal : null;
  const onsRatio = onsTotal > 0 ? onsOpenCount / onsTotal : null;

  // Calculate heat score (0-100)
  const checkInCount = checkIns.length;
  const heatScore = Math.min(100, checkInCount * 10);

  // Calculate average vibe score (0-1)
  const avgVibeScore = checkInCount > 0 ? totalVibeScore / checkInCount : 0;

  // Calculate ONS Boost score using tuned formula:
  // - Heavily weighted toward ONS intent (open/maybe)
  // - Single status as secondary factor
  // - Use log scale to make small amounts visible
  // - Normalize by percentage rather than raw counts for fairness
  //
  // Formula: boostScore = onsIntensity * singleFactor * activityBonus
  // where:
  //   onsIntensity = weighted ONS ratio (open=1.0, maybe=0.6)
  //   singleFactor = boost if many singles
  //   activityBonus = log scale activity boost
  
  let onsWeightedScore = 0;
  checkIns.forEach((c) => {
    if (c.onsIntent === 'open') onsWeightedScore += 1.0;
    else if (c.onsIntent === 'maybe') onsWeightedScore += 0.6;
  });
  
  // ONS intensity (0-1 scale, using percentage)
  const onsIntensity = onsTotal > 0 ? onsWeightedScore / onsTotal : 0;
  
  // Single factor: boost if many singles (1.0 to 1.5)
  const singleFactor = singleRatio !== null ? 1.0 + (singleRatio * 0.5) : 1.0;
  
  // Activity bonus: log scale so small venues can still show up
  // log2(activity + 1) gives: 0->0, 1->1, 3->2, 7->3, 15->4
  const activityBonus = Math.log2(checkInCount + 1);
  
  // Combined boost score
  // Base: ONS intensity is main factor
  // Multiply by single factor for bonus
  // Add activity bonus (scaled down) to break ties
  const boostScore = (onsIntensity * singleFactor * 10) + (activityBonus * 0.5);

  return {
    checkInCount,
    dominantVibe,
    heatScore,
    singleCount,
    singleTotal,
    singleRatio,
    onsOpenCount,
    onsTotal,
    onsRatio,
    boostScore,
  };
}

// ============================================
// EXTENDED VENUE WITH STATS (includes demographics and intent)
// ============================================

export interface VenueWithFullStats extends VenueWithStats {
  demographics: DemographicsStats;
  intentDistribution: IntentDistribution;
  boostScore: number;
}

/**
 * Calculate stats for all venues at once (including demographics and intent)
 */
export function calculateAllVenueStats(
  venues: Venue[],
  checkIns: CheckIn[]
): VenueWithFullStats[] {
  // Group check-ins by venue
  const checkInsByVenue = new Map<string, CheckIn[]>();
  
  checkIns.forEach((c) => {
    const existing = checkInsByVenue.get(c.venueId) || [];
    existing.push(c);
    checkInsByVenue.set(c.venueId, existing);
  });

  // Calculate stats for each venue
  return venues.map((venue) => {
    const venueCheckIns = checkInsByVenue.get(venue.id) || [];
    const stats = calculateVenueStats(venueCheckIns);
    const demographics = calculateDemographics(venueCheckIns);
    const intentDistribution = calculateIntentDistribution(venueCheckIns);

    return {
      ...venue,
      ...stats,
      // Map to expected interface names
      statusCount: stats.singleTotal,
      onsAnsweredCount: stats.onsTotal,
      demographics,
      intentDistribution,
      boostScore: stats.boostScore,
    };
  });
}

// ============================================
// SORT MODE TYPE (extended with 'age' and 'intent')
// ============================================

export type SortMode = HeatmapMode | 'age' | 'intent';

/**
 * Get combined percentage for multiple age bands
 */
export function getCombinedAgeBandPercentage(demographics: DemographicsStats, ageBands: AgeBand[]): number {
  if (ageBands.length === 0 || demographics.totalAgeResponses === 0) return 0;
  return ageBands.reduce((sum, band) => sum + (demographics.ageBandPct[band] || 0), 0);
}

/**
 * Sort venues based on sort mode
 * Supports: activity, single, ons, ons_boost, age, intent
 * For 'age' mode, accepts array of target age bands
 * For 'intent' mode, accepts array of target intents
 */
export function sortVenuesByMode(
  venues: VenueWithFullStats[],
  sortMode: SortMode,
  targetAgeBands?: AgeBand[],
  targetIntents?: Intent[]
): VenueWithFullStats[] {
  const sorted = [...venues];

  switch (sortMode) {
    case 'single':
      // Sort by singleRatio descending, venues without data at the end
      return sorted.sort((a, b) => {
        if (a.singleRatio === null && b.singleRatio === null) {
          return b.checkInCount - a.checkInCount;
        }
        if (a.singleRatio === null) return 1;
        if (b.singleRatio === null) return -1;
        return b.singleRatio - a.singleRatio;
      });

    case 'ons':
      // Sort by onsRatio descending, venues without data at the end
      return sorted.sort((a, b) => {
        if (a.onsRatio === null && b.onsRatio === null) {
          return b.checkInCount - a.checkInCount;
        }
        if (a.onsRatio === null) return 1;
        if (b.onsRatio === null) return -1;
        return b.onsRatio - a.onsRatio;
      });

    case 'ons_boost':
      // Sort by boostScore descending
      return sorted.sort((a, b) => b.boostScore - a.boostScore);

    case 'age':
      // Sort by percentage of guests in target age bands
      // Default to 25-30 if no target bands specified
      const bands = targetAgeBands && targetAgeBands.length > 0 ? targetAgeBands : ['25_30' as AgeBand];
      return sorted.sort((a, b) => {
        const aPct = getCombinedAgeBandPercentage(a.demographics, bands);
        const bPct = getCombinedAgeBandPercentage(b.demographics, bands);
        
        // If both have no age data, fall back to activity
        if (aPct === 0 && bPct === 0) {
          return b.checkInCount - a.checkInCount;
        }
        
        return bPct - aPct;
      });

    case 'intent':
      // Sort by percentage of guests with target intents
      // If no intents specified, sort by dominant intent percentage
      return sorted.sort((a, b) => {
        if (targetIntents && targetIntents.length > 0) {
          const aPct = getCombinedIntentPercentage(a.intentDistribution, targetIntents);
          const bPct = getCombinedIntentPercentage(b.intentDistribution, targetIntents);
          
          if (aPct === 0 && bPct === 0) {
            return b.checkInCount - a.checkInCount;
          }
          
          return bPct - aPct;
        } else {
          // Sort by dominant intent percentage
          return b.intentDistribution.dominantPct - a.intentDistribution.dominantPct;
        }
      });

    default:
      // Sort by check-in count (activity)
      return sorted.sort((a, b) => b.checkInCount - a.checkInCount);
  }
}
