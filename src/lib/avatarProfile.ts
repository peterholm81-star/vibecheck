/**
 * Avatar Profile API
 * 
 * Functions for managing avatar profile data in vibe_users table.
 * Uses auth.uid() for user identification.
 */

import { supabase } from './supabase';
import { getCurrentUserId } from './auth/getCurrentUserId';
import type { 
  AvatarProfile, 
  AvatarGender, 
  AvatarAgeRange, 
  AvatarRelationshipStatus,
  AvatarEnergy,
  AvatarStyle,
} from '../constants/avatarSetup';
import { emptyAvatarProfile } from '../constants/avatarSetup';

// ============================================
// DATABASE ROW TYPE
// ============================================

interface AvatarDbRow {
  avatar_gender: string | null;
  avatar_age_range: string | null;
  show_relationship: boolean | null;
  relationship_status: string | null;
  show_ons: boolean | null;
  open_for_ons: boolean | null;
  energy: string | null;
  style: string | null;
  avatar_setup_complete: boolean | null;
}

// ============================================
// MAPPING FUNCTIONS
// ============================================

function dbRowToAvatarProfile(row: AvatarDbRow | null): AvatarProfile {
  if (!row) return emptyAvatarProfile;
  
  return {
    avatarGender: (row.avatar_gender as AvatarGender) ?? null,
    avatarAgeRange: (row.avatar_age_range as AvatarAgeRange) ?? null,
    showRelationship: row.show_relationship ?? false,
    relationshipStatus: (row.relationship_status as AvatarRelationshipStatus) ?? null,
    showOns: row.show_ons ?? false,
    openForOns: row.open_for_ons ?? null,
    energy: (row.energy as AvatarEnergy) ?? null,
    style: (row.style as AvatarStyle) ?? null,
    avatarSetupComplete: row.avatar_setup_complete ?? false,
  };
}

function avatarProfileToDbUpdates(profile: Partial<AvatarProfile>): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  
  if (profile.avatarGender !== undefined) {
    updates.avatar_gender = profile.avatarGender;
  }
  if (profile.avatarAgeRange !== undefined) {
    updates.avatar_age_range = profile.avatarAgeRange;
  }
  if (profile.showRelationship !== undefined) {
    updates.show_relationship = profile.showRelationship;
  }
  if (profile.relationshipStatus !== undefined) {
    updates.relationship_status = profile.relationshipStatus;
  }
  if (profile.showOns !== undefined) {
    updates.show_ons = profile.showOns;
  }
  if (profile.openForOns !== undefined) {
    updates.open_for_ons = profile.openForOns;
  }
  if (profile.energy !== undefined) {
    updates.energy = profile.energy;
  }
  if (profile.style !== undefined) {
    updates.style = profile.style;
  }
  if (profile.avatarSetupComplete !== undefined) {
    updates.avatar_setup_complete = profile.avatarSetupComplete;
  }
  
  return updates;
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get current user's avatar profile from vibe_users
 * Uses auth.uid() for identification
 */
export async function getCurrentAvatarProfile(): Promise<AvatarProfile> {
  if (!supabase) {
    console.warn('[AvatarProfile] Supabase not configured');
    return emptyAvatarProfile;
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[AvatarProfile] Not authenticated');
      return emptyAvatarProfile;
    }
    
    const { data, error } = await supabase
      .from('vibe_users')
      .select(`
        avatar_gender,
        avatar_age_range,
        show_relationship,
        relationship_status,
        show_ons,
        open_for_ons,
        energy,
        style,
        avatar_setup_complete
      `)
      .eq('anon_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AvatarProfile] Error fetching profile:', error);
      return emptyAvatarProfile;
    }

    return dbRowToAvatarProfile(data);
  } catch (err) {
    console.error('[AvatarProfile] Exception:', err);
    return emptyAvatarProfile;
  }
}

/**
 * Update current user's avatar profile
 * Uses auth.uid() for identification
 */
export async function updateAvatarProfile(
  updates: Partial<AvatarProfile>
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    console.warn('[AvatarProfile] Supabase not configured');
    return { success: false, error: 'Database not configured' };
  }

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const dbUpdates = avatarProfileToDbUpdates(updates);
    
    // Add timestamp
    dbUpdates.last_seen_at = new Date().toISOString();

    console.log('[AvatarProfile] Updating profile for user:', userId);

    // Try upsert first
    const { error: upsertError } = await supabase
      .from('vibe_users')
      .upsert(
        {
          anon_user_id: userId, // Use auth.uid()
          ...dbUpdates,
        },
        { onConflict: 'anon_user_id' }
      );

    if (!upsertError) {
      console.log('[AvatarProfile] ✅ Profile updated successfully');
      return { success: true };
    }

    console.warn('[AvatarProfile] Upsert failed, trying update:', upsertError.message);

    // Fallback to update
    const { error: updateError } = await supabase
      .from('vibe_users')
      .update(dbUpdates)
      .eq('anon_user_id', userId);

    if (updateError) {
      console.error('[AvatarProfile] Update failed:', updateError);
      return { success: false, error: updateError.message };
    }

    console.log('[AvatarProfile] ✅ Profile updated (via update)');
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AvatarProfile] Exception:', err);
    return { success: false, error: message };
  }
}

/**
 * Check if current user has completed avatar setup
 * This is used for gating before entering Venue Rooms
 */
export async function checkAvatarSetupComplete(): Promise<boolean> {
  const profile = await getCurrentAvatarProfile();
  return profile.avatarSetupComplete && !!profile.avatarGender && !!profile.avatarAgeRange;
}

/**
 * Mark avatar setup as complete
 */
export async function completeAvatarSetup(
  profile: Pick<AvatarProfile, 'avatarGender' | 'avatarAgeRange'> & Partial<AvatarProfile>
): Promise<{ success: boolean; error?: string }> {
  return updateAvatarProfile({
    ...profile,
    avatarSetupComplete: true,
  });
}

