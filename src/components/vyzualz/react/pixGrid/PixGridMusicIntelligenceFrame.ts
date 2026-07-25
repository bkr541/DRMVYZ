import type { AudioFeatureBusPublicationMeta } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'

const PIX_GRID_BUS_FRESHNESS_MS = 250
const PIX_GRID_BUS_TIME_TOLERANCE_SEC = 0.25

export interface PixGridBusFrameResolutionInput {
  frame: MusicIntelligenceFrame
  publication: AudioFeatureBusPublicationMeta
  audioTimeSec: number
  trackIdentity?: string | null
  nowMs?: number
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function finiteTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function frameMatchesTrack(frame: MusicIntelligenceFrame, trackIdentity: string | null | undefined): boolean {
  if (!trackIdentity) return true
  const identities = [frame.trackId, frame.sourceId].filter((value): value is string => Boolean(value))
  return identities.includes(trackIdentity)
}

export function createNeutralPixGridMusicIntelligenceFrame(
  audioTimeSec: number,
  trackIdentity?: string | null,
): MusicIntelligenceFrame {
  const identity = trackIdentity ?? null
  return {
    ...DEFAULT_MI_FRAME,
    timeSec: finiteTime(audioTimeSec),
    sourceId: identity,
    trackId: identity,
  }
}

/**
 * PixGrid may briefly render without an attached analyser during engine changes,
 * device disconnects, or WebGL recovery. Only reuse a complete bus frame when it
 * is fresh, belongs to the current track, and represents the current playhead.
 * Otherwise return a neutral frame so another retired renderer cannot animate
 * PixGrid with stale audio data.
 */
export function resolvePixGridBusMusicIntelligenceFrame({
  frame,
  publication,
  audioTimeSec,
  trackIdentity = null,
  nowMs = monotonicNow(),
}: PixGridBusFrameResolutionInput): MusicIntelligenceFrame {
  const timeSec = finiteTime(audioTimeSec)
  const ageMs = publication.publishedAtMs > 0
    ? Math.max(0, nowMs - publication.publishedAtMs)
    : Number.POSITIVE_INFINITY
  const completeFrame = publication.kind === 'frame' && frame.frameId > 0
  const fresh = ageMs <= PIX_GRID_BUS_FRESHNESS_MS
  const playheadMatches = Math.abs(finiteTime(frame.timeSec) - timeSec) <= PIX_GRID_BUS_TIME_TOLERANCE_SEC

  if (completeFrame && fresh && playheadMatches && frameMatchesTrack(frame, trackIdentity)) {
    return frame
  }

  return createNeutralPixGridMusicIntelligenceFrame(timeSec, trackIdentity)
}
