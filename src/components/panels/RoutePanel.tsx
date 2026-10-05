import React, { useState, useMemo, useCallback } from 'react';
import { TransportMode, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import { computeRouteOptions } from '../../utils/routing';
import {
  TRANSPORT_ICONS, IconX, IconSave, IconChevronDown, IconClock,
  IconRoute,
} from '../ui/Icons';
import PlaceSearch from '../ui/PlaceSearch';

// ── Transport config ──────────────────────────────────────────────────────────
const TRANSPORT_CONFIG: Record<TransportMode, { label: string; color: string; bg: string }> = {
  walking:   { label: 'Walk',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  metro:     { label: 'Metro',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  tram:      { label: 'Tram',      color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  bus:       { label: 'Bus',       color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  ferry:     { label: 'Ferry',     color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  funicular: { label: 'Funicular', color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface RoutePanelProps {
  state: Pick<AppState, 'routeFrom' | 'routeTo' | 'routeMode' | 'data'>;
  actions: Pick<AppActions, 'setRouteFrom' | 'setRouteTo' | 'setRouteMode' | 'saveRoute' | 'deleteRoute' | 'notify'>;
  routeFromLabel: string;
  routeToLabel: string;
  setRouteFromLabel: (l: string) => void;
  setRouteToLabel: (l: string) => void;
  /** Which endpoint is "active" for map-click placement (driven by App) */
  activeEndpoint?: 'A' | 'B' | null;
  onSetActiveEndpoint?: (ep: 'A' | 'B' | null) => void;
}

// ── Divider line ──────────────────────────────────────────────────────────────
const HR = () => (
  <div style={{ height: '1px', background: 'rgba(233,228,218,0.08)', margin: '0 -1px' }} />
);

// ── Swap icon ─────────────────────────────────────────────────────────────────
const IconSwap = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
    <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────
const RoutePanelComponent: React.FC<RoutePanelProps> = ({
  state, actions, routeFromLabel, routeToLabel, setRouteFromLabel, setRouteToLabel,
  activeEndpoint, onSetActiveEndpoint,
}) => {
  const { routeFrom, routeTo, routeMode } = state;
  const [saveName, setSaveName]     = useState('');
  const [showSave, setShowSave]     = useState(false);
  const [selectedMode, setSelectedMode] = useState<TransportMode>(routeMode);
  const [expandedRoute, setExpandedRoute] = useState<TransportMode | null>(null);

  // GPS-fill state for A
  const [locLoading, setLocLoading] = useState(false);
  const [locError,   setLocError]   = useState(false);

  const routeOptions = useMemo(() => {
    if (!routeFrom || !routeTo) return [];
    return computeRouteOptions(routeFrom, routeTo);
  }, [routeFrom, routeTo]);

  const handleSave = useCallback(() => {
    if (saveName.trim()) {
      actions.saveRoute(saveName.trim());
      setSaveName('');
      setShowSave(false);
    }
  }, [saveName, actions]);

  const handleSwap = useCallback(() => {
    const prevFrom = routeFrom;
    const prevTo   = routeTo;
    const prevFromLabel = routeFromLabel;
    const prevToLabel   = routeToLabel;
    actions.setRouteFrom(prevTo);
    actions.setRouteTo(prevFrom);
    setRouteFromLabel(prevToLabel);
    setRouteToLabel(prevFromLabel);
  }, [routeFrom, routeTo, routeFromLabel, routeToLabel, actions, setRouteFromLabel, setRouteToLabel]);

  const handleClearAll = useCallback(() => {
    actions.setRouteFrom(null);
    actions.setRouteTo(null);
    setRouteFromLabel('');
    setRouteToLabel('');
    onSetActiveEndpoint?.('A');
  }, [actions, setRouteFromLabel, setRouteToLabel, onSetActiveEndpoint]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const monoSm: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#4a4f59',
  };

  const labelTag: React.CSSProperties = {
    ...monoSm,
    color: '#5a6070',
    marginBottom: '8px',
    display: 'block',
  };

  // ── Active-endpoint indicator pill ──────────────────────────────────────────
  const renderEndpointHint = () => {
    if (routeFrom && routeTo) return null;
    const isA = !routeFrom;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '8px',
          background: isA ? 'rgba(45,212,191,0.07)' : 'rgba(245,158,11,0.07)',
          border: `1px solid ${isA ? 'rgba(45,212,191,0.2)' : 'rgba(245,158,11,0.2)'}`,
          marginTop: '10px',
        }}
      >
        <div
          style={{
            width: '18px', height: '18px', borderRadius: '50%',
            background: isA ? '#2dd4bf' : '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: '#0b0c10',
            fontFamily: "'JetBrains Mono', monospace",
            flexShrink: 0,
          }}
        >
          {isA ? 'A' : 'B'}
        </div>
        <span style={{ fontSize: '11px', color: '#9a9d95', fontFamily: "'Space Grotesk', sans-serif" }}>
          {isA ? 'Click map to set start point' : 'Click map to set destination'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Input section ─────────────────────────────────────────── */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(233,228,218,0.08)', flexShrink: 0 }}>
        <span style={labelTag}>Plan Route</span>

        {/* From / To inputs with connecting line and swap */}
        <div style={{ position: 'relative' }}>
          {/* Vertical connector line */}
          <div style={{
            position: 'absolute',
            left: '19px',
            top: '36px',
            bottom: '36px',
            width: '1px',
            background: 'linear-gradient(to bottom, rgba(45,212,191,0.4), rgba(245,158,11,0.4))',
            zIndex: 0,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 1 }}>
            {/* From A */}
            <PlaceSearch
              label="A"
              color="#2dd4bf"
              value={routeFrom}
              valueLabel={routeFromLabel}
              onSelect={(pos, name) => {
                actions.setRouteFrom(pos);
                setRouteFromLabel(name);
                // Auto-advance focus to B
                if (!routeTo) onSetActiveEndpoint?.('B');
                else onSetActiveEndpoint?.(null);
              }}
              onClear={() => {
                actions.setRouteFrom(null);
                setRouteFromLabel('');
                onSetActiveEndpoint?.('A');
              }}
              placeholder="Start point — search or click map"
            />

            {/* To B */}
            <PlaceSearch
              label="B"
              color="#f59e0b"
              value={routeTo}
              valueLabel={routeToLabel}
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
              placeholder="Destination — search or click map"
            />
          </div>

          {/* Swap + Clear row */}
          {(routeFrom || routeTo) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              {/* Swap button — only when both are set */}
              {routeFrom && routeTo ? (
                <button
                  onClick={handleSwap}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', color: '#6d727b',
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: 'rgba(233,228,218,0.05)',
                    border: '1px solid rgba(233,228,218,0.12)',
                    borderRadius: '7px',
                    padding: '4px 9px',
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e9e4da';
                    e.currentTarget.style.borderColor = 'rgba(233,228,218,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6d727b';
                    e.currentTarget.style.borderColor = 'rgba(233,228,218,0.12)';
                  }}
                >
                  <IconSwap size={13} /> Swap
                </button>
              ) : <div />}

              <button
                onClick={handleClearAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', color: '#4a4f59',
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f43f5e'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#4a4f59'; }}
              >
                <IconX size={11} strokeWidth={2.5} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Active endpoint hint */}
        {renderEndpointHint()}
      </div>

      {/* ── Route options ───────────────────────────────────────────── */}
      {routeOptions.length > 0 ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 0' }}>

          {/* Count header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={monoSm}>
              {routeOptions.filter((r) => r.available).length} options
            </span>
            {/* Selected mode badge */}
            <span style={{
              ...monoSm,
              color: TRANSPORT_CONFIG[selectedMode].color,
              background: TRANSPORT_CONFIG[selectedMode].bg,
              padding: '2px 8px',
              borderRadius: '100px',
              border: `1px solid ${TRANSPORT_CONFIG[selectedMode].color}30`,
            }}>
              {TRANSPORT_CONFIG[selectedMode].label}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px' }}>
            {routeOptions.map((option) => {
              const cfg  = TRANSPORT_CONFIG[option.mode];
              const Icon = TRANSPORT_ICONS[option.mode];
              const isExp = expandedRoute === option.mode;
              const isSel = selectedMode === option.mode;

              return (
                <div
                  key={option.mode}
                  style={{
                    borderRadius: '12px',
                    border: isSel && option.available
                      ? `1px solid ${cfg.color}40`
                      : '1px solid rgba(233,228,218,0.07)',
                    background: isSel && option.available
                      ? `${cfg.color}08`
                      : 'rgba(11,12,16,0.55)',
                    opacity: option.available ? 1 : 0.32,
                    cursor: option.available ? 'pointer' : 'not-allowed',
                    transition: 'border-color 0.15s, background 0.15s',
                    overflow: 'hidden',
                  }}
                >
                  {/* Card header row */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px' }}
                    onClick={() => {
                      if (!option.available) return;
                      setSelectedMode(option.mode);
                      actions.setRouteMode(option.mode);
                      setExpandedRoute(isExp ? null : option.mode);
                    }}
                  >
                    {/* Mode icon */}
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: cfg.bg, color: cfg.color,
                    }}>
                      <Icon size={17} />
                    </div>

                    {/* Label + line */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 600, color: '#e9e4da',
                        fontFamily: "'Space Grotesk', sans-serif",
                        lineHeight: 1.2,
                      }}>
                        {cfg.label}
                        {!option.available && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', color: '#4a4f59', fontWeight: 400, fontFamily: "'JetBrains Mono', monospace" }}>
                            N/A
                          </span>
                        )}
                      </div>
                      {option.lines && option.lines.length > 0 && (
                        <div style={{
                          fontSize: '11px', color: '#5a6070', marginTop: '2px',
                          fontFamily: "'JetBrains Mono', monospace",
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {option.lines[0]}
                        </div>
                      )}
                    </div>

                    {/* Time + distance */}
                    {option.available && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          justifyContent: 'flex-end',
                          fontSize: '13px', fontWeight: 600, color: '#e9e4da',
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}>
                          <IconClock size={11} style={{ color: '#5a6070', flexShrink: 0 }} />
                          {formatDuration(option.durationMin)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#4a4f59', fontFamily: "'JetBrains Mono', monospace", marginTop: '2px' }}>
                          {option.distanceKm.toFixed(1)} km
                        </div>
                      </div>
                    )}

                    {/* Chevron */}
                    {option.available && (
                      <div style={{
                        color: '#4a4f59', marginLeft: '2px', flexShrink: 0,
                        transform: isExp ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 0.2s',
                      }}>
                        <IconChevronDown size={13} />
                      </div>
                    )}
                  </div>

                  {/* Expanded steps */}
                  {isExp && option.available && (
                    <div style={{
                      borderTop: '1px solid rgba(233,228,218,0.07)',
                      padding: '10px 12px 12px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                      {option.steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                            background: cfg.color, color: '#050506',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                            marginTop: '1px',
                          }}>
                            {i + 1}
                          </div>
                          <span style={{
                            fontSize: '12px', color: '#9a9d95', lineHeight: 1.55,
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}>
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
          <div style={{ paddingBottom: '14px' }}>
            <HR />
            <div style={{ paddingTop: '12px' }}>
              {showSave ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Name this route..."
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    style={{
                      flex: 1, borderRadius: '9px', padding: '8px 12px',
                      background: 'rgba(11,12,16,0.9)',
                      border: '1px solid rgba(233,228,218,0.2)',
                      color: '#e9e4da', fontSize: '13px',
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSave}
                    style={{
                      padding: '8px 14px', borderRadius: '9px', fontSize: '12px',
                      fontWeight: 600, background: 'rgba(233,228,218,0.1)',
                      color: '#e9e4da', border: '1px solid rgba(233,228,218,0.2)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    <IconSave size={13} /> Save
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    style={{ color: '#4a4f59', padding: '4px', cursor: 'pointer' }}
                  >
                    <IconX size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSave(true)}
                  style={{
                    width: '100%', padding: '9px', borderRadius: '9px',
                    fontSize: '12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '6px',
                    border: '1px dashed rgba(233,228,218,0.13)',
                    color: '#5a6070', cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    transition: 'color 0.15s, border-color 0.15s',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e9e4da';
                    e.currentTarget.style.borderColor = 'rgba(233,228,218,0.28)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#5a6070';
                    e.currentTarget.style.borderColor = 'rgba(233,228,218,0.13)';
                  }}
                >
                  <IconSave size={13} /> Save route
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────── */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', marginBottom: '16px',
            background: 'rgba(233,228,218,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3a3f47',
          }}>
            <IconRoute size={22} />
          </div>
          <p style={{ fontSize: '13px', color: '#6d727b', lineHeight: 1.7, fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>
            Set start and destination to see available routes.
          </p>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { dot: '#2dd4bf', text: 'Search by place name above' },
              { dot: '#f59e0b', text: 'Or click anywhere on the map' },
              { dot: '#818cf8', text: 'Drag A or B pins to adjust' },
            ].map(({ dot, text }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#3a3f47', fontFamily: "'JetBrains Mono', monospace" }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

      {/* ── Saved routes ─────────────────────────────────────────────── */}
      {state.data.savedRoutes.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(233,228,218,0.08)', padding: '12px 14px' }}>
          <span style={{ ...labelTag, marginBottom: '8px' }}>Saved</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '112px', overflowY: 'auto' }}>
            {state.data.savedRoutes.map((route) => {
              const cfg  = TC[route.mode];
              const Icon = cfg.Icon;
              return (
                <div key={route.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '5px 8px', borderRadius: '8px',
                  background: 'rgba(233,228,218,0.03)',
                }}>
                  <span style={{ color: cfg.color, flexShrink: 0 }}><Icon size={13} /></span>
                  <span style={{
                    flex: 1, fontSize: '12px', color: '#9a9d95', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {route.name}
                  </span>
                  <button
                    onClick={() => actions.deleteRoute(route.id)}
                    style={{ color: '#3a3f47', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f43f5e'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#3a3f47'; }}
                  >
                    <IconX size={12} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutePanelComponent;
