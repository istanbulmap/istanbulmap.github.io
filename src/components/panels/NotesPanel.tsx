import React, { useState } from 'react';
import { MapNote, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import { IconNote, IconPlus, IconEdit, IconTrash, IconX, IconCheck, IconPin, IconSave, IconMapPin, IconLocate } from '../ui/Icons';

const border = '1px solid rgba(233,228,218,0.10)';
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: '10px',
  letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#6d727b',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(5,5,6,0.8)',
  border: '1px solid rgba(233,228,218,0.18)', borderRadius: '8px',
  padding: '7px 10px', fontSize: '13px', color: '#e9e4da',
  outline: 'none', fontFamily: "'Space Grotesk',sans-serif",
};

interface NotesPanelProps {
  state: Pick<AppState, 'data'>;
  actions: Pick<AppActions, 'addNote' | 'updateNote' | 'deleteNote'>;
  mapCenter: LatLng;
}

const NotesPanelComponent: React.FC<NotesPanelProps> = ({ state, actions, mapCenter }) => {
  const [isCreating, setIsCreating]   = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [newContent, setNewContent]   = useState('');
  const [newLocation, setNewLocation] = useState<LatLng | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editTitle, setEditTitle]     = useState('');
  const [editContent, setEditContent] = useState('');
  const [editLocation, setEditLocation] = useState<LatLng | null>(null);

  const notes = [...state.data.notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleCreate = () => {
    if (newTitle.trim() || newContent.trim()) {
      actions.addNote(newTitle.trim() || 'Untitled', newContent.trim(), newLocation ?? undefined);
      setNewTitle(''); setNewContent(''); setNewLocation(null); setIsCreating(false);
    }
  };

  const startEdit = (n: MapNote) => {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditContent(n.content);
    setEditLocation(n.position);
  };

  const saveEdit = (id: string) => {
    actions.updateNote(id, {
      title:    editTitle || 'Untitled',
      content:  editContent,
      position: editLocation,
    });
    setEditingId(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditLocation(null); };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const fmtCoord = (pos: LatLng) =>
    `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;

  // Location badge shown in create/edit forms
  const LocationRow = ({
    location,
    onAttach,
    onRemove,
  }: {
    location: LatLng | null;
    onAttach: () => void;
    onRemove: () => void;
  }) => (
    <div className="flex items-center gap-2">
      {location ? (
        <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg"
             style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.25)' }}>
          <IconMapPin size={12} style={{ color: '#2dd4bf', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: '#2dd4bf', fontFamily: "'JetBrains Mono',monospace", flex: 1 }}>
            {fmtCoord(location)}
          </span>
          <button onClick={onRemove} style={{ color: '#6d727b' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
            <IconX size={11} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button onClick={onAttach}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors"
          style={{ border: '1px dashed rgba(233,228,218,0.15)', color: '#6d727b',
                   fontSize: '11px', fontFamily: "'JetBrains Mono',monospace" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#e9e4da'; e.currentTarget.style.borderColor = 'rgba(233,228,218,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6d727b'; e.currentTarget.style.borderColor = 'rgba(233,228,218,0.15)'; }}>
          <IconLocate size={11} /> Attach map location
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 flex-shrink-0" style={{ borderBottom: border }}>
        <div className="flex items-center justify-between mb-3">
          <p style={labelStyle}>Notes</p>
          <span style={{ ...labelStyle, letterSpacing: '0.05em' }}>{state.data.notes.length}</span>
        </div>

        {isCreating ? (
          <div className="space-y-2">
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title..." style={inputStyle} autoFocus />
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write your note..." rows={3}
              style={{ ...inputStyle, resize: 'none' }} />
            <LocationRow
              location={newLocation}
              onAttach={() => setNewLocation(mapCenter)}
              onRemove={() => setNewLocation(null)}
            />
            <div className="flex gap-2">
              <button onClick={handleCreate}
                className="flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(233,228,218,0.1)', color: '#e9e4da',
                         border: '1px solid rgba(233,228,218,0.2)', fontFamily: "'Space Grotesk',sans-serif" }}>
                <IconSave size={13} /> Save Note
              </button>
              <button onClick={() => { setIsCreating(false); setNewTitle(''); setNewContent(''); setNewLocation(null); }}
                className="px-3 py-2 text-sm flex items-center gap-1" style={{ color: '#6d727b' }}>
                <IconX size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setIsCreating(true)}
            className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            style={{ border: '1px dashed rgba(233,228,218,0.15)', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
            <IconPlus size={14} /> New Note
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {notes.length === 0 && !isCreating ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: 'rgba(233,228,218,0.05)', color: '#2b3038' }}>
              <IconNote size={22} />
            </div>
            <p style={{ fontSize: '13px', color: '#6d727b', lineHeight: 1.6, fontFamily: "'Space Grotesk',sans-serif" }}>
              Keep notes about your Istanbul trip. Attach a map location to any note.
            </p>
          </div>
        ) : (
          <div>
            {notes.map((note) => (
              <div key={note.id} className="p-4 transition-colors"
                   style={{ borderBottom: '1px solid rgba(233,228,218,0.06)' }}>
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      style={inputStyle} autoFocus />
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3}
                      style={{ ...inputStyle, resize: 'none' }} />
                    <LocationRow
                      location={editLocation}
                      onAttach={() => setEditLocation(mapCenter)}
                      onRemove={() => setEditLocation(null)}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(note.id)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
                        style={{ background: 'rgba(233,228,218,0.1)', color: '#e9e4da',
                                 border: '1px solid rgba(233,228,218,0.2)', fontFamily: "'Space Grotesk',sans-serif" }}>
                        <IconCheck size={11} /> Save
                      </button>
                      <button onClick={cancelEdit} className="text-xs flex items-center gap-1" style={{ color: '#6d727b' }}>
                        <IconX size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {note.pinned && <IconPin size={11} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                        <h3 className="text-sm font-semibold truncate"
                            style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                          {note.title}
                        </h3>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 items-center">
                        <button onClick={() => actions.updateNote(note.id, { pinned: !note.pinned })}
                          title={note.pinned ? 'Unpin' : 'Pin to top'}
                          style={{ color: note.pinned ? '#f59e0b' : '#6d727b' }}>
                          <IconPin size={12} />
                        </button>
                        <button onClick={() => startEdit(note)} style={{ color: '#6d727b' }}
                          title="Edit"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                          <IconEdit size={12} />
                        </button>
                        <button onClick={() => actions.deleteNote(note.id)} style={{ color: '#6d727b' }}
                          title="Delete"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>

                    {note.content && (
                      <p className="mt-1.5 leading-relaxed whitespace-pre-wrap"
                         style={{ fontSize: '13px', color: '#9a9d95', fontFamily: "'Space Grotesk',sans-serif" }}>
                        {note.content}
                      </p>
                    )}

                    {/* Location badge */}
                    {note.position && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg inline-flex"
                           style={{ background: 'rgba(45,212,191,0.07)', border: '1px solid rgba(45,212,191,0.18)', display: 'inline-flex' }}>
                        <IconMapPin size={10} style={{ color: '#2dd4bf', flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', color: '#2dd4bf', fontFamily: "'JetBrains Mono',monospace" }}>
                          {fmtCoord(note.position)}
                        </span>
                      </div>
                    )}

                    <div className="mt-2" style={{ fontSize: '10px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace" }}>
                      {fmt(note.updatedAt)}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanelComponent;
