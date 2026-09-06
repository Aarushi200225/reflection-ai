// Location capture + reverse-geocoding for journal entries.
// Uses the browser Geolocation API, then the Google Geocoding API to get a place label.
// The Maps key is a referrer-restricted client key (public by design; safe because it is
// locked to this app's domain). Location is sensitive personal data: capture is explicit
// (button-triggered, opt-in) and stored only under the user's isolated Firestore path.

import type { EntryLocation } from '../types';

const MAPS_KEY = import.meta.env.VITE_MAPS_API_KEY as string;

export async function captureLocation(): Promise<EntryLocation> {
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported in this browser.');
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
  });

  const lat = Number(pos.coords.latitude.toFixed(5));
  const lng = Number(pos.coords.longitude.toFixed(5));

  // Reverse-geocode to a human-readable label. Falls back to coords if it fails.
  let label = `${lat}, ${lng}`;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_KEY}`
    );
    const data = await res.json();
    if (data.status === 'OK' && data.results?.length) {
      // Prefer a concise locality-level label over the full formatted address.
      const r = data.results[0];
      label = r.formatted_address || label;
    }
  } catch {
    // keep the coord fallback
  }

  return { lat, lng, label };
}
