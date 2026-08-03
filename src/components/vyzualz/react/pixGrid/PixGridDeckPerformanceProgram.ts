import type { ReactSectionType } from '../ReactTypes'
import {
  PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
  type PixGridDeckDefinition,
  type PixGridDeckPreDropBehavior,
  type PixGridDeckReactionProfileId,
} from './PixGridDeckDomain'
import {
  createPixGridDeckGeneratedGroups,
  pixGridDeckGeneratedGroupId,
} from './PixGridDeckRuntime'
import type { PixGridDeckGeneratedMaskName } from './PixGridDeckCompilerContracts'
import { resolvePixGridLayerFrameSource } from './PixGridFrameSources'
import {
  calibratePixGridBuiltInContinuousRoute,
  calibratePixGridBuiltInEventRoute,
} from './PixGridPerceptualCalibration'
import {
  PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  type PixGridContinuousRoutePlan,
  type PixGridEventRoutePlan,
  type PixGridPerformanceAction,
  type PixGridPerformanceProgram,
  type PixGridProgramBank,
  type PixGridProgramRoleBinding,
  type PixGridSectionPlan,
  type PixGridVisualRole,
} from './PixGridPerformanceTypes'
import type { PixGridReactionAssignment, PixGridState } from './PixGridTypes'

export const PIX_GRID_DECK_REACTION_PROFILE_LABELS: Readonly<Record<PixGridDeckReactionProfileId, string>> = Object.freeze({
  balanced: 'Balanced',
  graphicLogo: 'Graphic & Logo',
  photoArtwork: 'Photo & Artwork',
  highEnergy: 'High Energy',
})

type ProfileTuning = Readonly<{
  continuous: number
  events: number
  bass: number
  outline: number
  glow: number
  displacement: number
  transition: number
  transitionType: 'crossfade' | 'rowWipe' | 'pixelDissolve'
}>

const PROFILE_TUNING: Readonly<Record<PixGridDeckReactionProfileId, ProfileTuning>> = Object.freeze({
  balanced: { continuous: 1, events: 1, bass: 1, outline: 1, glow: 1, displacement: 1, transition: 1, transitionType: 'crossfade' },
  graphicLogo: { continuous: 0.95, events: 1.08, bass: 0.92, outline: 1.45, glow: 0.82, displacement: 1.2, transition: 1.08, transitionType: 'rowWipe' },
  photoArtwork: { continuous: 1.08, events: 0.78, bass: 0.8, outline: 0.72, glow: 1.42, displacement: 0.72, transition: 0.92, transitionType: 'pixelDissolve' },
  highEnergy: { continuous: 1.18, events: 1.48, bass: 1.32, outline: 1.18, glow: 1.28, displacement: 1.42, transition: 1.4, transitionType: 'pixelDissolve' },
})

const MASK_ROLES: Readonly<Record<PixGridDeckGeneratedMaskName, readonly PixGridVisualRole[]>> = Object.freeze({
  foreground: ['hero', 'primary', 'typography', 'character'],
  background: ['background', 'atmosphere', 'environment'],
  border: ['outline', 'transition'],
  highlights: ['accent', 'sparkle', 'percussion'],
  shadows: ['secondary', 'atmosphere'],
  center: ['impact', 'bass', 'primary'],
})

function deckLayers(state: PixGridState, deckId: string) {
  return state.layers.filter(layer => {
    const source = resolvePixGridLayerFrameSource(layer)
    return source.kind === 'deck' && source.deckId === deckId
  })
}

function bindingsFor(state: PixGridState, deckId: string): PixGridProgramRoleBinding[] {
  return deckLayers(state, deckId).flatMap(layer => (
    (Object.keys(MASK_ROLES) as PixGridDeckGeneratedMaskName[]).map(maskName => ({
      id: `deck-binding:${layer.id}:${maskName}`,
      target: { kind: 'group' as const, id: pixGridDeckGeneratedGroupId(deckId, layer.id, maskName) },
      roles: MASK_ROLES[maskName],
    }))
  ))
}

function groupTargets(state: PixGridState, deckId: string, names: readonly PixGridDeckGeneratedMaskName[]) {
  return deckLayers(state, deckId).flatMap(layer => names.map(name => ({
    kind: 'group' as const,
    id: pixGridDeckGeneratedGroupId(deckId, layer.id, name),
  })))
}

