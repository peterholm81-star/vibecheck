import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Map, List, PlusCircle, RefreshCw, AlertCircle, User, Heart, Activity, Users, Sparkles, Search } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { ensureAnonymousUser } from './lib/auth/ensureAnonymousUser';
// LoginPage kept for potential admin use: import { LoginPage } from './pages/LoginPage';
import { AdminApp } from './apps/AdminApp';
import { InsightsApp } from './apps/InsightsApp';
import { AvatarSetupPage } from './pages/AvatarSetupPage';
import { VenueRoomPage } from './pages/VenueRoomPage';
import { getVenues, getRecentCheckIns } from './api';
import { MapView } from './components/MapView';
import { VenueList } from './components/VenueList';
import { VenueDetail } from './components/VenueDetail';
import { CheckInForm } from './components/CheckInForm';
import { ProfileSettings } from './components/ProfileSettings';
import { MobileFilters } from './components/MobileFilters';
// Legacy onboarding kept for reference: import { Onboarding } from './components/Onboarding';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { checkOnboardingComplete } from './lib/vibeUsers';
import { checkAvatarSetupComplete } from './lib/avatarProfile';
import { ToastContainer } from './components/Toast';
import { useProfile, type AgeBand } from './hooks/useProfile';
import { useToast } from './hooks/useToast';
import { useSmartCheckinEngine } from './hooks/useSmartCheckinEngine';
import { useIsMobile } from './hooks/useIsMobile';
import { getAgeBandFromBirthYear } from './utils/age';
import { AGE_BAND_LABELS } from './utils/venueStats';
import type { Venue, CheckIn, VibeScore, Intent, RelationshipStatus, OnsIntent, TimeWindow, HeatmapMode } from './types';
import { filterCheckInsByTime, INTENT_LABELS, INTENT_OPTIONS } from './types';
import { createCheckIn, checkInWithExternalPlace } from './lib/checkIns';

// ============================================
// TYPES
// ============================================

type Tab = 'map' | 'venues' | 'checkin' | 'profile';

interface MainAppState {
  venues: Venue[];
  checkIns: CheckIn[];
  loading: boolean;
  error: string | null;
}

// All age bands in order
const AGE_BANDS_ORDER: AgeBand[] = ['18_25', '25_30', '30_35', '35_40', '40_plus'];

// Cooldown duration in hours
const CHECKIN_COOLDOWN_HOURS = 3;

/**
 * Check if user can check in again at a specific venue.
 * Returns allowed = true if:
 * - lastVenueId !== venueId (different venue), OR
 * - lastAt is more than cooldownHours ago
 */
