import { useEffect, useState, useCallback } from "react";
import type { RelationshipStatus, OnsIntent, Intent } from "../types";

// ============================================
// PROFILE TYPES
// ============================================

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";

export type AgeBand = "18_25" | "25_30" | "30_35" | "35_40" | "40_plus";

export type FavoriteCity = "auto" | "Trondheim" | "Oslo" | "Bergen";

export interface UserProfile {
  birthYear: number | null;
  gender: Gender | null;
  defaultRelationshipStatus: RelationshipStatus | null;
  defaultOnsIntent: OnsIntent | null;
  defaultIntent: Intent | null;
  favoriteCity: FavoriteCity;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = "vibecheck_profile";

const emptyProfile: UserProfile = {
  birthYear: null,
  gender: null,
  defaultRelationshipStatus: null,
  defaultOnsIntent: null,
  defaultIntent: null,
  favoriteCity: "auto",
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Mann",
  female: "Kvinne",
  other: "Annet",
  prefer_not_to_say: "Foretrekker å ikke si",
};

export const GENDER_OPTIONS: Gender[] = ["male", "female", "other", "prefer_not_to_say"];

export const FAVORITE_CITY_OPTIONS: FavoriteCity[] = ["auto", "Trondheim", "Oslo", "Bergen"];

export const FAVORITE_CITY_LABELS: Record<FavoriteCity, string> = {
  auto: "Automatisk (geolocation)",
  Trondheim: "Trondheim",
  Oslo: "Oslo",
  Bergen: "Bergen",
};

// ============================================
// HOOK
// ============================================

export function useProfile() {
  const [profile, setProfileState] = useState<UserProfile>(emptyProfile);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load profile from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UserProfile>;
        setProfileState({
          birthYear: parsed.birthYear ?? null,
          gender: parsed.gender ?? null,
          defaultRelationshipStatus: parsed.defaultRelationshipStatus ?? null,
          defaultOnsIntent: parsed.defaultOnsIntent ?? null,
          defaultIntent: parsed.defaultIntent ?? null,
          favoriteCity: parsed.favoriteCity ?? "auto",
        });
      }
    } catch {
      // Ignore parse errors, use empty profile
    }
    setIsLoaded(true);
  }, []);

  // Save profile to localStorage
  const saveToStorage = useCallback((newProfile: UserProfile) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Set entire profile
  const setProfile = useCallback((updater: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setProfileState((prev) => {
      const newProfile = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(newProfile);
      return newProfile;
    });
  }, [saveToStorage]);

  // Update partial profile
  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    setProfileState((prev) => {
      const newProfile = { ...prev, ...partial };
      saveToStorage(newProfile);
      return newProfile;
    });
  }, [saveToStorage]);

  // Clear profile
  const clearProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    setProfileState(emptyProfile);
  }, []);

  return {
    profile,
    setProfile,
    updateProfile,
    clearProfile,
    isLoaded,
  };
}
