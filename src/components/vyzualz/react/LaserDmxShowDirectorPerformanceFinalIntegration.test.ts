import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixture,
  type ReactTrackSection,
} from './ReactTypes'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  createLaserDmxShowDirectorMusicIntelligenceAdapter,
} from './LaserDmxShowDirectorPerformanceContext'
import { createLaserDmxShowDirectorBeamBudgetReport } from './LaserDmxShowDirectorBeamBudget'
import {
  applyLaserDmxShowDirectorPerformanceProgramState,
  createDefaultLaserDmxShowDirectorPerformanceState,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  createLaserDmxShowDirectorPerformancePresetLoadResult,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } from './renderers/LaserDmxBeamMatrixCompiler'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'
import {
  enforceLaserDmxFinalBlackoutAuthority,
  resolveLaserDmxMusicIntelligenceFrame,
} from './renderers/LaserDmxRenderer'
import type { ReactFrameContext } from './renderers/reactRenderUtils'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 16, intensity: 0.25, source: 'auto', confidence: 1 },
  { id: 'verse', label: 'Verse', type: 'verse', startSec: 16, endSec: 48, intensity: 0.48, source: 'auto', confidence: 1 },
  { id: 'build', label: 'Build', type: 'build', startSec: 48, endSec: 72, intensity: 0.78, source: 'auto', confidence: 1 },
  { id: 'pre-drop', label: 'Pre-drop', type: 'preDrop', startSec: 72, endSec: 80, intensity: 0.82, source: 'auto', confidence: 1 },
  { id: 'drop-1', label: 'Drop 1', type: 'drop', startSec: 80, endSec: 112, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 112, endSec: 128, intensity: 0.3, source: 'auto', confidence: 1 },
  { id: 'drop-2', label: 'Drop 2', type: 'drop', startSec: 128, endSec: 160, intensity: 1, source: 'auto', confidence: 1 },
  { id: 'outro', label: 'Outro', type: 'outro', startSec: 160, endSec: 176, intensity: 0.2, source: 'auto', confidence: 1 },
]

function sectionAt(timeSec: number): ReactTrackSection {
  return SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? SECTIONS[SECTIONS.length - 1]
}

function frameAt(timeSec: number, advanced = true): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const beatFloat = timeSec * 2
  const beatIndex = Math.floor(beatFloat)
  const progress = Math.max(0, Math.min(1, (timeSec - section.startSec) / Math.max(0.001, section.endSec - section.startSec)))
  const energy = section.type === 'drop' ? 0.94 : section.type === 'breakdown' || section.type === 'outro' ? 0.28 : 0.5 + progress * 0.3
  return {
    ...DEFAULT_MI_FRAME,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    timeSec,
    sourceId: 'final-integration-track',
    trackId: 'final-integration-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.72,
      mid: 0.5,
      high: 0.58,
      volume: energy,
      normalizedBass: 0.72,
      normalizedMid: 0.5,
      normalizedHigh: 0.58,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 1,
      beatIndex,
      beatPhase: beatFloat - beatIndex,
      beatHit: true,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      downbeatHit: beatIndex % 4 === 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy,
      shortTerm: energy,
      longTerm: 0.5,
      buildProgress: section.type === 'build' || section.type === 'preDrop' ? progress : 0,
      dropImpact: section.type === 'drop' && progress < 0.08 ? 1 : 0,
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
    harmonic: { ...DEFAULT_MI_FRAME.harmonic, key: advanced ? 'C#' : null, mode: advanced ? 'minor' : null, chord: advanced ? 'C#m' : null },
    semantics: { ...DEFAULT_MI_FRAME.semantics, fakeoutConfidence: advanced ? 0.9 : 0, mood: advanced ? 'aggressive' : null },
    capabilities: {
      liveBands: advanced,
      rhythmEvents: advanced,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: advanced,
      stemCurves: false,
      lyrics: false,
    },
    confidence: { overall: 1, rhythm: 1, harmonic: advanced ? 0.9 : 0, section: 1 },
  }
}

