/**
 * HUM:N structural performance vocabulary: drop gestures, phrase/section body
 * language, deterministic selection, authority math and pose/geometry
 * resolution. Pure TypeScript with no GL access so every rule is unit-testable.
 *
 * Ownership boundaries:
 * - Events arrive from shared Choreography (drop / phrase / section-change).
 * - Selection is a pure function of a module/event random draw plus (only when
 *   Auto Performance is on) shared Visual Director context.
 * - Amplitude is always bounded by live user ceilings (Gesture Intensity,
 *   Motion Amount); nothing here is ever written into parameter state.
 */

import {
  CINEMA2_HUMN_ARM_ANCHORS,
  CINEMA2_HUMN_HAND_UNIT_BOUNDS,
  CINEMA2_HUMN_HAND_UNIT_WIDTH,
  CINEMA2_HUMN_HAND_UNIT_WRIST,
} from './Cinema2HumNLimbTopology'

// ── Vocabulary ──────────────────────────────────────────────────────────────

export const CINEMA2_HUMN_DROP_GESTURES = Object.freeze(['reach', 'shock', 'headGrab', 'lunge'] as const)
export type Cinema2HumNDropGesture = typeof CINEMA2_HUMN_DROP_GESTURES[number]

export const CINEMA2_HUMN_STRUCTURAL_VARIANTS = Object.freeze(['lookLeft', 'lookRight', 'bodyTurn', 'scan', 'center'] as const)
export type Cinema2HumNStructuralVariant = typeof CINEMA2_HUMN_STRUCTURAL_VARIANTS[number]

export type Cinema2HumNStructuralKind = 'drop' | 'phrase' | 'section'

export interface Cinema2HumNBeatTiming {
  readonly attack: number
  readonly hold: number
  readonly release: number
}

/** Musical-time envelopes in beats. Drop gestures: attack 0.10-0.20, hold 0.25-0.50, release 1-2. */
export const CINEMA2_HUMN_DROP_GESTURE_TIMINGS: Readonly<Record<Cinema2HumNDropGesture, Cinema2HumNBeatTiming>> = Object.freeze({
  reach: Object.freeze({ attack: 0.15, hold: 0.4, release: 1.5 }),
  shock: Object.freeze({ attack: 0.1, hold: 0.25, release: 1 }),
  headGrab: Object.freeze({ attack: 0.2, hold: 0.5, release: 2 }),
  lunge: Object.freeze({ attack: 0.15, hold: 0.4, release: 1.5 }),
})

/** Phrase/section variations run 1-4 beats. */
export const CINEMA2_HUMN_STRUCTURAL_TIMINGS: Readonly<Record<Cinema2HumNStructuralVariant, Cinema2HumNBeatTiming>> = Object.freeze({
  lookLeft: Object.freeze({ attack: 0.4, hold: 0.6, release: 1 }),
  lookRight: Object.freeze({ attack: 0.4, hold: 0.6, release: 1 }),
  bodyTurn: Object.freeze({ attack: 0.8, hold: 1, release: 1.6 }),
  scan: Object.freeze({ attack: 1, hold: 1, release: 1.8 }),
  center: Object.freeze({ attack: 0.5, hold: 0.5, release: 1 }),
})

/** Authority bounds (fraction of the user ceiling). Phrase is calmer than section, both far calmer than drops. */
export const CINEMA2_HUMN_STRUCTURAL_AUTHORITY = Object.freeze({
  phrase: Object.freeze({ gesture: 0.35, motion: 0.5 }),
  section: Object.freeze({ gesture: 0.6, motion: 0.7 }),
})

/** Peak forward-lunge figure-domain scale gain at full authority (approx 20-35% band, top of it). */
export const CINEMA2_HUMN_LUNGE_PEAK_GAIN = 0.35
/** Reach foreground hand share of frame width at full authority (approx 30-40%). */
export const CINEMA2_HUMN_REACH_PEAK_FRAME_WIDTH = 0.35
export const CINEMA2_HUMN_LUNGE_PIVOT = Object.freeze({ x: 0, y: 0.7 })

