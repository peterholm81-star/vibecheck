import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from './useProfile';

// ============================================
// TYPES
// ============================================

/**
 * Filter snapshot stored in a notification session.
 * Contains all filter state at the time the session was created.
 */
export interface NotificationSessionFilters {
  heatmapMode?: string;
  activeIntents?: string[];
  activeAgeBands?: string[];
  singlesOnly?: boolean;
  timeWindowMinutes?: number;
  [key: string]: unknown; // Allow additional filter properties
}

/**
 * Database row shape for notification_sessions table.
 */
interface NotificationSessionRow {
  id: string;
  user_id: string;
  filters: NotificationSessionFilters;
  started_at: string;
  ends_at: string;
  is_active: boolean;
  last_notified_at: string | null;
  created_at: string;
}

/**
 * Payload for starting a new notification session.
 */
export interface NotificationSessionPayload {
  /** JSON-safe snapshot of current filters */
  filters: NotificationSessionFilters;
  /** Session duration in hours (default: 4) */
  durationHours?: number;
}

/**
 * Return type for the useNotificationSession hook.
 */
export interface UseNotificationSessionResult {
  /** ID of the currently active session, or null if none */
  activeSessionId: string | null;
  /** Whether a session is currently being started */
  isActivating: boolean;
  /** Whether a session is currently being stopped */
  isDeactivating: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Start a new notification session with the given filters */
  startSession: (payload: NotificationSessionPayload) => Promise<void>;
  /** Stop the current notification session */
  stopSession: () => Promise<void>;
  /** Refresh the active session state from the database */
  refreshActiveSession: () => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

/** LocalStorage key for storing the active session ID */
const STORAGE_KEY = 'vibecheck_notification_session_id';

/** Default session duration in hours */
const DEFAULT_DURATION_HOURS = 4;

// ============================================
// HOOK
// ============================================

/**
 * Hook for managing notification sessions ("radar mode").
 * 
 * A notification session represents a short-lived period (typically 4 hours)
 * where the user wants to receive push notifications about venues matching
 * their current filters.
 * 
 * ## Usage Flow:
 * 1. User enables notifications in profile (allow_notifications = true)
 * 2. User activates "Live-varsler for kvelden" on the map
 * 3. Call startSession({ filters }) to create a session
 * 4. A future backend job reads active sessions and sends push notifications
 *    based on Heatmap 2.0 venue scores
 * 
 * ## Session Lifecycle:
 * - Sessions auto-expire after ends_at time
 * - User can manually stop a session with stopSession()
 * - The hook persists activeSessionId in localStorage to survive reloads
 */
export function useNotificationSession(): UseNotificationSessionResult {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Get profile to check allow_notifications
  const { profile } = useProfile();

  // ============================================
  // GET CURRENT USER ID
  // ============================================

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // ============================================
  // CHECK SESSION VALIDITY
  // ============================================

  /**
   * Check if a session is still active and not expired.
   */
  const checkSessionValidity = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!supabase) return false;

    const { data, error: fetchError } = await supabase
      .from('notification_sessions')
      .select('id, is_active, ends_at')
      .eq('id', sessionId)
      .single();

    if (fetchError || !data) {
      return false;
    }

    // Check if session is active and not expired
    const isActive = data.is_active === true;
    const notExpired = new Date(data.ends_at) > new Date();

    return isActive && notExpired;
  }, []);

  // ============================================
  // LOAD SESSION FROM STORAGE ON MOUNT
  // ============================================

  useEffect(() => {
    const loadStoredSession = async () => {
      const storedId = localStorage.getItem(STORAGE_KEY);
      
      if (!storedId) {
        setActiveSessionId(null);
        return;
      }

      // Verify the stored session is still valid
      const isValid = await checkSessionValidity(storedId);
      
      if (isValid) {
        setActiveSessionId(storedId);
      } else {
        // Clear invalid session from storage
        localStorage.removeItem(STORAGE_KEY);
        setActiveSessionId(null);
      }
    };

    loadStoredSession();
  }, [checkSessionValidity]);

  // ============================================
  // START SESSION
  // ============================================

  const startSession = useCallback(async (payload: NotificationSessionPayload) => {
    // Check if notifications are allowed in profile
    if (!profile?.allowNotifications) {
      setError('Varsler er slått av i profilen din. Gå til "Min profil" for å slå dem på.');
      return;
    }

    if (!supabase || !userId) {
      setError('Du må være logget inn for å bruke varsler.');
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      // Compute ends_at time
      const durationHours = payload.durationHours ?? DEFAULT_DURATION_HOURS;
      const endsAt = new Date();
      endsAt.setHours(endsAt.getHours() + durationHours);

      // Deactivate any existing active sessions for this user
      await supabase
        .from('notification_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Insert new session
      const { data, error: insertError } = await supabase
        .from('notification_sessions')
        .insert({
          user_id: userId,
          filters: payload.filters,
          started_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
          is_active: true,
        })
        .select('id')
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      if (!data) {
        throw new Error('Kunne ikke opprette varsel-økt');
      }

      // Store in state and localStorage
      setActiveSessionId(data.id);
      localStorage.setItem(STORAGE_KEY, data.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunne ikke starte varsel-økt';
      setError(message);
      console.error('startSession error:', err);
    } finally {
      setIsActivating(false);
    }
  }, [profile?.allowNotifications, userId]);

  // ============================================
  // STOP SESSION
  // ============================================

  const stopSession = useCallback(async () => {
    if (!activeSessionId) {
      return; // No-op if no active session
    }

    if (!supabase) {
      setError('Supabase ikke tilgjengelig');
      return;
    }

    setIsDeactivating(true);
    setError(null);

    try {
      // Update session to inactive
      const { error: updateError } = await supabase
        .from('notification_sessions')
        .update({
          is_active: false,
          ends_at: new Date().toISOString(), // Set ends_at to now
        })
        .eq('id', activeSessionId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Clear from state and localStorage
      setActiveSessionId(null);
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunne ikke stoppe varsel-økt';
      setError(message);
      console.error('stopSession error:', err);
    } finally {
      setIsDeactivating(false);
    }
  }, [activeSessionId]);

  // ============================================
  // REFRESH ACTIVE SESSION
  // ============================================

  const refreshActiveSession = useCallback(async () => {
    if (!activeSessionId) {
      return;
    }

    const isValid = await checkSessionValidity(activeSessionId);

    if (!isValid) {
      // Session is no longer valid - clear it
      setActiveSessionId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [activeSessionId, checkSessionValidity]);

  // ============================================
  // AUTO-REFRESH EVERY MINUTE
  // ============================================

  useEffect(() => {
    if (!activeSessionId) return;

    const interval = setInterval(() => {
      refreshActiveSession();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [activeSessionId, refreshActiveSession]);

  return {
    activeSessionId,
    isActivating,
    isDeactivating,
    error,
    startSession,
    stopSession,
    refreshActiveSession,
  };
}

