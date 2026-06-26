import type { QualityTier } from '../registry/shaderRegistryTypes'

// ── Quality tier with auto ────────────────────────────────────────────────────

export type QualityTierWithAuto = QualityTier | 'auto'

// ── Quality profiles ──────────────────────────────────────────────────────────

export interface QualityProfile {
  internalResolutionScale: number   // 0.25..1.0 — multiplied against canvas size
  rayMarchSteps:           number   // e.g. 32, 64, 128, 256
  fractalIterations:       number   // e.g. 4, 8, 16, 32
  particleCount:           number   // max simultaneous particles
  simulationResolution:    number   // fraction 0..1 of canvas
  bloomResolution:         number   // fraction 0..1 of canvas
  blurTaps:                number   // number of blur sample taps
  textureResolution:       'quarter' | 'half' | 'full'
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    internalResolutionScale: 0.5,
    rayMarchSteps:           32,
    fractalIterations:       4,
    particleCount:           1_000,
    simulationResolution:    0.25,
    bloomResolution:         0.25,
    blurTaps:                4,
    textureResolution:       'quarter',
  },
  medium: {
    internalResolutionScale: 0.75,
    rayMarchSteps:           64,
    fractalIterations:       8,
    particleCount:           10_000,
    simulationResolution:    0.5,
    bloomResolution:         0.5,
    blurTaps:                8,
    textureResolution:       'half',
  },
  high: {
    internalResolutionScale: 1.0,
    rayMarchSteps:           128,
    fractalIterations:       16,
    particleCount:           50_000,
    simulationResolution:    1.0,
    bloomResolution:         0.75,
    blurTaps:                16,
    textureResolution:       'full',
  },
  ultra: {
    internalResolutionScale: 1.0,
    rayMarchSteps:           256,
    fractalIterations:       32,
    particleCount:           200_000,
    simulationResolution:    1.0,
    bloomResolution:         1.0,
    blurTaps:                32,
    textureResolution:       'full',
  },
}

export const QUALITY_TIER_ORDER: QualityTier[] = ['low', 'medium', 'high', 'ultra']

// ── Performance metrics (one frame snapshot) ──────────────────────────────────

export interface PerformanceMetrics {
  /** CPU time to prepare uniforms and issue draw calls (ms). */
  cpuPrepMs:            number
  /** GPU time from timer query — null when extension not available. */
  gpuMs:                number | null
  /** Wall-clock total frame time (ms). */
  totalMs:              number
  /** Number of render passes this frame. */
  passCount:            number
  /** Number of live render targets (FBOs). */
  renderTargetCount:    number
  /** Estimated GPU texture memory (MiB). */
  textureMb:            number
  /** Render target width in pixels. */
  internalW:            number
  /** Render target height in pixels. */
  internalH:            number
  /** Frames in a row that exceeded the slow-frame threshold. */
  consecutiveSlowFrames: number
}

export const EMPTY_METRICS: PerformanceMetrics = {
  cpuPrepMs:            0,
  gpuMs:                null,
  totalMs:              0,
  passCount:            0,
  renderTargetCount:    0,
  textureMb:            0,
  internalW:            0,
  internalH:            0,
  consecutiveSlowFrames: 0,
}

// ── Auto quality state ────────────────────────────────────────────────────────

export interface AutoQualityState {
  /** The tier currently in use. */
  currentTier:    QualityTier
  /** True when the tier was reduced automatically by the quality controller. */
  wasAutoAdjusted: boolean
  /** Number of consecutive frames that exceeded the slow-frame threshold. */
  slowFrameCount:  number
  /** Number of consecutive frames within the fast-frame threshold. */
  stableFrameCount: number
}

// ── Timer query result ────────────────────────────────────────────────────────

export interface TimerQueryResult {
  available:  boolean
  gpuMs:      number | null
}
