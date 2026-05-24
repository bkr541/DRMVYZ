/**
 * Pure parameter-mapping utilities for the per-source color grade.
 *
 * Converts the UI-facing VzColorGrade (-100..100 / -180..180 ranges) into the
 * normalized uniform values consumed by COLOR_GRADE_FRAG, and into a CSS filter
 * string for the Canvas 2D fallback path.
 *
 * Isolated here (no DOM / WebGL dependency) so it can be unit tested directly.
 *
 * Conversion rules (matching the GLSL algorithm in COLOR_GRADE_FRAG):
 *   - brightness:  grade -100..100 → GPU additive offset -1..+1
 *                                  → CSS brightness(0%..200%)
 *   - contrast:    grade -100..100 → GPU contrast factor 0..2 (centered on 0.5)
 *                                  → CSS contrast(0%..200%)
 *   - saturation:  grade -100..100 → GPU mix factor 0..2 (0=grayscale, 1=orig)
 *                                  → CSS saturate(0%..200%)
 *   - hueRotation: grade -180..180 → GPU radians
 *                                  → CSS hue-rotate(Xdeg)
 *   - temperature: grade -100..100 → GPU offset -1..+1 (GPU-only; warm=R+,B-)
 *   - tint:        grade -100..100 → GPU offset -1..+1 (GPU-only; +=magenta,-=green)
 */

import type { VzColorGrade } from '../types/vzColorGrade'
import { DEFAULT_COLOR_GRADE } from '../types/vzColorGrade'

/** Normalized uniform values consumed by COLOR_GRADE_FRAG. */
export interface GpuColorGradeParams {
  /** Whether the grade pass should run at all. */
  enabled: boolean
  /** Additive luminance offset, -1..+1. */
  brightness: number
  /** Contrast multiplier centered on 0.5, 0..2. */
  contrast: number
  /** Saturation mix factor: 0=grayscale, 1=original, 2=double. */
  saturation: number
  /** Hue rotation in radians. */
  hueRotation: number
  /** Temperature offset -1..+1 (warm positive). GPU-only. */
  temperature: number
  /** Tint offset -1..+1 (magenta positive, green negative). GPU-only. */
  tint: number
}

/** A neutral (no-op) GPU param set: the grade pass can be skipped. */
export const NEUTRAL_GPU_COLOR_GRADE: GpuColorGradeParams = {
  enabled: false,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hueRotation: 0,
  temperature: 0,
  tint: 0,
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * Derive normalized GPU uniforms from a VzColorGrade.
 *
 * @param grade  - The source grade. Undefined → uses DEFAULT_COLOR_GRADE (neutral).
 * @param bypass - When true (Before/After preview), returns the neutral no-op set.
 */
export function deriveColorGradeParams(
  grade?: VzColorGrade,
  bypass?: boolean,
): GpuColorGradeParams {
  if (bypass) return { ...NEUTRAL_GPU_COLOR_GRADE }
  const g = grade ?? DEFAULT_COLOR_GRADE
  if (!g.enabled) return { ...NEUTRAL_GPU_COLOR_GRADE }

  const brightness  = clamp(g.brightness, -100, 100) / 100              // -1..+1
  const contrast    = 1 + clamp(g.contrast, -100, 100) / 100            // 0..2
  const saturation  = 1 + clamp(g.saturation, -100, 100) / 100         // 0..2
  const hueRotation = (clamp(g.hueRotation, -180, 180) * Math.PI) / 180 // radians
  const temperature = clamp(g.temperature, -100, 100) / 100             // -1..+1
  const tint        = clamp(g.tint, -100, 100) / 100                    // -1..+1

  return {
    enabled: true,
    brightness,
    contrast,
    saturation,
    hueRotation,
    temperature,
    tint,
  }
}

/**
 * Returns true when the derived params produce a visible change.
 * A grade that is disabled, bypassed, or exactly neutral returns false so the
 * renderer can skip the grade pass entirely.
 */
export function isColorGradeActive(params: GpuColorGradeParams): boolean {
  if (!params.enabled) return false
  return (
    params.brightness !== 0 ||
    params.contrast !== 1 ||
    params.saturation !== 1 ||
    params.hueRotation !== 0 ||
    params.temperature !== 0 ||
    params.tint !== 0
  )
}

/**
 * Build a CSS filter string for the Canvas 2D fallback path.
 *
 * Only brightness / contrast / saturate / hue-rotate are representable via
 * ctx.filter — temperature and tint are GPU-only and intentionally omitted
 * (the UI shows a "GPU" badge for those in Canvas mode).
 *
 * Returns 'none' for a disabled / neutral grade so callers can short-circuit.
 *
 * @param grade  - The source grade. Undefined → neutral → 'none'.
 * @param bypass - When true, returns 'none' (Before/After preview).
 */
export function buildCanvasColorGradeFilter(
  grade?: VzColorGrade,
  bypass?: boolean,
): string {
  if (bypass) return 'none'
  const g = grade ?? DEFAULT_COLOR_GRADE
  if (!g.enabled) return 'none'

  const brightnessPct = 100 + clamp(g.brightness, -100, 100)   // 0..200
  const contrastPct   = 100 + clamp(g.contrast, -100, 100)     // 0..200
  const saturatePct   = 100 + clamp(g.saturation, -100, 100)   // 0..200
  const hueDeg        = clamp(g.hueRotation, -180, 180)

  const parts: string[] = []
  if (brightnessPct !== 100) parts.push(`brightness(${brightnessPct}%)`)
  if (contrastPct   !== 100) parts.push(`contrast(${contrastPct}%)`)
  if (saturatePct   !== 100) parts.push(`saturate(${saturatePct}%)`)
  if (hueDeg        !== 0)   parts.push(`hue-rotate(${hueDeg}deg)`)

  return parts.length > 0 ? parts.join(' ') : 'none'
}
