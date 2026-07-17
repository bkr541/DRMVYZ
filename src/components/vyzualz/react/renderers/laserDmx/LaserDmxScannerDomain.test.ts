import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorOpticalPrimitiveType,
} from '../../ReactTypes'
import { compileLaserDmxShowDirectorToBeamMatrix } from '../LaserDmxShowDirectorBeamMatrixCompiler'
import { createLaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  LASER_DMX_SCANNER_DOMAIN_VERSION,
  buildLaserDmxScannerTimelineDiagnostics,
  createDefaultLaserDmxScannerHead,
  createLaserDmxLegacyScannerPlan,
  evaluateLaserDmxScannerAtTime,
  resolveLaserDmxScannerTravelDurationSeconds,
  solveLaserDmxScannerExposure,
  validateLaserDmxScanPath,
  type LaserDmxLegacyScannerTarget,
  type LaserDmxScanPath,
  type LaserDmxScanPoint,
  type LaserDmxScannerColorChannels,
  type LaserDmxScannerHead,
  type LaserDmxScannerVec3,
} from './LaserDmxScannerDomain'

const COLOR: LaserDmxScannerColorChannels = { r: 0.2, g: 0.8, b: 1, a: 1 }
const ORIGIN: LaserDmxScannerVec3 = { x: 0.5, y: 0.1, z: 0 }

function fixture(id: string, label = 'Scanner'): LaserDmxShowDirectorFixture {
  const result = createDefaultLaserDmxShowDirectorFixture('laser', id, 0)
  result.label = label
  result.semanticKey = label.toLowerCase().replace(/\s+/g, '-')
  result.brightness = 1
  result.optics.rayCount = 7
  result.optics.prismFacets = 1
  return result
}

function targets(points: Array<[number, number, number?]>): LaserDmxLegacyScannerTarget[] {
  return points.map(([x, y, z = 0], index) => ({ id: `target-${index + 1}`, position: { x, y, z } }))
}

function planFor(
  sourceFixture: LaserDmxShowDirectorFixture,
  sourceTargets: LaserDmxLegacyScannerTarget[],
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'> = 'fan',
) {
  return createLaserDmxLegacyScannerPlan({
    fixture: sourceFixture,
    origin: ORIGIN,
    targets: sourceTargets,
    primitiveType,
    color: COLOR,
    shutterExposureSeconds: 1 / 60,
    occurrenceSeed: 7,
  })
}

function path(pointsInput: LaserDmxScanPoint[], patch: Partial<LaserDmxScanPath> = {}): LaserDmxScanPath {
  const result: LaserDmxScanPath = {
    schemaVersion: LASER_DMX_SCANNER_DOMAIN_VERSION,
    id: 'path',
    fixtureId: 'laser',
    scannerHeadId: 'laser-scanner-1',
    points: pointsInput,
    closed: false,
    interpolation: 'linear',
    repeatMode: 'loop',
    scanDirection: 'forward',
    conversionKind: 'native',
    compatibilityMode: 'native',
    validationErrors: [],
    migrationWarnings: [],
    ...patch,
  }
  result.validationErrors = validateLaserDmxScanPath(result)
  return result
}

function point(id: string, x: number, y: number, patch: Partial<LaserDmxScanPoint> = {}): LaserDmxScanPoint {
  return {
    id,
    position: { x, y, z: 0 },
    blanked: false,
    dwellMicros: 24,
    intensity: 1,
    color: COLOR,
    cornerBehavior: 'continuous',
    ...patch,
  }
}

function head(patch: Partial<LaserDmxScannerHead> = {}): LaserDmxScannerHead {
  return { ...createDefaultLaserDmxScannerHead('laser', 0, 1 / 60, 0), ...patch }
}

function roundedSpatialWeights(samples: ReturnType<typeof solveLaserDmxScannerExposure>['exposureSamples']) {
  const weights = new Map<string, number>()
  for (const sample of samples.filter(candidate => candidate.opticalCopyIndex === 0)) {
    const key = `${sample.targetOrDirection.x.toFixed(3)}:${sample.targetOrDirection.y.toFixed(3)}`
    weights.set(key, (weights.get(key) ?? 0) + sample.exposureWeight)
  }
  return [...weights.values()]
}