function banksFor(state: PixGridState, deckId: string): PixGridProgramBank[] {
  const bank = (id: string, names: readonly PixGridDeckGeneratedMaskName[], roles: readonly PixGridVisualRole[]): PixGridProgramBank => ({
    id: `deck-${id}`,
    label: id,
    roles,
    members: groupTargets(state, deckId, names),
  })
  return [
    bank('hero-bank', ['foreground', 'center'], ['hero', 'primary']),
    bank('bass-bank', ['center', 'shadows'], ['bass', 'impact']),
    bank('outline-bank', ['border', 'foreground'], ['outline', 'typography']),
    bank('accent-bank', ['highlights', 'border'], ['accent', 'sparkle', 'percussion']),
    bank('background-bank', ['background', 'shadows'], ['background', 'atmosphere']),
    bank('transition-bank', ['border', 'foreground', 'background'], ['transition']),
  ]
}

function continuousRoutes(profile: PixGridDeckReactionProfileId): PixGridContinuousRoutePlan[] {
  const tune = PROFILE_TUNING[profile]
  const routes: PixGridContinuousRoutePlan[] = [
    { id: 'deck-bass-brightness', target: { bankId: 'deck-bass-bank' }, source: 'bass', operation: 'brightness', amount: 0.42 * tune.continuous * tune.bass, curve: 'smoothstep', blend: 'add', bassReactivityEnabled: true, minimumConfidence: 0.28, capabilityFallback: 'energy', clamp: [0, 0.9], priority: -250 },
    { id: 'deck-energy-hero', target: { bankId: 'deck-hero-bank' }, source: 'trackRelativeEnergy', operation: 'brightness', amount: 0.22 * tune.continuous, curve: 'easeOut', blend: 'add', minimumConfidence: 0.25, capabilityFallback: 'energy', clamp: [0, 0.55], priority: -240 },
    { id: 'deck-energy-glow', target: { bankId: 'deck-hero-bank' }, source: 'energy', operation: 'glow', amount: 0.24 * tune.continuous * tune.glow, curve: 'smoothstep', blend: 'add', capabilityFallback: 'zero', clamp: [0, 0.75], priority: -230 },
    { id: 'deck-high-outline', target: { bankId: 'deck-outline-bank' }, source: 'spectralBrightness', operation: 'outlineIntensity', amount: 0.22 * tune.continuous * tune.outline, curve: 'easeOut', blend: 'max', minimumConfidence: 0.25, capabilityFallback: 'midHighActivity', clamp: [0, 0.65], priority: -220 },
    { id: 'deck-build-displacement', target: { bankId: 'deck-transition-bank' }, source: 'buildProgress', operation: 'pixelDisplacement', amount: 0.16 * tune.continuous * tune.displacement, curve: 'easeIn', blend: 'add', minimumConfidence: 0.3, capabilityFallback: 'energy', clamp: [0, 0.5], conditions: { sectionTypes: ['build', 'preDrop'] }, priority: -210 },
    { id: 'deck-phrase-transition', target: { scope: 'transition' }, source: 'phraseProgress', operation: 'transitionStrength', amount: 0.12 * tune.continuous * tune.transition, curve: 'easeInOut', blend: 'add', minimumConfidence: 0.3, capabilityFallback: 'zero', clamp: [0, 0.45], priority: -200 },
    { id: 'deck-background-energy', target: { bankId: 'deck-background-bank' }, source: 'sectionRelativeEnergy', operation: 'brightness', amount: 0.14 * tune.continuous, curve: 'smoothstep', blend: 'add', minimumConfidence: 0.3, capabilityFallback: 'energy', clamp: [0, 0.4], priority: -190 },
  ]
  return routes.map(calibratePixGridBuiltInContinuousRoute)
}

