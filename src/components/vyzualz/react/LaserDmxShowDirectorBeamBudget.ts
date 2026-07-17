import {
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorWebGLQuality,
} from './ReactTypes'
import type { LaserDmxShowDirectorBeamPriorityRole } from './LaserDmxShowDirectorPerformanceProgram'

export const LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER: Readonly<Record<LaserDmxShowDirectorBeamPriorityRole, number>> = Object.freeze({
  heroImpact: 0,
  primaryArchitecture: 1,
  secondaryFan: 2,
  decorativeAccent: 3,
  detailLattice: 4,
})

export interface LaserDmxFanDensityPolicy {
  quality: LaserDmxShowDirectorWebGLQuality
  heroLimit: number
  primaryLimit: number
  supportLimit: number
  textureLimit: number
  decorativeLimit: number
}

export const LASER_DMX_FAN_DENSITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxFanDensityPolicy>> = Object.freeze({
  low: { quality: 'low', heroLimit: 8, primaryLimit: 8, supportLimit: 6, textureLimit: 4, decorativeLimit: 4 },
  medium: { quality: 'medium', heroLimit: 12, primaryLimit: 12, supportLimit: 8, textureLimit: 6, decorativeLimit: 6 },
  high: { quality: 'high', heroLimit: 16, primaryLimit: 16, supportLimit: 10, textureLimit: 8, decorativeLimit: 8 },
  ultra: { quality: 'ultra', heroLimit: 24, primaryLimit: 20, supportLimit: 12, textureLimit: 10, decorativeLimit: 10 },
  // Auto compiles enough stable candidates for High. The adaptive WebGL plan
  // then thins support/texture sources first as the effective tier changes.
  auto: { quality: 'auto', heroLimit: 16, primaryLimit: 16, supportLimit: 10, textureLimit: 8, decorativeLimit: 8 },
})

const DEFAULT_ROLE_BY_KIND: Readonly<Record<LaserDmxShowDirectorFixtureKind, LaserDmxShowDirectorBeamPriorityRole>> = Object.freeze({
  laser: 'primaryArchitecture',
  movingHead: 'primaryArchitecture',
  ledBar: 'secondaryFan',
  ledTube: 'secondaryFan',
  strobe: 'heroImpact',
  blinder: 'heroImpact',
  parWash: 'secondaryFan',
  videoWall: 'detailLattice',
  haze: 'decorativeAccent',
  co2Jet: 'heroImpact',
})

const PROFESSIONAL_FAN_PRIMITIVES = new Set([
  'fan',
  'layeredFan',
  'parallelBank',
  'sheet',
  'tunnel',
  'mirroredCorridor',
  'canopy',
  'audienceRake',
  'apertureBurst',
])

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(finite(value, fallback))))
}

function roleLimit(policy: LaserDmxFanDensityPolicy, role: LaserDmxShowDirectorBeamPriorityRole): number {
  switch (role) {
    case 'heroImpact': return policy.heroLimit
    case 'primaryArchitecture': return policy.primaryLimit
    case 'secondaryFan': return policy.supportLimit
    case 'detailLattice': return policy.textureLimit
    case 'decorativeAccent': return policy.decorativeLimit
  }
}

function physicalScannerOutputDemand(fixture: LaserDmxShowDirectorFixture): number | null {
  const scanner = fixture.kind === 'laser' ? fixture.scanner : null
  if (!scanner?.enabled || (scanner.migration.status !== 'native' && scanner.migration.status !== 'migrated')) return null
  const runtimeMode = fixture.runtimeScanner?.opticalMode ?? scanner.optics.mode
  const requestedCopies = runtimeMode === 'normal'
    ? 1
    : fixture.runtimeScanner?.opticalCopyCount ?? scanner.optics.copyCount
  const apertureCount = positiveInt(scanner.optics.apertureCount, 1, 1, 8)
  return positiveInt(requestedCopies, 1, 1, 25) * apertureCount
}

function professionalFanCandidate(fixture: LaserDmxShowDirectorFixture): boolean {
  if (fixture.kind !== 'laser' || fixture.beam?.beamEnabled === false) return false
  const primitive = fixture.optics.primitiveType
  const semantic = `${fixture.semanticKey ?? ''} ${fixture.label}`.toLowerCase()
  const fanSemantic = /hero|fan|bank|sheet|tunnel|corridor|canopy|prism|spectral|festival/.test(semantic)
  const spread = Math.max(finite(fixture.optics.fanWidth, 0), finite(fixture.beam.beamSpread, 0))
  return (primitive !== 'auto' && PROFESSIONAL_FAN_PRIMITIVES.has(primitive))
    || (primitive === 'auto' && fixture.beam.targetMode === 'fan' && (spread >= 42 || fanSemantic))
}

