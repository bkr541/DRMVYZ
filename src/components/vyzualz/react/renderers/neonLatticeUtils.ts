// ── Neon Lattice utility types and helpers ────────────────────────────────────
// These are pure functions with no side effects; safe to import from tests.

import type { NeonLatticeSettings, NeonLatticeTrigger } from '../ReactTypes'

// ── Canonical normalized segment model ───────────────────────────────────────

import type {
  NeonLatticeLineEnvelope,
  NeonLatticeLineOrientation,
  NeonLatticePaletteRole,
  NeonLatticeSpanMode,
} from '../ReactTypes'

/**
 * Canonical production geometry for every Neon Lattice line.
 * Coordinates are normalized to canvas space and therefore resize-safe.
 *
 * The deprecated axis fields are compatibility mirrors for old tests and
 * persisted helpers. Rendering, pulse interpolation, and new code use the
 * normalized endpoints exclusively.
 */
export interface NeonSegment {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  orientation: NeonLatticeLineOrientation
  spanMode: NeonLatticeSpanMode
  width: number
  alpha: number
  glow: number
  depth: number
  paletteRole: NeonLatticePaletteRole
  colorRgb: string
  birthSec: number
  lifetime: number
  envelope: NeonLatticeLineEnvelope | null
  envelopeStrength: number
  laneId?: string
  morphProgress: number
  morphDuration: number
  morphStartX: number
  morphStartY: number
  morphStartEndX: number
  morphStartEndY: number
  morphTargetX: number
  morphTargetY: number
  morphTargetEndX: number
  morphTargetEndY: number

  /** @deprecated compatibility mirror; use orientation/start/end coordinates. */
  vertical: boolean
  /** @deprecated compatibility mirror; use normalized endpoints. */
  pos: number
  /** @deprecated compatibility mirror; use normalized endpoints. */
  spanStart: number
  /** @deprecated compatibility mirror; use normalized endpoints. */
  spanEnd: number
  /** @deprecated compatibility morph mirror. */
  morphStartPos: number
  /** @deprecated compatibility morph mirror. */
  morphTargetPos: number
  /** @deprecated compatibility morph mirror. */
  morphStartSpanStart: number
  /** @deprecated compatibility morph mirror. */
  morphTargetSpanStart: number
  /** @deprecated compatibility morph mirror. */
  morphStartSpanEnd: number
  /** @deprecated compatibility morph mirror. */
  morphTargetSpanEnd: number
}

export interface LegacyNeonRailGeometry {
  vertical: boolean
  pos: number
  spanStart: number
  spanEnd: number
}

/** Input-only shape accepted by compatibility helpers and older tests. */
export interface LegacyNeonRail extends LegacyNeonRailGeometry {
  width: number
  alpha: number
  glow: number
  depth: number
  birthSec: number
  lifetime: number
  colorRgb: string
  morphProgress: number
  morphDuration: number
  morphStartPos: number
  morphTargetPos: number
  morphStartSpanStart: number
  morphTargetSpanStart: number
  morphStartSpanEnd: number
  morphTargetSpanEnd: number
}

/** Legacy public name retained as an adapter input union. Production state uses NeonSegment. */
export type NeonRail = NeonSegment | LegacyNeonRail

export function isNeonSegment(rail: NeonRail): rail is NeonSegment {
  return 'startX' in rail && 'endX' in rail
}

