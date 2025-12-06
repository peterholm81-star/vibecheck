import { useState, useEffect } from 'react';
import { Lock, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import { InsightsDashboard } from '../pages/InsightsDashboard';

// ============================================
// INSIGHTS APP - PIN-protected venue insights
// PIN is validated server-side via /api/insights-stats
// 
// After PIN validation, renders the FULL InsightsDashboard
// with all graphs, sections, and analytics
// ============================================

const INSIGHTS_PIN_KEY = 'vibecheck_insights_pin';

// ============================================
// PIN GATE COMPONENT
// ============================================

interface PinGateProps {
  onSuccess: (pin: string) => void;
  isValidating: boolean;
  validationError: string | null;
}

function InsightsPinGate({ onSuccess, isValidating, validationError }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Trigger shake animation when validation error changes
  useEffect(() => {
    if (validationError) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
    }
  }, [validationError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4 && !isValidating) {
      onSuccess(pin);
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
            <h1 className="text-2xl font-bold text-white mb-2">Partner Insights</h1>
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
                }}
                placeholder="••••"
                disabled={isValidating}
                className={`w-full pl-12 pr-4 py-4 bg-slate-900/50 border rounded-xl text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                  validationError
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-600 focus:ring-emerald-500/50 focus:border-emerald-500'
                }`}
                autoFocus
              />
            </div>

            {validationError && (
              <p className="text-red-400 text-sm text-center mt-3">{validationError}</p>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || isValidating}
              className="w-full mt-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Verifiserer...
                </>
              ) : (
                'Lås opp innsikt'
              )}
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

// ============================================
// MAIN INSIGHTS APP COMPONENT
// ============================================

export function InsightsApp() {
  // null = loading, '' = not authenticated, string = authenticated with PIN
  const [insightsPin, setInsightsPin] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check localStorage for saved PIN on mount
  useEffect(() => {
    const savedPin = localStorage.getItem(INSIGHTS_PIN_KEY);
    if (savedPin) {
      // Try to validate the saved PIN
      validatePin(savedPin);
    } else {
      // No saved PIN, show gate
      setInsightsPin('');
    }
  }, []);

  // Validate PIN by making a request to /api/insights-stats
  const validatePin = async (pin: string) => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/insights-stats', {
        method: 'GET',
        headers: {
          'x-insights-pin': pin,
        },
      });

      if (response.status === 401) {
        // Wrong PIN
        setValidationError('Feil PIN. Prøv igjen.');
        localStorage.removeItem(INSIGHTS_PIN_KEY);
        setInsightsPin('');
      } else if (response.ok) {
        // PIN is valid - save it and unlock
        localStorage.setItem(INSIGHTS_PIN_KEY, pin);
        setInsightsPin(pin);
      } else {
        // Other error (500, etc.)
        const data = await response.json().catch(() => ({}));
        setValidationError(data.error || 'Serverfeil. Prøv igjen senere.');
        setInsightsPin('');
      }
    } catch (err) {
      console.error('[InsightsApp] Validation error:', err);
      setValidationError('Kunne ikke koble til serveren.');
      setInsightsPin('');
    } finally {
      setIsValidating(false);
    }
  };

  // Handler for PIN submission from gate
  const handlePinSubmit = (pin: string) => {
    validatePin(pin);
  };

  // Handler for leaving insights (used by InsightsDashboard's back button)
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  // Show loading while checking saved PIN
  if (insightsPin === null) {
    return (
      <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center">
        <RefreshCw size={32} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Show PIN gate if not authenticated
  if (!insightsPin) {
    return (
      <InsightsPinGate
        onSuccess={handlePinSubmit}
        isValidating={isValidating}
        validationError={validationError}
      />
    );
  }

  // ============================================
  // PIN verified - render the FULL InsightsDashboard
  // with all graphs, sections, and analytics
  // ============================================
  return <InsightsDashboard onBack={handleBack} />;
}

export default InsightsApp;
