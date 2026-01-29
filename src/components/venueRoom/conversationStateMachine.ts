/**
 * Conversation State Machine - v1 LOCKED
 * 
 * Strict per-avatar state machine for VenueRoom conversations.
 * Enforces phase progression, turn limits, and gating rules.
 * 
 * ============================================
 * FLOW PHASES
 * ============================================
 * 
 * Phase 0 (idle): No interactions yet
 * Phase 1 (signal): First signal sent, waiting for response
 * Phase 2 (dialog): Back-and-forth preset replies (max 5 total)
 * Phase 3 (meetup_intent): One-time "Want to say hi in person?"
 * Phase 4 (coordination): Location sharing + optional quick hint
 * Terminal (closed): Conversation ended for the night
 * 
 * ============================================
 * GATING RULES (LOCKED)
 * ============================================
 * 
 * 1) Starter cannot propose meetup until exchangesCount >= 3
 * 2) Receiver can propose meetup after at least 1 exchange
 * 3) Meetup intent can only be asked ONCE per avatar per night
 * 4) After "maybe" or "not tonight", conversation is CLOSED
 * 5) Max 5 dialog exchanges total in phase 2
 * 
 * ============================================
 */

import type { SignalType } from '../../config/venueRoomChoices';

// ============================================
// TYPES
// ============================================

export type ConversationPhase =
  | 'idle'                    // Phase 0: No interactions
  | 'signal_sent'             // Phase 1: You sent first signal, waiting
  | 'signal_received'         // Phase 1: They sent first signal (mock)
  | 'dialog'                  // Phase 2: Back-and-forth dialog
  | 'meetup_intent_sent'      // Phase 3: You asked to meet, waiting
  | 'meetup_accepted'         // Phase 4: They said yes
  | 'location_shared'         // Phase 4: You shared location
  | 'closed';                 // Terminal: Conversation ended

export type Actor = 'you' | 'them';

export type MeetupIntentAnswer = 'yes' | 'maybe' | 'not_tonight' | null;

export type LocationHint = 'near_bar' | 'near_entrance' | 'by_counter';

/** Dialog reply options (Phase 2) - LOCKED v1 */
export const DIALOG_REPLY_OPTIONS = [
  "I'm here with friends",
  "I'm just observing tonight",
  "Open to meeting new people",
  "Taking it easy tonight",
  "I'll be here for a while",
  "I might head home soon",
  "Happy to keep it light",
  "Let me buy you a drink",
] as const;

export type DialogReply = typeof DIALOG_REPLY_OPTIONS[number];

/** Single interaction event in history */
export interface ConversationEvent {
  id: string;
  type: 
    | 'signal_sent' 
    | 'signal_received' 
    | 'dialog_sent' 
    | 'dialog_received'
    | 'meetup_intent_sent'
    | 'meetup_intent_received'
    | 'meetup_response'
    | 'location_shared'
    | 'quick_hint_sent';
  actor: Actor;
  timestamp: number;
  // Type-specific data
  signalType?: SignalType;
  dialogReply?: DialogReply;
  meetupAnswer?: MeetupIntentAnswer;
  locationHint?: LocationHint;
  quickHintText?: string;
}

/** Central conversation state per avatar */
export interface ConversationState {
  phase: ConversationPhase;
  /** Who initiated the first signal */
  starter: Actor | null;
  /** Total dialog exchanges in phase 2 (you + them) */
  exchangesCount: number;
  /** Full interaction history */
  history: ConversationEvent[];
  /** Meetup-specific state */
  meetup: {
    intentAskedBy: Actor | null;
    intentAnswer: MeetupIntentAnswer;
    location: LocationHint | null;
    quickHint: string | null;
  };
}

/** Actions that can be dispatched to the state machine */
export type ConversationAction =
  | { type: 'SEND_SIGNAL'; signalType: SignalType }
  | { type: 'RECEIVE_SIGNAL'; signalType: SignalType }
  | { type: 'SEND_DIALOG_REPLY'; reply: DialogReply }
  | { type: 'RECEIVE_DIALOG_REPLY'; reply: DialogReply }
  | { type: 'SEND_MEETUP_INTENT' }
  | { type: 'RECEIVE_MEETUP_RESPONSE'; answer: MeetupIntentAnswer }
  | { type: 'DECLINE_MEETUP' }  // User declines to ask meetup question → closes conversation
  | { type: 'SHARE_LOCATION'; location: LocationHint }
  | { type: 'SEND_QUICK_HINT'; text: string }
  | { type: 'RESET' };

// ============================================
// INITIAL STATE
// ============================================

