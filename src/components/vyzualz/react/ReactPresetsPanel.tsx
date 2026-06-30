import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { CINEMATIC_WORLD_BY_ID, CINEMATIC_WORLD_UI, getCinematicPresetMood } from './CinematicWorldsUi'
import type { ReactPreset, ReactEngineId } from './ReactTypes'
import { ReactPresetThumbnail } from './ReactPresetThumbnail'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'

const ENGINE_ORDER: ReactEngineId[] = ['cinematicPortal', 'oscilloscope', 'laserDmx', 'neonLattice']

const ENGINE_LABELS: Record<ReactEngineId, string> = {
  shaderPads: 'Shader Pads', cinematicPortal: 'Cinematic Worlds', oscilloscope: 'Sound Drawing', laserDmx: 'LaserDMX', neonLattice: 'Neon Lattice',
}

const ENGINE_ICONS: Record<ReactEngineId, string> = {
  shaderPads: '◈', cinematicPortal: '◎', oscilloscope: '〜', laserDmx: '✦', neonLattice: '⬡',
}

function getModeHint(preset: ReactPreset): string | null {
  if (preset.engine === 'cinematicPortal') {
    const mode = preset.cinematicConfig?.worldMode ?? 'legacyPortal'
    return `${CINEMATIC_WORLD_BY_ID[mode].label} · ${getCinematicPresetMood(preset)}`
  }
  if (preset.engine !== 'oscilloscope') return null
  const osc = preset.oscillatorSettings
  if (!osc) return 'Classic Scope'
  switch (osc.sourceType) {
    case 'classic':
      if (osc.autoSectionMode) return 'Classic · Auto'
      return osc.classicMode === 'lissajous' ? 'Lissajous'
        : osc.classicMode === 'radialScope' ? 'Radial Scope'
        : osc.classicMode === 'spiralScope' ? 'Spiral Scope'
        : osc.classicMode === 'sectionAuto' ? 'Classic · Auto' : 'Waveform'
    case 'builtinShape': return osc.builtinShape ? osc.builtinShape.charAt(0).toUpperCase() + osc.builtinShape.slice(1) : 'Shape'
    case 'text': return osc.text?.trim() ? `"${osc.text.trim()}"` : 'Text'
    case 'svgGlyph': return 'SVG Glyph'
    default: return null
  }
}

function PresetCard({ preset, isActive, modified, onSelect }: {
  preset: ReactPreset
  isActive: boolean
  modified: boolean
  onSelect: (id: string) => void
}) {
  const modeHint = getModeHint(preset)
  return (
    <button
      type="button"
      className={`rv-preset-card rv-preset-card--with-thumb${isActive ? ' rv-preset-card--active' : ''}`}
      onClick={() => onSelect(preset.id)}
      aria-pressed={isActive}
      aria-current={isActive ? 'true' : undefined}
      title={preset.description}
      style={isActive ? { '--accent': preset.palette.primary } as React.CSSProperties : undefined}
    >
      <div className="rv-preset-card-layout">
        <ReactPresetThumbnail preset={preset} />
        <div className="rv-preset-card-content">
          <div className="rv-preset-card-header">
            <span className="rv-preset-name">{preset.name}</span>
            {isActive && <span className="rv-preset-selected-label"><span className="rv-preset-active-dot" aria-hidden="true" />Selected</span>}
          </div>
          <div className="rv-preset-chip-row">
            {modeHint && <span className="rv-preset-mode-chip">{modeHint}</span>}
            {modified && <span className="rv-preset-modified-chip">Modified</span>}
          </div>
          <p className="rv-preset-desc">{preset.description}</p>
          <div className="rv-preset-palette" aria-label={`${preset.name} palette`}>
            {Object.values(preset.palette).slice(0, 5).map((color, index) => <span key={index} className="rv-palette-swatch" style={{ background: color }} title={color} />)}
          </div>
        </div>
      </div>
    </button>
  )
}

