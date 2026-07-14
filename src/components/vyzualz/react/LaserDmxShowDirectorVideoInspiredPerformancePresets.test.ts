import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../features/musicIntelligence/types'
import {
  createDefaultLaserDmxShowDirectorState,
  type ReactTrackSection,
} from './ReactTypes'
import {
  buildLaserDmxShowDirectorPerformanceContext,
} from './LaserDmxShowDirectorPerformanceContext'
import {
  createDefaultLaserDmxShowDirectorPerformanceState,
  normalizeLaserDmxShowDirectorPerformanceProgram,
} from './LaserDmxShowDirectorPerformanceProgram'
import {
  createLaserDmxShowDirectorPerformancePresetLoadResult,
  LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS,
  type LaserDmxShowDirectorPerformancePresetDefinition,
} from './LaserDmxShowDirectorPerformancePresets'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'

const IDS = [
  'vocal-eclipse-exchange',
  'emerald-tunnel-relay',
  'white-vector-interlock',
  'aurora-canopy-drift',
  'chromatic-chapter-stage',
  'prismatic-pulse-matrix',
  'spectral-ribbon-singularity',
  'crimson-apex-protocol',
  'violet-hourglass-orbit',
  'scarlet-origami-lattice',
] as const

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

function preset(id: string): LaserDmxShowDirectorPerformancePresetDefinition {
  const result = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(item => item.id === id)
  if (!result) throw new Error(`Missing preset ${id}`)
  return result
}

function ids(prefix: string): () => string {
  let index = 0
  return () => `${prefix}-${++index}`
}

function sectionAt(timeSec: number): ReactTrackSection {
  return SECTIONS.find(section => timeSec >= section.startSec && timeSec < section.endSec) ?? SECTIONS[SECTIONS.length - 1]
}

function frameAt(timeSec: number, lyricActivity = 0): MusicIntelligenceFrame {
  const section = sectionAt(timeSec)
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  const progress = Math.max(0, Math.min(1, (timeSec - section.startSec) / (section.endSec - section.startSec)))
  const drop = section.type === 'drop'
  const build = section.type === 'build' || section.type === 'preDrop'
  const energy = drop ? 0.94 : build ? 0.72 + progress * 0.2 : section.type === 'breakdown' ? 0.3 : 0.5
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.round(timeSec * 60),
    sourceId: 'video-inspired-test-source',
    trackId: 'video-inspired-test-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass: 0.78,
      high: 0.56,
      volume: energy,
      normalizedBass: 0.78,
      normalizedHigh: 0.56,
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
      kickHit: beatIndex % 2 === 0,
      kickStrength: beatIndex % 2 === 0 ? 1 : 0,
      snareHit: beatIndex % 4 === 2,
      snareStrength: beatIndex % 4 === 2 ? 1 : 0,
      hatHit: true,
      hatStrength: 0.62,
      transient: drop ? 0.72 : 0.28,
      transientConfidence: 1,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: energy,
      shortTerm: energy,
      longTerm: 0.52,
      peak: 0.98,
      spectralFlux: drop ? 0.76 : 0.42,
      buildProgress: build ? progress : 0,
      dropImpact: drop && progress < 0.08 ? 1 : 0.2,
      tension: build ? 0.84 : 0.42,
      trackCurve: energy,
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
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocalEnergy: lyricActivity,
      vocalActivity: lyricActivity,
    },
    lyrics: {
      ...DEFAULT_MI_FRAME.lyrics,
      vocalActivity: lyricActivity,
      isGap: lyricActivity <= 0.2,
      activeLine: lyricActivity > 0.2 ? 'test vocal' : null,
    },
    capabilities: {
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
      stemCurves: true,
      lyrics: true,
    },
    confidence: { overall: 1, rhythm: 1, harmonic: 0.7, section: 1 },
  }
}

