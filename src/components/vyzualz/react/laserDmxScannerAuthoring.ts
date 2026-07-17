import type {
  LaserDmxShowDirectorBeamTarget,
  LaserDmxShowDirectorDepthLayer,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorScannerConfig,
  LaserDmxShowDirectorScannerOpticalMode,
  LaserDmxShowDirectorScannerPathPoint,
  LaserDmxShowDirectorScannerPatternType,
  LaserDmxShowDirectorScannerRuntimeOverrides,
} from './ReactTypes'

export const LASER_DMX_SCANNER_AUTHORING_VERSION = 1

export const LASER_DMX_SCANNER_PATTERN_OPTIONS: Array<{ value: LaserDmxShowDirectorScannerPatternType; label: string }> = [
  { value: 'holdBeam', label: 'Hold Beam' },
  { value: 'lineSweep', label: 'Line Sweep' },
  { value: 'fanSweep', label: 'Fan Sweep' },
  { value: 'circle', label: 'Circle' },
  { value: 'arc', label: 'Arc' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'wave', label: 'Wave' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'mirroredCorridor', label: 'Mirrored Corridor' },
  { value: 'gridScan', label: 'Grid Scan' },
  { value: 'customPath', label: 'Custom Path' },
  { value: 'diffractionLine', label: 'Diffraction Line' },
  { value: 'diffractionGrid', label: 'Diffraction Grid' },
  { value: 'diffractionBurst', label: 'Diffraction Burst' },
]

export type LaserDmxScannerValidationSeverity = 'warning' | 'error'

export interface LaserDmxScannerValidationIssue {
  code: string
  severity: LaserDmxScannerValidationSeverity
  message: string
  pointId?: string
}

export interface LaserDmxScannerMigrationPreview {
  scanner: LaserDmxShowDirectorScannerConfig
  classification: LaserDmxShowDirectorScannerPatternType
  confidence: number
  ambiguous: boolean
  warnings: string[]
  visibleSegmentCount: number
  blankedSegmentCount: number
}

export interface LaserDmxScannerDiagnosticsSummary {
  activePattern: LaserDmxShowDirectorScannerPatternType
  pointCount: number
  visibleSegmentCount: number
  blankedSegmentCount: number
  dwellTotalMicros: number
  opticalCopyCount: number
  apertureCount: number
  compatibilityMode: 'native' | 'legacy' | 'migrated'
  migrationStatus: LaserDmxShowDirectorScannerConfig['migration']['status']
  validationWarnings: string[]
}

