/**
 * AvatarChip Component
 * 
 * Displays a user avatar with:
 * - Gender icon/label
 * - Age badge
 * - Optional tags: relationship (if show_relationship), ONS (if show_ons)
 * - Optional energy badge
 * 
 * Reuses existing types from avatarSetup constants.
 */

import { Heart, Flame } from 'lucide-react';
import type { AgeBand } from '../../hooks/useProfile';
import {
  type AvatarGender,
  type AvatarRelationshipStatus,
  type AvatarEnergy,
  AVATAR_GENDER_LABELS,
  AVATAR_AGE_RANGE_LABELS,
  AVATAR_RELATIONSHIP_LABELS,
  AVATAR_ENERGY_LABELS,
} from '../../constants/avatarSetup';

// Re-export AgeBand as AvatarAgeRange for component interface
export type AvatarAgeRange = AgeBand;

export interface AvatarChipData {
  avatarGender: AvatarGender | null;
  avatarAgeRange: AvatarAgeRange | null;
  showRelationship?: boolean;
  relationshipStatus?: AvatarRelationshipStatus | null;
  showOns?: boolean;
  openForOns?: boolean | null;
  energy?: AvatarEnergy | null;
  isCurrentUser?: boolean;
}

interface AvatarChipProps {
  data: AvatarChipData;
  size?: 'sm' | 'md' | 'lg';
}

export function AvatarChip({ data, size = 'md' }: AvatarChipProps) {
  const {
    avatarGender,
    avatarAgeRange,
    showRelationship,
    relationshipStatus,
    showOns,
    openForOns,
    energy,
    isCurrentUser,
  } = data;

  // Size classes
  const sizeClasses = {
    sm: 'p-2 min-w-[80px]',
    md: 'p-3 min-w-[100px]',
    lg: 'p-4 min-w-[120px]',
  };

  const iconSize = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const textSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  // Gender icon
  const genderIcon = avatarGender === 'male' ? '👨' : avatarGender === 'female' ? '👩' : '👤';

  // If no data, show placeholder
  if (!avatarGender || !avatarAgeRange) {
    return (
      <div className={`${sizeClasses[size]} bg-slate-700/50 rounded-xl border border-slate-600 text-center`}>
        <div className={`${iconSize[size]} mb-1`}>👤</div>
        <p className={`${textSize[size]} text-slate-500`}>Ikke satt opp</p>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-xl border text-center transition-all ${
        isCurrentUser
          ? 'bg-violet-500/20 border-violet-500/50'
          : 'bg-slate-800 border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Gender icon */}
      <div className={`${iconSize[size]} mb-1`}>{genderIcon}</div>

      {/* Gender label */}
      <p className={`${textSize[size]} font-medium ${isCurrentUser ? 'text-violet-300' : 'text-slate-200'}`}>
        {AVATAR_GENDER_LABELS[avatarGender]}
      </p>

      {/* Age badge */}
      <p className={`${textSize[size]} text-slate-400 mt-0.5`}>
        {AVATAR_AGE_RANGE_LABELS[avatarAgeRange]}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap justify-center gap-1 mt-2">
        {/* Relationship tag */}
        {showRelationship && relationshipStatus && (
          <span
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${textSize[size]} font-medium ${
              relationshipStatus === 'single'
                ? 'bg-pink-500/20 text-pink-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            <Heart size={10} />
            {AVATAR_RELATIONSHIP_LABELS[relationshipStatus]}
          </span>
        )}

        {/* ONS tag */}
        {showOns && openForOns !== null && openForOns && (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${textSize[size]} font-medium bg-orange-500/20 text-orange-300`}>
            <Flame size={10} />
            Åpen
          </span>
        )}

        {/* Energy tag */}
        {energy && (
          <span className={`px-1.5 py-0.5 rounded-full ${textSize[size]} font-medium bg-emerald-500/20 text-emerald-300`}>
            {AVATAR_ENERGY_LABELS[energy].split(' ')[0]}
          </span>
        )}
      </div>

      {/* Current user indicator */}
      {isCurrentUser && (
        <p className={`${textSize[size]} text-violet-400 mt-2 font-medium`}>Du</p>
      )}
    </div>
  );
}

export default AvatarChip;

