import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type ReactSectionType,
  type ReactTrackSection,
} from './ReactTypes'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  type LaserDmxShowDirectorPerformanceTimingContext,
} from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  LASER_DMX_SHOW_DIRECTOR_SHOWCASE_BLACKOUT_POLICY,
  LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS,
} from './LaserDmxShowDirectorPerformanceShowcasePresets'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import { enforceLaserDmxFinalBlackoutAuthority } from './renderers/LaserDmxRenderer'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro-1', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.34, source: 'auto', confidence: 1 },
  { id: 'verse-1', label: 'Verse', type: 'verse', startSec: 16, endSec: 32, intensity: 0.54, source: 'auto', confidence: 1 },
  { id: 'build-1', label: 'Build', type: 'build', startSec: 32, endSec: 40, intensity: 0.8, source: 'auto', confidence: 1 },
  { id: 'pre-drop-1', label: 'Pre-Drop', type: 'preDrop', startSec: 40, endSec: 44, intensity: 0.68, source: 'auto', confidence: 1 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 44, endSec: 60, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'breakdown-1', label: 'Breakdown', type: 'breakdown', startSec: 60, endSec: 76, intensity: 0.28, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 76, endSec: 92, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'outro-1', label: 'Outro', type: 'outro', startSec: 92, endSec: 108, intensity: 0.3, source: 'auto', confidence: 1 },
]

function sectionAt(timeSec: number): ReactTrackSection | null {
  return SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? null
}

function frameAt(timeSec: number): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    trackId: 'section-energy-arc-track',
    sourceId: 'section-energy-arc-source',
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatIndex % 4 === 0,
      beatHit: true,
      kickHit: false,
      kickStrength: 0,
      snareHit: false,
      snareStrength: 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: section?.intensity ?? 0.5,
      shortTerm: section?.intensity ?? 0.5,
      longTerm: 0.55,
      delta: section?.type === 'build' ? 0.08 : 0,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section?.type ?? 'unknown',
      label: section?.label ?? '',
      startSec: section?.startSec ?? 0,
      endSec: section?.endSec ?? 0,
      progress: section ? (timeSec - section.startSec) / (section.endSec - section.startSec) : 0,
      intensity: section?.intensity ?? 0,
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

