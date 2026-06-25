// ── Neon Lattice utility types and helpers ────────────────────────────────────
// These are pure functions with no side effects; safe to import from tests.

import type { NeonLatticeSettings, NeonLatticeTrigger } from '../ReactTypes'

// ── Rail model ────────────────────────────────────────────────────────────────

/** A single rail line in normalized canvas space. */
export interface NeonRail {
  /** true = vertical line at x=pos, false = horizontal line at y=pos */
  vertical:   boolean
  /** Normalized position along the perpendicular axis (0–1). */
  pos:        number
  /** Normalized start along the rail's own axis (0–1). */
  spanStart:  number
  /** Normalized end along the rail's own axis (0–1). */
  spanEnd:    number
  /** Line width in logical pixels (not yet DPR-scaled). */
  width:      number
  /** Base alpha before intensity/lifetime modulation (0–1). */
  alpha:      number
  /** Bloom radius multiplier (0–1). */
  glow:       number
  /** Depth layer (0 = far/dim, 1 = near/bright). */
  depth:      number
  /** Audio time when the rail was born. */
  birthSec:   number
  /** Lifetime in seconds before full fade-out. */
  lifetime:   number
  /** Packed RGB string, e.g. '74,199,219'. */
  colorRgb:   string
  // ── Morph fields ────────────────────────────────────────────────────────────
  // morphProgress = 1 means "at target / not morphing".
  // beginLayoutReseed sets it to 0 and supplies new targets; advanceRailMorph
  // interpolates pos/spanStart/spanEnd toward the targets each frame.
  /** 0 = morph just started, 1 = complete/idle. */
  morphProgress:        number
  /** Duration in seconds for this rail's morph to complete. */
  morphDuration:        number
  /** pos value when the morph started. */
  morphStartPos:        number
  /** pos target (normalized 0–1). */
  morphTargetPos:       number
  /** spanStart value when the morph started. */
  morphStartSpanStart:  number
  /** spanStart target (normalized 0–1). */
  morphTargetSpanStart: number
  /** spanEnd value when the morph started. */
  morphStartSpanEnd:    number
  /** spanEnd target (normalized 0–1). */
  morphTargetSpanEnd:   number
}

// ── Seeded PRNG (xorshift32) ──────────────────────────────────────────────────
// Produces deterministic pseudo-random values from an integer seed so geometry
// stays stable frame-to-frame and only changes on musical events.

export function xorshift32(seed: number): number {
  let s = seed >>> 0
  if (s === 0) s = 1
  s ^= s << 13
  s ^= s >>> 17
  s ^= s << 5
  return (s >>> 0) / 0xffffffff
}

/** Advance a seed and return [value, nextSeed]. */
export function prngNext(seed: number): [number, number] {
  let s = seed >>> 0
  if (s === 0) s = 1
  s ^= s << 13
  s ^= s >>> 17
  s ^= s << 5
  s = s >>> 0
  return [s / 0xffffffff, s]
}

// ── Palette RGB bundle ────────────────────────────────────────────────────────

/** Four palette roles as pre-converted 'r,g,b' strings. */
export interface NeonPaletteRgb {
  primary:   string
  secondary: string
  accent:    string
  highlight: string
}

// ── Lane selection ────────────────────────────────────────────────────────────

const MAX_VERT  = 12
const MAX_HORIZ = 10

export { MAX_VERT, MAX_HORIZ }

// ── Behavior resolvers ────────────────────────────────────────────────────────

/**
 * Returns per-orientation rail count targets driven by railDensity and verticalBias.
 * At zero density both targets are zero (automatic spawning suppressed).
 */
export function resolveRailTargets(
  railDensity:  number,
  verticalBias: number,
): { targetVert: number; targetHoriz: number } {
  const d = Math.max(0, Math.min(1, railDensity))
  const v = Math.max(0, Math.min(1, verticalBias))
  return {
    targetVert:  Math.round(d * v * MAX_VERT),
    targetHoriz: Math.round(d * (1 - v) * MAX_HORIZ),
  }
}

/**
 * Returns the musical subdivision slot index for the given audio time.
 * Two times in the same slot must not fire the same automatic event twice.
 * Returns 0 when bpm or snapDivision are zero.
 */
export function resolveSnapSlot(
  audioTime:    number,
  bpm:          number,
  snapDivision: number,
): number {
  if (bpm <= 0 || snapDivision <= 0) return 0
  const subBeatSec = (60 / bpm) / snapDivision
  return Math.floor(audioTime / subBeatSec)
}

/**
 * Chooses a lane index for a new vertical rail such that lanes are spread
 * across available slots. Returns a 0-based index in [0, MAX_VERT).
 * Deterministic: same seed → same lane.
 */
export function selectVerticalLane(seed: number, existing: NeonRail[]): number {
  const occupied = new Set(
    existing.filter(r => r.vertical).map(r => Math.round(r.pos * (MAX_VERT - 1)))
  )
  // Try up to 8 candidate positions; prefer unoccupied
  let best = 0
  let [v, s] = prngNext(seed)
  best = Math.round(v * (MAX_VERT - 1))
  for (let i = 0; i < 8; i++) {
    ;[v, s] = prngNext(s)
    const candidate = Math.round(v * (MAX_VERT - 1))
    if (!occupied.has(candidate)) return candidate
    if (!occupied.has(best)) break
    best = candidate
  }
  return best
}