export interface ScannerGridBounds {
  columns: number
  rows: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function pointId(fixtureId: string, index: number): string {
  return `${fixtureId}-scan-point-${index + 1}`
}

function targetToPoint(target: LaserDmxShowDirectorBeamTarget, fixtureId: string, index: number): LaserDmxShowDirectorScannerPathPoint {
  return {
    id: pointId(fixtureId, index),
    x: target.x,
    y: target.y,
    ...(target.z == null ? {} : { z: target.z }),
    ...(target.depthLayer == null ? {} : { depthLayer: target.depthLayer }),
    blanked: false,
    dwellMicros: 0,
  }
}

function makePoint(
  fixtureId: string,
  index: number,
  x: number,
  y: number,
  depthLayer?: LaserDmxShowDirectorDepthLayer,
): LaserDmxShowDirectorScannerPathPoint {
  return {
    id: pointId(fixtureId, index),
    x,
    y,
    ...(depthLayer && depthLayer !== 'auto' ? { depthLayer } : {}),
    blanked: false,
    dwellMicros: 0,
  }
}

function opticalModeForPattern(patternType: LaserDmxShowDirectorScannerPatternType): LaserDmxShowDirectorScannerOpticalMode {
  if (patternType === 'diffractionLine') return 'lineDiffraction'
  if (patternType === 'diffractionGrid') return 'gridDiffraction'
  if (patternType === 'diffractionBurst') return 'burstDiffraction'
  return 'normal'
}

function patternPoints(
  fixture: LaserDmxShowDirectorFixture,
  patternType: LaserDmxShowDirectorScannerPatternType,
  bounds: ScannerGridBounds,
  geometry: Pick<LaserDmxShowDirectorScannerConfig, 'size' | 'fanWidth' | 'radius'> = {
    size: 0.5,
    fanWidth: fixture.optics.fanWidth || 52,
    radius: 0.24,
  },
): LaserDmxShowDirectorScannerPathPoint[] {
  const maxX = Math.max(1, bounds.columns - 1)
  const maxY = Math.max(1, bounds.rows - 1)
  const cx = clamp(fixture.beam.targetX ?? maxX * 0.5, 0, maxX)
  const cy = clamp(fixture.beam.targetY ?? maxY * 0.58, 0, maxY)
  const baseExtent = Math.max(1, Math.min(maxX, maxY) * 0.22)
  const sizeExtent = baseExtent * clamp(geometry.size / 0.5, 0.12, 2.4)
  const radialExtent = baseExtent * clamp(geometry.radius / 0.24, 0.12, 2.4)
  const fanExtent = baseExtent * clamp(geometry.fanWidth / 52, 0.08, 3.2)
  const radiusX = patternType === 'fanSweep'
    ? fanExtent
    : patternType === 'circle' || patternType === 'arc' || patternType === 'triangle' || patternType === 'polygon' || patternType === 'diffractionBurst'
      ? radialExtent
      : sizeExtent
  const radiusY = Math.max(0.5, radiusX * 0.72)
  const p = (index: number, x: number, y: number, depthLayer?: LaserDmxShowDirectorDepthLayer) => makePoint(
    fixture.id,
    index,
    clamp(x, 0, maxX),
    clamp(y, 0, maxY),
    depthLayer,
  )

  switch (patternType) {
    case 'holdBeam':
      return [p(0, cx, cy)]
    case 'lineSweep':
    case 'diffractionLine':
      return [p(0, cx - radiusX, cy), p(1, cx + radiusX, cy)]
    case 'fanSweep':
      return [p(0, cx - radiusX, cy + radiusY * 0.45), p(1, cx, cy - radiusY * 0.45), p(2, cx + radiusX, cy + radiusY * 0.45)]
    case 'arc':
      return Array.from({ length: 7 }, (_, index) => {
        const angle = Math.PI + (Math.PI * index) / 6
        return p(index, cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY)
      })
    case 'circle':
    case 'diffractionBurst':
      return Array.from({ length: 12 }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 12
        return p(index, cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY)
      })
    case 'triangle':
      return [p(0, cx, cy - radiusY), p(1, cx + radiusX, cy + radiusY), p(2, cx - radiusX, cy + radiusY)]
    case 'polygon':
      return Array.from({ length: 6 }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6
        return p(index, cx + Math.cos(angle) * radiusX, cy + Math.sin(angle) * radiusY)
      })
    case 'wave':
      return Array.from({ length: 9 }, (_, index) => {
        const t = index / 8
        return p(index, cx - radiusX + radiusX * 2 * t, cy + Math.sin(t * Math.PI * 2) * radiusY * 0.65)
      })
    case 'tunnel':
      return [
        p(0, cx - radiusX, cy + radiusY, 'frontAir'),
        p(1, cx - radiusX * 0.5, cy + radiusY * 0.5, 'midAir'),
        p(2, cx, cy, 'deepAir'),
        p(3, cx + radiusX * 0.5, cy + radiusY * 0.5, 'midAir'),
        p(4, cx + radiusX, cy + radiusY, 'frontAir'),
      ]
    case 'mirroredCorridor':
      return [
        p(0, cx - radiusX, cy + radiusY, 'frontAir'),
        p(1, cx - radiusX * 0.45, cy, 'midAir'),
        p(2, cx - radiusX * 0.2, cy - radiusY, 'deepAir'),
        p(3, cx + radiusX * 0.2, cy - radiusY, 'deepAir'),
        p(4, cx + radiusX * 0.45, cy, 'midAir'),
        p(5, cx + radiusX, cy + radiusY, 'frontAir'),
      ]
    case 'gridScan':
    case 'diffractionGrid': {
      const points: LaserDmxShowDirectorScannerPathPoint[] = []
      for (let row = 0; row < 3; row += 1) {
        const y = cy - radiusY + row * radiusY
        const xA = cx - radiusX
        const xB = cx + radiusX
        points.push(p(points.length, row % 2 === 0 ? xA : xB, y))
        points.push(p(points.length, row % 2 === 0 ? xB : xA, y))
      }
      return points
    }
    case 'customPath':
    default:
      return [p(0, cx - radiusX, cy), p(1, cx, cy - radiusY), p(2, cx + radiusX, cy)]
  }
}

