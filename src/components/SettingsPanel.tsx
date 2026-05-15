import { VisualizerSettings, Theme } from '../types'

interface Props {
  settings: VisualizerSettings
  onChange: (s: Partial<VisualizerSettings>) => void
  primaryColor: string
  currentTrackName: string
}

const THEMES: { id: Theme; label: string; colors: string }[] = [
  { id: 'cyan-green',   label: 'Cyan / Green',   colors: '#00e5ff / #00ff88' },
  { id: 'cyan-blue',    label: 'Cyan / Blue',     colors: '#00e5ff / #448aff' },
  { id: 'green-gold',   label: 'Green / Gold',    colors: '#00ff88 / #ffcc00' },
  { id: 'purple-cyan',  label: 'Purple / Cyan',   colors: '#bb86fc / #00e5ff' },
]

export function SettingsPanel({ settings, onChange, primaryColor, currentTrackName }: Props) {
  return (
    <div className="settings-panel">
      <div className="settings-section">
        <label className="settings-label">DISPLAY NAME</label>
        <input
          className="settings-input"
          type="text"
          placeholder={currentTrackName || 'Track name override...'}
          value={settings.displayNameOverride}
          onChange={e => onChange({ displayNameOverride: e.target.value })}
          style={{ '--accent': primaryColor } as React.CSSProperties}
        />
      </div>

      <div className="settings-section">
        <label className="settings-label">ACCENT INTENSITY</label>
        <input
          type="range"
          className="settings-slider"
          min={0}
          max={1}
          step={0.05}
          value={settings.accentIntensity}
          onChange={e => onChange({ accentIntensity: parseFloat(e.target.value) })}
          style={{ '--pct': `${settings.accentIntensity * 100}%`, '--accent': primaryColor } as React.CSSProperties}
        />
        <span className="settings-val">{Math.round(settings.accentIntensity * 100)}%</span>
      </div>

      <div className="settings-section settings-toggles">
        {([
          ['showScanlines', 'SCANLINES'],
          ['showGlow',      'GLOW'],
          ['showGrid',      'GRID'],
          ['showLogo',      'LOGO'],
        ] as [keyof VisualizerSettings, string][]).map(([key, label]) => (
          <label key={key} className="toggle-row">
            <input
              type="checkbox"
              checked={settings[key] as boolean}
              onChange={e => onChange({ [key]: e.target.checked })}
            />
            <span className="toggle-track" style={{ '--accent': primaryColor } as React.CSSProperties}>
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{label}</span>
          </label>
        ))}
      </div>

      <div className="settings-section">
        <label className="settings-label">THEME</label>
        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-btn ${settings.theme === t.id ? 'active' : ''}`}
              onClick={() => onChange({ theme: t.id })}
              style={settings.theme === t.id ? { '--accent': primaryColor, borderColor: primaryColor } as React.CSSProperties : undefined}
            >
              <span className="theme-name">{t.label}</span>
              <span className="theme-colors">{t.colors}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
