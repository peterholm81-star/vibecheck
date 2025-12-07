/**
 * VibeCheck Insights Dashboard
 * Premium dark-mode analytics dashboard with sidebar navigation
 * Global timeRange and selectedVenueId filters affect all components
 * 
 * PIN authentication is handled by InsightsApp
 */

import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Calendar, RefreshCw, MapPin, BarChart3, Flame, TrendingUp, Users, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  KPISection,
  TrendGraphSection,
  ActivityHeatmap,
  VibeHeatmap,
  VibeCategoryTrend,
  DemographicsSection,
  VibeBoostSection,
  VibeImpactEstimator,
} from '../components/insights';

interface InsightsDashboardProps {
  onBack?: () => void;
  venueId?: string;
}

// Section type for sidebar navigation
type InsightsSection = 'overview' | 'vibe' | 'traffic' | 'demographics' | 'loyalty';

// Section configuration
const sectionConfig: Array<{
  id: InsightsSection;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'overview',
    label: 'Oversikt',
    description: 'Nøkkeltall & sammendrag',
    icon: <BarChart3 size={18} />,
  },
  {
    id: 'vibe',
    label: 'Vibe & stemning',
    description: 'Hot/Good/OK/Quiet, VibeBoost',
    icon: <Flame size={18} />,
  },
  {
    id: 'traffic',
    label: 'Besøk & trafikk',
    description: 'Aktivitet, peak times, heatmaps',
    icon: <TrendingUp size={18} />,
  },
  {
    id: 'demographics',
    label: 'Demografi',
    description: 'Hvem som er her',
    icon: <Users size={18} />,
  },
  {
    id: 'loyalty',
    label: 'Lojalitet',
    description: 'Returgjester & stamkunder',
    icon: <Award size={18} />,
  },
];

// ============================================
// VENUE LIST FOR INSIGHTS SELECTOR
// ============================================
// NOTE: These are PLACEHOLDER IDs that don't match real venue UUIDs in the database.
// 
// For REAL testing of the loyalty feature, you need to:
// 1. Find the actual venue UUID in Supabase:
//    SELECT id, name FROM public.venues WHERE name ILIKE '%Circus%';
// 2. Replace one of the placeholder IDs below with the real UUID.
//
// Example: If Circus has UUID 'a1b2c3d4-...' in your database, change:
//    { id: '1', name: 'Bar Circus' }
// to:
//    { id: 'a1b2c3d4-...', name: 'Bar Circus' }
//
// This will allow LoyaltyCard to fetch real data from venue_loyalty_city_rank.
// ============================================
const venueList = [
  { id: '1', name: 'Bar Circus' },
  { id: '2', name: 'Søstrene Karlsen Solsiden' },
  { id: '3', name: 'Downtown Nattklubb' },
  { id: '4', name: 'Bror Bar' },
  { id: '5', name: 'Habitat Cocktailbar' },
  { id: '6', name: 'Work-Work' },
  { id: '7', name: 'Ramp Pub & Scene' },
];

// Period options with numeric values
const periodOptions = [
  { id: '7d', label: '7 dager', days: 7 },
  { id: '14d', label: '14 dager', days: 14 },
  { id: '30d', label: '30 dager', days: 30 },
  { id: '90d', label: '90 dager', days: 90 },
];

