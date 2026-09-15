import type { Cinema2Vector2 } from '../../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  CINEMA2_INTERLOCK_RIG_ID,
  type Cinema2InterlockFixture,
  type Cinema2InterlockFixtureBank,
  type Cinema2InterlockFixturePair,
  type Cinema2InterlockMirrorSide,
  type Cinema2InterlockQuadrant,
  type Cinema2InterlockRig,
} from './Cinema2InterlockDomain'

interface PairSpec {
  readonly region: 'top' | 'bottom'
  readonly ordinal: number
  readonly bank: Cinema2InterlockFixtureBank
  readonly leftMidpointX: number
  readonly midpointY: number
  readonly lengthFactor: number
  readonly thicknessFactor: number
}

/**
 * Fourteen authored bilateral pairs create the fixed 28-fixture installation.
 * The edge pairs deliberately use 0/1 center-corridor intents so later layouts
 * can extend to the responsive safe boundary without changing fixture identity.
 */
const PAIR_SPECS = Object.freeze([
  { region: 'top', ordinal: 1, bank: 'inner', leftMidpointX: 0.42, midpointY: 0.40, lengthFactor: 0.22, thicknessFactor: 0.012 },
  { region: 'top', ordinal: 2, bank: 'inner', leftMidpointX: 0.34, midpointY: 0.34, lengthFactor: 0.24, thicknessFactor: 0.012 },
  { region: 'top', ordinal: 3, bank: 'middle', leftMidpointX: 0.27, midpointY: 0.28, lengthFactor: 0.27, thicknessFactor: 0.014 },
  { region: 'top', ordinal: 4, bank: 'middle', leftMidpointX: 0.20, midpointY: 0.22, lengthFactor: 0.29, thicknessFactor: 0.014 },
  { region: 'top', ordinal: 5, bank: 'outer', leftMidpointX: 0.14, midpointY: 0.16, lengthFactor: 0.31, thicknessFactor: 0.016 },
  { region: 'top', ordinal: 6, bank: 'outer', leftMidpointX: 0.08, midpointY: 0.10, lengthFactor: 0.33, thicknessFactor: 0.016 },
  { region: 'top', ordinal: 7, bank: 'edge', leftMidpointX: 0.00, midpointY: 0.00, lengthFactor: 0.36, thicknessFactor: 0.018 },
  { region: 'bottom', ordinal: 1, bank: 'inner', leftMidpointX: 0.42, midpointY: 0.60, lengthFactor: 0.22, thicknessFactor: 0.012 },
  { region: 'bottom', ordinal: 2, bank: 'inner', leftMidpointX: 0.34, midpointY: 0.66, lengthFactor: 0.24, thicknessFactor: 0.012 },
  { region: 'bottom', ordinal: 3, bank: 'middle', leftMidpointX: 0.27, midpointY: 0.72, lengthFactor: 0.27, thicknessFactor: 0.014 },
  { region: 'bottom', ordinal: 4, bank: 'middle', leftMidpointX: 0.20, midpointY: 0.78, lengthFactor: 0.29, thicknessFactor: 0.014 },
  { region: 'bottom', ordinal: 5, bank: 'outer', leftMidpointX: 0.14, midpointY: 0.84, lengthFactor: 0.31, thicknessFactor: 0.016 },
  { region: 'bottom', ordinal: 6, bank: 'outer', leftMidpointX: 0.08, midpointY: 0.90, lengthFactor: 0.33, thicknessFactor: 0.016 },
  { region: 'bottom', ordinal: 7, bank: 'edge', leftMidpointX: 0.00, midpointY: 1.00, lengthFactor: 0.36, thicknessFactor: 0.018 },
] as const satisfies readonly PairSpec[])

function point(x: number, y: number): Cinema2Vector2 {
  return Object.freeze([x, y]) as Cinema2Vector2
}

function pairId(spec: PairSpec): string {
  return `interlock-pair-${spec.region}-${String(spec.ordinal).padStart(2, '0')}`
}

function fixtureId(spec: PairSpec, side: Cinema2InterlockMirrorSide): string {
  return `interlock-${spec.region}-${String(spec.ordinal).padStart(2, '0')}-${side}`
}

