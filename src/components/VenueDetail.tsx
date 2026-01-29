import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Users, Zap, Clock, Plus, TrendingUp, Heart, Flame, Sparkles, Navigation, DoorOpen } from 'lucide-react';
import type { Venue, CheckIn, VibeScore, Intent } from '../types';
import {
  VIBE_SCORE_LABELS,
  VIBE_SCORE_COLORS,
  VENUE_CATEGORY_LABELS,
  INTENT_LABELS,
  INTENT_OPTIONS,
} from '../types';
import { getPeakTimesForVenue, type PeakHour } from '../api';
import { calculateDemographics, AGE_BAND_LABELS, calculateVenueStats, calculateIntentDistribution, INTENT_BADGE_LABELS } from '../utils/venueStats';
import type { AgeBand } from '../hooks/useProfile';

interface VenueDetailProps {
  venue: Venue;
  checkIns: CheckIn[];
  onBack: () => void;
  onCheckIn: () => void;
  canCheckIn?: boolean;         // Whether user can check in (cooldown passed)
  nextCheckInTime?: string;     // When user can check in again (e.g., "14:30")
  onNavigate?: () => void;      // Callback to start navigation to this venue
  onOpenVenueRoom?: () => void; // Callback to open the Venue Room
}

// Day names for peak times display
const DAY_NAMES: Record<number, string> = {
  0: 'søndager',
  1: 'mandager',
  2: 'tirsdager',
  3: 'onsdager',
  4: 'torsdager',
  5: 'fredager',
  6: 'lørdager',
};

// All age bands in order (from single source of truth)
import { AGE_RANGES } from '../constants/ageRanges';
const AGE_BANDS_ORDER = AGE_RANGES;

