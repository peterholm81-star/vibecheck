/**
 * AvatarChip Component - MyHeritage-inspired design
 * 
 * Mature, anonymous avatar card with:
 * - Abstract silhouette avatar (no emoji)
 * - Primary intent message (one clear message)
 * - Muted metadata (age range, presence)
 * - Single low-pressure action button
 * 
 * Design goals:
 * - Safe to glance at in public
 * - Non-dating aesthetic
 * - Calm, confident, adult hierarchy
 */

import type { AgeBand } from '../../hooks/useProfile';
import type { AvatarGender, AvatarEnergy } from '../../constants/avatarSetup';
import { AVATAR_AGE_RANGE_LABELS } from '../../constants/avatarSetup';

// Re-export AgeBand as AvatarAgeRange for component interface
export type AvatarAgeRange = AgeBand;

// Keep interface for backwards compatibility (fields are used for intent mapping)
export interface AvatarChipData {
  avatarGender: AvatarGender | null;
  avatarAgeRange: AvatarAgeRange | null;
  showRelationship?: boolean;
  relationshipStatus?: string | null;
  showOns?: boolean;
  openForOns?: boolean | null;
  energy?: AvatarEnergy | null;
  isCurrentUser?: boolean;
}

interface AvatarChipProps {
  data: AvatarChipData;
  size?: 'sm' | 'md' | 'lg';
  /** Optional click handler for interaction */
  onClick?: () => void;
  /** Optional interaction preview text (e.g., "They responded") */
  interactionPreview?: string | null;
}

/**
 * Map existing energy field to intent text
 * This uses existing data without requiring DB changes
 */
function getIntentText(energy: AvatarEnergy | null | undefined): string {
  switch (energy) {
    case 'curious':
      return 'Open to conversation';
    case 'playful':
      return 'Here with friends';
    case 'calm':
      return 'Just observing tonight';
    default:
      return 'At this venue';
  }
}

/**
 * Normalize gender values from various formats
 */
function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g === 'w') return 'female';
  if (g === 'male' || g === 'man' || g === 'm') return 'male';
  return null;
}

/**
 * Get display text for gender (subtle, not a badge)
 */
function getGenderLabel(gender: 'male' | 'female' | null): string {
  switch (gender) {
    case 'female':
      return 'Woman';
    case 'male':
      return 'Man';
    default:
      return '';
  }
}

// ============================================
// ACCENT COLOR - Single consistent color
// ============================================
const ACCENT_COLOR = '#8b5cf6'; // violet-500

/**
 * Gendered Silhouette Avatar - MyHeritage-inspired
 * Distinct silhouettes for male/female, neutral fallback
 */
function SilhouetteAvatar({ 
  size, 
  gender,
  isCurrentUser 
}: { 
  size: 'sm' | 'md' | 'lg';
  gender: 'male' | 'female' | null;
  isCurrentUser?: boolean;
}) {
  const dimensions = {
    sm: 44,
    md: 56,
    lg: 72,
  };
  
  const dim = dimensions[size];
  
  // Female silhouette - with hair shape
  const FemaleSilhouette = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-3/5 h-3/5 text-slate-400">
      <path d="M12 2C9 2 7 4 7 7v1c0 2 1.5 4 5 4s5-2 5-4V7c0-3-2-5-5-5z" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3.5" ry="3" fill="#64748b" />
      <path d="M12 13c-5 0-8 3-8 7h16c0-4-3-7-8-7z" fill="currentColor" />
      <path d="M7 7c0-1 0-2 .5-3C6.5 5 6 6.5 6 8c0 2 1 4 2 5-1-1-1-3-1-4V7z" fill="currentColor" />
      <path d="M17 7c0-1 0-2-.5-3 1 1 1.5 2.5 1.5 4 0 2-1 4-2 5 1-1 1-3 1-4V7z" fill="currentColor" />
    </svg>
  );
  
  // Male silhouette - simpler head shape
  const MaleSilhouette = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-3/5 h-3/5 text-slate-400">
      <circle cx="12" cy="7.5" r="4.5" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3" ry="2.8" fill="#64748b" />
      <rect x="10" y="11" width="4" height="2" fill="currentColor" />
      <path d="M12 13c-6 0-9 3-9 7h18c0-4-3-7-9-7z" fill="currentColor" />
    </svg>
  );
  
  // Neutral silhouette - generic person
  const NeutralSilhouette = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-3/5 h-3/5 text-slate-500">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
    </svg>
  );
  
  return (
    <div 
      className="relative mx-auto"
      style={{ width: dim, height: dim }}
    >
      {/* Outer ring - accent color for presence */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{ 
          border: `2px solid ${ACCENT_COLOR}`,
          opacity: isCurrentUser ? 0.8 : 0.4,
        }}
      />
      
      {/* Avatar background */}
      <div className="absolute inset-[3px] rounded-full bg-slate-700/80 flex items-center justify-center overflow-hidden">
        {gender === 'female' && <FemaleSilhouette />}
        {gender === 'male' && <MaleSilhouette />}
        {!gender && <NeutralSilhouette />}
      </div>
    </div>
  );
}

