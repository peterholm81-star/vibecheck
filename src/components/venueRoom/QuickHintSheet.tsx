/**
 * QuickHintSheet Component
 * 
 * Bottom sheet for adding a one-time quick hint after location sharing.
 * Max 120 characters, with validation to prevent contact info sharing.
 * 
 * Design: Calm, informational, not chat-like
 */

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';

const MAX_CHARS = 120;

/** Blocked keywords (lowercase) */
const BLOCKED_KEYWORDS = [
  'snap', 'snapchat',
  'instagram', 'insta', 'ig',
  'phone', 'number',
  'whatsapp', 'telegram',
  'facebook', 'fb',
  'twitter', 'x.com',
  'tiktok',
  'email', 'mail',
];

/**
 * Validate hint text for contact info
 * Returns error message if invalid, null if valid
 */
export function validateQuickHint(text: string): string | null {
  const trimmed = text.trim();
  
  if (!trimmed) {
    return null; // Empty is OK (will be caught by length check)
  }
  
  const lower = trimmed.toLowerCase();
  
  // Check for @ symbol (email, social handles)
  if (lower.includes('@')) {
    return 'Please keep it to a visual clue (no contact details).';
  }
  
  // Check for URLs
  if (lower.includes('http') || lower.includes('.com') || lower.includes('.no') || lower.includes('www.')) {
    return 'Please keep it to a visual clue (no contact details).';
  }
  
  // Check for blocked keywords
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'Please keep it to a visual clue (no contact details).';
    }
  }
  
  // Check for digit sequences >= 6 (phone numbers, etc.)
  const digitSequenceRegex = /\d{6,}/;
  // Also check for digit sequences with separators (e.g., "123 456 7890" or "123-456-7890")
  const digitsOnly = trimmed.replace(/[\s\-\.]/g, '');
  if (digitSequenceRegex.test(digitsOnly)) {
    return 'Please keep it to a visual clue (no contact details).';
  }
  
  return null;
}

interface QuickHintSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The avatar data of the selected person */
  selectedAvatar: AvatarChipData | null;
  /** Callback when user sends the hint */
  onSendHint: (text: string) => void;
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

export function QuickHintSheet({
  isOpen,
  onClose,
  selectedAvatar,
  onSendHint,
}: QuickHintSheetProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  
  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!isOpen) {
      setText('');
      setError(null);
      setIsSending(false);
    }
  }, [isOpen]);
  
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
  
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = text.trim().length === 0;
  
  // Handle text change with validation
  const handleTextChange = (value: string) => {
    setText(value);
    // Clear error when user types
    if (error) {
      setError(null);
    }
  };
  
  // Handle send
  const handleSend = () => {
    const trimmed = text.trim();
    
    if (!trimmed || isOverLimit) {
      return;
    }
    
    // Validate for contact info
    const validationError = validateQuickHint(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setIsSending(true);
    
    // Small delay for feedback
    setTimeout(() => {
      onSendHint(trimmed);
      onClose();
    }, 200);
  };

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
        aria-label="Add a quick hint"
      >
        <div className="max-w-md mx-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <MiniSilhouette gender={normalizedGender} />
              <div>
                <p className="text-sm font-medium text-white">Add a quick hint</p>
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
            {/* Microcopy */}
            <p className="text-[11px] text-slate-500 mb-3">
              One short clue to help them spot you. No names. No contact details.
            </p>
            
            {/* Text input */}
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="E.g., Wearing a blue jacket, by the window..."
                maxLength={MAX_CHARS + 20} // Allow typing over to show error
                rows={3}
                className={`
                  w-full
                  px-3 py-2.5
                  text-sm text-slate-200
                  bg-slate-700/50
                  border rounded-xl
                  placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-cyan-500/30
                  resize-none
                  ${error ? 'border-red-500/50' : isOverLimit ? 'border-amber-500/50' : 'border-slate-600/50'}
                `}
                disabled={isSending}
              />
              
              {/* Character counter */}
              <div className={`
                absolute bottom-2 right-2
                text-[10px]
                ${isOverLimit ? 'text-amber-400' : charCount > MAX_CHARS * 0.8 ? 'text-slate-400' : 'text-slate-500'}
              `}>
                {charCount}/{MAX_CHARS}
              </div>
            </div>
            
            {/* Error message */}
            {error && (
              <p className="mt-2 text-[11px] text-red-400/80">
                {error}
              </p>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={onClose}
                className="
                  flex-1
                  py-2.5 px-4
                  text-sm font-medium
                  rounded-xl
                  bg-slate-700/30
                  border border-slate-600/30
                  text-slate-400
                  hover:bg-slate-700/50
                  transition-colors
                "
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isEmpty || isOverLimit || isSending}
                className={`
                  flex-1
                  py-2.5 px-4
                  text-sm font-medium
                  rounded-xl
                  border
                  transition-colors
                  ${isEmpty || isOverLimit || isSending
                    ? 'bg-slate-700/20 border-slate-600/20 text-slate-500 cursor-not-allowed'
                    : 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200 hover:bg-cyan-600/30'
                  }
                `}
              >
                {isSending ? 'Sending...' : 'Send hint'}
              </button>
            </div>
          </div>
          
          {/* Safe area padding for mobile */}
          <div className="h-safe-area-inset-bottom" />
        </div>
      </div>
    </>
  );
}

export default QuickHintSheet;
