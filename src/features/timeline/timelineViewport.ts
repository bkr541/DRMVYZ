export interface TimelineViewport {
  startSec: number
  endSec:   number
}

export const MIN_VIEWPORT_SEC = 1.0
export const DEFAULT_TIMELINE_DURATION_SEC = 180

/** True only for finite durations greater than zero. */
export function isFinitePositiveDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * Resolves a duration without allowing zero, negative, NaN, or infinite values
 * into timeline math. The fallback is validated too so callers always receive a
 * finite positive value.
 */
export function resolvePositiveDuration(
  value: unknown,
  fallback: number = DEFAULT_TIMELINE_DURATION_SEC,
): number {
  if (isFinitePositiveDuration(value)) return value
  if (isFinitePositiveDuration(fallback)) return fallback
  return MIN_VIEWPORT_SEC
}

function resolveFiniteTime(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Computes the visible time window for a given playback position and zoom factor.
 * Mirrors getWindow() in RgbWaveformCanvas so both surfaces show the same range.
 */
export function computeWaveformViewport(
  durationSec:    number,
  currentTimeSec: number,
  zoom:           number,
): TimelineViewport {
  const safeDur     = resolvePositiveDuration(durationSec, MIN_VIEWPORT_SEC)
  const safeCurrent = Math.max(0, Math.min(safeDur, resolveFiniteTime(currentTimeSec)))
  const safeZoom    = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  if (safeZoom <= 1) return { startSec: 0, endSec: safeDur }
  const win = safeDur / safeZoom
  let start = safeCurrent - win / 2
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
  const safeDur = Math.max(MIN_VIEWPORT_SEC, resolvePositiveDuration(durationSec, MIN_VIEWPORT_SEC))
  const rawStart = resolveFiniteTime(vp.startSec, 0)
  const rawEnd   = resolveFiniteTime(vp.endSec, safeDur)
  let start = Math.max(0, Math.min(safeDur, rawStart))
  let end   = Math.max(0, Math.min(safeDur, rawEnd))
  if (end < start) [start, end] = [end, start]
  if (end - start < MIN_VIEWPORT_SEC) {
    const center = (start + end) / 2
    start = Math.max(0,       center - MIN_VIEWPORT_SEC / 2)
    end   = Math.min(safeDur, center + MIN_VIEWPORT_SEC / 2)
    if (end - start < MIN_VIEWPORT_SEC) {
      start = Math.max(0, safeDur - MIN_VIEWPORT_SEC)
      end   = safeDur
    }
  }
  return { startSec: start, endSec: end }
}

/**
 * Maps a time value into a [0, 1] fraction within the viewport.
 * Values outside the viewport produce ratios outside [0, 1].
 */
export function timeToViewportRatio(time: number, vp: TimelineViewport): number {
  const dur = vp.endSec - vp.startSec
  if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(time)) return 0
  return (time - vp.startSec) / dur
}

/** Converts a [0, 1] viewport fraction back to an absolute time. */
export function viewportRatioToTime(ratio: number, vp: TimelineViewport): number {
  const safeRatio = resolveFiniteTime(ratio)
  return vp.startSec + safeRatio * (vp.endSec - vp.startSec)
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
  const safeDur = resolvePositiveDuration(durationSec, MIN_VIEWPORT_SEC)
  const current = normalizeViewport(vp, safeDur)
  const curDur  = current.endSec - current.startSec
  if (curDur <= 0 || !Number.isFinite(factor) || factor <= 0) return current
  const safeMinDur = Math.min(safeDur, resolvePositiveDuration(minDurSec, MIN_VIEWPORT_SEC))
  const newDur      = Math.min(safeDur, Math.max(safeMinDur, curDur / factor))
  const safeAnchor  = resolveFiniteTime(anchorTime, current.startSec)
  const anchor      = Math.max(current.startSec, Math.min(current.endSec, safeAnchor))
  const anchorRatio = (anchor - current.startSec) / curDur
  let newStart = anchor - anchorRatio * newDur
  let newEnd   = newStart + newDur
  if (newStart < 0)       { newStart = 0;       newEnd = newDur           }
  if (newEnd   > safeDur) { newEnd = safeDur; newStart = safeDur - newDur }
  return { startSec: Math.max(0, newStart), endSec: Math.min(safeDur, newEnd) }
}

