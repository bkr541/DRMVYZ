/**
 * Color grading model for the DRMVYZ video color grading system (Phase 1).
 *
 * A VzColorGrade is attached per-source (timeline media clip or layer item) and
 * applied BEFORE RGB Split / Bloom / Displacement in the render pipeline:
 *   - WebGL2 path: a dedicated COLOR_GRADE_FRAG pass.
 *   - Canvas 2D path: a CSS ctx.filter string (brightness/contrast/saturate/hue
 *     only — temperature/tint are GPU-only).
 *
 * All scalar adjustment fields use a symmetric -100..100 range (0 = neutral)
 * except hueRotation which is -180..180 degrees. Many fields are reserved for
 * future phases and are not yet wired into the renderer.
 */

/** Reserved — selective color replacement (Phase 2+). */
export interface VzColorReplace {
  /** Target colour to replace (hex string, e.g. '#ff0000'). */
  targetColor: string
  /** Replacement colour (hex string). */
  replacement: string
  /** Hue/colour match tolerance 0..1. */
  tolerance: number
  /** Edge softness 0..1. */
  softness: number
}

/** Reserved — chroma (green/blue screen) keying (Phase 2+). */
export interface VzChromaKey {
  /** Key colour (hex string). */
  keyColor: string
  /** Similarity threshold 0..1 — larger removes more. */
  similarity: number
  /** Edge smoothness 0..1. */
  smoothness: number
  /** Spill suppression 0..1. */
  spill: number
}

/** Reserved — luminance keying (Phase 2+). */
export interface VzLumaKey {
  /** Low luminance cutoff 0..1. */
  low: number
  /** High luminance cutoff 0..1. */
  high: number
  /** Whether the keyed region is the dark or bright end. */
  invert: boolean
}

export interface VzColorGrade {
  /** Master on/off for the whole grade. When false the grade is bypassed. */
  enabled: boolean
  brightness: number   // -100 to 100, default 0
  exposure: number     // -100 to 100, default 0 (future)
  contrast: number     // -100 to 100, default 0
  saturation: number   // -100 to 100, default 0
  vibrance: number     // -100 to 100, default 0 (future)
  temperature: number  // -100 to 100, default 0
  tint: number         // -100 to 100, default 0
  hueRotation: number  // -180 to 180 degrees, default 0
  highlights: number   // future
  shadows: number      // future
  whites: number       // future
  blacks: number       // future
  fade: number         // future
  vignette: number     // future
  replaceColor?: VzColorReplace
  chromaKey?: VzChromaKey
  lumaKey?: VzLumaKey
}

export const DEFAULT_COLOR_GRADE: VzColorGrade = {
  enabled: true,
  brightness: 0,
  exposure: 0,
  contrast: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  hueRotation: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  fade: 0,
  vignette: 0,
}
