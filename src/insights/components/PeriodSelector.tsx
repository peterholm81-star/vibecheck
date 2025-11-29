interface PeriodSelectorProps {
  value: '7d' | '30d' | '90d';
  onChange: (period: '7d' | '30d' | '90d') => void;
  size?: 'sm' | 'md';
}

export function PeriodSelector({ value, onChange, size = 'md' }: PeriodSelectorProps) {
  const periods: ('7d' | '30d' | '90d')[] = ['7d', '30d', '90d'];
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-xs' 
    : 'px-3 py-1.5 text-sm';

  return (
    <div className="flex gap-1 bg-white/5 rounded-lg p-1">
      {periods.map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`
            ${sizeClasses}
            rounded-md font-medium transition-all
            ${value === period
              ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          {period}
        </button>
      ))}
    </div>
  );
}