/**
 * Chooses a lane index for a new horizontal rail.
 * Deterministic: same seed → same lane.
 */
export function selectHorizontalLane(seed: number, existing: NeonRail[]): number {
  const occupied = new Set(
    existing.filter(r => !r.vertical).map(r => Math.round(r.pos * (MAX_HORIZ - 1)))
  )
  let best = 0
  let [v, s] = prngNext(seed)
  best = Math.round(v * (MAX_HORIZ - 1))
  for (let i = 0; i < 8; i++) {
    ;[v, s] = prngNext(s)
    const candidate = Math.round(v * (MAX_HORIZ - 1))
    if (!occupied.has(candidate)) return candidate
    if (!occupied.has(best)) break
    best = candidate
  }
  return best
}

// ── Rail factory ──────────────────────────────────────────────────────────────

/**
 * Build a vertical rail seeded from the given integer.
 * pos is biased toward the center when centerBias > 0.
 */
export function makeVerticalRail(
  seed: number,
  settings: NeonLatticeSettings,
  audioTime: number,
  existing: NeonRail[],
  paletteRgb: NeonPaletteRgb,
  strength: number,
): NeonRail {
  const lane     = selectVerticalLane(seed, existing)
  let   norm     = lane / (MAX_VERT - 1)        // 0–1
  // Center bias pulls positions away from edges
  norm           = 0.1 + norm * 0.8             // keep off extreme edges
  const cb       = settings.centerBias * 0.3
  norm           = norm * (1 - cb) + 0.5 * cb   // blend toward centre

  let [r, s] = prngNext(seed + 1)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s]           = prngNext(s)
  const isSecondary = !isHighlight && r < 0.4

  const colorRgb = isHighlight ? paletteRgb.highlight : isSecondary ? paletteRgb.secondary : paletteRgb.primary

  ;[r, s]        = prngNext(s)
  const spanY0   = r * 0.15
  ;[r, s]        = prngNext(s)
  const spanY1   = 0.85 + r * 0.15

  ;[r]           = prngNext(s)
  const depth    = 0.25 + r * 0.75

  const rawLifetime = settings.railLifetime * (0.7 + strength * 0.5)

  return {
    vertical:  true,
    pos:       norm,
    spanStart: spanY0,
    spanEnd:   spanY1,
    width:     depth * (1.5 + strength * 1.5),
    alpha:     0.5 + strength * 0.4,
    glow:      settings.bloom * (0.5 + strength * 0.5),
    depth,
    birthSec:  audioTime,
    lifetime:  rawLifetime,
    colorRgb,
    // Morph fields: idle (already at target, no animation in progress)
    morphProgress:        1,
    morphDuration:        1,
    morphStartPos:        norm,
    morphTargetPos:       norm,
    morphStartSpanStart:  spanY0,
    morphTargetSpanStart: spanY0,
    morphStartSpanEnd:    spanY1,
    morphTargetSpanEnd:   spanY1,
  }
}

/**
 * Build a horizontal rail seeded from the given integer.
 */
export function makeHorizontalRail(
  seed: number,
  settings: NeonLatticeSettings,
  audioTime: number,
  existing: NeonRail[],
  paletteRgb: NeonPaletteRgb,
  strength: number,
): NeonRail {
  const lane  = selectHorizontalLane(seed, existing)
  let   norm  = lane / Math.max(1, MAX_HORIZ - 1)
  norm        = 0.1 + norm * 0.8
  const cb    = settings.centerBias * 0.25
  norm        = norm * (1 - cb) + 0.5 * cb

  let [r, s]  = prngNext(seed + 7)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s]     = prngNext(s)

  // Horizontal rails: highlight, secondary, or primary
  const colorRgb = isHighlight ? paletteRgb.highlight : r < 0.4 ? paletteRgb.secondary : paletteRgb.primary

  ;[r, s]     = prngNext(s)
  // Shorter spans — snare hits produce tighter dashes
  const halfSpan = 0.15 + r * 0.35
  ;[r, s]     = prngNext(s)
  const cx    = 0.2 + r * 0.6
  const x0    = Math.max(0, cx - halfSpan)
  const x1    = Math.min(1, cx + halfSpan)

  ;[r]        = prngNext(s)
  const depth = 0.15 + r * 0.65

  const rawLifetime = settings.railLifetime * 0.6 * (0.6 + strength * 0.4)

  return {
    vertical:  false,
    pos:       norm,
    spanStart: x0,
    spanEnd:   x1,
    width:     depth * (1.0 + strength),
    alpha:     0.35 + strength * 0.35,
    glow:      settings.bloom * (0.3 + strength * 0.4),
    depth,
    birthSec:  audioTime,
    lifetime:  rawLifetime,
    colorRgb,
    // Morph fields: idle
    morphProgress:        1,
    morphDuration:        1,
    morphStartPos:        norm,
    morphTargetPos:       norm,
    morphStartSpanStart:  x0,
    morphTargetSpanStart: x0,
    morphStartSpanEnd:    x1,
    morphTargetSpanEnd:   x1,
  }
}

