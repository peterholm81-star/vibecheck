/**
 * MeetupSheet Component
 * 
 * Bottom sheet for suggesting a meetup location when conversation is mutual.
 * Shows preset options only - no free text, no dating-app language.
 * 
 * Design: Calm, informational, non-urgent
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { 
  MEETUP_INTENT_LABEL, 
  LOCATION_HINT_LABELS, 
  type MeetupFlowState,
  type LocationHintType,
} from './ConversationPanel';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';

interface MeetupSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The avatar data of the selected person */
  selectedAvatar: AvatarChipData | null;
  /** Current meetup flow state */
  meetupFlowState: MeetupFlowState;
  /** Callback when user sends meetup intent */
  onSendIntent: () => void;
  /** Callback when user selects a location hint */
  onSelectLocation: (hint: LocationHintType) => void;
  /** Callback when user declines */
  onDecline: () => void;
}

/**
 * Get intent text from energy
 */
function getIntentText(energy: AvatarEnergy | null | undefined): string {
  switch (energy) {
    case 'curious': return 'Open to conversation';
    case 'playful': return 'Here with friends';
    case 'calm': return 'Just observing tonight';
    default: return 'At this venue';
  }
}

/**
 * Normalize gender for display
 */
function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g === 'w') return 'female';
  if (g === 'male' || g === 'man' || g === 'm') return 'male';
  return null;
}

/**
 * Mini silhouette for the sheet header
 */
function MiniSilhouette({ gender }: { gender: 'male' | 'female' | null }) {
  const FemaleSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-slate-400">
      <path d="M12 2C9 2 7 4 7 7v1c0 2 1.5 4 5 4s5-2 5-4V7c0-3-2-5-5-5z" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3.5" ry="3" fill="#64748b" />
      <path d="M12 13c-5 0-8 3-8 7h16c0-4-3-7-8-7z" fill="currentColor" />
    </svg>
  );
  
  const MaleSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-slate-400">
      <circle cx="12" cy="7.5" r="4.5" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3" ry="2.8" fill="#64748b" />
      <rect x="10" y="11" width="4" height="2" fill="currentColor" />
      <path d="M12 13c-6 0-9 3-9 7h18c0-4-3-7-9-7z" fill="currentColor" />
    </svg>
  );
  
  const NeutralSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-slate-500">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
    </svg>
  );
  
  return (
    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center p-2">
      {gender === 'female' && <FemaleSVG />}
      {gender === 'male' && <MaleSVG />}
      {!gender && <NeutralSVG />}
    </div>
  );
}

/** Ordered list of location options (only shown after mutual consent) */
const LOCATION_OPTIONS: LocationHintType[] = [
  'near_bar',
  'near_entrance',
  'by_counter',
];

export function MeetupSheet({
  isOpen,
  onClose,
  selectedAvatar,
  meetupFlowState,
  onSendIntent,
  onSelectLocation,
  onDecline,
}: MeetupSheetProps) {
  // Handle ESC key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !selectedAvatar) return null;

  const normalizedGender = normalizeGender(selectedAvatar.avatarGender);
  const intentText = getIntentText(selectedAvatar.energy);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6"
        role="dialog"
        aria-modal="true"
        aria-label="Find each other"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">
                  {meetupFlowState === 'meetup_accepted' ? 'Share your location' : 
                   meetupFlowState === 'location_shared' ? 'Location shared' :
                   'Find each other'}
                </p>
                <p className="text-xs text-slate-400">{intentText}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Content based on meetup flow state */}
          <div className="p-4">
            {/* State: none or initial - show intent question only */}
            {meetupFlowState === 'none' && (
              <>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-3">
                  Take the next step
                </p>
                <div className="space-y-2">
                  <button
                    onClick={onSendIntent}
                    className="
                      w-full text-left
                      py-3 px-4 
                      rounded-xl 
                      border
                      bg-slate-700/50 border-slate-600/50 text-slate-200 
                      hover:bg-slate-700 hover:border-slate-500
                      transition-all
                    "
                  >
                    <span className="text-sm">{MEETUP_INTENT_LABEL}</span>
                  </button>
                  <button
                    onClick={onDecline}
                    className="
                      w-full text-left
                      py-3 px-4 
                      rounded-xl 
                      border
                      bg-slate-700/30 border-slate-600/30 text-slate-400 
                      hover:bg-slate-700/50
                      transition-all
                    "
                  >
                    <span className="text-sm">Not tonight</span>
                  </button>
                </div>
              </>
            )}
            
            {/* State: waiting for response */}
            {(meetupFlowState === 'intent_sent' || meetupFlowState === 'intent_waiting') && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <span className="text-xl">⏳</span>
                </div>
                <p className="text-sm text-slate-300">Waiting for response</p>
                <p className="text-xs text-slate-500 mt-2">
                  They'll see your interest and can respond
                </p>
              </div>
            )}
            
            {/* State: meetup accepted - show location options */}
            {meetupFlowState === 'meetup_accepted' && (
              <>
                <div className="text-center mb-4 pb-4 border-b border-slate-700/30">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <span className="text-lg">✨</span>
                  </div>
                  <p className="text-sm text-emerald-300">They want to meet too!</p>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-3">
                  Share where you are
                </p>
                <div className="space-y-2">
                  {LOCATION_OPTIONS.map((hint) => {
                    const label = LOCATION_HINT_LABELS[hint];
                    
                    return (
                      <button
                        key={hint}
                        onClick={() => onSelectLocation(hint)}
                        className="
                          w-full text-left
                          py-3 px-4 
                          rounded-xl 
                          border
                          bg-slate-700/50 border-slate-600/50 text-slate-200 
                          hover:bg-emerald-700/30 hover:border-emerald-500/40
                          transition-all
                        "
                      >
                        <span className="text-sm">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            
            {/* State: location already shared */}
            {meetupFlowState === 'location_shared' && (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-xl">📍</span>
                </div>
                <p className="text-sm text-emerald-300">Location shared</p>
                <p className="text-xs text-slate-500 mt-2">
                  Check the conversation for details
                </p>
              </div>
            )}
            
            {/* State: declined */}
            {meetupFlowState === 'declined' && (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400">Maybe another time</p>
                <p className="text-xs text-slate-500 mt-2">
                  You can still send signals
                </p>
              </div>
            )}
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

export default MeetupSheet;
