import {
  CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID,
  CINEMA2_INTERLOCK_PATTERN_IDS,
  CINEMA2_INTERLOCK_PIVOT_IDS,
  CINEMA2_INTERLOCK_ROTATION_MODES,
  type Cinema2InterlockFixture,
  type Cinema2InterlockFixtureBank,
  type Cinema2InterlockPatternDefinition,
  type Cinema2InterlockPatternId,
  type Cinema2InterlockPatternTarget,
  type Cinema2InterlockRotationMode,
} from './Cinema2InterlockDomain'
import { CINEMA2_INTERLOCK_RIG } from './Cinema2InterlockRig'

const BANK_INDEX: Readonly<Record<Cinema2InterlockFixtureBank, number>> = Object.freeze({
  inner: 0,
  middle: 1,
  outer: 2,
  edge: 3,
})

const BANK_DELAY_BEATS: Readonly<Record<Cinema2InterlockFixtureBank, number>> = Object.freeze({
  inner: 0,
  middle: 0.0625,
  outer: 0.125,
  edge: 0.1875,
})

function degrees(value: number): number {
  return value * Math.PI / 180
}

function mirrorAngle(leftAngle: number): number {
  return Math.PI - leftAngle
}

function leftAuthoredAngle(fixture: Cinema2InterlockFixture, patternId: Cinema2InterlockPatternId): number {
  const bankIndex = BANK_INDEX[fixture.bank]
  const top = fixture.quadrant === 'topLeft' || fixture.quadrant === 'topRight'
  switch (patternId) {
    case 'diamondTunnel':
      return top ? -Math.PI / 4 : Math.PI / 4
    case 'mechanicalIris':
      return top ? degrees(-18 - bankIndex * 9) : degrees(18 + bankIndex * 9)
    case 'doubleWing':
      return 0
    case 'bassPortal':
      return Math.PI / 2
    case 'fourWayVortex':
      return top ? degrees(-10 - bankIndex * 18) : degrees(10 + bankIndex * 18)
  }
}

function authoredRotationMode(
  fixture: Cinema2InterlockFixture,
  patternId: Cinema2InterlockPatternId,
): Cinema2InterlockRotationMode {
  if (patternId !== 'fourWayVortex') return 'shortest'
  if (fixture.quadrant === 'topLeft' || fixture.quadrant === 'bottomRight') return 'clockwise'
  return 'counterclockwise'
}

function targetFor(fixture: Cinema2InterlockFixture, patternId: Cinema2InterlockPatternId): Cinema2InterlockPatternTarget {
  const leftAngle = leftAuthoredAngle(fixture, patternId)
  const angle = fixture.mirrorSide === 'left' ? leftAngle : mirrorAngle(leftAngle)
  return Object.freeze({
    fixtureId: fixture.id,
    pivot: 'middle' as const,
    targetAngleRad: angle,
    rotationMode: authoredRotationMode(fixture, patternId),
    bankDelayBeats: BANK_DELAY_BEATS[fixture.bank],
  })
}

function pattern(id: Cinema2InterlockPatternId, label: string): Cinema2InterlockPatternDefinition {
  return Object.freeze({
    id,
    label,
    targets: Object.freeze(CINEMA2_INTERLOCK_RIG.fixtures.map(fixture => targetFor(fixture, id))),
  })
}

export const CINEMA2_INTERLOCK_PATTERN_CATALOG = Object.freeze([
  pattern('diamondTunnel', 'Diamond Tunnel'),
  pattern('mechanicalIris', 'Mechanical Iris'),
  pattern('doubleWing', 'Double Wing'),
  pattern('bassPortal', 'Bass Portal'),
  pattern('fourWayVortex', 'Four-Way Vortex'),
])

const PATTERN_BY_ID = new Map(CINEMA2_INTERLOCK_PATTERN_CATALOG.map(candidate => [candidate.id, candidate]))
const TARGETS_BY_PATTERN = new Map(CINEMA2_INTERLOCK_PATTERN_CATALOG.map(candidate => [
  candidate.id,
  new Map(candidate.targets.map(target => [target.fixtureId, target])),
]))

