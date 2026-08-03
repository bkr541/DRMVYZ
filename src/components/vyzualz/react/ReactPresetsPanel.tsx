import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  resolveCinematicConfigForPreset,
  resolvePresetOscillatorSettings,
  useReactStore,
} from '../../../stores/reactStore'
import { CINEMATIC_WORLD_BY_ID, CINEMATIC_WORLD_UI, getCinematicPresetMood } from './CinematicWorldsUi'
import type { CinematicWorldMode } from './CinematicWorldConfig'
import {
  type ReactPreset,
  type ReactEngineId,
  type CanvasPresetDefinition,
  type CanvasPresetId,
  CANVAS_PRESETS,
} from './ReactTypes'
import { ReactPresetThumbnail } from './ReactPresetThumbnail'
import {
  ReactPresetCard,
  resolvePresetCardNavigationIndex,
  type ReactPresetCardChip,
} from './ReactPresetCard'
import {
  ShowDirectorPerformanceThumbnail,
  ShowDirectorTemplateThumbnail,
  getShowDirectorPerformancePresetPalette,
  getShowDirectorTemplatePalette,
} from './LaserDmxPresetThumbnail'
import {
  LASER_DMX_SHOW_DIRECTOR_TEMPLATES,
  type LaserDmxShowDirectorTemplate,
} from './laserDmxShowDirectorTemplates'
import {
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS,
  readLaserDmxShowDirectorPerformanceFavorites,
  writeLaserDmxShowDirectorPerformanceFavorites,
} from './LaserDmxShowDirectorPerformancePresets'
import { LaserDmxBeamMatrixPresetBrowser } from './LaserDmxBeamMatrixPresetBrowser'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from './laserDmxBeamMatrixPresets'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'
import type { ProductionFixtureKind } from './LaserDmxProductionRig'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG, REACT_ENGINE_IDS } from './reactEngineCatalog'
import { resolveReactPresetProvenance } from './ReactPresetProvenance'
import { usePixGridDeckCompilerStore } from './pixGrid/PixGridDeckCompilerRuntime'
import { resolvePixGridDeckPresetReadiness } from './pixGrid/PixGridDeckPreset'
import { resolveCanvasPresetProvenance } from './canvasPerformance/CanvasPresetProvenance'
import {
  filterReactPresetLibrary,
  isReactPresetVisibleForLockedLaserDmx,
  readReactPresetFavorites,
  sanitizeReactPresetFavorites,
  writeReactPresetFavorites,
  type ReactPresetLibraryView,
} from './reactPresetLibraryState'
import { HelpInfoTrigger } from '../../shared/InfoPopover'

const ENGINE_ORDER: ReactEngineId[] = REACT_ENGINE_IDS.filter(engine => engine !== 'shaderPads')
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

function isCinematicPresetModified(
  preset: ReactPreset | undefined,
  overrides: Record<string, import('./CinematicWorldConfig').CinematicWorldConfig>,
): boolean {
  if (!preset || preset.engine !== 'cinematicPortal' || !overrides[preset.id]) return false
  return JSON.stringify(resolveCinematicConfigForPreset(preset, overrides)) !==
    JSON.stringify(resolveCinematicConfigForPreset(preset, {}))
}

const FIXTURE_BADGE_LABELS: Record<ProductionFixtureKind, string> = {
  laserProjector: 'Laser', movingHeadBeam: 'Beam', movingHeadSpot: 'Spot', movingHeadWash: 'Wash', staticWash: 'Static Wash',
  strobe: 'Strobe', blinder: 'Blinder', ledBar: 'LED Bar', hazer: 'Haze', fogger: 'Fog', cryoJet: 'Cryo',
}

const CANVAS_PRESET_CHIP_LABELS: Record<CanvasPresetId, string> = {
  'canvas-clean-playback': 'Clean Source',
  'canvas-bass-bloom': 'Bass Reactive',
  'canvas-ghost-echo': 'Trail Layer',
  'canvas-glitch-pulse': 'Beat Glitch',
  'canvas-luma-melt': 'Luma Treatment',
  'canvas-frame-stutter': 'Rhythm Stutter',
  'canvas-particle-aura': 'Particle System',
}

