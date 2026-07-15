import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'

export type LaserDmxConcreteWebGLQuality = Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'>

export interface LaserDmxAdaptiveQualityCapabilities {
  hdrAvailable: boolean
  maxTextureSize: number
  maxRenderbufferSize: number
  devicePixelRatio: number
}

export interface LaserDmxAdaptiveQualitySnapshot {
  requested: LaserDmxShowDirectorWebGLQuality
  effective: LaserDmxConcreteWebGLQuality
  effectiveAtmosphere: LaserDmxConcreteWebGLQuality
  averageFrameMs: number | null
  sampleCount: number
  downshiftCount: number
  upshiftCount: number
  lastChangeReason: 'initial' | 'explicit' | 'slow-frame' | 'stable-headroom' | 'allocation-pressure'
}

const QUALITY_ORDER: readonly LaserDmxConcreteWebGLQuality[] = ['low', 'medium', 'high', 'ultra']
const MIN_EVALUATION_INTERVAL_MS = 1_000
const DOWNSHIFT_COOLDOWN_MS = 2_500
const UPSHIFT_COOLDOWN_MS = 8_000
const MIN_SAMPLES = 20

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function qualityIndex(quality: LaserDmxConcreteWebGLQuality): number {
  return QUALITY_ORDER.indexOf(quality)
}

function stepQuality(
  quality: LaserDmxConcreteWebGLQuality,
  direction: -1 | 1,
): LaserDmxConcreteWebGLQuality {
  return QUALITY_ORDER[clamp(qualityIndex(quality) + direction, 0, QUALITY_ORDER.length - 1)]
}

function lowerOf(
  left: LaserDmxConcreteWebGLQuality,
  right: LaserDmxConcreteWebGLQuality,
): LaserDmxConcreteWebGLQuality {
  return qualityIndex(left) <= qualityIndex(right) ? left : right
}

export function resolveLaserDmxInitialAutoQuality(
  capabilities: LaserDmxAdaptiveQualityCapabilities,
): LaserDmxConcreteWebGLQuality {
  const textureLimit = Math.min(
    Math.max(0, capabilities.maxTextureSize),
    Math.max(0, capabilities.maxRenderbufferSize),
  )
  const dpr = clamp(capabilities.devicePixelRatio, 0.5, 4)
  if (textureLimit < 2048) return 'low'
  if (textureLimit < 4096 || dpr >= 3) return 'medium'
  if (!capabilities.hdrAvailable || dpr >= 2.2) return 'high'
  return 'ultra'
}

export function resolveLaserDmxAutoAtmosphereQuality(
  mainQuality: LaserDmxConcreteWebGLQuality,
): LaserDmxConcreteWebGLQuality {
  // Atmosphere is the first scalable layer. Hero beam geometry remains at the
  // main quality while Ultra keeps haze at High to avoid full-frame fog cost.
  return mainQuality === 'ultra' ? 'high' : mainQuality
}

function slowFrameThreshold(quality: LaserDmxConcreteWebGLQuality): number {
  switch (quality) {
    case 'ultra': return 18.5
    case 'high': return 20.5
    case 'medium': return 24
    case 'low': return Number.POSITIVE_INFINITY
  }
}

function headroomThreshold(quality: LaserDmxConcreteWebGLQuality): number {
  switch (quality) {
    case 'low': return 11.2
    case 'medium': return 12.2
    case 'high': return 13.2
    case 'ultra': return Number.NEGATIVE_INFINITY
  }
}

/**
 * Bounded quality controller for the WebGL renderer.
 *
 * It observes only renderer timing and capabilities. It never changes camera,
 * fixture state, musical counters, occurrence identity, or authored geometry.
 */
export class LaserDmxAdaptiveQualityController {
  private effective: LaserDmxConcreteWebGLQuality
  private averageFrameMs: number | null = null
  private sampleCount = 0
  private lastEvaluationMs = Number.NEGATIVE_INFINITY
  private lastChangeMs = Number.NEGATIVE_INFINITY
  private slowWindows = 0
  private headroomWindows = 0
  private downshiftCount = 0
  private upshiftCount = 0
  private lastChangeReason: LaserDmxAdaptiveQualitySnapshot['lastChangeReason'] = 'initial'

  constructor(private capabilities: LaserDmxAdaptiveQualityCapabilities) {
    this.effective = resolveLaserDmxInitialAutoQuality(capabilities)
  }

