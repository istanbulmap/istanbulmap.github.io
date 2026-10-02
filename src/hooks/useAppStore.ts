import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  SavedData, Pin, PinColor, FavoriteLocation, LocationCategory,
  MapNote, SavedRoute, LatLng, TransportMode, ActivePanel,
} from '../types';
import {
  createEmptySavedData, exportDataToFile, importDataFromFile,
  mergeData, loadSessionData, saveSessionData,
} from '../utils/storage';

export interface AppState {
  data: SavedData;
  activePanel: ActivePanel;
  selectedPinId: string | null;
  routeFrom: LatLng | null;
  routeTo: LatLng | null;
  routeFromLabel: string;
  routeToLabel: string;
  routeMode: TransportMode;
  mapCenter: LatLng;
  mapZoom: number;
  searchQuery: string;
  notification: { message: string; type: 'success' | 'error' | 'info' } | null;
}

export interface AppActions {
  // Panels
  setActivePanel: (panel: ActivePanel) => void;

  // Pins
  addPin: (position: LatLng, label?: string) => void;
  updatePin: (id: string, updates: Partial<Pin>) => void;
  deletePin: (id: string) => void;
  selectPin: (id: string | null) => void;
  togglePinFavorite: (id: string) => void;

  // Favorites
  addFavorite: (name: string, position: LatLng, category: LocationCategory, emoji: string) => void;
  deleteFavorite: (id: string) => void;

  // Notes
  addNote: (title: string, content: string, position?: LatLng) => void;
  updateNote: (id: string, updates: Partial<MapNote>) => void;
  deleteNote: (id: string) => void;

  // Routes
  setRouteFrom: (pos: LatLng | null) => void;
  setRouteTo: (pos: LatLng | null) => void;
  setRouteFromLabel: (label: string) => void;
  setRouteToLabel: (label: string) => void;
  setRouteMode: (mode: TransportMode) => void;
  saveRoute: (name: string) => void;
  deleteRoute: (id: string) => void;

  // Map
  setMapCenter: (center: LatLng) => void;
  setMapZoom: (zoom: number) => void;
  flyToPin: (id: string) => void;

  // Data
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  resetData: () => void;

  // Search
  setSearchQuery: (q: string) => void;

  // Notification
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
}

const ISTANBUL_CENTER: LatLng = { lat: 41.0082, lng: 28.9784 };

