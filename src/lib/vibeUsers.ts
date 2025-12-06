/**
 * Vibe Users API
 * 
 * Functions for managing anonymous users in the vibe_users table.
 */

import { supabase } from './supabase';
import { getAnonUserId } from '../utils/anonUserId';

// ============================================
// SQL FOR SUPABASE (KJØRES MANUELT I SUPABASE SQL EDITOR):
// ============================================
// ALTER TABLE public.vibe_users
//   ADD COLUMN IF NOT EXISTS mode text,
//   ADD COLUMN IF NOT EXISTS vibe_preferences text[],
//   ADD COLUMN IF NOT EXISTS age_group text,
//   ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
// ============================================

/**
 * Onboarding 2.0 data structure matching the new wizard steps
 */
export interface OnboardingData2 {
  mode: string | null;              // What user is doing tonight (party, chill, date_night, etc.)
  vibe_preferences: string[];       // What user is looking for (danse, rolig_prat, flørte, ons, etc.)
  age_group: string | null;         // Age group (18-22, 23-27, etc.)
  onboarding_complete: boolean;     // Whether onboarding is finished
}

/**
 * Extended vibe_users row type (matches Supabase table with new fields)
 */
export interface VibeUserRow {
  anon_user_id: string;
  city: string | null;
  age_group: string | null;
  energy_level: string | null;
  goals: string[] | null;
  mode: string | null;
  vibe_preferences: string[] | null;
  onboarding_complete: boolean;
  onboarding_data: Record<string, unknown> | null;
  created_at: string;
  last_seen_at: string;
}

/**
 * Legacy onboarding data structure (for backwards compatibility)
 */
export interface OnboardingData {
  mode: string | null;           // What user is looking for (danse, rolig_prat, etc.)
  mood: number | null;           // Energy level 1-4
  ageRange: string | null;       // Age group (18_24, 25_34, etc.)
  favoriteCityId: string | null; // City (trondheim, etc.)
}

/**
 * Map onboarding mode to goals array (legacy)
 */
function modeToGoals(mode: string | null): string[] {
  if (!mode) return [];
  
  const modeLabels: Record<string, string> = {
    danse: 'Danse',
    rolig_prat: 'Rolig prat',
    live_musikk: 'Live musikk',
    florte: 'Flørte',
    mote_nye: 'Møte nye',
    ons: 'One night stand',
    chill: 'Chill',
    venner: 'Ute med venner',
  };
  
  return modeLabels[mode] ? [modeLabels[mode]] : [];
}

/**
 * Map mood number to energy level string (legacy)
 */
function moodToEnergyLevel(mood: number | null): string | null {
  if (!mood) return null;
  
  const levels: Record<number, string> = {
    1: 'Lav energi',
    2: 'Chill',
    3: 'Sosial',
    4: 'Full guffe',
  };
  
  return levels[mood] || null;
}

/**
 * Map age range ID to display label (legacy)
 */
function ageRangeToLabel(ageRange: string | null): string | null {
  if (!ageRange) return null;
  
  const labels: Record<string, string> = {
    '18_24': '18–24',
    '25_34': '25–34',
    '35_44': '35–44',
    '45_plus': '45+',
  };
  
  return labels[ageRange] || null;
}

/**
 * Map city ID to city name (legacy)
 */
function cityIdToName(cityId: string | null): string | null {
  if (!cityId) return null;
  
  const cities: Record<string, string> = {
    trondheim: 'Trondheim',
  };
  
  return cities[cityId] || null;
}

/**
 * Save or update onboarding data to Supabase vibe_users table.
 * (Legacy function for backwards compatibility)
 */
export async function saveOnboardingToSupabase(
  onboardingData: OnboardingData
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    console.warn('Supabase not configured, skipping onboarding save');
    return { success: true };
  }

  try {
    const anonUserId = getAnonUserId();
    
    const userData = {
      anon_user_id: anonUserId,
      city: cityIdToName(onboardingData.favoriteCityId),
      age_group: ageRangeToLabel(onboardingData.ageRange),
      energy_level: moodToEnergyLevel(onboardingData.mood),
      goals: modeToGoals(onboardingData.mode),
      onboarding_data: onboardingData,
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('vibe_users')
      .upsert(userData, {
        onConflict: 'anon_user_id',
      });

    if (error) {
      console.error('Failed to save onboarding to Supabase:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to save onboarding to Supabase:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Save Onboarding 2.0 data to Supabase vibe_users table.
 * Uses the new fields: mode, vibe_preferences, age_group, onboarding_complete
 * 
 * @param data - The collected onboarding 2.0 preferences
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function saveOnboarding2ToSupabase(
  data: OnboardingData2
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    console.warn('Supabase not configured, skipping onboarding save');
    return { success: true };
  }

  try {
    const anonUserId = getAnonUserId();
    
    const userData = {
      anon_user_id: anonUserId,
      mode: data.mode,
      vibe_preferences: data.vibe_preferences,
      age_group: data.age_group,
      onboarding_complete: data.onboarding_complete,
      last_seen_at: new Date().toISOString(),
    };

    console.log('[saveOnboarding2] Saving data for user:', anonUserId);
    console.log('[saveOnboarding2] Data:', userData);

    const { error } = await supabase
      .from('vibe_users')
      .upsert(userData, {
        onConflict: 'anon_user_id',
      });

    if (error) {
      console.error('[saveOnboarding2] Supabase error:', error);
      return { success: false, error: error.message };
    }

    console.log('[saveOnboarding2] Success!');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[saveOnboarding2] Exception:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if user has completed onboarding.
 * Checks both Supabase (onboarding_complete field) and localStorage fallback.
 * 
 * @returns Promise<boolean> - true if onboarding is complete
 */
export async function checkOnboardingComplete(): Promise<boolean> {
  // First check localStorage (fallback/offline support)
  const localComplete = localStorage.getItem('vibecheck_onboarding_complete') === 'true';
  
  if (!supabase) {
    return localComplete;
  }

  try {
    const anonUserId = getAnonUserId();
    
    const { data, error } = await supabase
      .from('vibe_users')
      .select('onboarding_complete')
      .eq('anon_user_id', anonUserId)
      .maybeSingle();

    if (error) {
      console.error('[checkOnboardingComplete] Error:', error);
      return localComplete; // Fallback to localStorage
    }

    // If user exists in DB, use their status
    if (data) {
      return data.onboarding_complete === true;
    }

    // No user in DB - use localStorage
    return localComplete;
  } catch (err) {
    console.error('[checkOnboardingComplete] Exception:', err);
    return localComplete;
  }
}

/**
 * Update last_seen_at timestamp for the current anonymous user.
 * Used when user opens the map screen.
 * 
 * This is a fire-and-forget operation - errors are logged but don't block UI.
 */
export async function updateLastSeen(): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    const anonUserId = getAnonUserId();
    
    await supabase
      .from('vibe_users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('anon_user_id', anonUserId);
      
  } catch (err) {
    // Fire-and-forget: just log errors
    console.error('Failed to update last_seen_at:', err);
  }
}
