import { describe, it, expect } from 'vitest'
import {
  routePulseAtIntersection,
  findNextIntersection,
  spawnBlockPattern,
  makeBlock,
  makeFlare,
  makeShockwave,
  makePulseOnRail,
  flareLifetimeAlpha,
  blockLifetimeAlpha,
  isPulseExpired,
  isFlareExpired,
  isBlockExpired,
  isShockwaveExpired,
  GRID_COLS,
  GRID_ROWS,
  MAX_PULSES,
  MAX_FLARES,
  MAX_BLOCKS,
  MAX_SHOCKWAVES,
} from '../neonLatticeUtils'
import type { NeonRail } from '../neonLatticeUtils'
import { DEFAULT_NEON_LATTICE_SETTINGS } from '../../ReactTypes'

const settings  = { ...DEFAULT_NEON_LATTICE_SETTINGS }
const palette   = { primary: '74,199,219', secondary: '220,60,190', accent: '220,60,190', highlight: '74,199,219' }

// ── Fixture rail ──────────────────────────────────────────────────────────────

const IDLE_MORPH = {
  morphProgress: 1, morphDuration: 1,
  morphStartPos: 0, morphTargetPos: 0,
  morphStartSpanStart: 0, morphTargetSpanStart: 0,
  morphStartSpanEnd: 1, morphTargetSpanEnd: 1,
} as const

const vertRail: NeonRail = {
  vertical: true, pos: 0.4, spanStart: 0.05, spanEnd: 0.95,
  width: 2, alpha: 0.8, glow: 0.5, depth: 0.7,
  birthSec: 0, lifetime: 4, colorRgb: '74,199,219',
  ...IDLE_MORPH,
}

const horizRail: NeonRail = {
  vertical: false, pos: 0.5, spanStart: 0.1, spanEnd: 0.9,
  width: 1.5, alpha: 0.6, glow: 0.4, depth: 0.5,
  birthSec: 0, lifetime: 3, colorRgb: '230,230,240',
  ...IDLE_MORPH,
}

// ─────────────────────────────────────────────────────────────────────────────
// routePulseAtIntersection
// ─────────────────────────────────────────────────────────────────────────────

