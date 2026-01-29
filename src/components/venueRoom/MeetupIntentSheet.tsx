/**
 * MeetupIntentSheet Component
 * 
 * Bottom sheet for Phase 3 meetup intent.
 * Shows the one-time "Want to say hi in person?" question.
 * 
 * Response options (LOCKED):
 * A) Yes -> Phase 4 (coordination)
 * B) Maybe another time -> terminal close
 * C) Not tonight — enjoy the rest of your night -> terminal close
 * 
 * Design: Calm, non-judgmental, MyHeritage-inspired
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { MeetupIntentAnswer } from './conversationStateMachine';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';

interface MeetupIntentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAvatar: AvatarChipData | null;
  /** Called when user clicks "Yes" - sends meetup intent */
  onSendIntent: () => void;
  /** Called when user clicks "Not tonight" - closes conversation */
  onDecline?: () => void;
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

export function MeetupIntentSheet({
  isOpen,
  onClose,
  selectedAvatar,
  onSendIntent,
  onDecline,
}: MeetupIntentSheetProps) {
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

  const handleSend = () => {
    onSendIntent();
    onClose();
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
        aria-label="Meet in person"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">Take the next step</p>
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
          
          {/* Content */}
          <div className="p-4">
            {/* Question */}
            <p className="text-base font-medium text-white text-center mb-2">
              Want to say hi in person?
            </p>
            <p className="text-[11px] text-slate-500 mb-4 text-center">
              This can only be asked once per night
            </p>
            
            {/* Yes button */}
            <button
              onClick={handleSend}
              className="
                w-full
                py-3.5 px-4 
                rounded-xl 
                border
                bg-emerald-600/20 border-emerald-500/40 text-emerald-200 
                hover:bg-emerald-600/30 hover:border-emerald-400/50
                transition-all
                text-center
              "
            >
              <span className="text-sm font-medium">Yes</span>
            </button>
            
            {/* Not tonight button */}
            <button
              onClick={() => {
                if (onDecline) {
                  onDecline();
                }
                onClose();
              }}
              className="
                w-full mt-3
                py-2.5 px-4 
                rounded-xl 
                bg-slate-700/30 
                text-slate-400 
                hover:bg-slate-700/50
                transition-all
                text-center
              "
            >
              <span className="text-[13px]">Not tonight</span>
            </button>
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

/**
 * MeetupResponseSheet Component
 * 
 * Shows the simulated response from the other person.
 * In real implementation, this would come from the backend.
 * For demo, we show it as a separate sheet.
 */
interface MeetupResponseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAvatar: AvatarChipData | null;
  onSelectResponse: (answer: MeetupIntentAnswer) => void;
}

export function MeetupResponseSheet({
  isOpen,
  onClose,
  selectedAvatar,
  onSelectResponse,
}: MeetupResponseSheetProps) {
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
        aria-label="Their response"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">Their response</p>
                <p className="text-xs text-slate-400">Demo mode: Choose their reply</p>
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
          
          {/* Response options (for demo simulation) */}
          <div className="p-4 space-y-2">
            <button
              onClick={() => {
                onSelectResponse('yes');
                onClose();
              }}
              className="
                w-full text-left
                py-3 px-4 
                rounded-xl 
                border
                bg-emerald-600/20 border-emerald-500/40 text-emerald-200 
                hover:bg-emerald-600/30
                transition-all
              "
            >
              <span className="text-sm">Yes, I'd like that</span>
            </button>
            
            <button
              onClick={() => {
                onSelectResponse('maybe');
                onClose();
              }}
              className="
                w-full text-left
                py-3 px-4 
                rounded-xl 
                border
                bg-slate-700/50 border-slate-600/50 text-slate-300 
                hover:bg-slate-700
                transition-all
              "
            >
              <span className="text-sm">Maybe another time</span>
            </button>
            
            <button
              onClick={() => {
                onSelectResponse('not_tonight');
                onClose();
              }}
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
              <span className="text-sm">Not tonight — enjoy the rest of your night. Who knows, maybe we'll cross paths.</span>
            </button>
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

export default MeetupIntentSheet;