function createCanvasPresetCardPreset(preset: CanvasPresetDefinition): ReactPreset {
  const intensity = preset.settings.intensity ?? 0.5
  const motion = Math.max(
    preset.settings.motionAmount ?? 0,
    preset.settings.trailAmount ?? preset.settings.motionTrailAmount ?? 0,
    preset.settings.rgbSplit ?? 0,
    preset.settings.glitchAmount ?? 0,
    preset.settings.turbulence ?? 0,
    preset.settings.stutterRate ? Math.min(1, preset.settings.stutterRate / 8) : 0,
  )
  const glow = preset.settings.glow ?? 0.3
  const bassReactivity = Math.max(
    preset.settings.bassReactivity ?? preset.settings.bassBurst ?? 0,
    preset.settings.beatPulse ?? 0,
    preset.id === 'canvas-bass-bloom' ? 0.75 : 0.45,
  )

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    engine: 'canvas',
    palette: {
      primary: preset.accent,
      secondary: '#4ac7db',
      accent: '#61d6aa',
      background: '#060d10',
      highlight: '#d8b95a',
      text: '#e8f4f8',
    },
    params: { intensity, motion, glow, bassReactivity },
    scenes: [],
    sectionMappings: [],
  }
}

export { resolvePresetCardNavigationIndex } from './ReactPresetCard'

function StandardReactPresetCard({
  preset,
  isActive,
  modified,
  isFavorite = false,
  activeEngineId,
  onSelect,
  onToggleFavorite,
  thumbnailGenerationKey,
  modeHintOverride,
  showMore = true,
}: {
  preset: ReactPreset
  isActive: boolean
  modified: boolean
  isFavorite?: boolean
  activeEngineId: ReactEngineId
  onSelect: (id: string) => void
  onToggleFavorite?: (id: string) => void
  thumbnailGenerationKey: string
  modeHintOverride?: string | null
  showMore?: boolean
}) {
  const deck = useReactStore(state => preset.pixGridDeck
    ? state.pixGridDecks.find(candidate => candidate.id === preset.pixGridDeck?.deckId) ?? null
    : null)
  const compileStatus = usePixGridDeckCompilerStore(state => deck ? state.statuses[deck.id] : undefined)
  const transitionStatus = usePixGridDeckCompilerStore(state => deck ? state.transitionStatuses[deck.id] : undefined)
  if (!isSelectableReactEngineId(preset.engine)) return null
  const modeHint = modeHintOverride ?? getModeHint(preset)
  const production = preset.productionPreset
  const switchesContext = preset.engine !== activeEngineId
  const destinationLabel = REACT_ENGINE_CATALOG[preset.engine].label
  const chips: ReactPresetCardChip[] = [
    ...(modeHint ? [{ label: modeHint }] : []),
    ...(switchesContext ? [{ label: 'Switch & Load', tone: 'switch' as const }] : []),
  ]
  const deckReadiness = deck
    ? resolvePixGridDeckPresetReadiness(deck, compileStatus, transitionStatus)
    : null
  const disabled = Boolean(preset.pixGridDeck && (!deck || !deckReadiness?.ready))

  return (
    <ReactPresetCard
      id={preset.id}
      title={preset.name}
      description={isActive && modified
        ? `Source preset: ${preset.description} Current values have diverged from this recipe.`
        : preset.description}
      thumbnail={<ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} />}
      chips={chips}
      palette={Object.values(preset.palette).slice(0, 5).map(color => ({ color }))}
      isActive={isActive}
      isModified={modified}
      isFavorite={isFavorite}
      activateLabel={disabled
        ? `${preset.name} is unavailable while its Deck is compiling`
        : `${switchesContext ? `Switch to ${destinationLabel} and load` : 'Load'} ${preset.name}`}
      onActivate={() => onSelect(preset.id)}
      disabled={disabled}
      onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(preset.id) : undefined}
      titleText={isActive && modified ? `Modified from ${preset.name}. ${preset.description}` : preset.description}
      contentBeforeDescription={detailsOpen => production ? (
        <div className="rv-production-badges" aria-label={`${preset.name} fixture families`}>
          {production.fixtureFamilyBadges.slice(0, detailsOpen ? 7 : 5).map(kind => (
            <span key={kind}>{FIXTURE_BADGE_LABELS[kind]}</span>
          ))}
        </div>
      ) : null}
      expandedContent={production ? (
        <div className="rv-preset-detail-panel">
          <div className="rv-production-meta">
            <span>Cost: {production.complexity}</span>
            <span>{production.requiredCapabilities.map(item => item.label).join(' · ')}</span>
          </div>
          <div className="rv-production-tags">
            {production.styleTags.map(tag => <span key={tag}>{tag}</span>)}
          </div>
        </div>
      ) : undefined}
      showMore={showMore}
    />
  )
}

type PresetCollectionProps = {
  presets: ReactPreset[]
  activePresetId: string | null
  modifiedIds: Set<string>
  favoriteIds: Set<string>
  activeEngineId: ReactEngineId
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  thumbnailGenerationKey: string
}

function handleCompactPresetCardKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  onActivate: () => void,
): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
    return
  }

  const group = event.currentTarget.closest<HTMLElement>('[data-preset-grid]')
  if (!group) return
  const cards = Array.from(group.querySelectorAll<HTMLElement>('[data-preset-card]'))
  const currentIndex = cards.indexOf(event.currentTarget)
  const columns = group.clientWidth >= 720 ? 2 : 1
  const nextIndex = resolvePresetCardNavigationIndex(currentIndex, event.key, cards.length, columns)
  if (nextIndex == null || nextIndex === currentIndex) return
  event.preventDefault()
  cards[nextIndex]?.focus()
}

function SoundDrawingPresetCard({
  preset,
  isActive,
  modified,
  isFavorite,
  onSelect,
  onToggleFavorite,
  thumbnailGenerationKey,
}: {
  preset: ReactPreset
  isActive: boolean
  modified: boolean
  isFavorite: boolean
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  thumbnailGenerationKey: string
}) {
  const modeHint = getModeHint(preset)
  const activate = () => onSelect(preset.id)

  return (
    <div
      className={`rv-shader-scene-card rv-sound-drawing-preset-card${isActive ? ' rv-shader-scene-card--active' : ''}`}
      role="button"
      tabIndex={0}
      data-preset-card
      data-preset-card-shell
      data-preset-card-id={preset.id}
      aria-pressed={isActive}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`Load ${preset.name}`}
      title={preset.description}
      onClick={activate}
      onKeyDown={event => handleCompactPresetCardKeyDown(event, activate)}
    >
      <ReactPresetThumbnail
        preset={preset}
        generationKey={thumbnailGenerationKey}
        className="rv-shader-scene-thumb rv-sound-drawing-preset-thumb"
      />

      <div className="rv-shader-scene-card-body">
        <div className="rv-shader-scene-name">{preset.name}</div>
        <div className="rv-shader-scene-meta">
          {modeHint && <span className="rv-shader-scene-category">{modeHint}</span>}
          {modified && <span className="rv-shader-scene-badge">Modified</span>}
        </div>
      </div>

      <div className="rv-shader-scene-actions" onClick={event => event.stopPropagation()}>
        <button
          type="button"
          className={`rv-shader-scene-action${isFavorite ? ' rv-shader-scene-action--active' : ''}`}
          onClick={() => onToggleFavorite(preset.id)}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? 'Remove' : 'Add'} ${preset.name} ${isFavorite ? 'from' : 'to'} favorites`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>
    </div>
  )
}

function renderPresetCard(preset: ReactPreset, props: Omit<PresetCollectionProps, 'presets'>) {
  const isActive = preset.id === props.activePresetId && preset.engine === props.activeEngineId
  const modified = props.modifiedIds.has(preset.id)
  const isFavorite = props.favoriteIds.has(preset.id)

  if (preset.engine === 'oscilloscope') {
    return (
      <SoundDrawingPresetCard
        key={preset.id}
        preset={preset}
        isActive={isActive}
        modified={modified}
        isFavorite={isFavorite}
        onSelect={props.onSelect}
        onToggleFavorite={props.onToggleFavorite}
        thumbnailGenerationKey={props.thumbnailGenerationKey}
      />
    )
  }

  return (
    <StandardReactPresetCard
      key={preset.id}
      preset={preset}
      isActive={isActive}
      modified={modified}
      isFavorite={isFavorite}
      activeEngineId={props.activeEngineId}
      onSelect={props.onSelect}
      onToggleFavorite={props.onToggleFavorite}
      thumbnailGenerationKey={props.thumbnailGenerationKey}
    />
  )
}

const CINEMATIC_CATEGORY_ORDER = ['Cosmic', 'Architectural', 'Organic', 'Mechanical', 'Storm', 'Legacy'] as const
const CINEMATIC_MOOD_ORDER = ['Ambient', 'Driving', 'Peak'] as const

export function getCinematicWorldPresetGroups(presets: ReactPreset[]) {
  return CINEMATIC_WORLD_UI.map(world => {
    const worldPresets = presets.filter(preset => (
      preset.engine === 'cinematicPortal' &&
      (preset.cinematicConfig?.worldMode ?? 'legacyPortal') === world.id
    ))
    return {
      world,
      presets: worldPresets,
      moods: CINEMATIC_MOOD_ORDER.map(mood => ({
        mood,
        presets: worldPresets.filter(preset => getCinematicPresetMood(preset) === mood),
      })).filter(group => group.presets.length > 0),
    }
  }).filter(group => group.presets.length > 0)
}

type CinematicWorldPresetGroup = ReturnType<typeof getCinematicWorldPresetGroups>[number]

function CinematicWorldPresetCards({
  group,
  props,
  headingId,
}: {
  group: CinematicWorldPresetGroup
  props: Omit<PresetCollectionProps, 'presets'>
  headingId: string
}) {
  return (
    <section className="rv-cinematic-preset-world rv-preset-group" aria-labelledby={headingId}>
      <div className="rv-cinematic-preset-world-heading">
        <strong id={headingId}>{group.world.label}</strong>
        <span>{group.world.description}</span>
      </div>
      {group.moods.map(({ mood, presets: moodPresets }) => (
        <div key={mood} className="rv-cinematic-preset-mood">
          <h4>{mood}</h4>
          <div className="rv-preset-group-cards" data-preset-grid>
            {moodPresets.map(preset => renderPresetCard(preset, props))}
          </div>
        </div>
      ))}
    </section>
  )
}

function CinematicCurrentPresetBrowser({
  presets,
  activeWorldMode,
  ...props
}: PresetCollectionProps & { activeWorldMode: CinematicWorldMode | null }) {
  const groups = useMemo(() => getCinematicWorldPresetGroups(presets), [presets])
  const activeGroup = groups.find(group => group.world.id === activeWorldMode) ?? groups[0]

  if (!activeGroup) return null

  return (
    <div
      className="rv-preset-group-cards rv-preset-group-cards--current rv-cinematic-preset-browser"
      data-preset-grid
      aria-label={`${activeGroup.world.label} presets`}
    >
      {activeGroup.presets.map(preset => renderPresetCard(preset, props))}
    </div>
  )
}

function CinematicPresetGroups({ presets, ...props }: PresetCollectionProps) {
  const groups = useMemo(() => getCinematicWorldPresetGroups(presets), [presets])

  return (
    <div className="rv-cinematic-preset-taxonomy">
      {CINEMATIC_CATEGORY_ORDER.map(category => {
        const categoryGroups = groups.filter(group => group.world.category === category)
        if (categoryGroups.length === 0) return null
        return (
          <section key={category} aria-labelledby={`cinematic-preset-category-${category}`}>
            <h3 id={`cinematic-preset-category-${category}`}>{category}</h3>
            {categoryGroups.map(group => (
              <CinematicWorldPresetCards
                key={group.world.id}
                group={group}
                props={props}
                headingId={`cinematic-preset-world-${group.world.id}`}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

function EngineSection({ engineId, presets, expandedByDefault = false, ...props }: PresetCollectionProps & {
  engineId: ReactEngineId
  expandedByDefault?: boolean
}) {
  const containsActive = presets.some(preset => (
    preset.id === props.activePresetId && preset.engine === props.activeEngineId
  ))
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


function CanvasPresetCollection({ thumbnailGenerationKey }: { thumbnailGenerationKey: string }) {
  const selectedCanvasPresetId = useReactStore(state => state.selectedCanvasPresetId)
  const selectCanvasPreset = useReactStore(state => state.selectCanvasPreset)
  const canvasPresetSettings = useReactStore(state => state.canvasPresetSettings)
  const cardPresets = useMemo(() => CANVAS_PRESETS.map(createCanvasPresetCardPreset), [])
  const cardById = useMemo(() => new Map(cardPresets.map(preset => [preset.id, preset])), [cardPresets])
  const canvasThumbnailGenerationKey = useMemo(
    () => `${thumbnailGenerationKey}:canvas:${CANVAS_PRESETS.map(item => item.id).join('|')}`,
    [thumbnailGenerationKey],
  )

  return (
    <section className="rv-preset-group" aria-label="CANVAS media presets">
      <div className="rv-preset-group-hdr">
        <span className="rv-preset-group-hdr-icon" aria-hidden="true">▣</span>
        <span className="rv-preset-group-hdr-label">CANVAS Media Presets</span>
        <span className="rv-preset-group-hdr-count">{CANVAS_PRESETS.length}</span>
      </div>
      <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>
        {CANVAS_PRESETS.map(canvasPreset => {
          const cardPreset = cardById.get(canvasPreset.id)
          if (!cardPreset) return null
          return (
            <StandardReactPresetCard
              key={canvasPreset.id}
              preset={cardPreset}
              isActive={canvasPreset.id === selectedCanvasPresetId}
              modified={canvasPreset.id === selectedCanvasPresetId
                && resolveCanvasPresetProvenance(canvasPreset, canvasPresetSettings).status === 'modified'}
              activeEngineId="canvas"
              onSelect={id => selectCanvasPreset(id as CanvasPresetId)}
              thumbnailGenerationKey={canvasThumbnailGenerationKey}
              modeHintOverride={CANVAS_PRESET_CHIP_LABELS[canvasPreset.id]}
              showMore={false}
            />
          )
        })}
      </div>
    </section>
  )
}

const SHOW_DIRECTOR_CATEGORY_LABELS: Record<LaserDmxShowDirectorTemplate['category'], string> = {
  club: 'Club',
  festival: 'Festival',
  drop: 'Drop',
  led: 'LED',
  hits: 'Hits',
  movement: 'Movement',
  atmosphere: 'Atmosphere',
}

function getShowDirectorTemplateChips(template: LaserDmxShowDirectorTemplate): ReactPresetCardChip[] {
  const triggerModes = Array.from(new Set(template.fixtures.map(fixture => fixture.trigger?.mode).filter(Boolean)))
  const triggerLabel = triggerModes.length === 1
    ? `${triggerModes[0]} trigger`
    : triggerModes.length > 1
      ? `${triggerModes.length} trigger types`
      : 'Static layout'
  return [
    { label: `${template.fixtures.length} fixtures` },
    { label: SHOW_DIRECTOR_CATEGORY_LABELS[template.category] },
    { label: triggerLabel },
    ...template.tags.slice(0, 2).map(tag => ({ label: tag })),
  ]
}

function ShowDirectorPerformancePresets() {
  const { performance, applyPerformancePreset } = useReactStore(useShallow(state => ({
    performance: state.laserDmxShowDirectorPerformance,
    applyPerformancePreset: state.applyLaserDmxShowDirectorPerformancePreset,
  })))
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readLaserDmxShowDirectorPerformanceFavorites)

  const toggleFavorite = (presetId: string) => {
    setFavoriteIds(current => {
      const next = current.includes(presetId) ? current.filter(id => id !== presetId) : [...current, presetId]
      writeLaserDmxShowDirectorPerformanceFavorites(next)
      return next
    })
  }

  return (
    <section className="rv-preset-group rv-show-director-performance-preset-group" aria-label="Show Director Performance Shows">
      <div className="rv-preset-group-hdr rv-show-director-preset-group__header">
        <span className="rv-preset-group-hdr-icon" aria-hidden="true">◆</span>
        <span className="rv-preset-group-hdr-label">Show Director Performance Shows</span>
        <span className="rv-preset-group-hdr-count">{LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.length}</span>
      </div>
      {LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.length === 0 ? (
        <div className="rv-preset-library-empty rv-show-director-performance-empty">
          <strong>No Performance Shows installed</strong>
          <span>Rig Layouts remain available below. Performance Shows will appear here when installed.</span>
        </div>
      ) : (
        <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>
          {LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => {
            const isActive = performance.activePresetId === preset.id
            return (
              <ReactPresetCard
                key={preset.id}
                id={preset.id}
                title={preset.name}
                description={preset.description}
                thumbnail={<ShowDirectorPerformanceThumbnail preset={preset} />}
                chips={[
                  { label: `${preset.fixtureCount} fixtures` },
                  { label: preset.effectCountLabel ?? `≈${preset.approximatePeakBeamDemand} beams` },
                  ...preset.genreTags.slice(0, 1).map(label => ({ label })),
                  ...preset.behaviorTags.slice(0, 1).map(label => ({ label })),
                  ...preset.musicIntelligenceCapabilities.slice(0, 1).map(label => ({ label, tone: 'mode' as const })),
                ]}
                palette={getShowDirectorPerformancePresetPalette(preset).map(color => ({ color }))}
                isActive={isActive}
                isModified={isActive && performance.presetDirty}
                isFavorite={favoriteIds.includes(preset.id)}
                activateLabel={`Load Show Director performance show ${preset.name}`}
                onActivate={() => applyPerformancePreset(preset)}
                onToggleFavorite={() => toggleFavorite(preset.id)}
                expandedContent={(
                  <div className="rv-show-director-performance-card-details">
                    <span>Sections: {preset.supportedSectionRoles.join(', ')}</span>
                    <span>Music Intelligence: {preset.musicIntelligenceCapabilities.join(', ') || 'Optional'}</span>
                  </div>
                )}
                secondaryActions={isActive ? [{
                  id: performance.presetDirty ? 'restore' : 'reload',
                  label: performance.presetDirty ? 'Restore' : 'Reload',
                  ariaLabel: `${performance.presetDirty ? 'Restore' : 'Reload'} performance show ${preset.name}`,
                  onSelect: () => applyPerformancePreset(preset),
                }] : []}
                showMore
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

function ShowDirectorTemplatePresets() {
  const {
    applyTemplate,
    setAuthoringMode,
    showDirector,
    presetDirty,
  } = useReactStore(useShallow(state => ({
    applyTemplate: state.applyLaserDmxShowDirectorTemplate,
    setAuthoringMode: state.setLaserDmxBeamMatrixAuthoringMode,
    showDirector: state.laserDmxShowDirector,
    presetDirty: state.laserDmxBeamMatrixPresetDirty,
  })))

  const handleApplyTemplate = (templateId: string) => {
    if (applyTemplate(templateId)) setAuthoringMode('showDirector')
  }

  return (
    <section className="rv-preset-group rv-show-director-preset-group" aria-label="Show Director starter rig layouts">
      <div className="rv-preset-group-hdr rv-show-director-preset-group__header">
        <span className="rv-preset-group-hdr-icon" aria-hidden="true">⌁</span>
        <span className="rv-preset-group-hdr-label">Show Director Rig Layouts</span>
        <span className="rv-preset-group-hdr-count">{LASER_DMX_SHOW_DIRECTOR_TEMPLATES.length}</span>
      </div>
      <div className="rv-preset-group-cards rv-preset-group-cards--current" data-preset-grid>
        {LASER_DMX_SHOW_DIRECTOR_TEMPLATES.map(template => {
          const isActive = showDirector.sourceTemplateId === template.id
          const isModified = isActive && presetDirty
          return (
            <ReactPresetCard
              key={template.id}
              id={template.id}
              title={template.name}
              description={template.description}
              thumbnail={<ShowDirectorTemplateThumbnail template={template} />}
              chips={getShowDirectorTemplateChips(template)}
              palette={getShowDirectorTemplatePalette(template).map(color => ({ color }))}
              isActive={isActive}
              isModified={isModified}
              activateLabel={`Load Show Director rig layout ${template.name}`}
              onActivate={() => handleApplyTemplate(template.id)}
              secondaryActions={isActive ? [{
                id: isModified ? 'restore' : 'reload',
                label: isModified ? 'Restore' : 'Reload',
                ariaLabel: `${isModified ? 'Restore' : 'Reload'} Show Director rig layout ${template.name}`,
                onSelect: () => handleApplyTemplate(template.id),
              }] : []}
              showMore={false}
            />
          )
        })}
      </div>
    </section>
  )
}

function BeamMatrixRuntimePresets() {
  return (
    <section className="rv-preset-group rv-laser-dmx-preset-group" aria-label="Beam Matrix presets">
      <div className="rv-preset-group-hdr rv-laser-dmx-preset-group__header">
        <span className="rv-preset-group-hdr-icon" aria-hidden="true">⌬</span>
        <span className="rv-preset-group-hdr-label">Beam Matrix Presets</span>
        <span className="rv-preset-group-hdr-count">{LASER_DMX_BEAM_MATRIX_PRESETS.length}</span>
      </div>
      <div className="rv-laser-dmx-preset-browser-wrap">
        <LaserDmxBeamMatrixPresetBrowser />
      </div>
    </section>
  )
}

const LIBRARY_VIEW_LABELS: Record<ReactPresetLibraryView, string> = {
  current: 'Current Engine',
  favorites: 'Favorites',
  all: 'All Engines',
}

export function ReactPresetsPanel() {
  const activeBrandKit = useBrandKitStore(state => state.activeKit)
  const {
    reactPresets,
    activeReactPresetId,
    activeReactEngineId,
    selectedCanvasPresetId,
    laserDmxBeamMatrixAuthoringMode,
    cinematicConfigsByPresetId,
    reactIntensity,
    reactMotion,
    reactGlow,
    reactBassReactivity,
    reactTrailDecay,
    reactFogDensity,
    reactParticleDensity,
    oscillatorSettings,
    selectReactPreset,
  } = useReactStore(useShallow(state => ({
    reactPresets: state.reactPresets,
    activeReactPresetId: state.activeReactPresetId,
    activeReactEngineId: state.activeReactEngineId,
    selectedCanvasPresetId: state.selectedCanvasPresetId,
    laserDmxBeamMatrixAuthoringMode: state.laserDmxBeamMatrixAuthoringMode,
    cinematicConfigsByPresetId: state.cinematicConfigsByPresetId,
    reactIntensity: state.reactIntensity,
    reactMotion: state.reactMotion,
    reactGlow: state.reactGlow,
    reactBassReactivity: state.reactBassReactivity,
    reactTrailDecay: state.reactTrailDecay,
    reactFogDensity: state.reactFogDensity,
    reactParticleDensity: state.reactParticleDensity,
    oscillatorSettings: state.oscillatorSettings,
    selectReactPreset: state.selectReactPreset,
  })))
  const [libraryView, setLibraryView] = useState<ReactPresetLibraryView>('current')
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(readReactPresetFavorites)

  // Selecting an engine always opens that engine's own library. Cross-engine
  // browsing remains available through All Engines without leaving stale
  // Cinematic/other-engine content beside the newly selected workspace.
  useEffect(() => {
    setLibraryView('current')
  }, [activeReactEngineId])

  const displayPresets = useMemo(
    () => reactPresets.filter(preset => isSelectableReactEngineId(preset.engine)).map(preset => resolveBrandedReactPreset(
      preset,
      cinematicConfigsByPresetId,
      activeBrandKit,
    ) ?? preset),
    [reactPresets, cinematicConfigsByPresetId, activeBrandKit],
  )

  useEffect(() => {
    const sanitized = sanitizeReactPresetFavorites(displayPresets.filter(isReactPresetVisibleForLockedLaserDmx).map(preset => preset.id))
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
  const visiblePresets = useMemo(
    () => filterReactPresetLibrary(displayPresets, activeReactEngineId, libraryView, favoriteIds),
    [displayPresets, activeReactEngineId, libraryView, favoriteIds],
  )
  const grouped = useMemo(
    () => ENGINE_ORDER
      .map(engine => ({ engine, presets: visiblePresets.filter(preset => preset.engine === engine) }))
      .filter(group => group.presets.length > 0),
    [visiblePresets],
  )
  const activeWorld = activeCinematicWorldMode
    ? CINEMATIC_WORLD_BY_ID[activeCinematicWorldMode].label
    : null
  const cinematicWorldCount = activeReactEngineId === 'cinematicPortal'
    ? getCinematicWorldPresetGroups(visiblePresets).length
    : 0
  const activePresetProvenance = useMemo(() => resolveReactPresetProvenance({
    presets: reactPresets,
    activePresetId: activeReactPresetId,
    activeEngineId: activeReactEngineId,
    controls: {
      intensity: reactIntensity,
      motion: reactMotion,
      glow: reactGlow,
      bassReactivity: reactBassReactivity,
      trailDecay: reactTrailDecay,
      fogDensity: reactFogDensity,
      particleDensity: reactParticleDensity,
    },
    oscillatorSettings,
    expectedOscillatorSettings: active?.engine === 'oscilloscope'
      ? resolvePresetOscillatorSettings(active, oscillatorSettings)
      : undefined,
    engineSpecificModified: isCinematicPresetModified(
      reactPresets.find(preset => preset.id === activeReactPresetId),
      cinematicConfigsByPresetId,
    ),
  }), [
    reactPresets,
    activeReactPresetId,
    activeReactEngineId,
    reactIntensity,
    reactMotion,
    reactGlow,
    reactBassReactivity,
    reactTrailDecay,
    reactFogDensity,
    reactParticleDensity,
    oscillatorSettings,
    active,
    cinematicConfigsByPresetId,
  ])
  const modifiedIds = useMemo(() => {
    const ids = new Set(
      reactPresets
        .filter(preset => isCinematicPresetModified(preset, cinematicConfigsByPresetId))
        .map(preset => preset.id),
    )
    if (activePresetProvenance.status === 'modified' && activeReactPresetId) ids.add(activeReactPresetId)
    return ids
  }, [reactPresets, activePresetProvenance.status, activeReactPresetId, cinematicConfigsByPresetId])
  const activeEngine = REACT_ENGINE_CATALOG[activeReactEngineId]
  const isLaserDmxCurrentLibrary = activeReactEngineId === 'laserDmx' && libraryView === 'current'
  const isCanvasCurrentLibrary = activeReactEngineId === 'canvas' && libraryView === 'current'
  const selectedCanvasPreset = CANVAS_PRESETS.find(preset => preset.id === selectedCanvasPresetId) ?? CANVAS_PRESETS[0]
  const laserDmxPresetCount = laserDmxBeamMatrixAuthoringMode === 'showDirector'
    ? LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.length + LASER_DMX_SHOW_DIRECTOR_TEMPLATES.length
    : LASER_DMX_BEAM_MATRIX_PRESETS.length
  const laserDmxPresetScopeLabel = laserDmxBeamMatrixAuthoringMode === 'showDirector'
    ? `${LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.length} Performance Shows · ${LASER_DMX_SHOW_DIRECTOR_TEMPLATES.length} Rig Layouts`
    : `${laserDmxPresetCount} Beam Matrix preset${laserDmxPresetCount === 1 ? '' : 's'}`
  const thumbnailGenerationKey = useMemo(
    () => `${activeReactEngineId}:${libraryView}:${visiblePresets.map(preset => preset.id).join('|')}`,
    [activeReactEngineId, libraryView, visiblePresets],
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
    onSelect: selectReactPreset,
    onToggleFavorite: toggleFavorite,
    thumbnailGenerationKey,
  }

  const presetLibraryContent = isCanvasCurrentLibrary ? (
    <CanvasPresetCollection thumbnailGenerationKey={thumbnailGenerationKey} />
  ) : isLaserDmxCurrentLibrary ? (
    laserDmxBeamMatrixAuthoringMode === 'showDirector'
      ? (
          <>
            <ShowDirectorPerformancePresets />
            <ShowDirectorTemplatePresets />
          </>
        )
      : <BeamMatrixRuntimePresets />
  ) : visiblePresets.length === 0 ? (
    <div className="rv-preset-library-empty">
      <strong>{libraryView === 'favorites' ? 'No favorite presets yet' : `No ${activeEngine.label} presets found`}</strong>
      <span>{libraryView === 'favorites' ? 'Choose ☆ on a preset to pin it here.' : 'Use the Design tab to edit the active engine look.'}</span>
    </div>
  ) : libraryView === 'current' ? (
    activeReactEngineId === 'cinematicPortal'
      ? <CinematicCurrentPresetBrowser presets={visiblePresets} activeWorldMode={activeCinematicWorldMode} {...collectionProps} />
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
  )

  return (
    <div className="rv-presets-panel">
      <header className="rv-preset-library-header">
        <div className="rv-preset-library-engine">
          <span aria-hidden="true">{activeEngine.icon}</span>
          <div>
            <strong>{activeEngine.label}</strong>
            <small>{isLaserDmxCurrentLibrary
              ? laserDmxPresetScopeLabel
              : isCanvasCurrentLibrary
                ? `${CANVAS_PRESETS.length} CANVAS media presets`
                : libraryView === 'current'
                  ? activeReactEngineId === 'cinematicPortal'
                    ? `${visiblePresets.length} presets across ${cinematicWorldCount} worlds`
                    : `${visiblePresets.length} presets for the selected engine`
                  : `${visiblePresets.length} presets shown`}</small>
            {activePresetProvenance.status === 'modified' && activePresetProvenance.preset && (
              <small role="status">Modified from {activePresetProvenance.preset.name}</small>
            )}
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
            ? `Load an ${activeWorld} preset, or choose another World from the left SOURCE panel.`
            : activeReactEngineId === 'canvas'
              ? 'CANVAS presets transform active uploaded media. Auto Select can choose presets from Audio Intelligence.'
              : activeReactEngineId === 'laserDmx'
                ? laserDmxBeamMatrixAuthoringMode === 'showDirector'
                  ? 'Performance Shows combine a deterministic program with a rig. Rig Layouts remain static, and Matrix mode contains Beam Matrix looks.'
                  : 'Beam Matrix looks only. Switch to Show Director for Performance Shows and Rig Layouts.'
                : `${activeEngine.label} presets only. Use All Engines to browse other engines.`
          : libraryView === 'favorites'
            ? 'Star presets from any engine to keep them together here.'
            : 'Selecting another engine’s preset switches that engine and loads the look.'}
      </p>

      {activeReactEngineId === 'oscilloscope' ? (
        <div className="rv-sound-drawing-presets-help drm-help-overlay-anchor">
          {presetLibraryContent}
          <HelpInfoTrigger
            helpId="react.soundDrawing.presetLibrary"
            currentValue={`${active?.name ?? 'No preset selected'} · ${LIBRARY_VIEW_LABELS[libraryView]} · ${visiblePresets.length} shown`}
            currentValueTone={active ? 'accent' : 'default'}
            placement="left"
          />
        </div>
      ) : activeReactEngineId === 'laserDmx' ? (
        <div className="rv-laser-presets-help drm-help-overlay-anchor">
          {presetLibraryContent}
          <HelpInfoTrigger
            helpId="react.laserDmx.presetLibrary"
            currentValue={`${laserDmxBeamMatrixAuthoringMode === 'showDirector' ? 'Show Director' : 'Matrix'} · ${LIBRARY_VIEW_LABELS[libraryView]} · ${laserDmxPresetScopeLabel}`}
            currentValueTone="accent"
            placement="left"
          />
        </div>
      ) : activeReactEngineId === 'pixGrid' ? (
        <div className="rv-pix-grid-presets-help drm-help-overlay-anchor">
          {presetLibraryContent}
          <HelpInfoTrigger
            helpId="react.pixGrid.presetLibrary"
            currentValue={`${active?.engine === 'pixGrid' ? active.name : 'No PixGrid preset selected'} · ${LIBRARY_VIEW_LABELS[libraryView]} · ${visiblePresets.length} shown`}
            currentValueTone={active?.engine === 'pixGrid' ? 'accent' : 'default'}
            placement="left"
          />
        </div>
      ) : activeReactEngineId === 'canvas' ? (
        <div className="rv-canvas-presets-help drm-help-overlay-anchor">
          {presetLibraryContent}
          <HelpInfoTrigger
            helpId="react.canvas.presetLibrary"
            currentValue={`${selectedCanvasPreset?.name ?? 'No CANVAS preset selected'} · ${LIBRARY_VIEW_LABELS[libraryView]} · ${libraryView === 'current' ? `${CANVAS_PRESETS.length} CANVAS presets` : `${visiblePresets.length} shown`}`}
            currentValueTone={selectedCanvasPreset ? 'accent' : 'default'}
            placement="left"
          />
        </div>
      ) : presetLibraryContent}
    </div>
  )
}
