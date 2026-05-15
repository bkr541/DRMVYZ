import { GlobalSettings, Theme, FftSize, ModuleInstance, ModuleSettings } from '../types'
import { COLOR_MAP_NAMES } from '../utils/colorMaps'

interface Props {
  settings: GlobalSettings
  onChange: (patch: Partial<GlobalSettings>) => void
  modules: ModuleInstance[]
  onModuleSettings: (id: string, s: Partial<ModuleSettings>) => void
  primaryColor: string
  currentTrackName: string
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'cyan-green',  label: 'Cyan / Green'  },
  { id: 'cyan-blue',   label: 'Cyan / Blue'   },
  { id: 'green-gold',  label: 'Green / Gold'  },
  { id: 'purple-cyan', label: 'Purple / Cyan' },
]

const FFT_SIZES: FftSize[] = [512, 1024, 2048, 4096, 8192]

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span className="toggle-label">{label}</span>
    </label>
  )
}

function Slider({ label, min, max, step, value, onChange, unit = '' }: {
  label: string; min: number; max: number; step: number; value: number
  onChange: (v: number) => void; unit?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="settings-slider-row">
      <span className="settings-slider-label">{label}</span>
      <input type="range" className="settings-slider" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties} />
      <span className="settings-val">{typeof value === 'number' && !Number.isInteger(value)
        ? value.toFixed(2) : value}{unit}</span>
    </div>
  )
}

export function SettingsPanel({ settings, onChange, modules, onModuleSettings, primaryColor, currentTrackName }: Props) {
  return (
    <div className="settings-panel">

      {/* ── Appearance ── */}
      <div className="settings-section">
        <div className="settings-section-title">APPEARANCE</div>

        <div className="theme-grid">
          {THEMES.map(t => (
            <button key={t.id}
              className={`theme-btn ${settings.theme === t.id ? 'active' : ''}`}
              onClick={() => onChange({ theme: t.id })}
              style={settings.theme === t.id ? { borderColor: primaryColor } as React.CSSProperties : undefined}>
              {t.label}
            </button>
          ))}
        </div>

        <Slider label="Glow" min={0} max={1} step={0.05} value={settings.accentIntensity}
          onChange={v => onChange({ accentIntensity: v })} />

        <div className="settings-toggles">
          <Toggle label="Glow"             checked={settings.showGlow}         onChange={v => onChange({ showGlow: v })} />
          <Toggle label="Scanlines"        checked={settings.showScanlines}    onChange={v => onChange({ showScanlines: v })} />
          <Toggle label="Grid"             checked={settings.showGrid}         onChange={v => onChange({ showGrid: v })} />
          <Toggle label="Logo"             checked={settings.showLogo}         onChange={v => onChange({ showLogo: v })} />
          <Toggle label="Module borders"   checked={settings.showModuleBorders}onChange={v => onChange({ showModuleBorders: v })} />
          <Toggle label="Transparent bg"   checked={settings.transparentBg}   onChange={v => onChange({ transparentBg: v })} />
        </div>

        <div className="settings-row">
          <span className="settings-label">FONT SIZE</span>
          <div className="btn-group">
            {(['compact','normal','large'] as const).map(d => (
              <button key={d} className={`btn-seg ${settings.fontDensity === d ? 'active' : ''}`}
                onClick={() => onChange({ fontDensity: d })}
                style={settings.fontDensity === d ? { color: primaryColor, borderColor: primaryColor } as React.CSSProperties : undefined}>
                {d[0].toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Analysis ── */}
      <div className="settings-section">
        <div className="settings-section-title">ANALYSIS</div>

        <div className="settings-row">
          <span className="settings-label">FFT SIZE</span>
          <select className="settings-select" value={settings.fftSize}
            onChange={e => onChange({ fftSize: parseInt(e.target.value) as FftSize })}>
            {FFT_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <Slider label="Smoothing"   min={0} max={0.99} step={0.01} value={settings.smoothing}
          onChange={v => onChange({ smoothing: v })} />
        <Slider label="Sensitivity" min={0.1} max={3} step={0.05} value={settings.sensitivity}
          onChange={v => onChange({ sensitivity: v })} />

        <Toggle label="Peak hold"   checked={settings.showPeakHold} onChange={v => onChange({ showPeakHold: v })} />
        <Slider label="Peak decay"  min={0.85} max={0.999} step={0.001} value={settings.peakDecay}
          onChange={v => onChange({ peakDecay: v })} />
      </div>

      {/* ── Recording ── */}
      <div className="settings-section">
        <div className="settings-section-title">RECORDING</div>
        <Toggle label="REC indicator" checked={settings.showRecIndicator} onChange={v => onChange({ showRecIndicator: v })} />
        <Toggle label="Safe margins"  checked={settings.showSafeMargins} onChange={v => onChange({ showSafeMargins: v })} />
        {settings.showSafeMargins && (
          <div className="settings-row">
            <span className="settings-label">ASPECT</span>
            <div className="btn-group">
              {(['9:16','1:1','16:9'] as const).map(a => (
                <button key={a} className={`btn-seg ${settings.safeMarginsAspect === a ? 'active' : ''}`}
                  onClick={() => onChange({ safeMarginsAspect: a })}
                  style={settings.safeMarginsAspect === a ? { color: primaryColor, borderColor: primaryColor } as React.CSSProperties : undefined}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Track Display ── */}
      <div className="settings-section">
        <div className="settings-section-title">DISPLAY</div>
        <label className="settings-label">NAME OVERRIDE</label>
        <input className="settings-input" type="text"
          placeholder={currentTrackName || 'Display name...'}
          value={settings.displayNameOverride}
          onChange={e => onChange({ displayNameOverride: e.target.value })}
          style={{ '--accent': primaryColor } as React.CSSProperties} />
      </div>

      {/* ── Per-module color maps ── */}
      <div className="settings-section">
        <div className="settings-section-title">COLOR MAPS</div>
        {modules.filter(m => ['spectrum','spectrogram','waveform'].includes(m.type)).map(m => (
          <div key={m.id} className="settings-row">
            <span className="settings-label">{m.label.toUpperCase()}</span>
            <select className="settings-select" value={m.settings.colorMap ?? 'cyan-green'}
              onChange={e => onModuleSettings(m.id, { colorMap: e.target.value as typeof COLOR_MAP_NAMES[number] })}>
              {COLOR_MAP_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