const MAX_ACTIVE_MOVES = 4
const MAX_REMEMBERED_EVENTS = 64
const RETRIGGER_RELEASE_BEATS = 0.5

const COMPOSITION_ANCHOR = Object.freeze({ x: 0, y: 0.0266565 })

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, Number.EPSILON), 0, 1)
  return t * t * (3 - 2 * t)
}

function totalBeats(timing: Cinema2HumNBeatTiming): number {
  return timing.attack + timing.hold + timing.release
}

/** Eased attack -> hold -> eased release, in beats. Returns exactly 0 outside the window. */
export function cinema2HumNEnvelope(elapsedBeats: number, timing: Cinema2HumNBeatTiming): number {
  if (!(elapsedBeats >= 0)) return 0
  if (elapsedBeats < timing.attack) return smoothstep(0, timing.attack, elapsedBeats)
  const afterAttack = elapsedBeats - timing.attack
  if (afterAttack <= timing.hold) return 1
  const released = afterAttack - timing.hold
  if (released >= timing.release) return 0
  return 1 - smoothstep(0, timing.release, released)
}

// ── Director context and deterministic selection ────────────────────────────

/** Minimal, preset-agnostic view of the shared Visual Director frame. */
export interface Cinema2HumNDirectorContext {
  readonly phase: 'low' | 'steady' | 'rising' | 'building' | 'peak' | 'release' | null
  readonly intensity: number | null
  readonly momentum: number | null
  readonly build: number | null
  readonly impact: number | null
  readonly variation: number | null
  readonly sectionType: string | null
}

interface DirectorLike {
  phase: { available: boolean; value: Cinema2HumNDirectorContext['phase'] }
  continuous: { intensity: { available: boolean; value: number | null }; momentum: { available: boolean; value: number | null } }
  authority: { impact: { available: boolean; authority: number }; variation: { available: boolean; authority: number } }
  context: { build: { available: boolean; value: number | null }; section: { available: boolean; value: { type: string | null } | null } }
}

export function cinema2HumNDirectorContext(director: DirectorLike | null | undefined): Cinema2HumNDirectorContext | null {
  if (!director) return null
  const signal = (entry: { available: boolean; value: number | null }) => (entry.available && entry.value != null ? clamp01(entry.value) : null)
  return Object.freeze({
    phase: director.phase.available ? director.phase.value : null,
    intensity: signal(director.continuous.intensity),
    momentum: signal(director.continuous.momentum),
    build: signal(director.context.build),
    impact: director.authority.impact.available ? clamp01(director.authority.impact.authority) : null,
    variation: director.authority.variation.available ? clamp01(director.authority.variation.authority) : null,
    sectionType: director.context.section.available ? director.context.section.value?.type ?? null : null,
  })
}

function weightedChoice<T extends string>(entries: readonly (readonly [T, number])[], unit: number): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (total <= 0) return entries[0]![0]
  let threshold = clamp(unit, 0, 0.999999) * total
  for (const [value, weight] of entries) {
    threshold -= Math.max(0, weight)
    if (threshold < 0) return value
  }
  return entries[entries.length - 1]![0]
}

/**
 * Manual selection is a uniform pick from the event's own random draw. With
 * Auto Performance on, shared Director context only re-weights the same four
 * authored families (it never invents geometry).
 */
