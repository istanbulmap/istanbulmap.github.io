import { useRef } from 'react';
import L from 'leaflet';
import { LatLng, Pin, TransportMode } from '../../types';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PIN_COLORS: Record<string, string> = {
  blue:   '#4f4ef1',
  red:    '#f43f5e',
  green:  '#22c55e',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  orange: '#f97316',
};

function createPinIcon(color: string, isFavorite: boolean): L.DivIcon {
  const hex = PIN_COLORS[color] ?? PIN_COLORS.blue;
  return L.divIcon({
    className: '',
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
    html: `<div style="filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7));">
      <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" width="28" height="36">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 5.036 2.662 9.45 6.65 11.938L14 36l7.35-10.062C25.338 23.45 28 19.036 28 14 28 6.268 21.732 0 14 0z" fill="${hex}"/>
        <circle cx="14" cy="14" r="6" fill="white" opacity="0.92"/>
        ${isFavorite
          ? `<path d="M14 10.5l1 2.1 2.3.3-1.65 1.6.4 2.35L14 15.7l-2.05 1.15.4-2.35L10.7 12.9l2.3-.3z" fill="${hex}"/>`
          : `<circle cx="14" cy="14" r="2.5" fill="${hex}" opacity="0.7"/>`}
      </svg>
    </div>`,
  });
}

function createEndpointIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
    html: `<div style="filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));cursor:grab;">
      <svg viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" width="32" height="42">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 9.6 16 26 16 26s16-16.4 16-26C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="11" fill="rgba(0,0,0,0.22)"/>
        <text x="16" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="white">${label}</text>
      </svg>
    </div>`,
  });
}

// ── OSRM routing helpers ──────────────────────────────────────────────────────
//
// OSRM public API only supports "foot" and "driving" profiles.
// To visually differentiate transit modes that share the driving profile
// we fetch BOTH profiles and pick the one that makes most sense per mode,
// then style the polyline differently so each mode looks distinct.
//
// walking   → foot   profile, dashed thin green
// funicular → foot   profile, dotted purple (short)
// ferry     → straight line over water (OSRM driving fails over sea), cyan
// metro     → driving profile, thick solid indigo — represents underground corridor
// tram      → driving profile, medium dashed amber (follows road but tram-style)
// bus       → driving profile, solid orange (road route)

type RouteStyle = {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
  dashOffset?: string;
};

const MODE_STYLE: Record<TransportMode, RouteStyle> = {
  walking:   { color: '#22c55e', weight: 3, opacity: 0.85, dashArray: '6 9' },
  funicular: { color: '#8b5cf6', weight: 3, opacity: 0.85, dashArray: '3 6' },
  metro:     { color: '#4f4ef1', weight: 6, opacity: 0.9  },
  tram:      { color: '#f59e0b', weight: 4, opacity: 0.9,  dashArray: '12 5' },
  bus:       { color: '#f97316', weight: 4, opacity: 0.88  },
  ferry:     { color: '#06b6d4', weight: 4, opacity: 0.85, dashArray: '8 10' },
};

// Which OSRM profile to use per mode
const OSRM_PROFILE: Record<TransportMode, 'foot' | 'driving' | 'straight'> = {
  walking:   'foot',
  funicular: 'foot',
  metro:     'driving',
  tram:      'driving',
  bus:       'driving',
  ferry:     'straight',   // ferry crosses water — OSRM can't route it
};

interface OSRMResponse {
  code: string;
  routes: Array<{ geometry: { coordinates: [number, number][] } }>;
}

// Incrementing request ID — lets async fetches detect if they're stale
let routeRequestId = 0;

