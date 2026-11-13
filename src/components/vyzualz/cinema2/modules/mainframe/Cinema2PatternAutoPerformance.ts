/**
 * Auto Performance for presets that run on the shared pattern controller (the Mainframe family and the 3D model previews). It follows BWC's
 * established rules (see Cinema2BwcAutoPerformance) with the two programs supplied by the preset, and owns exactly one thing: which pattern is
 * on stage during a build or a drop. Colours, intensity, speed and the authored Pattern, Pattern Change and Trigger values stay the user's.
 *
 * Precedence: the user's Pattern is the base; the Trigger may advance the base while Pattern Change is on; Auto Performance may then substitute
 * a pattern for a bounded musical moment; the base resumes afterward. The base controller keeps running underneath, so what resumes already
 * includes any advance that happened meanwhile. Nothing here is written to saved settings.
 *
 * - A confidently detected build puts the build pattern on stage while it charges and releases when it ends or after `buildMaxBeats`.
 * - A new drop puts the drop pattern on stage for `dropBeats`, restarted from the drop so the first hit lands on it. A drop ends a build's turn.
 * - Editing the Pattern cancels an override at once and the edit shows. The build in progress is spent: another override can begin only on a
 *   separately qualifying event (a new drop, or a new build after this one has ended).
 * - Turning Auto Performance on in the middle of a build does not yank the pattern; the next build or drop is the first it may use. Drops are
 *   consumed whether or not they are used, so enabling later never replays an old one.
 * - A discontinuity (track change, seek back, stop) clears everything, including the consumed drop identity.
 */
export interface Cinema2PatternAutoPerformanceConfig<Pattern extends string> {
  readonly buildPattern: Pattern
  readonly dropPattern: Pattern
  /** A build qualifies above this charge (zero without a confident build) and ends below `buildOff`. */
  readonly buildOn?: number
  readonly buildOff?: number
  readonly buildMaxBeats?: number
  readonly dropBeats?: number
}

export const CINEMA2_PATTERN_AUTO_BUILD_ON = 0.12
export const CINEMA2_PATTERN_AUTO_BUILD_OFF = 0.04
export const CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS = 32
export const CINEMA2_PATTERN_AUTO_DROP_BEATS = 8

export interface Cinema2PatternAutoPerformanceInput {
  readonly enabled: boolean
  readonly absoluteBeat: number
  /** The shared engine's build charge, 0..1. */
  readonly buildCharge: number
  /** The coalesced identity of a drop that arrived on this frame, if one did. */
  readonly dropEventId: string | null
  /** The user chose a different Pattern on this frame. */
  readonly patternEdited: boolean
  /** A discontinuity: track change, seek back, stop. */
  readonly reset: boolean
}

export interface Cinema2PatternPerformance<Pattern extends string> {
  /** The pattern Auto Performance has on stage, or null while the base pattern is. */
  readonly pattern: Pattern | null
  readonly reason: 'build' | 'drop' | null
  /** Where the override's own clock starts, in beats. */
  readonly startBeat: number
}

/** `idle` may begin an override; `active` is one; `spent` is a build that has already had its turn (or was edited away). */
type BuildEpisode = 'idle' | 'active' | 'spent'

export class Cinema2PatternAutoPerformance<Pattern extends string> {
  private episode: BuildEpisode = 'idle'
  private current: Readonly<Cinema2PatternPerformance<Pattern>>
  private endBeat = 0
  private lastDropEventId: string | null = null
  private readonly none: Readonly<Cinema2PatternPerformance<Pattern>> = Object.freeze({ pattern: null, reason: null, startBeat: 0 })
  private readonly buildOn: number
  private readonly buildOff: number
  private readonly buildMaxBeats: number
  private readonly dropBeats: number

  constructor(private readonly config: Readonly<Cinema2PatternAutoPerformanceConfig<Pattern>>) {
    this.current = this.none
    this.buildOn = config.buildOn ?? CINEMA2_PATTERN_AUTO_BUILD_ON
    this.buildOff = config.buildOff ?? CINEMA2_PATTERN_AUTO_BUILD_OFF
    this.buildMaxBeats = config.buildMaxBeats ?? CINEMA2_PATTERN_AUTO_BUILD_MAX_BEATS
    this.dropBeats = config.dropBeats ?? CINEMA2_PATTERN_AUTO_DROP_BEATS
  }

  update(input: Readonly<Cinema2PatternAutoPerformanceInput>): Readonly<Cinema2PatternPerformance<Pattern>> {
    const beat = Number.isFinite(input.absoluteBeat) ? Math.max(0, input.absoluteBeat) : 0
    const charge = Number.isFinite(input.buildCharge) ? Math.min(1, Math.max(0, input.buildCharge)) : 0
    if (input.reset) {
      this.clear()
      this.lastDropEventId = null
    }
    const newDrop = input.dropEventId != null && input.dropEventId !== this.lastDropEventId
    if (newDrop) this.lastDropEventId = input.dropEventId

    if (input.patternEdited || !input.enabled) {
      this.current = this.none
      this.episode = charge >= this.buildOff ? 'spent' : 'idle'
      return this.current
    }
    // The beat clock only runs backward across a discontinuity; an override from before it is stale.
    if (this.current.pattern && beat < this.current.startBeat - 1e-6) this.current = this.none

    if (this.current.pattern && beat >= this.endBeat) {
      // Out of time. A build that ran its course without ending is spent; it re-qualifies only after the charge falls away.
      if (this.current.reason === 'build') this.episode = 'spent'
      this.current = this.none
    }
    if (newDrop) {
      this.current = Object.freeze({ pattern: this.config.dropPattern, reason: 'drop' as const, startBeat: beat })
      this.endBeat = beat + this.dropBeats
      // The build the drop released has had its turn.
      this.episode = 'spent'
    }

    if (this.current.reason !== 'drop') {
      if (charge < this.buildOff) {
        if (this.current.reason === 'build') this.current = this.none
        this.episode = 'idle'
      } else if (this.episode === 'idle' && charge >= this.buildOn) {
        this.episode = 'active'
        this.current = Object.freeze({ pattern: this.config.buildPattern, reason: 'build' as const, startBeat: beat })
        this.endBeat = beat + this.buildMaxBeats
      }
    } else if (charge < this.buildOff) {
      // While a drop is on stage the build that preceded it can settle without ending the drop.
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
    this.current = this.none
    this.endBeat = 0
  }
}
