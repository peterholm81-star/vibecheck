import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
}

export function SectionHeader({ title, subtitle, rightContent }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {rightContent && <div>{rightContent}</div>}
    </div>
  );
}

