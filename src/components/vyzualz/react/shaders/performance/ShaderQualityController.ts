import type { QualityTier } from '../registry/shaderRegistryTypes'
import type { QualityRequirements } from '../registry/shaderRegistryTypes'
import {
  type QualityTierWithAuto,
  type QualityProfile,
  type AutoQualityState,
  QUALITY_PROFILES,
  QUALITY_TIER_ORDER,
} from './shaderPerformanceTypes'
import type { ShaderPerformanceMonitor } from './ShaderPerformanceMonitor'

// ── Auto-quality configuration ────────────────────────────────────────────────

export interface AutoQualityConfig {
  /** Frames above slowThresholdMs before stepping down. Default 10. */
  slowFramesBeforeDowngrade:  number
  /** Frames below fastThresholdMs before stepping up. Default 120. */
  stableFramesBeforeUpgrade:  number
  /** Frame time considered "slow" (ms). Default 33ms (~30fps). */
  slowThresholdMs:            number
  /** Frame time considered "fast enough to upgrade" (ms). Default 18ms (~55fps). */
  fastThresholdMs:            number
}

const DEFAULT_AUTO_CONFIG: AutoQualityConfig = {
  slowFramesBeforeDowngrade:  10,
  stableFramesBeforeUpgrade:  120,
  slowThresholdMs:            33,
  fastThresholdMs:            18,
}

// ── ShaderQualityController ───────────────────────────────────────────────────

/**
 * Manages quality tier selection for the Shader engine.
 *
 * In `auto` mode the controller reads from a `ShaderPerformanceMonitor` on
 * each `evaluate()` call and steps quality up or down based on sustained
 * performance — not isolated frame spikes.  Hysteresis prevents constant
 * quality flicker:
 *   - Quality decreases quickly (after N slow frames).
 *   - Quality increases slowly (only after a much longer stable interval).
 *
 * Manual tier selection overrides auto immediately.
 */
export class ShaderQualityController {
  private _selectedTier:     QualityTierWithAuto = 'auto'
  private _effectiveTier:    QualityTier         = 'high'
  private _wasAutoAdjusted   = false
  private _autoConfig:       AutoQualityConfig   = { ...DEFAULT_AUTO_CONFIG }
  private _sceneMinTier:     QualityTier | null  = null

  // Hysteresis counters
  private _slowFrameCount:   number = 0
  private _stableFrameCount: number = 0

  // ── Tier selection ────────────────────────────────────────────────────────

  get selectedTier():  QualityTierWithAuto { return this._selectedTier }
  get effectiveTier(): QualityTier         { return this._effectiveTier }
  get wasAutoAdjusted(): boolean            { return this._wasAutoAdjusted }

  /**
   * Set the user's quality preference.
   * Passing 'auto' re-enables automatic quality management.
   * Passing a concrete tier disables auto and locks to that tier.
   */
  setTier(tier: QualityTierWithAuto): void {
    this._selectedTier = tier
    if (tier !== 'auto') {
      const clamped = this._clampToSceneMin(tier)
      this._effectiveTier   = clamped
      this._wasAutoAdjusted = false
      this._resetCounters()
    }
  }

  /**
   * Inform the controller of the active scene's minimum quality requirement.
   * Pass `null` when switching to a scene with no requirement.
   */
  setSceneQualityRequirements(req: QualityRequirements | null | undefined): void {
    this._sceneMinTier = req?.minimumTier ?? null
    if (this._selectedTier !== 'auto') {
      this._effectiveTier = this._clampToSceneMin(this._selectedTier as QualityTier)
    }
  }

  /**
   * The resolved quality profile for the current effective tier.
   */
  get profile(): QualityProfile {
    return QUALITY_PROFILES[this._effectiveTier]
  }

  // ── Auto-quality evaluation ───────────────────────────────────────────────

  /**
   * Configure the automatic quality thresholds.
   */
  configureAuto(config: Partial<AutoQualityConfig>): void {
    this._autoConfig = { ...this._autoConfig, ...config }
  }

  /**
   * Evaluate current performance and potentially adjust the quality tier.
   *
   * Must be called once per frame when in `auto` mode.  In manual mode
   * this is a no-op.
   *
   * @param monitor  The performance monitor to read metrics from.
   * @returns        True when the tier changed this evaluation.
   */
  evaluate(monitor: ShaderPerformanceMonitor): boolean {
    if (this._selectedTier !== 'auto') return false

    const m      = monitor.lastMetrics
    const total  = m.totalMs
    const cfg    = this._autoConfig

    const isSlow = total > cfg.slowThresholdMs
    const isFast = total < cfg.fastThresholdMs

    if (isSlow) {
      this._stableFrameCount = 0
      this._slowFrameCount++
    } else if (isFast) {
      this._slowFrameCount  = 0
      this._stableFrameCount++
    } else {
      this._slowFrameCount  = 0
      this._stableFrameCount = 0
    }

    // Step down
    if (this._slowFrameCount >= cfg.slowFramesBeforeDowngrade) {
      this._slowFrameCount = 0
      return this._stepDown()
    }

    // Step up
    if (this._stableFrameCount >= cfg.stableFramesBeforeUpgrade) {
      this._stableFrameCount = 0
      return this._stepUp()
    }

    return false
  }

  // ── Snapshot ──────────────────────────────────────────────────────────────

  get autoState(): AutoQualityState {
    return {
      currentTier:     this._effectiveTier,
      wasAutoAdjusted: this._wasAutoAdjusted,
      slowFrameCount:  this._slowFrameCount,
      stableFrameCount: this._stableFrameCount,
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _stepDown(): boolean {
    const idx = QUALITY_TIER_ORDER.indexOf(this._effectiveTier)
    const min = this._resolvedMinIndex()
    if (idx <= min) return false

    this._effectiveTier   = QUALITY_TIER_ORDER[idx - 1]
    this._wasAutoAdjusted = true
    return true
  }

  private _stepUp(): boolean {
    const idx = QUALITY_TIER_ORDER.indexOf(this._effectiveTier)
    if (idx >= QUALITY_TIER_ORDER.length - 1) return false

    const candidate = QUALITY_TIER_ORDER[idx + 1]
    this._effectiveTier   = candidate
    this._wasAutoAdjusted = true
    return true
  }

  private _clampToSceneMin(tier: QualityTier): QualityTier {
    if (!this._sceneMinTier) return tier
    const minIdx  = QUALITY_TIER_ORDER.indexOf(this._sceneMinTier)
    const tierIdx = QUALITY_TIER_ORDER.indexOf(tier)
    return tierIdx < minIdx ? this._sceneMinTier : tier
  }

  private _resolvedMinIndex(): number {
    if (!this._sceneMinTier) return 0
    return Math.max(0, QUALITY_TIER_ORDER.indexOf(this._sceneMinTier))
  }

  private _resetCounters(): void {
    this._slowFrameCount   = 0
    this._stableFrameCount = 0
  }
}