function idFactory(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function resolvePreset(preset: LaserDmxShowDirectorPerformancePresetDefinition, timeSec: number, advanced = true) {
  const program = preset.createProgram()
  const context = buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, advanced),
    resolvedSections: SECTIONS,
    trackIdentity: 'final-integration-track',
  })
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(idFactory(`${preset.id}-fixture`)),
    program,
    context,
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:final`,
  })
}

function frameContext(trackKey: string): ReactFrameContext {
  return {
    W: 1280,
    H: 720,
    dpr: 1,
    t: 0,
    audioTime: 10,
    trackKey,
    bpm: 120,
    beatPhase: 0,
    beatHit: true,
    isPlaying: true,
    audio: { bass: 0.2, mid: 0.1, high: 0.1, volume: 0.25 },
    freqData: null,
    timeDomainData: null,
    musicIntelligence: null,
    trackSections: SECTIONS,
  }
}

function pressureFixture(kind: LaserDmxShowDirectorFixture['kind'], id: string, semanticKey: string, index: number): LaserDmxShowDirectorFixture {
  const fixture = createDefaultLaserDmxShowDirectorFixture(kind, id, index)
  return {
    ...fixture,
    semanticKey,
    enabled: true,
    beam: { ...fixture.beam, targetMode: kind === 'laser' ? 'fan' : fixture.beam.targetMode, beamSpread: kind === 'laser' ? 81 : fixture.beam.beamSpread },
    component: { ...fixture.component, ledCellCount: 16 },
  }
}

describe('Show Director performance final integration', () => {
  it('uses canonical boolean and categorical Music Intelligence values with human-readable capability guards', () => {
    const adapter = createLaserDmxShowDirectorMusicIntelligenceAdapter(frameAt(82.1), { hasSections: true })
    expect(adapter.value('isFakeout')).toBe(true)
    expect(adapter.value('key')).toBe('C#')
    expect(adapter.value('chord')).toBe('C#m')
    expect(adapter.value('mood')).toBe('aggressive')
    expect(adapter.supports('Beat Grid')).toBe(true)
    expect(adapter.supports('Stem Curves')).toBe(false)
    expect(adapter.modulation('stemVocals')).toBe(0)
  })

  it('rejects a stale AudioFeatureBus frame after track replacement and rebuilds from basic current-track timing', () => {
    const stale = { ...frameAt(10), sourceId: 'track-a', trackId: 'track-a', energy: { ...frameAt(10).energy, instant: 0.99 }, semantics: { ...frameAt(10).semantics, fakeoutConfidence: 1 } }
    const resolved = resolveLaserDmxMusicIntelligenceFrame(frameContext('track-b'), stale)
    expect(resolved.trackId).toBe('track-b')
    expect(resolved.sourceId).toBe('track-b')
    expect(resolved.energy.instant).toBe(0.25)
    expect(resolved.semantics.fakeoutConfidence).toBe(0)
    expect(resolved.capabilities?.beatGrid).toBe(true)
  })

  it('keeps blackout monotonic after authored cue evaluation', () => {
    const authoritative = { ...createDefaultLaserDmxBeamMatrixSettings(), output: { ...createDefaultLaserDmxBeamMatrixSettings().output, blackout: true } }
    const evaluated = { ...authoritative, output: { ...authoritative.output, blackout: false } }
    expect(enforceLaserDmxFinalBlackoutAuthority(authoritative, evaluated).output.blackout).toBe(true)
    expect(enforceLaserDmxFinalBlackoutAuthority({ ...authoritative, output: { ...authoritative.output, blackout: false } }, evaluated)).toBe(evaluated)
  })

  it.each(LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS)('$name resolves every representative section deterministically within the hard renderer budget', preset => {
    const samples = [0.1, 16.1, 48.1, 72.1, 80.1, 88.1, 96.1, 112.1, 128.1, 160.1, 175.1]
    let peak = 0
    for (const timeSec of samples) {
      const first = resolvePreset(preset, timeSec)
      const second = resolvePreset(preset, timeSec)
      expect(second.showDirector).toEqual(first.showDirector)
      const matrix = compileLaserDmxShowDirectorToBeamMatrix({
        showDirector: first.showDirector,
        beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
        sections: SECTIONS,
        fixturePriorityById: first.fixturePriorityById,
      })
      resetBeamMatrixCompilerState()
      const compiled = compileLaserDmxBeamMatrix({ settings: matrix, mi: frameAt(timeSec), timeSec, canvasWidth: 1280, canvasHeight: 720 })
      peak = Math.max(peak, compiled.beams.length)
      expect(compiled.beams.length).toBeLessThanOrEqual(300)
      expect(first.boundedBeamDemand).toBeLessThanOrEqual(300)
    }
    expect(peak).toBeLessThanOrEqual(preset.approximatePeakBeamDemand)
    expect(resolvePreset(preset, 128.1).currentSectionOccurrence).toBe(2)
    expect(resolvePreset(preset, 88.1, false).activeSceneId).toContain('drop-1')
  })

  it('sheds deterministic lower-priority detail before hero, architecture, and secondary identity', () => {
    const fixtures: LaserDmxShowDirectorFixture[] = []
    const roles: Record<string, 'heroImpact' | 'primaryArchitecture' | 'secondaryFan' | 'detailLattice' | 'decorativeAccent'> = {}
    const add = (role: keyof typeof roleCounts, kind: LaserDmxShowDirectorFixture['kind'], count: number) => {
      for (let index = 0; index < count; index += 1) {
        const id = `${role}-${index}`
        fixtures.push(pressureFixture(kind, id, id, fixtures.length))
        roles[id] = role
      }
    }
    const roleCounts = { heroImpact: 0, primaryArchitecture: 0, secondaryFan: 0, detailLattice: 0, decorativeAccent: 0 }
    add('heroImpact', 'strobe', 5)
    add('primaryArchitecture', 'laser', 10)
    add('secondaryFan', 'ledBar', 10)
    add('detailLattice', 'ledBar', 10)
    add('decorativeAccent', 'ledBar', 10)

    const budget = createLaserDmxShowDirectorBeamBudgetReport(fixtures, roles)
    expect(budget.estimatedDemand).toBeGreaterThan(300)
    expect(budget.boundedDemand).toBe(300)
    expect(budget.overBudget).toBe(true)
    expect(budget.fixtures.filter(item => item.role === 'heroImpact').every(item => item.allocatedDemand === item.estimatedDemand)).toBe(true)
    expect(budget.fixtures.filter(item => item.role === 'primaryArchitecture').every(item => item.allocatedDemand === item.estimatedDemand)).toBe(true)
    expect(budget.fixtures.filter(item => item.role === 'secondaryFan').every(item => item.allocatedDemand === item.estimatedDemand)).toBe(true)
    expect(budget.fixtures.filter(item => item.role === 'decorativeAccent').every(item => item.allocatedDemand === 0)).toBe(true)

    const matrix = compileLaserDmxShowDirectorToBeamMatrix({
      showDirector: { ...createDefaultLaserDmxShowDirectorState(), fixtures },
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      fixturePriorityById: budget.priorityByFixtureId,
    })
    expect(matrix.beams).toHaveLength(300)
  })

  it('reloads built-ins cleanly and disabling then re-enabling restores deterministic runtime behavior without mutating the rig', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS) {
      const initial = createDefaultLaserDmxShowDirectorPerformanceState()
      const first = createLaserDmxShowDirectorPerformancePresetLoadResult(createDefaultLaserDmxShowDirectorState(), initial, preset)!
      const reload = createLaserDmxShowDirectorPerformancePresetLoadResult(first.rig, first.performance, preset)!
      expect(reload.rig).toEqual(first.rig)
      expect(reload.performance.runtimeInvalidationId).not.toBe(first.performance.runtimeInvalidationId)

      const disabled = { ...first.performance, enabled: false }
      const reenabled = applyLaserDmxShowDirectorPerformanceProgramState(disabled, preset.createProgram())
      expect(reenabled.enabled).toBe(true)
      expect(reenabled.activeProgramDefinition).toEqual(first.performance.activeProgramDefinition)
      expect(first.rig).toEqual(reload.rig)
    }
  })
})