function canCheckInAgain(
  venueId: string,
  lastVenueId: string | null,
  lastAt: string | null,
  cooldownHours = CHECKIN_COOLDOWN_HOURS
): { allowed: boolean; nextTime?: string } {
  // If no previous check-in recorded, always allowed
  if (!lastVenueId || !lastAt) {
    return { allowed: true };
  }

  // If different venue, always allowed
  if (lastVenueId !== venueId) {
    return { allowed: true };
  }

  // Same venue - check if cooldown has passed
  const lastCheckInTime = new Date(lastAt).getTime();
  const now = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const timeSince = now - lastCheckInTime;

  if (timeSince >= cooldownMs) {
    return { allowed: true };
  }

  // Cooldown not passed - calculate next available time
  const nextAvailable = new Date(lastCheckInTime + cooldownMs);
  const nextTime = nextAvailable.toLocaleTimeString('no-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return { allowed: false, nextTime };
}

// ============================================
// MAIN APP COMPONENT (all existing logic)
// ============================================

interface MainAppProps {
  userId: string;
}

function MainApp({ userId }: MainAppProps) {
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [state, setState] = useState<MainAppState>({
    venues: [],
    checkIns: [],
    loading: true,
    error: null,
  });
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  
  // Avatar setup gating state
  const [avatarSetupChecked, setAvatarSetupChecked] = useState(false);
  const [hasAvatarSetup, setHasAvatarSetup] = useState(false);
  // Fixed time window - no longer user-configurable
  const timeWindowMinutes: TimeWindow = 180;
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('activity');
  const [activeAgeBands, setActiveAgeBands] = useState<AgeBand[]>([]);
  const [activeIntents, setActiveIntents] = useState<Intent[]>([]);
  const [singlesOnly, setSinglesOnly] = useState(false); // Filter for single users only
  const [preselectedVenueId, setPreselectedVenueId] = useState<string | null>(null);
  
  // Track last check-in for cooldown (3 hours per venue)
  const [lastCheckInVenueId, setLastCheckInVenueId] = useState<string | null>(null);
  const [lastCheckInAt, setLastCheckInAt] = useState<string | null>(null);
  
  // ============================================
  // NAVIGATION STATE
  // ============================================
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState<Venue | null>(null);
  const [navigationUserLocation, setNavigationUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [navigationInfo, setNavigationInfo] = useState<{
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);
  
  // Arrival detection state: idle → ready → shown → done
  const [navigationArrivalState, setNavigationArrivalState] = useState<'idle' | 'ready' | 'shown' | 'done'>('idle');
  
  // Get user profile for check-in defaults and filter initialization
  const { profile, localPrefs, isLoading: profileLoading } = useProfile();
  
  // Toast notifications
  const { toast, showSuccess, showError, dismissToast } = useToast();
  
  // Detect mobile screen for responsive UI
  const isMobile = useIsMobile();
  
  // Track if profile defaults have been applied to filters (only apply once on first load)
  const profileDefaultsApplied = useRef(false);

  // Test function for check-in with external place
  async function handleTestCheckIn() {
    try {
      await checkInWithExternalPlace(
        userId,
        {
          externalPlaceId: "test-place-id-123",
          name: "Test Pub",
          address: "Testgata 1",
          city: "Trondheim",
          lat: 63.4305,
          lng: 10.3951,
          category: "bar",
          source: "google_places",
        },
        "party",
        {
          vibeScore: 7,
          relationshipStatus: "single",
          onsIntent: "maybe",
          gender: "male",
          ageBand: "25_30",
        }
      );

      alert("Check-in gjennomført! Sjekk Supabase 👀");
    } catch (error: unknown) {
      console.error(error);
      alert("Feil ved check-in: " + (error instanceof Error ? error.message : "ukjent feil"));
    }
  }

  // Fetch all data
  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [venuesResult, checkInsResult] = await Promise.all([
        getVenues(),
        getRecentCheckIns(),
      ]);

      if (venuesResult.error) throw new Error(venuesResult.error);
      if (checkInsResult.error) throw new Error(checkInsResult.error);

      setState({
        venues: venuesResult.data || [],
        checkIns: checkInsResult.data || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load data',
      }));
    }
  }, []);

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Check avatar setup status on mount
  useEffect(() => {
    async function checkAvatar() {
      try {
        const complete = await checkAvatarSetupComplete();
        setHasAvatarSetup(complete);
      } catch (err) {
        console.error('[MainApp] Error checking avatar setup:', err);
        setHasAvatarSetup(false);
      } finally {
        setAvatarSetupChecked(true);
      }
    }
    checkAvatar();
  }, []);

  // Handle venueId query param (for return from avatar setup)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const venueIdFromUrl = params.get('venueId');
    if (venueIdFromUrl && avatarSetupChecked && hasAvatarSetup) {
      setSelectedVenueId(venueIdFromUrl);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
  }, [avatarSetupChecked, hasAvatarSetup]);

  // ============================================
  // SMART CHECK-IN ENGINE
  // Automatically checks in when user is at a venue
  // ============================================
  const { state: smartCheckinState } = useSmartCheckinEngine({
    userId,
    profile,
    localPrefs: {
      defaultIntent: localPrefs.defaultIntent,
      defaultOnsIntent: localPrefs.defaultOnsIntent,
    },
    venues: state.venues,
    onCheckin: (result) => {
      if (result.success && result.venueName) {
        showSuccess(`✅ Du er nå sjekket inn på ${result.venueName}`);
      } else if (result.error) {
        showError(`Smart check-in feilet: ${result.error}`);
      }
    },
    onRefresh: fetchData,
  });

  // ============================================
  // APPLY PROFILE DEFAULTS TO FILTERS (once on first load)
  // This pre-populates "Hva søker du i dag?" filters based on user profile
  // ============================================
  useEffect(() => {
    // Only apply defaults once, when profile is loaded
    if (profileLoading || profileDefaultsApplied.current) {
      return;
    }

    // Mark as applied to prevent re-applying on subsequent renders
    profileDefaultsApplied.current = true;

    // === MODUS / Mode filter ===
    // Map defaultOnsIntent to heatmap mode
    if (localPrefs.defaultOnsIntent) {
      if (localPrefs.defaultOnsIntent === 'open') {
        // User is open to ONS → show ONS mode
        setHeatmapMode('ons');
      } else if (localPrefs.defaultOnsIntent === 'maybe') {
        // User is maybe interested → show Single mode
        setHeatmapMode('single');
      }
      // 'not_interested' and 'prefer_not_to_say' → keep default 'activity'
    }

    // === STEMNING / Intent filter ===
    // Use defaultIntent from localPrefs
    if (localPrefs.defaultIntent) {
      setActiveIntents([localPrefs.defaultIntent]);
    }

    // === ALDER / Age filter ===
    // Derive age band from profile.birthYear
    if (profile?.birthYear) {
      const userAgeBand = getAgeBandFromBirthYear(profile.birthYear);
      if (userAgeBand) {
        setActiveAgeBands([userAgeBand]);
      }
    }
  }, [profileLoading, profile, localPrefs]);

  // ============================================
  // FILTER PIPELINE - applies filters in order:
  // 1. Time window (60/120/180 min)
  // 2. Singles only (if enabled)
  // 3. Age bands (if selected)
  // 4. Intents (if selected)
  // Note: City/favoriteCity filter could be added here
  // ============================================
  const filteredCheckIns = useMemo(() => {
    // DEBUG: Log input check-ins count
    if (process.env.NODE_ENV === 'development') {
      console.log('[App] state.checkIns count:', state.checkIns.length);
    }

    // Step 1: Filter by time window
    let filtered = filterCheckInsByTime(state.checkIns, timeWindowMinutes);
    
    // DEBUG: Log after time filter
    if (process.env.NODE_ENV === 'development') {
      console.log('[App] After time filter (', timeWindowMinutes, 'min):', filtered.length);
    }
    
    // Step 2: Apply singles-only filter if enabled
    // A check-in counts as "single" if relationship_status === 'single'
    // (The showAsSingle flag was already applied when creating the check-in)
    if (singlesOnly) {
      filtered = filtered.filter((c) => c.relationshipStatus === 'single');
    }
    
    // Step 3: Apply age band filter if any are selected
    if (activeAgeBands.length > 0) {
      filtered = filtered.filter((c) => {
        return c.ageBand && activeAgeBands.includes(c.ageBand);
      });
    }
    
    // Step 4: Apply intent filter if any are selected
    if (activeIntents.length > 0) {
      filtered = filtered.filter((c) => activeIntents.includes(c.intent));
    }

    // DEBUG: Log final filtered count
    if (process.env.NODE_ENV === 'development') {
      console.log('[App] Final filtered check-ins:', filtered.length);
    }
    
    return filtered;
  }, [state.checkIns, timeWindowMinutes, singlesOnly, activeAgeBands, activeIntents]);

  // Check if any filters are active
  const hasActiveFilters = activeAgeBands.length > 0 || activeIntents.length > 0 || singlesOnly;

  // Toggle age band in filter
  const toggleAgeBand = useCallback((band: AgeBand) => {
    setActiveAgeBands((prev) => {
      if (prev.includes(band)) {
        return prev.filter((b) => b !== band);
      } else {
        return [...prev, band];
      }
    });
  }, []);

  // Toggle intent in filter
  const toggleIntent = useCallback((intent: Intent) => {
    setActiveIntents((prev) => {
      if (prev.includes(intent)) {
        return prev.filter((i) => i !== intent);
      } else {
        return [...prev, intent];
      }
    });
  }, []);

  // Handle check-in submission for an existing venue
  // Since the user selects from existing venues in the dropdown,
  // we already have the venueId - no need to create a new venue.
  //
  // Profile data is used as defaults for check-in fields:
  // - gender: from profile.gender
  // - ageBand: derived from profile.birthYear
  // - relationshipStatus: form value (already prefilled from profile)
  //
  // The "single in heatmap" logic:
  // A user counts as "single" if:
  //   - profile.showAsSingle === true, OR
  //   - profile.relationshipStatus === 'single'
  // This is stored via the relationshipStatus field in check_ins.
  // Future heatmap queries can filter by relationship_status = 'single'.
  //
  // NOTE: The check_ins table should have columns for:
  //   - relationship_status (text/enum)
  //   - gender (text/enum)
  //   - age_band (text/enum)
  //   - ons_intent (text/enum)
  // If these columns are missing, consider adding a migration.
  const handleCheckInSubmit = async (
    venueId: string,
    vibeScore: VibeScore,
    intent: Intent,
    relationshipStatus: RelationshipStatus | null,
    onsIntent: OnsIntent | null,
    ageBandFromForm: AgeBand | null
  ) => {
    // Verify the venue exists in our list
    const venue = state.venues.find((v) => v.id === venueId);
    if (!venue) {
      throw new Error('Venue not found');
    }

    // ============================================
    // DERIVE CHECK-IN DATA FROM PROFILE
    // ============================================
    
    // Gender: directly from profile
    const gender = profile?.gender ?? null;
    
    // Age band: use form value if provided, otherwise derive from profile
    // Valid values: "18_25", "25_30", "30_35", "35_40", "40_plus", or null
    const ageBand = ageBandFromForm ?? getAgeBandFromBirthYear(profile?.birthYear ?? null);
    
    // Relationship status for check-in:
    // If user has showAsSingle=true in profile, force 'single' status
    // This allows users in open relationships to appear as single in heatmap
    let effectiveRelationshipStatus = relationshipStatus;
    if (profile?.showAsSingle === true && relationshipStatus !== 'single') {
      // User wants to appear as single in heatmap
      effectiveRelationshipStatus = 'single';
    }

    // Create the check-in directly using the existing venue's ID
    // This avoids creating duplicate venues
    await createCheckIn({
      userId,
      venueId: venue.id,
      intent,
      vibeScore,
      relationshipStatus: effectiveRelationshipStatus,
      onsIntent,
      gender,
      ageBand,
    });

    // Record this check-in for cooldown tracking
    setLastCheckInVenueId(venue.id);
    setLastCheckInAt(new Date().toISOString());

    // Refresh data after successful check-in
    await fetchData();

    // Navigate to the venue detail
    setSelectedVenueId(venueId);
    setActiveTab('venues');
  };

  // Handle venue click from map or list
  // Routes to Venue Room, with avatar setup gating if needed
  const handleVenueClick = (venueId: string) => {
    console.log('[VenueClick] venueId=', venueId, 'avatarComplete=', hasAvatarSetup);
    
    // Check if avatar setup is required
    if (avatarSetupChecked && !hasAvatarSetup) {
      // Redirect to avatar setup with return URL pointing to Venue Room
      const returnTo = encodeURIComponent(`/venue-room/${venueId}`);
      window.history.pushState({}, '', `/avatar-setup?returnTo=${returnTo}`);
      window.location.reload();
      return;
    }
    
    // Avatar is complete - go directly to Venue Room
    window.history.pushState({}, '', `/venue-room/${venueId}`);
    window.location.reload();
  };

  // Handle back from venue detail
  const handleBack = () => {
    setSelectedVenueId(null);
  };

  // ============================================
  // NAVIGATION FUNCTIONS
  // ============================================
  
  /**
   * Start navigation to a venue
   */
  const startNavigationToVenue = useCallback((venue: Venue) => {
    if (!venue.latitude || !venue.longitude) {
      console.warn('[Navigation] Venue mangler koordinater, kan ikke starte navigasjon:', venue.name);
      return;
    }
    
    console.log('[Navigation] Starting navigation to:', venue.name);
    setNavigationTarget(venue);
    setIsNavigating(true);
    setSelectedVenueId(null); // Close venue detail when starting navigation
    setNavigationArrivalState('idle'); // Reset arrival state for new navigation
    setActiveTab('map'); // Switch to map tab to show fullscreen navigation
  }, []);

  /**
   * Stop navigation and reset state
   */
  const stopNavigation = useCallback(() => {
    console.log('[Navigation] Stopping navigation');
    setIsNavigating(false);
    setNavigationTarget(null);
    setRouteGeoJson(null);
    setNavigationInfo(null);
    setNavigationUserLocation(null);
    setNavigationArrivalState('done'); // Ensure popup doesn't show after stopping
  }, []);

  // Watch user position when navigating
  useEffect(() => {
    if (!isNavigating) return;
    
    if (!navigator.geolocation) {
      console.warn('[Navigation] Geolocation not supported');
      return;
    }

    console.log('[Navigation] Starting geolocation watch');
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setNavigationUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('[Navigation] Geolocation error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    return () => {
      console.log('[Navigation] Clearing geolocation watch');
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isNavigating]);

  // Fetch route from Mapbox Directions API
  useEffect(() => {
    const fetchRoute = async () => {
      if (!isNavigating || !navigationUserLocation || !navigationTarget) return;
      
      try {
        const accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
        if (!accessToken) {
          console.error('[Navigation] Missing VITE_MAPBOX_TOKEN');
          return;
        }

        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${navigationUserLocation.lng},${navigationUserLocation.lat};${navigationTarget.longitude},${navigationTarget.latitude}?geometries=geojson&overview=full&access_token=${accessToken}`;
        
        console.log('[Navigation] Fetching route...');
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('[Navigation] Directions API error:', await response.text());
          return;
        }

        const data = await response.json();
        
        if (!data.routes || !data.routes[0]) {
          console.warn('[Navigation] No routes returned from Mapbox');
          return;
        }

        const route = data.routes[0];
        
        const featureCollection: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: route.geometry,
              properties: {},
            },
          ],
        };

        setRouteGeoJson(featureCollection);
        setNavigationInfo({
          distanceMeters: route.distance,
          durationSeconds: route.duration,
        });
        
        console.log('[Navigation] Route loaded:', Math.round(route.distance), 'm,', Math.round(route.duration / 60), 'min');
      } catch (error) {
        console.error('[Navigation] Failed to fetch route:', error);
      }
    };

    fetchRoute();
  }, [isNavigating, navigationUserLocation, navigationTarget]);

  // ============================================
  // ARRIVAL DETECTION
  // ============================================
  
  /**
   * Calculate distance in meters between two coordinates (Haversine formula)
   */
  const getDistanceMeters = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const toRad = (value: number) => (value * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const aa = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));

    return R * c;
  };

  // Detect arrival at navigation target
  useEffect(() => {
    if (!isNavigating || !navigationTarget || !navigationUserLocation) return;
    if (navigationArrivalState === 'done') return;

    const distance = getDistanceMeters(
      { lat: navigationUserLocation.lat, lng: navigationUserLocation.lng },
      { lat: navigationTarget.latitude!, lng: navigationTarget.longitude! }
    );

    const ARRIVAL_THRESHOLD_METERS = 35;

    if (distance <= ARRIVAL_THRESHOLD_METERS && navigationArrivalState === 'idle') {
      console.log('[Navigation] Arrived at destination! Distance:', Math.round(distance), 'm');
      setNavigationArrivalState('ready');
    }
  }, [isNavigating, navigationTarget, navigationUserLocation, navigationArrivalState]);

  // Arrival prompt callbacks
  const handleArrivalPromptShown = useCallback(() => {
    setNavigationArrivalState((prev) => (prev === 'ready' ? 'shown' : prev));
  }, []);

  const handleDismissArrivalPrompt = useCallback(() => {
    console.log('[Navigation] User dismissed arrival prompt');
    setNavigationArrivalState('done');
  }, []);

  const handleConfirmArrivalCheckIn = useCallback(() => {
    if (!navigationTarget) return;
    
    console.log('[Navigation] User confirmed check-in at arrival');
    
    // Use existing check-in flow: set preselected venue and switch to check-in tab
    setPreselectedVenueId(navigationTarget.id);
    stopNavigation();
    setActiveTab('checkin');
  }, [navigationTarget, stopNavigation]);

  // Tab configuration
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'Map', icon: <Map size={18} /> },
    { id: 'venues', label: 'Venues', icon: <List size={18} /> },
    { id: 'checkin', label: 'Check-in', icon: <PlusCircle size={18} /> },
    { id: 'profile', label: 'Profil', icon: <User size={18} /> },
  ];

  // Get selected venue
  const selectedVenue = selectedVenueId
    ? state.venues.find((v) => v.id === selectedVenueId) || null
    : null;

  // Get check-ins for selected venue
  const selectedVenueCheckIns = selectedVenueId
    ? filteredCheckIns.filter((c) => c.venueId === selectedVenueId)
    : [];

  // Render loading state
  if (state.loading && state.venues.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-slate-300 font-medium">Loading venues...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error && state.venues.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Couldn't load data</h2>
          <p className="text-slate-400 mb-4">{state.error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Handler for "Check In" button on venue details page
  const handleCheckInFromVenue = (venueId: string) => {
    setPreselectedVenueId(venueId);
    setSelectedVenueId(null); // Close venue detail
    setActiveTab('checkin');
  };

  // Render venue detail if selected
  if (selectedVenue) {
    // Check cooldown status for this venue
    const cooldownStatus = canCheckInAgain(
      selectedVenue.id,
      lastCheckInVenueId,
      lastCheckInAt
    );

    return (
      <VenueDetail
        venue={selectedVenue}
        checkIns={selectedVenueCheckIns}
        onBack={handleBack}
        onCheckIn={() => handleCheckInFromVenue(selectedVenue.id)}
        canCheckIn={cooldownStatus.allowed}
        nextCheckInTime={cooldownStatus.nextTime}
        onNavigate={() => startNavigationToVenue(selectedVenue)}
        onOpenVenueRoom={() => {
          window.history.pushState({}, '', `/venue-room/${selectedVenue.id}`);
          window.location.reload();
        }}
      />
    );
  }

  // Render main content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'map':
        return (
          <MapView
            venues={state.venues}
            checkIns={filteredCheckIns}
            timeWindowMinutes={timeWindowMinutes}
            heatmapMode={heatmapMode}
            onVenueClick={handleVenueClick}
            activeIntents={activeIntents}
            activeAgeBands={activeAgeBands}
            singlesOnly={singlesOnly}
            // Navigation props
            isNavigating={isNavigating}
            navigationTarget={navigationTarget}
            navigationUserLocation={navigationUserLocation}
            routeGeoJson={routeGeoJson}
            navigationInfo={navigationInfo}
            onStopNavigation={stopNavigation}
            // Arrival detection props
            navigationArrivalState={navigationArrivalState}
            onArrivalPromptShown={handleArrivalPromptShown}
            onDismissArrivalPrompt={handleDismissArrivalPrompt}
            onConfirmArrivalCheckIn={handleConfirmArrivalCheckIn}
          />
        );

      case 'venues':
        return (
          <VenueList
            venues={state.venues}
            checkIns={filteredCheckIns}
            timeWindowMinutes={timeWindowMinutes}
            heatmapMode={heatmapMode}
            activeAgeBands={activeAgeBands}
            activeIntents={activeIntents}
            onVenueClick={handleVenueClick}
            onNavigateToVenue={startNavigationToVenue}
          />
        );

      case 'checkin':
        return (
          <CheckInForm
            venues={state.venues}
            selectedVenueId={preselectedVenueId ?? undefined}
            onSubmit={handleCheckInSubmit}
          />
        );

      case 'profile':
        return <ProfileSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-x-hidden">
      {/* Test Check-in Button - Hidden on mobile, small on desktop */}
      <button
        onClick={handleTestCheckIn}
        className="hidden sm:block text-xs px-3 py-1.5 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-md mx-4 mt-2 self-start"
      >
        🧪 Test check-in
      </button>

      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">VibeCheck</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Real-time nightlife heatmap</p>
            </div>
            {state.loading && (
              <RefreshCw size={18} className="text-violet-400 animate-spin sm:w-5 sm:h-5" />
            )}
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-2 sm:px-4">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // Clear preselected venue when navigating away from check-in tab
                  if (tab.id !== 'checkin') {
                    setPreselectedVenueId(null);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 px-2 sm:px-4 font-medium text-xs sm:text-sm transition-all border-b-2 min-h-[48px] active:bg-slate-700/50 ${
                  activeTab === tab.id
                    ? 'border-violet-500 text-violet-400 bg-violet-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile Filters - Compact filter bar for small screens */}
      {(activeTab === 'map' || activeTab === 'venues') && (
        <div className="sm:hidden">
          <MobileFilters
            heatmapMode={heatmapMode}
            setHeatmapMode={setHeatmapMode}
            activeIntents={activeIntents}
            toggleIntent={toggleIntent}
            clearIntents={() => setActiveIntents([])}
            activeAgeBands={activeAgeBands}
            toggleAgeBand={toggleAgeBand}
            clearAgeBands={() => setActiveAgeBands([])}
            singlesOnly={singlesOnly}
            setSinglesOnly={setSinglesOnly}
            filteredCount={filteredCheckIns.length}
          />
        </div>
      )}

      {/* Desktop Filters - Full filter layout for larger screens */}
      {(activeTab === 'map' || activeTab === 'venues') && (
        <div className="hidden sm:block bg-slate-800/60 border-b border-slate-700">
          {/* Section Heading */}
          <div className="max-w-4xl mx-auto px-4 pt-3 pb-1">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Search size={14} className="text-violet-400" />
              Hva søker du i dag?
            </h3>
          </div>

          {/* Modus Filter Row */}
          <div className="px-4 py-2">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-slate-400 font-medium">Modus:</span>
              <div className="flex gap-2 flex-wrap justify-center">
                <button
                  onClick={() => setHeatmapMode('activity')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'activity'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Activity size={12} />
                  Aktivitet
                </button>
                <button
                  onClick={() => setHeatmapMode('single')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'single'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <Heart size={12} />
                  Single
                </button>
                <button
                  onClick={() => setHeatmapMode('ons')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'ons'
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <span className="text-sm">👉👌</span>
                  ONS
                </button>
                <button
                  onClick={() => setHeatmapMode('ons_boost')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'ons_boost'
                      ? 'bg-red-500/20 text-red-300 border border-red-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <span className="text-sm">👉👌</span>
                  ONS Boost
                </button>
                {/* Heatmap 2.0: Party and Chill modes */}
                <button
                  onClick={() => setHeatmapMode('party')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'party'
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <span className="text-sm">🎉</span>
                  Party
                </button>
                <button
                  onClick={() => setHeatmapMode('chill')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    heatmapMode === 'chill'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  <span className="text-sm">😌</span>
                  Chill
                </button>
              </div>
              
              {/* Singles Filter Toggle */}
              <div className="border-l border-slate-600 pl-3 ml-1">
                <button
                  onClick={() => setSinglesOnly(!singlesOnly)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 active:scale-95 ${
                    singlesOnly
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                  title="Vis kun steder der single er sjekket inn"
                >
                  <Heart size={12} />
                  Kun single
                </button>
              </div>
            </div>
          </div>

          {/* Stemning Filter Row */}
          <div className="bg-slate-800/40 px-4 py-2">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Sparkles size={12} />
                Stemning:
              </span>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {/* "Alle" button */}
                <button
                  onClick={() => setActiveIntents([])}
                  className={`min-h-[32px] px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                    activeIntents.length === 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  Alle
                </button>
                
                {/* Intent buttons */}
                {INTENT_OPTIONS.map((intent) => (
                  <button
                    key={intent}
                    onClick={() => toggleIntent(intent)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      activeIntents.includes(intent)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500'
                        : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {INTENT_LABELS[intent]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Alder Filter Row */}
          <div className="bg-slate-800/20 px-4 py-2 pb-3">
            <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Users size={12} />
                Alder:
              </span>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {/* "Alle" button */}
                <button
                  onClick={() => setActiveAgeBands([])}
                  className={`min-h-[32px] px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                    activeAgeBands.length === 0
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                  }`}
                >
                  Alle
                </button>
                
                {/* Age band buttons */}
                {AGE_BANDS_ORDER.map((band) => (
                  <button
                    key={band}
                    onClick={() => toggleAgeBand(band)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      activeAgeBands.includes(band)
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500'
                        : 'bg-slate-700 text-slate-400 border border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {AGE_BAND_LABELS[band]}
                  </button>
                ))}
              </div>
              
              {/* Show count when filtering */}
              {(activeAgeBands.length > 0 || activeIntents.length > 0) && (
                <span className="text-xs text-slate-400">
                  ({filteredCheckIns.length})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Status Banner - shows when filters result in no data */}
      {(activeTab === 'map' || activeTab === 'venues') && hasActiveFilters && filteredCheckIns.length === 0 && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-xs sm:text-sm">Ingen check-ins matcher valgte filtre</span>
            </div>
            <button
              onClick={() => {
                setActiveAgeBands([]);
                setActiveIntents([]);
                setSinglesOnly(false);
              }}
              className="text-amber-300 hover:text-amber-100 text-xs sm:text-sm font-medium min-h-[36px] px-3 py-1.5 rounded-lg active:bg-amber-900/30"
            >
              Nullstill filtre
            </button>
          </div>
        </div>
      )}

      {/* Error Banner (non-blocking) */}
      {state.error && state.venues.length > 0 && (
        <div className="bg-red-900/50 border-b border-red-800 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span className="text-xs sm:text-sm">{state.error}</span>
            </div>
            <button
              onClick={fetchData}
              className="text-red-300 hover:text-red-100 text-xs sm:text-sm font-medium min-h-[36px] px-3 py-1.5 rounded-lg active:bg-red-900/30"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4">
        {renderContent()}
      </main>

      {/* Toast Notifications */}
      <ToastContainer toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

// ============================================
// APP COMPONENT (auth wrapper + onboarding)
// ============================================
// Flyten er:
// 1. Sjekk om bruker har fullført onboarding (localStorage)
// 2. Hvis ikke → vis Onboarding-skjerm
// 3. Etter onboarding → sjekk auth
// 4. Hvis ikke innlogget → vis LoginPage
// 5. Hvis innlogget → vis MainApp
// ============================================

// Onboarding 2.0 key (synced with Supabase field)
const ONBOARDING_COMPLETE_KEY = 'vibecheck_onboarding_complete';

/**
 * Check if current URL is the admin route
 */
function isAdminRoute(): boolean {
  return window.location.pathname === '/admin';
}

/**
 * Check if current URL is the insights route
 */
function isInsightsRoute(): boolean {
  return window.location.pathname === '/insights';
}

/**
 * Check if current URL is the onboarding route
 */
function isOnboardingRoute(): boolean {
  return window.location.pathname === '/onboarding';
}

/**
 * Check if current URL is the avatar setup route
 */
function isAvatarSetupRoute(): boolean {
  return window.location.pathname === '/avatar-setup';
}

/**
 * Check if current URL is a venue room route
 * Returns venueId if on venue room route, null otherwise
 */
function getVenueRoomId(): string | null {
  const match = window.location.pathname.match(/^\/venue-room\/([^/]+)$/);
  return match ? match[1] : null;
}

// ============================================
// APP COMPONENT
// ============================================
// Anonymous Auth Flow:
// 1. App starts → ensureAnonymousUser() creates/retrieves anonymous Supabase user
// 2. Once authReady → check onboarding status
// 3. If not onboarded → show OnboardingPage
// 4. If onboarded → show MainApp (map/heatmap)
// No login required for regular users!
// ============================================

function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Anonymous auth state
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<Error | null>(null);
  
  // Onboarding 2.0 state - null until checked
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  
  // Admin route state
  const [showAdmin, setShowAdmin] = useState(isAdminRoute());
  
  // Insights route state
  const [showInsights, setShowInsights] = useState(isInsightsRoute());
  
  // Onboarding route state
  const [showOnboarding, setShowOnboarding] = useState(isOnboardingRoute());
  
  // Avatar setup route state
  const [showAvatarSetup, setShowAvatarSetup] = useState(isAvatarSetupRoute());
  
  // Venue room route state
  const [venueRoomId, setVenueRoomId] = useState<string | null>(getVenueRoomId());

  // Sjekk onboarding-status ved oppstart (Supabase + localStorage fallback)
  useEffect(() => {
    async function checkOnboarding() {
      // First check localStorage for fast initial render
      const localComplete = localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
      
      if (localComplete) {
        setHasOnboarded(true);
        setOnboardingChecked(true);
        return;
      }
      
      // Then check Supabase for authoritative status
      try {
        const complete = await checkOnboardingComplete();
        setHasOnboarded(complete);
        
        // Sync to localStorage if Supabase says complete
        if (complete) {
          localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
        }
      } catch (err) {
        console.error('[App] Failed to check onboarding status:', err);
        setHasOnboarded(false);
      }
      
      setOnboardingChecked(true);
    }
    
    checkOnboarding();
  }, []);

  // Handle browser back/forward for admin, insights, onboarding, avatar-setup, and venue-room routes
  useEffect(() => {
    const handlePopState = () => {
      setShowAdmin(isAdminRoute());
      setShowInsights(isInsightsRoute());
      setShowOnboarding(isOnboardingRoute());
      setShowAvatarSetup(isAvatarSetupRoute());
      setVenueRoomId(getVenueRoomId());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Håndter fullført onboarding 2.0
  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setHasOnboarded(true);
    setShowOnboarding(false);
    // Navigate to main app
    window.history.pushState({}, '', '/');
  };

  // Initialize anonymous auth on app start
  // This ensures we always have a Supabase user (anonymous or authenticated)
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // Check if Supabase is configured
      if (!supabase) {
        // If not configured, skip auth and show MainApp directly
        console.warn('[App] Supabase not configured, using mock user');
        if (isMounted) {
          setUser({ id: 'mock-user' } as SupabaseUser);
          setAuthReady(true);
          setLoading(false);
        }
        return;
      }

      // DEV: Allow bypassing auth with ?devbypass=true in URL
      const urlParams = new URLSearchParams(window.location.search);
      if (import.meta.env.DEV && urlParams.get('devbypass') === 'true') {
        console.log('[App] Dev bypass enabled');
        if (isMounted) {
          setUser({ id: 'dev-user' } as SupabaseUser);
          setAuthReady(true);
          setLoading(false);
        }
        return;
      }

      try {
        // Ensure we have an anonymous user (or existing authenticated user)
        const anonymousUser = await ensureAnonymousUser();
        
        if (isMounted) {
          setUser(anonymousUser);
          setAuthReady(true);
          setLoading(false);
        }
      } catch (err) {
        console.error('[App] Failed to initialize anonymous auth:', err);
        if (isMounted) {
          setAuthError(err instanceof Error ? err : new Error('Unknown auth error'));
          setAuthReady(true); // Still mark as ready so we can show error UI
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen for auth state changes (handles session refresh, logout, etc.)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Show admin dashboard if on /admin route
  // AdminApp handles PIN authentication and passes it to AdminDashboard
  if (showAdmin) {
    return <AdminApp />;
  }

  // Show insights dashboard if on /insights route
  // InsightsApp handles PIN authentication via server-side validation
  if (showInsights) {
    return <InsightsApp />;
  }

  // Show avatar setup page if on /avatar-setup route
  if (showAvatarSetup) {
    const handleAvatarSetupComplete = () => {
      setShowAvatarSetup(false);
      // Navigate to returnTo param if present, otherwise go home
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo');
      if (returnTo) {
        window.history.pushState({}, '', returnTo);
      } else {
        window.history.pushState({}, '', '/');
      }
      window.location.reload();
    };
    
    return (
      <AvatarSetupPage
        onComplete={handleAvatarSetupComplete}
        onBack={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  // Show venue room page if on /venue-room/:venueId route
  if (venueRoomId) {
    const handleVenueRoomBack = () => {
      setVenueRoomId(null);
      window.history.pushState({}, '', '/');
    };
    
    return (
      <VenueRoomPage
        venueId={venueRoomId}
        onBack={handleVenueRoomBack}
      />
    );
  }

  // Auth error - show friendly error message
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Noe gikk galt</h1>
          <p className="text-slate-400 mb-6">
            Kunne ikke starte appen. Prøv å laste siden på nytt.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors"
          >
            Last inn på nytt
          </button>
          <p className="text-slate-600 text-xs mt-4">
            Feil: {authError.message}
          </p>
        </div>
      </div>
    );
  }

  // Wait for auth to be ready
  if (!authReady || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-slate-300 font-medium">Laster VibeCheck...</p>
        </div>
      </div>
    );
  }

  // Wait for onboarding status check
  if (!onboardingChecked || hasOnboarded === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="mx-auto text-violet-400 animate-spin mb-4" />
          <p className="text-slate-300 font-medium">Laster...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if not completed (or on /onboarding route)
  if (showOnboarding || !hasOnboarded) {
    return <OnboardingPage onComplete={handleOnboardingComplete} />;
  }

  // No user after auth (shouldn't happen with anonymous auth, but safety check)
  if (user === null) {
    // Try to recover by reloading
    console.error('[App] No user after auth ready - this should not happen');
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-amber-400 mb-4" />
          <p className="text-slate-300 mb-4">Kunne ikke koble til. Prøv igjen.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors"
          >
            Last inn på nytt
          </button>
        </div>
      </div>
    );
  }

  // Auth ready + onboarded → show main app
  return <MainApp userId={user.id} />;
}

export default App;