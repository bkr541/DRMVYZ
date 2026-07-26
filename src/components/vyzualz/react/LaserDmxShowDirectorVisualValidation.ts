import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type LaserDmxMatrixBeamVisualRole,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorState,
  type LaserDmxShowDirectorWebGLQuality,
  type ReactTrackSection,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import { getRigBackedPerformanceShowDefinition } from './LaserDmxShowDirectorRigBackedPerformanceShows'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import { applyShowDirectorPerformanceGlobalOverrides } from './renderers/LaserDmxRenderer'
import {
  createLaserDmxSceneFrame,
  resolveLaserDmxSceneFrameOutput,
  type LaserDmxSceneFrame,
} from './renderers/laserDmx/LaserDmxSceneFrame'
import {
  compileLaserDmxBeamMatrix,
  resetBeamMatrixCompilerState,
  type CompiledLaserDmxMatrixBeam,
} from './renderers/LaserDmxBeamMatrixCompiler'

export const SHOW_DIRECTOR_VISUAL_VALIDATION_SEED = 0x5a17cafe
export const SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE = Object.freeze({ width: 640, height: 360 })
export const SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK = Object.freeze({
  id: 'show-director-visual-validation-track',
  label: 'Deterministic 120 BPM four-on-the-floor validation track',
  bpm: 120,
  timeSignature: 4,
  durationSec: 140,
  loopIdentity: 'visual-loop-0',
})