// ── Lifetime alpha ────────────────────────────────────────────────────────────

/**
 * Returns a 0–1 modulation factor based on age relative to lifetime.
 * Fades in over 8 % of lifetime; fades out over the last 30 %.
 */
export function railLifetimeAlpha(age: number, lifetime: number): number {
  if (age <= 0 || lifetime <= 0) return 0
  const t = age / lifetime
  if (t >= 1) return 0
  const fadeIn  = Math.min(1, t / 0.08)
  const fadeOut = t > 0.70 ? 1 - (t - 0.70) / 0.30 : 1
  return fadeIn * fadeOut
}

// ── Expiry check ──────────────────────────────────────────────────────────────

export function isRailExpired(rail: NeonRail, audioTime: number): boolean {
  return audioTime - rail.birthSec >= rail.lifetime
}

// ── Palette RGB extraction ────────────────────────────────────────────────────

/** Parse '#rrggbb' or 'rgb(r,g,b)' to 'r,g,b' string. Falls back to cyan. */
export function hexToRgbStr(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (m) return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
  const m2 = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(hex.trim())
  if (m2) return `${m2[1]},${m2[2]},${m2[3]}`
  return '74,199,219'
}

// ── Grid constants ─────────────────────────────────────────────────────────────
// Cells are the rectangular spaces between adjacent rail lines.

/** Number of cell columns (between MAX_VERT vertical rail lanes). */
export const GRID_COLS = MAX_VERT - 1   // 11
/** Number of cell rows (between MAX_HORIZ horizontal rail lanes). */
export const GRID_ROWS = MAX_HORIZ - 1  // 9

// ── Object caps ────────────────────────────────────────────────────────────────

export const MAX_PULSES     = 24
export const MAX_FLARES     = 12
export const MAX_BLOCKS     = 40
export const MAX_SHOCKWAVES = 4

// ── Pulse model ────────────────────────────────────────────────────────────────

export interface NeonPulse {
  /** true = pulse on a vertical rail (moves along Y). */
  vertical:   boolean
  /** Normalized perpendicular-axis position of the rail (X if vertical, Y if horizontal). */
  railPos:    number
  /** Normalized current position along the rail's own axis (Y if vertical, X if horizontal). */
  progress:   number
  /** +1 = downward/rightward, -1 = upward/leftward. */
  direction:  1 | -1
  /** Normalized canvas units per second. */
  speed:      number
  /** 0–1 peak brightness. */
  brightness: number
  /** Normalized canvas radius of the pulse head. */
  radius:     number
  colorRgb:   string
  birthSec:   number
  lifetime:   number
  depth:      number
  /** How many child pulses this object has already spawned (cap: 1). */
  splitCount: number
}

// ── Flare model ────────────────────────────────────────────────────────────────

export interface NeonFlare {
  /** Normalized canvas X (0–1). */
  x:          number
  /** Normalized canvas Y (0–1). */
  y:          number
  birthSec:   number
  /** Typical range: 0.18–0.33 seconds. */
  lifetime:   number
  brightness: number
  /** Visual size multiplier (1.0 = normal). Driven by flareAmount. */
  scale:      number
  paletteRgb: string
  depth:      number
}

// ── Block model ────────────────────────────────────────────────────────────────

export type BlockPattern =
  | 'verticalRain'
  | 'diagonalStair'
  | 'centerOutward'
  | 'checker'
  | 'horizontalScan'

export interface GridCell { col: number; row: number }

export interface NeonBlock {
  /** Cell column index: 0 to GRID_COLS-1. */
  col:      number
  /** Cell row index: 0 to GRID_ROWS-1. */
  row:      number
  birthSec: number
  lifetime: number
  alpha:    number
  colorRgb: string
  /** Depth layer (0 = far/background, 1 = near/foreground). */
  depth:    number
}

// ── Shockwave model ────────────────────────────────────────────────────────────

export interface NeonShockwave {
  /** Normalized center X (0–1). */
  cx:       number
  /** Normalized center Y (0–1). */
  cy:       number
  birthSec: number
  lifetime: number
  strength: number
  colorRgb: string
}

// ── Pulse routing ──────────────────────────────────────────────────────────────

export type PulseRoute = 'continue' | 'turn' | 'split' | 'expire'

/**
 * Deterministically choose how a pulse behaves at a rail intersection.
 * Split is only allowed when `splitCount === 0` (prevents recursive chains).
 */
export function routePulseAtIntersection(splitCount: number, seed: number): PulseRoute {
  const [v] = prngNext(seed)
  if (v < 0.55) return 'continue'
  if (v < 0.70) return 'turn'
  if (v < 0.85) return splitCount === 0 ? 'split' : 'turn'
  return 'expire'
}

/**
 * Given a pulse's current progress and direction, return the normalized
 * position of the nearest perpendicular rail ahead, or null if none.
 */
