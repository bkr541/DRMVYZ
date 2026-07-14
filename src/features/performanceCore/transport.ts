export interface SharedPerformanceTransportSnapshot {
  audioTimeSec: number
  trackIdentity: string | null
  seekIdentity: string
  loopIdentity: string
  trackChangeIdentity: string
  runtimeIdentity: string
}

export interface SharedPerformanceTransportTransition {
  seekDetected: boolean
  loopWrapDetected: boolean
  trackReplacementDetected: boolean
  timingDiscontinuity: boolean
}

const EPSILON_SEC = 1e-5

/** Pure transport lifecycle detection, reusable by every engine adapter. */
export function resolveSharedPerformanceTransportTransition(
  previous: SharedPerformanceTransportSnapshot | null | undefined,
  current: SharedPerformanceTransportSnapshot,
): SharedPerformanceTransportTransition {
  if (!previous) {
    return {
      seekDetected: false,
      loopWrapDetected: false,
      trackReplacementDetected: false,
      timingDiscontinuity: false,
    }
  }
  const seekDetected = previous.seekIdentity !== current.seekIdentity
  const trackReplacementDetected = (
    previous.trackIdentity !== current.trackIdentity
    || previous.trackChangeIdentity !== current.trackChangeIdentity
  )
  const movedBackward = current.audioTimeSec + EPSILON_SEC < previous.audioTimeSec
  const loopWrapDetected = (
    previous.loopIdentity !== current.loopIdentity
    || (!seekDetected && !trackReplacementDetected && movedBackward)
  )
  return {
    seekDetected,
    loopWrapDetected,
    trackReplacementDetected,
    timingDiscontinuity: previous.runtimeIdentity !== current.runtimeIdentity || movedBackward,
  }
}
