const SOUND_DRAWING_TRAIL_RETENTION_MIN = 0.35 // trailDecay = 1 (fastest)
const SOUND_DRAWING_TRAIL_RETENTION_MAX = 0.97 // trailDecay = 0 (slowest)

export const SOUND_DRAWING_TRAIL_REFERENCE_FPS = 30

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

/** Maps the 0–1 trailDecay control to a per-reference-frame (1/30s) retention fraction. */
export function computeSoundDrawingTrailRetentionPerReferenceFrame(trailDecay: number): number {
  const t = clamp(trailDecay, 0, 1)
  return SOUND_DRAWING_TRAIL_RETENTION_MAX - t * (SOUND_DRAWING_TRAIL_RETENTION_MAX - SOUND_DRAWING_TRAIL_RETENTION_MIN)
}

/** Frame-rate-independent trail retention over an actual elapsed `dtSeconds`. */
export function computeSoundDrawingTrailRetention(trailDecay: number, dtSeconds: number): number {
  const perReferenceFrame = computeSoundDrawingTrailRetentionPerReferenceFrame(trailDecay)
  const frameRatio = Math.max(0, dtSeconds) * SOUND_DRAWING_TRAIL_REFERENCE_FPS
  return Math.pow(clamp(perReferenceFrame, 0.0001, 0.9999), frameRatio)
}

/** Fraction of trail energy to erase this frame, floored so a trail never fully freezes. */
export function computeSoundDrawingTrailDecayAlpha(trailDecay: number, dtSeconds: number): number {
  return clamp(1 - computeSoundDrawingTrailRetention(trailDecay, dtSeconds), 0.01, 1)
}

export interface AuthoredTrailDecayResolution {
  alpha: number
  owner: 'manualResolvedLock' | 'authoredMix'
  authoredPersistence: number
  /** Alpha used when copying the clean current frame into bounded history. */
  historyWriteAlpha: number
}

/**
 * Controls how strongly a clean current frame is written into temporal history.
 * History is always committed with source-over, so this value changes trail weight
 * without permitting additive frame-over-frame energy growth.
 */
export function computeSoundDrawingHistoryWriteAlpha(
  authoredPersistence: number,
  feedbackAmount: number,
): number {
  const persistence = clamp(authoredPersistence, 0, 1)
  const feedback = clamp(feedbackAmount, 0, 1)
  // Zero persistence means zero history. The previous fixed 0.42 floor wrote a
  // ghost frame even when a layer explicitly requested no trail, which kept
  // supporting visuals and low-Trail-Intensity scopes smeared on screen.
  if (persistence <= 0.0001 && feedback <= 0.0001) return 0
  return clamp(persistence * 0.72 + feedback * 0.18, 0, 0.88)
}

/**
 * Resolves the final authored-performance trail fade. Version 2 trail locks protect
 * the captured manual Trail Decay at the last composition step. Legacy locks retain
 * the historic authored recipe, including source, feedback, Ribbon and Trail Intensity.
 */
export function resolveAuthoredSoundDrawingTrailDecay(input: {
  manualTrailDecay: number
  dtSeconds: number
  trailLockEnabled: boolean
  trailLockMode: 'legacyRecipe' | 'manualResolved'
  trailLockSnapshotDecay?: number | null
  globalTrailPersistence: number
  layerTrailPersistence?: number
  activeSourceTrail: number
  feedbackAmount: number
  layerFeedbackAmount?: number
  livingRibbonActive: boolean
  livingRibbonTrailDetail: number
}): AuthoredTrailDecayResolution {
  const layerTrailPersistence = clamp(
    input.layerTrailPersistence ?? input.globalTrailPersistence,
    0,
    1,
  )
  const layerFeedbackAmount = clamp(input.layerFeedbackAmount ?? input.feedbackAmount, 0, 1)
  const authoredPersistence = clamp(
    layerTrailPersistence * 0.58
      + input.globalTrailPersistence * 0.22
      + input.activeSourceTrail * 0.12
      + layerFeedbackAmount * 0.08,
    0,
    0.98,
  )
  const historyWriteAlpha = computeSoundDrawingHistoryWriteAlpha(
    authoredPersistence,
    layerFeedbackAmount,
  )
  if (input.trailLockEnabled && input.trailLockMode === 'manualResolved') {
    return {
      alpha: computeSoundDrawingTrailDecayAlpha(
        input.trailLockSnapshotDecay ?? input.manualTrailDecay,
        input.dtSeconds,
      ),
      owner: 'manualResolvedLock',
      authoredPersistence,
      historyWriteAlpha,
    }
  }
  const referenceAlpha = clamp(
    ((1 - authoredPersistence) * 0.28 + input.manualTrailDecay * 0.04) /
      (input.livingRibbonActive ? input.livingRibbonTrailDetail : 1),
    0.02,
    0.32,
  )
  const frameRatio = Math.max(0, input.dtSeconds) * SOUND_DRAWING_TRAIL_REFERENCE_FPS
  return {
    alpha: clamp(1 - Math.pow(1 - referenceAlpha, frameRatio), 0.001, 1),
    owner: 'authoredMix',
    authoredPersistence,
    historyWriteAlpha,
  }
}
