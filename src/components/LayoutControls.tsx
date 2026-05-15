import { LayoutPreset } from '../types'

interface Props {
  current: LayoutPreset
  onChange: (l: LayoutPreset) => void
  primaryColor: string
}

const PRESETS: { id: LayoutPreset; label: string; icon: string }[] = [
  { id: 'dashboard',   label: 'Dashboard', icon: '⊞' },
  { id: '16:9',        label: '16:9',      icon: '▬' },
  { id: 'quad',        label: 'Quad',      icon: '⊡' },
  { id: 'horizontal',  label: 'Stack',     icon: '≡' },
  { id: '1:1',         label: '1:1',       icon: '■' },
  { id: '9:16',        label: '9:16',      icon: '▮' },
]

export function LayoutControls({ current, onChange, primaryColor }: Props) {
  return (
    <div className="layout-controls">
      <span className="layout-label">LAYOUT</span>
      {PRESETS.map(p => (
        <button
          key={p.id}
          className={`btn-layout ${current === p.id ? 'active' : ''}`}
          onClick={() => onChange(p.id)}
          title={p.label}
          style={current === p.id
            ? { color: primaryColor, borderColor: primaryColor } as React.CSSProperties
            : undefined}
        >
          <span className="layout-icon">{p.icon}</span>
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}