export function ensureNeonSegment(rail: NeonRail): NeonSegment {
  return isNeonSegment(rail) ? rail : legacyRailToSegment(rail, rail)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function classifySegmentOrientation(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  epsilon = 1e-5,
): NeonLatticeLineOrientation {
  const dx = endX - startX
  const dy = endY - startY
  if (Math.abs(dx) <= epsilon && Math.abs(dy) > epsilon) return 'vertical'
  if (Math.abs(dy) <= epsilon && Math.abs(dx) > epsilon) return 'horizontal'
  if (Math.abs(dx) <= epsilon && Math.abs(dy) <= epsilon) return 'custom'
  return dx * dy < 0 ? 'diagonalUp' : 'diagonalDown'
}

export function syncLegacyRailGeometry(segment: NeonSegment): NeonSegment {
  const orientation = classifySegmentOrientation(segment.startX, segment.startY, segment.endX, segment.endY)
  segment.orientation = segment.orientation === 'custom' ? 'custom' : orientation
  segment.vertical = orientation === 'vertical'
  if (orientation === 'vertical') {
    segment.pos = segment.startX
    segment.spanStart = Math.min(segment.startY, segment.endY)
    segment.spanEnd = Math.max(segment.startY, segment.endY)
  } else if (orientation === 'horizontal') {
    segment.pos = segment.startY
    segment.spanStart = Math.min(segment.startX, segment.endX)
    segment.spanEnd = Math.max(segment.startX, segment.endX)
  } else {
    segment.pos = 0.5
    segment.spanStart = 0
    segment.spanEnd = 1
  }
  return segment
}

export function legacyRailToSegment(
  legacy: LegacyNeonRailGeometry,
  overrides: Partial<NeonSegment> = {},
): NeonSegment {
  const pos = clamp01(legacy.pos)
  const spanStart = clamp01(Math.min(legacy.spanStart, legacy.spanEnd))
  const spanEnd = clamp01(Math.max(legacy.spanStart, legacy.spanEnd))
  const startX = legacy.vertical ? pos : spanStart
  const startY = legacy.vertical ? spanStart : pos
  const endX = legacy.vertical ? pos : spanEnd
  const endY = legacy.vertical ? spanEnd : pos
  const orientation: NeonLatticeLineOrientation = legacy.vertical ? 'vertical' : 'horizontal'
  const base: NeonSegment = {
    id: 'legacy-segment',
    startX, startY, endX, endY,
    orientation,
    spanMode: legacy.vertical && spanStart <= 0.001 && spanEnd >= 0.999 ? 'fullCanvas' : 'short',
    width: 1,
    alpha: 1,
    glow: 0,
    depth: 0.5,
    paletteRole: 'primary',
    colorRgb: '74,199,219',
    birthSec: 0,
    lifetime: 4,
    envelope: null,
    envelopeStrength: 1,
    morphProgress: 1,
    morphDuration: 1,
    morphStartX: startX,
    morphStartY: startY,
    morphStartEndX: endX,
    morphStartEndY: endY,
    morphTargetX: startX,
    morphTargetY: startY,
    morphTargetEndX: endX,
    morphTargetEndY: endY,
    vertical: legacy.vertical,
    pos,
    spanStart,
    spanEnd,
    morphStartPos: pos,
    morphTargetPos: pos,
    morphStartSpanStart: spanStart,
    morphTargetSpanStart: spanStart,
    morphStartSpanEnd: spanEnd,
    morphTargetSpanEnd: spanEnd,
  }
  return syncLegacyRailGeometry({ ...base, ...overrides })
}

export function segmentPointAt(segment: Pick<NeonSegment, 'startX' | 'startY' | 'endX' | 'endY'>, progress: number): { x: number; y: number } {
  const t = clamp01(progress)
  return {
    x: segment.startX + (segment.endX - segment.startX) * t,
    y: segment.startY + (segment.endY - segment.startY) * t,
  }
}

export function segmentLength(segment: Pick<NeonSegment, 'startX' | 'startY' | 'endX' | 'endY'>): number {
  return Math.hypot(segment.endX - segment.startX, segment.endY - segment.startY)
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
  background?: string
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
): NeonSegment {
  const lane     = selectVerticalLane(seed, existing)
  let   norm     = lane / (MAX_VERT - 1)
  norm           = 0.1 + norm * 0.8
  const cb       = settings.centerBias * 0.3
  norm           = norm * (1 - cb) + 0.5 * cb

  let [r, s] = prngNext(seed + 1)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s]           = prngNext(s)
  const isSecondary = !isHighlight && r < 0.4
  const paletteRole: NeonLatticePaletteRole = isHighlight ? 'highlight' : isSecondary ? 'secondary' : 'primary'
  const colorRgb = paletteRgb[paletteRole]

  ;[r, s] = prngNext(s)
  const legacyY0 = r * 0.15
  ;[r, s] = prngNext(s)
  const legacyY1 = 0.85 + r * 0.15
  const spanMode = settings.verticalSpanMode
  const spanY0 = spanMode === 'fullCanvas' ? 0 : legacyY0
  const spanY1 = spanMode === 'fullCanvas' ? 1 : legacyY1

  ;[r] = prngNext(s)
  const depth = 0.25 + r * 0.75
  const rawLifetime = settings.railLifetime * (0.7 + strength * 0.5)

  return legacyRailToSegment(
    { vertical: true, pos: norm, spanStart: spanY0, spanEnd: spanY1 },
    {
      id: `nl-v-${seed}-${Math.round(audioTime * 1000)}`,
      spanMode,
      width: depth * (1.5 + strength * 1.5),
      alpha: 0.5 + strength * 0.4,
      glow: settings.bloom * (0.5 + strength * 0.5),
      depth,
      paletteRole,
      colorRgb,
      birthSec: audioTime,
      lifetime: rawLifetime,
      envelope: null,
      envelopeStrength: strength,
    },
  )
}

