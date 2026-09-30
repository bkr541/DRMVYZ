import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2AfterhoursFixture } from './Cinema2AfterhoursDomain'
import { CINEMA2_AFTERHOURS_RIG } from './Cinema2AfterhoursRig'

/**
 * Afterhours 2.0 pattern engine.
 *
 * A pattern is a programmed laser show of 1 to 16 bars, written the way a laser programmer thinks about it: groups of lasers (a row, the
 * sides, the centre points), each running its own bar-by-bar program. For every bar a group has
 *  - a gate: 16 characters, one per 16th note. `x` fires (a hit lands exactly on that 16th), `=` keeps the lasers lit, `.` is dark.
 *  - a beam shape: each laser fires 1 beam, a few beams, a fan, or a sheet (a fan so dense it reads as a surface). The shape can change
 *    from bar to bar, so the same laser can fire one beam in bar 1, three in bar 2 and a full fan in bar 3.
 *  - endpoints: one or more aim points. A laser always fires from its own position, but it can move between several endpoints within a bar
 *    (stepping on each hit, beat, 8th or 16th, sweeping between them, or scattering to a new random point each time).
 *  - a colour role: primary, accent, white, or alternating.
 *
 * Some groups hold one look for a whole bar while others change on every beat or faster, so a pattern mixes held and changing looks.
 * Everything is a pure function of the pattern-local beat position and a seed, so a show replays identically.
 */

export type Cinema2AfterhoursGroupId =
  | 'all'
  | 'floor' | 'floorInner' | 'floorOuter' | 'floorOdd' | 'floorEven' | 'floorEnds'
  | 'top' | 'topInner' | 'topOuter' | 'topOdd' | 'topEven' | 'topEnds'
  | 'mid' | 'midInner' | 'midOuter' | 'midOdd' | 'midEven'
  | 'sides' | 'sidesLow' | 'sidesHigh' | 'sidesOdd' | 'sidesEven'
  | 'floorCenter' | 'topCenter' | 'centers'

/** 1 = a single beam, 2..16 = that many beams in a fan, 'sheet' = a solid plane of light. */
export type Cinema2AfterhoursBeamShape = number | 'sheet'

/**
 * An endpoint: x runs from -1 to 1 and is measured outward from the stage centre for the laser's own side (so a mirrored pair fans out
 * together at positive x and crosses over at negative x); y runs from 0 (floor) to 1 (top of the room). With `rel`, x is an offset from
 * the laser's own position instead (0 fires straight ahead).
 */
export type Cinema2AfterhoursAim = readonly [x: number, y: number] | readonly [x: number, y: number, mode: 'rel']

export type Cinema2AfterhoursAimRate = 'hit' | 'beat' | '8th' | '16th' | 'bar'
export type Cinema2AfterhoursAimMode = 'step' | 'sweep' | 'scatter'
export type Cinema2AfterhoursColorRole = 'p' | 'a' | 'w' | 'alt'
export type Cinema2AfterhoursChaseMode = 'out' | 'in' | 'across'
export type Cinema2AfterhoursPatternEnergy = 'low' | 'mid' | 'high' | 'build'

export interface Cinema2AfterhoursPatternStep {
  readonly gate: string
  readonly beams: Cinema2AfterhoursBeamShape
  /** Fan width in endpoint units. Defaults suit the beam count. */
  readonly width?: number
  readonly orient?: 'h' | 'v'
  readonly aim: readonly Cinema2AfterhoursAim[]
  readonly aimRate?: Cinema2AfterhoursAimRate
  readonly aimMode?: Cinema2AfterhoursAimMode
  readonly color?: Cinema2AfterhoursColorRole
  /** Delay in 16ths between neighbouring lasers of the group, for chases. */
  readonly chase?: number
  readonly chaseMode?: Cinema2AfterhoursChaseMode
}

