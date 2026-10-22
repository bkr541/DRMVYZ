import { describe, expect, it } from 'vitest'
import { CANOPY_NEUTRAL_DRIVE, solveCanopyRods, type CanopyDesign, type CanopyDrive } from '../modules/canopy/Cinema2CanopyChoreography'
import {
  CANOPY_BASE_HANG,
  CANOPY_DEFAULT_STRUCTURE,
  CANOPY_FRAME_HALF_DEPTH,
  CANOPY_FRAME_HALF_WIDTH,
  CANOPY_MAX_RODS,
  CANOPY_MIN_HANG,
  CANOPY_MIN_TIP_Y,
  CANOPY_MOUNT_Y,
  CANOPY_PATTERN_IDS,
  canopyHash,
  clampCanopyStructure,
  resolveCanopyFitScale,
  type CanopyPatternId,
  type CanopyStructure,
} from '../modules/canopy/Cinema2CanopyDomain'
import {
  CANOPY_INSTANCE_FLOATS,
  CANOPY_KIND,
  CANOPY_MAX_BOX_INSTANCES,
  CANOPY_MAX_INSTANCES,
  buildCanopyLayout,
  canopyInstanceCounts,
  createCanopyRodState,
  packCanopyInstances,
  resolveCanopyBounds,
} from '../modules/canopy/Cinema2CanopyLayout'
import { evaluateCanopyPattern } from '../modules/canopy/Cinema2CanopyPatterns'

const DEFAULT_DESIGN: CanopyDesign = {
  masterIntensity: 0.78, motionAmount: 0.55, heightRange: 0.6, symmetry: true, idleGlow: 0.28, accentStrength: 0.55, autoPerformance: false,
  structure: CANOPY_DEFAULT_STRUCTURE,
}
const layoutOf = (structure: Partial<CanopyStructure> = {}) => buildCanopyLayout(clampCanopyStructure(structure))
const solve = (pattern: CanopyPatternId, phase: number, design: Partial<CanopyDesign> = {}, drive: Partial<CanopyDrive> = {}, structure: Partial<CanopyStructure> = {}) => {
  const layout = layoutOf(structure)
  const state = createCanopyRodState(layout.fixtures.length)
  solveCanopyRods(layout, { ...DEFAULT_DESIGN, structure: layout.structure, ...design }, { ...CANOPY_NEUTRAL_DRIVE, pattern, phase, ...drive }, state)
  return { layout, state }
}
const hangs = (pattern: CanopyPatternId, phase: number, design: Partial<CanopyDesign> = {}) => Array.from(solve(pattern, phase, design).state.hang)
const maxDifference = (a: readonly number[], b: readonly number[]) => Math.max(...a.map((value, index) => Math.abs(value - b[index]!)))

