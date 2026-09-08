/**
 * Afterhours Stage 3 virtual DJ-stage rig.
 *
 * This module owns physical/logical fixture identity, placement, mounting
 * direction, mirror relationships, and deterministic beam-budget allocation.
 * It is intentionally independent of Show Director choreography and of any
 * per-frame music/scanner state: persisted settings express user intent, while
 * this pure rig reconstructs the same fixture allocation from that intent.
 */

export type AfterhoursRigBank = 'bottom' | 'left' | 'right' | 'top'
export type AfterhoursRigRole = 'lower' | 'leftWing' | 'rightWing' | 'overhead'
export type AfterhoursRigMirrorSide = 'left' | 'right'
export type AfterhoursRigAllocationFamily = 'lower' | 'side' | 'top'

export interface AfterhoursRigPoint {
  readonly x: number
  readonly y: number
}

export interface AfterhoursRigFixture {
  /** Stable physical identity. Kept compatible with the Stage 1 source IDs. */
  readonly id: string
  readonly bank: AfterhoursRigBank
  readonly role: AfterhoursRigRole
  /** Stable index inside the legacy bank ordering. */
  readonly emitterIndex: number
  readonly position: AfterhoursRigPoint
  /** Neutral mounting direction in screen-space degrees: +X=0, +Y=90. */
  readonly homeHeadingDeg: number
  readonly mirrorSide: AfterhoursRigMirrorSide
  readonly mirrorFixtureId: string
  readonly pairId: string
}

export interface AfterhoursRigPair {
  readonly id: string
  readonly family: AfterhoursRigAllocationFamily
  /** Pair ordering is always logical left then logical right. */
  readonly fixtures: readonly [AfterhoursRigFixture, AfterhoursRigFixture]
}

export interface AfterhoursVirtualStageRig {
  readonly id: 'afterhours-virtual-stage-v1'
  readonly fixtures: readonly AfterhoursRigFixture[]
  readonly banks: Readonly<{
    lower: readonly AfterhoursRigFixture[]
    leftWing: readonly AfterhoursRigFixture[]
    rightWing: readonly AfterhoursRigFixture[]
    overhead: readonly AfterhoursRigFixture[]
  }>
  readonly pairs: Readonly<{
    lower: readonly AfterhoursRigPair[]
    side: readonly AfterhoursRigPair[]
    top: readonly AfterhoursRigPair[]
  }>
  /** Deliberately fixture-free aperture around stage centre. */
  readonly centerAperture: Readonly<{ minX: number; maxX: number }>
}

const BOTTOM_POSITIONS = Object.freeze([
  Object.freeze({ x: 0.07, y: 0.025 }),
  Object.freeze({ x: 0.165, y: 0.025 }),
  Object.freeze({ x: 0.26, y: 0.025 }),
  Object.freeze({ x: 0.355, y: 0.025 }),
  Object.freeze({ x: 0.45, y: 0.025 }),
  Object.freeze({ x: 0.55, y: 0.025 }),
  Object.freeze({ x: 0.645, y: 0.025 }),
  Object.freeze({ x: 0.74, y: 0.025 }),
  Object.freeze({ x: 0.835, y: 0.025 }),
  Object.freeze({ x: 0.93, y: 0.025 }),
] as const)

const LEFT_POSITIONS = Object.freeze([
  Object.freeze({ x: 0.02, y: 0.30 }),
  Object.freeze({ x: 0.02, y: 0.52 }),
  Object.freeze({ x: 0.02, y: 0.74 }),
] as const)

const RIGHT_POSITIONS = Object.freeze([
  Object.freeze({ x: 0.98, y: 0.30 }),
  Object.freeze({ x: 0.98, y: 0.52 }),
  Object.freeze({ x: 0.98, y: 0.74 }),
] as const)

const TOP_POSITIONS = Object.freeze([
  Object.freeze({ x: 0.12, y: 0.975 }),
  Object.freeze({ x: 0.264, y: 0.975 }),
  Object.freeze({ x: 0.408, y: 0.975 }),
  Object.freeze({ x: 0.592, y: 0.975 }),
  Object.freeze({ x: 0.736, y: 0.975 }),
  Object.freeze({ x: 0.88, y: 0.975 }),
] as const)

function horizontalPairId(bank: 'bottom' | 'top', index: number, length: number): string {
  const mirrorIndex = length - 1 - index
  return `afterhours-${bank}-pair-${Math.min(index, mirrorIndex)}`
}

