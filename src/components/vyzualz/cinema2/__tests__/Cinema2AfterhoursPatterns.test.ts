import { describe, expect, it } from 'vitest'
import {
  CINEMA2_AFTERHOURS_MAX_PATTERN_BARS,
  CINEMA2_AFTERHOURS_RIG,
  evaluateCinema2AfterhoursGate,
  evaluateCinema2AfterhoursPattern,
  getCinema2AfterhoursFixture,
  resolveCinema2AfterhoursGroup,
  type Cinema2AfterhoursPatternDefinition,
  type Cinema2AfterhoursPatternInput,
} from '../modules/afterhours'
import {
  CINEMA2_AFTERHOURS_PATTERNS,
  CINEMA2_AFTERHOURS_PATTERN_IDS,
  getCinema2AfterhoursPattern,
} from '../modules/afterhours/Cinema2AfterhoursPatternLibrary'

function input(pattern: Readonly<Cinema2AfterhoursPatternDefinition>, beat: number, overrides: Partial<Cinema2AfterhoursPatternInput> = {}): Cinema2AfterhoursPatternInput {
  return { pattern, beat, seed: 'test-seed', symmetry: true, spread: 0.65, motion: 1, sideLasers: true, topLasers: true, laserLimit: 46, ...overrides }
}

/** Rays of one laser, keyed by its aim, at a moment of a pattern. */
function raysOf(pattern: Readonly<Cinema2AfterhoursPatternDefinition>, beat: number, fixtureId: string, overrides: Partial<Cinema2AfterhoursPatternInput> = {}) {
  return evaluateCinema2AfterhoursPattern(input(pattern, beat, overrides)).rays.filter(ray => ray.fixtureId === fixtureId)
}

const aimKey = (ray: { targetWorld: readonly number[] }) => ray.targetWorld.map(value => value.toFixed(3)).join(',')

/** Samples a pattern every 16th note across its whole length. */
function sample(pattern: Readonly<Cinema2AfterhoursPatternDefinition>, overrides: Partial<Cinema2AfterhoursPatternInput> = {}) {
  const steps = []
  for (let sixteenth = 0; sixteenth < pattern.bars * 16; sixteenth += 1) {
    const beat = sixteenth / 4 + 0.01
    steps.push({ beat, frame: evaluateCinema2AfterhoursPattern(input(pattern, beat, overrides)) })
  }
  return steps
}

function custom(layers: Cinema2AfterhoursPatternDefinition['layers'], bars = 4): Cinema2AfterhoursPatternDefinition {
  return { id: 'custom', label: 'Custom', energy: 'mid', bars, layers }
}

describe('Afterhours 2.0 gates', () => {
  it('lands a hit exactly on its 16th: fully open from the first instant of the beat', () => {
    const gate = 'x...x...x...x...'
    for (const beat of [0, 1, 2, 3]) {
      expect(evaluateCinema2AfterhoursGate(gate, beat * 4).gate).toBe(1)
      expect(evaluateCinema2AfterhoursGate(gate, beat * 4 - 0.001).gate).toBeLessThan(1)
    }
    expect(evaluateCinema2AfterhoursGate(gate, 2).gate).toBe(0)
  })

  it('holds a lit run and closes briefly before a dark 16th or the next hit, so repeated hits read as separate hits', () => {
    const hold = 'x==============='
    for (let q = 0; q < 16; q += 0.25) expect(evaluateCinema2AfterhoursGate(hold, q).gate).toBe(1)
    const quarters = 'x===x===x===x==='
    expect(evaluateCinema2AfterhoursGate(quarters, 3.99).gate).toBeLessThan(0.2)
    expect(evaluateCinema2AfterhoursGate(quarters, 4).gate).toBe(1)
    expect(evaluateCinema2AfterhoursGate(quarters, 9).hitIndex).toBe(3)
    expect(evaluateCinema2AfterhoursGate(quarters, 9).hitsPerBar).toBe(4)
  })
})

