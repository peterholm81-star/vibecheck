/**
 * Avatar Setup Constants
 * 
 * IMPORTANT: Age ranges MUST match the existing AgeBand type from useProfile.ts
 * to ensure consistency across the app.
 */

import type { AgeBand } from '../hooks/useProfile';

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
// AGE RANGE (reuses existing AgeBand type)
// ============================================

// Re-export AgeBand type for convenience
export type AvatarAgeRange = AgeBand;

// These MUST match the AgeBand values exactly
export const AVATAR_AGE_RANGE_OPTIONS: AvatarAgeRange[] = [
  '18_25',
  '25_30',
  '30_35',
  '35_40',
  '40_plus',
];

export const AVATAR_AGE_RANGE_LABELS: Record<AvatarAgeRange, string> = {
  '18_25': '18-25 år',
  '25_30': '25-30 år',
  '30_35': '30-35 år',
  '35_40': '35-40 år',
  '40_plus': '40+ år',
};

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