export function selectCinema2HumNDropGesture(
  unit: number,
  options: { auto: Cinema2HumNDirectorContext | null; previous?: Cinema2HumNDropGesture | null } = { auto: null },
): Cinema2HumNDropGesture {
  const weights: Record<Cinema2HumNDropGesture, number> = { reach: 1, shock: 1, headGrab: 1, lunge: 1 }
  const context = options.auto
  if (context) {
    const impact = context.impact ?? 0.5
    const build = context.build ?? 0
    const momentum = context.momentum ?? 0.5
    if (impact >= 0.7) { weights.lunge *= 2.2; weights.reach *= 1.6 }
    if (context.phase === 'peak' || momentum >= 0.7) { weights.lunge *= 1.5; weights.reach *= 1.3 }
    if (context.phase === 'release' || context.phase === 'low' || context.phase === 'steady') { weights.shock *= 2; weights.headGrab *= 2 }
    if (build >= 0.5) { weights.reach *= 1.5; weights.headGrab *= 0.6 }
    if ((context.variation ?? 0) >= 0.5 && options.previous) weights[options.previous] = 0
  }
  return weightedChoice(CINEMA2_HUMN_DROP_GESTURES.map(gesture => [gesture, weights[gesture]] as const), unit)
}

export function selectCinema2HumNStructuralVariant(
  kind: 'phrase' | 'section',
  unit: number,
  auto: Cinema2HumNDirectorContext | null,
): Cinema2HumNStructuralVariant {
  const weights: Record<'look' | 'bodyTurn' | 'scan' | 'center', number> = {
    look: 1,
    bodyTurn: 1,
    scan: 1,
    center: kind === 'section' ? 0.5 : 0,
  }
  if (auto) {
    if (auto.phase === 'building' || auto.phase === 'rising') weights.scan *= 2.4
    if (auto.phase === 'peak') weights.bodyTurn *= 2.2
    if (auto.phase === 'release' || auto.phase === 'low') { weights.center *= 3; weights.look *= 1.4 }
    if (auto.sectionType === 'breakdown' || auto.sectionType === 'outro') weights.center *= 2
  }
  const family = weightedChoice((['look', 'bodyTurn', 'scan', 'center'] as const).map(name => [name, weights[name]] as const), unit)
  if (family === 'look') return 'lookLeft'
  return family
}

/**
 * Auto Performance may use Director impact authority as a gate and strength
 * input for a drop. Returns null when the impact is too weak to stage a gesture.
 */
export function cinema2HumNAutoDropStrength(strength: number, impact: number | null): number | null {
  if (impact == null) return strength
  if (impact < 0.15) return null
  return strength * (0.6 + 0.4 * clamp01(impact))
}

/** A second, independent draw picks direction so look/scan sides are not correlated with the family choice. */
export function cinema2HumNDirectionFromUnit(unit: number): 1 | -1 {
  return unit < 0.5 ? -1 : 1
}

// ── Authority ───────────────────────────────────────────────────────────────

export interface Cinema2HumNCeilings {
  /** Resolved Gesture Intensity (user base, possibly scaled down by Auto Performance). */
  readonly gestureIntensity: number
  /** Resolved Motion Amount. */
  readonly motionAmount: number
}

export function cinema2HumNStructuralAmplitude(kind: 'phrase' | 'section', ceilings: Cinema2HumNCeilings): number {
  const bounds = CINEMA2_HUMN_STRUCTURAL_AUTHORITY[kind]
  return clamp01(Math.max(bounds.gesture * clamp01(ceilings.gestureIntensity), bounds.motion * clamp01(ceilings.motionAmount)))
}

// ── Runtime ─────────────────────────────────────────────────────────────────

export interface Cinema2HumNTrigger {
  readonly eventId: string
  readonly kind: Cinema2HumNStructuralKind
  readonly gesture?: Cinema2HumNDropGesture
  readonly variant?: Cinema2HumNStructuralVariant
  /** +1 or -1: which way a look/scan/turn goes. */
  readonly sign?: 1 | -1
  /** Second independent draw in [0, 1): body-turn head follow vs counter-look. */
  readonly alt?: number
  readonly strength: number
  readonly startSec: number
  readonly beatSec: number
}

interface ActiveMove extends Cinema2HumNTrigger {
  timing: Cinema2HumNBeatTiming
  releasing: { startSec: number; weight: number; beats: number } | null
}

