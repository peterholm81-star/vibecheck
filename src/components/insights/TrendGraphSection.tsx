/**
 * TrendGraphSection - Premium trend line chart for Insights Dashboard
 * Shows check-in activity trend only (vibe-score removed)
 */

interface TrendGraphSectionProps {
  timeRange: number;
  selectedVenueId: string;
}

// Generate smooth curve path for SVG
function generatePath(points: number[], height: number, width: number): string {
  const maxValue = Math.max(...points);
  const minValue = Math.min(...points);
  const range = maxValue - minValue || 1;
  
  const stepX = width / (points.length - 1);
  
  const coords = points.map((value, index) => ({
    x: index * stepX,
    y: height - ((value - minValue) / range) * height * 0.8 - height * 0.1,
  }));

  // Create smooth bezier curve
  let path = `M ${coords[0].x} ${coords[0].y}`;
  
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = (prev.x + curr.x) / 2;
    path += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  return path;
}

// Generate area fill path
function generateAreaPath(points: number[], height: number, width: number): string {
  const linePath = generatePath(points, height, width);
  const stepX = width / (points.length - 1);
  return `${linePath} L ${(points.length - 1) * stepX} ${height} L 0 ${height} Z`;
}

// Generate placeholder activity data based on timeRange and venueId
function generateActivityData(timeRange: number, venueId: string): number[] {
  // Seed based on venueId for consistent results per venue
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const pseudoRandom = (index: number) => {
    const x = Math.sin(seed * 9999 + index) * 10000;
    return x - Math.floor(x);
  };

  const dataPoints = Math.min(timeRange, 30); // Cap at 30 points for readability
  const data: number[] = [];
  
  for (let i = 0; i < dataPoints; i++) {
    // Base value varies by venue
    const venueBase = 40 + (seed % 30);
    // Weekend bump pattern
    const dayOfWeek = i % 7;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const weekendBonus = isWeekend ? 25 : 0;
    // Random variation
    const randomVariation = pseudoRandom(i) * 20 - 10;
    // Slight upward trend
    const trend = (i / dataPoints) * 15;
    
    data.push(Math.max(20, Math.min(100, venueBase + weekendBonus + randomVariation + trend)));
  }
  
  return data;
}

// Generate X-axis labels based on timeRange
function generateTimeLabels(timeRange: number): string[] {
  const labels: string[] = [];
  const dataPoints = Math.min(timeRange, 30);
  
  if (timeRange <= 7) {
    const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
    for (let i = 0; i < dataPoints; i++) {
      labels.push(days[i % 7]);
    }
  } else if (timeRange <= 14) {
    for (let i = 0; i < dataPoints; i++) {
      labels.push(`D${i + 1}`);
    }
  } else {
    // Show every nth label to avoid crowding
    const step = Math.ceil(dataPoints / 10);
    for (let i = 0; i < dataPoints; i++) {
      if (i % step === 0) {
        labels.push(`D${i + 1}`);
      } else {
        labels.push('');
      }
    }
  }
  
  return labels;
}

export default function TrendGraphSection({ timeRange, selectedVenueId }: TrendGraphSectionProps) {
  const activityData = generateActivityData(timeRange, selectedVenueId);
  const timeLabels = generateTimeLabels(timeRange);
  
  const chartWidth = 800;
  const chartHeight = 200;

  return (
    <section className="mt-8">
      <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Aktivitetstrend</h2>
            <p className="text-sm text-slate-500 mt-1">Siste {timeRange} dager</p>
          </div>
          
          {/* Legend */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-400" />
            <span className="text-sm text-slate-400">Innsjekk</span>
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-56 w-full">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
            {/* Definitions */}
            <defs>
              <linearGradient id="activityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
              </linearGradient>
              <filter id="glowActivity">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75].map((ratio, i) => (
              <line
                key={i}
                x1="0"
                y1={chartHeight * ratio}
                x2={chartWidth}
                y2={chartHeight * ratio}
                stroke="#2a2b3b"
                strokeWidth="1"
              />
            ))}

            {/* Activity area fill */}
            <path
              d={generateAreaPath(activityData, chartHeight, chartWidth)}
              fill="url(#activityGradient)"
            />

            {/* Activity line with glow */}
            <path
              d={generatePath(activityData, chartHeight, chartWidth)}
              fill="none"
              stroke="#a78bfa"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glowActivity)"
            />
          </svg>

          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-2 -ml-8 text-xs text-slate-500">
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-4 px-4 overflow-hidden">
          {timeLabels.map((label, i) => (
            <span key={i} className="text-xs text-slate-500 min-w-0 truncate">{label}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