export function createLaserDmxScannerPattern(
  fixture: LaserDmxShowDirectorFixture,
  patternType: LaserDmxShowDirectorScannerPatternType,
  bounds: ScannerGridBounds,
): LaserDmxShowDirectorScannerConfig {
  const opticalMode = opticalModeForPattern(patternType)
  const isClosed = patternType === 'circle' || patternType === 'triangle' || patternType === 'polygon' || patternType === 'diffractionBurst'
  const isPingPong = patternType === 'lineSweep' || patternType === 'fanSweep' || patternType === 'arc' || patternType === 'wave'
  const interpolation = patternType === 'circle' || patternType === 'arc' || patternType === 'fanSweep'
    ? 'arc'
    : patternType === 'wave'
      ? 'bezier'
      : 'linear'
  return {
    schemaVersion: 1,
    enabled: true,
    patternType,
    scanRatePps: 24_000,
    durationBeats: patternType === 'holdBeam' ? 1 : 0.5,
    direction: isPingPong ? 'alternating' : 'forward',
    reversePath: false,
    phase: 0,
    size: 0.5,
    fanWidth: fixture.optics.fanWidth || 52,
    radius: 0.24,
    depthLayer: fixture.beam.targetDepthLayer ?? fixture.depthLayer ?? 'auto',
    switchBoundary: 'bar',
    shutterClosed: false,
    pathResetToken: 0,
    path: {
      points: patternPoints(fixture, patternType, bounds, {
        size: 0.5,
        fanWidth: fixture.optics.fanWidth || 52,
        radius: 0.24,
      }),
      closed: isClosed,
      repeatMode: isPingPong ? 'pingPong' : 'loop',
      interpolation,
      retraceBlanking: true,
      blankingDelayMicros: 18,
      pointDwellMicros: patternType === 'holdBeam' ? 1_000 : 24,
      cornerDwellMicros: isClosed ? 64 : 36,
    },
    optics: {
      mode: opticalMode,
      copyCount: opticalMode === 'normal' ? 1 : opticalMode === 'gridDiffraction' ? 9 : 5,
      spreadDeg: opticalMode === 'normal' ? 0 : 8,
      apertureCount: 1,
    },
    advanced: {
      maximumVelocity: 18_000,
      maximumAcceleration: 1_200_000,
      shutterExposureSeconds: 1 / 60,
      calibrationProfileId: 'default',
    },
    migration: {
      status: 'native',
      version: 0,
      sourceTargetIds: [],
      ambiguous: false,
      warnings: [],
    },
  }
}

export function cloneLaserDmxScannerConfig(scanner: LaserDmxShowDirectorScannerConfig): LaserDmxShowDirectorScannerConfig {
  return {
    ...scanner,
    path: { ...scanner.path, points: scanner.path.points.map(point => ({ ...point })) },
    optics: { ...scanner.optics },
    advanced: { ...scanner.advanced },
    migration: {
      ...scanner.migration,
      sourceTargetIds: [...scanner.migration.sourceTargetIds],
      warnings: [...scanner.migration.warnings],
      ...(scanner.migration.backupTargets ? { backupTargets: scanner.migration.backupTargets.map(target => ({ ...target })) } : {}),
    },
  }
}

export function updateLaserDmxScannerPatternGeometry(
  scanner: LaserDmxShowDirectorScannerConfig,
  fixture: LaserDmxShowDirectorFixture,
  bounds: ScannerGridBounds,
  patch: Partial<Pick<LaserDmxShowDirectorScannerConfig, 'size' | 'fanWidth' | 'radius'>>,
): LaserDmxShowDirectorScannerConfig {
  const next = { ...cloneLaserDmxScannerConfig(scanner), ...patch }
  if (next.patternType === 'customPath') return next
  const previousPoints = scanner.path.points
  next.path.points = patternPoints(fixture, next.patternType, bounds, next).map((point, index) => {
    const previous = previousPoints[index]
    if (!previous) return point
    return {
      ...point,
      blanked: previous.blanked,
      dwellMicros: previous.dwellMicros,
      ...(previous.cornerDwellMicros == null ? {} : { cornerDwellMicros: previous.cornerDwellMicros }),
      ...(previous.intensity == null ? {} : { intensity: previous.intensity }),
      ...(previous.color == null ? {} : { color: previous.color }),
    }
  })
  return next
}

