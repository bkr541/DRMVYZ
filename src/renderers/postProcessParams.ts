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