export interface Cinema2HumNPerformancePose {
  reach: number
  shock: number
  headGrab: number
  lunge: number
  /** Head yaw in [-1, 1]; +1 looks toward viewer-right. */
  lookYaw: number
  /** Upper-body turn in [-1, 1]. */
  bodyTurn: number
  /** Brief settle/nod in [0, 1]. */
  nod: number
}

export const CINEMA2_HUMN_NEUTRAL_POSE: Readonly<Cinema2HumNPerformancePose> = Object.freeze({
  reach: 0, shock: 0, headGrab: 0, lunge: 0, lookYaw: 0, bodyTurn: 0, nod: 0,
})

function scanCurve(tau: number): number {
  return clamp(Math.sin(2 * Math.PI * tau) * Math.sin(Math.PI * tau) * 1.35, -1, 1)
}

/**
 * Module-local, side-effect-free performance state. It owns only the timing of
 * events Choreography already deduplicated; it never scans audio and never
 * stores parameter values.
 */
export class Cinema2HumNPerformanceRuntime {
  private active: ActiveMove[] = []
  private readonly seen = new Set<string>()
  private readonly seenOrder: string[] = []
  private lastDropGesture: Cinema2HumNDropGesture | null = null

  get previousDropGesture(): Cinema2HumNDropGesture | null {
    return this.lastDropGesture
  }

  get activeCount(): number {
    return this.active.length
  }

  /** Returns false for an already-seen event id or an event that cannot be timed. */
  trigger(input: Cinema2HumNTrigger, nowSec: number): boolean {
    if (this.seen.has(input.eventId)) return false
    if (!(input.beatSec > 0) || !Number.isFinite(input.beatSec) || !Number.isFinite(input.startSec)) return false
    this.seen.add(input.eventId)
    this.seenOrder.push(input.eventId)
    while (this.seenOrder.length > MAX_REMEMBERED_EVENTS) this.seen.delete(this.seenOrder.shift()!)

    const timing = input.kind === 'drop' && input.gesture
      ? CINEMA2_HUMN_DROP_GESTURE_TIMINGS[input.gesture]
      : input.variant ? CINEMA2_HUMN_STRUCTURAL_TIMINGS[input.variant] : null
    if (!timing) return false

    // A newer event of the same kind releases the older one quickly instead of popping.
    for (const move of this.active) {
      if (move.kind === input.kind && !move.releasing) {
        move.releasing = { startSec: nowSec, weight: this.moveEnvelope(move, nowSec), beats: RETRIGGER_RELEASE_BEATS }
      }
    }
    if (input.kind === 'drop' && input.gesture) this.lastDropGesture = input.gesture
    this.active.push({ ...input, timing, releasing: null })
    while (this.active.length > MAX_ACTIVE_MOVES) this.active.shift()
    return true
  }

  reset(): void {
    this.active = []
    this.seen.clear()
    this.seenOrder.length = 0
    this.lastDropGesture = null
  }

  private moveEnvelope(move: ActiveMove, nowSec: number): number {
    const elapsedBeats = (nowSec - move.startSec) / move.beatSec
    if (move.releasing) {
      const releaseElapsed = (nowSec - move.releasing.startSec) / (move.beatSec * move.releasing.beats)
      return move.releasing.weight * (1 - smoothstep(0, 1, releaseElapsed))
    }
    return cinema2HumNEnvelope(elapsedBeats, move.timing)
  }

  private isFinished(move: ActiveMove, nowSec: number): boolean {
    if (move.releasing) return nowSec - move.releasing.startSec >= move.beatSec * move.releasing.beats
    return (nowSec - move.startSec) / move.beatSec >= totalBeats(move.timing)
  }

