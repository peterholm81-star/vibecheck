import { supabase } from '../../lib/supabase';

// ============================================
// TYPES
// ============================================

export type InsightsPeriod = '7d' | '30d' | '90d';

export type Intent =
  | 'party'
  | 'chill'
  | 'date_night'
  | 'with_friends'
  | 'solo';

export type AgeBand = '18_25' | '25_30' | '30_35' | '35_40' | '40_plus';

export interface RawCheckIn {
  id: string;
  venue_id: string;
  intent: Intent | null;
  created_at: string;
  relationship_status: 'single' | 'in_relationship' | 'complicated' | string | null;
  ons_intent: 'open' | 'maybe' | 'not_interested' | string | null;
  gender: 'male' | 'female' | 'other' | string | null;
  age_band: AgeBand | null;
}

export interface ActivityPoint {
  date: string; // ISO date (yyyy-mm-dd)
  visits: number;
}

export interface IntentPoint {
  date: string;
  party: number;
  chill: number;
  date_night: number;
  with_friends: number;
  solo: number;
}

export interface AgeDistribution {
  band: AgeBand;
  label: string;
  percentage: number;
}

export interface GenderDistribution {
  label: 'male' | 'female' | 'other';
  displayLabel: string;
  percentage: number;
}

export interface RelationshipDistribution {
  label: 'single' | 'in_relationship' | 'other';
  displayLabel: string;
  percentage: number;
}

export interface KPIData {
  totalVisits: { value: number; deltaPct: number };
  partyIntentIndex: { value: number; deltaPct: number };
  singleRate: { value: number; deltaPct: number };
  dominantAgeBand: { label: string; deltaPoints: number };
}

export interface ComparisonMetric {
  label: string;
  rank: number;
  total: number;
  score: number; // 0–1 relative score
}

export interface InsightsData {
  kpi: KPIData;
  activitySeries: ActivityPoint[];
  intentSeries: IntentPoint[];
  ageDistribution: AgeDistribution[];
  genderDistribution: GenderDistribution[];
  relationshipDistribution: RelationshipDistribution[];
  comparison: ComparisonMetric[];
}

// ============================================
// DATE HELPERS
// ============================================

export function getDateRange(period: InsightsPeriod): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now);

  if (period === '7d') from.setDate(now.getDate() - 7);
  if (period === '30d') from.setDate(now.getDate() - 30);
  if (period === '90d') from.setDate(now.getDate() - 90);

  return {
    from: from.toISOString(),
    to,
  };
}

function shiftPeriod(period: InsightsPeriod): number {
  if (period === '7d') return 7;
  if (period === '30d') return 30;
  if (period === '90d') return 90;
  return 30;
}

// ============================================
// DATA FETCHING
// ============================================

interface VenueMeta {
  id: string;
  name: string;
  category: string | null;
}

async function fetchVenueMeta(venueId: string): Promise<VenueMeta | null> {
  if (!supabase) {
    console.warn('Supabase not configured, using mock venue meta');
    return { id: venueId, name: 'Mock Venue', category: 'bar' };
  }

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, category')
    .eq('id', venueId)
    .single();

  if (error) {
    console.error('Error fetching venue meta', error);
    return null;
  }

  return data as VenueMeta;
}

async function fetchCheckInsForVenue(
  venueId: string,
  period: InsightsPeriod
): Promise<RawCheckIn[]> {
  if (!supabase) {
    console.warn('Supabase not configured, returning empty array');
    return [];
  }

  const { from } = getDateRange(period);

  const { data, error } = await supabase
    .from('check_ins')
    .select(
      'id, venue_id, intent, created_at, relationship_status, ons_intent, gender, age_band'
    )
    .eq('venue_id', venueId)
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching check_ins for venue', error);
    return [];
  }

  return (data || []) as RawCheckIn[];
}

