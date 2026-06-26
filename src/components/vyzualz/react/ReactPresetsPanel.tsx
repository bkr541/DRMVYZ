import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import type { ReactPreset, ReactEngineId } from './ReactTypes'

// ── Display data ──────────────────────────────────────────────────────────────

const ENGINE_ORDER: ReactEngineId[] = ['cinematicPortal', 'oscilloscope', 'laserDmx', 'neonLattice']

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

// ── Mode/source hint derivation ───────────────────────────────────────────────
// Returns a short chip label describing what the oscilloscope is drawing.
// Non-oscilloscope presets return null (section header already names the engine).

function getModeHint(preset: ReactPreset): string | null {
  if (preset.engine !== 'oscilloscope') return null

  const osc = preset.oscillatorSettings
  if (!osc) return 'Classic Scope'          // no overrides → resolves to default classic

  switch (osc.sourceType) {
    case 'classic': {
      if (osc.autoSectionMode) return 'Classic · Auto'
      switch (osc.classicMode) {
        case 'lissajous':   return 'Lissajous'
        case 'radialScope': return 'Radial Scope'
        case 'spiralScope': return 'Spiral Scope'
        case 'sectionAuto': return 'Classic · Auto'
        default:            return 'Waveform'
      }
    }
    case 'builtinShape':
      return osc.builtinShape
        ? osc.builtinShape.charAt(0).toUpperCase() + osc.builtinShape.slice(1)
        : 'Shape'
    case 'text':
      return osc.text?.trim() ? `"${osc.text.trim()}"` : 'Text'
    case 'svgGlyph':
      return 'SVG Glyph'
    default:
      return null
  }
}

// ── Preset card ───────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  isActive,
  onSelect,
}: {
  preset: ReactPreset
  isActive: boolean
  onSelect: (id: string) => void
}) {
  const modeHint = getModeHint(preset)

  return (
    <button
      type="button"
      className={`rv-preset-card${isActive ? ' rv-preset-card--active' : ''}`}
      onClick={() => onSelect(preset.id)}
      title={preset.description}
      style={isActive ? { '--accent': preset.palette.primary } as React.CSSProperties : undefined}
    >
      <div className="rv-preset-card-header">
        <span className="rv-preset-name">{preset.name}</span>
        {isActive && <span className="rv-preset-active-dot" />}
      </div>

      {modeHint && (
        <div className="rv-preset-mode-chip">{modeHint}</div>
      )}

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
}

// ── Engine section ────────────────────────────────────────────────────────────

function EngineSection({
  engineId,
  presets,
  activePresetId,
  onSelect,
}: {
  engineId: ReactEngineId
  presets: ReactPreset[]
  activePresetId: string | null
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(
    () => !presets.some(p => p.id === activePresetId)
  )

  return (
    <div className={`rv-preset-group${collapsed ? ' rv-preset-group--collapsed' : ''}`}>
      <button
        type="button"
        className="rv-preset-group-hdr"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
      >
        <span className="rv-preset-group-hdr-icon">{ENGINE_ICONS[engineId]}</span>
        <span className="rv-preset-group-hdr-label">{ENGINE_LABELS[engineId]}</span>
        <span className="rv-preset-group-hdr-count">{presets.length}</span>
        <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
      </button>
      {!collapsed && (
        <div className="rv-preset-group-cards">
          {presets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={preset.id === activePresetId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ReactPresetsPanel() {
  const { reactPresets, activeReactPresetId, selectReactPreset } = useReactStore(
    useShallow(s => ({
      reactPresets:        s.reactPresets,
      activeReactPresetId: s.activeReactPresetId,
      selectReactPreset:   s.selectReactPreset,
    }))
  )

  const grouped = useMemo(
    () =>
      ENGINE_ORDER
        .map(engine => ({
          engine,
          presets: reactPresets.filter(p => p.engine === engine),
        }))
        .filter(g => g.presets.length > 0),
    [reactPresets]
  )

  return (
    <div className="rv-presets-panel">
      <p className="rv-presets-hint">Presets are saved looks for the selected engine.</p>

      {grouped.map(({ engine, presets }) => (
        <EngineSection
          key={engine}
          engineId={engine}
          presets={presets}
          activePresetId={activeReactPresetId}
          onSelect={selectReactPreset}
        />
      ))}
    </div>
  )
}
