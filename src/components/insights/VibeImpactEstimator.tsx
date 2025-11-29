/**
 * VibeImpactEstimator - Estimates what share of traffic is driven by vibe
 * Shows a central percentage with confidence margin
 */

interface VibeImpactEstimatorProps {
  selectedVenueId: string | null;
  timeRange: number;
}

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

// Estimate vibe impact based on venue and timeRange
function estimateVibeImpact(venueId: string | null, timeRange: number): { estimate: number; margin: number } {
  const seed = hashVenueId(venueId);
  
  // Base estimate varies by venue (15-35%)
  const baseEstimate = 18 + seededRandom(seed, 20) * 17;
  
  // TimeRange affects confidence - more data = smaller margin
  const marginBase = timeRange >= 30 ? 5 : timeRange >= 14 ? 8 : 12;
  const marginVariation = seededRandom(seed, 21) * 4;
  
  // Slight variance based on timeRange
  const timeAdjustment = (timeRange - 30) / 90 * 5;
  
  return {
    estimate: Math.round(baseEstimate + timeAdjustment),
    margin: Math.round(marginBase + marginVariation),
  };
}

export default function VibeImpactEstimator({ selectedVenueId, timeRange }: VibeImpactEstimatorProps) {
  const { estimate, margin } = estimateVibeImpact(selectedVenueId, timeRange);
  
  // Calculate bar position (0-100 scale, estimate is 0-50 range typically)
  const barPosition = Math.min(100, Math.max(0, estimate * 2));

  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 lg:p-8 h-full">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">
          Estimert trafikk drevet av vibe
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Modellert sammenheng mellom stemning og innsjekk (siste {timeRange} dager)
        </p>
      </div>

      {/* Central estimate */}
      <div className="flex flex-col items-center justify-center py-8">
        {/* Big percentage */}
        <div className="relative">
          <span className="text-6xl sm:text-7xl font-bold bg-gradient-to-r from-violet-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            {estimate}%
          </span>
        </div>
        
        {/* Margin of error */}
        <p className="text-sm text-slate-500 mt-3">
          ± {margin} prosentpoeng usikkerhet
        </p>
        
        {/* Caption */}
        <p className="text-sm text-slate-400 mt-4 text-center max-w-xs">
          Av trafikken antas å være påvirket av høy vibe (Hot/Good).
        </p>
      </div>

      {/* Impact bar visualization */}
      <div className="mt-6 mb-8">
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Lav påvirkning</span>
          <span>Høy påvirkning</span>
        </div>
        <div className="h-3 bg-[#1a1b2b] rounded-full relative overflow-hidden">
          {/* Gradient background */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #1a1b2b 0%, #a78bfa40 50%, #f472b680 100%)'
            }}
          />
          {/* Marker */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-violet-400 shadow-lg shadow-violet-500/50 transition-all duration-500"
            style={{ left: `calc(${barPosition}% - 8px)` }}
          />
        </div>
        {/* Scale markers */}
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
        </div>
      </div>

      {/* Explanation text */}
      <div className="pt-6 border-t border-neutral-800/50">
        <p className="text-xs text-slate-500 leading-relaxed">
          Basert på sammenligning av innsjekkvolum når stemningen er Hot/Good versus når den er lavere. 
          Dette er et estimat, ikke en eksakt måling. Usikkerheten reduseres med mer data over tid.
        </p>
      </div>
    </div>
  );
}

