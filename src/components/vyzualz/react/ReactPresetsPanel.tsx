import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { resolveCinematicConfigForPreset, useReactStore } from '../../../stores/reactStore'
import { CINEMATIC_WORLD_BY_ID, CINEMATIC_WORLD_UI, getCinematicPresetMood } from './CinematicWorldsUi'
import {
  resolveReactPresetLaserDmxWorkspace,
  type LaserDmxSettings,
  type LaserDmxWorkspaceMode,
  type ReactPreset,
  type ReactEngineId,
} from './ReactTypes'
import { ReactPresetThumbnail } from './ReactPresetThumbnail'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'
import { analyzeProductionPresetCompatibility } from './LaserDmxProductionPresets'
import type { ProductionFixtureKind, ProductionPresetCompatibilityResult } from './LaserDmxProductionRig'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'
import {
  filterReactPresetLibrary,
  readReactPresetFavorites,
  sanitizeReactPresetFavorites,
  writeReactPresetFavorites,
  type ReactPresetLibraryView,
} from './reactPresetLibraryState'

const ENGINE_ORDER: ReactEngineId[] = REACT_ENGINE_IDS.filter(engine => engine !== 'shaderPads')
const LASER_DMX_WORKSPACE_LABELS: Record<LaserDmxWorkspaceMode, string> = {
  spatialFixtures: 'Spatial Fixtures',
  beamMatrix: 'Beam Matrix',
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

const FIXTURE_BADGE_LABELS: Record<ProductionFixtureKind, string> = {
  laserProjector: 'Laser', movingHeadBeam: 'Beam', movingHeadSpot: 'Spot', movingHeadWash: 'Wash', staticWash: 'Static Wash',
  strobe: 'Strobe', blinder: 'Blinder', ledBar: 'LED Bar', hazer: 'Haze', fogger: 'Fog', cryoJet: 'Cryo',
}

export function resolvePresetCardNavigationIndex(currentIndex: number, key: string, itemCount: number, columns = 1): number | null {
  if (itemCount <= 0) return null
  if (key === 'Home') return 0
  if (key === 'End') return itemCount - 1
  const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? columns : key === 'ArrowUp' ? -columns : 0
  if (delta === 0) return null
  return Math.max(0, Math.min(itemCount - 1, currentIndex + delta))
}

function handlePresetCardKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
  const group = event.currentTarget.closest<HTMLElement>('[data-preset-grid]')
  if (!group) return
  const cards = Array.from(group.querySelectorAll<HTMLButtonElement>('[data-preset-card]'))
  const currentIndex = cards.indexOf(event.currentTarget)
  const columns = group.clientWidth >= 720 ? 2 : 1
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, cards.length, columns)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  cards[nextIndex]?.focus()
}

function CompatibilitySummary({ result }: { result: ProductionPresetCompatibilityResult }) {
  const label = result.mode === 'full' ? 'Rig ready' : result.mode === 'adapted' ? 'Safe adaptation' : result.mode === 'partial' ? 'Partial playback' : 'Reference rig only'
  const detail = result.diagnostics.find(item => item.severity === 'error')?.message
    ?? result.diagnostics.find(item => item.severity === 'warning')?.message
  return <div className={`rv-production-compat rv-production-compat--${result.mode}`} title={detail}><strong>{label}</strong>{detail ? <span>{detail}</span> : null}</div>
}

