/**
 * Walking-route provider chain.
 *
 * WHY THIS EXISTS
 * The OSRM HTTP API documents that the {profile} segment of the URL is
 * "determined statically by the Lua profile used to prepare the data". A server
 * that loaded car data answers /route/v1/foot/... with a CAR route. That is
 * what router.project-osrm.org does, so using it as a "foot" fallback silently
 * produced driving routes labelled as walking. It is never used here.
 *
 * Providers, in order (all return real pedestrian routes):
 *   1. Valhalla "pedestrian" costing  (valhalla1.openstreetmap.de, FOSSGIS)
 *   2. OSRM foot-only instance        (routing.openstreetmap.de/routed-foot)
 *   3. Overpass OSM data + in-browser A* (src/utils/pedestrianRouter.ts)
 *
 * If all three fail the caller gets null and must say so - never draw a
 * car route as a walking route.
 */
import { TransportMode } from '../types';
import { Pt, haversineM, pathLengthM, routeWithOverpass } from './pedestrianRouter';

export type WalkEngine = 'valhalla' | 'osrm-foot' | 'osm-local';

export const ENGINE_LABEL: Record<WalkEngine, string> = {
  'valhalla':  'Valhalla pedestrian',
  'osrm-foot': 'OSRM foot',
  'osm-local': 'OSM footpaths',
};

export interface WalkResult {
  points: Pt[];
  engine: WalkEngine;
  distanceKm: number;
}

/** Status of the last route draw, shown in the route panel. */
export interface RouteInfo {
  mode: TransportMode;
  status: 'loading' | 'ok' | 'failed';
  engine?: WalkEngine;
  distanceKm?: number;
  durationMin?: number;
}

const WALK_KMH = 4.8;
export const walkMinutes = (km: number) => Math.max(1, Math.round((km / WALK_KMH) * 60));

// ── Polyline decoder (Valhalla returns Google-encoded polyline, precision 6) ──
export function decodePolyline(encoded: string, precision = 6): Pt[] {
  const factor = Math.pow(10, precision);
  const pts: Pt[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b: number, shift = 0, res = 0;
    do { b = encoded.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (res & 1) ? ~(res >> 1) : (res >> 1);
    shift = 0; res = 0;
    do { b = encoded.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (res & 1) ? ~(res >> 1) : (res >> 1);
    pts.push([lat / factor, lng / factor]);
  }
  return pts;
}

// ── Small helpers ─────────────────────────────────────────────────────────────
/** Abort signal that fires when the parent aborts OR the timeout elapses. */
function withTimeout(parent: AbortSignal, ms: number) {
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (parent.aborted) c.abort(); else parent.addEventListener('abort', onAbort, { once: true });
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => { clearTimeout(t); parent.removeEventListener('abort', onAbort); } };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

// FOSSGIS asks for at most ~1 request/second. Space our calls out.
let nextSlot = 0;
async function fossgisSlot(signal: AbortSignal) {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await sleep(wait, signal);
}

async function getJSON<T>(url: string, parent: AbortSignal, ms: number, tag: string): Promise<T | null> {
  const t = withTimeout(parent, ms);
  try {
    await fossgisSlot(parent);
    const res = await fetch(url, { signal: t.signal });
    if (!res.ok) { console.warn(`[walk] ${tag} -> HTTP ${res.status}`); return null; }
    return await res.json() as T;
  } catch (err) {
    if (!parent.aborted) console.warn(`[walk] ${tag} failed:`, err);
    return null;
  } finally { t.done(); }
}

const valid = (pts: Pt[] | null): pts is Pt[] =>
  !!pts && pts.length >= 2 && pts.every((p) => isFinite(p[0]) && isFinite(p[1]));

// ── Providers ─────────────────────────────────────────────────────────────────
async function viaValhalla(from: Pt, to: Pt, signal: AbortSignal): Promise<Pt[] | null> {
  const json = JSON.stringify({
    locations: [{ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }],
    costing: 'pedestrian',
    costing_options: { pedestrian: { walkway_factor: 0.8, sidewalk_factor: 0.9, driveway_factor: 3 } },
    directions_options: { units: 'km' },
  });
  const data = await getJSON<{ trip?: { legs?: Array<{ shape: string }> } }>(
    `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(json)}`, signal, 9000, 'Valhalla');
  const shape = data?.trip?.legs?.[0]?.shape;
  if (!shape) return null;
  const pts = decodePolyline(shape, 6);
  return valid(pts) ? pts : null;
}

async function viaOsrmFoot(from: Pt, to: Pt, signal: AbortSignal): Promise<Pt[] | null> {
  // The "routed-foot" instance only contains the foot profile; the profile name
  // in the path is ignored by osrm-routed (same URL shape the osm.org site uses).
  const c = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const data = await getJSON<{ code: string; routes: Array<{ geometry: { coordinates: [number, number][] } }> }>(
    `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${c}?overview=full&geometries=geojson`,
    signal, 9000, 'OSRM routed-foot');
  if (!data || data.code !== 'Ok' || !data.routes[0]) return null;
  const pts = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng] as Pt);
  return valid(pts) ? pts : null;
}

async function viaLocalOsm(from: Pt, to: Pt, signal: AbortSignal): Promise<Pt[] | null> {
  const t = withTimeout(signal, 40000);
  try {
    const pts = await routeWithOverpass(from, to, t.signal);
    return valid(pts) ? pts : null;
  } catch (err) {
    if (!signal.aborted) console.warn('[walk] local OSM router failed:', err);
    return null;
  } finally { t.done(); }
}

// ── Public API ────────────────────────────────────────────────────────────────
const cache = new Map<string, WalkResult>();
const key = (a: Pt, b: Pt) => `${a[0].toFixed(5)},${a[1].toFixed(5)}|${b[0].toFixed(5)},${b[1].toFixed(5)}`;

export async function fetchWalkingRoute(
  fromLL: { lat: number; lng: number }, toLL: { lat: number; lng: number }, signal: AbortSignal,
): Promise<WalkResult | null> {
  const from: Pt = [fromLL.lat, fromLL.lng];
  const to: Pt = [toLL.lat, toLL.lng];
  if (haversineM(from, to) < 5) return null;

  const k = key(from, to);
  const hit = cache.get(k);
  if (hit) return hit;

  const chain: Array<[WalkEngine, (a: Pt, b: Pt, s: AbortSignal) => Promise<Pt[] | null>]> = [
    ['valhalla', viaValhalla],
    ['osrm-foot', viaOsrmFoot],
    ['osm-local', viaLocalOsm],
  ];

  for (const [engine, run] of chain) {
    if (signal.aborted) return null;
    const points = await run(from, to, signal);
    if (points) {
      const result: WalkResult = { points, engine, distanceKm: pathLengthM(points) / 1000 };
      cache.set(k, result);
      if (cache.size > 60) cache.delete(cache.keys().next().value as string);
      return result;
    }
  }
  console.warn('[walk] no pedestrian engine could produce a route');
  return null;
}
