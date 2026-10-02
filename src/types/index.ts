export type TransportMode = 'walking' | 'bus' | 'metro' | 'ferry' | 'tram' | 'funicular';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Pin {
  id: string;
  position: LatLng;
  label: string;
  note: string;
  color: PinColor;
  emoji: string;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

export type PinColor = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange';

export interface RouteStop {
  position: LatLng;
  label: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  from: RouteStop;
  to: RouteStop;
  mode: TransportMode;
  createdAt: string;
  isFavorite: boolean;
}

export interface SavedData {
  version: string;
  exportedAt: string;
  pins: Pin[];
  savedRoutes: SavedRoute[];
  favoriteLocations: FavoriteLocation[];
  notes: MapNote[];
}

export interface FavoriteLocation {
  id: string;
  name: string;
  position: LatLng;
  category: LocationCategory;
  emoji: string;
  addedAt: string;
}

export type LocationCategory =
  | 'restaurant'
  | 'cafe'
  | 'hotel'
  | 'attraction'
  | 'shopping'
  | 'transport'
  | 'other';

export interface MapNote {
  id: string;
  title: string;
  content: string;
  position: LatLng | null;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

export type ActivePanel = 'none' | 'route' | 'pins' | 'favorites' | 'notes' | 'settings';

export interface RouteResult {
  mode: TransportMode;
  durationMin: number;
  distanceKm: number;
  steps: string[];
  lines?: string[];
}

export interface TransitLine {
  id: string;
  name: string;
  type: TransportMode;
  color: string;
}
