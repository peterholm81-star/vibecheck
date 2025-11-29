/**
 * DemographicsSection - Premium demographic cards for Insights Dashboard
 * Shows age, relationship status, intent, and vibe category distributions
 * All values depend on timeRange and selectedVenueId
 */

interface DemographicsSectionProps {
  timeRange: number;
  selectedVenueId: string;
}

// Generate pseudo-random based on seed
function seededRandom(seed: number, offset: number = 0): number {
  const x = Math.sin(seed * 9999 + offset * 123) * 10000;
  return x - Math.floor(x);
}

// Horizontal bar component
function HorizontalBar({ 
  label, 
  value, 
  maxValue, 
  color 
}: { 
  label: string; 
  value: number; 
  maxValue: number; 
  color: string;
}) {
  const percentage = (value / maxValue) * 100;
  
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-medium text-slate-400">{value}%</span>
      </div>
      <div className="h-2 bg-[#1a1b2b] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Mini donut chart placeholder
function DonutChart({ 
  segments, 
  colors 
}: { 
  segments: number[]; 
  colors: string[];
}) {
  const total = segments.reduce((a, b) => a + b, 0);
  let currentAngle = 0;

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      {segments.map((value, index) => {
        const angle = (value / total) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle += angle;

        const startRad = (startAngle - 90) * (Math.PI / 180);
        const endRad = (endAngle - 90) * (Math.PI / 180);

        const x1 = 50 + 35 * Math.cos(startRad);
        const y1 = 50 + 35 * Math.sin(startRad);
        const x2 = 50 + 35 * Math.cos(endRad);
        const y2 = 50 + 35 * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        return (
          <path
            key={index}
            d={`M 50 50 L ${x1} ${y1} A 35 35 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={colors[index]}
            className="hover:opacity-80 transition-opacity"
          />
        );
      })}
      {/* Inner circle for donut effect */}
      <circle cx="50" cy="50" r="20" fill="#11121b" />
    </svg>
  );
}

// Demographic card component
function DemoCard({ 
  title, 
  subtitle, 
  children 
}: { 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#11121b] border border-neutral-800/50 rounded-2xl p-6 hover:border-neutral-700/50 transition-all">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-white">{title}</h4>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Generate demographic data based on timeRange and venueId
function generateDemographicData(timeRange: number, venueId: string) {
  const seed = venueId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Time range affects variance slightly
  const timeVariance = timeRange / 30;
  
  // Age distribution (varies by venue)
  const ageBase = [
    { label: '18-24', baseValue: 25 },
    { label: '25-30', baseValue: 32 },
    { label: '31-35', baseValue: 22 },
    { label: '36-40', baseValue: 12 },
    { label: '40+', baseValue: 9 },
  ];
  
  const ageData = ageBase.map((item, i) => ({
    label: item.label,
    value: Math.max(3, Math.round(item.baseValue + (seededRandom(seed, i) * 10 - 5) * timeVariance)),
    color: ['bg-violet-500', 'bg-violet-400', 'bg-violet-300', 'bg-violet-200', 'bg-violet-100'][i],
  }));
  
  // Normalize age data to sum to 100
  const ageSum = ageData.reduce((sum, d) => sum + d.value, 0);
  ageData.forEach(d => d.value = Math.round((d.value / ageSum) * 100));
  
  // Relationship status
  const singleBase = 55 + Math.round(seededRandom(seed, 10) * 20);
  const relationshipBase = Math.round((100 - singleBase) * 0.75);
  const complicatedBase = 100 - singleBase - relationshipBase;
  
  const relationshipData = [
    { label: 'Single', value: singleBase, color: 'bg-pink-500' },
    { label: 'I forhold', value: relationshipBase, color: 'bg-pink-400' },
    { label: 'Komplisert', value: complicatedBase, color: 'bg-pink-300' },
  ];
  
  // Intent distribution
  const intentBase = [
    { label: 'Party', baseValue: 35 + seededRandom(seed, 20) * 15 },
    { label: 'Chill', baseValue: 22 + seededRandom(seed, 21) * 10 },
    { label: 'Date night', baseValue: 15 + seededRandom(seed, 22) * 10 },
    { label: 'Med venner', baseValue: 18 + seededRandom(seed, 23) * 8 },
    { label: 'Solo', baseValue: 3 + seededRandom(seed, 24) * 5 },
  ];
  
  const intentSum = intentBase.reduce((sum, d) => sum + d.baseValue, 0);
  const intentData = intentBase.map((item, i) => ({
    label: item.label,
    value: Math.round((item.baseValue / intentSum) * 100),
    color: ['bg-orange-500', 'bg-orange-400', 'bg-orange-300', 'bg-orange-200', 'bg-orange-100'][i],
  }));
  
  // Vibe distribution
  const vibeBase = [
    { label: '🔥 Hot', baseValue: 35 + seededRandom(seed, 30) * 20 },
    { label: '✨ Good', baseValue: 30 + seededRandom(seed, 31) * 15 },
    { label: '👍 OK', baseValue: 18 + seededRandom(seed, 32) * 10 },
    { label: '😴 Quiet', baseValue: 5 + seededRandom(seed, 33) * 8 },
  ];
  
  const vibeSum = vibeBase.reduce((sum, d) => sum + d.baseValue, 0);
  const vibeData = vibeBase.map((item, i) => ({
    label: item.label,
    value: Math.round((item.baseValue / vibeSum) * 100),
    color: ['bg-sky-500', 'bg-sky-400', 'bg-sky-300', 'bg-sky-200'][i],
  }));
  
  // ONS intent data
  const onsJa = Math.round(35 + seededRandom(seed, 40) * 20);
  const onsKanskje = Math.round(25 + seededRandom(seed, 41) * 15);
  const onsNei = 100 - onsJa - onsKanskje;
  
  const onsData = [
    { label: 'Ja', value: onsJa, color: 'bg-pink-500' },
    { label: 'Kanskje', value: onsKanskje, color: 'bg-orange-400' },
    { label: 'Nei', value: onsNei, color: 'bg-slate-400' },
  ];
  
  return { ageData, relationshipData, intentData, vibeData, onsData };
}

export default function DemographicsSection({ timeRange, selectedVenueId }: DemographicsSectionProps) {
  const { ageData, relationshipData, intentData, vibeData, onsData } = generateDemographicData(timeRange, selectedVenueId);

  const maxRelationship = Math.max(...relationshipData.map(d => d.value));
  const maxIntent = Math.max(...intentData.map(d => d.value));
  const maxVibe = Math.max(...vibeData.map(d => d.value));
  const maxOns = Math.max(...onsData.map(d => d.value));

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Demografi</h2>
        <span className="text-xs text-[#a8a8b5]">Siste {timeRange} dager</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Age Distribution */}
        <DemoCard title="Aldersfordeling" subtitle="Hvem er her">
          <div className="flex items-center gap-6">
            <DonutChart 
              segments={ageData.map(d => d.value)} 
              colors={['#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff']}
            />
            <div className="flex-1">
              {ageData.slice(0, 3).map((item) => (
                <div key={item.label} className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <span className="text-xs font-medium text-slate-300 ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </DemoCard>

        {/* Relationship Status */}
        <DemoCard title="Sivilstatus" subtitle="Single vs. opptatt">
          {relationshipData.map((item) => (
            <HorizontalBar 
              key={item.label}
              label={item.label}
              value={item.value}
              maxValue={maxRelationship}
              color={item.color}
            />
          ))}
        </DemoCard>

        {/* ONS Intent */}
        <DemoCard title="One night stand" subtitle="Åpenhet for ONS">
          {onsData.map((item) => (
            <HorizontalBar 
              key={item.label}
              label={item.label}
              value={item.value}
              maxValue={maxOns}
              color={item.color}
            />
          ))}
        </DemoCard>

        {/* Intent Distribution */}
        <DemoCard title="Hva folk vil" subtitle="Intensjon">
          {intentData.map((item) => (
            <HorizontalBar 
              key={item.label}
              label={item.label}
              value={item.value}
              maxValue={maxIntent}
              color={item.color}
            />
          ))}
        </DemoCard>

        {/* Vibe Categories */}
        <DemoCard title="Vibe-fordeling" subtitle="Stemning">
          {vibeData.map((item) => (
            <HorizontalBar 
              key={item.label}
              label={item.label}
              value={item.value}
              maxValue={maxVibe}
              color={item.color}
            />
          ))}
        </DemoCard>
      </div>
    </section>
  );
}
