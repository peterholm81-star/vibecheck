import { useState, useEffect, useCallback, useRef } from 'react';
import { useSmartCheckinLocation } from './useSmartCheckinLocation';
import type { UserProfile, AgeBand } from './useProfile';
import type { Venue, Intent, RelationshipStatus, OnsIntent, VibeScore } from '../types';
import { findNearestVenueWithinRadius, SMART_CHECKIN_RADIUS_METERS } from '../utils/geo';
import { getAgeBandFromBirthYear } from '../utils/age';
import { createCheckIn } from '../lib/checkIns';

// ============================================
// TYPES
// ============================================

export interface SmartCheckinState {
  /** Whether smart check-in is currently active (enabled + geolocation working) */
  isActive: boolean;
  /** The venue we're currently at (if any) */
  currentVenue: Venue | null;
  /** Distance to current venue in meters */
  currentDistanceMeters: number | null;
  /** Last smart check-in timestamp (ISO string) */
  lastCheckinAt: string | null;
  /** Last smart check-in venue ID */
  lastCheckinVenueId: string | null;
  /** Geolocation error message */
  geoError: string | null;
  /** Geolocation permission state */
  permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
}

export interface SmartCheckinResult {
  success: boolean;
  venueName?: string;
  error?: string;
}

interface UseSmartCheckinEngineReturn {
  /** Current smart check-in state */
  state: SmartCheckinState;
  /** Manually trigger a position check */
  checkNow: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/** Cooldown between smart check-ins at the same venue (in milliseconds) */
const COOLDOWN_MS = 45 * 60 * 1000; // 45 minutes

/** Local storage key for smart check-in state */
const STORAGE_KEY = 'vibecheck_smart_checkin';

/** Default vibe score for smart check-ins */
const DEFAULT_VIBE_SCORE: VibeScore = 'good';

/** Default intent for smart check-ins */
const DEFAULT_INTENT: Intent = 'chill';

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

interface StoredCheckinState {
  lastCheckinAt: string | null;
  lastCheckinVenueId: string | null;
}

function loadStoredState(): StoredCheckinState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredCheckinState;
      return {
        lastCheckinAt: parsed.lastCheckinAt ?? null,
        lastCheckinVenueId: parsed.lastCheckinVenueId ?? null,
      };
    }
  } catch {
    // Ignore errors
  }
  return { lastCheckinAt: null, lastCheckinVenueId: null };
}

function saveStoredState(state: StoredCheckinState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore errors
  }
}

// ============================================
// HELPER: Map profile relationship status to check-in status
// ============================================

function mapProfileToCheckinRelationshipStatus(
  profileStatus: UserProfile['relationshipStatus']
): RelationshipStatus | null {
  if (!profileStatus) return null;
  
  // Map 'open_relationship' to 'complicated' (closest semantic match)
  if (profileStatus === 'open_relationship') {
    return 'complicated';
  }
  
  // Other values map directly
  return profileStatus as RelationshipStatus;
}

// ============================================
// HOOK
// ============================================

interface UseSmartCheckinEngineProps {
  /** Current user ID */
  userId: string | null;
  /** Current user profile */
  profile: UserProfile | null;
  /** Local preferences (for intent defaults) */
  localPrefs: {
    defaultIntent: Intent | null;
    defaultOnsIntent: OnsIntent | null;
  };
  /** List of venues */
  venues: Venue[];
  /** Callback when a smart check-in is created */
  onCheckin?: (result: SmartCheckinResult) => void;
  /** Callback to refresh data after check-in */
  onRefresh?: () => void;
}

