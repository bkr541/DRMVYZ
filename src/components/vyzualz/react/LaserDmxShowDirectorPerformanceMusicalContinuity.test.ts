import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type LaserDmxShowDirectorFixture,
  type ReactTrackSection,
} from './ReactTypes'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  type LaserDmxShowDirectorPerformanceTimingContext,
} from './LaserDmxShowDirectorPerformanceContext'
import type { LaserDmxShowDirectorPerformancePresetDefinition } from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'
import {
  CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET,
  CYAN_MIRROR_CAGE_PERFORMANCE_PRESET,
  LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS,
  PRISM_CATHEDRAL_PERFORMANCE_PRESET,
} from './LaserDmxShowDirectorPerformanceShowcasePresets'
import { compileLaserDmxShowDirectorToBeamMatrix } from './renderers/LaserDmxShowDirectorBeamMatrixCompiler'

const MICRO_SECTIONS: ReactTrackSection[] = [
  { id: 'verse-a', label: 'Verse A', type: 'verse', startSec: 0, endSec: 10, intensity: 0.48, source: 'auto', confidence: 0.9 },
  { id: 'verse-b', label: 'Verse B', type: 'verse', startSec: 10, endSec: 22, intensity: 0.48, source: 'auto', confidence: 0.9 },
  { id: 'verse-c', label: 'Verse C', type: 'verse', startSec: 22, endSec: 36, intensity: 0.48, source: 'auto', confidence: 0.9 },
  { id: 'build-a', label: 'Build A', type: 'build', startSec: 36, endSec: 44, intensity: 0.76, source: 'auto', confidence: 0.9 },
  { id: 'drop-1a', label: 'Drop 1A', type: 'drop', startSec: 44, endSec: 54, intensity: 1, source: 'auto', confidence: 0.95 },
  { id: 'drop-1b', label: 'Drop 1B', type: 'drop', startSec: 54, endSec: 66, intensity: 1, source: 'auto', confidence: 0.95 },
  { id: 'breakdown', label: 'Breakdown', type: 'breakdown', startSec: 66, endSec: 74, intensity: 0.3, source: 'auto', confidence: 0.9 },
  { id: 'drop-2a', label: 'Drop 2A', type: 'drop', startSec: 74, endSec: 86, intensity: 1, source: 'auto', confidence: 0.95 },
  { id: 'drop-2b', label: 'Drop 2B', type: 'drop', startSec: 86, endSec: 98, intensity: 1, source: 'auto', confidence: 0.95 },
]

const EXPECTED_MOTIFS: Record<string, string[]> = {
  'prism-cathedral': ['prism-open-x', 'prism-nested-diamond', 'prism-mirrored-crown', 'prism-cathedral-cage'],
  'cardinal-fan-reactor': ['cardinal-horizontal-opposing-fans', 'cardinal-vertical-opposing-fans', 'cardinal-aperture', 'cardinal-diagonal-expansion'],
  'cyan-mirror-cage': ['cage-outer-mirrored-walls', 'cage-inner-chevrons', 'cage-double-x', 'cage-wide-cage-wings'],
}

function sectionAt(timeSec: number, sections = MICRO_SECTIONS): ReactTrackSection | null {
  return sections.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? null
}

function frameAt(timeSec: number, beatOffset = 0, sections = MICRO_SECTIONS): MusicIntelligenceFrame {
  const section = sectionAt(timeSec, sections)
  const absoluteBeat = timeSec * 2 + beatOffset
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    trackId: 'musical-continuity-track',
    sourceId: 'musical-continuity-source',
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
      kickHit: beatIndex % 4 === 0,
      kickStrength: beatIndex % 4 === 0 ? 0.9 : 0,
      snareHit: beatIndex % 4 === 2,
      snareStrength: beatIndex % 4 === 2 ? 0.85 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: section?.intensity ?? 0.5,
      shortTerm: section?.intensity ?? 0.5,
      longTerm: 0.55,
      delta: 0.02,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: section?.type ?? 'unknown',
      label: section?.label ?? '',
      startSec: section?.startSec ?? 0,
      endSec: section?.endSec ?? 0,
      intensity: section?.intensity ?? 0,
      confidence: section?.confidence ?? 0,
      source: 'analysis',
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      beatGrid: true,
      rhythmEvents: true,
      sections: true,
      liveBands: true,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 1 },
  }
}

function contextAt(
  timeSec: number,
  options: {
    sections?: ReactTrackSection[]
    previous?: LaserDmxShowDirectorPerformanceTimingContext | null
    seekIdentity?: string
    loopIdentity?: string
    beatOffset?: number
  } = {},
): LaserDmxShowDirectorPerformanceTimingContext {
  const sections = options.sections ?? MICRO_SECTIONS
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options.beatOffset ?? 0, sections),
    resolvedSections: sections,
    trackIdentity: 'musical-continuity-track',
    seekIdentity: options.seekIdentity ?? 'seek-0',
    loopIdentity: options.loopIdentity ?? 'loop-0',
    previous: options.previous ?? null,
  })
}