export interface Cinema2AfterhoursPatternLayer {
  readonly group: Cinema2AfterhoursGroupId
  /** Base layers keep their lasers first when Laser Count limits how many may be lit. */
  readonly role: 'base' | 'accent'
  /** One step per bar. A layer shorter than the pattern repeats. */
  readonly bars: readonly Cinema2AfterhoursPatternStep[]
}

export interface Cinema2AfterhoursPatternDefinition {
  readonly id: string
  readonly label: string
  readonly energy: Cinema2AfterhoursPatternEnergy
  /** Length in bars, 1..16. */
  readonly bars: number
  readonly layers: readonly Cinema2AfterhoursPatternLayer[]
}

export interface Cinema2AfterhoursPatternInput {
  readonly pattern: Readonly<Cinema2AfterhoursPatternDefinition>
  /** Beats since the pattern started (4 per bar). */
  readonly beat: number
  readonly seed: string
  readonly symmetry: boolean
  /** 0..1 lateral width of every endpoint. */
  readonly spread: number
  /** 0..1.4 how far a laser travels between its endpoints (0 = every hit fires at the first endpoint). */
  readonly motion: number
  readonly sideLasers: boolean
  readonly topLasers: boolean
  /** Most lasers that may be lit at once. */
  readonly laserLimit: number
}

export interface Cinema2AfterhoursPatternRay {
  readonly fixtureId: string
  readonly originWorld: Cinema2Vector3
  readonly targetWorld: Cinema2Vector3
  /** Shutter times shape weighting; 0 is never emitted. */
  readonly intensity: number
  readonly color: 'p' | 'a' | 'w'
  /** Optical width multiplier (sheets are drawn softer and wider). */
  readonly width: number
  readonly pairId: string
}

export interface Cinema2AfterhoursPatternFrame {
  readonly rays: readonly Cinema2AfterhoursPatternRay[]
  /** Fixture ids lit this frame, after Laser Count. */
  readonly litFixtureIds: readonly string[]
  readonly bar: number
}

export const CINEMA2_AFTERHOURS_MAX_PATTERN_BARS = 16
export const CINEMA2_AFTERHOURS_SHEET_RAYS = 22
const TARGET_Z = 10.5
const RELEASE_FRACTION = 0.16
/** Endpoint x = 1 lands this far out from the stage centre; y runs from TARGET_FLOOR to TARGET_FLOOR + TARGET_HEIGHT. */
const TARGET_HALF_WIDTH = 11
const TARGET_FLOOR = 0.2
const TARGET_HEIGHT = 7.6

const RIG = CINEMA2_AFTERHOURS_RIG

function pick(bank: readonly Cinema2AfterhoursFixture[], pairs: readonly number[]): readonly Cinema2AfterhoursFixture[] {
  return bank.filter(candidate => pairs.includes(candidate.pairIndex))
}

const SIDES = Object.freeze([...RIG.banks.left, ...RIG.banks.right])

const GROUPS: Readonly<Record<Cinema2AfterhoursGroupId, readonly Cinema2AfterhoursFixture[]>> = Object.freeze({
  all: RIG.fixtures,
  floor: RIG.banks.bottom,
  floorInner: pick(RIG.banks.bottom, [0, 1]),
  floorOuter: pick(RIG.banks.bottom, [3, 4]),
  floorOdd: pick(RIG.banks.bottom, [1, 3]),
  floorEven: pick(RIG.banks.bottom, [0, 2, 4]),
  floorEnds: pick(RIG.banks.bottom, [4]),
  top: RIG.banks.overhead,
  topInner: pick(RIG.banks.overhead, [0, 1]),
  topOuter: pick(RIG.banks.overhead, [3, 4]),
  topOdd: pick(RIG.banks.overhead, [1, 3]),
  topEven: pick(RIG.banks.overhead, [0, 2, 4]),
  topEnds: pick(RIG.banks.overhead, [4]),
  mid: RIG.banks.mid,
  midInner: pick(RIG.banks.mid, [0, 1]),
  midOuter: pick(RIG.banks.mid, [2, 3]),
  midOdd: pick(RIG.banks.mid, [1, 3]),
  midEven: pick(RIG.banks.mid, [0, 2]),
  sides: SIDES,
  sidesLow: pick(SIDES, [0, 1, 2, 3]),
  sidesHigh: pick(SIDES, [4, 5, 6, 7]),
  sidesOdd: pick(SIDES, [1, 3, 5, 7]),
  sidesEven: pick(SIDES, [0, 2, 4, 6]),
  floorCenter: [RIG.banks.center[0]!],
  topCenter: [RIG.banks.center[1]!],
  centers: RIG.banks.center,
})