describe('routePulseAtIntersection', () => {
  it('is deterministic — same seed and splitCount always returns same route', () => {
    expect(routePulseAtIntersection(0, 42)).toBe(routePulseAtIntersection(0, 42))
    expect(routePulseAtIntersection(1, 99)).toBe(routePulseAtIntersection(1, 99))
  })

  it('only returns valid PulseRoute values', () => {
    const valid = new Set(['continue', 'turn', 'split', 'expire'])
    for (let i = 1; i < 200; i++) {
      expect(valid.has(routePulseAtIntersection(0, hashSeed(i)))).toBe(true)
    }
  })

  it('never returns "split" when splitCount >= 1', () => {
    for (let i = 1; i < 500; i++) {
      const route = routePulseAtIntersection(1, hashSeed(i))
      expect(route).not.toBe('split')
    }
  })

  // Seeds in practice come from hashed intersection positions, not sequential
  // integers — use Knuth multiplicative hashing to produce distributed seeds.
  function hashSeed(i: number): number { return Math.imul(i, 0x9e3779b9) >>> 0 }

  it('can return "split" when splitCount === 0 over many seeds', () => {
    const routes = new Set<string>()
    for (let i = 1; i <= 500; i++) routes.add(routePulseAtIntersection(0, hashSeed(i)))
    expect(routes.has('split')).toBe(true)
  })

  it('all four routes appear across seeds when splitCount === 0', () => {
    const routes = new Set<string>()
    for (let i = 1; i <= 500; i++) routes.add(routePulseAtIntersection(0, hashSeed(i)))
    expect(routes.has('continue')).toBe(true)
    expect(routes.has('turn')).toBe(true)
    expect(routes.has('split')).toBe(true)
    expect(routes.has('expire')).toBe(true)
  })

  it('"continue" is the most common route', () => {
    const counts = { continue: 0, turn: 0, split: 0, expire: 0 }
    for (let i = 1; i <= 1000; i++) {
      const r = routePulseAtIntersection(0, hashSeed(i)) as keyof typeof counts
      counts[r]++
    }
    expect(counts.continue).toBeGreaterThan(counts.turn)
    expect(counts.continue).toBeGreaterThan(counts.split)
    expect(counts.continue).toBeGreaterThan(counts.expire)
    expect(counts.continue).toBeGreaterThan(400)  // > 40 % of 1000
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// findNextIntersection
// ─────────────────────────────────────────────────────────────────────────────

describe('findNextIntersection', () => {
  it('returns null when perpPositions is empty', () => {
    expect(findNextIntersection(0.3, 1, [])).toBeNull()
  })

  it('direction=1: returns closest position ahead (greater than progress)', () => {
    const result = findNextIntersection(0.2, 1, [0.1, 0.4, 0.7])
    expect(result).toBe(0.4)
  })

  it('direction=-1: returns closest position behind (less than progress)', () => {
    const result = findNextIntersection(0.8, -1, [0.3, 0.5, 0.9])
    expect(result).toBe(0.5)
  })

  it('ignores positions exactly equal when already past', () => {
    // direction=1, progress=0.4 — position 0.4 is NOT ahead
    const result = findNextIntersection(0.4, 1, [0.4, 0.6])
    expect(result).toBe(0.6)
  })

  it('returns null when all positions are behind for direction=1', () => {
    expect(findNextIntersection(0.9, 1, [0.1, 0.3, 0.5])).toBeNull()
  })

  it('returns null when all positions are ahead for direction=-1', () => {
    expect(findNextIntersection(0.1, -1, [0.3, 0.7, 0.9])).toBeNull()
  })

  it('handles a single perpendicular position correctly', () => {
    expect(findNextIntersection(0.3, 1,  [0.6])).toBe(0.6)
    expect(findNextIntersection(0.3, -1, [0.6])).toBeNull()
    expect(findNextIntersection(0.3, -1, [0.1])).toBe(0.1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// spawnBlockPattern — bounds
// ─────────────────────────────────────────────────────────────────────────────

describe('spawnBlockPattern — cell bounds', () => {
  const patterns = ['verticalRain', 'diagonalStair', 'centerOutward', 'checker', 'horizontalScan'] as const

  for (const pattern of patterns) {
    it(`${pattern}: all cells within [0,GRID_COLS)×[0,GRID_ROWS)`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const cells = spawnBlockPattern(pattern, seed, 0.7)
        expect(cells.length).toBeGreaterThan(0)
        for (const { col, row } of cells) {
          expect(col).toBeGreaterThanOrEqual(0)
          expect(col).toBeLessThan(GRID_COLS)
          expect(row).toBeGreaterThanOrEqual(0)
          expect(row).toBeLessThan(GRID_ROWS)
        }
      }
    })
  }

  it('verticalRain: all cells share the same column', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cells = spawnBlockPattern('verticalRain', seed, 0.5)
      const cols  = new Set(cells.map(c => c.col))
      expect(cols.size).toBe(1)
    }
  })

  it('horizontalScan: all cells share the same row', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cells = spawnBlockPattern('horizontalScan', seed, 0.5)
      const rows  = new Set(cells.map(c => c.row))
      expect(rows.size).toBe(1)
    }
  })

  it('checker: cells alternate by (col+row)%2===0', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cells = spawnBlockPattern('checker', seed, 0.5)
      for (const { col, row } of cells) {
        expect((col + row) % 2).toBe(0)
      }
    }
  })

  it('centerOutward ring=0: returns exactly the center cell', () => {
    const cells = spawnBlockPattern('centerOutward', 42, 0)
    expect(cells).toHaveLength(1)
    expect(cells[0].col).toBe(Math.floor(GRID_COLS / 2))
    expect(cells[0].row).toBe(Math.floor(GRID_ROWS / 2))
  })

  it('diagonalStair: cells are on a diagonal (diffs of ±1)', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const cells = spawnBlockPattern('diagonalStair', seed, 0.6)
      for (let i = 1; i < cells.length; i++) {
        const dRow = cells[i].row - cells[i - 1].row
        expect(dRow).toBe(1)  // always descends by 1 row
      }
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Lifetime curves
// ─────────────────────────────────────────────────────────────────────────────

describe('flareLifetimeAlpha', () => {
  it('0 at age=0', () => expect(flareLifetimeAlpha(0, 0.3)).toBe(0))
  it('0 at or past lifetime', () => {
    expect(flareLifetimeAlpha(0.3, 0.3)).toBe(0)
    expect(flareLifetimeAlpha(1.0, 0.3)).toBe(0)
  })
  it('1 during sustain phase (~25% of lifetime)', () => {
    expect(flareLifetimeAlpha(0.3 * 0.25, 0.3)).toBeCloseTo(1, 3)
  })
  it('fast attack: high value at 20% of lifetime', () => {
    expect(flareLifetimeAlpha(0.3 * 0.20, 0.3)).toBeGreaterThan(0.9)
  })
  it('decaying past 40% of lifetime', () => {
    const at50  = flareLifetimeAlpha(0.3 * 0.50, 0.3)
    const at80  = flareLifetimeAlpha(0.3 * 0.80, 0.3)
    expect(at80).toBeLessThan(at50)
  })
  it('all values in [0,1]', () => {
    for (let t = 0; t <= 0.35; t += 0.01) {
      const v = flareLifetimeAlpha(t, 0.3)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

describe('blockLifetimeAlpha', () => {
  it('0 at age=0', () => expect(blockLifetimeAlpha(0, 1)).toBe(0))
  it('0 at or past lifetime', () => {
    expect(blockLifetimeAlpha(1, 1)).toBe(0)
    expect(blockLifetimeAlpha(2, 1)).toBe(0)
  })
  it('~1 in mid-life', () => {
    expect(blockLifetimeAlpha(0.4, 1)).toBeGreaterThan(0.95)
  })
  it('fades in last 40%', () => {
    const mid  = blockLifetimeAlpha(0.4, 1)
    const late = blockLifetimeAlpha(0.9, 1)
    expect(late).toBeLessThan(mid)
    expect(late).toBeLessThan(0.3)
  })
  it('all values in [0,1]', () => {
    for (let t = 0; t <= 1.05; t += 0.05) {
      const v = blockLifetimeAlpha(t, 1)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Expiry predicates
// ─────────────────────────────────────────────────────────────────────────────

describe('expiry predicates', () => {
  const birth = 10

  it('isPulseExpired: false before, true at/after', () => {
    const pulse = makePulseOnRail(vertRail, 1, settings, birth, palette, 0.7, 1, 0.5)
    expect(isPulseExpired(pulse, birth)).toBe(false)
    expect(isPulseExpired(pulse, birth + pulse.lifetime)).toBe(true)
    expect(isPulseExpired(pulse, birth + pulse.lifetime + 1)).toBe(true)
  })

  it('isFlareExpired: false before, true at/after', () => {
    const flare = makeFlare(0.5, 0.5, birth, 0.8, '74,199,219', 0.7)
    expect(isFlareExpired(flare, birth)).toBe(false)
    expect(isFlareExpired(flare, birth + flare.lifetime)).toBe(true)
  })

  it('isBlockExpired: false before, true after', () => {
    const block = makeBlock(3, 2, birth, 1.5, '74,199,219', 0.6)
    expect(isBlockExpired(block, birth)).toBe(false)
    expect(isBlockExpired(block, birth + block.lifetime + 1e-6)).toBe(true)
  })

  it('isShockwaveExpired: false before, true after', () => {
    const sw = makeShockwave(0.5, 0.5, birth, 0.9, 0.6, '74,199,219')
    expect(isShockwaveExpired(sw, birth)).toBe(false)
    expect(isShockwaveExpired(sw, birth + sw.lifetime + 1e-6)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Object caps
// ─────────────────────────────────────────────────────────────────────────────

describe('object caps', () => {
  it('MAX_PULSES is 24',     () => expect(MAX_PULSES).toBe(24))
  it('MAX_FLARES is 12',     () => expect(MAX_FLARES).toBe(12))
  it('MAX_BLOCKS is 40',     () => expect(MAX_BLOCKS).toBe(40))
  it('MAX_SHOCKWAVES is 4',  () => expect(MAX_SHOCKWAVES).toBe(4))

  it('GRID_COLS × GRID_ROWS covers 99 cells', () => {
    expect(GRID_COLS * GRID_ROWS).toBe(99)
  })

  it('makePulseOnRail returns exactly one pulse object per call', () => {
    const p = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.7, 1, 0.5)
    expect(typeof p).toBe('object')
    expect(Array.isArray(p)).toBe(false)
    expect(p.lifetime).toBeGreaterThan(0)
  })

  it('makeBlock returns exactly one block object per call', () => {
    const b = makeBlock(0, 0, 0, 1.0, '74,199,219', 0.5)
    expect(typeof b).toBe('object')
    expect(Array.isArray(b)).toBe(false)
    expect(b.lifetime).toBeGreaterThan(0)
  })

  it('makeFlare returns exactly one flare object per call', () => {
    const f = makeFlare(0.5, 0.5, 0, 0.8, palette.primary, 0.5)
    expect(typeof f).toBe('object')
    expect(Array.isArray(f)).toBe(false)
    expect(f.lifetime).toBeGreaterThan(0)
  })

  it('makeShockwave returns exactly one shockwave object per call', () => {
    const sw = makeShockwave(0.5, 0.5, 0, 0.8, 0.6, palette.primary)
    expect(typeof sw).toBe('object')
    expect(Array.isArray(sw)).toBe(false)
    expect(sw.lifetime).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// makePulseOnRail
// ─────────────────────────────────────────────────────────────────────────────

describe('makePulseOnRail', () => {
  it('starts at spanStart for direction=1', () => {
    const p = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.7, 1, 0.5)
    expect(p.progress).toBeCloseTo(vertRail.spanStart)
  })

  it('starts at spanEnd for direction=-1', () => {
    const p = makePulseOnRail(vertRail, -1, settings, 0, palette, 0.7, 1, 0.5)
    expect(p.progress).toBeCloseTo(vertRail.spanEnd)
  })

  it('inherits rail.vertical and rail.pos', () => {
    const p = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.7, 1, 0.5)
    expect(p.vertical).toBe(true)
    expect(p.railPos).toBeCloseTo(vertRail.pos)
  })

  it('horizontal rail produces horizontal pulse', () => {
    const p = makePulseOnRail(horizRail, 1, settings, 0, palette, 0.5, 5, 0.5)
    expect(p.vertical).toBe(false)
    expect(p.railPos).toBeCloseTo(horizRail.pos)
  })

  it('higher strength → higher brightness', () => {
    const weak   = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.1, 1, 0.5)
    const strong = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.9, 1, 0.5)
    expect(strong.brightness).toBeGreaterThan(weak.brightness)
  })

  it('splitCount starts at 0', () => {
    const p = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.7, 1, 0.5)
    expect(p.splitCount).toBe(0)
  })

  it('positive lifetime', () => {
    const p = makePulseOnRail(vertRail, 1, settings, 0, palette, 0.7, 1, 0.5)
    expect(p.lifetime).toBeGreaterThan(0)
  })
})