function contextAt(
  timeSec: number,
  options: { previous?: LaserDmxShowDirectorPerformanceTimingContext | null; seek?: string; loop?: string } = {},
): LaserDmxShowDirectorPerformanceTimingContext {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec),
    resolvedSections: SECTIONS,
    trackIdentity: 'section-energy-arc-track',
    seekIdentity: options.seek ?? 'seek-0',
    loopIdentity: options.loop ?? 'loop-0',
    previous: options.previous ?? null,
  })
}

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function resolvePreset(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  timeSec: number,
  options: { previous?: LaserDmxShowDirectorPerformanceTimingContext | null; seek?: string; loop?: string } = {},
) {
  const program = preset.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(ids(`${preset.id}-energy`)),
    program,
    context: contextAt(timeSec, options),
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:section-energy-arc`,
    transportDiscontinuityIdentity: options.seek ?? options.loop ?? null,
  })
}

function activeGroups(result: ReturnType<typeof resolvePreset>): number {
  return result.activeGroupKeys.length
}

function compiled(result: ReturnType<typeof resolvePreset>) {
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
  })
}

const REQUIRED_ENVELOPES = ['intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro'] as const

function sampleSection(type: ReactSectionType): number {
  const section = SECTIONS.find(item => item.type === type)
  if (!section) throw new Error(`Missing ${type}`)
  return section.startSec + Math.min(4.35, (section.endSec - section.startSec) / 2)
}

describe('Show Director section energy arc', () => {
  it('defines all eight explicit energy envelopes and the bounded deterministic blackout policy', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const program = preset.createProgram()
      expect(REQUIRED_ENVELOPES.every(key => program.energyEnvelopes?.[key] != null)).toBe(true)
      expect(program.blackoutPolicy).toEqual(LASER_DMX_SHOW_DIRECTOR_SHOWCASE_BLACKOUT_POLICY)
      expect(program.scenes.every(scene => scene.energyEnvelopeKey != null)).toBe(true)
    }
  })

  it('keeps intro density below verse and drop density', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const intro = resolvePreset(preset, 2.35)
      const verse = resolvePreset(preset, 20.35)
      const drop = resolvePreset(preset, 48.35)
      expect(intro.energyMetrics!.estimatedBeamCount).toBeLessThan(verse.energyMetrics!.estimatedBeamCount)
      expect(verse.energyMetrics!.estimatedBeamCount).toBeLessThan(drop.energyMetrics!.estimatedBeamCount)
      expect(activeGroups(intro)).toBeLessThanOrEqual(2)
    }
  })

  it('recruits fixtures monotonically across the four build bars', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const bars = [32.35, 34.35, 36.35, 38.35].map(time => resolvePreset(preset, time))
      const groups = bars.map(activeGroups)
      const beams = bars.map(result => result.energyMetrics!.estimatedBeamCount)
      expect(groups[1]).toBeGreaterThanOrEqual(groups[0])
      expect(groups[2]).toBeGreaterThan(groups[1])
      expect(groups[3]).toBeGreaterThan(groups[2])
      expect(beams[1]).toBeGreaterThanOrEqual(beams[0])
      expect(beams[2]).toBeGreaterThan(beams[1])
      expect(beams[3]).toBeGreaterThan(beams[2])
    }
  })

  it('bounds pre-drop blackout to one half beat and resolves immediately into an active drop impact', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const before = resolvePreset(preset, 43.7)
      const blackout = resolvePreset(preset, 43.8)
      const impact = resolvePreset(preset, 44.05)
      expect(before.requestedGlobalOutputOverrides.blackout).not.toBe(true)
      expect(blackout.requestedGlobalOutputOverrides.blackout).toBe(true)
      expect(blackout.diagnostics.programmedBlackoutKind).toBe('preDrop')
      expect(blackout.diagnostics.programmedBlackoutRemainingBeats).toBeLessThanOrEqual(0.5)
      expect(impact.requestedGlobalOutputOverrides.blackout).not.toBe(true)
      expect(impact.energyMetrics!.estimatedBeamCount).toBeGreaterThan(0)
      const expectedImpactGroups = preset.id === 'prism-cathedral' ? 5 : preset.id === 'cardinal-fan-reactor' ? 4 : 6
      expect(activeGroups(impact)).toBe(expectedImpactGroups)
    }
  })

  it('keeps drop bodies visible, breakdowns sparse but nonzero, and Drop 2 structurally larger than Drop 1', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const dropOne = resolvePreset(preset, 48.35)
      const breakdown = resolvePreset(preset, 64.35)
      const dropTwo = resolvePreset(preset, 80.35)
      expect(dropOne.energyMetrics!.estimatedBeamCount).toBeGreaterThan(0)
      expect(dropOne.requestedGlobalOutputOverrides.blackout).not.toBe(true)
      expect(breakdown.energyMetrics!.estimatedBeamCount).toBeGreaterThan(0)
      expect(breakdown.energyMetrics!.estimatedBeamCount).toBeLessThan(dropOne.energyMetrics!.estimatedBeamCount)
      expect(dropTwo.energyMetrics!.estimatedBeamCount).toBeGreaterThan(dropOne.energyMetrics!.estimatedBeamCount)
      expect(activeGroups(dropTwo)).toBeGreaterThan(activeGroups(dropOne))
    }
  })

  it('releases outro fixture groups progressively without dropping to accidental zero output', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const stages = [92.35, 96.35, 100.35, 104.35].map(time => resolvePreset(preset, time))
      const groups = stages.map(activeGroups)
      expect(groups[1]).toBeLessThan(groups[0])
      expect(groups[2]).toBeLessThanOrEqual(groups[1])
      expect(groups[3]).toBeLessThanOrEqual(groups[2])
      expect(stages.every(result => result.energyMetrics!.estimatedBeamCount > 0)).toBe(true)
      expect(groups[3]).toBe(1)
    }
  })

  it('keeps the programmed blackout ratio below the preset-defined limit', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const program = preset.createProgram()
      const programmedBlackoutBeats = program.scenes.reduce((sum, scene) => (
        sum + (scene.blackoutWindows ?? []).reduce((windowSum, window) => windowSum + window.durationBeats, 0)
      ), 0)
      const trackBeats = 108 * 2
      expect(programmedBlackoutBeats / trackBeats).toBeLessThanOrEqual(LASER_DMX_SHOW_DIRECTOR_SHOWCASE_BLACKOUT_POLICY.maximumProgrammedBlackoutRatio)
    }
  })

  it('keeps safety blackout as final authority', () => {
    const result = resolvePreset(LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS[0], sampleSection('drop'))
    const authoritative = compiled(result)
    authoritative.output.blackout = true
    const evaluated = { ...authoritative, output: { ...authoritative.output, blackout: false } }
    expect(enforceLaserDmxFinalBlackoutAuthority(authoritative, evaluated).output.blackout).toBe(true)
  })

  it('reconstructs blackout duration after seeking and does not extend it while looping', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const prior = contextAt(20)
      const direct = resolvePreset(preset, 43.8)
      const sought = resolvePreset(preset, 43.8, { previous: prior, seek: 'seek-into-blackout' })
      const looped = resolvePreset(preset, 43.8, { previous: contextAt(43.9), loop: 'loop-pre-drop' })
      const after = resolvePreset(preset, 44.05, { previous: contextAt(43.8), loop: 'loop-pre-drop' })
      expect(sought.requestedGlobalOutputOverrides.blackout).toBe(direct.requestedGlobalOutputOverrides.blackout)
      expect(sought.diagnostics.programmedBlackoutRemainingBeats).toBeCloseTo(direct.diagnostics.programmedBlackoutRemainingBeats ?? 0, 5)
      expect(looped.requestedGlobalOutputOverrides.blackout).toBe(true)
      expect(after.requestedGlobalOutputOverrides.blackout).not.toBe(true)
    }
  })

  it('never requests or compiles more than 300 beams', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      for (let time = 0.1; time < 108; time += 0.5) {
        const result = resolvePreset(preset, time)
        expect(result.estimatedBeamDemand).toBeLessThanOrEqual(300)
        expect(result.boundedBeamDemand).toBeLessThanOrEqual(300)
        expect(compiled(result).beams.length).toBeLessThanOrEqual(300)
      }
    }
  }, 15_000)
})
