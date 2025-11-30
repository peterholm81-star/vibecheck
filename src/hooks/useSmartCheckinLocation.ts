import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// TYPES
// ============================================

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type GeoPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

interface UseSmartCheckinLocationReturn {
  /** Current user position (lat/lng), null if not available */
  position: GeoPosition | null;
  /** Whether geolocation polling is currently active */
  isActive: boolean;
  /** Current permission state */
  permissionState: GeoPermissionState;
  /** Error message if something went wrong */
  error: string | null;
  /** Manually request position update */
  requestPosition: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/** How often to poll for position updates (in milliseconds) */
const POLL_INTERVAL_MS = 30000; // 30 seconds

/** Geolocation options */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 15000, // Accept cached position up to 15 seconds old
};

// ============================================
// HOOK
// ============================================

/**
 * React hook for smart check-in geolocation.
 * 
 * - Requests geolocation permission when enabled.
 * - Polls the user's position every 30 seconds when enabled.
 * - Handles permission denied gracefully.
 * 
 * @param enabled - Whether smart check-in is enabled (from profile)
 */
export function useSmartCheckinLocation(enabled: boolean): UseSmartCheckinLocationReturn {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [permissionState, setPermissionState] = useState<GeoPermissionState>('prompt');
  const [error, setError] = useState<string | null>(null);
  
  // Refs to track interval and watch
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ============================================
  // CHECK PERMISSION STATE
  // ============================================
  
  const checkPermission = useCallback(async () => {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setPermissionState('unavailable');
      setError('Geolocation er ikke tilgjengelig i denne nettleseren.');
      return 'unavailable' as GeoPermissionState;
    }

    // Check permission state if Permissions API is available
    if (navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        const state = result.state as GeoPermissionState;
        setPermissionState(state);
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionState(result.state as GeoPermissionState);
        });
        
        return state;
      } catch {
        // Permissions API not fully supported, assume prompt
        return 'prompt' as GeoPermissionState;
      }
    }

    return 'prompt' as GeoPermissionState;
  }, []);

  // ============================================
  // GET CURRENT POSITION
  // ============================================
  
  const getCurrentPosition = useCallback((): Promise<GeoPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError('Geolocation er ikke tilgjengelig.');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPosition: GeoPosition = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setPosition(newPosition);
          setError(null);
          setIsActive(true);
          resolve(newPosition);
        },
        (geoError) => {
          switch (geoError.code) {
            case geoError.PERMISSION_DENIED:
              setPermissionState('denied');
              setError('Posisjonstilgang ble avslått.');
              break;
            case geoError.POSITION_UNAVAILABLE:
              setError('Kunne ikke hente posisjon.');
              break;
            case geoError.TIMEOUT:
              setError('Tidsavbrudd ved henting av posisjon.');
              break;
            default:
              setError('Ukjent feil ved henting av posisjon.');
          }
          setIsActive(false);
          resolve(null);
        },
        GEO_OPTIONS
      );
    });
  }, []);

  // ============================================
  // REQUEST POSITION (manual trigger)
  // ============================================
  
  const requestPosition = useCallback(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  // ============================================
  // START/STOP POLLING
  // ============================================
  
  useEffect(() => {
    if (!enabled) {
      // Stop polling when disabled
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsActive(false);
      setPosition(null);
      setError(null);
      return;
    }

    // Check permission and start polling
    const startPolling = async () => {
      const permState = await checkPermission();
      
      if (permState === 'denied') {
        setError('Smart check-in krever posisjonstilgang i nettleseren.');
        return;
      }
      
      if (permState === 'unavailable') {
        return;
      }

      // Get initial position
      await getCurrentPosition();

      // Set up polling interval
      pollIntervalRef.current = setInterval(() => {
        getCurrentPosition();
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    // Cleanup on unmount or when disabled
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, checkPermission, getCurrentPosition]);

  return {
    position,
    isActive,
    permissionState,
    error,
    requestPosition,
  };
}

