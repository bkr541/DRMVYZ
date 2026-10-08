import {
  CINEMA2_AFTERHOURS_TRIGGER_IDS,
  resolveCinema2AfterhoursTriggerEventIdentity,
  type Cinema2AfterhoursTriggerId,
} from '../Cinema2AfterhoursNativeModule'
import type { Cinema2ModuleFrameReadContext } from '../Cinema2ModuleContracts'
import {
  CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  CINEMA2_MAINFRAME_PATTERN_IDS,
  type Cinema2MainframePatternId,
} from './Cinema2MainframePatternEngine'

/** Mainframe intentionally reuses the canonical Afterhours trigger contract verbatim. */
export const CINEMA2_MAINFRAME_TRIGGER_IDS = CINEMA2_AFTERHOURS_TRIGGER_IDS
export type Cinema2MainframeTriggerId = Cinema2AfterhoursTriggerId

export interface Cinema2MainframePatternSelection {
  readonly activePattern: Cinema2MainframePatternId
  readonly patternStartBeat: number
  readonly changed: boolean
}

export interface Cinema2MainframePatternControllerInput {
  readonly authoredPattern: Cinema2MainframePatternId
  readonly patternChange: boolean
  readonly trigger: Cinema2MainframeTriggerId
  readonly triggerEventId: string | null
  readonly absoluteBeat: number
  readonly reset?: boolean
}

/** Fisher-Yates with engine-owned indexed samples: stable per activation and independent of frame consumption. */
export function createCinema2MainframePatternCycle(sample: (index: number) => number): readonly Cinema2MainframePatternId[] {
  const cycle = [...CINEMA2_MAINFRAME_PATTERN_IDS]
  let sampleIndex = 0
  for (let index = cycle.length - 1; index > 0; index -= 1) {
    const unit = Math.min(0.999999, Math.max(0, sample(sampleIndex)))
    sampleIndex += 1
    const swap = Math.floor(unit * (index + 1))
    ;[cycle[index], cycle[swap]] = [cycle[swap]!, cycle[index]!]
  }
  return Object.freeze(cycle)
}

export function nextCinema2MainframePattern(
  cycle: readonly Cinema2MainframePatternId[],
  current: Cinema2MainframePatternId,
): Cinema2MainframePatternId {
  if (cycle.length < 2) return current
  const index = cycle.indexOf(current)
  const next = cycle[(index < 0 ? 0 : index + 1) % cycle.length]
  return next === current ? cycle[(index + 2) % cycle.length] ?? CINEMA2_MAINFRAME_DEFAULT_PATTERN : next ?? CINEMA2_MAINFRAME_DEFAULT_PATTERN
}

/** Runtime-only pattern authority. Persistent authored parameters remain in Cinema2ParameterState. */
export class Cinema2MainframePatternController {
  private activePattern: Cinema2MainframePatternId
  private authoredPattern: Cinema2MainframePatternId | null = null
  private patternChange: boolean | null = null
  private trigger: Cinema2MainframeTriggerId | null = null
  private patternStartBeat = 0
  private lastTriggerEventId: string | null = null

  constructor(
    private readonly cycle: readonly Cinema2MainframePatternId[],
    initialPattern: Cinema2MainframePatternId = CINEMA2_MAINFRAME_DEFAULT_PATTERN,
  ) {
    this.activePattern = initialPattern
  }

  update(input: Readonly<Cinema2MainframePatternControllerInput>): Readonly<Cinema2MainframePatternSelection> {
    const absoluteBeat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const authoredChanged = this.authoredPattern != null && input.authoredPattern !== this.authoredPattern
    const toggled = this.patternChange != null && input.patternChange !== this.patternChange
    const triggerChanged = this.trigger != null && input.trigger !== this.trigger
    let changed = false

    if (input.reset || authoredChanged || toggled || this.authoredPattern == null) {
      changed = this.activePattern !== input.authoredPattern || authoredChanged || toggled
      this.activePattern = input.authoredPattern
      this.patternStartBeat = this.authoredPattern == null && !input.reset ? 0 : absoluteBeat
      // Do not consume an event already present on the edit/toggle/trigger/reset frame.
      this.lastTriggerEventId = input.triggerEventId
    } else if (triggerChanged) {
      // Changing trigger authority must not change the currently visible pattern.
      this.lastTriggerEventId = input.triggerEventId
    } else if (!input.patternChange) {
      if (this.activePattern !== input.authoredPattern) {
        this.activePattern = input.authoredPattern
        this.patternStartBeat = absoluteBeat
        changed = true
      }
      this.lastTriggerEventId = input.triggerEventId
    } else if (input.triggerEventId && input.triggerEventId !== this.lastTriggerEventId) {
      this.activePattern = nextCinema2MainframePattern(this.cycle, this.activePattern)
      this.patternStartBeat = absoluteBeat
      this.lastTriggerEventId = input.triggerEventId
      changed = true
    }

    this.authoredPattern = input.authoredPattern
    this.patternChange = input.patternChange
    this.trigger = input.trigger
    return Object.freeze({ activePattern: this.activePattern, patternStartBeat: this.patternStartBeat, changed })
  }

  reset(): void {
    this.authoredPattern = null
    this.patternChange = null
    this.trigger = null
    this.patternStartBeat = 0
    this.lastTriggerEventId = null
  }
}

export function resolveCinema2MainframeTriggerEventIdentity(
  frame: Readonly<Cinema2ModuleFrameReadContext>,
  trigger: Cinema2MainframeTriggerId,
  previousTimeSec: number | null,
): string | null {
  return resolveCinema2AfterhoursTriggerEventIdentity(frame, trigger, previousTimeSec)
}
