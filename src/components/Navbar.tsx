import React from 'react';
import { User, signOut } from '../firebase';
import { Sparkles, LogOut, ShieldCheck, BookOpen } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onOpenWrapped: () => void;
  entriesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenWrapped, entriesCount }) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
          <div className="w-4 h-4 bg-white rounded-sm rotate-45 transform transition-transform hover:rotate-90 duration-300"></div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-slate-800">Reflection.ai</span>
            <span className="hidden sm:inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-semibold rounded-md border border-indigo-100">
              gemini-3.6-flash
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium hidden md:inline">Private & Grounded Second Brain</span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {entriesCount > 0 && (
          <button
            id="open-journal-wrapped-btn"
            onClick={onOpenWrapped}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Journal</span> Wrapped
          </button>
        )}

        {user && (
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-800">{user.displayName || 'Reflective Mind'}</span>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">ABAC Protected</span>
              </div>
            </div>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-9 h-9 rounded-full border-2 border-indigo-100 object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <button
              id="sign-out-btn"
              onClick={() => signOut()}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
