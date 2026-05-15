import { useState } from 'react'

interface SpectrumSettings {
  mode: string
  averaging: string
  peakHold: string
  range: string
  hold: boolean
}

interface Props {
  settings: SpectrumSettings
  onChange: (s: Partial<SpectrumSettings>) => void
}

export function SpectrumSettingsPanel({ settings, onChange }: Props) {
  return (
    <div className="az-specsettings-body">
      <Row label="Mode">
        <select
          className="az-select"
          value={settings.mode}
          onChange={e => onChange({ mode: e.target.value })}
        >
          <option>1/3 Octave</option>
          <option>1/6 Octave</option>
          <option>Linear</option>
          <option>FFT</option>
        </select>
      </Row>

      <Row label="Averaging">
        <select
          className="az-select"
          value={settings.averaging}
          onChange={e => onChange({ averaging: e.target.value })}
        >
          <option>Medium</option>
          <option>Fast</option>
          <option>Slow</option>
          <option>None</option>
        </select>
      </Row>

      <Row label="Peak Hold">
        <select
          className="az-select"
          value={settings.peakHold}
          onChange={e => onChange({ peakHold: e.target.value })}
        >
          <option>2 sec</option>
          <option>1 sec</option>
          <option>5 sec</option>
          <option>Infinite</option>
        </select>
      </Row>

      <Row label="Range">
        <select
          className="az-select"
          value={settings.range}
          onChange={e => onChange({ range: e.target.value })}
        >
          <option>96 dB</option>
          <option>72 dB</option>
          <option>48 dB</option>
          <option>120 dB</option>
        </select>
      </Row>

      <Row label="Hold">
        <label className="az-toggle-label">
          <input
            className="az-toggle-input"
            type="checkbox"
            checked={settings.hold}
            onChange={e => onChange({ hold: e.target.checked })}
          />
          <span className="az-toggle-track"><span className="az-toggle-thumb" /></span>
          <span style={{ fontSize: 10, color: 'rgba(245,248,250,0.45)' }}>
            {settings.hold ? 'On' : 'Off'}
          </span>
        </label>
      </Row>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="az-setting-row">
      <span className="az-setting-label">{label}</span>
      <div className="az-setting-control">{children}</div>
    </div>
  )
}

export function useSpectrumSettings() {
  const [settings, setSettings] = useState<SpectrumSettings>({
    mode: '1/3 Octave',
    averaging: 'Medium',
    peakHold: '2 sec',
    range: '96 dB',
    hold: false,
  })

  const update = (patch: Partial<SpectrumSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }))

  return { settings, update }
}
