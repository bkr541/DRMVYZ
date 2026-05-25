/**
 * Pure parameter-mapping utility for GPU post-process passes.
 *
 * Converts live-render state (enabled effects, modulated intensities, quality config)
 * into the uniform values that WebGL2Renderer.renderFrame() expects.
 * Isolated here so callers can be tested without a DOM or WebGL context.
 */

import type { VzEffectParams } from '../types/effectParams'
import {
  resolvePixelDistortionParams,
  resolveBloomEffectParams,
  resolveFeedbackEffectParams,
  resolveDisplacementEffectParams,
} from '../types/effectParams'

/** Minimum subset of effect intensities needed for the post-process pass. */
export interface PostProcessEffects {
  noiseFog:  number
  scanlines: number
}

/** Minimum subset of quality config needed for the post-process pass. */
export interface PostProcessQuality {
  scanlineStep: number
}

/** Uniform values consumed by the POST_PROCESS_FRAG shader. */
export interface PostProcessParams {
  /** 0..1 grain intensity forwarded to u_grainAmount.  0 = pass disabled for grain. */
  grainAmount: number
  /** 0..1 scanline darkness forwarded to u_scanAlpha.  0 = pass disabled for lines. */
  scanAlpha: number
  /** Pixel stride between darkened rows, forwarded to u_scanStep. */
  scanStep: number
}

/**
 * Derive post-process shader uniforms from current render state.
 *
 * @param fxSet    - Set of currently enabled effect chain names
 * @param mEff     - Modulated effect intensities for this frame
 * @param quality  - Quality snapshot (scanlineStep comes from here)
 */
export function derivePostProcessParams(
  fxSet:   ReadonlySet<string>,
  mEff:    PostProcessEffects,
  quality: PostProcessQuality,
): PostProcessParams {
  return {
    grainAmount: fxSet.has('Noise Fog') ? Math.max(0, mEff.noiseFog)  : 0,
    scanAlpha:   fxSet.has('Scanlines') ? Math.max(0, mEff.scanlines) : 0,
    scanStep:    quality.scanlineStep,
  }
}

/**
 * Returns true when the post-process pass should run (at least one effect active).
 * Used in LiveVisualCanvas to decide what to push into gpuEffects diagnostics.
 */
export function isPostProcessActive(p: PostProcessParams): boolean {
  return p.grainAmount > 0 || p.scanAlpha > 0
}

// ── GPU Displacement parameters ───────────────────────────────────────────────

/** Uniform values consumed by the DISPLACEMENT_FRAG shader. */
export interface DisplacementParams {
  /** Horizontal ghost offset in canvas pixels (pre-computed; may be negative). 0 = no x-shift. */
  dispOffXPx: number
  /** Vertical ghost offset in canvas pixels (pre-computed; may be negative). 0 = no y-shift. */
  dispOffYPx: number
  /** Ghost intensity 0..1. Ghost alpha = 0.35 × amount. 0 = pass is identity. */
  dispAmount: number
  /** Hue rotation for ghost in radians. 0 = no rotation. */
  dispHueRad: number
}

/**
 * Derive GPU displacement shader uniforms from current render state.
 *
 * Matches the Canvas 2D displacement path in LiveVisualCanvas:
 *   offX = sin(beatPhase × 2π  or  t × 0.002) × dispMod × 12
 *   offY = cos(beatPhase × 2π  or  t × 0.0017) × dispMod × 8
 *   hue  = (colorShift × 360 + 90)° when colorShift > 0, else 0
 *
 * Returns all-zero params (pass is identity) when the effect is inactive.
 */
export function deriveDisplacementParams(
  fxSet:            ReadonlySet<string>,
  dispMod:          number,
  synced:           boolean,
  beatPhase:        number,
  t:                number,
  activeColorShift: number,
): DisplacementParams {
  if (!fxSet.has('Displacement') || dispMod <= 0) {
    return { dispOffXPx: 0, dispOffYPx: 0, dispAmount: 0, dispHueRad: 0 }
  }
  const angleX = synced ? beatPhase * Math.PI * 2 : t * 0.002
  const angleY = synced ? beatPhase * Math.PI * 2 : t * 0.0017
  return {
    dispOffXPx: Math.sin(angleX) * dispMod * 12,
    dispOffYPx: Math.cos(angleY) * dispMod * 8,
    dispAmount: dispMod,
    dispHueRad: activeColorShift > 0 ? (activeColorShift * 2 * Math.PI + Math.PI / 2) : 0,
  }
}

// ── Pixel Distortion params ───────────────────────────────────────────────────

