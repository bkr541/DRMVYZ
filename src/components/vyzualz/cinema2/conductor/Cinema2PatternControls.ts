import { resolveCinema2PatternControls, type Cinema2MoodFrame } from './Cinema2MoodConductor'

export interface Cinema2PatternControlsInput<TTrigger extends string> {
  /** The user's saved Pattern Change and Trigger (never written to). */
  readonly saved: Readonly<{ patternChange: boolean; trigger: TTrigger }>
  /** The frame's mood; null/undefined when there is no analysed track or live features. */
  readonly mood: Readonly<Cinema2MoodFrame> | null | undefined
  /** The preset's Auto Performance toggle, already combined with anything else that must hold (for example "is playing"). */
  readonly autoPerformance: boolean
}

export interface Cinema2PatternControlsState<TTrigger extends string> {
  readonly patternChange: boolean
  readonly trigger: TTrigger
  /** True while the music, not the saved values, is choosing. */
  readonly automatic: boolean
}

/**
 * What a preset module uses to honour "Auto Performance chooses Pattern Change and the Trigger". A module owns one, calls `update` once per
 * frame before its usual trigger-event logic, and acts on the returned values instead of the saved ones:
 *
 *   const controls = new Cinema2PatternControlResolver<MyTriggerId>()
 *   const { patternChange, trigger } = controls.update({ saved: { patternChange: frame.patternChange, trigger: frame.trigger }, mood: frame.mood, autoPerformance: frame.auto })
 *   // ...resolve the trigger event from `trigger`, advance the pattern only if `patternChange`...
 *   inspect: { ...controls.inspect() }
 *
 * `TTrigger` is the module's own trigger id type. The music only ever chooses values of the canonical Trigger list (CINEMA2_MOOD_TRIGGER_LADDER),
 * which the preset compiler requires the tagged Trigger control to offer, so the module's type holds them. With no beat grid, no mood, or the
 * toggle off, the result is exactly the saved values and `automatic` is false.
 */
export class Cinema2PatternControlResolver<TTrigger extends string = string> {
  private state: Cinema2PatternControlsState<TTrigger> | null = null

  update(input: Readonly<Cinema2PatternControlsInput<TTrigger>>): Readonly<Cinema2PatternControlsState<TTrigger>> {
    const resolved = resolveCinema2PatternControls(input.saved, input.mood, input.autoPerformance)
    this.state = Object.freeze({ patternChange: resolved.patternChange, trigger: resolved.trigger as TTrigger, automatic: resolved.automatic })
    return this.state
  }

  /** The last resolved values, or null before the first update. */
  get current(): Readonly<Cinema2PatternControlsState<TTrigger>> | null {
    return this.state
  }

  /** The fields modules add to their `inspect()` output. */
  inspect(): Readonly<{ effectivePatternChange: boolean | null; effectiveTrigger: TTrigger | null; patternControlsAutomatic: boolean }> {
    return Object.freeze({
      effectivePatternChange: this.state?.patternChange ?? null,
      effectiveTrigger: this.state?.trigger ?? null,
      patternControlsAutomatic: this.state?.automatic ?? false,
    })
  }

  reset(): void {
    this.state = null
  }
}
