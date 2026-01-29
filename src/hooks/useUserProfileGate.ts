/**
 * User Profile Gate Hook
 * 
 * Single source of truth for user profile/onboarding status.
 * Loads vibe_users for auth.uid() and determines if user can access the app.
 * 
 * Profile is "complete" when:
 * - vibe_users row exists
 * - avatar_complete = true (meaning avatar gender + age range are set)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth/getCurrentUserId';

// ============================================
// TYPES
// ============================================

export interface UserProfile {
  id: string;                    // auth.uid()
  mode: string | null;
  vibe_preferences: string[] | null;
  age_group: string | null;
  onboarding_complete: boolean;
  avatar_gender: string | null;
  avatar_age_range: string | null;
  avatar_setup_complete: boolean;  // True when avatar is fully set up
}

export interface UseUserProfileGateResult {
  /** Loading state - show spinner while checking */
  isLoading: boolean;
  /** Profile data (null if not loaded or doesn't exist) */
  profile: UserProfile | null;
  /** Whether onboarding story has been seen (onboarding_complete = true) */
  isOnboardingComplete: boolean;
  /** Whether profile is complete (avatar_setup_complete = true, meaning gender+age saved) */
  isProfileComplete: boolean;
  /** Whether onboarding+avatar is complete (both flags true) */
  isComplete: boolean;
  /** Error message if any */
  error: string | null;
  /** User ID from auth.uid() */
  userId: string | null;
  /** Force refetch profile (call after saving) */
  refetch: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useUserProfileGate(): UseUserProfileGateResult {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Get auth.uid()
      const authUserId = await getCurrentUserId();
      setUserId(authUserId);

      if (!authUserId) {
        console.log('[ProfileGate] No authenticated user');
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (!supabase) {
        console.warn('[ProfileGate] Supabase not configured');
        setError('Database not configured');
        setIsLoading(false);
        return;
      }

      // 2. Fetch vibe_users row for this user
      const { data, error: fetchError } = await supabase
        .from('vibe_users')
        .select(`
          anon_user_id,
          mode,
          vibe_preferences,
          age_group,
          onboarding_complete,
          avatar_gender,
          avatar_age_range,
          avatar_setup_complete
        `)
        .eq('anon_user_id', authUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('[ProfileGate] Fetch error:', fetchError);
        setError(fetchError.message);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      if (!data) {
        // No profile row exists yet
        console.log('[ProfileGate] No profile found for user:', authUserId);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // 3. Map to typed profile
      const userProfile: UserProfile = {
        id: data.anon_user_id,
        mode: data.mode,
        vibe_preferences: data.vibe_preferences,
        age_group: data.age_group,
        onboarding_complete: data.onboarding_complete ?? false,
        avatar_gender: data.avatar_gender,
        avatar_age_range: data.avatar_age_range,
        avatar_setup_complete: data.avatar_setup_complete ?? false,
      };

      console.log('[ProfileGate] Profile loaded:', {
        id: userProfile.id,
        onboarding_complete: userProfile.onboarding_complete,
        avatar_setup_complete: userProfile.avatar_setup_complete,
      });

      setProfile(userProfile);
    } catch (err) {
      console.error('[ProfileGate] Exception:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Compute completion flags
  // isOnboardingComplete = story has been seen
  const isOnboardingComplete = !!(profile && profile.onboarding_complete);
  
  // isProfileComplete = gender + age have been saved (avatar_setup_complete = true)
  const isProfileComplete = !!(profile && profile.avatar_setup_complete);
  
  // isComplete = both phases done (backwards compatible)
  const isComplete = isOnboardingComplete && isProfileComplete;

  return {
    isLoading,
    profile,
    isOnboardingComplete,
    isProfileComplete,
    isComplete,
    error,
    userId,
    refetch: fetchProfile,
  };
}

/**
 * Check if profile is complete (for use outside React components)
 */
export async function checkProfileComplete(): Promise<boolean> {
  const authUserId = await getCurrentUserId();
  if (!authUserId || !supabase) return false;

  const { data, error } = await supabase
    .from('vibe_users')
    .select('onboarding_complete, avatar_setup_complete')
    .eq('anon_user_id', authUserId)
    .maybeSingle();

  if (error || !data) return false;

  return (data.onboarding_complete ?? false) && (data.avatar_setup_complete ?? false);
}

