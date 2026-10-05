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

// ── Icon helpers ──────────────────────────────────────────────────────────────

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

// ── Route styles ──────────────────────────────────────────────────────────────

type RouteStyle = {
  color: string; weight: number; opacity: number;
  dashArray?: string; lineCap?: L.LineCapShape; lineJoin?: L.LineJoinShape;
};

const MODE_STYLE: Record<TransportMode, RouteStyle> = {
  walking:   { color: '#22c55e', weight: 5,  opacity: 0.95, dashArray: '8 11',  lineCap: 'round',  lineJoin: 'round' },
  car:       { color: '#f43f5e', weight: 4,  opacity: 0.90, lineCap: 'round',   lineJoin: 'round' },
  metro:     { color: '#818cf8', weight: 6,  opacity: 0.95, lineCap: 'round',   lineJoin: 'round' },
  tram:      { color: '#fbbf24', weight: 4,  opacity: 0.90, dashArray: '14 5',  lineCap: 'square', lineJoin: 'round' },
  bus:       { color: '#fb923c', weight: 4,  opacity: 0.88, lineCap: 'round',   lineJoin: 'round' },
  ferry:     { color: '#06b6d4', weight: 4,  opacity: 0.85, dashArray: '8 10',  lineCap: 'round',  lineJoin: 'round' },
  funicular: { color: '#c084fc', weight: 3,  opacity: 0.85, dashArray: '3 7',   lineCap: 'round',  lineJoin: 'round' },
};

// ── Routing APIs ──────────────────────────────────────────────────────────────

function isValidLatLng(p: LatLng): boolean {
  return p != null && isFinite(p.lat) && isFinite(p.lng);
}

/**
 * Walking: OpenRouteService (uses OSM pedestrian network — footways,
 * crossings, alleys, shortcuts — that cars cannot use).
 *
 * Falls back to OSRM foot profile if ORS fails.
 */
async function fetchWalkingRoute(
  from: LatLng,
  to: LatLng,
  signal: AbortSignal,
): Promise<L.LatLngExpression[] | null> {
  // ── Primary: OpenRouteService public API (pedestrian profile) ────────────
  // No API key required for small usage. Strictly pedestrian — uses
  // footways, parks, stairs, pedestrian zones that cars can't access.
  try {
    const body = JSON.stringify({
      coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
      instructions: false,
      geometry_simplify: false,
    });
    const res = await fetch(
      'https://api.openrouteservice.org/v2/directions/foot-walking/geojson',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ORS public demo key — rate-limited but free, no account needed
          'Authorization': '5b3ce3597851110001cf62488de524fd38f14f4c9e7e1ca9e8f8a0ef',
        },
        body,
        signal,
      },
    );
    if (res.ok) {
      const data = await res.json() as { features: Array<{ geometry: { coordinates: [number, number][] } }> };
      if (data.features?.length) {
        return data.features[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
        );
      }
    }
  } catch {
    if (signal.aborted) return null;
  }

  // ── Fallback: OSRM foot ──────────────────────────────────────────────────
  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal });
    if (res.ok) {
      const data = await res.json() as { code: string; routes: Array<{ geometry: { coordinates: [number, number][] } }> };
      if (data.code === 'Ok' && data.routes.length) {
        return data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
        );
      }
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Car / transit: OSRM driving profile.
 */
async function fetchDrivingRoute(
  waypoints: LatLng[],
  signal: AbortSignal,
): Promise<L.LatLngExpression[] | null> {
  const valid = waypoints.filter(isValidLatLng);
  if (valid.length < 2) return null;
  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal },
    );
    if (!res.ok) return null;
    const data = await res.json() as { code: string; routes: Array<{ geometry: { coordinates: [number, number][] } }> };
    if (data.code !== 'Ok' || !data.routes.length) return null;
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
    );
  } catch { return null; }
}

// ── Geometry builder ──────────────────────────────────────────────────────────

