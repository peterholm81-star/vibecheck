/**
 * Avatar Setup Page
 * 
 * One-screen wizard for setting up avatar profile before entering Venue Rooms.
 * Uses big tap targets, no text input.
 * 
 * Required fields:
 * - Gender (Male/Female)
 * - Age Range (from existing AgeBand type)
 * 
 * Optional fields:
 * - Show relationship? → Single / I forhold
 * - Show ONS? → Åpen for ONS toggle
 * - Energy (calm/curious/playful)
 * - Style (neutral/marked)
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import {
  type AvatarGender,
  type AvatarAgeRange,
  type AvatarRelationshipStatus,
  type AvatarEnergy,
  AVATAR_GENDER_OPTIONS,
  AVATAR_GENDER_LABELS,
  AVATAR_AGE_RANGE_OPTIONS,
  AVATAR_AGE_RANGE_LABELS,
  AVATAR_RELATIONSHIP_OPTIONS,
  AVATAR_RELATIONSHIP_LABELS,
  AVATAR_ENERGY_OPTIONS,
  AVATAR_ENERGY_LABELS,
} from '../constants/avatarSetup';
import { completeAvatarSetup, getCurrentAvatarProfile } from '../lib/avatarProfile';

interface AvatarSetupPageProps {
  onComplete: () => void;
  onBack?: () => void;
}

export function AvatarSetupPage({ onComplete, onBack }: AvatarSetupPageProps) {
  // Required fields
  const [gender, setGender] = useState<AvatarGender | null>(null);
  const [ageRange, setAgeRange] = useState<AvatarAgeRange | null>(null);
  
  // Optional toggles
  const [showRelationship, setShowRelationship] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState<AvatarRelationshipStatus | null>(null);
  const [showOns, setShowOns] = useState(false);
  const [openForOns, setOpenForOns] = useState<boolean | null>(null);
  const [energy, setEnergy] = useState<AvatarEnergy | null>(null);
  
  // Form state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await getCurrentAvatarProfile();
        if (profile.avatarGender) setGender(profile.avatarGender);
        if (profile.avatarAgeRange) setAgeRange(profile.avatarAgeRange);
        setShowRelationship(profile.showRelationship);
        if (profile.relationshipStatus) setRelationshipStatus(profile.relationshipStatus);
        setShowOns(profile.showOns);
        setOpenForOns(profile.openForOns);
        if (profile.energy) setEnergy(profile.energy);
      } catch (err) {
        console.error('[AvatarSetup] Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  // Check if form is valid (required fields filled)
  const isValid = gender !== null && ageRange !== null;

  // Handle save
  const handleSave = async () => {
    if (!isValid) return;
    
    setIsSaving(true);
    setError(null);

    try {
      const result = await completeAvatarSetup({
        avatarGender: gender,
        avatarAgeRange: ageRange,
        showRelationship,
        relationshipStatus: showRelationship ? relationshipStatus : null,
        showOns,
        openForOns: showOns ? openForOns : null,
        energy,
      });

      if (result.success) {
        onComplete();
      } else {
        setError(result.error || 'Kunne ikke lagre. Prøv igjen.');
      }
    } catch (err) {
      setError('Noe gikk galt. Prøv igjen.');
      console.error('[AvatarSetup] Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Sett opp avatar</h1>
            <p className="text-sm text-slate-400">For å delta i venue rooms</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-8">
        {/* Gender Selection (Required) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
            Kjønn <span className="text-violet-400">*</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {AVATAR_GENDER_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setGender(option)}
                className={`py-4 px-6 rounded-xl text-lg font-medium transition-all border-2 ${
                  gender === option
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                {option === 'male' ? '👨' : '👩'} {AVATAR_GENDER_LABELS[option]}
              </button>
            ))}
          </div>
        </section>

        {/* Age Range Selection (Required) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
            Alder <span className="text-violet-400">*</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {AVATAR_AGE_RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setAgeRange(option)}
                className={`py-3 px-5 rounded-xl font-medium transition-all border-2 ${
                  ageRange === option
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                {AVATAR_AGE_RANGE_LABELS[option]}
              </button>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-slate-700 pt-6">
          <p className="text-sm text-slate-500 mb-6">Valgfritt – hjelper andre finne deg</p>
        </div>

        {/* Relationship Toggle */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Vis sivilstatus?
            </h2>
            <button
              onClick={() => setShowRelationship(!showRelationship)}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                showRelationship ? 'bg-violet-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                  showRelationship ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {showRelationship && (
            <div className="grid grid-cols-2 gap-3">
              {AVATAR_RELATIONSHIP_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setRelationshipStatus(option)}
                  className={`py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                    relationshipStatus === option
                      ? 'border-pink-500 bg-pink-500/20 text-pink-300'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {option === 'single' ? '💫' : '❤️'} {AVATAR_RELATIONSHIP_LABELS[option]}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ONS Toggle */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Vis 👉👌?
            </h2>
            <button
              onClick={() => setShowOns(!showOns)}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                showOns ? 'bg-violet-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute w-5 h-5 bg-white rounded-full top-1 transition-transform ${
                  showOns ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          {showOns && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setOpenForOns(true)}
                className={`py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                  openForOns === true
                    ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                ✅ Åpen
              </button>
              <button
                onClick={() => setOpenForOns(false)}
                className={`py-3 px-4 rounded-xl font-medium transition-all border-2 ${
                  openForOns === false
                    ? 'border-slate-500 bg-slate-700 text-slate-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                ❌ Ikke nå
              </button>
            </div>
          )}
        </section>

        {/* Energy (Optional) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
            Energi / Modus
          </h2>
          <div className="flex flex-wrap gap-2">
            {AVATAR_ENERGY_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setEnergy(energy === option ? null : option)}
                className={`py-3 px-5 rounded-xl font-medium transition-all border-2 ${
                  energy === option
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}
              >
                {AVATAR_ENERGY_LABELS[option]}
              </button>
            ))}
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Spacer for fixed button */}
        <div className="h-24" />
      </main>

      {/* Fixed Save Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              isValid && !isSaving
                ? 'bg-violet-600 hover:bg-violet-500 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Lagrer...
              </>
            ) : (
              <>
                <Check size={20} />
                Lagre og fortsett
              </>
            )}
          </button>
          {!isValid && (
            <p className="text-center text-sm text-slate-500 mt-2">
              Velg kjønn og alder for å fortsette
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AvatarSetupPage;

