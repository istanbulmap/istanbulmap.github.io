import { LatLng } from '../types';

export interface GeoResult {
  displayName: string;
  shortName: string;
  subName: string;
  position: LatLng;
}

// Bounding box to bias results toward Istanbul
const ISTANBUL_VIEWBOX = '28.0,40.8,29.6,41.4';

let lastCall = 0;
const THROTTLE_MS = 400;

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  if (!query || query.trim().length < 2) return [];

  // Throttle
  const now = Date.now();
  if (now - lastCall < THROTTLE_MS) return [];
  lastCall = now;

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '7',
      viewbox: ISTANBUL_VIEWBOX,
      bounded: '0',         // show Istanbul-biased but not bounded
      countrycodes: 'tr',   // bias to Turkey
      'accept-language': 'en',
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { 'User-Agent': 'IstanbulNavigator/1.0' } }
    );

    if (!res.ok) return [];

    const data = await res.json() as NominatimResult[];

    return data.map((r) => {
      const parts = r.display_name.split(', ');
      return {
        displayName: r.display_name,
        shortName: parts[0] ?? r.display_name,
        subName: parts.slice(1, 3).join(', '),
        position: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
      };
    });
  } catch {
    return [];
  }
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address: Record<string, string>;
}
