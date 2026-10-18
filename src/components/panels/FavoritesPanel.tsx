import React, { useState, useMemo, useEffect } from 'react';
import { FavoriteLocation, LocationCategory, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import {
  IconStar, IconTrash, IconArrowRight, IconChevronDown, IconChevronRight, IconPlus, IconX, IconCheck,
  CATEGORY_ICONS,
} from '../ui/Icons';
import { PlaceSuggestion, suggestionsFor } from '../../data/istanbulPlaces';
import { resolvePlacePosition } from '../../utils/placeResolver';

const CATEGORIES: { id: LocationCategory; label: string }[] = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'cafe',       label: 'Cafe'       },
  { id: 'hotel',      label: 'Hotel'      },
  { id: 'attraction', label: 'Attraction' },
  { id: 'shopping',   label: 'Shopping'   },
  { id: 'transport',  label: 'Transport'  },
  { id: 'other',      label: 'Other'      },
];

const PAGE_SIZE = 10;

const border = '1px solid rgba(233,228,218,0.10)';
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: '10px',
  letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#6d727b',
};
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(5,5,6,0.8)',
  border: '1px solid rgba(233,228,218,0.18)', borderRadius: '8px',
  padding: '6px 10px', fontSize: '13px', color: '#e9e4da',
  outline: 'none', fontFamily: "'Space Grotesk',sans-serif",
};

interface FavoritesPanelProps {
  state: Pick<AppState, 'data'>;
  actions: Pick<AppActions, 'addFavorite' | 'deleteFavorite' | 'setMapCenter' | 'setMapZoom'>;
  mapCenter: LatLng;
}

