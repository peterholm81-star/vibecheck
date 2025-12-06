/**
 * Admin Dashboard
 * 
 * Admin panel showing user statistics and venues management.
 * PIN authentication is handled by AdminApp, which passes the PIN
 * for use in authenticated API calls.
 * Styled to match the existing Insights dark theme.
 */

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, UserPlus, Activity, RefreshCw, AlertCircle, MapPin, Download, LogOut } from 'lucide-react';
import { getCitiesWithRadius, CityWithRadius } from '../api/cities';
import { refreshVenuesForCity } from '../api/venues';
import { getCityRadius } from '../config/cityRadius';

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

interface VenuesRefreshSectionProps {
  adminPin: string;
}

interface BatchResult {
  cityId: number;
  cityName: string;
  status: 'success' | 'error';
  inserted?: number;
  radiusKm?: number;
  error?: string;
}

interface BatchResponse {
  success: boolean;
  totalCities: number;
  successCount: number;
  failedCount: number;
  totalVenuesInserted: number;
  results: BatchResult[];
}

function VenuesRefreshSection({ adminPin }: VenuesRefreshSectionProps) {
  const [cities, setCities] = useState<CityWithRadius[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [includeCafeRestaurant, setIncludeCafeRestaurant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Batch refresh state
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null);

  // Get selected city for showing suggested radius
  const selectedCity = cities.find(c => c.id === selectedCityId);

  // Check if any operation is running
  const isAnyLoading = loading || batchLoading;

  useEffect(() => {
    (async () => {
      try {
        console.log('[VenuesRefreshSection] Fetching cities...');
        const list = await getCitiesWithRadius();
        console.log('[VenuesRefreshSection] Received cities:', list.length, list);
        setCities(list);
        if (list.length > 0) {
          setSelectedCityId(list[0].id);
          // Set initial radius to the first city's suggested radius
          setRadiusKm(list[0].suggested_radius_km);
        } else {
          console.warn('[VenuesRefreshSection] No cities returned from getCitiesWithRadius');
          setErrorMessage("Ingen byer funnet. Sjekk at cities-tabellen er seeded og har RLS-policy.");
        }
      } catch (error) {
        console.error('[VenuesRefreshSection] Error fetching cities:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        setErrorMessage(`Kunne ikke hente byliste: ${errorMsg}`);
      } finally {
        setLoadingCities(false);
      }
    })();
  }, []);

  // Update radius when city changes
  const handleCityChange = (newCityId: number) => {
    setSelectedCityId(newCityId);
    const city = cities.find(c => c.id === newCityId);
    if (city) {
      setRadiusKm(city.suggested_radius_km);
    }
  };

  // Single city refresh
  const handleRefresh = async () => {
    if (!selectedCityId) return;

    setLoading(true);
    setResultMessage(null);
    setErrorMessage(null);
    setBatchResult(null);

    try {
      const data = await refreshVenuesForCity({
        cityId: selectedCityId,
        radiusKm,
        includeCafeRestaurant,
      });

      const inserted = data?.inserted ?? 0;
      const cityName = data?.city?.name ?? "byen";

      setResultMessage(
        `✓ Oppdaterte venues for ${cityName} (radius ${radiusKm} km). Antall innsatte venues: ${inserted}.`
      );
    } catch (error: unknown) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : "Noe gikk galt under refresh.";
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Batch refresh all cities
  const handleBatchRefresh = async () => {
    setBatchLoading(true);
    setBatchProgress(`Starter batch-oppdatering for ${cities.length} byer...`);
    setResultMessage(null);
    setErrorMessage(null);
    setBatchResult(null);

    try {
      console.log('[VenuesRefreshSection] Starting batch refresh...');
      
      const response = await fetch('/api/admin-refresh-all-cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': adminPin,
        },
        body: JSON.stringify({
          includeCafeRestaurant,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: BatchResponse = await response.json();
      console.log('[VenuesRefreshSection] Batch complete:', data);
      
      setBatchResult(data);
      setBatchProgress(null);

      if (data.failedCount === 0) {
        setResultMessage(
          `✓ Batch fullført! Oppdaterte venues for alle ${data.successCount} byer. Totalt ${data.totalVenuesInserted} venues.`
        );
      } else {
        setResultMessage(
          `⚠️ Batch fullført med noen feil. ${data.successCount} byer OK, ${data.failedCount} feilet. Totalt ${data.totalVenuesInserted} venues. Se console for detaljer.`
        );
      }
    } catch (error: unknown) {
      console.error('[VenuesRefreshSection] Batch error:', error);
      const errorMsg = error instanceof Error ? error.message : "Noe gikk galt under batch-refresh.";
      setErrorMessage(errorMsg);
      setBatchProgress(null);
    } finally {
      setBatchLoading(false);
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
                onChange={(e) => handleCityChange(Number(e.target.value))}
              >
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name} ({city.country_code}) – anbefalt {city.suggested_radius_km} km
                  </option>
                ))}
              </select>
              {selectedCity && (
                <p className="text-xs text-slate-500">
                  Sentrum: {selectedCity.center_lat.toFixed(4)}, {selectedCity.center_lon.toFixed(4)}
                </p>
              )}
            </div>

            {/* Radius */}
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-400 font-medium">
                Radius (km) rundt byens sentrum
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors w-32"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                />
                {selectedCity && radiusKm !== selectedCity.suggested_radius_km && (
                  <button
                    type="button"
                    onClick={() => setRadiusKm(selectedCity.suggested_radius_km)}
                    className="text-xs text-violet-400 hover:text-violet-300 underline"
                  >
                    Bruk anbefalt ({selectedCity.suggested_radius_km} km)
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Maks 50 km. Større radius = flere venues, men tregere Overpass-spørring.
              </p>
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

            {/* Buttons row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Single city refresh button */}
              <button
                onClick={handleRefresh}
                disabled={isAnyLoading || !selectedCityId}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Oppdaterer...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Refresh én by
                  </>
                )}
              </button>

              {/* Batch refresh button */}
              <button
                onClick={handleBatchRefresh}
                disabled={isAnyLoading || cities.length === 0}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
              >
                {batchLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Batch kjører...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Oppdater alle byer ({cities.length})
                  </>
                )}
              </button>
            </div>

            {/* Batch info text */}
            <p className="text-xs text-slate-500">
              "Oppdater alle byer" kjører Overpass-oppdatering for alle {cities.length} norske byer. 
              Tar 1-3 minutter avhengig av antall.
            </p>

            {/* Batch progress indicator */}
            {batchProgress && (
              <div className="p-4 bg-violet-900/20 border border-violet-800/50 rounded-xl flex items-center gap-3">
                <RefreshCw size={18} className="text-violet-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-violet-300">{batchProgress}</p>
              </div>
            )}

            {/* Success message */}
            {resultMessage && (
              <div className="p-4 bg-emerald-900/20 border border-emerald-800/50 rounded-xl">
                <p className="text-sm text-emerald-400">{resultMessage}</p>
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-xl flex items-center gap-3">
                <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{errorMessage}</p>
              </div>
            )}

            {/* Batch result details */}
            {batchResult && batchResult.failedCount > 0 && (
              <details className="p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
                <summary className="text-sm text-amber-400 cursor-pointer">
                  Vis detaljer for {batchResult.failedCount} feilede byer
                </summary>
                <ul className="mt-3 space-y-1 text-xs text-amber-300/80">
                  {batchResult.results
                    .filter(r => r.status === 'error')
                    .map(r => (
                      <li key={r.cityId}>
                        • {r.cityName}: {r.error}
                      </li>
                    ))}
                </ul>
              </details>
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

interface DashboardContentProps {
  onBack: () => void;
  onLogout?: () => void;
  adminPin: string;
}

function DashboardContent({ onBack, onLogout, adminPin }: DashboardContentProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    console.log('[AdminDashboard] Fetching stats from /api/admin-stats...');

    try {
      // Fetch stats from Edge Function API with PIN header
      const response = await fetch('/api/admin-stats', {
        method: 'GET',
        headers: {
          'x-admin-pin': adminPin,
        },
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        setError('Ugyldig PIN. Vennligst logg inn på nytt.');
        // Trigger logout if available
        onLogout?.();
        return;
      }

      const data: AdminStatsResponse = await response.json();

      console.log('[AdminDashboard] API response:', data);

      // Check for API errors
      if (data.error) {
        throw new Error(data.error);
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
  }, [adminPin, onLogout]);

  useEffect(() => {
    console.log('[AdminDashboard] Mounted, fetching stats...');
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

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
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-[#1a1b2b] border border-neutral-800 text-slate-400 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-50"
                title="Oppdater"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2.5 rounded-xl bg-[#1a1b2b] border border-neutral-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                  title="Logg ut"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
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
            <VenuesRefreshSection adminPin={adminPin} />

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
  onLogout?: () => void;
  adminPin: string;
}

export function AdminDashboard({ onBack, onLogout, adminPin }: AdminDashboardProps) {
  return <DashboardContent onBack={onBack} onLogout={onLogout} adminPin={adminPin} />;
}

export default AdminDashboard;
