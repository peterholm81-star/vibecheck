/**
 * DialogReplySheet Component
 * 
 * Bottom sheet for Phase 2 dialog replies.
 * Shows preset "night context" reply options.
 * 
 * Design: MyHeritage-inspired, calm, no chat bubbles
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { DIALOG_REPLY_OPTIONS, type DialogReply } from './conversationStateMachine';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';

interface DialogReplySheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAvatar: AvatarChipData | null;
  onSelectReply: (reply: DialogReply) => void;
  /** Current exchange count (for display) */
  exchangesCount: number;
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

export function DialogReplySheet({
  isOpen,
  onClose,
  selectedAvatar,
  onSelectReply,
  exchangesCount,
}: DialogReplySheetProps) {
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
  const remainingExchanges = Math.max(0, 5 - exchangesCount);

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
        aria-label="Choose a reply"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">Reply</p>
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
          
          {/* Exchange counter */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">
              {remainingExchanges} {remainingExchanges === 1 ? 'reply' : 'replies'} remaining
            </p>
          </div>
          
          {/* Reply options */}
          <div className="p-4 pt-2 max-h-[50vh] overflow-y-auto">
            <div className="space-y-2">
              {DIALOG_REPLY_OPTIONS.map((reply) => (
                <button
                  key={reply}
                  onClick={() => {
                    onSelectReply(reply);
                    onClose();
                  }}
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
                  <span className="text-sm">{reply}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

export default DialogReplySheet;
