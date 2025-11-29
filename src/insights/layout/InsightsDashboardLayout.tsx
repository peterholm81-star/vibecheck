import type { ReactNode } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { PeriodSelector } from '../components/PeriodSelector';
import type { InsightsPeriod } from '../api/insightsData';

interface InsightsDashboardLayoutProps {
  children: ReactNode;
  venueName?: string;
  period: InsightsPeriod;
  onPeriodChange: (period: InsightsPeriod) => void;
  onBack?: () => void;
}

export function InsightsDashboardLayout({ 
  children, 
  venueName = 'Bakgården',
  period,
  onPeriodChange,
  onBack 
}: InsightsDashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0B1020]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#0B1020]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                  <BarChart3 size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-100">VibeCheck Insights</h1>
                  <p className="text-sm text-slate-400">{venueName}</p>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <PeriodSelector value={period} onChange={onPeriodChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
