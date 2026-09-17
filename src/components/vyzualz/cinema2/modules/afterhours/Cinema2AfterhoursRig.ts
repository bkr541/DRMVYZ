import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT,
  CINEMA2_AFTERHOURS_MAX_BEAMS,
  CINEMA2_AFTERHOURS_MIN_BEAMS,
  CINEMA2_AFTERHOURS_STAGE_VOLUME,
  type Cinema2AfterhoursAllocationFamily,
  type Cinema2AfterhoursAllocationInput,
  type Cinema2AfterhoursAllocationResult,
  type Cinema2AfterhoursFixture,
  type Cinema2AfterhoursFixturePair,
  type Cinema2AfterhoursFixtureRole,
  type Cinema2AfterhoursRig,
  type Cinema2AfterhoursRigBank,
} from './Cinema2AfterhoursDomain'
import { getCinema2AfterhoursTopologyDefinition } from './Cinema2AfterhoursTopologyCatalog'

// These remain true world-space fixture positions, but they are authored
// against the production Afterhours camera so their projected sources read as
// a perimeter rig instead of floating around the middle 40% of the canvas.
// The old coordinates were mathematically valid 3D positions but projected far
// too far inward, which visually broke the legacy floor/side/overhead contract.
const BOTTOM_X = Object.freeze([-13.0, -10.3, -7.6, -4.9, -2.2, 2.2, 4.9, 7.6, 10.3, 13.0])
const OVERHEAD_X = Object.freeze([-13.2, -10.5, -7.8, -5.1, -2.3, 2.3, 5.1, 7.8, 10.5, 13.2])
const SIDE_Y = Object.freeze([-3.4, -0.8, 1.8, 4.4, 7.0, 9.6])
const SIDE_Z = Object.freeze([0.65, 0.45, 0.2, -0.05, -0.3, -0.55])
const BOTTOM_PAIR_ORDER = Object.freeze([[4, 5], [3, 6], [2, 7], [1, 8], [0, 9]] as const)
const OVERHEAD_PAIR_ORDER = Object.freeze([[4, 5], [3, 6], [2, 7], [1, 8], [0, 9]] as const)
const SIDE_PAIR_ORDER = Object.freeze([2, 3, 1, 4, 0, 5] as const)

function vector(x: number, y: number, z: number): Cinema2Vector3 {
  return Object.freeze([x, y, z]) as Cinema2Vector3
}

function normalize(value: Cinema2Vector3): Cinema2Vector3 {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length <= 1e-8) return vector(0, 0, 1)
  return vector(value[0] / length, value[1] / length, value[2] / length)
}

function fixture(
  bank: Cinema2AfterhoursRigBank,
  role: Cinema2AfterhoursFixtureRole,
  emitterIndex: number,
  positionWorld: Cinema2Vector3,
  mountDirectionWorld: Cinema2Vector3,
  mirrorFixtureId: string,
  pairId: string,
): Cinema2AfterhoursFixture {
  return Object.freeze({
    id: `afterhours2-${bank}-${String(emitterIndex).padStart(2, '0')}`,
    bank,
    role,
    emitterIndex,
    positionWorld,
    mountDirectionWorld: normalize(mountDirectionWorld),
    mirrorSide: positionWorld[0] < 0 ? 'left' : 'right',
    mirrorFixtureId,
    pairId,
  })
}

function fixtureId(bank: Cinema2AfterhoursRigBank, emitterIndex: number): string {
  return `afterhours2-${bank}-${String(emitterIndex).padStart(2, '0')}`
}

function horizontalPairId(bank: 'bottom' | 'overhead', index: number, length: number): string {
  return `afterhours2-${bank}-pair-${Math.min(index, length - 1 - index)}`
}

const BOTTOM_FIXTURES = Object.freeze(BOTTOM_X.map((x, index) => {
  const mirrorIndex = BOTTOM_X.length - 1 - index
  return fixture(
    'bottom', 'floor', index, vector(x, -4.75, 0.75), vector(0, 0.38, 0.93),
    fixtureId('bottom', mirrorIndex), horizontalPairId('bottom', index, BOTTOM_X.length),
  )
}))

const LEFT_FIXTURES = Object.freeze(SIDE_Y.map((y, index) => fixture(
  'left', 'leftWing', index, vector(-14.2, y, SIDE_Z[index]!), vector(0.48, 0.08, 0.87),
  fixtureId('right', index), `afterhours2-side-pair-${index}`,
)))

const RIGHT_FIXTURES = Object.freeze(SIDE_Y.map((y, index) => fixture(
  'right', 'rightWing', index, vector(14.2, y, SIDE_Z[index]!), vector(-0.48, 0.08, 0.87),
  fixtureId('left', index), `afterhours2-side-pair-${index}`,
)))