async function fetchCheckInsForVenuePreviousPeriod(
  venueId: string,
  period: InsightsPeriod
): Promise<RawCheckIn[]> {
  if (!supabase) {
    return [];
  }

  const days = shiftPeriod(period);
  const now = new Date();
  
  // Current period start
  const currentFrom = new Date(now);
  currentFrom.setDate(now.getDate() - days);

  // Previous period: from (now - 2*days) to (now - days)
  const prevTo = currentFrom.toISOString();
  const prevFrom = new Date(currentFrom);
  prevFrom.setDate(prevFrom.getDate() - days);

  const { data, error } = await supabase
    .from('check_ins')
    .select(
      'id, venue_id, intent, created_at, relationship_status, ons_intent, gender, age_band'
    )
    .eq('venue_id', venueId)
    .gte('created_at', prevFrom.toISOString())
    .lt('created_at', prevTo)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching previous period check_ins', error);
    return [];
  }

  return (data || []) as RawCheckIn[];
}

async function fetchAllCheckInsForPeriod(
  period: InsightsPeriod
): Promise<{ [venueId: string]: RawCheckIn[] }> {
  if (!supabase) {
    return {};
  }

  const { from } = getDateRange(period);

  const { data, error } = await supabase
    .from('check_ins')
    .select(
      'id, venue_id, intent, created_at, relationship_status, ons_intent, gender, age_band'
    )
    .gte('created_at', from)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching check_ins for area', error);
    return {};
  }

  const byVenue: { [venueId: string]: RawCheckIn[] } = {};
  (data || []).forEach((row: RawCheckIn) => {
    const vId = row.venue_id;
    if (!byVenue[vId]) byVenue[vId] = [];
    byVenue[vId].push(row);
  });

  return byVenue;
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

function buildActivitySeries(checkIns: RawCheckIn[], period: InsightsPeriod): ActivityPoint[] {
  const map = new Map<string, number>();
  
  // Initialize all dates in the period with 0
  const days = shiftPeriod(period);
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, 0);
  }

  // Count check-ins per day
  for (const ci of checkIns) {
    const d = new Date(ci.created_at);
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  const sortedKeys = Array.from(map.keys()).sort();
  return sortedKeys.map((date) => ({
    date,
    visits: map.get(date) || 0,
  }));
}

function buildIntentSeries(checkIns: RawCheckIn[], period: InsightsPeriod): IntentPoint[] {
  const map = new Map<
    string,
    { party: number; chill: number; date_night: number; with_friends: number; solo: number }
  >();

  // Initialize all dates in the period with 0
  const days = shiftPeriod(period);
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { party: 0, chill: 0, date_night: 0, with_friends: 0, solo: 0 });
  }

  // Count intents per day
  for (const ci of checkIns) {
    const d = new Date(ci.created_at);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) {
      map.set(key, { party: 0, chill: 0, date_night: 0, with_friends: 0, solo: 0 });
    }
    const bucket = map.get(key)!;
    switch (ci.intent) {
      case 'party':
        bucket.party++;
        break;
      case 'chill':
        bucket.chill++;
        break;
      case 'date_night':
        bucket.date_night++;
        break;
      case 'with_friends':
        bucket.with_friends++;
        break;
      case 'solo':
        bucket.solo++;
        break;
    }
  }

  const sortedKeys = Array.from(map.keys()).sort();
  return sortedKeys.map((date) => ({ date, ...map.get(date)! }));
}

const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '18_25': '18–25',
  '25_30': '25–30',
  '30_35': '30–35',
  '35_40': '35–40',
  '40_plus': '40+',
};

function buildAgeDistribution(checkIns: RawCheckIn[]): AgeDistribution[] {
  const counts: Record<AgeBand, number> = {
    '18_25': 0,
    '25_30': 0,
    '30_35': 0,
    '35_40': 0,
    '40_plus': 0,
  };
  let total = 0;

  for (const ci of checkIns) {
    if (ci.age_band && counts.hasOwnProperty(ci.age_band)) {
      counts[ci.age_band]++;
      total++;
    }
  }

  if (total === 0) {
    return (Object.keys(counts) as AgeBand[]).map((band) => ({
      band,
      label: AGE_BAND_LABELS[band],
      percentage: 0,
    }));
  }

  return (Object.keys(counts) as AgeBand[]).map((band) => ({
    band,
    label: AGE_BAND_LABELS[band],
    percentage: Math.round((counts[band] / total) * 100),
  }));
}