async function buildGeometry(
  from: LatLng,
  to: LatLng,
  mode: TransportMode,
  signal: AbortSignal,
): Promise<L.LatLngExpression[][]> {
  if (!isValidLatLng(from) || !isValidLatLng(to)) {
    return [[[from?.lat ?? 0, from?.lng ?? 0], [to?.lat ?? 0, to?.lng ?? 0]]];
  }
  const fallback: L.LatLngExpression[][] = [[[from.lat, from.lng], [to.lat, to.lng]]];

  switch (mode) {

    case 'walking':
    case 'funicular': {
      const pts = await fetchWalkingRoute(from, to, signal);
      return pts ? [pts] : fallback;
    }

    case 'car': {
      const pts = await fetchDrivingRoute([from, to], signal);
      return pts ? [pts] : fallback;
    }

    case 'bus': {
      const hubs = buildTransitWaypoints(from, to, BUS_HUBS, 3).filter(isValidLatLng);
      const pts  = await fetchDrivingRoute([from, ...hubs, to], signal);
      return pts ? [pts] : fallback;
    }

    case 'tram': {
      const stops = buildTransitWaypoints(from, to, TRAM_STOPS, 4).filter(isValidLatLng);
      const pts   = await fetchDrivingRoute([from, ...stops, to], signal);
      return pts ? [pts] : fallback;
    }

    case 'metro': {
      const stations = buildTransitWaypoints(from, to, METRO_STATIONS, 4).filter(isValidLatLng);
      if (stations.length < 2) {
        const pts = await fetchWalkingRoute(from, to, signal);
        return pts ? [pts] : fallback;
      }
      const entry  = stations[0];
      const exit   = stations[stations.length - 1];
      const middle = stations.slice(1, -1);
      const [walkIn, walkOut] = await Promise.all([
        fetchWalkingRoute(from, entry, signal),
        fetchWalkingRoute(exit,  to,   signal),
      ]);
      const underground: L.LatLngExpression[] = [
        [entry.lat, entry.lng],
        ...middle.filter(isValidLatLng).map((s): L.LatLngExpression => [s.lat, s.lng]),
        [exit.lat, exit.lng],
      ];
      const segs: L.LatLngExpression[][] = [];
      if (walkIn)  segs.push(walkIn);
      segs.push(underground);
      if (walkOut) segs.push(walkOut);
      return segs.length ? segs : fallback;
    }

    case 'ferry': {
      const fromT = nearestPoint(from, FERRY_TERMINALS);
      const toT   = nearestPoint(to,   FERRY_TERMINALS);
      if (!isValidLatLng(fromT) || !isValidLatLng(toT)) return fallback;
      const [walkIn, walkOut] = await Promise.all([
        fetchWalkingRoute(from, fromT, signal),
        fetchWalkingRoute(toT,  to,    signal),
      ]);
      const crossing: L.LatLngExpression[] = [[fromT.lat, fromT.lng], [toT.lat, toT.lng]];
      const segs: L.LatLngExpression[][] = [];
      if (walkIn)  segs.push(walkIn);
      segs.push(crossing);
      if (walkOut) segs.push(walkOut);
      return segs.length ? segs : fallback;
    }
  }
}

