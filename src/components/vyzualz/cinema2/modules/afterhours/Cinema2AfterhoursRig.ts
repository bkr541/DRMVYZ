import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AFTERHOURS_INSTALLED_FIXTURE_COUNT,
  CINEMA2_AFTERHOURS_MAX_LASERS,
  CINEMA2_AFTERHOURS_MIN_LASERS,
  CINEMA2_AFTERHOURS_STAGE_VOLUME,
  type Cinema2AfterhoursFixture,
  type Cinema2AfterhoursFixturePair,
  type Cinema2AfterhoursFixtureRole,
  type Cinema2AfterhoursRig,
  type Cinema2AfterhoursRigBank,
} from './Cinema2AfterhoursDomain'

const BOTTOM_X = Object.freeze([-8.9, -7.0, -5.1, -3.2, -1.3, 1.3, 3.2, 5.1, 7.0, 8.9])
const OVERHEAD_X = Object.freeze([-9.15, -7.2, -5.25, -3.3, -1.35, 1.35, 3.3, 5.25, 7.2, 9.15])
const MID_X = Object.freeze([-8.4, -6.0, -3.6, -1.2, 1.2, 3.6, 6.0, 8.4])
const SIDE_Y = Object.freeze([0.8, 1.77, 2.74, 3.71, 4.68, 5.65, 6.62, 7.6])
const SIDE_Z = Object.freeze([0.7, 0.52, 0.34, 0.16, -0.02, -0.2, -0.38, -0.56])

function vector(x: number, y: number, z: number): Cinema2Vector3 {
  return Object.freeze([x, y, z]) as Cinema2Vector3
}

function normalize(value: Cinema2Vector3): Cinema2Vector3 {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length <= 1e-8) return vector(0, 0, 1)
  return vector(value[0] / length, value[1] / length, value[2] / length)
}

function fixtureId(bank: Cinema2AfterhoursRigBank, emitterIndex: number): string {
  return `afterhours2-${bank}-${String(emitterIndex).padStart(2, '0')}`
}

function fixture(
  bank: Cinema2AfterhoursRigBank,
  role: Cinema2AfterhoursFixtureRole,
  emitterIndex: number,
  positionWorld: Cinema2Vector3,
  mountDirectionWorld: Cinema2Vector3,
  mirrorFixtureId: string,
  pairId: string,
  pairIndex: number,
): Cinema2AfterhoursFixture {
  return Object.freeze({
    id: fixtureId(bank, emitterIndex),
    bank,
    role,
    emitterIndex,
    positionWorld,
    mountDirectionWorld: normalize(mountDirectionWorld),
    mirrorSide: bank === 'center' ? 'center' : positionWorld[0] < 0 ? 'left' : 'right',
    mirrorFixtureId,
    pairId,
    pairIndex,
  })
}

/** A horizontal row: index 0 is stage-left. Pair 0 is the innermost pair, counting outward. */
function row(
  bank: 'bottom' | 'overhead' | 'mid',
  role: Cinema2AfterhoursFixtureRole,
  xs: readonly number[],
  y: number,
  z: number,
  mount: Cinema2Vector3,
): readonly Cinema2AfterhoursFixture[] {
  const half = xs.length / 2
  return Object.freeze(xs.map((x, index) => {
    const mirrorIndex = xs.length - 1 - index
    const pairIndex = index < half ? half - 1 - index : index - half
    return fixture(bank, role, index, vector(x, y, z), mount, fixtureId(bank, mirrorIndex), `afterhours2-${bank}-pair-${pairIndex}`, pairIndex)
  }))
}

const BOTTOM_FIXTURES = row('bottom', 'floor', BOTTOM_X, 0.35, 0.75, vector(0, 0.38, 0.93))
const OVERHEAD_FIXTURES = row('overhead', 'roof', OVERHEAD_X, 7.2, -0.45, vector(0, -0.34, 0.94))
const MID_FIXTURES = row('mid', 'midTruss', MID_X, 3.8, -0.9, vector(0, 0.05, 1))

