import { useEffect, useMemo, useState } from 'react'
import { sortPresetsByName } from './presetOrder'
import { useShallow } from 'zustand/react/shallow'
import {
  resolveCinematicConfigForPreset,
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
  CANVAS_VISIBLE_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_CANVAS_PRESET_SETTINGS,
} from './ReactTypes'
import { ReactPresetThumbnail } from './ReactPresetThumbnail'
import { Badge } from './controls/Badge'
import { TagPill } from './controls/TagPill'
import { VisualPresetSearch } from './controls/VisualPresetSearch'
import { useVisualPresetSearch } from './controls/useVisualPresetSearch'
import {
  ReactPresetCard,
  type ReactPresetCardChip,
  type ReactPresetCardLayout,
} from './ReactPresetCard'
import {
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
import { LaserDmxBeamMatrixPresetBrowser, requiresBeamMatrixPresetConfirmation } from './LaserDmxBeamMatrixPresetBrowser'
import { ConfirmDialog } from './controls/ConfirmDialog'
import { LASER_DMX_BEAM_MATRIX_PRESETS } from './laserDmxBeamMatrixPresets'
import { useBrandKitStore } from '../../../features/personalization/brandKitStore'
import { resolveBrandedReactPreset } from '../../../features/personalization/resolveBrandedReactPreset'
import type { ProductionFixtureKind } from './LaserDmxProductionRig'
import { isSelectableReactEngineId, REACT_ENGINE_CATALOG } from './reactEngineCatalog'
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
} from './reactPresetLibraryState'
import { usePresetScopeFilter } from '../../../features/presetCatalog/presetCatalogStore'
import type { PresetScopeTab } from '../../../features/presetCatalog/presetScope'
import { resolvePresetDiscoveryMetadata } from './presetDiscovery'

// Clean Playback is the implicit base look CANVAS always starts on (see
// selectReactEngine), not a preset the user picks — so it is never carded in
// the presets tab. The header status can still read "Clean Playback".
const CANVAS_TAB_PRESETS = CANVAS_VISIBLE_PRESETS.filter(preset => preset.id !== DEFAULT_CANVAS_PRESET_ID)