  updateCapabilities(capabilities: LaserDmxAdaptiveQualityCapabilities): void {
    this.capabilities = capabilities
    const safeMaximum = resolveLaserDmxInitialAutoQuality(capabilities)
    this.effective = lowerOf(this.effective, safeMaximum)
  }

  resolve(
    requested: LaserDmxShowDirectorWebGLQuality,
    requestedAtmosphere: LaserDmxShowDirectorWebGLQuality,
  ): LaserDmxAdaptiveQualitySnapshot {
    const effective = requested === 'auto' ? this.effective : requested
    const effectiveAtmosphere = requestedAtmosphere === 'auto'
      ? resolveLaserDmxAutoAtmosphereQuality(effective)
      : requestedAtmosphere
    return {
      requested,
      effective,
      effectiveAtmosphere,
      averageFrameMs: this.averageFrameMs,
      sampleCount: this.sampleCount,
      downshiftCount: this.downshiftCount,
      upshiftCount: this.upshiftCount,
      lastChangeReason: requested === 'auto' ? this.lastChangeReason : 'explicit',
    }
  }

  sample(frameMs: number, nowMs: number, requested: LaserDmxShowDirectorWebGLQuality): void {
    if (requested !== 'auto' || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return
    this.averageFrameMs = this.averageFrameMs == null
      ? frameMs
      : this.averageFrameMs * 0.88 + frameMs * 0.12
    this.sampleCount += 1
    if (this.sampleCount < MIN_SAMPLES || nowMs - this.lastEvaluationMs < MIN_EVALUATION_INTERVAL_MS) return
    this.lastEvaluationMs = nowMs

    const average = this.averageFrameMs
    if (average > slowFrameThreshold(this.effective)) {
      this.slowWindows += 1
      this.headroomWindows = 0
    } else if (average < headroomThreshold(this.effective)) {
      this.headroomWindows += 1
      this.slowWindows = 0
    } else {
      this.slowWindows = 0
      this.headroomWindows = 0
    }

    if (
      this.slowWindows >= 2
      && this.effective !== 'low'
      && nowMs - this.lastChangeMs >= DOWNSHIFT_COOLDOWN_MS
    ) {
      this.effective = stepQuality(this.effective, -1)
      this.downshiftCount += 1
      this.lastChangeReason = 'slow-frame'
      this.lastChangeMs = nowMs
      this.slowWindows = 0
      this.headroomWindows = 0
      return
    }

    const capabilityMaximum = resolveLaserDmxInitialAutoQuality(this.capabilities)
    if (
      this.headroomWindows >= 4
      && qualityIndex(this.effective) < qualityIndex(capabilityMaximum)
      && nowMs - this.lastChangeMs >= UPSHIFT_COOLDOWN_MS
    ) {
      this.effective = stepQuality(this.effective, 1)
      this.upshiftCount += 1
      this.lastChangeReason = 'stable-headroom'
      this.lastChangeMs = nowMs
      this.slowWindows = 0
      this.headroomWindows = 0
    }
  }

  emergencyDownshift(nowMs: number): boolean {
    if (this.effective === 'low') return false
    this.effective = stepQuality(this.effective, -1)
    this.downshiftCount += 1
    this.lastChangeReason = 'allocation-pressure'
    this.lastChangeMs = nowMs
    this.slowWindows = 0
    this.headroomWindows = 0
    return true
  }

  resetTimings(): void {
    this.averageFrameMs = null
    this.sampleCount = 0
    this.lastEvaluationMs = Number.NEGATIVE_INFINITY
    this.slowWindows = 0
    this.headroomWindows = 0
  }
}

export function applyLaserDmxAdaptiveQualityToFrame(
  frame: LaserDmxSceneFrame,
  snapshot: LaserDmxAdaptiveQualitySnapshot,
): LaserDmxSceneFrame {
  if (
    frame.quality.qualityTier === snapshot.effective
    && frame.atmosphere.qualityTier === snapshot.effectiveAtmosphere
  ) return frame
  return {
    ...frame,
    atmosphere: {
      ...frame.atmosphere,
      qualityTier: snapshot.effectiveAtmosphere,
    },
    quality: {
      ...frame.quality,
      qualityTier: snapshot.effective,
    },
  }
}