const LEFT_FIXTURES = Object.freeze(SIDE_Y.map((y, index) => fixture(
  'left', 'leftWing', index, vector(-11.2, y, SIDE_Z[index]!), vector(0.48, 0.08, 0.87),
  fixtureId('right', index), `afterhours2-side-pair-${index}`, index,
)))
const RIGHT_FIXTURES = Object.freeze(SIDE_Y.map((y, index) => fixture(
  'right', 'rightWing', index, vector(11.2, y, SIDE_Z[index]!), vector(-0.48, 0.08, 0.87),
  fixtureId('left', index), `afterhours2-side-pair-${index}`, index,
)))

const CENTER_FIXTURES = Object.freeze([
  fixture('center', 'floorCenter', 0, vector(0, 0.3, 0.95), vector(0, 0.4, 0.92), fixtureId('center', 0), 'afterhours2-center-floor', 0),
  fixture('center', 'topCenter', 1, vector(0, 7.3, -0.5), vector(0, -0.36, 0.93), fixtureId('center', 1), 'afterhours2-center-top', 1),
])

function pairsOf(bank: Cinema2AfterhoursRigBank, left: readonly Cinema2AfterhoursFixture[], right: readonly Cinema2AfterhoursFixture[]) {
  const byPair = new Map<number, Cinema2AfterhoursFixture[]>()
  for (const candidate of [...left, ...right]) {
    const entries = byPair.get(candidate.pairIndex) ?? []
    entries.push(candidate)
    byPair.set(candidate.pairIndex, entries)
  }
  return Object.freeze([...byPair.entries()].sort((a, b) => a[0] - b[0]).map(([, entries]) => {
    const [first, second] = [...entries].sort((a, b) => a.positionWorld[0] - b.positionWorld[0])
    return Object.freeze({
      id: first!.pairId,
      bank,
      fixtures: Object.freeze([first!, second ?? first!]) as readonly [Cinema2AfterhoursFixture, Cinema2AfterhoursFixture],
    }) satisfies Cinema2AfterhoursFixturePair
  }))
}

export const CINEMA2_AFTERHOURS_RIG: Cinema2AfterhoursRig = Object.freeze({
  id: 'afterhours2-world-rig-v2',
  fixtures: Object.freeze([...BOTTOM_FIXTURES, ...LEFT_FIXTURES, ...RIGHT_FIXTURES, ...OVERHEAD_FIXTURES, ...MID_FIXTURES, ...CENTER_FIXTURES]),
  banks: Object.freeze({
    bottom: BOTTOM_FIXTURES,
    left: LEFT_FIXTURES,
    right: RIGHT_FIXTURES,
    overhead: OVERHEAD_FIXTURES,
    mid: MID_FIXTURES,
    center: CENTER_FIXTURES,
  }),
  pairs: Object.freeze({
    bottom: pairsOf('bottom', BOTTOM_FIXTURES, []),
    overhead: pairsOf('overhead', OVERHEAD_FIXTURES, []),
    mid: pairsOf('mid', MID_FIXTURES, []),
    side: pairsOf('left', LEFT_FIXTURES, RIGHT_FIXTURES),
    center: Object.freeze(CENTER_FIXTURES.map(candidate => Object.freeze({
      id: candidate.pairId,
      bank: 'center' as const,
      fixtures: Object.freeze([candidate, candidate]) as readonly [Cinema2AfterhoursFixture, Cinema2AfterhoursFixture],
    }))),
  }),
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

/** Laser Count: how many lasers may be lit at once. */
export function resolveCinema2AfterhoursLaserLimit(raw: number): number {
  const rounded = Math.round(Number.isFinite(raw) ? raw : CINEMA2_AFTERHOURS_MAX_LASERS)
  return Math.max(CINEMA2_AFTERHOURS_MIN_LASERS, Math.min(CINEMA2_AFTERHOURS_MAX_LASERS, rounded))
}
