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
import {
  LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY,
  type LaserDmxShowDirectorMixedFixtureAction,
  type LaserDmxShowDirectorPerformanceMutationBase,
  type LaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceScene,
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
  createHazeCo2PerformanceProgram,
  createStrobeBlinderPerformanceProgram,
  HAZE_CO2_PERFORMANCE_BANKS,
  HAZE_CO2_PERFORMANCE_LIMITS,
  STROBE_BLINDER_PERFORMANCE_BANKS,
  STROBE_BLINDER_PERFORMANCE_LIMITS,
} from './LaserDmxShowDirectorRigBackedImpactAtmospherePerformancePrograms'
import { inspectRigBackedPerformanceShowSource } from './LaserDmxShowDirectorRigPerformanceInspection'
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

type PerformanceId = 'strobe-blinder-hits-performance' | 'haze-co2-drops-performance'

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
    sourceId: 'rig-backed-impact-atmosphere-test-source',
    trackId: 'rig-backed-impact-atmosphere-test-track',
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
    trackIdentity: 'rig-backed-impact-atmosphere-test-track',
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
    runtimeInvalidationId: `${showId}:patch-4-test`,
    transportDiscontinuityIdentity: `${options.seekIdentity ?? 'seek-0'}:${options.loopIdentity ?? 'loop-0'}`,
  })
}

function fixturesOfKind(
  state: LaserDmxShowDirectorState,
  kinds: readonly LaserDmxShowDirectorFixture['kind'][],
): LaserDmxShowDirectorFixture[] {
  return state.fixtures.filter(fixture => kinds.includes(fixture.kind) && fixture.enabled && fixture.brightness > 0.04)
}

function activeKeys(
  result: LaserDmxShowDirectorPerformanceResolution,
  kinds: readonly LaserDmxShowDirectorFixture['kind'][],
): string[] {
  return fixturesOfKind(result.showDirector, kinds).map(fixture => fixture.semanticKey ?? fixture.id).sort()
}

function fixtureSignature(result: LaserDmxShowDirectorPerformanceResolution, kinds: readonly LaserDmxShowDirectorFixture['kind'][]): string {
  return JSON.stringify(result.showDirector.fixtures.filter(fixture => kinds.includes(fixture.kind)).map(fixture => ({
    key: fixture.semanticKey,
    enabled: fixture.enabled,
    brightness: Number(fixture.brightness.toFixed(5)),
    color: fixture.color,
    fadeOutMs: fixture.trigger.fadeOutMs,
    strobeRate: fixture.component.strobeRate,
    hazeIntensity: fixture.component.hazeIntensity,
    co2BurstDurationMs: fixture.component.co2BurstDurationMs,
  })).sort((left, right) => (left.key ?? '').localeCompare(right.key ?? '')))
}

