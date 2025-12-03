import { useState } from 'react';
import { MapPin, Sparkles, Shield, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react';
import { saveOnboardingToSupabase } from '../lib/vibeUsers';

// ============================================
// ONBOARDING WIZARD (6 steg)
// ============================================
// Steg 1: Velkomst
// Steg 2: Modus (hva er du ute etter)
// Steg 3: Stemning/energi (1-4)
// Steg 4: Aldersgruppe
// Steg 5: Favorittby
// Steg 6: Anonymitet + fullfør
// ============================================

interface OnboardingProps {
  onComplete: () => void;
}

// Typer for wizard-state
type Mode = 'danse' | 'rolig_prat' | 'live_musikk' | 'florte' | 'mote_nye' | 'ons' | 'chill' | 'venner' | null;
type Mood = 1 | 2 | 3 | 4 | null;
type AgeRange = '18_24' | '25_34' | '35_44' | '45_plus' | null;

// Modus-alternativer
const MODE_OPTIONS: { id: Mode; label: string; emoji: string }[] = [
  { id: 'danse', label: 'Danse', emoji: '💃' },
  { id: 'rolig_prat', label: 'Rolig prat', emoji: '☕' },
  { id: 'live_musikk', label: 'Live musikk', emoji: '🎸' },
  { id: 'florte', label: 'Flørte', emoji: '😏' },
  { id: 'mote_nye', label: 'Møte nye', emoji: '👋' },
  { id: 'ons', label: 'One night stand', emoji: '🔥' },
  { id: 'chill', label: 'Chill', emoji: '😌' },
  { id: 'venner', label: 'Ute med venner', emoji: '👯' },
];

// Stemning-alternativer
const MOOD_OPTIONS: { value: Mood; label: string; emoji: string }[] = [
  { value: 1, label: 'Lav energi', emoji: '😴' },
  { value: 2, label: 'Chill', emoji: '🙂' },
  { value: 3, label: 'Sosial', emoji: '😄' },
  { value: 4, label: 'Full guffe', emoji: '🔥' },
];

// Alder-alternativer
const AGE_OPTIONS: { id: AgeRange; label: string }[] = [
  { id: '18_24', label: '18–24' },
  { id: '25_34', label: '25–34' },
  { id: '35_44', label: '35–44' },
  { id: '45_plus', label: '45+' },
];

// By-alternativer (foreløpig kun Trondheim)
const CITY_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'trondheim', label: 'Trondheim', emoji: '🏔️' },
];

const TOTAL_STEPS = 6;
const PREFERENCES_KEY = 'vibecheck_preferences';

