/**
 * VibeBoostSection - Visualizes how high vibe correlates with higher traffic
 * Shows traffic index by vibe category and derived VibeBoost KPI
 */

interface VibeBoostSectionProps {
  selectedVenueId: string | null;
  timeRange: number;
}

// Vibe colors matching existing palette
const vibeConfig = {
  Hot: { color: '#fb923c', bg: 'bg-orange-500', emoji: '🔥' },
  Good: { color: '#34d399', bg: 'bg-emerald-500', emoji: '✨' },
  OK: { color: '#facc15', bg: 'bg-yellow-400', emoji: '👍' },
  Quiet: { color: '#a78bfa', bg: 'bg-violet-400', emoji: '😴' },
};

// Seeded random generator for consistent venue-specific values
function seededRandom(seed: number, offset: number = 0): number {
  const x = Math.sin(seed * 9999 + offset * 123) * 10000;
  return x - Math.floor(x);
}

// Hash venueId to numeric seed
function hashVenueId(venueId: string | null): number {
  if (!venueId) return 42;
  return venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

// Generate vibe traffic data based on venue and timeRange
function generateVibeTraffic(venueId: string | null, timeRange: number) {
  const seed = hashVenueId(venueId);
  const timeVariance = timeRange / 30;
  
  return [
    { 
      vibe: 'Hot' as const, 
      index: 1.6 + seededRandom(seed, 1) * 0.4 + timeVariance * 0.1 
    },
    { 
      vibe: 'Good' as const, 
      index: 1.2 + seededRandom(seed, 2) * 0.3 
    },
    { 
      vibe: 'OK' as const, 
      index: 0.95 + seededRandom(seed, 3) * 0.15 
    },
    { 
      vibe: 'Quiet' as const, 
      index: 0.5 + seededRandom(seed, 4) * 0.3 
    },
  ];
}

// Generate mini-insights based on venue and timeRange
function generateMiniInsights(venueId: string | null, timeRange: number) {
  const seed = hashVenueId(venueId);
  
  const days = ['Fredag', 'Lørdag', 'Søndag', 'Torsdag'];
  const bestDayIndex = Math.floor(seededRandom(seed, 10) * 2); // Fri or Sat usually
  
  const timeSlots = ['22:00–01:00', '23:00–02:00', '21:00–00:00', '20:00–23:00'];
  const bestTimeIndex = Math.floor(seededRandom(seed, 11) * timeSlots.length);
  
  const topVibes = ['🔥 Hot', '✨ Good'];
  const topVibeIndex = seededRandom(seed, 12) > 0.7 ? 1 : 0;
  
  return {
    bestDay: days[bestDayIndex],
    bestTime: timeSlots[bestTimeIndex],
    topVibe: topVibes[topVibeIndex],
  };
}

export default function VibeBoostSection({ selectedVenueId, timeRange }: VibeBoostSectionProps) {
  const vibeTraffic = generateVibeTraffic(selectedVenueId, timeRange);
  const miniInsights = generateMiniInsights(selectedVenueId, timeRange);
  
  // Calculate VibeBoost percentage
  const avgHighVibe = (vibeTraffic[0].index + vibeTraffic[1].index) / 2;
  const avgLowVibe = (vibeTraffic[2].index + vibeTraffic[3].index) / 2;
  const vibeBoost = Math.round((avgHighVibe / avgLowVibe - 1) * 100);
  
  const maxIndex = Math.max(...vibeTraffic.map(v => v.index));

  return (
    <section className="mt-8">
      <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h3 className="text-lg font-semibold text-white">
              VibeBoost – hvordan stemning påvirker trafikken
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Sammenheng mellom vibe og innsjekkvolum (siste {timeRange} dager)
            </p>
          </div>
          <span className="text-xs text-[#a8a8b5]">Siste {timeRange} dager</span>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart: Traffic by Vibe */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-medium text-slate-400 mb-4">Trafikk-indeks per vibe</h4>
            <div className="space-y-4">
              {vibeTraffic.map((item) => {
                const config = vibeConfig[item.vibe];
                const barWidth = (item.index / maxIndex) * 100;
                
                return (
                  <div key={item.vibe} className="flex items-center gap-4">
                    {/* Vibe label */}
                    <div className="w-20 flex items-center gap-2">
                      <span className="text-sm">{config.emoji}</span>
                      <span className="text-sm text-slate-300">{item.vibe}</span>
                    </div>
                    
                    {/* Bar */}
                    <div className="flex-1 h-8 bg-[#1a1b2b] rounded-lg overflow-hidden relative">
                      <div 
                        className="h-full rounded-lg transition-all duration-500"
                        style={{ 
                          width: `${barWidth}%`,
                          backgroundColor: config.color,
                          boxShadow: `0 0 20px ${config.color}40`
                        }}
                      />
                      {/* Index label inside bar */}
                      <span 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                        style={{ color: barWidth > 60 ? '#fff' : config.color }}
                      >
                        {item.index.toFixed(1)}×
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend text */}
            <p className="text-xs text-slate-500 mt-4">
              {vibeTraffic[0].index.toFixed(1)}× flere innsjekk ved {vibeConfig.Hot.emoji} Hot-vibe sammenlignet med baseline
            </p>
          </div>

          {/* VibeBoost KPI */}
          <div className="flex flex-col items-center justify-center p-6 bg-[#1a1b2b] rounded-2xl border border-neutral-800/30">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-2">VibeBoost</span>
            <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">
              +{vibeBoost}%
            </div>
            <p className="text-sm text-slate-400 mt-2 text-center">
              Flere innsjekk i timene etter høy vibe
            </p>
            <p className="text-xs text-slate-600 mt-4 text-center leading-relaxed max-w-[200px]">
              Estimert økning i trafikk når stemningen er Hot eller Good, sammenlignet med ellers.
            </p>
          </div>
        </div>

        {/* Mini-insights row */}
        <div className="mt-8 pt-6 border-t border-neutral-800/50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Best day */}
            <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Størst effekt</p>
              <p className="text-xl font-semibold text-emerald-400">{miniInsights.bestDay}</p>
              <p className="text-xs text-slate-500 mt-1">Høyest VibeBoost på denne dagen</p>
            </div>

            {/* Best time */}
            <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Beste tidspunkt</p>
              <p className="text-xl font-semibold text-sky-400">{miniInsights.bestTime}</p>
              <p className="text-xs text-slate-500 mt-1">Mest økning i trafikk etter høy vibe</p>
            </div>

            {/* Top vibe */}
            <div className="bg-[#1a1b2b] rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Vibe som driver mest</p>
              <p className="text-xl font-semibold text-orange-400">{miniInsights.topVibe}</p>
              <p className="text-xs text-slate-500 mt-1">Gir høyest innsjekkvolum</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

