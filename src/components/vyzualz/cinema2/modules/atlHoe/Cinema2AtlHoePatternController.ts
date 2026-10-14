import {
  CINEMA2_ATL_HOE_DEFAULT_PATTERN,
  type Cinema2AtlHoePatternId,
  type Cinema2AtlHoePatternTransitionInput,
} from './Cinema2AtlHoePatternEngine'

export const CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS = 0.45

export interface Cinema2AtlHoePatternSelection {
  readonly pattern: Cinema2AtlHoePatternId
  readonly changed: boolean
  readonly transition: Readonly<Cinema2AtlHoePatternTransitionInput> | null
}

/** Runtime-only manual selection authority. Automatic Pattern Change belongs to issue 5. */
export class Cinema2AtlHoePatternController {
  private active: Cinema2AtlHoePatternId
  private outgoing: Cinema2AtlHoePatternId | null = null
  private elapsedSec = CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS

  constructor(initial = CINEMA2_ATL_HOE_DEFAULT_PATTERN) { this.active = initial }

  update(authored: Cinema2AtlHoePatternId, deltaTimeSec: number): Readonly<Cinema2AtlHoePatternSelection> {
    const changed = authored !== this.active
    if (changed) {
      this.outgoing = this.active
      this.active = authored
      this.elapsedSec = 0
    } else if (this.outgoing) {
      this.elapsedSec = Math.min(CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS, this.elapsedSec + Math.max(0, deltaTimeSec))
      if (this.elapsedSec >= CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS) this.outgoing = null
    }
    const transition = this.outgoing
      ? Object.freeze({ outgoingPattern: this.outgoing, progress: this.elapsedSec / CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS })
      : null
    return Object.freeze({ pattern: this.active, changed, transition })
  }

  reset(pattern = CINEMA2_ATL_HOE_DEFAULT_PATTERN): void {
    this.active = pattern
    this.outgoing = null
    this.elapsedSec = CINEMA2_ATL_HOE_PATTERN_CROSSFADE_SECONDS
  }
}