function createValidationMicroSections(
  idPrefix: string,
  label: string,
  type: ReactTrackSection['type'],
  startSec: number,
  endSec: number,
  intensity: number,
): ReactTrackSection[] {
  const count = Math.ceil((endSec - startSec) / 4)
  return Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}-${index + 1}`,
    label: `${label} ${index + 1}`,
    type,
    startSec: startSec + index * 4,
    endSec: Math.min(endSec, startSec + (index + 1) * 4),
    intensity,
    source: 'auto' as const,
    confidence: 1,
  }))
}

/**
 * Four-second micro sections intentionally exercise the continuity layer. The
 * context builder must merge them into musical macro sections so four-bar
 * variation and eight-bar recruitment remain reachable despite short Track Map
 * entries.
 */
export const SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS: ReactTrackSection[] = [
  ...createValidationMicroSections('intro', 'Intro', 'intro', 0, 16, 0.34),
  ...createValidationMicroSections('verse', 'Verse', 'verse', 16, 32, 0.54),
  ...createValidationMicroSections('build', 'Build', 'build', 32, 48, 0.8),
  ...createValidationMicroSections('pre-drop', 'Pre-Drop', 'preDrop', 48, 52, 0.68),
  ...createValidationMicroSections('drop-1', 'Drop 1', 'drop', 52, 76, 1),
  ...createValidationMicroSections('breakdown', 'Breakdown', 'breakdown', 76, 92, 0.28),
  ...createValidationMicroSections('drop-2', 'Drop 2', 'drop', 92, 124, 1),
  ...createValidationMicroSections('outro', 'Outro', 'outro', 124, 140, 0.3),
]

export type ShowDirectorVisualValidationFrameId =
  | 'intro' | 'verse' | 'build' | 'pre-drop' | 'drop-1-impact'
  | 'drop-1-body' | 'breakdown' | 'drop-2-impact' | 'drop-2-body' | 'outro'

export interface ShowDirectorVisualValidationFrameDefinition {
  id: ShowDirectorVisualValidationFrameId
  timeSec: number
  beat?: boolean
  kick?: boolean
  snare?: boolean
  hat?: boolean
  transient?: number
}

/**
 * Deliberately placed just after deterministic eight-beat boundaries. This lets
 * the browser review prime beat-division envelopes on the preceding frame and
 * then capture the authored response, rather than testing an impossible isolated
 * first render where synthetic trigger routes intentionally remain dormant.
 */
export const SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES: readonly ShowDirectorVisualValidationFrameDefinition[] = Object.freeze([
  { id: 'intro', timeSec: 4.02, hat: true },
  { id: 'verse', timeSec: 20.02, kick: true },
  { id: 'build', timeSec: 40.02, hat: true },
  { id: 'pre-drop', timeSec: 48.02, snare: true },
  { id: 'drop-1-impact', timeSec: 52.02, kick: true, snare: true, transient: 1 },
  { id: 'drop-1-body', timeSec: 68.02, kick: true },
  { id: 'breakdown', timeSec: 84.02, hat: true },
  { id: 'drop-2-impact', timeSec: 92.12, kick: true, snare: true, transient: 1 },
  { id: 'drop-2-body', timeSec: 112.02, hat: true },
  { id: 'outro', timeSec: 139.5, beat: false },
])

function sectionAt(timeSec: number): ReactTrackSection {
  return SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec)
    ?? SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS[SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS.length - 1]
}

export function createShowDirectorVisualValidationFrame(
  definition: ShowDirectorVisualValidationFrameDefinition,
): MusicIntelligenceFrame {
  const section = sectionAt(definition.timeSec)
  const absoluteBeat = definition.timeSec * SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.bpm / 60
  const beatIndex = Math.floor(absoluteBeat)
  const progress = (definition.timeSec - section.startSec) / Math.max(0.001, section.endSec - section.startSec)
  const drop = section.type === 'drop'
  const energy = drop ? 0.96 : section.type === 'build' ? 0.82 : section.type === 'breakdown' ? 0.3 : section.intensity
  const beatHit = definition.beat ?? true
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: definition.timeSec,
    frameId: Math.round(definition.timeSec * 60),
    trackId: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.id,
    sourceId: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.id,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.76, bass: 0.82, mid: 0.5, high: 0.58, volume: energy,
      normalizedSub: 0.76, normalizedBass: 0.82, normalizedMid: 0.5, normalizedHigh: 0.58,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.bpm,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatHit,
      beatInBar: beatIndex % SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature,
      barIndex: Math.floor(beatIndex / SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature),
      downbeatHit: beatHit && beatIndex % SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature === 0,
      kickHit: definition.kick ?? false,
      kickStrength: definition.kick ? 1 : 0,
      snareHit: definition.snare ?? false,
      snareStrength: definition.snare ? 1 : 0,
      hatHit: definition.hat ?? false,
      hatStrength: definition.hat ? 1 : 0,
      transient: definition.transient ?? 0,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy,
      shortTerm: energy,
      longTerm: 0.56,
      peak: 0.98,
      delta: section.type === 'build' ? 0.14 : 0.02,
      buildProgress: section.type === 'build' || section.type === 'preDrop' ? progress : 0,
      dropImpact: drop && progress < 0.08 ? 1 : 0.18,
      tension: section.type === 'build' || section.type === 'preDrop' ? 0.82 : 0.42,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section.type,
      label: section.label,
      startSec: section.startSec,
      endSec: section.endSec,
      progress,
      intensity: section.intensity,
      confidence: 1,
      source: 'analysis',
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      beatGrid: true,
      rhythmEvents: true,
      sections: true,
      liveBands: true,
      trackEnergyCurve: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
  }
}

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function rounded(value: number, places = 4): number {
  const scale = 10 ** places
  return Math.round(value * scale) / scale
}

function stableFixtureSnapshot(fixture: LaserDmxShowDirectorFixture): string {
  const targets = (fixture.beam.targets ?? []).map(target => `${rounded(target.x, 3)},${rounded(target.y, 3)}`).join(';')
  return [
    fixture.semanticKey ?? fixture.id,
    fixture.kind,
    fixture.enabled ? 1 : 0,
    rounded(fixture.brightness, 3),
    fixture.color.toLowerCase(),
    rounded(fixture.rotation, 2),
    rounded(fixture.beam.targetX ?? 0, 2),
    rounded(fixture.beam.targetY ?? 0, 2),
    rounded(fixture.beam.beamSpread, 2),
    rounded(fixture.beam.focus, 3),
    targets,
    fixture.component.movingHeadPanTiltStyle,
    rounded(fixture.component.hazeIntensity, 3),
    Math.round(fixture.component.co2BurstDurationMs),
    Math.round(fixture.trigger.fadeOutMs),
  ].join(':')
}

function activeFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return fixture.enabled && fixture.brightness > 0.04 && fixture.runtimeOutputGate?.open !== false
}

function activeMatrixSourceFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return activeFixture(fixture) && fixture.kind !== 'haze' && fixture.kind !== 'co2Jet' && fixture.kind !== 'videoWall'
}

export interface ShowDirectorVisualEffectMetrics {
  activeFixtureCount: number
  activeBeamFixtureCount: number
  activeLedFixtureCount: number
  activeRowCount: number
  activeColumnCount: number
  activeMovingHeadCount: number
  activeMovementBankCount: number
  movementPositionSpread: number
  strobeActivations: number
  blinderActivations: number
  hazeFixtureCount: number
  hazeLevel: number
  co2BurstCount: number
  maximumStrobeDurationMs: number
  maximumBlinderDurationMs: number
  maximumCo2BurstDurationMs: number
  simultaneousColorCount: number
  aggregateBrightness: number
  averageBrightness: number
  maximumBrightness: number
  stateSignature: string
  movementSignature: string
  effectSignature: string
}

function fixtureBankParticipation(presetId: string, activeKeys: Set<string>): number {
  const definition = getRigBackedPerformanceShowDefinition(presetId)
  const movementKeys = definition?.effectCountReporting?.movementBankKeys ?? []
  return movementKeys.filter(bankKey => {
    const bank = definition?.fixtureBanks[bankKey]
    return (bank?.address.fixtureSemanticKeys ?? []).some(key => activeKeys.has(key))
  }).length
}

export function measureShowDirectorFixtureEffects(
  presetId: string,
  showDirector: LaserDmxShowDirectorState,
): ShowDirectorVisualEffectMetrics {
  const active = showDirector.fixtures.filter(activeFixture)
  const activeKeys = new Set(active.map(fixture => fixture.semanticKey ?? fixture.id))
  const leds = active.filter(fixture => fixture.kind === 'ledBar' || fixture.kind === 'ledTube')
  const heads = active.filter(fixture => fixture.kind === 'movingHead')
  const strobes = active.filter(fixture => fixture.kind === 'strobe')
  const blinders = active.filter(fixture => fixture.kind === 'blinder')
  const haze = active.filter(fixture => fixture.kind === 'haze')
  const co2 = active.filter(fixture => fixture.kind === 'co2Jet')
  const targetPoints = heads.flatMap(fixture => {
    const targets = fixture.beam.targets?.length
      ? fixture.beam.targets
      : [{ id: 'primary', x: fixture.beam.targetX ?? fixture.x, y: fixture.beam.targetY ?? fixture.y }]
    return targets.map(target => ({ x: target.x, y: target.y }))
  })
  const movementPositionSpread = targetPoints.length > 1
    ? Math.hypot(
        Math.max(...targetPoints.map(point => point.x)) - Math.min(...targetPoints.map(point => point.x)),
        Math.max(...targetPoints.map(point => point.y)) - Math.min(...targetPoints.map(point => point.y)),
      )
    : 0
  const hazeLevel = haze.length
    ? haze.reduce((sum, fixture) => sum + fixture.brightness * fixture.component.hazeIntensity, 0) / haze.length
    : 0
  const brightnessValues = active.map(fixture => fixture.brightness)
  const aggregateBrightness = brightnessValues.reduce((sum, value) => sum + value, 0)
  const stateSignature = active.map(stableFixtureSnapshot).sort().join('|')
  const movementSignature = heads.map(stableFixtureSnapshot).sort().join('|')
  const effectSignature = [
    `led:${leds.map(fixture => fixture.semanticKey ?? fixture.id).sort().join(',')}`,
    `head:${heads.map(fixture => fixture.semanticKey ?? fixture.id).sort().join(',')}`,
    `strobe:${strobes.map(fixture => fixture.semanticKey ?? fixture.id).sort().join(',')}`,
    `blinder:${blinders.map(fixture => fixture.semanticKey ?? fixture.id).sort().join(',')}`,
    `haze:${rounded(hazeLevel, 3)}`,
    `co2:${co2.map(fixture => fixture.semanticKey ?? fixture.id).sort().join(',')}`,
  ].join('|')
  const maxDuration = (fixtures: LaserDmxShowDirectorFixture[], selector: (fixture: LaserDmxShowDirectorFixture) => number): number => (
    fixtures.length ? Math.max(...fixtures.map(selector)) : 0
  )
  return {
    activeFixtureCount: active.length,
    activeBeamFixtureCount: showDirector.fixtures.filter(activeMatrixSourceFixture).length,
    activeLedFixtureCount: leds.length,
    activeRowCount: new Set(leds.map(fixture => rounded(fixture.y, 3))).size,
    activeColumnCount: new Set(leds.map(fixture => rounded(fixture.x, 3))).size,
    activeMovingHeadCount: heads.length,
    activeMovementBankCount: fixtureBankParticipation(presetId, activeKeys),
    movementPositionSpread: rounded(movementPositionSpread, 3),
    strobeActivations: strobes.length,
    blinderActivations: blinders.length,
    hazeFixtureCount: haze.length,
    hazeLevel: rounded(hazeLevel, 4),
    co2BurstCount: co2.length,
    maximumStrobeDurationMs: maxDuration(strobes, fixture => fixture.trigger.fadeOutMs),
    maximumBlinderDurationMs: maxDuration(blinders, fixture => fixture.trigger.fadeOutMs),
    maximumCo2BurstDurationMs: maxDuration(co2, fixture => fixture.component.co2BurstDurationMs),
    simultaneousColorCount: new Set(active.map(fixture => fixture.color.toLowerCase())).size,
    aggregateBrightness: rounded(aggregateBrightness, 4),
    averageBrightness: brightnessValues.length ? rounded(aggregateBrightness / brightnessValues.length, 4) : 0,
    maximumBrightness: brightnessValues.length ? rounded(Math.max(...brightnessValues), 4) : 0,
    stateSignature,
    movementSignature,
    effectSignature,
  }
}

export interface ShowDirectorVisualValidationResolution {
  presetId: string
  presetName: string
  sourceRigLayoutId: string | null
  performanceProgramId: string
  frame: ShowDirectorVisualValidationFrameDefinition
  renderSettleMs: number
  trackAssumptions: typeof SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK
  deterministicSeed: number
  section: string
  beat: number
  bar: number
  absoluteBar: number
  fourBarIndex: number
  eightBarIndex: number
  sixteenBarIndex: number
  dropOccurrence: number
  fixtureCount: number
  activeFixtureCount: number
  authoredBeamCount: number
  compiledBeamCount: number
  visibleBeamCount: number
  activeMotif: string | null
  recruitmentStage: number
  staticSourceRigImmutable: boolean
  beams: CompiledLaserDmxMatrixBeam[]
  metrics: ShowDirectorVisualGeometryMetrics
  effects: ShowDirectorVisualEffectMetrics
  output: ReturnType<typeof compileLaserDmxBeamMatrix>['output']
  fog: ReturnType<typeof compileLaserDmxBeamMatrix>['fog']
  /** Production WebGL scene payload, resolved from the same deterministic show state. */
  sceneFrame: LaserDmxSceneFrame
}

export function showDirectorVisualValidationRenderSettleMs(
  definition: ShowDirectorVisualValidationFrameDefinition,
): number {
  if (definition.beat === false) return 0
  return 80
}

function compiledRenderScore(result: ReturnType<typeof compileLaserDmxBeamMatrix>): number {
  return result.beams.reduce((sum, beam) => sum + (
    Math.hypot(
      beam.visibleTarget.x - beam.visibleOrigin.x,
      beam.visibleTarget.y - beam.visibleOrigin.y,
    ) * beam.intensity * (beam.strobeVisible ? 1 : 0)
  ), 0)
}

function primedBeamMatrixCompile(
  settings: Parameters<typeof compileLaserDmxBeamMatrix>[0]['settings'],
  definition: ShowDirectorVisualValidationFrameDefinition,
  size: { width: number; height: number },
): ReturnType<typeof compileLaserDmxBeamMatrix> {
  const secondsPerBeat = 60 / SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.bpm
  const currentBeatBoundary = Math.floor((definition.timeSec + 0.001) / secondsPerBeat) * secondsPerBeat
  resetBeamMatrixCompilerState()

  // Build two bars of deterministic compiler history. The production compiler
  // normally arrives at a representative moment with active travel and release
  // envelopes from preceding beats; an isolated single-frame compile would
  // collapse authored grow routes back into their fixture origins.
  for (let offset = 8; offset >= 1; offset -= 1) {
    const timeSec = Math.max(0, currentBeatBoundary - offset * secondsPerBeat)
    const beatIndex = Math.floor(timeSec / secondsPerBeat + 0.001)
    const beatInBar = ((beatIndex % SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature)
      + SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature)
      % SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.timeSignature
    const hitDefinition: ShowDirectorVisualValidationFrameDefinition = {
      id: definition.id,
      timeSec,
      beat: true,
      kick: beatInBar === 0 || beatInBar === 2,
      snare: beatInBar === 1 || beatInBar === 3,
      hat: false,
      transient: 0,
    }
    compileLaserDmxBeamMatrix({
      settings,
      mi: createShowDirectorVisualValidationFrame(hitDefinition),
      timeSec,
      canvasWidth: size.width,
      canvasHeight: size.height,
    })
    const releaseDefinition: ShowDirectorVisualValidationFrameDefinition = {
      ...hitDefinition,
      timeSec: timeSec + Math.min(0.22, secondsPerBeat * 0.44),
      beat: false,
      kick: false,
      snare: false,
    }
    compileLaserDmxBeamMatrix({
      settings,
      mi: createShowDirectorVisualValidationFrame(releaseDefinition),
      timeSec: releaseDefinition.timeSec,
      canvasWidth: size.width,
      canvasHeight: size.height,
    })
  }

  const hit = compileLaserDmxBeamMatrix({
    settings,
    mi: createShowDirectorVisualValidationFrame(definition),
    timeSec: definition.timeSec,
    canvasWidth: size.width,
    canvasHeight: size.height,
  })
  const settleMs = showDirectorVisualValidationRenderSettleMs(definition)
  if (settleMs <= 0) return hit
  const releaseDefinition: ShowDirectorVisualValidationFrameDefinition = {
    ...definition,
    timeSec: definition.timeSec + settleMs / 1_000,
    beat: false,
    kick: false,
    snare: false,
    hat: false,
    transient: 0,
  }
  const settled = compileLaserDmxBeamMatrix({
    settings,
    mi: createShowDirectorVisualValidationFrame(releaseDefinition),
    timeSec: releaseDefinition.timeSec,
    canvasWidth: size.width,
    canvasHeight: size.height,
  })
  return compiledRenderScore(settled) >= compiledRenderScore(hit) ? settled : hit
}

export function resolveShowDirectorVisualValidationFrame(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  definition: ShowDirectorVisualValidationFrameDefinition,
  size = SHOW_DIRECTOR_VISUAL_VALIDATION_SIZE,
  webglQuality: LaserDmxShowDirectorWebGLQuality = 'high',
): ShowDirectorVisualValidationResolution {
  const frame = createShowDirectorVisualValidationFrame(definition)
  const program = preset.createProgram()
  const context = buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: definition.timeSec,
    frame,
    resolvedSections: SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS,
    trackIdentity: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.id,
    seekIdentity: `visual:${preset.id}:${definition.id}`,
    loopIdentity: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.loopIdentity,
    previous: null,
  })
  const authoredRig = preset.createRig(ids(`${preset.id}-visual`))
  const authoredRigSnapshot = JSON.stringify(authoredRig)
  const deterministicSeed = program.deterministicSeed ^ SHOW_DIRECTOR_VISUAL_VALIDATION_SEED
  const result = resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: authoredRig,
    program,
    context,
    tuning: program.tuning,
    programSeed: deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:visual-validation`,
    transportDiscontinuityIdentity: `visual:${definition.id}`,
  })
  const baseBeamMatrix = createDefaultLaserDmxBeamMatrixSettings()
  const authoredMatrix = compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: baseBeamMatrix,
    sections: SHOW_DIRECTOR_VISUAL_VALIDATION_SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
    fixturePriorityRoleById: result.fixturePriorityRoleById,
  })
  const matrix = applyShowDirectorPerformanceGlobalOverrides(authoredMatrix, result.requestedGlobalOutputOverrides)
  const compiled = primedBeamMatrixCompile(matrix, definition, size)
  const effects = measureShowDirectorFixtureEffects(preset.id, result.showDirector)
  const webglShowDirector: LaserDmxShowDirectorState = {
    ...result.showDirector,
    settings: {
      ...result.showDirector.settings,
      rendererMode: 'webgl',
      presentationMode: 'capture',
      webglQuality,
      webglAtmosphereQuality: webglQuality,
      webglRenderScale: 1,
    },
  }
  const unresolvedSceneFrame = createLaserDmxSceneFrame({
    showDirector: webglShowDirector,
    evaluatedBeamMatrix: baseBeamMatrix,
    audioTimeSec: definition.timeSec,
    deltaTimeSec: 1 / 60,
    isPlaying: true,
    timingDiscontinuity: true,
    trackKey: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.id,
    historyIdentity: `${preset.id}:webgl-visual-validation`,
    occurrenceSeed: context.deterministicVariationSeed,
    bpm: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK.bpm,
    beatIndex: context.absoluteBeat,
    beatPhase: context.beatPhase,
    beatHit: context.boundaries.beatBoundary,
    downbeat: context.downbeat,
    barIndex: context.absoluteBar,
    phraseIndex: context.phraseIndex,
    section: context.sectionType,
    sectionProgress: context.sectionProgress,
    energy: context.energy,
    kickHit: context.kick,
    kickStrength: context.kickStrength,
    snareHit: context.snare,
    snareStrength: context.snareStrength,
    hatHit: context.hat,
    hatStrength: context.hatStrength,
    transient: context.transient,
    fourBarBlockIndex: context.performanceFourBarBlockIndex,
    eightBarBlockIndex: context.performanceEightBarBlockIndex,
    sixteenBarBlockIndex: context.performanceSixteenBarBlockIndex,
    devicePixelRatio: 1,
    fixturePriorityById: result.fixturePriorityById,
    fixturePriorityRoleById: result.fixturePriorityRoleById,
  })
  const sceneFrame = resolveLaserDmxSceneFrameOutput(unresolvedSceneFrame, matrix)
  return {
    presetId: preset.id,
    presetName: preset.name,
    sourceRigLayoutId: preset.sourceRigLayoutId ?? null,
    performanceProgramId: program.id,
    frame: definition,
    renderSettleMs: showDirectorVisualValidationRenderSettleMs(definition),
    trackAssumptions: SHOW_DIRECTOR_VISUAL_VALIDATION_TRACK,
    deterministicSeed,
    section: result.currentSection,
    beat: context.beatWithinBar + 1,
    bar: context.barWithinMacroSection + 1,
    absoluteBar: context.absoluteTrackBarIndex + 1,
    fourBarIndex: context.performanceFourBarBlockIndex,
    eightBarIndex: context.performanceEightBarBlockIndex,
    sixteenBarIndex: context.performanceSixteenBarBlockIndex,
    dropOccurrence: context.macroDropOccurrence,
    fixtureCount: result.showDirector.fixtures.length,
    activeFixtureCount: effects.activeFixtureCount,
    authoredBeamCount: matrix.beams.filter(beam => beam.enabled).length,
    compiledBeamCount: compiled.beams.length,
    visibleBeamCount: compiled.beams.filter(beam => beam.strobeVisible && beam.intensity > 0.005).length,
    activeMotif: result.activeMotifFamily ?? null,
    recruitmentStage: result.eightBarRecruitmentStage,
    staticSourceRigImmutable: JSON.stringify(authoredRig) === authoredRigSnapshot,
    beams: compiled.beams,
    metrics: measureShowDirectorVisualGeometry(
      preset.id,
      compiled.beams,
      size.width,
      size.height,
      effects.activeBeamFixtureCount,
    ),
    effects,
    output: compiled.output,
    fog: compiled.fog,
    sceneFrame,
  }
}

