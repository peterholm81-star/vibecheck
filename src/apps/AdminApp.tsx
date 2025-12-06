import { useState, useEffect } from 'react';
import { Lock, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import { AdminDashboard } from '../pages/AdminDashboard';

// ============================================
// ADMIN APP - PIN-protected admin dashboard
// PIN is validated server-side via /api/admin-stats
// ============================================

const ADMIN_PIN_KEY = 'vibecheck_admin_pin';

interface PinGateProps {
  onSuccess: (pin: string) => void;
  isValidating: boolean;
  validationError: string | null;
}

function AdminPinGate({ onSuccess, isValidating, validationError }: PinGateProps) {
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
            <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Admin</h1>
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
                    : 'border-slate-600 focus:ring-violet-500/50 focus:border-violet-500'
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
              className="w-full mt-6 py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isValidating ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Verifiserer...
                </>
              ) : (
                'Logg inn'
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

export function AdminApp() {
  // null = loading, '' = not authenticated, string = authenticated with PIN
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Check localStorage for saved PIN on mount
  useEffect(() => {
    const savedPin = localStorage.getItem(ADMIN_PIN_KEY);
    if (savedPin) {
      // Try to validate the saved PIN
      validatePin(savedPin);
    } else {
      // No saved PIN, show gate
      setAdminPin('');
    }
  }, []);

  // Validate PIN by making a request to /api/admin-stats
  const validatePin = async (pin: string) => {
    setIsValidating(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/admin-stats', {
        method: 'GET',
        headers: {
          'x-admin-pin': pin,
        },
      });

      if (response.status === 401) {
        // Wrong PIN
        setValidationError('Feil PIN. Prøv igjen.');
        localStorage.removeItem(ADMIN_PIN_KEY);
        setAdminPin('');
      } else if (response.ok) {
        // PIN is valid - save it and unlock
        localStorage.setItem(ADMIN_PIN_KEY, pin);
        setAdminPin(pin);
      } else {
        // Other error (500, etc.)
        const data = await response.json().catch(() => ({}));
        setValidationError(data.error || 'Serverfeil. Prøv igjen senere.');
        setAdminPin('');
      }
    } catch (err) {
      console.error('[AdminApp] Validation error:', err);
      setValidationError('Kunne ikke koble til serveren.');
      setAdminPin('');
    } finally {
      setIsValidating(false);
    }
  };

  // Handler for PIN submission from gate
  const handlePinSubmit = (pin: string) => {
    validatePin(pin);
  };

  // Handler for leaving admin
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  // Handler for logout (clear saved PIN)
  const handleLogout = () => {
    localStorage.removeItem(ADMIN_PIN_KEY);
    setAdminPin('');
    setValidationError(null);
  };

  // Show loading while checking saved PIN
  if (adminPin === null) {
    return (
      <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center">
        <RefreshCw size={32} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  // Show PIN gate if not authenticated
  if (!adminPin) {
    return (
      <AdminPinGate
        onSuccess={handlePinSubmit}
        isValidating={isValidating}
        validationError={validationError}
      />
    );
  }

  // Show admin dashboard with PIN for API calls
  return (
    <AdminDashboard
      onBack={handleBack}
      onLogout={handleLogout}
      adminPin={adminPin}
    />
  );
}

export default AdminApp;