function allSceneMutations(scene: LaserDmxShowDirectorPerformanceScene): LaserDmxShowDirectorPerformanceMutationBase[] {
  return [
    ...(scene.sectionEntryMutations ?? []),
    ...(scene.sectionBodyMutations ?? []),
    ...(scene.sectionExitMutations ?? []),
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
  return program.scenes.flatMap(scene => [
    ...(scene.fixtureActions ?? []),
    ...allSceneMutations(scene).flatMap(mutation => mutation.fixtureActions ?? []),
  ])
}

function maximumDuration(program: LaserDmxShowDirectorPerformanceProgram, kind: 'strobe' | 'blinder' | 'co2'): number {
  return Math.max(0, ...allFixtureActions(program).map(action => action.kind === kind && 'durationMs' in action ? action.durationMs ?? 0 : 0))
}

function maximumHazeAmount(program: LaserDmxShowDirectorPerformanceProgram): number {
  return Math.max(0, ...allFixtureActions(program).filter(action => action.kind === 'haze').map(action => action.amount ?? 0))
}

function maximumBeatActivationRatio(program: LaserDmxShowDirectorPerformanceProgram, kind: 'strobe' | 'blinder' | 'co2'): number {
  return Math.max(0, ...program.scenes.flatMap(scene => (scene.beatMutations ?? [])
    .filter(mutation => mutation.fixtureActions?.some(action => action.kind === kind))
    .map(mutation => mutation.responseEnvelope?.releaseUntil ?? 0.48)))
}

function scene(program: LaserDmxShowDirectorPerformanceProgram, id: string): LaserDmxShowDirectorPerformanceScene {
  return program.scenes.find(candidate => candidate.id === id)!
}

describe('Strobe + Blinder Performance', () => {
  it('registers explicit event-owner banks and preserves the canonical static Rig Layout', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    const definition = getRigBackedPerformanceShowDefinition('strobe-blinder-hits-performance')!
    const program = definition.createProgram!()
    expect(definition.status).toBe('available')
    expect(definition.displayName).toBe('Strobe + Blinder Performance')
    expect(definition.sourceRigLayoutId).toBe('strobe-blinder-hits')
    expect(Object.keys(program.fixtureBanks ?? {})).toEqual(expect.arrayContaining([
      'kickStrobeBank', 'snareStrobeBank', 'downbeatStrobeBank', 'leftBlinderBank',
      'rightBlinderBank', 'fullImpactBlinderBank', 'buildPulseBank', 'breakdownIsolationBank',
    ]))
    expect(STROBE_BLINDER_PERFORMANCE_BANKS.kickStrobeBank.address.fixtureSemanticKeys)
      .not.toEqual(STROBE_BLINDER_PERFORMANCE_BANKS.snareStrobeBank.address.fixtureSemanticKeys)
    createRigBackedPerformanceShowRig('strobe-blinder-hits-performance')!.fixtures[0]!.brightness = 0
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
    expect(inspectRigBackedPerformanceShowSource(definition)?.unsupportedPropertyWarnings).toEqual([])
  })

  it('bounds every white or warm impact and prevents continuous scene-body activation', () => {
    const program = createStrobeBlinderPerformanceProgram()
    expect(maximumDuration(program, 'strobe')).toBe(STROBE_BLINDER_PERFORMANCE_LIMITS.maximumStrobeDurationMs)
    expect(maximumDuration(program, 'blinder')).toBe(STROBE_BLINDER_PERFORMANCE_LIMITS.maximumBlinderDurationMs)
    expect(maximumBeatActivationRatio(program, 'strobe')).toBeLessThanOrEqual(STROBE_BLINDER_PERFORMANCE_LIMITS.maximumScheduledActivationRatio)
    expect(maximumBeatActivationRatio(program, 'blinder')).toBeLessThanOrEqual(STROBE_BLINDER_PERFORMANCE_LIMITS.maximumScheduledActivationRatio)
    expect(program.scenes.every(item => item.fixture?.enabled === false && item.fixture?.brightness === 0)).toBe(true)
    expect(program.scenes.flatMap(item => item.sectionBodyMutations ?? []).some(mutation => (
      mutation.fixtureActions?.some(action => (action.kind === 'strobe' || action.kind === 'blinder') && action.active)
    ))).toBe(false)
    const fullWhite = allFixtureActions(program).filter(action => action.kind === 'strobe' && action.color === '#f7fbff')
    expect(Math.max(...fullWhite.map(action => 'durationMs' in action ? action.durationMs ?? 0 : 0)))
      .toBeLessThanOrEqual(STROBE_BLINDER_PERFORMANCE_LIMITS.maximumFullFrameWhiteDurationMs)
  })

  it('keeps kick, snare, and downbeat impacts visibly distinct', () => {
    const neutral = resolveShow('strobe-blinder-hits-performance', 89.3)
    const kick = resolveShow('strobe-blinder-hits-performance', 89.3, { kick: true })
    const snare = resolveShow('strobe-blinder-hits-performance', 89.3, { snare: true })
    const downbeat = resolveShow('strobe-blinder-hits-performance', 88.05)
    expect(activeKeys(neutral, ['strobe', 'blinder'])).toEqual([])
    expect(activeKeys(kick, ['strobe'])).toEqual(['bass-flash-center'])
    expect(activeKeys(snare, ['strobe'])).toEqual(['transient-strobe-l', 'transient-strobe-r'])
    expect(activeKeys(kick, ['strobe'])).not.toEqual(activeKeys(snare, ['strobe']))
    expect(activeKeys(downbeat, ['strobe'])).toEqual(['bass-flash-center', 'transient-strobe-l', 'transient-strobe-r'])
    expect(activeKeys(downbeat, ['blinder'])).toEqual(['blinder-l'])
  })

  it('escalates the build, uses a bounded pre-drop cut, and keeps the breakdown sparse', () => {
    const earlyBuild = resolveShow('strobe-blinder-hits-performance', 52.05)
    const lateBuild = resolveShow('strobe-blinder-hits-performance', 68.05)
    const isolatedHold = resolveShow('strobe-blinder-hits-performance', 79.7)
    const preDropCut = resolveShow('strobe-blinder-hits-performance', 79.9)
    const dropImpact = resolveShow('strobe-blinder-hits-performance', 80.05)
    const breakdown = resolveShow('strobe-blinder-hits-performance', 114.3)
    expect(activeKeys(lateBuild, ['strobe', 'blinder']).length).toBeGreaterThan(activeKeys(earlyBuild, ['strobe', 'blinder']).length)
    expect(activeKeys(isolatedHold, ['blinder'])).toEqual(['blinder-c'])
    expect(isolatedHold.requestedGlobalOutputOverrides.blackout).not.toBe(true)
    expect(preDropCut.requestedGlobalOutputOverrides.blackout).toBe(true)
    expect(preDropCut.diagnostics.programmedBlackoutRemainingBeats).toBeLessThanOrEqual(0.5)
    expect(activeKeys(dropImpact, ['strobe', 'blinder'])).toHaveLength(6)
    expect(activeKeys(breakdown, ['strobe', 'blinder']).length).toBeLessThanOrEqual(1)
  })

  it('evolves Drop 2 through faster bank recruitment without creating a permanent flash', () => {
    const dropOneOffPattern = resolveShow('strobe-blinder-hits-performance', 91.05)
    const dropTwoResponse = resolveShow('strobe-blinder-hits-performance', 135.05)
    expect(activeKeys(dropOneOffPattern, ['strobe', 'blinder'])).toEqual([])
    expect(activeKeys(dropTwoResponse, ['blinder'])).toEqual(['blinder-r'])
    const program = createStrobeBlinderPerformanceProgram()
    const dropOne = scene(program, 'strobe-blinder-drop-1')
    const dropTwo = scene(program, 'strobe-blinder-drop-2')
    const rightOne = dropOne.beatMutations?.find(mutation => mutation.id.endsWith('right-response'))
    const rightTwo = dropTwo.beatMutations?.find(mutation => mutation.id.endsWith('right-response'))
    expect(rightTwo?.beatCycleLength).toBeLessThan(rightOne?.beatCycleLength ?? Number.POSITIVE_INFINITY)
  })

  it('reconstructs identical impact state after seeking or looping and preserves final blackout authority', () => {
    const direct = resolveShow('strobe-blinder-hits-performance', 88.05, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const afterSeek = resolveShow('strobe-blinder-hits-performance', 88.05, { seekIdentity: 'seek-b', loopIdentity: 'loop-a' })
    const afterLoop = resolveShow('strobe-blinder-hits-performance', 88.05, { seekIdentity: 'seek-a', loopIdentity: 'loop-b' })
    expect(fixtureSignature(afterSeek, ['strobe', 'blinder'])).toBe(fixtureSignature(direct, ['strobe', 'blinder']))
    expect(fixtureSignature(afterLoop, ['strobe', 'blinder'])).toBe(fixtureSignature(direct, ['strobe', 'blinder']))
    expect(afterSeek.deterministicIdentity).not.toBe(direct.deterministicIdentity)
    expect(afterLoop.deterministicIdentity).not.toBe(direct.deterministicIdentity)

    const authored = createDefaultLaserDmxBeamMatrixSettings()
    const authoritative = { ...authored, output: { ...authored.output, blackout: true } }
    const attemptedOverride = applyShowDirectorPerformanceGlobalOverrides(authoritative, { blackout: false, dimmer: 1 })
    expect(attemptedOverride.output.blackout).toBe(true)
    expect(enforceLaserDmxFinalBlackoutAuthority(authoritative, {
      ...attemptedOverride,
      output: { ...attemptedOverride.output, blackout: false },
    }).output.blackout).toBe(true)
  })
})

describe('Haze + CO2 Performance', () => {
  it('registers the authored atmosphere and virtual-impact banks while preserving the static source rig', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    const definition = getRigBackedPerformanceShowDefinition('haze-co2-drops-performance')!
    const program = definition.createProgram!()
    expect(definition.status).toBe('available')
    expect(definition.displayName).toBe('Haze + CO2 Performance')
    expect(definition.sourceRigLayoutId).toBe('haze-co2-drops')
    expect(Object.keys(program.fixtureBanks ?? {})).toEqual(expect.arrayContaining([
      'baseHazeBank', 'buildHazeBank', 'dropHazeBank', 'leftCo2ImpactBank',
      'rightCo2ImpactBank', 'downbeatCo2ImpactBank', 'drop2ExpandedImpactBank', 'outroReleaseBank',
    ]))
    expect(HAZE_CO2_PERFORMANCE_BANKS.leftCo2ImpactBank.address.fixtureSemanticKeys)
      .not.toEqual(HAZE_CO2_PERFORMANCE_BANKS.rightCo2ImpactBank.address.fixtureSemanticKeys)
    createRigBackedPerformanceShowRig('haze-co2-drops-performance')!.fixtures[0]!.brightness = 0
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
    expect(inspectRigBackedPerformanceShowSource(definition)?.unsupportedPropertyWarnings).toEqual([])
  })

  it('caps haze and burst duration while preventing continuous virtual plumes', () => {
    const program = createHazeCo2PerformanceProgram()
    expect(maximumHazeAmount(program)).toBe(HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount)
    expect(maximumDuration(program, 'co2')).toBe(HAZE_CO2_PERFORMANCE_LIMITS.maximumCo2BurstDurationMs)
    expect(maximumBeatActivationRatio(program, 'co2')).toBeLessThanOrEqual(HAZE_CO2_PERFORMANCE_LIMITS.maximumScheduledBurstActivationRatio)
    expect(program.scenes.every(item => item.fixture?.enabled === false && item.fixture?.brightness === 0)).toBe(true)
    expect(program.scenes.flatMap(item => item.sectionBodyMutations ?? []).some(mutation => (
      mutation.fixtureActions?.some(action => action.kind === 'co2' && action.active)
    ))).toBe(false)
    expect(activeKeys(resolveShow('haze-co2-drops-performance', 88.3), ['co2Jet'])).toEqual([])
  })

  it('follows a readable capped haze envelope across the full-song section arc', () => {
    const intro = resolveShow('haze-co2-drops-performance', 8.3)
    const verse = resolveShow('haze-co2-drops-performance', 28.3)
    const buildEarly = resolveShow('haze-co2-drops-performance', 52.3)
    const buildLate = resolveShow('haze-co2-drops-performance', 68.3)
    const preDrop = resolveShow('haze-co2-drops-performance', 76.3)
    const dropOne = resolveShow('haze-co2-drops-performance', 88.3)
    const breakdown = resolveShow('haze-co2-drops-performance', 116.3)
    const dropTwo = resolveShow('haze-co2-drops-performance', 136.3)
    const outro = resolveShow('haze-co2-drops-performance', 164.3)
    const haze = (result: LaserDmxShowDirectorPerformanceResolution) => result.requestedGlobalOutputOverrides.haze ?? 0
    expect(haze(intro)).toBeLessThan(haze(verse))
    expect(haze(buildLate)).toBeGreaterThan(haze(buildEarly))
    expect(haze(preDrop)).toBeLessThan(haze(buildLate))
    expect(haze(dropOne)).toBeGreaterThan(haze(preDrop))
    expect(haze(breakdown) / haze(dropOne)).toBeLessThan(0.35)
    expect(haze(dropTwo)).toBeGreaterThan(haze(dropOne))
    expect(haze(outro)).toBeLessThan(haze(dropTwo))
    expect(Math.max(...[intro, verse, buildEarly, buildLate, preDrop, dropOne, breakdown, dropTwo, outro].map(haze)))
      .toBeLessThanOrEqual(HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount)
    for (const result of [intro, verse, buildEarly, buildLate, preDrop, dropOne, breakdown, dropTwo, outro]) {
      const hazeFixtures = result.showDirector.fixtures.filter(fixture => fixture.kind === 'haze')
      expect(hazeFixtures.every(fixture => fixture.component.hazeIntensity <= HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount)).toBe(true)
    }
  })

  it('alternates left and right bursts and expands the second-drop impact bank', () => {
    const left = resolveShow('haze-co2-drops-performance', 88.05)
    const right = resolveShow('haze-co2-drops-performance', 90.05)
    const dropTwoExpanded = resolveShow('haze-co2-drops-performance', 136.05)
    expect(activeKeys(left, ['co2Jet'])).toEqual(['co2-jet-l'])
    expect(activeKeys(right, ['co2Jet'])).toEqual(['co2-jet-r'])
    expect(activeKeys(left, ['co2Jet'])).not.toEqual(activeKeys(right, ['co2Jet']))
    expect(activeKeys(dropTwoExpanded, ['co2Jet'])).toEqual(['co2-jet-l', 'co2-jet-r', 'phrase-co2-center'])
    expect(activeKeys(dropTwoExpanded, ['co2Jet']).length).toBeGreaterThan(activeKeys(left, ['co2Jet']).length)
  })

  it('clears atmosphere and burst state at the outro release boundary', () => {
    const release = resolveShow('haze-co2-drops-performance', 175.6)
    expect(release.requestedGlobalOutputOverrides.haze).toBe(0)
    expect(activeKeys(release, ['haze', 'co2Jet'])).toEqual([])
  })

  it('keeps renderer haze contribution capped and retains deterministic seeking and looping', () => {
    const direct = resolveShow('haze-co2-drops-performance', 136.05, { seekIdentity: 'seek-a', loopIdentity: 'loop-a' })
    const afterSeek = resolveShow('haze-co2-drops-performance', 136.05, { seekIdentity: 'seek-b', loopIdentity: 'loop-a' })
    const afterLoop = resolveShow('haze-co2-drops-performance', 136.05, { seekIdentity: 'seek-a', loopIdentity: 'loop-b' })
    expect(fixtureSignature(afterSeek, ['haze', 'co2Jet'])).toBe(fixtureSignature(direct, ['haze', 'co2Jet']))
    expect(fixtureSignature(afterLoop, ['haze', 'co2Jet'])).toBe(fixtureSignature(direct, ['haze', 'co2Jet']))
    expect(afterSeek.deterministicIdentity).not.toBe(direct.deterministicIdentity)
    expect(afterLoop.deterministicIdentity).not.toBe(direct.deterministicIdentity)

    const compiled = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: direct.showDirector,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      sections: SECTIONS,
      fixturePriorityById: direct.fixturePriorityById,
    })
    expect(compiled.fog.density).toBeLessThanOrEqual(HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount * 0.62)
    expect(compiled.fog.opacity).toBeLessThanOrEqual(HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount * 0.52)
    expect(compiled.fog.beamScatter).toBeLessThanOrEqual(HAZE_CO2_PERFORMANCE_LIMITS.maximumHazeAmount * 0.78)
  })
})

describe('Patch 4 registration and regression boundaries', () => {
  it('publishes both shows without changing the eight earlier Performance Programs', () => {
    const entries = Object.values(LASER_DMX_SHOW_DIRECTOR_BUILT_IN_PERFORMANCE_REGISTRY)
    expect(entries.filter(entry => entry.status === 'available')).toHaveLength(10)
    expect(entries.filter(entry => entry.status === 'foundation')).toHaveLength(0)
    expect(entries.slice(0, 8).map(entry => entry.id)).toEqual([
      'prism-cathedral', 'cardinal-fan-reactor', 'cyan-mirror-cage',
      'small-club-rig-performance', 'festival-front-beams-performance', 'dubstep-drop-lasers-performance',
      'led-bar-grid-performance', 'moving-head-sweep-performance',
    ])
    expect(entries.slice(8).map(entry => entry.name)).toEqual([
      'Strobe + Blinder Performance',
      'Haze + CO2 Performance',
    ])
  })
})
