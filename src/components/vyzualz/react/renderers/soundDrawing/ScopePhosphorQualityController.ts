import {
  SCOPE_PHOSPHOR_QUALITY_ORDER,
  type ScopePhosphorQuality,
} from './soundDrawingPhosphorPlan'

// ── ScopePhosphorQualityController ────────────────────────────────────────────
//
// Frame-timing-driven quality selection for the GPU phosphor pipeline.
//
// Follows the hysteresis shape LaserDMX's adaptive quality already established
// — separate downshift and upshift cooldowns, a minimum sample count, and a
// per-tier slow-frame threshold — rather than inventing a second policy. It is a
// separate instance because the two pipelines have different pass budgets and
// must be able to sit at different tiers on the same machine.
//
// The controlling idea is asymmetry. Dropping quality is cheap and should be
// quick, because the user is currently dropping frames. Raising it is
// speculative and should be slow, because being wrong costs another visible
// downshift. Symmetric cooldowns produce oscillation, which reads worse than
// simply sitting one tier low.

export type ScopeQualityChangeReason =
  | 'initial'
  | 'explicit'
  | 'slow-frame'
  | 'stable-headroom'
  | 'context-restored'

export interface ScopeQualitySnapshot {
  /** What the user asked for; 'auto' hands control to this class. */
  requested: ScopePhosphorQuality | 'auto'
  effective: ScopePhosphorQuality
  averageFrameMs: number | null
  sampleCount: number
  downshiftCount: number
  upshiftCount: number
  lastChangeReason: ScopeQualityChangeReason
}

/** Minimum frames before any automatic decision. */
const MIN_SAMPLES = 20

/** Never re-evaluate more often than this. */
const MIN_EVALUATION_INTERVAL_MS = 1_000

/** After dropping a tier, settle before considering another change. */
const DOWNSHIFT_COOLDOWN_MS = 2_500

/**
 * After raising a tier, wait considerably longer. Deliberately ~3x the
 * downshift cooldown: an over-eager upshift immediately triggers a downshift,
 * and the resulting pumping is far more noticeable than staying conservative.
 */
const UPSHIFT_COOLDOWN_MS = 8_000

/**
 * Average frame time above which a tier is considered too expensive.
 *
 * Below 60 fps (16.7 ms) with headroom for everything else on the frame. The
 * cheapest tier has no threshold — there is nothing below it to fall to, and
 * reporting it as "too slow" every second would only add noise.
 */
function slowFrameThresholdMs(quality: ScopePhosphorQuality): number {
  switch (quality) {
    case 'ultra': return 18.5
    case 'high': return 20.5
    case 'medium': return 24
    case 'low': return Number.POSITIVE_INFINITY
  }
}

/**
 * Average frame time below which the next tier up is worth attempting.
 *
 * Strictly tighter than the tier above's downshift threshold, so a tier that
 * would immediately fail cannot be selected. That gap is what prevents a
 * two-tier oscillation loop.
 */
function headroomThresholdMs(quality: ScopePhosphorQuality): number {
  switch (quality) {
    case 'low': return 12
    case 'medium': return 11
    case 'high': return 10
    case 'ultra': return Number.NEGATIVE_INFINITY
  }
}

function qualityIndex(quality: ScopePhosphorQuality): number {
  return SCOPE_PHOSPHOR_QUALITY_ORDER.indexOf(quality)
}

function step(quality: ScopePhosphorQuality, direction: -1 | 1): ScopePhosphorQuality {
  const index = qualityIndex(quality) + direction
  const clamped = Math.max(0, Math.min(SCOPE_PHOSPHOR_QUALITY_ORDER.length - 1, index))
  return SCOPE_PHOSPHOR_QUALITY_ORDER[clamped]
}

export class ScopePhosphorQualityController {
  private requested: ScopePhosphorQuality | 'auto'
  private effective: ScopePhosphorQuality

  private frameMsTotal = 0
  private frameSamples = 0
  private lastEvaluationMs: number | null = null
  private lastChangeMs: number | null = null
  private lastChangeWasUpshift = false

  private downshiftCount = 0
  private upshiftCount = 0
  private lastChangeReason: ScopeQualityChangeReason = 'initial'

