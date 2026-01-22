/**
 * Avatar Setup Constants
 * 
 * IMPORTANT: Age ranges use the single source of truth from constants/ageRanges.ts
 */

import { AGE_RANGES, AGE_RANGE_LABELS, type AgeRange } from './ageRanges';

// ============================================
// AVATAR GENDER (simplified for avatar display)
// ============================================

export type AvatarGender = 'male' | 'female';

export const AVATAR_GENDER_OPTIONS: AvatarGender[] = ['male', 'female'];

export const AVATAR_GENDER_LABELS: Record<AvatarGender, string> = {
  male: 'Mann',
  female: 'Kvinne',
};

// ============================================
// AGE RANGE (uses single source of truth)
// ============================================

// Re-export from single source of truth
export type AvatarAgeRange = AgeRange;

// These MUST match the DB constraint exactly
export const AVATAR_AGE_RANGE_OPTIONS: readonly AgeRange[] = AGE_RANGES;

export const AVATAR_AGE_RANGE_LABELS: Record<AgeRange, string> = AGE_RANGE_LABELS;

// ============================================
// RELATIONSHIP STATUS (for avatar display)
// ============================================

export type AvatarRelationshipStatus = 'single' | 'relationship';

export const AVATAR_RELATIONSHIP_OPTIONS: AvatarRelationshipStatus[] = ['single', 'relationship'];

export const AVATAR_RELATIONSHIP_LABELS: Record<AvatarRelationshipStatus, string> = {
  single: 'Singel',
  relationship: 'I forhold',
};

// ============================================
// ENERGY / MOOD (optional)
// ============================================

export type AvatarEnergy = 'calm' | 'curious' | 'playful';

export const AVATAR_ENERGY_OPTIONS: AvatarEnergy[] = ['calm', 'curious', 'playful'];

export const AVATAR_ENERGY_LABELS: Record<AvatarEnergy, string> = {
  calm: '😌 Rolig',
  curious: '🤔 Nysgjerrig',
  playful: '😜 Leken',
};

// ============================================
// STYLE (optional)
// ============================================

export type AvatarStyle = 'neutral' | 'marked';

export const AVATAR_STYLE_OPTIONS: AvatarStyle[] = ['neutral', 'marked'];

export const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  neutral: 'Nøytral',
  marked: 'Markert',
};

// ============================================
// AVATAR PROFILE TYPE
// ============================================

export interface AvatarProfile {
  avatarGender: AvatarGender | null;
  avatarAgeRange: AvatarAgeRange | null;
  showRelationship: boolean;
  relationshipStatus: AvatarRelationshipStatus | null;
  showOns: boolean;
  openForOns: boolean | null;
  energy: AvatarEnergy | null;
  style: AvatarStyle | null;
  avatarSetupComplete: boolean;
}

export const emptyAvatarProfile: AvatarProfile = {
  avatarGender: null,
  avatarAgeRange: null,
  showRelationship: false,
  relationshipStatus: null,
  showOns: false,
  openForOns: null,
  energy: null,
  style: null,
  avatarSetupComplete: false,
};

// ============================================
// VALIDATION
// ============================================

/**
 * Check if avatar setup is complete (required fields filled)
 */
export function isAvatarSetupComplete(profile: AvatarProfile | null): boolean {
  if (!profile) return false;
  return !!(profile.avatarGender && profile.avatarAgeRange);
}