function resolveHorizontalSpan(
  mode: NeonLatticeSpanMode,
  seed: number,
): { start: number; end: number } {
  let [r, s] = prngNext(seed)
  if (mode === 'fullCanvas') return { start: 0, end: 1 }
  if (mode === 'long') {
    const length = 0.68 + r * 0.24
    ;[r] = prngNext(s)
    const center = 0.5 + (r - 0.5) * Math.max(0, 1 - length)
    return { start: Math.max(0, center - length / 2), end: Math.min(1, center + length / 2) }
  }
  if (mode === 'random') {
    const length = 0.12 + r * 0.78
    ;[r] = prngNext(s)
    const start = r * (1 - length)
    return { start, end: start + length }
  }
  // presetDefined currently falls back to the legacy authored dash until a
  // custom segment is selected by the composition runtime.
  const halfSpan = 0.15 + r * 0.35
  ;[r] = prngNext(s)
  const cx = 0.2 + r * 0.6
  return { start: Math.max(0, cx - halfSpan), end: Math.min(1, cx + halfSpan) }
}

/** Build a horizontal segment. The legacy short-dash span remains the default. */
export function makeHorizontalRail(
  seed: number,
  settings: NeonLatticeSettings,
  audioTime: number,
  existing: NeonRail[],
  paletteRgb: NeonPaletteRgb,
  strength: number,
): NeonSegment {
  const lane  = selectHorizontalLane(seed, existing)
  let norm    = lane / Math.max(1, MAX_HORIZ - 1)
  norm        = 0.1 + norm * 0.8
  const cb    = settings.centerBias * 0.25
  norm        = norm * (1 - cb) + 0.5 * cb

  let [r, s]  = prngNext(seed + 7)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s] = prngNext(s)
  const paletteRole: NeonLatticePaletteRole = isHighlight ? 'highlight' : r < 0.4 ? 'secondary' : 'primary'
  const colorRgb = paletteRgb[paletteRole]

  const span = resolveHorizontalSpan(settings.horizontalSpanMode, s)
  ;[r] = prngNext(s)
  const depth = 0.15 + r * 0.65
  const rawLifetime = settings.railLifetime * 0.6 * (0.6 + strength * 0.4)

  return legacyRailToSegment(
    { vertical: false, pos: norm, spanStart: span.start, spanEnd: span.end },
    {
      id: `nl-h-${seed}-${Math.round(audioTime * 1000)}`,
      spanMode: settings.horizontalSpanMode,
      width: depth * (1.0 + strength),
      alpha: 0.35 + strength * 0.35,
      glow: settings.bloom * (0.3 + strength * 0.4),
      depth,
      paletteRole,
      colorRgb,
      birthSec: audioTime,
      lifetime: rawLifetime,
      envelope: null,
      envelopeStrength: strength,
    },
  )
}


// ── Orientation-independent segment factories ───────────────────────────────

export interface NeonSegmentFactoryOptions {
  spanMode?: NeonLatticeSpanMode
  paletteRole?: NeonLatticePaletteRole
  angleDeg?: number
  custom?: { startX: number; startY: number; endX: number; endY: number }
  laneId?: string
}

export function paletteColorForRole(palette: NeonPaletteRgb, role: NeonLatticePaletteRole): string {
  return role === 'background' ? (palette.background ?? palette.primary) : palette[role]
}

export function clampDiagonalAngleDegrees(angleDeg: number): number {
  const finiteAngle = Number.isFinite(angleDeg) ? angleDeg : 45
  const sign = finiteAngle < 0 ? -1 : 1
  return sign * Math.max(10, Math.min(80, Math.abs(finiteAngle)))
}