export function updateLaserDmxScannerPoint(
  scanner: LaserDmxShowDirectorScannerConfig,
  pointIdValue: string,
  patch: Partial<LaserDmxShowDirectorScannerPathPoint>,
): LaserDmxShowDirectorScannerConfig {
  return {
    ...cloneLaserDmxScannerConfig(scanner),
    patternType: scanner.patternType === 'customPath' ? scanner.patternType : 'customPath',
    path: {
      ...scanner.path,
      points: scanner.path.points.map(point => point.id === pointIdValue ? { ...point, ...patch, id: point.id } : { ...point }),
    },
  }
}

export function insertLaserDmxScannerPoint(
  scanner: LaserDmxShowDirectorScannerConfig,
  fixtureId: string,
  afterIndex = scanner.path.points.length - 1,
): LaserDmxShowDirectorScannerConfig {
  const points = scanner.path.points.map(point => ({ ...point }))
  const previous = points[Math.max(0, Math.min(afterIndex, points.length - 1))]
  const next = points[Math.min(points.length - 1, Math.max(0, afterIndex + 1))] ?? previous
  const newPoint = makePoint(
    fixtureId,
    points.length,
    previous && next ? (previous.x + next.x) / 2 : 0,
    previous && next ? (previous.y + next.y) / 2 : 0,
    previous?.depthLayer ?? scanner.depthLayer,
  )
  points.splice(Math.max(0, afterIndex + 1), 0, newPoint)
  return { ...cloneLaserDmxScannerConfig(scanner), patternType: 'customPath', path: { ...scanner.path, points } }
}

export function removeLaserDmxScannerPoint(scanner: LaserDmxShowDirectorScannerConfig, pointIdValue: string): LaserDmxShowDirectorScannerConfig {
  return {
    ...cloneLaserDmxScannerConfig(scanner),
    patternType: 'customPath',
    path: { ...scanner.path, points: scanner.path.points.filter(point => point.id !== pointIdValue) },
  }
}

export function reorderLaserDmxScannerPoint(
  scanner: LaserDmxShowDirectorScannerConfig,
  pointIdValue: string,
  offset: -1 | 1,
): LaserDmxShowDirectorScannerConfig {
  const points = scanner.path.points.map(point => ({ ...point }))
  const index = points.findIndex(point => point.id === pointIdValue)
  const targetIndex = index + offset
  if (index < 0 || targetIndex < 0 || targetIndex >= points.length) return cloneLaserDmxScannerConfig(scanner)
  const [point] = points.splice(index, 1)
  if (point) points.splice(targetIndex, 0, point)
  return { ...cloneLaserDmxScannerConfig(scanner), patternType: 'customPath', path: { ...scanner.path, points } }
}

export function reverseLaserDmxScannerPath(scanner: LaserDmxShowDirectorScannerConfig): LaserDmxShowDirectorScannerConfig {
  return {
    ...cloneLaserDmxScannerConfig(scanner),
    reversePath: !scanner.reversePath,
    path: { ...scanner.path, points: [...scanner.path.points].reverse().map(point => ({ ...point })) },
  }
}

export function scannerPointsToBeamTargets(scanner: LaserDmxShowDirectorScannerConfig): LaserDmxShowDirectorBeamTarget[] {
  return scanner.path.points.map(point => ({
    id: point.id,
    x: point.x,
    y: point.y,
    ...(point.z == null ? {} : { z: point.z }),
    ...(point.depthLayer == null ? {} : { depthLayer: point.depthLayer }),
  }))
}

function distance(a: LaserDmxShowDirectorBeamTarget, b: LaserDmxShowDirectorBeamTarget): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function polygonArea(targets: readonly LaserDmxShowDirectorBeamTarget[]): number {
  if (targets.length < 3) return 0
  return Math.abs(targets.reduce((sum, point, index) => {
    const next = targets[(index + 1) % targets.length]!
    return sum + point.x * next.y - next.x * point.y
  }, 0)) / 2
}

