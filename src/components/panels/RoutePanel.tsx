import React, { useState, useMemo } from 'react';
import { TransportMode, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import { computeRouteOptions } from '../../utils/routing';
import {
  TRANSPORT_ICONS, IconX, IconSave, IconChevronDown, IconChevronRight, IconClock,
} from '../ui/Icons';
import PlaceSearch from '../ui/PlaceSearch';

const TRANSPORT_CONFIG: Record<TransportMode, { label: string; color: string }> = {
  walking:   { label: 'Walk',      color: '#22c55e' },
  metro:     { label: 'Metro',     color: '#4f4ef1' },
  tram:      { label: 'Tram',      color: '#f59e0b' },
  bus:       { label: 'Bus',       color: '#f97316' },
  ferry:     { label: 'Ferry',     color: '#06b6d4' },
  funicular: { label: 'Funicular', color: '#8b5cf6' },
};

interface RoutePanelProps {
  state: Pick<AppState, 'routeFrom' | 'routeTo' | 'routeMode' | 'data'>;
  actions: Pick<AppActions, 'setRouteFrom' | 'setRouteTo' | 'setRouteMode' | 'saveRoute' | 'deleteRoute' | 'notify'>;
  routeFromLabel: string;
  routeToLabel: string;
  setRouteFromLabel: (l: string) => void;
  setRouteToLabel: (l: string) => void;
}

const border = '1px solid rgba(233,228,218,0.10)';

const RoutePanelComponent: React.FC<RoutePanelProps> = ({
  state, actions, routeFromLabel, routeToLabel, setRouteFromLabel, setRouteToLabel,
}) => {
  const { routeFrom, routeTo, routeMode } = state;
  const [saveName, setSaveName]   = useState('');
  const [showSave, setShowSave]   = useState(false);
  const [selectedMode, setSelectedMode] = useState<TransportMode>(routeMode);
  const [expandedRoute, setExpandedRoute] = useState<TransportMode | null>(null);

  const routeOptions = useMemo(() => {
    if (!routeFrom || !routeTo) return [];
    return computeRouteOptions(routeFrom, routeTo);
  }, [routeFrom, routeTo]);

  const handleSave = () => {
    if (saveName.trim()) {
      actions.saveRoute(saveName.trim());
      setSaveName('');
      setShowSave(false);
    }
  };

  const formatDuration = (min: number) =>
    min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60 ? `${min % 60}m` : ''}`.trim();

  const labelStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: '10px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#6d727b',
    marginBottom: '6px',
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="p-4 flex-shrink-0" style={{ borderBottom: border }}>
        <p style={{ ...labelStyle, marginBottom: '12px' }}>Plan Route</p>

        <div className="space-y-2">
          {/* From */}
          <PlaceSearch
            label="A"
            color="#2dd4bf"
            value={routeFrom}
            valueLabel={routeFromLabel}
            onSelect={(pos, name) => {
              actions.setRouteFrom(pos);
              setRouteFromLabel(name);
            }}
            onClear={() => { actions.setRouteFrom(null); setRouteFromLabel(''); }}
            placeholder="Search start or click map..."
          />
          {/* To */}
          <PlaceSearch
            label="B"
            color="#f59e0b"
            value={routeTo}
            valueLabel={routeToLabel}
            onSelect={(pos, name) => {
              actions.setRouteTo(pos);
              setRouteToLabel(name);
            }}
            onClear={() => { actions.setRouteTo(null); setRouteToLabel(''); }}
            placeholder="Search destination or click map..."
          />
        </div>

        {(routeFrom || routeTo) && (
          <button
            onClick={() => {
              actions.setRouteFrom(null);
              actions.setRouteTo(null);
              setRouteFromLabel('');
              setRouteToLabel('');
            }}
            className="mt-2 flex items-center gap-1 transition-colors"
            style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}
          >
            <IconX size={11} strokeWidth={2.5} /> Clear points
          </button>
        )}
      </div>

      {/* Results */}
      {routeOptions.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <p style={labelStyle}>{routeOptions.filter((r) => r.available).length} options available</p>

          {routeOptions.map((option) => {
            const cfg  = TRANSPORT_CONFIG[option.mode];
            const Icon = TRANSPORT_ICONS[option.mode];
            const isExp = expandedRoute === option.mode;
            const isSel = selectedMode === option.mode;

            return (
              <div
                key={option.mode}
                style={{
                  borderRadius: '10px',
                  border: isSel && option.available
                    ? '1px solid rgba(233,228,218,0.3)'
                    : '1px solid rgba(233,228,218,0.08)',
                  background: isSel && option.available
                    ? 'rgba(233,228,218,0.05)'
                    : 'rgba(11,12,16,0.6)',
                  opacity: option.available ? 1 : 0.38,
                  cursor:  option.available ? 'pointer' : 'not-allowed',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div
                  className="flex items-center gap-3 p-3"
                  onClick={() => {
                    if (!option.available) return;
                    setSelectedMode(option.mode);
                    actions.setRouteMode(option.mode);
                    setExpandedRoute(isExp ? null : option.mode);
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: cfg.color + '18', color: cfg.color }}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                      {cfg.label}
                      {!option.available && <span className="ml-2 text-xs" style={{ color: '#6d727b' }}>N/A</span>}
                    </div>
                    {option.lines && option.lines.length > 0 && (
                      <div className="truncate" style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>
                        {option.lines[0]}
                      </div>
                    )}
                  </div>
                  {option.available && (
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: '#e9e4da' }}>
                        <IconClock size={11} style={{ color: '#6d727b' }} />
                        {formatDuration(option.durationMin)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>
                        {option.distanceKm.toFixed(1)} km
                      </div>
                    </div>
                  )}
                  {option.available && (
                    <div style={{ color: '#6d727b', marginLeft: '4px' }}>
                      {isExp ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                    </div>
                  )}
                </div>

                {isExp && option.available && (
                  <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(233,228,218,0.07)', paddingTop: '10px' }}>
                    {option.steps.map((step, i) => (
                      <div key={i} className="flex gap-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-white"
                             style={{ background: cfg.color, fontSize: '10px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: '12px', color: '#9a9d95', lineHeight: '1.5', paddingTop: '2px', fontFamily: "'Space Grotesk',sans-serif" }}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Save route */}
          <div className="pt-2">
            {showSave ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Route name..."
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: 'rgba(11,12,16,0.8)', border: '1px solid rgba(233,228,218,0.2)', color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <button onClick={handleSave}
                  className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1"
                  style={{ background: 'rgba(233,228,218,0.1)', color: '#e9e4da', border: '1px solid rgba(233,228,218,0.2)' }}>
                  <IconSave size={13} /> Save
                </button>
                <button onClick={() => setShowSave(false)} style={{ color: '#6d727b', padding: '4px' }}>
                  <IconX size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSave(true)}
                className="w-full py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors"
                style={{ border: '1px dashed rgba(233,228,218,0.15)', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}
              >
                <IconSave size={13} /> Save this route
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: 'rgba(233,228,218,0.06)', color: '#6d727b' }}>
            <IconChevronRight size={22} />
          </div>
          <p style={{ fontSize: '13px', color: '#6d727b', lineHeight: '1.7', fontFamily: "'Space Grotesk',sans-serif" }}>
            Search for places above or click the map to set start and end points.
          </p>
          <div className="mt-4 space-y-1" style={{ fontSize: '11px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace" }}>
            <div>First click = start point A</div>
            <div>Second click = destination B</div>
            <div>Drag A or B to adjust</div>
          </div>
        </div>
      )}

      {/* Saved routes */}
      {state.data.savedRoutes.length > 0 && (
        <div className="flex-shrink-0 p-4" style={{ borderTop: border }}>
          <p style={labelStyle}>Saved Routes</p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {state.data.savedRoutes.map((route) => {
              const cfg  = TRANSPORT_CONFIG[route.mode];
              const Icon = TRANSPORT_ICONS[route.mode];
              return (
                <div key={route.id} className="flex items-center gap-2 py-1">
                  <span style={{ color: cfg.color }}><Icon size={13} /></span>
                  <span className="flex-1 text-sm truncate" style={{ color: '#9a9d95', fontFamily: "'Space Grotesk',sans-serif" }}>
                    {route.name}
                  </span>
                  <button onClick={() => actions.deleteRoute(route.id)} style={{ color: '#6d727b' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
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