async function fetchOSRMRoute(
  from: LatLng,
  to: LatLng,
  profile: 'foot' | 'driving',
): Promise<L.LatLngExpression[] | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${from.lng},${from.lat};${to.lng},${to.lat}` +
      `?overview=full&geometries=geojson`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as OSRMResponse;
    if (data.code === 'Ok' && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression,
      );
    }
  } catch { /* timeout or network error — fall through */ }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export class MapView {
  private map: L.Map | null = null;
  private pinLayers: Map<string, L.Marker> = new Map();
  private routeLayer: L.LayerGroup | null = null;
  private fromMarker: L.Marker | null = null;
  private toMarker:   L.Marker | null = null;

  onFromDragEnd: ((pos: LatLng) => void) | null = null;
  onToDragEnd:   ((pos: LatLng) => void) | null = null;

  init(container: HTMLElement, center: LatLng, zoom: number): L.Map {
    if (this.map) return this.map;

    this.map = L.map(container, {
      center:             [center.lat, center.lng],
      zoom,
      zoomControl:        false,
      tap:                false,
      tapTolerance:       10,
      bounceAtZoomLimits: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains:  'abc',
      maxZoom:     19,
    }).addTo(this.map);

    // Apply dark filter only to the tile pane — leaves marker/overlay panes unaffected
    const tilePane = this.map.getPane('tilePane');
    if (tilePane) {
      tilePane.style.filter =
        'invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.55) contrast(1.1)';
    }

    this.routeLayer = L.layerGroup().addTo(this.map);
    return this.map;
  }

  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.pinLayers.clear();
      this.fromMarker = null;
      this.toMarker   = null;
    }
  }

  getMap(): L.Map | null { return this.map; }

  // ── Pins ───────────────────────────────────────────────────────────────────

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
      const icon   = createPinIcon(pin.color, pin.isFavorite);
      const latlng = [pin.position.lat, pin.position.lng] as L.LatLngExpression;
      const existing = this.pinLayers.get(pin.id);

      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setPopupContent(this.buildPopupContent(pin));
      } else {
        const marker = L.marker(latlng, { icon, draggable: true })
          .bindPopup(this.buildPopupContent(pin), { className: 'dark-popup', maxWidth: 220 })
          .addTo(this.map!);

        marker.on('click', (e) =>
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent));
        marker.on('dblclick', (e) =>
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent));
        marker.on('dragend', () => {
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

  // ── Route markers ──────────────────────────────────────────────────────────

  setRouteMarkers(from: LatLng | null, to: LatLng | null) {
    if (!this.map) return;

    if (this.fromMarker) { this.fromMarker.remove(); this.fromMarker = null; }
    if (this.toMarker)   { this.toMarker.remove();   this.toMarker   = null; }

    const stopProp = (e: L.LeafletEvent) =>
      L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);

    if (from) {
      this.fromMarker = L.marker([from.lat, from.lng], {
        icon: createEndpointIcon('A', '#2dd4bf'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.fromMarker.on('click', stopProp);
      this.fromMarker.on('dblclick', stopProp);
      this.fromMarker.on('dragend', () => {
        if (!this.fromMarker || !this.onFromDragEnd) return;
        const ll = this.fromMarker.getLatLng();
        this.onFromDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }

    if (to) {
      this.toMarker = L.marker([to.lat, to.lng], {
        icon: createEndpointIcon('B', '#f59e0b'), draggable: true, zIndexOffset: 1000,
      }).addTo(this.map);
      this.toMarker.on('click', stopProp);
      this.toMarker.on('dblclick', stopProp);
      this.toMarker.on('dragend', () => {
        if (!this.toMarker || !this.onToDragEnd) return;
        const ll = this.toMarker.getLatLng();
        this.onToDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }
  }

  // ── Routing ────────────────────────────────────────────────────────────────

  async drawRouteReal(from: LatLng, to: LatLng, mode: TransportMode): Promise<void> {
    if (!this.map || !this.routeLayer) return;

    // Stamp this request — any earlier async call that resolves later will abort
    const myId = ++routeRequestId;

    this.routeLayer.clearLayers();

    const profile = OSRM_PROFILE[mode];
    const style   = MODE_STYLE[mode];

    let coords: L.LatLngExpression[] | null = null;

    if (profile === 'straight') {
      // Ferry: straight geodesic line — OSRM can't cross the Bosphorus
      coords = [[from.lat, from.lng], [to.lat, to.lng]];
    } else {
      coords = await fetchOSRMRoute(from, to, profile);
    }

    // If a newer request started while we were waiting, discard this result
    if (myId !== routeRequestId) return;
    if (!this.map || !this.routeLayer) return;

    if (coords && coords.length > 1) {
      const polyline = L.polyline(coords, {
        color:     style.color,
        weight:    style.weight,
        opacity:   style.opacity,
        dashArray: style.dashArray,
        lineCap:   'round',
        lineJoin:  'round',
      });
      this.routeLayer.addLayer(polyline);
      this.map.fitBounds(polyline.getBounds(), { padding: [70, 70], maxZoom: 16 });
    } else {
      // OSRM failed — draw styled fallback straight line
      const fallback = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
        color:     style.color,
        weight:    style.weight,
        opacity:   0.65,
        dashArray: '8 12',
      });
      this.routeLayer.addLayer(fallback);
      this.map.fitBounds(fallback.getBounds(), { padding: [70, 70] });
    }
  }

  clearRoute() {
    routeRequestId++; // cancel any in-flight fetch
    this.routeLayer?.clearLayers();
  }

  flyTo(center: LatLng, zoom?: number) {
    this.map?.flyTo([center.lat, center.lng], zoom ?? this.map.getZoom(), {
      duration: 0.9, easeLinearity: 0.5,
    });
  }
}

export function useMapView() {
  const instanceRef = useRef<MapView>(new MapView());
  return instanceRef.current;
}

export default MapView;
