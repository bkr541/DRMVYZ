import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  type LaserDmxShowDirectorFixture,
  type ReactTrackSection,
} from './ReactTypes'
import { LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER } from './LaserDmxShowDirectorBeamBudget'
import {
  buildLaserDmxShowDirectorPerformanceContext,
  type LaserDmxShowDirectorPerformanceTimingContext,
} from './LaserDmxShowDirectorPerformanceContext'
import {
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import {
  LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS,
  type LaserDmxShowDirectorRigBackedPerformanceShowId,
} from './LaserDmxShowDirectorRigBackedPerformanceShows'
import {
  resolveLaserDmxShowDirectorPerformance,
  type LaserDmxShowDirectorPerformanceResolution,
} from './LaserDmxShowDirectorPerformanceResolver'
import { LASER_DMX_SHOW_DIRECTOR_TEMPLATES } from './laserDmxShowDirectorTemplates'
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


const SHORT_VERSE_SECTIONS: ReactTrackSection[] = [
  { id: 'verse-a', label: 'Verse A', type: 'verse', startSec: 16, endSec: 24, intensity: 0.46, source: 'auto', confidence: 1 },
  { id: 'verse-b', label: 'Verse B', type: 'verse', startSec: 24, endSec: 32, intensity: 0.5, source: 'auto', confidence: 1 },
  { id: 'verse-c', label: 'Verse C', type: 'verse', startSec: 32, endSec: 48, intensity: 0.52, source: 'auto', confidence: 1 },
]

const EXPECTED = Object.freeze({
  'small-club-rig-performance': {
    sourceRigLayoutId: 'small-club-rig',
    requiredBanks: ['lowerKick', 'upperSnare', 'leftCall', 'rightResponse', 'outerHero', 'innerPrimary', 'texture', 'boundedImpact'],
    center: { minX: 6, maxX: 8 },
  },
  'festival-front-beams-performance': {
    sourceRigLayoutId: 'festival-front-beams',
    requiredBanks: ['leftHeroEdge', 'rightHeroEdge', 'innerPrimary', 'lowerKick', 'upperSnare', 'fourBarSubdivision', 'eightBarRecruitment', 'texture', 'boundedImpact'],
    center: { minX: 7.8, maxX: 9.2 },
  },
  'dubstep-drop-lasers-performance': {
    sourceRigLayoutId: 'dubstep-drop-lasers',
    requiredBanks: ['kick', 'snare', 'hatTexture', 'downbeatImpact', 'outerHero', 'innerPrimary', 'fourBarMutation', 'eightBarRecruitment'],
    center: { minX: 6.1, maxX: 7.9 },
  },
} satisfies Record<string, {
  sourceRigLayoutId: string
  requiredBanks: string[]
  center: { minX: number; maxX: number }
}>)

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
    sourceId: 'rig-backed-laser-test-source',
    trackId: 'rig-backed-laser-test-track',
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
    sections?: ReactTrackSection[]
  } = {},
): LaserDmxShowDirectorPerformanceTimingContext {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: options.sections ?? SECTIONS,
    trackIdentity: 'rig-backed-laser-test-track',
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
    runtimeInvalidationId: `${preset.id}:authored-laser-test`,
  })
}

function activeSignature(result: LaserDmxShowDirectorPerformanceResolution): string {
  return JSON.stringify(result.showDirector.fixtures
    .filter(fixture => fixture.enabled)
    .map(fixture => ({
      key: fixture.semanticKey,
      brightness: Number(fixture.brightness.toFixed(4)),
      color: fixture.color,
      rotation: Number(fixture.rotation.toFixed(4)),
      spread: Number(fixture.beam.beamSpread.toFixed(4)),
      targets: (fixture.beam.targets ?? []).map(target => [Number(target.x.toFixed(3)), Number(target.y.toFixed(3))]),
      travel: fixture.runtimeBeamTravel,
      appearance: fixture.runtimeBeamAppearance,
    }))
    .sort((a, b) => (a.key ?? '').localeCompare(b.key ?? '')))
}

function activeBeamFixtures(result: LaserDmxShowDirectorPerformanceResolution): LaserDmxShowDirectorFixture[] {
  return result.showDirector.fixtures.filter(fixture => fixture.enabled && (fixture.kind === 'laser' || fixture.kind === 'movingHead'))
}

function compiledBeamCount(result: LaserDmxShowDirectorPerformanceResolution): number {
  return compileLaserDmxShowDirectorToBeamMatrix({
    showDirector: result.showDirector,
    beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
    sections: SECTIONS,
    fixturePriorityById: result.fixturePriorityById,
  }).beams.length
}

