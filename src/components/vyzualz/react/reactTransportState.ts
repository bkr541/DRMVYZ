/**
 * Transport-state helpers shared by the React visual canvases.
 *
 * The audio engine exposes `isPlaying`, current time, and duration rather than
 * a dedicated paused flag. A non-zero playhead that is not at the natural end
 * of the track therefore represents a user pause. Stopped/idle state remains
 * distinct so engines can keep their existing idle-preview or blackout policy.
 */

export interface ReactTransportSnapshot {
  isPlaying: boolean
  currentTimeSec: number
  durationSec: number
}

const START_EPSILON_SEC = 0.01
const END_EPSILON_SEC = 0.05

export function isReactTransportPaused({
  isPlaying,
  currentTimeSec,
  durationSec,
}: ReactTransportSnapshot): boolean {
  if (isPlaying) return false

  const currentTime = Number.isFinite(currentTimeSec) ? Math.max(0, currentTimeSec) : 0
  if (currentTime <= START_EPSILON_SEC) return false

  const duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0
  if (duration > 0 && currentTime >= Math.max(0, duration - END_EPSILON_SEC)) {
    return false
  }

  return true
}
