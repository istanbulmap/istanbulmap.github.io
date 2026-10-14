/**
 * Walking-route provider chain.
 *
 * WHY THIS EXISTS
 * The OSRM HTTP API documents that the {profile} segment of the URL is
 * "determined statically by the Lua profile used to prepare the data". A server
 * that loaded car data answers /route/v1/foot/... with a CAR route. That is
 * what router.project-osrm.org does, so it is never used for walking.
 *
 * Providers, in order (all return real pedestrian routes):
 *   1. Valhalla "pedestrian" costing  (valhalla1.openstreetmap.de, FOSSGIS)
 *   2. OSRM foot-only instance        (routing.openstreetmap.de/routed-foot)
 *   3. Overpass OSM data + in-browser A* (src/utils/pedestrianRouter.ts)
 *
 * WATER
 * Pedestrian routers treat ferries as walkable. A "walk" from Bakirkoy to
 * Kadikoy would therefore come back as a straight line across the Marmara Sea.
 * We ask Valhalla to avoid ferries, then reject any result that still contains
 * a ferry leg (explicit marker) or a suspiciously long unbroken segment. When
 * the only way across is by water we report "water" - no walking route exists.
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

/** What happened when we tried to find a walking route. */
export type WalkOutcome =
  | { kind: 'ok'; result: WalkResult }
  | { kind: 'water' }        // routers answered, but every route needs a ferry / water crossing
  | { kind: 'unreachable' }; // no routing engine could be reached