export function createInitialConversationState(): ConversationState {
  return {
    phase: 'idle',
    starter: null,
    exchangesCount: 0,
    history: [],
    meetup: {
      intentAskedBy: null,
      intentAnswer: null,
      location: null,
      quickHint: null,
    },
  };
}

// ============================================
// DERIVED STATE (for UI)
// ============================================

export interface ConversationUIContext {
  phase: ConversationPhase;
  /** CTA button label */
  ctaLabel: string;
  /** CTA is disabled */
  ctaDisabled: boolean;
  /** What action CTA triggers */
  ctaAction: 'open_signal_sheet' | 'open_dialog_sheet' | 'open_meetup_intent' | 'open_location_sheet' | 'none';
  /** Can send another signal */
  canSendSignal: boolean;
  /** Can send dialog reply */
  canSendDialogReply: boolean;
  /** Can propose meetup */
  canProposeMeetup: boolean;
  /** Can share location */
  canShareLocation: boolean;
  /** Can send quick hint */
  canSendQuickHint: boolean;
  /** Conversation is closed */
  isClosed: boolean;
  /** Status hint for card preview */
  statusHint: string;
  /** Secondary CTA (e.g., propose meetup when in dialog) */
  secondaryCtaLabel: string | null;
  secondaryCtaAction: 'open_meetup_intent' | 'open_quick_hint' | null;
}

/** Derive UI context from conversation state */
export function getConversationUIContext(state: ConversationState): ConversationUIContext {
  const { phase, starter, exchangesCount, meetup, history } = state;
  
  // Base values
  let ctaLabel = '';
  let ctaDisabled = false;
  let ctaAction: ConversationUIContext['ctaAction'] = 'none';
  let canSendSignal = false;
  let canSendDialogReply = false;
  let canProposeMeetup = false;
  let canShareLocation = false;
  let canSendQuickHint = false;
  let isClosed = false;
  let statusHint = '';
  let secondaryCtaLabel: string | null = null;
  let secondaryCtaAction: ConversationUIContext['secondaryCtaAction'] = null;
  
  // Phase-specific logic
  switch (phase) {
    case 'idle':
      ctaLabel = 'Say hello';
      ctaAction = 'open_signal_sheet';
      canSendSignal = true;
      statusHint = 'Start the conversation';
      break;
      
    case 'signal_sent':
      ctaLabel = 'Waiting for response';
      ctaDisabled = true;
      statusHint = 'Waiting for response';
      break;
      
    case 'signal_received':
      // They sent first signal, you can respond
      ctaLabel = 'Reply';
      ctaAction = 'open_dialog_sheet';
      canSendDialogReply = true;
      statusHint = 'They said hello';
      break;
      
    case 'dialog':
      // Check if we've hit the limit
      if (exchangesCount >= 5) {
        ctaLabel = 'Dialog complete';
        ctaDisabled = true;
        statusHint = 'Dialog complete';
        
        // ONLY show meetup CTA when dialog is complete
        if (canProposeMeetupInDialog(state)) {
          secondaryCtaLabel = 'Want to say hi in person?';
          secondaryCtaAction = 'open_meetup_intent';
          canProposeMeetup = true;
        }
      } else {
        // Check whose turn it is
        const lastEvent = history[history.length - 1];
        const isYourTurn = !lastEvent || lastEvent.actor === 'them';
        
        if (isYourTurn) {
          ctaLabel = 'Reply';
          ctaAction = 'open_dialog_sheet';
          canSendDialogReply = true;
          statusHint = exchangesCount === 0 ? 'Start chatting' : 'Your turn';
          // NOTE: Meetup CTA is NOT shown during dialog - only after completion
        } else {
          ctaLabel = 'Waiting for reply';
          ctaDisabled = true;
          statusHint = 'Waiting for reply';
        }
      }
      break;
      
    case 'meetup_intent_sent':
      ctaLabel = 'Waiting for response';
      ctaDisabled = true;
      statusHint = 'Waiting for response';
      break;
      
    case 'meetup_accepted':
      ctaLabel = 'Share where you are';
      ctaAction = 'open_location_sheet';
      canShareLocation = true;
      statusHint = 'They want to meet too';
      break;
      
    case 'location_shared':
      // Check if quick hint already sent
      if (meetup.quickHint) {
        ctaLabel = 'Location shared';
        ctaDisabled = true;
        statusHint = 'Location shared';
      } else {
        ctaLabel = 'Location shared';
        ctaDisabled = true;
        statusHint = 'Location shared';
        secondaryCtaLabel = 'Add a quick hint';
        secondaryCtaAction = 'open_quick_hint';
        canSendQuickHint = true;
      }
      break;
      
    case 'closed':
      ctaLabel = 'Closed for tonight';
      ctaDisabled = true;
      isClosed = true;
      statusHint = 'Closed for tonight';
      break;
  }
  
  return {
    phase,
    ctaLabel,
    ctaDisabled,
    ctaAction,
    canSendSignal,
    canSendDialogReply,
    canProposeMeetup,
    canShareLocation,
    canSendQuickHint,
    isClosed,
    statusHint,
    secondaryCtaLabel,
    secondaryCtaAction,
  };
}