export interface ShowDirectorVisualGeometryMetrics {
  activeSourceCount: number
  originDistinguishability: number
  angularDiversity: number
  protectedZoneOccupancy: number
  symmetry: number
  leftRightSymmetry: number
  topBottomSymmetry: number
  saturation: number
  luminance: number
  heroToTextureBrightnessRatio: number
  dominantColorCount: number
  dominantColorOwnership: number
  roleCounts: Record<LaserDmxMatrixBeamVisualRole, number>
  geometrySignature: string
}

function sourceKey(beam: CompiledLaserDmxMatrixBeam): string {
  return `${beam.groupId ?? 'ungrouped'}:${Math.round(beam.origin.x)}:${Math.round(beam.origin.y)}`
}

function protectedZoneContains(presetId: string, x: number, y: number, width: number, height: number): boolean {
  const nx = x / width
  const ny = y / height
  if (presetId === 'cyan-mirror-cage') return nx >= 0.445 && nx <= 0.555 && ny >= 0.08 && ny <= 0.94
  if (presetId === 'cardinal-fan-reactor') {
    const dx = (nx - 0.5) / 0.115
    const dy = (ny - 0.52) / 0.16
    return dx * dx + dy * dy <= 1
  }
  if (presetId === 'festival-front-beams-performance') return nx >= 0.455 && nx <= 0.545 && ny >= 0.14 && ny <= 0.92
  if (presetId === 'small-club-rig-performance') {
    const dx = Math.abs(nx - 0.5) / 0.085
    const dy = Math.abs(ny - 0.52) / 0.18
    return dx + dy <= 1
  }
  if (presetId === 'dubstep-drop-lasers-performance') return nx >= 0.475 && nx <= 0.525 && ny >= 0.18 && ny <= 0.86
  const dx = Math.abs(nx - 0.5) / 0.105
  const dy = Math.abs(ny - 0.52) / 0.135
  return dx + dy <= 1
}