export function validateCinema2InterlockPatternDefinition(
  definition: Pick<Cinema2InterlockPatternDefinition, 'id' | 'targets'>,
): readonly string[] {
  const errors: string[] = []
  const fixtureIds = new Set(CINEMA2_INTERLOCK_RIG.fixtures.map(candidate => candidate.id))
  const targetIds = new Set<string>()

  if (!CINEMA2_INTERLOCK_PATTERN_IDS.includes(definition.id)) errors.push(`Unknown pattern id: ${definition.id}`)
  if (definition.targets.length !== CINEMA2_INTERLOCK_RIG.fixtures.length) {
    errors.push(`Pattern ${definition.id} expected ${CINEMA2_INTERLOCK_RIG.fixtures.length} targets, found ${definition.targets.length}.`)
  }

  for (const target of definition.targets) {
    if (!fixtureIds.has(target.fixtureId)) errors.push(`Pattern ${definition.id} targets unknown fixture ${target.fixtureId}.`)
    if (targetIds.has(target.fixtureId)) errors.push(`Pattern ${definition.id} duplicates fixture ${target.fixtureId}.`)
    targetIds.add(target.fixtureId)
    if (!CINEMA2_INTERLOCK_PIVOT_IDS.includes(target.pivot)) errors.push(`Pattern ${definition.id} has invalid pivot for ${target.fixtureId}.`)
    if (!CINEMA2_INTERLOCK_ROTATION_MODES.includes(target.rotationMode)) errors.push(`Pattern ${definition.id} has invalid rotation mode for ${target.fixtureId}.`)
    if (!Number.isFinite(target.targetAngleRad)) errors.push(`Pattern ${definition.id} has non-finite angle for ${target.fixtureId}.`)
    if (!Number.isFinite(target.bankDelayBeats) || target.bankDelayBeats < 0) errors.push(`Pattern ${definition.id} has invalid bank delay for ${target.fixtureId}.`)
  }

  for (const fixtureId of fixtureIds) {
    if (!targetIds.has(fixtureId)) errors.push(`Pattern ${definition.id} is missing fixture ${fixtureId}.`)
  }

  return Object.freeze(errors)
}

for (const definition of CINEMA2_INTERLOCK_PATTERN_CATALOG) {
  const errors = validateCinema2InterlockPatternDefinition(definition)
  if (errors.length > 0) throw new Error(`Invalid Interlock pattern catalog: ${errors.join(' ')}`)
}

if (CINEMA2_INTERLOCK_PATTERN_CATALOG.map(candidate => candidate.id).join('|') !== CINEMA2_INTERLOCK_PATTERN_IDS.join('|')) {
  throw new Error('Interlock pattern catalog order must match the stable pattern ID contract.')
}

export function normalizeCinema2InterlockPatternId(value: unknown): Cinema2InterlockPatternId {
  return typeof value === 'string' && (CINEMA2_INTERLOCK_PATTERN_IDS as readonly string[]).includes(value)
    ? value as Cinema2InterlockPatternId
    : CINEMA2_INTERLOCK_DEFAULT_PATTERN_ID
}

export function getCinema2InterlockPatternDefinition(value: unknown): Cinema2InterlockPatternDefinition {
  const id = normalizeCinema2InterlockPatternId(value)
  const definition = PATTERN_BY_ID.get(id)
  if (!definition) throw new Error(`Missing Interlock pattern definition: ${id}`)
  return definition
}

export function getCinema2InterlockPatternTarget(
  patternId: Cinema2InterlockPatternId,
  fixtureId: string,
): Cinema2InterlockPatternTarget {
  const target = TARGETS_BY_PATTERN.get(patternId)?.get(fixtureId)
  if (!target) throw new Error(`Missing Interlock target for ${patternId}/${fixtureId}.`)
  return target
}
