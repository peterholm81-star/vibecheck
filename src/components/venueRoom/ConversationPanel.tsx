/**
 * ConversationPanel Component - v1 LOCKED
 * 
 * Read-only interaction history with a selected avatar.
 * Shows chronological list of interaction events.
 * 
 * ============================================
 * DESIGN PRINCIPLES (LOCKED)
 * ============================================
 * 
 * 1) THIS IS NOT A CHAT - It's an interaction log.
 *    - No input fields for free text
 *    - No typing, no sending arbitrary messages
 *    - The "quick hint" is handled by a separate sheet, not here
 * 
 * 2) READ-ONLY - Users can only VIEW what happened.
 *    - Actions are taken through SignalSheet, MeetupSheet, QuickHintSheet
 *    - This panel is purely informational
 * 
 * 3) CALM AESTHETIC - MyHeritage-inspired
 *    - Simple text list (no chat bubbles)
 *    - Subtle separators
 *    - No urgency, no pressure
 * 
 * 4) SINGLE SOURCE OF TRUTH for event building:
 *    - All interaction events MUST be built through buildInteractionEventsWithMeetup()
 *    - This ensures consistent ordering and event types
 * 
 * ============================================
 */

import { X } from 'lucide-react';
import type { AvatarChipData } from './AvatarChip';
import type { AvatarEnergy } from '../../constants/avatarSetup';
import { AVATAR_AGE_RANGE_LABELS } from '../../constants/avatarSetup';
import type { SignalType } from '../../config/venueRoomChoices';
import { SIGNAL_LABELS } from '../../config/venueRoomChoices';

// ============================================
// TYPES - v1 LOCKED
// ============================================
// 
// These types define the interaction model for VenueRoom v1.
// Changes to these types require careful consideration of:
//   - Privacy implications (location sharing is gated)
//   - Harassment prevention (one-time limits on hints)
//   - UX consistency (flow must remain linear)
// ============================================

/** Meetup intent - expressing interest WITHOUT sharing location */
export type MeetupIntentType = 'meetup_intent';

/** 
 * Location hint - only available AFTER mutual consent.
 * CONSTRAINT: Cannot be triggered without going through meetup_accepted state.
 */
export type LocationHintType = 'near_bar' | 'near_entrance' | 'by_counter';

/** Combined type for backwards compat */
export type MeetupHintType = MeetupIntentType | LocationHintType | 'not_tonight';

/** 
 * Meetup flow state machine.
 * 
 * Valid transitions:
 *   none → intent_sent (user expresses interest)
 *   intent_sent → meetup_accepted (they accept) OR declined (they decline)
 *   meetup_accepted → location_shared (user shares location)
 *   location_shared → (terminal, can add quick hint but no state change)
 * 
 * CONSTRAINT: Once location_shared, cannot re-enter without full reset.
 */
export type MeetupFlowState = 
  | 'none'                    // No meetup initiated
  | 'intent_sent'             // User sent "Want to say hi?"
  | 'intent_waiting'          // Waiting for response (alias for intent_sent)
  | 'meetup_accepted'         // Other user accepted (MUTUAL CONSENT achieved)
  | 'location_shared'         // User shared their location (terminal for location)
  | 'declined';               // Other user declined

/** Single interaction event in the conversation history */
export interface InteractionEvent {
  id: string;
  type: 
    | 'signal_sent' 
    | 'signal_received' 
    | 'hello' 
    | 'meetup_intent_sent' 
    | 'meetup_accepted' 
    | 'location_shared' 
    | 'quick_hint_sent' 
    | 'quick_hint_received';
  signalType?: SignalType;
  meetupHint?: MeetupHintType;
  /** 
   * Quick hint text (max 120 chars).
   * CONSTRAINT: Only ONE per avatar per session.
   */
  quickHintText?: string;
  timestamp: number;
}

/** Labels for meetup options */
export const MEETUP_INTENT_LABEL = 'Want to say hi in person?';

export const LOCATION_HINT_LABELS: Record<LocationHintType, string> = {
  near_bar: "I'm near the bar",
  near_entrance: "I'm near the entrance",
  by_counter: "I'm by the counter",
};

/** Legacy combined labels for display */
export const MEETUP_HINT_LABELS: Record<MeetupHintType, string> = {
  meetup_intent: MEETUP_INTENT_LABEL,
  near_bar: "I'm near the bar",
  near_entrance: "I'm near the entrance",
  by_counter: "I'm by the counter",
  not_tonight: 'Not tonight',
};

