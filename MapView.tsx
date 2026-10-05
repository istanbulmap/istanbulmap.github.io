import { useRef } from 'react';
import L from 'leaflet';
import { LatLng, Pin, TransportMode } from '../../types';
import {
  METRO_STATIONS, TRAM_STOPS, BUS_HUBS, FERRY_TERMINALS,
  nearestPoint, buildTransitWaypoints,
} from '../../utils/transitWaypoints';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PIN_COLORS: Record<string, string> = {
  blue: '#4f4ef1', red: '#f43f5e', green: '#22c55e',
  yellow: '#f59e0b', purple: '#8b5cf6', orange: '#f97316',
};

function createPinIcon(color: string, isFavorite: boolean): L.DivIcon {
  const hex = PIN_COLORS[color] ?? PIN_COLORS.blue;
  return L.divIcon({
    className: '', iconAnchor: [14, 36], popupAnchor: [0, -38],
    html: `<div style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7));">
      <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" width="28" height="36">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 5.036 2.662 9.45 6.65 11.938L14 36l7.35-10.062C25.338 23.45 28 19.036 28 14 28 6.268 21.732 0 14 0z" fill="${hex}"/>
        <circle cx="14" cy="14" r="6" fill="white" opacity="0.92"/>
        ${isFavorite
          ? `<path d="M14 10.5l1 2.1 2.3.3-1.65 1.6.4 2.35L14 15.7l-2.05 1.15.4-2.35L10.7 12.9l2.3-.3z" fill="${hex}"/>`
          : `<circle cx="14" cy="14" r="2.5" fill="${hex}" opacity="0.7"/>`}
      </svg></div>`,
  });
}

function createEndpointIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '', iconAnchor: [16, 40], popupAnchor: [0, -42],
    html: `<div style="filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));cursor:grab;">
      <svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" width="32" height="42">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 9.6 16 26 16 26s16-16.4 16-26C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="11" fill="rgba(0,0,0,0.22)"/>
        <text x="16" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="white">${label}</text>
      </svg></div>`,
  });
}

type RouteStyle = {
  color: string; weight: number; opacity: number;
  dashArray?: string; lineCap?: L.LineCapShape; lineJoin?: L.LineJoinShape;
};

const MODE_STYLE: Record<TransportMode, RouteStyle> = {
  walking:   { color: '#22c55e', weight: 5,  opacity: 0.95, dashArray: '8 11', lineCap: 'round',  lineJoin: 'round' },
  car:       { color: '#f43f5e', weight: 4,  opacity: 0.90, lineCap: 'round',  lineJoin: 'round' },
  metro:     { color: '#818cf8', weight: 6,  opacity: 0.95, lineCap: 'round',  lineJoin: 'round' },
  tram:      { color: '#fbbf24', weight: 4,  opacity: 0.90, dashArray: '14 5', lineCap: 'square', lineJoin: 'round' },
  bus:       { color: '#fb923c', weight: 4,  opacity: 0.88, lineCap: 'round',  lineJoin: 'round' },
  ferry:     { color: '#06b6d4', weight: 4,  opacity: 0.85, dashArray: '8 10', lineCap: 'round',  lineJoin: 'round' },
  funicular: { color: '#c084fc', weight: 3,  opacity: 0.85, dashArray: '3 7',  lineCap: 'round',  lineJoin: 'round' },
};

function isValid(p: LatLng): boolean {
  return p != null && isFinite(p.lat) && isFinite(p.lng);
}

function lngLatToLeaflet(coords: [number, number][]): L.LatLngExpression[] {
  return coords.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
}

