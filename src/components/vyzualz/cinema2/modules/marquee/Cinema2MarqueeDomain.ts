import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import {
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
  resolveCinema2AfterhoursTriggerEventIdentity,
  type Cinema2AfterhoursTriggerId,
} from '../Cinema2AfterhoursNativeModule'

export const CINEMA2_MARQUEE_PATTERN_IDS = Object.freeze([
  'opening-night',
  'canopy-cascade',
  'triple-face-relay',
  'tower-call-response',
  'neon-crown-rise',
  'velvet-intermission',
  'premiere-burst',
] as const)

export type Cinema2MarqueePatternId = typeof CINEMA2_MARQUEE_PATTERN_IDS[number]
export const CINEMA2_MARQUEE_DEFAULT_PATTERN: Cinema2MarqueePatternId = 'opening-night'
export const CINEMA2_MARQUEE_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2MarqueeTriggerId = Cinema2AfterhoursTriggerId

export type Cinema2MarqueeFixtureKind =
  | 'marquee-front'
  | 'marquee-left'
  | 'marquee-right'
  | 'canopy'
  | 'tower-left'
  | 'tower-right'
  | 'led-left'
  | 'led-right'
  | 'neon-red'
  | 'neon-amber'
  | 'neon-blue'
  | 'crowd-flash'

export interface Cinema2MarqueeSignals {
  readonly overall: number
  readonly sub: number
  readonly bass: number
  readonly mid: number
  readonly high: number
  readonly vocal: number
  readonly build: number
  readonly significance: number
}

export interface Cinema2MarqueeImpulses {
  readonly beat: number
  readonly kick: number
  readonly snare: number
  readonly downbeat: number
  readonly phrase: number
  readonly section: number
  readonly drop: number
  readonly transient: number
}

export interface Cinema2MarqueePerformanceFrame {
  readonly pattern: Cinema2MarqueePatternId
  readonly beats: number
  readonly patternBeats: number
  readonly signals: Readonly<Cinema2MarqueeSignals>
  readonly impulses: Readonly<Cinema2MarqueeImpulses>
}

export interface Cinema2MarqueeFixtureAddress {
  readonly kind: Cinema2MarqueeFixtureKind
  /** Stable 0..1 position within the physical row, perimeter, tower, or LED grid. */
  readonly progress: number
  /** Stable 0..1 row/depth coordinate where the source names provide one. */
  readonly row: number
}

export interface Cinema2MarqueePatternSelection {
  readonly basePattern: Cinema2MarqueePatternId
  readonly activePattern: Cinema2MarqueePatternId
  readonly patternStartBeat: number
  readonly changed: boolean
  readonly overridden: boolean
}

export interface Cinema2MarqueePatternControllerInput {
  readonly authoredPattern: Cinema2MarqueePatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MarqueeTriggerId
  readonly triggerEventId: string | null
  readonly absoluteBeat: number
  readonly autoPerformance: boolean
  readonly build: number
  readonly dropEventId: string | null
  readonly reset?: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)
const pulse = (distance: number, width: number) => clamp01(1 - Math.abs(distance) / Math.max(0.001, width))
const wrappedPulse = (position: number, front: number, width: number) => pulse((((position - front) % 1) + 1.5) % 1 - 0.5, width)

export const CINEMA2_MARQUEE_ZERO_SIGNALS: Readonly<Cinema2MarqueeSignals> = Object.freeze({
  overall: 0, sub: 0, bass: 0, mid: 0, high: 0, vocal: 0, build: 0, significance: 0,
})

export const CINEMA2_MARQUEE_ZERO_IMPULSES: Readonly<Cinema2MarqueeImpulses> = Object.freeze({
  beat: 0, kick: 0, snare: 0, downbeat: 0, phrase: 0, section: 0, drop: 0, transient: 0,
})