function lineProtectedOccupancy(
  presetId: string,
  beam: CompiledLaserDmxMatrixBeam,
  width: number,
  height: number,
): number {
  let occupied = 0
  const samples = 24
  for (let index = 1; index < samples; index += 1) {
    const t = index / samples
    const x = beam.visibleOrigin.x + (beam.visibleTarget.x - beam.visibleOrigin.x) * t
    const y = beam.visibleOrigin.y + (beam.visibleTarget.y - beam.visibleOrigin.y) * t
    if (protectedZoneContains(presetId, x, y, width, height)) occupied += 1
  }
  return occupied / (samples - 1)
}

function colorFamily(beam: CompiledLaserDmxMatrixBeam): string {
  const { r, g, b } = beam.rgba
  if (Math.max(r, g, b) - Math.min(r, g, b) < 35) return 'white'
  if (r > b * 1.15 && r > g * 1.15) return r > 235 && g > 90 ? 'orange-red' : 'red-magenta'
  if (b > r * 1.12 && b > g * 1.03) return r > 120 ? 'violet' : 'blue'
  if (g > r * 1.05 && b > r * 1.18) return 'cyan'
  return 'accent'
}

function axisSymmetry(
  beams: CompiledLaserDmxMatrixBeam[],
  width: number,
  height: number,
  axis: 'horizontal' | 'vertical',
): number {
  const a = new Array<number>(12).fill(0)
  const b = new Array<number>(12).fill(0)
  for (const beam of beams) {
    const coordinate = axis === 'vertical' ? beam.visibleTarget.y / height : beam.visibleTarget.x / width
    const bin = Math.max(0, Math.min(11, Math.floor(coordinate * 12)))
    const weight = beam.intensity * Math.max(0.25, beam.beamWidth)
    const side = axis === 'vertical' ? beam.visibleTarget.x < width / 2 : beam.visibleTarget.y < height / 2
    if (side) a[bin] += weight
    else b[bin] += weight
  }
  const denominator = a.reduce((sum, value, index) => sum + Math.max(value, b[index]), 0)
  const difference = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0)
  return denominator > 0 ? Math.max(0, 1 - difference / denominator) : 1
}

