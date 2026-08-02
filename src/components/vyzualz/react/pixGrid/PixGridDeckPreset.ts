import type { ReactPixGridDeckPresetMetadata, ReactPreset, ReactSectionMapping, ReactSectionType } from '../ReactTypes'
import { clonePixGridLayer, createDefaultPixGridState } from './PixGridDefaults'
import {
  PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX,
  PIX_GRID_DECK_PATTERN_ID,
  PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
  type PixGridDeckDefinition,
} from './PixGridDeckDomain'
import { createPixGridDeckGeneratedGroups } from './PixGridDeckRuntime'
import type { PixGridDeckCompileStatus } from './PixGridDeckCompilerContracts'
import type { PixGridDeckTransitionStatus } from './PixGridDeckTransitionCoordinator'
import type { PixGridLayer, PixGridSceneSettings } from './PixGridTypes'

export interface PixGridDeckPresetReadiness {
  deckId: string
  deckRevision: number
  enabledItemCount: number
  frameProgress: number
  transitionProgress: number
  ready: boolean
  errorCount: number
  message: string
  errors?: readonly string[]
}

const SECTION_TYPES: ReactSectionType[] = [
  'intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown',
]

function deckLayer(deck: PixGridDeckDefinition): PixGridLayer {
  const fallback = createDefaultPixGridState().layers[0]
  if (!fallback) throw new Error('PixGrid Deck Presets require a canonical PixGrid layer baseline.')
  return {
    ...clonePixGridLayer(fallback),
    id: `pix-grid-deck-layer:${deck.id}`,
    name: `${deck.name} Images`,
    frameSource: { kind: 'deck', deckId: deck.id },
    mediaId: null,
    visible: true,
    opacity: 1,
    position: { x: 0.5, y: 0.5 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    blendMode: 'normal',
    zIndex: 0,
    animations: [],
    audioReactivity: undefined,
    seed: 1,
  }
}

function thumbnailFingerprint(deck: PixGridDeckDefinition): string {
  const firstEnabled = deck.items.find(item => item.enabled) ?? null
  return [
    deck.id,
    deck.revision,
    firstEnabled?.id ?? 'none',
    firstEnabled?.revision ?? 0,
    firstEnabled?.source.fingerprint ?? 'none',
  ].join(':')
}

export function resolvePixGridDeckPresetReadiness(
  deck: PixGridDeckDefinition,
  compileStatus: PixGridDeckCompileStatus | null | undefined,
  transitionStatus: PixGridDeckTransitionStatus | null | undefined,
): PixGridDeckPresetReadiness {
  const enabledItemCount = deck.items.filter(item => item.enabled).length
  const statusMatches = compileStatus?.deckId === deck.id && compileStatus.deckRevision === deck.revision
  const transitionMatches = transitionStatus?.deckId === deck.id && transitionStatus.deckRevision === deck.revision
  const frameProgress = statusMatches ? compileStatus.progress : 0
  const transitionProgress = transitionMatches ? transitionStatus.progress : 0
  const errors = [
    ...(statusMatches ? compileStatus.items : [])
      .filter(item => item.error)
      .map(item => item.error!.message),
    ...(transitionMatches ? transitionStatus.pairs : [])
      .filter(pair => pair.error)
      .map(pair => pair.error!.message),
  ]
  const errorCount = Math.max(
    errors.length,
    (statusMatches ? compileStatus.failedItemCount : 0)
      + (transitionMatches ? transitionStatus.failedPairCount : 0),
  )
  const ready = enabledItemCount >= 2
    && statusMatches
    && compileStatus.ready
    && transitionMatches
    && transitionStatus.ready
  const message = enabledItemCount < 2
    ? 'Enable at least two images.'
    : errorCount > 0
      ? 'Resolve compilation errors before creating the Preset.'
      : ready
        ? 'Ready to create Preset.'
        : 'Preparing images and transitions…'
  return {
    deckId: deck.id,
    deckRevision: deck.revision,
    enabledItemCount,
    frameProgress,
    transitionProgress,
    ready,
    errorCount,
    message,
    errors,
  }
}

export function isPixGridDeckGeneratedPreset(
  preset: Pick<ReactPreset, 'id' | 'engine' | 'pixGridDeck'>,
): boolean {
  return preset.engine === 'pixGrid'
    && preset.id.startsWith(PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX)
    && Boolean(preset.pixGridDeck?.deckId)
}

export function createPixGridDeckGeneratedPreset(deck: PixGridDeckDefinition): ReactPreset {
  const layer = deckLayer(deck)
  const scenePrefix = `pix-grid-deck-scene:${deck.id}`
  const scenes = SECTION_TYPES.map(sectionType => ({
    id: `${scenePrefix}:${sectionType}`,
    sectionType,
    engineId: 'pixGrid' as const,
    params: {},
  }))
  const sectionMappings: ReactSectionMapping[] = SECTION_TYPES.map(sectionType => ({
    sectionType,
    sceneId: `${scenePrefix}:${sectionType}`,
  }))
  const sceneSettings: Record<string, PixGridSceneSettings> = Object.fromEntries(
    SECTION_TYPES.map(sectionType => [
      `${scenePrefix}:${sectionType}`,
      { density: 1, motionMultiplier: 1, paletteOffset: 0 },
    ]),
  )
  const firstEnabled = deck.items.find(item => item.enabled) ?? null

  return {
    id: deck.generatedPresetId,
    name: deck.name,
    description: `${deck.items.filter(item => item.enabled).length} image PixGrid Deck`,
    engine: 'pixGrid',
    palette: {
      primary: '#4ac7db',
      secondary: '#61d6aa',
      accent: '#ffffff',
      background: '#000000',
      highlight: '#b84fc9',
      text: '#ffffff',
    },
    params: { intensity: 0.9, motion: 0.65, glow: 0.6, bassReactivity: 0.75 },
    renderSettings: { trailDecay: 0.12, fogDensity: 0, particleDensity: 0 },
    scenes,
    sectionMappings,
    pixGridDeck: {
      deckId: deck.id,
      deckRevision: deck.revision,
      firstEnabledItemId: firstEnabled?.id ?? null,
      thumbnailFingerprint: thumbnailFingerprint(deck),
    },
    pixGridSettings: {
      authoredConfigurationVersion: 1,
      pattern: PIX_GRID_DECK_PATTERN_ID,
      quality: 'high',
      qualityMode: 'adaptive',
      backgroundMode: 'black',
      backgroundColor: '#000000',
      backgroundBrightness: 0,
      cellGap: 0.14,
      cellRoundness: 0.24,
      cellBrightness: 1,
      globalIntensity: 0.9,
      glowAmount: 0.6,
      diffusion: 0.08,
      rgbSubpixelMode: false,
      selectedSceneId: scenes[0]?.id ?? null,
      layers: [layer],
      groups: [...createPixGridDeckGeneratedGroups(deck.id, layer.id)],
      audioAssignments: [],
      performanceProgramId: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
      performanceEnabled: true,
      sceneSettings,
    },
  }
}

/**
 * Rebuilds generated records from the persisted Deck source of truth. This
 * keeps rename, revision, undo/redo, hydration and deletion atomic without
 * copying media or compiler state into the Preset catalog.
 */
export function reconcilePixGridDeckGeneratedPresets(
  presets: readonly ReactPreset[],
  decks: readonly PixGridDeckDefinition[],
): ReactPreset[] {
  const managedIds = new Set(decks.map(deck => deck.generatedPresetId))
  const unmanaged = presets.filter(preset => (
    !preset.id.startsWith(PIX_GRID_DECK_GENERATED_PRESET_ID_PREFIX)
    || (!managedIds.has(preset.id) && !preset.pixGridDeck)
  ))
  const generated = decks
    .filter(deck => deck.presetCreated)
    .map(createPixGridDeckGeneratedPreset)
  return [...unmanaged, ...generated]
}
