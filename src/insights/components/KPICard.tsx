import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number | string;
  deltaLabel?: string;
  accentColor?: 'cyan' | 'indigo' | 'pink' | 'emerald';
  loading?: boolean;
}

export function KPICard({
  label,
  value,
  unit = '',
  delta,
  deltaLabel = 'vs forrige periode',
  accentColor = 'cyan',
  loading = false,
}: KPICardProps) {
  // Determine delta display
  const isPositive = typeof delta === 'number' ? delta > 0 : typeof delta === 'string' && delta.startsWith('+');
  const isNegative = typeof delta === 'number' ? delta < 0 : typeof delta === 'string' && delta.startsWith('-');
  const isNeutral = !isPositive && !isNegative;

  // Accent color classes
  const colorClasses = {
    cyan: 'text-cyan-300',
    indigo: 'text-indigo-300',
    pink: 'text-pink-300',
    emerald: 'text-emerald-300',
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/5 rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-20 bg-white/10 rounded mb-3" />
        <div className="h-8 w-16 bg-white/10 rounded mb-2" />
        <div className="h-3 w-24 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-5 hover:bg-white/[0.07] transition-all duration-150">
      <p className="text-sm font-medium text-slate-400 mb-2">{label}</p>
      
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${colorClasses[accentColor]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-lg text-slate-400">{unit}</span>
        )}
      </div>

      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-2">
          {isPositive && <TrendingUp size={14} className="text-emerald-400" />}
          {isNegative && <TrendingDown size={14} className="text-red-400" />}
          {isNeutral && <Minus size={14} className="text-slate-500" />}
          
          <span className={`text-sm font-medium ${
            isPositive ? 'text-emerald-400' :
            isNegative ? 'text-red-400' :
            'text-slate-500'
          }`}>
            {typeof delta === 'number' ? `${delta > 0 ? '+' : ''}${delta}%` : delta}
          </span>
          
          <span className="text-xs text-slate-500">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
