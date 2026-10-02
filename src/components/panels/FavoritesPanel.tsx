import React, { useState } from 'react';
import { FavoriteLocation, LocationCategory, LatLng } from '../../types';
import { AppActions, AppState } from '../../hooks/useAppStore';
import {
  IconStar, IconTrash, IconArrowRight, IconChevronDown, IconChevronRight, IconPlus,
  CATEGORY_ICONS,
} from '../ui/Icons';

const CATEGORIES: { id: LocationCategory; label: string }[] = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'cafe',       label: 'Cafe'       },
  { id: 'hotel',      label: 'Hotel'      },
  { id: 'attraction', label: 'Attraction' },
  { id: 'shopping',   label: 'Shopping'   },
  { id: 'transport',  label: 'Transport'  },
  { id: 'other',      label: 'Other'      },
];

const LANDMARKS: { name: string; position: LatLng; category: LocationCategory }[] = [
  { name: 'Hagia Sophia',          position: { lat: 41.0086, lng: 28.9802 }, category: 'attraction' },
  { name: 'Topkapi Palace',        position: { lat: 41.0115, lng: 28.9833 }, category: 'attraction' },
  { name: 'Grand Bazaar',          position: { lat: 41.0108, lng: 28.9682 }, category: 'shopping'   },
  { name: 'Spice Bazaar',          position: { lat: 41.0166, lng: 28.9702 }, category: 'shopping'   },
  { name: 'Bosphorus Bridge',      position: { lat: 41.0463, lng: 29.0338 }, category: 'attraction' },
  { name: 'Galata Tower',          position: { lat: 41.0257, lng: 28.9741 }, category: 'attraction' },
  { name: 'Taksim Square',         position: { lat: 41.0369, lng: 28.9850 }, category: 'attraction' },
  { name: 'Dolmabahce Palace',     position: { lat: 41.0393, lng: 29.0005 }, category: 'attraction' },
  { name: 'Kadikoy Market',        position: { lat: 40.9906, lng: 29.0266 }, category: 'shopping'   },
  { name: 'Suleymaniye Mosque',    position: { lat: 41.0161, lng: 28.9639 }, category: 'attraction' },
  { name: 'Istanbul Airport',      position: { lat: 41.2753, lng: 28.7519 }, category: 'transport'  },
  { name: 'Sabiha Gokcen Airport', position: { lat: 40.8982, lng: 29.3093 }, category: 'transport'  },
];

const border = '1px solid rgba(233,228,218,0.10)';
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: '10px',
  letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: '#6d727b',
};

interface FavoritesPanelProps {
  state: Pick<AppState, 'data'>;
  actions: Pick<AppActions, 'addFavorite' | 'deleteFavorite' | 'setMapCenter' | 'setMapZoom'>;
}

const FavoritesPanelComponent: React.FC<FavoritesPanelProps> = ({ state, actions }) => {
  const [activeCategory, setActiveCategory] = useState<LocationCategory | 'all'>('all');
  const [showLandmarks, setShowLandmarks] = useState(false);

  const favorites = state.data.favoriteLocations.filter(
    (f) => activeCategory === 'all' || f.category === activeCategory
  );

  const flyTo = (fav: FavoriteLocation) => {
    actions.setMapCenter(fav.position);
    actions.setMapZoom(16);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
      <div className="p-4 flex-shrink-0" style={{ borderBottom: border }}>
        <div className="flex items-center justify-between mb-3">
          <p style={labelStyle}>Favorites</p>
          <span style={{ ...labelStyle, letterSpacing: '0.05em' }}>{state.data.favoriteLocations.length}</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {tabBtn(activeCategory === 'all', () => setActiveCategory('all'), 'All')}
          {CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat.id];
            return tabBtn(
              activeCategory === cat.id,
              () => setActiveCategory(cat.id),
              <><CatIcon size={11} /> {cat.label}</>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Quick-add landmarks */}
        <div className="p-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(233,228,218,0.06)' }}>
          <button onClick={() => setShowLandmarks(!showLandmarks)}
            className="flex items-center gap-2 transition-colors"
            style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.05em' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}>
            {showLandmarks ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
            Quick-add Istanbul Landmarks
          </button>

          {showLandmarks && (
            <div className="mt-2 space-y-0.5">
              {LANDMARKS.map((lm) => {
                const alreadyAdded = state.data.favoriteLocations.some((f) => f.name === lm.name);
                const CatIcon = CATEGORY_ICONS[lm.category];
                return (
                  <button key={lm.name}
                    onClick={() => !alreadyAdded && actions.addFavorite(lm.name, lm.position, lm.category, '')}
                    disabled={alreadyAdded}
                    className="flex items-center gap-2 text-left px-2 py-1.5 rounded-lg w-full transition-colors"
                    style={{
                      color: alreadyAdded ? '#2b3038' : '#9a9d95',
                      cursor: alreadyAdded ? 'default' : 'pointer',
                      fontSize: '12px', fontFamily: "'Space Grotesk',sans-serif",
                    }}
                    onMouseEnter={(e) => { if (!alreadyAdded) e.currentTarget.style.background = 'rgba(233,228,218,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                    <CatIcon size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{lm.name}</span>
                    {alreadyAdded
                      ? <span style={{ fontSize: '10px', color: '#2dd4bf', fontFamily: "'JetBrains Mono',monospace" }}>Added</span>
                      : <IconPlus size={12} style={{ color: '#6d727b' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 p-6 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                 style={{ background: 'rgba(233,228,218,0.05)', color: '#2b3038' }}>
              <IconStar size={22} />
            </div>
            <p style={{ fontSize: '13px', color: '#6d727b', fontFamily: "'Space Grotesk',sans-serif" }}>
              No favorites yet. Use Quick-add above or right-click the map.
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
                    <div className="text-sm font-medium truncate" style={{ color: '#e9e4da', fontFamily: "'Space Grotesk',sans-serif" }}>
                      {fav.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace", marginTop: '2px' }}>
                      {CATEGORIES.find((c) => c.id === fav.category)?.label} &middot; {fmt(fav.addedAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => flyTo(fav)} style={{ color: '#6d727b' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#e9e4da')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#6d727b')}
                      title="Fly to">
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