function fixture(
  bank: AfterhoursRigBank,
  role: AfterhoursRigRole,
  emitterIndex: number,
  position: AfterhoursRigPoint,
  homeHeadingDeg: number,
  mirrorFixtureId: string,
  pairId: string,
): AfterhoursRigFixture {
  return Object.freeze({
    id: `afterhours-${bank}-${emitterIndex}`,
    bank,
    role,
    emitterIndex,
    position,
    homeHeadingDeg,
    mirrorSide: position.x < 0.5 ? 'left' : 'right',
    mirrorFixtureId,
    pairId,
  })
}

const LOWER_FIXTURES = Object.freeze(BOTTOM_POSITIONS.map((position, index) => {
  const mirrorIndex = BOTTOM_POSITIONS.length - 1 - index
  return fixture(
    'bottom', 'lower', index, position, 90,
    `afterhours-bottom-${mirrorIndex}`,
    horizontalPairId('bottom', index, BOTTOM_POSITIONS.length),
  )
}))

const LEFT_WING_FIXTURES = Object.freeze(LEFT_POSITIONS.map((position, index) => fixture(
  'left', 'leftWing', index, position, 0,
  `afterhours-right-${index}`,
  `afterhours-side-pair-${index}`,
)))

const RIGHT_WING_FIXTURES = Object.freeze(RIGHT_POSITIONS.map((position, index) => fixture(
  'right', 'rightWing', index, position, 180,
  `afterhours-left-${index}`,
  `afterhours-side-pair-${index}`,
)))

const OVERHEAD_FIXTURES = Object.freeze(TOP_POSITIONS.map((position, index) => {
  const mirrorIndex = TOP_POSITIONS.length - 1 - index
  return fixture(
    'top', 'overhead', index, position, 270,
    `afterhours-top-${mirrorIndex}`,
    horizontalPairId('top', index, TOP_POSITIONS.length),
  )
}))

function pair(
  id: string,
  family: AfterhoursRigAllocationFamily,
  left: AfterhoursRigFixture,
  right: AfterhoursRigFixture,
): AfterhoursRigPair {
  return Object.freeze({ id, family, fixtures: Object.freeze([left, right]) as readonly [AfterhoursRigFixture, AfterhoursRigFixture] })
}

/** Center-out pair ordering creates a plausible stage hierarchy and negative space. */
const LOWER_PAIRS = Object.freeze([
  pair(LOWER_FIXTURES[4].pairId, 'lower', LOWER_FIXTURES[4], LOWER_FIXTURES[5]),
  pair(LOWER_FIXTURES[3].pairId, 'lower', LOWER_FIXTURES[3], LOWER_FIXTURES[6]),
  pair(LOWER_FIXTURES[2].pairId, 'lower', LOWER_FIXTURES[2], LOWER_FIXTURES[7]),
  pair(LOWER_FIXTURES[1].pairId, 'lower', LOWER_FIXTURES[1], LOWER_FIXTURES[8]),
  pair(LOWER_FIXTURES[0].pairId, 'lower', LOWER_FIXTURES[0], LOWER_FIXTURES[9]),
] as const)

/** Side bank is one product toggle but allocation always treats both wings as a pair. */
const SIDE_PAIRS = Object.freeze([
  pair(LEFT_WING_FIXTURES[1].pairId, 'side', LEFT_WING_FIXTURES[1], RIGHT_WING_FIXTURES[1]),
  pair(LEFT_WING_FIXTURES[0].pairId, 'side', LEFT_WING_FIXTURES[0], RIGHT_WING_FIXTURES[0]),
  pair(LEFT_WING_FIXTURES[2].pairId, 'side', LEFT_WING_FIXTURES[2], RIGHT_WING_FIXTURES[2]),
] as const)

const TOP_PAIRS = Object.freeze([
  pair(OVERHEAD_FIXTURES[2].pairId, 'top', OVERHEAD_FIXTURES[2], OVERHEAD_FIXTURES[3]),
  pair(OVERHEAD_FIXTURES[1].pairId, 'top', OVERHEAD_FIXTURES[1], OVERHEAD_FIXTURES[4]),
  pair(OVERHEAD_FIXTURES[0].pairId, 'top', OVERHEAD_FIXTURES[0], OVERHEAD_FIXTURES[5]),
] as const)