// ── Google Encoded Polyline decoder (used by Valhalla) ────────────────────────
function decodePolyline(encoded: string, precision = 6): L.LatLngExpression[] {
  const factor = Math.pow(10, precision);
  const pts: L.LatLngExpression[] = [];
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

// ── Pedestrian routing — three-provider chain ─────────────────────────────────
//
// OSRM's public demo `foot` profile routes along OSM roads even when a
// pedestrian shortcut exists nearby, because it uses a shared graph that
// doesn't properly weight footways over road edges.
//
// Provider chain (each tried in order):
//   1. Valhalla on valhalla1.openstreetmap.de — true pedestrian costing,
//      strongly prefers footways/paths/steps over road edges.
//   2. OSM Foundation OSRM foot instance on routing.openstreetmap.de —
//      separate foot-only graph with alleyway and park-path coverage.
//   3. Public OSRM demo foot — last resort.

interface OSRMResp {
  code: string;
  routes: Array<{ geometry: { coordinates: [number, number][] } }>;
}

async function fetchPedestrian(
  from: LatLng, to: LatLng, signal: AbortSignal,
): Promise<L.LatLngExpression[] | null> {

  // 1. Valhalla ──────────────────────────────────────────────────────────────
  try {
    const json = JSON.stringify({
      locations: [{ lon: from.lng, lat: from.lat }, { lon: to.lng, lat: to.lat }],
      costing: 'pedestrian',
      costing_options: {
        pedestrian: {
          use_roads: 0.1,
          walkway_factor: 0.9,
          alley_factor: 1.0,
          driveway_factor: 5.0,
          step_penalty: 30,
        },
      },
      directions_options: { units: 'km' },
    });
    const res = await fetch(
      `https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(json)}`,
      { signal },
    );
    if (res.ok) {
      const data = await res.json() as { trip?: { legs?: Array<{ shape: string }> } };
      const shape = data?.trip?.legs?.[0]?.shape;
      if (shape) return decodePolyline(shape);
    }
  } catch { if (signal.aborted) return null; }

  // 2. OSM OSRM foot ─────────────────────────────────────────────────────────
  try {
    const c = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${c}?overview=full&geometries=geojson`,
      { signal },
    );
    if (res.ok) {
      const data = await res.json() as OSRMResp;
      if (data.code === 'Ok' && data.routes[0])
        return lngLatToLeaflet(data.routes[0].geometry.coordinates);
    }
  } catch { if (signal.aborted) return null; }

  // 3. Public OSRM foot ──────────────────────────────────────────────────────
  try {
    const c = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/foot/${c}?overview=full&geometries=geojson`,
      { signal },
    );
    if (res.ok) {
      const data = await res.json() as OSRMResp;
      if (data.code === 'Ok' && data.routes[0])
        return lngLatToLeaflet(data.routes[0].geometry.coordinates);
    }
  } catch { /* ignore */ }

  return null;
}