  /**
   * Resolves the current pose. Live ceilings are applied here (not latched), so
   * lowering Gesture Intensity or Motion Amount mid-gesture takes effect at once.
   * A clock that runs backwards past an event's start (seek/loop) drops it.
   */
  evaluate(nowSec: number, ceilings: Cinema2HumNCeilings): Cinema2HumNPerformancePose {
    const pose: Cinema2HumNPerformancePose = { ...CINEMA2_HUMN_NEUTRAL_POSE }
    const gestureCeiling = clamp01(ceilings.gestureIntensity)
    let centerDamp = 0

    this.active = this.active.filter(move => nowSec >= move.startSec - 0.05 && !this.isFinished(move, nowSec))

    for (const move of this.active) {
      const envelope = this.moveEnvelope(move, nowSec)
      const strength = clamp01(move.strength)
      if (move.kind === 'drop' && move.gesture) {
        pose[move.gesture] = clamp01(pose[move.gesture] + envelope * strength * gestureCeiling)
        continue
      }
      const kind = move.kind === 'phrase' ? 'phrase' : 'section'
      const amplitude = cinema2HumNStructuralAmplitude(kind, ceilings) * strength * envelope
      if (amplitude <= 0 || !move.variant) continue
      const sign = move.sign ?? 1
      switch (move.variant) {
        case 'lookLeft':
        case 'lookRight':
          pose.lookYaw += sign * amplitude
          pose.bodyTurn += 0.3 * sign * amplitude
          break
        case 'bodyTurn':
          pose.bodyTurn += sign * amplitude
          pose.lookYaw += (move.alt ?? 0) >= 0.5 ? 0.5 * sign * amplitude : -0.4 * sign * amplitude
          break
        case 'scan': {
          const tau = clamp01((nowSec - move.startSec) / (move.beatSec * totalBeats(move.timing)))
          const scan = sign * scanCurve(tau) * clamp01(strength) * (kind === 'phrase'
            ? cinema2HumNStructuralAmplitude('phrase', ceilings)
            : cinema2HumNStructuralAmplitude('section', ceilings))
          pose.lookYaw += scan
          pose.bodyTurn += 0.3 * scan
          break
        }
        case 'center':
          pose.nod = clamp01(pose.nod + amplitude)
          centerDamp = Math.max(centerDamp, envelope)
          break
      }
    }

    pose.lookYaw = clamp(pose.lookYaw * (1 - 0.85 * centerDamp), -1, 1)
    pose.bodyTurn = clamp(pose.bodyTurn * (1 - 0.85 * centerDamp), -1, 1)
    return pose
  }
}

// ── Pose -> shader uniforms ─────────────────────────────────────────────────

export interface Cinema2HumNViewGeometry {
  aspect: number
  /** Resolved (safe-capped) figure scale, i.e. what u_figureScale already is. */
  figureScale: number
}

export function cinema2HumNPortraitScale(aspect: number): number {
  return 1.02 + (1.14 - 1.02) * smoothstep(1.1, 1.9, aspect)
}

/** Screen-space (normalized, y up) position of a figure-local point under idle framing. */
export function cinema2HumNProjectFigurePoint(
  point: readonly [number, number],
  view: Cinema2HumNViewGeometry,
): readonly [number, number] {
  const portraitScale = cinema2HumNPortraitScale(view.aspect)
  const x = COMPOSITION_ANCHOR.x + view.figureScale * (point[0] - COMPOSITION_ANCHOR.x)
  const y = COMPOSITION_ANCHOR.y + view.figureScale * (point[1] - COMPOSITION_ANCHOR.y)
  return [(portraitScale * x) / view.aspect, portraitScale * (y - 0.012)]
}

/** Head critical points that must stay inside the frame at every gesture peak. */
export const CINEMA2_HUMN_HEAD_CRITICAL_POINTS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([-0.04, 0.826] as const), // crown
  Object.freeze([-0.43, 0.30] as const), // left temple
  Object.freeze([0.35, 0.30] as const), // right temple
  Object.freeze([-0.34, 0.62] as const), // upper-left brow
])

const SAFE_SCREEN_LIMIT = 0.985

