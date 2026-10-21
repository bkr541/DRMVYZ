import type { Cinema2BwcPatternId } from './Cinema2BwcPatternEngine'

/**
 * BWC's Auto Performance. It owns exactly one thing: which lighting program is on stage during a build or a drop. Everything else (colours,
 * intensity, the line's speed, effects, and the authored Pattern, Pattern Change and Trigger values themselves) stays the user's.
 *
 * Precedence, from the preset contract: the user's Pattern is the base; the Trigger may advance the base while Pattern Change is on;
 * Auto Performance may then substitute a program for a bounded musical moment; the base resumes afterward. The base controller keeps
 * running underneath (it is not paused or reset by an override), so what resumes already includes any advance that happened meanwhile.
 *
 * - A confidently detected buildup puts Surge on stage while it charges, and releases when it ends or after `BUILD_MAX_BEATS`.
 * - A new drop puts Core Burst on stage for `DROP_BEATS`, restarted from the drop so the first hit lands on it. A drop ends a buildup's turn.
 * - Editing the Pattern cancels an override at once and the edit shows. The buildup that was in progress is spent: another override can
 *   begin only on a separately qualifying event (a new drop, or a new buildup after this one has ended).
 * - Turning Auto Performance on in the middle of a buildup does not yank the program; the next buildup or drop is the first it may use.
 */
export const BWC_AUTO_BUILD_PATTERN: Cinema2BwcPatternId = 'surge'
export const BWC_AUTO_DROP_PATTERN: Cinema2BwcPatternId = 'core-burst'
/** A buildup qualifies above this charge (the pattern engine's charge is already zero without a confident buildup) and ends below the lower one. */
export const BWC_AUTO_BUILD_ON = 0.12
export const BWC_AUTO_BUILD_OFF = 0.04
export const BWC_AUTO_BUILD_MAX_BEATS = 32
export const BWC_AUTO_DROP_BEATS = 8

export interface Cinema2BwcAutoPerformanceInput {
  readonly enabled: boolean
  readonly absoluteBeat: number
  /** The shared engine's buildup charge, 0..1. */
  readonly buildCharge: number
  /** The coalesced identity of a drop that arrived on this frame, if one did. */
  readonly dropEventId: string | null
  /** The user chose a different Pattern on this frame. */
  readonly patternEdited: boolean
  /** A discontinuity: track change, seek back, stop. */
  readonly reset: boolean
}

export interface Cinema2BwcPerformance {
  /** The program Auto Performance has on stage, or null while the base pattern is. */
  readonly pattern: Cinema2BwcPatternId | null
  readonly reason: 'build' | 'drop' | null
  /** Where the override's own clock starts, in beats. */
  readonly startBeat: number
}

const NONE: Readonly<Cinema2BwcPerformance> = Object.freeze({ pattern: null, reason: null, startBeat: 0 })

/** `idle` may begin an override; `active` is one; `spent` is a buildup that has already had its turn (or was edited away). */
type BuildEpisode = 'idle' | 'active' | 'spent'

export class Cinema2BwcAutoPerformance {
  private episode: BuildEpisode = 'idle'
  private current: Readonly<Cinema2BwcPerformance> = NONE
  private endBeat = 0
  private lastDropEventId: string | null = null

  update(input: Readonly<Cinema2BwcAutoPerformanceInput>): Readonly<Cinema2BwcPerformance> {
    const beat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const charge = Number.isFinite(input.buildCharge) ? Math.min(1, Math.max(0, input.buildCharge)) : 0
    if (input.reset) {
      this.clear()
      this.lastDropEventId = null
    }
    // A drop is consumed whether or not it is used, so enabling Auto Performance later never replays an old one.
    const newDrop = input.dropEventId != null && input.dropEventId !== this.lastDropEventId
    if (newDrop) this.lastDropEventId = input.dropEventId

    if (input.patternEdited) {
      this.current = NONE
      this.episode = charge >= BWC_AUTO_BUILD_OFF ? 'spent' : 'idle'
      return this.current
    }
    if (!input.enabled) {
      this.current = NONE
      this.episode = charge >= BWC_AUTO_BUILD_OFF ? 'spent' : 'idle'
      return this.current
    }
    // The beat clock only runs backward across a discontinuity; an override from before it is stale.
    if (this.current.pattern && beat < this.current.startBeat - 1e-6) this.current = NONE

    if (this.current.pattern && beat >= this.endBeat) {
      // Out of time. A buildup that ran its course without ending is spent; it re-qualifies only after the charge falls away.
      if (this.current.reason === 'build') this.episode = 'spent'
      this.current = NONE
    }
    if (newDrop) {
      this.current = Object.freeze({ pattern: BWC_AUTO_DROP_PATTERN, reason: 'drop' as const, startBeat: beat })
      this.endBeat = beat + BWC_AUTO_DROP_BEATS
      // The buildup the drop released has had its turn.
      this.episode = 'spent'
    }

    if (this.current.reason !== 'drop') {
      if (charge < BWC_AUTO_BUILD_OFF) {
        if (this.current.reason === 'build') this.current = NONE
        this.episode = 'idle'
      } else if (this.episode === 'idle' && charge >= BWC_AUTO_BUILD_ON) {
        this.episode = 'active'
        this.current = Object.freeze({ pattern: BWC_AUTO_BUILD_PATTERN, reason: 'build' as const, startBeat: beat })
        this.endBeat = beat + BWC_AUTO_BUILD_MAX_BEATS
      }
    } else if (charge < BWC_AUTO_BUILD_OFF) {
      // While a drop is on stage the buildup that preceded it can settle without ending the drop.
      this.episode = 'idle'
    }
    return this.current
  }

  reset(): void {
    this.clear()
    this.lastDropEventId = null
  }

  private clear(): void {
    this.episode = 'idle'
    this.current = NONE
    this.endBeat = 0
  }
}