function CinematicPresetGroups({ presets, activePresetId, modifiedIds, onSelect }: {
  presets: ReactPreset[]
  activePresetId: string | null
  modifiedIds: Set<string>
  onSelect: (id: string) => void
}) {
  const categories = useMemo(() => {
    const order = ['Cosmic', 'Architectural', 'Organic', 'Mechanical', 'Storm', 'Media', 'Legacy'] as const
    return order.map(category => ({
      category,
      worlds: CINEMATIC_WORLD_UI.filter(world => world.category === category).map(world => ({
        world,
        moods: (['Ambient', 'Driving', 'Peak'] as const).map(mood => ({
          mood,
          presets: presets.filter(preset => (preset.cinematicConfig?.worldMode ?? 'legacyPortal') === world.id && getCinematicPresetMood(preset) === mood),
        })).filter(group => group.presets.length > 0),
      })).filter(group => group.moods.length > 0),
    })).filter(group => group.worlds.length > 0)
  }, [presets])

  return <div className="rv-cinematic-preset-taxonomy">
    {categories.map(category => (
      <section key={category.category} aria-labelledby={`cinematic-preset-category-${category.category}`}>
        <h3 id={`cinematic-preset-category-${category.category}`}>{category.category}</h3>
        {category.worlds.map(({ world, moods }) => (
          <div className="rv-cinematic-preset-world" key={world.id}>
            <div className="rv-cinematic-preset-world-heading">
              <strong>{world.label}</strong><span>{world.description}</span>
            </div>
            {moods.map(({ mood, presets: moodPresets }) => (
              <div key={mood} className="rv-cinematic-preset-mood">
                <h4>{mood}</h4>
                <div className="rv-preset-group-cards">
                  {moodPresets.map(preset => <PresetCard key={preset.id} preset={preset} isActive={preset.id === activePresetId} modified={modifiedIds.has(preset.id)} onSelect={onSelect} />)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    ))}
  </div>
}

function EngineSection({ engineId, presets, activePresetId, modifiedIds, onSelect }: {
  engineId: ReactEngineId
  presets: ReactPreset[]
  activePresetId: string | null
  modifiedIds: Set<string>
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(() => !presets.some(preset => preset.id === activePresetId))
  return (
    <div className={`rv-preset-group${collapsed ? ' rv-preset-group--collapsed' : ''}`}>
      <button type="button" className="rv-preset-group-hdr" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>
        <span
          className="rv-preset-group-hdr-icon"
          style={{ color: (presets.find(preset => preset.id === activePresetId) ?? presets[0])?.palette.primary }}
        >{ENGINE_ICONS[engineId]}</span>
        <span className="rv-preset-group-hdr-label">{ENGINE_LABELS[engineId]}</span>
        <span className="rv-preset-group-hdr-count">{presets.length}</span>
        <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
      </button>
      {!collapsed && (engineId === 'cinematicPortal'
        ? <CinematicPresetGroups presets={presets} activePresetId={activePresetId} modifiedIds={modifiedIds} onSelect={onSelect} />
        : <div className="rv-preset-group-cards">{presets.map(preset => <PresetCard key={preset.id} preset={preset} isActive={preset.id === activePresetId} modified={false} onSelect={onSelect} />)}</div>
      )}
    </div>
  )
}

export function ReactPresetsPanel() {
  const activeBrandKit = useBrandKitStore(state => state.activeKit)
  const { reactPresets, activeReactPresetId, cinematicConfigsByPresetId, selectReactPreset } = useReactStore(useShallow(state => ({
    reactPresets: state.reactPresets,
    activeReactPresetId: state.activeReactPresetId,
    cinematicConfigsByPresetId: state.cinematicConfigsByPresetId,
    selectReactPreset: state.selectReactPreset,
  })))
  const displayPresets = useMemo(
    () => reactPresets.map(preset => resolveBrandedReactPreset(
      preset,
      cinematicConfigsByPresetId,
      activeBrandKit,
    ) ?? preset),
    [reactPresets, cinematicConfigsByPresetId, activeBrandKit],
  )
  const grouped = useMemo(() => ENGINE_ORDER.map(engine => ({ engine, presets: displayPresets.filter(preset => preset.engine === engine) })).filter(group => group.presets.length > 0), [displayPresets])
  const active = displayPresets.find(preset => preset.id === activeReactPresetId)
  const activeWorld = active?.engine === 'cinematicPortal' ? CINEMATIC_WORLD_BY_ID[active.cinematicConfig?.worldMode ?? 'legacyPortal'].label : null
  const modifiedIds = useMemo(() => new Set(Object.keys(cinematicConfigsByPresetId)), [cinematicConfigsByPresetId])
  return (
    <div className="rv-presets-panel">
      <p className="rv-presets-hint">Presets are saved looks organized by engine. Cinematic Worlds are grouped by category, world and mood.</p>
      {activeWorld && <div className="rv-cinematic-current-world" aria-live="polite">Current world: <strong>{activeWorld}</strong>{activeReactPresetId && modifiedIds.has(activeReactPresetId) ? ' · Modified from preset' : ''}</div>}
      {grouped.map(({ engine, presets }) => <EngineSection key={engine} engineId={engine} presets={presets} activePresetId={activeReactPresetId} modifiedIds={modifiedIds} onSelect={selectReactPreset} />)}
    </div>
  )
}
