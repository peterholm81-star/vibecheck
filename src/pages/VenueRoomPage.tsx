/**
 * Venue Room Page - v1 LOCKED
 * 
 * Shows:
 * 1) Venue header with name and back button
 * 2) "Your presence" - current user's avatar
 * 3) "Others here now" - grid of other avatars
 * 
 * ============================================
 * DESIGN PRINCIPLES (LOCKED)
 * ============================================
 * 
 * 1) NO FREE CHAT - This is intentional, not a missing feature.
 *    - VibeCheck is NOT a messaging app
 *    - Free text enables harassment, unwanted contact, and pressure
 *    - Preset signals (wave/wink/poke) are safe, non-invasive, and reversible
 *    - The one-time "quick hint" (max 120 chars) is the only free text,
 *      and it's gated behind mutual consent + location sharing
 * 
 * 2) LOCATION GATED BEHIND CONSENT - This is a safety feature.
 *    - Users cannot share their location until BOTH parties express interest
 *    - Flow: signals → mutual → "Want to say hi?" → they accept → THEN location
 *    - This prevents one-sided stalking or unwanted approaches
 *    - The consent gate cannot be bypassed or skipped
 * 
 * 3) ONE-TIME INTERACTIONS - Prevents spam and pressure.
 *    - Quick hint: max ONE per avatar per night
 *    - Location: cannot be re-triggered after sharing (would need flow reset)
 *    - These limits are intentional friction against harassment
 * 
 * 4) EPHEMERAL STATE - Nothing persists beyond the session.
 *    - All interaction state resets when leaving the venue
 *    - No conversation history is saved to database
 *    - This is a feature: what happens in the venue stays in the venue
 * 
 * ============================================
 * CHECKPOINT 1: Mutual Moment UI (feature-flagged)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentAvatarProfile } from '../lib/avatarProfile';
import { AvatarChip, type AvatarChipData } from '../components/venueRoom/AvatarChip';

// State Machine (v1 LOCKED)
import {
  type ConversationState,
  type ConversationAction,
  type DialogReply,
  type LocationHint,
  type MeetupIntentAnswer,
  createInitialConversationState,
  transitionConversation,
  getConversationUIContext,
  getCardPreviewText,
  DIALOG_REPLY_OPTIONS,
} from '../components/venueRoom/conversationStateMachine';

// Sheet components
import { SignalSheet } from '../components/venueRoom/SignalSheet';
import { DialogReplySheet } from '../components/venueRoom/DialogReplySheet';
import { MeetupIntentSheet, MeetupResponseSheet } from '../components/venueRoom/MeetupIntentSheet';
import { LocationSheet } from '../components/venueRoom/LocationSheet';
import { QuickHintSheet } from '../components/venueRoom/QuickHintSheet';

// Legacy components (keeping for backwards compat / gradual migration)
import { ConnectionActionsSheet } from '../components/venueRoom/ConnectionActionsSheet';
import { FindEachOtherSheet } from '../components/venueRoom/FindEachOtherSheet';
import type { SignalType, ChoiceKey, HintKey } from '../config/venueRoomChoices';
import styles from '../components/venueRoom/venueRoomMutualMoment.module.css';

// Note: styles import kept for DEV mock panel styling

// ============================================
// FEATURE FLAGS - Checkpoint 1 UI-only
// ============================================

/** Enable Mutual Moment UI (set false to disable entirely) */
const ENABLE_VENUE_ROOM_MUTUAL_MOMENT_UI_V1 = true;

/** Show DEV mock buttons for testing flows (set false for production) */
const DEV_MOCKS = true;

// ============================================
// MOCK DATA - Demo avatars, easy to delete later
// ============================================

// Extended type with stable ID for state management
interface MockAvatar extends AvatarChipData {
  id: string; // Stable identifier for conversation state keying
}

const MOCK_AVATARS: MockAvatar[] = [
  {
    id: 'avatar-001',
    avatarGender: 'female',
    avatarAgeRange: '25–34',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: false,
    openForOns: null,
    energy: 'curious',
  },
  {
    id: 'avatar-002',
    avatarGender: 'male',
    avatarAgeRange: '25–34',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: true,
    openForOns: true,
    energy: 'playful',
  },
  {
    id: 'avatar-003',
    avatarGender: 'female',
    avatarAgeRange: '18–24',
    showRelationship: false,
    relationshipStatus: null,
    showOns: false,
    openForOns: null,
    energy: 'calm',
  },
  {
    id: 'avatar-004',
    avatarGender: 'male',
    avatarAgeRange: '35–44',
    showRelationship: true,
    relationshipStatus: 'relationship',
    showOns: false,
    openForOns: null,
    energy: null,
  },
  {
    id: 'avatar-005',
    avatarGender: 'female',
    avatarAgeRange: '25–34',
    showRelationship: true,
    relationshipStatus: 'single',
    showOns: true,
    openForOns: true,
    energy: 'playful',
  },
  {
    id: 'avatar-006',
    avatarGender: 'male',
    avatarAgeRange: '25–34',
    showRelationship: false,
    relationshipStatus: null,
    showOns: false,
    openForOns: null,
    energy: 'curious',
  },
];

// ============================================
// TYPES
// ============================================

interface VenueBasic {
  id: string;
  name: string;
}

