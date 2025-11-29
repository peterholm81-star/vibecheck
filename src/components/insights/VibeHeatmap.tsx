/**
 * VibeHeatmap - Compact heatmap showing vibe scores by day/hour
 * Uses warm colors (orange/pink) for high vibes
 * All values depend on timeRange and selectedVenueId
 */

interface VibeHeatmapProps {
  timeRange: number;
  selectedVenueId: string;
}

const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
// Norwegian venues close at 03:00, so we only show hours 18:00-03:00
const hours = [
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
  '00:00',
  '01:00',
  '02:00',
  '03:00',
];

// Generate pseudo-random based on seed
function seededRandom(seed: number, offset: number = 0): number {
  const x = Math.sin(seed * 9999 + offset * 123) * 10000;
  return x - Math.floor(x);
}

// Generate placeholder vibe data based on timeRange and venueId
function generateVibeData(timeRange: number, venueId: string): number[][] {
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeVariance = timeRange / 30;
  
  return hours.map((_, hourIndex) => {
    return days.map((_, dayIndex) => {
      const isWeekend = dayIndex >= 4;
      const isPeakVibe = hourIndex >= 5 && hourIndex <= 7;
      const isLateNight = hourIndex >= 8;
      const venueBase = 0.4 + seededRandom(seed, 200) * 0.2;
      
      let baseValue = venueBase + seededRandom(seed, hourIndex * 10 + dayIndex + 50) * 0.2 * timeVariance;
      
      if (isWeekend) baseValue += 0.12 + seededRandom(seed, hourIndex + dayIndex * 11) * 0.08;
      if (isPeakVibe) baseValue += 0.15 + seededRandom(seed, hourIndex * 5) * 0.1;
      if (isLateNight) baseValue -= 0.08;
      
      return Math.max(0.1, Math.min(1, baseValue));
    });
  });
}

// Get color class based on vibe intensity (0-1)
function getVibeColor(value: number): string {
  if (value < 0.3) return 'bg-orange-500/15';
  if (value < 0.5) return 'bg-orange-500/30';
  if (value < 0.65) return 'bg-pink-500/40';
  if (value < 0.8) return 'bg-pink-500/60';
  return 'bg-pink-500/80';
}

// Get vibe emoji based on value
function getVibeEmoji(value: number): string {
  if (value < 0.3) return '😴';
  if (value < 0.5) return '👍';
  if (value < 0.7) return '✨';
  if (value < 0.85) return '🔥';
  return '🎉';
}

export default function VibeHeatmap({ timeRange, selectedVenueId }: VibeHeatmapProps) {
  const vibeData = generateVibeData(timeRange, selectedVenueId);
  const avgVibe = vibeData.flat().reduce((a, b) => a + b, 0) / (vibeData.length * vibeData[0].length);

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-4 sm:p-5">
      {/* Header - compact */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-white">Vibe-score fordeling</h3>
          <p className="text-xs text-slate-500 mt-0.5">Stemning gjennom uken</p>
        </div>
        <div className="text-right flex items-center gap-2">
          <span className="text-lg">{getVibeEmoji(avgVibe)}</span>
          <div>
            <p className="text-[10px] text-slate-500">Snitt</p>
            <p className="text-xs font-medium text-slate-400">{Math.round(avgVibe * 10)}/10</p>
          </div>
        </div>
      </div>

      {/* Time range label */}
      <div className="flex justify-end mb-2">
        <span className="text-[10px] text-[#a8a8b5]">Typisk uke ({timeRange}d)</span>
      </div>

      {/* Heatmap Grid - compact */}
      <div className="overflow-x-auto">
        <div className="min-w-[280px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-0.5 mb-1">
            <div className="w-10" />
            {days.map((day) => (
              <div key={day} className="text-center text-[10px] font-medium text-slate-500">
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap rows - compact cells */}
          {hours.map((hour, hourIndex) => (
            <div key={hour} className="grid grid-cols-8 gap-0.5 mb-0.5">
              <div className="w-10 text-[10px] text-slate-600 flex items-center justify-end pr-1.5">
                {hour}
              </div>
              {days.map((day, dayIndex) => {
                const value = vibeData[hourIndex][dayIndex];
                return (
                  <div
                    key={`${day}-${hour}`}
                    className={`h-5 rounded-sm ${getVibeColor(value)} hover:ring-1 hover:ring-pink-400/50 transition-all cursor-pointer flex items-center justify-center`}
                    title={`${day} ${hour}: ${Math.round(value * 10)}/10`}
                  >
                    {value > 0.8 && (
                      <span className="text-[8px]">🔥</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend - compact */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px]">😴</span>
          <span className="text-[10px] text-slate-600">Rolig</span>
        </div>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.55, 0.72, 0.9].map((value) => (
            <div
              key={value}
              className={`w-5 h-2 rounded-sm ${getVibeColor(value)}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-600">Party</span>
          <span className="text-[10px]">🔥</span>
        </div>
      </div>
    </div>
  );
}