const FavoritesPanelComponent: React.FC<FavoritesPanelProps> = ({ state, actions, mapCenter }) => {
  const [activeCategory, setActiveCategory] = useState<LocationCategory | 'all'>('all');
  const [showLandmarks, setShowLandmarks]   = useState(true);
  const [showAddForm, setShowAddForm]       = useState(false);
  const [addName, setAddName]               = useState('');
  const [addCategory, setAddCategory]       = useState<LocationCategory>('restaurant');
  const [query, setQuery]                   = useState('');
  const [visible, setVisible]               = useState(PAGE_SIZE);
  const [adding, setAdding]                 = useState<string | null>(null);

  // Start from the first page whenever the category or the search changes
  useEffect(() => { setVisible(PAGE_SIZE); }, [activeCategory, query]);

  const addedNames = useMemo(
    () => new Set(state.data.favoriteLocations.map((f) => f.name)),
    [state.data.favoriteLocations],
  );

  // Not-yet-added places first, already-added ones sink to the bottom
  const suggestions = useMemo(() => {
    const list  = suggestionsFor(activeCategory, query);
    const fresh = list.filter((p) => !addedNames.has(p.name));
    const done  = list.filter((p) =>  addedNames.has(p.name));
    return { list: [...fresh, ...done], fresh: fresh.length };
  }, [activeCategory, query, addedNames]);

  // Add a suggestion. The saved position is refined through the geocoder when possible.
  const handleAddSuggestion = async (place: PlaceSuggestion) => {
    if (adding !== null || addedNames.has(place.name)) return;
    setAdding(place.name);
    try {
      const position = await resolvePlacePosition(place);
      actions.addFavorite(place.name, position, place.category, '');
    } finally {
      setAdding(null);
    }
  };

  const favorites = state.data.favoriteLocations.filter(
    (f) => activeCategory === 'all' || f.category === activeCategory
  );

  const flyTo = (fav: FavoriteLocation) => {
    actions.setMapCenter(fav.position);
    actions.setMapZoom(16);
  };

  const handleAddCustom = () => {
    if (!addName.trim()) return;
    actions.addFavorite(addName.trim(), mapCenter, addCategory, '');
    setAddName('');
    setShowAddForm(false);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const categoryLabel = activeCategory === 'all'
    ? 'favorites'
    : CATEGORIES.find((c) => c.id === activeCategory)?.label.toLowerCase() ?? 'favorites';

  const tabBtn = (active: boolean, onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick}
      className="flex-shrink-0 text-xs px-3 py-1 rounded-full transition-all flex items-center gap-1"
      style={{
        background: active ? 'rgba(233,228,218,0.12)' : 'transparent',
        color:      active ? '#e9e4da' : '#6d727b',
        border:     active ? '1px solid rgba(233,228,218,0.2)' : '1px solid transparent',
        fontFamily: "'Space Grotesk',sans-serif",
      }}>
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Category filter */}
      <div className="p-4 flex-shrink-0" style={{ borderBottom: border }}>
        <div className="flex items-center justify-between mb-3">
          <p style={labelStyle}>Favorites</p>
          <span style={{ ...labelStyle, letterSpacing: '0.05em' }}>{state.data.favoriteLocations.length}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tabBtn(activeCategory === 'all', () => setActiveCategory('all'), 'All')}
          {CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat.id];
            return (
              <React.Fragment key={cat.id}>
                {tabBtn(
                  activeCategory === cat.id,
                  () => setActiveCategory(cat.id),
                  <><CatIcon size={11} /> {cat.label}</>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Add current map location */}
        <div className="p-3" style={{ borderBottom: '1px solid rgba(233,228,218,0.06)' }}>
          {showAddForm ? (
            <div className="space-y-2">
              <p style={{ ...labelStyle, marginBottom: '6px' }}>Save current map location</p>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Place name..."
                style={inputStyle}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              />
              {/* Category picker */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map((cat) => {
                  const CatIcon = CATEGORY_ICONS[cat.id];
                  const isActive = addCategory === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setAddCategory(cat.id)}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all"
                      style={{
                        background: isActive ? 'rgba(233,228,218,0.12)' : 'transparent',
                        color:      isActive ? '#e9e4da' : '#6d727b',
                        border:     isActive ? '1px solid rgba(233,228,218,0.25)' : '1px solid rgba(233,228,218,0.08)',
                        fontFamily: "'Space Grotesk',sans-serif",
                      }}>
                      <CatIcon size={10} /> {cat.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>
                Location: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddCustom}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'rgba(233,228,218,0.1)', color: '#e9e4da',
                           border: '1px solid rgba(233,228,218,0.2)', fontFamily: "'Space Grotesk',sans-serif" }}>
                  <IconCheck size={11} /> Save
                </button>
                <button onClick={() => { setShowAddForm(false); setAddName(''); }}
                  className="flex items-center gap-1 text-xs" style={{ color: '#6d727b' }}>
                  <IconX size={11} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)}
              className="w-full py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
              style={{ border: '1px dashed rgba(233,228,218,0.15)', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
              <IconPlus size={13} /> Save current map location
            </button>
          )}
        </div>

        {/* Discover Istanbul: curated suggestions for every category */}
        <div className="p-3" style={{ borderBottom: '1px solid rgba(233,228,218,0.06)' }}>
          <button onClick={() => setShowLandmarks(!showLandmarks)}
            className="flex items-center gap-2 transition-colors w-full"
            style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
            {showLandmarks ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            <span style={{ flex: 1, textAlign: 'left' }}>Discover Istanbul</span>
            <span style={{ color: '#2dd4bf' }}>{suggestions.fresh} to add</span>
          </button>

          {showLandmarks && (
            <div className="mt-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or district..."
                style={inputStyle}
              />
              <div style={{ ...labelStyle, letterSpacing: '0.05em', margin: '8px 2px 4px' }}>
                {suggestions.list.length === 0
                  ? 'No matches'
                  : visible < suggestions.list.length
                    ? `Showing ${visible} of ${suggestions.list.length}`
                    : `${suggestions.list.length} places`}
              </div>

              <div className="space-y-0.5">
                {suggestions.list.slice(0, visible).map((lm) => {
                  const alreadyAdded = addedNames.has(lm.name);
                  const isAdding = adding === lm.name;
                  const CatIcon = CATEGORY_ICONS[lm.category];
                  return (
                    <button key={lm.name}
                      onClick={() => handleAddSuggestion(lm)}
                      disabled={alreadyAdded || adding !== null}
                      className="flex items-center gap-2 text-left px-2 py-1.5 rounded-lg w-full transition-colors"
                      style={{
                        color:  alreadyAdded ? '#2b3038' : '#9a9d95',
                        cursor: alreadyAdded ? 'default' : (adding !== null ? 'wait' : 'pointer'),
                        fontSize: '12px', fontFamily: "'Space Grotesk',sans-serif",
                      }}
                      onMouseEnter={(e) => { if (!alreadyAdded && adding === null) e.currentTarget.style.background = 'rgba(233,228,218,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                      <CatIcon size={13} style={{ flexShrink: 0, color: '#6d727b' }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lm.name}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: '#4a4f59', fontFamily: "'JetBrains Mono',monospace", marginTop: '1px' }}>{lm.area}</span>
                      </span>
                      {alreadyAdded
                        ? <span style={{ fontSize: '10px', color: '#2dd4bf', fontFamily: "'JetBrains Mono',monospace" }}>Added</span>
                        : isAdding
                          ? <span style={{ fontSize: '10px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>Adding...</span>
                          : <IconPlus size={12} style={{ color: '#6d727b', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {visible < suggestions.list.length && (
                <button onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="w-full mt-2 py-2 rounded-lg text-xs transition-colors"
                  style={{ border: '1px dashed rgba(233,228,218,0.15)', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                  Show {Math.min(PAGE_SIZE, suggestions.list.length - visible)} more &middot; {suggestions.list.length - visible} left
                </button>
              )}

              {suggestions.list.length === 0 && (
                <p style={{ fontSize: '11px', color: '#4a4f59', fontFamily: "'JetBrains Mono',monospace", padding: '6px 8px' }}>
                  Nothing matches &ldquo;{query}&rdquo;. Try a district such as Kadıköy or Beşiktaş.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Favorites list */}
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: '140px' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3"
                 style={{ background: 'rgba(233,228,218,0.05)', color: '#2b3038' }}>
              <IconStar size={20} />
            </div>
            <p style={{ fontSize: '13px', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif", lineHeight: 1.6 }}>
              No {categoryLabel} saved yet.
              {activeCategory !== 'all' && (
                <><br /><span style={{ fontSize: '11px', color: '#2b3038' }}>
                  Use &ldquo;Save current map location&rdquo; above or add from Discover Istanbul.
                </span></>
              )}
            </p>
          </div>
        ) : (
          <div>
            {favorites.map((fav) => {
              const CatIcon = CATEGORY_ICONS[fav.category];
              return (
                <div key={fav.id} className="p-3 flex items-center gap-3 transition-colors"
                     style={{ borderBottom: '1px solid rgba(233,228,218,0.06)' }}
                     onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.03)')}
                     onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(233,228,218,0.06)', color: '#6d727b' }}>
                    <CatIcon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-medium truncate"
                         style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                      {fav.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace", marginTop: '2px' }}>
                      {CATEGORIES.find((c) => c.id === fav.category)?.label} &middot; {fmt(fav.addedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => flyTo(fav)} style={{ color: '#6d727b' }} title="Fly to location"
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                      <IconArrowRight size={15} />
                    </button>
                    <button onClick={() => actions.deleteFavorite(fav.id)} style={{ color: '#6d727b' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
                      <IconTrash size={14} />
                    </button>
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

export default FavoritesPanelComponent;
