export interface TimelineViewport {
  startSec: number
  endSec:   number
}

export const MIN_VIEWPORT_SEC = 1.0

/**
 * Computes the visible time window for a given playback position and zoom factor.
 * Mirrors getWindow() in RgbWaveformCanvas so both surfaces show the same range.
 */
export function computeWaveformViewport(
  durationSec:    number,
  currentTimeSec: number,
  zoom:           number,
): TimelineViewport {
  const safeDur  = durationSec > 0 ? durationSec : 1
  const safeZoom = isFinite(zoom) && zoom > 0 ? zoom : 1
  if (safeZoom <= 1) return { startSec: 0, endSec: safeDur }
  const win = safeDur / safeZoom
  let start = currentTimeSec - win / 2
  let end   = start + win
  if (start < 0)       { start = 0;       end = win        }
  if (end   > safeDur) { end = safeDur;   start = safeDur - win }
  return { startSec: start, endSec: end }
}

/** Clamps a viewport within [0, durationSec] and enforces a minimum window size. */
export function normalizeViewport(
  vp:          TimelineViewport,
  durationSec: number,
): TimelineViewport {
  const safeDur = Math.max(MIN_VIEWPORT_SEC, durationSec)
  let start = Math.max(0, vp.startSec)
  let end   = Math.min(safeDur, vp.endSec)
  if (end - start < MIN_VIEWPORT_SEC) {
    const center = (start + end) / 2
    start = Math.max(0,       center - MIN_VIEWPORT_SEC / 2)
    end   = Math.min(safeDur, center + MIN_VIEWPORT_SEC / 2)
  }
  return { startSec: start, endSec: end }
}

/**
 * Maps a time value into a [0, 1] fraction within the viewport.
 * Values outside the viewport produce ratios outside [0, 1].
 */
export function timeToViewportRatio(time: number, vp: TimelineViewport): number {
  const dur = vp.endSec - vp.startSec
  if (dur <= 0) return 0
  return (time - vp.startSec) / dur
}

/** Converts a [0, 1] viewport fraction back to an absolute time. */
export function viewportRatioToTime(ratio: number, vp: TimelineViewport): number {
  return vp.startSec + ratio * (vp.endSec - vp.startSec)
}

/**
 * Zooms the viewport by `factor` (>1 = zoom in, <1 = zoom out) around `anchorTime`.
 * The anchor point stays at the same proportional position after the zoom.
 */
export function zoomViewportAroundTime(
  vp:          TimelineViewport,
  anchorTime:  number,
  factor:      number,
  durationSec: number,
  minDurSec:   number = MIN_VIEWPORT_SEC,
): TimelineViewport {
  const curDur = vp.endSec - vp.startSec
  if (curDur <= 0 || !isFinite(factor) || factor <= 0) return vp
  const newDur      = Math.max(minDurSec, curDur / factor)
  const anchor      = Math.max(vp.startSec, Math.min(vp.endSec, anchorTime))
  const anchorRatio = (anchor - vp.startSec) / curDur
  let newStart = anchor - anchorRatio * newDur
  let newEnd   = newStart + newDur
  if (newStart < 0)           { newStart = 0;           newEnd = newDur           }
  if (newEnd   > durationSec) { newEnd = durationSec;   newStart = durationSec - newDur }
  return { startSec: Math.max(0, newStart), endSec: Math.min(durationSec, newEnd) }
}

/** Shifts the viewport by `deltaSec`, clamping at track boundaries. */
export function panViewport(
  vp:          TimelineViewport,
  deltaSec:    number,
  durationSec: number,
): TimelineViewport {
  const dur = vp.endSec - vp.startSec
  let start = vp.startSec + deltaSec
  let end   = vp.endSec   + deltaSec
  if (start < 0)            { start = 0;           end = dur           }
  if (end   > durationSec)  { end = durationSec;   start = durationSec - dur }
  return { startSec: Math.max(0, start), endSec: Math.min(durationSec, end) }
}

export interface TimeRange {
  startSec: number
  endSec:   number
}

/**
 * Returns the visible portion of a time range within the viewport,
 * or null if the range is entirely outside.
 */
export function intersectTimeRange(
  range: TimeRange,
  vp:    TimelineViewport,
): { visibleStart: number; visibleEnd: number } | null {
  const visStart = Math.max(range.startSec, vp.startSec)
  const visEnd   = Math.min(range.endSec,   vp.endSec)
  if (visEnd <= visStart) return null
  return { visibleStart: visStart, visibleEnd: visEnd }
}
