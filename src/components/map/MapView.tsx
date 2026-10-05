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
  blue:   '#4f4ef1', red:    '#f43f5e', green:  '#22c55e',
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
  walking:   { color: '#22c55e', weight: 4, opacity: 0.95, dashArray: '8 10',  lineCap: 'round', lineJoin: 'round' },
  metro:     { color: '#4f4ef1', weight: 6, opacity: 0.95, lineCap: 'round',  lineJoin: 'round' },
  tram:      { color: '#f59e0b', weight: 4, opacity: 0.9,  dashArray: '14 5', lineCap: 'square', lineJoin: 'round' },
  bus:       { color: '#f97316', weight: 4, opacity: 0.88, lineCap: 'round',  lineJoin: 'round' },
  ferry:     { color: '#06b6d4', weight: 4, opacity: 0.85, dashArray: '8 10', lineCap: 'round',  lineJoin: 'round' },
  funicular: { color: '#8b5cf6', weight: 3, opacity: 0.85, dashArray: '3 7',  lineCap: 'round',  lineJoin: 'round' },
};

// ── OSRM ─────────────────────────────────────────────────────────────────────

interface OSRMRoute { geometry: { coordinates: [number, number][] } }
interface OSRMResp  { code: string; routes: OSRMRoute[] }

function isValidLatLng(p: LatLng): boolean {
  return (
    p != null &&
    typeof p.lat === 'number' && isFinite(p.lat) &&
    typeof p.lng === 'number' && isFinite(p.lng)
  );
}

/**
 * Validate that a LatLng has finite, real-number coordinates before use.
 */
function isValidLatLng(p: LatLng): boolean {
  return (
    p != null &&
    typeof p.lat === 'number' && isFinite(p.lat) &&
    typeof p.lng === 'number' && isFinite(p.lng)
  );
}

/**
 * Fetch a route from the OSRM public API.
 * Uses `foot` profile for walking (true pedestrian paths) and
 * `driving` for vehicle-based modes.
 *
 * FIX: The original code was occasionally called with NaN-coordinate
 * waypoints from transit waypoint helpers.  We validate every point
 * before building the URL so OSRM never receives a malformed request.
 */
async function fetchOSRM(
  waypoints: LatLng[],
  profile: 'foot' | 'driving',
  signal: AbortSignal,
): Promise<L.LatLngExpression[] | null> {
  // Guard: drop invalid points, bail if we have fewer than 2 remaining
  const valid = waypoints.filter(isValidLatLng);
  if (valid.length < 2) return null;

  const coords = valid.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
  try {
    const res  = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json() as OSRMResp;
    if (data.code !== 'Ok' || !data.routes.length) return null;
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
    );
  } catch { return null; }
}

/**
 * Build the geometry for each transport mode.
 *
 * Walking always uses OSRM foot — this routes via actual pedestrian
 * paths, crossings, and footways, NOT via car roads.
 *
 * Other modes use driving or composited segments as before.
 */
