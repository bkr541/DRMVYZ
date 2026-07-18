import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixture,
  type ReactSectionType,
  type ReactTrackSection,
} from './ReactTypes'
import { buildLaserDmxShowDirectorPerformanceContext, type LaserDmxShowDirectorPerformanceTimingContext } from './LaserDmxShowDirectorPerformanceContext'
import { resolveLaserDmxShowDirectorPerformance, type LaserDmxShowDirectorPerformanceResolution } from './LaserDmxShowDirectorPerformanceResolver'
import {
  createLaserDmxShowDirectorPerformancePresetLoadResult,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS as ALL_PERFORMANCE_PRESETS,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import { createDefaultLaserDmxShowDirectorPerformanceState } from './LaserDmxShowDirectorPerformanceProgram'
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

const SHOWCASE_PERFORMANCE_PRESETS = ALL_PERFORMANCE_PRESETS.filter(preset => (
  preset.id === 'prism-cathedral'
  || preset.id === 'cardinal-fan-reactor'
  || preset.id === 'cyan-mirror-cage'
))

function sectionAt(timeSec: number): ReactTrackSection {
  return SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? SECTIONS[SECTIONS.length - 1]
}

function frameAt(
  timeSec: number,
  options: { advanced?: boolean; kick?: boolean; snare?: boolean; transient?: number } = {},
): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const sectionProgress = Math.max(0, Math.min(1, (timeSec - section.startSec) / Math.max(0.001, section.endSec - section.startSec)))
  const advanced = options.advanced ?? true
  const energy = section.type === 'breakdown' || section.type === 'outro' ? 0.3 : section.type === 'drop' ? 0.94 : 0.52 + sectionProgress * 0.34
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: 'showcase-test-source',
    trackId: 'showcase-test-track',
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
      liveBands: advanced,
      rhythmEvents: advanced,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: advanced,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { overall: 1, rhythm: 1, harmonic: advanced ? 0.7 : 0, section: 1 },
  }
}

function contextAt(
  timeSec: number,
  options: {
    advanced?: boolean
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
    trackIdentity: 'showcase-test-track',
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    previous: options.previous ?? null,
  })
}

function deterministicIdFactory(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-fixture-${++index}`
}

function resolvePreset(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  timeSec: number,
  options: Parameters<typeof contextAt>[1] = {},
): LaserDmxShowDirectorPerformanceResolution {
  const program = preset.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(deterministicIdFactory(preset.id)),
    program,
    context: contextAt(timeSec, options),
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:runtime`,
  })
}

function activeSignature(result: LaserDmxShowDirectorPerformanceResolution): string {
  return JSON.stringify(result.showDirector.fixtures
    .filter(fixture => fixture.enabled)
    .map(fixture => ({
      key: fixture.semanticKey,
      brightness: fixture.brightness,
      color: fixture.color,
      rotation: fixture.rotation,
      spread: fixture.beam.beamSpread,
      focus: fixture.beam.focus,
      targetMode: fixture.beam.targetMode,
      targetX: fixture.beam.targetX,
      targetY: fixture.beam.targetY,
      targets: (fixture.beam.targets ?? []).map(target => [target.x, target.y]),
      travel: fixture.runtimeBeamTravel,
      appearance: fixture.runtimeBeamAppearance,
    }))
    .sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''))
  )
}

function fixtureByKey(result: LaserDmxShowDirectorPerformanceResolution, key: string): LaserDmxShowDirectorFixture | undefined {
  return result.showDirector.fixtures.find(fixture => fixture.semanticKey === key)
}

function compileBeamCount(result: LaserDmxShowDirectorPerformanceResolution): number {
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
  }).beams.length
}

function meanActiveSpread(result: LaserDmxShowDirectorPerformanceResolution): number {
  const active = result.showDirector.fixtures.filter(fixture => fixture.enabled)
  return active.reduce((sum, fixture) => sum + fixture.beam.beamSpread, 0) / Math.max(1, active.length)
}