function PresetCard({
  preset,
  isActive,
  modified,
  isFavorite,
  activeEngineId,
  activeLaserDmxWorkspace,
  onSelect,
  onToggleFavorite,
  currentRig,
  thumbnailGenerationKey,
}: {
  preset: ReactPreset
  isActive: boolean
  modified: boolean
  isFavorite: boolean
  activeEngineId: ReactEngineId
  activeLaserDmxWorkspace: LaserDmxWorkspaceMode
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  currentRig: LaserDmxSettings
  thumbnailGenerationKey: string
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  if (!isSelectableReactEngineId(preset.engine)) return null
  const modeHint = getModeHint(preset)
  const production = preset.productionPreset
  const compatibility = production ? analyzeProductionPresetCompatibility(preset, currentRig) : null
  const presetLaserWorkspace = resolveReactPresetLaserDmxWorkspace(preset)
  const switchesEngine = preset.engine !== activeEngineId
  const switchesLaserWorkspace = preset.engine === 'laserDmx'
    && activeEngineId === 'laserDmx'
    && presetLaserWorkspace != null
    && presetLaserWorkspace !== activeLaserDmxWorkspace
  const switchesContext = switchesEngine || switchesLaserWorkspace
  const destinationLabel = switchesLaserWorkspace && presetLaserWorkspace
    ? LASER_DMX_WORKSPACE_LABELS[presetLaserWorkspace]
    : REACT_ENGINE_CATALOG[preset.engine].label
  const hasMoreDetails = true

  return (
    <div className={`rv-preset-card-shell${detailsOpen ? ' rv-preset-card-shell--expanded' : ''}`}>
      <button
        type="button"
        className={`rv-preset-card rv-preset-card--with-thumb${isActive ? ' rv-preset-card--active' : ''}${detailsOpen ? ' rv-preset-card--expanded' : ''}`}
        onClick={() => onSelect(preset.id)}
        onKeyDown={handlePresetCardKeyDown}
        data-preset-card
        aria-pressed={isActive}
        aria-current={isActive ? 'true' : undefined}
        aria-label={`${switchesContext ? `Switch to ${destinationLabel} and load` : 'Load'} ${preset.name}`}
        title={preset.description}
      >
        <div className="rv-preset-card-layout">
          <ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} />
          <div className="rv-preset-card-content">
            <div className="rv-preset-card-header">
              <span className="rv-preset-name">{preset.name}</span>
              {isActive && <span className="rv-preset-selected-label"><span className="rv-preset-active-dot" aria-hidden="true" />Selected</span>}
            </div>
            <div className="rv-preset-chip-row">
              {modeHint && <span className="rv-preset-mode-chip">{modeHint}</span>}
              {modified && <span className="rv-preset-modified-chip">Modified</span>}
              {switchesContext && <span className="rv-preset-switch-chip">Switch &amp; Load</span>}
            </div>
            {production && <>
              <div className="rv-production-badges" aria-label={`${preset.name} fixture families`}>
                {production.fixtureFamilyBadges.slice(0, detailsOpen ? 7 : 5).map(kind => <span key={kind}>{FIXTURE_BADGE_LABELS[kind]}</span>)}
              </div>
              {detailsOpen && (
                <div className="rv-preset-detail-panel">
                  <div className="rv-production-meta"><span>Cost: {production.complexity}</span><span>{production.requiredCapabilities.map(item => item.label).join(' · ')}</span></div>
                  <div className="rv-production-tags">{production.styleTags.map(tag => <span key={tag}>{tag}</span>)}</div>
                  {compatibility && <CompatibilitySummary result={compatibility} />}
                </div>
              )}
            </>}
            <p className="rv-preset-desc">{preset.description}</p>
            <div className="rv-preset-palette" aria-label={`${preset.name} palette`}>
              {Object.values(preset.palette).slice(0, 5).map((color, index) => <span key={index} className="rv-palette-swatch" style={{ background: color }} title={color} />)}
            </div>
          </div>
        </div>
      </button>
      <button
        type="button"
        className={`rv-preset-favorite${isFavorite ? ' rv-preset-favorite--active' : ''}`}
        onClick={() => onToggleFavorite(preset.id)}
        aria-pressed={isFavorite}
        aria-label={`${isFavorite ? 'Remove' : 'Add'} ${preset.name} ${isFavorite ? 'from' : 'to'} favorites`}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        {isFavorite ? '★' : '☆'}
      </button>
      {hasMoreDetails && (
        <button
          type="button"
          className="rv-preset-more-btn"
          aria-expanded={detailsOpen}
          aria-label={`${detailsOpen ? 'Hide' : 'Show'} detailed information for ${preset.name}`}
          onClick={event => {
            event.stopPropagation()
            setDetailsOpen(open => !open)
          }}
        >
          {detailsOpen ? 'Less' : 'More'} <span aria-hidden="true">›</span>
        </button>
      )}
    </div>
  )
}