function quadrant(spec: PairSpec, side: Cinema2InterlockMirrorSide): Cinema2InterlockQuadrant {
  if (spec.region === 'top') return side === 'left' ? 'topLeft' : 'topRight'
  return side === 'left' ? 'bottomLeft' : 'bottomRight'
}

function baseAngle(spec: PairSpec, side: Cinema2InterlockMirrorSide): number {
  if (spec.region === 'top') return side === 'left' ? -Math.PI / 4 : -3 * Math.PI / 4
  return side === 'left' ? Math.PI / 4 : 3 * Math.PI / 4
}

function fixture(spec: PairSpec, side: Cinema2InterlockMirrorSide): Cinema2InterlockFixture {
  const x = side === 'left' ? spec.leftMidpointX : 1 - spec.leftMidpointX
  const id = fixtureId(spec, side)
  const mirrorSide = side === 'left' ? 'right' : 'left'
  return Object.freeze({
    id,
    pairId: pairId(spec),
    groupId: `${spec.region}-${String(spec.ordinal).padStart(2, '0')}`,
    bank: spec.bank,
    quadrant: quadrant(spec, side),
    mirrorSide: side,
    mirrorFixtureId: fixtureId(spec, mirrorSide),
    lengthFactor: spec.lengthFactor,
    thicknessFactor: spec.thicknessFactor,
    basePose: Object.freeze({
      midpointNormalized: point(x, spec.midpointY),
      angleRad: baseAngle(spec, side),
    }),
  })
}

const PAIRS = Object.freeze(PAIR_SPECS.map((spec): Cinema2InterlockFixturePair => {
  const left = fixture(spec, 'left')
  const right = fixture(spec, 'right')
  return Object.freeze({
    id: pairId(spec),
    bank: spec.bank,
    fixtures: Object.freeze([left, right]) as readonly [Cinema2InterlockFixture, Cinema2InterlockFixture],
  })
}))

const FIXTURES = Object.freeze(PAIRS.flatMap(candidate => candidate.fixtures))

function fixturesInBank(bank: Cinema2InterlockFixtureBank): readonly Cinema2InterlockFixture[] {
  return Object.freeze(FIXTURES.filter(candidate => candidate.bank === bank))
}

export const CINEMA2_INTERLOCK_RIG: Cinema2InterlockRig = Object.freeze({
  id: CINEMA2_INTERLOCK_RIG_ID,
  fixtures: FIXTURES,
  pairs: PAIRS,
  banks: Object.freeze({
    inner: fixturesInBank('inner'),
    middle: fixturesInBank('middle'),
    outer: fixturesInBank('outer'),
    edge: fixturesInBank('edge'),
  }),
})

if (CINEMA2_INTERLOCK_RIG.fixtures.length !== CINEMA2_INTERLOCK_FIXTURE_COUNT) {
  throw new Error(`Interlock rig expected ${CINEMA2_INTERLOCK_FIXTURE_COUNT} fixtures.`)
}

const FIXTURE_BY_ID = new Map(CINEMA2_INTERLOCK_RIG.fixtures.map(candidate => [candidate.id, candidate]))

for (const candidate of CINEMA2_INTERLOCK_RIG.fixtures) {
  const mirror = FIXTURE_BY_ID.get(candidate.mirrorFixtureId)
  if (!mirror || mirror.mirrorFixtureId !== candidate.id || mirror.pairId !== candidate.pairId) {
    throw new Error(`Interlock rig has an invalid mirror relationship for ${candidate.id}.`)
  }
}

export function getCinema2InterlockFixture(id: string): Cinema2InterlockFixture | null {
  return FIXTURE_BY_ID.get(id) ?? null
}

export function getCinema2InterlockMirrorFixture(candidate: Cinema2InterlockFixture): Cinema2InterlockFixture {
  const mirror = FIXTURE_BY_ID.get(candidate.mirrorFixtureId)
  if (!mirror) throw new Error(`Missing Interlock mirror fixture for ${candidate.id}.`)
  return mirror
}