describe('LaserDMX physical scanner domain', () => {
  it('creates production-safe single-aperture scanner defaults', () => {
    const scanner = createDefaultLaserDmxScannerHead('fixture-a', 0, 1 / 48, 0.25)
    expect(scanner).toMatchObject({
      schemaVersion: 1,
      fixtureId: 'fixture-a',
      apertureIndex: 0,
      scanRatePps: 24000,
      retraceBlanking: true,
      scanPhase: 0.25,
    })
    expect(scanner.maximumAngularVelocity).toBeGreaterThan(0)
    expect(scanner.maximumAngularAcceleration).toBeGreaterThan(0)
    expect(scanner.pointDwellMicros).toBeGreaterThan(0)
  })

  it('validates ordered path identity, points, closed shape requirements, dwell, and intensity', () => {
    const invalid = path([], { id: '', fixtureId: '', scannerHeadId: '', closed: true })
    expect(invalid.validationErrors).toEqual(expect.arrayContaining([
      'Path id is required.',
      'Fixture id is required.',
      'Scanner head id is required.',
      'At least one scan point is required.',
      'Closed paths require at least three points.',
    ]))
  })

  it('migrates a triangle into sequential perimeter traversal rather than projector spokes', () => {
    const source = fixture('triangle', 'Triangle Hero')
    source.beam.targetMode = 'fixed'
    const migrated = planFor(source, targets([[0.5, 0.1], [0.82, 0.75], [0.18, 0.75]]), 'parallelBank')
    expect(migrated.paths[0]).toMatchObject({ conversionKind: 'polygon', closed: true })
    expect(migrated.paths[0]?.points).toHaveLength(3)
    expect(new Set(migrated.paths[0]?.points.map(candidate => candidate.sourceTargetId))).toHaveLength(3)
  })

  it('sorts arbitrary legacy polygon vertices into a stable perimeter', () => {
    const source = fixture('polygon', 'Polygon Plane')
    source.beam.targetMode = 'fixed'
    const input = targets([[0.8, 0.8], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8]])
    const first = planFor(source, input, 'parallelBank')
    const second = planFor(source, [...input].reverse(), 'parallelBank')
    const firstPositions = first.paths[0]?.points.map(candidate => candidate.position)
    const secondPositions = second.paths[0]?.points.map(candidate => candidate.position)
    expect(firstPositions).toEqual(secondPositions)
  })

  it('converts a legacy circle into an ordered perimeter with arc interpolation', () => {
    const source = fixture('circle', 'Circle Scanner')
    source.optics.rayCount = 16
    const migrated = planFor(source, targets([[0.5, 0.5]]), 'parallelBank')
    expect(migrated.paths[0]).toMatchObject({ conversionKind: 'circle', closed: true, interpolation: 'arc' })
    expect(migrated.paths[0]?.points).toHaveLength(16)
  })

  it('converts waves into ordered open ping-pong traces', () => {
    const source = fixture('wave', 'Scanner Wave')
    const migrated = planFor(source, targets([[0.8, 0.4], [0.2, 0.6], [0.5, 0.25]]), 'scannerWave')
    expect(migrated.paths[0]).toMatchObject({ conversionKind: 'wave', closed: false, repeatMode: 'pingPong' })
    expect(migrated.paths[0]?.points.map(candidate => candidate.position.x)).toEqual([0.2, 0.5, 0.8])
  })

  it('converts fans into one ordered angular sweep', () => {
    const source = fixture('fan', 'Wide Fan')
    const migrated = planFor(source, targets([[0.8, 0.7], [0.2, 0.7], [0.5, 0.9]]), 'fan')
    expect(migrated.paths[0]).toMatchObject({ conversionKind: 'fan', closed: false, repeatMode: 'pingPong' })
    expect(migrated.heads).toHaveLength(1)
  })

  it('keeps bursts as rapid radial scans unless an explicit prism is active', () => {
    const radialTargets = targets([[0.8, 0.5], [0.5, 0.8], [0.2, 0.5], [0.5, 0.2]])
    const plain = planFor(fixture('burst-plain', 'Aperture Burst'), radialTargets, 'apertureBurst')
    const diffractedFixture = fixture('burst-prism', 'Aperture Burst')
    diffractedFixture.optics.prismFacets = 3
    const diffracted = planFor(diffractedFixture, radialTargets, 'apertureBurst')
    expect(plain.paths[0]?.conversionKind).toBe('burst-scan')
    expect(plain.opticalCopies).toHaveLength(0)
    expect(diffracted.paths[0]?.conversionKind).toBe('burst-diffraction')
    expect(diffracted.opticalCopies).toHaveLength(2)
  })

  it('creates one instantaneous physical ray per scanner head while exposure integrates the path', () => {
    const migrated = planFor(fixture('single-head', 'Wide Fan'), targets([[0.2, 0.8], [0.5, 0.9], [0.8, 0.8]]), 'fan')
    const solved = solveLaserDmxScannerExposure({
      ...migrated,
      originByFixtureId: new Map([['single-head', ORIGIN]]),
      audioTimeSec: 2,
      bpm: 150,
      quality: 'high',
    })
    expect(solved.instantaneousRays).toHaveLength(1)
    expect(solved.exposureSamples.length).toBeGreaterThan(1)
    expect(solved.instantaneousRays[0]?.opticalCopyIndex).toBe(0)
  })

  it('supports several explicit scanner heads without inventing rays from target count', () => {
    const left = planFor(fixture('left', 'Left Fan'), targets([[0.1, 0.8], [0.35, 0.75]]), 'fan')
    const right = planFor(fixture('right', 'Right Fan'), targets([[0.65, 0.75], [0.9, 0.8]]), 'fan')
    const solved = solveLaserDmxScannerExposure({
      heads: [...left.heads, ...right.heads],
      paths: [...left.paths, ...right.paths],
      opticalCopies: [],
      originByFixtureId: new Map([['left', { x: 0.25, y: 0.1, z: 0 }], ['right', { x: 0.75, y: 0.1, z: 0 }]]),
      audioTimeSec: 1,
      bpm: 150,
      quality: 'medium',
    })
    expect(solved.instantaneousRays.map(ray => ray.fixtureId)).toEqual(['left', 'right'])
  })

  it('enforces velocity and acceleration lower bounds on travel time', () => {
    const slowHead = head({ maximumAngularVelocity: 90, maximumAngularAcceleration: 90, scanRatePps: 100000 })
    const travel = resolveLaserDmxScannerTravelDurationSeconds(
      slowHead,
      point('a', 0, 0),
      point('b', 1, 0),
    )
    expect(travel.durationSec).toBeGreaterThanOrEqual(2)
    expect(travel.velocityRatio).toBeLessThanOrEqual(1)
  })

  it('adds point and corner dwell without requiring mutable frame history', () => {
    const scanner = head({ pointDwellMicros: 200, cornerDwellMicros: 800 })
    const scanPath = path([
      point('a', 0.2, 0.2, { dwellMicros: 500 }),
      point('b', 0.8, 0.2, { cornerBehavior: 'dwell' }),
      point('c', 0.8, 0.8),
    ], { closed: true })
    const timeline = buildLaserDmxScannerTimelineDiagnostics(scanner, scanPath, 150)
    const dwells = timeline.events.filter(event => event.kind === 'dwell')
    expect(dwells).toHaveLength(3)
    expect((dwells[0]?.endSec ?? 0) - (dwells[0]?.startSec ?? 0)).toBeGreaterThanOrEqual(0.0005)
    expect((dwells[1]?.endSec ?? 0) - (dwells[1]?.startSec ?? 0)).toBeGreaterThan(0.0002)
  })

  it('blanks open-path retrace and explicit disconnected jumps', () => {
    const scanner = head()
    const open = path([point('a', 0.2, 0.2), point('b', 0.8, 0.8)], { repeatMode: 'loop' })
    const timeline = buildLaserDmxScannerTimelineDiagnostics(scanner, open, 150)
    expect(timeline.events[timeline.events.length - 1]).toMatchObject({ kind: 'travel', blanked: true })

    const source = fixture('disconnected', 'Disconnected Targets')
    source.beam.targetMode = 'fixed'
    const migrated = planFor(source, targets([[0.1, 0.2], [0.15, 0.2], [0.2, 0.2], [0.9, 0.9]]), 'parallelBank')
    expect(migrated.paths[0]?.points.some(candidate => candidate.blanked)).toBe(true)
  })

  it('retains zero-energy blank markers so renderers can break retrace topology', () => {
    const scanner = head({ shutterExposureSeconds: 1 / 12, scanRatePps: 100 })
    const scanPath = path([
      point('a', 0.2, 0.2),
      point('blank', 0.8, 0.8, { blanked: true, cornerBehavior: 'blank', intensity: 0 }),
      point('b', 0.2, 0.8),
    ])
    const solved = solveLaserDmxScannerExposure({
      heads: [scanner], paths: [scanPath], opticalCopies: [],
      originByFixtureId: new Map([['laser', ORIGIN]]), audioTimeSec: 0.05, bpm: 150, quality: 'ultra',
    })
    expect(solved.blankedSampleCount).toBeGreaterThan(0)
    const blanked = solved.exposureSamples.filter(sample => sample.blanked)
    expect(blanked.length).toBeGreaterThan(0)
    expect(blanked.every(sample => sample.exposureWeight === 0 && sample.intensity === 0)).toBe(true)
  })

  it('concentrates held-point exposure and spreads fast scan exposure across space', () => {
    const scanner = head({ shutterExposureSeconds: 1 / 30 })
    const held = path([point('held', 0.5, 0.8, { dwellMicros: 1000 })])
    const moving = path([point('a', 0.2, 0.8), point('b', 0.8, 0.8)], { repeatMode: 'pingPong' })
    const originByFixtureId = new Map([['laser', ORIGIN]])
    const heldSolved = solveLaserDmxScannerExposure({ heads: [scanner], paths: [held], opticalCopies: [], originByFixtureId, audioTimeSec: 1, bpm: 150, quality: 'ultra' })
    const movingSolved = solveLaserDmxScannerExposure({ heads: [scanner], paths: [moving], opticalCopies: [], originByFixtureId, audioTimeSec: 1, bpm: 150, quality: 'ultra' })
    expect(Math.max(...roundedSpatialWeights(heldSolved.exposureSamples))).toBeCloseTo(1, 6)
    expect(Math.max(...roundedSpatialWeights(movingSolved.exposureSamples))).toBeLessThan(1)
  })

  it('scales bounded exposure samples by quality without changing the authored path', () => {
    const migrated = planFor(fixture('quality', 'Wide Fan'), targets([[0.2, 0.8], [0.5, 0.9], [0.8, 0.8]]), 'fan')
    const common = {
      ...migrated,
      originByFixtureId: new Map([['quality', ORIGIN]]),
      audioTimeSec: 2,
      bpm: 150,
    }
    const low = solveLaserDmxScannerExposure({ ...common, quality: 'low' })
    const ultra = solveLaserDmxScannerExposure({ ...common, quality: 'ultra' })
    expect(low.exposureSamples).toHaveLength(4)
    expect(ultra.exposureSamples).toHaveLength(28)
    expect(migrated.paths[0]?.points).toHaveLength(3)
  })

  it('reveals a more localized moving beam at low scan rates than high scan rates', () => {
    const scanPath = path([point('a', 0.1, 0.8), point('b', 0.9, 0.8)], { repeatMode: 'pingPong' })
    const originByFixtureId = new Map([['laser', ORIGIN]])
    const low = solveLaserDmxScannerExposure({ heads: [head({ scanRatePps: 60 })], paths: [scanPath], opticalCopies: [], originByFixtureId, audioTimeSec: 0.5, bpm: 150, quality: 'ultra' })
    const high = solveLaserDmxScannerExposure({ heads: [head({ scanRatePps: 30000 })], paths: [scanPath], opticalCopies: [], originByFixtureId, audioTimeSec: 0.5, bpm: 150, quality: 'ultra' })
    expect(roundedSpatialWeights(low.exposureSamples).length).toBeLessThanOrEqual(roundedSpatialWeights(high.exposureSamples).length)
  })

  it('is deterministic for migration, direct seek reconstruction, loops, pause/resume, and repeated evaluation', () => {
    const source = fixture('deterministic', 'Circle Scanner')
    const firstPlan = planFor(source, targets([[0.5, 0.5]]), 'parallelBank')
    const secondPlan = planFor(structuredClone(source), targets([[0.5, 0.5]]), 'parallelBank')
    expect(secondPlan).toEqual(firstPlan)

    const input = {
      ...firstPlan,
      originByFixtureId: new Map([['deterministic', ORIGIN]]),
      audioTimeSec: 12.345,
      bpm: 150,
      quality: 'high' as const,
    }
    const direct = solveLaserDmxScannerExposure(input)
    const seeked = solveLaserDmxScannerExposure({ ...input, audioTimeSec: 4 })
    const reconstructed = solveLaserDmxScannerExposure(input)
    expect(reconstructed).toEqual(direct)
    expect(seeked).not.toEqual(direct)
    expect(solveLaserDmxScannerExposure(input)).toEqual(direct)
  })

  it('honors forward, reverse, alternating, ping-pong, and once traversal deterministically', () => {
    const scanner = head()
    const forwardPath = path([point('a', 0.1, 0.8), point('b', 0.9, 0.8)], { repeatMode: 'pingPong' })
    const reversePath = { ...forwardPath, id: 'reverse', scanDirection: 'reverse' as const }
    const forward = evaluateLaserDmxScannerAtTime(scanner, forwardPath, 0, 150)
    const reverse = evaluateLaserDmxScannerAtTime(scanner, reversePath, 0, 150)
    expect(forward?.target.x).toBeCloseTo(0.1, 4)
    expect(reverse?.target.x).toBeCloseTo(0.9, 4)

    const oncePath = { ...forwardPath, id: 'once', repeatMode: 'once' as const }
    const late = evaluateLaserDmxScannerAtTime(scanner, oncePath, 999, 150)
    expect(late?.target.x).toBeCloseTo(0.9, 4)
  })

  it('adds explicit prism copies without multiplying scanner heads or instantaneous base rays', () => {
    const source = fixture('prism', 'Prism Fan')
    source.optics.prismFacets = 5
    const migrated = planFor(source, targets([[0.2, 0.8], [0.8, 0.8]]), 'fan')
    const solved = solveLaserDmxScannerExposure({
      ...migrated,
      originByFixtureId: new Map([['prism', ORIGIN]]),
      audioTimeSec: 1,
      bpm: 150,
      quality: 'low',
    })
    expect(migrated.heads).toHaveLength(1)
    expect(migrated.opticalCopies).toHaveLength(4)
    expect(solved.instantaneousRays).toHaveLength(1)
    expect(new Set(solved.exposureSamples.map(sample => sample.opticalCopyIndex))).toEqual(new Set([0, 1, 2, 3, 4]))
  })

  it('migrates old projects non-destructively and leaves production Beam Matrix output compatible', () => {
    const raw = {
      schemaVersion: 4,
      groups: [],
      fixtures: [{
        id: 'legacy-laser', kind: 'laser', label: 'Legacy Fan', enabled: true,
        x: 2.5, y: 1.5, rotation: 0, color: '#4ac7db', colorMode: 'fixed', brightness: 0.9,
        beam: { beamEnabled: true, beamAngle: 0, beamSpread: 40, focus: 0.8, targetMode: 'fan', targetX: 10, targetY: 7 },
      }],
      selectedFixtureId: null,
      settings: { gridSize: { columns: 15, rows: 10 } },
    }
    const normalized = normalizeLaserDmxShowDirectorState(raw)
    const before = structuredClone(normalized)
    const matrixSettings = createDefaultLaserDmxBeamMatrixSettings()
    const matrixBefore = compileLaserDmxShowDirectorToBeamMatrix({ showDirector: normalized, beamMatrix: matrixSettings })
    const frame = createLaserDmxSceneFrame({
      showDirector: normalized,
      evaluatedBeamMatrix: matrixSettings,
      audioTimeSec: 5,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: true,
      trackKey: 'legacy-track',
      bpm: 150,
    })
    const matrixAfter = compileLaserDmxShowDirectorToBeamMatrix({ showDirector: normalized, beamMatrix: matrixSettings })
    expect(frame.scannerHeads).toHaveLength(1)
    expect(frame.scanPaths[0]?.compatibilityMode).toBe('legacy-converted')
    expect(frame.legacyCompatibilityBeamIds.length).toBe(frame.beams.length)
    expect(matrixAfter).toEqual(matrixBefore)
    expect(normalized).toEqual(before)
  })

  it('reconstructs the same scanner state across track, preset, renderer, and context reset boundaries', () => {
    const showDirector = createDefaultLaserDmxShowDirectorState()
    const source = fixture('reset-laser', 'Reset Circle')
    source.beam.targetMode = 'fixed'
    source.beam.targets = [{ id: 'circle-anchor', x: 7, y: 5 }]
    showDirector.fixtures = [source]
    const matrix = createDefaultLaserDmxBeamMatrixSettings()
    const makeFrame = (trackKey: string, timingDiscontinuity: boolean, rendererMode: 'webgl' | 'canvas2d') => {
      showDirector.settings.rendererMode = rendererMode
      return createLaserDmxSceneFrame({
        showDirector,
        evaluatedBeamMatrix: matrix,
        audioTimeSec: 8.25,
        deltaTimeSec: 1 / 60,
        isPlaying: true,
        timingDiscontinuity,
        trackKey,
        occurrenceSeed: 3,
        bpm: 150,
      })
    }
    const baseline = makeFrame('track-a', false, 'webgl')
    const reset = makeFrame('track-b', true, 'canvas2d')
    expect(reset.scannerInstantaneousRays).toEqual(baseline.scannerInstantaneousRays)
    expect(reset.exposureSamples).toEqual(baseline.exposureSamples)
    expect(reset.scanPaths).toEqual(baseline.scanPaths)
  })
})