export function findNextIntersection(
  progress:       number,
  direction:      1 | -1,
  perpPositions:  number[],
): number | null {
  let best: number | null = null
  for (const pos of perpPositions) {
    if (direction === 1) {
      if (pos > progress && (best === null || pos < best)) best = pos
    } else {
      if (pos < progress && (best === null || pos > best)) best = pos
    }
  }
  return best
}

// ── Pulse factory ──────────────────────────────────────────────────────────────

/**
 * Create a pulse that starts at one end of `rail` and travels to the other.
 */
export function makePulseOnRail(
  rail:        NeonRail,
  direction:   1 | -1,
  settings:    NeonLatticeSettings,
  audioTime:   number,
  paletteRgb:  NeonPaletteRgb,
  strength:    number,
  seed:        number,
  motionScale: number,
): NeonPulse {
  // Clamp minimum speed so zero pulseSpeed never creates permanent stationary pulses
  const rawSpeed    = settings.pulseSpeed * (0.20 + strength * 0.40) * Math.max(0.1, motionScale)
  const speed       = Math.max(0.06, rawSpeed)
  const railLength  = Math.max(0.05, rail.spanEnd - rail.spanStart)
  const lifetime    = Math.min(4.0, railLength / speed * (0.8 + strength * 0.2))
  const startProg   = direction === 1 ? rail.spanStart : rail.spanEnd

  let [r, s] = prngNext(seed + 3)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s] = prngNext(s)
  const colorRgb = isHighlight ? paletteRgb.highlight : r < 0.30 ? paletteRgb.secondary : paletteRgb.primary
  ;[r]    = prngNext(s)
  const radius = 0.007 + r * 0.011

  return {
    vertical:   rail.vertical,
    railPos:    rail.pos,
    progress:   startProg,
    direction,
    speed,
    brightness: 0.55 + strength * 0.45,
    radius,
    colorRgb,
    birthSec:   audioTime,
    lifetime,
    depth:      rail.depth,
    splitCount: 0,
  }
}

// ── Flare factory ──────────────────────────────────────────────────────────────

export function makeFlare(
  x:          number,
  y:          number,
  audioTime:  number,
  strength:   number,
  paletteRgb: string,
  depth:      number,
  scale       = 1.0,
): NeonFlare {
  return {
    x, y,
    birthSec:   audioTime,
    lifetime:   0.18 + strength * 0.15,
    brightness: 0.5 + strength * 0.5,
    scale,
    paletteRgb,
    depth,
  }
}

// ── Block pattern spawner ──────────────────────────────────────────────────────

/**
 * Return a list of grid cells for the given pattern.
 * All returned cells are guaranteed to be within [0,GRID_COLS)×[0,GRID_ROWS).
 */
export function spawnBlockPattern(
  pattern:  BlockPattern,
  seed:     number,
  strength: number,
): GridCell[] {
  const cells: GridCell[] = []

  switch (pattern) {
    case 'verticalRain': {
      let [r, s] = prngNext(seed)
      const col     = Math.min(GRID_COLS - 1, Math.floor(r * GRID_COLS))
      ;[r, s]       = prngNext(s)
      const startRow = Math.floor(r * Math.floor(GRID_ROWS * 0.4))
      const count    = Math.round(3 + strength * 3)
      for (let i = 0; i < count; i++) {
        cells.push({ col, row: (startRow + i) % GRID_ROWS })
      }
      break
    }

    case 'diagonalStair': {
      let [r, s] = prngNext(seed)
      const col0 = Math.floor(r * Math.max(1, GRID_COLS - 4))
      ;[r, s]    = prngNext(s)
      const row0 = Math.floor(r * Math.max(1, GRID_ROWS - 4))
      ;[r]       = prngNext(s)
      const dx   = r < 0.5 ? 1 : -1
      const count = Math.round(3 + strength * 2)
      for (let i = 0; i < count; i++) {
        const col = Math.max(0, Math.min(GRID_COLS - 1, col0 + i * dx))
        const row = Math.max(0, Math.min(GRID_ROWS - 1, row0 + i))
        cells.push({ col, row })
      }
      break
    }

    case 'centerOutward': {
      const cx   = Math.floor(GRID_COLS / 2)
      const cy   = Math.floor(GRID_ROWS / 2)
      const ring = Math.round(strength * 2)
      if (ring === 0) {
        cells.push({ col: cx, row: cy })
      } else {
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dy = -ring; dy <= ring; dy++) {
            if (Math.abs(dx) + Math.abs(dy) === ring) {
              cells.push({
                col: Math.max(0, Math.min(GRID_COLS - 1, cx + dx)),
                row: Math.max(0, Math.min(GRID_ROWS - 1, cy + dy)),
              })
            }
          }
        }
      }
      break
    }

    case 'checker': {
      let [r, s] = prngNext(seed)
      const col0 = Math.floor(r * Math.max(1, GRID_COLS - 4))
      ;[r]       = prngNext(s)
      const row0 = Math.floor(r * Math.max(1, GRID_ROWS - 3))
      for (let dc = 0; dc <= 3; dc++) {
        for (let dr = 0; dr <= 2; dr++) {
          if ((dc + dr) % 2 === 0) {
            cells.push({
              col: Math.min(GRID_COLS - 1, col0 + dc),
              row: Math.min(GRID_ROWS - 1, row0 + dr),
            })
          }
        }
      }
      break
    }

    case 'horizontalScan': {
      let [r] = prngNext(seed)
      const row = Math.min(GRID_ROWS - 1, Math.floor(r * GRID_ROWS))
      for (let col = 0; col < GRID_COLS; col += 2) {
        cells.push({ col, row })
      }
      break
    }
  }

  return cells
}