export function measureShowDirectorVisualGeometry(
  presetId: string,
  beams: CompiledLaserDmxMatrixBeam[],
  width: number,
  height: number,
  activeFixtureCount: number,
): ShowDirectorVisualGeometryMetrics {
  const visible = beams.filter(beam => beam.strobeVisible && beam.intensity > 0.005)
  const sources = new Set(visible.map(sourceKey))
  const angleBins = new Set(visible.map(beam => {
    const angle = Math.atan2(beam.visibleTarget.y - beam.visibleOrigin.y, beam.visibleTarget.x - beam.visibleOrigin.x)
    return Math.round(angle / (Math.PI / 24))
  }))
  const protectedZoneOccupancy = visible.length
    ? visible.reduce((sum, beam) => sum + lineProtectedOccupancy(presetId, beam, width, height), 0) / visible.length
    : 0
  const leftRightSymmetry = axisSymmetry(visible, width, height, 'vertical')
  const topBottomSymmetry = axisSymmetry(visible, width, height, 'horizontal')
  let saturationWeight = 0
  let saturationSum = 0
  let luminanceSum = 0
  const roleCounts: Record<LaserDmxMatrixBeamVisualRole, number> = { hero: 0, primary: 0, secondary: 0, texture: 0, impact: 0 }
  const roleEnergy: Record<LaserDmxMatrixBeamVisualRole, number[]> = { hero: [], primary: [], secondary: [], texture: [], impact: [] }
  const families = new Map<string, number>()
  for (const beam of visible) {
    roleCounts[beam.visualRole] += 1
    const weight = beam.intensity * Math.max(0.25, beam.beamWidth)
    roleEnergy[beam.visualRole].push(weight)
    const max = Math.max(beam.rgba.r, beam.rgba.g, beam.rgba.b)
    const min = Math.min(beam.rgba.r, beam.rgba.g, beam.rgba.b)
    const saturation = max > 0 ? (max - min) / max : 0
    saturationSum += saturation * weight
    saturationWeight += weight
    luminanceSum += ((0.2126 * beam.rgba.r + 0.7152 * beam.rgba.g + 0.0722 * beam.rgba.b) / 255) * weight
    families.set(colorFamily(beam), (families.get(colorFamily(beam)) ?? 0) + weight)
  }
  const averageRole = (roles: LaserDmxMatrixBeamVisualRole[]) => {
    const values = roles.flatMap(role => roleEnergy[role])
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  }
  const hero = averageRole(['hero', 'impact'])
  const texture = averageRole(['texture'])
  const familyTotal = [...families.values()].reduce((sum, value) => sum + value, 0)
  const familyShares = [...families.values()].map(value => familyTotal > 0 ? value / familyTotal : 0)
  const dominantColorCount = familyShares.filter(value => value >= 0.1).length
  const geometrySignature = visible
    .map(beam => `${sourceKey(beam)}:${Math.round(beam.visibleTarget.x / 8)}:${Math.round(beam.visibleTarget.y / 8)}:${beam.visualRole}:${colorFamily(beam)}`)
    .sort()
    .join('|')
  return {
    activeSourceCount: sources.size,
    originDistinguishability: activeFixtureCount > 0 ? Math.min(1, sources.size / activeFixtureCount) : 1,
    angularDiversity: visible.length ? Math.min(1, angleBins.size / Math.min(24, visible.length)) : 0,
    protectedZoneOccupancy,
    symmetry: leftRightSymmetry,
    leftRightSymmetry,
    topBottomSymmetry,
    saturation: saturationWeight > 0 ? saturationSum / saturationWeight : 0,
    luminance: saturationWeight > 0 ? luminanceSum / saturationWeight : 0,
    heroToTextureBrightnessRatio: texture > 0 ? hero / texture : hero > 0 ? 8 : 1,
    dominantColorCount,
    dominantColorOwnership: familyShares.length ? Math.max(...familyShares) : 0,
    roleCounts,
    geometrySignature,
  }
}

