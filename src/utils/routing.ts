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

const SPEED_KMH: Record<TransportMode, number> = {
  walking:   5,
  car:       35,   // city average with traffic
  bus:       18,
  metro:     40,
  tram:      20,
  ferry:     30,
  funicular: 10,
};

const BOARDING_MIN: Record<TransportMode, number> = {
  walking:   0,
  car:       2,    // minimal — already in your car
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

const METRO_LINES = [
  { id: 'M1',       name: 'M1 Aksaray - Atatürk Airport'    },
  { id: 'M2',       name: 'M2 Yenikiapi - Haciosman'        },
  { id: 'M3',       name: 'M3 Kirazli - Olimpiyat'          },
  { id: 'M4',       name: 'M4 Kadikoy - Sabiha Gökcen'      },
  { id: 'M5',       name: 'M5 Üsküdar - Çekmeköy'           },
  { id: 'M6',       name: 'M6 Levent - Bogazici'            },
  { id: 'M7',       name: 'M7 Mecidiyeköy - Mahmutbey'      },
  { id: 'M9',       name: 'M9 Ataköy - Ikitelli'            },
  { id: 'M11',      name: 'M11 Gayrettepe - Istanbul Airport'},
  { id: 'Marmaray', name: 'Marmaray (Bosphorus Tunnel)'      },
];

const TRAM_LINES = [
  { id: 'T1', name: 'T1 Kabataş - Bağcılar' },
  { id: 'T3', name: 'T3 Kadıköy - Moda'     },
];

const FERRY_ROUTES = [
  'Eminönü - Kadıköy',
  'Beşiktaş - Kadıköy',
  'Kabataş - Üsküdar',
  'Eminönü - Üsküdar',
];

function getBosphorusProximity(pos: LatLng): boolean {
  return pos.lng >= 28.95 && pos.lng <= 29.15 && pos.lat >= 40.9 && pos.lat <= 41.2;
}

/** Pick a deterministic "random" item from an array based on coordinates */
function pick<T>(arr: T[], from: LatLng): T {
  const idx = Math.abs(Math.round((from.lat + from.lng) * 1000)) % arr.length;
  return arr[idx];
}

function detectAvailableTransit(from: LatLng, to: LatLng) {
  const dist = haversineKm(from, to);
  const crossesBosphorus =
    (from.lng < 29.0 && to.lng > 29.05) ||
    (from.lng > 29.05 && to.lng < 29.0);

  return {
    hasFerry:     crossesBosphorus || (getBosphorusProximity(from) && getBosphorusProximity(to)),
    hasMetro:     dist > 1.5,
    hasTram:      dist < 15 && !crossesBosphorus,
    hasFunicular: dist < 3,
    crossesBosphorus,
  };
}

export function computeRouteOptions(from: LatLng, to: LatLng): RouteOption[] {
  const dist    = haversineKm(from, to);
  const transit = detectAvailableTransit(from, to);

  const makeOption = (mode: TransportMode): RouteOption => {
    const speed      = SPEED_KMH[mode];
    const boarding   = BOARDING_MIN[mode];
    const travelMin  = (dist / speed) * 60;
    const totalMin   = Math.round(travelMin + boarding);

    let steps: string[]   = [];
    let lines: string[]   = [];
    let available         = true;
    let reason            = '';

    switch (mode) {
      case 'walking':
        // Walking is always shown — user decides if it's too far
        available = true;
        steps = [
          `Head towards your destination (${dist.toFixed(1)} km)`,
          'Follow pedestrian paths, crossings, and footways',
          'Arrive at destination',
        ];
        break;

      case 'car':
        available = true;
        steps = [
          'Start navigation in your preferred maps app',
          `Drive towards destination (~${dist.toFixed(1)} km)`,
          'Istanbul traffic: allow extra time during rush hours (07–10, 17–20)',
          'Look for paid parking (otopark) near destination',
        ];
        break;

      case 'metro': {
        available = transit.hasMetro;
        reason    = !transit.hasMetro ? 'Metro not practical for this short distance' : '';
        const line = transit.crossesBosphorus
          ? METRO_LINES[METRO_LINES.length - 1]   // Marmaray
          : pick(METRO_LINES.slice(0, -1), from);
        lines = [line.name];
        steps = [
          'Walk to nearest metro station',
          `Board ${line.name}`,
          'Ride to the closest station to your destination',
          'Walk to final destination',
        ];
        break;
      }

      case 'tram': {
        available = transit.hasTram;
        reason    = !transit.hasTram ? 'No tram route available for this journey' : '';
        const line = pick(TRAM_LINES, from);
        lines = [line.name];
        steps = [
          'Walk to nearest tram stop',
          `Board ${line.name} tram`,
          'Exit at stop nearest to destination',
          'Short walk to destination',
        ];
        break;
      }

      case 'bus': {
        available = true;
        // Deterministic bus number from coordinates
        const busNum = (Math.abs(Math.round((from.lat + from.lng) * 100)) % 300) + 1;
        const suffix = ['', 'A', 'B', 'C'][Math.abs(Math.round(from.lat * 10)) % 4];
        lines = [`IETT Bus ${busNum}${suffix}`];
        steps = [
          'Find the nearest IETT bus stop (orange signs)',
          `Take Bus ${busNum}${suffix} towards your direction`,
          'Use Istanbulkart contactless card for payment',
          'Alight at the stop nearest to your destination',
          'Short walk to arrive',
        ];
        break;
      }

      case 'ferry': {
        available = transit.hasFerry;
        reason    = !transit.hasFerry ? 'No ferry route serves this crossing' : '';
        const route = pick(FERRY_ROUTES, from);
        lines = [`IDO / Şehir Hatları: ${route}`];
        steps = [
          'Walk to the nearest ferry terminal (iskele)',
          'Purchase ticket or tap Istanbulkart',
          `Board the ${route} ferry service`,
          'Enjoy the Bosphorus crossing (~15–20 min)',
          'Walk or take connecting transport to destination',
        ];
        break;
      }

      case 'funicular':
        available = transit.hasFunicular && dist < 2;
        reason    = !available ? 'Funicular serves specific routes only (Kabataş–Taksim, Beyoğlu)' : '';
        lines     = ['F1 Kabataş – Taksim'];
        steps = [
          'Walk to Kabataş funicular entrance',
          'Board F1 funicular (2-min ride)',
          'Exit at Taksim Square',
          'Walk to final destination',
        ];
        break;
    }

    return { mode, durationMin: totalMin, distanceKm: dist, steps, lines, available, reason };
  };

  const modes: TransportMode[] = ['walking', 'car', 'metro', 'tram', 'bus', 'ferry', 'funicular'];
  const options = modes.map(makeOption);

  return options.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.durationMin - b.durationMin;
  });
}

export { METRO_LINES, TRAM_LINES, FERRY_ROUTES };
