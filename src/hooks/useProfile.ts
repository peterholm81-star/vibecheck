import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { RelationshipStatus, OnsIntent, Intent } from "../types";

// ============================================
// PROFILE TYPES
// ============================================

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export type AgeBand = "18_25" | "25_30" | "30_35" | "35_40" | "40_plus";

export type FavoriteCity = "auto" | "Trondheim" | "Oslo" | "Bergen";

/**
 * Orientation type for matching features
 */
export type Orientation = "straight" | "gay" | "bi" | "other" | "prefer_not_to_say";

/**
 * Profile relationship status - extended with open_relationship
 * Note: This is separate from the check-in relationship status
 */
export type ProfileRelationshipStatus = 
  | "single"
  | "in_relationship"
  | "open_relationship"
  | "prefer_not_to_say";

/**
 * User profile stored in Supabase `profiles` table
 */
export interface UserProfile {
  // Basic info (stored in Supabase)
  birthYear: number | null;
  gender: Gender | null;
  orientation: Orientation | null;
  relationshipStatus: ProfileRelationshipStatus | null;
  
  // Heatmap & feature flags (stored in Supabase)
  showAsSingle: boolean;
  smartCheckinEnabled: boolean;
  
  // Notification preferences
  allowNotifications: boolean;
}

/**
 * Local preferences stored in localStorage (not synced to Supabase)
 * These are check-in defaults that don't need to be on the server
 */
export interface LocalPreferences {
  defaultRelationshipStatus: RelationshipStatus | null;
  defaultOnsIntent: OnsIntent | null;
  defaultIntent: Intent | null;
  favoriteCity: FavoriteCity;
}

/**
 * Database row type (snake_case to match Supabase)
 */
interface ProfileDbRow {
  id: string;
  relationship_status: ProfileRelationshipStatus | null;
  gender: Gender | null;
  orientation: Orientation | null;
  birth_year: number | null;
  show_as_single: boolean;
  smart_checkin_enabled: boolean;
  allow_notifications: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// CONSTANTS & LABELS
// ============================================

const LOCAL_PREFS_KEY = "vibecheck_local_prefs";

const emptyProfile: UserProfile = {
  birthYear: null,
  gender: null,
  orientation: null,
  relationshipStatus: null,
  showAsSingle: false,
  smartCheckinEnabled: false,
  allowNotifications: false,
};

const emptyLocalPrefs: LocalPreferences = {
  defaultRelationshipStatus: null,
  defaultOnsIntent: null,
  defaultIntent: null,
  favoriteCity: "auto",
};

// Gender labels (Norwegian)
export const GENDER_LABELS: Record<Gender, string> = {
  female: "Kvinne",
  male: "Mann",
  other: "Annet",
  prefer_not_to_say: "Vil ikke si",
};

export const GENDER_OPTIONS: Gender[] = ["female", "male", "other", "prefer_not_to_say"];

// Orientation labels (Norwegian)
export const ORIENTATION_LABELS: Record<Orientation, string> = {
  straight: "Hetero",
  gay: "Homo",
  bi: "Bi",
  other: "Annet",
  prefer_not_to_say: "Vil ikke si",
};

export const ORIENTATION_OPTIONS: Orientation[] = ["straight", "gay", "bi", "other", "prefer_not_to_say"];

// Profile relationship status labels (Norwegian)
export const PROFILE_RELATIONSHIP_STATUS_LABELS: Record<ProfileRelationshipStatus, string> = {
  single: "Singel",
  in_relationship: "I et forhold",
  open_relationship: "Åpent forhold",
  prefer_not_to_say: "Vil ikke si",
};

export const PROFILE_RELATIONSHIP_STATUS_OPTIONS: ProfileRelationshipStatus[] = [
  "single",
  "in_relationship",
  "open_relationship",
  "prefer_not_to_say",
];

// Favorite city options
export const FAVORITE_CITY_OPTIONS: FavoriteCity[] = ["auto", "Trondheim", "Oslo", "Bergen"];

export const FAVORITE_CITY_LABELS: Record<FavoriteCity, string> = {
  auto: "Automatisk (geolocation)",
  Trondheim: "Trondheim",
  Oslo: "Oslo",
  Bergen: "Bergen",
};

// ============================================
// MAPPING FUNCTIONS (DB <-> TypeScript)
// ============================================

/**
 * Convert DB row (snake_case) to TypeScript profile (camelCase)
 */
function dbRowToProfile(row: ProfileDbRow): UserProfile {
  return {
    birthYear: row.birth_year,
    gender: row.gender,
    orientation: row.orientation,
    relationshipStatus: row.relationship_status,
    showAsSingle: row.show_as_single ?? false,
    smartCheckinEnabled: row.smart_checkin_enabled ?? false,
    allowNotifications: row.allow_notifications ?? false,
  };
}

/**
 * Convert TypeScript profile updates to DB format (snake_case)
 */
function profileToDbUpdates(updates: Partial<UserProfile>): Record<string, unknown> {
  const dbUpdates: Record<string, unknown> = {};
  
  if (updates.birthYear !== undefined) {
    dbUpdates.birth_year = updates.birthYear;
  }
  if (updates.gender !== undefined) {
    dbUpdates.gender = updates.gender;
  }
  if (updates.orientation !== undefined) {
    dbUpdates.orientation = updates.orientation;
  }
  if (updates.relationshipStatus !== undefined) {
    dbUpdates.relationship_status = updates.relationshipStatus;
  }
  if (updates.showAsSingle !== undefined) {
    dbUpdates.show_as_single = updates.showAsSingle;
  }
  if (updates.smartCheckinEnabled !== undefined) {
    dbUpdates.smart_checkin_enabled = updates.smartCheckinEnabled;
  }
  if (updates.allowNotifications !== undefined) {
    dbUpdates.allow_notifications = updates.allowNotifications;
  }
  
  return dbUpdates;
}

// ============================================
// LOCAL PREFERENCES HELPERS
// ============================================

function loadLocalPrefs(): LocalPreferences {
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalPreferences>;
      return {
        defaultRelationshipStatus: parsed.defaultRelationshipStatus ?? null,
        defaultOnsIntent: parsed.defaultOnsIntent ?? null,
        defaultIntent: parsed.defaultIntent ?? null,
        favoriteCity: parsed.favoriteCity ?? "auto",
      };
    }
  } catch {
    // Ignore parse errors
  }
  return emptyLocalPrefs;
}