function idFactory(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function resolvePreset(
  preset: LaserDmxShowDirectorPerformancePresetDefinition,
  context: LaserDmxShowDirectorPerformanceTimingContext,
) {
  const program = preset.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: preset.createRig(idFactory(preset.id)),
    program,
    context,
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${preset.id}:musical-continuity`,
  })
}

function fixtureSignature(fixture: LaserDmxShowDirectorFixture): string {
  return JSON.stringify({
    key: fixture.semanticKey,
    enabled: fixture.enabled,
    rotation: fixture.rotation,
    spread: fixture.beam.beamSpread,
    angle: fixture.beam.beamAngle,
    color: fixture.color,
    targets: (fixture.beam.targets ?? []).map(target => [target.x, target.y]),
    travel: fixture.runtimeBeamTravel,
  })
}

function activeSignature(result: ReturnType<typeof resolvePreset>): string {
  return JSON.stringify(result.showDirector.fixtures
    .filter(fixture => fixture.enabled)
    .map(fixtureSignature)
    .sort())
}

describe('Show Director macro-section musical continuity', () => {
  it('keeps 5-to-7-bar verse subdivisions on one continuous phrase clock', () => {
    const verseA = contextAt(9.9)
    const verseB = contextAt(10.1, { previous: verseA })
    const verseC = contextAt(22.1, { previous: verseB })

    expect(verseA.resolvedMacroSection?.id).toBe(verseB.resolvedMacroSection?.id)
    expect(verseB.resolvedMacroSection?.id).toBe(verseC.resolvedMacroSection?.id)
    expect(verseB.boundaryClassification).toBe('continuation')
    expect(verseB.boundaries.hardMusicalReset).toBe(false)
    expect(verseB.barsSinceMacroSectionStart).toBeCloseTo(5.05, 4)
    expect(verseC.performanceFourBarBlockIndex).toBe(2)
    expect(verseC.performanceEightBarBlockIndex).toBe(1)
  })

  it('hard-resets cadence for a true role change but not for a micro boundary', () => {
    const beforeMicro = contextAt(9.9)
    const afterMicro = contextAt(10.1, { previous: beforeMicro })
    const beforeBuild = contextAt(35.9, { previous: afterMicro })
    const build = contextAt(36.1, { previous: beforeBuild })

    expect(afterMicro.boundaries.microSectionContinuation).toBe(true)
    expect(afterMicro.performanceFourBarBlockIndex).toBe(1)
    expect(build.boundaryClassification).toBe('hardReset')
    expect(build.boundaries.hardMusicalReset).toBe(true)
    expect(build.performanceFourBarBlockIndex).toBe(0)
    expect(build.performanceEightBarBlockIndex).toBe(0)
  })

  it('keeps Drop 1 phrases together while giving Drop 2 an independent clock', () => {
    const dropOneA = contextAt(45)
    const dropOneB = contextAt(55, { previous: dropOneA })
    const dropTwo = contextAt(75, { previous: dropOneB, seekIdentity: 'seek-drop-two' })

    expect(dropOneA.resolvedMacroSection?.id).toBe(dropOneB.resolvedMacroSection?.id)
    expect(dropOneB.dropOccurrence).toBe(1)
    expect(dropTwo.resolvedMacroSection?.id).not.toBe(dropOneB.resolvedMacroSection?.id)
    expect(dropTwo.dropOccurrence).toBe(2)
    expect(dropTwo.performanceFourBarBlockIndex).toBe(0)
  })

  it('invalidates macro calculations after an in-place Track Map edit', () => {
    const editable = MICRO_SECTIONS.map(section => ({ ...section }))
    const before = contextAt(12, { sections: editable })
    editable[1]!.type = 'build'
    editable[1]!.label = 'Manual Build Edit'
    editable[1]!.source = 'user-edited-auto'
    const after = contextAt(12, { sections: editable, previous: before })

    expect(after.sectionIdentity).not.toBe(before.sectionIdentity)
    expect(after.macroSectionIdentity).not.toBe(before.macroSectionIdentity)
    expect(after.resolvedMacroSection?.type).toBe('build')
    expect(after.boundaries.timingDiscontinuity).toBe(true)
  })

  it('preserves manual Track Map authority when constructing macro sections', () => {
    const auto: ReactTrackSection[] = [
      { id: 'auto-verse', label: 'Verse', type: 'verse', startSec: 0, endSec: 24, intensity: 0.5, source: 'auto', confidence: 0.8 },
    ]
    const manual: ReactTrackSection[] = [
      { id: 'manual-build', label: 'Manual Build', type: 'build', startSec: 8, endSec: 16, intensity: 0.8, source: 'manual', confidence: 1 },
    ]
    const context = buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: 10,
      frame: frameAt(10, 0, [...auto, ...manual]),
      analyzedSections: auto,
      manualSections: manual,
      trackIdentity: 'manual-authority',
    })

    expect(context.resolvedSection?.id).toBe('manual-build')
    expect(context.resolvedMacroSection?.type).toBe('build')
    expect(context.boundaryClassification).toBe('hardReset')
  })

  it('reconstructs the same four- and eight-bar state after seek and loop discontinuities', () => {
    const directContext = contextAt(24.1)
    const seekContext = contextAt(24.1, { previous: contextAt(4), seekIdentity: 'seek-12-bars' })
    const loopContext = contextAt(24.1, { previous: contextAt(32), loopIdentity: 'loop-9-16-pass-2' })
    const direct = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, directContext)
    const sought = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, seekContext)
    const looped = resolvePreset(PRISM_CATHEDRAL_PERFORMANCE_PRESET, loopContext)

    expect(directContext.performanceFourBarBlockIndex).toBe(3)
    expect(directContext.performanceEightBarBlockIndex).toBe(1)
    expect(directContext.sceneLocalVariationIndex).toBe(3)
    expect(activeSignature(sought)).toBe(activeSignature(direct))
    expect(activeSignature(looped)).toBe(activeSignature(direct))
    expect(sought.activeMotifFamily).toBe(direct.activeMotifFamily)
    expect(looped.eightBarRecruitmentStage).toBe(direct.eightBarRecruitmentStage)
  })

  it('detects skipped four- and eight-bar transitions after dropped render frames', () => {
    const before = contextAt(7.9)
    const after = contextAt(16.1, { previous: before })

    expect(after.boundaries.timingDiscontinuity).toBe(false)
    expect(after.boundaries.performanceFourBarBoundary).toBe(true)
    expect(after.boundaries.performanceEightBarBoundary).toBe(true)
  })

  it('keeps motif identity stable across beat mutations inside one four-bar block', () => {
    const firstBeat = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, contextAt(12.1, { beatOffset: 0 }))
    const laterBeat = resolvePreset(CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET, contextAt(12.6, { beatOffset: 0 }))

    expect(firstBeat.activeSceneId).toBe(laterBeat.activeSceneId)
    expect(firstBeat.activeMotifFamily).toBe(laterBeat.activeMotifFamily)
    expect(firstBeat.activeMotifFamily).toBe('cardinal-vertical-opposing-fans')
    expect(activeSignature(firstBeat)).not.toBe(activeSignature(laterBeat))
  })

  it('reaches stage two through micro-sections and evolves fixtures already active', () => {
    for (const preset of LASER_DMX_SHOW_DIRECTOR_SHOWCASE_PRESETS) {
      const stageOne = resolvePreset(preset, contextAt(15.9))
      const stageTwo = resolvePreset(preset, contextAt(16.1))
      const activeAtBoth = stageOne.showDirector.fixtures.filter(fixture => (
        fixture.enabled && stageTwo.showDirector.fixtures.some(candidate => candidate.semanticKey === fixture.semanticKey && candidate.enabled)
      ))
      const evolved = activeAtBoth.some(fixture => {
        const next = stageTwo.showDirector.fixtures.find(candidate => candidate.semanticKey === fixture.semanticKey)
        return next != null && (next.rotation !== fixture.rotation || next.beam.beamSpread !== fixture.beam.beamSpread || next.beam.beamAngle !== fixture.beam.beamAngle)
      })

      expect(stageOne.eightBarRecruitmentStage).toBe(1)
      expect(stageTwo.eightBarRecruitmentStage).toBe(2)
      expect(evolved).toBe(true)
    }
  })

  it('authors deterministic four-bar motif sequences and stays under the 300-beam budget', () => {
    for (const preset of [
      PRISM_CATHEDRAL_PERFORMANCE_PRESET,
      CARDINAL_FAN_REACTOR_PERFORMANCE_PRESET,
      CYAN_MIRROR_CAGE_PERFORMANCE_PRESET,
    ]) {
      const program = preset.createProgram()
      const sequencedScenes = program.scenes.filter(scene => (scene.fourBarVariations?.length ?? 0) >= 4)
      expect(sequencedScenes.length).toBeGreaterThan(0)
      for (const scene of sequencedScenes) {
        expect(scene.fourBarVariations?.slice(0, 4).map(variation => variation.motifFamily)).toEqual(EXPECTED_MOTIFS[preset.id])
      }
      for (const timeSec of [1, 8.1, 16.1, 24.1, 45, 60.1, 75, 90.1]) {
        const result = resolvePreset(preset, contextAt(timeSec))
        const compiled = compileLaserDmxShowDirectorToBeamMatrix({
          showDirector: result.showDirector,
          beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
          sections: MICRO_SECTIONS,
          fixturePriorityById: result.fixturePriorityById,
        })
        expect(result.boundedBeamDemand).toBeLessThanOrEqual(300)
        expect(compiled.beams.length).toBeLessThanOrEqual(300)
      }
    }
  })
})
