import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../features/musicIntelligence/constants'
import {
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type ReactTrackSection,
} from './ReactTypes'
import { createLaserDmxScannerPattern } from './laserDmxScannerAuthoring'
import { buildLaserDmxShowDirectorPerformanceContext } from './LaserDmxShowDirectorPerformanceContext'
import {
  normalizeLaserDmxShowDirectorPerformanceProgram,
  type LaserDmxShowDirectorPerformanceProgram,
} from './LaserDmxShowDirectorPerformanceProgram'
import { resolveLaserDmxShowDirectorPerformance } from './LaserDmxShowDirectorPerformanceResolver'

const sections: ReactTrackSection[] = [
  { id: 'manual-build', label: 'Manual Build', type: 'build', startSec: 0, endSec: 16, intensity: 0.7, source: 'manual', confidence: 1 },
  { id: 'manual-drop', label: 'Manual Drop', type: 'drop', startSec: 16, endSec: 32, intensity: 1, source: 'manual', confidence: 1 },
]

function context(timeSec: number, seekIdentity = 'seek-a', loopIdentity = 'loop-a') {
  return buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec,
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, beatIndex: Math.floor(timeSec * 2), beatPhase: (timeSec * 2) % 1, barIndex: Math.floor(timeSec / 2) },
      section: { ...DEFAULT_MI_FRAME.section, type: timeSec < 16 ? 'build' : 'drop', confidence: 0.4 },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 1, rhythm: 1, section: 0.4 },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, beatGrid: true, sections: true },
    },
    resolvedSections: sections,
    trackIdentity: 'track-map-authoritative',
    seekIdentity,
    loopIdentity,
    previous: null,
  })
}

function rig() {
  const source = createDefaultLaserDmxShowDirectorFixture('laser', 'scanner-hero', 0)
  source.semanticKey = 'scanner-hero'
  source.scanner = createLaserDmxScannerPattern(source, 'fanSweep', { columns: 15, rows: 10 })
  return normalizeLaserDmxShowDirectorState({ ...createDefaultLaserDmxShowDirectorState(), fixtures: [source] })
}

function program(): LaserDmxShowDirectorPerformanceProgram {
  const normalized = normalizeLaserDmxShowDirectorPerformanceProgram({
    schemaVersion: 1,
    id: 'scanner-track-map-program',
    name: 'Scanner Track Map Program',
    deterministicSeed: 44,
    fallbackOrder: ['build', 'drop'],
    tuning: { intensity: 1, variation: 1, audioIntelligenceResponse: 1, transitionScale: 1 },
    scenes: [
      {
        id: 'build-scanner', label: 'Build Scanner', enabled: true, priority: 10,
        section: { types: ['build'] },
        address: { fixtureSemanticKeys: ['scanner-hero'] },
        fixtureActions: [{
          id: 'build-scan-action', kind: 'scanner', patternType: 'lineSweep', scanRatePps: 12000,
          direction: 'forward', phase: 0.1, fanWidth: 28, retraceBlanking: true,
          switchBoundary: 'bar', opticalMode: 'normal', opticalCopyCount: 1,
        }],
      },
      {
        id: 'drop-scanner', label: 'Drop Scanner', enabled: true, priority: 10,
        section: { types: ['drop'] },
        address: { fixtureSemanticKeys: ['scanner-hero'] },
        fixtureActions: [{
          id: 'drop-scan-action', kind: 'scanner', patternType: 'circle', scanRatePps: 26000,
          direction: 'alternating', reversePath: true, phase: 0.5, depthLayer: 'deepAir',
          opticalMode: 'prism', opticalCopyCount: 5, pathResetToken: 3, switchBoundary: 'section',
        }],
      },
    ],
  })
  if (!normalized) throw new Error('Expected scanner performance program to normalize')
  return normalized
}

function resolve(timeSec: number, seek = 'seek-a', loop = 'loop-a') {
  const authored = rig()
  const authoredProgram = program()
  return resolveLaserDmxShowDirectorPerformance({
    authoredShowDirector: authored,
    program: authoredProgram,
    context: context(timeSec, seek, loop),
    tuning: authoredProgram.tuning,
    programSeed: authoredProgram.deterministicSeed,
    enabled: true,
    audioIntelligenceEnabled: true,
    fallbackBehavior: 'basicTiming',
    runtimeInvalidationId: `${seek}:${loop}`,
  })
}

describe('Show Director scanner Track Map and Performance Program integration', () => {
  it('normalizes the complete high-level scanner action surface', () => {
    const normalized = program()
    expect(normalized.scenes[1]?.fixtureActions?.[0]).toMatchObject({
      kind: 'scanner', patternType: 'circle', scanRatePps: 26000, direction: 'alternating',
      reversePath: true, phase: 0.5, depthLayer: 'deepAir', opticalMode: 'prism',
      opticalCopyCount: 5, pathResetToken: 3, switchBoundary: 'section',
    })
  })

  it('uses manual Track Map sections to select scanner behavior', () => {
    expect(resolve(8).showDirector.fixtures[0]?.runtimeScanner).toMatchObject({ patternType: 'lineSweep', scanRatePps: 12000, switchBoundary: 'bar' })
    expect(resolve(20).showDirector.fixtures[0]?.runtimeScanner).toMatchObject({ patternType: 'circle', scanRatePps: 26000, opticalMode: 'prism', opticalCopyCount: 5 })
  })

  it('reconstructs identical scanner state after seek, loop, track, and occurrence invalidation', () => {
    const baseline = resolve(20, 'seek-a', 'loop-a').showDirector.fixtures[0]?.runtimeScanner
    const afterSeek = resolve(20, 'seek-b', 'loop-a').showDirector.fixtures[0]?.runtimeScanner
    const afterLoop = resolve(20, 'seek-b', 'loop-b').showDirector.fixtures[0]?.runtimeScanner
    expect(afterSeek).toEqual(baseline)
    expect(afterLoop).toEqual(baseline)
  })

  it('keeps authored scanner data immutable while runtime controls remain transient', () => {
    const authored = rig()
    const before = structuredClone(authored)
    resolve(20)
    expect(authored).toEqual(before)
    expect(authored.fixtures[0]?.runtimeScanner).toBeUndefined()
  })
})
