import type { LaserDmxShowDirectorWebGLQuality } from '../../ReactTypes'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'

export type LaserDmxHdrTargetFormat = 'rgba16f' | 'rgba8'
export type LaserDmxToneMappingCurve = 'aces-fitted'

export interface LaserDmxWebGLPostCapabilityProbe {
  webgl2: boolean
  colorBufferFloat: boolean
  rgba16fRenderable: boolean
  floatLinearFiltering: boolean
}

export interface LaserDmxHdrTargetStrategy {
  hdrEnabled: boolean
  targetFormat: LaserDmxHdrTargetFormat
  linearFiltering: boolean
  maximumSceneValue: number
  diagnosticCode: 'hdr-rgba16f' | 'ldr-rgba8-fallback'
}

export interface LaserDmxBloomQualitySettings {
  levelCount: number
  baseScale: number
  threshold: number
  softKnee: number
  strength: number
  radius: number
  levelWeights: readonly [number, number, number, number]
}

export interface LaserDmxOpticalPostSettings {
  glareThreshold: number
  glareStrength: number
  glareStreakPx: number
  glareStarStrength: number
  chromaticThreshold: number
  chromaticAmountPx: number
  spectralEdgeStrength: number
}

export interface LaserDmxToneMappingSettings {
  curve: LaserDmxToneMappingCurve
  exposure: number
  whitePoint: number
  saturation: number
  highlightDesaturation: number
  blackClip: number
  gamma: number
}

export interface LaserDmxExposureResponse {
  baseExposure: number
  targetExposure: number
  targetWashout: number
  minimumExposure: number
  maximumExposure: number
  attackSec: number
  releaseSec: number
  strobeStrength: number
  blinderStrength: number
}

export interface LaserDmxExposureState {
  exposure: number
  washout: number
}

export interface LaserDmxWebGLPostProcessPlan {
  quality: Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'>
  targetStrategy: LaserDmxHdrTargetStrategy
  bloom: LaserDmxBloomQualitySettings
  optics: LaserDmxOpticalPostSettings
  toneMapping: LaserDmxToneMappingSettings
  washout: number
  strobeStrength: number
  blinderStrength: number
  degraded: boolean
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))

const clamp01 = (value: number): number => clamp(value, 0, 1)

const QUALITY_POLICIES: Readonly<Record<Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'>, {
  levelCount: number
  baseScale: number
  strength: number
  radius: number
  levelWeights: readonly [number, number, number, number]
  glareStrength: number
  glareStreakPx: number
  glareStarStrength: number
  chromaticAmountPx: number
  spectralEdgeStrength: number
}>> = Object.freeze({
  low: Object.freeze({
    levelCount: 1,
    baseScale: 0.34,
    strength: 0.34,
    radius: 0.72,
    levelWeights: Object.freeze([1, 0, 0, 0] as const),
    glareStrength: 0.025,
    glareStreakPx: 1.25,
    glareStarStrength: 0,
    chromaticAmountPx: 0,
    spectralEdgeStrength: 0,
  }),
  medium: Object.freeze({
    levelCount: 2,
    baseScale: 0.46,
    strength: 0.48,
    radius: 0.9,
    levelWeights: Object.freeze([0.72, 0.28, 0, 0] as const),
    glareStrength: 0.08,
    glareStreakPx: 2.1,
    glareStarStrength: 0.025,
    chromaticAmountPx: 0,
    spectralEdgeStrength: 0,
  }),
  high: Object.freeze({
    levelCount: 3,
    baseScale: 0.52,
    strength: 0.62,
    radius: 1.05,
    levelWeights: Object.freeze([0.58, 0.29, 0.13, 0] as const),
    glareStrength: 0.14,
    glareStreakPx: 3.1,
    glareStarStrength: 0.055,
    chromaticAmountPx: 0.42,
    spectralEdgeStrength: 0.035,
  }),
  ultra: Object.freeze({
    levelCount: 4,
    baseScale: 0.58,
    strength: 0.7,
    radius: 1.18,
    levelWeights: Object.freeze([0.5, 0.27, 0.15, 0.08] as const),
    glareStrength: 0.18,
    glareStreakPx: 4,
    glareStarStrength: 0.08,
    chromaticAmountPx: 0.62,
    spectralEdgeStrength: 0.05,
  }),
})