/** Check if user can propose meetup in current dialog state */
function canProposeMeetupInDialog(state: ConversationState): boolean {
  const { starter, exchangesCount, meetup, phase } = state;
  
  // Already asked or not in dialog phase
  if (phase !== 'dialog' || meetup.intentAskedBy !== null) {
    return false;
  }
  
  // Must have at least one exchange
  if (exchangesCount === 0) {
    return false;
  }
  
  // If YOU started, need at least 3 exchanges
  if (starter === 'you' && exchangesCount < 3) {
    return false;
  }
  
  // If THEY started, you can propose earlier (after at least 1 exchange)
  // Already checked exchangesCount > 0 above
  
  return true;
}

// ============================================
// STATE TRANSITION FUNCTION (PURE)
// ============================================

/**
 * Pure state transition function.
 * Returns new state or null if action is invalid.
 */
export function transitionConversation(
  state: ConversationState,
  action: ConversationAction
): ConversationState | null {
  const now = Date.now();
  
  switch (action.type) {
    case 'RESET':
      return createInitialConversationState();
      
    case 'SEND_SIGNAL': {
      // Can only send signal in idle phase
      if (state.phase !== 'idle') {
        console.warn('[StateMachine] Cannot send signal: not in idle phase');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `signal-sent-${now}`,
        type: 'signal_sent',
        actor: 'you',
        timestamp: now,
        signalType: action.signalType,
      };
      
      return {
        ...state,
        phase: 'signal_sent',
        starter: 'you',
        history: [...state.history, event],
      };
    }
    
    case 'RECEIVE_SIGNAL': {
      // They can send signal when idle OR after you sent (mock response)
      if (state.phase !== 'idle' && state.phase !== 'signal_sent') {
        console.warn('[StateMachine] Cannot receive signal: invalid phase');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `signal-received-${now}`,
        type: 'signal_received',
        actor: 'them',
        timestamp: now,
        signalType: action.signalType,
      };
      
      // SIMPLIFIED: Always transition to 'dialog' after receiving signal
      // Both parties have now interacted, so dialog can begin immediately
      const newStarter = state.starter || 'them';
      
      return {
        ...state,
        phase: 'dialog',
        starter: newStarter,
        history: [...state.history, event],
      };
    }
    
    case 'SEND_DIALOG_REPLY': {
      // Can send dialog reply in signal_received (your first response) or dialog phase
      if (state.phase !== 'signal_received' && state.phase !== 'dialog') {
        console.warn('[StateMachine] Cannot send dialog reply: invalid phase');
        return null;
      }
      
      // Check exchange limit
      if (state.exchangesCount >= 5) {
        console.warn('[StateMachine] Cannot send dialog reply: exchange limit reached');
        return null;
      }
      
      // Check if it's your turn
      const lastEvent = state.history[state.history.length - 1];
      if (lastEvent && lastEvent.actor === 'you' && state.phase === 'dialog') {
        console.warn('[StateMachine] Cannot send dialog reply: not your turn');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `dialog-sent-${now}`,
        type: 'dialog_sent',
        actor: 'you',
        timestamp: now,
        dialogReply: action.reply,
      };
      
      return {
        ...state,
        phase: 'dialog',
        exchangesCount: state.exchangesCount + 1,
        history: [...state.history, event],
      };
    }
    
    case 'RECEIVE_DIALOG_REPLY': {
      // Can receive dialog reply in dialog phase only
      // NOTE: If user proposes meetup while a mock reply is pending,
      // the mock reply will be rejected (phase becomes 'meetup_intent_sent').
      // This is handled in VenueRoomPage by checking phase before dispatch.
      if (state.phase !== 'dialog') {
        // Only log as warning if this is unexpected (debug aid)
        console.warn(`[StateMachine] Cannot receive dialog reply: phase is '${state.phase}', expected 'dialog'`);
        return null;
      }
      
      // Check exchange limit
      if (state.exchangesCount >= 5) {
        console.warn(`[StateMachine] Cannot receive dialog reply: exchange limit reached (${state.exchangesCount}/5)`);
        return null;
      }
      
      const event: ConversationEvent = {
        id: `dialog-received-${now}`,
        type: 'dialog_received',
        actor: 'them',
        timestamp: now,
        dialogReply: action.reply,
      };
      
      return {
        ...state,
        exchangesCount: state.exchangesCount + 1,
        history: [...state.history, event],
      };
    }
    
    case 'SEND_MEETUP_INTENT': {
      // Can only send meetup intent in dialog phase with proper gating
      if (state.phase !== 'dialog') {
        console.warn('[StateMachine] Cannot send meetup intent: not in dialog phase');
        return null;
      }
      
      // Check if already asked
      if (state.meetup.intentAskedBy !== null) {
        console.warn('[StateMachine] Cannot send meetup intent: already asked');
        return null;
      }
      
      // Check gating rules
      if (!canProposeMeetupInDialog(state)) {
        console.warn('[StateMachine] Cannot send meetup intent: gating rules not met');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `meetup-intent-sent-${now}`,
        type: 'meetup_intent_sent',
        actor: 'you',
        timestamp: now,
      };
      
      return {
        ...state,
        phase: 'meetup_intent_sent',
        history: [...state.history, event],
        meetup: {
          ...state.meetup,
          intentAskedBy: 'you',
        },
      };
    }
    
    case 'RECEIVE_MEETUP_RESPONSE': {
      // Can only receive response if we sent intent
      if (state.phase !== 'meetup_intent_sent') {
        console.warn('[StateMachine] Cannot receive meetup response: not waiting for response');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `meetup-response-${now}`,
        type: 'meetup_response',
        actor: 'them',
        timestamp: now,
        meetupAnswer: action.answer,
      };
      
      let newPhase: ConversationPhase;
      if (action.answer === 'yes') {
        newPhase = 'meetup_accepted';
      } else {
        // 'maybe' or 'not_tonight' -> closed
        newPhase = 'closed';
      }
      
      return {
        ...state,
        phase: newPhase,
        history: [...state.history, event],
        meetup: {
          ...state.meetup,
          intentAnswer: action.answer,
        },
      };
    }
    
    case 'DECLINE_MEETUP': {
      // User declines to ask the meetup question → close conversation
      // Can decline from dialog phase (when meetup button is shown)
      if (state.phase !== 'dialog') {
        console.warn('[StateMachine] Cannot decline meetup: not in dialog phase');
        return null;
      }
      
      return {
        ...state,
        phase: 'closed',
        meetup: {
          ...state.meetup,
          intentAnswer: 'not_tonight',
        },
      };
    }
    
    case 'SHARE_LOCATION': {
      // Can only share location after meetup accepted
      if (state.phase !== 'meetup_accepted') {
        console.warn('[StateMachine] Cannot share location: meetup not accepted');
        return null;
      }
      
      // Check if already shared
      if (state.meetup.location !== null) {
        console.warn('[StateMachine] Cannot share location: already shared');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `location-shared-${now}`,
        type: 'location_shared',
        actor: 'you',
        timestamp: now,
        locationHint: action.location,
      };
      
      return {
        ...state,
        phase: 'location_shared',
        history: [...state.history, event],
        meetup: {
          ...state.meetup,
          location: action.location,
        },
      };
    }
    
    case 'SEND_QUICK_HINT': {
      // Can only send quick hint after location shared
      if (state.phase !== 'location_shared') {
        console.warn('[StateMachine] Cannot send quick hint: location not shared');
        return null;
      }
      
      // Check if already sent
      if (state.meetup.quickHint !== null) {
        console.warn('[StateMachine] Cannot send quick hint: already sent');
        return null;
      }
      
      const event: ConversationEvent = {
        id: `quick-hint-${now}`,
        type: 'quick_hint_sent',
        actor: 'you',
        timestamp: now,
        quickHintText: action.text,
      };
      
      return {
        ...state,
        history: [...state.history, event],
        meetup: {
          ...state.meetup,
          quickHint: action.text,
        },
      };
    }
    
    default:
      return null;
  }
}

// ============================================
// HELPER: Get card preview text
// ============================================

export function getCardPreviewText(state: ConversationState): string | null {
  const { phase, meetup, exchangesCount } = state;
  
  switch (phase) {
    case 'idle':
      return null;
    case 'signal_sent':
      return 'Waiting for response';
    case 'signal_received':
      return 'They said hello';
    case 'dialog':
      if (exchangesCount >= 5) {
        return 'Dialog complete';
      }
      const lastEvent = state.history[state.history.length - 1];
      return lastEvent?.actor === 'you' ? 'Waiting for reply' : 'Your turn to reply';
    case 'meetup_intent_sent':
      return 'Waiting for response';
    case 'meetup_accepted':
      return 'They want to meet';
    case 'location_shared':
      return meetup.quickHint ? 'Location shared' : 'Location shared';
    case 'closed':
      return 'Closed for tonight';
    default:
      return null;
  }
}