  constructor(requested: ScopePhosphorQuality | 'auto', initialAuto: ScopePhosphorQuality) {
    this.requested = requested
    this.effective = requested === 'auto' ? initialAuto : requested
  }

  get currentQuality(): ScopePhosphorQuality {
    return this.effective
  }

  /** Applies an explicit user selection, cancelling automatic control. */
  setRequested(requested: ScopePhosphorQuality | 'auto', initialAuto: ScopePhosphorQuality): void {
    if (requested === this.requested) return
    this.requested = requested
    if (requested !== 'auto') {
      this.effective = requested
      this.lastChangeReason = 'explicit'
    } else {
      this.effective = initialAuto
      this.lastChangeReason = 'initial'
    }
    this.resetSamples()
    // An explicit change starts its own cooldown, so automatic control cannot
    // immediately override what the user just asked for.
    this.lastChangeMs = null
    this.lastEvaluationMs = null
  }

  /**
   * Re-selects the tier after a context restore.
   *
   * Capabilities can genuinely differ after a restore — a different GPU may be
   * driving the context — so the automatic tier is recomputed rather than
   * assumed. An explicit user selection is preserved.
   */
  handleContextRestored(initialAuto: ScopePhosphorQuality): void {
    this.resetSamples()
    this.lastChangeMs = null
    this.lastEvaluationMs = null
    if (this.requested !== 'auto') return
    this.effective = initialAuto
    this.lastChangeReason = 'context-restored'
  }

  /**
   * Records one frame's GPU-or-CPU duration and returns the tier to use next.
   *
   * `nowMs` is supplied rather than read from `performance.now()` so the policy
   * is deterministic under test.
   */
  recordFrame(frameMs: number, nowMs: number): ScopePhosphorQuality {
    if (this.requested !== 'auto') return this.effective
    if (!Number.isFinite(frameMs) || frameMs < 0) return this.effective

    this.frameMsTotal += frameMs
    this.frameSamples++

    if (this.lastEvaluationMs == null) this.lastEvaluationMs = nowMs
    if (nowMs - this.lastEvaluationMs < MIN_EVALUATION_INTERVAL_MS) return this.effective
    if (this.frameSamples < MIN_SAMPLES) return this.effective

    this.lastEvaluationMs = nowMs
    const average = this.frameMsTotal / this.frameSamples

    const cooldown = this.lastChangeWasUpshift ? UPSHIFT_COOLDOWN_MS : DOWNSHIFT_COOLDOWN_MS
    const withinCooldown = this.lastChangeMs != null && nowMs - this.lastChangeMs < cooldown

    if (!withinCooldown) {
      if (average > slowFrameThresholdMs(this.effective) && this.effective !== 'low') {
        this.applyChange(step(this.effective, -1), 'slow-frame', nowMs, false)
        return this.effective
      }
      if (average < headroomThresholdMs(this.effective) && this.effective !== 'ultra') {
        this.applyChange(step(this.effective, 1), 'stable-headroom', nowMs, true)
        return this.effective
      }
    }

    // Start a fresh window either way, so one slow burst cannot bias the
    // average long after the conditions that produced it have passed.
    this.resetSamples()
    return this.effective
  }

  private applyChange(
    next: ScopePhosphorQuality,
    reason: ScopeQualityChangeReason,
    nowMs: number,
    isUpshift: boolean,
  ): void {
    if (next === this.effective) return
    this.effective = next
    this.lastChangeReason = reason
    this.lastChangeMs = nowMs
    this.lastChangeWasUpshift = isUpshift
    if (isUpshift) this.upshiftCount++
    else this.downshiftCount++
    this.resetSamples()
  }

  private resetSamples(): void {
    this.frameMsTotal = 0
    this.frameSamples = 0
  }

  getSnapshot(): ScopeQualitySnapshot {
    return {
      requested: this.requested,
      effective: this.effective,
      averageFrameMs: this.frameSamples > 0 ? this.frameMsTotal / this.frameSamples : null,
      sampleCount: this.frameSamples,
      downshiftCount: this.downshiftCount,
      upshiftCount: this.upshiftCount,
      lastChangeReason: this.lastChangeReason,
    }
  }
}