function qualityFanDemand(
  fixture: LaserDmxShowDirectorFixture,
  role: LaserDmxShowDirectorBeamPriorityRole,
  quality: LaserDmxShowDirectorWebGLQuality,
  baseDemand: number,
): number {
  const policy = LASER_DMX_FAN_DENSITY_POLICIES[quality]
  const roleDensityLimit = roleLimit(policy, role)
  if (!professionalFanCandidate(fixture) || quality === 'low' || quality === 'medium') {
    return Math.min(baseDemand, roleDensityLimit)
  }
  // Layered banks already multiply visual structure across depth planes. Keep
  // each individual source somewhat leaner than a single-plane festival fan so
  // mirror cages and corridors gain detail without becoming lopsided light walls.
  const semantic = `${fixture.semanticKey ?? ''} ${fixture.label}`.toLowerCase()
  const constrainedMirrorLayer = /mirror|corridor|cage/.test(semantic)
    && ['layeredFan', 'tunnel', 'mirroredCorridor'].includes(fixture.optics.primitiveType)
  const primitiveDensityLimit = constrainedMirrorLayer
    ? quality === 'ultra' ? 16 : 12
    : roleDensityLimit
  const limit = Math.min(roleDensityLimit, primitiveDensityLimit)
  const spread = Math.max(finite(fixture.optics.fanWidth, 0), finite(fixture.beam.beamSpread, 0))
  const spreadDivisor = quality === 'ultra' ? 5.5 : 7
  const professionalDemand = Math.max(baseDemand, Math.round(spread / spreadDivisor) + 2)
  return Math.max(1, Math.min(limit, professionalDemand, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS))
}

export function resolveLaserDmxShowDirectorBeamPriorityRole(
  fixture: LaserDmxShowDirectorFixture,
  requestedRole?: LaserDmxShowDirectorBeamPriorityRole | null,
): LaserDmxShowDirectorBeamPriorityRole {
  return requestedRole && requestedRole in LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER
    ? requestedRole
    : DEFAULT_ROLE_BY_KIND[fixture.kind] ?? 'decorativeAccent'
}

export interface LaserDmxShowDirectorBeamDemandOptions {
  quality?: LaserDmxShowDirectorWebGLQuality
  role?: LaserDmxShowDirectorBeamPriorityRole | null
}

