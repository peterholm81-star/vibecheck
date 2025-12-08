/**
 * ============================================
 * SEED DEMO DATA FOR VIBECHECK INSIGHTS
 * ============================================
 * 
 * Generates realistic check-in data for testing the Insights dashboard.
 * 
 * Usage:
 *   npm run seed:demo
 * 
 * What it does:
 * 1. Deletes all existing check_ins
 * 2. Fetches all venues with their city_id
 * 3. Generates check-ins based on city size:
 *    - Big cities (Oslo, Bergen, Trondheim, Stavanger, Tromsø): 150-300 per venue
 *    - Other cities: 60-200 per venue
 * 4. Distributes check-ins over 60 days with realistic patterns
 * 5. Runs loyalty calculation function
 * 
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ============================================
// CONFIGURATION
// ============================================

const SEED_DAYS = 60; // Generate data for the last 60 days
const BIG_CITIES = ['Oslo', 'Bergen', 'Trondheim', 'Stavanger', 'Tromsø'];

// Check-in counts per venue (historical)
const BIG_CITY_MIN = 150;
const BIG_CITY_MAX = 300;
const NORMAL_CITY_MIN = 60;
const NORMAL_CITY_MAX = 200;

// Live check-ins per venue (last 60 minutes)
const LIVE_CHECKINS_MIN = 5;
const LIVE_CHECKINS_MAX = 15;
const LIVE_WINDOW_MINUTES = 60;

// Batch size for inserts
const INSERT_BATCH_SIZE = 500;

// ============================================
// TYPES
// ============================================

interface Venue {
  id: string;
  name: string;
  city: string | null;
  city_id: number | null;
}

interface City {
  id: number;
  name: string;
}

type VibeScore = 1 | 2 | 3 | 4; // 1=quiet, 2=ok, 3=good, 4=hot
type Intent = 'party' | 'chill' | 'date_night' | 'with_friends' | 'solo';
type RelationshipStatus = 'single' | 'in_relationship' | 'complicated' | 'prefer_not_to_say';
type OnsIntent = 'open' | 'maybe' | 'not_interested' | 'prefer_not_to_say';
type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type AgeBand = '18_25' | '25_30' | '30_35' | '35_40' | '40_plus';

interface CheckInInsert {
  venue_id: string;
  user_id: string;
  vibe_score: VibeScore;
  intent: Intent;
  relationship_status: RelationshipStatus;
  ons_intent: OnsIntent;
  gender: Gender;
  age_band: AgeBand;
  created_at: string;
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function validateEnvironment(): void {
  const missing: string[] = [];

  if (!SUPABASE_URL) {
    missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
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
// RANDOM HELPERS
// ============================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice<T>(options: Array<{ value: T; weight: number }>): T {
  const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const option of options) {
    random -= option.weight;
    if (random <= 0) {
      return option.value;
    }
  }
  
  return options[options.length - 1].value;
}

function generateUserId(): string {
  // Generate a fake but consistent UUID for demo purposes
  return `demo-${Math.random().toString(36).substring(2, 15)}`;
}

// ============================================
// DATE HELPERS
// ============================================

function getRandomTimestamp(daysAgo: number): Date {
  const now = new Date();
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  
  // Random time within the day
  // Weight towards evening hours (20:00-02:00)
  const hour = weightedChoice([
    { value: randomInt(10, 15), weight: 5 },   // Day (10-15): low weight
    { value: randomInt(16, 19), weight: 15 },  // Early evening (16-19): medium weight
    { value: randomInt(20, 23), weight: 50 },  // Prime time (20-23): high weight
    { value: randomInt(0, 2), weight: 30 },    // Late night (00-02): high weight
  ]);
  
  date.setHours(hour, randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));
  return date;
}

function getDayOfWeek(date: Date): number {
  return date.getDay(); // 0=Sunday, 6=Saturday
}

function isWeekend(date: Date): boolean {
  const day = getDayOfWeek(date);
  return day === 5 || day === 6; // Friday or Saturday
}

// ============================================
// DATA GENERATION
// ============================================

function generateRelationshipStatus(): RelationshipStatus {
  // 55-65% single, 30-40% in_relationship, rest other
  return weightedChoice([
    { value: 'single' as RelationshipStatus, weight: 60 },
    { value: 'in_relationship' as RelationshipStatus, weight: 35 },
    { value: 'complicated' as RelationshipStatus, weight: 3 },
    { value: 'prefer_not_to_say' as RelationshipStatus, weight: 2 },
  ]);
}

function generateOnsIntent(relationshipStatus: RelationshipStatus): OnsIntent {
  // Singles: 25-35% open/maybe
  // In relationship: lower
  if (relationshipStatus === 'single') {
    return weightedChoice([
      { value: 'open' as OnsIntent, weight: 15 },
      { value: 'maybe' as OnsIntent, weight: 20 },
      { value: 'not_interested' as OnsIntent, weight: 50 },
      { value: 'prefer_not_to_say' as OnsIntent, weight: 15 },
    ]);
  } else {
    return weightedChoice([
      { value: 'open' as OnsIntent, weight: 5 },
      { value: 'maybe' as OnsIntent, weight: 10 },
      { value: 'not_interested' as OnsIntent, weight: 70 },
      { value: 'prefer_not_to_say' as OnsIntent, weight: 15 },
    ]);
  }
}

function generateIntent(date: Date): Intent {
  const isWeekendNight = isWeekend(date);
  const hour = date.getHours();
  const isLateNight = hour >= 22 || hour <= 2;
  
  if (isWeekendNight && isLateNight) {
    // Friday/Saturday late night: more party
    return weightedChoice([
      { value: 'party' as Intent, weight: 45 },
      { value: 'chill' as Intent, weight: 15 },
      { value: 'date_night' as Intent, weight: 15 },
      { value: 'with_friends' as Intent, weight: 20 },
      { value: 'solo' as Intent, weight: 5 },
    ]);
  } else if (isWeekendNight) {
    // Friday/Saturday early evening
    return weightedChoice([
      { value: 'party' as Intent, weight: 30 },
      { value: 'chill' as Intent, weight: 20 },
      { value: 'date_night' as Intent, weight: 20 },
      { value: 'with_friends' as Intent, weight: 25 },
      { value: 'solo' as Intent, weight: 5 },
    ]);
  } else {
    // Weekday: more chill and with_friends
    return weightedChoice([
      { value: 'party' as Intent, weight: 15 },
      { value: 'chill' as Intent, weight: 35 },
      { value: 'date_night' as Intent, weight: 15 },
      { value: 'with_friends' as Intent, weight: 30 },
      { value: 'solo' as Intent, weight: 5 },
    ]);
  }
}

function generateVibeScore(date: Date): VibeScore {
  const isWeekendNight = isWeekend(date);
  const hour = date.getHours();
  const isPrimeTime = hour >= 22 || hour <= 1;
  
  if (isWeekendNight && isPrimeTime) {
    // Weekend prime time: higher vibe scores
    return weightedChoice([
      { value: 4 as VibeScore, weight: 35 }, // hot
      { value: 3 as VibeScore, weight: 40 }, // good
      { value: 2 as VibeScore, weight: 20 }, // ok
      { value: 1 as VibeScore, weight: 5 },  // quiet
    ]);
  } else if (isWeekendNight) {
    return weightedChoice([
      { value: 4 as VibeScore, weight: 25 },
      { value: 3 as VibeScore, weight: 40 },
      { value: 2 as VibeScore, weight: 25 },
      { value: 1 as VibeScore, weight: 10 },
    ]);
  } else {
    // Weekday: lower vibe scores
    return weightedChoice([
      { value: 4 as VibeScore, weight: 10 },
      { value: 3 as VibeScore, weight: 30 },
      { value: 2 as VibeScore, weight: 40 },
      { value: 1 as VibeScore, weight: 20 },
    ]);
  }
}

function generateGender(): Gender {
  return weightedChoice([
    { value: 'male' as Gender, weight: 55 },
    { value: 'female' as Gender, weight: 40 },
    { value: 'other' as Gender, weight: 3 },
    { value: 'prefer_not_to_say' as Gender, weight: 2 },
  ]);
}

function generateAgeBand(): AgeBand {
  // Main demographic: 20-35
  return weightedChoice([
    { value: '18_25' as AgeBand, weight: 30 },
    { value: '25_30' as AgeBand, weight: 35 },
    { value: '30_35' as AgeBand, weight: 20 },
    { value: '35_40' as AgeBand, weight: 10 },
    { value: '40_plus' as AgeBand, weight: 5 },
  ]);
}

function generateCheckInForVenue(venueId: string, daysAgo: number): CheckInInsert {
  const timestamp = getRandomTimestamp(daysAgo);
  const relationshipStatus = generateRelationshipStatus();
  
  return {
    venue_id: venueId,
    user_id: generateUserId(),
    vibe_score: generateVibeScore(timestamp),
    intent: generateIntent(timestamp),
    relationship_status: relationshipStatus,
    ons_intent: generateOnsIntent(relationshipStatus),
    gender: generateGender(),
    age_band: generateAgeBand(),
    created_at: timestamp.toISOString(),
  };
}

/**
 * Get a random timestamp within the last N minutes (for "live" check-ins)
 */