async function buildGeometry(
  from: LatLng,
  to: LatLng,
  mode: TransportMode,
  signal: AbortSignal,
): Promise<L.LatLngExpression[][]> {
  // Validate from/to before any async work
  if (!isValidLatLng(from) || !isValidLatLng(to)) {
    return [[[from?.lat ?? 0, from?.lng ?? 0], [to?.lat ?? 0, to?.lng ?? 0]]];
  }

  const fallback: L.LatLngExpression[][] = [[[from.lat, from.lng], [to.lat, to.lng]]];

  switch (mode) {

    // ── Pedestrian — strictly foot profile, no car roads ────────────────────
    case 'walking':
    case 'funicular': {
      // Strict foot-routed pedestrian path — never driving profile
      const pts = await fetchOSRM([from, to], 'foot', signal);
      return pts ? [pts] : fallback;
    }

    // ── Bus — driving via nearest hubs ───────────────────────────────────────
    case 'bus': {
      const hubs = buildTransitWaypoints(from, to, BUS_HUBS, 3).filter(isValidLatLng);
      const pts  = await fetchOSRM([from, ...hubs, to], 'driving', signal);
      return pts ? [pts] : fallback;
    }

    // ── Tram ─────────────────────────────────────────────────────────────────
    case 'tram': {
      const stops = buildTransitWaypoints(from, to, TRAM_STOPS, 4).filter(isValidLatLng);
      const pts   = await fetchOSRM([from, ...stops, to], 'driving', signal);
      return pts ? [pts] : fallback;
    }

    // ── Metro — walk to/from station, straight line underground ─────────────
    case 'metro': {
      const stations = buildTransitWaypoints(from, to, METRO_STATIONS, 4).filter(isValidLatLng);
      if (stations.length < 2) {
        const pts = await fetchOSRM([from, to], 'foot', signal);
        return pts ? [pts] : fallback;
      }
      const entry  = stations[0];
      const exit   = stations[stations.length - 1];
      const middle = stations.slice(1, -1);

      const [walkIn, walkOut] = await Promise.all([
        fetchOSRM([from, entry], 'foot', signal),
        fetchOSRM([exit, to],   'foot', signal),
      ]);

      const underground: L.LatLngExpression[] = [
        [entry.lat, entry.lng],
        ...middle.filter(isValidLatLng).map((s): L.LatLngExpression => [s.lat, s.lng]),
        [exit.lat,  exit.lng],
      ];

      const segments: L.LatLngExpression[][] = [];
      if (walkIn)  segments.push(walkIn);
      segments.push(underground);
      if (walkOut) segments.push(walkOut);
      return segments.length ? segments : fallback;
    }

    // ── Ferry — walk to terminal, cross, walk to destination ─────────────────
    case 'ferry': {
      const fromTerminal = nearestPoint(from, FERRY_TERMINALS);
      const toTerminal   = nearestPoint(to,   FERRY_TERMINALS);

      if (!isValidLatLng(fromTerminal) || !isValidLatLng(toTerminal)) {
        return fallback;
      }

      const [walkToPort, walkFromPort] = await Promise.all([
        fetchOSRM([from, fromTerminal], 'foot', signal),
        fetchOSRM([toTerminal, to],     'foot', signal),
      ]);

      const crossing: L.LatLngExpression[] = [
        [fromTerminal.lat, fromTerminal.lng],
        [toTerminal.lat,   toTerminal.lng],
      ];

      const segments: L.LatLngExpression[][] = [];
      if (walkToPort)   segments.push(walkToPort);
      segments.push(crossing);
      if (walkFromPort) segments.push(walkFromPort);
      return segments.length ? segments : fallback;
    }
  }
}

