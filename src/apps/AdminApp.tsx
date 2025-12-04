import { useState, useEffect } from 'react';
import { Lock, RefreshCw, ArrowLeft, KeyRound } from 'lucide-react';
import { AdminDashboard } from '../pages/AdminDashboard';

// ============================================
// ADMIN APP - PIN-protected admin dashboard
// ============================================

const ADMIN_PIN = '9281';
const ADMIN_AUTH_KEY = 'vibecheck_admin_authed';

interface PinGateProps {
  onSuccess: () => void;
}

function AdminPinGate({ onSuccess }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      localStorage.setItem(ADMIN_AUTH_KEY, 'true');
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
                  setError(false);
                }}
                placeholder="••••"
                className={`w-full pl-12 pr-4 py-4 bg-slate-900/50 border rounded-xl text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? 'border-red-500 focus:ring-red-500/50'
                    : 'border-slate-600 focus:ring-violet-500/50 focus:border-violet-500'
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
              className="w-full mt-6 py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all"
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

export function AdminApp() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    const authed = localStorage.getItem(ADMIN_AUTH_KEY) === 'true';
    setIsAuthed(authed);
  }, []);

  // Handler for leaving admin
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  // Show loading while checking auth
  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center">
        <RefreshCw size={32} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  // Show PIN gate if not authed
  if (!isAuthed) {
    return <AdminPinGate onSuccess={() => setIsAuthed(true)} />;
  }

  // Show admin dashboard (without the internal PIN gate)
  return <AdminDashboardContent onBack={handleBack} />;
}

// We need a version of AdminDashboard without its own PIN gate
// For now, we'll use the existing one which has its own PIN gate
// This will be double-gated, but we can fix that later
function AdminDashboardContent({ onBack }: { onBack: () => void }) {
  // Import the actual dashboard content
  // For now, just render the full AdminDashboard which has its own PIN
  // We'll need to refactor AdminDashboard to export the content separately
  return <AdminDashboard onBack={onBack} />;
}

export default AdminApp;

