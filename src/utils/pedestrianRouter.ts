/**
 * In-browser pedestrian router built on raw OpenStreetMap data.
 *
 * Last-resort engine for walking routes: it downloads every walkable way in a
 * bounding box from Overpass (footways, paths, steps, pedestrian zones, alleys,
 * residential streets...) and runs A* on that graph. Because it uses the full
 * foot network it takes the shortcuts a car cannot: stairs, passages, park
 * paths, pedestrian-only streets. Motorways/trunks and foot=no ways are excluded.
 */

export type Pt = [number, number]; // [lat, lng]

interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}
export interface OverpassData { elements: OverpassElement[] }

export interface Graph {
  coords: Map<number, Pt>;
  adj: Map<number, Array<[number, number]>>; // nodeId -> [neighbourId, cost(m)]
}

// ── Geometry ──────────────────────────────────────────────────────────────────
export function haversineM(a: Pt, b: Pt): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function pathLengthM(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversineM(pts[i - 1], pts[i]);
  return d;
}

// ── Walkability rules ─────────────────────────────────────────────────────────
// Cost multiplier per highway type (1 = neutral). Lower = preferred.
const FACTOR: Record<string, number> = {
  footway: 1, pedestrian: 1, path: 1, living_street: 1,
  residential: 1, unclassified: 1, service: 1.05, track: 1.1, road: 1.1,
  steps: 1.4,
  tertiary: 1.05, tertiary_link: 1.05,
  secondary: 1.12, secondary_link: 1.12,
  primary: 1.2, primary_link: 1.2,
  cycleway: 1.05,
};

/** Returns the cost multiplier for a way, or null if pedestrians can't use it. */
export function wayFactor(tags: Record<string, string> | undefined): number | null {
  if (!tags) return null;
  const hw = tags.highway;
  if (!hw || !(hw in FACTOR)) return null;

  const foot = tags.foot;
  const footOk = foot === 'yes' || foot === 'designated' || foot === 'permissive';
  if (foot === 'no') return null;
  if ((tags.access === 'no' || tags.access === 'private') && !footOk) return null;
  // Cycleways only count when foot traffic is explicitly allowed.
  if (hw === 'cycleway' && !footOk) return null;

  let f = FACTOR[hw];
  if (hw === 'service' && (tags.service === 'driveway' || tags.service === 'parking_aisle')) f = 1.3;
  return f;
}

// ── Graph construction ────────────────────────────────────────────────────────
export function buildGraph(data: OverpassData): Graph {
  const allNodes = new Map<number, Pt>();
  for (const el of data.elements) {
    if (el.type === 'node' && el.lat !== undefined && el.lon !== undefined) {
      allNodes.set(el.id, [el.lat, el.lon]);
    }
  }

  const coords = new Map<number, Pt>();
  const adj = new Map<number, Array<[number, number]>>();

  const link = (a: number, b: number, cost: number) => {
    let la = adj.get(a); if (!la) { la = []; adj.set(a, la); }
    let lb = adj.get(b); if (!lb) { lb = []; adj.set(b, lb); }
    la.push([b, cost]);
    lb.push([a, cost]);
  };

  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue;
    const factor = wayFactor(el.tags);
    if (factor === null) continue;
    for (let i = 1; i < el.nodes.length; i++) {
      const a = el.nodes[i - 1], b = el.nodes[i];
      const pa = allNodes.get(a), pb = allNodes.get(b);
      if (!pa || !pb) continue;
      coords.set(a, pa); coords.set(b, pb);
      link(a, b, haversineM(pa, pb) * factor);
    }
  }
  return { coords, adj };
}

export function nearestNode(g: Graph, p: Pt, maxM = 400): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (const id of g.adj.keys()) {
    const c = g.coords.get(id)!;
    // cheap reject before haversine
    if (Math.abs(c[0] - p[0]) > 0.01 || Math.abs(c[1] - p[1]) > 0.01) continue;
    const d = haversineM(c, p);
    if (d < bestD) { bestD = d; best = id; }
  }
  return bestD <= maxM ? best : null;
}