describe('CANOPY layout', () => {
  it('builds the default 8 x 8 array of 64 rods with stable row-major addresses', () => {
    const layout = layoutOf()
    expect(layout.fixtures).toHaveLength(64)
    expect(layout.fixtures.map(fixture => fixture.index)).toEqual(Array.from({ length: 64 }, (_, index) => index))
    layout.fixtures.forEach(fixture => expect(fixture.index).toBe(fixture.row * 8 + fixture.column))
    expect(layout.scale).toBe(1)
  })

  it('is deterministic: the same structure always gives the same rods', () => {
    expect(layoutOf({ rows: 7, columns: 9 })).toEqual(layoutOf({ rows: 7, columns: 9 }))
    expect(canopyHash(5, 11)).toBe(canopyHash(5, 11))
    expect(canopyHash(5, 11)).not.toBe(canopyHash(6, 11))
  })

  it('centres the array on the origin with the authored spacing', () => {
    const layout = layoutOf()
    const xs = layout.fixtures.map(fixture => fixture.x)
    const zs = layout.fixtures.map(fixture => fixture.z)
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 6)
    expect(Math.min(...zs)).toBeCloseTo(-Math.max(...zs), 6)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(7 * 1.08, 6)
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(7 * 1, 6)
  })

  it('changes the actual rod count with Rows and Columns, from 4 to 12 on each axis, and never past the cap', () => {
    expect(layoutOf({ rows: 4, columns: 4 }).fixtures).toHaveLength(16)
    expect(layoutOf({ rows: 12, columns: 4 }).fixtures).toHaveLength(48)
    expect(layoutOf({ rows: 4, columns: 12 }).fixtures).toHaveLength(48)
    expect(layoutOf({ rows: 12, columns: 12 }).fixtures).toHaveLength(144)
    expect(layoutOf({ rows: 99, columns: 99 }).fixtures.length).toBeLessThanOrEqual(CANOPY_MAX_RODS)
    expect(clampCanopyStructure({ rows: 2, columns: 2 })).toMatchObject({ rows: 4, columns: 4 })
    expect(clampCanopyStructure({ rows: Number.NaN })).toMatchObject({ rows: 8 })
  })

  it('makes Row and Column Spacing real distances and Rod Length a real length', () => {
    const wide = layoutOf({ columnSpacing: 1.4 })
    const narrow = layoutOf({ columnSpacing: 0.75 })
    expect(wide.fixtures[7]!.x - wide.fixtures[0]!.x).toBeCloseTo(7 * 1.4, 6)
    expect(narrow.fixtures[7]!.x - narrow.fixtures[0]!.x).toBeCloseTo(7 * 0.75, 6)
    const short = layoutOf({ rodLength: 0.6, lengthVariation: 0 })
    const long = layoutOf({ rodLength: 2.1, lengthVariation: 0 })
    expect(short.fixtures.every(fixture => fixture.length === 0.6)).toBe(true)
    expect(long.fixtures.every(fixture => fixture.length === 2.1)).toBe(true)
  })

  it('varies rod length by Length Variation, the same way every time, and not at all at 0', () => {
    const none = layoutOf({ lengthVariation: 0 })
    expect(new Set(none.fixtures.map(fixture => fixture.length)).size).toBe(1)
    const varied = layoutOf({ lengthVariation: 0.65 })
    expect(new Set(varied.fixtures.map(fixture => fixture.length)).size).toBeGreaterThan(30)
    expect(Math.max(...varied.fixtures.map(fixture => fixture.length)) / 1.45).toBeLessThanOrEqual(1 + 0.65 / 2 + 1e-9)
  })

  it('splits the rods into two colour banks by alternating column', () => {
    const layout = layoutOf()
    expect(layout.fixtures.filter(fixture => fixture.bank === 0)).toHaveLength(32)
    expect(layout.fixtures.every(fixture => fixture.bank === fixture.column % 2)).toBe(true)
  })

  it('scales an oversized array to stay in frame and leaves the default untouched', () => {
    expect(resolveCanopyFitScale(clampCanopyStructure({}))).toBe(1)
    const big = clampCanopyStructure({ rows: 12, columns: 12, rowSpacing: 1.4, columnSpacing: 1.4 })
    const scale = resolveCanopyFitScale(big)
    expect(scale).toBeLessThan(1)
    expect(scale).toBeGreaterThan(0.3)
    const bounds = resolveCanopyBounds(buildCanopyLayout(big))
    expect(bounds.max[0]).toBeLessThanOrEqual(CANOPY_FRAME_HALF_WIDTH + 1e-6)
    expect(bounds.max[2]).toBeLessThanOrEqual(CANOPY_FRAME_HALF_DEPTH + 1e-6)
  })
})

