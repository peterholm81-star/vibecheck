import { useState } from 'react';
import { 
  ChevronRight, 
  Check, 
  Loader2, 
  PartyPopper, 
  Coffee, 
  Heart, 
  Users, 
  User, 
  Eye,
  Music,
  MessageCircle,
  Sparkles,
  Flame,
  UserPlus,
  MapPin,
  Shield,
  Navigation
} from 'lucide-react';
import { saveOnboarding2ToSupabase } from '../../lib/vibeUsers';

// ============================================
// ONBOARDING 2.0 WIZARD (4 steg)
// ============================================
// Steg 1: Velkommen + anonymitet
// Steg 2: Modus for kvelden (single select)
// Steg 3: Stemning / preferanser (multi select)
// Steg 4: Alder + GPS
// ============================================

interface OnboardingPageProps {
  onComplete: () => void;
}

// Modus-alternativer (single select)
type Mode = 'party' | 'chill' | 'date_night' | 'with_friends' | 'solo' | 'just_looking' | null;

const MODE_OPTIONS: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: 'party', label: 'Party', icon: <PartyPopper size={24} /> },
  { id: 'chill', label: 'Chill kveld', icon: <Coffee size={24} /> },
  { id: 'date_night', label: 'Date night', icon: <Heart size={24} /> },
  { id: 'with_friends', label: 'Med venner', icon: <Users size={24} /> },
  { id: 'solo', label: 'Solo', icon: <User size={24} /> },
  { id: 'just_looking', label: 'Bare ser rundt', icon: <Eye size={24} /> },
];

// Vibe-preferanser (multi select)
type VibePreference = 'danse' | 'rolig_prat' | 'live_musikk' | 'flørte' | 'møte_nye' | 'ons';

const VIBE_OPTIONS: { id: VibePreference; label: string; icon: React.ReactNode; emoji?: string }[] = [
  { id: 'danse', label: 'Danse', icon: <Music size={20} /> },
  { id: 'rolig_prat', label: 'Rolig prat', icon: <MessageCircle size={20} /> },
  { id: 'live_musikk', label: 'Live musikk', icon: <Sparkles size={20} /> },
  { id: 'flørte', label: 'Flørte', icon: <Heart size={20} /> },
  { id: 'møte_nye', label: 'Møte nye folk', icon: <UserPlus size={20} /> },
  { id: 'ons', label: 'ONS', icon: <Flame size={20} />, emoji: '👉👌' },
];

// Aldersgrupper
type AgeGroup = '18-22' | '23-27' | '28-34' | '35-44' | '45+' | null;

const AGE_OPTIONS: { id: AgeGroup; label: string }[] = [
  { id: '18-22', label: '18–22' },
  { id: '23-27', label: '23–27' },
  { id: '28-34', label: '28–34' },
  { id: '35-44', label: '35–44' },
  { id: '45+', label: '45+' },
];

