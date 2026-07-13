import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorState,
  type ReactTrackSection,
} from './ReactTypes'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  type LaserDmxShowDirectorPerformanceTimingContext,
} from './LaserDmxShowDirectorPerformanceContext'
import type {
  LaserDmxShowDirectorMixedFixtureAction,
  LaserDmxShowDirectorPerformanceMutationBase,
  LaserDmxShowDirectorPerformanceProgram,
  LaserDmxShowDirectorPerformanceScene,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  resolveLaserDmxShowDirectorPerformance,
  type LaserDmxShowDirectorPerformanceResolution,
} from './LaserDmxShowDirectorPerformanceResolver'
import {
  createRigBackedPerformanceShowRig,
  getRigBackedPerformanceShowDefinition,
} from './LaserDmxShowDirectorRigBackedPerformanceShows'
import {
  createLedBarGridPerformanceProgram,
  createMovingHeadSweepPerformanceProgram,
  LED_BAR_GRID_PERFORMANCE_BANKS,
  MOVING_HEAD_SWEEP_PERFORMANCE_BANKS,
} from './LaserDmxShowDirectorRigBackedLedMovingHeadPerformancePrograms'
import {
  createRigBackedPerformanceEffectCountReport,
  inspectRigBackedPerformanceShowSource,
} from './LaserDmxShowDirectorRigPerformanceInspection'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from './laserDmxShowDirectorTemplates'
import {
  applyShowDirectorPerformanceGlobalOverrides,
  enforceLaserDmxFinalBlackoutAuthority,
} from './renderers/LaserDmxRenderer'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.28, source: 'auto', confidence: 1 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 16, endSec: 48, intensity: 0.48, source: 'auto', confidence: 1 },
  { id: 'build', label: 'Build', type: 'build', startSec: 48, endSec: 72, intensity: 0.78, source: 'auto', confidence: 1 },
  { id: 'pre-drop', label: 'Pre-drop', type: 'preDrop', startSec: 72, endSec: 80, intensity: 0.82, source: 'auto', confidence: 1 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 80, endSec: 112, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 112, endSec: 128, intensity: 0.3, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 128, endSec: 160, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 160, endSec: 176, intensity: 0.24, source: 'auto', confidence: 1 },
]

type PerformanceId = 'led-bar-grid-performance' | 'moving-head-sweep-performance'

function sectionAt(timeSec: number): ReactTrackSection {
  return SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? SECTIONS[SECTIONS.length - 1]
}

function frameAt(
  timeSec: number,
  options: { kick?: boolean; snare?: boolean; transient?: number } = {},
): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const sectionProgress = Math.max(0, Math.min(1, (timeSec - section.startSec) / Math.max(0.001, section.endSec - section.startSec)))
  const energy = section.type === 'breakdown' || section.type === 'outro' ? 0.3 : section.type === 'drop' ? 0.94 : 0.52 + sectionProgress * 0.34
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'rig-backed-led-moving-test-source',
    trackId: 'rig-backed-led-moving-test-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.72,
      bass: 0.78,
      mid: 0.52,
      high: 0.58,
      volume: energy,
      normalizedSub: 0.72,
      normalizedBass: 0.78,
      normalizedMid: 0.52,
      normalizedHigh: 0.58,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatHit: true,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatIndex % 4 === 0,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      snareHit: options.snare ?? false,
      snareStrength: options.snare ? 1 : 0,
      transient: options.transient ?? 0,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy,
      shortTerm: energy,
      longTerm: 0.56,
      peak: 0.98,
      delta: section.type === 'build' ? 0.18 : 0.02,
      buildProgress: section.type === 'build' || section.type === 'preDrop' ? sectionProgress : 0,
      dropImpact: section.type === 'drop' && sectionProgress < 0.08 ? 1 : 0.2,
      tension: section.type === 'build' || section.type === 'preDrop' ? 0.8 : 0.45,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section.type,
      label: section.label,
      startSec: section.startSec,
      endSec: section.endSec,
      progress: sectionProgress,
      intensity: section.intensity,
      confidence: 1,
      source: 'analysis',
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { overall: 1, rhythm: 1, harmonic: 0.7, section: 1 },
  }
}

