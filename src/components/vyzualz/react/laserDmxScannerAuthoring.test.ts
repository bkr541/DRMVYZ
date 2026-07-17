import { describe, expect, it } from 'vitest'
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxShowDirectorFixture,
  createDefaultLaserDmxShowDirectorState,
  normalizeLaserDmxShowDirectorState,
} from './ReactTypes'
import {
  LASER_DMX_SCANNER_PATTERN_OPTIONS,
  applyLaserDmxScannerRuntimeOverrides,
  createLaserDmxScannerDiagnosticsSummary,
  createLaserDmxScannerPattern,
  insertLaserDmxScannerPoint,
  previewLaserDmxLegacyScannerMigration,
  removeLaserDmxScannerPoint,
  reorderLaserDmxScannerPoint,
  reverseLaserDmxScannerPath,
  scannerPointsToBeamTargets,
  updateLaserDmxScannerPoint,
  updateLaserDmxScannerPatternGeometry,
  validateLaserDmxScannerConfig,
} from './laserDmxScannerAuthoring'
import { createLaserDmxSceneFrame } from './renderers/laserDmx/LaserDmxSceneFrame'

const GRID = { columns: 15, rows: 10 }

function fixture(id = 'scanner-fixture') {
  const result = createDefaultLaserDmxShowDirectorFixture('laser', id, 0)
  result.x = 7
  result.y = 1
  result.beam.targetX = 7
  result.beam.targetY = 6
  result.beam.targets = [
    { id: `${id}-a`, x: 3, y: 7 },
    { id: `${id}-b`, x: 7, y: 3 },
    { id: `${id}-c`, x: 11, y: 7 },
  ]
  return result
}