// ── Car/transit: OSRM driving ─────────────────────────────────────────────────
async function fetchDriving(
  waypoints: LatLng[], signal: AbortSignal,
): Promise<L.LatLngExpression[] | null> {
  const valid = waypoints.filter(isValid);
  if (valid.length < 2) return null;
  const c = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${c}?overview=full&geometries=geojson`,
      { signal },
    );
    if (!res.ok) return null;
    const data = await res.json() as OSRMResp;
    if (data.code !== 'Ok' || !data.routes[0]) return null;
    return lngLatToLeaflet(data.routes[0].geometry.coordinates);
  } catch { return null; }
}

// ── Geometry builder ──────────────────────────────────────────────────────────
async function buildGeometry(
  from: LatLng, to: LatLng, mode: TransportMode, signal: AbortSignal,
): Promise<L.LatLngExpression[][]> {
  if (!isValid(from) || !isValid(to))
    return [[[from?.lat ?? 0, from?.lng ?? 0], [to?.lat ?? 0, to?.lng ?? 0]]];
  const fb: L.LatLngExpression[][] = [[[from.lat, from.lng], [to.lat, to.lng]]];

  switch (mode) {
    case 'walking':
    case 'funicular': {
      const pts = await fetchPedestrian(from, to, signal);
      return pts ? [pts] : fb;
    }
    case 'car': {
      const pts = await fetchDriving([from, to], signal);
      return pts ? [pts] : fb;
    }
    case 'bus': {
      const hubs = buildTransitWaypoints(from, to, BUS_HUBS, 3).filter(isValid);
      const pts  = await fetchDriving([from, ...hubs, to], signal);
      return pts ? [pts] : fb;
    }
    case 'tram': {
      const stops = buildTransitWaypoints(from, to, TRAM_STOPS, 4).filter(isValid);
      const pts   = await fetchDriving([from, ...stops, to], signal);
      return pts ? [pts] : fb;
    }
    case 'metro': {
      const sts = buildTransitWaypoints(from, to, METRO_STATIONS, 4).filter(isValid);
      if (sts.length < 2) { const pts = await fetchPedestrian(from, to, signal); return pts ? [pts] : fb; }
      const entry = sts[0], exit = sts[sts.length - 1];
      const [wi, wo] = await Promise.all([
        fetchPedestrian(from, entry, signal),
        fetchPedestrian(exit, to,   signal),
      ]);
      const ug: L.LatLngExpression[] = [
        [entry.lat, entry.lng],
        ...sts.slice(1, -1).map((s): L.LatLngExpression => [s.lat, s.lng]),
        [exit.lat, exit.lng],
      ];
      const segs: L.LatLngExpression[][] = [];
      if (wi) segs.push(wi);
      segs.push(ug);
      if (wo) segs.push(wo);
      return segs.length ? segs : fb;
    }
    case 'ferry': {
      const ft = nearestPoint(from, FERRY_TERMINALS);
      const tt = nearestPoint(to,   FERRY_TERMINALS);
      if (!isValid(ft) || !isValid(tt)) return fb;
      const [wi, wo] = await Promise.all([
        fetchPedestrian(from, ft, signal),
        fetchPedestrian(tt,   to, signal),
      ]);
      const segs: L.LatLngExpression[][] = [];
      if (wi) segs.push(wi);
      segs.push([[ft.lat, ft.lng], [tt.lat, tt.lng]]);
      if (wo) segs.push(wo);
      return segs.length ? segs : fb;
    }
  }
}

let currentAbort: AbortController | null = null;

// ── MapView class ─────────────────────────────────────────────────────────────
export class MapView {
  private map:        L.Map | null = null;
  private pinLayers:  Map<string, L.Marker> = new Map();
  private routeLayer: L.LayerGroup | null = null;
  private fromMarker: L.Marker | null = null;
  private toMarker:   L.Marker | null = null;

  onFromDragEnd: ((pos: LatLng) => void) | null = null;
  onToDragEnd:   ((pos: LatLng) => void) | null = null;

  init(container: HTMLElement, center: LatLng, zoom: number): L.Map {
    if (this.map) return this.map;
    this.map = L.map(container, {
      center: [center.lat, center.lng], zoom,
      zoomControl: false, tap: false, tapTolerance: 10,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc', maxZoom: 19,
    }).addTo(this.map);
    const tp = this.map.getPane('tilePane');
    if (tp) tp.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.55) contrast(1.1)';
    this.routeLayer = L.layerGroup().addTo(this.map);
    return this.map;
  }

  destroy() {
    currentAbort?.abort();
    this.map?.remove(); this.map = null;
    this.pinLayers.clear();
    this.fromMarker = null; this.toMarker = null;
  }

  getMap(): L.Map | null { return this.map; }

  invalidateSize() {
    if (!this.map) return;
    this.map.invalidateSize({ animate: false });
    requestAnimationFrame(() => { this.map?.invalidateSize({ animate: false }); });
  }

  syncPins(pins: Pin[], onPinClick: (id: string) => void, onPinUpdate: (id: string, pos: LatLng) => void) {
    if (!this.map) return;
    const ids = new Set(pins.map((p) => p.id));
    this.pinLayers.forEach((m, id) => { if (!ids.has(id)) { m.remove(); this.pinLayers.delete(id); } });
    pins.forEach((pin) => {
      const icon = createPinIcon(pin.color, pin.isFavorite);
      const ll   = [pin.position.lat, pin.position.lng] as L.LatLngExpression;
      const ex   = this.pinLayers.get(pin.id);
      if (ex) { ex.setLatLng(ll); ex.setIcon(icon); ex.setPopupContent(this.popupHtml(pin)); return; }
      const m = L.marker(ll, { icon, draggable: true })
        .bindPopup(this.popupHtml(pin), { className: 'dark-popup', maxWidth: 220 })
        .addTo(this.map!);
      const sp = (e: L.LeafletEvent) => L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);
      m.on('click', sp); m.on('dblclick', sp);
      m.on('click', () => onPinClick(pin.id));
      m.on('dragend', () => { const p = m.getLatLng(); onPinUpdate(pin.id, { lat: p.lat, lng: p.lng }); });
      this.pinLayers.set(pin.id, m);
    });
  }

  private popupHtml(pin: Pin): string {
    return `<div style="font-family:'Space Grotesk',sans-serif;min-width:140px;">
      <div style="font-weight:600;font-size:14px;color:#e9e4da;margin-bottom:4px">${pin.label}</div>
      ${pin.note ? `<div style="font-size:12px;color:#9a9d95;line-height:1.5">${pin.note}</div>` : ''}
      <div style="font-size:10px;color:#6d727b;margin-top:5px;font-family:'JetBrains Mono',monospace">${new Date(pin.createdAt).toLocaleDateString()}</div>
    </div>`;
  }

  setRouteMarkers(from: LatLng | null, to: LatLng | null) {
    if (!this.map) return;
    this.fromMarker?.remove(); this.fromMarker = null;
    this.toMarker?.remove();   this.toMarker   = null;
    const sp = (e: L.LeafletEvent) => L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);
    if (from && isValid(from)) {
      this.fromMarker = L.marker([from.lat, from.lng], {
        icon: createEndpointIcon('A', '#2dd4bf'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.fromMarker.on('click', sp); this.fromMarker.on('dblclick', sp);
      this.fromMarker.on('dragend', () => { const ll = this.fromMarker!.getLatLng(); this.onFromDragEnd?.({ lat: ll.lat, lng: ll.lng }); });
    }
    if (to && isValid(to)) {
      this.toMarker = L.marker([to.lat, to.lng], {
        icon: createEndpointIcon('B', '#f59e0b'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.toMarker.on('click', sp); this.toMarker.on('dblclick', sp);
      this.toMarker.on('dragend', () => { const ll = this.toMarker!.getLatLng(); this.onToDragEnd?.({ lat: ll.lat, lng: ll.lng }); });
    }
  }

  async drawRouteReal(from: LatLng, to: LatLng, mode: TransportMode): Promise<void> {
    if (!this.map || !this.routeLayer) return;
    if (!isValid(from) || !isValid(to)) return;
    currentAbort?.abort();
    currentAbort = new AbortController();
    const { signal } = currentAbort;
    this.routeLayer.clearLayers();
    const style = MODE_STYLE[mode];
    try {
      const segments = await buildGeometry(from, to, mode, signal);
      if (signal.aborted || !this.map || !this.routeLayer) return;
      const bounds: L.LatLngExpression[] = [];
      segments.forEach((coords, idx) => {
        const isWalk = (mode === 'metro' || mode === 'ferry') && (idx === 0 || idx === segments.length - 1) && segments.length > 1;
        const s: RouteStyle = isWalk
          ? { color: '#22c55e', weight: 2.5, opacity: 0.7, dashArray: '4 7', lineCap: 'round', lineJoin: 'round' }
          : style;
        this.routeLayer!.addLayer(L.polyline(coords, {
          color: s.color, weight: s.weight, opacity: s.opacity,
          dashArray: s.dashArray, lineCap: s.lineCap ?? 'round', lineJoin: s.lineJoin ?? 'round',
        }));
        bounds.push(...coords);
      });
      if (bounds.length > 1)
        this.map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [60, 60], maxZoom: 16, animate: true });
    } catch {
      if (signal.aborted || !this.map || !this.routeLayer) return;
      this.routeLayer.addLayer(L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: style.color, weight: style.weight, opacity: 0.5, dashArray: '8 12' }));
    }
  }

  clearRoute() { currentAbort?.abort(); currentAbort = null; this.routeLayer?.clearLayers(); }

  flyTo(center: LatLng, zoom?: number) {
    if (!this.map || !isValid(center)) return;
    const c = this.map.getContainer();
    if (!c || c.clientWidth === 0 || c.clientHeight === 0) return;
    this.map.flyTo([center.lat, center.lng], zoom ?? this.map.getZoom(), { duration: 0.9, easeLinearity: 0.5 });
  }
}

export function useMapView() {
  const ref = useRef<MapView>(new MapView());
  return ref.current;
}

export default MapView;
