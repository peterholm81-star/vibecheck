import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card } from './Card';
import type { IntentPoint } from '../api/insightsData';

// Intent colors (neon-ish palette)
const INTENT_COLORS = {
  party: '#F472B6',      // Pink
  chill: '#22D3EE',      // Cyan
  date_night: '#C084FC', // Purple
  with_friends: '#34D399', // Emerald
  solo: '#FCD34D',       // Yellow
};

const INTENT_LABELS: Record<string, string> = {
  party: 'Party',
  chill: 'Chill',
  date_night: 'Date Night',
  with_friends: 'Med venner',
  solo: 'Solo',
};

interface IntentStackedChartProps {
  data?: IntentPoint[];
  loading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const formattedDate = label ? new Date(label).toLocaleDateString('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) : '';

  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-slate-400 text-xs mb-2 font-medium">{formattedDate}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-300 text-sm">
                {INTENT_LABELS[entry.dataKey]}
              </span>
            </div>
            <span className="text-slate-100 font-medium text-sm">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomLegend({ payload }: { payload?: Array<{ dataKey: string; color: string }> }) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400 text-sm">
            {INTENT_LABELS[entry.dataKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IntentStackedChart({ data, loading = false }: IntentStackedChartProps) {
  // Format dates for display
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((point) => ({
      ...point,
      displayDate: new Date(point.date).toLocaleDateString('nb-NO', { 
        day: '2-digit', 
        month: '2-digit' 
      }),
    }));
  }, [data]);

  const hasData = chartData.length > 0 && chartData.some(d => 
    d.party > 0 || d.chill > 0 || d.date_night > 0 || d.with_friends > 0 || d.solo > 0
  );

  return (
    <Card
      title="Stemningstrend"
      subtitle="Intent-fordeling over tid"
    >
      <div className="h-[300px] mt-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-slate-400">Laster data...</div>
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400">Ingen intent-data i valgt periode</p>
              <p className="text-slate-500 text-sm mt-1">Prøv en lengre periode</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />
              
              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 11 }}
                tickMargin={10}
                interval={Math.max(0, Math.floor(chartData.length / 7) - 1)}
              />
              
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 11 }}
                tickMargin={10}
                width={35}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend content={<CustomLegend />} />
              
              <Area
                type="monotone"
                dataKey="solo"
                stackId="1"
                stroke={INTENT_COLORS.solo}
                fill={INTENT_COLORS.solo}
                fillOpacity={0.8}
              />
              <Area
                type="monotone"
                dataKey="with_friends"
                stackId="1"
                stroke={INTENT_COLORS.with_friends}
                fill={INTENT_COLORS.with_friends}
                fillOpacity={0.8}
              />
              <Area
                type="monotone"
                dataKey="date_night"
                stackId="1"
                stroke={INTENT_COLORS.date_night}
                fill={INTENT_COLORS.date_night}
                fillOpacity={0.8}
              />
              <Area
                type="monotone"
                dataKey="chill"
                stackId="1"
                stroke={INTENT_COLORS.chill}
                fill={INTENT_COLORS.chill}
                fillOpacity={0.8}
              />
              <Area
                type="monotone"
                dataKey="party"
                stackId="1"
                stroke={INTENT_COLORS.party}
                fill={INTENT_COLORS.party}
                fillOpacity={0.8}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