const GENDER_LABELS: Record<'male' | 'female' | 'other', string> = {
  male: 'Menn',
  female: 'Kvinner',
  other: 'Annet',
};

function buildGenderDistribution(checkIns: RawCheckIn[]): GenderDistribution[] {
  const counts: Record<'male' | 'female' | 'other', number> = {
    male: 0,
    female: 0,
    other: 0,
  };
  let total = 0;

  for (const ci of checkIns) {
    if (!ci.gender) continue;
    let key: 'male' | 'female' | 'other' = 'other';
    if (ci.gender === 'male') key = 'male';
    else if (ci.gender === 'female') key = 'female';
    counts[key]++;
    total++;
  }

  if (total === 0) {
    return (['male', 'female', 'other'] as const).map((label) => ({
      label,
      displayLabel: GENDER_LABELS[label],
      percentage: 0,
    }));
  }

  return (['male', 'female', 'other'] as const).map((label) => ({
    label,
    displayLabel: GENDER_LABELS[label],
    percentage: Math.round((counts[label] / total) * 100),
  }));
}

const RELATIONSHIP_LABELS: Record<'single' | 'in_relationship' | 'other', string> = {
  single: 'Singel',
  in_relationship: 'I forhold',
  other: 'Annet',
};

function buildRelationshipDistribution(checkIns: RawCheckIn[]): RelationshipDistribution[] {
  const counts: Record<'single' | 'in_relationship' | 'other', number> = {
    single: 0,
    in_relationship: 0,
    other: 0,
  };
  let total = 0;

  for (const ci of checkIns) {
    if (!ci.relationship_status) continue;
    let key: 'single' | 'in_relationship' | 'other' = 'other';
    if (ci.relationship_status === 'single') key = 'single';
    else if (ci.relationship_status === 'in_relationship') key = 'in_relationship';
    counts[key]++;
    total++;
  }

  if (total === 0) {
    return (['single', 'in_relationship', 'other'] as const).map((label) => ({
      label,
      displayLabel: RELATIONSHIP_LABELS[label],
      percentage: 0,
    }));
  }

  return (['single', 'in_relationship', 'other'] as const).map((label) => ({
    label,
    displayLabel: RELATIONSHIP_LABELS[label],
    percentage: Math.round((counts[label] / total) * 100),
  }));
}

// ============================================
// KPI CALCULATION
// ============================================