function contextAt(
  timeSec: number,
  options: {
    kick?: boolean
    snare?: boolean
    transient?: number
    previous?: LaserDmxShowDirectorPerformanceTimingContext | null
    seekIdentity?: string
    loopIdentity?: string
  } = {},
): LaserDmxShowDirectorPerformanceTimingContext {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: SECTIONS,
    trackIdentity: 'rig-backed-led-moving-test-track',
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    previous: options.previous ?? null,
  })
}

function resolveShow(
  showId: PerformanceId,
  timeSec: number,
  options: Parameters<typeof contextAt>[1] = {},
): LaserDmxShowDirectorPerformanceResolution {
  const definition = getRigBackedPerformanceShowDefinition(showId)!
  const program = definition.createProgram!()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: definition.createCanonicalRig()!,
    program,
    context: contextAt(timeSec, options),
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${showId}:patch-3-test`,
    transportDiscontinuityIdentity: `${options.seekIdentity ?? 'seek-0'}:${options.loopIdentity ?? 'loop-0'}`,
  })
}

function fixturesOfKind(state: LaserDmxShowDirectorState, kinds: readonly LaserDmxShowDirectorFixture['kind'][]): LaserDmxShowDirectorFixture[] {
  return state.fixtures.filter(fixture => kinds.includes(fixture.kind) && fixture.enabled && fixture.brightness > 0.04)
}

function fixtureMap(state: LaserDmxShowDirectorState): Map<string, LaserDmxShowDirectorFixture> {
  return new Map(state.fixtures.map(fixture => [fixture.semanticKey ?? fixture.id, fixture]))
}

function ledSignature(result: LaserDmxShowDirectorPerformanceResolution): string {
  return JSON.stringify(fixturesOfKind(result.showDirector, ['ledBar', 'ledTube']).map(fixture => ({
    key: fixture.semanticKey,
    enabled: fixture.enabled,
    brightness: Number(fixture.brightness.toFixed(4)),
    color: fixture.color,
    direction: fixture.component.ledDirection,
  })).sort((left, right) => (left.key ?? '').localeCompare(right.key ?? '')))
}

function movementSignature(result: LaserDmxShowDirectorPerformanceResolution, includeBrightness = true): string {
  return JSON.stringify(fixturesOfKind(result.showDirector, ['movingHead']).map(fixture => ({
    key: fixture.semanticKey,
    brightness: includeBrightness ? Number(fixture.brightness.toFixed(4)) : undefined,
    color: includeBrightness ? fixture.color : undefined,
    rotation: Number(fixture.rotation.toFixed(4)),
    spread: Number(fixture.beam.beamSpread.toFixed(4)),
    focus: Number(fixture.beam.focus.toFixed(4)),
    targetMode: fixture.beam.targetMode,
    targets: (fixture.beam.targets ?? []).map(target => [Number(target.x.toFixed(3)), Number(target.y.toFixed(3))]),
    style: fixture.component.movingHeadPanTiltStyle,
  })).sort((left, right) => (left.key ?? '').localeCompare(right.key ?? '')))
}

function movementTargetSignature(result: LaserDmxShowDirectorPerformanceResolution): string {
  return movementSignature(result, false)
}

function activeKeys(result: LaserDmxShowDirectorPerformanceResolution, kinds: readonly LaserDmxShowDirectorFixture['kind'][]): string[] {
  return fixturesOfKind(result.showDirector, kinds).map(fixture => fixture.semanticKey ?? fixture.id).sort()
}

function averageHeadSpread(result: LaserDmxShowDirectorPerformanceResolution): number {
  const heads = fixturesOfKind(result.showDirector, ['movingHead'])
  return heads.reduce((sum, fixture) => sum + fixture.beam.beamSpread, 0) / Math.max(1, heads.length)
}

function allSceneMutations(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceMutationBase[] {
  return [
    ...(scene.barProgression ?? []),
    ...(scene.barMutations ?? []),
    ...(scene.beatMutations ?? []),
    ...(scene.kickMutations ?? []),
    ...(scene.snareMutations ?? []),
    ...(scene.hatMutations ?? []),
    ...(scene.transientMutations ?? []),
    ...(scene.fourBarVariations ?? []),
    ...(scene.eightBarRecruitment ?? []),
    ...(scene.sixteenBarEvolution ?? []),
  ]
}

function allFixtureActions(program: LaserDmxShowDirectorPerformanceProgram): LaserDmxShowDirectorMixedFixtureAction[] {
  return program.scenes.flatMap(scene => allSceneMutations(scene).flatMap(mutation => mutation.fixtureActions ?? []))
}

function maximumImpactDuration(program: LaserDmxShowDirectorPerformanceProgram): number {
  return Math.max(0, ...program.scenes.flatMap(scene => (
    scene.beatMutations ?? []
  ).filter(mutation => mutation.id.includes('impact')).map(mutation => mutation.durationBeats ?? 0)))
}

function compiledBeamCount(result: LaserDmxShowDirectorPerformanceResolution): number {
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
  }).beams.length
}

describe('LED Bar Grid Performance', () => {
  it('registers explicit architectural fixture banks and preserves the static source Rig Layout', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    const definition = getRigBackedPerformanceShowDefinition('led-bar-grid-performance')!
    const program = definition.createProgram!()
    expect(definition.status).toBe('available')
    expect(definition.sourceRigLayoutId).toBe('led-bar-grid')
    expect(Object.keys(program.fixtureBanks ?? {})).toEqual(expect.arrayContaining([
      'lowerRowKick', 'upperRowSnare', 'leftColumnResponse', 'rightColumnResponse',
      'innerGridPrimary', 'outerGridHero', 'diagonalA', 'diagonalB',
      'textureTransient', 'fullGridImpact',
    ]))
    expect(program.scenes.map(scene => scene.energyEnvelopeKey)).toEqual([
      'intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro',
    ])
    createRigBackedPerformanceShowRig('led-bar-grid-performance')!.fixtures[0]!.brightness = 0
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
  })

  it('produces visible beat differences with separated kick and snare ownership', () => {
    const evenBeat = resolveShow('led-bar-grid-performance', 84.3)
    const oddBeat = resolveShow('led-bar-grid-performance', 84.8)
    expect(ledSignature(evenBeat)).not.toBe(ledSignature(oddBeat))

    const neutral = resolveShow('led-bar-grid-performance', 85.3)
    const kick = resolveShow('led-bar-grid-performance', 85.3, { kick: true })
    const snare = resolveShow('led-bar-grid-performance', 85.3, { snare: true })
    expect(ledSignature(kick)).not.toBe(ledSignature(neutral))
    expect(ledSignature(snare)).not.toBe(ledSignature(neutral))
    expect(ledSignature(kick)).not.toBe(ledSignature(snare))

    const kickFixtures = fixtureMap(kick.showDirector)
    const snareFixtures = fixtureMap(snare.showDirector)
    expect(kickFixtures.get('mid-bar-2')!.brightness).toBeGreaterThan(kickFixtures.get('top-bar-2')!.brightness)
    expect(snareFixtures.get('top-bar-2')!.brightness).toBeGreaterThan(snareFixtures.get('mid-bar-2')!.brightness)
  })

  it('changes four-bar ownership, recruits at eight bars, and evolves Drop 2 structurally', () => {
    const beforeFour = resolveShow('led-bar-grid-performance', 87.8)
    const afterFour = resolveShow('led-bar-grid-performance', 88.3)
    expect(afterFour.fourBarVariation).not.toBe(beforeFour.fourBarVariation)
    expect(ledSignature(afterFour)).not.toBe(ledSignature(beforeFour))

    const beforeEight = resolveShow('led-bar-grid-performance', 95.8)
    const afterEight = resolveShow('led-bar-grid-performance', 96.3)
    expect(afterEight.eightBarRecruitmentStage).toBeGreaterThan(beforeEight.eightBarRecruitmentStage)
    expect(ledSignature(afterEight)).not.toBe(ledSignature(beforeEight))

    const dropOne = resolveShow('led-bar-grid-performance', 88.3)
    const dropTwo = resolveShow('led-bar-grid-performance', 136.3)
    expect(dropOne.activeSceneId).toBe('led-grid-drop-1')
    expect(dropTwo.activeSceneId).toBe('led-grid-drop-2')
    expect(dropTwo.activeMotifFamily).not.toBe(dropOne.activeMotifFamily)
    expect(ledSignature(dropTwo)).not.toBe(ledSignature(dropOne))
  })

  it('bounds full-grid white impacts and preserves a controlled palette with no black frames', () => {
    const program = createLedBarGridPerformanceProgram()
    expect(maximumImpactDuration(program)).toBeLessThanOrEqual(0.25)
    const impact = resolveShow('led-bar-grid-performance', 84.05)
    const body = resolveShow('led-bar-grid-performance', 84.3)
    const impactLeds = fixturesOfKind(impact.showDirector, ['ledBar', 'ledTube'])
    const bodyLeds = fixturesOfKind(body.showDirector, ['ledBar', 'ledTube'])
    expect(impactLeds.filter(fixture => fixture.color.toLowerCase() === '#f7fbff')).toHaveLength(10)
    expect(bodyLeds.filter(fixture => fixture.color.toLowerCase() === '#f7fbff').length).toBeLessThan(10)

    for (const timeSec of [1.3, 20.3, 52.3, 74.3, 84.3, 114.3, 132.3, 162.3]) {
      const result = resolveShow('led-bar-grid-performance', timeSec)
      const leds = fixturesOfKind(result.showDirector, ['ledBar', 'ledTube'])
      expect(leds.length).toBeGreaterThan(0)
      expect(Math.max(...leds.map(fixture => fixture.brightness))).toBeGreaterThanOrEqual(0.22)
      expect(new Set(leds.map(fixture => fixture.color.toLowerCase())).size).toBeLessThanOrEqual(3)
    }
  })

  it('writes only supported LED properties, adds no fake laser targets, and reports LED-native counts', () => {
    const program = createLedBarGridPerformanceProgram()
    const actions = allFixtureActions(program)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(action => action.kind === 'led')).toBe(true)
    for (const action of actions) {
      expect(Object.keys(action).sort()).toEqual(expect.arrayContaining(['id', 'kind']))
      expect(action).not.toHaveProperty('targetMode')
      expect(action).not.toHaveProperty('targetPoints')
      expect(action).not.toHaveProperty('fanSpread')
      expect(action).not.toHaveProperty('movementStyle')
    }

    const source = createRigBackedPerformanceShowRig('led-bar-grid-performance')!
    const runtime = resolveShow('led-bar-grid-performance', 136.3)
    const sourceTargets = Object.fromEntries(source.fixtures.map(fixture => [fixture.semanticKey, fixture.beam.targets ?? []]))
    const runtimeTargets = Object.fromEntries(runtime.showDirector.fixtures.map(fixture => [fixture.semanticKey, fixture.beam.targets ?? []]))
    expect(runtimeTargets).toEqual(sourceTargets)
    expect(runtime.diagnostics.unsupportedFixtureActionIds).toEqual([])
    expect(compiledBeamCount(runtime)).toBeGreaterThan(0)

    const report = createRigBackedPerformanceEffectCountReport('led-bar-grid-performance', runtime.showDirector)!
    expect(report).toMatchObject({
      mode: 'ledGrid',
      activeLedFixtureCount: 10,
      activeRowCount: 4,
      activeColumnCount: 5,
      impactDurationBeats: 0.25,
      legitimateBeamCount: null,
    })
    expect(report.simultaneousColorCount).toBeLessThanOrEqual(3)
    expect(report.brightnessHierarchy.maximum).toBeGreaterThan(report.brightnessHierarchy.minimum)
  })

  it('reconstructs identical LED state after seeks and loops', () => {
    const direct = resolveShow('led-bar-grid-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const repeated = resolveShow('led-bar-grid-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const afterSeek = resolveShow('led-bar-grid-performance', 136.3, { seekIdentity: 'seek-b', loopIdentity: 'loop-a' })
    const afterLoop = resolveShow('led-bar-grid-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-b' })
    expect(ledSignature(repeated)).toBe(ledSignature(direct))
    expect(ledSignature(afterSeek)).toBe(ledSignature(direct))
    expect(ledSignature(afterLoop)).toBe(ledSignature(direct))
    expect(afterSeek.deterministicIdentity).not.toBe(direct.deterministicIdentity)
    expect(afterLoop.deterministicIdentity).not.toBe(direct.deterministicIdentity)
  })
})

describe('Moving Head Sweep Performance', () => {
  it('registers explicit movement banks and preserves the static source Rig Layout', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    const definition = getRigBackedPerformanceShowDefinition('moving-head-sweep-performance')!
    const program = definition.createProgram!()
    expect(definition.status).toBe('available')
    expect(definition.sourceRigLayoutId).toBe('moving-head-sweep')
    expect(Object.keys(program.fixtureBanks ?? {})).toEqual(expect.arrayContaining([
      'leftMovement', 'rightMovement', 'innerPrimary', 'outerHero', 'upperRear',
      'kickAccent', 'snareAccent', 'downbeatImpact', 'breakdownIsolation',
    ]))
    expect(program.scenes.map(scene => scene.energyEnvelopeKey)).toEqual([
      'intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro',
    ])
    createRigBackedPerformanceShowRig('moving-head-sweep-performance')!.fixtures[0]!.rotation = 999
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
  })

  it('keeps left and right banks distinct while beat accents preserve phrase paths', () => {
    const neutral = resolveShow('moving-head-sweep-performance', 20.3)
    const kick = resolveShow('moving-head-sweep-performance', 20.3, { kick: true })
    const snare = resolveShow('moving-head-sweep-performance', 20.3, { snare: true })
    const neutralMap = fixtureMap(neutral.showDirector)
    expect(neutralMap.get('sweep-head-fl')!.beam.targets).not.toEqual(neutralMap.get('sweep-head-fr')!.beam.targets)
    expect(neutralMap.get('sweep-head-bl')!.beam.targets).not.toEqual(neutralMap.get('sweep-head-br')!.beam.targets)
    expect(movementTargetSignature(kick)).toBe(movementTargetSignature(neutral))
    expect(movementTargetSignature(snare)).toBe(movementTargetSignature(neutral))
    expect(movementSignature(kick)).not.toBe(movementSignature(snare))

    const beatOne = resolveShow('moving-head-sweep-performance', 20.3)
    const beatTwo = resolveShow('moving-head-sweep-performance', 20.8)
    expect(movementTargetSignature(beatTwo)).toBe(movementTargetSignature(beatOne))
    expect(movementSignature(beatTwo)).not.toBe(movementSignature(beatOne))
  })

  it('compresses through build, expands on Drop 1, isolates breakdown, and evolves Drop 2 paths', () => {
    const build = resolveShow('moving-head-sweep-performance', 68.3)
    const preDrop = resolveShow('moving-head-sweep-performance', 74.3)
    const dropOne = resolveShow('moving-head-sweep-performance', 88.3)
    const breakdown = resolveShow('moving-head-sweep-performance', 114.3)
    const dropTwo = resolveShow('moving-head-sweep-performance', 136.3)

    expect(averageHeadSpread(preDrop)).toBeLessThan(averageHeadSpread(build))
    expect(averageHeadSpread(dropOne)).toBeGreaterThan(averageHeadSpread(preDrop))
    expect(activeKeys(breakdown, ['movingHead']).length).toBeLessThan(activeKeys(dropOne, ['movingHead']).length)
    expect(dropOne.activeSceneId).toBe('moving-head-drop-1')
    expect(dropTwo.activeSceneId).toBe('moving-head-drop-2')
    expect(movementTargetSignature(dropTwo)).not.toBe(movementTargetSignature(dropOne))
    expect(averageHeadSpread(dropTwo)).toBeGreaterThanOrEqual(averageHeadSpread(dropOne))
  })

  it('bounds impacts, writes only supported fixture actions, and reports legitimate moving-head beams', () => {
    const program = createMovingHeadSweepPerformanceProgram()
    expect(maximumImpactDuration(program)).toBeLessThanOrEqual(0.25)
    const actions = allFixtureActions(program)
    expect(actions.length).toBeGreaterThan(0)
    expect(new Set(actions.map(action => action.kind))).toEqual(new Set(['movingHead', 'wash']))
    const allowedMovingKeys = new Set(['id', 'kind', 'enabled', 'brightness', 'color', 'targetMode', 'targetPoints', 'fanSpread', 'focus', 'rotation', 'movementStyle'])
    const allowedWashKeys = new Set(['id', 'kind', 'enabled', 'brightness', 'color', 'fanSpread', 'focus'])
    for (const action of actions) {
      const allowed = action.kind === 'movingHead' ? allowedMovingKeys : allowedWashKeys
      expect(Object.keys(action).every(key => allowed.has(key))).toBe(true)
    }

    const runtime = resolveShow('moving-head-sweep-performance', 136.3)
    expect(runtime.diagnostics.unsupportedFixtureActionIds).toEqual([])
    const report = createRigBackedPerformanceEffectCountReport('moving-head-sweep-performance', runtime.showDirector)!
    expect(report.mode).toBe('movingHead')
    expect(report.activeMovingHeadCount).toBe(4)
    expect(report.activeMovementBankCount).toBeGreaterThanOrEqual(2)
    expect(report.representativeMovementSpread).toBeGreaterThan(20)
    expect(report.mirroredPairParticipation).toBe(4)
    expect(report.impactDurationBeats).toBe(0.25)
    expect(report.legitimateBeamCount).toBe(4)
    expect(compiledBeamCount(runtime)).toBeGreaterThanOrEqual(report.legitimateBeamCount!)
  })

  it('reconstructs deterministic seek and loop positions', () => {
    const direct = resolveShow('moving-head-sweep-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const repeated = resolveShow('moving-head-sweep-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const afterSeek = resolveShow('moving-head-sweep-performance', 136.3, { seekIdentity: 'seek-b', loopIdentity: 'loop-a' })
    const afterLoop = resolveShow('moving-head-sweep-performance', 136.3, { seekIdentity: 'seek-a', loopIdentity: 'loop-b' })
    expect(movementSignature(repeated)).toBe(movementSignature(direct))
    expect(movementSignature(afterSeek)).toBe(movementSignature(direct))
    expect(movementSignature(afterLoop)).toBe(movementSignature(direct))
    expect(afterSeek.deterministicIdentity).not.toBe(direct.deterministicIdentity)
    expect(afterLoop.deterministicIdentity).not.toBe(direct.deterministicIdentity)
  })
})

describe('Patch 3 compatibility and safety boundaries', () => {
  it('keeps fixture capability inspection clean and preserves the Patch 2 laser programs', () => {
    const ledDefinition = getRigBackedPerformanceShowDefinition('led-bar-grid-performance')!
    const movingDefinition = getRigBackedPerformanceShowDefinition('moving-head-sweep-performance')!
    expect(inspectRigBackedPerformanceShowSource(ledDefinition)?.unsupportedPropertyWarnings).toEqual([])
    expect(inspectRigBackedPerformanceShowSource(movingDefinition)?.unsupportedPropertyWarnings).toEqual([])
    expect(Object.keys(LED_BAR_GRID_PERFORMANCE_BANKS).length).toBeGreaterThanOrEqual(12)
    expect(Object.keys(MOVING_HEAD_SWEEP_PERFORMANCE_BANKS).length).toBeGreaterThanOrEqual(12)

    for (const showId of [
      'small-club-rig-performance',
      'festival-front-beams-performance',
      'dubstep-drop-lasers-performance',
    ] as const) {
      const definition = getRigBackedPerformanceShowDefinition(showId)!
      expect(definition.status).toBe('available')
      expect(definition.createProgram!().id).toBe(showId)
      expect(definition.sourceRigLayoutId).not.toBe('led-bar-grid')
      expect(definition.sourceRigLayoutId).not.toBe('moving-head-sweep')
    }
  })

  it('keeps safety blackout authority dominant over performance requests', () => {
    const authored = createDefaultLaserDmxBeamMatrixSettings()
    const authoritative = { ...authored, output: { ...authored.output, blackout: true } }
    const attemptedOverride = applyShowDirectorPerformanceGlobalOverrides(authoritative, { blackout: false, dimmer: 1 })
    expect(attemptedOverride.output.blackout).toBe(true)
    const attemptedRelease = { ...attemptedOverride, output: { ...attemptedOverride.output, blackout: false } }
    expect(enforceLaserDmxFinalBlackoutAuthority(authoritative, attemptedRelease).output.blackout).toBe(true)
  })
})
