import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useAppStore, AppState } from './hooks/useAppStore';
import { MapView, useMapView } from './components/map/MapView';
import RoutePanelComponent from './components/panels/RoutePanel';
import PinsPanelComponent from './components/panels/PinsPanel';
import NotesPanelComponent from './components/panels/NotesPanel';
import FavoritesPanelComponent from './components/panels/FavoritesPanel';
import SettingsPanelComponent from './components/panels/SettingsPanel';
import {
  IconRoute, IconPin, IconStar, IconNote, IconSettings,
  IconZoomIn, IconZoomOut, IconLocate, IconX,
} from './components/ui/Icons';
import { ActivePanel, LatLng } from './types';

interface NavItem {
  id: ActivePanel;
  Icon: React.FC<{ size?: number; className?: string }>;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'route',     Icon: IconRoute,    label: 'Route'     },
  { id: 'pins',      Icon: IconPin,      label: 'Pins'      },
  { id: 'favorites', Icon: IconStar,     label: 'Favorites' },
  { id: 'notes',     Icon: IconNote,     label: 'Notes'     },
  { id: 'settings',  Icon: IconSettings, label: 'Settings'  },
];

export default function App() {
  const store       = useAppStore();
  const mapInstance = useMapView();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady]           = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // ── Refs: defeat stale closures in Leaflet handlers ──────────────────────
  const activePanelRef  = useRef<ActivePanel>('none');
  const routeFromRef    = useRef<LatLng | null>(null);
  const routeToRef      = useRef<LatLng | null>(null);
  const setRouteFromFn  = useRef(store.setRouteFrom);
  const setRouteToFn    = useRef(store.setRouteTo);
  const addPinFn        = useRef(store.addPin);
  const updatePinFn     = useRef(store.updatePin);

  activePanelRef.current = store.activePanel;
  routeFromRef.current   = store.routeFrom;
  routeToRef.current     = store.routeTo;
  setRouteFromFn.current = store.setRouteFrom;
  setRouteToFn.current   = store.setRouteTo;
  addPinFn.current       = store.addPin;
  updatePinFn.current    = store.updatePin;

  // ── Programmatic fly guard — stops moveend feedback loop ─────────────────
  const isProgrammaticRef    = useRef(false);
  const programmaticDoneRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Drag guard: while marker is being dragged, block map clicks ──────────
  const isDraggingMarkerRef = useRef(false);

  // (double-click is now handled via Leaflet's native dblclick event)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Init map ONCE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = mapInstance.init(mapContainerRef.current, { lat: 41.0082, lng: 28.9784 }, 13);
    setMapReady(true);

    // Wire drag callbacks — always fresh via closure over refs
    mapInstance.onFromDragEnd = (pos) => {
      isDraggingMarkerRef.current = false;
      setRouteFromFn.current(pos);
    };
    mapInstance.onToDragEnd = (pos) => {
      isDraggingMarkerRef.current = false;
      setRouteToFn.current(pos);
    };

    // Block map clicks during marker drag
    map.on('dragstart', () => { isDraggingMarkerRef.current = true; });

    // Pending single-click timeout — cancelled if dblclick fires first
    let singleClickTimer: ReturnType<typeof setTimeout> | null = null;

    // dblclick: always drop a pin, cancel any pending single-click route action
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (isDraggingMarkerRef.current) return;
      if (singleClickTimer) { clearTimeout(singleClickTimer); singleClickTimer = null; }
      addPinFn.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      // Ignore if a marker drag just ended
      if (isDraggingMarkerRef.current) {
        isDraggingMarkerRef.current = false;
        return;
      }

      const pos: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };

      // Schedule single-click route action — will be cancelled if dblclick fires
      if (singleClickTimer) { clearTimeout(singleClickTimer); singleClickTimer = null; }

      singleClickTimer = setTimeout(() => {
        singleClickTimer = null;
        // Only set route points on single click when route panel is active
        if (activePanelRef.current === 'route') {
          if (!routeFromRef.current) {
            setRouteFromFn.current(pos);
          } else if (!routeToRef.current) {
            setRouteToFn.current(pos);
          } else {
            // Both set — reset A, clear B so user picks new start
            setRouteFromFn.current(pos);
            setRouteToFn.current(null);
          }
        }
        // On all other panels single-click does nothing — dblclick adds pins
      }, 280);
    });

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (singleClickTimer) { clearTimeout(singleClickTimer); singleClickTimer = null; }
      addPinFn.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    // moveend: only persist user-initiated movements
    map.on('moveend', () => {
      if (isProgrammaticRef.current) return;
      const c = map.getCenter();
      store.setMapCenter({ lat: c.lat, lng: c.lng });
      store.setMapZoom(map.getZoom());
    });

    return () => { mapInstance.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync pins ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    mapInstance.syncPins(
      store.data.pins,
      (id) => { store.selectPin(id); store.setActivePanel('pins'); },
      (id, pos) => updatePinFn.current(id, { position: pos }),
    );
  }, [store.data.pins, mapReady, mapInstance, store]);

  // ── Sync route — real OSRM routing ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    mapInstance.setRouteMarkers(store.routeFrom, store.routeTo);
    if (store.routeFrom && store.routeTo) {
      mapInstance.drawRouteReal(store.routeFrom, store.routeTo, store.routeMode);
    } else {
      mapInstance.clearRoute();
    }
  }, [store.routeFrom, store.routeTo, store.routeMode, mapReady, mapInstance]);

  // ── Programmatic fly: only when panel actions change mapCenter ────────────
  const lastFlyTargetRef = useRef<string>('');
  useEffect(() => {
    if (!mapReady) return;
    const key = `${store.mapCenter.lat.toFixed(5)},${store.mapCenter.lng.toFixed(5)},${store.mapZoom}`;
    if (key === lastFlyTargetRef.current) return;
    lastFlyTargetRef.current = key;

    isProgrammaticRef.current = true;
    if (programmaticDoneRef.current) clearTimeout(programmaticDoneRef.current);
    mapInstance.flyTo(store.mapCenter, store.mapZoom);
    programmaticDoneRef.current = setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 1400);
  }, [store.mapCenter, store.mapZoom, mapReady, mapInstance]);

  // ── Panel toggle ─────────────────────────────────────────────────────────
  const togglePanel = useCallback((id: ActivePanel) => {
    if (store.activePanel === id) {
      store.setActivePanel('none');
      setMobileDrawerOpen(false);
    } else {
      store.setActivePanel(id);
      setMobileDrawerOpen(true);
    }
  }, [store]);

  const closePanel = useCallback(() => {
    store.setActivePanel('none');
    setMobileDrawerOpen(false);
  }, [store]);

  const renderPanel = () => {
    switch (store.activePanel) {
      case 'route':
        return (
          <RoutePanelComponent
            state={{ routeFrom: store.routeFrom, routeTo: store.routeTo, routeMode: store.routeMode, data: store.data }}
            actions={{ setRouteFrom: store.setRouteFrom, setRouteTo: store.setRouteTo, setRouteMode: store.setRouteMode, saveRoute: store.saveRoute, deleteRoute: store.deleteRoute, notify: store.notify }}
            routeFromLabel={store.routeFromLabel}
            routeToLabel={store.routeToLabel}
            setRouteFromLabel={store.setRouteFromLabel}
            setRouteToLabel={store.setRouteToLabel}
          />
        );
      case 'pins':
        return (
          <PinsPanelComponent
            state={{ data: store.data, selectedPinId: store.selectedPinId }}
            actions={{ updatePin: store.updatePin, deletePin: store.deletePin, selectPin: store.selectPin, togglePinFavorite: store.togglePinFavorite, flyToPin: store.flyToPin }}
          />
        );
      case 'favorites':
        return (
          <FavoritesPanelComponent
            state={{ data: store.data }}
            actions={{ addFavorite: store.addFavorite, deleteFavorite: store.deleteFavorite, setMapCenter: store.setMapCenter, setMapZoom: store.setMapZoom }}
          />
        );
      case 'notes':
        return (
          <NotesPanelComponent
            state={{ data: store.data }}
            actions={{ addNote: store.addNote, updateNote: store.updateNote, deleteNote: store.deleteNote }}
          />
        );
      case 'settings':
        return (
          <SettingsPanelComponent
            state={{ data: store.data }}
            actions={{ exportData: store.exportData, importData: store.importData, resetData: store.resetData, notify: store.notify }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full overflow-hidden" style={{ background: '#050506', fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>

      {/* ══════════ DESKTOP ══════════ */}
      {!isMobile && (
        <div className="flex h-full">
          {/* Sidebar nav */}
          <nav className="flex flex-col items-center gap-1 py-5 px-2 w-16 z-20 flex-shrink-0"
               style={{ background: '#0b0c10', borderRight: '1px solid rgba(233,228,218,0.10)' }}>
            <div className="mb-5 select-none">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-void text-[9px] font-bold font-mono shadow-glow"
                   style={{ background: '#e9e4da' }}>
                IST
              </div>
            </div>
            {NAV_ITEMS.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                title={label}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                style={{
                  background: store.activePanel === id ? 'rgba(233,228,218,0.12)' : 'transparent',
                  color:      store.activePanel === id ? '#e9e4da' : '#6d727b',
                  boxShadow:  store.activePanel === id ? '0 0 0 1px rgba(233,228,218,0.2)' : 'none',
                }}
              >
                <Icon size={19} />
              </button>
            ))}
            <div className="flex-1" />
            <div className="text-[9px] font-mono" style={{ color: '#2b3038' }}>NAV</div>
          </nav>

          {/* Side panel */}
          {store.activePanel !== 'none' && (
            <aside className="w-80 flex flex-col h-full z-10 relative flex-shrink-0"
                   style={{ background: '#0b0c10', borderRight: '1px solid rgba(233,228,218,0.10)' }}>
              <button
                onClick={closePanel}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-colors z-10"
                style={{ background: 'rgba(233,228,218,0.08)', color: '#6d727b' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}
              >
                <IconX size={12} strokeWidth={2.5} />
              </button>
              <div className="flex-1 min-h-0 overflow-hidden">{renderPanel()}</div>
            </aside>
          )}

          {/* Map */}
          <div className="flex-1 relative min-w-0">
            <div ref={mapContainerRef} className="w-full h-full" />
            <MapHints activePanel={store.activePanel} routeFrom={store.routeFrom} routeTo={store.routeTo} />
            <ZoomControls map={mapInstance} />
            <Notification notification={store.notification} />
          </div>
        </div>
      )}

      {/* ══════════ MOBILE ══════════ */}
      {isMobile && (
        <div className="flex flex-col h-full">
          {/* Map area */}
          <div className="flex-1 relative min-h-0">
            <div ref={mapContainerRef} className="w-full h-full" />
            <MapHints activePanel={store.activePanel} routeFrom={store.routeFrom} routeTo={store.routeTo} />
            <ZoomControls map={mapInstance} />
            <Notification notification={store.notification} />

            {/* Floating header */}
            <div className="absolute top-0 left-0 right-0 pointer-events-none p-3" style={{ zIndex: 9999 }}>
              <div className="flex items-center gap-2 rounded-2xl px-3 py-2 pointer-events-auto"
                   style={{ background: 'rgba(11,12,16,0.92)', backdropFilter: 'blur(12px)', border: '1px solid rgba(233,228,218,0.12)' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-void text-[8px] font-bold font-mono flex-shrink-0"
                     style={{ background: '#e9e4da' }}>
                  IST
                </div>
                <span className="text-sm font-semibold" style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                  Istanbul Navigator
                </span>
              </div>
            </div>
          </div>

          {/* Drawer */}
          {mobileDrawerOpen && store.activePanel !== 'none' && (
            <div className="flex flex-col flex-shrink-0"
                 style={{ height: '56vh', maxHeight: '56vh', background: '#0b0c10', borderTop: '1px solid rgba(233,228,218,0.12)' }}>
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                   style={{ borderBottom: '1px solid rgba(233,228,218,0.10)' }}>
                <span className="text-sm font-semibold" style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                  {NAV_ITEMS.find((n) => n.id === store.activePanel)?.label}
                </span>
                <button
                  onClick={closePanel}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(233,228,218,0.08)', color: '#6d727b' }}
                >
                  <IconX size={13} strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">{renderPanel()}</div>
            </div>
          )}

          {/* Bottom nav */}
          <nav
            className="flex items-center justify-around px-1 flex-shrink-0 z-20"
            style={{
              background:   '#0b0c10',
              borderTop:    '1px solid rgba(233,228,218,0.10)',
              paddingTop:   '8px',
              paddingBottom: 'max(env(safe-area-inset-bottom,0px),10px)',
            }}
          >
            {NAV_ITEMS.map(({ id, Icon, label }) => (
              <button
                key={id}
                onClick={() => togglePanel(id)}
                className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all"
                style={{ color: store.activePanel === id ? '#e9e4da' : '#6d727b', minWidth: '52px' }}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium font-mono">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MapHintsProps {
  activePanel: ActivePanel;
  routeFrom: LatLng | null;
  routeTo:   LatLng | null;
}

function MapHints({ activePanel, routeFrom, routeTo }: MapHintsProps) {
  let hint = '';
  if (activePanel === 'route') {
    if (!routeFrom) hint = 'Search or click the map to set start point A';
    else if (!routeTo) hint = 'Search or click the map to set destination B';
    else hint = 'Drag A or B to adjust the route';
  } else {
    hint = 'Double-click or right-click to drop a pin';
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none px-3 w-full flex justify-center" style={{ zIndex: 9999 }}>
      <div
        className="rounded-full px-4 py-2 text-xs text-center whitespace-nowrap max-w-xs"
        style={{
          background:   'rgba(11,12,16,0.88)',
          backdropFilter: 'blur(10px)',
          border:       '1px solid rgba(233,228,218,0.12)',
          color:        '#6d727b',
          fontFamily:   "'JetBrains Mono',monospace",
          letterSpacing: '0.02em',
        }}
      >
        {hint}
      </div>
    </div>
  );
}

function ZoomControls({ map }: { map: MapView }) {
  const leafletMap = map.getMap();
  const btnStyle: React.CSSProperties = {
    width: '36px', height: '36px',
    background:  'rgba(11,12,16,0.92)',
    border:      '1px solid rgba(233,228,218,0.18)',
    borderRadius: '10px',
    color:       '#e9e4da',
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'center',
    cursor:      'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow:   '0 2px 12px rgba(0,0,0,0.5)',
    transition:  'background 0.15s, border-color 0.15s',
  };

  return (
    <div className="absolute top-16 right-3 flex flex-col gap-1.5" style={{ zIndex: 9999 }}>
      <button style={btnStyle} onClick={() => leafletMap?.zoomIn()}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(11,12,16,0.92)')}>
        <IconZoomIn size={16} />
      </button>
      <button style={btnStyle} onClick={() => leafletMap?.zoomOut()}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(11,12,16,0.92)')}>
        <IconZoomOut size={16} />
      </button>
      <button style={{ ...btnStyle, marginTop: '4px' }}
        onClick={() => leafletMap?.locate({ setView: true, maxZoom: 16 })}
        title="My location"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(11,12,16,0.92)')}>
        <IconLocate size={15} />
      </button>
    </div>
  );
}

function Notification({ notification }: { notification: AppState['notification'] | null | undefined }) {
  if (!notification) return null;
  const styles: Record<string, React.CSSProperties> = {
    success: { borderColor: '#2dd4bf', background: 'rgba(45,212,191,0.08)', color: '#2dd4bf' },
    error:   { borderColor: '#f43f5e', background: 'rgba(244,63,94,0.08)',  color: '#f43f5e' },
    info:    { borderColor: 'rgba(233,228,218,0.2)', background: 'rgba(233,228,218,0.05)', color: '#9a9d95' },
  };
  return (
    <div
      className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
      style={{ border: '1px solid', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', letterSpacing: '0.02em', zIndex: 9999, ...styles[notification.type] }}
    >
      {notification.message}
    </div>
  );
}