export function resolveCinema2AfterhoursGroup(group: Cinema2AfterhoursGroupId): readonly Cinema2AfterhoursFixture[] {
  return GROUPS[group] ?? []
}

function bankEnabled(candidate: Cinema2AfterhoursFixture, input: Readonly<Cinema2AfterhoursPatternInput>): boolean {
  if (candidate.bank === 'left' || candidate.bank === 'right') return input.sideLasers
  if (candidate.bank === 'overhead' || candidate.role === 'topCenter') return input.topLasers
  return true
}

function hash(value: string): number {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  return ((h >>> 0) % 1_000_003) / 1_000_003
}

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, finiteOr(value, min)))
const smooth = (t: number) => t * t * (3 - 2 * t)
const positiveModulo = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo

export interface Cinema2AfterhoursGateState {
  /** 0..1 shutter. */
  readonly gate: number
  /** Hits (`x`) in this bar up to and including the current 16th; 0 before the first hit. */
  readonly hitIndex: number
  /** Hits in the whole bar. */
  readonly hitsPerBar: number
}

/**
 * The shutter of one gate string at a position within the bar, in 16ths (0 ≤ q < 16). A hit snaps fully open on its 16th. A lit run closes
 * briefly at the end of its last 16th before a dark 16th or the next hit, so consecutive hits read as separate hits.
 */
export function evaluateCinema2AfterhoursGate(gate: string, q: number): Cinema2AfterhoursGateState {
  const position = positiveModulo(finiteOr(q, 0), 16)
  const index = Math.min(15, Math.floor(position))
  let hitsPerBar = 0
  let hitIndex = 0
  for (let step = 0; step < 16; step += 1) {
    if (gate[step] === 'x') {
      hitsPerBar += 1
      if (step <= index) hitIndex += 1
    }
  }
  const current = gate[index] ?? '.'
  if (current !== 'x' && current !== '=') return { gate: 0, hitIndex, hitsPerBar }
  const next = index < 15 ? gate[index + 1] ?? '.' : '='
  const fraction = position - index
  let value = 1
  if ((next === '.' || next === 'x') && fraction > 1 - RELEASE_FRACTION) value = clamp((1 - fraction) / RELEASE_FRACTION, 0, 1)
  return { gate: value, hitIndex, hitsPerBar }
}

function fanOffsets(shape: Cinema2AfterhoursBeamShape, width: number | undefined): { offsets: number[]; intensity: number; opticalWidth: number } {
  if (shape === 'sheet') {
    const span = width ?? 1.1
    const offsets = Array.from({ length: CINEMA2_AFTERHOURS_SHEET_RAYS }, (_, index) => (index / (CINEMA2_AFTERHOURS_SHEET_RAYS - 1) - 0.5) * span)
    return { offsets, intensity: 0.2, opticalWidth: 2.6 }
  }
  const count = Math.max(1, Math.min(16, Math.round(finiteOr(shape, 1))))
  if (count === 1) return { offsets: [0], intensity: 1, opticalWidth: 1 }
  const span = width ?? (count === 2 ? 0.28 : count === 3 ? 0.34 : 0.85)
  const offsets = Array.from({ length: count }, (_, index) => (index / (count - 1) - 0.5) * span)
  return { offsets, intensity: clamp(2.1 / Math.sqrt(count), 0.34, 0.88), opticalWidth: 1 }
}

function aimAt(aims: readonly Cinema2AfterhoursAim[], index: number): Cinema2AfterhoursAim {
  return aims[positiveModulo(index, aims.length)] ?? [0.5, 0.5]
}