// ── Block factory ──────────────────────────────────────────────────────────────

export function makeBlock(
  col:      number,
  row:      number,
  audioTime: number,
  holdSec:  number,
  colorRgb: string,
  strength: number,
  depth:    number = 0.5,   // 0=far, 1=near; default = midground
): NeonBlock {
  return {
    col, row,
    birthSec: audioTime,
    lifetime: holdSec * (0.6 + strength * 0.6),
    alpha:    0.09 + strength * 0.09,
    colorRgb,
    depth,
  }
}

// ── Shockwave factory ──────────────────────────────────────────────────────────

export function makeShockwave(
  cx:         number,
  cy:         number,
  audioTime:  number,
  strength:   number,
  speedScale: number,
  colorRgb:   string,
): NeonShockwave {
  return {
    cx, cy,
    birthSec: audioTime,
    lifetime: 0.55 / Math.max(0.15, speedScale),
    strength,
    colorRgb,
  }
}

// ── Lifetime curves ────────────────────────────────────────────────────────────

/**
 * Fast attack (0→1 in the first 15 % of lifetime), sustain, then linear decay
 * to 0 by end of lifetime. Used for flares.
 */
export function flareLifetimeAlpha(age: number, lifetime: number): number {
  if (age <= 0 || lifetime <= 0) return 0
  const t = age / lifetime
  if (t >= 1) return 0
  if (t < 0.15) return t / 0.15
  if (t < 0.40) return 1
  return 1 - (t - 0.40) / 0.60
}

/**
 * Quick fade-in (5 % of lifetime), long sustain, fade-out over last 40 %.
 * Used for block cells.
 */
export function blockLifetimeAlpha(age: number, lifetime: number): number {
  if (age <= 0 || lifetime <= 0) return 0
  const t = age / lifetime
  if (t >= 1) return 0
  const fadeIn  = Math.min(1, t / 0.05)
  const fadeOut = t > 0.60 ? 1 - (t - 0.60) / 0.40 : 1
  return fadeIn * fadeOut
}

// ── Expiry predicates ──────────────────────────────────────────────────────────

export function isPulseExpired(pulse: NeonPulse, audioTime: number): boolean {
  return audioTime - pulse.birthSec >= pulse.lifetime
}

export function isFlareExpired(flare: NeonFlare, audioTime: number): boolean {
  return audioTime - flare.birthSec >= flare.lifetime
}

export function isBlockExpired(block: NeonBlock, audioTime: number): boolean {
  return audioTime - block.birthSec >= block.lifetime
}

export function isShockwaveExpired(sw: NeonShockwave, audioTime: number): boolean {
  return audioTime - sw.birthSec >= sw.lifetime
}

// ── Depth plane constants and helpers ─────────────────────────────────────────

/** Canonical depth value for the background plane (far, dim, narrow). */
export const DEPTH_BG = 0.15
/** Canonical depth value for the midground plane. */
export const DEPTH_MG = 0.50
/** Canonical depth value for the foreground plane (near, bright, wide). */
export const DEPTH_FG = 0.85

export type DepthPlane = 'background' | 'midground' | 'foreground'

/**
 * Classify a continuous depth value (0=far, 1=near) into a named plane.
 * Boundaries: background [0, 1/3), midground [1/3, 2/3), foreground [2/3, 1].
 */
export function resolveDepthPlane(depth: number): DepthPlane {
  if (depth < 1 / 3) return 'background'
  if (depth < 2 / 3) return 'midground'
  return 'foreground'
}

// ── Depth / parallax helpers ───────────────────────────────────────────────────

/**
 * Compute per-rail visual modifiers from the depth setting and the rail's own
 * depth value.
 *
 * `railDepth` is 0–1: **0 = far/background** (dim, narrow, slow),
 * **1 = near/foreground** (bright, wide, fast). This matches the convention in
 * `NeonRail.depth`.
 * `depth` setting 0 = flat (no differentiation), 1 = maximum differentiation.
 */
export function resolveDepthModifiers(
  depth:     number,   // settings.depth 0–1
  railDepth: number,   // rail/object depth: 0=far, 1=near
): { alphaMul: number; intensityMul: number; widthMul: number; speedMul: number; reactivityMul: number } {
  const near = Math.max(0, Math.min(1, railDepth))
  const far  = 1 - near                             // 1 when railDepth=0 (background)
  const d    = Math.max(0, Math.min(1, depth))
  return {
    alphaMul:      1.0 - far * d * 0.60,  // background elements dimmer
    intensityMul:  1.0 - far * d * 0.35,  // background elements less intense
    widthMul:      1.0 - far * d * 0.50,  // background elements narrower
    speedMul:      1.0 - far * d * 0.25,  // background pulses move slower
    reactivityMul: 1.0 - far * d * 0.40,  // background elements less bass-reactive
  }
}