interface VenueRoomPageProps {
  venueId: string;
  onBack: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VenueRoomPage({ venueId, onBack }: VenueRoomPageProps) {
  // Venue state
  const [venue, setVenue] = useState<VenueBasic | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [venueError, setVenueError] = useState<string | null>(null);

  // Current user avatar state
  const [currentUserAvatar, setCurrentUserAvatar] = useState<AvatarChipData | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);

  // ============================================
  // CONVERSATION STATE MACHINE (v1 LOCKED)
  // ============================================
  // 
  // IMPORTANT: All interaction state is EPHEMERAL.
  // It resets when:
  //   - User leaves VenueRoom (component unmount)
  //   - venueId changes (different venue)
  // This is intentional - see DESIGN PRINCIPLES above.
  // 
  // The state machine enforces:
  //   - Phase progression (idle → signal → dialog → meetup → location)
  //   - Turn limits (max 5 dialog exchanges)
  //   - Meetup gating (starter needs 3+ exchanges, receiver needs 1+)
  //   - Terminal states (closed conversation)
  // ============================================
  
  // Selected avatar for interaction (null = none selected)
  // Uses stable avatar ID (string), not array index
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  
  // Centralized conversation state per avatar: { avatarId: ConversationState }
  // IMPORTANT: Keyed by stable avatar.id, NOT array index
  const [conversations, setConversations] = useState<Record<string, ConversationState>>({});
  
  // Track interaction timestamps for sorting: { avatarId: timestamp }
  const [interactionTimes, setInteractionTimes] = useState<Record<string, number>>({});
  
