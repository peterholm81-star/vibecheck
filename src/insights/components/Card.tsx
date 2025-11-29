import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerRight?: ReactNode;
}

export function Card({ title, subtitle, children, className = '', headerRight }: CardProps) {
  return (
    <div
      className={`
        bg-white/5 
        border border-white/5 
        rounded-2xl 
        shadow-lg 
        p-6
        backdrop-blur-sm
        hover:bg-white/[0.07]
        transition-all duration-150
        ${className}
      `}
    >
      {(title || headerRight) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

