import React, { useState, useEffect } from 'react';
import { JournalInteraction, WrappedReport } from '../types';
import { Sparkles, X, Quote, Compass, Award, RefreshCw } from 'lucide-react';

interface JournalWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  interactions: JournalInteraction[];
}

export const JournalWrappedModal: React.FC<JournalWrappedModalProps> = ({
  isOpen,
  onClose,
  interactions,
}) => {
  const [loading, setLoading] = useState(false);
  const [wrappedData, setWrappedData] = useState<WrappedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !wrappedData && interactions.length > 0) {
      generateWrapped();
    }
  }, [isOpen]);

  const generateWrapped = async () => {
    try {
      setLoading(true);
      setError(null);

      const { authedFetch } = await import('../firebase');
      const res = await authedFetch('/api/gemini/wrap', {
        entries: interactions,
        periodName: 'Recent Reflections',
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not generate Journal Wrapped.');
      }

      setWrappedData(json.data);
    } catch (err: any) {
      console.error('Wrapped error:', err);
      setError(err?.message || 'Failed to synthesize Wrapped report.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-700 rounded-2xl flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Journal Wrapped</h2>
              <p className="text-xs text-indigo-200">Grounded Multi-Entry AI Synthesis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-grow flex flex-col gap-5 bg-slate-50">
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
              <p className="font-bold text-slate-800 text-sm">Synthesizing your journal journey...</p>
              <p className="text-xs text-slate-500 mt-1">
                Gemini is analyzing themes, habits, and mindset shifts across your entries.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={generateWrapped}
                className="font-bold underline ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {wrappedData && !loading && (
            <div className="flex flex-col gap-4">
              {/* Headline Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1 block">
                  {wrappedData.periodTitle}
                </span>
                <h3 className="text-xl font-black text-slate-900 leading-snug">
                  {wrappedData.headline}
                </h3>
              </div>

              {/* Golden Quote */}
              {wrappedData.goldenQuote && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-3 items-start">
                  <Quote className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-indigo-900 italic">
                      "{wrappedData.goldenQuote}"
                    </p>
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider mt-1 block">
                      Core Reflection Takeaway
                    </span>
                  </div>
                </div>
              )}

              {/* Grid: Themes & Mindset */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Themes */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Top Themes
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {wrappedData.topThemes?.map((theme, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-lg"
                      >
                        #{theme}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Dominant Mood */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dominant Vibe
                  </p>
                  <p className="text-lg font-bold text-slate-800">{wrappedData.dominantMood}</p>
                </div>
              </div>

              {/* Deep Insights */}
              {wrappedData.deepInsights && wrappedData.deepInsights.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Behavioral Insights</span>
                  </p>
                  <ul className="space-y-2">
                    {wrappedData.deepInsights.map((insight, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Period Focus */}
              {wrappedData.nextPeriodFocus && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                  <Compass className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Next Step Intention
                    </p>
                    <p className="text-xs text-emerald-900 font-medium mt-0.5">
                      {wrappedData.nextPeriodFocus}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
