/**
 * VibeCategoryTrend - Premium multiline neon graph showing vibe category trends
 * Categories: Hot (orange), Good (green), OK (yellow), Quiet (purple)
 * Uses light smoothing with increased variation for visible trends
 */

interface VibeCategoryTrendProps {
  timeRange: number;
  selectedVenueId: string;
}

// Category colors (neon palette)
const categoryConfig = {
  hot: { color: '#fb923c', label: '🔥 Hot', glowColor: 'rgba(251, 146, 60, 0.3)' },
  good: { color: '#34d399', label: '✨ Good', glowColor: 'rgba(52, 211, 153, 0.3)' },
  ok: { color: '#facc15', label: '👍 OK', glowColor: 'rgba(250, 204, 21, 0.3)' },
  quiet: { color: '#a78bfa', label: '😴 Quiet', glowColor: 'rgba(167, 139, 250, 0.3)' },
};

interface VibeTrendDataPoint {
  label: string;
  hot: number;
  good: number;
  ok: number;
  quiet: number;
}

// Generate venue-specific pseudo-random based on seed
function seededRandom(seed: number, index: number): number {
  const x = Math.sin(seed * 9999 + index * 123) * 10000;
  return x - Math.floor(x);
}

/**
 * Light smoothing with window of 2 - preserves variation while removing sharp spikes
 */
function smoothSeries(values: number[]): number[] {
  if (values.length < 2) return values;

  const smoothed: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      smoothed.push((values[0] + values[1]) / 2);
    } else if (i === values.length - 1) {
      smoothed.push((values[i - 1] + values[i]) / 2);
    } else {
      // Simple 3-point weighted average favoring current point
      smoothed.push(values[i - 1] * 0.25 + values[i] * 0.5 + values[i + 1] * 0.25);
    }
  }
  return smoothed;
}

// Generate vibe trend data with clear wave patterns and separation
function generateVibeTrendData(timeRange: number, venueId: string): VibeTrendDataPoint[] {
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const dataPoints = Math.min(timeRange, 30);
  const data: VibeTrendDataPoint[] = [];
  
  // Venue-specific phase offsets for wave patterns
  const hotPhase = seededRandom(seed, 100) * Math.PI * 2;
  const goodPhase = seededRandom(seed, 101) * Math.PI * 2;
  const okPhase = seededRandom(seed, 102) * Math.PI * 2;
  const quietPhase = seededRandom(seed, 103) * Math.PI * 2;
  
  // Venue-specific base levels
  const venueOffset = (seed % 15) / 100;
  
  for (let i = 0; i < dataPoints; i++) {
    const dayIndex = i % 7;
    const isWeekend = dayIndex === 5 || dayIndex === 6;
    const progress = i / dataPoints; // 0 to 1 over the range
    
    // Wave patterns with different frequencies per category
    const hotWave = Math.sin(progress * Math.PI * 4 + hotPhase) * 8;
    const goodWave = Math.sin(progress * Math.PI * 3 + goodPhase) * 6;
    const okWave = Math.sin(progress * Math.PI * 2.5 + okPhase) * 5;
    const quietWave = Math.sin(progress * Math.PI * 3.5 + quietPhase) * 4;
    
    // Random noise (smaller than before)
    const hotNoise = (seededRandom(seed, i * 4) - 0.5) * 6;
    const goodNoise = (seededRandom(seed, i * 4 + 1) - 0.5) * 5;
    const okNoise = (seededRandom(seed, i * 4 + 2) - 0.5) * 4;
    const quietNoise = (seededRandom(seed, i * 4 + 3) - 0.5) * 3;
    
    // Base + wave + weekend boost + noise + venue offset
    let hot = 38 + hotWave + hotNoise + (isWeekend ? 10 : -3) + venueOffset * 60;
    let good = 32 + goodWave + goodNoise + (isWeekend ? 3 : 0) - venueOffset * 20;
    let ok = 20 + okWave + okNoise + (isWeekend ? -2 : 2);
    let quiet = 10 + quietWave + quietNoise + (isWeekend ? -4 : 3) - venueOffset * 15;
    
    // Clamp to valid ranges with good separation
    hot = Math.max(25, Math.min(55, hot));
    good = Math.max(22, Math.min(42, good));
    ok = Math.max(12, Math.min(28, ok));
    quiet = Math.max(4, Math.min(18, quiet));
    
    // Generate label
    let label: string;
    if (timeRange <= 7) {
      const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
      label = days[i % 7];
    } else if (timeRange <= 14) {
      label = i % 2 === 0 ? `D${i + 1}` : '';
    } else {
      const labelInterval = Math.ceil(dataPoints / 7);
      label = i % labelInterval === 0 ? `D${i + 1}` : '';
    }
    
    data.push({ label, hot, good, ok, quiet });
  }
  
  return data;
}

