import { useMemo, useState, useEffect } from 'react';
import { MapPin, TrendingUp, Users, Heart, Flame, Zap, Calendar, Sparkles, Search, X, Loader2 } from 'lucide-react';
import type { Venue, CheckIn, TimeWindow, HeatmapMode, Intent, VenueCategory } from '../types';
import { VIBE_SCORE_LABELS, VIBE_SCORE_COLORS, VENUE_CATEGORY_LABELS, INTENT_SHORT_LABELS } from '../types';
import { 
  calculateAllVenueStats, 
  sortVenuesByMode, 
  AGE_BAND_LABELS, 
  getCombinedAgeBandPercentage,
  getCombinedIntentPercentage,
  INTENT_BADGE_LABELS,
  type SortMode 
} from '../utils/venueStats';
import { useProfile, type AgeBand } from '../hooks/useProfile';
import { getAgeBandFromBirthYear } from '../utils/age';
import { useCityVenues, VenuePoint } from '../hooks/useCityVenues';
import { useCityName } from '../hooks/useCityName';
import { getCityRadius } from '../config/cityRadius';
import { DEFAULT_CENTER } from '../config/map';
import { calculateDistanceMeters } from '../utils/geo';

interface VenueListProps {
  venues: Venue[]; // Legacy prop, used as fallback
  checkIns: CheckIn[];
  timeWindowMinutes: TimeWindow;
  heatmapMode: HeatmapMode;
  activeAgeBands: AgeBand[];
  activeIntents: Intent[];
  onVenueClick: (venueId: string) => void;
}

