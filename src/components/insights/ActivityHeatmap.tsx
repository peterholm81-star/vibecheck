/**
 * ActivityHeatmap - Compact heatmap showing check-in activity by day/hour
 * 7 columns (days) × 10 rows (hours: 18:00-03:00)
 * All values depend on timeRange and selectedVenueId
 */

interface ActivityHeatmapProps {
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

// Generate placeholder heatmap data with realistic nightlife patterns
function generateHeatmapData(timeRange: number, venueId: string): number[][] {
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const timeVariance = timeRange / 30;
  
  return hours.map((_, hourIndex) => {
    return days.map((_, dayIndex) => {
      const isWeekend = dayIndex >= 4;
      const isPeakHour = hourIndex >= 4 && hourIndex <= 8;
      const venueBase = 0.1 + seededRandom(seed, 100) * 0.2;
      
      let baseValue = venueBase + seededRandom(seed, hourIndex * 10 + dayIndex) * 0.2 * timeVariance;
      
      if (isWeekend) baseValue += 0.25 + seededRandom(seed, hourIndex + dayIndex * 7) * 0.15;
      if (isPeakHour) baseValue += 0.2 + seededRandom(seed, hourIndex * 3) * 0.1;
      if (isWeekend && isPeakHour) baseValue += 0.15;
      
      return Math.min(1, Math.max(0, baseValue));
    });
  });
}

// Get color class based on intensity (0-1)
function getIntensityColor(value: number): string {
  if (value < 0.2) return 'bg-violet-500/10';
  if (value < 0.4) return 'bg-violet-500/25';
  if (value < 0.6) return 'bg-violet-500/40';
  if (value < 0.8) return 'bg-violet-500/60';
  return 'bg-violet-500/80';
}

export default function ActivityHeatmap({ timeRange, selectedVenueId }: ActivityHeatmapProps) {
  const heatmapData = generateHeatmapData(timeRange, selectedVenueId);

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-4 sm:p-5">
      {/* Header - more compact */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-white">Aktivitet per time</h3>
          <p className="text-xs text-slate-500 mt-0.5">Når folk sjekker inn</p>
        </div>
        <span className="text-[10px] text-[#a8a8b5] leading-tight text-right max-w-[140px]">
          Typisk uke ({timeRange}d)
        </span>
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
              {/* Hour label */}
              <div className="w-10 text-[10px] text-slate-600 flex items-center justify-end pr-1.5">
                {hour}
              </div>
              {/* Cells - smaller and square */}
              {days.map((day, dayIndex) => (
                <div
                  key={`${day}-${hour}`}
                  className={`h-5 rounded-sm ${getIntensityColor(heatmapData[hourIndex][dayIndex])} hover:ring-1 hover:ring-violet-400/50 transition-all cursor-pointer`}
                  title={`${day} ${hour}: ${Math.round(heatmapData[hourIndex][dayIndex] * 100)}%`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend - compact */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">Lav</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((value) => (
            <div
              key={value}
              className={`w-5 h-2 rounded-sm ${getIntensityColor(value)}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-slate-600">Høy</span>
      </div>
    </div>
  );
}