function clipInfiniteLineToUnitSquare(cx: number, cy: number, dx: number, dy: number): { startX: number; startY: number; endX: number; endY: number } {
  const candidates: Array<{ t: number; x: number; y: number }> = []
  const push = (t: number) => {
    const x = cx + dx * t
    const y = cy + dy * t
    if (x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6) {
      candidates.push({ t, x: clamp01(x), y: clamp01(y) })
    }
  }
  if (Math.abs(dx) > 1e-8) { push((0 - cx) / dx); push((1 - cx) / dx) }
  if (Math.abs(dy) > 1e-8) { push((0 - cy) / dy); push((1 - cy) / dy) }
  candidates.sort((a, b) => a.t - b.t)
  const first = candidates[0] ?? { x: 0, y: 0, t: 0 }
  const last = candidates[candidates.length - 1] ?? { x: 1, y: 1, t: 1 }
  return { startX: first.x, startY: first.y, endX: last.x, endY: last.y }
}

function applySpanModeToEndpoints(
  endpoints: { startX: number; startY: number; endX: number; endY: number },
  mode: NeonLatticeSpanMode,
  seed: number,
): { startX: number; startY: number; endX: number; endY: number } {
  if (mode === 'fullCanvas' || mode === 'presetDefined') return endpoints
  let [r, s] = prngNext(seed)
  const scale = mode === 'long' ? 0.62 + r * 0.25 : mode === 'short' ? 0.18 + r * 0.28 : 0.15 + r * 0.80
  ;[r] = prngNext(s)
  const centerT = Math.max(scale / 2, Math.min(1 - scale / 2, r))
  const startT = centerT - scale / 2
  const endT = centerT + scale / 2
  return {
    startX: endpoints.startX + (endpoints.endX - endpoints.startX) * startT,
    startY: endpoints.startY + (endpoints.endY - endpoints.startY) * startT,
    endX: endpoints.startX + (endpoints.endX - endpoints.startX) * endT,
    endY: endpoints.startY + (endpoints.endY - endpoints.startY) * endT,
  }
}

export function makeSegmentFromEndpoints(
  id: string,
  endpoints: { startX: number; startY: number; endX: number; endY: number },
  settings: NeonLatticeSettings,
  audioTime: number,
  paletteRgb: NeonPaletteRgb,
  strength: number,
  options: NeonSegmentFactoryOptions = {},
): NeonSegment {
  const startX = clamp01(endpoints.startX)
  const startY = clamp01(endpoints.startY)
  const endX = clamp01(endpoints.endX)
  const endY = clamp01(endpoints.endY)
  const orientation = classifySegmentOrientation(startX, startY, endX, endY)
  const role = options.paletteRole ?? 'primary'
  const depthSeed = xorshift32(Math.abs(id.split('').reduce((acc, char) => acc * 31 + char.charCodeAt(0), 7)))
  const depth = 0.2 + depthSeed * 0.75
  const segment = legacyRailToSegment(
    orientation === 'vertical'
      ? { vertical: true, pos: startX, spanStart: Math.min(startY, endY), spanEnd: Math.max(startY, endY) }
      : { vertical: false, pos: startY, spanStart: Math.min(startX, endX), spanEnd: Math.max(startX, endX) },
    {
      id,
      startX, startY, endX, endY,
      orientation,
      spanMode: options.spanMode ?? 'presetDefined',
      width: (1.1 + depth * 1.8) * (0.7 + strength * 0.6),
      alpha: 0.4 + strength * 0.45,
      glow: settings.bloom * (0.4 + strength * 0.6),
      depth,
      paletteRole: role,
      colorRgb: paletteColorForRole(paletteRgb, role),
      birthSec: audioTime,
      lifetime: settings.railLifetime * (0.7 + strength * 0.5),
      envelope: null,
      envelopeStrength: strength,
      laneId: options.laneId,
      morphStartX: startX,
      morphStartY: startY,
      morphStartEndX: endX,
      morphStartEndY: endY,
      morphTargetX: startX,
      morphTargetY: startY,
      morphTargetEndX: endX,
      morphTargetEndY: endY,
    },
  )
  segment.startX = startX; segment.startY = startY; segment.endX = endX; segment.endY = endY
  segment.orientation = orientation
  return syncLegacyRailGeometry(segment)
}

