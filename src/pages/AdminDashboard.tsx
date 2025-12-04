/**
 * Admin Dashboard
 * 
 * PIN-protected admin panel showing user statistics.
 * Styled to match the existing Insights dark theme.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, UserPlus, Activity, Lock, RefreshCw, AlertCircle } from 'lucide-react';

// Admin PIN - can be overridden via environment variable
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '9281';
const SESSION_KEY = 'vibecheck_admin_authed';

interface UserStats {
  totalUsers: number;
  newLast24h: number;
  activeLast10min: number;
}

interface AdminStatsResponse {
  totalUsers?: number;
  newUsers24h?: number;
  activeLast10m?: number;
  error?: string;
  details?: string;
}

// ============================================
// PIN GATE COMPONENT
// ============================================

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setError(null);

    // Small delay to prevent brute force
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        onSuccess();
      } else {
        setError('Feil kode. Prøv igjen.');
        setPin('');
      }
      setIsChecking(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-violet-500/20 rounded-2xl flex items-center justify-center">
              <Lock size={32} className="text-violet-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Admin login
          </h1>
          <p className="text-slate-500 text-center mb-8">
            Skriv inn admin-koden for å fortsette
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Skriv admin-kode
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 placeholder:text-slate-600"
              autoFocus
            />

            {/* Error message */}
            {error && (
              <p className="mt-3 text-sm text-red-400 text-center flex items-center justify-center gap-2">
                <AlertCircle size={14} />
                {error}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={pin.length < 4 || isChecking}
              className={`w-full mt-6 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                pin.length >= 4 && !isChecking
                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isChecking ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Sjekker...
                </>
              ) : (
                'Logg inn'
              )}
            </button>
          </form>
        </div>
      </div>
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
  isLoading,
}: {
  title: string;
  value: number | null;
  icon: React.ReactNode;
  color: 'violet' | 'emerald' | 'sky';
  subtitle?: string;
  isLoading: boolean;
}) {
  const colorClasses = {
    violet: 'text-violet-400 bg-violet-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/20',
  };

  const valueColorClasses = {
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    sky: 'text-sky-400',
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
      
      {isLoading ? (
        <div className="h-10 flex items-center">
          <div className="w-16 h-8 bg-slate-800 rounded animate-pulse" />
        </div>
      ) : (
        <p className={`text-4xl font-bold ${valueColorClasses[color]}`}>
          {value !== null ? value.toLocaleString('no-NO') : '0'}
        </p>
      )}
      
      {subtitle && (
        <p className="text-xs text-slate-600 mt-2">{subtitle}</p>
      )}
    </div>
  );
}

// ============================================
// ADMIN DASHBOARD CONTENT
// ============================================

function DashboardContent({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    console.log('[AdminDashboard] Fetching stats from /api/admin-stats...');

    try {
      // Fetch stats from Edge Function API
      const response = await fetch('/api/admin-stats');
      const data: AdminStatsResponse = await response.json();

      console.log('[AdminDashboard] API response:', data);

      // Check for API errors
      if (data.error) {
        throw new Error(data.details || data.error);
      }

      // Set stats from API response
      const newStats: UserStats = {
        totalUsers: data.totalUsers ?? 0,
        newLast24h: data.newUsers24h ?? 0,
        activeLast10min: data.activeLast10m ?? 0,
      };

      console.log('[AdminDashboard] Stats:', newStats);
      setStats(newStats);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminDashboard] Error:', msg);
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    console.log('[AdminDashboard] Mounted, fetching stats...');
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats();
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
                onClick={onBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline text-sm font-medium">Tilbake</span>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
                  Brukerstatistikk
                </p>
              </div>
            </div>

            {/* Right side */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-[#1a1b2b] border border-neutral-800 text-slate-400 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-50"
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sidebar + Content Layout */}
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-24 bg-[#11121b] border border-neutral-800/50 rounded-2xl p-5">
              <div className="mb-5 pb-4 border-b border-neutral-800/50">
                <h2 className="text-base font-semibold text-white">Innsikt</h2>
                <p className="text-xs text-slate-500 mt-1">Velg fokusområde</p>
              </div>
              <nav>
                <button className="w-full text-left px-3 py-3 rounded-xl bg-violet-500/15 border-l-2 border-violet-400">
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-violet-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Brukere</p>
                      <p className="text-xs text-slate-400">Brukerstatistikk</p>
                    </div>
                  </div>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Section Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Brukerinnsikt</h2>
              <p className="text-sm text-slate-500 mt-1">
                Nøkkeltall for VibeCheck-brukere
              </p>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-xl flex items-center gap-3">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <StatsCard
                title="Totalt antall brukere"
                value={stats?.totalUsers ?? null}
                icon={<Users size={24} />}
                color="violet"
                subtitle="Alle registrerte"
                isLoading={isLoading}
              />
              <StatsCard
                title="Nye siste 24 timer"
                value={stats?.newLast24h ?? null}
                icon={<UserPlus size={24} />}
                color="emerald"
                subtitle="Siden i går"
                isLoading={isLoading}
              />
              <StatsCard
                title="Aktive siste 10 min"
                value={stats?.activeLast10min ?? null}
                icon={<Activity size={24} />}
                color="sky"
                subtitle="Online nå"
                isLoading={isLoading}
              />
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-neutral-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-slate-500">
                    Oppdateres hvert 30. sekund
                  </span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-700 mt-6">
                VibeCheck Admin · Kun for autorisert personell
              </p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN ADMIN DASHBOARD COMPONENT
// ============================================

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  // Check session storage on mount
  useEffect(() => {
    const authed = sessionStorage.getItem(SESSION_KEY) === 'true';
    setIsAuthed(authed);
  }, []);

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
    return <PinGate onSuccess={() => setIsAuthed(true)} />;
  }

  // Show dashboard content
  return <DashboardContent onBack={onBack} />;
}

export default AdminDashboard;