// Summarize peak times data into human-readable text
function summarizePeakTimes(peakData: PeakHour[]): string {
  if (!peakData.length) {
    return 'Lite historikk på dette stedet ennå.';
  }

  // Focus on weekend (Friday = 5, Saturday = 6)
  const weekend = peakData.filter((p) => p.dow === 5 || p.dow === 6);
  const base = weekend.length ? weekend : peakData;

  if (base.length === 0) {
    return 'Lite historikk på dette stedet ennå.';
  }

  // Sort by check-in count descending
  const sorted = [...base].sort((a, b) => b.checkinCount - a.checkinCount);
  const top = sorted[0];

  if (top.checkinCount < 2) {
    return 'Lite historikk på dette stedet ennå.';
  }

  const startHour = top.hour;
  const endHour = (top.hour + 2) % 24;
  const dayName = DAY_NAMES[top.dow] || '';

  // Format hours nicely
  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}:00`;

  if (weekend.length > 0) {
    return `Mest trøkk vanligvis rundt kl ${formatHour(startHour)}–${formatHour(endHour)} i helgene`;
  }

  return `Mest trøkk vanligvis rundt kl ${formatHour(startHour)}–${formatHour(endHour)} på ${dayName}`;
}

export function VenueDetail({ 
  venue, 
  checkIns, 
  onBack, 
  onCheckIn,
  canCheckIn = true,
  nextCheckInTime,
  onNavigate,
  onOpenVenueRoom,
}: VenueDetailProps) {
  const [peakTimes, setPeakTimes] = useState<PeakHour[]>([]);
  const [peakTimesLoading, setPeakTimesLoading] = useState(true);
  const [peakTimesError, setPeakTimesError] = useState<string | null>(null);

  // Fetch peak times on mount
  useEffect(() => {
    async function fetchPeakTimes() {
      setPeakTimesLoading(true);
      const result = await getPeakTimesForVenue(venue.id);
      
      if (result.error) {
        setPeakTimesError(result.error);
        console.error('Peak times error:', result.error);
      } else {
        setPeakTimes(result.data || []);
      }
      setPeakTimesLoading(false);
    }

    fetchPeakTimes();
  }, [venue.id]);

  // Calculate vibe distribution
  const vibeDistribution = useMemo(() => {
    const counts: Record<VibeScore, number> = {
      hot: 0,
      good: 0,
      ok: 0,
      quiet: 0,
    };

    checkIns.forEach((c) => {
      counts[c.vibeScore]++;
    });

    return counts;
  }, [checkIns]);

  // Get dominant vibe
  const dominantVibe = useMemo<VibeScore | null>(() => {
    if (checkIns.length === 0) return null;

    const entries = Object.entries(vibeDistribution) as [VibeScore, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : null;
  }, [vibeDistribution, checkIns.length]);

  // Calculate demographics
  const demographics = useMemo(() => {
    return calculateDemographics(checkIns);
  }, [checkIns]);

  // Calculate intent distribution
  const intentDistribution = useMemo(() => {
    return calculateIntentDistribution(checkIns);
  }, [checkIns]);

  // Calculate venue stats (for single/ONS ratios)
  const venueStats = useMemo(() => {
    return calculateVenueStats(checkIns);
  }, [checkIns]);

  // Sort check-ins by timestamp (most recent first)
  const recentCheckIns = useMemo(() => {
    return [...checkIns]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [checkIns]);

  // Format time ago
  const getTimeAgo = (timestamp: string): string => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return 'akkurat nå';
    if (minutes === 1) return '1 min siden';
    if (minutes < 60) return `${minutes} min siden`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 time siden' : `${hours} timer siden`;
  };

  // Peak times summary text
  const peakSummaryText = useMemo(() => {
    if (peakTimesLoading) return 'Laster...';
    if (peakTimesError) return 'Kunne ikke hente historikk ennå.';
    return summarizePeakTimes(peakTimes);
  }, [peakTimes, peakTimesLoading, peakTimesError]);

  // Check if we have enough data for demographics
  const hasEnoughDemographicsData = checkIns.length >= 3 && (demographics.totalGenderResponses >= 2 || demographics.totalAgeResponses >= 2);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-800 border-b border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>

          {canCheckIn ? (
            <button
              onClick={onCheckIn}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={18} />
              Check In
            </button>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-700/50 px-3 py-2 rounded-lg">
              <Clock size={16} />
              <span>Du er nå sjekket inn her. Ny innsjekk på dette stedet mulig kl. {nextCheckInTime}.</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Venue Header */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-violet-400 uppercase tracking-wider">
                {VENUE_CATEGORY_LABELS[venue.category]}
              </span>
              <h1 className="text-3xl font-bold text-white mt-1">{venue.name}</h1>
              <div className="flex items-center gap-2 text-slate-400 mt-2">
                <MapPin size={16} />
                <span>{venue.address}</span>
              </div>
              
              {/* Navigation button */}
              {onNavigate && venue.latitude && venue.longitude && (
                <button
                  onClick={onNavigate}
                  className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Navigation size={18} />
                  Ta meg hit
                </button>
              )}
              
              {/* Venue Room button */}
              {onOpenVenueRoom && (
                <button
                  onClick={onOpenVenueRoom}
                  className="mt-3 flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <DoorOpen size={18} />
                  Åpne Venue Room
                </button>
              )}
            </div>

            {/* Activity badge */}
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-2 ${
                checkIns.length >= 8
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : checkIns.length >= 5
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : checkIns.length >= 2
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                  : checkIns.length > 0
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'bg-slate-700 border-slate-600 text-slate-500'
              }`}
            >
              {checkIns.length}
            </div>
          </div>

          {/* Dominant vibe banner */}
          {dominantVibe && (
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full ${VIBE_SCORE_COLORS[dominantVibe]}`}>
              <Zap size={16} />
              <span className="font-semibold">Vibe nå: {VIBE_SCORE_LABELS[dominantVibe]}</span>
            </div>
          )}

          {/* Single and ONS stats badges */}
          {(venueStats.singleRatio !== null || venueStats.onsRatio !== null) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {venueStats.singleRatio !== null && (
                <div className="inline-flex items-center gap-1 rounded-full bg-pink-500/20 border border-pink-500/30 px-3 py-1.5 text-xs text-pink-200 font-medium">
                  <Heart size={12} />
                  <span>{Math.round(venueStats.singleRatio * 100)}% single</span>
                </div>
              )}
              {venueStats.onsRatio !== null && (
                <div className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/30 px-3 py-1.5 text-xs text-orange-200 font-medium">
                  <Flame size={12} />
                  <span>{Math.round(venueStats.onsRatio * 100)}% åpne for ONS</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Peak Times Section */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Peak times</h3>
          </div>
          <p className="text-sm text-slate-300">
            {peakSummaryText}
          </p>
        </div>

        {/* Intent Distribution Section */}
        {checkIns.length >= 2 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-emerald-400" />
              Stemning akkurat nå
            </h2>
            
            {intentDistribution.dominantIntent ? (
              <div className="space-y-4">
                {/* Dominant intent highlight */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 text-center">
                  <p className="text-emerald-300 text-lg font-semibold">
                    {INTENT_BADGE_LABELS[intentDistribution.dominantIntent]}
                  </p>
                  <p className="text-emerald-400/80 text-sm mt-1">
                    {intentDistribution.dominantPct}% av gjestene
                  </p>
                </div>

                {/* Intent breakdown */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-400">Stemningsfordeling</h3>
                  {INTENT_OPTIONS.map((intent) => {
                    const pct = intentDistribution[intent];
                    if (pct === 0) return null;
                    return (
                      <div key={intent} className="flex items-center gap-3">
                        <span className="text-sm text-slate-300 w-24">{INTENT_LABELS[intent]}</span>
                        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all" 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-400 w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Basert på {intentDistribution.total} check-ins
                </p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-2">
                For lite data til å vise stemning ennå.
              </p>
            )}
          </div>
        )}

        {/* Demographics Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-violet-400" />
            Demografi (basert på valgt tidsvindu)
          </h2>
          
          {hasEnoughDemographicsData ? (
            <div className="space-y-5">
              {/* Gender distribution */}
              {demographics.totalGenderResponses >= 2 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Gender distribution</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Women */}
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
                      <div className="text-2xl mb-1">👩</div>
                      <div className="text-xl font-bold text-pink-300">{demographics.femalePct}%</div>
                      <div className="text-xs text-slate-400">kvinner</div>
                    </div>
                    {/* Men */}
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
                      <div className="text-2xl mb-1">👨</div>
                      <div className="text-xl font-bold text-blue-300">{demographics.malePct}%</div>
                      <div className="text-xs text-slate-400">menn</div>
                    </div>
                    {/* Other */}
                    <div className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700">
                      <div className="text-2xl mb-1">⚧</div>
                      <div className="text-xl font-bold text-violet-300">{demographics.otherPct}%</div>
                      <div className="text-xs text-slate-400">annet</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Basert på {demographics.totalGenderResponses} svar
                  </p>
                </div>
              )}

              {/* Age distribution */}
              {demographics.totalAgeResponses >= 2 && (
                <div className="pt-4 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Aldersfordeling</h3>
                  <div className="flex flex-wrap gap-2">
                    {AGE_BANDS_ORDER.map((band) => {
                      const pct = demographics.ageBandPct[band];
                      const isHighest = band === demographics.mostCommonAgeBand;
                      
                      return (
                        <div
                          key={band}
                          className={`px-3 py-2 rounded-lg text-center ${
                            isHighest 
                              ? 'bg-violet-500/20 border-2 border-violet-500' 
                              : 'bg-slate-900/50 border border-slate-700'
                          }`}
                        >
                          <div className={`text-lg font-bold ${isHighest ? 'text-violet-300' : 'text-slate-300'}`}>
                            {pct}%
                          </div>
                          <div className={`text-xs ${isHighest ? 'text-violet-400' : 'text-slate-500'}`}>
                            {AGE_BAND_LABELS[band]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {demographics.mostCommonAgeBand && (
                    <p className="text-xs text-slate-400 mt-3">
                      📊 Most common age group: <span className="text-violet-300 font-medium">{AGE_BAND_LABELS[demographics.mostCommonAgeBand]}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">
                    Basert på {demographics.totalAgeResponses} svar
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">
                For lite data til å vise demografi ennå.
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Trenger minst 3 check-ins med demografiinfo.
              </p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Check-ins */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Users size={18} />
              <span className="text-sm font-medium">Check-ins</span>
            </div>
            <div className="text-3xl font-bold text-white">{checkIns.length}</div>
            <div className="text-xs text-slate-500 mt-1">i valgt tidsvindu</div>
          </div>

          {/* Last Activity */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Clock size={18} />
              <span className="text-sm font-medium">Siste aktivitet</span>
            </div>
            <div className="text-lg font-bold text-white">
              {recentCheckIns.length > 0 ? getTimeAgo(recentCheckIns[0].timestamp) : 'Ingen'}
            </div>
          </div>
        </div>

        {/* Vibe Distribution */}
        {checkIns.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Vibe-fordeling</h2>
            <div className="space-y-3">
              {(Object.entries(vibeDistribution) as [VibeScore, number][])
                .filter(([_, count]) => count > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([vibe, count]) => {
                  const percentage = Math.round((count / checkIns.length) * 100);
                  return (
                    <div key={vibe} className="flex items-center gap-3">
                      <span className={`text-sm font-medium w-24 ${VIBE_SCORE_COLORS[vibe]} px-2 py-1 rounded text-center`}>
                        {VIBE_SCORE_LABELS[vibe]}
                      </span>
                      <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-400 w-16 text-right">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Recent Check-ins */}
        {recentCheckIns.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Siste check-ins ({recentCheckIns.length})
            </h2>
            <div className="space-y-3">
              {recentCheckIns.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between py-3 border-b border-slate-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${VIBE_SCORE_COLORS[checkIn.vibeScore]}`}>
                      {VIBE_SCORE_LABELS[checkIn.vibeScore]}
                    </span>
                    <span className="text-sm text-slate-500">
                      {INTENT_LABELS[checkIn.intent]}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">{getTimeAgo(checkIn.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {checkIns.length === 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
            <Users size={48} className="mx-auto text-slate-600 mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Ingen aktivitet</h3>
            <p className="text-slate-400 mb-4">Vær den første som sjekker inn og deler viben!</p>
            {canCheckIn ? (
              <button
                onClick={onCheckIn}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <Plus size={18} />
                Check In nå
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 text-slate-400 text-sm bg-slate-700/50 px-4 py-3 rounded-lg">
                <Clock size={16} />
                <span>Du er nå sjekket inn her. Ny innsjekk på dette stedet mulig kl. {nextCheckInTime}.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