function eventRoutes(profile: PixGridDeckReactionProfileId): PixGridEventRoutePlan[] {
  const tune = PROFILE_TUNING[profile]
  const event = (route: PixGridEventRoutePlan) => calibratePixGridBuiltInEventRoute(route)
  return [
    event({ id: 'deck-kick-impact', target: { bankId: 'deck-bass-bank' }, event: 'kick', operation: 'scale', amount: 0.075 * tune.events * tune.bass, envelope: { attack: 0, hold: 0.035, release: 0.16, curve: 'easeOut' }, quantization: 'none', retrigger: 'restart', maximumStacking: 1, minimumConfidence: 0.3, capabilityFallback: 'beat', blend: 'add', clamp: [0, 0.2], priority: -180 }),
    event({ id: 'deck-snare-outline', target: { bankId: 'deck-outline-bank' }, event: 'snare', operation: 'outlineFlash', amount: 0.3 * tune.events * tune.outline, envelope: { attack: 0, hold: 0.035, release: 0.18, curve: 'easeOut' }, quantization: 'none', retrigger: 'restart', maximumStacking: 1, minimumConfidence: 0.3, capabilityFallback: 'transient', blend: 'max', clamp: [0, 0.85], priority: -170 }),
    event({ id: 'deck-hat-sparkle', target: { bankId: 'deck-accent-bank' }, event: 'hat', operation: 'sparkleDensity', amount: 0.18 * tune.events, envelope: { attack: 0, hold: 0.02, release: 0.11, curve: 'easeOut' }, quantization: 'none', retrigger: 'restart', maximumStacking: 1, minimumConfidence: 0.25, capabilityFallback: 'transient', blend: 'max', clamp: [0, 0.55], priority: -160 }),
    event({ id: 'deck-downbeat-pulse', target: { bankId: 'deck-hero-bank' }, event: 'downbeat', operation: 'scale', amount: 0.045 * tune.events, envelope: { attack: 0, hold: 0.045, release: 0.22, curve: 'easeOut' }, quantization: 'beat', retrigger: 'restart', maximumStacking: 1, capabilityFallback: 'beat', blend: 'add', clamp: [0, 0.14], priority: -150 }),
    event({ id: 'deck-phrase-accent', target: { bankId: 'deck-transition-bank' }, event: 'phraseEntry', operation: 'glow', amount: 0.2 * tune.events * tune.glow, envelope: { attack: 0.01, hold: 0.08, release: 0.34, curve: 'easeOut' }, quantization: 'bar', retrigger: 'restart', maximumStacking: 1, minimumConfidence: 0.3, capabilityFallback: 'zero', blend: 'add', clamp: [0, 0.6], priority: -140 }),
    event({ id: 'deck-section-accent', target: { bankId: 'deck-hero-bank' }, event: 'sectionEntry', operation: 'brightness', amount: 0.18 * tune.events, envelope: { attack: 0, hold: 0.08, release: 0.42, curve: 'easeOut' }, quantization: 'bar', retrigger: 'restart', maximumStacking: 1, minimumConfidence: 0.3, capabilityFallback: 'zero', blend: 'add', clamp: [0, 0.55], priority: -130 }),
    event({ id: 'deck-drop-impact', target: { bankId: 'deck-hero-bank' }, event: 'dropImpact', operation: 'transitionStrength', amount: 0.5 * tune.events * tune.transition, envelope: { attack: 0, hold: 0.1, release: 0.5, curve: 'easeOut' }, quantization: 'beat', retrigger: 'ignoreWhileActive', maximumStacking: 1, minimumConfidence: 0.35, capabilityFallback: 'beat', blend: 'max', clamp: [0, 1], conditions: { sectionTypes: ['drop'] }, priority: -120 }),
  ]
}

function preDropActions(behavior: PixGridDeckPreDropBehavior, groupIds: readonly string[]): readonly PixGridPerformanceAction[] {
  if (behavior === 'dim') return [{ type: 'setBackgroundState', state: 'dim', brightness: 0.04 }, ...groupIds.map(groupId => ({ type: 'setGroupBrightness' as const, groupId, brightness: 0.28 }))]
  if (behavior === 'disperse') return groupIds.map(groupId => ({ type: 'dissolveGroup' as const, groupId, amount: 0.58 }))
  if (behavior === 'previewNext') return [{ type: 'setTransition', transition: 'dissolve', durationBeats: 1 }]
  if (behavior === 'hold') return [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 0.02 }]
  return [{ type: 'changeAnimationSpeed', target: 'all', multiplier: 0.72 }]
}