export function VenueList({ 
  venues: propsVenues, 
  checkIns, 
  timeWindowMinutes, 
  heatmapMode, 
  activeAgeBands, 
  activeIntents, 
  onVenueClick 
}: VenueListProps) {
  const { profile, localPrefs } = useProfile();
  const [localSortMode, setLocalSortMode] = useState<'sync' | 'age' | 'intent'>('sync');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // User position for venue fetching
  const [userPosition, setUserPosition] = useState<{ lat: number; lon: number } | null>(null);
  
  // Get city name from GPS (reverse geocoding)
  const gpsBasedCityName = useCityName();
  
  // Determine effective city name (same logic as MapView)
  const effectiveCityName = localPrefs.favoriteCity !== 'auto' ? localPrefs.favoriteCity : gpsBasedCityName;
  
  // Calculate appropriate radius for the city
  const cityRadiusKm = effectiveCityName ? getCityRadius(effectiveCityName) : 10;
  
  // Get user position on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          // Fallback to default center
          setUserPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
        }
      );
    } else {
      setUserPosition({ lat: DEFAULT_CENTER[1], lon: DEFAULT_CENTER[0] });
    }
  }, []);
  
  // Fetch venues for the active city using the same hook as MapView
  // Note: We use DEFAULT_CENTER as fallback so we don't need to wait for userPosition
  const {
    venues: cityVenues,
    loading: venuesLoading,
    error: venuesError,
    cityId: resolvedCityId,
    cityName: resolvedCityName,
    cityCenter,
    usingFallback,
    detectedCityName,
  } = useCityVenues({
    cityName: effectiveCityName,
    userLat: userPosition?.lat ?? DEFAULT_CENTER[1],
    userLon: userPosition?.lon ?? DEFAULT_CENTER[0],
    radiusKm: cityRadiusKm,
    nightlifeOnly: false, // Inkluder alle venues (både overpass og google_places)
    // Don't require userPosition - we have DEFAULT_CENTER as fallback
    enabled: !!effectiveCityName,
    useNearestCity: true,
    useFallback: true,
  });
  
  // DEBUG: Log city resolution
  useEffect(() => {
    console.log("[VenueList] effectiveCityName:", effectiveCityName);
    console.log("[VenueList] resolvedCityId:", resolvedCityId);
    console.log("[VenueList] resolvedCityName:", resolvedCityName);
    console.log("[VenueList] cityVenues count:", cityVenues.length);
    console.log("[VenueList] localPrefs.favoriteCity:", localPrefs.favoriteCity);
  }, [effectiveCityName, resolvedCityId, resolvedCityName, cityVenues.length, localPrefs.favoriteCity]);
  
  // Convert VenuePoint[] to Venue[] format
  const convertedCityVenues: Venue[] = useMemo(() => {
    return cityVenues.map((v: VenuePoint) => ({
      id: v.id,
      name: v.name,
      address: '', // Not available from edge function
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
      console.log('[Venues] Ingen cityCenter, kan ikke filtrere fallback geografisk');
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

    console.log('[Venues] fallbackCityVenues:', filtered.length, 'av', propsVenues.length, 'innenfor', cityRadiusKm, 'km fra', effectiveCityName);
    return filtered;
  }, [propsVenues, cityCenter, cityRadiusKm, effectiveCityName]);
  
  // ALLTID bruk geo-filtrert fallback som primær kilde
  // Dette sikrer at ALLE venues innenfor radius vises (inkl. google_places med city_id: NULL)
  // Edge Function filtrerer på city_id, som ekskluderer google_places-venues
  const venues = useMemo(() => {
    // Hvis vi har geo-filtrerte venues, bruk dem (inkluderer alle sources)
    if (fallbackCityVenues.length > 0) {
      console.log('[Venues] Bruker', fallbackCityVenues.length, 'geo-filtrerte venues for', effectiveCityName);
      return fallbackCityVenues;
    }

    // Hvis vi laster og ikke har geo-data ennå, bruk API-resultater midlertidig
    if (venuesLoading && convertedCityVenues.length > 0) {
      console.log('[Venues] Laster geo... midlertidig API-venues:', convertedCityVenues.length);
      return convertedCityVenues;
    }

    // Siste fallback: propsVenues (uten geo-filter)
    console.log('[Venues] Ingen geo-data, bruker propsVenues:', propsVenues.length);
    return propsVenues;
  }, [fallbackCityVenues, convertedCityVenues, propsVenues, venuesLoading, effectiveCityName]);

  // Debug logging for sammenligning med CheckIn
  console.log('[Venues fanen]', effectiveCityName, 'geo:', fallbackCityVenues.length, 'api:', convertedCityVenues.length, 'vises:', venues.length);
  
  // Filter venues by search query
  const searchFilteredVenues = useMemo(() => {
    if (!searchQuery.trim()) {
      return venues;
    }
    
    const normalizedQuery = searchQuery.toLowerCase().trim();
    return venues.filter(venue => 
      venue.name.toLowerCase().includes(normalizedQuery)
    );
  }, [venues, searchQuery]);
  
  // Get user's age band from profile
  const userAgeBand = useMemo(() => {
    return getAgeBandFromBirthYear(profile?.birthYear ?? null);
  }, [profile?.birthYear]);

  // Determine target age bands for sorting
  const targetAgeBands = useMemo((): AgeBand[] => {
    if (activeAgeBands.length > 0) {
      return activeAgeBands;
    }
    if (userAgeBand) {
      return [userAgeBand];
    }
    return ['25_30'];
  }, [activeAgeBands, userAgeBand]);

  // Calculate stats for all venues using shared utility
  const venuesWithStats = useMemo(() => {
    return calculateAllVenueStats(searchFilteredVenues, checkIns);
  }, [searchFilteredVenues, checkIns]);

  // Determine actual sort mode
  const actualSortMode: SortMode = localSortMode === 'age' ? 'age' : localSortMode === 'intent' ? 'intent' : heatmapMode;

  // Sort venues based on current sort mode
  const sortedVenues = useMemo(() => {
    return sortVenuesByMode(venuesWithStats, actualSortMode, targetAgeBands, activeIntents);
  }, [venuesWithStats, actualSortMode, targetAgeBands, activeIntents]);

  // Check if we have no results after filtering
  const hasNoResults = checkIns.length === 0;
  
  // Display name for the city
  const displayCityName = resolvedCityName || effectiveCityName || 'byen';

  // Loading state
  if (venuesLoading && cityVenues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700">
        <div className="text-center p-8">
          <Loader2 size={48} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-slate-300 text-lg font-medium">Laster utesteder i {displayCityName}...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (venuesError && venues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700">
        <div className="text-center p-8">
          <Users size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-slate-300 text-lg font-medium">Kunne ikke laste utesteder</p>
          <p className="text-slate-500 text-sm mt-2">{venuesError}</p>
        </div>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700">
        <div className="text-center p-8">
          <Users size={48} className="mx-auto text-slate-500 mb-4" />
          <p className="text-slate-300 text-lg font-medium">Ingen steder i {displayCityName}</p>
          <p className="text-slate-500 text-sm mt-2">Prøv en annen by eller kom tilbake senere</p>
        </div>
      </div>
    );
  }

  const timeLabel = timeWindowMinutes === 60 ? '1 time' : `${timeWindowMinutes / 60} timer`;

  // Get current sort mode label
  const getSortModeLabel = () => {
    if (localSortMode === 'age') {
      return '📅 Alder';
    }
    if (localSortMode === 'intent') {
      return '✨ Stemning';
    }
    switch (heatmapMode) {
      case 'single': return '💘 Single';
      case 'ons': return '🔥 ONS';
      case 'ons_boost': return '🚀 ONS Boost';
      default: return '📊 Aktivitet';
    }
  };

  // Get age band labels for display
  const getAgeBandLabelsText = () => {
    return targetAgeBands.map(band => AGE_BAND_LABELS[band]).join(', ');
  };

  // Get intent labels for display
  const getIntentLabelsText = () => {
    return activeIntents.map(intent => INTENT_SHORT_LABELS[intent]).join(', ');
  };

  // Get sorting info text
  const getSortingInfoText = () => {
    if (localSortMode === 'intent') {
      if (activeIntents.length > 0) {
        return `Sorterer etter steder med flest gjester i valgt stemning (${getIntentLabelsText()})`;
      }
      return 'Sorterer etter steder med sterkest dominerende stemning';
    }
    if (localSortMode === 'age') {
      if (activeAgeBands.length > 0) {
        return `Sorterer etter steder med flest gjester i valgt aldersgruppe (${getAgeBandLabelsText()})`;
      }
      if (userAgeBand) {
        return `Sorterer etter steder med flest gjester i din aldersgruppe (${AGE_BAND_LABELS[userAgeBand]})`;
      }
    }
    return '';
  };

  return (
    <div className="flex-1 space-y-3">
      {/* City header with fallback info */}
      <div className="bg-gradient-to-r from-violet-900/30 to-slate-800 rounded-lg border border-violet-700/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-violet-400" />
            <span className="text-white font-medium">{displayCityName}</span>
            {usingFallback && detectedCityName && (
              <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">
                Fallback fra {detectedCityName}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            {venues.length} utesteder
          </span>
        </div>
      </div>
      
      {/* Search field */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Søk etter utested..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* Search results info */}
      {searchQuery && (
        <div className="text-sm text-slate-400 px-1">
          {searchFilteredVenues.length === 0 ? (
            <span className="text-amber-400">Ingen utesteder matcher "{searchQuery}"</span>
          ) : (
            <span>Viser {searchFilteredVenues.length} av {venues.length} utesteder</span>
          )}
        </div>
      )}
      
      {/* No search results message */}
      {searchQuery && searchFilteredVenues.length === 0 && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
          <Search size={32} className="mx-auto text-slate-500 mb-3" />
          <p className="text-slate-300 font-medium">Ingen utesteder matcher søket ditt</p>
          <p className="text-slate-500 text-sm mt-1">
            Prøv å søke etter noe annet eller tøm søkefeltet
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
          >
            Vis alle utesteder
          </button>
        </div>
      )}
      
      {/* Only show stats and list if we have results */}
      {searchFilteredVenues.length > 0 && (
        <>
          {/* Stats summary */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 space-y-3">
            {/* Stats row */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                <strong className="text-white">{searchFilteredVenues.length}</strong> venues
              </span>
              <span className="text-slate-400">
                <strong className="text-white">
                  {sortedVenues.filter((v) => v.checkInCount > 0).length}
                </strong>{' '}
                aktive nå
              </span>
              <span className="text-slate-400">
                <strong className="text-white">{checkIns.length}</strong> check-ins ({timeLabel})
              </span>
            </div>

            {/* Sort mode controls */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700">
              <span className="text-xs text-slate-500">Sorter:</span>
              
              {/* Sync with heatmap button */}
              <button
                onClick={() => setLocalSortMode('sync')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  localSortMode === 'sync'
                    ? heatmapMode === 'activity' ? 'bg-violet-500/20 text-violet-300 border border-violet-500' :
                      heatmapMode === 'single' ? 'bg-pink-500/20 text-pink-300 border border-pink-500' :
                      heatmapMode === 'ons' ? 'bg-orange-500/20 text-orange-300 border border-orange-500' :
                      'bg-red-500/20 text-red-300 border border-red-500'
                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                {localSortMode === 'sync' ? getSortModeLabel() : '📊 Modus'}
              </button>
              
              {/* Intent sort button */}
              <button
                onClick={() => setLocalSortMode('intent')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  localSortMode === 'intent'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500'
                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                <Sparkles size={12} />
                Stemning
              </button>
              
              {/* Age sort button */}
              <button
                onClick={() => setLocalSortMode('age')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  localSortMode === 'age'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500'
                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                }`}
              >
                <Calendar size={12} />
                Alder
              </button>
            </div>

            {/* Sorting info */}
            {(localSortMode === 'age' || localSortMode === 'intent') && (
              <div className={`text-xs rounded-lg px-3 py-2 border ${
                localSortMode === 'intent' 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
              }`}>
                {getSortingInfoText()}
              </div>
            )}
          </div>

          {/* No results message */}
          {hasNoResults && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
              <Users size={32} className="mx-auto text-slate-500 mb-3" />
              <p className="text-slate-300 font-medium">Ingen data for valgt filter</p>
              <p className="text-slate-500 text-sm mt-1">
                Prøv å fjerne noen filtre eller endre tidsvindu
              </p>
            </div>
          )}

          {/* Venue cards */}
          {sortedVenues.map((venue, index) => (
            <button
              key={venue.id}
              onClick={() => onVenueClick(venue.id)}
              className="w-full bg-slate-800 rounded-lg transition-all duration-200 p-4 text-left border border-slate-700 hover:border-violet-500/50 hover:bg-slate-750 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Venue name with ranking */}
                  <div className="flex items-center gap-2 mb-1">
                    {index < 3 && venue.checkInCount > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        localSortMode === 'intent' ? (
                          index === 0 ? 'bg-emerald-500/20 text-emerald-400' :
                          index === 1 ? 'bg-emerald-400/20 text-emerald-300' :
                          'bg-emerald-300/20 text-emerald-200'
                        ) :
                        localSortMode === 'age' ? (
                          index === 0 ? 'bg-cyan-500/20 text-cyan-400' :
                          index === 1 ? 'bg-cyan-400/20 text-cyan-300' :
                          'bg-cyan-300/20 text-cyan-200'
                        ) :
                        heatmapMode === 'ons_boost' ? (
                          index === 0 ? 'bg-red-500/20 text-red-400' :
                          index === 1 ? 'bg-red-400/20 text-red-300' :
                          'bg-red-300/20 text-red-200'
                        ) :
                        heatmapMode === 'ons' ? (
                          index === 0 ? 'bg-orange-500/20 text-orange-400' :
                          index === 1 ? 'bg-orange-400/20 text-orange-300' :
                          'bg-orange-300/20 text-orange-200'
                        ) :
                        heatmapMode === 'single' ? (
                          index === 0 ? 'bg-pink-500/20 text-pink-400' :
                          index === 1 ? 'bg-pink-400/20 text-pink-300' :
                          'bg-pink-300/20 text-pink-200'
                        ) : (
                          index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                          index === 1 ? 'bg-slate-400/20 text-slate-300' :
                          'bg-amber-700/20 text-amber-500'
                        )
                      }`}>
                        #{index + 1}
                      </span>
                    )}
                    <h3 className="font-semibold text-white text-lg truncate group-hover:text-violet-300 transition-colors">
                      {venue.name}
                    </h3>
                    {venue.checkInCount > 0 && (
                      <TrendingUp size={16} className="text-green-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Address and category */}
                  <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                    <MapPin size={14} />
                    <span className="truncate">{venue.address || displayCityName}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-500">{VENUE_CATEGORY_LABELS[venue.category]}</span>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Dominant vibe */}
                    {venue.dominantVibe && (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${VIBE_SCORE_COLORS[venue.dominantVibe]}`}>
                        {VIBE_SCORE_LABELS[venue.dominantVibe]}
                      </span>
                    )}

                    {/* Dominant intent badge */}
                    {venue.intentDistribution.dominantIntent && venue.intentDistribution.dominantPct >= 30 && (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {INTENT_BADGE_LABELS[venue.intentDistribution.dominantIntent]} {venue.intentDistribution.dominantPct}%
                      </span>
                    )}

                    {/* Check-in count */}
                    {venue.checkInCount > 0 ? (
                      <span className="text-xs text-slate-400">
                        {venue.checkInCount} check-in{venue.checkInCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Ingen aktivitet</span>
                    )}

                    {/* Boost score (only in ons_boost mode) */}
                    {localSortMode === 'sync' && heatmapMode === 'ons_boost' && venue.boostScore > 0 && (
                      <span className="text-xs text-red-300 flex items-center gap-1">
                        <Zap size={12} />
                        Boost: {venue.boostScore.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* Intent distribution - show when sorting by intent or when intents are filtered */}
                  {venue.checkInCount >= 2 && (localSortMode === 'intent' || activeIntents.length > 0) && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Sparkles size={10} className="text-emerald-400" />
                        {activeIntents.length > 0 ? (
                          <span>
                            {getCombinedIntentPercentage(venue.intentDistribution, activeIntents)}% matcher valgt stemning
                          </span>
                        ) : venue.intentDistribution.dominantIntent && (
                          <span>
                            Stemning: {INTENT_BADGE_LABELS[venue.intentDistribution.dominantIntent]} ({venue.intentDistribution.dominantPct}%)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Demographics stats - always show if data exists */}
                  {venue.checkInCount >= 3 && (venue.demographics.totalGenderResponses > 0 || venue.demographics.totalAgeResponses > 0) && localSortMode !== 'intent' && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
                      {/* Gender distribution */}
                      {venue.demographics.totalGenderResponses >= 2 && (
                        <div className="text-[11px] text-slate-400">
                          <span className="mr-1">👥</span>
                          {venue.demographics.femalePct}% kvinner · {venue.demographics.malePct}% menn
                          {venue.demographics.otherPct > 0 && ` · ${venue.demographics.otherPct}% annet`}
                        </div>
                      )}
                      
                      {/* Age distribution */}
                      {venue.demographics.mostCommonAgeBand && venue.demographics.totalAgeResponses >= 2 && (
                        <div className="text-[11px] text-slate-400">
                          <span className="mr-1">📊</span>
                          Vanligste alder: {AGE_BAND_LABELS[venue.demographics.mostCommonAgeBand]}
                          {/* Show percentage in target age groups if sorting by age */}
                          {localSortMode === 'age' && (
                            <span className="ml-2 text-cyan-400">
                              ({getCombinedAgeBandPercentage(venue.demographics, targetAgeBands)}% i valgt gruppe)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Single and ONS stats badges */}
                  {(venue.singleRatio !== null || venue.onsRatio !== null) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-700/50 flex-wrap">
                      {venue.singleRatio !== null && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-pink-500/20 border border-pink-500/30 px-2.5 py-1 text-[11px] text-pink-200 font-medium">
                          <Heart size={10} />
                          <span>{Math.round(venue.singleRatio * 100)}% single</span>
                        </div>
                      )}
                      {venue.onsRatio !== null && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/30 px-2.5 py-1 text-[11px] text-orange-200 font-medium">
                          <Flame size={10} />
                          <span>{Math.round(venue.onsRatio * 100)}% åpne for ONS</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Activity indicator */}
                <div className="flex-shrink-0">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
                      venue.checkInCount >= 8
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : venue.checkInCount >= 5
                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                        : venue.checkInCount >= 2
                        ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                        : venue.checkInCount > 0
                        ? 'bg-green-500/20 border-green-500/50 text-green-400'
                        : 'bg-slate-700 border-slate-600 text-slate-500'
                    }`}
                  >
                    {venue.checkInCount}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
