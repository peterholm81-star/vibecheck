import type { Venue, CheckIn, VibeScore, Intent, RelationshipStatus, OnsIntent, HeatmapPoint, HeatmapMode, Gender, AgeBand } from '../types';
import { calculateHeatmapWeight } from '../types';
import { calculateVenueStats } from '../utils/venueStats';

// ============================================
// MOCK VENUES - Oslo Nightlife Hotspots
// TODO: Replace with Supabase data in Phase 2
// ============================================

export const MOCK_VENUES: Venue[] = [
  // Grünerløkka area
  {
    id: 'v1',
    name: 'Blå',
    address: 'Brenneriveien 9C, 0182 Oslo',
    latitude: 59.9225,
    longitude: 10.7525,
    category: 'club',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v2',
    name: 'Parkteatret Bar',
    address: 'Olaf Ryes plass 11, 0552 Oslo',
    latitude: 59.9234,
    longitude: 10.7589,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v3',
    name: 'Crowbar',
    address: 'Torggata 32, 0183 Oslo',
    latitude: 59.9178,
    longitude: 10.7512,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Sentrum area
  {
    id: 'v4',
    name: 'Jaeger',
    address: 'Grensen 9, 0159 Oslo',
    latitude: 59.9139,
    longitude: 10.7412,
    category: 'club',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v5',
    name: 'The Villa',
    address: 'Møllergata 23, 0179 Oslo',
    latitude: 59.9167,
    longitude: 10.7489,
    category: 'club',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v6',
    name: 'Kulturhuset',
    address: 'Youngstorget 3, 0181 Oslo',
    latitude: 59.9145,
    longitude: 10.7492,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v7',
    name: 'Himkok',
    address: 'Storgata 27, 0184 Oslo',
    latitude: 59.9155,
    longitude: 10.7535,
    category: 'lounge',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v8',
    name: 'Angst Bar',
    address: 'Torgata 11, 0181 Oslo',
    latitude: 59.9152,
    longitude: 10.7478,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Aker Brygge / Tjuvholmen
  {
    id: 'v9',
    name: 'Aker Brygge Rooftop',
    address: 'Stranden 3, 0250 Oslo',
    latitude: 59.9095,
    longitude: 10.7275,
    category: 'rooftop',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v10',
    name: 'Tjuvholmen Sjømagasin',
    address: 'Tjuvholmen allé 14, 0252 Oslo',
    latitude: 59.9072,
    longitude: 10.7215,
    category: 'lounge',
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Vulkan area
  {
    id: 'v11',
    name: 'Hendrix Ibsen',
    address: 'Vulkan 5, 0178 Oslo',
    latitude: 59.9218,
    longitude: 10.7515,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v12',
    name: 'Smelteverket',
    address: 'Maridalsveien 33, 0175 Oslo',
    latitude: 59.9205,
    longitude: 10.7508,
    category: 'pub',
    createdAt: '2024-01-01T00:00:00Z',
  },
  // Majorstuen / Frogner
  {
    id: 'v13',
    name: 'Revolver',
    address: 'Møllergata 32, 0179 Oslo',
    latitude: 59.9171,
    longitude: 10.7485,
    category: 'bar',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'v14',
    name: 'Sentralen',
    address: 'Øvre Slottsgate 3, 0157 Oslo',
    latitude: 59.9118,
    longitude: 10.7398,
    category: 'lounge',
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// ============================================
// MOCK CHECK-INS - Simulated recent activity
// TODO: Replace with Supabase realtime in Phase 2
// ============================================

/**
 * Generate mock check-ins with realistic distribution
 * - More check-ins at popular venues
 * - Mix of vibe scores weighted toward "good"
 * - Recent timestamps with natural decay
 * - Random relationship status and ONS intent
 */
function generateMockCheckIns(): CheckIn[] {
  const now = Date.now();
  const checkIns: CheckIn[] = [];
  
  // Define venue activity levels (higher = more check-ins)
  const venueActivity: Record<string, number> = {
    'v1': 8,   // Blå - very popular
    'v2': 5,   // Parkteatret
    'v3': 3,   // Crowbar
    'v4': 10,  // Jaeger - hottest spot
    'v5': 7,   // The Villa
    'v6': 4,   // Kulturhuset
    'v7': 6,   // Himkok
    'v8': 2,   // Angst
    'v9': 4,   // Aker Brygge
    'v10': 3,  // Tjuvholmen
    'v11': 5,  // Hendrix
    'v12': 4,  // Smelteverket
    'v13': 6,  // Revolver
    'v14': 3,  // Sentralen
  };
  
  // Vibe score distribution (weighted random)
  const vibeScores: VibeScore[] = ['hot', 'good', 'good', 'good', 'ok', 'ok', 'quiet'];
  const intents: Intent[] = ['party', 'party', 'chill', 'with_friends', 'with_friends', 'date_night', 'solo'];
  
  // Relationship status distribution (many null, some answers)
  const relationshipStatuses: (RelationshipStatus | null)[] = [
    null, null, null, null, null, // Most don't answer
    'single', 'single', 'single', // Singles are more likely to share
    'in_relationship',
    'complicated',
    'prefer_not_to_say',
  ];
  
  // ONS intent distribution (many null, some answers)
  const onsIntents: (OnsIntent | null)[] = [
    null, null, null, null, null, // Most don't answer
    'open', 'open',
    'maybe', 'maybe', 'maybe',
    'not_interested',
    'prefer_not_to_say',
  ];
  
  // Gender distribution (many null, some answers)
  const genders: (Gender | null)[] = [
    null, null, null, // Some don't answer
    'male', 'male', 'male', 'male',
    'female', 'female', 'female', 'female', 'female',
    'other',
    'prefer_not_to_say',
  ];
  
  // Age band distribution (many null, some answers)
  const ageBands: (AgeBand | null)[] = [
    null, null, null, // Some don't answer
    '18_25', '18_25', '18_25', '18_25', // Most common: young crowd
    '25_30', '25_30', '25_30', '25_30', '25_30',
    '30_35', '30_35',
    '35_40',
    '40_plus',
  ];
  
  let checkInId = 1;
  
  Object.entries(venueActivity).forEach(([venueId, count]) => {
    for (let i = 0; i < count; i++) {
      // Random timestamp within last 180 minutes (to cover all time windows)
      const minutesAgo = Math.random() * 180;
      const timestamp = new Date(now - minutesAgo * 60 * 1000).toISOString();
      
      // Weighted random selections
      const vibeScore = vibeScores[Math.floor(Math.random() * vibeScores.length)];
      const intent = intents[Math.floor(Math.random() * intents.length)];
      const relationshipStatus = relationshipStatuses[Math.floor(Math.random() * relationshipStatuses.length)];
      const onsIntent = onsIntents[Math.floor(Math.random() * onsIntents.length)];
      const gender = genders[Math.floor(Math.random() * genders.length)];
      const ageBand = ageBands[Math.floor(Math.random() * ageBands.length)];
      
      checkIns.push({
        id: `c${checkInId++}`,
        venueId,
        timestamp,
        vibeScore,
        intent,
        relationshipStatus,
        onsIntent,
        gender,
        ageBand,
        createdAt: timestamp,
      });
    }
  });
  
  // Sort by timestamp descending (most recent first)
  return checkIns.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export const MOCK_CHECKINS: CheckIn[] = generateMockCheckIns();

// ============================================
// HEATMAP DATA GENERATION
// ============================================

/**
 * Convert check-ins to heatmap points with calculated weights
 * Each point represents a check-in location with intensity based on:
 * - Vibe score (hot = max weight, quiet = min weight)
 * - Recency (newer = higher weight, decays over time window)
 * - Mode: activity (default), single, ons, or ons_boost
 */
export function generateHeatmapData(
  venues: Venue[],
  checkIns: CheckIn[],
  timeWindowMinutes: number = 60,
  mode: HeatmapMode = 'activity'
): HeatmapPoint[] {
  const venueMap = new Map(venues.map(v => [v.id, v]));
  
  // For single/ons/ons_boost modes, we need venue-level stats
  if (mode === 'single' || mode === 'ons' || mode === 'ons_boost') {
    // Group check-ins by venue
    const checkInsByVenue = new Map<string, CheckIn[]>();
    checkIns.forEach(c => {
      const existing = checkInsByVenue.get(c.venueId) || [];
      existing.push(c);
      checkInsByVenue.set(c.venueId, existing);
    });

    // Generate heatmap points per venue (not per check-in)
    const points: HeatmapPoint[] = [];
    
    // For ons_boost, we need to find max boost score for normalization
    let maxBoostScore = 1;
    if (mode === 'ons_boost') {
      checkInsByVenue.forEach((venueCheckIns) => {
        const stats = calculateVenueStats(venueCheckIns);
        if (stats.boostScore > maxBoostScore) {
          maxBoostScore = stats.boostScore;
        }
      });
    }
    
    checkInsByVenue.forEach((venueCheckIns, venueId) => {
      const venue = venueMap.get(venueId);
      if (!venue) return;
      
      const stats = calculateVenueStats(venueCheckIns);
      const baseActivity = venueCheckIns.length;
      
      // Calculate weight based on mode
      let weight = 0;
      if (mode === 'single' && stats.singleRatio !== null) {
        // Single mode: highlight venues with high single ratio
        // Use sqrt for more even distribution
        weight = Math.min(1, Math.sqrt(baseActivity / 10) * stats.singleRatio);
      } else if (mode === 'ons' && stats.onsRatio !== null) {
        // ONS mode: highlight venues with high ONS openness ratio
        weight = Math.min(1, Math.sqrt(baseActivity / 10) * stats.onsRatio);
      } else if (mode === 'ons_boost') {
        // ONS Boost mode: use tuned boost score
        // Apply power curve to make differences more visible
        const normalized = maxBoostScore > 0 ? stats.boostScore / maxBoostScore : 0;
        // Use power of 0.7 to boost lower values slightly
        weight = Math.pow(normalized, 0.7);
      }
      
      // Lower threshold for visibility - show venues with even small ONS activity
      const minWeight = mode === 'ons_boost' ? 0.05 : 0;
      
      // Only add point if there's some weight
      if (weight > minWeight) {
        // Add multiple points based on activity for better visualization
        // For ons_boost, also factor in weight to determine point count
        const numPoints = mode === 'ons_boost' 
          ? Math.max(1, Math.min(baseActivity, Math.ceil(weight * 5)))
          : Math.min(baseActivity, 5);
          
        for (let i = 0; i < numPoints; i++) {
          const jitter = 0.0003;
          const latOffset = (Math.random() - 0.5) * jitter;
          const lngOffset = (Math.random() - 0.5) * jitter;
          
          points.push({
            latitude: venue.latitude + latOffset,
            longitude: venue.longitude + lngOffset,
            weight,
          });
        }
      }
    });
    
    return points;
  }
  
  // Default activity mode: per-checkin weighting
  return checkIns
    .map(checkIn => {
      const venue = venueMap.get(checkIn.venueId);
      if (!venue) return null;
      
      // Calculate combined weight from vibe score and recency
      const weight = calculateHeatmapWeight(checkIn, timeWindowMinutes);
      
      // Add small random offset to prevent exact overlap
      // This creates a more natural-looking heatmap
      const jitter = 0.0003; // ~30 meters
      const latOffset = (Math.random() - 0.5) * jitter;
      const lngOffset = (Math.random() - 0.5) * jitter;
      
      return {
        latitude: venue.latitude + latOffset,
        longitude: venue.longitude + lngOffset,
        weight,
      };
    })
    .filter((point): point is HeatmapPoint => point !== null);
}