function lungePoint(point: readonly [number, number], scale: number): readonly [number, number] {
  const pivot = CINEMA2_HUMN_LUNGE_PIVOT
  return [pivot.x + (point[0] - pivot.x) * scale, pivot.y + (point[1] - pivot.y) * scale]
}

/**
 * The largest lunge scale (up to the peak gain) that keeps the head's critical
 * points inside the frame for this viewport. Never below 1.
 */
export function cinema2HumNLungeScaleCap(view: Cinema2HumNViewGeometry): number {
  const peak = 1 + CINEMA2_HUMN_LUNGE_PEAK_GAIN
  let scale = peak
  for (let iteration = 0; iteration < 24; iteration++) {
    const inside = CINEMA2_HUMN_HEAD_CRITICAL_POINTS.every(point => {
      const projected = cinema2HumNProjectFigurePoint(lungePoint(point, scale), view)
      return Math.abs(projected[0]) <= SAFE_SCREEN_LIMIT && Math.abs(projected[1]) <= SAFE_SCREEN_LIMIT
    })
    if (inside) return scale
    scale = 1 + (scale - 1) * 0.9
  }
  return 1
}

export function cinema2HumNLungeScale(weight: number, view: Cinema2HumNViewGeometry): number {
  return 1 + (cinema2HumNLungeScaleCap(view) - 1) * clamp01(weight)
}

export interface Cinema2HumNReachGeometry {
  readonly weight: number
  /** Hand origin (palm centre) in pre-figure-scale screen space (p0). */
  readonly handX: number
  readonly handY: number
  readonly handScale: number
  readonly handAngle: number
  readonly shoulderX: number
  readonly shoulderY: number
  readonly elbowX: number
  readonly elbowY: number
  readonly wristX: number
  readonly wristY: number
  /** Hand width as a share of the visible frame width. */
  readonly frameWidthShare: number
}

/**
 * Reach is a foreground projection: the hand is sized against the visible
 * frame (about 30-40% of its width at full authority, capped by frame height)
 * and connected back to the figure's own shoulder by a tapering forearm. The
 * figure itself and the background grid are untouched.
 */
export function resolveCinema2HumNReachGeometry(weight: number, view: Cinema2HumNViewGeometry): Cinema2HumNReachGeometry {
  const w = clamp01(weight)
  const portraitScale = cinema2HumNPortraitScale(view.aspect)
  const halfWidth = view.aspect / portraitScale
  const frameWidth = 2 * halfWidth
  const frameHeight = 2 / portraitScale
  const unitHeight = CINEMA2_HUMN_HAND_UNIT_BOUNDS.maxY - CINEMA2_HUMN_HAND_UNIT_BOUNDS.minY
  const desiredWidth = CINEMA2_HUMN_REACH_PEAK_FRAME_WIDTH * frameWidth * Math.pow(w, 0.75)
  const heightLimitedWidth = (0.85 * frameHeight) * (CINEMA2_HUMN_HAND_UNIT_WIDTH / unitHeight)
  const width = Math.min(desiredWidth, heightLimitedWidth)
  const scale = width / CINEMA2_HUMN_HAND_UNIT_WIDTH
  const angle = 0.18

  const boundsCenterX = (CINEMA2_HUMN_HAND_UNIT_BOUNDS.minX + CINEMA2_HUMN_HAND_UNIT_BOUNDS.maxX) / 2
  const boundsCenterY = (CINEMA2_HUMN_HAND_UNIT_BOUNDS.minY + CINEMA2_HUMN_HAND_UNIT_BOUNDS.maxY) / 2
  const targetCenterX = halfWidth - width / 2 - 0.075 * frameWidth
  const targetCenterY = -0.2
  const restX = targetCenterX - boundsCenterX * scale
  const restY = targetCenterY - boundsCenterY * scale

  const shoulderFigure = CINEMA2_HUMN_ARM_ANCHORS.rightShoulder
  const shoulderX = COMPOSITION_ANCHOR.x + view.figureScale * (shoulderFigure[0] - COMPOSITION_ANCHOR.x)
  const shoulderY = COMPOSITION_ANCHOR.y + view.figureScale * (shoulderFigure[1] - COMPOSITION_ANCHOR.y)

  // The hand emerges from the shoulder and settles into place over the first part of the gesture.
  const settle = 1 - Math.pow(1 - clamp01(w * 1.6), 2)
  const handX = shoulderX + (restX - shoulderX) * settle
  const handY = shoulderY + (restY - shoulderY) * settle

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const wristX = handX + (cos * CINEMA2_HUMN_HAND_UNIT_WRIST[0] - sin * CINEMA2_HUMN_HAND_UNIT_WRIST[1]) * scale
  const wristY = handY + (sin * CINEMA2_HUMN_HAND_UNIT_WRIST[0] + cos * CINEMA2_HUMN_HAND_UNIT_WRIST[1]) * scale

  // Elbow bows outward/down from the straight shoulder-wrist line so the arm reads as bent.
  const dx = wristX - shoulderX
  const dy = wristY - shoulderY
  const length = Math.hypot(dx, dy) || 1
  const elbowX = shoulderX + dx * 0.5 + (dy / length) * 0.2 * length
  const elbowY = shoulderY + dy * 0.5 - (dx / length) * 0.2 * length

  return Object.freeze({
    weight: w,
    handX, handY, handScale: scale, handAngle: angle,
    shoulderX, shoulderY, elbowX, elbowY, wristX, wristY,
    frameWidthShare: width / frameWidth,
  })
}