describe('Afterhours 2.0 pattern engine', () => {
  it('lets one laser fire one beam, then three, then a whole fan in consecutive bars', () => {
    const pattern = custom([{ group: 'floorEnds', role: 'base', bars: [
      { gate: 'x===============', beams: 1, aim: [[0.5, 0.8]] },
      { gate: 'x===============', beams: 3, aim: [[0.5, 0.8]] },
      { gate: 'x===============', beams: 9, aim: [[0.5, 0.8]] },
      { gate: 'x===============', beams: 'sheet', aim: [[0.5, 0.8]] },
    ] }])
    const laser = resolveCinema2AfterhoursGroup('floorEnds')[0]!.id
    expect([0.5, 4.5, 8.5, 12.5].map(beat => raysOf(pattern, beat, laser).length)).toEqual([1, 3, 9, 22])
    // Every ray of a laser leaves from that laser's single origin.
    const origins = new Set(raysOf(pattern, 8.5, laser).map(ray => ray.originWorld.join(',')))
    expect(origins.size).toBe(1)
  })

  it('moves one laser between several endpoints: holding one during a build and hitting many during a drop', () => {
    const pattern = custom([{ group: 'floorEnds', role: 'base', bars: [
      { gate: 'x===============', beams: 1, aim: [[0.5, 0.8]] },
      { gate: 'x=x=x=x=x=x=x=x=', beams: 1, aim: [[0.2, 0.9], [0.8, 0.5], [0.5, 0.2], [-0.4, 0.7]] },
    ] }], 2)
    const laser = resolveCinema2AfterhoursGroup('floorEnds')[0]!.id
    const build = new Set([0.1, 1.1, 2.1, 3.1].map(beat => aimKey(raysOf(pattern, beat, laser)[0]!)))
    const drop = new Set([4.1, 4.6, 5.1, 5.6, 6.1, 6.6].map(beat => aimKey(raysOf(pattern, beat, laser)[0]!)))
    expect(build.size).toBe(1)
    expect(drop.size).toBe(4)
  })

  it('keeps mirrored pairs symmetric, including random scatter, and breaks symmetry only when Symmetry is off', () => {
    const scatter = custom([{ group: 'floor', role: 'base', bars: [{ gate: 'x===x===x===x===', beams: 1, aim: [[0.5, 0.5]], aimMode: 'scatter', aimRate: 'beat' }] }])
    for (const beat of [0.5, 1.5, 2.5, 7.5]) {
      const frame = evaluateCinema2AfterhoursPattern(input(scatter, beat))
      for (const ray of frame.rays) {
        const mirror = CINEMA2_AFTERHOURS_RIG.fixtures.find(candidate => candidate.id === getCinema2AfterhoursFixture(ray.fixtureId)!.mirrorFixtureId)!
        const partner = frame.rays.find(other => other.fixtureId === mirror.id)!
        expect(partner.targetWorld[0]).toBeCloseTo(-ray.targetWorld[0], 6)
        expect(partner.targetWorld[1]).toBeCloseTo(ray.targetWorld[1], 6)
      }
    }
    const asymmetric = evaluateCinema2AfterhoursPattern(input(scatter, 0.5, { symmetry: false }))
    const left = asymmetric.rays.find(ray => ray.fixtureId === 'afterhours2-bottom-00')!
    const right = asymmetric.rays.find(ray => ray.fixtureId === 'afterhours2-bottom-09')!
    expect(right.targetWorld[0]).not.toBeCloseTo(-left.targetWorld[0], 3)
  })

  it('changes every beat when a pattern asks for it (a new random endpoint per beat)', () => {
    const pattern = getCinema2AfterhoursPattern('beatJump')
    const laser = resolveCinema2AfterhoursGroup('floor')[0]!.id
    const aims = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map(beat => aimKey(raysOf(pattern, beat, laser)[0]!))
    expect(new Set(aims).size).toBe(aims.length)
  })

  it('obeys Laser Count, keeping base layers and whole mirrored pairs first', () => {
    const pattern = getCinema2AfterhoursPattern('fullRig')
    for (const laserLimit of [2, 7, 12, 30]) {
      const frame = evaluateCinema2AfterhoursPattern(input(pattern, 0.5, { laserLimit }))
      expect(frame.litFixtureIds.length).toBeLessThanOrEqual(laserLimit)
      const lit = new Set(frame.litFixtureIds)
      for (const id of lit) expect(lit.has(getCinema2AfterhoursFixture(id)!.mirrorFixtureId)).toBe(true)
    }
    const small = evaluateCinema2AfterhoursPattern(input(pattern, 0.5, { laserLimit: 4 }))
    expect(small.litFixtureIds.every(id => id.includes('-bottom-') || id.includes('-overhead-'))).toBe(true)
  })

  it('never lights a side or top laser the user turned off', () => {
    for (const pattern of CINEMA2_AFTERHOURS_PATTERNS) {
      for (const { frame } of sample(pattern, { sideLasers: false, topLasers: false }).filter((_, index) => index % 3 === 0)) {
        for (const id of frame.litFixtureIds) {
          const laser = getCinema2AfterhoursFixture(id)!
          expect(laser.bank === 'left' || laser.bank === 'right' || laser.bank === 'overhead' || laser.role === 'topCenter', `${pattern.id} ${id}`).toBe(false)
        }
      }
    }
  })

  it('is deterministic for a given seed and changes scatter with the seed', () => {
    const pattern = getCinema2AfterhoursPattern('scatterStorm')
    expect(evaluateCinema2AfterhoursPattern(input(pattern, 5.3))).toEqual(evaluateCinema2AfterhoursPattern(input(pattern, 5.3)))
    expect(evaluateCinema2AfterhoursPattern(input(pattern, 5.3, { seed: 'other' }))).not.toEqual(evaluateCinema2AfterhoursPattern(input(pattern, 5.3)))
  })

  it('fires every hit at its first endpoint when Motion Amount is 0', () => {
    const pattern = getCinema2AfterhoursPattern('gridStep')
    const laser = resolveCinema2AfterhoursGroup('mid')[0]!.id
    const aims = new Set([0.5, 1.5, 2.5, 3.5, 4.5].map(beat => aimKey(raysOf(pattern, beat, laser, { motion: 0 })[0]!)))
    expect(aims.size).toBe(1)
  })

  it('handles non-finite and negative positions without throwing', () => {
    const pattern = getCinema2AfterhoursPattern('wideFan')
    expect(() => evaluateCinema2AfterhoursPattern(input(pattern, Number.NaN))).not.toThrow()
    expect(() => evaluateCinema2AfterhoursPattern(input(pattern, -3))).not.toThrow()
    expect(evaluateCinema2AfterhoursPattern(input(pattern, Number.POSITIVE_INFINITY)).rays.every(ray => ray.targetWorld.every(Number.isFinite))).toBe(true)
  })
})