function legacyClassification(
  fixture: LaserDmxShowDirectorFixture,
  targets: readonly LaserDmxShowDirectorBeamTarget[],
): { pattern: LaserDmxShowDirectorScannerPatternType; confidence: number; ambiguous: boolean; warnings: string[] } {
  if (targets.length <= 1) return { pattern: 'holdBeam', confidence: 1, ambiguous: false, warnings: [] }
  if (targets.length === 2) return { pattern: 'lineSweep', confidence: 1, ambiguous: false, warnings: [] }
  const xs = targets.map(target => target.x)
  const ys = targets.map(target => target.y)
  const width = Math.max(...xs) - Math.min(...xs)
  const height = Math.max(...ys) - Math.min(...ys)
  const center = { x: xs.reduce((sum, value) => sum + value, 0) / targets.length, y: ys.reduce((sum, value) => sum + value, 0) / targets.length }
  const radii = targets.map(target => Math.hypot(target.x - center.x, target.y - center.y))
  const meanRadius = radii.reduce((sum, value) => sum + value, 0) / radii.length
  const radialVariance = meanRadius > 1e-6
    ? radii.reduce((sum, value) => sum + Math.abs(value - meanRadius), 0) / radii.length / meanRadius
    : 1
  const area = polygonArea(targets)
  const pathLength = targets.slice(1).reduce((sum, target, index) => sum + distance(targets[index]!, target), 0)
  const diagonal = Math.hypot(width, height)
  const hasExplicitDiffraction = fixture.optics.diffractionMode !== 'none' || fixture.optics.prismFacets > 1 || (fixture.optics.apertureCount ?? 1) > 1
  const spans = targets.slice(1).map((target, index) => distance(targets[index]!, target))
  const sortedSpans = [...spans].sort((a, b) => a - b)
  const medianSpan = sortedSpans[Math.floor(sortedSpans.length / 2)] ?? 0
  const longestSpan = Math.max(0, ...spans)
  if (medianSpan > 0 && longestSpan > Math.max(2, medianSpan * 3.2)) {
    return { pattern: 'customPath', confidence: 0.48, ambiguous: true, warnings: ['The legacy network contains disconnected target groups. Long travel is previewed as a blanked retrace.'] }
  }
  if (fixture.optics.primitiveType === 'apertureBurst' && !hasExplicitDiffraction) {
    return { pattern: 'circle', confidence: 0.64, ambiguous: true, warnings: ['Radial targets were converted to an ordered perimeter scan because no explicit diffraction or multi-aperture hardware is authored.'] }
  }
  if (fixture.beam.targetMode === 'mirror') return { pattern: 'mirroredCorridor', confidence: 0.86, ambiguous: false, warnings: [] }
  if (fixture.beam.targetMode === 'fan' || fixture.optics.primitiveType === 'fan' || fixture.optics.primitiveType === 'layeredFan') {
    return { pattern: 'fanSweep', confidence: 0.92, ambiguous: false, warnings: [] }
  }
  if (radialVariance < 0.18 && area > 0.08 * width * height) {
    if (fixture.optics.primitiveType === 'apertureBurst') {
      return hasExplicitDiffraction
        ? { pattern: 'diffractionBurst', confidence: 0.9, ambiguous: false, warnings: [] }
        : { pattern: 'polygon', confidence: 0.58, ambiguous: true, warnings: ['Radial targets were converted to an ordered perimeter scan because no explicit diffraction or multi-aperture hardware is authored.'] }
    }
    return { pattern: targets.length >= 8 ? 'circle' : 'polygon', confidence: 0.86, ambiguous: false, warnings: [] }
  }
  const alternating = targets.slice(2).filter((target, index) => {
    const previous = targets[index + 1]!
    const previousPrevious = targets[index]!
    return Math.sign(target.y - previous.y) !== Math.sign(previous.y - previousPrevious.y)
  }).length
  if (alternating >= Math.max(2, targets.length / 3) && width > height) return { pattern: 'wave', confidence: 0.78, ambiguous: false, warnings: [] }
  if (pathLength > diagonal * 4.2) return { pattern: 'gridScan', confidence: 0.62, ambiguous: true, warnings: ['The legacy network has long disconnected travel. Preview blanked retraces before applying migration.'] }
  return { pattern: 'customPath', confidence: 0.45, ambiguous: true, warnings: ['The legacy target order is ambiguous. Review point order and blanked retraces before applying migration.'] }
}

