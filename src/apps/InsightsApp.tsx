import { useState, useEffect } from 'react';
import { Lock, RefreshCw, ArrowLeft, KeyRound, Users, Activity, MapPin, TrendingUp, Building, Clock } from 'lucide-react';

// ============================================
// INSIGHTS APP - PIN-protected venue insights
// PIN is validated server-side via /api/insights-stats
// ============================================

const INSIGHTS_PIN_KEY = 'vibecheck_insights_pin';

// ============================================
// TYPES
// ============================================

interface InsightsStats {
  totalUsers: number;
  activeLast10m: number;
  checkInsLast24h: number;
  checkInsLastHour: number;
  totalVenues: number;
  venuesWithCheckInsLast24h: number;
}

interface PinGateProps {
  onSuccess: (pin: string) => void;
  isValidating: boolean;
  validationError: string | null;
}

// ============================================
// PIN GATE COMPONENT
// ============================================

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
// STATS CARD COMPONENT
// ============================================

function StatsCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'emerald' | 'sky' | 'violet' | 'orange';
  subtitle?: string;
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/20',
    violet: 'text-violet-400 bg-violet-500/20',
    orange: 'text-orange-400 bg-orange-500/20',
  };

  const valueColorClasses = {
    emerald: 'text-emerald-400',
    sky: 'text-sky-400',
    violet: 'text-violet-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
        {title}
      </p>
      
      <p className={`text-4xl font-bold ${valueColorClasses[color]}`}>
        {value.toLocaleString('no-NO')}
      </p>
      
      {subtitle && (
        <p className="text-xs text-slate-600 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================
// INSIGHTS DASHBOARD COMPONENT
// ============================================

interface InsightsDashboardProps {
  stats: InsightsStats;
  onRefresh: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
}

function InsightsDashboard({ stats, onRefresh, onLogout, isRefreshing }: InsightsDashboardProps) {
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f17]/95 backdrop-blur-md border-b border-neutral-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline text-sm font-medium">Tilbake</span>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
                  Partner Insights
                </h1>
                <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
                  Sanntidsdata for utesteder
                </p>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-[#1a1b2b] border border-neutral-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-neutral-800 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all text-sm"
              >
                Logg ut
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">Oversikt</h2>
          <p className="text-sm text-slate-500 mt-1">
            Nøkkeltall for VibeCheck-plattformen
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatsCard
            title="Totalt antall brukere"
            value={stats.totalUsers}
            icon={<Users size={24} />}
            color="emerald"
            subtitle="Alle registrerte"
          />
          <StatsCard
            title="Aktive nå"
            value={stats.activeLast10m}
            icon={<Activity size={24} />}
            color="sky"
            subtitle="Siste 10 minutter"
          />
          <StatsCard
            title="Check-ins siste time"
            value={stats.checkInsLastHour}
            icon={<Clock size={24} />}
            color="violet"
            subtitle="Sanntid"
          />
          <StatsCard
            title="Check-ins siste 24 timer"
            value={stats.checkInsLast24h}
            icon={<TrendingUp size={24} />}
            color="orange"
            subtitle="Total aktivitet"
          />
          <StatsCard
            title="Totalt antall venues"
            value={stats.totalVenues}
            icon={<Building size={24} />}
            color="emerald"
            subtitle="Registrerte steder"
          />
          <StatsCard
            title="Aktive venues"
            value={stats.venuesWithCheckInsLast24h}
            icon={<MapPin size={24} />}
            color="sky"
            subtitle="Med check-ins siste 24t"
          />
        </div>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-neutral-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-slate-500">
                Klikk på oppdater-knappen for ferske tall
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-slate-700 mt-6">
            VibeCheck Partner Insights · Kun for autoriserte partnere
          </p>
        </footer>
      </div>
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
  const [stats, setStats] = useState<InsightsStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        const data = await response.json();
        localStorage.setItem(INSIGHTS_PIN_KEY, pin);
        setInsightsPin(pin);
        setStats(data);
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

  // Refresh stats
  const refreshStats = async () => {
    if (!insightsPin) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/insights-stats', {
        method: 'GET',
        headers: {
          'x-insights-pin': insightsPin,
        },
      });

      if (response.status === 401) {
        // PIN no longer valid
        localStorage.removeItem(INSIGHTS_PIN_KEY);
        setInsightsPin('');
        setStats(null);
        setValidationError('Sesjonen er utløpt. Logg inn på nytt.');
      } else if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('[InsightsApp] Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handler for PIN submission from gate
  const handlePinSubmit = (pin: string) => {
    validatePin(pin);
  };

  // Handler for logout (clear saved PIN)
  const handleLogout = () => {
    localStorage.removeItem(INSIGHTS_PIN_KEY);
    setInsightsPin('');
    setStats(null);
    setValidationError(null);
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

  // Show loading while fetching initial stats
  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center">
        <RefreshCw size={32} className="text-emerald-400 animate-spin" />
      </div>
    );
  }

  // Show insights dashboard with stats
  return (
    <InsightsDashboard
      stats={stats}
      onRefresh={refreshStats}
      onLogout={handleLogout}
      isRefreshing={isRefreshing}
    />
  );
}

export default InsightsApp;