const OVERHEAD_FIXTURES = Object.freeze(OVERHEAD_X.map((x, index) => {
  const mirrorIndex = OVERHEAD_X.length - 1 - index
  return fixture(
    'overhead', 'roof', index, vector(x, 11.25, -0.45), vector(0, -0.34, 0.94),
    fixtureId('overhead', mirrorIndex), horizontalPairId('overhead', index, OVERHEAD_X.length),
  )
}))

function pair(
  id: string,
  family: Cinema2AfterhoursAllocationFamily,
  left: Cinema2AfterhoursFixture,
  right: Cinema2AfterhoursFixture,
): Cinema2AfterhoursFixturePair {
  return Object.freeze({ id, family, fixtures: Object.freeze([left, right]) as readonly [Cinema2AfterhoursFixture, Cinema2AfterhoursFixture] })
}

const BOTTOM_PAIRS = Object.freeze(BOTTOM_PAIR_ORDER.map(([leftIndex, rightIndex]) => pair(
  BOTTOM_FIXTURES[leftIndex]!.pairId, 'bottom', BOTTOM_FIXTURES[leftIndex]!, BOTTOM_FIXTURES[rightIndex]!,
)))
const SIDE_PAIRS = Object.freeze(SIDE_PAIR_ORDER.map(index => pair(
  LEFT_FIXTURES[index]!.pairId, 'side', LEFT_FIXTURES[index]!, RIGHT_FIXTURES[index]!,
)))
const OVERHEAD_PAIRS = Object.freeze(OVERHEAD_PAIR_ORDER.map(([leftIndex, rightIndex]) => pair(
  OVERHEAD_FIXTURES[leftIndex]!.pairId, 'overhead', OVERHEAD_FIXTURES[leftIndex]!, OVERHEAD_FIXTURES[rightIndex]!,
)))

export const CINEMA2_AFTERHOURS_RIG: Cinema2AfterhoursRig = Object.freeze({
  id: 'afterhours2-world-rig-v1',
  fixtures: Object.freeze([...BOTTOM_FIXTURES, ...LEFT_FIXTURES, ...RIGHT_FIXTURES, ...OVERHEAD_FIXTURES]),
  banks: Object.freeze({
    bottom: BOTTOM_FIXTURES,
    left: LEFT_FIXTURES,
    right: RIGHT_FIXTURES,
    overhead: OVERHEAD_FIXTURES,
  }),
  pairs: Object.freeze({ bottom: BOTTOM_PAIRS, side: SIDE_PAIRS, overhead: OVERHEAD_PAIRS }),
  stageVolume: CINEMA2_AFTERHOURS_STAGE_VOLUME,
})

if (CINEMA2_AFTERHOURS_RIG.fixtures.length !== CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT) {
  throw new Error(`Afterhours 2.0 rig expected ${CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT} fixtures.`)
}

const FIXTURE_BY_ID = new Map(CINEMA2_AFTERHOURS_RIG.fixtures.map(candidate => [candidate.id, candidate]))

export function getCinema2AfterhoursFixture(id: string): Cinema2AfterhoursFixture | null {
  return FIXTURE_BY_ID.get(id) ?? null
}

export function getCinema2AfterhoursMirrorFixture(candidate: Cinema2AfterhoursFixture): Cinema2AfterhoursFixture {
  const mirror = FIXTURE_BY_ID.get(candidate.mirrorFixtureId)
  if (!mirror) throw new Error(`Missing Afterhours 2.0 mirror fixture for ${candidate.id}.`)
  return mirror
}

export function resolveCinema2AfterhoursBeamCount(raw: number): number {
  const rounded = Math.round(Number.isFinite(raw) ? raw : CINEMA2_AFTERHOURS_MIN_BEAMS)
  return Math.max(CINEMA2_AFTERHOURS_MIN_BEAMS, Math.min(CINEMA2_AFTERHOURS_MAX_BEAMS, rounded))
}

function familyEnabled(family: Cinema2AfterhoursAllocationFamily, input: Cinema2AfterhoursAllocationInput): boolean {
  if (family === 'side') return input.sideLasers
  if (family === 'overhead') return input.topLasers
  return true
}

function pairPool(family: Cinema2AfterhoursAllocationFamily): readonly Cinema2AfterhoursFixturePair[] {
  if (family === 'side') return SIDE_PAIRS
  if (family === 'overhead') return OVERHEAD_PAIRS
  return BOTTOM_PAIRS
}