type PresetCollectionProps = {
  presets: ReactPreset[]
  activePresetId: string | null
  modifiedIds: Set<string>
  favoriteIds: Set<string>
  activeEngineId: ReactEngineId
  activeLaserDmxWorkspace: LaserDmxWorkspaceMode
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  currentRig: LaserDmxSettings
  thumbnailGenerationKey: string
}

function renderPresetCard(preset: ReactPreset, props: Omit<PresetCollectionProps, 'presets'>) {
  const presetWorkspace = resolveReactPresetLaserDmxWorkspace(preset)
  const workspaceMatches = preset.engine !== 'laserDmx'
    || (props.activeEngineId === 'laserDmx' && presetWorkspace === props.activeLaserDmxWorkspace)
  return (
    <PresetCard
      key={preset.id}
      preset={preset}
      isActive={preset.id === props.activePresetId && preset.engine === props.activeEngineId && workspaceMatches}
      modified={props.modifiedIds.has(preset.id)}
      isFavorite={props.favoriteIds.has(preset.id)}
      activeEngineId={props.activeEngineId}
      activeLaserDmxWorkspace={props.activeLaserDmxWorkspace}
      onSelect={props.onSelect}
      onToggleFavorite={props.onToggleFavorite}
      currentRig={props.currentRig}
      thumbnailGenerationKey={props.thumbnailGenerationKey}
    />
  )
}

function CinematicPresetGroups({ presets, ...props }: PresetCollectionProps) {
  const categories = useMemo(() => {
    const order = ['Cosmic', 'Architectural', 'Organic', 'Mechanical', 'Storm', 'Legacy'] as const
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
                <div className="rv-preset-group-cards" data-preset-grid>
                  {moodPresets.map(preset => renderPresetCard(preset, props))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    ))}
  </div>
}

function EngineSection({ engineId, presets, expandedByDefault = false, ...props }: PresetCollectionProps & {
  engineId: ReactEngineId
  expandedByDefault?: boolean
}) {
  const containsActive = presets.some(preset => {
    if (preset.id !== props.activePresetId || preset.engine !== props.activeEngineId) return false
    const workspace = resolveReactPresetLaserDmxWorkspace(preset)
    return preset.engine !== 'laserDmx' || workspace === props.activeLaserDmxWorkspace
  })
  const [collapsed, setCollapsed] = useState(() => !expandedByDefault && !containsActive)

  useEffect(() => {
    if (containsActive) setCollapsed(false)
  }, [containsActive])

  const engine = REACT_ENGINE_CATALOG[engineId]
  return (
    <div className={`rv-preset-group${collapsed ? ' rv-preset-group--collapsed' : ''}`}>
      <button type="button" className="rv-preset-group-hdr" onClick={() => setCollapsed(value => !value)} aria-expanded={!collapsed}>
        <span
          className="rv-preset-group-hdr-icon"
          style={{ color: (presets.find(preset => preset.id === props.activePresetId) ?? presets[0])?.palette.primary }}
        >{engine.icon}</span>
        <span className="rv-preset-group-hdr-label">{engine.label}</span>
        <span className="rv-preset-group-hdr-count">{presets.length}</span>
        <span className="rv-preset-group-hdr-chevron" aria-hidden="true">▾</span>
      </button>
      {!collapsed && (engineId === 'cinematicPortal'
        ? <CinematicPresetGroups presets={presets} {...props} />
        : <div className="rv-preset-group-cards" data-preset-grid>{presets.map(preset => renderPresetCard(preset, props))}</div>
      )}
    </div>
  )
}

const LIBRARY_VIEW_LABELS: Record<ReactPresetLibraryView, string> = {
  current: 'Current Workspace',
  favorites: 'Favorites',
  all: 'All Engines',
}