/**
 * Compute the normalized x-axis parallax shift for an object at a given depth.
 * Returns a value in [-parallax, +parallax] to multiply by W before applying.
 *
 * With convention **0 = far, 1 = near**:
 * - Near objects (depth=1) shift positively with positive cameraDriftX.
 * - Far objects (depth=0) shift negatively (opposite direction).
 * - Midground (depth=0.5) has zero shift.
 * Returns 0 when `cameraDriftX` is 0 or `parallax` is 0.
 */
export function resolveCameraParallaxShift(
  railDepth:    number,  // 0=far, 1=near
  cameraDriftX: number,  // normalized camera offset (-1 to 1)
  parallax:     number,  // settings.parallax 0–1
): number {
  return cameraDriftX * (railDepth - 0.5) * parallax * 2.0
}

// ── Rail morph helpers ────────────────────────────────────────────────────────

/** Minimum morph animation duration in seconds. */
export const MORPH_DURATION_MIN = 1.5
/** Maximum morph animation duration in seconds. */
export const MORPH_DURATION_MAX = 2.5

/** Smoothstep easing (S-curve, clamped to [0,1]). */
function smoothstep(t: number): number {
  const tc = Math.max(0, Math.min(1, t))
  return tc * tc * (3 - 2 * tc)
}

/**
 * Compute a new morph target position and span for a vertical rail.
 * Biases toward positions that differ from `currentPos` by at least a small
 * distance so reseeds are visually distinct.
 *
 * All returned values are in normalized canvas space [0, 1].
 */
export function computeVertRailMorphTarget(
  currentPos: number,
  seed:       number,
  centerBias: number,
): { targetPos: number; targetSpanStart: number; targetSpanEnd: number } {
  const cb = Math.max(0, Math.min(1, centerBias)) * 0.3
  let [r, s] = prngNext(seed)
  // Try several candidates; keep the one with the greatest distance from currentPos
  let bestLane = Math.round(r * (MAX_VERT - 1))
  let bestDist = 0
  for (let i = 0; i < 10; i++) {
    ;[r, s]         = prngNext(s)
    const candidate = Math.round(r * (MAX_VERT - 1))
    let   norm      = candidate / (MAX_VERT - 1)
    norm            = 0.1 + norm * 0.8
    norm            = norm * (1 - cb) + 0.5 * cb
    const dist      = Math.abs(norm - currentPos)
    if (dist > bestDist) { bestDist = dist; bestLane = candidate }
    if (dist >= 0.12) break  // sufficient separation found
  }
  let targetPos = bestLane / (MAX_VERT - 1)
  targetPos     = 0.1 + targetPos * 0.8
  targetPos     = targetPos * (1 - cb) + 0.5 * cb

  ;[r, s]                  = prngNext(s)
  const targetSpanStart    = r * 0.15
  ;[r]                     = prngNext(s)
  const targetSpanEnd      = 0.85 + r * 0.15

  return { targetPos, targetSpanStart, targetSpanEnd }
}

/**
 * Compute a new morph target position and span for a horizontal rail.
 */
export function computeHorizRailMorphTarget(
  currentPos: number,
  seed:       number,
  centerBias: number,
): { targetPos: number; targetSpanStart: number; targetSpanEnd: number } {
  const cb = Math.max(0, Math.min(1, centerBias)) * 0.25
  let [r, s] = prngNext(seed)
  let bestLane = Math.round(r * (MAX_HORIZ - 1))
  let bestDist = 0
  for (let i = 0; i < 10; i++) {
    ;[r, s]         = prngNext(s)
    const candidate = Math.round(r * (MAX_HORIZ - 1))
    let   norm      = candidate / Math.max(1, MAX_HORIZ - 1)
    norm            = 0.1 + norm * 0.8
    norm            = norm * (1 - cb) + 0.5 * cb
    const dist      = Math.abs(norm - currentPos)
    if (dist > bestDist) { bestDist = dist; bestLane = candidate }
    if (dist >= 0.12) break
  }
  let targetPos = bestLane / Math.max(1, MAX_HORIZ - 1)
  targetPos     = 0.1 + targetPos * 0.8
  targetPos     = targetPos * (1 - cb) + 0.5 * cb

  ;[r, s]               = prngNext(s)
  const halfSpan        = 0.15 + r * 0.35
  ;[r, s]               = prngNext(s)
  const cx              = 0.2 + r * 0.6
  const targetSpanStart = Math.max(0, cx - halfSpan)
  const targetSpanEnd   = Math.min(1, cx + halfSpan)

  return { targetPos, targetSpanStart, targetSpanEnd }
}

/**
 * Advance a rail's morph animation by `dt` seconds in place.
 * Interpolates `pos`, `spanStart`, and `spanEnd` toward their morph targets
 * using smoothstep easing.  Does nothing when `morphProgress >= 1`.
 */