export const AFTERHOURS_VIRTUAL_STAGE_RIG: AfterhoursVirtualStageRig = Object.freeze({
  id: 'afterhours-virtual-stage-v1',
  fixtures: Object.freeze([
    ...LOWER_FIXTURES,
    ...LEFT_WING_FIXTURES,
    ...RIGHT_WING_FIXTURES,
    ...OVERHEAD_FIXTURES,
  ]),
  banks: Object.freeze({
    lower: LOWER_FIXTURES,
    leftWing: LEFT_WING_FIXTURES,
    rightWing: RIGHT_WING_FIXTURES,
    overhead: OVERHEAD_FIXTURES,
  }),
  pairs: Object.freeze({
    lower: LOWER_PAIRS,
    side: SIDE_PAIRS,
    top: TOP_PAIRS,
  }),
  centerAperture: Object.freeze({ minX: 0.46, maxX: 0.54 }),
})

const FIXTURE_BY_ID = new Map(AFTERHOURS_VIRTUAL_STAGE_RIG.fixtures.map(candidate => [candidate.id, candidate]))

export function getAfterhoursRigFixture(bank: AfterhoursRigBank, emitterIndex: number): AfterhoursRigFixture {
  const fixtures = bank === 'bottom'
    ? LOWER_FIXTURES
    : bank === 'left'
      ? LEFT_WING_FIXTURES
      : bank === 'right'
        ? RIGHT_WING_FIXTURES
        : OVERHEAD_FIXTURES
  const candidate = fixtures[emitterIndex]
  if (!candidate) throw new Error(`Unknown Afterhours fixture ${bank}:${emitterIndex}`)
  return candidate
}

export function getAfterhoursMirrorFixture(candidate: AfterhoursRigFixture): AfterhoursRigFixture {
  const mirror = FIXTURE_BY_ID.get(candidate.mirrorFixtureId)
  if (!mirror) throw new Error(`Missing mirror fixture for ${candidate.id}`)
  return mirror
}

export interface AfterhoursRigAllocationSettings {
  readonly beamCount: number
  readonly sideLasers: boolean
  readonly topLasers: boolean
}

interface AllocationFamilyState {
  readonly family: AfterhoursRigAllocationFamily
  readonly pairs: readonly AfterhoursRigPair[]
  cursor: number
}

/**
 * Deterministic, role-aware beam-budget allocation.
 *
 * Full pairs are distributed round-robin in explicit priority order:
 * lower -> side -> top. This means low budgets degrade intentionally rather
 * than starving whichever bank happens to be later in a fixture array. At the
 * ordinary eight-beam budget, all enabled supported families participate.
 * Side fixtures are never split, so the left/right wing roles stay balanced.
 * An odd literal Beam Count adds one deterministic lower fixture because this
 * rig deliberately has no centre/hero source; inventing one would close the
 * authored centre aperture.
 */
export function allocateAfterhoursRigFixtures(
  settings: AfterhoursRigAllocationSettings,
): readonly AfterhoursRigFixture[] {
  const count = Math.max(0, Math.trunc(Number.isFinite(settings.beamCount) ? settings.beamCount : 0))
  if (count === 0) return Object.freeze([])

  const families: AllocationFamilyState[] = [
    { family: 'lower', pairs: LOWER_PAIRS, cursor: 0 },
  ]
  if (settings.sideLasers) families.push({ family: 'side', pairs: SIDE_PAIRS, cursor: 0 })
  if (settings.topLasers) families.push({ family: 'top', pairs: TOP_PAIRS, cursor: 0 })

  const selectedPairs = new Map<AfterhoursRigAllocationFamily, AfterhoursRigPair[]>(
    families.map(state => [state.family, []]),
  )
  let pairBudget = Math.floor(count / 2)
  while (pairBudget > 0) {
    for (const state of families) {
      if (pairBudget <= 0) break
      const selected = state.pairs[state.cursor % state.pairs.length]
      state.cursor += 1
      selectedPairs.get(state.family)?.push(selected)
      pairBudget -= 1
    }
  }

  // Selection is balanced round-robin, then materialised in stable family
  // order. Existing lower/wing fixtures therefore keep a predictable slot
  // neighborhood when another optional family is toggled.
  const allocated: AfterhoursRigFixture[] = []
  for (const state of families) {
    for (const selected of selectedPairs.get(state.family) ?? []) {
      allocated.push(selected.fixtures[0], selected.fixtures[1])
    }
  }

  if (allocated.length < count) {
    // Preserve exact literal count without breaking the side-wing mirror pair.
    const lowerState = families[0]
    const selected = lowerState.pairs[lowerState.cursor % lowerState.pairs.length]
    // Alternate the unavoidable singleton side as the pair budget changes so
    // odd counts do not permanently bias the virtual stage to one half.
    const singletonSide = (Math.floor(count / 2) + lowerState.cursor) % 2
    allocated.push(selected.fixtures[singletonSide])
  }

  return Object.freeze(allocated.slice(0, count))
}