function saveLocalPrefs(prefs: LocalPreferences): void {
  try {
    window.localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// MAIN HOOK
// ============================================

interface UseProfileReturn {
  // Supabase-backed profile
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Local preferences (localStorage)
  localPrefs: LocalPreferences;
  
  // Actions
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateLocalPrefs: (updates: Partial<LocalPreferences>) => void;
  refreshProfile: () => Promise<void>;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [localPrefs, setLocalPrefs] = useState<LocalPreferences>(emptyLocalPrefs);

  // ============================================
  // FETCH PROFILE FROM SUPABASE
  // ============================================
  
  const fetchProfile = useCallback(async (uid: string) => {
    if (!supabase) {
      // Supabase not configured - use empty profile
      setProfile(emptyProfile);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the get_or_create_profile() RPC function
      // This creates a new profile if one doesn't exist
      const { data, error: rpcError } = await supabase.rpc('get_or_create_profile');
      
      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (data) {
        setProfile(dbRowToProfile(data as ProfileDbRow));
      } else {
        // Fallback: try to fetch directly
        const { data: selectData, error: selectError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is handled below
          throw new Error(selectError.message);
        }

        if (selectData) {
          setProfile(dbRowToProfile(selectData as ProfileDbRow));
        } else {
          // No profile exists and RPC failed - use empty profile
          setProfile(emptyProfile);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load profile';
      setError(message);
      console.error('Error fetching profile:', err);
      // Set empty profile on error so UI still works
      setProfile(emptyProfile);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================
  // LISTEN FOR AUTH STATE & FETCH PROFILE
  // ============================================
  
  useEffect(() => {
    // Load local preferences from localStorage
    setLocalPrefs(loadLocalPrefs());

    if (!supabase) {
      // Supabase not configured - just use empty profile
      setProfile(emptyProfile);
      setIsLoading(false);
      return;
    }

    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchProfile(data.user.id);
      } else {
        // Not logged in
        setUserId(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchProfile(session.user.id);
      } else {
        setUserId(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ============================================
  // UPDATE PROFILE (Supabase)
  // ============================================
  
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!supabase || !userId) {
      console.warn('Cannot update profile: no Supabase client or user');
      return;
    }

    setError(null);

    try {
      const dbUpdates = profileToDbUpdates(updates);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update(dbUpdates)
        .eq('id', userId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state optimistically
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, ...updates };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
      console.error('Error updating profile:', err);
      throw err; // Re-throw so caller can handle
    }
  }, [userId]);

  // ============================================
  // UPDATE LOCAL PREFERENCES (localStorage)
  // ============================================
  
  const updateLocalPrefs = useCallback((updates: Partial<LocalPreferences>) => {
    setLocalPrefs((prev) => {
      const newPrefs = { ...prev, ...updates };
      saveLocalPrefs(newPrefs);
      return newPrefs;
    });
  }, []);

  // ============================================
  // REFRESH PROFILE
  // ============================================
  
  const refreshProfile = useCallback(async () => {
    if (userId) {
      await fetchProfile(userId);
    }
  }, [userId, fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    localPrefs,
    updateProfile,
    updateLocalPrefs,
    refreshProfile,
  };
}

// ============================================
// LEGACY EXPORTS (for backward compatibility)
// Combine profile + localPrefs into single object
// ============================================

export interface CombinedProfile extends UserProfile, LocalPreferences {}

/**
 * @deprecated Use useProfile() directly instead
 * This hook maintains backward compatibility with existing code
 */
export function useCombinedProfile() {
  const { profile, localPrefs, isLoading, error, updateProfile, updateLocalPrefs } = useProfile();

  const combinedProfile: CombinedProfile = {
    // Profile fields (from Supabase)
    birthYear: profile?.birthYear ?? null,
    gender: profile?.gender ?? null,
    orientation: profile?.orientation ?? null,
    relationshipStatus: profile?.relationshipStatus ?? null,
    showAsSingle: profile?.showAsSingle ?? false,
    smartCheckinEnabled: profile?.smartCheckinEnabled ?? false,
    allowNotifications: profile?.allowNotifications ?? false,
    // Local preferences (from localStorage)
    ...localPrefs,
  };

  const updateCombinedProfile = useCallback(async (updates: Partial<CombinedProfile>) => {
    // Separate profile updates from local pref updates
    const profileUpdates: Partial<UserProfile> = {};
    const localUpdates: Partial<LocalPreferences> = {};

    if (updates.birthYear !== undefined) profileUpdates.birthYear = updates.birthYear;
    if (updates.gender !== undefined) profileUpdates.gender = updates.gender;
    if (updates.orientation !== undefined) profileUpdates.orientation = updates.orientation;
    if (updates.relationshipStatus !== undefined) profileUpdates.relationshipStatus = updates.relationshipStatus;
    if (updates.showAsSingle !== undefined) profileUpdates.showAsSingle = updates.showAsSingle;
    if (updates.smartCheckinEnabled !== undefined) profileUpdates.smartCheckinEnabled = updates.smartCheckinEnabled;
    if (updates.allowNotifications !== undefined) profileUpdates.allowNotifications = updates.allowNotifications;

    if (updates.defaultRelationshipStatus !== undefined) localUpdates.defaultRelationshipStatus = updates.defaultRelationshipStatus;
    if (updates.defaultOnsIntent !== undefined) localUpdates.defaultOnsIntent = updates.defaultOnsIntent;
    if (updates.defaultIntent !== undefined) localUpdates.defaultIntent = updates.defaultIntent;
    if (updates.favoriteCity !== undefined) localUpdates.favoriteCity = updates.favoriteCity;

    // Update local prefs synchronously
    if (Object.keys(localUpdates).length > 0) {
      updateLocalPrefs(localUpdates);
    }

    // Update Supabase profile asynchronously
    if (Object.keys(profileUpdates).length > 0) {
      await updateProfile(profileUpdates);
    }
  }, [updateProfile, updateLocalPrefs]);

  return {
    profile: combinedProfile,
    isLoading,
    isLoaded: !isLoading, // Legacy alias
    error,
    updateProfile: updateCombinedProfile,
  };
}
