import { useState } from 'react';
import { Clock, ChevronDown, X } from 'lucide-react';
import type { TimeWindow } from '../types';

// ============================================
// MOBILE TIME RANGE PICKER
// A compact chip that opens a bottom sheet to
// select time range (60/120/180 minutes).
// ============================================

interface MobileTimeRangePickerProps {
  timeWindowMinutes: TimeWindow;
  setTimeWindowMinutes: (value: TimeWindow) => void;
}

const TIME_OPTIONS: TimeWindow[] = [60, 120, 180];

export function MobileTimeRangePicker({
  timeWindowMinutes,
  setTimeWindowMinutes,
}: MobileTimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (value: TimeWindow) => {
    setTimeWindowMinutes(value);
    setIsOpen(false);
  };

  return (
    <>
      {/* Compact chip button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-full bg-slate-700/80 border border-slate-600 text-slate-300 hover:border-slate-500 transition-all active:scale-95"
      >
        <Clock size={14} className="text-violet-400" />
        <span className="text-xs font-medium">Tidsrom: {timeWindowMinutes} min</span>
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {/* Bottom sheet overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          {/* Bottom sheet */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl shadow-xl border-t border-slate-700 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock size={16} className="text-violet-400" />
                Velg tidsrom
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            <div className="p-4 space-y-2">
              {TIME_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  className={`w-full min-h-[52px] px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between ${
                    timeWindowMinutes === value
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 active:bg-slate-700'
                  }`}
                >
                  <span>Siste {value} minutter</span>
                  {timeWindowMinutes === value && (
                    <span className="text-violet-200">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* Safe area padding for iOS */}
            <div className="h-6" />
          </div>
        </div>
      )}
    </>
  );
}