/** Pure fixture program. Each pattern gives at least one physical zone a distinct spatial grammar. */
export function evaluateCinema2MarqueeFixture(
  address: Readonly<Cinema2MarqueeFixtureAddress>,
  frame: Readonly<Cinema2MarqueePerformanceFrame>,
): number {
  const { pattern, patternBeats: beats, signals: s, impulses: e } = frame
  const p = clamp01(address.progress)
  const row = clamp01(address.row)
  const energy = clamp01(0.38 * s.overall + 0.28 * s.bass + 0.18 * s.mid + 0.08 * s.high + 0.08 * s.significance)
  if (address.kind === 'crowd-flash') return evaluateCinema2MarqueeCrowdFlash(address, frame)
  const marquee = address.kind.startsWith('marquee-')
  const tower = address.kind.startsWith('tower-')
  const led = address.kind.startsWith('led-')
  const neon = address.kind.startsWith('neon-')
  let gain = 0.2

  if (pattern === 'opening-night') {
    const chase = wrappedPulse(p, fract(beats / 8), 0.12)
    gain = address.kind === 'marquee-front' ? 0.62 + 0.34 * chase + 0.16 * e.beat
      : marquee ? 0.42 + 0.28 * chase
        : address.kind === 'canopy' ? 0.28 + 0.24 * s.bass + 0.26 * e.kick
          : tower ? 0.36 + 0.18 * e.downbeat
            : led ? 0.2 + 0.28 * s.mid : neon ? 0.48 + 0.12 * s.high : 0.25
  } else if (pattern === 'canopy-cascade') {
    const wave = wrappedPulse(row, fract(beats / 2), 0.12)
    gain = address.kind === 'canopy' ? 0.14 + 0.8 * wave + 0.34 * e.kick
      : marquee ? 0.28 + 0.22 * e.beat : tower ? 0.22 + 0.28 * e.downbeat
        : led ? 0.18 + 0.24 * s.mid : neon ? 0.38 + 0.18 * s.high : 0.2
  } else if (pattern === 'triple-face-relay') {
    const face = address.kind === 'marquee-left' ? 0 : address.kind === 'marquee-front' ? 1 : address.kind === 'marquee-right' ? 2 : -1
    const relay = face < 0 ? 0 : pulse((((beats / 2) % 3) + 3) % 3 - face, 0.58)
    gain = marquee ? 0.12 + 0.88 * relay + 0.18 * e.beat
      : address.kind === 'canopy' ? 0.24 + 0.25 * wrappedPulse(p, fract(beats / 3), 0.18)
        : tower ? 0.26 + 0.24 * e.snare : led ? 0.16 + 0.22 * s.mid : neon ? 0.42 : 0.2
  } else if (pattern === 'tower-call-response') {
    const leftTurn = Math.floor(beats) % 2 === 0
    const active = address.kind.endsWith('left') === leftTurn
    const climb = wrappedPulse(row, fract(beats / 2), 0.18)
    gain = tower ? 0.12 + (active ? 0.72 : 0.24) * climb + 0.5 * e.snare
      : led ? 0.1 + (!active ? 0.65 : 0.22) * climb + 0.34 * e.transient
        : marquee ? 0.3 + 0.2 * e.beat : address.kind === 'canopy' ? 0.2 + 0.22 * e.kick : neon ? 0.38 : 0.2
  } else if (pattern === 'neon-crown-rise') {
    const rise = clamp01(s.build * 0.78 + fract(beats / 8) * 0.34)
    const layer = address.kind === 'neon-blue' ? 0.72 : address.kind === 'neon-amber' ? 0.48 : 0.24
    gain = neon ? 0.18 + 0.78 * clamp01((rise - layer + 0.3) / 0.3) + 0.36 * e.phrase
      : marquee ? 0.34 + 0.24 * s.high : tower ? 0.3 + 0.22 * e.downbeat
        : address.kind === 'canopy' ? 0.2 + 0.22 * s.bass : led ? 0.2 + 0.3 * s.mid : 0.2
  } else if (pattern === 'velvet-intermission') {
    gain = marquee ? 0.48 + 0.12 * wrappedPulse(p, fract(beats / 12), 0.18)
      : address.kind === 'canopy' ? 0.18 + 0.16 * s.sub
        : tower ? 0.24 + 0.14 * e.downbeat : led ? 0.08 + 0.12 * s.vocal
          : neon ? 0.24 + (address.kind === 'neon-red' ? 0.16 : 0.04) : 0.16
  } else {
    const burst = clamp01(0.45 + 0.55 * Math.max(e.drop, e.downbeat, energy))
    const sweep = wrappedPulse(p, fract(beats), 0.22)
    gain = (marquee ? 0.52 + 0.46 * sweep : address.kind === 'canopy' ? 0.42 + 0.56 * wrappedPulse(row, fract(beats), 0.2)
      : tower ? 0.48 + 0.46 * (1 - row) : led ? 0.4 + 0.52 * row : neon ? 0.62 + 0.34 * s.high : 0.4) * burst
  }

  // Continuous and rhythmic categories remain spatially distinct.
  if (address.kind === 'canopy') gain += 0.16 * s.bass + 0.24 * e.kick
  if (tower) gain += 0.22 * e.snare
  if (led) gain += 0.14 * s.mid + 0.16 * e.transient
  if (neon) gain += 0.1 * s.high + (address.kind === 'neon-red' ? 0.18 * s.build : 0)
  if (marquee) gain += 0.12 * e.beat + 0.18 * e.phrase
  gain += 0.28 * e.drop
  return clamp01(gain)
}

/**
 * Paparazzi camera flashes. Pattern-independent: a flash pops when a music impulse lands and the camera's own (stable) draw says it is one of
 * the cameras that fires on that kind of event, plus a sparse idle twinkle on the beat clock so the crowd is alive with no music at all.
 */