const TOTAL_STEPS = 4;
const ONBOARDING_COMPLETE_KEY = 'vibecheck_onboarding_complete';

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [mode, setMode] = useState<Mode>(null);
  const [selectedVibes, setSelectedVibes] = useState<VibePreference[]>([]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationAsked, setLocationAsked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigasjon
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // Toggle vibe preference
  const toggleVibe = (vibe: VibePreference) => {
    setSelectedVibes((prev) => 
      prev.includes(vibe) 
        ? prev.filter((v) => v !== vibe)
        : [...prev, vibe]
    );
  };

  // Request geolocation
  const requestLocation = () => {
    setLocationAsked(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setLocationGranted(true);
        },
        (err) => {
          console.log('[Onboarding] Geolocation denied:', err.message);
          setLocationGranted(false);
        }
      );
    }
  };

  // Skip location
  const skipLocation = () => {
    setLocationAsked(true);
    setLocationGranted(false);
  };

  // Complete onboarding
  const handleComplete = async () => {
    setIsSaving(true);
    setError(null);

    // Alltid lagre til localStorage først (fungerer alltid)
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    localStorage.setItem('vibecheck_onboarding_data', JSON.stringify({
      mode,
      vibe_preferences: selectedVibes,
      age_group: ageGroup,
    }));

    try {
      // Prøv å lagre til Supabase
      const result = await saveOnboarding2ToSupabase({
        mode,
        vibe_preferences: selectedVibes,
        age_group: ageGroup,
        onboarding_complete: true,
      });

      if (!result.success) {
        // Supabase feilet, men localStorage er lagret
        console.error('[Onboarding] Supabase-lagring feilet:', result.error);
        console.warn('[Onboarding] Fortsetter likevel - data er lagret lokalt');
        // Ikke blokker brukeren - la dem fortsette med lokal lagring
      } else {
        console.log('[Onboarding] ✅ Alt lagret vellykket!');
      }

      setIsSaving(false);
      onComplete();
    } catch (err) {
      // Selv ved exception, la brukeren fortsette
      console.error('[Onboarding] Exception under lagring:', err);
      console.warn('[Onboarding] Fortsetter likevel - data er lagret lokalt');
      setIsSaving(false);
      onComplete();
    }
  };

  // Progress indicator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 === currentStep
              ? 'w-10 bg-gradient-to-r from-violet-500 to-purple-500'
              : i + 1 < currentStep
              ? 'w-6 bg-violet-500'
              : 'w-6 bg-slate-300/30'
          }`}
        />
      ))}
    </div>
  );

  // ============================================
  // STEG 1: Velkommen + anonymitet
  // ============================================
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
            <ProgressIndicator />
            
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-400/40">
                <MapPin size={40} className="text-white" />
              </div>
            </div>

            {/* Tittel */}
            <h1 className="text-3xl font-bold text-slate-800 text-center mb-4">
              Velkommen til VibeCheck 👋
            </h1>

            {/* Anonymitet-tekst */}
            <p className="text-slate-600 text-center leading-relaxed mb-8 text-[15px]">
              VibeCheck viser hvor det er liv, stemning og folk – uten å spore hvem du er.
              <br /><br />
              Vi lagrer ingen navn, ingen telefonnummer og ingen sosiale profiler.
              <br /><br />
              Data brukes kun anonymt for å vise trender og aktivitet, og basert på din og andres innlogging håper vi å kunne dytte deg i rett retning slik at du finner akkurat det du er ute etter når du drar på byen ;)
            </p>

            {/* Shield icon */}
            <div className="flex items-center justify-center gap-2 text-emerald-600 bg-emerald-50 rounded-xl px-4 py-3 mb-8">
              <Shield size={20} />
              <span className="text-sm font-medium">100% anonymt</span>
            </div>

            {/* CTA */}
            <button
              onClick={goNext}
              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-4 px-6 rounded-xl shadow-lg shadow-violet-400/30 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              Kom i gang
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 2: Modus for kvelden (single select)
  // ============================================
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
            <ProgressIndicator />

            <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
              Hva bruker du VibeCheck til i kveld?
            </h2>
            <p className="text-slate-500 text-center mb-8 text-sm">
              Velg én
            </p>

            {/* Mode cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setMode(option.id)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2 ${
                    mode === option.id
                      ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-200/50'
                      : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                  }`}
                >
                  <div className={`${mode === option.id ? 'text-violet-600' : 'text-slate-500'}`}>
                    {option.icon}
                  </div>
                  <span className={`text-sm font-medium ${mode === option.id ? 'text-violet-700' : 'text-slate-700'}`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={goBack}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl transition-all"
              >
                Tilbake
              </button>
              <button
                onClick={goNext}
                disabled={!mode}
                className={`flex-1 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  mode
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-400/30'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Neste
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 3: Stemning / preferanser (multi select)
  // ============================================
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
            <ProgressIndicator />

            <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
              Hva ser du etter i kveld?
            </h2>
            <p className="text-slate-500 text-center mb-8 text-sm">
              Velg én eller flere
            </p>

            {/* Vibe chips */}
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {VIBE_OPTIONS.map((option) => {
                const isSelected = selectedVibes.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleVibe(option.id)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-2 ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50 shadow-md shadow-violet-200/50'
                        : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                    }`}
                  >
                    <span className={isSelected ? 'text-violet-600' : 'text-slate-500'}>
                      {option.emoji ? (
                        <span className="text-lg">{option.emoji}</span>
                      ) : (
                        option.icon
                      )}
                    </span>
                    <span className={`text-sm font-medium ${isSelected ? 'text-violet-700' : 'text-slate-700'}`}>
                      {option.label}
                    </span>
                    {isSelected && (
                      <Check size={16} className="text-violet-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected count */}
            {selectedVibes.length > 0 && (
              <p className="text-center text-sm text-violet-600 mb-6">
                {selectedVibes.length} valgt
              </p>
            )}

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={goBack}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl transition-all"
              >
                Tilbake
              </button>
              <button
                onClick={goNext}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-violet-400/30 transition-all flex items-center justify-center gap-2"
              >
                Neste
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 4: Alder + GPS
  // ============================================
  if (currentStep === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50 to-purple-50 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-[22px] shadow-xl shadow-violet-200/50 p-8">
            <ProgressIndicator />

            {/* Age section */}
            <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">
              Hvilken aldersgruppe er du i?
            </h2>
            <p className="text-slate-500 text-center mb-6 text-sm">
              Valgfritt – hjelper oss vise relevante steder
            </p>

            {/* Age buttons */}
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {AGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setAgeGroup(ageGroup === option.id ? null : option.id)}
                  className={`px-5 py-2.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${
                    ageGroup === option.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md shadow-violet-200/50'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* GPS section */}
            <div className="bg-slate-50 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Navigation size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Vil du dele posisjon?</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Det gjør at VibeCheck automatisk finner riktig by og gir mer treffsikre kart.
                  </p>
                </div>
              </div>

              {!locationAsked ? (
                <div className="flex gap-3">
                  <button
                    onClick={requestLocation}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    <Navigation size={16} />
                    Aktiver posisjon
                  </button>
                  <button
                    onClick={skipLocation}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-all text-sm"
                  >
                    Hopp over
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${
                  locationGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {locationGranted ? (
                    <>
                      <Check size={18} />
                      <span className="text-sm font-medium">Posisjon aktivert</span>
                    </>
                  ) : (
                    <>
                      <MapPin size={18} />
                      <span className="text-sm font-medium">Manuell by-valg brukes</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3">
              <button
                onClick={goBack}
                disabled={isSaving}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3.5 px-4 rounded-xl transition-all disabled:opacity-50"
              >
                Tilbake
              </button>
              <button
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-violet-400/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Lagrer...
                  </>
                ) : (
                  <>
                    Fullfør og gå til kartet
                    <Check size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