function getRecentTimestamp(withinMinutes: number): Date {
  const now = new Date();
  const minutesAgo = randomInt(1, withinMinutes);
  const secondsAgo = randomInt(0, 59);
  
  return new Date(now.getTime() - (minutesAgo * 60 * 1000) - (secondsAgo * 1000));
}

/**
 * Generate a "live" check-in for a venue (within the last 60 minutes)
 * Uses current time context for vibe/intent generation
 */
function generateLiveCheckInForVenue(venueId: string): CheckInInsert {
  const timestamp = getRecentTimestamp(LIVE_WINDOW_MINUTES);
  const relationshipStatus = generateRelationshipStatus();
  
  return {
    venue_id: venueId,
    user_id: generateUserId(),
    vibe_score: generateVibeScore(timestamp),
    intent: generateIntent(timestamp),
    relationship_status: relationshipStatus,
    ons_intent: generateOnsIntent(relationshipStatus),
    gender: generateGender(),
    age_band: generateAgeBand(),
    created_at: timestamp.toISOString(),
  };
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedDemoData(): Promise<void> {
  console.log('🌱 Starting demo data seed...\n');

  const supabase = createSupabaseAdmin();
  console.log('✅ Supabase client initialized\n');

  // ============================================
  // STEP 1: Delete existing check-ins
  // ============================================
  console.log('🗑️  Deleting existing check-ins...');
  
  const { error: deleteError } = await supabase
    .from('check_ins')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq with impossible id)
  
  if (deleteError) {
    console.error('❌ Error deleting check-ins:', deleteError.message);
    process.exit(1);
  }
  console.log('   ✓ Existing check-ins deleted\n');

  // ============================================
  // STEP 2: Fetch cities
  // ============================================
  console.log('📍 Fetching cities...');
  
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('id, name');
  
  if (citiesError) {
    console.error('❌ Error fetching cities:', citiesError.message);
    process.exit(1);
  }
  
  const cityMap = new Map<number, string>();
  (cities ?? []).forEach((c: City) => cityMap.set(c.id, c.name));
  console.log(`   ✓ Found ${cityMap.size} cities\n`);

  // ============================================
  // STEP 3: Fetch venues
  // ============================================
  console.log('🏪 Fetching venues...');
  
  const { data: venues, error: venuesError } = await supabase
    .from('venues')
    .select('id, name, city, city_id');
  
  if (venuesError) {
    console.error('❌ Error fetching venues:', venuesError.message);
    process.exit(1);
  }
  
  if (!venues || venues.length === 0) {
    console.log('⚠️  No venues found. Cannot generate check-ins.');
    process.exit(0);
  }
  
  console.log(`   ✓ Found ${venues.length} venues\n`);

  // ============================================
  // STEP 4: Generate check-ins
  // ============================================
  console.log('📝 Generating check-ins...\n');
  
  const allCheckIns: CheckInInsert[] = [];
  const venueStats: Array<{ name: string; city: string; count: number }> = [];
  
  for (const venue of venues as Venue[]) {
    // Determine city name
    let cityName = venue.city ?? 'Unknown';
    if (venue.city_id && cityMap.has(venue.city_id)) {
      cityName = cityMap.get(venue.city_id)!;
    }
    
    // Determine check-in count based on city size
    const isBigCity = BIG_CITIES.includes(cityName);
    const checkInCount = isBigCity
      ? randomInt(BIG_CITY_MIN, BIG_CITY_MAX)
      : randomInt(NORMAL_CITY_MIN, NORMAL_CITY_MAX);
    
    // Generate check-ins spread over SEED_DAYS
    for (let i = 0; i < checkInCount; i++) {
      // Weight towards weekends
      let daysAgo: number;
      if (Math.random() < 0.4) {
        // 40% chance: pick a weekend day
        const weekendDays = [];
        for (let d = 0; d < SEED_DAYS; d++) {
          const date = new Date();
          date.setDate(date.getDate() - d);
          if (isWeekend(date)) {
            weekendDays.push(d);
          }
        }
        daysAgo = randomChoice(weekendDays.length > 0 ? weekendDays : [randomInt(0, SEED_DAYS - 1)]);
      } else {
        // 60% chance: random day
        daysAgo = randomInt(0, SEED_DAYS - 1);
      }
      
      allCheckIns.push(generateCheckInForVenue(venue.id, daysAgo));
    }
    
    venueStats.push({
      name: venue.name ?? 'Unknown',
      city: cityName,
      count: checkInCount,
    });
    
    // Progress logging every 10 venues
    if (venueStats.length % 10 === 0) {
      console.log(`   Processed ${venueStats.length}/${venues.length} venues...`);
    }
  }
  
  console.log(`\n   ✓ Generated ${allCheckIns.length} check-ins for ${venues.length} venues\n`);

  // ============================================
  // STEP 5: Insert check-ins in batches
  // ============================================
  console.log('💾 Inserting check-ins...');
  
  let inserted = 0;
  for (let i = 0; i < allCheckIns.length; i += INSERT_BATCH_SIZE) {
    const batch = allCheckIns.slice(i, i + INSERT_BATCH_SIZE);
    
    const { error: insertError } = await supabase
      .from('check_ins')
      .insert(batch);
    
    if (insertError) {
      console.error(`❌ Error inserting batch ${i}-${i + batch.length}:`, insertError.message);
      process.exit(1);
    }
    
    inserted += batch.length;
    console.log(`   Inserted ${inserted}/${allCheckIns.length} check-ins...`);
  }
  
  console.log(`   ✓ All ${allCheckIns.length} historical check-ins inserted\n`);

  // ============================================
  // STEP 6: Generate "live" check-ins (last 60 minutes)
  // ============================================
  console.log('⚡ Generating live check-ins (last 60 minutes)...\n');
  
  const liveCheckIns: CheckInInsert[] = [];
  
  for (const venue of venues as Venue[]) {
    const liveCount = randomInt(LIVE_CHECKINS_MIN, LIVE_CHECKINS_MAX);
    
    for (let i = 0; i < liveCount; i++) {
      liveCheckIns.push(generateLiveCheckInForVenue(venue.id));
    }
  }
  
  console.log(`   ✓ Generated ${liveCheckIns.length} live check-ins for ${venues.length} venues\n`);

  // ============================================
  // STEP 7: Insert live check-ins
  // ============================================
  console.log('💾 Inserting live check-ins...');
  
  let liveInserted = 0;
  for (let i = 0; i < liveCheckIns.length; i += INSERT_BATCH_SIZE) {
    const batch = liveCheckIns.slice(i, i + INSERT_BATCH_SIZE);
    
    const { error: insertError } = await supabase
      .from('check_ins')
      .insert(batch);
    
    if (insertError) {
      console.error(`❌ Error inserting live batch ${i}-${i + batch.length}:`, insertError.message);
      process.exit(1);
    }
    
    liveInserted += batch.length;
    console.log(`   Inserted ${liveInserted}/${liveCheckIns.length} live check-ins...`);
  }
  
  console.log(`   ✓ All ${liveCheckIns.length} live check-ins inserted\n`);

  // ============================================
  // STEP 8: Run loyalty calculation
  // ============================================
  console.log('🏆 Running loyalty calculation...');
  
  const { error: loyaltyError } = await supabase.rpc('calculate_loyalty_for_all_venues', {
    stats_date: new Date().toISOString().split('T')[0],
  });
  
  if (loyaltyError) {
    console.warn('⚠️  Loyalty calculation warning:', loyaltyError.message);
    console.log('   (This is OK if the function does not exist yet)\n');
  } else {
    console.log('   ✓ Loyalty calculated\n');
  }

  // ============================================
  // STEP 9: Print summary
  // ============================================
  const counts = venueStats.map((v) => v.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const avgCount = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
  
  const totalCheckIns = allCheckIns.length + liveCheckIns.length;
  const avgLivePerVenue = Math.round(liveCheckIns.length / venues.length);
  
  // Group by city
  const cityBreakdown = new Map<string, { venues: number; checkIns: number }>();
  for (const stat of venueStats) {
    const existing = cityBreakdown.get(stat.city) ?? { venues: 0, checkIns: 0 };
    existing.venues++;
    existing.checkIns += stat.count;
    cityBreakdown.set(stat.city, existing);
  }
  
  console.log('═'.repeat(60));
  console.log('📊 SEED SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total venues:        ${venues.length}`);
  console.log(`   Historical check-ins: ${allCheckIns.length} (last ${SEED_DAYS} days)`);
  console.log(`   Live check-ins:       ${liveCheckIns.length} (last ${LIVE_WINDOW_MINUTES} min)`);
  console.log(`   Total check-ins:      ${totalCheckIns}`);
  console.log('');
  console.log('   Historical per venue:');
  console.log(`     Min:     ${minCount}`);
  console.log(`     Max:     ${maxCount}`);
  console.log(`     Average: ${avgCount}`);
  console.log('');
  console.log(`   Live per venue:      ~${avgLivePerVenue} (${LIVE_CHECKINS_MIN}-${LIVE_CHECKINS_MAX})`);
  console.log('');
  console.log('   By city (historical):');
  
  // Sort cities by check-in count descending
  const sortedCities = Array.from(cityBreakdown.entries())
    .sort((a, b) => b[1].checkIns - a[1].checkIns);
  
  for (const [city, stats] of sortedCities) {
    const isBig = BIG_CITIES.includes(city) ? ' ⭐' : '';
    console.log(`     ${city}${isBig}: ${stats.venues} venues, ${stats.checkIns} check-ins`);
  }
  
  console.log('═'.repeat(60));
  console.log('\n✅ Demo data seeding complete!');
  console.log('\n📍 Map & Venues now have live activity from the last 60 minutes');
  console.log('📊 Insights dashboard has 60 days of historical data');
  console.log('\nTest at /map or /insights\n');
  
  process.exit(0);
}

// ============================================
// RUN
// ============================================

validateEnvironment();

seedDemoData().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