describe('LaserDMX scanner authoring', () => {
  it('creates every approachable pattern as an ordered path', () => {
    const source = fixture()
    expect(LASER_DMX_SCANNER_PATTERN_OPTIONS).toHaveLength(15)
    for (const option of LASER_DMX_SCANNER_PATTERN_OPTIONS) {
      const scanner = createLaserDmxScannerPattern(source, option.value, GRID)
      expect(scanner.patternType).toBe(option.value)
      expect(scanner.path.points.length).toBeGreaterThan(0)
      expect(new Set(scanner.path.points.map(point => point.id)).size).toBe(scanner.path.points.length)
    }
  })

  it('uses physical pattern semantics for hold, line, fan, circle, polygon, wave, tunnel, and corridor', () => {
    const source = fixture()
    expect(createLaserDmxScannerPattern(source, 'holdBeam', GRID).path.points).toHaveLength(1)
    expect(createLaserDmxScannerPattern(source, 'lineSweep', GRID).path).toMatchObject({ closed: false, repeatMode: 'pingPong' })
    expect(createLaserDmxScannerPattern(source, 'fanSweep', GRID).path.points).toHaveLength(3)
    expect(createLaserDmxScannerPattern(source, 'circle', GRID).path).toMatchObject({ closed: true, interpolation: 'arc' })
    expect(createLaserDmxScannerPattern(source, 'polygon', GRID).path.closed).toBe(true)
    expect(createLaserDmxScannerPattern(source, 'wave', GRID).path).toMatchObject({ closed: false, interpolation: 'bezier' })
    expect(new Set(createLaserDmxScannerPattern(source, 'tunnel', GRID).path.points.map(point => point.depthLayer)).size).toBeGreaterThan(1)
    expect(createLaserDmxScannerPattern(source, 'mirroredCorridor', GRID).path.points).toHaveLength(6)
  })

  it('maps diffraction patterns to explicit optics rather than target spokes', () => {
    const source = fixture()
    expect(createLaserDmxScannerPattern(source, 'diffractionLine', GRID).optics.mode).toBe('lineDiffraction')
    expect(createLaserDmxScannerPattern(source, 'diffractionGrid', GRID).optics.mode).toBe('gridDiffraction')
    expect(createLaserDmxScannerPattern(source, 'diffractionBurst', GRID).optics.mode).toBe('burstDiffraction')
  })

  it('supports point insertion, movement, blanking, dwell, removal, and reordering immutably', () => {
    const source = fixture()
    const initial = createLaserDmxScannerPattern(source, 'customPath', GRID)
    const inserted = insertLaserDmxScannerPoint(initial, source.id, 0)
    const insertedPoint = inserted.path.points[1]!
    const edited = updateLaserDmxScannerPoint(inserted, insertedPoint.id, { x: 4.5, y: 5.5, blanked: true, dwellMicros: 900 })
    const reordered = reorderLaserDmxScannerPoint(edited, insertedPoint.id, 1)
    const removed = removeLaserDmxScannerPoint(reordered, insertedPoint.id)
    expect(initial.path.points).toHaveLength(3)
    expect(inserted.path.points).toHaveLength(4)
    expect(edited.path.points.find(point => point.id === insertedPoint.id)).toMatchObject({ x: 4.5, y: 5.5, blanked: true, dwellMicros: 900 })
    expect(reordered.path.points.findIndex(point => point.id === insertedPoint.id)).toBe(2)
    expect(removed.path.points).toHaveLength(3)
  })

  it('reverses ordered paths while retaining deterministic metadata', () => {
    const scanner = createLaserDmxScannerPattern(fixture(), 'wave', GRID)
    const first = scanner.path.points[0]!.id
    const reversed = reverseLaserDmxScannerPath(scanner)
    expect(reversed.path.points[reversed.path.points.length - 1]?.id).toBe(first)
    expect(reversed.reversePath).toBe(true)
    expect(scanner.reversePath).toBe(false)
  })

  it('persists scanner fields and does not persist transient runtime overrides', () => {
    const source = fixture()
    source.scanner = createLaserDmxScannerPattern(source, 'circle', GRID)
    source.runtimeScanner = { scanRatePps: 9000, reversePath: true }
    const normalized = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      fixtures: [source],
    })
    expect(normalized.fixtures[0]?.scanner?.patternType).toBe('circle')
    expect(normalized.fixtures[0]?.runtimeScanner).toBeUndefined()
    expect(normalized.fixtures[0]?.scanner?.path.points).toHaveLength(12)
  })

  it('keeps legacy projects readable without silently adding scanner data', () => {
    const source = fixture()
    const normalized = normalizeLaserDmxShowDirectorState({
      ...createDefaultLaserDmxShowDirectorState(),
      fixtures: [source],
    })
    expect(normalized.fixtures[0]?.scanner).toBeUndefined()
    expect(normalized.fixtures[0]?.beam.targets).toHaveLength(3)
  })

  it('previews and applies known legacy classifications non-destructively', () => {
    const source = fixture()
    source.beam.targets = [{ id: 'a', x: 2, y: 5 }, { id: 'b', x: 12, y: 5 }]
    const before = structuredClone(source)
    const preview = previewLaserDmxLegacyScannerMigration(source, GRID)
    expect(preview.classification).toBe('lineSweep')
    expect(preview.scanner.migration.status).toBe('previewed')
    expect(preview.scanner.migration.backupTargets).toEqual(source.beam.targets)
    expect(source).toEqual(before)
  })

  it('marks ambiguous networks and inserts blanked retrace travel', () => {
    const source = fixture()
    source.beam.targetMode = 'fixed'
    source.beam.targets = [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 2, y: 1 },
      { id: 'c', x: 13, y: 8 },
      { id: 'd', x: 12, y: 8 },
    ]
    const preview = previewLaserDmxLegacyScannerMigration(source, GRID)
    expect(preview.ambiguous).toBe(true)
    expect(preview.blankedSegmentCount).toBeGreaterThan(0)
  })

  it('does not infer diffraction from arbitrary radial targets without explicit fixture semantics', () => {
    const source = fixture()
    source.optics.primitiveType = 'apertureBurst'
    source.optics.prismFacets = 1
    source.optics.diffractionMode = 'none'
    source.beam.targets = [
      { id: 'a', x: 7, y: 2 }, { id: 'b', x: 12, y: 5 },
      { id: 'c', x: 7, y: 8 }, { id: 'd', x: 2, y: 5 },
    ]
    const preview = previewLaserDmxLegacyScannerMigration(source, GRID)
    expect(preview.classification).not.toMatch(/^diffraction/)
    expect(preview.warnings.join(' ')).toMatch(/ordered perimeter scan/i)
  })

  it('warns about single-aperture multi-ray, empty visible paths, unsafe dwell, timing, depth, and bounds', () => {
    const source = fixture()
    const scanner = createLaserDmxScannerPattern(source, 'customPath', GRID)
    scanner.optics.mode = 'normal'
    scanner.optics.copyCount = 5
    scanner.scanRatePps = 100_000
    scanner.advanced.maximumVelocity = 100
    scanner.advanced.maximumAcceleration = 100
    scanner.path.points = [{ ...scanner.path.points[0]!, x: -5, z: 2, blanked: true, dwellMicros: 500_000 }]
    const codes = validateLaserDmxScannerConfig(source, scanner, GRID).map(issue => issue.code)
    expect(codes).toEqual(expect.arrayContaining([
      'no-visible-segments',
      'point-outside-bounds',
      'invalid-depth',
      'excessive-dwell',
      'impossible-timing',
      'acceleration-limit',
      'single-aperture-multi-ray',
    ]))
  })

  it('accepts synchronized Canvas2D compatibility targets but warns about stale duplicate legacy geometry', () => {
    const source = fixture()
    const scanner = createLaserDmxScannerPattern(source, 'polygon', GRID)
    source.beam.targets = scannerPointsToBeamTargets(scanner)
    expect(validateLaserDmxScannerConfig(source, scanner, GRID).map(issue => issue.code)).not.toContain('duplicate-legacy-rendering')
    source.beam.targets[0] = { ...source.beam.targets[0]!, x: source.beam.targets[0]!.x + 1 }
    expect(validateLaserDmxScannerConfig(source, scanner, GRID).map(issue => issue.code)).toContain('duplicate-legacy-rendering')
  })

  it('applies high-level Track Map and Performance Program scanner overrides deterministically', () => {
    const source = fixture()
    const scanner = createLaserDmxScannerPattern(source, 'fanSweep', GRID)
    const overrides = {
      patternType: 'circle' as const,
      scanRatePps: 18_000,
      direction: 'reverse' as const,
      reversePath: true,
      phase: 0.25,
      depthLayer: 'deepAir' as const,
      retraceBlanking: false,
      opticalMode: 'prism' as const,
      opticalCopyCount: 5,
      shutterClosed: true,
      pathResetToken: 7,
      switchBoundary: 'bar' as const,
    }
    expect(applyLaserDmxScannerRuntimeOverrides(scanner, overrides)).toEqual(applyLaserDmxScannerRuntimeOverrides(scanner, overrides))
    expect(applyLaserDmxScannerRuntimeOverrides(scanner, overrides)).toMatchObject({
      patternType: 'circle', scanRatePps: 18_000, direction: 'reverse', reversePath: true,
      phase: 0.25, depthLayer: 'deepAir', shutterClosed: true, pathResetToken: 7,
      path: { retraceBlanking: false }, optics: { mode: 'prism', copyCount: 5 },
    })
    const rebuilt = applyLaserDmxScannerRuntimeOverrides(scanner, overrides, { fixture: source, bounds: GRID })
    expect(rebuilt.path.points).toHaveLength(12)
    expect(rebuilt.path.closed).toBe(true)
  })

  it('rebuilds authored geometry when size, radius, or fan width changes', () => {
    const source = fixture()
    const fan = createLaserDmxScannerPattern(source, 'fanSweep', GRID)
    const originalSpan = fan.path.points[fan.path.points.length - 1]!.x - fan.path.points[0]!.x
    const wider = updateLaserDmxScannerPatternGeometry(fan, source, GRID, { fanWidth: 104 })
    expect(wider.path.points[wider.path.points.length - 1]!.x - wider.path.points[0]!.x).toBeGreaterThan(originalSpan)

    const circle = createLaserDmxScannerPattern(source, 'circle', GRID)
    const originalRadius = Math.abs(circle.path.points[0]!.y - source.beam.targetY!)
    const larger = updateLaserDmxScannerPatternGeometry(circle, source, GRID, { radius: 0.4 })
    expect(Math.abs(larger.path.points[0]!.y - source.beam.targetY!)).toBeGreaterThan(originalRadius)
  })

  it('feeds authored paths into the scanner-sample scene frame and remains Canvas2D compatible', () => {
    const source = fixture('authored-scene')
    source.scanner = createLaserDmxScannerPattern(source, 'circle', GRID)
    source.beam.targets = scannerPointsToBeamTargets(source.scanner)
    const showDirector = createDefaultLaserDmxShowDirectorState()
    showDirector.fixtures = [source]
    showDirector.settings.rendererMode = 'canvas2d'
    const frame = createLaserDmxSceneFrame({
      showDirector,
      evaluatedBeamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 8.25,
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      timingDiscontinuity: true,
      trackKey: 'authored-track',
      occurrenceSeed: 2,
      bpm: 150,
    })
    expect(frame.scanPaths[0]).toMatchObject({ compatibilityMode: 'native', conversionKind: 'native', closed: true })
    expect(frame.scanPaths[0]?.points).toHaveLength(12)
    expect(frame.scannerDiagnostics.compatibilityMode).toBe('native')
    expect(frame.scannerInstantaneousRays).toHaveLength(1)
  })

  it('reports concise authoring diagnostics', () => {
    const source = fixture()
    const scanner = createLaserDmxScannerPattern(source, 'polygon', GRID)
    scanner.path.points[1]!.blanked = true
    const diagnostics = createLaserDmxScannerDiagnosticsSummary(source, scanner, GRID)
    expect(diagnostics).toMatchObject({ activePattern: 'polygon', pointCount: 6, blankedSegmentCount: 1, opticalCopyCount: 1, apertureCount: 1 })
  })
})
