import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Card } from './Card';
import type { AgeDistribution, GenderDistribution, RelationshipDistribution } from '../api/insightsData';

// Age band colors
const AGE_COLORS = ['#22D3EE', '#6366F1', '#A78BFA', '#E879F9', '#F472B6'];

// Gender colors
const GENDER_COLORS: Record<string, string> = {
  male: '#60A5FA',
  female: '#F472B6',
  other: '#A78BFA',
};

interface DemographicPanelProps {
  ageDistribution?: AgeDistribution[];
  genderDistribution?: GenderDistribution[];
  relationshipDistribution?: RelationshipDistribution[];
  loading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-slate-100 font-medium text-sm">{payload[0].name}: {payload[0].value}%</p>
    </div>
  );
}

function AgeDistributionChart({ data }: { data: AgeDistribution[] }) {
  const hasData = data.some(d => d.percentage > 0);

  if (!hasData) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-500 text-sm">Ingen aldersdata tilgjengelig</p>
      </div>
    );
  }

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, 'dataMax']}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 10 }}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="percentage"
            radius={[0, 4, 4, 0]}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={AGE_COLORS[index % AGE_COLORS.length]} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GenderDistributionChart({ data }: { data: GenderDistribution[] }) {
  const hasData = data.some(d => d.percentage > 0);

  if (!hasData) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-500 text-sm">Ingen kjønnsdata tilgjengelig</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-[100px] h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={45}
              dataKey="percentage"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={GENDER_COLORS[entry.label] || '#A78BFA'} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.map((g) => (
          <div key={g.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: GENDER_COLORS[g.label] || '#A78BFA' }}
              />
              <span className="text-sm text-slate-400">{g.displayLabel}</span>
            </div>
            <span className="text-sm font-medium text-slate-200">{g.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationshipDistributionChart({ data }: { data: RelationshipDistribution[] }) {
  const hasData = data.some(d => d.percentage > 0);

  if (!hasData) {
    return (
      <div className="text-center py-4">
        <p className="text-slate-500 text-sm">Ingen sivilstatusdata tilgjengelig</p>
      </div>
    );
  }

  const colors = ['#F472B6', '#6366F1', '#94A3B8'];

  return (
    <div className="space-y-2">
      {data.filter(r => r.percentage > 0).map((r, index) => (
        <div key={r.label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-slate-400">{r.displayLabel}</span>
            <span className="text-sm font-medium text-slate-200">{r.percentage}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${r.percentage}%`,
                backgroundColor: colors[index % colors.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DemographicPanel({
  ageDistribution,
  genderDistribution,
  relationshipDistribution,
  loading = false,
}: DemographicPanelProps) {
  if (loading) {
    return (
      <Card title="Demografi" subtitle="Hvem besøker deg">
        <div className="space-y-6 mt-2 animate-pulse">
          <div className="h-32 bg-white/5 rounded-lg" />
          <div className="h-24 bg-white/5 rounded-lg" />
          <div className="h-16 bg-white/5 rounded-lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Demografi" subtitle="Hvem besøker deg">
      <div className="space-y-6 mt-2">
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Aldersfordeling</h4>
          {ageDistribution ? (
            <AgeDistributionChart data={ageDistribution} />
          ) : (
            <p className="text-slate-500 text-sm">Ingen data</p>
          )}
        </div>
        
        <div className="h-px bg-white/5" />
        
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Kjønnsfordeling</h4>
          {genderDistribution ? (
            <GenderDistributionChart data={genderDistribution} />
          ) : (
            <p className="text-slate-500 text-sm">Ingen data</p>
          )}
        </div>
        
        <div className="h-px bg-white/5" />
        
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Sivilstatus</h4>
          {relationshipDistribution ? (
            <RelationshipDistributionChart data={relationshipDistribution} />
          ) : (
            <p className="text-slate-500 text-sm">Ingen data</p>
          )}
        </div>
      </div>
    </Card>
  );
}
