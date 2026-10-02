import { LatLng, RouteResult, TransportMode } from '../types';

const R = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Istanbul bounding box
const ISTANBUL_BOUNDS = {
  minLat: 40.8, maxLat: 41.3,
  minLng: 28.5, maxLng: 29.5,
};

export function isInIstanbul(pos: LatLng): boolean {
  return (
    pos.lat >= ISTANBUL_BOUNDS.minLat &&
    pos.lat <= ISTANBUL_BOUNDS.maxLat &&
    pos.lng >= ISTANBUL_BOUNDS.minLng &&
    pos.lng <= ISTANBUL_BOUNDS.maxLng
  );
}

// Approximate walk speed 5 km/h, various transit speeds
const SPEED_KMH: Record<TransportMode, number> = {
  walking:   5,
  bus:       18,
  metro:     40,
  tram:      20,
  ferry:     30,
  funicular: 10,
};

// Penalty minutes for waiting + boarding per mode
const BOARDING_MIN: Record<TransportMode, number> = {
  walking:   0,
  bus:       7,
  metro:     5,
  tram:      6,
  ferry:     15,
  funicular: 3,
};

export interface RouteOption extends RouteResult {
  available: boolean;
  reason?: string;
}

// Istanbul metro lines (M1-M12 + Marmaray + funicular)
const METRO_LINES = [
  { id: 'M1', name: 'M1 Aksaray - Airport (old)', color: '#e63946' },
  { id: 'M2', name: 'M2 Yenikiapi - Haciosman', color: '#2a9d8f' },
  { id: 'M3', name: 'M3 Kirazli - Olimpiyat', color: '#e9c46a' },
  { id: 'M4', name: 'M4 Kadikoy - Sabiha Gokcen', color: '#f4a261' },
  { id: 'M5', name: 'M5 Üsküdar - Cekmekoy', color: '#264653' },
  { id: 'M6', name: 'M6 Levent - Bogazici', color: '#6a0572' },
  { id: 'M7', name: 'M7 Mecidiyekoy - Mahmutbey', color: '#0077b6' },
  { id: 'M9', name: 'M9 Atakoy - Ikitelli', color: '#023e8a' },
  { id: 'M11', name: 'M11 Gayrettepe - Airport', color: '#00b4d8' },
  { id: 'Marmaray', name: 'Marmaray (Bosphorus Tunnel)', color: '#9b2226' },
];

const TRAM_LINES = [
  { id: 'T1', name: 'T1 Kabatas - Bagcilar', color: '#e76f51' },
  { id: 'T3', name: 'T3 Kadikoy - Moda', color: '#457b9d' },
];

const FERRY_ROUTES = [
  'Eminonu - Kadikoy',
  'Besiktas - Kadikoy',
  'Kabatas - Uskudar',
  'Eminonu - Uskudar',
  'Bosphorus Cruise',
  'Princes Islands',
];

function getBosphorusProximity(pos: LatLng): boolean {
  // Rough Bosphorus corridor
  return pos.lng >= 28.95 && pos.lng <= 29.15 && pos.lat >= 40.9 && pos.lat <= 41.2;
}

function detectAvailableTransit(from: LatLng, to: LatLng) {
  const dist = haversineKm(from, to);
  const crossesBosphorus =
    (from.lng < 29.0 && to.lng > 29.05) ||
    (from.lng > 29.05 && to.lng < 29.0);

  return {
    hasFerry: crossesBosphorus || (getBosphorusProximity(from) && getBosphorusProximity(to)),
    hasMetro: dist > 1.5,
    hasTram: dist < 15 && !crossesBosphorus,
    hasFunicular: dist < 3,
    crossesBosphorus,
  };
}

export function computeRouteOptions(from: LatLng, to: LatLng): RouteOption[] {
  const dist = haversineKm(from, to);
  const transit = detectAvailableTransit(from, to);

  const makeOption = (mode: TransportMode): RouteOption => {
    const speed = SPEED_KMH[mode];
    const boarding = BOARDING_MIN[mode];
    const travelMin = (dist / speed) * 60;
    const totalMin = Math.round(travelMin + boarding);

    let steps: string[] = [];
    let lines: string[] = [];
    let available = true;
    let reason = '';

    switch (mode) {
      case 'walking':
        available = dist <= 5;
        reason = dist > 5 ? 'Too far to walk comfortably' : '';
        steps = [
          `Head towards your destination (${dist.toFixed(1)} km)`,
          'Follow pedestrian paths and crossings',
          'Arrive at destination',
        ];
        break;

      case 'metro':
        available = transit.hasMetro;
        reason = !transit.hasMetro ? 'Metro not practical for this short distance' : '';
        lines = [METRO_LINES[Math.floor(Math.random() * METRO_LINES.length)].name];
        steps = [
          'Walk to nearest metro station',
          `Board ${lines[0]}`,
          'Ride to the closest station to your destination',
          'Walk to final destination',
        ];
        if (transit.crossesBosphorus) {
          lines = ['Marmaray (Bosphorus Tunnel)'];
          steps[1] = 'Board Marmaray line (crosses under Bosphorus)';
        }
        break;

      case 'tram':
        available = transit.hasTram;
        reason = !transit.hasTram ? 'No tram route available for this journey' : '';
        lines = [TRAM_LINES[0].name];
        steps = [
          'Walk to nearest tram stop',
          `Board ${TRAM_LINES[0].name} tram`,
          'Exit at stop nearest to destination',
          'Short walk to destination',
        ];
        break;

      case 'bus':
        available = true;
        const busLine = `${Math.floor(Math.random() * 300) + 1}${['', 'A', 'B', 'C'][Math.floor(Math.random() * 4)]}`;
        lines = [`IETT Bus ${busLine}`];
        steps = [
          'Find the nearest IETT bus stop (look for the orange signs)',
          `Take Bus ${busLine} towards your direction`,
          'Use Istanbulkart contactless card for payment',
          'Alight at the stop nearest to your destination',
          'Short walk to arrive',
        ];
        break;

      case 'ferry':
        available = transit.hasFerry;
        reason = !transit.hasFerry ? 'No ferry route serves this crossing' : '';
        const ferry = FERRY_ROUTES[Math.floor(Math.random() * 3)];
        lines = [`IDO / Sehir Hatlari: ${ferry}`];
        steps = [
          'Walk to the nearest ferry terminal (iskele)',
          'Purchase ticket or use Istanbulkart',
          `Board the ${ferry} ferry service`,
          'Enjoy the Bosphorus crossing (~15-20 min)',
          'Walk or take connecting transport to destination',
        ];
        break;

      case 'funicular':
        available = transit.hasFunicular && dist < 2;
        reason = !available ? 'Funicular only serves specific hillside routes (Kabatas-Taksim, Beyoglu)' : '';
        lines = ['F1 Kabatas - Taksim'];
        steps = [
          'Walk to Kabatas funicular entrance',
          'Board F1 funicular (2-min ride)',
          'Exit at Taksim Square',
          'Walk to final destination',
        ];
        break;
    }

    return { mode, durationMin: totalMin, distanceKm: dist, steps, lines, available, reason };
  };

  const modes: TransportMode[] = ['walking', 'metro', 'tram', 'bus', 'ferry', 'funicular'];
  const options = modes.map(makeOption);

  // Sort: available first, then by duration
  return options.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.durationMin - b.durationMin;
  });
}

export { METRO_LINES, TRAM_LINES, FERRY_ROUTES };