export function estimateLaserDmxShowDirectorFixtureBeamDemand(
  fixture: LaserDmxShowDirectorFixture,
  options: LaserDmxShowDirectorBeamDemandOptions = {},
): number {
  if (!fixture.enabled) return 0
  const beamEnabled = fixture.beam?.beamEnabled !== false
  const quality = options.quality ?? 'medium'
  const role = resolveLaserDmxShowDirectorBeamPriorityRole(fixture, options.role)
  const scannerDemand = physicalScannerOutputDemand(fixture)
  if (scannerDemand != null) return scannerDemand
  let baseDemand = 0
  switch (fixture.kind) {
    case 'laser':
    case 'movingHead':
    case 'parWash': {
      if (!beamEnabled) return 0
      if (fixture.optics.primitiveType !== 'auto') {
        baseDemand = positiveInt(fixture.optics.rayCount, 7, 1, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
      } else {
        const targets = Array.isArray(fixture.beam.targets)
          ? fixture.beam.targets.slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
          : []
        const editableTargetCount = Math.max(1, targets.length)
        if (fixture.beam.targetMode === 'fixed' || editableTargetCount > 1) baseDemand = editableTargetCount
        else if (fixture.beam.targetMode === 'fan') {
          const spread = Math.max(0, Math.min(180, finite(fixture.beam.beamSpread, 0)))
          baseDemand = Math.max(3, Math.min(9, Math.round(spread / 9)))
        } else if (fixture.beam.targetMode === 'cross' || fixture.beam.targetMode === 'mirror') baseDemand = 2
        else baseDemand = 1
      }
      if (fixture.kind === 'laser') return qualityFanDemand(fixture, role, quality, baseDemand)
      const nonLaserLimit = role === 'heroImpact' || role === 'primaryArchitecture' ? 8 : 6
      return Math.min(baseDemand, nonLaserLimit)
    }
    case 'ledBar':
      return beamEnabled ? Math.min(positiveInt(fixture.component.ledCellCount, 8, 1, 64), 16) : 0
    case 'ledTube':
      return beamEnabled ? Math.min(positiveInt(fixture.component.ledCellCount, 8, 1, 64), 12) : 0
    case 'strobe':
    case 'blinder':
      return beamEnabled ? Math.min(4, positiveInt(fixture.optics.rayCount, 4, 1, 4)) : 0
    case 'videoWall':
      return 4
    case 'co2Jet':
      return 1
    case 'haze':
    default:
      return 0
  }
}

export interface LaserDmxShowDirectorBeamBudgetFixture {
  fixtureId: string
  semanticKey: string
  role: LaserDmxShowDirectorBeamPriorityRole
  priority: number
  estimatedDemand: number
  allocatedDemand: number
}

export interface LaserDmxShowDirectorBeamBudgetReport {
  estimatedDemand: number
  boundedDemand: number
  overBudget: boolean
  quality: LaserDmxShowDirectorWebGLQuality
  fixtures: LaserDmxShowDirectorBeamBudgetFixture[]
  priorityByFixtureId: Record<string, number>
}

function allocateBalancedRoleGroup<T extends { estimatedDemand: number }>(
  group: readonly T[],
  remaining: number,
): { allocations: number[]; remaining: number } {
  const allocations = new Array<number>(group.length).fill(0)
  let available = remaining
  let progress = true
  // Round-robin allocation keeps mirrored/paired sources balanced and makes
  // degradation deterministic. Lower-priority groups are reached only after
  // hero and primary structures have received their complete coherent fans.
  while (available > 0 && progress) {
    progress = false
    for (let index = 0; index < group.length && available > 0; index += 1) {
      if (allocations[index]! >= group[index]!.estimatedDemand) continue
      allocations[index] += 1
      available -= 1
      progress = true
    }
  }
  return { allocations, remaining: available }
}

export function createLaserDmxShowDirectorBeamBudgetReport(
  fixtures: readonly LaserDmxShowDirectorFixture[],
  requestedRoles: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>> = {},
  limit = LASER_DMX_MATRIX_MAX_BEAMS,
  quality: LaserDmxShowDirectorWebGLQuality = 'medium',
): LaserDmxShowDirectorBeamBudgetReport {
  const ordered = fixtures.map(fixture => {
    const role = resolveLaserDmxShowDirectorBeamPriorityRole(fixture, requestedRoles[fixture.id])
    return {
      fixture,
      role,
      priority: LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER[role],
      estimatedDemand: estimateLaserDmxShowDirectorFixtureBeamDemand(fixture, { quality, role }),
    }
  }).sort((a, b) => (
    a.priority - b.priority
    || (a.fixture.semanticKey ?? '').localeCompare(b.fixture.semanticKey ?? '')
    || a.fixture.id.localeCompare(b.fixture.id)
  ))

  let remaining = Math.max(0, Math.round(limit))
  const reportFixtures: LaserDmxShowDirectorBeamBudgetFixture[] = []
  for (const priority of [0, 1, 2, 3, 4]) {
    const group = ordered.filter(item => item.priority === priority)
    const balanced = allocateBalancedRoleGroup(group, remaining)
    remaining = balanced.remaining
    group.forEach((item, index) => {
      reportFixtures.push({
        fixtureId: item.fixture.id,
        semanticKey: item.fixture.semanticKey ?? item.fixture.id,
        role: item.role,
        priority: item.priority,
        estimatedDemand: item.estimatedDemand,
        allocatedDemand: balanced.allocations[index] ?? 0,
      })
    })
  }
  const estimatedDemand = reportFixtures.reduce((sum, item) => sum + item.estimatedDemand, 0)
  const boundedDemand = reportFixtures.reduce((sum, item) => sum + item.allocatedDemand, 0)

  return {
    estimatedDemand,
    boundedDemand,
    overBudget: estimatedDemand > Math.max(0, Math.round(limit)),
    quality,
    fixtures: reportFixtures,
    priorityByFixtureId: Object.fromEntries(reportFixtures.map(item => [item.fixtureId, item.priority])),
  }
}
