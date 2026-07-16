import { resolvePixGridMatrixDimensions } from './PixGridDefaults'
import type { PixGridQualityMode, PixGridQualityTier } from './PixGridTypes'

export type PixGridAdaptiveStage = 0 | 1 | 2 | 3

export interface PixGridAdaptiveQualityProfile {
  stage: PixGridAdaptiveStage
  logicalQuality: PixGridQualityTier
  logicalWidth: number
  logicalHeight: number
  glowScale: number
  diffusionScale: number
  rgbSubpixelEnabled: boolean
  diagnosticsEnabled: boolean
  reason: 'fixed' | 'full' | 'effects-reduced' | 'secondary-effects-minimal' | 'logical-resolution-reduced'
}

export interface PixGridAdaptiveQualitySample {
  fps: number
  nowMs: number
  requestedQuality: PixGridQualityTier
  mode: PixGridQualityMode
  thumbnail?: boolean
}

export interface PixGridAdaptiveQualityOptions {
  degradeFps?: number
  recoverFps?: number
  degradeSamples?: number
  recoverSamples?: number
  transitionCooldownMs?: number
}

function reducedLogicalQuality(requested: PixGridQualityTier): PixGridQualityTier {
  if (requested === 'ultra') return 'high'
  if (requested === 'high') return 'low'
  return 'low'
}

export function resolvePixGridAdaptiveQualityProfile(
  requestedQuality: PixGridQualityTier,
  mode: PixGridQualityMode,
  stage: PixGridAdaptiveStage,
): PixGridAdaptiveQualityProfile {
  const effectiveStage: PixGridAdaptiveStage = mode === 'fixed' ? 0 : stage
  const adaptiveBaseQuality = mode === 'adaptive' && requestedQuality === 'draft' ? 'low' : requestedQuality
  const logicalQuality = effectiveStage >= 3 ? reducedLogicalQuality(adaptiveBaseQuality) : adaptiveBaseQuality
  const dimensions = resolvePixGridMatrixDimensions(logicalQuality)
  if (mode === 'fixed') {
    return {
      stage: 0,
      logicalQuality,
      logicalWidth: dimensions.width,
      logicalHeight: dimensions.height,
      glowScale: 1,
      diffusionScale: 1,
      rgbSubpixelEnabled: true,
      diagnosticsEnabled: true,
      reason: 'fixed',
    }
  }
  if (effectiveStage === 0) {
    return {
      stage: 0,
      logicalQuality,
      logicalWidth: dimensions.width,
      logicalHeight: dimensions.height,
      glowScale: 1,
      diffusionScale: 1,
      rgbSubpixelEnabled: true,
      diagnosticsEnabled: true,
      reason: 'full',
    }
  }
  if (effectiveStage === 1) {
    return {
      stage: 1,
      logicalQuality,
      logicalWidth: dimensions.width,
      logicalHeight: dimensions.height,
      glowScale: 0.65,
      diffusionScale: 0.6,
      rgbSubpixelEnabled: true,
      diagnosticsEnabled: false,
      reason: 'effects-reduced',
    }
  }
  if (effectiveStage === 2) {
    return {
      stage: 2,
      logicalQuality,
      logicalWidth: dimensions.width,
      logicalHeight: dimensions.height,
      glowScale: 0.28,
      diffusionScale: 0.22,
      rgbSubpixelEnabled: false,
      diagnosticsEnabled: false,
      reason: 'secondary-effects-minimal',
    }
  }
  return {
    stage: 3,
    logicalQuality,
    logicalWidth: dimensions.width,
    logicalHeight: dimensions.height,
    glowScale: 0.22,
    diffusionScale: 0.18,
    rgbSubpixelEnabled: false,
    diagnosticsEnabled: false,
    reason: 'logical-resolution-reduced',
  }
}

/**
 * Slow-moving quality controller. It samples the already-aggregated live FPS
 * once per reporting window, changes at most one stage per cooldown, and never
 * lets thumbnail work influence the live renderer.
 */
export class PixGridAdaptiveQualityController {
  private stage: PixGridAdaptiveStage = 0
  private lowSamples = 0
  private healthySamples = 0
  private lastTransitionMs = Number.NEGATIVE_INFINITY
  private readonly degradeFps: number
  private readonly recoverFps: number
  private readonly degradeSamples: number
  private readonly recoverSamples: number
  private readonly transitionCooldownMs: number

  constructor(options: PixGridAdaptiveQualityOptions = {}) {
    this.degradeFps = options.degradeFps ?? 52
    this.recoverFps = options.recoverFps ?? 58
    this.degradeSamples = options.degradeSamples ?? 3
    this.recoverSamples = options.recoverSamples ?? 8
    this.transitionCooldownMs = options.transitionCooldownMs ?? 5_000
  }

  get currentStage(): PixGridAdaptiveStage { return this.stage }

  reset(): void {
    this.stage = 0
    this.lowSamples = 0
    this.healthySamples = 0
    this.lastTransitionMs = Number.NEGATIVE_INFINITY
  }

  sample(input: PixGridAdaptiveQualitySample): PixGridAdaptiveQualityProfile {
    if (input.thumbnail || input.mode === 'fixed') {
      this.lowSamples = 0
      this.healthySamples = 0
      if (input.mode === 'fixed') this.stage = 0
      return resolvePixGridAdaptiveQualityProfile(input.requestedQuality, input.mode, this.stage)
    }

    const fps = Number.isFinite(input.fps) ? input.fps : 0
    if (fps > 0 && fps < this.degradeFps) {
      this.lowSamples += 1
      this.healthySamples = 0
    } else if (fps >= this.recoverFps) {
      this.healthySamples += 1
      this.lowSamples = 0
    } else {
      this.lowSamples = Math.max(0, this.lowSamples - 1)
      this.healthySamples = Math.max(0, this.healthySamples - 1)
    }

    const cooldownElapsed = input.nowMs - this.lastTransitionMs >= this.transitionCooldownMs
    if (cooldownElapsed && this.lowSamples >= this.degradeSamples && this.stage < 3) {
      this.stage = (this.stage + 1) as PixGridAdaptiveStage
      this.lowSamples = 0
      this.healthySamples = 0
      this.lastTransitionMs = input.nowMs
    } else if (cooldownElapsed && this.healthySamples >= this.recoverSamples && this.stage > 0) {
      this.stage = (this.stage - 1) as PixGridAdaptiveStage
      this.lowSamples = 0
      this.healthySamples = 0
      this.lastTransitionMs = input.nowMs
    }

    return resolvePixGridAdaptiveQualityProfile(input.requestedQuality, input.mode, this.stage)
  }
}