export function makeDiagonalRail(
  seed: number,
  orientation: 'diagonalUp' | 'diagonalDown',
  settings: NeonLatticeSettings,
  audioTime: number,
  _existing: NeonRail[],
  paletteRgb: NeonPaletteRgb,
  strength: number,
  options: NeonSegmentFactoryOptions = {},
): NeonSegment {
  const authoredAngle = options.angleDeg ?? (orientation === 'diagonalUp' ? -settings.diagonalAngleDegrees : settings.diagonalAngleDegrees)
  const angle = clampDiagonalAngleDegrees(authoredAngle)
  const radians = angle * Math.PI / 180
  let [r, s] = prngNext(seed + 17)
  const offset = (r - 0.5) * 0.65
  ;[r] = prngNext(s)
  const cx = 0.5 + offset * 0.35
  const cy = 0.5 + (r - 0.5) * 0.35
  const full = clipInfiniteLineToUnitSquare(cx, cy, Math.cos(radians), Math.sin(radians))
  const spanMode = options.spanMode ?? settings.diagonalSpanMode
  const endpoints = options.custom ?? applySpanModeToEndpoints(full, spanMode, seed + 101)
  const role: NeonLatticePaletteRole = options.paletteRole ?? (xorshift32(seed + 5) < settings.cyanAccentChance ? 'highlight' : 'primary')
  return makeSegmentFromEndpoints(
    `nl-${orientation === 'diagonalUp' ? 'du' : 'dd'}-${seed}-${Math.round(audioTime * 1000)}`,
    endpoints,
    settings,
    audioTime,
    paletteRgb,
    strength,
    { ...options, spanMode, paletteRole: role },
  )
}

export function makeCustomSegmentRail(
  seed: number,
  custom: { id?: string; startX: number; startY: number; endX: number; endY: number; paletteRole?: NeonLatticePaletteRole },
  settings: NeonLatticeSettings,
  audioTime: number,
  paletteRgb: NeonPaletteRgb,
  strength: number,
): NeonSegment {
  return makeSegmentFromEndpoints(
    custom.id ?? `nl-custom-${seed}-${Math.round(audioTime * 1000)}`,
    custom,
    settings,
    audioTime,
    paletteRgb,
    strength,
    { spanMode: 'presetDefined', paletteRole: custom.paletteRole ?? 'primary' },
  )
}

export function selectWeightedOrientation(
  weights: NeonLatticeSettings['orientationWeights'],
  seed: number,
): Exclude<NeonLatticeLineOrientation, 'custom'> {
  const normalized = [weights.vertical, weights.horizontal, weights.diagonalUp, weights.diagonalDown]
  const total = normalized.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (total <= 1e-9) return 'vertical'
  const [value] = prngNext(seed)
  let cursor = value * total
  const orientations: Array<Exclude<NeonLatticeLineOrientation, 'custom'>> = ['vertical', 'horizontal', 'diagonalUp', 'diagonalDown']
  for (let index = 0; index < orientations.length; index++) {
    cursor -= Math.max(0, normalized[index])
    if (cursor <= 0) return orientations[index]
  }
  return 'vertical'
}

// ── General segment intersections ────────────────────────────────────────────

export interface NeonSegmentIntersection {
  id: string
  segmentAId: string
  segmentBId: string
  x: number
  y: number
  progressA: number
  progressB: number
  kind: 'point' | 'overlap'
}

function cross2(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx
}

export function intersectSegments(
  a: Pick<NeonSegment, 'id' | 'startX' | 'startY' | 'endX' | 'endY'>,
  b: Pick<NeonSegment, 'id' | 'startX' | 'startY' | 'endX' | 'endY'>,
  tolerance = 1e-6,
): NeonSegmentIntersection | null {
  const rx = a.endX - a.startX
  const ry = a.endY - a.startY
  const sx = b.endX - b.startX
  const sy = b.endY - b.startY
  const qpx = b.startX - a.startX
  const qpy = b.startY - a.startY
  const rxs = cross2(rx, ry, sx, sy)
  const qpxr = cross2(qpx, qpy, rx, ry)
  const aLen2 = rx * rx + ry * ry
  const bLen2 = sx * sx + sy * sy
  if (aLen2 <= tolerance * tolerance || bLen2 <= tolerance * tolerance) return null

  let t: number
  let u: number
  let kind: 'point' | 'overlap' = 'point'
  if (Math.abs(rxs) <= tolerance) {
    if (Math.abs(qpxr) > tolerance) return null
    const t0 = (qpx * rx + qpy * ry) / aLen2
    const t1 = t0 + (sx * rx + sy * ry) / aLen2
    const lo = Math.max(0, Math.min(t0, t1))
    const hi = Math.min(1, Math.max(t0, t1))
    if (hi < lo - tolerance) return null
    t = clamp01((lo + hi) / 2)
    const x = a.startX + rx * t
    const y = a.startY + ry * t
    u = Math.abs(sx) >= Math.abs(sy) ? (x - b.startX) / sx : (y - b.startY) / sy
    kind = 'overlap'
  } else {
    t = cross2(qpx, qpy, sx, sy) / rxs
    u = cross2(qpx, qpy, rx, ry) / rxs
    if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) return null
    t = clamp01(t)
    u = clamp01(u)
  }
  const x = clamp01(a.startX + rx * t)
  const y = clamp01(a.startY + ry * t)
  const pair = [a.id, b.id].sort()
  const qx = Math.round(x * 1e6)
  const qy = Math.round(y * 1e6)
  return {
    id: `${pair[0]}|${pair[1]}@${qx},${qy}`,
    segmentAId: a.id,
    segmentBId: b.id,
    x, y,
    progressA: t,
    progressB: u,
    kind,
  }
}

