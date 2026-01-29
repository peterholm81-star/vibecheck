/**
 * Venue Room Choices Configuration
 * 
 * All user-facing copy for Mutual Moment feature.
 * Edit labels here to change wording without touching components.
 * 
 * CHECKPOINT 1: UI-only, no backend wiring yet.
 */

export type ChoiceKey = 'HI' | 'MEET';
export type HintKey = 'BAR' | 'ENTRANCE' | 'OUTSIDE';
export type SignalType = 'wave' | 'wink' | 'poke';

export const CHOICES: Record<ChoiceKey, { label: string }> = {
  HI: { label: 'Just saying hi' },
  MEET: { label: 'Want to meet tonight' },
};

export const MEET_HINTS: Record<HintKey, { label: string }> = {
  BAR: { label: 'At the bar' },
  ENTRANCE: { label: 'By the entrance' },
  OUTSIDE: { label: 'Outside for air' },
};

export const SIGNAL_LABELS: Record<SignalType, { emoji: string; label: string }> = {
  wave: { emoji: '👋', label: 'Wave' },
  wink: { emoji: '😉', label: 'Wink' },
  poke: { emoji: '👉', label: 'Poke' },
};
