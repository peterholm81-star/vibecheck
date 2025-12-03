/**
 * Vibe Users API
 * 
 * Functions for managing anonymous users in the vibe_users table.
 */

import { supabase } from './supabase';
import { getAnonUserId } from '../utils/anonUserId';

/**
 * Onboarding data structure matching the wizard steps
 */
export interface OnboardingData {
  mode: string | null;           // What user is looking for (danse, rolig_prat, etc.)
  mood: number | null;           // Energy level 1-4
  ageRange: string | null;       // Age group (18_24, 25_34, etc.)
  favoriteCityId: string | null; // City (trondheim, etc.)
}

/**
 * Map onboarding mode to goals array
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
 * Map mood number to energy level string
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
 * Map age range ID to display label
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
 * Map city ID to city name
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
 * 
 * Uses upsert: if the anon_user_id already exists, updates the row.
 * If not, creates a new row.
 * 
 * @param onboardingData - The collected onboarding preferences
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function saveOnboardingToSupabase(
  onboardingData: OnboardingData
): Promise<{ success: boolean; error?: string }> {
  // Check if Supabase is configured
  if (!supabase) {
    console.warn('Supabase not configured, skipping onboarding save');
    return { success: true }; // Return success to not block the user
  }

  try {
    const anonUserId = getAnonUserId();
    
    // Prepare data for vibe_users table
    const userData = {
      anon_user_id: anonUserId,
      city: cityIdToName(onboardingData.favoriteCityId),
      age_group: ageRangeToLabel(onboardingData.ageRange),
      energy_level: moodToEnergyLevel(onboardingData.mood),
      goals: modeToGoals(onboardingData.mode),
      onboarding_data: onboardingData,
      last_seen_at: new Date().toISOString(),
    };

    // Upsert: insert or update based on anon_user_id
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

