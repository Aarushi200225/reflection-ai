import React from 'react';
import { ReflectionInsight } from '../types';
import { Sparkles, Lightbulb, Compass, Tag } from 'lucide-react';

interface GeminiInsightsProps {
  insights?: ReflectionInsight;
  isThinking: boolean;
}

export const GeminiInsights: React.FC<GeminiInsightsProps> = ({ insights, isThinking }) => {
  return (
    <div className="bg-indigo-950 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between h-full border border-indigo-900/50">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isThinking ? 'bg-amber-400 animate-ping' : 'bg-indigo-400 animate-pulse'}`}></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              Gemini Insights
            </span>
          </div>
          {insights?.mood && (
            <span className="px-2.5 py-0.5 bg-indigo-800/80 text-indigo-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {insights.mood}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Synthesis</span>
        </h2>

        {insights?.synthesis ? (
          <p className="text-indigo-100 text-sm leading-relaxed mb-5 italic opacity-95 bg-indigo-900/40 p-3.5 rounded-2xl border border-indigo-800/40">
            "{insights.synthesis}"
          </p>
        ) : (
          <p className="text-indigo-300/80 text-xs leading-relaxed mb-5 italic">
            {isThinking
              ? 'Analyzing reflection patterns and mindset indicators...'
              : 'Write your first journal reflection to generate personal synthesis and theme analysis.'}
          </p>
        )}

        {/* Actionable Prompt if available */}
        {insights?.actionablePrompt && (
          <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-indigo-100 flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-indigo-200 text-[10px] uppercase tracking-wider mb-0.5">Gentle Reflection Prompt</p>
              <p className="text-xs text-slate-200">{insights.actionablePrompt}</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Themes Section */}
      <div className="mt-auto pt-2">
        <div className="bg-white/10 p-4 rounded-2xl border border-white/10">
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 uppercase font-bold mb-2">
            <Tag className="w-3 h-3 text-indigo-400" />
            <span>Key Themes</span>
          </div>
          {insights?.keyThemes && insights.keyThemes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {insights.keyThemes.map((theme, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-white/15 text-indigo-100 rounded-lg text-xs font-medium backdrop-blur-sm"
                >
                  {theme}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-indigo-300/70">No themes extracted yet</span>
          )}
        </div>
      </div>
    </div>
  );
};