export function buildSegmentIntersections(
  segments: NeonSegment[],
  tolerance = 1e-6,
): { intersections: NeonSegmentIntersection[]; duplicatesSuppressed: number } {
  const seen = new Set<string>()
  const intersections: NeonSegmentIntersection[] = []
  let duplicatesSuppressed = 0
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const hit = intersectSegments(segments[i], segments[j], tolerance)
      if (!hit) continue
      if (seen.has(hit.id)) { duplicatesSuppressed++; continue }
      seen.add(hit.id)
      intersections.push(hit)
    }
  }
  intersections.sort((a, b) => a.id.localeCompare(b.id))
  return { intersections, duplicatesSuppressed }
}


export interface PulseIntersectionCandidate {
  intersection: NeonSegmentIntersection
  otherSegmentId: string
  currentProgress: number
  otherProgress: number
}

/**
 * Select the nearest valid intersection crossed during this update. Recent
 * route history is rejected so a pulse cannot immediately ping-pong between
 * two connected segments.
 */
export function selectPulseIntersectionCandidate(
  segmentId: string,
  previousProgress: number,
  nextProgress: number,
  direction: 1 | -1,
  intersections: readonly NeonSegmentIntersection[],
  routeHistory: readonly string[],
  lastIntersectionId?: string,
  tolerance = 1e-6,
): PulseIntersectionCandidate | null {
  const candidates: PulseIntersectionCandidate[] = []
  for (const intersection of intersections) {
    if (intersection.kind === 'overlap') continue
    const isA = intersection.segmentAId === segmentId
    const isB = intersection.segmentBId === segmentId
    if (!isA && !isB) continue
    if (intersection.id === lastIntersectionId) continue
    const currentProgress = isA ? intersection.progressA : intersection.progressB
    const otherProgress = isA ? intersection.progressB : intersection.progressA
    const otherSegmentId = isA ? intersection.segmentBId : intersection.segmentAId
    if (routeHistory.slice(-2).includes(otherSegmentId)) continue
    const crossed = direction === 1
      ? currentProgress > previousProgress + tolerance && currentProgress <= nextProgress + tolerance
      : currentProgress < previousProgress - tolerance && currentProgress >= nextProgress - tolerance
    if (crossed) candidates.push({ intersection, otherSegmentId, currentProgress, otherProgress })
  }
  candidates.sort((a, b) => direction === 1
    ? a.currentProgress - b.currentProgress
    : b.currentProgress - a.currentProgress)
  return candidates[0] ?? null
}

function syncLegacyMorphFieldsFromCanonical(segment: NeonSegment): void {
  const sourceOrientation = classifySegmentOrientation(
    segment.morphStartX, segment.morphStartY, segment.morphStartEndX, segment.morphStartEndY,
  )
  const targetOrientation = classifySegmentOrientation(
    segment.morphTargetX, segment.morphTargetY, segment.morphTargetEndX, segment.morphTargetEndY,
  )
  if (sourceOrientation !== targetOrientation) return
  if (sourceOrientation === 'vertical') {
    segment.morphStartPos = segment.morphStartX
    segment.morphTargetPos = segment.morphTargetX
    segment.morphStartSpanStart = Math.min(segment.morphStartY, segment.morphStartEndY)
    segment.morphTargetSpanStart = Math.min(segment.morphTargetY, segment.morphTargetEndY)
    segment.morphStartSpanEnd = Math.max(segment.morphStartY, segment.morphStartEndY)
    segment.morphTargetSpanEnd = Math.max(segment.morphTargetY, segment.morphTargetEndY)
  } else if (sourceOrientation === 'horizontal') {
    segment.morphStartPos = segment.morphStartY
    segment.morphTargetPos = segment.morphTargetY
    segment.morphStartSpanStart = Math.min(segment.morphStartX, segment.morphStartEndX)
    segment.morphTargetSpanStart = Math.min(segment.morphTargetX, segment.morphTargetEndX)
    segment.morphStartSpanEnd = Math.max(segment.morphStartX, segment.morphStartEndX)
    segment.morphTargetSpanEnd = Math.max(segment.morphTargetX, segment.morphTargetEndX)
  }
}