export interface PixelDistortionParams {
  pixelDistortAmount:      number
  pixelDistortPixelSize:   number
  pixelDistortPosterize:   number
  pixelDistortDither:      number
  pixelDistortCorruption:  number
  pixelDistortOverexposure: number
  pixelDistortEnergyTint:  number
  pixelDistortBeatPunch:   number
}

/**
 * Derive pixel distortion shader uniforms from current render state.
 * beatPunch is the beat audio value (0–1 burst at beat boundary).
 */
export function derivePixelDistortionParams(
  fxSet:        ReadonlySet<string>,
  mEff:         { pixelDistortion: number },
  effectParams: VzEffectParams,
  beatPunch:    number,
): PixelDistortionParams {
  if (!fxSet.has('Pixel Distortion') || mEff.pixelDistortion <= 0) {
    return { pixelDistortAmount: 0, pixelDistortPixelSize: 4, pixelDistortPosterize: 5, pixelDistortDither: 0.55, pixelDistortCorruption: 0.35, pixelDistortOverexposure: 0.45, pixelDistortEnergyTint: 0.65, pixelDistortBeatPunch: 0 }
  }
  const p = resolvePixelDistortionParams(effectParams)
  return {
    pixelDistortAmount:      Math.max(0, Math.min(1, mEff.pixelDistortion)),
    pixelDistortPixelSize:   p.pixelSize,
    pixelDistortPosterize:   p.posterizeLevels,
    pixelDistortDither:      p.ditherAmount,
    pixelDistortCorruption:  p.corruptionAmount,
    pixelDistortOverexposure: p.overexposure,
    pixelDistortEnergyTint:  p.energyTint,
    pixelDistortBeatPunch:   p.beatPunch * beatPunch,
  }
}

// ── Extended Bloom params ─────────────────────────────────────────────────────

export interface BloomGpuParams {
  bloomThreshold:    number
  bloomExposure:     number
  bloomTintR:        number
  bloomTintG:        number
  bloomTintB:        number
  bloomIntensityMul: number
}

export function deriveBloomGpuParams(effectParams: VzEffectParams): BloomGpuParams {
  const p = resolveBloomEffectParams(effectParams)
  return {
    bloomThreshold:    p.threshold,
    bloomExposure:     p.exposure,
    bloomTintR:        p.tintR,
    bloomTintG:        p.tintG,
    bloomTintB:        p.tintB,
    bloomIntensityMul: p.intensityMultiplier,
  }
}

// ── Feedback params ───────────────────────────────────────────────────────────

export interface FeedbackGpuParams {
  feedbackDecay:  number
  feedbackSmearX: number
  feedbackSmearY: number
  feedbackZoom:   number
}

export function deriveFeedbackParams(
  fxSet:        ReadonlySet<string>,
  feedbackMod:  number,
  effectParams: VzEffectParams,
): FeedbackGpuParams {
  if (!fxSet.has('Feedback') || feedbackMod <= 0) {
    return { feedbackDecay: 0, feedbackSmearX: 0, feedbackSmearY: 0, feedbackZoom: 1 }
  }
  const p = resolveFeedbackEffectParams(effectParams)
  return {
    feedbackDecay:  p.decay,
    feedbackSmearX: p.smearX,
    feedbackSmearY: p.smearY,
    feedbackZoom:   p.zoom,
  }
}

// ── Noise warp displacement params ────────────────────────────────────────────

export interface NoiseWarpGpuParams {
  noiseWarpAmount:      number
  noiseWarpScale:       number
  noiseWarpSpeed:       number
  noiseWarpHBias:       number
  noiseWarpRetainGhost: boolean
}

export function deriveNoiseWarpParams(
  fxSet:        ReadonlySet<string>,
  dispMod:      number,
  effectParams: VzEffectParams,
): NoiseWarpGpuParams {
  if (!fxSet.has('Displacement') || dispMod <= 0) {
    return { noiseWarpAmount: 0, noiseWarpScale: 2, noiseWarpSpeed: 0.2, noiseWarpHBias: 1, noiseWarpRetainGhost: true }
  }
  const p = resolveDisplacementEffectParams(effectParams)
  // Only route through noise warp when noiseAmount > 0; else fallback to legacy ghost-copy
  if (p.noiseAmount <= 0) {
    return { noiseWarpAmount: 0, noiseWarpScale: p.noiseScale, noiseWarpSpeed: p.warpSpeed, noiseWarpHBias: p.horizontalBias, noiseWarpRetainGhost: p.retainGhostLayer }
  }
  return {
    noiseWarpAmount:      Math.min(dispMod, 1) * p.noiseAmount,
    noiseWarpScale:       p.noiseScale,
    noiseWarpSpeed:       p.warpSpeed,
    noiseWarpHBias:       p.horizontalBias,
    noiseWarpRetainGhost: p.retainGhostLayer,
  }
}
