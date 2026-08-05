export interface TrackTimelineViewport {
  startSec: number
  endSec: number
}

export interface TrackTimelineViewportBar {
  start: number
  end: number
}

export type TrackTimelineZoomPreset = 'full' | 32 | 16 | 8 | 4

export const TRACK_TIMELINE_ZOOM_PRESETS: readonly TrackTimelineZoomPreset[] = [
  'full',
  32,
  16,
  8,
  4,
]

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeTrackTimelineViewport(
  viewport: TrackTimelineViewport,
  durationSec: number,
  minimumDurationSec = 0.25,
): TrackTimelineViewport {
  const duration = Math.max(0, finite(durationSec, 0))
  if (duration <= 0) return { startSec: 0, endSec: 0 }

  const requestedStart = finite(viewport.startSec, 0)
  const requestedEnd = finite(viewport.endSec, duration)
  const minDuration = Math.min(duration, Math.max(0.001, finite(minimumDurationSec, 0.25)))
  const requestedDuration = Math.max(minDuration, requestedEnd - requestedStart)
  const clampedDuration = Math.min(duration, requestedDuration)
  const startSec = clamp(requestedStart, 0, Math.max(0, duration - clampedDuration))

  return {
    startSec,
    endSec: startSec + clampedDuration,
  }
}

export function estimateTrackTimelineBarDuration(
  bars: readonly TrackTimelineViewportBar[],
  bpm: number | null,
  timeSignature: number | null,
): number {
  const durations = bars
    .map(bar => bar.end - bar.start)
    .filter(duration => Number.isFinite(duration) && duration > 0.05)
    .sort((a, b) => a - b)

  if (durations.length > 0) {
    const middle = Math.floor(durations.length / 2)
    return durations.length % 2 === 0
      ? (durations[middle - 1]! + durations[middle]!) / 2
      : durations[middle]!
  }

  const safeBpm = Math.max(1, bpm ?? 120)
  const beatsPerBar = Math.max(1, timeSignature ?? 4)
  return (60 / safeBpm) * beatsPerBar
}

export function createTrackTimelineViewport(
  durationSec: number,
  bars: readonly TrackTimelineViewportBar[],
  bpm: number | null,
  timeSignature: number | null,
  preset: TrackTimelineZoomPreset,
  centerSec: number,
): TrackTimelineViewport {
  const duration = Math.max(0, finite(durationSec, 0))
  if (duration <= 0 || preset === 'full') return { startSec: 0, endSec: duration }

  if (bars.length > 0) {
    const requestedBars = Math.min(preset, bars.length)
    const safeCenter = clamp(finite(centerSec, 0), 0, duration)
    let centerIndex = bars.findIndex(bar => safeCenter >= bar.start && safeCenter < bar.end)
    if (centerIndex === -1) {
      centerIndex = bars.reduce((bestIndex, bar, index) => {
        const best = bars[bestIndex]!
        const barCenter = (bar.start + bar.end) / 2
        const bestCenter = (best.start + best.end) / 2
        return Math.abs(barCenter - safeCenter) < Math.abs(bestCenter - safeCenter) ? index : bestIndex
      }, 0)
    }
    const startIndex = clamp(
      centerIndex - Math.floor(requestedBars / 2),
      0,
      Math.max(0, bars.length - requestedBars),
    )
    const endIndex = Math.min(bars.length - 1, startIndex + requestedBars - 1)
    return normalizeTrackTimelineViewport({
      startSec: bars[startIndex]!.start,
      endSec: bars[endIndex]!.end,
    }, duration, 0.25)
  }

  const barDuration = estimateTrackTimelineBarDuration(bars, bpm, timeSignature)
  const viewportDuration = Math.min(duration, Math.max(0.25, barDuration * preset))
  const safeCenter = clamp(finite(centerSec, viewportDuration / 2), 0, duration)

  return normalizeTrackTimelineViewport({
    startSec: safeCenter - viewportDuration / 2,
    endSec: safeCenter + viewportDuration / 2,
  }, duration, Math.min(viewportDuration, barDuration * 4))
}

export function moveTrackTimelineViewport(
  viewport: TrackTimelineViewport,
  nextStartSec: number,
  durationSec: number,
): TrackTimelineViewport {
  const width = Math.max(0, viewport.endSec - viewport.startSec)
  return normalizeTrackTimelineViewport({
    startSec: nextStartSec,
    endSec: nextStartSec + width,
  }, durationSec, Math.min(width, 0.25))
}

export function resolveTrackTimelineViewportRatio(
  timeSec: number,
  viewport: TrackTimelineViewport,
): number | null {
  const width = viewport.endSec - viewport.startSec
  if (!Number.isFinite(timeSec) || width <= 0 || timeSec < viewport.startSec || timeSec > viewport.endSec) {
    return null
  }
  return clamp((timeSec - viewport.startSec) / width, 0, 1)
}
