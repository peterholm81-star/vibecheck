import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card } from './Card';
import type { ActivityPoint } from '../api/insightsData';

interface ActivityLineChartProps {
  data?: ActivityPoint[];
  loading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  // Format date label
  const formattedDate = label ? new Date(label).toLocaleDateString('nb-NO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) : '';

  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-slate-400 text-xs mb-1">{formattedDate}</p>
      <p className="text-cyan-300 font-bold text-lg">{payload[0].value} besøk</p>
    </div>
  );
}

export function ActivityLineChart({ data, loading = false }: ActivityLineChartProps) {
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

  const hasData = chartData.length > 0 && chartData.some(d => d.visits > 0);

  return (
    <Card
      title="Aktivitet over tid"
      subtitle="Antall besøk per dag"
    >
      <div className="h-[300px] mt-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-slate-400">Laster data...</div>
          </div>
        ) : !hasData ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400">Ingen aktivitet i valgt periode</p>
              <p className="text-slate-500 text-sm mt-1">Prøv en lengre periode</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22D3EE" />
                  <stop offset="100%" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              
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
                width={40}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Line
                type="monotone"
                dataKey="visits"
                stroke="url(#lineGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: '#22D3EE',
                  stroke: '#0B1020',
                  strokeWidth: 2,
                }}
                filter="url(#glow)"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
