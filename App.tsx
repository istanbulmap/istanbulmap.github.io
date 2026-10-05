import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return isMobile;
}

export default function App() {
  const store       = useAppStore();
  const mapInstance = useMapView();
  const isMobile    = useIsMobile();

  /**
   * KEY FIX — single map container.
   *
   * Previously mapContainerRef was rendered inside two separate JSX branches
   * (!isMobile / isMobile). When isMobile flipped, React unmounted one branch
   * and mounted the other, destroying the DOM node Leaflet was attached to.
   * The map never re-initialised because the init useEffect runs only once.
   * Result: black screen.
   *
   * Solution: one <div ref={mapContainerRef}> that is ALWAYS in the DOM,
   * positioned absolutely to fill its parent. The desktop sidebar and mobile
   * chrome are overlaid on top of it. Leaflet always has the same live node.
   */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  // activeEndpoint: which pin the next map-click places
  const [activeEndpoint, setActiveEndpoint] = useState<'A' | 'B' | null>('A');

  // Mobile bottom-sheet state: 'hidden' | 'peek' | 'half' | 'full'
  type SheetState = 'hidden' | 'peek' | 'half' | 'full';
  const [sheetState, setSheetState] = useState<SheetState>('hidden');

  // Stale-closure refs for Leaflet handlers
  const activePanelRef    = useRef<ActivePanel>('none');
  const routeFromRef      = useRef<LatLng | null>(null);
  const routeToRef        = useRef<LatLng | null>(null);
  const activeEndpointRef = useRef<'A' | 'B' | null>('A');
  const setRouteFromFn    = useRef(store.setRouteFrom);
  const setRouteToFn      = useRef(store.setRouteTo);
  const addPinFn          = useRef(store.addPin);
  const updatePinFn       = useRef(store.updatePin);

  activePanelRef.current    = store.activePanel;
  routeFromRef.current      = store.routeFrom;
  routeToRef.current        = store.routeTo;
  activeEndpointRef.current = activeEndpoint;
  setRouteFromFn.current    = store.setRouteFrom;
  setRouteToFn.current      = store.setRouteTo;
  addPinFn.current          = store.addPin;
  updatePinFn.current       = store.updatePin;

  const isProgrammaticRef   = useRef(false);
  const programmaticDoneRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingMarkerRef = useRef(false);

  // ── Init map ONCE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = mapInstance.init(mapContainerRef.current, { lat: 41.0082, lng: 28.9784 }, 13);

    map.once('load', () => setMapReady(true));
    setTimeout(() => setMapReady((p) => p || true), 300);

    mapInstance.onFromDragEnd = (pos) => {
      isDraggingMarkerRef.current = false;
      setRouteFromFn.current(pos);
    };
    mapInstance.onToDragEnd = (pos) => {
      isDraggingMarkerRef.current = false;
      setRouteToFn.current(pos);
    };

    map.on('dragstart', () => { isDraggingMarkerRef.current = true; });

    let clickTimer: ReturnType<typeof setTimeout> | null = null;

    map.on('dblclick', (e: L.LeafletMouseEvent) => {
      if (isDraggingMarkerRef.current) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      addPinFn.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isDraggingMarkerRef.current) { isDraggingMarkerRef.current = false; return; }
      const pos: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (activePanelRef.current !== 'route') return;
        const ep = activeEndpointRef.current;
        if (ep === 'A' || !routeFromRef.current) {
          setRouteFromFn.current(pos);
          setActiveEndpoint(!routeToRef.current ? 'B' : null);
        } else if (ep === 'B' || !routeToRef.current) {
          setRouteToFn.current(pos);
          setActiveEndpoint(null);
        } else {
          setRouteFromFn.current(pos);
          setRouteToFn.current(null);
          setActiveEndpoint('B');
        }
      }, 260);
    });

    map.on('contextmenu', (e: L.LeafletMouseEvent) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      addPinFn.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    map.on('moveend', () => {
      if (isProgrammaticRef.current) return;
      const c = map.getCenter();
      store.setMapCenter({ lat: c.lat, lng: c.lng });
      store.setMapZoom(map.getZoom());
    });

    return () => { mapInstance.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Invalidate size whenever layout changes (isMobile flip) ──────────────
  // useLayoutEffect fires synchronously after DOM mutations, before paint —
  // so Leaflet measures the correct container size on the same frame.
  useLayoutEffect(() => {
    mapInstance.invalidateSize();
  }, [isMobile, mapInstance]);

  // ── Sync pins ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    mapInstance.syncPins(
      store.data.pins,
      (id) => { store.selectPin(id); store.setActivePanel('pins'); },
      (id, pos) => updatePinFn.current(id, { position: pos }),
    );
  }, [store.data.pins, mapReady, mapInstance, store]);

  // ── Sync route ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    mapInstance.setRouteMarkers(store.routeFrom, store.routeTo);
    if (store.routeFrom && store.routeTo) {
      mapInstance.drawRouteReal(store.routeFrom, store.routeTo, store.routeMode);
    } else {
      mapInstance.clearRoute();
    }
  }, [store.routeFrom, store.routeTo, store.routeMode, mapReady, mapInstance]);

  // ── Programmatic fly ──────────────────────────────────────────────────────
  const lastFlyTargetRef = useRef('');
  useEffect(() => {
    if (!mapReady) return;
    const key = `${store.mapCenter.lat.toFixed(5)},${store.mapCenter.lng.toFixed(5)},${store.mapZoom}`;
    if (key === lastFlyTargetRef.current) return;
    lastFlyTargetRef.current = key;
    isProgrammaticRef.current = true;
    if (programmaticDoneRef.current) clearTimeout(programmaticDoneRef.current);
    mapInstance.flyTo(store.mapCenter, store.mapZoom);
    programmaticDoneRef.current = setTimeout(() => { isProgrammaticRef.current = false; }, 1400);
  }, [store.mapCenter, store.mapZoom, mapReady, mapInstance]);

  // ── Active endpoint resets ────────────────────────────────────────────────
  useEffect(() => {
    if (store.activePanel === 'route') {
      if (!store.routeFrom)      setActiveEndpoint('A');
      else if (!store.routeTo)   setActiveEndpoint('B');
      else                       setActiveEndpoint(null);
    }
  }, [store.activePanel, store.routeFrom, store.routeTo]);

  // ── Panel/sheet helpers ───────────────────────────────────────────────────
  const openPanel = useCallback((id: ActivePanel) => {
    if (store.activePanel === id) {
      store.setActivePanel('none');
      setSheetState('hidden');
    } else {
      store.setActivePanel(id);
      setSheetState(id === 'route' ? 'peek' : 'half');
    }
  }, [store]);

  const closePanel = useCallback(() => {
    store.setActivePanel('none');
    setSheetState('hidden');
  }, [store]);

  // ── Render panel content ──────────────────────────────────────────────────
  const routePanelProps = {
    state:   { routeFrom: store.routeFrom, routeTo: store.routeTo, routeMode: store.routeMode, data: store.data },
    actions: { setRouteFrom: store.setRouteFrom, setRouteTo: store.setRouteTo, setRouteMode: store.setRouteMode, saveRoute: store.saveRoute, deleteRoute: store.deleteRoute, notify: store.notify },
    routeFromLabel: store.routeFromLabel, routeToLabel: store.routeToLabel,
    setRouteFromLabel: store.setRouteFromLabel, setRouteToLabel: store.setRouteToLabel,
    activeEndpoint, onSetActiveEndpoint: setActiveEndpoint,
  };

  const renderPanelContent = (compact = false) => {
    switch (store.activePanel) {
      case 'route':     return <RoutePanelComponent {...routePanelProps} compact={compact} />;
      case 'pins':      return <PinsPanelComponent state={{ data: store.data, selectedPinId: store.selectedPinId }} actions={{ updatePin: store.updatePin, deletePin: store.deletePin, selectPin: store.selectPin, togglePinFavorite: store.togglePinFavorite, flyToPin: store.flyToPin }} />;
      case 'favorites': return <FavoritesPanelComponent state={{ data: store.data }} actions={{ addFavorite: store.addFavorite, deleteFavorite: store.deleteFavorite, setMapCenter: store.setMapCenter, setMapZoom: store.setMapZoom }} mapCenter={store.mapCenter} />;
      case 'notes':     return <NotesPanelComponent state={{ data: store.data }} actions={{ addNote: store.addNote, updateNote: store.updateNote, deleteNote: store.deleteNote }} mapCenter={store.mapCenter} />;
      case 'settings':  return <SettingsPanelComponent state={{ data: store.data }} actions={{ exportData: store.exportData, importData: store.importData, resetData: store.resetData, notify: store.notify }} />;
      default:          return null;
    }
  };

  // Sheet heights (% of viewport height)
  const SHEET_H: Record<SheetState, string> = {
    hidden: '0px',
    peek:   '200px',   // just inputs visible, map takes most of screen
    half:   '48vh',
    full:   '85vh',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050506', overflow: 'hidden' }}>

      {/* ══ MAP — always mounted, always filling parent ══════════════════════ */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute', inset: 0,
          // On desktop, leave room for the sidebar (64px nav + optional 320px panel)
          left: isMobile ? 0 : (store.activePanel !== 'none' ? 384 : 64),
          transition: 'left 0.25s ease',
        }}
      />

      {/* ══ DESKTOP LAYOUT ════════════════════════════════════════════════════ */}
      {!isMobile && (
        <>
          {/* Nav sidebar */}
          <nav style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 64,
            background: '#0b0c10', borderRight: '1px solid rgba(233,228,218,0.10)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px 8px', zIndex: 100, gap: 4,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: '#e9e4da',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: '#050506',
              marginBottom: 20, flexShrink: 0,
            }}>IST</div>

            {NAV_ITEMS.map(({ id, Icon, label }) => (
              <button key={id} onClick={() => openPanel(id)} title={label} style={{
                width: 40, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: store.activePanel === id ? 'rgba(233,228,218,0.12)' : 'transparent',
                color:      store.activePanel === id ? '#e9e4da' : '#6d727b',
                boxShadow:  store.activePanel === id ? '0 0 0 1px rgba(233,228,218,0.18)' : 'none',
                transition: 'background 0.15s, color 0.15s',
              }}>
                <Icon size={19} />
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#2b3038' }}>NAV</span>
          </nav>

          {/* Side panel */}
          {store.activePanel !== 'none' && (
            <aside style={{
              position: 'absolute', left: 64, top: 0, bottom: 0, width: 320,
              background: '#0b0c10', borderRight: '1px solid rgba(233,228,218,0.10)',
              display: 'flex', flexDirection: 'column', zIndex: 99,
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid rgba(233,228,218,0.08)',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6d727b' }}>
                  {NAV_ITEMS.find((n) => n.id === store.activePanel)?.label}
                </span>
                <button onClick={closePanel} style={{
                  width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'rgba(233,228,218,0.08)', color: '#6d727b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#e9e4da'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#6d727b'; }}
                >
                  <IconX size={12} strokeWidth={2.5} />
                </button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {renderPanelContent(false)}
              </div>
            </aside>
          )}

          {/* Desktop map overlays */}
          <MapHints activePanel={store.activePanel} routeFrom={store.routeFrom} routeTo={store.routeTo} activeEndpoint={activeEndpoint} isMobile={false} />
          <ZoomControls map={mapInstance} />
          <Notification notification={store.notification} />
        </>
      )}

      {/* ══ MOBILE LAYOUT ═════════════════════════════════════════════════════
          The map fills the whole screen. Everything else floats on top.
          Bottom sheet slides up from the bottom — it does NOT push the map.
      ══════════════════════════════════════════════════════════════════════ */}
      {isMobile && (
        <>
          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200,
            padding: '10px 12px',
            pointerEvents: 'none',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 16,
              background: 'rgba(11,12,16,0.92)', backdropFilter: 'blur(14px)',
              border: '1px solid rgba(233,228,218,0.12)',
              pointerEvents: 'auto',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 7, background: '#e9e4da',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 700, fontFamily: 'monospace', color: '#050506', flexShrink: 0,
              }}>IST</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                Istanbul Navigator
              </span>
            </div>
          </div>

          {/* Map overlays */}
          <ZoomControls map={mapInstance} />
          <Notification notification={store.notification} />
          <MapHints activePanel={store.activePanel} routeFrom={store.routeFrom} routeTo={store.routeTo} activeEndpoint={activeEndpoint} isMobile sheetState={sheetState} />

          {/* ── Bottom sheet ─────────────────────────────────────────────────
              Overlays the map. Does NOT affect map container size, so
              Leaflet stays fully rendered behind it at all times.
          ─────────────────────────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 52, // above tab bar
            height: sheetState === 'hidden' ? 0 : SHEET_H[sheetState],
            maxHeight: '85vh',
            background: '#0b0c10',
            borderTop: '2px solid rgba(233,228,218,0.10)',
            borderRadius: '20px 20px 0 0',
            zIndex: 150,
            overflow: 'hidden',
            transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          }}>
            {store.activePanel !== 'none' && sheetState !== 'hidden' && (
              <>
                {/* Drag handle + header */}
                <div
                  style={{ flexShrink: 0, cursor: 'ns-resize' }}
                  onClick={() => {
                    if (sheetState === 'peek') setSheetState('half');
                    else if (sheetState === 'half') setSheetState('full');
                    else setSheetState('peek');
                  }}
                >
                  {/* Handle pill */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(233,228,218,0.18)' }} />
                  </div>
                  {/* Title row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 14px 8px',
                    borderBottom: '1px solid rgba(233,228,218,0.08)',
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                      {NAV_ITEMS.find((n) => n.id === store.activePanel)?.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Expand/collapse toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSheetState(sheetState === 'full' ? 'peek' : 'full'); }}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(233,228,218,0.07)', color: '#6d727b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontFamily: 'monospace',
                        }}
                      >
                        {sheetState === 'full' ? '↓' : '↑'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); closePanel(); }}
                        style={{
                          width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(233,228,218,0.07)', color: '#6d727b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <IconX size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scrollable panel content */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  {renderPanelContent(true)}
                </div>
              </>
            )}
          </div>

          {/* ── Bottom tab bar ──────────────────────────────────────────────── */}
          <nav style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200,
            background: '#0b0c10', borderTop: '1px solid rgba(233,228,218,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            paddingTop: 8,
            paddingBottom: 'max(env(safe-area-inset-bottom,0px),10px)',
          }}>
            {NAV_ITEMS.map(({ id, Icon, label }) => (
              <button key={id} onClick={() => openPanel(id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '2px 12px 4px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: store.activePanel === id ? '#e9e4da' : '#6d727b',
                minWidth: 52,
              }}>
                <Icon size={20} />
                <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 500 }}>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

// ── MapHints ──────────────────────────────────────────────────────────────────

interface MapHintsProps {
  activePanel:    ActivePanel;
  routeFrom:      LatLng | null;
  routeTo:        LatLng | null;
  activeEndpoint: 'A' | 'B' | null;
  isMobile:       boolean;
  sheetState?:    string;
}

function MapHints({ activePanel, routeFrom, routeTo, activeEndpoint, isMobile, sheetState }: MapHintsProps) {
  // On mobile, hide hint when sheet is full (map is mostly hidden anyway)
  if (isMobile && sheetState === 'full') return null;

  let hint = '';
  if (activePanel === 'route') {
    if (!routeFrom)                   hint = 'Tap map to place start point A';
    else if (!routeTo)                hint = 'Tap map to place destination B';
    else if (activeEndpoint === 'A')  hint = 'Tap to move start point A';
    else if (activeEndpoint === 'B')  hint = 'Tap to move destination B';
    else                              hint = 'Drag A or B pins to adjust route';
  } else {
    hint = 'Double-tap or long-press to drop a pin';
  }

  // On mobile, position hint just above the bottom sheet
  const bottomOffset = isMobile
    ? (sheetState === 'hidden' ? '66px' : sheetState === 'peek' ? '218px' : '50vh')
    : '24px';

  return (
    <div style={{
      position: 'absolute', bottom: bottomOffset, left: 0, right: 0,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
      zIndex: 140, transition: 'bottom 0.3s ease', padding: '0 16px',
    }}>
      <div style={{
        padding: '6px 16px', borderRadius: 100,
        background: 'rgba(11,12,16,0.88)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(233,228,218,0.12)',
        color: '#6d727b', fontSize: 11,
        fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}>
        {hint}
      </div>
    </div>
  );
}

// ── Live location pulse CSS ────────────────────────────────────────────────────

function ensurePulseStyle() {
  if (document.getElementById('ist-pulse-style')) return;
  const s = document.createElement('style');
  s.id = 'ist-pulse-style';
  s.textContent = `
    @keyframes ist-pulse {
      0%   { transform: scale(1);   opacity: 0.55; }
      70%  { transform: scale(2.8); opacity: 0;    }
      100% { transform: scale(2.8); opacity: 0;    }
    }
    .ist-loc-pulse { animation: ist-pulse 2s ease-out infinite; }
  `;
  document.head.appendChild(s);
}

function createLocationIcon(): L.DivIcon {
  ensurePulseStyle();
  return L.divIcon({
    className: '', iconAnchor: [12, 12], iconSize: [24, 24],
    html: `<div style="position:relative;width:24px;height:24px;">
      <div class="ist-loc-pulse" style="position:absolute;inset:0;border-radius:50%;background:rgba(45,212,191,0.3);"></div>
      <div style="position:absolute;inset:2px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(45,212,191,0.7),0 2px 8px rgba(0,0,0,0.5);"></div>
      <div style="position:absolute;inset:5px;border-radius:50%;background:#2dd4bf;"></div>
    </div>`,
  });
}

// ── ZoomControls + live location ──────────────────────────────────────────────

function ZoomControls({ map }: { map: MapView }) {
  const leafletMap = map.getMap();
  const [tracking, setTracking] = React.useState(false);
  const [hasError,  setHasError]  = React.useState(false);
  const watchIdRef        = React.useRef<number | null>(null);
  const markerRef         = React.useRef<L.Marker | null>(null);
  const circleRef         = React.useRef<L.Circle | null>(null);
  const hasFlewRef        = React.useRef(false);

  const clearLayers = React.useCallback(() => {
    markerRef.current?.remove(); markerRef.current = null;
    circleRef.current?.remove(); circleRef.current = null;
  }, []);

  const stopTracking = React.useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    clearLayers(); hasFlewRef.current = false;
    setTracking(false); setHasError(false);
  }, [clearLayers]);

  const startTracking = React.useCallback(() => {
    if (!leafletMap || !navigator.geolocation) { setHasError(true); return; }
    setHasError(false); setTracking(true); hasFlewRef.current = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords: { latitude: lat, longitude: lng, accuracy } }) => {
        const ll: L.LatLngExpression = [lat, lng];
        if (!hasFlewRef.current) {
          leafletMap.flyTo(ll, Math.min(leafletMap.getZoom(), 16), { duration: 1 });
          hasFlewRef.current = true;
        }
        if (markerRef.current) markerRef.current.setLatLng(ll);
        else markerRef.current = L.marker(ll, { icon: createLocationIcon(), zIndexOffset: 2000, interactive: false }).addTo(leafletMap);
        if (circleRef.current) { circleRef.current.setLatLng(ll); circleRef.current.setRadius(accuracy); }
        else circleRef.current = L.circle(ll, { radius: accuracy, color: '#2dd4bf', fillColor: '#2dd4bf', fillOpacity: 0.07, weight: 1.5, opacity: 0.3, interactive: false }).addTo(leafletMap);
      },
      () => { setHasError(true); setTracking(false); clearLayers(); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 },
    );
  }, [leafletMap, clearLayers]);

  React.useEffect(() => () => stopTracking(), [stopTracking]);

  const btn: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(233,228,218,0.18)',
    background: 'rgba(11,12,16,0.92)', backdropFilter: 'blur(8px)',
    color: '#e9e4da', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  };

  return (
    <div style={{ position: 'absolute', top: 64, right: 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 190 }}>
      <button style={btn} onClick={() => leafletMap?.zoomIn()}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(233,228,218,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(11,12,16,0.92)'; }}>
        <IconZoomIn size={16} />
      </button>
      <button style={btn} onClick={() => leafletMap?.zoomOut()}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(233,228,218,0.1)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(11,12,16,0.92)'; }}>
        <IconZoomOut size={16} />
      </button>
      <button
        style={{
          ...btn, marginTop: 4,
          ...(tracking ? { border: '1px solid rgba(45,212,191,0.55)', background: 'rgba(45,212,191,0.10)', color: '#2dd4bf', boxShadow: '0 0 0 1px rgba(45,212,191,0.2),0 2px 12px rgba(0,0,0,0.5)' } : {}),
          ...(hasError  ? { border: '1px solid rgba(244,63,94,0.45)',  background: 'rgba(244,63,94,0.08)',  color: '#f43f5e' } : {}),
        }}
        onClick={() => tracking ? stopTracking() : startTracking()}
        title={tracking ? 'Stop tracking' : hasError ? 'Location unavailable' : 'Track my location'}
      >
        <IconLocate size={15} />
      </button>
    </div>
  );
}

// ── Notification ──────────────────────────────────────────────────────────────

function Notification({ notification }: { notification: AppState['notification'] | null | undefined }) {
  if (!notification) return null;
  const s: Record<string, React.CSSProperties> = {
    success: { borderColor: '#2dd4bf', background: 'rgba(45,212,191,0.08)',  color: '#2dd4bf' },
    error:   { borderColor: '#f43f5e', background: 'rgba(244,63,94,0.08)',   color: '#f43f5e' },
    info:    { borderColor: 'rgba(233,228,218,0.2)', background: 'rgba(233,228,218,0.05)', color: '#9a9d95' },
  };
  return (
    <div style={{
      position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
      padding: '6px 16px', borderRadius: 100, border: '1px solid',
      fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: '0.02em',
      whiteSpace: 'nowrap', zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)', ...s[notification.type],
    }}>
      {notification.message}
    </div>
  );
}
