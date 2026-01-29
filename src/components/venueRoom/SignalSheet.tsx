/**
 * SignalSheet Component
 * 
 * Bottom sheet modal for sending signals (Wave/Wink/Poke).
 * Fixed position so it's always accessible without scrolling.
 * 
 * Features:
 * - Shows selected person's silhouette + intent
 * - Wave / Wink / Poke actions
 * - Close on backdrop click or X button
 * - ESC key closes sheet
 * - Works on mobile and desktop
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { X, Check } from 'lucide-react';
import { SIGNAL_LABELS, type SignalType } from '../../config/venueRoomChoices';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';

/** Auto-close delay after sending a signal (ms) */
const AUTO_CLOSE_DELAY_MS = 900;

interface SignalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The avatar data of the selected person */
  selectedAvatar: AvatarChipData | null;
  /** Index for display purposes */
  selectedIndex: number;
  /** Which signals have already been sent */
  sentSignals: SignalType[];
  /** Callback when user sends a signal */
  onSendSignal: (type: SignalType) => void;
}

/**
 * Get intent text (duplicated from AvatarChip for independence)
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
 * Normalize gender for silhouette
 */
function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g === 'w') return 'female';
  if (g === 'male' || g === 'man' || g === 'm') return 'male';
  return null;
}

/**
 * Small silhouette for the sheet header
 */
function MiniSilhouette({ gender }: { gender: 'male' | 'female' | null }) {
  // Female silhouette
  const FemaleSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-slate-400">
      <path d="M12 2C9 2 7 4 7 7v1c0 2 1.5 4 5 4s5-2 5-4V7c0-3-2-5-5-5z" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3.5" ry="3" fill="#64748b" />
      <path d="M12 13c-5 0-8 3-8 7h16c0-4-3-7-8-7z" fill="currentColor" />
    </svg>
  );
  
  // Male silhouette
  const MaleSVG = () => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-slate-400">
      <circle cx="12" cy="7.5" r="4.5" fill="currentColor" />
      <ellipse cx="12" cy="8" rx="3" ry="2.8" fill="#64748b" />
      <rect x="10" y="11" width="4" height="2" fill="currentColor" />
      <path d="M12 13c-6 0-9 3-9 7h18c0-4-3-7-9-7z" fill="currentColor" />
    </svg>
  );
  
  // Neutral silhouette
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

export function SignalSheet({
  isOpen,
  onClose,
  selectedAvatar,
  selectedIndex,
  sentSignals,
  onSendSignal,
}: SignalSheetProps) {
  // Track which action was just sent in this session (for immediate feedback + auto-close)
  const [justSentAction, setJustSentAction] = useState<SignalType | null>(null);
  
  // Timer ref for auto-close
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Clear timer helper
  const clearAutoCloseTimer = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);
  
  // Handle close with cleanup
  const handleClose = useCallback(() => {
    clearAutoCloseTimer();
    setJustSentAction(null);
    onClose();
  }, [onClose, clearAutoCloseTimer]);

  // Handle ESC key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  }, [handleClose]);

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when closing
      clearAutoCloseTimer();
      setJustSentAction(null);
    }
  }, [isOpen, clearAutoCloseTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoCloseTimer();
    };
  }, [clearAutoCloseTimer]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when sheet is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !selectedAvatar) return null;

  const allSignals: SignalType[] = ['wave', 'wink', 'poke'];
  const normalizedGender = normalizeGender(selectedAvatar.avatarGender);
  const intentText = getIntentText(selectedAvatar.energy);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };
  
  // Handle sending a signal with auto-close
  const handleSignalClick = (signalType: SignalType) => {
    // Prevent double-tap / repeated sends
    if (justSentAction !== null) return;
    
    // Send the signal
    onSendSignal(signalType);
    
    // Set immediate feedback
    setJustSentAction(signalType);
    
    // Start auto-close timer
    clearAutoCloseTimer();
    autoCloseTimerRef.current = setTimeout(() => {
      handleClose();
    }, AUTO_CLOSE_DELAY_MS);
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
        aria-label="Send a signal"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">{intentText}</p>
                <p className="text-xs text-slate-400">
                  {normalizedGender === 'female' ? 'Woman' : normalizedGender === 'male' ? 'Man' : ''} 
                  {selectedAvatar.avatarAgeRange ? ` · ${selectedAvatar.avatarAgeRange}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Activity log (mobile - shows past signals) */}
          {sentSignals.length > 0 && (
            <div className="px-4 pt-3 pb-2 border-b border-slate-700/30">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Your signals</p>
              <div className="flex flex-wrap gap-2">
                {sentSignals.map((signal, idx) => {
                  const { emoji, label } = SIGNAL_LABELS[signal];
                  return (
                    <span 
                      key={`${signal}-${idx}`}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-700/40 rounded-full px-2.5 py-1"
                    >
                      <span>{emoji}</span>
                      <span>{label}</span>
                      <span className="text-slate-500">✓</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-3">Send a signal</p>
            <div className="grid grid-cols-3 gap-3">
              {allSignals.map((signalType) => {
                const { emoji, label } = SIGNAL_LABELS[signalType];
                const alreadySent = sentSignals.includes(signalType);
                const isJustSent = justSentAction === signalType;
                const isOtherSending = justSentAction !== null && justSentAction !== signalType;
                const isDisabled = alreadySent || isJustSent || isOtherSending;

                return (
                  <button
                    key={signalType}
                    onClick={() => handleSignalClick(signalType)}
                    disabled={isDisabled}
                    aria-label={isJustSent ? `${label} sent` : `Send ${label}`}
                    className={`
                      flex flex-col items-center gap-2 
                      py-4 px-3 
                      rounded-xl 
                      border
                      transition-all duration-150
                      ${isJustSent 
                        ? 'bg-violet-600/30 border-violet-500/50 scale-[1.02]' 
                        : alreadySent 
                          ? 'bg-slate-700/30 border-slate-600/30 opacity-50 cursor-not-allowed' 
                          : isOtherSending
                            ? 'bg-slate-700/20 border-slate-600/20 opacity-40 cursor-not-allowed'
                            : 'bg-slate-700/50 border-slate-600/50 hover:bg-slate-700 hover:border-slate-500 active:scale-95'
                      }
                    `}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      isJustSent 
                        ? 'text-violet-300' 
                        : alreadySent 
                          ? 'text-slate-500' 
                          : isOtherSending
                            ? 'text-slate-600'
                            : 'text-slate-300'
                    }`}>
                      {isJustSent ? (
                        <>
                          <Check size={12} className="text-violet-400" />
                          Sent
                        </>
                      ) : alreadySent ? (
                        'Sent ✓'
                      ) : (
                        label
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {/* All sent message */}
            {allSignals.every(s => sentSignals.includes(s)) && !justSentAction && (
              <p className="text-center text-xs text-slate-500 mt-4">
                You've sent all available signals
              </p>
            )}
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

export default SignalSheet;