// ── Abort controller ──────────────────────────────────────────────────────────
let currentAbortController: AbortController | null = null;

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
      zoomControl: false, tap: false, tapTolerance: 10, bounceAtZoomLimits: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc', maxZoom: 19,
    }).addTo(this.map);
    const tilePane = this.map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter =
        'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.55) contrast(1.1)';
    }
    this.routeLayer = L.layerGroup().addTo(this.map);
    return this.map;
  }

  destroy() {
    currentAbortController?.abort();
    if (this.map) {
      this.map.remove(); this.map = null;
      this.pinLayers.clear();
      this.fromMarker = null; this.toMarker = null;
    }
  }

  getMap(): L.Map | null { return this.map; }

  /**
   * FIX: black-screen on mobile ↔ desktop switch.
   * When the layout changes the map container resizes but Leaflet doesn't
   * know about it. Calling invalidateSize() tells Leaflet to re-read the
   * container dimensions and re-render all tiles.
   */
  invalidateSize() {
    if (!this.map) return;
    // Small delay lets the DOM finish re-laying out before we measure
    setTimeout(() => { this.map?.invalidateSize({ animate: false }); }, 50);
  }

  // ── Pins ────────────────────────────────────────────────────────────────────
  syncPins(
    pins: Pin[],
    onPinClick:  (id: string) => void,
    onPinUpdate: (id: string, pos: LatLng) => void,
  ) {
    if (!this.map) return;
    const currentIds = new Set(pins.map((p) => p.id));
    this.pinLayers.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.remove(); this.pinLayers.delete(id); }
    });
    pins.forEach((pin) => {
      const icon    = createPinIcon(pin.color, pin.isFavorite);
      const latlng  = [pin.position.lat, pin.position.lng] as L.LatLngExpression;
      const existing = this.pinLayers.get(pin.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setPopupContent(this.buildPopupContent(pin));
      } else {
        const marker = L.marker(latlng, { icon, draggable: true })
          .bindPopup(this.buildPopupContent(pin), { className: 'dark-popup', maxWidth: 220 })
          .addTo(this.map!);
        const stopProp = (e: L.LeafletEvent) =>
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);
        marker.on('click',    stopProp);
        marker.on('dblclick', stopProp);
        marker.on('dragend',  () => {
          const ll = marker.getLatLng();
          onPinUpdate(pin.id, { lat: ll.lat, lng: ll.lng });
        });
        this.pinLayers.set(pin.id, marker);
      }
    });
  }

  private buildPopupContent(pin: Pin): string {
    return `<div style="font-family:'Space Grotesk',sans-serif;min-width:150px;">
      <div style="font-weight:600;font-size:14px;color:#e9e4da;margin-bottom:4px">${pin.label}</div>
      ${pin.note ? `<div style="font-size:12px;color:#9a9d95;line-height:1.5">${pin.note}</div>` : ''}
      <div style="font-size:10px;color:#6d727b;margin-top:6px;font-family:'JetBrains Mono',monospace">${new Date(pin.createdAt).toLocaleDateString()}</div>
    </div>`;
  }

  // ── Route markers ─────────────────────────────────────────────────────────
  setRouteMarkers(from: LatLng | null, to: LatLng | null) {
    if (!this.map) return;
    if (this.fromMarker) { this.fromMarker.remove(); this.fromMarker = null; }
    if (this.toMarker)   { this.toMarker.remove();   this.toMarker   = null; }
    const stopProp = (e: L.LeafletEvent) =>
      L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);

    if (from && isValidLatLng(from)) {
      this.fromMarker = L.marker([from.lat, from.lng], {
        icon: createEndpointIcon('A', '#2dd4bf'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.fromMarker.on('click',    stopProp);
      this.fromMarker.on('dblclick', stopProp);
      this.fromMarker.on('dragend',  () => {
        if (!this.fromMarker || !this.onFromDragEnd) return;
        const ll = this.fromMarker.getLatLng();
        this.onFromDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }

    if (to && isValidLatLng(to)) {
      this.toMarker = L.marker([to.lat, to.lng], {
        icon: createEndpointIcon('B', '#f59e0b'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.toMarker.on('click',    stopProp);
      this.toMarker.on('dblclick', stopProp);
      this.toMarker.on('dragend',  () => {
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

    // FIX: Guard against invalid coordinates — these cause the NaN LatLng error
    if (!isValidLatLng(from) || !isValidLatLng(to)) return;

    currentAbortController?.abort();
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    this.routeLayer.clearLayers();
    const style = MODE_STYLE[mode];

    try {
      const segments = await buildGeometry(from, to, mode, signal);
      if (signal.aborted) return;
      if (!this.map || !this.routeLayer) return;

      const allBounds: L.LatLngExpression[] = [];

      segments.forEach((coords, idx) => {
        const isMetroWalk = mode === 'metro' && (idx === 0 || idx === segments.length - 1) && segments.length > 1;
        const isFerryWalk = mode === 'ferry' && (idx === 0 || idx === segments.length - 1) && segments.length > 1;
        const isTransitWalk = isMetroWalk || isFerryWalk;

        const segStyle: RouteStyle = isTransitWalk
          ? { color: '#22c55e', weight: 2, opacity: 0.75, dashArray: '4 7', lineCap: 'round', lineJoin: 'round' }
          : style;

        const polyline = L.polyline(coords, {
          color:     segStyle.color,
          weight:    segStyle.weight,
          opacity:   segStyle.opacity,
          dashArray: segStyle.dashArray,
          lineCap:   segStyle.lineCap ?? 'round',
          lineJoin:  segStyle.lineJoin ?? 'round',
        });
        this.routeLayer!.addLayer(polyline);
        allBounds.push(...coords);
      });

      if (allBounds.length > 1) {
        this.map.fitBounds(L.latLngBounds(allBounds as L.LatLngExpression[]), {
          padding: [70, 70], maxZoom: 16, animate: true,
        });
      }
    } catch {
      if (signal.aborted) return;
      if (!this.map || !this.routeLayer) return;
      const fallback = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color: style.color, weight: style.weight, opacity: 0.55, dashArray: '8 12',
      });
      this.routeLayer.addLayer(fallback);
      this.map.fitBounds(fallback.getBounds(), { padding: [70, 70] });
    }
  }

  clearRoute() {
    currentAbortController?.abort();
    currentAbortController = null;
    this.routeLayer?.clearLayers();
  }

  /**
   * FIX: The original flyTo() called map.flyTo() even when the map
   * container had zero size (e.g., on first render before layout),
   * which made Leaflet's unproject() return NaN coordinates.
   * We now check that the container has a real size first.
   */
  flyTo(center: LatLng, zoom?: number) {
    if (!this.map) return;
    if (!isValidLatLng(center)) return;

    // Guard: container must have been laid out (non-zero size)
    const container = this.map.getContainer();
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;

    this.map.flyTo([center.lat, center.lng], zoom ?? this.map.getZoom(), {
      duration: 0.9, easeLinearity: 0.5,
    });
  }
}

export function useMapView() {
  const instanceRef = useRef<MapView>(new MapView());
  return instanceRef.current;
}

export default MapView;