interface ResolvedAim { x: number; y: number; rel: boolean }

function resolveAim(
  step: Readonly<Cinema2AfterhoursPatternStep>,
  counters: Readonly<{ hit: number; beat: number; bar: number }>,
  motion: number,
  scatterKey: string,
): ResolvedAim {
  const aims = step.aim.length > 0 ? step.aim : ([[0.5, 0.5]] as const)
  const first = aims[0]!
  const rate = step.aimRate ?? 'hit'
  const mode = step.aimMode ?? 'step'
  const discrete = rate === 'hit' ? counters.hit
    : rate === 'bar' ? counters.bar
      : rate === 'beat' ? Math.floor(counters.beat)
        : rate === '8th' ? Math.floor(counters.beat * 2)
          : Math.floor(counters.beat * 4)
  let x: number
  let y: number
  if (mode === 'scatter') {
    const key = `${scatterKey}:${discrete}`
    x = -0.25 + hash(`${key}:x`) * 1.25
    y = 0.08 + hash(`${key}:y`) * 0.88
  } else if (mode === 'sweep') {
    const continuous = rate === 'bar' ? counters.bar + positiveModulo(counters.beat, 4) / 4
      : rate === '8th' ? counters.beat * 2
        : rate === '16th' ? counters.beat * 4
          : counters.beat
    const segment = Math.floor(continuous)
    const t = smooth(continuous - segment)
    const from = aimAt(aims, segment)
    const to = aimAt(aims, segment + 1)
    x = from[0] + (to[0] - from[0]) * t
    y = from[1] + (to[1] - from[1]) * t
  } else {
    const point = aimAt(aims, discrete)
    x = point[0]
    y = point[1]
  }
  return {
    x: first[0] + (x - first[0]) * motion,
    y: first[1] + (y - first[1]) * motion,
    rel: first[2] === 'rel',
  }
}

/** Chase order of a laser within its group. */
function chaseRank(candidate: Cinema2AfterhoursFixture, mode: Cinema2AfterhoursChaseMode, members: readonly Cinema2AfterhoursFixture[]): number {
  if (mode === 'across') {
    const xs = [...new Set(members.map(member => member.positionWorld[0]))].sort((a, b) => a - b)
    return xs.indexOf(candidate.positionWorld[0])
  }
  if (mode === 'in') {
    const maxPair = members.reduce((max, member) => Math.max(max, member.pairIndex), 0)
    return maxPair - candidate.pairIndex
  }
  return candidate.pairIndex
}

interface PendingRay extends Cinema2AfterhoursPatternRay {
  readonly priority: number
}