const ASYMMETRIC_BOTTOM = Object.freeze([4, 6, 2, 8, 0, 5, 3, 7, 1, 9].map(index => BOTTOM_FIXTURES[index]!))
const ASYMMETRIC_SIDE = Object.freeze([
  LEFT_FIXTURES[2]!, RIGHT_FIXTURES[4]!, LEFT_FIXTURES[0]!, RIGHT_FIXTURES[1]!,
  LEFT_FIXTURES[5]!, RIGHT_FIXTURES[3]!, LEFT_FIXTURES[1]!, RIGHT_FIXTURES[5]!,
  LEFT_FIXTURES[4]!, RIGHT_FIXTURES[0]!, LEFT_FIXTURES[3]!, RIGHT_FIXTURES[2]!,
])
const ASYMMETRIC_OVERHEAD = Object.freeze([4, 6, 2, 8, 0, 5, 3, 7, 1, 9].map(index => OVERHEAD_FIXTURES[index]!))

function fixturePool(family: Cinema2AfterhoursAllocationFamily): readonly Cinema2AfterhoursFixture[] {
  if (family === 'side') return ASYMMETRIC_SIDE
  if (family === 'overhead') return ASYMMETRIC_OVERHEAD
  return ASYMMETRIC_BOTTOM
}

function uniqueCycle(input: Cinema2AfterhoursAllocationInput): readonly Cinema2AfterhoursAllocationFamily[] {
  const topology = getCinema2AfterhoursTopologyDefinition(input.topologyId)
  const enabled = topology.allocationCycle.filter(family => familyEnabled(family, input))
  return Object.freeze(enabled.length > 0 ? enabled : ['bottom'])
}

function allocateSymmetric(
  input: Cinema2AfterhoursAllocationInput,
  limit: number,
): readonly Cinema2AfterhoursFixture[] {
  const cycle = uniqueCycle(input)
  const cursor = new Map<Cinema2AfterhoursAllocationFamily, number>()
  const selected: Cinema2AfterhoursFixture[] = []
  const pairBudget = Math.floor(limit / 2)
  let cycleIndex = 0
  let stalled = 0

  while (selected.length / 2 < pairBudget && stalled < cycle.length) {
    const family = cycle[cycleIndex % cycle.length]!
    cycleIndex += 1
    const pool = pairPool(family)
    const index = cursor.get(family) ?? 0
    if (index >= pool.length) {
      stalled += 1
      continue
    }
    stalled = 0
    const candidate = pool[index]!
    cursor.set(family, index + 1)
    selected.push(candidate.fixtures[0], candidate.fixtures[1])
  }

  return Object.freeze(selected.slice(0, pairBudget * 2))
}

function allocateAsymmetric(
  input: Cinema2AfterhoursAllocationInput,
  limit: number,
): readonly Cinema2AfterhoursFixture[] {
  const cycle = uniqueCycle(input)
  const cursor = new Map<Cinema2AfterhoursAllocationFamily, number>()
  const selected: Cinema2AfterhoursFixture[] = []
  const selectedIds = new Set<string>()
  let cycleIndex = 0
  let stalled = 0

  while (selected.length < limit && stalled < cycle.length) {
    const family = cycle[cycleIndex % cycle.length]!
    cycleIndex += 1
    const pool = fixturePool(family)
    let index = cursor.get(family) ?? 0
    while (index < pool.length && selectedIds.has(pool[index]!.id)) index += 1
    if (index >= pool.length) {
      cursor.set(family, index)
      stalled += 1
      continue
    }
    stalled = 0
    const candidate = pool[index]!
    cursor.set(family, index + 1)
    selectedIds.add(candidate.id)
    selected.push(candidate)
  }

  return Object.freeze(selected)
}

/**
 * Pure fixture recruitment. Beam Count is always a ceiling. With Symmetry ON,
 * an odd ceiling deliberately resolves to the next lower even count so every
 * active source has its installed mirror instead of inventing a center fixture.
 */
export function allocateCinema2AfterhoursFixtures(
  input: Cinema2AfterhoursAllocationInput,
): Cinema2AfterhoursAllocationResult {
  const requestedBeamCount = resolveCinema2AfterhoursBeamCount(input.beamCount)
  const topology = getCinema2AfterhoursTopologyDefinition(input.topologyId)
  const limit = Math.min(requestedBeamCount, topology.maxActiveBeams)
  const fixtures = input.symmetry ? allocateSymmetric(input, limit) : allocateAsymmetric(input, limit)
  return Object.freeze({
    requestedBeamCount,
    activeBeamCount: fixtures.length,
    symmetry: input.symmetry,
    fixtures,
  })
}