export interface Cinema2HumNGestureUniforms {
  readonly reach: Cinema2HumNReachGeometry
  readonly shock: number
  readonly headGrab: number
  readonly lungeWeight: number
  readonly lungeScale: number
  readonly lookYaw: number
  readonly bodyTurn: number
  readonly nod: number
}

export function resolveCinema2HumNGestureUniforms(
  pose: Readonly<Cinema2HumNPerformancePose>,
  view: Cinema2HumNViewGeometry,
): Cinema2HumNGestureUniforms {
  return Object.freeze({
    reach: resolveCinema2HumNReachGeometry(pose.reach, view),
    shock: clamp01(pose.shock),
    headGrab: clamp01(pose.headGrab),
    lungeWeight: clamp01(pose.lunge),
    lungeScale: cinema2HumNLungeScale(pose.lunge, view),
    lookYaw: clamp(pose.lookYaw, -1, 1),
    bodyTurn: clamp(pose.bodyTurn, -1, 1),
    nod: clamp01(pose.nod),
  })
}

/**
 * Forward (figure-local) pose used for safe-bound checks; the native shader
 * applies the inverse of exactly these steps when sampling. Head-only offsets
 * are deliberately tiny (<= 0.05 units) so they can never move the head out of
 * the approved frame on their own.
 */
export function cinema2HumNForwardPosePoint(
  point: readonly [number, number],
  uniforms: Readonly<Cinema2HumNGestureUniforms>,
): readonly [number, number] {
  let [x, y] = lungePoint(point, uniforms.lungeScale)
  const headWeight = smoothstep(-0.22, 0.05, y)
  const shockHead = uniforms.shock * headWeight
  x = -0.04 + (x + 0.04) * (1 - 0.07 * shockHead)
  y = 0.35 + (y - 0.35) * (1 - 0.07 * shockHead) + 0.03 * shockHead
  y -= 0.03 * uniforms.headGrab * headWeight
  const tilt = 0.09 * uniforms.headGrab * headWeight
  const px = x + 0.04
  const py = y - 0.1
  x = -0.04 + px * Math.cos(tilt) - py * Math.sin(tilt)
  y = 0.1 + px * Math.sin(tilt) + py * Math.cos(tilt)
  x += 0.05 * uniforms.lookYaw * headWeight
  return [x, y]
}
