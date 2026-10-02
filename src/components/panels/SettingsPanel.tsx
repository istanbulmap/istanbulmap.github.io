import React, { useRef } from 'react';
import { AppActions, AppState } from '../../hooks/useAppStore';
import {
  IconDownload, IconUpload, IconTrash, IconPin, IconStar, IconNote, IconRoute,
  IconMetro, IconBus, IconTram, IconFerry, IconFunicular, IconWalk, IconAlertTriangle, IconInfo,
} from '../ui/Icons';

const border = '1px solid rgba(233,228,218,0.10)';
const labelStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono',monospace", fontSize: '10px',
  letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: '#6d727b',
  marginBottom: '12px', display: 'block',
};

interface SettingsPanelProps {
  state: Pick<AppState, 'data'>;
  actions: Pick<AppActions, 'exportData' | 'importData' | 'resetData' | 'notify'>;
}

const SettingsPanelComponent: React.FC<SettingsPanelProps> = ({ state, actions }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChange  = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { await actions.importData(file); e.target.value = ''; }
  };
  const handleReset = () => {
    if (window.confirm('Clear all pins, notes, favorites and routes?\n\nExport your data first!')) {
      actions.resetData();
    }
  };

  const stats = [
    { label: 'Pins',      value: state.data.pins.length,              Icon: IconPin   },
    { label: 'Favorites', value: state.data.favoriteLocations.length, Icon: IconStar  },
    { label: 'Notes',     value: state.data.notes.length,             Icon: IconNote  },
    { label: 'Routes',    value: state.data.savedRoutes.length,       Icon: IconRoute },
  ];

  const transit = [
    { Icon: IconMetro,     label: 'Metro',      desc: '12 lines on both sides. M11 links city to Istanbul Airport.' },
    { Icon: IconTram,      label: 'Tram',       desc: 'T1 Sultanahmet to Bagcilar (European). T3 Kadikoy (Asian).' },
    { Icon: IconBus,       label: 'Bus (IETT)', desc: 'Extensive network. Istanbulkart contactless card recommended.' },
    { Icon: IconFerry,     label: 'Ferry (IDO)', desc: 'Crosses Bosphorus between European and Asian districts.' },
    { Icon: IconMetro,     label: 'Marmaray',   desc: 'Undersea tunnel rail connecting both sides of the city.' },
    { Icon: IconFunicular, label: 'Funicular',  desc: 'F1 Kabatas terminal to Taksim Square, 2 min.' },
    { Icon: IconWalk,      label: 'Walking',    desc: 'Sultanahmet and Beyoglu historic districts are walkable.' },
  ];

  const btnBase: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
    fontFamily: "'Space Grotesk',sans-serif",
  };

  return (
    <div style={{ minHeight: '100%' }}>
      <div className="p-4 space-y-7">
        {/* Stats */}
        <section>
          <span style={labelStyle}>Your Data</span>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(({ label, value, Icon }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl p-3"
                   style={{ background: 'rgba(233,228,218,0.04)', border: '1px solid rgba(233,228,218,0.08)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                     style={{ background: 'rgba(233,228,218,0.06)', color: '#9a9d95' }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="text-base font-semibold" style={{ color: '#e9e4da', fontFamily: "'Fraunces',serif", fontWeight: 300 }}>
                    {value}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.05em' }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Backup */}
        <section>
          <span style={labelStyle}>Data Backup</span>
          <div className="space-y-2">
            <button onClick={actions.exportData}
              style={{ ...btnBase, background: 'rgba(233,228,218,0.08)', border: '1px solid rgba(233,228,218,0.18)', color: '#e9e4da' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.13)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.08)')}>
              <IconDownload size={18} />
              <div className="text-left">
                <div className="text-sm font-medium">Export to File</div>
                <div style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>
                  Saves a .json file to your device
                </div>
              </div>
            </button>

            <button onClick={handleImportClick}
              style={{ ...btnBase, background: 'rgba(233,228,218,0.04)', border: '1px solid rgba(233,228,218,0.10)', color: '#9a9d95' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(233,228,218,0.04)')}>
              <IconUpload size={18} />
              <div className="text-left">
                <div className="text-sm font-medium" style={{ color: '#e9e4da' }}>Import from File</div>
                <div style={{ fontSize: '11px', color: '#6d727b', fontFamily: "'JetBrains Mono',monospace" }}>
                  Merges a previously exported file
                </div>
              </div>
            </button>

            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          </div>

          <div className="mt-3 p-3 rounded-xl flex gap-2.5"
               style={{ background: 'rgba(233,228,218,0.04)', border: '1px solid rgba(233,228,218,0.10)' }}>
            <IconInfo size={14} style={{ color: '#6d727b', flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '12px', color: '#6d727b', lineHeight: 1.6, fontFamily: "'Space Grotesk',sans-serif" }}>
              Data is stored in your browser session only. Export regularly for a permanent backup. Import merges with current data.
            </p>
          </div>
        </section>

        {/* Transit guide */}
        <section>
          <span style={labelStyle}>Istanbul Transit</span>
          <div className="space-y-3">
            {transit.map(({ Icon, label, desc }) => (
              <div key={label} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                     style={{ background: 'rgba(233,228,218,0.06)', color: '#6d727b' }}>
                  <Icon size={13} />
                </div>
                <p style={{ fontSize: '12px', color: '#9a9d95', lineHeight: 1.6, fontFamily: "'Space Grotesk',sans-serif" }}>
                  <span style={{ color: '#e9e4da', fontWeight: 500 }}>{label}: </span>{desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Danger */}
        <section>
          <span style={labelStyle}>Danger Zone</span>
          <button onClick={handleReset}
            className="w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            style={{ border: '1px solid rgba(244,63,94,0.3)', color: '#f43f5e', fontFamily: "'Space Grotesk',sans-serif" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,63,94,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <IconAlertTriangle size={14} /> Clear All Data
          </button>
        </section>

        <div className="text-center pb-4"
             style={{ fontSize: '10px', color: '#2b3038', fontFamily: "'JetBrains Mono',monospace", letterSpacing: '0.08em' }}>
          Istanbul Navigator v1.0.0 &middot; OpenStreetMap &middot; OSRM
        </div>
      </div>
    </div>
  );
};

export default SettingsPanelComponent;
