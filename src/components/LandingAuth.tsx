import React, { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import { Sparkles, Shield, Lock, Brain, Flame, ArrowRight, CheckCircle2 } from 'lucide-react';

export const LandingAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setAuthError(err?.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans text-slate-900">
      {/* Top Banner */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <div className="w-4 h-4 bg-white rounded-sm rotate-45"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Reflection.ai</span>
        </div>

        <button
          id="nav-google-signin-btn"
          onClick={handleSignIn}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
        >
          {loading ? 'Authenticating...' : 'Sign in with Google'}
        </button>
      </header>

      {/* Main Hero & Bento Showcase */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-grow flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grounded Personal RAG & Intelligence</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-4 leading-tight">
            Your private second brain that <span className="text-indigo-600">knows you</span> & keeps you accountable.
          </h1>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            Write uninhibited thoughts, unpack complex decisions, and converse with Gemini. Every interaction is strictly isolated in Cloud Firestore under per-user ABAC rules.
          </p>

          {authError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {authError}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="hero-google-signin-btn"
              onClick={handleSignIn}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-base shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all hover:translate-y-[-1px] active:scale-[0.99]"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{loading ? 'Signing In...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Bento Grid Visual Cards Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Bento Card 1: Multi-turn Reflections */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">Grounded Multi-Turn Chat</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Discuss blockers, unpack emotions, or plan habits with Gemini. The model adapts to your personal context across entries.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Multi-model Fallback Ladder (3.6-flash)</span>
            </div>
          </div>

          {/* Bento Card 2: Firestore ABAC Isolation */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">Per-User Data Isolation</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Entries are stored strictly under <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">/users/&#123;userId&#125;</code> and protected by Firestore Security Rules.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-600">
              <Lock className="w-4 h-4" />
              <span>Zero Cross-User Visibility</span>
            </div>
          </div>

          {/* Bento Card 3: Consistency Mindscape */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">Habit Streak Mindscape</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Celebrate your journaling habit with code-rendered heatmaps, streak analytics, and weekly Journal Wrapped recaps.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-amber-600">
              <Sparkles className="w-4 h-4" />
              <span>Personalized Synthesis & Insights</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-200 text-center text-xs text-slate-500 bg-white">
        Protected by Firebase Authentication & Firestore Security Rules • Powered by Gemini
      </footer>
    </div>
  );
};