function resolve(id: string, timeSec: number, lyricActivity = 0) {
  const item = preset(id)
  const program = item.createProgram()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: item.createRig(ids(`${id}-fixture`)),
    program,
    context: buildLaserDmxShowDirectorPerformanceContext({
      audioTimeSec: timeSec,
      frame: frameAt(timeSec, lyricActivity),
      resolvedSections: SECTIONS,
      trackIdentity: 'video-inspired-test-track',
      seekIdentity: 'seek-0',
      loopIdentity: 'loop-0',
    }),
    tuning: program.tuning,
    programSeed: program.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${id}:test`,
  })
}

function activeKeys(result: ReturnType<typeof resolve>): string[] {
  return result.showDirector.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.semanticKey ?? fixture.id)
}

function geometrySignature(result: ReturnType<typeof resolve>): string {
  return JSON.stringify(result.showDirector.fixtures
    .filter(fixture => fixture.enabled && (fixture.kind === 'laser' || fixture.kind === 'movingHead'))
    .map(fixture => ({
      key: fixture.semanticKey,
      color: fixture.color,
      spread: fixture.beam.beamSpread,
      targets: fixture.beam.targets?.map(target => [target.x, target.y]),
    }))
    .sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''))
  )
}

describe('video-inspired Show Director performance presets', () => {
  it('registers all ten reference-authored presets with stable rigs and complete full-song programs', () => {
    expect(IDS.map(id => preset(id).name)).toEqual([
      'Vocal Eclipse Exchange',
      'Emerald Tunnel Relay',
      'White Vector Interlock',
      'Aurora Canopy Drift',
      'Chromatic Chapter Stage',
      'Prismatic Pulse Matrix',
      'Spectral Ribbon Singularity',
      'Crimson Apex Protocol',
      'Violet Hourglass Orbit',
      'Scarlet Origami Lattice',
    ])

    for (const id of IDS) {
      const item = preset(id)
      const first = item.createRig(ids(`${id}-first`))
      const second = item.createRig(ids(`${id}-second`))
      const program = item.createProgram()
      expect(first.fixtures).toHaveLength(item.fixtureCount)
      expect(first.fixtures.map(fixture => fixture.semanticKey)).toEqual(second.fixtures.map(fixture => fixture.semanticKey))
      expect(new Set(first.fixtures.map(fixture => fixture.semanticKey)).size).toBe(item.fixtureCount)
      expect(program.scenes).toHaveLength(8)
      expect(program.scenes.filter(scene => scene.section.types.includes('drop'))).toHaveLength(2)
      expect(program.scenes.every(scene => (scene.fourBarVariations?.length ?? 0) >= 4)).toBe(true)
      expect(program.scenes.every(scene => (scene.eightBarRecruitment?.length ?? 0) > 0)).toBe(true)
      expect(program.scenes.every(scene => (scene.beatMutations?.length ?? 0) > 0)).toBe(true)
      expect(program.blackoutPolicy?.maximumProgrammedBlackoutRatio).toBeLessThanOrEqual(0.08)
      expect(normalizeLaserDmxShowDirectorPerformanceProgram(program)?.id).toBe(id)

      const load = createLaserDmxShowDirectorPerformancePresetLoadResult(
        createDefaultLaserDmxShowDirectorState(),
        createDefaultLaserDmxShowDirectorPerformanceState(),
        item,
      )
      expect(load?.performance.activeBuiltInProgramId).toBe(id)
      expect(load?.performance.activePresetId).toBe(id)
    }
  })

  it('contracts Vocal Eclipse to moving-head isolation during vocals and restores laser responses in lyric gaps', () => {
    const vocal = resolve('vocal-eclipse-exchange', 24, 0.9)
    const gap = resolve('vocal-eclipse-exchange', 24, 0.05)
    const vocalKeys = activeKeys(vocal)
    const gapKeys = activeKeys(gap)
    expect(vocalKeys).toEqual(expect.arrayContaining(['eclipse-head-l', 'eclipse-head-r']))
    expect(gapKeys).toEqual(expect.arrayContaining(['eclipse-laser-top-l', 'eclipse-laser-top-r']))
    expect(gapKeys.filter(key => key.includes('laser')).length).toBeGreaterThan(vocalKeys.filter(key => key.includes('laser')).length)
  })

  it('gives each show a genuinely evolved second drop rather than a brightness-only repeat', () => {
    for (const id of IDS) {
      const drop1 = resolve(id, 88)
      const drop2 = resolve(id, 136)
      expect(geometrySignature(drop2)).not.toBe(geometrySignature(drop1))
      expect(activeKeys(drop2).length).toBeGreaterThanOrEqual(activeKeys(drop1).length)
    }
  })

  it('replaces geometry on nearly every beat of the Prismatic Pulse Matrix sixteen-beat drop phrase', () => {
    const signatures = Array.from({ length: 16 }, (_, beatOffset) => geometrySignature(resolve(
      'prismatic-pulse-matrix',
      80 + beatOffset * 0.5 + 0.02,
    )))
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(12)

    const cyanDownbeat = resolve('prismatic-pulse-matrix', 80.02)
    const sparseReset = resolve('prismatic-pulse-matrix', 83.02)
    const whiteFan = resolve('prismatic-pulse-matrix', 86.02)
    expect(activeKeys(cyanDownbeat).filter(key => key.includes('laser')).length).toBeGreaterThanOrEqual(4)
    expect(geometrySignature(sparseReset)).not.toBe(geometrySignature(cyanDownbeat))
    expect(sparseReset.showDirector.fixtures.find(fixture => fixture.semanticKey === 'matrix-laser-side-l')?.color).toBe('#ff243f')
    expect(activeKeys(whiteFan).filter(key => key.includes('head')).length).toBeGreaterThanOrEqual(3)
  })


  it('alternates Spectral Ribbon Singularity between sparse beacon breaths and wide chromatic ribbon sculptures', () => {
    const beacon = resolve('spectral-ribbon-singularity', 82.52)
    const cyanSail = resolve('spectral-ribbon-singularity', 80.52)
    const whiteRibbon = resolve('spectral-ribbon-singularity', 84.52)
    const beaconKeys = activeKeys(beacon)
    expect(beaconKeys).toEqual(expect.arrayContaining(['ribbon-laser-center', 'ribbon-head-center']))
    expect(geometrySignature(beacon)).not.toBe(geometrySignature(cyanSail))
    expect(beacon.showDirector.fixtures.find(fixture => fixture.semanticKey === 'ribbon-laser-center')?.brightness)
      .toBeGreaterThan(beacon.showDirector.fixtures.find(fixture => fixture.semanticKey === 'ribbon-laser-top-l-outer')?.brightness ?? 0)
    expect(activeKeys(whiteRibbon).filter(key => key.includes('ribbon-head')).length).toBeGreaterThanOrEqual(3)
    expect(geometrySignature(cyanSail)).not.toBe(geometrySignature(whiteRibbon))
  })

  it('runs Crimson Apex Protocol as an eight-beat red-and-white architectural relay', () => {
    const signatures = Array.from({ length: 8 }, (_, beatOffset) => geometrySignature(resolve(
      'crimson-apex-protocol',
      80 + beatOffset * 0.5 + 0.02,
    )))
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(6)

    const pyramid = resolve('crimson-apex-protocol', 80.02)
    const whiteEdge = resolve('crimson-apex-protocol', 81.02)
    const sparseSpine = resolve('crimson-apex-protocol', 83.02)
    expect(pyramid.showDirector.fixtures.find(fixture => fixture.semanticKey === 'apex-laser-center-l')?.color).toBe('#ff174d')
    expect(activeKeys(whiteEdge).filter(key => key.includes('apex-head')).length).toBeGreaterThanOrEqual(3)
    expect(sparseSpine.showDirector.fixtures.find(fixture => fixture.semanticKey === 'apex-laser-side-l')?.color).toBe('#78001f')
    expect(geometrySignature(sparseSpine)).not.toBe(geometrySignature(pyramid))
  })

  it('runs Violet Hourglass Orbit as a sixteen-beat center-point geometry relay with a sparse breath and red-white close', () => {
    const signatures = Array.from({ length: 16 }, (_, beatOffset) => geometrySignature(resolve(
      'violet-hourglass-orbit',
      80 + beatOffset * 0.5 + 0.02,
    )))
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(11)

    const cyanStar = resolve('violet-hourglass-orbit', 80.02)
    const sparseBeacon = resolve('violet-hourglass-orbit', 83.52)
    const whiteWireFan = resolve('violet-hourglass-orbit', 84.02)
    expect(activeKeys(cyanStar).filter(key => key.includes('hourglass')).length).toBeGreaterThanOrEqual(6)
    expect(activeKeys(sparseBeacon)).toEqual(expect.arrayContaining(['hourglass-laser-center', 'hourglass-head-center']))
    expect(activeKeys(whiteWireFan).filter(key => key.includes('hourglass-head')).length).toBeGreaterThanOrEqual(3)
    expect(geometrySignature(cyanStar)).not.toBe(geometrySignature(sparseBeacon))
  })

  it('runs Scarlet Origami Lattice as a sixteen-beat red-fill and white-wire alternation', () => {
    const signatures = Array.from({ length: 16 }, (_, beatOffset) => geometrySignature(resolve(
      'scarlet-origami-lattice',
      80 + beatOffset * 0.5 + 0.02,
    )))
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(11)

    const triFold = resolve('scarlet-origami-lattice', 81.02)
    const whiteLattice = resolve('scarlet-origami-lattice', 83.52)
    const redWireWeb = resolve('scarlet-origami-lattice', 84.02)
    expect(triFold.showDirector.fixtures.find(fixture => fixture.semanticKey === 'origami-laser-center-l')?.color).toBe('#ff174d')
    expect(activeKeys(whiteLattice).filter(key => key.includes('origami-head')).length).toBeGreaterThanOrEqual(3)
    expect(redWireWeb.showDirector.fixtures.find(fixture => fixture.semanticKey === 'origami-laser-side-l')?.color).toBe('#d90838')
    expect(geometrySignature(whiteLattice)).not.toBe(geometrySignature(redWireWeb))
  })

  it('uses mixed fixtures as scene language in Chromatic Chapter Stage', () => {
    const verse = resolve('chromatic-chapter-stage', 24, 0.9)
    const drop = resolve('chromatic-chapter-stage', 88, 0)
    const verseKinds = new Set(verse.showDirector.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.kind))
    const dropKinds = new Set(drop.showDirector.fixtures.filter(fixture => fixture.enabled).map(fixture => fixture.kind))
    expect(verseKinds.has('movingHead')).toBe(true)
    expect(verseKinds.has('parWash')).toBe(true)
    expect(dropKinds.has('laser')).toBe(true)
    expect(dropKinds.has('haze')).toBe(true)
  })
})