function calcPercentageChange(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function buildKpis(current: RawCheckIn[], previous: RawCheckIn[]): KPIData {
  const totalCurrent = current.length;
  const totalPrev = previous.length;

  // Party intent index: andel med intent 'party'
  const currentParty =
    current.filter((c) => c.intent === 'party').length / (totalCurrent || 1);
  const prevParty =
    previous.filter((c) => c.intent === 'party').length / (totalPrev || 1);

  // Single-rate
  const currentSingle =
    current.filter((c) => c.relationship_status === 'single').length /
    (totalCurrent || 1);
  const prevSingle =
    previous.filter((c) => c.relationship_status === 'single').length /
    (totalPrev || 1);

  // Aldersdominans
  const currentAge = buildAgeDistribution(current);
  const prevAge = buildAgeDistribution(previous);

  const sortedCurrentAge = [...currentAge].sort(
    (a, b) => b.percentage - a.percentage
  );
  const topCurrent = sortedCurrentAge[0];

  const prevTop = prevAge.find((a) => a.band === topCurrent?.band);
  const deltaPoints = Math.round(
    (topCurrent?.percentage || 0) - (prevTop?.percentage || 0)
  );

  return {
    totalVisits: {
      value: totalCurrent,
      deltaPct: calcPercentageChange(totalCurrent, totalPrev),
    },
    partyIntentIndex: {
      value: Math.round(currentParty * 100),
      deltaPct: calcPercentageChange(currentParty, prevParty),
    },
    singleRate: {
      value: Math.round(currentSingle * 100),
      deltaPct: calcPercentageChange(currentSingle, prevSingle),
    },
    dominantAgeBand: {
      label: topCurrent?.label || '25–30',
      deltaPoints,
    },
  };
}

// ============================================
// RANKING / COMPARISON
// ============================================

function computeScoreForMetrics(checkInsByVenue: {
  [venueId: string]: RawCheckIn[];
}): {
  activity: { [venueId: string]: number };
  party: { [venueId: string]: number };
  singles: { [venueId: string]: number };
  youth: { [venueId: string]: number };
} {
  const activity: Record<string, number> = {};
  const party: Record<string, number> = {};
  const singles: Record<string, number> = {};
  const youth: Record<string, number> = {};

  for (const [venueId, list] of Object.entries(checkInsByVenue)) {
    const total = list.length || 1;
    activity[venueId] = total;
    party[venueId] =
      list.filter((c) => c.intent === 'party').length / total;
    singles[venueId] =
      list.filter((c) => c.relationship_status === 'single').length / total;
    youth[venueId] =
      list.filter((c) => c.age_band === '18_25').length / total;
  }

  return { activity, party, singles, youth };
}

function buildRankings(
  baseVenueId: string,
  scores: {
    activity: { [venueId: string]: number };
    party: { [venueId: string]: number };
    singles: { [venueId: string]: number };
    youth: { [venueId: string]: number };
  }
): ComparisonMetric[] {
  function rankMetric(map: { [venueId: string]: number }) {
    const entries = Object.entries(map).sort(
      (a, b) => (b[1] || 0) - (a[1] || 0)
    );
    const total = entries.length;
    const index = entries.findIndex(([id]) => id === baseVenueId);
    const score = map[baseVenueId] || 0;
    return {
      rank: index >= 0 ? index + 1 : total,
      total,
      score,
    };
  }

  const activityRank = rankMetric(scores.activity);
  const partyRank = rankMetric(scores.party);
  const singleRank = rankMetric(scores.singles);
  const youthRank = rankMetric(scores.youth);

  function normalizeScore(value: number, max: number) {
    if (max === 0) return 0;
    return value / max;
  }

  const maxActivity = Math.max(...Object.values(scores.activity), 0);
  const maxParty = Math.max(...Object.values(scores.party), 0);
  const maxSingles = Math.max(...Object.values(scores.singles), 0);
  const maxYouth = Math.max(...Object.values(scores.youth), 0);

  return [
    {
      label: 'Aktivitet',
      rank: activityRank.rank,
      total: activityRank.total || 1,
      score: normalizeScore(scores.activity[baseVenueId] || 0, maxActivity),
    },
    {
      label: 'Party-intensitet',
      rank: partyRank.rank,
      total: partyRank.total || 1,
      score: normalizeScore(scores.party[baseVenueId] || 0, maxParty),
    },
    {
      label: 'Singlerate',
      rank: singleRank.rank,
      total: singleRank.total || 1,
      score: normalizeScore(scores.singles[baseVenueId] || 0, maxSingles),
    },
    {
      label: '18–25 andel',
      rank: youthRank.rank,
      total: youthRank.total || 1,
      score: normalizeScore(scores.youth[baseVenueId] || 0, maxYouth),
    },
  ];
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export async function loadInsightsData(
  venueId: string,
  period: InsightsPeriod
): Promise<InsightsData> {
  const [current, previous, allCheckIns] = await Promise.all([
    fetchCheckInsForVenue(venueId, period),
    fetchCheckInsForVenuePreviousPeriod(venueId, period),
    fetchAllCheckInsForPeriod(period),
  ]);

  const activitySeries = buildActivitySeries(current, period);
  const intentSeries = buildIntentSeries(current, period);
  const ageDistribution = buildAgeDistribution(current);
  const genderDistribution = buildGenderDistribution(current);
  const relationshipDistribution = buildRelationshipDistribution(current);
  const kpi = buildKpis(current, previous);

  const scores = computeScoreForMetrics(allCheckIns);
  const comparison = buildRankings(venueId, scores);

  return {
    kpi,
    activitySeries,
    intentSeries,
    ageDistribution,
    genderDistribution,
    relationshipDistribution,
    comparison,
  };
}

