import React from 'react';
import { StreakStats } from '../types';
import { Flame, Award, TrendingUp } from 'lucide-react';

interface ConsistencyMindscapeProps {
  stats: StreakStats;
}

export const ConsistencyMindscape: React.FC<ConsistencyMindscapeProps> = ({ stats }) => {
  // Generate the last 28 days activity matrix (4 weeks x 7 days)
  const daysMatrix = React.useMemo(() => {
    const days: { dateStr: string; isActive: boolean; dayName: string }[] = [];
    const today = new Date();

    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const isActive = stats.activeDates.includes(dateStr);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      days.push({ dateStr, isActive, dayName });
    }
    return days;
  }, [stats.activeDates]);

  return (
    <div className="bg-emerald-600 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-full border border-emerald-500/40">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-200 fill-amber-200" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">
              Current Streak
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-700/60 rounded-full text-emerald-100">
            {stats.totalEntries} Total {stats.totalEntries === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <p className="text-3xl font-black tracking-tight">{stats.currentStreak} Days</p>
          <span className="text-xs font-semibold text-emerald-200">
            (Best: {stats.longestStreak}d)
          </span>
        </div>

        {/* Code-rendered Mindscape 4-week SVG Heatmap */}
        <div className="bg-emerald-700/50 p-3 rounded-2xl border border-emerald-500/40 mb-3">
          <p className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wider mb-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Consistency Mindscape</span>
          </p>
          <div className="grid grid-cols-7 gap-1.5 justify-items-center">
            {daysMatrix.map((item, idx) => (
              <div
                key={idx}
                title={`${item.dateStr}: ${item.isActive ? 'Reflected' : 'No reflection'}`}
                className={`w-4 h-4 rounded-md transition-all ${
                  item.isActive
                    ? 'bg-white shadow-sm scale-105'
                    : 'bg-emerald-800/60 border border-emerald-600/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between pt-1 border-t border-emerald-500/40">
        <div className="flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5 text-amber-200" />
          <span className="text-xs font-semibold text-emerald-50">
            Consistency: Top {100 - stats.consistencyPercentile}%
          </span>
        </div>
        <div className="flex gap-1 items-end">
          <div className="w-1.5 h-3 bg-white/40 rounded-full"></div>
          <div className="w-1.5 h-5 bg-white/70 rounded-full"></div>
          <div className="w-1.5 h-7 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
};
