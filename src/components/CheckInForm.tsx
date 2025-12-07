import { useState, useEffect, useMemo } from 'react';
import { MapPin, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { Venue, VibeScore, Intent, RelationshipStatus, OnsIntent, VenueCategory } from '../types';
import {
  VIBE_SCORE_LABELS,
  INTENT_LABELS,
  INTENT_OPTIONS,
  RELATIONSHIP_STATUS_LABELS,
  ONS_INTENT_LABELS,
} from '../types';
import { useProfile, type ProfileRelationshipStatus } from '../hooks/useProfile';
import { useCityVenues, VenuePoint } from '../hooks/useCityVenues';
import { useCityName } from '../hooks/useCityName';
import { getCityRadius } from '../config/cityRadius';
import { DEFAULT_CENTER } from '../config/map';
import { calculateDistanceMeters } from '../utils/geo';

// ============================================
// HELPER: Map profile relationship status to check-in relationship status
// ProfileRelationshipStatus: single, in_relationship, open_relationship, prefer_not_to_say
// RelationshipStatus: single, in_relationship, complicated, prefer_not_to_say
// ============================================
function mapProfileToCheckInRelationshipStatus(
  profileStatus: ProfileRelationshipStatus | null
): RelationshipStatus | null {
  if (!profileStatus) return null;
  
  // Map 'open_relationship' to 'complicated' (closest semantic match)
  if (profileStatus === 'open_relationship') {
    return 'complicated';
  }
  
  // Other values map directly
  return profileStatus as RelationshipStatus;
}

interface CheckInFormProps {
  venues: Venue[];
  selectedVenueId?: string;
  onSubmit: (
    venueId: string,
    vibeScore: VibeScore,
    intent: Intent,
    relationshipStatus: RelationshipStatus | null,
    onsIntent: OnsIntent | null
  ) => Promise<void>;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const VIBE_OPTIONS: VibeScore[] = ['hot', 'good', 'ok', 'quiet'];

export function CheckInForm({ venues: propsVenues, selectedVenueId, onSubmit }: CheckInFormProps) {
  const { profile, localPrefs, isLoading } = useProfile();
  
  const [venueId, setVenueId] = useState(selectedVenueId || '');
  const [vibeScore, setVibeScore] = useState<VibeScore | ''>('');
  const [intent, setIntent] = useState<Intent | ''>('');
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [onsIntent, setOnsIntent] = useState<OnsIntent | null>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  
  // ============================================
  // CITY-FILTERED VENUES (same logic as VenueList and MapView)
  // ============================================
  const gpsBasedCityName = useCityName();
  const effectiveCityName = localPrefs.favoriteCity !== 'auto' ? localPrefs.favoriteCity : gpsBasedCityName;
  const cityRadiusKm = effectiveCityName ? getCityRadius(effectiveCityName) : 10;
  
  const {
    venues: cityVenues,
    loading: venuesLoading,
    cityName: resolvedCityName,
    cityCenter,
  } = useCityVenues({
    cityName: effectiveCityName,
    userLat: DEFAULT_CENTER[1],
    userLon: DEFAULT_CENTER[0],
    radiusKm: cityRadiusKm,
    nightlifeOnly: false, // Inkluder alle venues (både overpass og google_places)
    enabled: !!effectiveCityName,
    useNearestCity: true,
    useFallback: true,
  });
  
  // Convert VenuePoint[] to Venue[] format for dropdown
  const cityFilteredVenues: Venue[] = useMemo(() => {
    return cityVenues.map((v: VenuePoint) => ({
      id: v.id,
      name: v.name,
      address: '',
      latitude: v.lat,
      longitude: v.lon,
      category: (v.category as VenueCategory) || 'bar',
      createdAt: new Date().toISOString(),
    }));
  }, [cityVenues]);

  // Filtrer propsVenues til aktiv by ved hjelp av geografisk avstand fra bysentrum
  // Dette brukes som fallback når useCityVenues ikke har data
  const fallbackCityVenues = useMemo(() => {
    // Hvis vi ikke har bysentrum-koordinater, kan vi ikke filtrere geografisk
    if (!cityCenter) {
      return propsVenues;
    }

    const radiusMeters = cityRadiusKm * 1000;
    const filtered = propsVenues.filter((venue) => {
      if (venue.latitude == null || venue.longitude == null) return false;
      const distance = calculateDistanceMeters(
        { lat: cityCenter.lat, lng: cityCenter.lon },
        { lat: venue.latitude, lng: venue.longitude }
      );
      return distance <= radiusMeters;
    });

    return filtered;
  }, [propsVenues, cityCenter, cityRadiusKm]);
  
  // ALLTID bruk geo-filtrert fallback som primær kilde (samme som VenueList)
  // Dette sikrer at ALLE venues innenfor radius vises (inkl. google_places med city_id: NULL)
  // Edge Function filtrerer på city_id, som ekskluderer google_places-venues
  const venues = useMemo(() => {
    // Hvis vi har geo-filtrerte venues, bruk dem (inkluderer alle sources)
    if (fallbackCityVenues.length > 0) {
      return fallbackCityVenues;
    }

    // Hvis vi laster og ikke har geo-data ennå, bruk API-resultater midlertidig
    if (venuesLoading && cityFilteredVenues.length > 0) {
      return cityFilteredVenues;
    }

    // Siste fallback: propsVenues (uten geo-filter)
    return propsVenues;
  }, [fallbackCityVenues, cityFilteredVenues, propsVenues, venuesLoading]);
  
  const displayCityName = resolvedCityName || effectiveCityName || 'byen';
  
  // Debug logging for sammenligning med Venues-fanen
  console.log('[Check-in]', effectiveCityName, 'geo:', fallbackCityVenues.length, 'api:', cityFilteredVenues.length, 'vises:', venues.length);

  // Sync venueId state when selectedVenueId prop changes (e.g., navigating from venue details)
  useEffect(() => {
    if (selectedVenueId) {
      setVenueId(selectedVenueId);
    }
  }, [selectedVenueId]);

  // Apply profile defaults when profile is loaded (only on initial load)
  // Priority for relationship status:
  //   1. profile.relationshipStatus (from Supabase profile)
  //   2. localPrefs.defaultRelationshipStatus (from localStorage)
  useEffect(() => {
    if (!isLoading && !defaultsApplied) {
      // Intent: use localStorage preference
      if (localPrefs.defaultIntent) {
        setIntent(localPrefs.defaultIntent);
      }
      
      // Relationship status: prefer profile over localStorage
      // This ensures the user's actual relationship status is used in check-ins
      if (profile?.relationshipStatus) {
        setRelationshipStatus(mapProfileToCheckInRelationshipStatus(profile.relationshipStatus));
      } else if (localPrefs.defaultRelationshipStatus) {
        setRelationshipStatus(localPrefs.defaultRelationshipStatus);
      }
      
      // ONS intent: use localStorage preference
      if (localPrefs.defaultOnsIntent) {
        setOnsIntent(localPrefs.defaultOnsIntent);
      }
      
      setDefaultsApplied(true);
    }
  }, [isLoading, profile, localPrefs, defaultsApplied]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!venueId || !vibeScore || !intent) return;

    setFormState('submitting');
    setErrorMessage(null);

    try {
      await onSubmit(venueId, vibeScore, intent, relationshipStatus, onsIntent);
      setFormState('success');

      // Reset form after success (but keep profile defaults for next time)
      setTimeout(() => {
        setVenueId('');
        setVibeScore('');
        // Re-apply profile defaults after reset
        // Priority: profile.relationshipStatus > localPrefs.defaultRelationshipStatus
        setIntent(localPrefs.defaultIntent || '');
        setRelationshipStatus(
          profile?.relationshipStatus
            ? mapProfileToCheckInRelationshipStatus(profile.relationshipStatus)
            : localPrefs.defaultRelationshipStatus
        );
        setOnsIntent(localPrefs.defaultOnsIntent);
        setFormState('idle');
      }, 2000);
    } catch (err) {
      setFormState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const isValid = venueId && vibeScore && intent;

  // Success state
  if (formState === 'success') {
    return (
      <div className="flex-1 flex items-center justify-center px-4 sm:px-0">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 sm:p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="mx-auto text-green-400 mb-4 sm:w-16 sm:h-16" />
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Check-in Submitted!</h2>
          <p className="text-slate-400 text-sm sm:text-base">Thanks for sharing the vibe! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col sm:items-start sm:justify-center py-4 overflow-y-auto">
      <div className="bg-slate-800 sm:rounded-2xl border-y sm:border border-slate-700 p-4 sm:p-6 sm:max-w-md w-full mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Check In</h2>
        <p className="text-slate-400 text-sm mb-5 sm:mb-6">Share the vibe at your current spot</p>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-5">
          {/* Venue Selection - uses city-filtered venues */}
          <div>
            <label htmlFor="venue" className="block text-sm sm:text-sm font-medium text-slate-300 mb-2">
              <MapPin size={16} className="inline mr-1.5 -mt-0.5" />
              Hvor er du? <span className="text-slate-500 font-normal">({displayCityName})</span>
            </label>
            {venuesLoading && cityFilteredVenues.length === 0 ? (
              <div className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-slate-400 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Laster utesteder i {displayCityName}...
              </div>
            ) : (
              <select
                id="venue"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                disabled={formState === 'submitting'}
                className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
              >
                <option value="">Velg et utested ({venues.length} i {displayCityName})</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Vibe Score Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              What's the vibe?
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {VIBE_OPTIONS.map((vibe) => (
                <button
                  key={vibe}
                  type="button"
                  onClick={() => setVibeScore(vibe)}
                  disabled={formState === 'submitting'}
                  className={`min-h-[48px] py-3.5 sm:py-3 px-4 rounded-xl border-2 font-medium text-base transition-all active:scale-[0.98] ${
                    vibeScore === vibe
                      ? 'border-violet-500 bg-violet-500/20 ring-2 ring-violet-500/30'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  } ${formState === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={vibeScore === vibe ? 'text-violet-300' : 'text-slate-300'}>
                    {VIBE_SCORE_LABELS[vibe]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Intent Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              What are you looking for tonight?
            </label>
            <div className="flex flex-wrap gap-2.5 sm:gap-2">
              {INTENT_OPTIONS.map((intentOption) => (
                <button
                  key={intentOption}
                  type="button"
                  onClick={() => setIntent(intentOption)}
                  disabled={formState === 'submitting'}
                  className={`min-h-[40px] py-2.5 sm:py-2 px-4 sm:px-3 rounded-full border font-medium text-sm transition-all active:scale-[0.97] ${
                    intent === intentOption
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                      : 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  } ${formState === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {INTENT_LABELS[intentOption]}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 pt-5 sm:pt-4">
            <p className="text-xs text-slate-500 mb-4">Valgfrie felt – hjelper andre finne riktig sted</p>
          </div>

          {/* Relationship Status (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sivilstatus (valgfritt)
            </label>
            <select
              value={relationshipStatus ?? ''}
              onChange={(e) =>
                setRelationshipStatus(
                  e.target.value === '' ? null : (e.target.value as RelationshipStatus)
                )
              }
              disabled={formState === 'submitting'}
              className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="">Ikke valgt</option>
              <option value="single">{RELATIONSHIP_STATUS_LABELS.single}</option>
              <option value="in_relationship">{RELATIONSHIP_STATUS_LABELS.in_relationship}</option>
              <option value="complicated">{RELATIONSHIP_STATUS_LABELS.complicated}</option>
              <option value="prefer_not_to_say">{RELATIONSHIP_STATUS_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* ONS Intent (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              👉👌 ONS? (valgfritt)
            </label>
            <select
              value={onsIntent ?? ''}
              onChange={(e) =>
                setOnsIntent(
                  e.target.value === '' ? null : (e.target.value as OnsIntent)
                )
              }
              disabled={formState === 'submitting'}
              className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="">Ikke valgt</option>
              <option value="open">{ONS_INTENT_LABELS.open}</option>
              <option value="maybe">{ONS_INTENT_LABELS.maybe}</option>
              <option value="not_interested">{ONS_INTENT_LABELS.not_interested}</option>
              <option value="prefer_not_to_say">{ONS_INTENT_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* Error Message */}
          {formState === 'error' && errorMessage && (
            <div className="flex items-center gap-2 p-3.5 sm:p-3 bg-red-500/20 border border-red-500/50 rounded-xl sm:rounded-lg text-red-300">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 sm:pt-0">
            <button
              type="submit"
              disabled={!isValid || formState === 'submitting'}
              className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white px-6 py-4 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[52px] sm:min-h-0"
            >
              {formState === 'submitting' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit Check-in
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info text */}
        <p className="text-center text-xs text-slate-500 mt-4 pb-2 sm:pb-0">
          Alle check-ins er anonyme og hjelper andre finne beste viben i kveld.
        </p>
      </div>
    </div>
  );
}
