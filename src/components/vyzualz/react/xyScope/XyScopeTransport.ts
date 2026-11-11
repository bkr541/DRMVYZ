// Sound Drawing XY: transport lifecycle. The shared performance context only knows a seek or a loop when the
// engine tells it (through seek, loop and timing identities), so each surface that builds a context watches the
// audio clock itself. This is the same rule PixGrid applies, kept pure so it can be tested without a browser.

export interface XyScopeTransportInput {
  /** Audio-clock time in seconds. */
  audioTime: number
  /** True while the music is actually playing (not paused or stopped). */
  clockActive: boolean
  /** Monotonic wall-clock time in milliseconds. */
  wallMs: number
  durationSec: number
  trackIdentity: string | null
}

export interface XyScopeTransportState {
  seekIdentity: string
  loopIdentity: string
  timingIdentity: string
  /** A seek or loop happened on this update. */
  discontinuity: boolean
  /** The track changed on this update. */
  trackChanged: boolean
}

export class XyScopeTransportTracker {
  private lastAudioTime = 0
  private lastWallMs = 0
  private hasPrevious = false
  private trackIdentity: string | null | undefined = undefined
  private seek = 0
  private loop = 0
  private timing = 0

  update(input: XyScopeTransportInput): XyScopeTransportState {
    const audioTime = Number.isFinite(input.audioTime) ? Math.max(0, input.audioTime) : this.lastAudioTime
    let trackChanged = false
    if (this.trackIdentity !== undefined && this.trackIdentity !== input.trackIdentity) {
      trackChanged = true
      this.seek = 0
      this.loop = 0
      this.timing = 0
      this.hasPrevious = false
    }
    this.trackIdentity = input.trackIdentity

    const wallDeltaSec = Math.max(0, (input.wallMs - this.lastWallMs) / 1000)
    const audioDeltaSec = audioTime - this.lastAudioTime
    const expectedAdvanceSec = input.clockActive ? wallDeltaSec : 0
    const movedBackward = this.hasPrevious && audioDeltaSec < -0.05
    const forwardSeek = this.hasPrevious && (
      input.clockActive
        ? audioDeltaSec - expectedAdvanceSec > Math.max(0.35, wallDeltaSec * 2 + 0.1)
        : audioDeltaSec > 0.02
    )
    const pausedSeek = this.hasPrevious && !input.clockActive && Math.abs(audioDeltaSec) > 0.02
    const duration = Math.max(0, input.durationSec)
    const loopWrap = movedBackward && duration > 0 && this.lastAudioTime >= duration * 0.7 && audioTime <= duration * 0.3
    const discontinuity = movedBackward || forwardSeek || pausedSeek
    if (discontinuity) {
      this.timing += 1
      if (loopWrap) this.loop += 1
      else this.seek += 1
    }

    this.lastAudioTime = audioTime
    this.lastWallMs = input.wallMs
    this.hasPrevious = true
    return {
      seekIdentity: `xy-scope-seek:${this.seek}`,
      loopIdentity: `xy-scope-loop:${this.loop}`,
      timingIdentity: `xy-scope-timing:${this.timing}`,
      discontinuity,
      trackChanged,
    }
  }

  reset(): void {
    this.hasPrevious = false
    this.trackIdentity = undefined
    this.seek = 0
    this.loop = 0
    this.timing = 0
  }
}