function sectionPlans(
  state: PixGridState,
  profile: PixGridDeckReactionProfileId,
  preDropBehavior: PixGridDeckPreDropBehavior,
): PixGridSectionPlan[] {
  const tune = PROFILE_TUNING[profile]
  const scenePreference = state.selectedSceneId
    ? [state.selectedSceneId, ...state.scenes.map(scene => scene.id).filter(id => id !== state.selectedSceneId)]
    : state.scenes.map(scene => scene.id)
  const allGroupIds = state.groups.filter(group => group.smartRuleId?.startsWith('deck:')).map(group => group.id)
  const transition = tune.transitionType
  const base = (id: string, type: ReactSectionType, density: number, motion: number, intensity: readonly [number, number], actions: readonly PixGridPerformanceAction[] = []): PixGridSectionPlan => ({
    id: `deck-${id}`,
    sectionTypes: [type],
    priority: type === 'unknown' ? 1 : 20,
    scenePreference,
    actions: [
      { type: 'setDensity', density },
      { type: 'setTransition', transition, durationBeats: Math.max(0.25, (type === 'drop' ? 0.5 : 1.5) / tune.transition) },
      ...actions,
    ],
    continuousRouteIds: continuousRoutes(profile).map(route => route.id),
    eventRouteIds: eventRoutes(profile).map(route => route.id),
    motionState: { amount: motion, direction: 'alternate', grammar: `deck-${profile}-${type}` },
    paletteState: { intensity: intensity[1], primaryRole: 'primary', accentRole: 'accent' },
    densityState: { value: density, minimum: Math.max(0, density - 0.18), maximum: Math.min(1, density + 0.14) },
    intensityRange: intensity,
    negativeSpaceTarget: Math.max(0.08, 1 - density * 0.75),
    transitionIn: { type: transition, durationBeats: type === 'drop' ? 0.5 : 1.5, interruptible: true },
    variationPolicy: { deterministic: true, preserveIdentity: true, occurrenceMode: 'develop' },
  })
  return [
    base('intro', 'intro', 0.34, 0.28, [0.28, 0.58]),
    base('verse', 'verse', 0.56, 0.46, [0.42, 0.76]),
    base('build', 'build', 0.74, 0.7, [0.58, 0.92]),
    base('pre-drop', 'preDrop', 0.3, preDropBehavior === 'continue' ? 0.54 : 0.08, [0.26, 0.62], preDropActions(preDropBehavior, allGroupIds)),
    base('drop', 'drop', 0.96, 0.96, [0.82, 1.2], [{ type: 'setBackgroundState', state: 'lifted', brightness: 0.18 }]),
    base('breakdown', 'breakdown', 0.38, 0.24, [0.3, 0.62]),
    base('bridge', 'bridge', 0.58, 0.42, [0.4, 0.78]),
    base('outro', 'outro', 0.3, 0.2, [0.22, 0.5]),
    base('fallback', 'unknown', 0.5, 0.4, [0.38, 0.72]),
  ]
}

export function createPixGridDeckPerformanceProgram(
  state: PixGridState,
  deck: Pick<PixGridDeckDefinition, 'id' | 'configuration'>,
): PixGridPerformanceProgram {
  const profile = deck.configuration.reactionProfileId
  const routes = continuousRoutes(profile)
  const events = eventRoutes(profile)
  return {
    schemaVersion: PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
    id: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
    metadata: {
      name: `Media Deck: ${PIX_GRID_DECK_REACTION_PROFILE_LABELS[profile]}`,
      description: 'Canonical, quantized Deck music-reactive program using Shared Audio Intelligence and generated semantic groups.',
      engine: 'pixGrid',
      version: 1,
      visualIdentity: `media deck ${profile}`,
    },
    visualRoles: ['hero', 'primary', 'secondary', 'accent', 'outline', 'background', 'atmosphere', 'impact', 'percussion', 'bass', 'sparkle', 'transition', 'typography', 'character', 'environment'],
    bindings: bindingsFor(state, deck.id),
    banks: banksFor(state, deck.id),
    continuousRoutes: routes,
    eventRoutes: events,
    sectionPlans: sectionPlans(state, profile, deck.configuration.preDropBehavior),
    musicalArcs: [
      { id: 'deck-density-arc', kind: 'density', defaultValue: 0.5, sectionValues: { intro: 0.34, verse: 0.56, build: 0.74, preDrop: 0.3, drop: 0.96, breakdown: 0.38, bridge: 0.58, outro: 0.3 }, clamp: [0, 1] },
      { id: 'deck-motion-arc', kind: 'motion', defaultValue: 0.4, sectionValues: { intro: 0.28, verse: 0.46, build: 0.7, preDrop: 0.08, drop: 0.96, breakdown: 0.24, bridge: 0.42, outro: 0.2 }, clamp: [0, 1] },
      { id: 'deck-impact-arc', kind: 'impactStrength', defaultValue: 0.48, sectionValues: { build: 0.72, preDrop: 0.42, drop: 1 }, clamp: [0, 1] },
    ],
    fallbackOrder: ['verse', 'intro', 'breakdown', 'bridge', 'drop', 'outro'],
    fallbackSectionPlanId: 'deck-fallback',
  }
}

