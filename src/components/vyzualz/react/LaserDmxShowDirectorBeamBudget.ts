import {
  LASER_DMX_MATRIX_MAX_BEAMS,
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'
import type { LaserDmxShowDirectorBeamPriorityRole } from './LaserDmxShowDirectorPerformanceProgram'

export const LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER: Readonly<Record<LaserDmxShowDirectorBeamPriorityRole, number>> = Object.freeze({
  heroImpact: 0,
  primaryArchitecture: 1,
  secondaryFan: 2,
  detailLattice: 3,
  decorativeAccent: 4,
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

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(finite(value, fallback))))
}

export function resolveLaserDmxShowDirectorBeamPriorityRole(
  fixture: LaserDmxShowDirectorFixture,
  requestedRole?: LaserDmxShowDirectorBeamPriorityRole | null,
): LaserDmxShowDirectorBeamPriorityRole {
  return requestedRole && requestedRole in LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER
    ? requestedRole
    : DEFAULT_ROLE_BY_KIND[fixture.kind] ?? 'decorativeAccent'
}

export function estimateLaserDmxShowDirectorFixtureBeamDemand(fixture: LaserDmxShowDirectorFixture): number {
  if (!fixture.enabled) return 0
  const beamEnabled = fixture.beam?.beamEnabled !== false
  switch (fixture.kind) {
    case 'laser':
    case 'movingHead':
    case 'parWash': {
      if (!beamEnabled) return 0
      if (fixture.optics.primitiveType !== 'auto') {
        return positiveInt(fixture.optics.rayCount, 7, 1, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
      }
      const targets = Array.isArray(fixture.beam.targets)
        ? fixture.beam.targets.slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
        : []
      const editableTargetCount = Math.max(1, targets.length)
      if (fixture.beam.targetMode === 'fixed' || editableTargetCount > 1) return editableTargetCount
      if (fixture.beam.targetMode === 'fan') {
        const spread = Math.max(0, Math.min(180, finite(fixture.beam.beamSpread, 0)))
        return Math.max(3, Math.min(9, Math.round(spread / 9)))
      }
      if (fixture.beam.targetMode === 'cross' || fixture.beam.targetMode === 'mirror') return 2
      return 1
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
  fixtures: LaserDmxShowDirectorBeamBudgetFixture[]
  priorityByFixtureId: Record<string, number>
}

export function createLaserDmxShowDirectorBeamBudgetReport(
  fixtures: readonly LaserDmxShowDirectorFixture[],
  requestedRoles: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>> = {},
  limit = LASER_DMX_MATRIX_MAX_BEAMS,
): LaserDmxShowDirectorBeamBudgetReport {
  const ordered = fixtures.map(fixture => {
    const role = resolveLaserDmxShowDirectorBeamPriorityRole(fixture, requestedRoles[fixture.id])
    return {
      fixture,
      role,
      priority: LASER_DMX_SHOW_DIRECTOR_BEAM_PRIORITY_ORDER[role],
      estimatedDemand: estimateLaserDmxShowDirectorFixtureBeamDemand(fixture),
    }
  }).sort((a, b) => (
    a.priority - b.priority
    || (a.fixture.semanticKey ?? '').localeCompare(b.fixture.semanticKey ?? '')
    || a.fixture.id.localeCompare(b.fixture.id)
  ))

  let remaining = Math.max(0, Math.round(limit))
  const reportFixtures = ordered.map(item => {
    const allocatedDemand = Math.min(item.estimatedDemand, remaining)
    remaining -= allocatedDemand
    return {
      fixtureId: item.fixture.id,
      semanticKey: item.fixture.semanticKey ?? item.fixture.id,
      role: item.role,
      priority: item.priority,
      estimatedDemand: item.estimatedDemand,
      allocatedDemand,
    }
  })
  const estimatedDemand = reportFixtures.reduce((sum, item) => sum + item.estimatedDemand, 0)
  const boundedDemand = reportFixtures.reduce((sum, item) => sum + item.allocatedDemand, 0)

  return {
    estimatedDemand,
    boundedDemand,
    overBudget: estimatedDemand > Math.max(0, Math.round(limit)),
    fixtures: reportFixtures,
    priorityByFixtureId: Object.fromEntries(reportFixtures.map(item => [item.fixtureId, item.priority])),
  }
}