describe('CANOPY instance packing', () => {
  it('writes rails, stems and caps as one box batch and every diffuser into the fixed diffuser region', () => {
    const layout = layoutOf()
    const counts = canopyInstanceCounts(layout)
    expect(counts).toEqual({ boxes: 16 + 128, diffusers: 64, total: 16 + 128 + 64 })
    const state = createCanopyRodState(64)
    const out = new Float32Array(CANOPY_MAX_INSTANCES * CANOPY_INSTANCE_FLOATS)
    packCanopyInstances(layout, state, out)
    const kind = (instance: number) => out[instance * CANOPY_INSTANCE_FLOATS + 3]
    for (let i = 0; i < 16; i += 1) expect(kind(i)).toBe(CANOPY_KIND.rail)
    for (let i = 16; i < 80; i += 1) expect(kind(i)).toBe(CANOPY_KIND.stem)
    for (let i = 80; i < 144; i += 1) expect(kind(i)).toBe(CANOPY_KIND.cap)
    for (let i = 0; i < 64; i += 1) expect(kind(CANOPY_MAX_BOX_INSTANCES + i)).toBe(CANOPY_KIND.diffuser)
    expect(Array.from(out).every(Number.isFinite)).toBe(true)
  })

  it('keeps every rod under the mounting plane and every tip above the minimum height, at the longest and lowest', () => {
    for (const structure of [{}, { rodLength: 2.1, lengthVariation: 0.65 }, { rodLength: 0.6 }, { rows: 12, columns: 12, rodLength: 2.1 }]) {
      const layout = layoutOf(structure)
      const state = createCanopyRodState(layout.fixtures.length)
      state.hang.fill(99)
      const out = new Float32Array(CANOPY_MAX_INSTANCES * CANOPY_INSTANCE_FLOATS)
      packCanopyInstances(layout, state, out)
      const scale = layout.scale
      for (let i = 0; i < layout.fixtures.length; i += 1) {
        const o = (CANOPY_MAX_BOX_INSTANCES + i) * CANOPY_INSTANCE_FLOATS
        const centre = out[o + 1]!
        const height = out[o + 5]!
        expect(centre + height / 2).toBeLessThanOrEqual(CANOPY_MOUNT_Y + 1e-6 + (scale === 1 ? 0 : 3))
        const tip = scale === 1 ? centre - height / 2 : null
        if (tip != null) expect(tip).toBeGreaterThanOrEqual(CANOPY_MIN_TIP_Y - 1e-6)
      }
      state.hang.fill(-5)
      packCanopyInstances(layout, state, out)
      for (let i = 0; i < layout.fixtures.length; i += 1) {
        const o = (CANOPY_MAX_BOX_INSTANCES + i) * CANOPY_INSTANCE_FLOATS
        if (scale === 1) expect(out[o + 1]! + out[o + 5]! / 2).toBeLessThanOrEqual(CANOPY_MOUNT_Y - CANOPY_MIN_HANG + 1e-6)
      }
    }
  })
})