export function advanceRailMorph(rail: NeonRail, dt: number): void {
  if (rail.morphProgress >= 1) return
  rail.morphProgress = Math.min(1, rail.morphProgress + dt / Math.max(0.01, rail.morphDuration))
  const t = smoothstep(rail.morphProgress)
  rail.pos       = rail.morphStartPos       + (rail.morphTargetPos       - rail.morphStartPos)       * t
  rail.spanStart = rail.morphStartSpanStart + (rail.morphTargetSpanStart - rail.morphStartSpanStart) * t
  rail.spanEnd   = rail.morphStartSpanEnd   + (rail.morphTargetSpanEnd   - rail.morphStartSpanEnd)   * t
}

// ── Section / MI helpers ───────────────────────────────────────────────────────

import type { ReactSectionType } from '../ReactTypes'

/**
 * Resolve the effective NL section type using manual-section priority.
 * Order: manualSectionType → MI section → null.
 */
export function resolveEffectiveSection(
  manualSectionType: ReactSectionType | null,
  miSectionType:     ReactSectionType | null,
): ReactSectionType | null {
  return manualSectionType ?? miSectionType ?? null
}

/**
 * Compute a spawn probability multiplier for event-based rail / pulse spawning.
 * Returns > 1 for high-energy sections (drop) and < 1 for sparse sections (intro).
 *
 * Values are supplemental — they scale the density target, not replace it.
 */
export function resolveSectionSpawnMul(
  sectionType:     ReactSectionType | null,
  buildProgress:   number,  // 0–1
  dropImpact:      number,  // 0–1
  tension:         number,  // 0–1
  sectionProgress: number,  // 0–1
): number {
  switch (sectionType) {
    case 'intro':     return 0.25
    case 'verse':     return 0.60
    case 'build':     return 0.60 + Math.max(0, Math.min(1, buildProgress)) * 0.45
    case 'preDrop':   return 0.30 + Math.max(0, Math.min(1, tension)) * 0.20
    case 'drop':      return 1.00 + Math.max(0, Math.min(1, dropImpact)) * 0.25
    case 'breakdown': return 0.30
    case 'bridge':    return 0.65
    case 'outro':     return 0.25 + (1.0 - Math.max(0, Math.min(1, sectionProgress))) * 0.30
    default:          return 1.0
  }
}

// ── Per-section visual behavior ────────────────────────────────────────────────

/**
 * Visual modifiers the Neon Lattice renderer applies for a given musical section.
 * All multipliers scale on top of the user-facing settings so section behavior
 * adjusts relative to the preset rather than replacing it.
 */
export interface NLSectionBehavior {
  /** Multiplier for automatic rail spawn targets. */
  railSpawnMul:      number
  /** Multiplier applied to settings.pulseSpeed. */
  pulseSpeedMul:     number
  /** Additive shift on params.trailDecay (positive = faster fade). */
  decayAdjust:       number
  /** Multiplier applied to settings.bloom. */
  glowMul:           number
  /** Multiplier applied to settings.blockDensity. */
  blockMul:          number
  /** When false, shockwaves are suppressed regardless of settings.shockwaveAmount. */
  shockwavesAllowed: boolean
  /** Additive shift on settings.centerBias (positive = more centered). */
  centerBiasAdd:     number
  /** Multiplier applied to settings.railLifetime. */
  lifetimeMul:       number
  /** True only on the first renderer frame after entering a new section. */
  isEntryFrame:      boolean
}

/**
 * Compute section-specific visual behavior modifiers.
 * Pure function; safe to call from tests and in every render frame.
 *
 * Smooth MI signals (buildProgress, dropImpact, tension, sectionProgress)
 * drive continuous interpolation within each section.  `prevSectionType`
 * drives one-shot entry detection via `isEntryFrame`.
 */
