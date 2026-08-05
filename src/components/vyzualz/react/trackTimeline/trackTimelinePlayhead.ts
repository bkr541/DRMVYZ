export function clampTrackTimelinePlayheadTime(currentTimeSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0
  if (!Number.isFinite(currentTimeSec)) return 0
  return Math.min(durationSec, Math.max(0, currentTimeSec))
}

export function resolveTrackTimelinePlayheadRatio(currentTimeSec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0
  return clampTrackTimelinePlayheadTime(currentTimeSec, durationSec) / durationSec
}