export function Onboarding({ onComplete }: OnboardingProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [mode, setMode] = useState<Mode>(null);
  const [mood, setMood] = useState<Mood>(null);
  const [ageRange, setAgeRange] = useState<AgeRange>(null);
  const [favoriteCityId, setFavoriteCityId] = useState<string>('trondheim');
  const [isSaving, setIsSaving] = useState(false);

  // Navigasjon
  const goNext = () => setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // Fullfør onboarding
  const handleComplete = async () => {
    setIsSaving(true);
    
    // Lagre preferanser i localStorage
    const preferences = {
      mode,
      mood,
      ageRange,
      favoriteCityId,
    };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    
    // Lagre til Supabase (fire-and-forget, men vent på resultat)
    const result = await saveOnboardingToSupabase(preferences);
    
    if (!result.success) {
      // Log error but don't block the user
      console.error('Failed to save onboarding to Supabase:', result.error);
    }
    
    setIsSaving(false);
    
    // Kall onComplete for å gå videre til appen
    onComplete();
  };

  // Progresjonsindikator
  const ProgressIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-all ${
            i + 1 === currentStep
              ? 'w-8 bg-violet-500'
              : i + 1 < currentStep
              ? 'bg-violet-500'
              : 'bg-slate-600'
          }`}
        />
      ))}
    </div>
  );

  // Navigasjonsknapper
  const NavigationButtons = ({
    canGoNext,
    nextLabel = 'Neste',
    onNext,
    isLoading = false,
  }: {
    canGoNext: boolean;
    nextLabel?: string;
    onNext?: () => void;
    isLoading?: boolean;
  }) => (
    <div className="flex gap-3 mt-8">
      {currentStep > 1 && (
        <button
          onClick={goBack}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3.5 px-6 rounded-xl transition-all disabled:opacity-50"
        >
          <ChevronLeft size={18} />
          Tilbake
        </button>
      )}
      <button
        onClick={onNext || goNext}
        disabled={!canGoNext || isLoading}
        className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 px-6 rounded-xl transition-all ${
          canGoNext && !isLoading
            ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/30'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Lagrer...
          </>
        ) : (
          <>
            {nextLabel}
            {nextLabel === 'Neste' && <ChevronRight size={18} />}
            {nextLabel === 'Fullfør og start' && <Check size={18} />}
          </>
        )}
      </button>
    </div>
  );

  // ============================================
  // STEG 1: Velkomst
  // ============================================
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-6 py-12">
        <ProgressIndicator />

        {/* Logo */}
        <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-violet-500/30">
          <MapPin size={40} className="text-white" />
        </div>

        {/* Tittel */}
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          VibeCheck
        </h1>

        {/* Tagline */}
        <p className="text-lg text-slate-300 text-center max-w-sm mb-12 leading-relaxed">
          Finn riktig stemning i byen – anonymt, enkelt og i sanntid.
        </p>

        {/* Feature highlights */}
        <div className="w-full max-w-sm space-y-4 mb-8">
          <div className="flex items-center gap-4 bg-slate-800/50 rounded-xl px-4 py-3">
            <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Sanntidskart</p>
              <p className="text-xs text-slate-400">Se hvor det skjer akkurat nå</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 rounded-xl px-4 py-3">
            <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-pink-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Vibe-filtre</p>
              <p className="text-xs text-slate-400">Finn steder som matcher din stemning</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 rounded-xl px-4 py-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">100% anonymt</p>
              <p className="text-xs text-slate-400">Din lokasjon deles aldri</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={goNext}
          className="w-full max-w-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-violet-500/30 transition-all active:scale-[0.98]"
        >
          Kom i gang
        </button>
      </div>
    );
  }

  // ============================================
  // STEG 2: Modus
  // ============================================
  if (currentStep === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col px-6 py-12">
        <ProgressIndicator />

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Spørsmål */}
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Hva er du ute etter i kveld?
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Velg det som passer best
          </p>

          {/* Alternativer som chips */}
          <div className="flex flex-wrap gap-3 justify-center mb-auto">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setMode(option.id)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  mode === option.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="text-lg">{option.emoji}</span>
                {option.label}
              </button>
            ))}
          </div>

          <NavigationButtons canGoNext={mode !== null} />
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 3: Stemning
  // ============================================
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col px-6 py-12">
        <ProgressIndicator />

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Spørsmål */}
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Hvor mye energi har du i kveld?
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Vi matcher deg med riktig stemning
          </p>

          {/* Alternativer som cards */}
          <div className="space-y-3 mb-auto">
            {MOOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setMood(option.value)}
                className={`w-full px-5 py-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                  mood === option.value
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="text-3xl">{option.emoji}</span>
                <div>
                  <p className="font-semibold">{option.label}</p>
                  <p className={`text-sm ${mood === option.value ? 'text-violet-200' : 'text-slate-500'}`}>
                    Energinivå {option.value} av 4
                  </p>
                </div>
              </button>
            ))}
          </div>

          <NavigationButtons canGoNext={mood !== null} />
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 4: Alder
  // ============================================
  if (currentStep === 4) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col px-6 py-12">
        <ProgressIndicator />

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Spørsmål */}
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Hvilket aldersspenn er du i?
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Hjelper oss vise relevante steder
          </p>

          {/* Alternativer */}
          <div className="grid grid-cols-2 gap-3 mb-auto">
            {AGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setAgeRange(option.id)}
                className={`px-5 py-4 rounded-xl text-center transition-all ${
                  ageRange === option.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <p className="text-lg font-semibold">{option.label}</p>
              </button>
            ))}
          </div>

          <NavigationButtons canGoNext={ageRange !== null} />
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 5: Favorittby
  // ============================================
  if (currentStep === 5) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col px-6 py-12">
        <ProgressIndicator />

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Spørsmål */}
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Hvor pleier du å gå ut?
          </h2>
          <p className="text-slate-400 text-center mb-8">
            Flere byer kommer snart!
          </p>

          {/* By-alternativer */}
          <div className="space-y-3 mb-auto">
            {CITY_OPTIONS.map((city) => (
              <button
                key={city.id}
                onClick={() => setFavoriteCityId(city.id)}
                className={`w-full px-5 py-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                  favoriteCityId === city.id
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="text-3xl">{city.emoji}</span>
                <div>
                  <p className="font-semibold">{city.label}</p>
                  <p className={`text-sm ${favoriteCityId === city.id ? 'text-violet-200' : 'text-slate-500'}`}>
                    Norges beste uteliv
                  </p>
                </div>
              </button>
            ))}
          </div>

          <NavigationButtons canGoNext={favoriteCityId !== null} />
        </div>
      </div>
    );
  }

  // ============================================
  // STEG 6: Anonymitet & fullfør
  // ============================================
  if (currentStep === 6) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col px-6 py-12">
        <ProgressIndicator />

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
          {/* Overskrift */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <Shield size={32} className="text-emerald-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Anonymt & trygt
          </h2>

          <p className="text-slate-400 text-center mb-8 leading-relaxed">
            Vi viser kun aggregert stemning per sted – ingen navn, ingen chat, ingen profiler. Du bidrar anonymt og ser kun tall.
          </p>

          {/* Info-bokser */}
          <div className="space-y-3 mb-auto">
            <div className="bg-slate-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-emerald-400" />
              </div>
              <p className="text-sm text-slate-300">
                Ingen personlige data deles med andre brukere
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-emerald-400" />
              </div>
              <p className="text-sm text-slate-300">
                Din nøyaktige posisjon lagres aldri
              </p>
            </div>

            <div className="bg-slate-800/50 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check size={14} className="text-emerald-400" />
              </div>
              <p className="text-sm text-slate-300">
                Du velger selv hva du deler ved check-in
              </p>
            </div>
          </div>

          {/* Oppsummering */}
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-violet-300 font-medium mb-2">Dine valg:</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                {MODE_OPTIONS.find((m) => m.id === mode)?.emoji} {MODE_OPTIONS.find((m) => m.id === mode)?.label}
              </span>
              <span className="px-2 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                {MOOD_OPTIONS.find((m) => m.value === mood)?.emoji} {MOOD_OPTIONS.find((m) => m.value === mood)?.label}
              </span>
              <span className="px-2 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                {AGE_OPTIONS.find((a) => a.id === ageRange)?.label}
              </span>
              <span className="px-2 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
                📍 {CITY_OPTIONS.find((c) => c.id === favoriteCityId)?.label}
              </span>
            </div>
          </div>

          <NavigationButtons
            canGoNext={true}
            nextLabel="Fullfør og start"
            onNext={handleComplete}
            isLoading={isSaving}
          />
        </div>
      </div>
    );
  }

  // Fallback (should never happen)
  return null;
}