function insertLegacyBlanking(points: readonly LaserDmxShowDirectorScannerPathPoint[]): LaserDmxShowDirectorScannerPathPoint[] {
  if (points.length < 3) return points.map(point => ({ ...point }))
  const spans = points.slice(1).map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y))
  const sorted = [...spans].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  const threshold = Math.max(1.5, median * 3.2)
  return points.map((point, index) => ({ ...point, blanked: index > 0 && spans[index - 1]! > threshold }))
}

export function previewLaserDmxLegacyScannerMigration(
  fixture: LaserDmxShowDirectorFixture,
  bounds: ScannerGridBounds,
): LaserDmxScannerMigrationPreview {
  const legacyTargets = fixture.beam.targets?.length
    ? fixture.beam.targets.map(target => ({ ...target }))
    : [{ id: `${fixture.id}-target-1`, x: fixture.beam.targetX ?? bounds.columns / 2, y: fixture.beam.targetY ?? bounds.rows / 2 }]
  const classification = legacyClassification(fixture, legacyTargets)
  const scanner = createLaserDmxScannerPattern(fixture, classification.pattern, bounds)
  const orderedPoints = insertLegacyBlanking(legacyTargets.map((target, index) => targetToPoint(target, fixture.id, index)))
  scanner.patternType = classification.pattern
  scanner.path.points = orderedPoints
  scanner.path.closed = classification.pattern === 'circle' || classification.pattern === 'polygon' || classification.pattern === 'diffractionBurst'
  scanner.path.repeatMode = classification.pattern === 'lineSweep' || classification.pattern === 'fanSweep' || classification.pattern === 'wave' ? 'pingPong' : 'loop'
  scanner.path.interpolation = classification.pattern === 'circle' || classification.pattern === 'fanSweep' ? 'arc' : classification.pattern === 'wave' ? 'bezier' : 'linear'
  scanner.migration = {
    status: 'previewed',
    version: LASER_DMX_SCANNER_AUTHORING_VERSION,
    sourceTargetIds: legacyTargets.map(target => target.id),
    ambiguous: classification.ambiguous,
    warnings: [...classification.warnings],
    backupTargets: legacyTargets,
  }
  const segments = Math.max(0, orderedPoints.length - 1) + (scanner.path.closed && orderedPoints.length > 1 ? 1 : 0)
  const blankedSegmentCount = orderedPoints.slice(1).filter(point => point.blanked).length
  return {
    scanner,
    classification: classification.pattern,
    confidence: classification.confidence,
    ambiguous: classification.ambiguous,
    warnings: [...classification.warnings],
    visibleSegmentCount: Math.max(0, segments - blankedSegmentCount),
    blankedSegmentCount,
  }
}