export function AvatarChip({ data, size = 'md', onClick, interactionPreview }: AvatarChipProps) {
  const {
    avatarGender,
    avatarAgeRange,
    energy,
    isCurrentUser,
  } = data;

  // Normalize gender for display and silhouette
  const normalizedGender = normalizeGender(avatarGender);
  const genderLabel = getGenderLabel(normalizedGender);

  // Fixed height configurations for consistent card sizes
  // MyHeritage-inspired: more padding, taller cards
  const cardConfig = {
    sm: {
      height: 'h-[220px]',
      padding: 'p-4',
      width: 'w-full',
    },
    md: {
      height: 'h-[260px]',
      padding: 'p-5',
      width: 'w-full',
    },
    lg: {
      height: 'h-[300px]',
      padding: 'p-6',
      width: 'w-full max-w-[240px]',
    },
  };

  const config = cardConfig[size];

  // If no data, show placeholder
  if (!avatarGender || !avatarAgeRange) {
    return (
      <div className={`${config.height} ${config.padding} ${config.width} bg-slate-850 rounded-xl border border-slate-700/40 flex flex-col items-center justify-center shadow-sm`}>
        <SilhouetteAvatar size={size} gender={null} />
        <p className="text-[11px] text-slate-500 mt-4">Profile not set up</p>
      </div>
    );
  }

  // Get intent text from energy field
  const intentText = getIntentText(energy);
  
  // Get age label
  const ageLabel = AVATAR_AGE_RANGE_LABELS[avatarAgeRange] || avatarAgeRange;

  // Determine if clickable
  const isClickable = !!onClick && !isCurrentUser;

  return (
    <div
      className={`
        ${config.height}
        ${config.width}
        rounded-xl
        border
        transition-all
        duration-150
        flex flex-col
        shadow-sm
        overflow-hidden
        ${isCurrentUser
          ? 'bg-slate-800/95 border-violet-500/25'
          : 'bg-slate-800/80 border-slate-700/40 hover:border-slate-600/60 hover:shadow-md'
        }
        ${isClickable ? 'cursor-pointer active:scale-[0.98]' : ''}
      `}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* ===== HEADER: Avatar (fixed size) ===== */}
      <div className="flex-shrink-0 text-center pt-4 px-4">
        <SilhouetteAvatar size={size} gender={normalizedGender} isCurrentUser={isCurrentUser} />
        <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider">
          At this venue
        </p>
      </div>
      
      {/* ===== BODY: Content area (flexible, can compress) ===== */}
      <div className="flex-1 flex flex-col justify-center text-center px-4 py-2 min-h-0 overflow-hidden">
        {/* Intent - primary focus */}
        <p 
          className="text-sm font-semibold leading-snug line-clamp-2 flex-shrink-0"
          style={{ color: isCurrentUser ? '#c4b5fd' : ACCENT_COLOR }}
        >
          {intentText}
        </p>
        
        {/* Metadata - subdued */}
        <div className="mt-2 space-y-0.5 flex-shrink-0">
          <p className="text-[11px] text-slate-400">
            {genderLabel}{genderLabel && ageLabel ? ' · ' : ''}{ageLabel}
          </p>
          <p className="text-[10px] text-slate-500/70">
            Here now
          </p>
        </div>

        {/* Current user indicator */}
        {isCurrentUser && (
          <p className="text-[10px] font-medium mt-2 flex-shrink-0" style={{ color: ACCENT_COLOR }}>
            You
          </p>
        )}
      </div>

      {/* ===== PREVIEW: Optional interaction status (between body and footer) ===== */}
      {interactionPreview && !isCurrentUser && (
        <div className="flex-shrink-0 text-center px-4 pb-1">
          <p className="text-[10px] text-slate-500 italic truncate">
            {interactionPreview}
          </p>
        </div>
      )}

      {/* ===== FOOTER: CTA (pinned to bottom, fixed size) ===== */}
      {!isCurrentUser && (
        <div className="flex-shrink-0 px-4 pb-4">
          <button
            className="
              w-full 
              text-[11px]
              font-medium
              py-2.5
              rounded-lg 
              bg-slate-700/40
              text-slate-300
              transition-all
              duration-150
              border
              border-slate-600/30
              hover:bg-violet-600/20
              hover:border-violet-500/40
              hover:text-violet-200
              active:scale-[0.98]
            "
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Say hello
          </button>
        </div>
      )}
    </div>
  );
}

export default AvatarChip;