interface ConversationPanelProps {
  /** Selected avatar data (null = no selection) */
  selectedAvatar: AvatarChipData | null;
  /** Signals sent to this avatar */
  sentSignals: SignalType[];
  /** Signals received from this avatar (mock) */
  receivedSignals?: SignalType[];
  /** Full interaction history (optional, for richer display) */
  interactions?: InteractionEvent[];
  /** Whether to show placeholder */
  showPlaceholder?: boolean;
  /** Close handler (optional, for mobile sheet) */
  onClose?: () => void;
  /** Variant: 'panel' for desktop, 'sheet' for mobile */
  variant?: 'panel' | 'sheet';
  /** Pre-computed conversation context (passed from parent) */
  context?: ConversationContext;
  /** Meetup flow state for this avatar */
  meetupFlowState?: MeetupFlowState;
  /** Location hint sent to this avatar (if any) */
  locationHint?: LocationHintType | null;
  /** Quick hint sent to this avatar (if any) */
  quickHint?: string | null;
  /** Callback to open quick hint sheet (only shown when eligible) */
  onOpenQuickHint?: () => void;
}

// Accent color (consistent with AvatarChip)
const ACCENT_COLOR = '#8b5cf6';

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
 * Normalize gender
 */
function normalizeGender(gender: string | null | undefined): 'male' | 'female' | null {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g === 'w') return 'female';
  if (g === 'male' || g === 'man' || g === 'm') return 'male';
  return null;
}

/**
 * Get gender label
 */
function getGenderLabel(gender: 'male' | 'female' | null): string {
  switch (gender) {
    case 'female': return 'Woman';
    case 'male': return 'Man';
    default: return '';
  }
}

/**
 * Mini silhouette for panel header
 */
function PanelSilhouette({ gender }: { gender: 'male' | 'female' | null }) {
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
    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center p-1.5 flex-shrink-0">
      {gender === 'female' && <FemaleSVG />}
      {gender === 'male' && <MaleSVG />}
      {!gender && <NeutralSVG />}
    </div>
  );
}

/**
 * INTERNAL: Build signal-only events for context computation.
 * 
 * This is a lightweight version used ONLY by getConversationContext()
 * to determine conversation state (waiting, mutual, etc.) based on signals.
 * It does NOT include meetup flow events (intent, accepted, location, hint).
 * 
 * For full interaction history display, use buildInteractionEventsWithMeetup().
 * 
 * @internal
 */