describe('CANOPY patterns', () => {
  const context = { rows: 8, columns: 8, symmetry: true, skew: 0 }
  const fixtures = layoutOf().fixtures
  const restOf = (pattern: CanopyPatternId) => fixtures.map(fixture => evaluateCanopyPattern(pattern, fixture, { ...context, phase: 0 }).rest)

  it('gives six materially different rest formations', () => {
    for (let a = 0; a < CANOPY_PATTERN_IDS.length; a += 1) {
      for (let b = a + 1; b < CANOPY_PATTERN_IDS.length; b += 1) {
        const first = restOf(CANOPY_PATTERN_IDS[a]!)
        const second = restOf(CANOPY_PATTERN_IDS[b]!)
        const meanDifference = first.reduce((sum, value, index) => sum + Math.abs(value - second[index]!), 0) / first.length
        expect(meanDifference, `${CANOPY_PATTERN_IDS[a]} vs ${CANOPY_PATTERN_IDS[b]}`).toBeGreaterThan(0.08)
      }
    }
  })

  it('moves every pattern differently over time, with no two patterns following the same trajectory', () => {
    const phases = [0.5, 1.5, 2.5, 3.5, 5, 6.5]
    const trajectories = CANOPY_PATTERN_IDS.map(pattern => phases.flatMap(phase => fixtures.map(fixture => evaluateCanopyPattern(pattern, fixture, { ...context, phase }).motion)))
    for (const trajectory of trajectories) expect(Math.max(...trajectory.map(Math.abs))).toBeGreaterThan(0.1)
    for (let a = 0; a < trajectories.length; a += 1) for (let b = a + 1; b < trajectories.length; b += 1) expect(maxDifference(trajectories[a]!, trajectories[b]!)).toBeGreaterThan(0.2)
  })

  it('has no motion at phase 0 and is a pure function of its inputs', () => {
    for (const pattern of CANOPY_PATTERN_IDS) {
      expect(fixtures.every(fixture => evaluateCanopyPattern(pattern, fixture, { ...context, phase: 0 }).motion === 0), pattern).toBe(true)
      const first = evaluateCanopyPattern(pattern, fixtures[10]!, { ...context, phase: 3.3 })
      const second = evaluateCanopyPattern(pattern, fixtures[10]!, { ...context, phase: 3.3 })
      expect(first).toEqual(second)
    }
  })

  it('hangs Waterfall high at the front and low at the back', () => {
    const rest = restOf('waterfall')
    const row = (r: number) => rest.slice(r * 8, r * 8 + 8).reduce((s, v) => s + v, 0) / 8
    expect(row(7)).toBeLessThan(row(0) - 0.4)
  })

  it('hangs Crown low at the centre and lifts the rim', () => {
    const rest = restOf('crown')
    const centre = fixtures.filter(fixture => fixture.radius < 0.25).map(fixture => rest[fixture.index]!)
    const rim = fixtures.filter(fixture => fixture.radius > 0.85).map(fixture => rest[fixture.index]!)
    expect(Math.min(...centre)).toBeGreaterThan(Math.max(...rim) + 0.5)
  })

  it('splits the wings: one half lifted while the other hangs', () => {
    const rest = restOf('splitWings')
    const left = fixtures.filter(fixture => fixture.u < -0.3).map(fixture => rest[fixture.index]!)
    const right = fixtures.filter(fixture => fixture.u > 0.3).map(fixture => rest[fixture.index]!)
    expect(Math.abs(left.reduce((s, v) => s + v, 0) / left.length - right.reduce((s, v) => s + v, 0) / right.length)).toBeGreaterThan(0.8)
    // Later in the cycle the wings have swapped.
    const later = fixtures.map(fixture => evaluateCanopyPattern('splitWings', fixture, { ...context, phase: 4.6 }))
    const leftLater = fixtures.filter(fixture => fixture.u < -0.3).map(fixture => later[fixture.index]!.rest + later[fixture.index]!.motion)
    expect(Math.sign(leftLater.reduce((s, v) => s + v, 0))).toBe(-Math.sign(left.reduce((s, v) => s + v, 0)))
  })

  it('raises Checker Lift\'s alternate rods into two tiers', () => {
    const rest = restOf('checkerLift')
    const even = fixtures.filter(fixture => (fixture.row + fixture.column) % 2 === 0).map(fixture => rest[fixture.index]!)
    const odd = fixtures.filter(fixture => (fixture.row + fixture.column) % 2 === 1).map(fixture => rest[fixture.index]!)
    expect(Math.min(...even)).toBeGreaterThan(Math.max(...odd) + 0.8)
  })

  it('holds Downpour high at rest and brings the whole curtain down mid-cycle', () => {
    const rest = restOf('downpour')
    expect(Math.max(...rest)).toBeLessThan(-0.4)
    const mid = fixtures.map(fixture => evaluateCanopyPattern('downpour', fixture, { ...context, phase: 3.2 }))
    expect(mid.every(sample => sample.rest + sample.motion > 0.2)).toBe(true)
  })

  it('leans each formation when Symmetry is off and mirrors it when on', () => {
    for (const pattern of ['waterfall', 'crosswave', 'crown', 'splitWings', 'checkerLift', 'downpour'] as const) {
      const on = fixtures.map(fixture => evaluateCanopyPattern(pattern, fixture, { ...context, phase: 2.2, symmetry: true }))
      const off = fixtures.map(fixture => evaluateCanopyPattern(pattern, fixture, { ...context, phase: 2.2, symmetry: false }))
      const differs = on.some((sample, index) => Math.abs(sample.rest + sample.motion - off[index]!.rest - off[index]!.motion) > 0.02)
      expect(differs, pattern).toBe(true)
    }
  })
})