function adoptLegacyAxisMorphIfChanged(segment: NeonSegment): void {
  const sourceOrientation = classifySegmentOrientation(
    segment.morphStartX, segment.morphStartY, segment.morphStartEndX, segment.morphStartEndY,
  )
  const targetOrientation = classifySegmentOrientation(
    segment.morphTargetX, segment.morphTargetY, segment.morphTargetEndX, segment.morphTargetEndY,
  )
  if (sourceOrientation !== targetOrientation || (sourceOrientation !== 'vertical' && sourceOrientation !== 'horizontal')) return
  const values = [
    segment.morphStartPos, segment.morphTargetPos,
    segment.morphStartSpanStart, segment.morphTargetSpanStart,
    segment.morphStartSpanEnd, segment.morphTargetSpanEnd,
  ]
  if (!values.every(Number.isFinite)) return

  const projected = sourceOrientation === 'vertical'
    ? [
        segment.morphStartX, segment.morphTargetX,
        Math.min(segment.morphStartY, segment.morphStartEndY),
        Math.min(segment.morphTargetY, segment.morphTargetEndY),
        Math.max(segment.morphStartY, segment.morphStartEndY),
        Math.max(segment.morphTargetY, segment.morphTargetEndY),
      ]
    : [
        segment.morphStartY, segment.morphTargetY,
        Math.min(segment.morphStartX, segment.morphStartEndX),
        Math.min(segment.morphTargetX, segment.morphTargetEndX),
        Math.max(segment.morphStartX, segment.morphStartEndX),
        Math.max(segment.morphTargetX, segment.morphTargetEndX),
      ]
  if (!values.some((value, index) => Math.abs(value - projected[index]) > 1e-9)) return

  const startPos = clamp01(segment.morphStartPos)
  const targetPos = clamp01(segment.morphTargetPos)
  const startSpanStart = clamp01(Math.min(segment.morphStartSpanStart, segment.morphStartSpanEnd))
  const startSpanEnd = clamp01(Math.max(segment.morphStartSpanStart, segment.morphStartSpanEnd))
  const targetSpanStart = clamp01(Math.min(segment.morphTargetSpanStart, segment.morphTargetSpanEnd))
  const targetSpanEnd = clamp01(Math.max(segment.morphTargetSpanStart, segment.morphTargetSpanEnd))
  if (sourceOrientation === 'vertical') {
    segment.morphStartX = startPos
    segment.morphStartY = startSpanStart
    segment.morphStartEndX = startPos
    segment.morphStartEndY = startSpanEnd
    segment.morphTargetX = targetPos
    segment.morphTargetY = targetSpanStart
    segment.morphTargetEndX = targetPos
    segment.morphTargetEndY = targetSpanEnd
  } else {
    segment.morphStartX = startSpanStart
    segment.morphStartY = startPos
    segment.morphStartEndX = startSpanEnd
    segment.morphStartEndY = startPos
    segment.morphTargetX = targetSpanStart
    segment.morphTargetY = targetPos
    segment.morphTargetEndX = targetSpanEnd
    segment.morphTargetEndY = targetPos
  }
}