export function resolveLaserDmxHdrTargetStrategy(
  probe: LaserDmxWebGLPostCapabilityProbe,
): LaserDmxHdrTargetStrategy {
  const hdrEnabled = probe.webgl2 && probe.colorBufferFloat && probe.rgba16fRenderable
  return hdrEnabled
    ? {
        hdrEnabled: true,
        targetFormat: 'rgba16f',
        linearFiltering: probe.floatLinearFiltering,
        maximumSceneValue: 16,
        diagnosticCode: 'hdr-rgba16f',
      }
    : {
        hdrEnabled: false,
        targetFormat: 'rgba8',
        linearFiltering: true,
        maximumSceneValue: 1,
        diagnosticCode: 'ldr-rgba8-fallback',
      }
}

/**
 * Performs one tiny framebuffer probe. The runtime retains only the resulting
 * capability record, not the temporary texture or framebuffer.
 */
export function probeLaserDmxWebGLPostCapabilities(
  gl: WebGL2RenderingContext,
): LaserDmxWebGLPostCapabilityProbe {
  const colorBufferFloat = gl.getExtension('EXT_color_buffer_float') != null
  const floatLinearFiltering = gl.getExtension('OES_texture_float_linear') != null
  let rgba16fRenderable = false
  const texture = gl.createTexture()
  const framebuffer = gl.createFramebuffer()
  try {
    if (colorBufferFloat && texture && framebuffer && !gl.isContextLost()) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, 2, 2, 0, gl.RGBA, gl.HALF_FLOAT, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
      rgba16fRenderable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }
  } catch {
    rgba16fRenderable = false
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (framebuffer) gl.deleteFramebuffer(framebuffer)
    if (texture) gl.deleteTexture(texture)
  }
  return {
    webgl2: true,
    colorBufferFloat,
    rgba16fRenderable,
    floatLinearFiltering,
  }
}

export function resolveLaserDmxPostQuality(
  requested: LaserDmxShowDirectorWebGLQuality,
  renderScale: number,
  devicePixelRatio: number,
): Exclude<LaserDmxShowDirectorWebGLQuality, 'auto'> {
  if (requested !== 'auto') return requested
  const pixelPressure = clamp(renderScale, 0.25, 1) * clamp(devicePixelRatio, 0.5, 4)
  if (pixelPressure >= 2.4) return 'medium'
  if (pixelPressure >= 1.45) return 'high'
  return 'ultra'
}

function activeFixtureStrength(frame: LaserDmxSceneFrame, kind: 'strobe' | 'blinder'): number {
  return frame.fixtures.reduce(
    (maximum, fixture) => fixture.kind === kind && fixture.enabled
      ? Math.max(maximum, clamp01(fixture.intensity))
      : maximum,
    0,
  )
}

function transientStrength(frame: LaserDmxSceneFrame, kind: 'strobe' | 'blinder'): number {
  return frame.transientEvents.reduce(
    (maximum, event) => event.kind === kind ? Math.max(maximum, clamp01(event.strength)) : maximum,
    0,
  )
}

export function resolveLaserDmxExposureResponse(frame: LaserDmxSceneFrame): LaserDmxExposureResponse {
  const energy = clamp01(frame.musicalState.energy)
  const globalGlow = clamp01(frame.output.globalGlow)
  const strobeStrength = transientStrength(frame, 'strobe')
  const blinderStrength = Math.max(
    activeFixtureStrength(frame, 'blinder'),
    transientStrength(frame, 'blinder'),
  )
  const baseExposure = clamp(0.92 + energy * 0.14 + globalGlow * 0.08, 0.78, 1.18)
  const flashLift = strobeStrength * 0.34 + blinderStrength * 0.62
  const blackout = frame.output.blackout || frame.transientEvents.some(event => event.kind === 'blackout')
  return {
    baseExposure,
    targetExposure: blackout ? baseExposure : clamp(baseExposure + flashLift, 0.72, 1.9),
    targetWashout: blackout ? 0 : clamp(strobeStrength * 0.24 + blinderStrength * 0.68, 0, 0.84),
    minimumExposure: 0.72,
    maximumExposure: 1.9,
    attackSec: blinderStrength > 0.02 || strobeStrength > 0.02 ? 0.018 : 0.12,
    releaseSec: blackout ? 0.055 : 0.38 + blinderStrength * 0.24,
    strobeStrength,
    blinderStrength,
  }
}

function approach(current: number, target: number, deltaTimeSec: number, timeConstantSec: number): number {
  if (timeConstantSec <= 0.0001) return target
  const t = 1 - Math.exp(-Math.max(0, deltaTimeSec) / timeConstantSec)
  return current + (target - current) * clamp01(t)
}