function getModeHint(preset: ReactPreset): string | null {
  if (preset.engine === 'cinematicPortal') {
    const mode = preset.cinematicConfig?.worldMode ?? 'legacyPortal'
    return `${CINEMATIC_WORLD_BY_ID[mode].label} · ${getCinematicPresetMood(preset)}`
  }
  return null
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

function createCanvasPresetCardPreset(preset: CanvasPresetDefinition): ReactPreset {
  const intensity = preset.rendererKind === 'fragmentCollage'
    ? preset.settings.fractureIntensity ?? DEFAULT_CANVAS_PRESET_SETTINGS.fractureIntensity
    : preset.settings.intensity ?? 0.5
  const motion = Math.max(
    preset.rendererKind === 'fragmentCollage'
      ? preset.settings.fractureMotionAmount ?? DEFAULT_CANVAS_PRESET_SETTINGS.fractureMotionAmount
      : 0,
    preset.settings.motionAmount ?? 0,
    preset.settings.trailAmount ?? preset.settings.motionTrailAmount ?? 0,
    preset.settings.rgbSplit ?? 0,
    preset.settings.glitchAmount ?? 0,
    preset.settings.turbulence ?? 0,
    preset.settings.stutterRate ? Math.min(1, preset.settings.stutterRate / 8) : 0,
  )
  const glow = preset.rendererKind === 'fragmentCollage'
    ? preset.settings.fractureGlowAmount ?? DEFAULT_CANVAS_PRESET_SETTINGS.fractureGlowAmount
    : preset.settings.glow ?? 0.3
  const bassReactivity = Math.max(
    preset.settings.bassReactivity ?? preset.settings.bassBurst ?? 0,
    preset.settings.beatPulse ?? 0,
    0.45,
  )

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    ...resolvePresetDiscoveryMetadata(preset, preset.rendererKind),
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
  layout,
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
  layout?: ReactPresetCardLayout
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
      engineId={preset.engine}
      title={preset.name}
      description={isActive && modified
        ? `Source preset: ${preset.description} Current values have diverged from this recipe.`
        : preset.description}
      layout={layout}
      thumbnail={layout === 'row' ? <ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} /> : undefined}
      backdrop={preset.engine !== 'canvas' ? <ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} /> : undefined}
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
      contentBeforeDescription={detailsOpen => production ? (
        <div className="rv-production-badges" aria-label={`${preset.name} fixture families`}>
          {production.fixtureFamilyBadges.slice(0, detailsOpen ? 7 : 5).map(kind => (
            <Badge key={kind} label={FIXTURE_BADGE_LABELS[kind]} tone="#4ac7db" />
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
            {production.styleTags.map(tag => <TagPill key={tag} label={tag} />)}
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
  layout?: ReactPresetCardLayout
}

/** The empty-list message for a Presets tab: a search with no hits, or a sub-tab that has no presets. */
function emptyScopeMessage(engineLabel: string, scope: PresetScopeTab, query: string): string {
  if (query.trim()) return `No ${engineLabel} presets match your search.`
  return scope === 'user' ? 'No user presets yet.' : `No ${engineLabel} presets.`
}

function reactPresetDiscoveryMetadata(preset: ReactPreset) {
  const constellationProfile = preset.cinematicConfig?.worldSettings.mode === 'reactiveConstellation'
    ? preset.cinematicConfig.worldSettings.settings.visualDnaProfile
    : null
  const fallbackCategory = preset.engine === 'cinematicPortal'
    ? preset.cinematicConfig?.worldMode ?? 'cinematic-world'
    : preset.engine === 'pixGrid'
      ? preset.pixGridDeck ? 'media-deck' : 'pixel-art'
      : preset.engine
  return resolvePresetDiscoveryMetadata(
    preset,
    fallbackCategory,
    [
      ...(preset.productionPreset?.styleTags ?? []),
      ...(constellationProfile ? [constellationProfile] : []),
    ],
  )
}

function renderPresetCard(preset: ReactPreset, props: Omit<PresetCollectionProps, 'presets'>) {
  const isActive = preset.id === props.activePresetId && preset.engine === props.activeEngineId
  const modified = props.modifiedIds.has(preset.id)
  const isFavorite = props.favoriteIds.has(preset.id)

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
      layout={props.layout}
    />
  )
}

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
      {activeGroup.presets.map(preset => renderPresetCard(preset, { ...props, layout: 'row' }))}
    </div>
  )
}

/** A click on the active preset toggles it off to Clean Playback; any other click selects that preset. */
export function resolveCanvasPresetClick(clickedId: CanvasPresetId, activeId: CanvasPresetId): CanvasPresetId {
  return clickedId === activeId ? DEFAULT_CANVAS_PRESET_ID : clickedId
}

function CanvasPresetCollection({ thumbnailGenerationKey, query, scope, inScope }: { thumbnailGenerationKey: string; query: string; scope: PresetScopeTab; inScope: (presetKey: string) => boolean }) {
  const selectedCanvasPresetId = useReactStore(state => state.selectedCanvasPresetId)
  const selectCanvasPreset = useReactStore(state => state.selectCanvasPreset)
  const canvasPresetSettings = useReactStore(state => state.canvasPresetSettings)
  const cardPresets = useMemo(() => CANVAS_TAB_PRESETS.map(createCanvasPresetCardPreset), [])
  const cardById = useMemo(() => new Map(cardPresets.map(preset => [preset.id, preset])), [cardPresets])
  const canvasThumbnailGenerationKey = useMemo(
    () => `${thumbnailGenerationKey}:canvas:${CANVAS_TAB_PRESETS.map(item => item.id).join('|')}`,
    [thumbnailGenerationKey],
  )
  const visibleCanvasPresets = sortPresetsByName(CANVAS_TAB_PRESETS.filter(canvasPreset => inScope(canvasPreset.id)), canvasPreset => cardById.get(canvasPreset.id)?.name ?? canvasPreset.name)

  return (
    <div className="rv-preset-group-cards rv-preset-group-cards--current rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
      {visibleCanvasPresets.length === 0 && (
        <div className="rv-ctrl-info">{emptyScopeMessage('CANVAS', scope, query)}</div>
      )}
      {visibleCanvasPresets.map(canvasPreset => {
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
            // Clicking the active preset again removes it: the loaded media falls back to Clean Playback (the default preset).
            onSelect={id => selectCanvasPreset(resolveCanvasPresetClick(id as CanvasPresetId, selectedCanvasPresetId))}
            thumbnailGenerationKey={canvasThumbnailGenerationKey}
            modeHintOverride={null}
            showMore={false}
          />
        )
      })}
    </div>
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

/** The Performance Show and Rig Layout cards that match the search and the SYSTEM / USER sub-tab. */
function getVisibleShowDirectorPerformanceShows(inScope: (presetKey: string) => boolean) {
  return sortPresetsByName(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.filter(preset => inScope(preset.id)), preset => preset.name)
}

function getVisibleShowDirectorRigLayouts(inScope: (presetKey: string) => boolean) {
  return sortPresetsByName(LASER_DMX_SHOW_DIRECTOR_TEMPLATES.filter(template => inScope(template.id)), template => template.name)
}

function ShowDirectorPerformanceCards({ presets }: { presets: readonly (typeof LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS)[number][] }) {
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
    <>
      {presets.map(preset => {
        const isActive = performance.activePresetId === preset.id
        return (
          <ReactPresetCard
            key={preset.id}
            id={preset.id}
            engineId="laserDmx"
            title={preset.name}
            description={preset.description}
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
    </>
  )
}

function ShowDirectorRigLayoutCards({ templates }: { templates: readonly LaserDmxShowDirectorTemplate[] }) {
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
    <>
      {templates.map(template => {
        const isActive = showDirector.sourceTemplateId === template.id
        const isModified = isActive && presetDirty
        return (
          <ReactPresetCard
            key={template.id}
            id={template.id}
            engineId="laserDmx"
            title={template.name}
            description={template.description}
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
    </>
  )
}

/** Show Director mode: Performance Shows, then Rig Layouts, in one flat grid with no headings. */
function ShowDirectorPresetGrid({ query, scope, inScope }: { query: string; scope: PresetScopeTab; inScope: (presetKey: string) => boolean }) {
  const performanceShows = getVisibleShowDirectorPerformanceShows(inScope)
  const rigLayouts = getVisibleShowDirectorRigLayouts(inScope)
  return (
    <div className="rv-preset-group-cards rv-preset-group-cards--current rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
      <ShowDirectorPerformanceCards presets={performanceShows} />
      <ShowDirectorRigLayoutCards templates={rigLayouts} />
      {performanceShows.length + rigLayouts.length === 0 && <div className="rv-ctrl-info">{emptyScopeMessage('LaserDMX', scope, query)}</div>}
    </div>
  )
}

function BeamMatrixRuntimePresets({ inScope }: { inScope: (presetKey: string) => boolean }) {
  return <LaserDmxBeamMatrixPresetBrowser externalQuery="" presetFilter={inScope} showFilters={false} />
}

export function ReactPresetsPanel() {
  const activeBrandKit = useBrandKitStore(state => state.activeKit)
  const {
    reactPresets,
    activeReactPresetId,
    activeReactEngineId,
    laserDmxBeamMatrixAuthoringMode,
    cinematicConfigsByPresetId,
    reactIntensity,
    reactMotion,
    reactGlow,
    reactBassReactivity,
    reactTrailDecay,
    reactFogDensity,
    reactParticleDensity,
    selectReactPreset,
  } = useReactStore(useShallow(state => ({
    reactPresets: state.reactPresets,
    activeReactPresetId: state.activeReactPresetId,
    activeReactEngineId: state.activeReactEngineId,
    laserDmxBeamMatrixAuthoringMode: state.laserDmxBeamMatrixAuthoringMode,
    cinematicConfigsByPresetId: state.cinematicConfigsByPresetId,
    reactIntensity: state.reactIntensity,
    reactMotion: state.reactMotion,
    reactGlow: state.reactGlow,
    reactBassReactivity: state.reactBassReactivity,
    reactTrailDecay: state.reactTrailDecay,
    reactFogDensity: state.reactFogDensity,
    reactParticleDensity: state.reactParticleDensity,
    selectReactPreset: state.selectReactPreset,
  })))
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(readReactPresetFavorites)
  const [presetScope, setPresetScope] = useState<PresetScopeTab>('system')
  const [pendingBeamPresetId, setPendingBeamPresetId] = useState<string | null>(null)
  const inScope = usePresetScopeFilter(activeReactEngineId, presetScope)

  const displayPresets = useMemo(
    () => reactPresets.filter(preset => isSelectableReactEngineId(preset.engine)).map(preset => resolveBrandedReactPreset(
      preset,
      cinematicConfigsByPresetId,
      activeBrandKit,
    ) ?? preset),
    [reactPresets, cinematicConfigsByPresetId, activeBrandKit],
  )

  useEffect(() => {
    const sanitized = sanitizeReactPresetFavorites(reactPresets.filter(isReactPresetVisibleForLockedLaserDmx).map(preset => preset.id))
    setFavoritePresetIds(current => (
      current.length === sanitized.length && current.every((presetId, index) => presetId === sanitized[index])
        ? current
        : sanitized
    ))
  }, [displayPresets, reactPresets])

  const favoriteIds = useMemo(() => new Set(favoritePresetIds), [favoritePresetIds])
  const active = displayPresets.find(preset => preset.id === activeReactPresetId)
  const activeCinematicWorldMode = activeReactEngineId === 'cinematicPortal' && active?.engine === 'cinematicPortal'
    ? resolveCinematicConfigForPreset(active, cinematicConfigsByPresetId)?.worldMode ?? null
    : null
  const visiblePresets = useMemo(
    () => filterReactPresetLibrary(displayPresets, activeReactEngineId, 'current', favoriteIds),
    [displayPresets, activeReactEngineId, favoriteIds],
  )
  const isShowDirectorLibrary = laserDmxBeamMatrixAuthoringMode === 'showDirector'
  const searchSources = activeReactEngineId === 'canvas'
    ? CANVAS_TAB_PRESETS.map(preset => ({ ...preset, ...resolvePresetDiscoveryMetadata(preset, preset.rendererKind) }))
    : activeReactEngineId === 'laserDmx'
      ? isShowDirectorLibrary
        ? [...LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.map(preset => ({ ...preset,
          ...resolvePresetDiscoveryMetadata(preset, 'performance-show', [...preset.genreTags, ...preset.behaviorTags, ...preset.musicIntelligenceCapabilities]) })),
          ...LASER_DMX_SHOW_DIRECTOR_TEMPLATES]
        : LASER_DMX_BEAM_MATRIX_PRESETS
      : visiblePresets.map(preset => ({ ...preset, ...reactPresetDiscoveryMetadata(preset) }))
  const searchContext = `${activeReactEngineId}:${activeReactEngineId === 'laserDmx' ? laserDmxBeamMatrixAuthoringMode : ''}`
  const search = useVisualPresetSearch(activeReactEngineId, searchSources, presetScope, setPresetScope, inScope, searchContext, id => {
    const state = useReactStore.getState()
    // Use the same activation and safety rules as the existing preset cards.
    if (activeReactEngineId === 'canvas') {
      state.selectCanvasPreset(resolveCanvasPresetClick(id as CanvasPresetId, state.selectedCanvasPresetId))
    } else if (activeReactEngineId === 'laserDmx') {
      if (isShowDirectorLibrary) {
        const show = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(item => item.id === id)
        if (show) state.applyLaserDmxShowDirectorPerformancePreset(show)
        else if (state.applyLaserDmxShowDirectorTemplate(id)) state.setLaserDmxBeamMatrixAuthoringMode('showDirector')
      } else if (requiresBeamMatrixPresetConfirmation(id)) setPendingBeamPresetId(id)
      else state.applyLaserDmxBeamMatrixPreset(id)
    } else {
      const preset = visiblePresets.find(item => item.id === id)
      if (!preset) return
      if (preset.pixGridDeck) {
        const deck = state.pixGridDecks.find(item => item.id === preset.pixGridDeck?.deckId)
        const compiler = usePixGridDeckCompilerStore.getState()
        if (!deck || !resolvePixGridDeckPresetReadiness(deck, compiler.statuses[deck.id], compiler.transitionStatuses[deck.id]).ready) return
      }
      state.selectReactPreset(id)
    }
  })
  useEffect(() => { setPendingBeamPresetId(null) }, [searchContext])
  const presetQuery = search.query
  const matchesSearch = (id: string) => search.matchingIds.has(id)
  const filteredPresets = search.sortByName(visiblePresets.filter(preset => matchesSearch(preset.id)), preset => preset.id, preset => preset.name)
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
  const isLaserDmxCurrentLibrary = activeReactEngineId === 'laserDmx'
  const isCanvasCurrentLibrary = activeReactEngineId === 'canvas'
  const thumbnailGenerationKey = useMemo(
    () => `${activeReactEngineId}:${visiblePresets.map(preset => preset.id).join('|')}`,
    [activeReactEngineId, visiblePresets],
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

  // LaserDMX draws from three libraries (Beam Matrix presets, Performance Shows, Rig Layouts), shown one at a time by mode, each as a flat grid.
  const laserScopeIsEmpty = presetScope === 'user' && !isShowDirectorLibrary
    && !LASER_DMX_BEAM_MATRIX_PRESETS.some(preset => inScope(preset.id))

  const presetLibraryContent = isCanvasCurrentLibrary ? (
    <CanvasPresetCollection thumbnailGenerationKey={thumbnailGenerationKey} query={presetQuery} scope={presetScope} inScope={matchesSearch} />
  ) : isLaserDmxCurrentLibrary ? (
    isShowDirectorLibrary
      ? <ShowDirectorPresetGrid query={presetQuery} scope={presetScope} inScope={matchesSearch} />
      : laserScopeIsEmpty
        ? <div className="rv-ctrl-info">No user presets yet.</div>
        : <BeamMatrixRuntimePresets inScope={matchesSearch} />
  ) : filteredPresets.length === 0 ? (
    presetScope === 'user' && !presetQuery.trim() ? (
      <div className="rv-ctrl-info">No user presets yet.</div>
    ) : (
      <div className="rv-preset-library-empty">
        <strong>No {activeEngine.label} presets {presetQuery.trim() ? 'match your search' : 'found'}</strong>
        <span>{presetQuery.trim() ? 'Clear the search to see every preset.' : 'Use the Design tab to edit the active engine look.'}</span>
      </div>
    )
  ) : activeReactEngineId === 'cinematicPortal' ? (
    <CinematicCurrentPresetBrowser presets={filteredPresets} activeWorldMode={activeCinematicWorldMode} {...collectionProps} />
  ) : (
    <div className="rv-preset-group-cards rv-preset-group-cards--current rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">{filteredPresets.map(preset => renderPresetCard(preset, collectionProps))}</div>
  )

  return (
    <div className="rv-presets-panel" data-preset-scope={presetScope}>
      {pendingBeamPresetId && activeReactEngineId === 'laserDmx' && !isShowDirectorLibrary && <ConfirmDialog
        title="Replace modified program?" message="Applying this preset will replace your unsaved Beam Matrix program changes."
        confirmLabel="Replace" onCancel={() => setPendingBeamPresetId(null)} onConfirm={() => {
          useReactStore.getState().applyLaserDmxBeamMatrixPreset(pendingBeamPresetId); setPendingBeamPresetId(null)
        }} />}
      <VisualPresetSearch key={searchContext} {...search.searchProps} ariaLabel={`Search ${activeEngine.label} presets`}
        renderArtwork={record => {
          const preset = activeReactEngineId === 'canvas' || activeReactEngineId === 'laserDmx' ? undefined : visiblePresets.find(item => item.id === record.id)
          return preset ? <ReactPresetThumbnail preset={preset} generationKey={thumbnailGenerationKey} /> : undefined
        }} />
      <div className="rv-preset-scroll">
        {activeReactEngineId === 'laserDmx' ? (
          <div className="rv-laser-presets-list">
            {presetLibraryContent}
          </div>
        ) : activeReactEngineId === 'pixGrid' ? (
          <div className="rv-pix-grid-presets-list">
            {presetLibraryContent}
          </div>
        ) : activeReactEngineId === 'canvas' ? (
          <div className="rv-canvas-presets-list">
            {presetLibraryContent}
          </div>
        ) : presetLibraryContent}
      </div>
    </div>
  )
}
