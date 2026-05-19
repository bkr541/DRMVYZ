import type { VzTimelineClip } from '../types/timeline'

export function recalculateTimelineStarts(clips: VzTimelineClip[]): VzTimelineClip[] {
  let cursor = 0
  return clips.map(clip => {
    const updated = { ...clip, startSec: cursor }
    cursor += clip.durationSec
    return updated
  })
}

export function getTimelineDuration(clips: VzTimelineClip[]): number {
  return clips.reduce((sum, c) => sum + c.durationSec, 0)
}

export interface ActiveClipResult {
  clip: VzTimelineClip | null
  localTimeSec: number    // time within the clip (0 → clip.durationSec)
  timelineTimeSec: number // resolved timeline position (after loop wrap)
}

export function getActiveTimelineClip(
  clips: VzTimelineClip[],
  timeSec: number,
  loop: boolean,
): ActiveClipResult {
  if (!clips.length) return { clip: null, localTimeSec: 0, timelineTimeSec: 0 }

  const total = getTimelineDuration(clips)
  if (total <= 0) return { clip: null, localTimeSec: 0, timelineTimeSec: 0 }

  let t = timeSec
  if (loop) {
    t = t % total
    if (t < 0) t += total
  } else {
    t = Math.min(t, total)
  }

  // Linear scan — clip count stays small (< 100) so this is fine
  for (const clip of clips) {
    if (t >= clip.startSec && t < clip.startSec + clip.durationSec) {
      return {
        clip,
        localTimeSec: t - clip.startSec,
        timelineTimeSec: t,
      }
    }
  }

  // Edge: t === total (non-loop end) → return last clip at its end
  const last = clips[clips.length - 1]
  return {
    clip: last,
    localTimeSec: last.durationSec,
    timelineTimeSec: total,
  }
}