export function updateLaserDmxExposureState(
  previous: LaserDmxExposureState,
  response: LaserDmxExposureResponse,
  deltaTimeSec: number,
  reset: boolean,
): LaserDmxExposureState {
  if (reset) {
    return {
      exposure: clamp(response.baseExposure, response.minimumExposure, response.maximumExposure),
      washout: 0,
    }
  }
  const exposureTime = response.targetExposure > previous.exposure
    ? response.attackSec
    : response.releaseSec
  const washoutTime = response.targetWashout > previous.washout
    ? Math.min(0.016, response.attackSec)
    : response.releaseSec
  return {
    exposure: clamp(
      approach(previous.exposure, response.targetExposure, deltaTimeSec, exposureTime),
      response.minimumExposure,
      response.maximumExposure,
    ),
    washout: clamp01(approach(previous.washout, response.targetWashout, deltaTimeSec, washoutTime)),
  }
}

export class LaserDmxExposureController {
  private state: LaserDmxExposureState = { exposure: 1, washout: 0 }

  get snapshot(): LaserDmxExposureState {
    return { ...this.state }
  }

  update(frame: LaserDmxSceneFrame): { state: LaserDmxExposureState; response: LaserDmxExposureResponse } {
    const response = resolveLaserDmxExposureResponse(frame)
    this.state = updateLaserDmxExposureState(
      this.state,
      response,
      frame.deltaTime,
      frame.transport.timingDiscontinuity,
    )
    return { state: this.snapshot, response }
  }

  reset(exposure = 1): void {
    this.state = { exposure: clamp(exposure, 0.72, 1.9), washout: 0 }
  }
}

export function resolveLaserDmxWebGLPostProcessPlan(
  frame: LaserDmxSceneFrame,
  targetStrategy: LaserDmxHdrTargetStrategy,
  exposureState: LaserDmxExposureState,
  response = resolveLaserDmxExposureResponse(frame),
): LaserDmxWebGLPostProcessPlan {
  const quality = resolveLaserDmxPostQuality(
    frame.quality.qualityTier,
    frame.quality.renderScale,
    frame.quality.devicePixelRatio,
  )
  const policy = QUALITY_POLICIES[quality]
  const energy = clamp01(frame.musicalState.energy)
  const flash = Math.max(response.strobeStrength, response.blinderStrength)
  const editAttenuation = frame.presentationMode === 'edit' ? 0.18 : 1
  const hdrThreshold = targetStrategy.hdrEnabled ? 1.02 : 0.72
  const glareThreshold = targetStrategy.hdrEnabled ? 2.05 : 0.93
  const chromaticThreshold = targetStrategy.hdrEnabled ? 2.45 : 0.96
  const bloomStrength = clamp(
    policy.strength * (0.78 + energy * 0.36 + flash * 0.34) * (0.72 + frame.output.globalGlow * 0.38),
    0,
    1.2,
  )
  const opticalFlash = clamp01(Math.max(flash, Math.max(0, exposureState.exposure - 1) * 0.9))
  const glareStrength = clamp(
    policy.glareStrength * (0.55 + energy * 0.35 + opticalFlash * 1.25) * editAttenuation,
    0,
    0.42,
  )
  const chromaticAmountPx = clamp(
    policy.chromaticAmountPx * (0.3 + opticalFlash * 0.9) * editAttenuation,
    0,
    0.85,
  )

  return {
    quality,
    targetStrategy,
    bloom: {
      levelCount: policy.levelCount,
      baseScale: policy.baseScale,
      threshold: hdrThreshold,
      softKnee: targetStrategy.hdrEnabled ? 0.58 : 0.18,
      strength: bloomStrength,
      radius: clamp(policy.radius * (0.88 + energy * 0.18), 0.55, 1.45),
      levelWeights: policy.levelWeights,
    },
    optics: {
      glareThreshold,
      glareStrength,
      glareStreakPx: policy.glareStreakPx * (0.85 + opticalFlash * 0.4),
      glareStarStrength: policy.glareStarStrength * (0.5 + opticalFlash * 0.8) * editAttenuation,
      chromaticThreshold,
      chromaticAmountPx,
      spectralEdgeStrength: policy.spectralEdgeStrength * opticalFlash * editAttenuation,
    },
    toneMapping: {
      curve: 'aces-fitted',
      exposure: clamp(exposureState.exposure, response.minimumExposure, response.maximumExposure),
      whitePoint: targetStrategy.hdrEnabled ? 7.5 : 1.55,
      saturation: clamp(1.04 + energy * 0.04, 1, 1.1),
      highlightDesaturation: targetStrategy.hdrEnabled ? 0.18 : 0.08,
      blackClip: 0.0008,
      gamma: 2.2,
    },
    washout: clamp01(exposureState.washout),
    strobeStrength: response.strobeStrength,
    blinderStrength: response.blinderStrength,
    degraded: !targetStrategy.hdrEnabled,
  }
}
