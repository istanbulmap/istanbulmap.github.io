/**
 * Refines a suggestion's coordinates through the geocoder when it is added.
 *
 * The curated coordinates in data/istanbulPlaces.ts are close but approximate.
 * When online we ask the geocoder for the place and take the result NEAREST to
 * the curated point - but only if it is within MAX_REFINE_KM. A geocoder match
 * further away is more likely a different branch / namesake than a better fix,
 * so we ignore it. Offline, slow (> timeout) or no match: the curated point is used.
 */
import { LatLng } from '../types';
import { searchPlaces } from './geocoder';
import { haversineKm } from './routing';

export const MAX_REFINE_KM = 1.5;

export interface ResolvablePlace { name: string; area: string; position: LatLng }

/** "Çiya Sofrası (Kadıköy)" -> "Çiya Sofrası": parentheses confuse the geocoder. */
const cleanName = (n: string) => n.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

export async function resolvePlacePosition(place: ResolvablePlace, timeoutMs = 4000): Promise<LatLng> {
  try {
    const query = `${cleanName(place.name)}, ${place.area}, Istanbul`;
    const results = await Promise.race([
      searchPlaces(query),
      new Promise<[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ]);
    let best: LatLng | null = null;
    let bestKm = Infinity;
    for (const r of results) {
      if (!isFinite(r.position.lat) || !isFinite(r.position.lng)) continue;
      const d = haversineKm(place.position, r.position);
      if (d < bestKm) { bestKm = d; best = r.position; }
    }
    return best && bestKm <= MAX_REFINE_KM ? best : place.position;
  } catch {
    return place.position;
  }
}
