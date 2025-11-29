/**
 * KPISection - Premium 6-card KPI row for Insights Dashboard
 * Displays key metrics with sparkline placeholders
 * All values are generated based on timeRange and selectedVenueId
 */

interface KPISectionProps {
  timeRange: number;
  selectedVenueId: string;
}

// Mini sparkline SVG component
function Sparkline({ color = 'violet' }: { color?: 'violet' | 'pink' | 'orange' | 'sky' | 'emerald' | 'amber' }) {
  const colorMap = {
    violet: '#a78bfa',
    pink: '#f472b6',
    orange: '#fb923c',
    sky: '#38bdf8',
    emerald: '#34d399',
    amber: '#fbbf24',
  };

  return (
    <svg viewBox="0 0 100 30" className="w-full h-8 mt-3">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colorMap[color]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorMap[color]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 8 L80 14 L90 6 L100 10"
        fill="none"
        stroke={colorMap[color]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0 25 L10 20 L20 22 L30 15 L40 18 L50 10 L60 12 L70 8 L80 14 L90 6 L100 10 L100 30 L0 30 Z"
        fill={`url(#grad-${color})`}
      />
    </svg>
  );
}

// Single KPI Card
interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  color: 'violet' | 'pink' | 'orange' | 'sky' | 'emerald' | 'amber';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

function KPICard({ title, value, subtitle, color, trend = 'neutral', trendValue }: KPICardProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-rose-400',
    neutral: 'text-slate-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-5 hover:border-neutral-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-black/20">
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
        {trendValue && (
          <span className={`text-xs font-medium ${trendColors[trend]} flex items-center gap-0.5`}>
            {trendIcons[trend]} {trendValue}
          </span>
        )}
      </div>
      <div className="mt-2">
        <span className={`text-3xl font-bold bg-gradient-to-r from-${color}-400 to-${color}-300 bg-clip-text text-transparent`}>
          {value}
        </span>
        {subtitle && (
          <span className="text-sm text-slate-500 ml-2">{subtitle}</span>
        )}
      </div>
      <Sparkline color={color} />
    </div>
  );
}

// Generate pseudo-random based on seed for consistent venue-specific values
function seededRandom(seed: number, offset: number = 0): number {
  const x = Math.sin(seed * 9999 + offset * 123) * 10000;
  return x - Math.floor(x);
}

// Generate KPI values based on timeRange and venueId
function generateKPIValues(timeRange: number, venueId: string) {
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Scale base values by timeRange
  const baseCheckIns = Math.round((150 + seed % 100) * (timeRange / 7));
  const checkInVariation = Math.round(seededRandom(seed, 1) * 200);
  const totalCheckIns = baseCheckIns + checkInVariation;
  
  // Vibe score (6.5 - 9.5 range)
  const vibeScore = (7 + seededRandom(seed, 2) * 2.5).toFixed(1);
  const vibeChange = (seededRandom(seed, 3) * 0.6 - 0.2).toFixed(1);
  
  // Single percentage (50-75%)
  const singlePercent = Math.round(55 + seededRandom(seed, 4) * 20);
  const singleChange = Math.round(seededRandom(seed, 5) * 8 - 4);
  
  // ONS intent rate (25-50%)
  const onsRate = Math.round(30 + seededRandom(seed, 6) * 20);
  const onsChange = Math.round(seededRandom(seed, 7) * 10 - 3);
  
  // Popular vibe
  const vibes = ['Party', 'Chill', 'Date night', 'Afterwork'];
  const popularVibe = vibes[Math.floor(seededRandom(seed, 8) * vibes.length)];
  
  // Peak time
  const peakHour = 21 + Math.floor(seededRandom(seed, 9) * 4);
  const peakDays = ['Fredag', 'Lørdag', 'Torsdag'];
  const peakDay = peakDays[Math.floor(seededRandom(seed, 10) * peakDays.length)];
  
  // Check-in trend
  const checkInTrend = Math.round(seededRandom(seed, 11) * 20 - 5);
  
  return {
    totalCheckIns: totalCheckIns.toLocaleString('nb-NO'),
    checkInTrend: checkInTrend >= 0 ? `+${checkInTrend}%` : `${checkInTrend}%`,
    checkInTrendDir: checkInTrend >= 2 ? 'up' : checkInTrend <= -2 ? 'down' : 'neutral',
    vibeScore,
    vibeChange: parseFloat(vibeChange) >= 0 ? `+${vibeChange}` : vibeChange,
    vibeTrendDir: parseFloat(vibeChange) >= 0.1 ? 'up' : parseFloat(vibeChange) <= -0.1 ? 'down' : 'neutral',
    singlePercent: `${singlePercent}%`,
    singleChange: singleChange >= 0 ? `+${singleChange}%` : `${singleChange}%`,
    singleTrendDir: Math.abs(singleChange) <= 2 ? 'neutral' : singleChange > 0 ? 'up' : 'down',
    onsRate: `${onsRate}%`,
    onsChange: onsChange >= 0 ? `+${onsChange}%` : `${onsChange}%`,
    onsTrendDir: onsChange >= 2 ? 'up' : onsChange <= -2 ? 'down' : 'neutral',
    popularVibe,
    peakTime: `${peakHour}:00`,
    peakDay,
  };
}

// Main KPI Section
export default function KPISection({ timeRange, selectedVenueId }: KPISectionProps) {
  const values = generateKPIValues(timeRange, selectedVenueId);
  
  const kpis: KPICardProps[] = [
    {
      title: 'Total innsjekk',
      value: values.totalCheckIns,
      color: 'violet',
      trend: values.checkInTrendDir as 'up' | 'down' | 'neutral',
      trendValue: values.checkInTrend,
    },
    {
      title: 'Snitt vibe-score',
      value: values.vibeScore,
      subtitle: '/ 10',
      color: 'pink',
      trend: values.vibeTrendDir as 'up' | 'down' | 'neutral',
      trendValue: values.vibeChange,
    },
    {
      title: 'Andel single',
      value: values.singlePercent,
      color: 'orange',
      trend: values.singleTrendDir as 'up' | 'down' | 'neutral',
      trendValue: values.singleChange,
    },
    {
      title: 'ONS-intent rate',
      value: values.onsRate,
      color: 'sky',
      trend: values.onsTrendDir as 'up' | 'down' | 'neutral',
      trendValue: values.onsChange,
    },
    {
      title: 'Mest populære vibe',
      value: values.popularVibe,
      color: 'emerald',
      trend: 'neutral',
    },
    {
      title: 'Peak time',
      value: values.peakTime,
      subtitle: values.peakDay,
      color: 'amber',
      trend: 'neutral',
    },
  ];

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Nøkkeltall</h2>
        <span className="text-xs text-[#a8a8b5]">Siste {timeRange} dager</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>
    </section>
  );
}