function angularDiversity(fixtures: readonly LaserDmxShowDirectorFixture[]): number {
  const angles = fixtures.flatMap(fixture => (fixture.beam.targets ?? []).map(target => (
    Math.atan2(target.y - fixture.y, target.x - fixture.x) * 180 / Math.PI
  )))
  return new Set(angles.map(angle => Math.round(angle / 4) * 4)).size
}

function targetSignature(fixture: LaserDmxShowDirectorFixture): string {
  return JSON.stringify((fixture.beam.targets ?? []).map(target => [Number(target.x.toFixed(3)), Number(target.y.toFixed(3))]))
}

describe('authored rig-backed laser Performance Shows', () => {
  it('registers exactly the three canonical laser conversions without mutating static Rig Layout presets', () => {
    const before = JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)
    expect(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS.map(preset => preset.name)).toEqual([
      'Small Club Performance',
      'Festival Front Beams Performance',
      'Dubstep Drop Lasers Performance',
    ])
    for (const preset of LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS) {
      const expected = EXPECTED[preset.id as keyof typeof EXPECTED]
      expect(expected).toBeDefined()
      expect(preset.sourceRigLayoutId).toBe(expected.sourceRigLayoutId)
      expect(preset.createRig(deterministicIdFactory(preset.id)).sourceTemplateId).toBe(expected.sourceRigLayoutId)
      expect(LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_SHOWS[preset.id as LaserDmxShowDirectorRigBackedPerformanceShowId].status).toBe('available')
    }
    expect(JSON.stringify(LASER_DMX_SHOW_DIRECTOR_TEMPLATES)).toBe(before)
  })

  for (const preset of LASER_DMX_SHOW_DIRECTOR_RIG_BACKED_PERFORMANCE_PRESETS) {
    const expected = EXPECTED[preset.id as keyof typeof EXPECTED]

    describe(preset.name, () => {
      it('authors the required fixture-bank responsibilities and complete section lifecycle', () => {
        const program = preset.createProgram()
        expect(Object.keys(program.fixtureBanks ?? {})).toEqual(expect.arrayContaining(expected.requiredBanks))
        expect(program.scenes.map(scene => scene.energyEnvelopeKey)).toEqual([
          'intro', 'verse', 'build', 'preDrop', 'drop1', 'breakdown', 'drop2', 'outro',
        ])
        expect(program.blackoutPolicy).toMatchObject({
          maxPreDropBeats: 0.5,
          maxImpactCutBeats: 0.25,
          breakdownRequiresVisibleOutput: true,
        })
        expect(program.diagnostics?.notes).toEqual(expect.arrayContaining([
          expect.stringContaining(expected.sourceRigLayoutId),
        ]))
      })

      it('keeps fixture-local origins readable, protects the center aperture, and preserves angular diversity', () => {
        const dropBody = resolvePreset(preset, 88.1)
        const beams = activeBeamFixtures(dropBody)
        expect(beams.length).toBeGreaterThanOrEqual(2)
        expect(new Set(beams.map(fixture => `${fixture.x.toFixed(2)}:${fixture.y.toFixed(2)}`)).size).toBeGreaterThanOrEqual(2)
        expect(new Set(beams.map(targetSignature)).size).toBeGreaterThan(1)
        expect(angularDiversity(beams)).toBeGreaterThanOrEqual(5)

        const protectedTargets = beams.flatMap(fixture => fixture.beam.targets ?? [])
          .filter(target => target.x > expected.center.minX && target.x < expected.center.maxX)
        expect(protectedTargets).toEqual([])
      })

      it('separates kick and snare geometry while retaining beat, four-bar, eight-bar, and phrase continuity', () => {
        const neutral = resolvePreset(preset, 88.1)
        const kick = resolvePreset(preset, 88.1, { kick: true })
        const snare = resolvePreset(preset, 88.1, { snare: true })
        expect(activeSignature(kick)).not.toBe(activeSignature(neutral))
        expect(activeSignature(snare)).not.toBe(activeSignature(neutral))
        expect(activeSignature(kick)).not.toBe(activeSignature(snare))

        expect(activeSignature(resolvePreset(preset, 82.1))).not.toBe(activeSignature(resolvePreset(preset, 82.6)))
        expect(activeSignature(resolvePreset(preset, 87.9))).not.toBe(activeSignature(resolvePreset(preset, 88.1)))

        const beforeRecruitment = resolvePreset(preset, 95.9)
        const afterRecruitment = resolvePreset(preset, 96.1)
        expect(afterRecruitment.eightBarRecruitmentStage).toBeGreaterThan(beforeRecruitment.eightBarRecruitmentStage)
        expect(afterRecruitment.activeFixtureKeys.length).toBeGreaterThan(beforeRecruitment.activeFixtureKeys.length)

        const beforeSection = contextAt(23.9, { sections: SHORT_VERSE_SECTIONS })
        const afterSection = contextAt(24.1, { previous: beforeSection, sections: SHORT_VERSE_SECTIONS })
        expect(afterSection.performanceFourBarBlockIndex).toBeGreaterThanOrEqual(beforeSection.performanceFourBarBlockIndex)
        expect(afterSection.performanceEightBarBlockIndex).toBeGreaterThanOrEqual(beforeSection.performanceEightBarBlockIndex)
      })

      it('delivers a readable full-song density arc with bounded blackouts and an evolved second drop', () => {
        const snapshots = {
          intro: resolvePreset(preset, 0.1),
          verse: resolvePreset(preset, 24.1),
          build: resolvePreset(preset, 66.1),
          preDrop: resolvePreset(preset, 76.1),
          dropOneImpact: resolvePreset(preset, 80.1),
          dropOneBody: resolvePreset(preset, 96.1),
          breakdown: resolvePreset(preset, 112.1),
          dropTwoImpact: resolvePreset(preset, 128.1),
          dropTwoBody: resolvePreset(preset, 136.1),
          outro: resolvePreset(preset, 166.1),
        }

        for (const resolution of Object.values(snapshots)) {
          expect(resolution.activeFixtureKeys.length).toBeGreaterThan(0)
          expect(compiledBeamCount(resolution)).toBeLessThanOrEqual(300)
        }
        expect(snapshots.build.activeFixtureKeys.length).toBeGreaterThan(snapshots.intro.activeFixtureKeys.length)
        expect(snapshots.dropOneBody.estimatedBeamDemand).toBeGreaterThan(snapshots.verse.estimatedBeamDemand)
        expect(snapshots.breakdown.estimatedBeamDemand).toBeLessThan(snapshots.dropOneBody.estimatedBeamDemand)
        expect(snapshots.dropTwoImpact.estimatedBeamDemand).toBeGreaterThan(snapshots.dropOneImpact.estimatedBeamDemand)
        expect(activeSignature(snapshots.dropTwoBody)).not.toBe(activeSignature(snapshots.dropOneBody))
        expect(snapshots.outro.estimatedBeamDemand).toBeLessThan(snapshots.dropTwoBody.estimatedBeamDemand)

        expect(resolvePreset(preset, 79.4).requestedGlobalOutputOverrides.blackout).not.toBe(true)
        expect(resolvePreset(preset, 79.8).requestedGlobalOutputOverrides).toMatchObject({ blackout: true, dimmer: 0 })
      })

      it('enforces beam hierarchy, palette ownership, and the declared hard beam budget', () => {
        const body = resolvePreset(preset, 88.1)
        const active = body.showDirector.fixtures.filter(fixture => fixture.enabled)
        const activeRoles = active.map(fixture => body.fixturePriorityRoleById?.[fixture.id]).filter(Boolean)
        expect(activeRoles).toEqual(expect.arrayContaining(['heroImpact']))
        expect(LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER.heroImpact).toBeLessThan(
          LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER.decorativeAccent,
        )

        const colors = active.map(fixture => fixture.color.toLowerCase())
        expect(new Set(colors).size).toBeLessThanOrEqual(3)
        expect(colors.filter(color => color === '#f7fbff').length).toBeLessThan(active.length)

        let peak = 0
        for (let timeSec = 0.1; timeSec < 176; timeSec += 1.9) {
          peak = Math.max(peak, compiledBeamCount(resolvePreset(preset, timeSec)))
        }
        expect(peak).toBeLessThanOrEqual(preset.approximatePeakBeamDemand)
        expect(peak).toBeLessThanOrEqual(300)
      })

      it('reconstructs identical show state after seeks and loops', () => {
        const direct = resolvePreset(preset, 98.1)
        const sought = resolvePreset(preset, 98.1, {
          previous: contextAt(140.1),
          seekIdentity: 'seek-2',
        })
        const looped = resolvePreset(preset, 98.1, {
          previous: contextAt(110.1),
          loopIdentity: 'loop-2',
        })
        expect(sought.showDirector).toEqual(direct.showDirector)
        expect(looped.showDirector).toEqual(direct.showDirector)
        expect(sought.activeSceneId).toBe(direct.activeSceneId)
        expect(looped.fourBarVariation).toBe(direct.fourBarVariation)
        expect(looped.eightBarRecruitmentStage).toBe(direct.eightBarRecruitmentStage)
      })
    })
  }
})