export function ReactPresetsPanel() {
  const activeBrandKit = useBrandKitStore(state => state.activeKit)
  const {
    reactPresets,
    activeReactPresetId,
    activeReactEngineId,
    laserDmxWorkspaceMode,
    cinematicConfigsByPresetId,
    selectReactPreset,
    laserDmxSettings,
  } = useReactStore(useShallow(state => ({
    reactPresets: state.reactPresets,
    activeReactPresetId: state.activeReactPresetId,
    activeReactEngineId: state.activeReactEngineId,
    laserDmxWorkspaceMode: state.laserDmxWorkspaceMode,
    cinematicConfigsByPresetId: state.cinematicConfigsByPresetId,
    selectReactPreset: state.selectReactPreset,
    laserDmxSettings: state.laserDmxSettings,
  })))
  const [libraryView, setLibraryView] = useState<ReactPresetLibraryView>('current')
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(readReactPresetFavorites)

  // Selecting an engine always opens that engine's own library. Cross-engine
  // browsing remains available through All Engines without leaving stale
  // Cinematic/other-engine content beside the newly selected workspace.
  useEffect(() => {
    setLibraryView('current')
  }, [activeReactEngineId, laserDmxWorkspaceMode])

  const displayPresets = useMemo(
    () => reactPresets.filter(preset => isSelectableReactEngineId(preset.engine)).map(preset => resolveBrandedReactPreset(
      preset,
      cinematicConfigsByPresetId,
      activeBrandKit,
    ) ?? preset),
    [reactPresets, cinematicConfigsByPresetId, activeBrandKit],
  )

  useEffect(() => {
    const sanitized = sanitizeReactPresetFavorites(displayPresets.map(preset => preset.id))
    setFavoritePresetIds(current => (
      current.length === sanitized.length && current.every((presetId, index) => presetId === sanitized[index])
        ? current
        : sanitized
    ))
  }, [displayPresets])

  const favoriteIds = useMemo(() => new Set(favoritePresetIds), [favoritePresetIds])
  const active = displayPresets.find(preset => preset.id === activeReactPresetId)
  const activeCinematicWorldMode = activeReactEngineId === 'cinematicPortal' && active?.engine === 'cinematicPortal'
    ? resolveCinematicConfigForPreset(active, cinematicConfigsByPresetId)?.worldMode ?? null
    : null
  const visiblePresets = useMemo(() => {
    const engineVisible = filterReactPresetLibrary(displayPresets, activeReactEngineId, laserDmxWorkspaceMode, libraryView, favoriteIds)
    if (libraryView !== 'current' || activeReactEngineId !== 'cinematicPortal' || !activeCinematicWorldMode) return engineVisible
    return engineVisible.filter(preset => (
      resolveCinematicConfigForPreset(preset, cinematicConfigsByPresetId)?.worldMode === activeCinematicWorldMode
    ))
  }, [
    displayPresets,
    activeReactEngineId,
    laserDmxWorkspaceMode,
    libraryView,
    favoriteIds,
    activeCinematicWorldMode,
    cinematicConfigsByPresetId,
  ])
  const grouped = useMemo(
    () => ENGINE_ORDER
      .map(engine => ({ engine, presets: visiblePresets.filter(preset => preset.engine === engine) }))
      .filter(group => group.presets.length > 0),
    [visiblePresets],
  )
  const activeWorld = activeCinematicWorldMode
    ? CINEMATIC_WORLD_BY_ID[activeCinematicWorldMode].label
    : null
  const modifiedIds = useMemo(() => new Set(Object.keys(cinematicConfigsByPresetId)), [cinematicConfigsByPresetId])
  const activeEngine = REACT_ENGINE_CATALOG[activeReactEngineId]
  const thumbnailGenerationKey = useMemo(
    () => `${activeReactEngineId}:${laserDmxWorkspaceMode}:${libraryView}:${visiblePresets.map(preset => preset.id).join('|')}`,
    [activeReactEngineId, laserDmxWorkspaceMode, libraryView, visiblePresets],
  )

  const toggleFavorite = (presetId: string) => {
    setFavoritePresetIds(current => {
      const next = current.includes(presetId)
        ? current.filter(id => id !== presetId)
        : [...current, presetId]
      writeReactPresetFavorites(next)
      return next
    })
  }

  const collectionProps: Omit<PresetCollectionProps, 'presets'> = {
    activePresetId: activeReactPresetId,
    modifiedIds,
    favoriteIds,
    activeEngineId: activeReactEngineId,
    activeLaserDmxWorkspace: laserDmxWorkspaceMode,
    onSelect: selectReactPreset,
    onToggleFavorite: toggleFavorite,
    currentRig: laserDmxSettings,
    thumbnailGenerationKey,
  }

  return (
    <div className="rv-presets-panel">
      <header className="rv-preset-library-header">
        <div className="rv-preset-library-engine">
          <span aria-hidden="true">{activeEngine.icon}</span>
          <div>
            <strong>{activeEngine.label}</strong>
            <small>{libraryView === 'current'
              ? `${visiblePresets.length} presets for ${activeReactEngineId === 'laserDmx' ? LASER_DMX_WORKSPACE_LABELS[laserDmxWorkspaceMode] : 'the selected engine'}`
              : `${visiblePresets.length} presets shown`}</small>
          </div>
        </div>
        <div className="rv-preset-library-views" role="tablist" aria-label="Preset library filter">
          {(Object.keys(LIBRARY_VIEW_LABELS) as ReactPresetLibraryView[]).map(view => (
            <button
              key={view}
              type="button"
              role="tab"
              className={libraryView === view ? 'is-active' : ''}
              aria-selected={libraryView === view}
              onClick={() => setLibraryView(view)}
            >
              {LIBRARY_VIEW_LABELS[view]}
              {view === 'favorites' && favoritePresetIds.length > 0 ? ` ${favoritePresetIds.length}` : ''}
            </button>
          ))}
        </div>
      </header>

      <p className="rv-presets-hint">
        {libraryView === 'current'
          ? activeReactEngineId === 'cinematicPortal' && activeWorld
            ? `${activeWorld} presets only. Use All Engines to browse and switch worlds.`
            : `${activeReactEngineId === 'laserDmx' ? LASER_DMX_WORKSPACE_LABELS[laserDmxWorkspaceMode] : activeEngine.label} presets only. Use All Engines to browse and switch workspaces.`
          : libraryView === 'favorites'
            ? 'Star presets from any engine to keep them together here.'
            : 'Selecting another engine’s preset switches that engine and loads the look.'}
      </p>

      {activeWorld && active?.engine === activeReactEngineId && (
        <div className="rv-cinematic-current-world" aria-live="polite">
          Current world: <strong>{activeWorld}</strong>
          {activeReactPresetId && modifiedIds.has(activeReactPresetId) ? ' · Modified from preset' : ''}
        </div>
      )}

      {visiblePresets.length === 0 ? (
        <div className="rv-preset-library-empty">
          <strong>{libraryView === 'favorites' ? 'No favorite presets yet' : `No ${activeEngine.label} presets found`}</strong>
          <span>{libraryView === 'favorites' ? 'Choose ☆ on a preset to pin it here.' : 'This engine can still be edited from its left workspace.'}</span>
        </div>
      ) : libraryView === 'current' ? (
        activeReactEngineId === 'cinematicPortal'
          ? <CinematicPresetGroups presets={visiblePresets} {...collectionProps} />
          : <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>{visiblePresets.map(preset => renderPresetCard(preset, collectionProps))}</div>
      ) : (
        grouped.map(({ engine, presets }) => (
          <EngineSection
            key={`${libraryView}-${engine}`}
            engineId={engine}
            presets={presets}
            expandedByDefault={libraryView === 'favorites'}
            {...collectionProps}
          />
        ))
      )}
    </div>
  )
}
