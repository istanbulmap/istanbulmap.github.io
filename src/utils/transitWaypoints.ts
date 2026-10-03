/**
 * Real Istanbul transit infrastructure coordinates.
 * Used to snap routes through actual station locations so each
 * transport mode draws a geometrically distinct path.
 */
import { LatLng } from '../types';

// ── Metro stations (selected key nodes per line) ──────────────────────────────
export const METRO_STATIONS: LatLng[] = [
  // M1 Aksaray – Atatürk Airport
  { lat: 41.0138, lng: 28.9497 }, // Aksaray
  { lat: 41.0097, lng: 28.9310 }, // Yenibosna
  { lat: 40.9824, lng: 28.8152 }, // Atatürk Airport

  // M2 Yenikapı – Hacıosman
  { lat: 41.0037, lng: 28.9726 }, // Yenikapı
  { lat: 41.0144, lng: 28.9740 }, // Vezneciler
  { lat: 41.0257, lng: 28.9741 }, // Taksim
  { lat: 41.0369, lng: 28.9850 }, // Şişli-Mecidiyeköy
  { lat: 41.0609, lng: 28.9878 }, // Levent
  { lat: 41.0775, lng: 28.9952 }, // Hacıosman

  // M3 Kirazlı – Olimpiyatköy
  { lat: 41.0503, lng: 28.8145 }, // Bağcılar
  { lat: 41.0631, lng: 28.7961 }, // Kirazlı
  { lat: 41.0756, lng: 28.8014 }, // Olimpiyatköy

  // M4 Kadıköy – Sabiha Gökçen
  { lat: 40.9906, lng: 29.0266 }, // Kadıköy
  { lat: 40.9748, lng: 29.0731 }, // Ayrılık Çeşmesi
  { lat: 40.9617, lng: 29.1094 }, // Içerenköy
  { lat: 40.9260, lng: 29.1701 }, // Sabiha Gökçen

  // M5 Üsküdar – Çekmeköy
  { lat: 41.0227, lng: 29.0143 }, // Üsküdar
  { lat: 41.0299, lng: 29.0477 }, // Altunizade
  { lat: 41.0411, lng: 29.0786 }, // Çekmeköy

  // M7 Mecidiyeköy – Mahmutbey
  { lat: 41.0587, lng: 28.9856 }, // Mecidiyeköy
  { lat: 41.0614, lng: 28.9399 }, // Bağcılar Meydan
  { lat: 41.0562, lng: 28.8460 }, // Mahmutbey

  // M9 Atakoy – Ikitelli
  { lat: 40.9881, lng: 28.8730 }, // Atakoy
  { lat: 41.0247, lng: 28.8290 }, // Ikitelli

  // M11 Gayrettepe – Istanbul Airport
  { lat: 41.0660, lng: 28.9975 }, // Gayrettepe
  { lat: 41.1500, lng: 28.8200 }, // Kağıthane
  { lat: 41.2753, lng: 28.7519 }, // Istanbul Airport

  // Marmaray (key nodes)
  { lat: 41.0037, lng: 28.9726 }, // Yenikapı
  { lat: 41.0135, lng: 29.0060 }, // Sirkeci
  { lat: 41.0062, lng: 29.0136 }, // Üsküdar M
];

// ── Tram stops (T1 main line + T3) ───────────────────────────────────────────
export const TRAM_STOPS: LatLng[] = [
  // T1 Kabataş – Bağcılar
  { lat: 41.0398, lng: 28.9992 }, // Kabataş
  { lat: 41.0369, lng: 28.9850 }, // Taksim (transfer)
  { lat: 41.0315, lng: 28.9769 }, // Karaköy
  { lat: 41.0208, lng: 28.9740 }, // Eminönü
  { lat: 41.0173, lng: 28.9700 }, // Sirkeci
  { lat: 41.0128, lng: 28.9643 }, // Gülhane
  { lat: 41.0086, lng: 28.9802 }, // Sultanahmet
  { lat: 41.0052, lng: 28.9758 }, // Çemberlitaş
  { lat: 41.0144, lng: 28.9740 }, // Beyazıt
  { lat: 41.0138, lng: 28.9497 }, // Aksaray
  { lat: 41.0350, lng: 28.9000 }, // Bağcılar
  // T3 Kadıköy – Moda
  { lat: 40.9906, lng: 29.0266 }, // Kadıköy
  { lat: 40.9870, lng: 29.0230 }, // Moda
];

// ── Bus corridor anchor points (major IETT corridors) ────────────────────────
// These are major road intersections / bus hubs buses physically pass through
export const BUS_HUBS: LatLng[] = [
  { lat: 41.0138, lng: 28.9497 }, // Aksaray hub
  { lat: 41.0208, lng: 28.9740 }, // Eminönü
  { lat: 41.0369, lng: 28.9850 }, // Taksim
  { lat: 41.0660, lng: 28.9975 }, // 4.Levent
  { lat: 40.9906, lng: 29.0266 }, // Kadıköy
  { lat: 41.0227, lng: 29.0143 }, // Üsküdar
  { lat: 41.0503, lng: 28.8145 }, // Bağcılar
  { lat: 41.0062, lng: 28.8730 }, // Bakırköy
];

// ── Ferry terminals ───────────────────────────────────────────────────────────
export const FERRY_TERMINALS: LatLng[] = [
  { lat: 41.0208, lng: 28.9740 }, // Eminönü
  { lat: 41.0270, lng: 28.9740 }, // Karaköy
  { lat: 41.0398, lng: 28.9992 }, // Kabataş
  { lat: 41.0430, lng: 29.0050 }, // Beşiktaş
  { lat: 41.0227, lng: 29.0143 }, // Üsküdar
  { lat: 40.9906, lng: 29.0266 }, // Kadıköy
];

/**
 * Find the nearest point in a list to a given coordinate.
 */
export function nearestPoint(pos: LatLng, points: LatLng[]): LatLng {
  let best = points[0];
  let bestDist = Infinity;
  for (const p of points) {
    const d = (p.lat - pos.lat) ** 2 + (p.lng - pos.lng) ** 2;
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

/**
 * Build an ordered list of waypoints along the transit network
 * between two points. Returns waypoints to pass through OSRM as
 * intermediate stops so the route follows real infrastructure.
 */
export function buildTransitWaypoints(
  from: LatLng,
  to: LatLng,
  network: LatLng[],
  maxWaypoints = 3,
): LatLng[] {
  // Find the nearest entry station to `from` and nearest exit to `to`
  const entry = nearestPoint(from, network);
  const exit  = nearestPoint(to,   network);

  // If entry and exit are the same node, return just that one
  if (entry.lat === exit.lat && entry.lng === exit.lng) return [entry];

  // Find 0-1 intermediate nodes that are geographically between entry and exit
  const midLat = (entry.lat + exit.lat) / 2;
  const midLng = (entry.lng + exit.lng) / 2;

  // Score nodes by how close they are to the midpoint AND lie between entry/exit
  const candidates = network
    .filter((p) => p !== entry && p !== exit)
    .map((p) => ({
      p,
      score: Math.abs(p.lat - midLat) + Math.abs(p.lng - midLng),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, maxWaypoints - 2)
    .map((x) => x.p);

  return [entry, ...candidates, exit];
}