/** Shifts the viewport by `deltaSec`, clamping at track boundaries. */
export function panViewport(
  vp:          TimelineViewport,
  deltaSec:    number,
  durationSec: number,
): TimelineViewport {
  const safeDur = resolvePositiveDuration(durationSec, MIN_VIEWPORT_SEC)
  const current = normalizeViewport(vp, safeDur)
  const delta   = resolveFiniteTime(deltaSec)
  const dur     = current.endSec - current.startSec
  let start = current.startSec + delta
  let end   = current.endSec   + delta
  if (start < 0)       { start = 0;       end = dur           }
  if (end   > safeDur) { end = safeDur; start = safeDur - dur }
  return { startSec: Math.max(0, start), endSec: Math.min(safeDur, end) }
}

export interface TimeRange {
  startSec: number
  endSec:   number
}

export interface ViewportRangeLayout {
  visible:           boolean
  leftPct:           number
  widthPct:          number
  startEdgeVisible:  boolean
  endEdgeVisible:    boolean
}

const HIDDEN_RANGE_LAYOUT: ViewportRangeLayout = {
  visible:          false,
  leftPct:          0,
  widthPct:         0,
  startEdgeVisible: false,
  endEdgeVisible:   false,
}

/**
 * Computes viewport-relative layout for a timeline range. This pure helper is
 * shared by React render-time layout and imperative playback-follow updates.
 */
export function computeViewportRangeLayout(
  range: TimeRange,
  vp:    TimelineViewport,
): ViewportRangeLayout {
  const vpDur = vp.endSec - vp.startSec
  if (
    !Number.isFinite(vpDur) || vpDur <= 0 ||
    !Number.isFinite(range.startSec) || !Number.isFinite(range.endSec) ||
    range.endSec <= range.startSec
  ) return HIDDEN_RANGE_LAYOUT

  const visibleStart = Math.max(range.startSec, vp.startSec)
  const visibleEnd   = Math.min(range.endSec, vp.endSec)
  if (visibleEnd <= visibleStart) return HIDDEN_RANGE_LAYOUT

  return {
    visible:          true,
    leftPct:          ((visibleStart - vp.startSec) / vpDur) * 100,
    widthPct:         ((visibleEnd - visibleStart) / vpDur) * 100,
    startEdgeVisible: range.startSec >= vp.startSec - 0.01,
    endEdgeVisible:   range.endSec   <= vp.endSec   + 0.01,
  }
}

/**
 * Returns the visible portion of a time range within the viewport,
 * or null if the range is entirely outside.
 */
export function intersectTimeRange(
  range: TimeRange,
  vp:    TimelineViewport,
): { visibleStart: number; visibleEnd: number } | null {
  const layout = computeViewportRangeLayout(range, vp)
  if (!layout.visible) return null
  return {
    visibleStart: Math.max(range.startSec, vp.startSec),
    visibleEnd:   Math.min(range.endSec, vp.endSec),
  }
}

/** Maps an absolute time in seconds to a CSS-pixel position in the viewport. */
export function timeToPixel(
  timeSec: number,
  viewport: TimelineViewport,
  widthPx: number,
): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return 0
  return timeToViewportRatio(timeSec, viewport) * widthPx
}

/** Maps a CSS-pixel position back to an absolute time in seconds. */
export function pixelToTime(
  pixelX: number,
  viewport: TimelineViewport,
  widthPx: number,
): number {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return viewport.startSec
  return viewportRatioToTime(resolveFiniteTime(pixelX) / widthPx, viewport)
}

/**
 * Converts a pointer clientX to timeline time and clamps it to both the visible
 * viewport and the track duration. Shared by Audio Dock and lyric authoring.
 */
export function clientXToTimelineTime(
  clientX: number,
  rect: Pick<DOMRect, 'left' | 'width'>,
  viewport: TimelineViewport,
  durationSec: number,
): number {
  const safeDuration = resolvePositiveDuration(durationSec, MIN_VIEWPORT_SEC)
  const ratio = rect.width > 0
    ? Math.max(0, Math.min(1, (resolveFiniteTime(clientX) - rect.left) / rect.width))
    : 0
  return Math.max(0, Math.min(safeDuration, viewportRatioToTime(ratio, viewport)))
}

/** Returns true when a time is inside the viewport, including either edge. */
export function isTimeVisible(timeSec: number, viewport: TimelineViewport): boolean {
  return Number.isFinite(timeSec) && timeSec >= viewport.startSec && timeSec <= viewport.endSec
}