export function resolveSectionBehavior(
  sectionType:     ReactSectionType | null,
  buildProgress:   number,  // 0–1
  dropImpact:      number,  // 0–1
  tension:         number,  // 0–1
  sectionProgress: number,  // 0–1 through the section
  prevSectionType: ReactSectionType | null,
): NLSectionBehavior {
  const isEntryFrame = sectionType !== prevSectionType
  const bp  = Math.max(0, Math.min(1, buildProgress))
  const di  = Math.max(0, Math.min(1, dropImpact))
  const tn  = Math.max(0, Math.min(1, tension))
  const sp  = Math.max(0, Math.min(1, sectionProgress))

  switch (sectionType) {
    case 'intro': return {
      railSpawnMul:      0.25,
      pulseSpeedMul:     0.70,
      decayAdjust:      -0.010,
      glowMul:           0.60,
      blockMul:          0.30,
      shockwavesAllowed: false,
      centerBiasAdd:     0.10,
      lifetimeMul:       1.40,
      isEntryFrame,
    }
    case 'verse': return {
      railSpawnMul:      0.60,
      pulseSpeedMul:     1.00,
      decayAdjust:       0.000,
      glowMul:           0.85,
      blockMul:          0.60,
      shockwavesAllowed: true,
      centerBiasAdd:     0.00,
      lifetimeMul:       1.00,
      isEntryFrame,
    }
    case 'build': return {
      railSpawnMul:      0.60 + bp * 0.45,
      pulseSpeedMul:     1.00 + bp * 0.35,
      decayAdjust:       bp * 0.015,
      glowMul:           0.80 + bp * 0.40,
      blockMul:          0.50 + bp * 0.50,
      shockwavesAllowed: bp > 0.50,
      centerBiasAdd:     bp * 0.15,
      lifetimeMul:       1.00 - bp * 0.20,
      isEntryFrame,
    }
    case 'preDrop': return {
      railSpawnMul:      0.30 + tn * 0.20,
      pulseSpeedMul:     0.80,
      decayAdjust:      -0.010,
      glowMul:           0.40 + tn * 0.60,
      blockMul:          0.20,
      shockwavesAllowed: false,
      centerBiasAdd:     0.20 + tn * 0.15,
      lifetimeMul:       1.30,
      isEntryFrame,
    }
    case 'drop': return {
      railSpawnMul:      1.00 + di * 0.25,
      pulseSpeedMul:     1.00 + di * 0.30,
      decayAdjust:       0.020,
      glowMul:           1.00 + di * 0.50,
      blockMul:          1.00 + di * 0.50,
      shockwavesAllowed: true,
      centerBiasAdd:    -0.10,
      lifetimeMul:       0.80,
      isEntryFrame,
    }
    case 'breakdown': return {
      railSpawnMul:      0.30,
      pulseSpeedMul:     0.65,
      decayAdjust:      -0.015,
      glowMul:           0.50,
      blockMul:          0.25,
      shockwavesAllowed: false,
      centerBiasAdd:     0.00,
      lifetimeMul:       1.60,
      isEntryFrame,
    }
    case 'bridge': return {
      railSpawnMul:      0.65,
      pulseSpeedMul:     1.00,
      decayAdjust:       0.000,
      glowMul:           0.90,
      blockMul:          0.60,
      shockwavesAllowed: true,
      centerBiasAdd:     0.00,
      lifetimeMul:       1.00,
      isEntryFrame,
    }
    case 'outro': return {
      railSpawnMul:      0.25 + (1 - sp) * 0.30,
      pulseSpeedMul:     0.50 + (1 - sp) * 0.40,
      decayAdjust:       sp * -0.020,
      glowMul:           0.40 + (1 - sp) * 0.30,
      blockMul:          0.30,
      shockwavesAllowed: false,
      centerBiasAdd:     sp * 0.20,
      lifetimeMul:       1.00 + sp * 0.50,
      isEntryFrame,
    }
    default: return {
      railSpawnMul:      1.00,
      pulseSpeedMul:     1.00,
      decayAdjust:       0.000,
      glowMul:           1.00,
      blockMul:          1.00,
      shockwavesAllowed: true,
      centerBiasAdd:     0.00,
      lifetimeMul:       1.00,
      isEntryFrame,
    }
  }
}

// ── Trigger-behavior constants (shared between renderer and tests) ─────────────

/** Whiteout overlay fade duration in seconds. */
export const WHITEOUT_DURATION  = 0.35
/** Blackout (manual pad) overlay fade duration in seconds. */
export const BLACKOUT_DURATION  = 0.85
/** Freeze Trails freeze hold duration in seconds. */
export const FREEZE_DURATION    = 1.2
/** Fraction of remaining rail lifetime kept after a reseed morph. */
export const RESEED_LIFE_SCALE  = 0.28

/**
 * Compute the current alpha of a fading overlay.
 * Starts at 1.0 immediately after the trigger and reaches 0 after `duration` seconds.
 * `age` = audioTime − startSec.
 */
export function resolveOverlayAlpha(age: number, duration: number): number {
  const progress = Math.min(1, age / Math.max(0.001, duration))
  return 1 - progress
}

/**
 * Compute the cyanStrike color-override duration for the given BPM.
 * Falls back to a 0.5 s beat when BPM is zero.
 */
export function resolveCyanStrikeDuration(bpm: number): number {
  const beatSec = bpm > 0 ? 60 / bpm : 0.5
  return Math.max(0.40, beatSec * 1.5)
}

/**
 * Number of vertical and horizontal rails that a Rail Burst trigger emits,
 * scaled by the verticalBias setting.
 */
export function resolveRailBurstCounts(
  verticalBias: number,
): { vertCount: number; horizCount: number } {
  return {
    vertCount:  Math.round(2 + verticalBias * 2),
    horizCount: Math.round(1 + (1 - verticalBias) * 2),
  }
}

/**
 * Returns true when the given audio event should fire pulses and blocks
 * for the configured trigger setting. One-to-one mapping:
 * 'beat' matches only the generic beat event (not kick or snare).
 * 'drop' matches only a qualified drop event (not bare downbeat).
 */
export function resolveTriggerFires(
  trigger: NeonLatticeTrigger,
  event:   'kick' | 'snare' | 'beat' | 'downbeat' | 'drop',
): boolean {
  if (trigger === 'none') return false
  return trigger === event
}

/**
 * Returns true when BPM-based snap-slot deduplication should gate events.
 * When false, per-event debounce timestamps handle rate-limiting instead.
 */
export function isSnapActive(bpm: number, snapDivision: number): boolean {
  return bpm > 0 && snapDivision > 0
}