// Period selector component
function PeriodSelector({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-[#1a1b2b] rounded-xl p-1">
      {periodOptions.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all ${
            value === p.id
              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f0f17]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Desktop Sidebar Navigation
function SidebarNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: InsightsSection;
  onSectionChange: (section: InsightsSection) => void;
}) {
  return (
    <aside className="hidden md:flex w-56 lg:w-64 flex-col flex-shrink-0">
      <div className="sticky top-24 bg-[#11121b] border border-neutral-800/50 rounded-2xl p-4 lg:p-5">
        {/* Sidebar header */}
        <div className="mb-5 pb-4 border-b border-neutral-800/50">
          <h2 className="text-base font-semibold text-white">Innsikt</h2>
          <p className="text-xs text-slate-500 mt-1">Velg fokusområde</p>
        </div>

        {/* Nav items */}
        <nav className="space-y-1">
          {sectionConfig.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`w-full text-left px-3 py-3 rounded-xl transition-all group ${
                  isActive
                    ? 'bg-violet-500/15 border-l-2 border-violet-400'
                    : 'hover:bg-[#1a1b2b] border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                    {section.icon}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}>
                      {section.label}
                    </p>
                    <p className={`text-xs truncate ${
                      isActive ? 'text-slate-400' : 'text-slate-600 group-hover:text-slate-500'
                    }`}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

// Mobile Horizontal Navigation
function MobileNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: InsightsSection;
  onSectionChange: (section: InsightsSection) => void;
}) {
  return (
    <div className="md:hidden mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 min-w-max pb-2">
        {sectionConfig.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50'
                  : 'bg-[#1a1b2b] text-slate-400 border border-transparent hover:text-slate-200'
              }`}
            >
              <span className={isActive ? 'text-violet-400' : 'text-slate-500'}>
                {section.icon}
              </span>
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Section Header
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================
// LOYALTY CARD: Viser lojalitetsstatistikk fra venue_loyalty_city_rank
// ============================================

interface LoyaltyData {
  venue_id: string;
  venue_name: string;
  city_name: string;
  retention_score: number;
  loyalty_rank: number;
  venues_in_city: number;
  weekly_returners: number;
  monthly_returners: number;
  high_frequency_guests: number;
  churned_users: number;
  total_users_90d: number;
}

function LoyaltyCard({ venueId }: { venueId: string }) {
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLoyaltyData() {
      setIsLoading(true);
      setError(null);

      // TODO: venueId kommer fra props. Når innlogget venue er implementert,
      // bør dette kobles til den innloggede venue-ID-en automatisk.
      const { data, error: fetchError } = await supabase
        .from('venue_loyalty_city_rank')
        .select('*')
        .eq('venue_id', venueId)
        .maybeSingle();

      if (fetchError) {
        console.error('[LoyaltyCard] Feil ved henting:', fetchError);
        setError('Kunne ikke hente lojalitetsstatistikk.');
      } else {
        setLoyaltyData(data);
      }
      setIsLoading(false);
    }

    if (venueId) {
      fetchLoyaltyData();
    }
  }, [venueId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Award size={18} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Lojalitet</h3>
        </div>
        <p className="text-sm text-slate-400">Laster lojalitetsdata…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-[#11121b] border border-red-800/30 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Award size={18} className="text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Lojalitet</h3>
        </div>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // No data state
  if (!loyaltyData) {
    return (
      <div className="p-6 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Award size={18} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Lojalitet</h3>
        </div>
        <p className="text-sm text-slate-500">Ingen lojalitetsdata tilgjengelig ennå.</p>
      </div>
    );
  }

  // Success state - vis lojalitetsdata
  return (
    <div className="p-6 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Award size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Lojalitet</h3>
            <p className="text-xs text-slate-500">{loyaltyData.city_name}</p>
          </div>
        </div>
        {/* Lojalitetsscore badge */}
        <div className="text-right">
          <div className="text-2xl font-bold text-amber-400">
            {loyaltyData.retention_score}<span className="text-sm text-slate-500">/100</span>
          </div>
          <p className="text-xs text-slate-500">Lojalitetsscore</p>
        </div>
      </div>

      {/* Plassering */}
      <div className="mb-5 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
        <p className="text-sm text-slate-300">
          <span className="text-amber-400 font-semibold">#{loyaltyData.loyalty_rank}</span>
          {' '}av {loyaltyData.venues_in_city} venues i {loyaltyData.city_name}
        </p>
      </div>

      {/* Statistikk-grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1a1b2b] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ukentlig</p>
          <p className="text-xl font-semibold text-emerald-400">{loyaltyData.weekly_returners}</p>
          <p className="text-xs text-slate-500">returgjester</p>
        </div>
        <div className="bg-[#1a1b2b] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Månedlig</p>
          <p className="text-xl font-semibold text-sky-400">{loyaltyData.monthly_returners}</p>
          <p className="text-xs text-slate-500">returgjester</p>
        </div>
        <div className="bg-[#1a1b2b] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">High-freq</p>
          <p className="text-xl font-semibold text-violet-400">{loyaltyData.high_frequency_guests}</p>
          <p className="text-xs text-slate-500">stamgjester</p>
        </div>
        <div className="bg-[#1a1b2b] rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Totalt</p>
          <p className="text-xl font-semibold text-slate-300">{loyaltyData.total_users_90d}</p>
          <p className="text-xs text-slate-500">gjester (90d)</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INSIGHTS DASHBOARD CONTENT (actual dashboard)
// ============================================

function InsightsDashboardContent({ onBack }: InsightsDashboardProps) {
  const [period, setPeriod] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venueList[0].id);
  const [activeSection, setActiveSection] = useState<InsightsSection>('overview');

  // Convert period string to numeric timeRange
  const timeRange = useMemo(() => {
    const found = periodOptions.find(p => p.id === period);
    return found?.days || 30;
  }, [period]);

  // Get selected venue name
  const selectedVenue = venueList.find(v => v.id === selectedVenueId);
  const venueName = selectedVenue?.name || 'Velg sted';

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Render section content based on activeSection
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <>
            <SectionHeader 
              title="Oversikt" 
              subtitle={`Nøkkeltall og sammendrag for ${venueName}`} 
            />
            <KPISection timeRange={timeRange} selectedVenueId={selectedVenueId} />
            <TrendGraphSection timeRange={timeRange} selectedVenueId={selectedVenueId} />
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ActivityHeatmap timeRange={timeRange} selectedVenueId={selectedVenueId} />
              <VibeHeatmap timeRange={timeRange} selectedVenueId={selectedVenueId} />
            </div>
            {/* Lojalitets-teaser – full analyse finnes under Lojalitet-fanen */}
            <div className="mt-8 p-4 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Award size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Lojalitetsanalyse</p>
                    <p className="text-xs text-slate-500">Se returgjester og stamkunder</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSection('loyalty')}
                  className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
                >
                  Vis detaljer →
                </button>
              </div>
            </div>
            <DemographicsSection timeRange={timeRange} selectedVenueId={selectedVenueId} />
          </>
        );

      case 'vibe':
        return (
          <>
            <SectionHeader 
              title="Vibe & stemning" 
              subtitle="Hot, Good, OK, Quiet – hvordan stemningen påvirker stedet" 
            />
            <div className="mb-8">
              <VibeHeatmap timeRange={timeRange} selectedVenueId={selectedVenueId} />
            </div>
            <VibeBoostSection selectedVenueId={selectedVenueId} timeRange={timeRange} />
            <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <VibeImpactEstimator selectedVenueId={selectedVenueId} timeRange={timeRange} />
              <VibeCategoryTrend timeRange={timeRange} selectedVenueId={selectedVenueId} />
            </div>
          </>
        );

      case 'traffic':
        return (
          <>
            <SectionHeader 
              title="Besøk & trafikk" 
              subtitle="Aktivitetsmønstre, peak times og innsjekkvolum" 
            />
            <TrendGraphSection timeRange={timeRange} selectedVenueId={selectedVenueId} />
            <div className="mt-8">
              <ActivityHeatmap timeRange={timeRange} selectedVenueId={selectedVenueId} />
            </div>
            {/* Include a simplified view of traffic-related VibeBoost stats */}
            <div className="mt-8 p-6 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Trafikk-relatert innsikt</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Peak dag</p>
                  <p className="text-xl font-semibold text-emerald-400">Lørdag</p>
                  <p className="text-xs text-slate-500 mt-1">Høyest aktivitet</p>
                </div>
                <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Peak time</p>
                  <p className="text-xl font-semibold text-sky-400">23:00</p>
                  <p className="text-xs text-slate-500 mt-1">Flest innsjekk</p>
                </div>
                <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Snitt per kveld</p>
                  <p className="text-xl font-semibold text-violet-400">47</p>
                  <p className="text-xs text-slate-500 mt-1">Innsjekk</p>
                </div>
              </div>
            </div>
          </>
        );

      case 'demographics':
        return (
          <>
            <SectionHeader 
              title="Demografi – hvem er her" 
              subtitle={`Alder, sivilstatus, intensjoner og vibe-fordeling basert på siste ${timeRange} dager`} 
            />
            <DemographicsSection timeRange={timeRange} selectedVenueId={selectedVenueId} />
          </>
        );

      case 'loyalty':
        return (
          <>
            <SectionHeader 
              title="Lojalitet" 
              subtitle="Hvor godt gjestene kommer tilbake til dette stedet" 
            />
            <LoyaltyCard venueId={selectedVenueId} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f17]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0f17]/95 backdrop-blur-md border-b border-neutral-800/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Left side - Back button and title */}
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                  <span className="hidden sm:inline text-sm font-medium">Tilbake</span>
                </button>
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                  VibeCheck Insights
                </h1>
                <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">
                  {venueName} · Sanntidsanalyse
                </p>
              </div>
            </div>

            {/* Right side - Period selector and refresh */}
            <div className="flex items-center gap-2 sm:gap-3">
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-[#1a1b2b] border border-neutral-800 text-slate-400 hover:text-violet-400 hover:border-violet-500/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Admin Venue Selector - Full width above sidebar+content */}
        <div className="mb-6 p-4 bg-[#11121b] border border-neutral-800/50 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/20 rounded-lg">
                <MapPin size={18} className="text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Velg sted</p>
                <p className="text-sm text-slate-300 mt-0.5">Viser insights for valgt venue</p>
              </div>
            </div>
            <select
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="bg-[#1a1b2b] border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 min-w-[200px] cursor-pointer"
            >
              {venueList.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sidebar + Main Content */}
        <div className="flex gap-6 lg:gap-8">
          {/* Desktop Sidebar */}
          <SidebarNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
          />

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {/* Mobile Navigation */}
            <MobileNav 
              activeSection={activeSection} 
              onSectionChange={setActiveSection} 
            />

            {/* Section Content */}
            {renderSectionContent()}

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-neutral-800/50">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-slate-500">
                    Data oppdateres i sanntid
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar size={14} />
                  <span>Viser data for siste {timeRange} dager</span>
                </div>
              </div>
              <p className="text-center text-xs text-slate-700 mt-6">
                VibeCheck Insights · Powered by anonyme innsjekk-data
              </p>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN INSIGHTS DASHBOARD COMPONENT
// PIN authentication is now handled by InsightsApp
// ============================================

export function InsightsDashboard({ onBack }: InsightsDashboardProps) {
  // Render dashboard content directly - PIN is handled by InsightsApp
  return <InsightsDashboardContent onBack={onBack} />;
}

export default InsightsDashboard;