  // Sheet open states
  const [isSignalSheetOpen, setIsSignalSheetOpen] = useState(false);
  const [isDialogSheetOpen, setIsDialogSheetOpen] = useState(false);
  const [isMeetupIntentSheetOpen, setIsMeetupIntentSheetOpen] = useState(false);
  const [isMeetupResponseSheetOpen, setIsMeetupResponseSheetOpen] = useState(false);
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);
  const [isQuickHintSheetOpen, setIsQuickHintSheetOpen] = useState(false);
  
  // Conversation panel open state (for viewing interaction history - mobile)
  const [isConversationPanelOpen, setIsConversationPanelOpen] = useState(false);
  
  // Legacy: Mock connection state for testing UI flow (kept for backwards compat)
  const [showConnectionSheet, setShowConnectionSheet] = useState(false);
  const [_userChoice, setUserChoice] = useState<ChoiceKey | null>(null);
  const [showFindSheet, setShowFindSheet] = useState(false);
  
  // Ref to track pending mock response timers per avatar (to prevent stale dispatches)
  // Keyed by avatar.id (string)
  const pendingMockTimers = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Ref to track current conversations state (for reading in async callbacks)
  // This avoids stale closure issues in setTimeout callbacks
  const conversationsRef = useRef<Record<string, ConversationState>>(conversations);
  
  // Keep ref in sync with state
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  
  // ============================================
  // STATE RESET - Clean slate when leaving/changing venue
  // ============================================
  
  /**
   * Reset all interaction state to initial values.
   * Called when venueId changes or component unmounts.
   * This ensures no stale interaction data persists across venues.
   */
  const resetAllInteractionState = useCallback(() => {
    // Clear all pending mock timers to prevent stale dispatches
    Object.values(pendingMockTimers.current).forEach(timerId => {
      clearTimeout(timerId);
    });
    pendingMockTimers.current = {};
    
    setSelectedAvatarId(null);
    setConversations({});
    setInteractionTimes({});
    setIsSignalSheetOpen(false);
    setIsDialogSheetOpen(false);
    setIsMeetupIntentSheetOpen(false);
    setIsMeetupResponseSheetOpen(false);
    setIsLocationSheetOpen(false);
    setIsQuickHintSheetOpen(false);
    setIsConversationPanelOpen(false);
    setShowConnectionSheet(false);
    setUserChoice(null);
    setShowFindSheet(false);
  }, []);
  
  // Reset interaction state when venueId changes
  useEffect(() => {
    return () => {
      resetAllInteractionState();
    };
  }, [venueId, resetAllInteractionState]);
  
  // ============================================
  // STATE MACHINE DISPATCH
  // ============================================
  
  /**
   * Get conversation state for an avatar by ID (creates initial if not exists)
   */
  const getConversation = useCallback((avatarId: string): ConversationState => {
    return conversations[avatarId] || createInitialConversationState();
  }, [conversations]);

  /**
   * Dispatch an action to the conversation state machine for an avatar.
   * Returns true if action was valid, false if rejected.
   * 
   * @param avatarId - Stable avatar ID (NOT array index)
   * @param action - The action to dispatch
   */
  const dispatchConversationAction = useCallback((
    avatarId: string,
    action: ConversationAction
  ): boolean => {
    const currentState = getConversation(avatarId);
    const newState = transitionConversation(currentState, action);
    
    if (newState === null) {
      // Debug: include avatar ID and current phase in warning
      console.warn(`[VenueRoom] Action '${action.type}' rejected for avatar '${avatarId}' (current phase: '${currentState.phase}')`);
      return false;
    }
    
    // DEV debug logging
    if (DEV_MOCKS) {
      console.log(`[VenueRoom] Dispatch: avatarId='${avatarId}', action='${action.type}', phase: '${currentState.phase}' → '${newState.phase}'`);
    }
    
    setConversations(prev => {
      const updated = {
        ...prev,
        [avatarId]: newState,
      };
      // DEV debug: log conversation keys count
      if (DEV_MOCKS) {
        console.log(`[VenueRoom] Conversations count: ${Object.keys(updated).length}, keys: [${Object.keys(updated).join(', ')}]`);
      }
      return updated;
    });
    
    // Update interaction time for sorting
    setInteractionTimes(prev => ({
      ...prev,
      [avatarId]: Date.now(),
    }));
    
    return true;
  }, [getConversation]);
  
  // ============================================
  // COMPUTED UI CONTEXT
  // ============================================
  
  // Get UI context for selected avatar
  const selectedUIContext = useMemo(() => {
    if (selectedAvatarId === null) {
      return getConversationUIContext(createInitialConversationState());
    }
    return getConversationUIContext(getConversation(selectedAvatarId));
  }, [selectedAvatarId, getConversation, conversations]);
  
  // Get the selected avatar object (for passing to sheets/panels)
  const selectedAvatar = useMemo(() => {
    if (selectedAvatarId === null) return null;
    return MOCK_AVATARS.find(a => a.id === selectedAvatarId) || null;
  }, [selectedAvatarId]);
  
  // ============================================
  // SORTED AVATARS - prioritize last interacted
  // ============================================
  
  // Sort avatars by interaction time (most recent first)
  // Returns array of avatars (not indices) to preserve stable ID reference
  const sortedAvatars = useMemo(() => {
    // Sort by interaction time (most recent first), then by original order
    return [...MOCK_AVATARS].sort((a, b) => {
      const timeA = interactionTimes[a.id] || 0;
      const timeB = interactionTimes[b.id] || 0;
      
      // If both have interaction times, sort by most recent
      if (timeA && timeB) return timeB - timeA;
      // If only one has interaction time, it comes first
      if (timeA) return -1;
      if (timeB) return 1;
      // Otherwise keep original order (by index in original array)
      return MOCK_AVATARS.indexOf(a) - MOCK_AVATARS.indexOf(b);
    });
  }, [interactionTimes]);

  // ============================================
  // STATE MACHINE HANDLERS (v1 LOCKED)
  // ============================================

  const handleAvatarClick = (avatarId: string) => {
    if (!ENABLE_VENUE_ROOM_MUTUAL_MOMENT_UI_V1) return;
    
    const isMobile = window.innerWidth < 768;
    const conversation = getConversation(avatarId);
    const hasInteraction = conversation.phase !== 'idle';
    
    // Toggle selection on desktop
    if (selectedAvatarId === avatarId && !isMobile) {
      setSelectedAvatarId(null);
      setIsConversationPanelOpen(false);
    } else {
      setSelectedAvatarId(avatarId);
      
      // On mobile: if they have interaction history, show conversation panel
      // Otherwise show signal sheet to send first signal
      if (isMobile) {
        if (hasInteraction) {
          setIsConversationPanelOpen(true);
        } else {
          setIsSignalSheetOpen(true);
        }
      }
    }
  };
  
  const handleCloseSignalSheet = () => {
    setIsSignalSheetOpen(false);
    if (window.innerWidth < 768) {
      setTimeout(() => setSelectedAvatarId(null), 200);
    }
  };
  
  const handleCloseConversationPanel = () => {
    setIsConversationPanelOpen(false);
    setTimeout(() => setSelectedAvatarId(null), 200);
  };
  
  // Primary CTA handler - opens appropriate sheet based on state
  const handlePrimaryCTA = () => {
    if (selectedAvatarId === null || selectedUIContext.ctaDisabled) return;
    
    setIsConversationPanelOpen(false);
    
    switch (selectedUIContext.ctaAction) {
      case 'open_signal_sheet':
        setIsSignalSheetOpen(true);
        break;
      case 'open_dialog_sheet':
        setIsDialogSheetOpen(true);
        break;
      case 'open_meetup_intent':
        setIsMeetupIntentSheetOpen(true);
        break;
      case 'open_location_sheet':
        setIsLocationSheetOpen(true);
        break;
      case 'none':
      default:
        break;
    }
  };
  
  // Secondary CTA handler
  const handleSecondaryCTA = () => {
    if (selectedAvatarId === null || !selectedUIContext.secondaryCtaAction) return;
    
    switch (selectedUIContext.secondaryCtaAction) {
      case 'open_meetup_intent':
        setIsMeetupIntentSheetOpen(true);
        break;
      case 'open_quick_hint':
        setIsQuickHintSheetOpen(true);
        break;
    }
  };
  
  // Send signal (Phase 0 -> Phase 1)
  const handleSendSignal = (type: SignalType) => {
    console.log('[DIAG] handleSendSignal called, type:', type, 'selectedAvatarId:', selectedAvatarId);
    if (selectedAvatarId === null) return;
    
    const success = dispatchConversationAction(selectedAvatarId, {
      type: 'SEND_SIGNAL',
      signalType: type,
    });
    console.log('[DIAG] SEND_SIGNAL dispatch result:', success);
    
    if (success) {
      setIsSignalSheetOpen(false);
      
      // Clear any existing timer for this avatar
      if (pendingMockTimers.current[selectedAvatarId]) {
        clearTimeout(pendingMockTimers.current[selectedAvatarId]);
      }
      
      // Mock: simulate response after delay
      const avatarId = selectedAvatarId; // Capture stable ID for closure
      const delay = 2000 + Math.random() * 3000;
      console.log('[DIAG] Scheduling mock response for avatarId:', avatarId, 'delay:', delay.toFixed(0), 'ms');
      
      const timerId = setTimeout(() => {
        console.log('[DIAG] setTimeout fired for avatarId:', avatarId);
        // Clean up timer ref
        delete pendingMockTimers.current[avatarId];
        
        // Read current conversation from ref (avoids stale closure)
        const currentConvo = conversationsRef.current[avatarId];
        const phase = currentConvo?.phase;
        console.log('[DIAG] currentConvo phase:', phase);
        
        // FASE B: Phase should now always be defined after SEND_SIGNAL
        // Only allow response if phase is 'signal_sent' (we sent, waiting for response)
        if (phase !== 'signal_sent') {
          console.log('[DIAG] Phase check failed (expected signal_sent, got:', phase, '), skipping mock response');
          return;
        }
        console.log('[DIAG] Phase check passed (signal_sent), proceeding with mock response');
        
        // 70% chance of response (100% in DEV_MOCKS mode for deterministic testing)
        const roll = Math.random();
        const threshold = DEV_MOCKS ? 1.0 : 0.7; // Always respond in demo mode
        console.log('[DIAG] Random roll:', roll.toFixed(2), `(need < ${threshold} for response, DEV_MOCKS=${DEV_MOCKS})`);
        if (roll < threshold) {
          const responseTypes: SignalType[] = ['wave', 'wink', 'poke'];
          const randomResponse = responseTypes[Math.floor(Math.random() * responseTypes.length)];
          console.log('[DIAG] Dispatching RECEIVE_SIGNAL:', randomResponse, 'to avatarId:', avatarId);
          dispatchConversationAction(avatarId, {
            type: 'RECEIVE_SIGNAL',
            signalType: randomResponse,
          });
        } else {
          console.log('[DIAG] No response (30% chance hit)');
        }
      }, delay);
      
      pendingMockTimers.current[selectedAvatarId] = timerId;
    }
  };
  
  // Send dialog reply (Phase 2)
  const handleSendDialogReply = (reply: DialogReply) => {
    if (selectedAvatarId === null) return;
    
    const success = dispatchConversationAction(selectedAvatarId, {
      type: 'SEND_DIALOG_REPLY',
      reply,
    });
    
    if (success) {
      setIsDialogSheetOpen(false);
      
      // Clear any existing timer for this avatar
      if (pendingMockTimers.current[selectedAvatarId]) {
        clearTimeout(pendingMockTimers.current[selectedAvatarId]);
      }
      
      // Mock: simulate reply after delay
      const avatarId = selectedAvatarId; // Capture stable ID for closure
      const timerId = setTimeout(() => {
        // Clean up timer ref
        delete pendingMockTimers.current[avatarId];
        
        // Read current conversation from ref (avoids stale closure)
        const currentConvo = conversationsRef.current[avatarId];
        console.log('[DIAG] Dialog setTimeout fired, phase:', currentConvo?.phase);
        
        if (!currentConvo || currentConvo.phase !== 'dialog') {
          // Phase changed (e.g., user proposed meetup), skip dispatch
          console.log('[DIAG] Dialog phase check failed, skipping');
          return;
        }
        
        // Check if exchange limit reached
        if (currentConvo.exchangesCount >= 5) {
          console.log('[DIAG] Exchange limit reached, skipping');
          return;
        }
        
        // 80% chance of reply (100% in DEV_MOCKS mode for deterministic testing)
        const dialogThreshold = DEV_MOCKS ? 1.0 : 0.8;
        if (Math.random() < dialogThreshold) {
          const randomReply = DIALOG_REPLY_OPTIONS[Math.floor(Math.random() * DIALOG_REPLY_OPTIONS.length)];
          console.log('[DIAG] Dispatching RECEIVE_DIALOG_REPLY to avatarId:', avatarId);
          dispatchConversationAction(avatarId, {
            type: 'RECEIVE_DIALOG_REPLY',
            reply: randomReply,
          });
        } else {
          console.log('[DIAG] No dialog reply (20% chance hit)');
        }
      }, 1500 + Math.random() * 2500);
      
      pendingMockTimers.current[selectedAvatarId] = timerId;
    }
  };
  
  // Send meetup intent (Phase 2 -> Phase 3)
  const handleSendMeetupIntent = () => {
    if (selectedAvatarId === null) return;
    
    const success = dispatchConversationAction(selectedAvatarId, {
      type: 'SEND_MEETUP_INTENT',
    });
    
    if (success) {
      setIsMeetupIntentSheetOpen(false);
      
      // Show response sheet for demo (in production this would be async)
      setTimeout(() => {
        setIsMeetupResponseSheetOpen(true);
      }, 500);
    }
  };
  
  // Decline meetup opportunity (user chooses "Not tonight" before asking)
  const handleDeclineMeetup = () => {
    if (selectedAvatarId === null) return;
    
    dispatchConversationAction(selectedAvatarId, {
      type: 'DECLINE_MEETUP',
    });
    
    setIsMeetupIntentSheetOpen(false);
  };
  
  // Receive meetup response (Phase 3)
  const handleMeetupResponse = (answer: MeetupIntentAnswer) => {
    if (selectedAvatarId === null || !answer) return;
    
    dispatchConversationAction(selectedAvatarId, {
      type: 'RECEIVE_MEETUP_RESPONSE',
      answer,
    });
    
    setIsMeetupResponseSheetOpen(false);
  };
  
  // Share location (Phase 4)
  const handleShareLocation = (location: LocationHint) => {
    if (selectedAvatarId === null) return;
    
    const success = dispatchConversationAction(selectedAvatarId, {
      type: 'SHARE_LOCATION',
      location,
    });
    
    if (success) {
      setIsLocationSheetOpen(false);
    }
  };
  
  // Send quick hint (Phase 4, optional)
  const handleSendQuickHint = (text: string) => {
    if (selectedAvatarId === null) return;
    
    const success = dispatchConversationAction(selectedAvatarId, {
      type: 'SEND_QUICK_HINT',
      text,
    });
    
    if (success) {
      setIsQuickHintSheetOpen(false);
    }
  };
  
  // Legacy handlers for backwards compat (kept for ConnectionActionsSheet / FindEachOtherSheet)
  const handleChoose = (choiceKey: ChoiceKey) => {
    setUserChoice(choiceKey);
    setShowConnectionSheet(false);
    console.log('[MutualMoment] User chose:', choiceKey);
  };

  const handlePickHint = (hintKey: HintKey) => {
    setShowFindSheet(false);
    console.log('[MutualMoment] User picked hint:', hintKey);
  };

  // DEV mock handlers
  const handleDevSimulateConnection = () => {
    setShowConnectionSheet(true);
  };

  const handleDevSimulateBothMeet = () => {
    setShowFindSheet(true);
  };

  // Fetch venue data
  useEffect(() => {
    async function fetchVenue() {
      if (!supabase || !venueId) {
        setVenue({ id: venueId, name: 'Unknown venue' });
        setVenueLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('venues')
          .select('id, name')
          .eq('id', venueId)
          .single();

        if (error) {
          console.error('[VenueRoom] Error fetching venue:', error);
          setVenueError('Could not load venue');
          setVenue({ id: venueId, name: 'Unknown venue' });
        } else if (data) {
          setVenue(data);
        } else {
          setVenue({ id: venueId, name: 'Unknown venue' });
        }
      } catch (err) {
        console.error('[VenueRoom] Exception:', err);
        setVenueError('Something went wrong');
        setVenue({ id: venueId, name: 'Unknown venue' });
      } finally {
        setVenueLoading(false);
      }
    }

    fetchVenue();
  }, [venueId]);

  // Fetch current user's avatar profile
  useEffect(() => {
    async function fetchAvatar() {
      try {
        const profile = await getCurrentAvatarProfile();
        if (profile.avatarGender && profile.avatarAgeRange) {
          setCurrentUserAvatar({
            avatarGender: profile.avatarGender,
            avatarAgeRange: profile.avatarAgeRange,
            showRelationship: profile.showRelationship,
            relationshipStatus: profile.relationshipStatus,
            showOns: profile.showOns,
            openForOns: profile.openForOns,
            energy: profile.energy,
            isCurrentUser: true,
          });
        } else {
          setCurrentUserAvatar(null);
        }
      } catch (err) {
        console.error('[VenueRoom] Error fetching avatar:', err);
        setCurrentUserAvatar(null);
      } finally {
        setAvatarLoading(false);
      }
    }

    fetchAvatar();
  }, []);

  // Loading state
  if (venueLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header - clean, mature design */}
      <header className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white truncate">
              {venue?.name || 'Venue'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {MOCK_AVATARS.length + (currentUserAvatar ? 1 : 0)} people here now
            </p>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {venueError && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-amber-300 text-sm">
            <AlertCircle size={16} />
            <span>{venueError}</span>
          </div>
        </div>
      )}

      {/* About banner - compact, visible without scrolling */}
      <div className="bg-slate-800/50 border-b border-slate-700/30 px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 text-slate-400">
          <Info size={14} className="flex-shrink-0 text-slate-500" />
          <p className="text-xs leading-relaxed">
            Everyone here is anonymous — no photos, no names, just presence and intent.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 space-y-5">
        {/* Current User Section - compact */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {avatarLoading ? (
                <div className="w-16 h-16 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                </div>
              ) : currentUserAvatar ? (
                <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden border-2 border-violet-500/30">
                  <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-violet-400">
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
                  </svg>
                </div>
              ) : null}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">Your presence</p>
              <p className="text-xs text-slate-500 mt-0.5">Visible to others anonymously</p>
            </div>
          </div>
        </section>

        {/* Others in Room Section */}
        <section className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300">
              Others here now
            </h2>
            <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
              {MOCK_AVATARS.length}
            </span>
          </div>

          {/* Demo notice - very subtle */}
          <div className="mb-4 py-1.5 px-2.5 bg-slate-700/20 border border-slate-600/20 rounded text-center">
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">
              Demo mode
            </p>
          </div>

          {/* Avatar Grid with optional ConversationPanel on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {sortedAvatars.map((avatar) => {
              // Use stable avatar.id for all state lookups
              const isSelected = selectedAvatarId === avatar.id;
              const conversation = getConversation(avatar.id);
              const hasInteraction = conversation.phase !== 'idle';
              
              // Get preview text from THIS avatar's conversation state
              const interactionPreview = getCardPreviewText(conversation);
              
              // Determine indicator color based on phase
              const getIndicatorColor = () => {
                const { phase } = conversation;
                if (phase === 'closed') {
                  return isSelected ? 'bg-slate-400' : 'bg-slate-500/60';
                }
                if (phase === 'location_shared') {
                  return isSelected ? 'bg-emerald-400' : 'bg-emerald-500/60';
                }
                if (phase === 'meetup_accepted') {
                  return isSelected ? 'bg-emerald-400' : 'bg-emerald-500/60';
                }
                if (phase === 'meetup_intent_sent') {
                  return isSelected ? 'bg-amber-400' : 'bg-amber-500/60';
                }
                if (phase === 'dialog') {
                  return isSelected ? 'bg-violet-400' : 'bg-violet-500/60';
                }
                // signal_sent or signal_received
                return isSelected ? 'bg-violet-400' : 'bg-violet-500/60';
              };

              return (
                <div
                  key={avatar.id}
                  className={`
                    relative transition-all rounded-2xl
                    ${isSelected ? 'ring-2 ring-violet-500/40 ring-offset-2 ring-offset-slate-900' : ''}
                  `}
                >
                  <AvatarChip 
                    data={avatar} 
                    size="sm" 
                    onClick={() => handleAvatarClick(avatar.id)}
                    interactionPreview={interactionPreview}
                  />
                  {/* Indicator dot - shows conversation phase */}
                  {hasInteraction && (
                    <div className={`
                      absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900
                      ${getIndicatorColor()}
                    `} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Desktop Conversation Panel - shows when avatar selected */}
        {selectedAvatarId !== null && (
          <div className="hidden md:block">
            <DesktopConversationPanel
              conversation={getConversation(selectedAvatarId)}
              selectedAvatar={MOCK_AVATARS.find(a => a.id === selectedAvatarId) || MOCK_AVATARS[0]}
              uiContext={selectedUIContext}
              onPrimaryCTA={handlePrimaryCTA}
              onSecondaryCTA={handleSecondaryCTA}
              onDeclineMeetup={handleDeclineMeetup}
            />
          </div>
        )}
        
        {/* Placeholder when no avatar selected (desktop) */}
        {selectedAvatarId === null && (
          <div className="hidden md:block bg-slate-800/30 rounded-xl border border-slate-700/30 p-6 text-center">
            <p className="text-slate-500 text-sm">Select someone to see your conversation</p>
          </div>
        )}

        {/* DEV Mock Panel - for testing Mutual Moment UI flow */}
        {ENABLE_VENUE_ROOM_MUTUAL_MOMENT_UI_V1 && DEV_MOCKS && (
          <div className={styles.devMockPanel}>
            <p className={styles.devMockLabel}>Dev Testing Only</p>
            <button
              className={styles.devMockButton}
              onClick={handleDevSimulateConnection}
            >
              Legacy: Simulate connection
            </button>
            <button
              className={styles.devMockButton}
              onClick={handleDevSimulateBothMeet}
            >
              Legacy: Simulate both chose MEET
            </button>
            {selectedAvatarId !== null && (
              <p className="text-xs text-violet-300 mt-2">
                Phase: {getConversation(selectedAvatarId).phase}
              </p>
            )}
          </div>
        )}
      </main>

      {/* Bottom Sheets (State Machine v1) */}
      {ENABLE_VENUE_ROOM_MUTUAL_MOMENT_UI_V1 && (
        <>
          {/* Signal Sheet - Phase 0 → Phase 1 */}
          <SignalSheet
            isOpen={isSignalSheetOpen}
            onClose={handleCloseSignalSheet}
            selectedAvatar={selectedAvatar}
            selectedIndex={0} // Legacy prop, not used for state keying
            sentSignals={[]} // State machine handles this internally now
            onSendSignal={handleSendSignal}
          />
          
          {/* Dialog Reply Sheet - Phase 2 */}
          <DialogReplySheet
            isOpen={isDialogSheetOpen}
            onClose={() => setIsDialogSheetOpen(false)}
            selectedAvatar={selectedAvatar}
            onSelectReply={handleSendDialogReply}
            exchangesCount={selectedAvatarId !== null ? getConversation(selectedAvatarId).exchangesCount : 0}
          />
          
          {/* Meetup Intent Sheet - Phase 3 (ask) */}
          <MeetupIntentSheet
            isOpen={isMeetupIntentSheetOpen}
            onClose={() => setIsMeetupIntentSheetOpen(false)}
            selectedAvatar={selectedAvatar}
            onSendIntent={handleSendMeetupIntent}
            onDecline={handleDeclineMeetup}
          />
          
          {/* Meetup Response Sheet - Phase 3 (demo response selection) */}
          <MeetupResponseSheet
            isOpen={isMeetupResponseSheetOpen}
            onClose={() => setIsMeetupResponseSheetOpen(false)}
            selectedAvatar={selectedAvatar}
            onSelectResponse={handleMeetupResponse}
          />
          
          {/* Location Sheet - Phase 4 */}
          <LocationSheet
            isOpen={isLocationSheetOpen}
            onClose={() => setIsLocationSheetOpen(false)}
            selectedAvatar={selectedAvatar}
            onSelectLocation={handleShareLocation}
          />
          
          {/* Quick Hint Sheet - Phase 4 (optional) */}
          <QuickHintSheet
            isOpen={isQuickHintSheetOpen}
            onClose={() => setIsQuickHintSheetOpen(false)}
            selectedAvatar={selectedAvatar}
            onSendHint={handleSendQuickHint}
          />
          
          {/* Mobile Conversation Panel */}
          {isConversationPanelOpen && selectedAvatarId !== null && selectedAvatar && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden"
                onClick={handleCloseConversationPanel}
                aria-hidden="true"
              />
              
              {/* Sheet */}
              <div 
                className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Conversation"
              >
                <MobileConversationPanel
                  conversation={getConversation(selectedAvatarId)}
                  selectedAvatar={selectedAvatar}
                  uiContext={selectedUIContext}
                  onClose={handleCloseConversationPanel}
                  onPrimaryCTA={handlePrimaryCTA}
                  onSecondaryCTA={handleSecondaryCTA}
                  onDeclineMeetup={handleDeclineMeetup}
                />
              </div>
            </>
          )}
          
          {/* Legacy sheets (kept for backwards compat) */}
          <ConnectionActionsSheet
            isOpen={showConnectionSheet}
            onClose={() => setShowConnectionSheet(false)}
            onChoose={handleChoose}
          />
          <FindEachOtherSheet
            isOpen={showFindSheet}
            onClose={() => setShowFindSheet(false)}
            onPickHint={handlePickHint}
          />
        </>
      )}
    </div>
  );
}