export function applyLaserDmxScannerRuntimeOverrides(
  scanner: LaserDmxShowDirectorScannerConfig,
  overrides: LaserDmxShowDirectorScannerRuntimeOverrides | undefined,
  context?: { fixture: LaserDmxShowDirectorFixture; bounds: ScannerGridBounds },
): LaserDmxShowDirectorScannerConfig {
  if (!overrides) return cloneLaserDmxScannerConfig(scanner)
  const requestedPattern = overrides.patternType ?? scanner.patternType
  const patternChanged = requestedPattern !== scanner.patternType
  let next = patternChanged && context && requestedPattern !== 'customPath'
    ? (() => {
      const generated = createLaserDmxScannerPattern(context.fixture, requestedPattern, context.bounds)
      return {
        ...generated,
        scanRatePps: scanner.scanRatePps,
        durationBeats: scanner.durationBeats,
        phase: scanner.phase,
        size: scanner.size,
        fanWidth: scanner.fanWidth,
        radius: scanner.radius,
        depthLayer: scanner.depthLayer,
        shutterClosed: scanner.shutterClosed,
        pathResetToken: scanner.pathResetToken,
        advanced: { ...scanner.advanced },
        migration: cloneLaserDmxScannerConfig(scanner).migration,
      }
    })()
    : cloneLaserDmxScannerConfig(scanner)
  next.patternType = requestedPattern
  if (overrides.scanRatePps != null) next.scanRatePps = clamp(overrides.scanRatePps, 10, 100_000)
  if (overrides.durationBeats != null) next.durationBeats = clamp(overrides.durationBeats, 0.0625, 128)
  if (overrides.direction) next.direction = overrides.direction
  if (overrides.reversePath != null) next.reversePath = overrides.reversePath
  if (overrides.phase != null) next.phase = clamp01(overrides.phase)
  if (overrides.fanWidth != null) next.fanWidth = clamp(overrides.fanWidth, 0, 180)
  if (overrides.radius != null) next.radius = clamp01(overrides.radius)
  if (overrides.size != null) next.size = clamp01(overrides.size)
  if (overrides.depthLayer) next.depthLayer = overrides.depthLayer
  if (context && requestedPattern !== 'customPath' && (patternChanged || overrides.fanWidth != null || overrides.radius != null || overrides.size != null)) {
    next.path.points = patternPoints(context.fixture, requestedPattern, context.bounds, next)
  }
  if (overrides.retraceBlanking != null) next.path.retraceBlanking = overrides.retraceBlanking
  if (overrides.opticalMode) next.optics.mode = overrides.opticalMode
  if (overrides.opticalCopyCount != null) next.optics.copyCount = Math.round(clamp(overrides.opticalCopyCount, 1, 25))
  if (overrides.shutterClosed != null) next.shutterClosed = overrides.shutterClosed
  if (overrides.heldBeam) {
    next.patternType = 'holdBeam'
    if (context) next.path = createLaserDmxScannerPattern(context.fixture, 'holdBeam', context.bounds).path
  }
  if (overrides.pathResetToken != null) next.pathResetToken = Math.max(0, Math.round(overrides.pathResetToken))
  if (overrides.switchBoundary) next.switchBoundary = overrides.switchBoundary
  return next
}