/** Evaluates every lit laser and its beams for one moment of a pattern. */
export function evaluateCinema2AfterhoursPattern(input: Readonly<Cinema2AfterhoursPatternInput>): Cinema2AfterhoursPatternFrame {
  const pattern = input.pattern
  const bars = clamp(Math.round(pattern.bars), 1, CINEMA2_AFTERHOURS_MAX_PATTERN_BARS)
  const beat = Math.max(0, finiteOr(input.beat, 0))
  const bar = Math.floor(beat / 4) % bars
  const beatInPattern = bar * 4 + positiveModulo(beat, 4)
  const q = positiveModulo(beat, 4) * 4
  const lateral = 0.45 + clamp(input.spread, 0, 1) * 0.55
  const motion = clamp(input.motion, 0, 1.4)
  const pending: PendingRay[] = []

  pattern.layers.forEach((layer, layerIndex) => {
    if (layer.bars.length === 0) return
    const step = layer.bars[bar % layer.bars.length]!
    const members = resolveCinema2AfterhoursGroup(layer.group).filter(candidate => bankEnabled(candidate, input))
    if (members.length === 0) return
    const shape = fanOffsets(step.beams, step.width)
    const orient = step.orient ?? 'h'
    for (const candidate of members) {
      const rank = step.chase ? chaseRank(candidate, step.chaseMode ?? 'out', members) : 0
      const delay = (step.chase ?? 0) * rank
      const state = evaluateCinema2AfterhoursGate(step.gate, q - delay)
      if (state.gate <= 1e-4) continue
      const localBeat = beatInPattern - delay / 4
      const counters = { hit: bar * state.hitsPerBar + Math.max(0, state.hitIndex - 1), beat: localBeat, bar }
      // Mirrored lasers share their scatter point (so pairs stay symmetric) unless Symmetry is off.
      const scatterUnit = input.symmetry ? `${candidate.bank === 'right' ? 'left' : candidate.bank}:${candidate.pairIndex}` : candidate.id
      const aim = resolveAim(step, counters, motion, `${input.seed}:${pattern.id}:${layerIndex}:${scatterUnit}`)
      const colorRole: 'p' | 'a' | 'w' = step.color === 'alt' ? (counters.hit % 2 === 0 ? 'p' : 'a') : step.color ?? 'p'
      const origin = candidate.positionWorld
      const signs: number[] = candidate.mirrorSide === 'center'
        ? (Math.abs(aim.x) > 0.02 && !aim.rel ? [1, -1] : [1])
        : [input.symmetry ? (candidate.mirrorSide === 'left' ? -1 : 1) : 1]
      for (const sign of signs) {
        for (const offset of shape.offsets) {
          const ax = aim.x + (orient === 'h' ? offset : 0)
          const ay = aim.y + (orient === 'v' ? offset : 0)
          const tx = aim.rel ? origin[0] + sign * ax * TARGET_HALF_WIDTH * lateral : sign * ax * TARGET_HALF_WIDTH * lateral
          const target = Object.freeze([clamp(tx, -14, 14), TARGET_FLOOR + clamp(ay, -0.05, 1.05) * TARGET_HEIGHT, TARGET_Z]) as Cinema2Vector3
          pending.push({
            fixtureId: candidate.id,
            originWorld: origin,
            targetWorld: target,
            intensity: state.gate * shape.intensity,
            color: colorRole,
            width: shape.opticalWidth,
            pairId: candidate.pairId,
            priority: (layer.role === 'base' ? 0 : 1000) + layerIndex * 50 + candidate.pairIndex,
          })
        }
      }
    }
  })

  const litFixtureIds = limitLasers(pending, input.laserLimit, input.symmetry)
  const keep = new Set(litFixtureIds)
  const rays = pending.filter(ray => keep.has(ray.fixtureId)).map(({ priority: _priority, ...ray }) => Object.freeze(ray))
  return Object.freeze({ rays: Object.freeze(rays), litFixtureIds: Object.freeze(litFixtureIds), bar })
}

/** Laser Count: keeps the highest-priority lasers (base layers first, inner pairs first) and, with Symmetry on, whole mirrored pairs. */
function limitLasers(rays: readonly PendingRay[], rawLimit: number, symmetry: boolean): string[] {
  const priority = new Map<string, { priority: number; pairId: string }>()
  for (const ray of rays) {
    const current = priority.get(ray.fixtureId)
    if (!current || ray.priority < current.priority) priority.set(ray.fixtureId, { priority: ray.priority, pairId: ray.pairId })
  }
  const ranked = [...priority.entries()].sort((a, b) => a[1].priority - b[1].priority || a[0].localeCompare(b[0]))
  const limit = Math.max(1, Math.round(finiteOr(rawLimit, ranked.length)))
  if (ranked.length <= limit) return ranked.map(entry => entry[0])
  if (!symmetry) return ranked.slice(0, limit).map(entry => entry[0])
  const kept: string[] = []
  const seenPairs = new Set<string>()
  for (const [, info] of ranked) {
    if (seenPairs.has(info.pairId)) continue
    seenPairs.add(info.pairId)
    const members = ranked.filter(entry => entry[1].pairId === info.pairId).map(entry => entry[0])
    if (kept.length + members.length > limit) continue
    kept.push(...members)
  }
  return kept
}