function canonicalPlaceholderState(): PixGridState {
  const layerId = 'deck-canonical-layer'
  const deckId = 'deck-canonical'
  return {
    version: 19,
    configuration: {} as PixGridState['configuration'], quality: 'high', qualityMode: 'fixed', matrixWidth: 160, matrixHeight: 90,
    backgroundMode: 'preset', backgroundColor: '#000000', backgroundBrightness: 0, cellGap: 0, cellRoundness: 0, cellBrightness: 1,
    globalIntensity: 1, glowAmount: 0, diffusion: 0, rgbSubpixelMode: false, stoppedBehavior: 'baseline', selectedPresetId: null,
    selectedSceneId: 'deck-canonical-scene', authoringOverlayVisible: false, editorTool: 'select',
    editor: { hasEnteredAuthoring: false, scenePreviewMode: 'followTrack', guidesVisible: false, zoom: 1, panX: 0, panY: 0, paintColor: '#ffffff', paintOpacity: 1, eraserMode: 'off', selectedLayerId: null, selectedGroupId: null, previewReactionAssignmentId: null, selection: null },
    scenes: [{ id: 'deck-canonical-scene', name: 'Deck', layerIds: [layerId], pixelOverrides: [] }],
    layers: [{ id: layerId, name: 'Deck', assetId: 'pix-checkerboard', frameSource: { kind: 'deck', deckId }, mediaId: null, visible: true, opacity: 1, position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, flipX: false, flipY: false, blendMode: 'normal', paletteMap: {}, zIndex: 0, clipMode: 'clip', maskAssetId: null, animations: [], densityRank: 0, seed: 1 }],
    groups: [...createPixGridDeckGeneratedGroups(deckId, layerId)], audioAssignments: [], pixelOverrides: [],
    performance: { enabled: true, intensity: 1, sharedPerformanceProgramId: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID, seed: 1, lockedRoutes: [], programOverrides: { routes: {}, sections: {} } },
    conversion: {} as PixGridState['conversion'], diagnostics: {} as PixGridState['diagnostics'],
  }
}

/** Registry entry. Runtime Decks use createPixGridDeckPerformanceProgram so targets bind to their real generated groups. */
export const PIX_GRID_MEDIA_DECK_PERFORMANCE_PROGRAM: PixGridPerformanceProgram = createPixGridDeckPerformanceProgram(
  canonicalPlaceholderState(),
  { id: 'deck-canonical', configuration: { reactionProfileId: 'balanced', preDropBehavior: 'hold' } as PixGridDeckDefinition['configuration'] },
)

function manualAssignment(
  id: string,
  source: PixGridReactionAssignment['source'],
  target: PixGridReactionAssignment['target'],
  targetId: string,
  amount: number,
  fallback: PixGridReactionAssignment['capabilityFallback'],
  bassReactivityEnabled = false,
): PixGridReactionAssignment {
  return {
    id, name: id, enabled: true, source, target, targetScope: 'group', targetId, amount,
    invert: false, threshold: 0.04, attack: 0.02, hold: 0, release: 0.18, smoothing: 0.035,
    quantization: 'none', retrigger: 'restart', minimumConfidence: 0.22, capabilityFallback: fallback,
    clamp: [0, 1], blend: 'add', bassReactivityEnabled,
  }
}

/**
 * Adds basic, non-persistent reactions for manual mode. No section conditions,
 * scene actions, frameAdvance, or source-frame mutation is introduced.
 */
export function applyPixGridDeckManualAudioReactions(state: PixGridState, deckId: string): PixGridState {
  let changed = false
  const groups = state.groups.map(group => {
    if (!group.smartRuleId?.startsWith(`deck:${deckId}:`)) return group
    const parts = group.smartRuleId.split(':')
    const maskName = parts[parts.length - 1] as PixGridDeckGeneratedMaskName | undefined
    const reactions: PixGridReactionAssignment[] = []
    if (maskName === 'foreground' || maskName === 'background') reactions.push(manualAssignment(`deck-manual:${group.id}:brightness`, 'energy', 'brightness', group.id, maskName === 'foreground' ? 0.2 : 0.12, 'zero'))
    if (maskName === 'border' || maskName === 'highlights') reactions.push(manualAssignment(`deck-manual:${group.id}:glow`, 'spectralBrightness', 'glow', group.id, maskName === 'border' ? 0.2 : 0.16, 'midHighActivity'))
    if (maskName === 'center') reactions.push(manualAssignment(`deck-manual:${group.id}:scale`, 'bass', 'scale', group.id, 0.065, 'energy', true))
    if (!reactions.length) return group
    const existing = new Set(group.reactions.map(reaction => reaction.id))
    const additions = reactions.filter(reaction => !existing.has(reaction.id))
    if (!additions.length) return group
    changed = true
    return { ...group, reactions: [...group.reactions, ...additions] }
  })
  return changed ? { ...state, groups } : state
}