function signatureDifference(leftSignature: string, rightSignature: string): number {
  const left = new Set(leftSignature.split('|').filter(Boolean))
  const right = new Set(rightSignature.split('|').filter(Boolean))
  const union = new Set([...left, ...right])
  if (!union.size) return 0
  let shared = 0
  for (const item of left) if (right.has(item)) shared += 1
  return 1 - shared / union.size
}

export function showDirectorGeometryDifference(
  a: ShowDirectorVisualGeometryMetrics,
  b: ShowDirectorVisualGeometryMetrics,
): number {
  return signatureDifference(a.geometrySignature, b.geometrySignature)
}

export function showDirectorFixtureStateDifference(
  a: ShowDirectorVisualEffectMetrics,
  b: ShowDirectorVisualEffectMetrics,
): number {
  return signatureDifference(a.stateSignature, b.stateSignature)
}

export function showDirectorRepresentativeDifference(
  a: ShowDirectorVisualValidationResolution,
  b: ShowDirectorVisualValidationResolution,
): number {
  return Math.max(
    showDirectorGeometryDifference(a.metrics, b.metrics),
    showDirectorFixtureStateDifference(a.effects, b.effects),
    signatureDifference(a.effects.effectSignature, b.effects.effectSignature),
    a.activeMotif === b.activeMotif ? 0 : 1,
  )
}
