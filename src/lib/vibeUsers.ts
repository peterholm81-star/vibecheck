/**
 * Vibe Users API
 * 
 * Functions for managing users in the vibe_users table.
 * Uses Supabase auth.uid() for user identification.
 */

import { supabase } from './supabase';
import { getCurrentUserId } from './auth/getCurrentUserId';

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
 * Now includes avatar fields for unified onboarding flow
 */
export interface OnboardingData2 {
  mode: string | null;              // What user is doing tonight (party, chill, date_night, etc.)
  vibe_preferences: string[];       // What user is looking for (danse, rolig_prat, flørte, ons, etc.)
  age_group: string | null;         // Age group (18-22, 23-27, etc.)
  onboarding_complete: boolean;     // Whether onboarding is finished
  // Avatar fields (for unified onboarding)
  avatar_gender?: string | null;    // 'male' | 'female'
  avatar_age_range?: string | null; // Uses standardized AGE_RANGES
  avatar_setup_complete?: boolean;  // Whether avatar is set up
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
 * Map onboarding age group values to standardized AGE_RANGES values.
 * Onboarding uses: '18-22', '23-27', '28-34', '35-44', '45+'
 * Standardized: '18–24', '25–34', '35–44', '45+' (uses en-dash)
 */
function normalizeAgeGroup(ageGroup: string | null): string | null {
  if (!ageGroup) return null;
  
  // Map onboarding values to standardized ranges
  const mapping: Record<string, string> = {
    '18-22': '18–24',
    '18-24': '18–24',
    '18–24': '18–24', // Already correct
    '23-27': '25–34',
    '25-34': '25–34',
    '25–34': '25–34', // Already correct
    '28-34': '25–34',
    '35-44': '35–44',
    '35–44': '35–44', // Already correct
    '45+': '45+',     // Already correct
  };
  
  const normalized = mapping[ageGroup];
  if (!normalized) {
    console.warn(`[vibeUsers] Unknown age_group value: "${ageGroup}"`);
    return null;
  }
  
  return normalized;
}

/**
 * Save or update onboarding data to Supabase vibe_users table.
 * Uses auth.uid() as the user identifier.
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const userData = {
      anon_user_id: userId, // Use auth.uid() as the identifier
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
 * Uses auth.uid() as the user identifier.
 * Uses the new fields: mode, vibe_preferences, age_group, onboarding_complete
 * 
 * Strategy:
 * 1. First try UPSERT (insert or update on conflict)
 * 2. If that fails, try INSERT
 * 3. If INSERT fails with conflict, try UPDATE
 * 4. Return detailed error info for debugging
 * 
 * @param data - The collected onboarding 2.0 preferences
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function saveOnboarding2ToSupabase(
  data: OnboardingData2
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    console.warn('[Onboarding] Supabase ikke konfigurert, hopper over lagring');
    return { success: true };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    console.error('[Onboarding] Ikke autentisert');
    return { success: false, error: 'Ikke autentisert' };
  }
  
  // Normalize age_group to standardized format
  const normalizedAgeGroup = normalizeAgeGroup(data.age_group);
  
  // Build user data object
  const userData: Record<string, unknown> = {
    anon_user_id: userId, // Use auth.uid() as the identifier
    mode: data.mode,
    vibe_preferences: data.vibe_preferences,
    age_group: normalizedAgeGroup, // Use normalized value
    onboarding_complete: data.onboarding_complete,
    last_seen_at: new Date().toISOString(),
  };

  // Include avatar fields if provided
  if (data.avatar_gender !== undefined) {
    userData.avatar_gender = data.avatar_gender;
  }
  if (data.avatar_age_range !== undefined) {
    userData.avatar_age_range = data.avatar_age_range;
  }
  if (data.avatar_setup_complete !== undefined) {
    userData.avatar_setup_complete = data.avatar_setup_complete;
  }

  console.log('[Onboarding] Lagrer data for bruker:', userId);
  console.log('[Onboarding] age_group normalized:', data.age_group, '->', normalizedAgeGroup);
  console.log('[Onboarding] avatar_setup_complete:', data.avatar_setup_complete);
  console.log('[Onboarding] Data som sendes:', userData);

  try {
    // Strategi 1: Prøv UPSERT først (mest vanlig)
    const { error: upsertError } = await supabase
      .from('vibe_users')
      .upsert(userData, {
        onConflict: 'anon_user_id',
      });

    if (!upsertError) {
      console.log('[Onboarding] ✅ Upsert vellykket!');
      return { success: true };
    }

    console.warn('[Onboarding] Upsert feilet, prøver INSERT:', upsertError.message);

    // Strategi 2: Prøv INSERT (kanskje brukeren ikke eksisterer ennå)
    const { error: insertError } = await supabase
      .from('vibe_users')
      .insert(userData);

    if (!insertError) {
      console.log('[Onboarding] ✅ Insert vellykket!');
      return { success: true };
    }

    // Sjekk om det er en duplikat-feil (brukeren finnes allerede)
    if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
      console.warn('[Onboarding] Bruker finnes allerede, prøver UPDATE:', insertError.message);

      // Strategi 3: Prøv UPDATE
      // Build update data including avatar fields if present
      const updateData: Record<string, unknown> = {
        mode: data.mode,
        vibe_preferences: data.vibe_preferences,
        age_group: normalizedAgeGroup, // Use normalized value
        onboarding_complete: data.onboarding_complete,
        last_seen_at: new Date().toISOString(),
      };
      if (data.avatar_gender !== undefined) {
        updateData.avatar_gender = data.avatar_gender;
      }
      if (data.avatar_age_range !== undefined) {
        updateData.avatar_age_range = data.avatar_age_range;
      }
      if (data.avatar_setup_complete !== undefined) {
        updateData.avatar_setup_complete = data.avatar_setup_complete;
      }
      
      const { error: updateError } = await supabase
        .from('vibe_users')
        .update(updateData)
        .eq('anon_user_id', userId);

      if (!updateError) {
        console.log('[Onboarding] ✅ Update vellykket!');
        return { success: true };
      }

      console.error('[Onboarding] ❌ Alle metoder feilet. Update-feil:', updateError);
      console.error('[Onboarding] Feilkode:', updateError.code);
      console.error('[Onboarding] Feilmelding:', updateError.message);
      console.error('[Onboarding] Hint:', updateError.hint || 'Ingen hint');
      console.error('[Onboarding] Detaljer:', updateError.details || 'Ingen detaljer');
      
      return { 
        success: false, 
        error: `Kunne ikke oppdatere bruker (${updateError.code}): ${updateError.message}` 
      };
    }

    // INSERT feilet av annen grunn
    console.error('[Onboarding] ❌ Insert feilet (ikke duplikat):', insertError);
    console.error('[Onboarding] Feilkode:', insertError.code);
    console.error('[Onboarding] Feilmelding:', insertError.message);
    console.error('[Onboarding] Hint:', insertError.hint || 'Ingen hint');
    console.error('[Onboarding] Detaljer:', insertError.details || 'Ingen detaljer');
    
    // Spesialhåndtering for RLS-feil
    if (insertError.code === '42501' || insertError.message.includes('policy')) {
      console.error('[Onboarding] 🔒 RLS POLICY FEIL: Tabellen mangler sannsynligvis INSERT-policy for anonymous users');
      return { 
        success: false, 
        error: 'Tilgangsfeil (RLS). Kontakt administrator.' 
      };
    }
    
    return { 
      success: false, 
      error: `Lagring feilet (${insertError.code}): ${insertError.message}` 
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Ukjent feil';
    console.error('[Onboarding] ❌ Exception under lagring:', err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if user has completed onboarding.
 * Uses auth.uid() to check the vibe_users table.
 * Falls back to localStorage for offline support.
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
    const userId = await getCurrentUserId();
    if (!userId) {
      return localComplete;
    }
    
    const { data, error } = await supabase
      .from('vibe_users')
      .select('onboarding_complete')
      .eq('anon_user_id', userId)
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
 * Update last_seen_at timestamp for the current user.
 * Uses auth.uid() for identification.
 * Used when user opens the map screen.
 * 
 * This is a fire-and-forget operation - errors are logged but don't block UI.
 */
export async function updateLastSeen(): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    await supabase
      .from('vibe_users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('anon_user_id', userId);
      
  } catch (err) {
    // Fire-and-forget: just log errors
    console.error('Failed to update last_seen_at:', err);
  }
}

/**
 * Check if user has a vibe_users row (onboarding complete).
 * This is used as a guard before check-in.
 * 
 * @returns Promise<boolean> - true if user exists in vibe_users
 */
export async function hasVibeUsersRow(): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) return false;
    
    const { data, error } = await supabase
      .from('vibe_users')
      .select('anon_user_id')
      .eq('anon_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[hasVibeUsersRow] Error:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[hasVibeUsersRow] Exception:', err);
    return false;
  }
}
