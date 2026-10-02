import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LatLng } from '../../types';
import { searchPlaces, GeoResult } from '../../utils/geocoder';
import { IconX, IconLocate } from './Icons';

interface PlaceSearchProps {
  label: string;
  color: string;
  value: LatLng | null;
  valueLabel?: string;
  onSelect: (pos: LatLng, name: string) => void;
  onClear: () => void;
  placeholder?: string;
}

const PlaceSearch: React.FC<PlaceSearchProps> = ({
  label, color, value, valueLabel, onSelect, onClear, placeholder = 'Search or click map...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const found = await searchPlaces(q);
      setResults(found);
      setLoading(false);
    }, 420);
  }, []);

  const handleSelect = useCallback((r: GeoResult) => {
    onSelect(r.position, r.shortName);
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [onSelect]);

  const handleClear = useCallback(() => {
    onClear();
    setQuery('');
    setResults([]);
    setOpen(false);
  }, [onClear]);

  const displayText = value
    ? (valueLabel || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`)
    : null;

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border transition-colors"
        style={{
          background: 'rgba(11,12,16,0.95)',
          borderColor: open ? color : 'rgba(233,228,218,0.14)',
        }}
      >
        {/* Label badge */}
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-void font-mono"
          style={{ background: color }}
        >
          {label}
        </div>

        {/* Input or value display */}
        {displayText && !open ? (
          <div className="flex-1 min-w-0">
            <div className="text-sm text-bone font-medium truncate">{displayText}</div>
          </div>
        ) : (
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => setOpen(true)}
            placeholder={displayText ?? placeholder}
            className="flex-1 bg-transparent text-sm text-bone placeholder-ash outline-none font-sans"
            autoComplete="off"
          />
        )}

        {/* Clear / loading */}
        {value ? (
          <button
            onClick={handleClear}
            className="text-ash hover:text-bone transition-colors flex-shrink-0"
          >
            <IconX size={13} strokeWidth={2.5} />
          </button>
        ) : loading ? (
          <div className="w-3 h-3 border border-ash border-t-bone rounded-full animate-spin flex-shrink-0" />
        ) : (
          <IconLocate size={13} className="text-ash flex-shrink-0" />
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <div
              key={i}
              className="search-dropdown-item"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
            >
              <span className="place-name">{r.shortName}</span>
              {r.subName && <span className="place-sub">{r.subName}</span>}
            </div>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="search-dropdown">
          <div className="search-dropdown-item" style={{ color: '#6d727b', cursor: 'default' }}>
            No results — try a different name or click the map
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceSearch;