/** Status of the last route draw, shown in the route panel. */
export interface RouteInfo {
  mode: TransportMode;
  status: 'loading' | 'ok' | 'failed' | 'no-route';
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

// ── Water detection ───────────────────────────────────────────────────────────
/** Longest gap allowed between two consecutive points of a *walking* path. */
export const MAX_WALK_GAP_M = 1500;
/** Looser limit used when the engine DID give explicit ferry information and reported none. */
export const MAX_WALK_GAP_STRUCTURED_M = 4000;

/**
 * A real footpath has a vertex at least every few hundred metres (junctions,
 * bends). A multi-kilometre straight edge is a ferry line, not a street.
 * Safety net for engines that don't flag ferry legs explicitly.
 */
export function hasLongGap(pts: Pt[], maxGapM = MAX_WALK_GAP_M): boolean {
  for (let i = 1; i < pts.length; i++) {
    if (haversineM(pts[i - 1], pts[i]) > maxGapM) return true;
  }
  return false;
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
/** A route as returned by one engine, before the water check. */
interface Candidate {
  points: Pt[];
  /** the engine explicitly marked part of the route as a ferry */
  ferry: boolean;
  /** the engine returned per-leg detail (maneuvers / steps), so `ferry` is trustworthy */
  structured: boolean;
}

// Valhalla maneuver types (proto/directions.proto): kFerryEnter = 28, kFerryExit = 29
const VALHALLA_FERRY_ENTER = 28;
const VALHALLA_FERRY_EXIT = 29;

async function viaValhalla(from: Pt, to: Pt, signal: AbortSignal): Promise<Candidate | null> {
  const json = JSON.stringify({
    locations: [{ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }],
    costing: 'pedestrian',
    costing_options: {
      pedestrian: {
        walkway_factor: 0.8, sidewalk_factor: 0.9, driveway_factor: 3,
        use_ferry: 0, // pedestrians can't walk on water: avoid ferries (0 = avoid, not a hard ban)
      },
    },
    directions_options: { units: 'km' },
  });
  const data = await getJSON<{
    trip?: { legs?: Array<{ shape: string; maneuvers?: Array<{ type?: number }> }> };
  }>(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(json)}`, signal, 9000, 'Valhalla');
  const leg = data?.trip?.legs?.[0];
  if (!leg?.shape) return null;
  const points = decodePolyline(leg.shape, 6);
  if (!valid(points)) return null;
  const maneuvers = leg.maneuvers ?? [];
  const ferry = maneuvers.some((m) => m.type === VALHALLA_FERRY_ENTER || m.type === VALHALLA_FERRY_EXIT);
  return { points, ferry, structured: maneuvers.length > 0 };
}

async function viaOsrmFoot(from: Pt, to: Pt, signal: AbortSignal): Promise<Candidate | null> {
  // The "routed-foot" instance only contains the foot profile; the profile name
  // in the path is ignored by osrm-routed (same URL shape the osm.org site uses).
  // steps=true lets us see which parts of the route are ferry legs (step.mode).
  const c = `${from[1]},${from[0]};${to[1]},${to[0]}`;
  const data = await getJSON<{
    code: string;
    routes: Array<{
      geometry: { coordinates: [number, number][] };
      legs?: Array<{ steps?: Array<{ mode?: string }> }>;
    }>;
  }>(
    `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${c}?overview=full&geometries=geojson&steps=true`,
    signal, 9000, 'OSRM routed-foot');
  if (!data || data.code !== 'Ok' || !data.routes[0]) return null;
  const route = data.routes[0];
  const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as Pt);
  if (!valid(points)) return null;
  const steps = (route.legs ?? []).flatMap((l) => l.steps ?? []);
  const ferry = steps.some((st) => st.mode === 'ferry');
  return { points, ferry, structured: steps.length > 0 };
}

async function viaLocalOsm(from: Pt, to: Pt, signal: AbortSignal): Promise<Candidate | null> {
  const t = withTimeout(signal, 40000);
  try {
    const points = await routeWithOverpass(from, to, t.signal);
    // The local graph only contains highway ways - it can never contain a ferry.
    return valid(points) ? { points, ferry: false, structured: true } : null;
  } catch (err) {
    if (!signal.aborted) console.warn('[walk] local OSM router failed:', err);
    return null;
  } finally { t.done(); }
}

// ── Public API ────────────────────────────────────────────────────────────────
const cache = new Map<string, WalkResult>();
const waterPairs = new Set<string>();
const key = (a: Pt, b: Pt) => `${a[0].toFixed(5)},${a[1].toFixed(5)}|${b[0].toFixed(5)},${b[1].toFixed(5)}`;

export async function routeWalking(
  fromLL: { lat: number; lng: number }, toLL: { lat: number; lng: number }, signal: AbortSignal,
): Promise<WalkOutcome> {
  const from: Pt = [fromLL.lat, fromLL.lng];
  const to: Pt = [toLL.lat, toLL.lng];
  if (haversineM(from, to) < 5) return { kind: 'unreachable' };

  const k = key(from, to);
  const hit = cache.get(k);
  if (hit) return { kind: 'ok', result: hit };
  if (waterPairs.has(k)) return { kind: 'water' };

  const chain: Array<[WalkEngine, (a: Pt, b: Pt, s: AbortSignal) => Promise<Candidate | null>]> = [
    ['valhalla', viaValhalla],
    ['osrm-foot', viaOsrmFoot],
    ['osm-local', viaLocalOsm],
  ];

  let sawWater = false;
  for (const [engine, run] of chain) {
    if (signal.aborted) return { kind: 'unreachable' };
    const cand = await run(from, to, signal);
    if (!cand) continue;

    // The local OSM graph contains highway ways only (no ferries), so the long-edge
    // check is only needed for the engines that can return ferry legs.
    const gapLimit = cand.structured ? MAX_WALK_GAP_STRUCTURED_M : MAX_WALK_GAP_M;
    const water = cand.ferry || (engine !== 'osm-local' && hasLongGap(cand.points, gapLimit));
    if (water) {
      sawWater = true;
      console.warn(`[walk] ${engine}: the only route needs a ferry / water crossing`);
      // Valhalla was told to avoid ferries and still needs one: that is the
      // answer. The other engines would only repeat it, so stop here.
      if (engine === 'valhalla') break;
      continue; // otherwise let the next engine (e.g. the land-only local router) try
    }

    const result: WalkResult = { points: cand.points, engine, distanceKm: pathLengthM(cand.points) / 1000 };
    cache.set(k, result);
    if (cache.size > 60) cache.delete(cache.keys().next().value as string);
    return { kind: 'ok', result };
  }

  if (sawWater) {
    waterPairs.add(k);
    if (waterPairs.size > 60) waterPairs.delete(waterPairs.values().next().value as string);
    return { kind: 'water' };
  }
  console.warn('[walk] no pedestrian engine could produce a route');
  return { kind: 'unreachable' };
}

/** Convenience for callers that only want a usable route or nothing (e.g. metro access legs). */
export async function fetchWalkingRoute(
  from: { lat: number; lng: number }, to: { lat: number; lng: number }, signal: AbortSignal,
): Promise<WalkResult | null> {
  const o = await routeWalking(from, to, signal);
  return o.kind === 'ok' ? o.result : null;
}
