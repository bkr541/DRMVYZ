/**
 * Pure parameter-mapping utility for the GPU post-process pass (grain + scanlines).
 *
 * Converts live-render state (enabled effects, modulated intensities, quality config)
 * into the three uniform values that WebGL2Renderer.renderFrame() expects for its
 * combined grain/scanlines stage.  Isolated here so callers can be tested without
 * a DOM or WebGL context.
 */

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