export function beginSegmentMorph(
  segment: NeonSegment,
  target: Pick<NeonSegment, 'startX' | 'startY' | 'endX' | 'endY'>,
  duration: number,
): 'morph' | 'replace' {
  const sourceOrientation = classifySegmentOrientation(segment.startX, segment.startY, segment.endX, segment.endY)
  const targetOrientation = classifySegmentOrientation(target.startX, target.startY, target.endX, target.endY)
  const sourceAngle = Math.atan2(segment.endY - segment.startY, segment.endX - segment.startX)
  const targetAngle = Math.atan2(target.endY - target.startY, target.endX - target.startX)
  const delta = Math.abs(Math.atan2(Math.sin(targetAngle - sourceAngle), Math.cos(targetAngle - sourceAngle)))
  if (sourceOrientation !== targetOrientation && delta > Math.PI * 0.72) return 'replace'
  segment.morphStartX = segment.startX
  segment.morphStartY = segment.startY
  segment.morphStartEndX = segment.endX
  segment.morphStartEndY = segment.endY
  segment.morphTargetX = clamp01(target.startX)
  segment.morphTargetY = clamp01(target.startY)
  segment.morphTargetEndX = clamp01(target.endX)
  segment.morphTargetEndY = clamp01(target.endY)
  segment.morphDuration = Math.max(0.01, duration)
  segment.morphProgress = 0
  syncLegacyMorphFieldsFromCanonical(segment)
  return 'morph'
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
  id: string
  segmentId: string
  startX: number
  startY: number
  endX: number
  endY: number
  /** Normalized 0–1 progress from segment start to segment end. */
  progress: number
  /** +1 travels start→end, -1 travels end→start. */
  direction: 1 | -1
  speed: number
  brightness: number
  radius: number
  colorRgb: string
  birthSec: number
  lifetime: number
  depth: number
  splitCount: number
  /** Segment IDs visited most recently, used by the general router in Patch 2. */
  routeHistory: string[]
  /** Last routed intersection, preventing zero-distance re-entry on the next frame. */
  lastIntersectionId?: string
  /** @deprecated compatibility mirror. */
  vertical: boolean
  /** @deprecated compatibility mirror. */
  railPos: number
}

export function pulsePointAt(pulse: Pick<NeonPulse, 'startX' | 'startY' | 'endX' | 'endY' | 'progress'>): { x: number; y: number } {
  return segmentPointAt(pulse, pulse.progress)
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
  const segment = ensureNeonSegment(rail)
  const rawSpeed = settings.pulseSpeed * (0.20 + strength * 0.40) * Math.max(0.1, motionScale)
  const speed = Math.max(0.06, rawSpeed)
  const length = Math.max(0.05, segmentLength(segment))
  const lifetime = Math.min(4.0, length / speed * (0.8 + strength * 0.2))

  let [r, s] = prngNext(seed + 3)
  const isHighlight = r < settings.cyanAccentChance
  ;[r, s] = prngNext(s)
  const colorRgb = isHighlight ? paletteRgb.highlight : r < 0.30 ? paletteRgb.secondary : paletteRgb.primary
  ;[r] = prngNext(s)
  const radius = 0.007 + r * 0.011

  return {
    id: `nl-p-${seed}-${Math.round(audioTime * 1000)}`,
    segmentId: segment.id,
    startX: segment.startX,
    startY: segment.startY,
    endX: segment.endX,
    endY: segment.endY,
    progress: direction === 1 ? 0 : 1,
    direction,
    speed,
    brightness: 0.55 + strength * 0.45,
    radius,
    colorRgb,
    birthSec: audioTime,
    lifetime,
    depth: segment.depth,
    splitCount: 0,
    routeHistory: [segment.id],
    vertical: segment.orientation === 'vertical',
    railPos: segment.orientation === 'vertical' ? segment.startX : segment.startY,
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
  const segment = ensureNeonSegment(rail)
  if (segment.morphProgress >= 1) return
  // Older renderer/test integrations still author axis morphs through the
  // compatibility fields. Adopt those values only when they differ from the
  // canonical same-axis segment morph; diagonal/cross-axis morphs stay native.
  adoptLegacyAxisMorphIfChanged(segment)
  segment.morphProgress = Math.min(1, segment.morphProgress + dt / Math.max(0.01, segment.morphDuration))
  const t = smoothstep(segment.morphProgress)
  segment.startX = segment.morphStartX + (segment.morphTargetX - segment.morphStartX) * t
  segment.startY = segment.morphStartY + (segment.morphTargetY - segment.morphStartY) * t
  segment.endX = segment.morphStartEndX + (segment.morphTargetEndX - segment.morphStartEndX) * t
  segment.endY = segment.morphStartEndY + (segment.morphTargetEndY - segment.morphStartEndY) * t
  syncLegacyRailGeometry(segment)
  syncLegacyMorphFieldsFromCanonical(segment)
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
