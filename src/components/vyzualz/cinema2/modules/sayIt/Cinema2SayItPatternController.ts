import { Cinema2PatternEventLatch } from '../../conductor/Cinema2PatternEventLatch'
import type { Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'

export const CINEMA2_SAY_IT_PATTERN_IDS = Object.freeze([
  'solid', 'pulse', 'letter-chase', 'alternate', 'center-wave', 'strobe',
] as const)
export type Cinema2SayItPatternId = typeof CINEMA2_SAY_IT_PATTERN_IDS[number]
export type Cinema2SayItTriggerId = Cinema2AfterhoursTriggerId
export const CINEMA2_SAY_IT_DEFAULT_PATTERN: Cinema2SayItPatternId = 'solid'

export interface Cinema2SayItPatternSelection {
  readonly activePattern: Cinema2SayItPatternId
  readonly patternStartBeat: number
  readonly changed: boolean
}

export function isCinema2SayItPattern(value: unknown): value is Cinema2SayItPatternId {
  return typeof value === 'string' && CINEMA2_SAY_IT_PATTERN_IDS.includes(value as Cinema2SayItPatternId)
}

export function createCinema2SayItPatternCycle(sample: (index: number) => number): readonly Cinema2SayItPatternId[] {
  const cycle = [...CINEMA2_SAY_IT_PATTERN_IDS]
  for (let index = cycle.length - 1, sampleIndex = 0; index > 0; index -= 1, sampleIndex += 1) {
    const unit = Math.min(0.999999, Math.max(0, sample(sampleIndex)))
    const swap = Math.floor(unit * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

function nextPattern(cycle: readonly Cinema2SayItPatternId[], current: Cinema2SayItPatternId): Cinema2SayItPatternId {
  if (cycle.length < 2) return current
  const index = cycle.indexOf(current)
  return cycle[(index < 0 ? 0 : index + 1) % cycle.length] ?? CINEMA2_SAY_IT_DEFAULT_PATTERN
}

/** Matches Mainframe's manual/automatic pattern authority and event de-duplication semantics. */
export class Cinema2SayItPatternController {
  private activePattern: Cinema2SayItPatternId
  private authoredPattern: Cinema2SayItPatternId | null = null
  private patternChange: boolean | null = null
  private trigger: Cinema2SayItTriggerId | null = null
  private patternStartBeat = 0
  private readonly events = new Cinema2PatternEventLatch<Cinema2SayItTriggerId>()

  constructor(
    private readonly cycle: readonly Cinema2SayItPatternId[],
    initialPattern: Cinema2SayItPatternId = CINEMA2_SAY_IT_DEFAULT_PATTERN,
  ) {
    this.activePattern = initialPattern
  }

  update(input: Readonly<{
    authoredPattern: Cinema2SayItPatternId
    patternChange: boolean
    trigger: Cinema2SayItTriggerId
    triggerEventId: string | null
    absoluteBeat: number
    reset?: boolean
    reselect?: boolean
  }>): Readonly<Cinema2SayItPatternSelection> {
    const absoluteBeat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const authoredChanged = this.authoredPattern != null && input.authoredPattern !== this.authoredPattern
    const toggled = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    if (input.reset) this.events.reset()
    const fresh = this.events.observe(input.trigger, input.triggerEventId)
    let changed = false

    if (input.reset || input.reselect || authoredChanged || toggled || this.authoredPattern == null) {
      changed = this.activePattern !== input.authoredPattern || authoredChanged || toggled
      this.activePattern = input.authoredPattern
      this.patternStartBeat = absoluteBeat
    } else if (triggerChanged) {
      // Observe the boundary without advancing the currently visible pattern.
    } else if (!input.patternChange) {
      if (this.activePattern !== input.authoredPattern) {
        this.activePattern = input.authoredPattern
        this.patternStartBeat = absoluteBeat
        changed = true
      }
    } else if (fresh) {
      this.activePattern = nextPattern(this.cycle, this.activePattern)
      this.patternStartBeat = absoluteBeat
      changed = true
    }

    this.authoredPattern = input.authoredPattern
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    return Object.freeze({ activePattern: this.activePattern, patternStartBeat: this.patternStartBeat, changed })
  }
}
