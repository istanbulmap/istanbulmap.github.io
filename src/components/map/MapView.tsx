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

// Map-pin SVG shape — accurate point at bottom
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
        ${isFavorite ? `<path d="M14 10.5l1 2.1 2.3.3-1.65 1.6.4 2.35L14 15.7l-2.05 1.15.4-2.35L10.7 12.9l2.3-.3z" fill="${hex}"/>` : `<circle cx="14" cy="14" r="2.5" fill="${hex}" opacity="0.7"/>`}
      </svg>
    </div>`,
  });
}

// Route endpoint — teardrop shape with letter
function createEndpointIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconAnchor: [16, 38],
    popupAnchor: [0, -40],
    html: `<div style="filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));cursor:grab;">
      <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" width="32" height="40">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 9.6 16 24 16 24s16-14.4 16-24C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="15" r="11" fill="rgba(0,0,0,0.25)"/>
        <text x="16" y="20" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="700" fill="white">${label}</text>
      </svg>
    </div>`,
  });
}

// OSRM profile mapping
const OSRM_PROFILE: Partial<Record<TransportMode, string>> = {
  walking:   'foot',
  bus:       'driving',   // approximation
  metro:     'driving',
  tram:      'driving',
  ferry:     'driving',
  funicular: 'foot',
};

const ROUTE_COLORS: Record<TransportMode, string> = {
  walking:   '#22c55e',
  metro:     '#4f4ef1',
  tram:      '#f59e0b',
  bus:       '#f97316',
  ferry:     '#06b6d4',
  funicular: '#8b5cf6',
};

export class MapView {
  private map: L.Map | null = null;
  private pinLayers: Map<string, L.Marker> = new Map();
  private routeLayer: L.LayerGroup | null = null;
  private fromMarker: L.Marker | null = null;
  private toMarker: L.Marker | null = null;
  private currentRoutePolyline: L.Polyline | null = null;

  // Drag callbacks — set from App via refs
  onFromDragEnd: ((pos: LatLng) => void) | null = null;
  onToDragEnd:   ((pos: LatLng) => void) | null = null;

  init(container: HTMLElement, center: LatLng, zoom: number): L.Map {
    if (this.map) return this.map;

    this.map = L.map(container, {
      center:         [center.lat, center.lng],
      zoom,
      zoomControl:    false,
      tap:            false,   // disable Leaflet tap emulation — prevents ghost clicks / drift
      tapTolerance:   10,
      bounceAtZoomLimits: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains:  'abc',
      maxZoom:     19,
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
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.pinLayers.clear();
      this.fromMarker = null;
      this.toMarker   = null;
    }
  }

  getMap(): L.Map | null { return this.map; }

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

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent);
          onPinClick(pin.id);
        });
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

  setRouteMarkers(from: LatLng | null, to: LatLng | null) {
    if (!this.map) return;

    if (this.fromMarker) { this.fromMarker.remove(); this.fromMarker = null; }
    if (this.toMarker)   { this.toMarker.remove();   this.toMarker   = null; }

    if (from) {
      this.fromMarker = L.marker([from.lat, from.lng], {
        icon:         createEndpointIcon('A', '#2dd4bf'),
        draggable:    true,
        zIndexOffset: 1000,
      }).addTo(this.map);

      this.fromMarker.on('click', (e) =>
        L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent));
      this.fromMarker.on('dragend', () => {
        if (!this.fromMarker || !this.onFromDragEnd) return;
        const ll = this.fromMarker.getLatLng();
        this.onFromDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }

    if (to) {
      this.toMarker = L.marker([to.lat, to.lng], {
        icon:         createEndpointIcon('B', '#f59e0b'),
        draggable:    true,
        zIndexOffset: 1000,
      }).addTo(this.map);

      this.toMarker.on('click', (e) =>
        L.DomEvent.stopPropagation(e as unknown as L.LeafletMouseEvent));
      this.toMarker.on('dragend', () => {
        if (!this.toMarker || !this.onToDragEnd) return;
        const ll = this.toMarker.getLatLng();
        this.onToDragEnd({ lat: ll.lat, lng: ll.lng });
      });
    }
  }

  // Fetch real road/path geometry from OSRM (free public API)
  async drawRouteReal(from: LatLng, to: LatLng, mode: TransportMode): Promise<void> {
    if (!this.map || !this.routeLayer) return;
    this.routeLayer.clearLayers();

    const profile = OSRM_PROFILE[mode] ?? 'foot';
    const color   = ROUTE_COLORS[mode] ?? '#4f4ef1';

    try {
      const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const res  = await fetch(url);
      const data = await res.json() as OSRMResponse;

      if (data.code === 'Ok' && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression
        );

        const polyline = L.polyline(coords, {
          color,
          weight:    mode === 'walking' ? 3 : 5,
          opacity:   0.9,
          dashArray: mode === 'walking' ? '6, 8' : undefined,
          lineCap:   'round',
          lineJoin:  'round',
        });

        this.routeLayer.addLayer(polyline);
        this.map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 16 });
        return;
      }
    } catch {
      // fall through to straight line fallback
    }

    // Fallback: dashed straight line
    const fallback = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
      color,
      weight:    3,
      opacity:   0.7,
      dashArray: '8, 10',
    });
    this.routeLayer.addLayer(fallback);
    this.map.fitBounds(fallback.getBounds(), { padding: [60, 60] });
  }

  clearRoute() {
    this.routeLayer?.clearLayers();
  }

  flyTo(center: LatLng, zoom?: number) {
    this.map?.flyTo([center.lat, center.lng], zoom ?? this.map.getZoom(), {
      duration:      0.9,
      easeLinearity: 0.5,
    });
  }
}

interface OSRMResponse {
  code: string;
  routes: Array<{
    geometry: { coordinates: [number, number][] };
    duration: number;
    distance: number;
  }>;
}

export function useMapView() {
  const instanceRef = useRef<MapView>(new MapView());
  return instanceRef.current;
}

export default MapView;