// ============================================
// DESKTOP CONVERSATION PANEL COMPONENT
// ============================================

interface ConversationPanelProps {
  conversation: ConversationState;
  selectedAvatar: AvatarChipData;
  uiContext: ReturnType<typeof getConversationUIContext>;
  onPrimaryCTA: () => void;
  onSecondaryCTA: () => void;
  onDeclineMeetup: () => void;
}

function DesktopConversationPanel({
  conversation,
  selectedAvatar,
  uiContext,
  onPrimaryCTA,
  onSecondaryCTA,
  onDeclineMeetup,
}: ConversationPanelProps) {
  const { history, phase, exchangesCount, meetup } = conversation;
  
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/40 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-400">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">
              {selectedAvatar.energy === 'curious' ? 'Open to conversation' :
               selectedAvatar.energy === 'playful' ? 'Here with friends' : 
               'Just observing tonight'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedAvatar.avatarGender === 'female' ? 'Woman' : 'Man'} · {selectedAvatar.avatarAgeRange}
            </p>
          </div>
        </div>
      </div>
      
      {/* Interaction History */}
      <div className="p-4 max-h-60 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No interactions yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((event) => (
              <InteractionEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
      
      {/* Status & Actions */}
      <div className="p-4 border-t border-slate-700/30 space-y-3">
        {/* Status hint */}
        <p className={`text-xs text-center ${uiContext.isClosed ? 'text-slate-500 italic' : 'text-slate-400'}`}>
          {uiContext.statusHint}
        </p>
        
        {/* Exchange counter (Phase 2) */}
        {phase === 'dialog' && exchangesCount > 0 && (
          <p className="text-[10px] text-slate-500 text-center uppercase tracking-wide">
            {exchangesCount}/5 exchanges
          </p>
        )}
        
        {/* CTAs */}
        {!uiContext.isClosed && (
          <div className="space-y-2">
            {/* Primary CTA */}
            {uiContext.ctaLabel && (
              <button
                onClick={onPrimaryCTA}
                disabled={uiContext.ctaDisabled}
                className={`
                  w-full py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${uiContext.ctaDisabled
                    ? 'bg-slate-700/30 border border-slate-600/30 text-slate-500 cursor-not-allowed'
                    : phase === 'meetup_accepted' || phase === 'location_shared'
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30'
                      : 'bg-violet-600/20 border border-violet-500/40 text-violet-200 hover:bg-violet-600/30'
                  }
                `}
              >
                {uiContext.ctaLabel}
              </button>
            )}
            
            {/* Secondary CTA - Special handling for meetup intent */}
            {uiContext.secondaryCtaLabel && uiContext.secondaryCtaAction === 'open_meetup_intent' && (
              <div className="space-y-2 pt-2 border-t border-slate-700/30">
                <p className="text-sm text-center text-slate-300 font-medium">
                  {uiContext.secondaryCtaLabel}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onSecondaryCTA}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={onDeclineMeetup}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:bg-slate-700/50 transition-colors"
                  >
                    Not tonight
                  </button>
                </div>
              </div>
            )}
            
            {/* Other secondary CTAs (e.g., quick hint) */}
            {uiContext.secondaryCtaLabel && uiContext.secondaryCtaAction !== 'open_meetup_intent' && (
              <button
                onClick={onSecondaryCTA}
                className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 transition-colors"
              >
                {uiContext.secondaryCtaLabel}
              </button>
            )}
          </div>
        )}
        
        {/* Quick hint sent confirmation */}
        {meetup.quickHint && (
          <p className="text-xs text-center text-emerald-400/70">✓ Hint sent</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// MOBILE CONVERSATION PANEL COMPONENT
// ============================================

interface MobileConversationPanelProps extends ConversationPanelProps {
  onClose: () => void;
}

function MobileConversationPanel({
  conversation,
  selectedAvatar,
  uiContext,
  onClose,
  onPrimaryCTA,
  onSecondaryCTA,
  onDeclineMeetup,
}: MobileConversationPanelProps) {
  const { history, phase, exchangesCount, meetup } = conversation;
  
  return (
    <div className="bg-slate-800 rounded-t-2xl border-t border-slate-700/50 max-h-[70vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-slate-400">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7" fill="currentColor" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">
              {selectedAvatar.energy === 'curious' ? 'Open to conversation' :
               selectedAvatar.energy === 'playful' ? 'Here with friends' : 
               'Just observing tonight'}
            </p>
            <p className="text-xs text-slate-500">
              {selectedAvatar.avatarGender === 'female' ? 'Woman' : 'Man'} · {selectedAvatar.avatarAgeRange}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      
      {/* Interaction History */}
      <div className="flex-1 p-4 overflow-y-auto">
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">No interactions yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((event) => (
              <InteractionEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
      
      {/* Status & Actions */}
      <div className="p-4 border-t border-slate-700/30 space-y-3">
        {/* Status hint */}
        <p className={`text-xs text-center ${uiContext.isClosed ? 'text-slate-500 italic' : 'text-slate-400'}`}>
          {uiContext.statusHint}
        </p>
        
        {/* Exchange counter (Phase 2) */}
        {phase === 'dialog' && exchangesCount > 0 && (
          <p className="text-[10px] text-slate-500 text-center uppercase tracking-wide">
            {exchangesCount}/5 exchanges
          </p>
        )}
        
        {/* CTAs */}
        {!uiContext.isClosed && (
          <div className="space-y-2">
            {/* Primary CTA */}
            {uiContext.ctaLabel && (
              <button
                onClick={onPrimaryCTA}
                disabled={uiContext.ctaDisabled}
                className={`
                  w-full py-3 rounded-xl text-sm font-medium transition-colors
                  ${uiContext.ctaDisabled
                    ? 'bg-slate-700/30 border border-slate-600/30 text-slate-500 cursor-not-allowed'
                    : phase === 'meetup_accepted' || phase === 'location_shared'
                      ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30'
                      : 'bg-violet-600/20 border border-violet-500/40 text-violet-200 hover:bg-violet-600/30'
                  }
                `}
              >
                {uiContext.ctaLabel}
              </button>
            )}
            
            {/* Secondary CTA - Special handling for meetup intent */}
            {uiContext.secondaryCtaLabel && uiContext.secondaryCtaAction === 'open_meetup_intent' && (
              <div className="space-y-2 pt-2 border-t border-slate-700/30">
                <p className="text-sm text-center text-slate-300 font-medium">
                  {uiContext.secondaryCtaLabel}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={onSecondaryCTA}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/30 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={onDeclineMeetup}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:bg-slate-700/50 transition-colors"
                  >
                    Not tonight
                  </button>
                </div>
              </div>
            )}
            
            {/* Other secondary CTAs (e.g., quick hint) */}
            {uiContext.secondaryCtaLabel && uiContext.secondaryCtaAction !== 'open_meetup_intent' && (
              <button
                onClick={onSecondaryCTA}
                className="w-full py-2 rounded-xl text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/30 transition-colors"
              >
                {uiContext.secondaryCtaLabel}
              </button>
            )}
          </div>
        )}
        
        {/* Quick hint sent confirmation */}
        {meetup.quickHint && (
          <p className="text-xs text-center text-emerald-400/70">✓ Hint sent</p>
        )}
      </div>
      
      {/* Safe area padding for mobile */}
      <div className="h-safe-area-inset-bottom" />
    </div>
  );
}

// ============================================
// INTERACTION EVENT ROW COMPONENT
// ============================================

import type { ConversationEvent } from '../components/venueRoom/conversationStateMachine';

function InteractionEventRow({ event }: { event: ConversationEvent }) {
  const isYou = event.actor === 'you';
  
  const getEventText = () => {
    switch (event.type) {
      case 'signal_sent':
      case 'signal_received':
        const signalEmoji = event.signalType === 'wave' ? '👋' : event.signalType === 'wink' ? '😉' : '👉';
        return `${isYou ? 'You' : 'They'} ${event.signalType === 'wave' ? 'waved' : event.signalType === 'wink' ? 'winked' : 'poked'} ${signalEmoji}`;
      case 'dialog_sent':
      case 'dialog_received':
        return `${isYou ? 'You' : 'They'}: "${event.dialogReply}"`;
      case 'meetup_intent_sent':
        return `${isYou ? 'You' : 'They'} asked to meet in person`;
      case 'meetup_intent_received':
        return `${isYou ? 'You' : 'They'} asked to meet in person`;
      case 'meetup_response':
        const answer = event.meetupAnswer;
        if (answer === 'yes') return `${isYou ? 'You' : 'They'} said yes ✨`;
        if (answer === 'maybe') return `${isYou ? 'You' : 'They'} said maybe another time`;
        return `${isYou ? 'You' : 'They'} said not tonight`;
      case 'location_shared':
        const loc = event.locationHint === 'near_bar' ? 'near the bar' :
                    event.locationHint === 'near_entrance' ? 'near the entrance' : 'by the counter';
        return `${isYou ? 'You' : 'They'} shared location: ${loc}`;
      case 'quick_hint_sent':
        return `${isYou ? 'You' : 'They'} sent a hint: "${event.quickHintText}"`;
      default:
        return 'Unknown event';
    }
  };
  
  return (
    <div className={`text-xs py-1.5 ${isYou ? 'text-slate-300' : 'text-slate-400'}`}>
      {getEventText()}
    </div>
  );
}

export default VenueRoomPage;

