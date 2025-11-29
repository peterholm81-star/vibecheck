import { Card } from './Card';
import { Trophy, TrendingUp, Heart, Users } from 'lucide-react';
import type { ComparisonMetric } from '../api/insightsData';

interface ComparisonBarsProps {
  data?: ComparisonMetric[];
  loading?: boolean;
}

const METRIC_ICONS: Record<string, React.ComponentType<{ size: number; className?: string }>> = {
  'Aktivitet': TrendingUp,
  'Party-intensitet': Trophy,
  'Singlerate': Heart,
  '18–25 andel': Users,
};

const METRIC_COLORS: Record<string, string> = {
  'Aktivitet': '#22D3EE',
  'Party-intensitet': '#F472B6',
  'Singlerate': '#A78BFA',
  '18–25 andel': '#34D399',
};

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  
  if (!isTop3) {
    return (
      <span className="text-slate-400 font-medium">#{rank}</span>
    );
  }

  const colors: Record<number, string> = {
    1: 'from-yellow-400 to-amber-500 text-amber-900',
    2: 'from-slate-300 to-slate-400 text-slate-700',
    3: 'from-amber-600 to-amber-700 text-amber-100',
  };

  return (
    <div className={`
      w-8 h-8 rounded-lg 
      bg-gradient-to-br ${colors[rank]}
      flex items-center justify-center 
      font-bold text-sm
      shadow-lg
    `}>
      #{rank}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  rank: number;
  total: number;
  score: number;
}

function ComparisonRow({ label, rank, total, score }: ComparisonRowProps) {
  const Icon = METRIC_ICONS[label] || TrendingUp;
  const color = METRIC_COLORS[label] || '#22D3EE';

  return (
    <div className="flex items-center gap-4 py-3">
      {/* Icon */}
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={20} style={{ color }} />
      </div>

      {/* Label and rank badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-slate-200">{label}</span>
          <div className="flex items-center gap-2">
            <RankBadge rank={rank} />
            <span className="text-xs text-slate-500">av {total}</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${score * 100}%`,
              backgroundColor: color,
              boxShadow: `0 0 12px ${color}50`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ComparisonBars({ data, loading = false }: ComparisonBarsProps) {
  if (loading) {
    return (
      <Card title="Ranking i området" subtitle="Sammenlign med andre venues">
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/5 rounded w-32" />
                <div className="h-2 bg-white/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card title="Ranking i området" subtitle="Sammenlign med andre venues">
        <div className="text-center py-8">
          <p className="text-slate-400">Ingen sammenligningsdata tilgjengelig</p>
          <p className="text-slate-500 text-sm mt-1">Data vises når det er flere venues med aktivitet</p>
        </div>
      </Card>
    );
  }

  // Find best rankings for summary
  const bestRankings = data.filter(d => d.rank <= 3).sort((a, b) => a.rank - b.rank);

  return (
    <Card
      title="Ranking i området"
      subtitle="Sammenlign med andre venues i samme område"
    >
      <div className="divide-y divide-white/5">
        {data.map((item) => (
          <ComparisonRow
            key={item.label}
            label={item.label}
            rank={item.rank}
            total={item.total}
            score={item.score}
          />
        ))}
      </div>
      
      {/* Summary text */}
      {bestRankings.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-sm text-slate-400 text-center">
            {bestRankings.map((r, i) => (
              <span key={r.label}>
                {i > 0 && ' og '}
                <span className={`font-medium ${
                  r.rank === 1 ? 'text-yellow-300' :
                  r.rank === 2 ? 'text-slate-300' :
                  'text-amber-500'
                }`}>
                  #{r.rank}
                </span>
                {' på '}
                <span className="text-slate-300">{r.label.toLowerCase()}</span>
              </span>
            ))}
            {' i området!'}
          </p>
        </div>
      )}
    </Card>
  );
}
