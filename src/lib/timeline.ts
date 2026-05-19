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

// ── Clip playback helpers ─────────────────────────────────────────────

export interface ClipSourceRange {
  inSec: number     // effective source start (≥ 0)
  outSec: number    // effective source end
  lengthSec: number // outSec − inSec (always > 0)
}

/**
 * Returns the effective source range for a clip.
 * Pass `HTMLVideoElement.duration` (may be NaN/Infinity when metadata not yet loaded).
 * For images, pass 0 — the result is not used for drawing logic.
 */
export function getClipSourceRange(clip: VzTimelineClip, videoDuration: number): ClipSourceRange {
  const inSec = Math.max(0, clip.mediaInSec)
  let outSec: number
  if (clip.mediaOutSec !== undefined && clip.mediaOutSec > inSec) {
    outSec = clip.mediaOutSec
  } else if (isFinite(videoDuration) && videoDuration > 0) {
    outSec = videoDuration
  } else {
    outSec = inSec + clip.durationSec // safe fallback when duration unknown
  }
  // Never exceed known video duration
  if (isFinite(videoDuration) && videoDuration > 0) {
    outSec = Math.min(outSec, videoDuration)
  }
  outSec = Math.max(outSec, inSec + 0.001) // guarantee non-zero length
  return { inSec, outSec, lengthSec: outSec - inSec }
}

/**
 * Returns the desired `video.currentTime` for the given local clip time.
 * For loop mode the source segment is wrapped; for trim/freeze it is clamped.
 */
export function getClipSourceTime(
  clip: VzTimelineClip,
  localTimeSec: number,
  videoDuration: number,
): number {
  const { inSec, outSec, lengthSec } = getClipSourceRange(clip, videoDuration)
  const local = Math.max(0, localTimeSec)
  switch (clip.playbackMode) {
    case 'loop':
      return lengthSec > 0 ? inSec + (local % lengthSec) : inSec
    case 'trim':
    case 'freeze':
    default:
      return Math.min(inSec + local, outSec - 0.001)
  }
}

/**
 * Returns true when a trim/freeze clip has consumed its source range
 * and should hold the final frame rather than advancing.
 */
export function shouldFreezeClipFrame(
  clip: VzTimelineClip,
  localTimeSec: number,
  videoDuration: number,
): boolean {
  if (clip.playbackMode === 'loop') return false
  const { lengthSec } = getClipSourceRange(clip, videoDuration)
  return localTimeSec >= lengthSec
}

/** Returns the clip after `clipId`; wraps to first when loop=true, null when not found or at end */
export function getNextTimelineClip(
  clips: VzTimelineClip[],
  clipId: string,
  loop: boolean,
): VzTimelineClip | null {
  const idx = clips.findIndex(c => c.id === clipId)
  if (idx === -1) return null
  if (idx + 1 < clips.length) return clips[idx + 1]
  return loop ? clips[0] : null
}

export interface TransitionState {
  type: 'cut' | 'crossfade' | 'glitch' | 'flash'
  /** 0 → 1, clamped */
  progress: number
  outgoingClip: VzTimelineClip
  incomingClip: VzTimelineClip
}

/**
 * Returns a TransitionState when `timeSec` falls within a non-cut transition
 * window attached to the END of the outgoing clip.
 * Returns null outside any transition window, or for cut-type transitions.
 *
 * Timing model: the transition lives in the last `transition.durationSec`
 * seconds of the outgoing clip.  progress=0 at window start, progress=1
 * at the clip boundary (hard switch point).
 */
export function getTransitionState(
  clips: VzTimelineClip[],
  timeSec: number,
  loop: boolean,
): TransitionState | null {
  if (!clips.length) return null
  const total = getTimelineDuration(clips)
  if (total <= 0) return null

  let t = timeSec
  if (loop) {
    t = ((t % total) + total) % total
  } else {
    t = Math.min(t, total)
  }

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    if (!clip.transition || clip.transition.type === 'cut' || clip.transition.durationSec <= 0) continue

    const transDur    = Math.min(clip.transition.durationSec, clip.durationSec)
    const clipEnd     = clip.startSec + clip.durationSec
    const transStart  = clipEnd - transDur

    if (t >= transStart && t < clipEnd) {
      const incomingClip: VzTimelineClip | null =
        i + 1 < clips.length ? clips[i + 1] : loop ? clips[0] : null
      if (!incomingClip) continue

      return {
        type:         clip.transition.type,
        progress:     Math.min(1, Math.max(0, (t - transStart) / transDur)),
        outgoingClip: clip,
        incomingClip,
      }
    }
  }
  return null
}
