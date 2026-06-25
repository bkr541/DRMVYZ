import type { ReactPreset, ReactEngineId } from './ReactTypes'

const ENGINE_LABELS: Record<ReactEngineId, string> = {
  shaderPads:      'Shader Pads',
  cinematicPortal: 'Cinematic Portal',
  oscilloscope:    'Sound Drawing',
  laserDmx:        'LaserDMX',
  neonLattice:     'Neon Lattice',
}

const ENGINE_ICONS: Record<ReactEngineId, string> = {
  shaderPads:      '◈',
  cinematicPortal: '◎',
  oscilloscope:    '〜',
  laserDmx:        '✦',
  neonLattice:     '⬡',
}

interface Props {
  presets: ReactPreset[]
  activePresetId: string | null
  onSelect: (id: string) => void
}

export function ReactPresetBrowser({ presets, activePresetId, onSelect }: Props) {
  return (
    <div className="rv-preset-browser">
      <div className="rv-panel-header">
        <span className="rv-panel-icon">◈</span>
        <span className="rv-panel-title">Visual Engines</span>
      </div>
      <div className="rv-preset-list">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId
          return (
            <button
              key={preset.id}
              className={`rv-preset-card${isActive ? ' rv-preset-card--active' : ''}`}
              onClick={() => onSelect(preset.id)}
              title={preset.description}
              style={isActive ? { '--accent': preset.palette.primary } as React.CSSProperties : undefined}
            >
              <div className="rv-preset-card-header">
                <span className="rv-preset-engine-icon" style={{ color: preset.palette.primary }}>
                  {ENGINE_ICONS[preset.engine]}
                </span>
                <span className="rv-preset-name">{preset.name}</span>
                {isActive && <span className="rv-preset-active-dot" />}
              </div>
              <div className="rv-preset-engine-label">
                {ENGINE_LABELS[preset.engine]}
              </div>
              <p className="rv-preset-desc">{preset.description}</p>
              <div className="rv-preset-palette">
                {Object.values(preset.palette).slice(0, 5).map((color, i) => (
                  <span
                    key={i}
                    className="rv-palette-swatch"
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
