// Renders a small interactive Google Map with a single pin for a located entry.
// Loads the Maps JS API on demand (once), using the referrer-restricted client key.
import React, { useEffect, useRef, useState } from 'react';
import type { EntryLocation } from '../types';
import { MapPin } from 'lucide-react';

const MAPS_KEY = import.meta.env.VITE_MAPS_API_KEY as string;

// Load the Maps JS script once, shared across component instances.
let mapsPromise: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('no window');
  if ((window as any).google?.maps) return Promise.resolve();
  if (!mapsPromise) {
    mapsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Google Maps.'));
      document.head.appendChild(s);
    });
  }
  return mapsPromise;
}

interface Props {
  location: EntryLocation;
}

export const EntryLocationMap: React.FC<Props> = ({ location }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = (window as any).google;
        const map = new g.maps.Map(ref.current, {
          center: { lat: location.lat, lng: location.lng },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
        });
        new g.maps.Marker({ position: { lat: location.lat, lng: location.lng }, map });
      })
      .catch(() => !cancelled && setErr(true));
    return () => { cancelled = true; };
  }, [location.lat, location.lng]);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100">
        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-xs font-semibold text-slate-700 truncate">{location.label}</span>
      </div>
      {err ? (
        <div className="p-3 text-xs text-slate-500">
          {location.lat}, {location.lng}
        </div>
      ) : (
        <div ref={ref} className="w-full h-32" />
      )}
    </div>
  );
};