function programPayloads(program: ReturnType<LaserDmxShowDirectorPerformancePresetDefinition['createProgram']>) {
  return program.scenes.flatMap(scene => [
    scene, ...(scene.variations ?? []), ...(scene.beatMutations ?? []), ...(scene.kickMutations ?? []),
    ...(scene.snareMutations ?? []), ...(scene.transientMutations ?? []), ...(scene.barMutations ?? []),
    ...(scene.fourBarVariations ?? []), ...(scene.eightBarRecruitment ?? []), ...(scene.sixteenBarEvolution ?? []),
    ...(scene.sectionEntryMutations ?? []), ...(scene.sectionBodyMutations ?? []), ...(scene.sectionExitMutations ?? []),
  ])
}

const REQUIRED_SECTIONS: ReactSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro']

describe('Show Director showcase performance shows', () => {
  it('registers complete canonical cards with accurate authored metadata', () => {
    expect(SHOWCASE_PERFORMANCE_PRESETS.map(preset => preset.name)).toEqual([
      'Prism Cathedral',
      'Cardinal Fan Reactor',
      'Cyan Mirror Cage',
    ])
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const rig = preset.createRig(deterministicIdFactory(`${preset.id}-metadata`))
      const program = preset.createProgram()
      expect(rig.fixtures).toHaveLength(preset.fixtureCount)
      expect(preset.genreTags.length).toBeGreaterThan(0)
      expect(preset.behaviorTags.length).toBeGreaterThan(0)
      expect(preset.musicIntelligenceCapabilities).toEqual(expect.arrayContaining(['Beat Grid', 'Sections', 'Energy']))
      expect(preset.supportedSectionRoles).toEqual(expect.arrayContaining(REQUIRED_SECTIONS))
      expect(program.scenes).toHaveLength(8)
      expect(program.scenes.filter(scene => scene.section.types.includes('drop'))).toHaveLength(2)
      expect(program.scenes.every(scene => (scene.beatMutations?.length ?? 0) > 0)).toBe(true)
      expect(program.scenes.every(scene => (scene.barMutations?.length ?? 0) > 0)).toBe(true)
      expect(program.scenes.every(scene => (scene.fourBarVariations?.length ?? 0) > 0)).toBe(true)
      expect(program.scenes.every(scene => (scene.eightBarRecruitment?.length ?? 0) > 0)).toBe(true)
    }
  })

  it('keeps fixture and group semantic keys stable across recreation, normalization, loading, and reloading', () => {
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const first = preset.createRig(deterministicIdFactory(`${preset.id}-first`))
      const second = preset.createRig(deterministicIdFactory(`${preset.id}-second`))
      expect(first.fixtures.map(fixture => fixture.semanticKey)).toEqual(second.fixtures.map(fixture => fixture.semanticKey))
      expect(first.groups.map(group => group.semanticKey)).toEqual(second.groups.map(group => group.semanticKey))
      expect(new Set(first.fixtures.map(fixture => fixture.semanticKey)).size).toBe(preset.fixtureCount)
      expect(new Set(first.groups.map(group => group.semanticKey)).size).toBe(first.groups.length)

      const initialPerformance = createDefaultLaserDmxShowDirectorPerformanceState()
      const load = createLaserDmxShowDirectorPerformancePresetLoadResult(createDefaultLaserDmxShowDirectorState(), initialPerformance, preset)
      const reload = createLaserDmxShowDirectorPerformancePresetLoadResult(createDefaultLaserDmxShowDirectorState(), initialPerformance, preset)
      expect(load).not.toBeNull()
      expect(reload).not.toBeNull()
      expect(load?.performance.activeBuiltInProgramId).toBe(preset.id)
      expect(load?.performance.activeProgramDefinition).toEqual(reload?.performance.activeProgramDefinition)
      expect(load?.rig).toEqual(reload?.rig)
    }
  })

  describe.each(SHOWCASE_PERFORMANCE_PRESETS)('$name', (preset: LaserDmxShowDirectorPerformancePresetDefinition) => {
    it('changes perceptible parameters on every consecutive beat and reacts independently to kick and snare', () => {
      for (const startSec of [0, 16, 48, 72, 80, 112, 128, 160]) {
        const beatA = resolvePreset(preset, startSec + 0.1)
        const beatB = resolvePreset(preset, startSec + 0.6)
        expect(activeSignature(beatB), `beat cadence at ${startSec}s`).not.toBe(activeSignature(beatA))
      }

      const neutral = resolvePreset(preset, 82.1)
      const kick = resolvePreset(preset, 82.1, { kick: true })
      const snare = resolvePreset(preset, 82.1, { snare: true })
      expect(activeSignature(kick)).not.toBe(activeSignature(neutral))
      expect(activeSignature(snare)).not.toBe(activeSignature(neutral))
      expect(activeSignature(kick)).not.toBe(activeSignature(snare))
    })

    it('steps geometry or direction on every bar throughout the full song', () => {
      for (const startSec of [0, 16, 48, 72, 80, 112, 128, 160]) {
        const barA = resolvePreset(preset, startSec + 0.1)
        const barB = resolvePreset(preset, startSec + 2.1)
        expect(activeSignature(barB), `bar cadence at ${startSec}s`).not.toBe(activeSignature(barA))
      }
    })

    it('changes four-bar composition only after the correct boundary', () => {
      const before = resolvePreset(preset, 87.9)
      const after = resolvePreset(preset, 88.1)
      expect(before.fourBarVariation).not.toBeNull()
      expect(after.fourBarVariation).not.toBeNull()
      expect(before.fourBarVariation).not.toBe(after.fourBarVariation)
      expect(activeSignature(before)).not.toBe(activeSignature(after))
    })

    it('cycles through all four Drop 1 composition variations at four-bar boundaries', () => {
      const variations = [80.1, 88.1, 96.1, 104.1].map(timeSec => resolvePreset(preset, timeSec).fourBarVariation)
      expect(variations.every(Boolean)).toBe(true)
      expect(new Set(variations).size).toBe(4)
      expect(resolvePreset(preset, 87.9).fourBarVariation).toBe(variations[0])
    })

    it('recruits at eight bars and also redirects fixtures that were already active', () => {
      const before = resolvePreset(preset, 95.9)
      const after = resolvePreset(preset, 96.1)
      expect(before.eightBarRecruitmentStage).toBe(1)
      expect(after.eightBarRecruitmentStage).toBe(2)
      expect(after.activeFixtureKeys.length).toBeGreaterThan(before.activeFixtureKeys.length)
      const existingKey = before.activeFixtureKeys.find(key => after.activeFixtureKeys.includes(key))!
      const existingBefore = fixtureByKey(before, existingKey)!
      const existingAfter = fixtureByKey(after, existingKey)!
      expect([
        existingAfter.rotation,
        existingAfter.beam.targetX,
        existingAfter.beam.beamSpread,
      ]).not.toEqual([
        existingBefore.rotation,
        existingBefore.beam.targetX,
        existingBefore.beam.beamSpread,
      ])
    })

    it('escalates builds, restrains and blacks out the final pre-drop half-beat, and uses negative-space breakdown allocation', () => {
      const buildStart = resolvePreset(preset, 48.1)
      const buildLate = resolvePreset(preset, 66.1)
      expect(buildLate.activeFixtureKeys.length).toBeGreaterThan(buildStart.activeFixtureKeys.length)
      expect(buildLate.estimatedBeamDemand).toBeGreaterThan(buildStart.estimatedBeamDemand)
      expect(meanActiveSpread(buildLate)).toBeGreaterThanOrEqual(meanActiveSpread(buildStart))

      const preDrop = resolvePreset(preset, 76.1)
      const preDropBlackout = resolvePreset(preset, 79.8)
      const drop = resolvePreset(preset, 80.1)
      expect(preDrop.estimatedBeamDemand).toBeLessThan(drop.estimatedBeamDemand)
      expect(preDropBlackout.requestedGlobalOutputOverrides.blackout).toBe(true)
      expect(preDropBlackout.requestedGlobalOutputOverrides.dimmer).toBe(0)

      const breakdown = resolvePreset(preset, 112.1)
      expect(breakdown.activeFixtureKeys.length).toBeLessThan(drop.activeFixtureKeys.length)
      if (breakdown.activeGroupKeys.length > 0 || drop.activeGroupKeys.length > 0) {
        expect(breakdown.activeGroupKeys).not.toEqual(drop.activeGroupKeys)
      } else {
        expect(breakdown.activeFixtureKeys).not.toEqual(drop.activeFixtureKeys)
      }
      expect(activeSignature(breakdown)).not.toBe(activeSignature(drop))
    })

    it('returns to the same deterministic state after seeking and looping', () => {
      const timeSec = 98.1
      const direct = resolvePreset(preset, timeSec)
      const sought = resolvePreset(preset, timeSec, { previous: contextAt(140.1), seekIdentity: 'seek-2' })
      const looped = resolvePreset(preset, timeSec, { previous: contextAt(110.1), loopIdentity: 'loop-2' })
      expect(sought.showDirector).toEqual(direct.showDirector)
      expect(looped.showDirector).toEqual(direct.showDirector)
      expect(sought.activeSceneId).toBe(direct.activeSceneId)
      expect(looped.fourBarVariation).toBe(direct.fourBarVariation)
      expect(sought.eightBarRecruitmentStage).toBe(direct.eightBarRecruitmentStage)
    })

    it('falls back safely without stems, lyrics, detailed bands, rhythm events, or offline energy curves', () => {
      const fallback = resolvePreset(preset, 88.1, { advanced: false })
      expect(fallback.activeSceneId).toContain('drop-1')
      expect(fallback.activeFixtureKeys.length).toBeGreaterThan(0)
      expect(fallback.boundedBeamDemand).toBeGreaterThan(0)
      expect(fallback.diagnostics.suppressionReason).toBeNull()
      expect(fallback.diagnostics.missingCapabilities).toEqual(expect.arrayContaining(['Live Bands']))
    })

    it('makes Drop 2 recognizably larger and stays inside the declared and hard beam budgets', () => {
      const dropOne = resolvePreset(preset, 80.1)
      const dropTwo = resolvePreset(preset, 128.1)
      expect(dropTwo.activeFixtureKeys.length).toBeGreaterThan(dropOne.activeFixtureKeys.length)
      expect(dropTwo.estimatedBeamDemand).toBeGreaterThan(dropOne.estimatedBeamDemand)
      expect(activeSignature(dropTwo)).not.toBe(activeSignature(dropOne))

      let peakEstimated = 0
      let peakCompiled = 0
      for (let timeSec = 0.1; timeSec < 176; timeSec += 2) {
        const resolution = resolvePreset(preset, timeSec)
        peakEstimated = Math.max(peakEstimated, resolution.estimatedBeamDemand)
        peakCompiled = Math.max(peakCompiled, compileBeamCount(resolution))
      }
      expect(peakEstimated).toBeLessThanOrEqual(preset.approximatePeakBeamDemand)
      expect(peakCompiled).toBeLessThanOrEqual(preset.approximatePeakBeamDemand)
      expect(peakEstimated).toBeLessThanOrEqual(300)
      expect(peakCompiled).toBeLessThanOrEqual(300)
    })
  })

  it('produces structurally different drop programs for every registered show', () => {
    const signatures = SHOWCASE_PERFORMANCE_PRESETS.map(preset => activeSignature(resolvePreset(preset, 88.1)))
    expect(new Set(signatures).size).toBe(SHOWCASE_PERFORMANCE_PRESETS.length)
  })

  it('keeps every registered show visible when Variation Amount is zero', () => {
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      const resolution = resolveLaserDmxShowDirectorPerformance({
        authoredShowDirector: preset.createRig(deterministicIdFactory(`${preset.id}-variation-zero`)),
        program,
        context: contextAt(88.1),
        tuning: { ...program.tuning, variation: 0 },
        programSeed: program.deterministicSeed,
        enabled: true,
        audioIntelligenceEnabled: true,
        fallbackBehavior: 'basicTiming',
        runtimeInvalidationId: `${preset.id}:variation-zero`,
      })
      expect(resolution.activeFixtureKeys.length, preset.id).toBeGreaterThan(0)
      expect(resolution.estimatedBeamDemand, preset.id).toBeGreaterThan(0)
    }
  })

  it('uses the evolved Drop 2 scene for Drop 3 and later occurrences', () => {
    const extendedSections: ReactTrackSection[] = [
      ...SECTIONS.slice(0, 7),
      { id: 'drop-3', label: 'Drop 3', type: 'drop', startSec: 160, endSec: 192, intensity: 1, source: 'auto', confidence: 1 },
      { id: 'outro-extended', label: 'Outro', type: 'outro', startSec: 192, endSec: 208, intensity: 0.2, source: 'auto', confidence: 1 },
    ]
    const context = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 164.1,
      frame: frameAt(164.1),
      resolvedSections: extendedSections,
      trackIdentity: 'showcase-drop-three',
    })
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      const result = resolveLaserDmxShowDirectorPerformance({
        authoredShowDirector: preset.createRig(deterministicIdFactory(`${preset.id}-drop-three`)),
        program, context, tuning: program.tuning, programSeed: program.deterministicSeed,
        enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
        runtimeInvalidationId: `${preset.id}:drop-three`,
      })
      expect(context.dropOccurrence).toBe(3)
      expect(result.activeSceneId, preset.id).toContain('drop-2')
    }
  })

  it('selects Drop 1 from high-energy basic timing when no section map is available', () => {
    const highEnergyFrame: MusicIntelligenceFrame = {
      ...frameAt(88.1, { advanced: false }),
      section: { ...DEFAULT_MI_FRAME.section, type: 'unknown', confidence: 0 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, ...frameAt(88.1, { advanced: false }).capabilities!, sections: false },
      energy: { ...frameAt(88.1, { advanced: false }).energy, instant: 0.95, shortTerm: 0.95 },
    }
    const context = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 88.1,
      frame: highEnergyFrame,
      resolvedSections: [],
      trackIdentity: 'showcase-energy-only',
    })
    expect(context.dropOccurrence).toBe(0)
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      const result = resolveLaserDmxShowDirectorPerformance({
        authoredShowDirector: preset.createRig(deterministicIdFactory(`${preset.id}-energy-only`)),
        program, context, tuning: program.tuning, programSeed: program.deterministicSeed,
        enabled: true, audioIntelligenceEnabled: true, fallbackBehavior: 'basicTiming',
        runtimeInvalidationId: `${preset.id}:energy-only`,
      })
      expect(result.currentSection, preset.id).toBe('drop')
      expect(result.currentSectionOccurrence, preset.id).toBe(1)
      expect(result.activeSceneId, preset.id).toContain('drop-1')
      expect(result.activeFixtureKeys.length, preset.id).toBeGreaterThan(0)
    }
  })

  it('keeps built-in output values in range and demonstrates broad Music Intelligence coverage', () => {
    const sources = new Set<string>()
    for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
      const program = preset.createProgram()
      for (const scene of program.scenes) {
        if (scene.global?.globalGlow != null) expect(scene.global.globalGlow).toBeLessThanOrEqual(1)
        const payloads = [
          scene, ...(scene.variations ?? []), ...(scene.beatMutations ?? []), ...(scene.kickMutations ?? []),
          ...(scene.snareMutations ?? []), ...(scene.transientMutations ?? []), ...(scene.barMutations ?? []),
          ...(scene.fourBarVariations ?? []), ...(scene.eightBarRecruitment ?? []), ...(scene.sixteenBarEvolution ?? []),
          ...(scene.sectionEntryMutations ?? []), ...(scene.sectionBodyMutations ?? []), ...(scene.sectionExitMutations ?? []),
        ]
        for (const payload of payloads) {
          payload.conditions?.forEach(condition => sources.add(condition.source))
          payload.modulations?.forEach(modulation => sources.add(modulation.source))
        }
      }
    }
    expect([...sources]).toEqual(expect.arrayContaining([
      'hat', 'isChordChange', 'trackEnergy', 'isFakeout', 'isAggressive',
      'spectralCentroid', 'isDark', 'isAtmospheric', 'spectralRolloff', 'tension',
      'buildProgress', 'dropImpact', 'transient', 'vocalEnergy',
    ]))
  })


  describe('native professional programming', () => {
    it('removes legacy fixture geometry payloads from first-party shows', () => {
      for (const preset of SHOWCASE_PERFORMANCE_PRESETS) {
        const program = preset.createProgram()
        expect(program.laserProgramming?.compatibility.source, preset.id).toBe('native')
        expect(program.diagnostics?.authoringVersion, preset.id).toBe('professional-cue-authoring-v1')
        expect(program.laserProgramming?.macros.length, preset.id).toBeGreaterThanOrEqual(28)
        expect(program.laserProgramming?.groupRelationships.length, preset.id).toBe(program.laserProgramming?.macros.length)

        for (const payload of programPayloads(program)) {
          expect(payload.fixture?.targetPoints, `${preset.id}:${payload.id}`).toBeUndefined()
          expect(payload.fixture?.targetPointsByFixtureSemanticKey, `${preset.id}:${payload.id}`).toBeUndefined()
          expect(payload.fixtureActions?.some(action => action.kind === 'scanner' || action.kind === 'beam') ?? false, `${preset.id}:${payload.id}`).toBe(false)
          expect(payload.modulations?.some(modulation => /(target|rayCount|copyCount|pattern|path|geometry|rotation|fanSpread)/i.test(modulation.target)) ?? false, `${preset.id}:${payload.id}`).toBe(false)
        }
      }
    })

    it('authors Cardinal as stable wide and opposed fan cue families', () => {
      const program = SHOWCASE_PERFORMANCE_PRESETS.find(candidate => candidate.id === 'cardinal-fan-reactor')!.createProgram()
      const document = program.laserProgramming!
      const topologyIds = document.macros.map(macro => macro.pattern.topologyId)
      expect(topologyIds).toContain('cardinal-fan-reactor:wide-stepped-fan:topology')
      expect(topologyIds).toContain('cardinal-fan-reactor:opposed-fans:topology')
      expect(document.groupRelationships.some(relationship => relationship.mode === 'opposed')).toBe(true)
      expect(document.groupRelationships.every(relationship => relationship.sharedSpeed && relationship.sharedSpread && relationship.sharedIntensity)).toBe(true)

      const dropCues = document.cueStacks[0].cues.filter(cue => cue.sceneIds?.some(sceneId => sceneId.includes('drop-1')))
      expect(new Set(dropCues.filter(cue => !cue.blackout).map(cue => cue.startOffsetBeats))).toEqual(new Set([0, 16, 32, 48]))
      expect(dropCues.filter(cue => !cue.blackout).every(cue => cue.duration.kind === 'fourBars')).toBe(true)
    })

    it('keeps Prism Cathedral architectural identities discrete across sections', () => {
      const program = SHOWCASE_PERFORMANCE_PRESETS.find(candidate => candidate.id === 'prism-cathedral')!.createProgram()
      const document = program.laserProgramming!
      const topologyIds = new Set(document.macros.map(macro => macro.pattern.topologyId))
      expect([...topologyIds]).toEqual(expect.arrayContaining([
        'prism-cathedral:arc-scan:topology',
        'prism-cathedral:upper-canopy:topology',
        'prism-cathedral:corridor:topology',
        'prism-cathedral:circle-scan:topology',
      ]))
      expect(document.macros.every(macro => macro.pattern.topologyId.length > 0)).toBe(true)
      expect(document.macros.every(macro => macro.compatibility?.provisional === false)).toBe(true)
    })

    it('keeps Cyan mirrored and crossing banks deterministic after seeking', () => {
      const preset = SHOWCASE_PERFORMANCE_PRESETS.find(candidate => candidate.id === 'cyan-mirror-cage')!
      const program = preset.createProgram()
      const document = program.laserProgramming!
      const topologyIds = new Set(document.macros.map(macro => macro.pattern.topologyId))
      expect(topologyIds).toContain('cyan-mirror-cage:mirrored-fans:topology')
      expect(topologyIds).toContain('cyan-mirror-cage:crossing-fans:topology')
      expect(document.groupRelationships.some(relationship => relationship.mode === 'mirrored')).toBe(true)
      expect(document.groupRelationships.some(relationship => relationship.mode === 'alternating')).toBe(true)

      const direct = resolvePreset(preset, 136.1)
      const sought = resolvePreset(preset, 136.1, { previous: contextAt(164.1), seekIdentity: 'native-programming-seek' })
      expect(sought.activeSceneId).toBe(direct.activeSceneId)
      expect(sought.activePrimaryCueId).toBe(direct.activePrimaryCueId)
      expect(sought.activeMacroId).toBe(direct.activeMacroId)
      expect(sought.stablePatternFrame).toEqual(direct.stablePatternFrame)
      expect(activeSignature(sought)).toEqual(activeSignature(direct))
    })
  })

})