// Generate smooth bezier curve path for a data series
function generateCurvePath(
  data: number[],
  chartWidth: number,
  chartHeight: number,
  padding: number = 30
): string {
  if (data.length === 0) return '';
  if (data.length === 1) {
    const y = chartHeight - padding - (data[0] / 60) * (chartHeight - padding * 2);
    return `M ${padding} ${y} L ${chartWidth - padding} ${y}`;
  }
  
  const maxValue = 60;
  const minValue = 0;
  const range = maxValue - minValue;
  
  const stepX = (chartWidth - padding * 2) / (data.length - 1);
  
  const coords = data.map((value, index) => ({
    x: padding + index * stepX,
    y: chartHeight - padding - ((value - minValue) / range) * (chartHeight - padding * 2),
  }));

  let path = `M ${coords[0].x} ${coords[0].y}`;
  
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const tension = 0.35;
    const cpX1 = prev.x + (curr.x - prev.x) * tension;
    const cpX2 = curr.x - (curr.x - prev.x) * tension;
    path += ` C ${cpX1} ${prev.y}, ${cpX2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  return path;
}

export default function VibeCategoryTrend({ timeRange, selectedVenueId }: VibeCategoryTrendProps) {
  const chartWidth = 700;
  const chartHeight = 260;
  const padding = 35;

  const vibeTrendData = generateVibeTrendData(timeRange, selectedVenueId);

  // Apply light smoothing to each series
  const hotData = smoothSeries(vibeTrendData.map(d => d.hot));
  const goodData = smoothSeries(vibeTrendData.map(d => d.good));
  const okData = smoothSeries(vibeTrendData.map(d => d.ok));
  const quietData = smoothSeries(vibeTrendData.map(d => d.quiet));

  const gridValues = [0, 20, 40, 60];

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 lg:p-8 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Vibe-trend etter kategori</h3>
          <p className="text-sm text-slate-500 mt-1">
            Fordeling av Hot / Good / OK / Quiet over tid
          </p>
        </div>
        <span className="text-xs text-[#a8a8b5]">Siste {timeRange} dager</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 sm:gap-8 mb-8">
        {Object.entries(categoryConfig).map(([key, { color, label }]) => (
          <div key={key} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
            />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Chart Container */}
      <div className="relative w-full" style={{ height: chartHeight }}>
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Definitions for subtle glow effects */}
          <defs>
            <filter id="glow-hot-v2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor={categoryConfig.hot.glowColor} />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-good-v2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor={categoryConfig.good.glowColor} />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-ok-v2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor={categoryConfig.ok.glowColor} />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-quiet-v2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feFlood floodColor={categoryConfig.quiet.glowColor} />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {gridValues.map((value, i) => {
            const y = chartHeight - padding - (value / 60) * (chartHeight - padding * 2);
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#252636"
                  strokeWidth="1"
                  strokeDasharray={value === 0 ? '0' : '3,6'}
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-600 text-[10px]"
                >
                  {value}%
                </text>
              </g>
            );
          })}

          {/* Quiet line (back) */}
          <path
            d={generateCurvePath(quietData, chartWidth, chartHeight, padding)}
            fill="none"
            stroke={categoryConfig.quiet.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-quiet-v2)"
            opacity="0.9"
          />

          {/* OK line */}
          <path
            d={generateCurvePath(okData, chartWidth, chartHeight, padding)}
            fill="none"
            stroke={categoryConfig.ok.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-ok-v2)"
            opacity="0.9"
          />

          {/* Good line */}
          <path
            d={generateCurvePath(goodData, chartWidth, chartHeight, padding)}
            fill="none"
            stroke={categoryConfig.good.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-good-v2)"
          />

          {/* Hot line (front) */}
          <path
            d={generateCurvePath(hotData, chartWidth, chartHeight, padding)}
            fill="none"
            stroke={categoryConfig.hot.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow-hot-v2)"
          />
        </svg>

        {/* X-axis labels */}
        <div 
          className="absolute bottom-0 left-0 right-0 flex justify-between"
          style={{ marginBottom: '-4px', paddingLeft: padding, paddingRight: padding }}
        >
          {vibeTrendData.map((item, i) => (
            <span 
              key={i} 
              className="text-[10px] text-slate-600 min-w-0"
              style={{ visibility: item.label ? 'visible' : 'hidden' }}
            >
              {item.label || '.'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
