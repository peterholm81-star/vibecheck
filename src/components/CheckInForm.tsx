import { useState, useEffect } from 'react';
import { MapPin, Send, CheckCircle, AlertCircle } from 'lucide-react';
import type { Venue, VibeScore, Intent, RelationshipStatus, OnsIntent } from '../types';
import {
  VIBE_SCORE_LABELS,
  INTENT_LABELS,
  INTENT_OPTIONS,
  RELATIONSHIP_STATUS_LABELS,
  ONS_INTENT_LABELS,
} from '../types';
import { useProfile } from '../hooks/useProfile';

interface CheckInFormProps {
  venues: Venue[];
  selectedVenueId?: string;
  onSubmit: (
    venueId: string,
    vibeScore: VibeScore,
    intent: Intent,
    relationshipStatus: RelationshipStatus | null,
    onsIntent: OnsIntent | null
  ) => Promise<void>;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const VIBE_OPTIONS: VibeScore[] = ['hot', 'good', 'ok', 'quiet'];

export function CheckInForm({ venues, selectedVenueId, onSubmit }: CheckInFormProps) {
  const { profile, isLoaded } = useProfile();
  
  const [venueId, setVenueId] = useState(selectedVenueId || '');
  const [vibeScore, setVibeScore] = useState<VibeScore | ''>('');
  const [intent, setIntent] = useState<Intent | ''>('');
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus | null>(null);
  const [onsIntent, setOnsIntent] = useState<OnsIntent | null>(null);
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // Sync venueId state when selectedVenueId prop changes (e.g., navigating from venue details)
  useEffect(() => {
    if (selectedVenueId) {
      setVenueId(selectedVenueId);
    }
  }, [selectedVenueId]);

  // Apply profile defaults when profile is loaded (only on initial load)
  useEffect(() => {
    if (isLoaded && !defaultsApplied) {
      if (profile.defaultIntent) {
        setIntent(profile.defaultIntent);
      }
      if (profile.defaultRelationshipStatus) {
        setRelationshipStatus(profile.defaultRelationshipStatus);
      }
      if (profile.defaultOnsIntent) {
        setOnsIntent(profile.defaultOnsIntent);
      }
      setDefaultsApplied(true);
    }
  }, [isLoaded, profile, defaultsApplied]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!venueId || !vibeScore || !intent) return;

    setFormState('submitting');
    setErrorMessage(null);

    try {
      await onSubmit(venueId, vibeScore, intent, relationshipStatus, onsIntent);
      setFormState('success');

      // Reset form after success (but keep profile defaults for next time)
      setTimeout(() => {
        setVenueId('');
        setVibeScore('');
        // Re-apply profile defaults after reset
        setIntent(profile.defaultIntent || '');
        setRelationshipStatus(profile.defaultRelationshipStatus);
        setOnsIntent(profile.defaultOnsIntent);
        setFormState('idle');
      }, 2000);
    } catch (err) {
      setFormState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const isValid = venueId && vibeScore && intent;

  // Success state
  if (formState === 'success') {
    return (
      <div className="flex-1 flex items-center justify-center px-4 sm:px-0">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 sm:p-8 max-w-md w-full text-center">
          <CheckCircle size={56} className="mx-auto text-green-400 mb-4 sm:w-16 sm:h-16" />
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Check-in Submitted!</h2>
          <p className="text-slate-400 text-sm sm:text-base">Thanks for sharing the vibe! 🎉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col sm:items-start sm:justify-center py-4 overflow-y-auto">
      <div className="bg-slate-800 sm:rounded-2xl border-y sm:border border-slate-700 p-4 sm:p-6 sm:max-w-md w-full mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Check In</h2>
        <p className="text-slate-400 text-sm mb-5 sm:mb-6">Share the vibe at your current spot</p>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-5">
          {/* Venue Selection */}
          <div>
            <label htmlFor="venue" className="block text-sm sm:text-sm font-medium text-slate-300 mb-2">
              <MapPin size={16} className="inline mr-1.5 -mt-0.5" />
              Where are you?
            </label>
            <select
              id="venue"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              disabled={formState === 'submitting'}
              className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="">Select a venue</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vibe Score Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              What's the vibe?
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {VIBE_OPTIONS.map((vibe) => (
                <button
                  key={vibe}
                  type="button"
                  onClick={() => setVibeScore(vibe)}
                  disabled={formState === 'submitting'}
                  className={`min-h-[48px] py-3.5 sm:py-3 px-4 rounded-xl border-2 font-medium text-base transition-all active:scale-[0.98] ${
                    vibeScore === vibe
                      ? 'border-violet-500 bg-violet-500/20 ring-2 ring-violet-500/30'
                      : 'border-slate-600 bg-slate-700 hover:border-slate-500'
                  } ${formState === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className={vibeScore === vibe ? 'text-violet-300' : 'text-slate-300'}>
                    {VIBE_SCORE_LABELS[vibe]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Intent Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              What are you looking for tonight?
            </label>
            <div className="flex flex-wrap gap-2.5 sm:gap-2">
              {INTENT_OPTIONS.map((intentOption) => (
                <button
                  key={intentOption}
                  type="button"
                  onClick={() => setIntent(intentOption)}
                  disabled={formState === 'submitting'}
                  className={`min-h-[40px] py-2.5 sm:py-2 px-4 sm:px-3 rounded-full border font-medium text-sm transition-all active:scale-[0.97] ${
                    intent === intentOption
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                      : 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  } ${formState === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {INTENT_LABELS[intentOption]}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700 pt-5 sm:pt-4">
            <p className="text-xs text-slate-500 mb-4">Valgfrie felt – hjelper andre finne riktig sted</p>
          </div>

          {/* Relationship Status (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sivilstatus (valgfritt)
            </label>
            <select
              value={relationshipStatus ?? ''}
              onChange={(e) =>
                setRelationshipStatus(
                  e.target.value === '' ? null : (e.target.value as RelationshipStatus)
                )
              }
              disabled={formState === 'submitting'}
              className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="">Ikke valgt</option>
              <option value="single">{RELATIONSHIP_STATUS_LABELS.single}</option>
              <option value="in_relationship">{RELATIONSHIP_STATUS_LABELS.in_relationship}</option>
              <option value="complicated">{RELATIONSHIP_STATUS_LABELS.complicated}</option>
              <option value="prefer_not_to_say">{RELATIONSHIP_STATUS_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* ONS Intent (optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              One night stand? (valgfritt)
            </label>
            <select
              value={onsIntent ?? ''}
              onChange={(e) =>
                setOnsIntent(
                  e.target.value === '' ? null : (e.target.value as OnsIntent)
                )
              }
              disabled={formState === 'submitting'}
              className="w-full px-4 py-3.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-xl sm:rounded-lg text-base sm:text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="">Ikke valgt</option>
              <option value="open">{ONS_INTENT_LABELS.open}</option>
              <option value="maybe">{ONS_INTENT_LABELS.maybe}</option>
              <option value="not_interested">{ONS_INTENT_LABELS.not_interested}</option>
              <option value="prefer_not_to_say">{ONS_INTENT_LABELS.prefer_not_to_say}</option>
            </select>
          </div>

          {/* Error Message */}
          {formState === 'error' && errorMessage && (
            <div className="flex items-center gap-2 p-3.5 sm:p-3 bg-red-500/20 border border-red-500/50 rounded-xl sm:rounded-lg text-red-300">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 sm:pt-0">
            <button
              type="submit"
              disabled={!isValid || formState === 'submitting'}
              className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white px-6 py-4 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[52px] sm:min-h-0"
            >
              {formState === 'submitting' ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Submit Check-in
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info text */}
        <p className="text-center text-xs text-slate-500 mt-4 pb-2 sm:pb-0">
          Alle check-ins er anonyme og hjelper andre finne beste viben i kveld.
        </p>
      </div>
    </div>
  );
}
