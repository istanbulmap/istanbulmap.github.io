import React, { useState } from 'react';
import { Pin, PinColor } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import { IconEdit, IconTrash, IconPin, IconStar, IconX, IconCheck, IconMapPin } from '../ui/Icons';

const PIN_COLORS: { color: PinColor; hex: string }[] = [
  { color: 'blue',   hex: '#4f4ef1' },
  { color: 'red',    hex: '#f43f5e' },
  { color: 'green',  hex: '#22c55e' },
  { color: 'yellow', hex: '#f59e0b' },
  { color: 'purple', hex: '#8b5cf6' },
  { color: 'orange', hex: '#f97316' },
];

const border = '1px solid rgba(233,228,218,0.10)';
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: '10px',
  letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6d727b',
};

interface PinsPanelProps {
  state: Pick<AppState, 'data' | 'selectedPinId'>;
  actions: Pick<AppActions, 'updatePin' | 'deletePin' | 'selectPin' | 'togglePinFavorite' | 'flyToPin'>;
}

const PinsPanelComponent: React.FC<PinsPanelProps> = ({ state, actions }) => {
  const { data, selectedPinId } = state;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNote, setEditNote] = useState('');
  const [filterFav, setFilterFav] = useState(false);

  const pins = filterFav ? data.pins.filter((p) => p.isFavorite) : data.pins;

  const startEdit = (pin: Pin) => { setEditingId(pin.id); setEditLabel(pin.label); setEditNote(pin.note); };
  const saveEdit  = (id: string) => { actions.updatePin(id, { label: editLabel, note: editNote }); setEditingId(null); };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(5,5,6,0.8)',
    border: '1px solid rgba(233,228,218,0.18)', borderRadius: '8px',
    padding: '6px 10px', fontSize: '13px', color: '#e9e4da',
    outline: 'none', fontFamily: "'Space Grotesk',sans-serif",
  };

  const tabBtn = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} className="flex items-center gap-1 px-3 py-1 rounded-full transition-all text-xs"
      style={{ background: active ? 'rgba(233,228,218,0.12)' : 'transparent',
               color: active ? '#e9e4da' : '#6d727b',
               border: active ? '1px solid rgba(233,228,218,0.2)' : '1px solid transparent',
               fontFamily: "'Space Grotesk',sans-serif" }}>
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 flex-shrink-0" style={{ borderBottom: border }}>
        <div className="flex items-center justify-between mb-3">
          <p style={labelStyle}>Pins</p>
          <span style={{ ...labelStyle, letterSpacing: '0.05em' }}>{data.pins.length}</span>
        </div>
        <div className="flex gap-2">
          {tabBtn(!filterFav, () => setFilterFav(false), 'All')}
          {tabBtn(filterFav,  () => setFilterFav(true),  <><IconStar size={11} /> Favorites</>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: 'rgba(233,228,218,0.05)', color: '#2b3038' }}>
              <IconPin size={22} />
            </div>
            <p style={{ fontSize: '13px', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif", lineHeight: 1.6 }}>
              {filterFav ? 'No favorite pins yet.' : 'Double-click the map to drop a pin.'}
            </p>
          </div>
        ) : (
          <div>
            {pins.map((pin) => {
              const colorHex = PIN_COLORS.find((c) => c.color === pin.color)?.hex ?? '#4f4ef1';
              const isSel = selectedPinId === pin.id;
              return (
                <div key={pin.id} className="p-3 transition-colors"
                     style={{ borderBottom: '1px solid rgba(233,228,218,0.06)',
                              background: isSel ? 'rgba(233,228,218,0.04)' : 'transparent' }}>
                  <div className="flex items-start gap-3">
                    <button onClick={() => { actions.selectPin(pin.id); actions.flyToPin(pin.id); }}
                      className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                      style={{ background: colorHex, border: '2px solid rgba(255,255,255,0.15)' }}>
                      <IconMapPin size={13} className="text-white" />
                    </button>

                    <div className="flex-1 min-w-0">
                      {editingId === pin.id ? (
                        <div className="space-y-2">
                          <input type="text" value={editLabel} onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Pin name..." style={inputStyle} autoFocus />
                          <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)}
                            placeholder="Add a note..." rows={2}
                            style={{ ...inputStyle, resize: 'none' }} />
                          <div className="flex gap-1.5">
                            {PIN_COLORS.map(({ color, hex }) => (
                              <button key={color} onClick={() => actions.updatePin(pin.id, { color })}
                                className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ background: hex, border: pin.color === color ? '2px solid #e9e4da' : '2px solid transparent' }}>
                                {pin.color === color && <IconCheck size={9} className="text-white" strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveEdit(pin.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
                              style={{ background: 'rgba(233,228,218,0.1)', color: '#e9e4da', border: '1px solid rgba(233,228,218,0.2)', fontFamily: "'Space Grotesk',sans-serif" }}>
                              <IconCheck size={11} /> Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-2 py-1 text-xs" style={{ color: '#6d727b' }}>
                              <IconX size={11} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => { actions.selectPin(pin.id); actions.flyToPin(pin.id); }}
                            className="text-sm font-medium text-left w-full truncate block transition-colors"
                            style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                            {pin.label}
                          </button>
                          {pin.note && (
                            <p className="line-clamp-2 leading-relaxed mt-0.5"
                               style={{ fontSize: '12px', color: '#9a9d95', fontFamily: "'Space Grotesk',sans-serif" }}>
                              {pin.note}
                            </p>
                          )}
                          <div className="mt-1" style={{ fontSize: '10px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace" }}>
                            {pin.position.lat.toFixed(5)}, {pin.position.lng.toFixed(5)}
                          </div>
                        </>
                      )}
                    </div>

                    {editingId !== pin.id && (
                      <div className="flex flex-col items-center gap-1.5">
                        <button onClick={() => actions.togglePinFavorite(pin.id)} style={{ color: pin.isFavorite ? '#f59e0b' : '#6d727b' }}>
                          <IconStar size={14} style={pin.isFavorite ? { fill: '#f59e0b' } : {}} />
                        </button>
                        <button onClick={() => startEdit(pin)} style={{ color: '#6d727b' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                          <IconEdit size={13} />
                        </button>
                        <button onClick={() => actions.deletePin(pin.id)} style={{ color: '#6d727b' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                          <IconTrash size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PinsPanelComponent;
