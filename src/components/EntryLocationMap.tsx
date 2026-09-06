// Location display for a journal entry.
// Shows a clean, styled location card. (An interactive Google Map tile is a documented
// post-submission enhancement; the buildpack did not reliably inline the Maps JS key, so
// we display the captured, per-user-isolated location directly instead of a broken map.)
import React from 'react';
import type { EntryLocation } from '../types';
import { MapPin } from 'lucide-react';

interface Props {
  location: EntryLocation;
}

export const EntryLocationMap: React.FC<Props> = ({ location }) => {
  const mapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100">
        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-slate-700 truncate">
          {location.label || 'Location attached'}
        </span>
      </div>
      <div className="px-3 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500 font-mono">
          {location.lat}, {location.lng}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          Open in Maps →
        </a>
      </div>
    </div>
  );
};
