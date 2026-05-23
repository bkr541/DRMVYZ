// Shared time ↔ pixel math for the multi-lane timeline editor.
// Import these wherever time-to-pixel conversion is needed — never duplicate.

export const MIN_CLIP_DUR = 0.25

/** Base pixels per second at zoom level 1. */
export const BASE_PX_PER_SEC = 60

export function timeToPx(t: number, pxPerSec: number): number {
  return t * pxPerSec
}

export function pxToTime(px: number, pxPerSec: number): number {
  return px / pxPerSec
}

/** Format seconds as M:SS.d for compact ruler labels. */
export function fmtTimelineLabel(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m === 0) return `${s}s`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format seconds as M:SS.d for inspector fields. */
export function fmtSec(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00.0'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const d = Math.floor((sec % 1) * 10)
  return `${m}:${String(s).padStart(2, '0')}.${d}`
}

export function clampSec(t: number, min = 0, max = Infinity): number {
  return Math.max(min, Math.min(max, t))
}

export function snapSec(t: number, snap = 0.1): number {
  return Math.round(t / snap) * snap
}

/** Choose a tick interval (seconds) that keeps ruler readable at the current scale. */
export function rulerTickInterval(totalSec: number, pxPerSec: number): number {
  // Target ~80px between ticks
  const targetSec = 80 / pxPerSec
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  for (const c of candidates) {
    if (c >= targetSec) return c
  }
  return 300
}
