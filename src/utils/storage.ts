import { SavedData, Pin, SavedRoute, FavoriteLocation, MapNote } from '../types';

const DATA_VERSION = '1.0.0';

export function createEmptySavedData(): SavedData {
  return {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    pins: [],
    savedRoutes: [],
    favoriteLocations: [],
    notes: [],
  };
}

export function exportDataToFile(data: SavedData): void {
  const payload: SavedData = { ...data, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `istanbul-navigator-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importDataFromFile(file: File): Promise<SavedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as SavedData;
        if (!parsed.version || !Array.isArray(parsed.pins)) {
          reject(new Error('Invalid file format'));
          return;
        }
        resolve({
          ...createEmptySavedData(),
          ...parsed,
          version: DATA_VERSION,
        });
      } catch {
        reject(new Error('Could not parse file'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function mergeData(existing: SavedData, incoming: SavedData): SavedData {
  const mergeById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    a.forEach((item) => map.set(item.id, item));
    b.forEach((item) => map.set(item.id, item));
    return Array.from(map.values());
  };

  return {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    pins: mergeById<Pin>(existing.pins, incoming.pins),
    savedRoutes: mergeById<SavedRoute>(existing.savedRoutes, incoming.savedRoutes),
    favoriteLocations: mergeById<FavoriteLocation>(
      existing.favoriteLocations,
      incoming.favoriteLocations
    ),
    notes: mergeById<MapNote>(existing.notes, incoming.notes),
  };
}

const SESSION_KEY = 'istanbul_nav_session';

export function loadSessionData(): SavedData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedData;
  } catch {
    return null;
  }
}

export function saveSessionData(data: SavedData): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Session storage full; silently ignore
  }
}