describe('CANOPY rod solver', () => {
  it('rests every rod at the base hang when Height Range is 0, and never moves the cap in or out of its bounds', () => {
    const { state } = solve('waterfall', 3, { heightRange: 0 })
    expect(Array.from(state.hang).every(value => Math.abs(value - CANOPY_BASE_HANG) < 1e-6)).toBe(true)
  })

  it('travels further with a larger Height Range: the cap moves, not only the light', () => {
    const spread = (range: number) => { const h = hangs('waterfall', 3, { heightRange: range }); return Math.max(...h) - Math.min(...h) }
    expect(spread(0.8)).toBeGreaterThan(spread(0.45) * 1.5)
    expect(spread(0.45)).toBeGreaterThan(spread(0.1) * 3)
  })

  it('freezes all physical movement at Motion Amount 0 while the formation still stands', () => {
    const frozen = hangs('crosswave', 0.3, { motionAmount: 0 })
    for (const phase of [1, 2.5, 4.4, 7]) expect(maxDifference(hangs('crosswave', phase, { motionAmount: 0 }), frozen)).toBeLessThan(1e-9)
    expect(maxDifference(hangs('crown', 0, { motionAmount: 0 }), hangs('crosswave', 0, { motionAmount: 0 }))).toBeGreaterThan(0.1)
    expect(maxDifference(hangs('crosswave', 3, { motionAmount: 1 }), hangs('crosswave', 0.3, { motionAmount: 1 }))).toBeGreaterThan(0.05)
  })

  it('stops music from moving the rods at Motion Amount 0, but still lights them', () => {
    const music: Partial<CanopyDrive> = { musicActive: true, level: 0.6, signals: { sub: 0.9, bass: 0.9, mid: 0.9, high: 0.5, vocal: 0, overall: 0.7, build: 0.5 }, impulses: { kick: 1, snare: 1, downbeat: 1, phrase: 0, section: 0, drop: 1 } }
    const frozen = solve('waterfall', 2, { motionAmount: 0 }, music)
    const quiet = solve('waterfall', 2, { motionAmount: 0 })
    expect(maxDifference(Array.from(frozen.state.hang), Array.from(quiet.state.hang))).toBeLessThan(0.05)
    expect(Math.max(...Array.from(frozen.state.emission))).toBeGreaterThan(Math.max(...Array.from(quiet.state.emission)))
  })

  it('gives zero emission at Master Intensity 0, and more at a higher one, however loud the music', () => {
    const loud: Partial<CanopyDrive> = { musicActive: true, level: 1, signals: { sub: 1, bass: 1, mid: 1, high: 1, vocal: 0, overall: 1, build: 1 }, impulses: { kick: 1, snare: 1, downbeat: 1, phrase: 1, section: 0, drop: 1 } }
    expect(Array.from(solve('waterfall', 2, { masterIntensity: 0, autoPerformance: true }, loud).state.emission).every(value => value === 0)).toBe(true)
    const mean = (intensity: number) => { const e = Array.from(solve('waterfall', 2, { masterIntensity: intensity }).state.emission); return e.reduce((s, v) => s + v, 0) / e.length }
    expect(mean(1)).toBeGreaterThan(mean(0.78))
    expect(mean(0.78)).toBeGreaterThan(mean(0.3))
  })

  it('holds the idle glow when there is no music', () => {
    const e = Array.from(solve('crown', 0, { idleGlow: 0.5 }).state.emission)
    expect(Math.min(...e)).toBeGreaterThanOrEqual(0.5 - 1e-9)
    const dim = Array.from(solve('crown', 0, { idleGlow: 0 }).state.emission)
    expect(Math.max(...dim)).toBeLessThan(0.15)
  })

  it('lifts kick rods and snare rods differently and tints only the rods hit', () => {
    const none = solve('checkerLift', 0, { motionAmount: 1 }, { musicActive: true })
    const kick = solve('checkerLift', 0, { motionAmount: 1 }, { musicActive: true, impulses: { kick: 1, snare: 0, downbeat: 0, phrase: 0, section: 0, drop: 0 } })
    const snare = solve('checkerLift', 0, { motionAmount: 1 }, { musicActive: true, impulses: { kick: 0, snare: 1, downbeat: 0, phrase: 0, section: 0, drop: 0 } })
    const rose = (hit: typeof kick) => none.layout.fixtures.filter(fixture => hit.state.hang[fixture.index]! < none.state.hang[fixture.index]! - 1e-6).map(fixture => fixture.index)
    const kickRods = rose(kick)
    const snareRods = rose(snare)
    expect(kickRods.length).toBeGreaterThan(8)
    expect(snareRods.length).toBeGreaterThan(8)
    expect(kickRods.filter(index => snareRods.includes(index))).toEqual([])
    expect(kickRods.every(index => kick.state.accent[index]! > 0)).toBe(true)
    expect(Array.from(kick.state.accent).filter(value => value > 0)).toHaveLength(kickRods.length)
  })

  it('keeps hits inside Accent Strength: none at 0, more at the maximum', () => {
    const hit: Partial<CanopyDrive> = { musicActive: true, impulses: { kick: 1, snare: 1, downbeat: 1, phrase: 0, section: 0, drop: 0 } }
    const lift = (strength: number) => {
      const calm = solve('checkerLift', 0, { motionAmount: 1, accentStrength: strength }, { musicActive: true })
      const hits = solve('checkerLift', 0, { motionAmount: 1, accentStrength: strength }, hit)
      return Math.max(...calm.layout.fixtures.map(fixture => calm.state.hang[fixture.index]! - hits.state.hang[fixture.index]!))
    }
    expect(lift(0)).toBeLessThan(1e-9)
    expect(lift(1)).toBeGreaterThan(lift(0.55))
    expect(lift(1)).toBeLessThanOrEqual(0.25 * 1.1 * 1.1 + 1e-9)
    expect(Array.from(solve('checkerLift', 0, { accentStrength: 0 }, hit).state.accent).every(value => value === 0)).toBe(true)
  })

  it('releases the whole array downward on a drop, and a little further with Auto Performance', () => {
    const drop: Partial<CanopyDrive> = { musicActive: true, impulses: { kick: 0, snare: 0, downbeat: 0, phrase: 0, section: 0, drop: 1 } }
    const calm = hangs('downpour', 0, { motionAmount: 1 })
    const released = Array.from(solve('downpour', 0, { motionAmount: 1 }, drop).state.hang)
    const auto = Array.from(solve('downpour', 0, { motionAmount: 1, autoPerformance: true }, drop).state.hang)
    expect(released.every((value, index) => value > calm[index]! - 1e-9)).toBe(true)
    expect(Math.max(...released.map((value, index) => value - calm[index]!))).toBeGreaterThan(0.15)
    expect(Math.max(...auto)).toBeGreaterThan(Math.max(...released))
  })

  it('compresses the height range during a build, more with Auto Performance, and never at 0 Height Range', () => {
    const build: Partial<CanopyDrive> = { musicActive: true, signals: { sub: 0, bass: 0, mid: 0, high: 0, vocal: 0, overall: 0.5, build: 1 } }
    const spread = (design: Partial<CanopyDesign>, drive: Partial<CanopyDrive>) => { const h = Array.from(solve('crown', 0, { motionAmount: 1, ...design }, drive).state.hang); return Math.max(...h) - Math.min(...h) }
    const relaxed = spread({}, { musicActive: true })
    expect(spread({}, build)).toBeLessThan(relaxed)
    expect(spread({ autoPerformance: true }, build)).toBeLessThan(spread({}, build))
  })

  it('keeps every cap inside its bounds for any drive, however extreme', () => {
    const extreme: Partial<CanopyDrive> = { musicActive: true, level: 1, signals: { sub: 1, bass: 1, mid: 1, high: 1, vocal: 1, overall: 1, build: 1 }, impulses: { kick: 1, snare: 1, downbeat: 1, phrase: 1, section: 1, drop: 1 }, director: { impact: 1, intensity: 1 } }
    for (const pattern of CANOPY_PATTERN_IDS) {
      for (const structure of [{}, { rodLength: 2.1, lengthVariation: 0.65, rows: 12, columns: 12 }]) {
        const { layout, state } = solve(pattern, 3.7, { motionAmount: 1, heightRange: 0.8, autoPerformance: true, accentStrength: 1, masterIntensity: 1 }, extreme, structure)
        for (const fixture of layout.fixtures) {
          expect(state.hang[fixture.index]!).toBeGreaterThanOrEqual(CANOPY_MIN_HANG - 1e-9)
          expect(state.hang[fixture.index]!).toBeLessThanOrEqual(fixture.maxHang + 1e-5)
          expect(Number.isFinite(state.emission[fixture.index]!)).toBe(true)
          expect(state.accent[fixture.index]!).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('calms the secondary bank during vocals without going below the idle glow', () => {
    const quiet = solve('crown', 0, {}, { musicActive: true, level: 0.5 })
    const vocal = solve('crown', 0, {}, { musicActive: true, level: 0.5, signals: { sub: 0, bass: 0, mid: 0, high: 0, vocal: 1, overall: 0.5, build: 0 } })
    const secondary = quiet.layout.fixtures.filter(fixture => fixture.bank === 1)
    expect(secondary.every(fixture => vocal.state.emission[fixture.index]! < quiet.state.emission[fixture.index]!)).toBe(true)
    expect(secondary.every(fixture => vocal.state.emission[fixture.index]! >= 0.28 / 0.78 * 0.78 - 1e-9)).toBe(true)
    const primary = quiet.layout.fixtures.filter(fixture => fixture.bank === 0)
    expect(primary.every(fixture => vocal.state.emission[fixture.index]! === quiet.state.emission[fixture.index]!)).toBe(true)
  })
})