describe('Afterhours 2.0 pattern library', () => {
  it('offers 30 to 40 distinct patterns of 1 to 16 bars with well-formed gates', () => {
    expect(CINEMA2_AFTERHOURS_PATTERNS.length).toBeGreaterThanOrEqual(30)
    expect(CINEMA2_AFTERHOURS_PATTERNS.length).toBeLessThanOrEqual(40)
    expect(new Set(CINEMA2_AFTERHOURS_PATTERN_IDS).size).toBe(CINEMA2_AFTERHOURS_PATTERN_IDS.length)
    expect(new Set(CINEMA2_AFTERHOURS_PATTERNS.map(pattern => pattern.label)).size).toBe(CINEMA2_AFTERHOURS_PATTERNS.length)
    for (const pattern of CINEMA2_AFTERHOURS_PATTERNS) {
      expect(pattern.bars, pattern.id).toBeGreaterThanOrEqual(1)
      expect(pattern.bars, pattern.id).toBeLessThanOrEqual(CINEMA2_AFTERHOURS_MAX_PATTERN_BARS)
      for (const layer of pattern.layers) {
        expect(layer.bars.length, `${pattern.id} ${layer.group}`).toBeLessThanOrEqual(pattern.bars)
        for (const step of layer.bars) expect(step.gate, pattern.id).toMatch(/^[x=.]{16}$/)
      }
    }
  })

  it('keeps the eight original pattern ids so saved presets still resolve', () => {
    for (const id of ['wideFan', 'splitWings', 'crossCanopy', 'diamondStar', 'chevronRoof', 'radialCrown', 'sparseArchitecture', 'fullRig']) {
      expect(CINEMA2_AFTERHOURS_PATTERN_IDS).toContain(id)
    }
    expect(getCinema2AfterhoursPattern('not-a-pattern').id).toBe('wideFan')
  })

  it('lights lasers in every pattern, with finite geometry, and never lights every laser all the time', () => {
    for (const pattern of CINEMA2_AFTERHOURS_PATTERNS) {
      const steps = sample(pattern)
      expect(steps.some(step => step.frame.rays.length > 0), pattern.id).toBe(true)
      expect(steps.some(step => step.frame.litFixtureIds.length < 46), pattern.id).toBe(true)
      for (const step of steps) {
        for (const ray of step.frame.rays) {
          expect(ray.targetWorld.every(Number.isFinite) && ray.intensity > 0, pattern.id).toBe(true)
        }
      }
    }
  })

  it('mixes lasers that hold a look for a bar with lasers that change within the bar', () => {
    const mixed = CINEMA2_AFTERHOURS_PATTERNS.filter(pattern => pattern.layers.some(layer => layer.bars.some(step => step.gate === 'x==============='))
      && pattern.layers.some(layer => layer.bars.some(step => (step.gate.match(/x/g) ?? []).length >= 4)))
    expect(mixed.length).toBeGreaterThanOrEqual(10)
  })

  it('uses the whole rig across the library: every bank, beam shape and endpoint behaviour', () => {
    const used = new Set<string>()
    for (const pattern of CINEMA2_AFTERHOURS_PATTERNS) {
      for (const { frame } of sample(pattern)) for (const id of frame.litFixtureIds) used.add(id)
    }
    expect(used.size).toBe(46)
    const steps = CINEMA2_AFTERHOURS_PATTERNS.flatMap(pattern => pattern.layers.flatMap(layer => layer.bars))
    expect(steps.some(step => step.beams === 'sheet')).toBe(true)
    expect(steps.some(step => typeof step.beams === 'number' && step.beams >= 8)).toBe(true)
    for (const mode of ['step', 'sweep', 'scatter'] as const) expect(steps.some(step => (step.aimMode ?? 'step') === mode && step.aim.length > 1 || (mode === 'scatter' && step.aimMode === 'scatter'))).toBe(true)
    expect(steps.some(step => step.chaseMode === 'across')).toBe(true)
    expect(CINEMA2_AFTERHOURS_PATTERNS.map(pattern => pattern.energy)).toEqual(expect.arrayContaining(['low', 'mid', 'high', 'build']))
  })
})