function buildSignalEventsForContext(
  sentSignals: SignalType[],
  receivedSignals: SignalType[] = []
): InteractionEvent[] {
  const events: InteractionEvent[] = [];
  
  // Add sent signals with mock timestamps
  sentSignals.forEach((signal, idx) => {
    events.push({
      id: `sent-${signal}-${idx}`,
      type: 'signal_sent',
      signalType: signal,
      timestamp: Date.now() - (sentSignals.length - idx) * 60000,
    });
  });
  
  // Add received signals with mock timestamps
  receivedSignals.forEach((signal, idx) => {
    events.push({
      id: `received-${signal}-${idx}`,
      type: 'signal_received',
      signalType: signal,
      timestamp: Date.now() - (receivedSignals.length - idx) * 45000 - 30000,
    });
  });
  
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * PRIMARY: Build complete interaction events for display.
 * 
 * This is the SINGLE SOURCE OF TRUTH for building interaction history.
 * It includes all event types:
 *   - Signal events (sent/received)
 *   - Meetup flow events (intent, accepted, location)
 *   - Quick hint events
 * 
 * All UI components that display interaction history MUST use this function.
 * 
 * @param sentSignals - Signals sent by the user
 * @param receivedSignals - Signals received from the avatar (mock)
 * @param meetupFlowState - Current state of the meetup flow
 * @param locationHint - Location hint sent (if any)
 * @param quickHint - Quick hint text sent (if any)
 */
export function buildInteractionEventsWithMeetup(
  sentSignals: SignalType[],
  receivedSignals: SignalType[] = [],
  meetupFlowState: MeetupFlowState = 'none',
  locationHint?: LocationHintType | null,
  quickHint?: string | null
): InteractionEvent[] {
  const events: InteractionEvent[] = [];
  
  // Add sent signals with mock timestamps
  sentSignals.forEach((signal, idx) => {
    events.push({
      id: `sent-${signal}-${idx}`,
      type: 'signal_sent',
      signalType: signal,
      timestamp: Date.now() - (sentSignals.length - idx) * 60000,
    });
  });
  
  // Add received signals with mock timestamps (interleaved)
  receivedSignals.forEach((signal, idx) => {
    events.push({
      id: `received-${signal}-${idx}`,
      type: 'signal_received',
      signalType: signal,
      timestamp: Date.now() - (receivedSignals.length - idx) * 45000 - 30000,
    });
  });
  
  // Add meetup flow events based on state
  if (meetupFlowState !== 'none') {
    // Intent was sent
    if (meetupFlowState === 'intent_sent' || meetupFlowState === 'intent_waiting' || 
        meetupFlowState === 'meetup_accepted' || meetupFlowState === 'location_shared') {
      events.push({
        id: 'meetup-intent',
        type: 'meetup_intent_sent',
        meetupHint: 'meetup_intent',
        timestamp: Date.now() - 10000,
      });
    }
    
    // Meetup was accepted (mutual consent achieved)
    if (meetupFlowState === 'meetup_accepted' || meetupFlowState === 'location_shared') {
      events.push({
        id: 'meetup-accepted',
        type: 'meetup_accepted',
        timestamp: Date.now() - 8000,
      });
    }
    
    // Location was shared
    if (meetupFlowState === 'location_shared' && locationHint) {
      events.push({
        id: `location-${locationHint}`,
        type: 'location_shared',
        meetupHint: locationHint,
        timestamp: Date.now() - 5000,
      });
    }
    
    // Quick hint was sent (after location)
    if (meetupFlowState === 'location_shared' && quickHint) {
      events.push({
        id: 'quick-hint-sent',
        type: 'quick_hint_sent',
        quickHintText: quickHint,
        timestamp: Date.now() - 3000,
      });
    }
  }
  
  // Sort by timestamp
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================
// CONVERSATION STATE HELPERS (exported for parent use)
// ============================================

export type ConversationState = 
  | 'empty'           // No interactions yet
  | 'waiting'         // User sent, no response yet
  | 'they_responded'  // They responded (last event was received)
  | 'mutual'          // Both have sent signals
  | 'you_responded';  // You responded to their signal

export interface ConversationContext {
  state: ConversationState;
  statusHint: string;
  ctaLabel: string;
  hasSentSignals: boolean;
  hasReceivedSignals: boolean;
  lastEventWasReceived: boolean;
  /** True when both have exchanged signals - ready for next step */
  isMutual: boolean;
  /** Meetup flow state (if any) */
  meetupFlowState: MeetupFlowState;
  /** CTA is disabled when waiting for meetup response */
  ctaDisabled: boolean;
  /** 
   * Conversation has ended for the night (declined state).
   * When true: no CTAs shown, no signals can be sent, read-only mode.
   */
  isConversationEnded: boolean;
}

/**
 * Derive conversation context from signals and meetup flow state
 * Exported so parent can compute and pass down as props
 */
export function getConversationContext(
  sentSignals: SignalType[],
  receivedSignals: SignalType[],
  meetupFlowState: MeetupFlowState = 'none'
): ConversationContext {
  const hasSentSignals = sentSignals.length > 0;
  const hasReceivedSignals = receivedSignals.length > 0;
  
  // Build signal-only events to determine last event
  // NOTE: Using internal helper that only includes signals, not meetup events
  const signalEvents = buildSignalEventsForContext(sentSignals, receivedSignals);
  const lastEvent = signalEvents.length > 0 ? signalEvents[signalEvents.length - 1] : null;
  const lastEventWasReceived = lastEvent?.type === 'signal_received';
  
  // Determine state
  let state: ConversationState = 'empty';
  if (!hasSentSignals && !hasReceivedSignals) {
    state = 'empty';
  } else if (hasSentSignals && !hasReceivedSignals) {
    state = 'waiting';
  } else if (!hasSentSignals && hasReceivedSignals) {
    state = 'they_responded'; // Edge case: they signaled first
  } else if (hasSentSignals && hasReceivedSignals) {
    state = lastEventWasReceived ? 'they_responded' : 'mutual';
  }
  
  // Check if mutual (both have exchanged at least one signal)
  const isMutual = hasSentSignals && hasReceivedSignals;
  
  // Determine status hint and CTA based on meetup flow state first
  let statusHint = '';
  let ctaLabel = 'Send a signal';
  let ctaDisabled = false;
  let isConversationEnded = false;
  
  // Meetup flow takes priority over signal-only state
  if (meetupFlowState === 'intent_sent' || meetupFlowState === 'intent_waiting') {
    statusHint = 'Waiting for response';
    ctaLabel = 'Waiting for response';
    ctaDisabled = true;
  } else if (meetupFlowState === 'meetup_accepted') {
    statusHint = 'They want to meet too';
    ctaLabel = 'Share where you are';
    ctaDisabled = false;
  } else if (meetupFlowState === 'location_shared') {
    statusHint = 'Location shared';
    ctaLabel = 'Location shared';
    ctaDisabled = true;
  } else if (meetupFlowState === 'declined') {
    // TERMINAL STATE: Conversation ended for the night
    // No further signals or actions can be sent until reset (venue change/session end)
    statusHint = 'Conversation ended for tonight';
    ctaLabel = '';  // No CTA shown
    ctaDisabled = true;
    isConversationEnded = true;
  } else {
    // No active meetup flow - use signal-based status hints
    switch (state) {
      case 'empty':
        statusHint = 'Start the conversation';
        break;
      case 'waiting':
        statusHint = 'Waiting to see if they respond';
        break;
      case 'they_responded':
        statusHint = 'They responded';
        break;
      case 'mutual':
        statusHint = 'Mutual interest';
        break;
    }
    
    // Determine CTA label based on signal context
    if (isMutual) {
      // Both have exchanged signals - offer next step
      ctaLabel = 'Try to find each other';
    } else if (lastEventWasReceived) {
      ctaLabel = 'Respond with a signal';
    } else if (hasSentSignals) {
      ctaLabel = 'Send another signal';
    }
  }
  
  return {
    state,
    statusHint,
    ctaLabel,
    hasSentSignals,
    hasReceivedSignals,
    lastEventWasReceived,
    isMutual,
    meetupFlowState,
    ctaDisabled,
    isConversationEnded,
  };
}

export function ConversationPanel({ 
  selectedAvatar, 
  sentSignals,
  receivedSignals = [],
  interactions,
  showPlaceholder = true,
  onClose,
  variant = 'panel',
  context: providedContext,
  meetupFlowState = 'none',
  locationHint,
  quickHint,
  onOpenQuickHint,
}: ConversationPanelProps) {
  // Placeholder state
  if (!selectedAvatar) {
    if (!showPlaceholder) return null;
    
    return (
      <div className="h-[220px] bg-slate-800/40 rounded-xl border border-slate-700/40 flex flex-col items-center justify-center p-5">
        <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-4" style={{ borderColor: ACCENT_COLOR, borderWidth: 1, borderStyle: 'solid', opacity: 0.3 }}>
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-slate-500">
            <circle cx="12" cy="8" r="4" fill="currentColor" />
            <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
          </svg>
        </div>
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          Select someone to see<br />your interaction history
        </p>
      </div>
    );
  }

  const normalizedGender = normalizeGender(selectedAvatar.avatarGender);
  const genderLabel = getGenderLabel(normalizedGender);
  const intentText = getIntentText(selectedAvatar.energy);
  const ageLabel = selectedAvatar.avatarAgeRange 
    ? (AVATAR_AGE_RANGE_LABELS[selectedAvatar.avatarAgeRange] || selectedAvatar.avatarAgeRange)
    : '';

  // Build events from signals and meetup flow state if not provided
  const events = interactions || buildInteractionEventsWithMeetup(sentSignals, receivedSignals, meetupFlowState, locationHint, quickHint);
  const hasInteractions = events.length > 0;
  
  // Use provided context or compute internally (purely derived, no side effects)
  const context = providedContext || getConversationContext(sentSignals, receivedSignals, meetupFlowState);
  
  // Quick hint eligibility: only after location has been shared
  const canAddQuickHint = meetupFlowState === 'location_shared' && !quickHint && onOpenQuickHint;
  const hasQuickHint = !!quickHint;

  // Container classes based on variant
  const containerClasses = variant === 'sheet' 
    ? 'bg-slate-800 rounded-t-2xl border-t border-x border-slate-700/50 flex flex-col max-h-[70vh]'
    : 'h-[260px] bg-slate-800/40 rounded-xl border border-slate-700/40 flex flex-col overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Header - Person info + context */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/30 flex-shrink-0">
        <PanelSilhouette gender={normalizedGender} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">At this venue</p>
          <p className="text-sm font-semibold truncate" style={{ color: ACCENT_COLOR }}>
            {intentText}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {genderLabel}{genderLabel && ageLabel ? ' · ' : ''}{ageLabel}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>
      
      {/* Interaction history - read-only, chronological */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!hasInteractions ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-4">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No interactions yet.<br />
              <span className="text-slate-600">Say hello to start.</span>
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">
              Interaction history
            </p>
            {events.map((event) => (
              <InteractionRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
      
      {/* Footer - status hint + optional quick hint button */}
      <div className="px-4 py-3 border-t border-slate-700/30 flex-shrink-0">
        <p className={`text-[11px] text-center ${
          context.isConversationEnded
            ? 'text-slate-500/70 italic'  // Calm, non-judgmental for ended conversations
            : context.lastEventWasReceived 
              ? 'text-violet-400/70' 
              : 'text-slate-500'
        }`}>
          {context.statusHint}
        </p>
        
        {/* Quick hint button - only after location shared, NOT when conversation ended */}
        {canAddQuickHint && !context.isConversationEnded && (
          <button
            onClick={onOpenQuickHint}
            className="
              mt-3 w-full
              text-[11px] font-medium
              py-2 px-3
              rounded-lg
              bg-slate-700/30
              border border-slate-600/30
              text-slate-400
              hover:bg-slate-700/50
              hover:text-slate-300
              transition-colors
            "
          >
            Add a quick hint
          </button>
        )}
        
        {/* Show "Hint sent" state if already sent (but not when ended) */}
        {hasQuickHint && !context.isConversationEnded && (
          <p className="mt-2 text-[10px] text-slate-500 text-center">
            ✓ Hint sent
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Single interaction row - simple text, no bubbles
 */
function InteractionRow({ event }: { event: InteractionEvent }) {
  // Handle meetup intent sent (asking to meet)
  if (event.type === 'meetup_intent_sent') {
    return (
      <div className="flex items-center gap-2.5 text-[11px] py-2 px-3 rounded-lg bg-amber-500/10">
        <span className="text-base flex-shrink-0">👋</span>
        <span className="text-amber-300/80">{MEETUP_INTENT_LABEL}</span>
        <span className="ml-auto text-slate-600 text-[10px]">✓</span>
      </div>
    );
  }
  
  // Handle meetup accepted (mutual consent)
  if (event.type === 'meetup_accepted') {
    return (
      <div className="flex items-center gap-2.5 text-[11px] py-2 px-3 rounded-lg bg-emerald-500/10">
        <span className="text-base flex-shrink-0">✨</span>
        <span className="text-emerald-300/80">They want to meet too</span>
      </div>
    );
  }
  
  // Handle location shared
  if (event.type === 'location_shared' && event.meetupHint) {
    const hintLabel = LOCATION_HINT_LABELS[event.meetupHint as LocationHintType] || event.meetupHint;
    return (
      <div className="flex items-center gap-2.5 text-[11px] py-2 px-3 rounded-lg bg-emerald-500/10">
        <span className="text-base flex-shrink-0">📍</span>
        <span className="text-emerald-300/80">{hintLabel}</span>
        <span className="ml-auto text-slate-600 text-[10px]">✓</span>
      </div>
    );
  }
  
  // Handle quick hint sent
  if (event.type === 'quick_hint_sent' && event.quickHintText) {
    return (
      <div className="py-2 px-3 rounded-lg bg-cyan-500/10">
        <div className="flex items-start gap-2.5 text-[11px]">
          <span className="text-base flex-shrink-0 mt-0.5">💬</span>
          <div className="min-w-0 flex-1">
            <span className="text-cyan-300/80 italic break-words">"{event.quickHintText}"</span>
          </div>
          <span className="ml-auto text-slate-600 text-[10px] flex-shrink-0">✓</span>
        </div>
      </div>
    );
  }
  
  // Handle quick hint received (mock)
  if (event.type === 'quick_hint_received' && event.quickHintText) {
    return (
      <div className="py-2 px-3 rounded-lg bg-violet-500/10">
        <div className="flex items-start gap-2.5 text-[11px]">
          <span className="text-base flex-shrink-0 mt-0.5">💬</span>
          <div className="min-w-0 flex-1">
            <span className="text-violet-300/80 italic break-words">"{event.quickHintText}"</span>
          </div>
        </div>
      </div>
    );
  }
  
  // Handle signal events
  const { emoji, label } = event.signalType 
    ? SIGNAL_LABELS[event.signalType] 
    : { emoji: '👋', label: 'Hello' };
  
  const isSent = event.type === 'signal_sent' || event.type === 'hello';
  
  // Format: "You waved" or "They winked"
  const actionText = isSent 
    ? `You ${label.toLowerCase()}${event.signalType ? 'ed' : ''}`
    : `They ${label.toLowerCase()}${event.signalType ? 'ed' : ''}`;
  
  return (
    <div 
      className={`
        flex items-center gap-2.5 
        text-[11px] 
        py-2 px-3 
        rounded-lg
        ${isSent ? 'bg-slate-700/25' : 'bg-violet-500/10'}
      `}
    >
      <span className="text-base flex-shrink-0">{emoji}</span>
      <span className={isSent ? 'text-slate-400' : 'text-violet-300/80'}>
        {actionText}
      </span>
      {isSent && (
        <span className="ml-auto text-slate-600 text-[10px]">✓</span>
      )}
    </div>
  );
}

export default ConversationPanel;