export function evaluateCinema2MarqueeCrowdFlash(
  address: Readonly<Cinema2MarqueeFixtureAddress>,
  frame: Readonly<Cinema2MarqueePerformanceFrame>,
): number {
  const { impulses: e, signals: s, beats } = frame
  const seed = fract(Math.sin(address.progress * 91.7 + address.row * 37.3) * 43758.5453)
  const seed2 = fract(seed * 7.13 + 0.31)
  const seed3 = fract(seed * 3.71 + 0.67)
  const idle = fract(beats * 0.5 + seed) < 0.06 ? 0.55 : 0
  const pop = e.kick * (seed < 0.45 ? 1 : 0) + e.snare * (seed2 < 0.5 ? 1 : 0) + e.transient * (seed3 < 0.35 ? 0.9 : 0)
    + e.beat * (seed < 0.18 ? 0.8 : 0) + e.drop * (seed2 < 0.8 ? 1 : 0) + e.downbeat * (seed3 < 0.4 ? 0.9 : 0)
  return clamp01(idle + pop * (0.55 + 0.45 * clamp01(s.overall + 0.4)))
}

export function createCinema2MarqueePatternCycle(sample: (index: number) => number): readonly Cinema2MarqueePatternId[] {
  const cycle = [...CINEMA2_MARQUEE_PATTERN_IDS]
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.min(0.999999, clamp01(sample(cycle.length - 1 - index))) * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

function nextPattern(cycle: readonly Cinema2MarqueePatternId[], current: Cinema2MarqueePatternId): Cinema2MarqueePatternId {
  const index = cycle.indexOf(current)
  return cycle[(index < 0 ? 0 : index + 1) % cycle.length] ?? CINEMA2_MARQUEE_DEFAULT_PATTERN
}

/** Runtime-only pattern authority; persistent authored values are never mutated. */
export class Cinema2MarqueePatternController {
  private basePattern: Cinema2MarqueePatternId = CINEMA2_MARQUEE_DEFAULT_PATTERN
  private authoredPattern: Cinema2MarqueePatternId | null = null
  private patternChange: boolean | null = null
  private trigger: Cinema2MarqueeTriggerId | null = null
  private lastTriggerEventId: string | null = null
  private lastDropEventId: string | null = null
  private patternStartBeat = 0
  private buildArmed = true
  private override: { pattern: Cinema2MarqueePatternId; untilBeat: number } | null = null

  constructor(private readonly cycle: readonly Cinema2MarqueePatternId[]) {}

  update(input: Readonly<Cinema2MarqueePatternControllerInput>): Readonly<Cinema2MarqueePatternSelection> {
    const beat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const authoredChanged = this.authoredPattern != null && input.authoredPattern !== this.authoredPattern
    const toggleChanged = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    let changed = false

    if (input.reset || this.authoredPattern == null || authoredChanged || toggleChanged) {
      this.basePattern = input.authoredPattern
      this.patternStartBeat = beat
      this.lastTriggerEventId = input.triggerEventId
      this.override = null
      if (authoredChanged) this.buildArmed = false
      changed = true
    } else if (triggerChanged || !input.patternChange) {
      this.lastTriggerEventId = input.triggerEventId
      if (!input.patternChange && this.basePattern !== input.authoredPattern) {
        this.basePattern = input.authoredPattern
        this.patternStartBeat = beat
        changed = true
      }
    } else if (input.triggerEventId && input.triggerEventId !== this.lastTriggerEventId) {
      this.basePattern = nextPattern(this.cycle, this.basePattern)
      this.patternStartBeat = beat
      this.lastTriggerEventId = input.triggerEventId
      changed = true
    }

    if (input.build < 0.48) this.buildArmed = true
    if (!input.autoPerformance) this.override = null
    else if (input.dropEventId && input.dropEventId !== this.lastDropEventId) {
      this.lastDropEventId = input.dropEventId
      this.override = { pattern: 'premiere-burst', untilBeat: beat + 4 }
    } else if (this.buildArmed && input.build >= 0.74) {
      this.buildArmed = false
      this.override = { pattern: 'neon-crown-rise', untilBeat: beat + 8 }
    }
    if (this.override && beat >= this.override.untilBeat) this.override = null

    this.authoredPattern = input.authoredPattern
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    const activePattern = this.override?.pattern ?? this.basePattern
    return Object.freeze({ basePattern: this.basePattern, activePattern, patternStartBeat: this.patternStartBeat, changed, overridden: this.override != null })
  }

  reset(): void {
    this.basePattern = CINEMA2_MARQUEE_DEFAULT_PATTERN
    this.authoredPattern = null
    this.patternChange = null
    this.trigger = null
    this.lastTriggerEventId = null
    this.lastDropEventId = null
    this.patternStartBeat = 0
    this.buildArmed = true
    this.override = null
  }
}

export function resolveCinema2MarqueeTriggerEventIdentity(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  trigger: Cinema2MarqueeTriggerId,
  previousTimeSec: number | null,
): string | null {
  return resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, previousTimeSec)
}

export function isCinema2MarqueePattern(value: unknown): value is Cinema2MarqueePatternId {
  return typeof value === 'string' && CINEMA2_MARQUEE_PATTERN_IDS.includes(value as Cinema2MarqueePatternId)
}

export function isCinema2MarqueeTrigger(value: unknown): value is Cinema2MarqueeTriggerId {
  return typeof value === 'string' && CINEMA2_MARQUEE_TRIGGER_IDS.includes(value as Cinema2MarqueeTriggerId)
}