export function useSmartCheckinEngine({
  userId,
  profile,
  localPrefs,
  venues,
  onCheckin,
  onRefresh,
}: UseSmartCheckinEngineProps): UseSmartCheckinEngineReturn {
  // ============================================
  // STATE
  // ============================================
  
  const [currentVenue, setCurrentVenue] = useState<Venue | null>(null);
  const [currentDistanceMeters, setCurrentDistanceMeters] = useState<number | null>(null);
  const [lastCheckinAt, setLastCheckinAt] = useState<string | null>(null);
  const [lastCheckinVenueId, setLastCheckinVenueId] = useState<string | null>(null);
  
  // Ref to prevent duplicate check-ins during the same position update
  const isCheckingInRef = useRef(false);

  // ============================================
  // GEOLOCATION
  // ============================================
  
  const smartCheckinEnabled = profile?.smartCheckinEnabled ?? false;
  
  const {
    position,
    isActive: geoIsActive,
    permissionState,
    error: geoError,
    requestPosition,
  } = useSmartCheckinLocation(smartCheckinEnabled && Boolean(userId));

  // ============================================
  // LOAD STORED STATE ON MOUNT
  // ============================================
  
  useEffect(() => {
    const stored = loadStoredState();
    setLastCheckinAt(stored.lastCheckinAt);
    setLastCheckinVenueId(stored.lastCheckinVenueId);
  }, []);

  // ============================================
  // CHECK IF COOLDOWN HAS PASSED
  // ============================================
  
  const hasCooldownPassed = useCallback((venueId: string): boolean => {
    // If this is a different venue, no cooldown applies
    if (lastCheckinVenueId !== venueId) {
      return true;
    }
    
    // Check if enough time has passed since last check-in
    if (!lastCheckinAt) {
      return true;
    }
    
    const timeSinceLastCheckin = Date.now() - new Date(lastCheckinAt).getTime();
    return timeSinceLastCheckin >= COOLDOWN_MS;
  }, [lastCheckinAt, lastCheckinVenueId]);

  // ============================================
  // PERFORM SMART CHECK-IN
  // ============================================
  
  const performCheckin = useCallback(async (venue: Venue): Promise<SmartCheckinResult> => {
    if (!userId || !profile) {
      return { success: false, error: 'Bruker ikke innlogget' };
    }

    try {
      // Derive check-in data from profile
      const ageBand: AgeBand | null = getAgeBandFromBirthYear(profile.birthYear);
      const relationshipStatus = mapProfileToCheckinRelationshipStatus(profile.relationshipStatus);
      const intent = localPrefs.defaultIntent ?? DEFAULT_INTENT;
      const onsIntent = localPrefs.defaultOnsIntent ?? null;
      const gender = profile.gender ?? null;

      // Create check-in
      await createCheckIn({
        userId,
        venueId: venue.id,
        intent,
        vibeScore: DEFAULT_VIBE_SCORE,
        relationshipStatus,
        onsIntent,
        gender,
        ageBand,
      });

      // Update stored state
      const now = new Date().toISOString();
      setLastCheckinAt(now);
      setLastCheckinVenueId(venue.id);
      saveStoredState({ lastCheckinAt: now, lastCheckinVenueId: venue.id });

      // Trigger refresh
      onRefresh?.();

      return { success: true, venueName: venue.name };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ukjent feil';
      console.error('Smart check-in failed:', err);
      return { success: false, error: errorMessage };
    }
  }, [userId, profile, localPrefs, onRefresh]);

  // ============================================
  // MAIN LOGIC: DETECT VENUE AND AUTO CHECK-IN
  // ============================================
  
  useEffect(() => {
    // Skip if not enabled or no position
    if (!smartCheckinEnabled || !position || !userId) {
      setCurrentVenue(null);
      setCurrentDistanceMeters(null);
      return;
    }

    // Find nearest venue
    const result = findNearestVenueWithinRadius(position, venues, SMART_CHECKIN_RADIUS_METERS);
    
    if (result) {
      setCurrentVenue(result.venue);
      setCurrentDistanceMeters(result.distanceMeters);

      // Check if we should auto check-in
      if (!isCheckingInRef.current && hasCooldownPassed(result.venue.id)) {
        isCheckingInRef.current = true;
        
        performCheckin(result.venue).then((checkInResult) => {
          isCheckingInRef.current = false;
          onCheckin?.(checkInResult);
        });
      }
    } else {
      setCurrentVenue(null);
      setCurrentDistanceMeters(null);
    }
  }, [position, venues, userId, smartCheckinEnabled, hasCooldownPassed, performCheckin, onCheckin]);

  // ============================================
  // RETURN
  // ============================================
  
  const state: SmartCheckinState = {
    isActive: smartCheckinEnabled && geoIsActive && Boolean(userId),
    currentVenue,
    currentDistanceMeters,
    lastCheckinAt,
    lastCheckinVenueId,
    geoError,
    permissionState,
  };

  return {
    state,
    checkNow: requestPosition,
  };
}

