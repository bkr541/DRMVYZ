import {
  CINEMA2_ATL_HOE_DEFAULT_PATTERN,
  CINEMA2_ATL_HOE_PATTERN_IDS,
  type Cinema2AtlHoePatternId,
  type Cinema2AtlHoePatternTransitionInput,
} from './Cinema2AtlHoePatternEngine'

export const CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS = 0.45
export const CINEMA2_ATL_HOE_TRIGGER_IDS = Object.freeze([
  'beat', 'kick', 'snare', 'downbeat', 'beat2', 'bar', 'bar4', 'bar8', 'phrase', 'section', 'drop',
] as const)
export type Cinema2AtlHoeTriggerId = typeof CINEMA2_ATL_HOE_TRIGGER_IDS[number]

export interface Cinema2AtlHoePatternSelection {
  readonly pattern: Cinema2AtlHoePatternId
  readonly changed: boolean
  readonly transition: Readonly<Cinema2AtlHoePatternTransitionInput> | null
}

export interface Cinema2AtlHoePatternControllerInput {
  readonly authoredPattern: Cinema2AtlHoePatternId
  readonly autoPerformance: boolean
  readonly patternChange: boolean
  readonly triggerEventId: string | null
  readonly autoBoundaryId: string | null
  readonly autoPattern: Cinema2AtlHoePatternId
  readonly deltaTimeSec: number
}

/** A stable shuffled order prevents adjacent repeats without introducing wall-clock randomness. */
export function createCinema2AtlHoePatternCycle(sample: (index: number) => number): readonly Cinema2AtlHoePatternId[] {
  const result = [...CINEMA2_ATL_HOE_PATTERN_IDS]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const unit = Math.min(0.999999, Math.max(0, sample(index)))
    const swap = Math.floor(unit * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return Object.freeze(result)
}

export function resolveCinema2AtlHoeAutoPattern(input: Readonly<{
  stage: 'rest' | 'active' | 'buildup' | 'drop' | 'recovery'
  energy: number
  vocalPresence: number
  current: Cinema2AtlHoePatternId
  boundaryOrdinal: number
}>): Cinema2AtlHoePatternId {
  const candidates: readonly Cinema2AtlHoePatternId[] = input.stage === 'drop'
    ? ['storm-takeover']
    : input.stage === 'buildup'
      ? ['skyline-rise', 'interstate-flow']
      : input.stage === 'rest' || input.vocalPresence > 0.58 || input.energy < 0.22
        ? ['city-pulse', 'neon-brownout']
        : input.energy > 0.68
          ? ['waffle-marquee', 'interstate-flow', 'skyline-rise', 'city-pulse']
          : ['city-pulse', 'waffle-marquee', 'interstate-flow']
  let candidate = candidates[Math.abs(input.boundaryOrdinal) % candidates.length]
  if (candidate === input.current && candidates.length > 1) candidate = candidates[(Math.abs(input.boundaryOrdinal) + 1) % candidates.length]
  return candidate
}

/** Deterministic manual/trigger/auto authority with stable-event de-duplication. */
export class Cinema2AtlHoePatternController {
  private active: Cinema2AtlHoePatternId
  private outgoing: Cinema2AtlHoePatternId | null = null
  private elapsedSec = CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS
  private lastTriggerEventId: string | null = null
  private lastAutoBoundaryId: string | null = null
  private cycleIndex = 0

  constructor(
    initial = CINEMA2_ATL_HOE_DEFAULT_PATTERN,
    private readonly cycle: readonly Cinema2AtlHoePatternId[] = CINEMA2_ATL_HOE_PATTERN_IDS,
  ) { this.active = initial }

  update(input: Readonly<Cinema2AtlHoePatternControllerInput>): Readonly<Cinema2AtlHoePatternSelection> {
    let requested = this.active
    if (input.patternChange) {
      if (input.triggerEventId && input.triggerEventId !== this.lastTriggerEventId) {
        this.lastTriggerEventId = input.triggerEventId
        requested = this.nextPattern()
      }
    } else if (input.autoPerformance) {
      if (input.autoBoundaryId && input.autoBoundaryId !== this.lastAutoBoundaryId) {
        this.lastAutoBoundaryId = input.autoBoundaryId
        requested = input.autoPattern
      }
    } else {
      requested = input.authoredPattern
    }

    const changed = requested !== this.active
    if (changed) {
      this.outgoing = this.active
      this.active = requested
      this.elapsedSec = 0
    } else if (this.outgoing) {
      this.elapsedSec = Math.min(CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS, this.elapsedSec + Math.max(0, input.deltaTimeSec))
      if (this.elapsedSec >= CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS) this.outgoing = null
    }
    const transition = this.outgoing
      ? Object.freeze({ outgoingPattern: this.outgoing, progress: this.elapsedSec / CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS })
      : null
    return Object.freeze({ pattern: this.active, changed, transition })
  }

  get activePattern(): Cinema2AtlHoePatternId { return this.active }

  reset(pattern = CINEMA2_ATL_HOE_DEFAULT_PATTERN): void {
    this.active = pattern
    this.outgoing = null
    this.elapsedSec = CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS
    this.lastTriggerEventId = null
    this.lastAutoBoundaryId = null
    this.cycleIndex = 0
  }

  private nextPattern(): Cinema2AtlHoePatternId {
    for (let count = 0; count < this.cycle.length; count += 1) {
      const candidate = this.cycle[this.cycleIndex++ % this.cycle.length] ?? CINEMA2_ATL_HOE_DEFAULT_PATTERN
      if (candidate !== this.active) return candidate
    }
    return this.active
  }
}
