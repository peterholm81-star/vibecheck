/**
 * Admin Dashboard
 * 
 * Admin panel showing user statistics and venues management.
 * PIN authentication is handled by AdminApp.
 * Styled to match the existing Insights dark theme.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Users, UserPlus, Activity, RefreshCw, AlertCircle, MapPin, Download } from 'lucide-react';
import { getCities, City } from '../api/cities';
import { refreshVenuesForCity } from '../api/venues';

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
// VENUES REFRESH SECTION
// ============================================

function VenuesRefreshSection() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [includeCafeRestaurant, setIncludeCafeRestaurant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await getCities();
        setCities(list);
        if (list.length > 0) {
          setSelectedCityId(list[0].id);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage("Kunne ikke hente byliste.");
      } finally {
        setLoadingCities(false);
      }
    })();
  }, []);

  const handleRefresh = async () => {
    if (!selectedCityId) return;

    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      const data = await refreshVenuesForCity({
        cityId: selectedCityId,
        radiusKm,
        includeCafeRestaurant,
      });

      const inserted = data?.inserted ?? 0;
      const cityName = data?.city?.name ?? "byen";

      setResultMessage(
        `Oppdaterte venues for ${cityName}. Antall innsatte venues: ${inserted}.`
      );
    } catch (error: unknown) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Noe gikk galt under refresh.";
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MapPin size={20} className="text-emerald-400" />
          Venues fra OpenStreetMap
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Hent og oppdater venues fra OpenStreetMap/Overpass API
        </p>
      </div>

      <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 space-y-5">
        {loadingCities ? (
          <div className="flex items-center gap-2 text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Laster byer...</span>
          </div>
        ) : (
          <>
            {/* City select */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-400 font-medium">By</label>
              <select
                className="bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                value={selectedCityId ?? ""}
                onChange={(e) => setSelectedCityId(Number(e.target.value))}
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} ({city.country_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Radius */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-400 font-medium">
                Radius (km) rundt byens sentrum
              </label>
              <input
                type="number"
                min={1}
                max={30}
                className="bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors w-32"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
              />
            </div>

            {/* Cafe/restaurant toggle */}
            <label className="inline-flex items-center gap-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded bg-[#1a1b2b] border-neutral-700 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                checked={includeCafeRestaurant}
                onChange={(e) => setIncludeCafeRestaurant(e.target.checked)}
              />
              Inkluder cafe/restaurant i tillegg til bar/pub/nightclub
            </label>

            {/* Button */}
            <button
              onClick={handleRefresh}
              disabled={loading || !selectedCityId}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Oppdaterer venues...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Refresh venues fra OpenStreetMap
                </>
              )}
            </button>

            {/* Messages */}
            {resultMessage && (
              <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl">
                <p className="text-sm text-emerald-400">{resultMessage}</p>
              </div>
            )}
            {errorMessage && (
              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-xl flex items-center gap-3">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}
          </>
        )}
      </div>
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

            {/* Venues Refresh Section */}
            <VenuesRefreshSection />

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
// PIN authentication is now handled by AdminApp
// ============================================

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  // Render dashboard content directly - PIN is handled by AdminApp
  return <DashboardContent onBack={onBack} />;
}

export default AdminDashboard;