export function useAppStore(): AppState & AppActions {
  const [data, setData] = useState<SavedData>(() => {
    const session = loadSessionData();
    return session ?? createEmptySavedData();
  });

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [routeFrom, setRouteFrom] = useState<LatLng | null>(null);
  const [routeTo, setRouteTo] = useState<LatLng | null>(null);
  const [routeFromLabel, setRouteFromLabel] = useState<string>('');
  const [routeToLabel, setRouteToLabel] = useState<string>('');
  const [routeMode, setRouteMode] = useState<TransportMode>('metro');
  const [mapCenter, setMapCenter] = useState<LatLng>(ISTANBUL_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<AppState['notification']>(null);

  // Persist to session on every data change
  useEffect(() => {
    saveSessionData(data);
  }, [data]);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const clearNotification = useCallback(() => setNotification(null), []);

  const mutateData = useCallback((fn: (d: SavedData) => SavedData) => {
    setData((prev) => fn(prev));
  }, []);

  // --- Pins ---
  const addPin = useCallback((position: LatLng, label = 'My Pin') => {
    const pin: Pin = {
      id: uuidv4(),
      position,
      label,
      note: '',
      color: 'blue',
      emoji: 'pin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false,
    };
    mutateData((d) => ({ ...d, pins: [...d.pins, pin] }));
    notify('Pin added', 'success');
  }, [mutateData, notify]);

  const updatePin = useCallback((id: string, updates: Partial<Pin>) => {
    mutateData((d) => ({
      ...d,
      pins: d.pins.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }));
  }, [mutateData]);

  const deletePin = useCallback((id: string) => {
    mutateData((d) => ({ ...d, pins: d.pins.filter((p) => p.id !== id) }));
    setSelectedPinId(null);
    notify('Pin removed', 'info');
  }, [mutateData, notify]);

  const selectPin = useCallback((id: string | null) => {
    setSelectedPinId(id);
  }, []);

  const togglePinFavorite = useCallback((id: string) => {
    mutateData((d) => ({
      ...d,
      pins: d.pins.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      ),
    }));
  }, [mutateData]);

  // --- Favorites ---
  const addFavorite = useCallback(
    (name: string, position: LatLng, category: LocationCategory, emoji: string) => {
      const fav: FavoriteLocation = {
        id: uuidv4(),
        name,
        position,
        category,
        emoji,
        addedAt: new Date().toISOString(),
      };
      mutateData((d) => ({ ...d, favoriteLocations: [...d.favoriteLocations, fav] }));
      notify('Added to favorites', 'success');
    },
    [mutateData, notify]
  );

  const deleteFavorite = useCallback((id: string) => {
    mutateData((d) => ({
      ...d,
      favoriteLocations: d.favoriteLocations.filter((f) => f.id !== id),
    }));
    notify('Removed from favorites', 'info');
  }, [mutateData, notify]);

  // --- Notes ---
  const addNote = useCallback(
    (title: string, content: string, position?: LatLng) => {
      const note: MapNote = {
        id: uuidv4(),
        title,
        content,
        position: position ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pinned: false,
      };
      mutateData((d) => ({ ...d, notes: [...d.notes, note] }));
      notify('Note saved', 'success');
    },
    [mutateData, notify]
  );

  const updateNote = useCallback((id: string, updates: Partial<MapNote>) => {
    mutateData((d) => ({
      ...d,
      notes: d.notes.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    }));
  }, [mutateData]);

  const deleteNote = useCallback((id: string) => {
    mutateData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    notify('Note deleted', 'info');
  }, [mutateData, notify]);

  // --- Routes ---
  const saveRoute = useCallback(
    (name: string) => {
      if (!routeFrom || !routeTo) return;
      const route: SavedRoute = {
        id: uuidv4(),
        name,
        from: { position: routeFrom, label: 'Start' },
        to: { position: routeTo, label: 'End' },
        mode: routeMode,
        createdAt: new Date().toISOString(),
        isFavorite: false,
      };
      mutateData((d) => ({ ...d, savedRoutes: [...d.savedRoutes, route] }));
      notify('Route saved', 'success');
    },
    [routeFrom, routeTo, routeMode, mutateData, notify]
  );

  const deleteRoute = useCallback((id: string) => {
    mutateData((d) => ({
      ...d,
      savedRoutes: d.savedRoutes.filter((r) => r.id !== id),
    }));
    notify('Route removed', 'info');
  }, [mutateData, notify]);

  // --- Map ---
  const flyToPin = useCallback((id: string) => {
    const pin = data.pins.find((p) => p.id === id);
    if (pin) {
      setMapCenter(pin.position);
      setMapZoom(17);
    }
  }, [data.pins]);

  // --- Data IO ---
  const exportData = useCallback(() => {
    exportDataToFile(data);
    notify('Data exported to file', 'success');
  }, [data, notify]);

  const importData = useCallback(async (file: File) => {
    try {
      const imported = await importDataFromFile(file);
      setData((prev) => mergeData(prev, imported));
      notify('Data imported and merged', 'success');
    } catch (err) {
      notify((err as Error).message, 'error');
    }
  }, [notify]);

  const resetData = useCallback(() => {
    setData(createEmptySavedData());
    notify('All data cleared', 'info');
  }, [notify]);

  return {
    data,
    activePanel,
    selectedPinId,
    routeFrom,
    routeTo,
    routeFromLabel,
    routeToLabel,
    routeMode,
    mapCenter,
    mapZoom,
    searchQuery,
    notification,

    setActivePanel,
    addPin,
    updatePin,
    deletePin,
    selectPin,
    togglePinFavorite,
    addFavorite,
    deleteFavorite,
    addNote,
    updateNote,
    deleteNote,
    setRouteFrom: useCallback((pos: LatLng | null) => setRouteFrom(pos), []),
    setRouteTo: useCallback((pos: LatLng | null) => setRouteTo(pos), []),
    setRouteFromLabel: useCallback((l: string) => setRouteFromLabel(l), []),
    setRouteToLabel: useCallback((l: string) => setRouteToLabel(l), []),
    setRouteMode: useCallback((mode: TransportMode) => setRouteMode(mode), []),
    saveRoute,
    deleteRoute,
    setMapCenter: useCallback((c) => setMapCenter(c), []),
    setMapZoom: useCallback((z) => setMapZoom(z), []),
    flyToPin,
    exportData,
    importData,
    resetData,
    setSearchQuery: useCallback((q) => setSearchQuery(q), []),
    notify,
    clearNotification,
  };
}
