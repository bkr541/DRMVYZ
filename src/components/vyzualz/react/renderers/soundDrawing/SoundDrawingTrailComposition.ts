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
  activeSourceTrail: number
  feedbackAmount: number
  livingRibbonActive: boolean
  livingRibbonTrailDetail: number
}): AuthoredTrailDecayResolution {
  const authoredPersistence = clamp(
    input.globalTrailPersistence * 0.78 + input.activeSourceTrail * 0.16 + input.feedbackAmount * 0.12,
    0,
    0.98,
  )
  if (input.trailLockEnabled && input.trailLockMode === 'manualResolved') {
    return {
      alpha: computeSoundDrawingTrailDecayAlpha(
        input.trailLockSnapshotDecay ?? input.manualTrailDecay,
        input.dtSeconds,
      ),
      owner: 'manualResolvedLock',
      authoredPersistence,
    }
  }
  return {
    alpha: clamp(
      ((1 - authoredPersistence) * 0.28 + input.manualTrailDecay * 0.04) /
        (input.livingRibbonActive ? input.livingRibbonTrailDetail : 1),
      0.02,
      0.32,
    ),
    owner: 'authoredMix',
    authoredPersistence,
  }
}
