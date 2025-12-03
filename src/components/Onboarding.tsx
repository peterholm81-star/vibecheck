import { MapPin, Sparkles, Shield } from 'lucide-react';

// ============================================
// ONBOARDING COMPONENT
// ============================================
// Vises første gang brukeren åpner appen.
// Når brukeren trykker "Start VibeCheck", kalles onComplete.
// App.tsx lagrer da "vibecheck_onboarded" i localStorage.
// ============================================

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 flex flex-col items-center justify-center px-6 py-12">
      {/* Logo / Icon */}
      <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl shadow-violet-500/30">
        <MapPin size={40} className="text-white" />
      </div>

      {/* Title */}
      <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
        VibeCheck
      </h1>

      {/* Tagline */}
      <p className="text-lg text-slate-300 text-center max-w-sm mb-12 leading-relaxed">
        Finn riktig stemning i byen – anonymt, enkelt og i sanntid.
      </p>

      {/* Feature highlights */}
      <div className="w-full max-w-sm space-y-4 mb-12">
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

      {/* CTA Button */}
      <button
        onClick={onComplete}
        className="w-full max-w-sm bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-violet-500/30 transition-all active:scale-[0.98]"
      >
        Start VibeCheck
      </button>

      {/* Footer text */}
      <p className="text-xs text-slate-500 mt-8 text-center">
        Ved å fortsette godtar du våre vilkår
      </p>
    </div>
  );
}