// ── A* with a binary min-heap ─────────────────────────────────────────────────
class MinHeap {
  private a: Array<[number, number]> = []; // [priority, nodeId]
  get size() { return this.a.length; }
  push(p: number, id: number) {
    const a = this.a; a.push([p, id]);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]]; i = parent;
    }
  }
  pop(): [number, number] | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}

export function astar(g: Graph, start: number, goal: number): number[] | null {
  const goalPt = g.coords.get(goal)!;
  const gScore = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const closed = new Set<number>();
  const open = new MinHeap();
  open.push(haversineM(g.coords.get(start)!, goalPt), start);

  while (open.size) {
    const [, cur] = open.pop()!;
    if (cur === goal) {
      const path = [cur];
      let n = cur;
      while (prev.has(n)) { n = prev.get(n)!; path.push(n); }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    const gc = gScore.get(cur)!;
    for (const [nb, cost] of g.adj.get(cur) ?? []) {
      if (closed.has(nb)) continue;
      const tentative = gc + cost;
      if (tentative < (gScore.get(nb) ?? Infinity)) {
        gScore.set(nb, tentative);
        prev.set(nb, cur);
        // factors are >= 1, so straight-line distance never overestimates
        open.push(tentative + haversineM(g.coords.get(nb)!, goalPt), nb);
      }
    }
  }
  return null;
}

/** Route between two arbitrary points over a built graph. */
export function routeOnGraph(g: Graph, from: Pt, to: Pt): Pt[] | null {
  const s = nearestNode(g, from);
  const t = nearestNode(g, to);
  if (s === null || t === null) return null;
  const ids = s === t ? [s] : astar(g, s, t);
  if (!ids) return null;
  const pts: Pt[] = ids.map((id) => g.coords.get(id)!);
  // connect the exact clicked points to the snapped network
  if (haversineM(from, pts[0]) > 1) pts.unshift(from);
  if (haversineM(to, pts[pts.length - 1]) > 1) pts.push(to);
  return pts;
}

// ── Overpass download ─────────────────────────────────────────────────────────
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export function buildOverpassQuery(s: number, w: number, n: number, e: number): string {
  const bb = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;
  return `[out:json][timeout:25];
way["highway"]["highway"!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway|bus_guideway|bridleway|corridor|elevator|platform)$"]["foot"!="no"](${bb})->.w;
.w out body qt;
node(w.w);
out skel qt;`;
}

export async function fetchOverpass(
  bbox: [number, number, number, number], signal: AbortSignal,
): Promise<OverpassData | null> {
  const query = buildOverpassQuery(...bbox);
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal,
      });
      if (!res.ok) { console.warn(`[walk] Overpass ${url} -> HTTP ${res.status}`); continue; }
      const data = await res.json() as OverpassData;
      if (data?.elements?.length) return data;
    } catch (err) {
      if (signal.aborted) return null;
      console.warn(`[walk] Overpass ${url} failed:`, err);
    }
  }
  return null;
}

/** Full pipeline: download OSM footpaths around the two points, then A*. */
export async function routeWithOverpass(
  from: Pt, to: Pt, signal: AbortSignal,
): Promise<Pt[] | null> {
  const straight = haversineM(from, to);
  if (straight > 8000) return null; // too large for an in-browser graph

  for (const pad of [0.004, 0.012]) { // ~450 m, then ~1.3 km of slack
    const s = Math.min(from[0], to[0]) - pad, n = Math.max(from[0], to[0]) + pad;
    const w = Math.min(from[1], to[1]) - pad, e = Math.max(from[1], to[1]) + pad;
    const data = await fetchOverpass([s, w, n, e], signal);
    if (!data) return null;
    const route = routeOnGraph(buildGraph(data), from, to);
    if (route) return route;
    if (signal.aborted) return null;
  }
  return null;
}
