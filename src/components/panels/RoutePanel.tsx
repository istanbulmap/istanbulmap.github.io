import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { TransportMode, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import { computeRouteOptions } from '../../utils/routing';
import {
  IconWalk, IconMetro, IconBus, IconTram, IconFerry, IconFunicular,
  IconX, IconSave, IconChevronDown, IconClock, IconRoute, IconLocate,
} from '../ui/Icons';
import PlaceSearch from '../ui/PlaceSearch';

// ── Car icon ──────────────────────────────────────────────────────────────────
const IconCar = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h12l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
    <circle cx="7.5" cy="17.5" r="2.5"/>
    <circle cx="16.5" cy="17.5" r="2.5"/>
  </svg>
);

// ── Swap icon ─────────────────────────────────────────────────────────────────
const IconSwap = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>
);

// ── Transport config ──────────────────────────────────────────────────────────
type IconFC = React.FC<{ size?: number }>;

interface ModeConfig {
  label: string;
  color: string;
  bg:    string;
  Icon:  IconFC;
}

const TC: Record<TransportMode, ModeConfig> = {
  walking:   { label: 'Walk',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   Icon: IconWalk      },
  car:       { label: 'Car',       color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   Icon: IconCar       },
  metro:     { label: 'Metro',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)', Icon: IconMetro     },
  tram:      { label: 'Tram',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  Icon: IconTram      },
  bus:       { label: 'Bus',       color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  Icon: IconBus       },
  ferry:     { label: 'Ferry',     color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  Icon: IconFerry     },
  funicular: { label: 'Funicular', color: '#c084fc', bg: 'rgba(192,132,252,0.12)', Icon: IconFunicular },
};

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface RoutePanelProps {
  state: Pick<AppState, 'routeFrom' | 'routeTo' | 'routeMode' | 'data'>;
  actions: Pick<AppActions, 'setRouteFrom' | 'setRouteTo' | 'setRouteMode' | 'saveRoute' | 'deleteRoute' | 'notify'>;
  routeFromLabel: string;
  routeToLabel:   string;
  setRouteFromLabel: (l: string) => void;
  setRouteToLabel:   (l: string) => void;
  activeEndpoint?:     'A' | 'B' | null;
  onSetActiveEndpoint?: (ep: 'A' | 'B' | null) => void;
  compact?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
const RoutePanelComponent: React.FC<RoutePanelProps> = ({
  state, actions,
  routeFromLabel, routeToLabel, setRouteFromLabel, setRouteToLabel,
  activeEndpoint, onSetActiveEndpoint,
  compact = false,
}) => {
  const { routeFrom, routeTo, routeMode } = state;

  const [saveName,       setSaveName]       = useState('');
  const [showSave,       setShowSave]       = useState(false);
  const [selectedMode,   setSelectedMode]   = useState<TransportMode>(routeMode);
  const [expandedRoute,  setExpandedRoute]  = useState<TransportMode | null>(null);
  const [locLoading,     setLocLoading]     = useState(false);
  const [locError,       setLocError]       = useState(false);

  const routeOptions = useMemo(() => {
    if (!routeFrom || !routeTo) return [];
    return computeRouteOptions(routeFrom, routeTo);
  }, [routeFrom, routeTo]);

  // Auto-select fastest available mode when endpoints change
  useEffect(() => {
    if (routeOptions.length === 0) return;
    const fastest = routeOptions.find((o) => o.available);
    if (fastest && fastest.mode !== selectedMode) {
      setSelectedMode(fastest.mode);
      actions.setRouteMode(fastest.mode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFrom, routeTo]);

  // ── "Use my location" ─────────────────────────────────────────────────────
  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocError(true); return; }
    setLocLoading(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLoading(false);
        const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        actions.setRouteFrom(loc);
        setRouteFromLabel('My Location');
        if (!routeTo) onSetActiveEndpoint?.('B');
        else          onSetActiveEndpoint?.(null);
      },
      () => {
        setLocLoading(false);
        setLocError(true);
        setTimeout(() => setLocError(false), 3000);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [actions, setRouteFromLabel, routeTo, onSetActiveEndpoint]);

  const handleSwap = useCallback(() => {
    actions.setRouteFrom(routeTo);
    actions.setRouteTo(routeFrom);
    setRouteFromLabel(routeToLabel);
    setRouteToLabel(routeFromLabel);
  }, [routeFrom, routeTo, routeFromLabel, routeToLabel, actions, setRouteFromLabel, setRouteToLabel]);

  const handleClearAll = useCallback(() => {
    actions.setRouteFrom(null);
    actions.setRouteTo(null);
    setRouteFromLabel('');
    setRouteToLabel('');
    onSetActiveEndpoint?.('A');
  }, [actions, setRouteFromLabel, setRouteToLabel, onSetActiveEndpoint]);

  const handleSave = useCallback(() => {
    if (saveName.trim()) {
      actions.saveRoute(saveName.trim());
      setSaveName('');
      setShowSave(false);
    }
  }, [saveName, actions]);

  // ── Style atoms ───────────────────────────────────────────────────────────
  const monoSm: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#4a4f59',
  };

  // ── Loc button ────────────────────────────────────────────────────────────
  const renderLocBtn = () => (
    <button
      onClick={handleUseMyLocation}
      disabled={locLoading}
      title={locError ? 'Location unavailable' : 'Use my current location'}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '5px 9px', borderRadius: '8px',
        cursor: locLoading ? 'wait' : 'pointer',
        fontSize: '11px', fontFamily: "'Space Grotesk', sans-serif",
        border:      locError ? '1px solid rgba(244,63,94,0.4)'  : '1px solid rgba(45,212,191,0.25)',
        background:  locError ? 'rgba(244,63,94,0.06)'           : 'rgba(45,212,191,0.06)',
        color:       locError ? '#f43f5e' : locLoading ? '#4a4f59' : '#2dd4bf',
        whiteSpace:  'nowrap', flexShrink: 0, transition: 'all 0.15s',
      }}
    >
      <IconLocate size={12} />
      {locLoading ? 'Locating…' : locError ? 'Unavailable' : 'My location'}
    </button>
  );

  // ── Endpoint hint ─────────────────────────────────────────────────────────
  const renderEndpointHint = () => {
    if (routeFrom && routeTo) return null;
    const isA = !routeFrom;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 10px', borderRadius: '8px', marginTop: '8px',
        background: isA ? 'rgba(45,212,191,0.07)' : 'rgba(245,158,11,0.07)',
        border: `1px solid ${isA ? 'rgba(45,212,191,0.2)' : 'rgba(245,158,11,0.2)'}`,
      }}>
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
          background: isA ? '#2dd4bf' : '#f59e0b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '9px', fontWeight: 700, color: '#0b0c10',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {isA ? 'A' : 'B'}
        </div>
        <span style={{ fontSize: '11px', color: '#9a9d95', fontFamily: "'Space Grotesk', sans-serif" }}>
          {isA ? 'Tap map or use "My location"' : 'Tap map to set destination'}
        </span>
      </div>
    );
  };

  // ── Inputs ────────────────────────────────────────────────────────────────
  const renderInputs = () => (
    <div style={{ padding: compact ? '10px 12px 8px' : '14px 14px 12px', flexShrink: 0 }}>
      {!compact && (
        <span style={{ ...monoSm, color: '#5a6070', marginBottom: '8px', display: 'block' }}>
          Plan Route
        </span>
      )}

      {!routeFrom && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          {renderLocBtn()}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '19px', top: '34px', bottom: '34px', width: '1px',
          background: 'linear-gradient(to bottom, rgba(45,212,191,0.4), rgba(245,158,11,0.4))',
          zIndex: 0,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative', zIndex: 1 }}>
          <PlaceSearch
            label="A" color="#2dd4bf"
            value={routeFrom} valueLabel={routeFromLabel}
            onSelect={(pos, name) => {
              actions.setRouteFrom(pos);
              setRouteFromLabel(name);
              if (!routeTo) onSetActiveEndpoint?.('B');
              else          onSetActiveEndpoint?.(null);
            }}
            onClear={() => {
              actions.setRouteFrom(null);
              setRouteFromLabel('');
              onSetActiveEndpoint?.('A');
            }}
            placeholder="Start — search or tap map"
          />
          <PlaceSearch
            label="B" color="#f59e0b"
            value={routeTo} valueLabel={routeToLabel}
            onSelect={(pos, name) => {
              actions.setRouteTo(pos);
              setRouteToLabel(name);
              onSetActiveEndpoint?.(null);
            }}
            onClear={() => {
              actions.setRouteTo(null);
              setRouteToLabel('');
              onSetActiveEndpoint?.('B');
            }}
            placeholder="Destination — search or tap map"
          />
        </div>

        {(routeFrom || routeTo) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '7px' }}>
            {(routeFrom && routeTo) ? (
              <button
                onClick={handleSwap}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', color: '#6d727b',
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: 'rgba(233,228,218,0.05)',
                  border: '1px solid rgba(233,228,218,0.12)',
                  borderRadius: '7px', padding: '4px 9px', cursor: 'pointer',
                }}
              >
                <IconSwap size={12} /> Swap
              </button>
            ) : <div />}
            <button
              onClick={handleClearAll}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: '#4a4f59',
                fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f43f5e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a4f59'; }}
            >
              <IconX size={11} strokeWidth={2.5} /> Clear
            </button>
          </div>
        )}
      </div>

      {renderEndpointHint()}
    </div>
  );

  // ── Mode pill strip (compact/mobile) ──────────────────────────────────────
  const renderModePills = () => {
    const available = routeOptions.filter((o) => o.available);
    if (available.length === 0) return null;
    return (
      <div style={{
        display: 'flex', gap: '6px', overflowX: 'auto',
        padding: '0 12px 10px', scrollbarWidth: 'none',
      }}>
        {available.map((o) => {
          const cfg  = TC[o.mode];
          const Icon = cfg.Icon;
          const isSel = selectedMode === o.mode;
          return (
            <button
              key={o.mode}
              onClick={() => { setSelectedMode(o.mode); actions.setRouteMode(o.mode); }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '7px 10px', borderRadius: '12px', cursor: 'pointer',
                flexShrink: 0, minWidth: '58px',
                border:      isSel ? `1px solid ${cfg.color}50` : '1px solid rgba(233,228,218,0.08)',
                background:  isSel ? cfg.bg : 'rgba(11,12,16,0.6)',
                color:       isSel ? cfg.color : '#5a6070',
                transition:  'all 0.15s',
              }}
            >
              <Icon size={15} />
              <span style={{ fontSize: '9px', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.06em' }}>
                {formatDuration(o.durationMin)}
              </span>
              <span style={{ fontSize: '8px', fontFamily: "'JetBrains Mono',monospace", opacity: 0.6 }}>
                {cfg.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: compact ? '16px' : '24px', textAlign: 'center',
    }}>
      <div style={{
        width: '44px', height: '44px', borderRadius: '14px', marginBottom: '12px',
        background: 'rgba(233,228,218,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3a3f47',
      }}>
        <IconRoute size={20} />
      </div>
      <p style={{ fontSize: '12px', color: '#6d727b', lineHeight: 1.7, fontFamily: "'Space Grotesk',sans-serif", margin: 0 }}>
        Set start and destination to see routes.
      </p>
      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {[
          { dot: '#2dd4bf', text: '"My location" or search above' },
          { dot: '#f59e0b', text: 'Or tap anywhere on the map'    },
          { dot: '#818cf8', text: 'Drag A or B pins to adjust'    },
        ].map(({ dot, text }, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: '#3a3f47', fontFamily: "'JetBrains Mono',monospace" }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Route card list ───────────────────────────────────────────────────────
  const renderRouteCards = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '0 12px 8px' : '10px 14px 0' }}>
      {!compact && routeOptions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={monoSm}>{routeOptions.filter((r) => r.available).length} options</span>
          <span style={{
            ...monoSm, color: TC[selectedMode].color,
            background: TC[selectedMode].bg, padding: '2px 8px',
            borderRadius: '100px', border: `1px solid ${TC[selectedMode].color}30`,
          }}>{TC[selectedMode].label}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingBottom: '10px' }}>
        {routeOptions.map((option) => {
          const cfg   = TC[option.mode];
          const Icon  = cfg.Icon;
          const isExp = expandedRoute === option.mode;
          const isSel = selectedMode  === option.mode;

          return (
            <div
              key={option.mode}
              style={{
                borderRadius: '12px', overflow: 'hidden',
                border:     isSel && option.available ? `1px solid ${cfg.color}40` : '1px solid rgba(233,228,218,0.07)',
                background: isSel && option.available ? `${cfg.color}08`           : 'rgba(11,12,16,0.55)',
                opacity:    option.available ? 1 : 0.3,
                cursor:     option.available ? 'pointer' : 'not-allowed',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: compact ? '9px 11px' : '11px 12px' }}
                onClick={() => {
                  if (!option.available) return;
                  setSelectedMode(option.mode);
                  actions.setRouteMode(option.mode);
                  setExpandedRoute(isExp ? null : option.mode);
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: cfg.bg, color: cfg.color,
                }}>
                  <Icon size={15} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif", lineHeight: 1.2 }}>
                    {cfg.label}
                    {!option.available && (
                      <span style={{ marginLeft: '6px', fontSize: '10px', color: '#4a4f59', fontWeight: 400, fontFamily: "'JetBrains Mono',monospace" }}>
                        N/A
                      </span>
                    )}
                  </div>
                  {option.lines && option.lines.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#5a6070', marginTop: '2px', fontFamily: "'JetBrains Mono',monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {option.lines[0]}
                    </div>
                  )}
                </div>

                {option.available && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '13px', fontWeight: 600, color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                      <IconClock size={11} />
                      {formatDuration(option.durationMin)}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4a4f59', fontFamily: "'JetBrains Mono',monospace", marginTop: '2px' }}>
                      {option.distanceKm.toFixed(1)} km
                    </div>
                  </div>
                )}

                {option.available && (
                  <div style={{
                    color: '#4a4f59', marginLeft: '2px', flexShrink: 0,
                    transform: isExp ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                  }}>
                    <IconChevronDown size={12} />
                  </div>
                )}
              </div>

              {isExp && option.available && (
                <div style={{ borderTop: '1px solid rgba(233,228,218,0.07)', padding: '8px 11px 11px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {option.steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                        background: cfg.color, color: '#050506',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace",
                        marginTop: '1px',
                      }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '11px', color: '#9a9d95', lineHeight: 1.55, fontFamily: "'Space Grotesk',sans-serif" }}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save route */}
      {routeOptions.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(233,228,218,0.07)', paddingTop: '10px', paddingBottom: compact ? '8px' : '14px' }}>
          {showSave ? (
            <div style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text" value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Name this route…"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                style={{
                  flex: 1, borderRadius: '8px', padding: '7px 10px',
                  background: 'rgba(11,12,16,0.9)', border: '1px solid rgba(233,228,218,0.2)',
                  color: '#e9e4da', fontSize: '12px', fontFamily: "'Space Grotesk',sans-serif", outline: 'none',
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                  background: 'rgba(233,228,218,0.1)', color: '#e9e4da',
                  border: '1px solid rgba(233,228,218,0.2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <IconSave size={12} /> Save
              </button>
              <button onClick={() => setShowSave(false)} style={{ color: '#4a4f59', padding: '4px', cursor: 'pointer' }}>
                <IconX size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSave(true)}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px', fontSize: '11px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                border: '1px dashed rgba(233,228,218,0.12)', color: '#5a6070',
                cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif", background: 'transparent',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e9e4da'; e.currentTarget.style.borderColor = 'rgba(233,228,218,0.28)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6070'; e.currentTarget.style.borderColor = 'rgba(233,228,218,0.12)'; }}
            >
              <IconSave size={12} /> Save route
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ── Saved routes section ──────────────────────────────────────────────────
  const renderSaved = () => {
    if (state.data.savedRoutes.length === 0) return null;
    return (
      <div style={{ flexShrink: 0, borderTop: '1px solid rgba(233,228,218,0.08)', padding: compact ? '8px 12px' : '10px 14px' }}>
        <span style={{ ...monoSm, color: '#5a6070', marginBottom: '6px', display: 'block' }}>Saved</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: compact ? '80px' : '100px', overflowY: 'auto' }}>
          {state.data.savedRoutes.map((route) => {
            const cfg  = TC[route.mode];
            const Icon = cfg.Icon;
            return (
              <div key={route.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 7px', borderRadius: '7px', background: 'rgba(233,228,218,0.03)' }}>
                <span style={{ color: cfg.color, flexShrink: 0 }}><Icon size={12} /></span>
                <span style={{ flex: 1, fontSize: '11px', color: '#9a9d95', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'Space Grotesk',sans-serif" }}>
                  {route.name}
                </span>
                <button
                  onClick={() => actions.deleteRoute(route.id)}
                  style={{ color: '#3a3f47', cursor: 'pointer', flexShrink: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f43f5e'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3a3f47'; }}
                >
                  <IconX size={11} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Compact layout (mobile) ───────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ borderBottom: '1px solid rgba(233,228,218,0.08)', flexShrink: 0 }}>
          {renderInputs()}
        </div>
        {routeOptions.length > 0 && (
          <div style={{ borderBottom: '1px solid rgba(233,228,218,0.07)', flexShrink: 0 }}>
            {renderModePills()}
          </div>
        )}
        {routeOptions.length === 0 ? renderEmpty() : renderRouteCards()}
        {renderSaved()}
      </div>
    );
  }

  // ── Full layout (desktop) ─────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ borderBottom: '1px solid rgba(233,228,218,0.08)', flexShrink: 0 }}>
        {renderInputs()}
      </div>
      {routeOptions.length === 0 ? renderEmpty() : renderRouteCards()}
      {renderSaved()}
    </div>
  );
};

export default RoutePanelComponent;
