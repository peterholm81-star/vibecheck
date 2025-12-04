import { useState, useEffect } from 'react';
import { Lock, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import { InsightsDashboard } from '../pages/InsightsDashboard';

// ============================================
// INSIGHTS APP - PIN-protected venue insights
// ============================================

const INSIGHTS_PIN = '9281';
const INSIGHTS_AUTH_KEY = 'vibecheck_insights_authed';

interface PinGateProps {
  onSuccess: () => void;
}

function InsightsPinGate({ onSuccess }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === INSIGHTS_PIN) {
      localStorage.setItem(INSIGHTS_AUTH_KEY, 'true');
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  };

  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={handleBack}
          className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span>Tilbake til appen</span>
        </button>

        {/* PIN form */}
        <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700/50">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Insights</h1>
            <p className="text-slate-400 text-sm">Skriv inn PIN for å fortsette</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={`relative ${shake ? 'animate-shake' : ''}`}>
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError(false);
                }}
                placeholder="••••"
                className={`w-full pl-12 pr-4 py-4 bg-slate-900/50 border rounded-xl text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-600 focus:ring-emerald-500/50 focus:border-emerald-500'
                }`}
                autoFocus
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center mt-3">Feil PIN. Prøv igjen.</p>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4}
              className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all"
            >
              Logg inn
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export function InsightsApp() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    const authed = localStorage.getItem(INSIGHTS_AUTH_KEY) === 'true';
    setIsAuthed(authed);
  }, []);

  // Handler for leaving insights
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  // Show loading while checking auth
  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center">
        <RefreshCw size={32} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Show PIN gate if not authed
  if (!isAuthed) {
    return <InsightsPinGate onSuccess={() => setIsAuthed(true)} />;
  }

  // Show insights dashboard
  return <InsightsDashboard onBack={handleBack} />;
}

export default InsightsApp;