export function validateLaserDmxScannerConfig(
  fixture: LaserDmxShowDirectorFixture,
  scanner: LaserDmxShowDirectorScannerConfig,
  bounds: ScannerGridBounds,
): LaserDmxScannerValidationIssue[] {
  const issues: LaserDmxScannerValidationIssue[] = []
  const points = scanner.path.points
  const visiblePoints = points.filter(point => !point.blanked)
  if (fixture.kind !== 'laser') issues.push({ code: 'unsupported-fixture', severity: 'error', message: 'Scanner paths are supported only by laser fixtures.' })
  if (points.length === 0) issues.push({ code: 'empty-path', severity: 'error', message: 'Scanner path requires at least one point.' })
  if (visiblePoints.length === 0) issues.push({ code: 'no-visible-segments', severity: 'error', message: 'Scanner path has no visible points or segments.' })
  if (scanner.path.closed && points.length < 3) issues.push({ code: 'closed-path-too-small', severity: 'error', message: 'Closed paths require at least three points.' })
  if (scanner.patternType === 'holdBeam' && visiblePoints.length > 1) issues.push({ code: 'held-multiple-rays', severity: 'warning', message: 'Hold Beam should contain one visible scanner position.' })
  const maxX = Math.max(1, bounds.columns - 1)
  const maxY = Math.max(1, bounds.rows - 1)
  points.forEach(point => {
    if (point.x < 0 || point.x > maxX || point.y < 0 || point.y > maxY) issues.push({ code: 'point-outside-bounds', severity: 'warning', message: 'A path point is outside the safe stage bounds.', pointId: point.id })
    if (point.z != null && (point.z < -1 || point.z > 1)) issues.push({ code: 'invalid-depth', severity: 'warning', message: 'A path point has an invalid depth assignment.', pointId: point.id })
    if (point.dwellMicros > 250_000) issues.push({ code: 'excessive-dwell', severity: 'warning', message: 'A point dwell exceeds 250 ms and may create a hazardous held beam.', pointId: point.id })
  })
  if (scanner.scanRatePps < 500) issues.push({ code: 'slow-scan-rate', severity: 'warning', message: 'Scan rate is unusually low for a moving scanner path.' })
  if (scanner.scanRatePps > scanner.advanced.maximumVelocity * 8) issues.push({ code: 'impossible-timing', severity: 'warning', message: 'Requested scan rate is not plausible for the configured maximum velocity.' })
  if (scanner.advanced.maximumAcceleration < scanner.advanced.maximumVelocity * 8) issues.push({ code: 'acceleration-limit', severity: 'warning', message: 'Maximum acceleration may be too low for this path timing.' })
  if (scanner.optics.copyCount < 1 || scanner.optics.copyCount > 25) issues.push({ code: 'invalid-copy-count', severity: 'error', message: 'Optical copy count must be between 1 and 25.' })
  if (scanner.optics.apertureCount < 1 || scanner.optics.apertureCount > 8) issues.push({ code: 'invalid-aperture-count', severity: 'error', message: 'Aperture count must be between 1 and 8.' })
  if (scanner.optics.mode === 'normal' && scanner.optics.copyCount > 1) issues.push({ code: 'single-aperture-multi-ray', severity: 'warning', message: 'A normal single-aperture scanner cannot emit several permanent rays. Select prism, diffraction, or supported multi-aperture hardware.' })
  if (scanner.optics.mode !== 'normal' && scanner.optics.copyCount === 1) issues.push({ code: 'optics-without-copies', severity: 'warning', message: 'The selected optical mode has only one output copy.' })
  if (scanner.optics.apertureCount > 1 && (fixture.optics.apertureCount ?? 1) <= 1) issues.push({ code: 'unsupported-aperture-count', severity: 'warning', message: 'Multiple apertures require a compatible multi-emitter fixture profile.' })
  const compatibilityTargets = scannerPointsToBeamTargets(scanner)
  const legacyTargetsAreSynchronized = fixture.beam.targets?.length === compatibilityTargets.length
    && fixture.beam.targets.every((target, index) => {
      const compatibility = compatibilityTargets[index]
      return compatibility != null
        && Math.abs(target.x - compatibility.x) < 1e-6
        && Math.abs(target.y - compatibility.y) < 1e-6
        && Math.abs((target.z ?? 0) - (compatibility.z ?? 0)) < 1e-6
        && (target.depthLayer ?? 'auto') === (compatibility.depthLayer ?? 'auto')
    })
  if (fixture.beam.targets && fixture.beam.targets.length > 1 && scanner.enabled && !legacyTargetsAreSynchronized) {
    issues.push({ code: 'duplicate-legacy-rendering', severity: 'warning', message: 'Legacy target endpoints do not match the authored scanner compatibility projection and could be rendered twice by an unsupported path.' })
  }
  const longVisibleTravel = points.slice(1).some((point, index) => {
    const previous = points[index]!
    const span = Math.hypot(point.x - previous.x, point.y - previous.y)
    return span > Math.hypot(maxX, maxY) * 0.6 && !point.blanked && !previous.blanked
  })
  if (longVisibleTravel && scanner.path.retraceBlanking) issues.push({ code: 'unblanked-disconnected-travel', severity: 'warning', message: 'A long disconnected move is visible. Mark the destination point blanked or disable the segment intentionally.' })
  return issues
}

export function createLaserDmxScannerDiagnosticsSummary(
  fixture: LaserDmxShowDirectorFixture,
  scanner: LaserDmxShowDirectorScannerConfig,
  bounds: ScannerGridBounds,
): LaserDmxScannerDiagnosticsSummary {
  const segmentCount = Math.max(0, scanner.path.points.length - 1) + (scanner.path.closed && scanner.path.points.length > 1 ? 1 : 0)
  const blankedSegmentCount = scanner.path.points.slice(1).filter(point => point.blanked).length
  const issues = validateLaserDmxScannerConfig(fixture, scanner, bounds)
  return {
    activePattern: scanner.patternType,
    pointCount: scanner.path.points.length,
    visibleSegmentCount: Math.max(0, segmentCount - blankedSegmentCount),
    blankedSegmentCount,
    dwellTotalMicros: scanner.path.points.reduce((sum, point) => sum + (point.dwellMicros || scanner.path.pointDwellMicros) + (point.cornerDwellMicros ?? scanner.path.cornerDwellMicros), 0),
    opticalCopyCount: scanner.optics.copyCount,
    apertureCount: scanner.optics.apertureCount,
    compatibilityMode: scanner.migration.status === 'migrated' ? 'migrated' : scanner.migration.status === 'legacy' || scanner.migration.status === 'previewed' ? 'legacy' : 'native',
    migrationStatus: scanner.migration.status,
    validationWarnings: issues.map(issue => issue.message),
  }
}