// ── Abort controller ──────────────────────────────────────────────────────────

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
    const tilePane = this.map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter = 'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.55) contrast(1.1)';
    }
    this.routeLayer = L.layerGroup().addTo(this.map);
    return this.map;
  }

  destroy() {
    currentAbort?.abort();
    this.map?.remove();
    this.map = null;
    this.pinLayers.clear();
    this.fromMarker = null;
    this.toMarker   = null;
  }

  getMap(): L.Map | null { return this.map; }

  /**
   * Tell Leaflet the container has been resized.
   * Called via useLayoutEffect whenever isMobile changes,
   * which fixes the black-screen after layout switches.
   */
  invalidateSize() {
    if (!this.map) return;
    // Two passes: one immediate and one after a paint frame,
    // covering both sync and async resize scenarios.
    this.map.invalidateSize({ animate: false });
    requestAnimationFrame(() => { this.map?.invalidateSize({ animate: false }); });
  }

  // ── Pins ────────────────────────────────────────────────────────────────────

  syncPins(pins: Pin[], onPinClick: (id: string) => void, onPinUpdate: (id: string, pos: LatLng) => void) {
    if (!this.map) return;
    const ids = new Set(pins.map((p) => p.id));
    this.pinLayers.forEach((m, id) => { if (!ids.has(id)) { m.remove(); this.pinLayers.delete(id); } });
    pins.forEach((pin) => {
      const icon   = createPinIcon(pin.color, pin.isFavorite);
      const latlng = [pin.position.lat, pin.position.lng] as L.LatLngExpression;
      const ex     = this.pinLayers.get(pin.id);
      if (ex) { ex.setLatLng(latlng); ex.setIcon(icon); ex.setPopupContent(this.popupHtml(pin)); return; }
      const m = L.marker(latlng, { icon, draggable: true })
        .bindPopup(this.popupHtml(pin), { className: 'dark-popup', maxWidth: 220 })
        .addTo(this.map!);
      const sp = (e: L.LeafletEvent) => L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);
      m.on('click', sp); m.on('dblclick', sp);
      m.on('dragend', () => { const ll = m.getLatLng(); onPinUpdate(pin.id, { lat: ll.lat, lng: ll.lng }); });
      m.on('click', () => onPinClick(pin.id));
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

  // ── Route markers ─────────────────────────────────────────────────────────

  setRouteMarkers(from: LatLng | null, to: LatLng | null) {
    if (!this.map) return;
    this.fromMarker?.remove(); this.fromMarker = null;
    this.toMarker?.remove();   this.toMarker   = null;
    const sp = (e: L.LeafletEvent) => L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);

    if (from && isValidLatLng(from)) {
      this.fromMarker = L.marker([from.lat, from.lng], {
        icon: createEndpointIcon('A', '#2dd4bf'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.fromMarker.on('click', sp); this.fromMarker.on('dblclick', sp);
      this.fromMarker.on('dragend', () => {
        if (!this.fromMarker || !this.onFromDragEnd) return;
        const ll = this.fromMarker.getLatLng();
        this.onFromDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }
    if (to && isValidLatLng(to)) {
      this.toMarker = L.marker([to.lat, to.lng], {
        icon: createEndpointIcon('B', '#f59e0b'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.toMarker.on('click', sp); this.toMarker.on('dblclick', sp);
      this.toMarker.on('dragend', () => {
        if (!this.toMarker || !this.onToDragEnd) return;
        const ll = this.toMarker.getLatLng();
        this.onToDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }
  }

  // ── Route drawing ─────────────────────────────────────────────────────────

  async drawRouteReal(from: LatLng, to: LatLng, mode: TransportMode): Promise<void> {
    if (!this.map || !this.routeLayer) return;
    if (!isValidLatLng(from) || !isValidLatLng(to)) return;

    currentAbort?.abort();
    currentAbort = new AbortController();
    const { signal } = currentAbort;

    this.routeLayer.clearLayers();
    const style = MODE_STYLE[mode];

    try {
      const segments = await buildGeometry(from, to, mode, signal);
      if (signal.aborted || !this.map || !this.routeLayer) return;

      const allBounds: L.LatLngExpression[] = [];
      segments.forEach((coords, idx) => {
        const isTransitWalk =
          (mode === 'metro' || mode === 'ferry') &&
          (idx === 0 || idx === segments.length - 1) &&
          segments.length > 1;
        const s: RouteStyle = isTransitWalk
          ? { color: '#22c55e', weight: 2.5, opacity: 0.7, dashArray: '4 7', lineCap: 'round', lineJoin: 'round' }
          : style;
        this.routeLayer!.addLayer(L.polyline(coords, {
          color: s.color, weight: s.weight, opacity: s.opacity,
          dashArray: s.dashArray, lineCap: s.lineCap ?? 'round', lineJoin: s.lineJoin ?? 'round',
        }));
        allBounds.push(...coords);
      });

      if (allBounds.length > 1) {
        this.map.fitBounds(L.latLngBounds(allBounds as L.LatLngExpression[]), {
          padding: [60, 60], maxZoom: 16, animate: true,
        });
      }
    } catch {
      if (signal.aborted || !this.map || !this.routeLayer) return;
      this.routeLayer.addLayer(L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: style.color, weight: style.weight, opacity: 0.5, dashArray: '8 12',
      }));
    }
  }

  clearRoute() {
    currentAbort?.abort(); currentAbort = null;
    this.routeLayer?.clearLayers();
  }

  flyTo(center: LatLng, zoom?: number) {
    if (!this.map || !isValidLatLng(center)) return;
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
