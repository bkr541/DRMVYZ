import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2SayItGlyphPose } from './Cinema2SayItMotion'

export interface Cinema2SayItQualityProfile {
  quality: Cinema2RenderQualityLevel
  maxVisibleGlyphs: number
  castShadows: boolean
  environmentIntensityScale: number
  roughnessFloor: number
  frameBudgetMs: number
  gpuBudgetBytes: number
}

export const CINEMA2_SAY_IT_QUALITY_PROFILES: Readonly<Record<Cinema2RenderQualityLevel, Readonly<Cinema2SayItQualityProfile>>> = Object.freeze({
  low: Object.freeze({
    quality: 'low', maxVisibleGlyphs: 12, castShadows: false,
    environmentIntensityScale: 0.72, roughnessFloor: 0.24,
    frameBudgetMs: 6, gpuBudgetBytes: 8 * 1024 * 1024,
  }),
  medium: Object.freeze({
    quality: 'medium', maxVisibleGlyphs: 16, castShadows: false,
    environmentIntensityScale: 0.9, roughnessFloor: 0.12,
    frameBudgetMs: 9, gpuBudgetBytes: 12 * 1024 * 1024,
  }),
  high: Object.freeze({
    quality: 'high', maxVisibleGlyphs: 20, castShadows: true,
    environmentIntensityScale: 1, roughnessFloor: 0.04,
    frameBudgetMs: 12, gpuBudgetBytes: 16 * 1024 * 1024,
  }),
})

export const CINEMA2_SAY_IT_CAMERA_FOV_DEGREES = 34
export const CINEMA2_SAY_IT_CAMERA_DISTANCE = 7
export const CINEMA2_SAY_IT_COMPOSED_MIN_ASPECT = 1.6

export interface Cinema2SayItVisualBaseline {
  id: 'assembled' | 'maximum-separation' | 'edge-on-rotation'
  cyclePhase: number
  description: string
}

/** Stable capture checkpoints used by visual regression tooling. */
export const CINEMA2_SAY_IT_VISUAL_BASELINES: readonly Readonly<Cinema2SayItVisualBaseline>[] = Object.freeze([
  Object.freeze({ id: 'assembled', cyclePhase: 0, description: 'Exact assembled chrome text before release.' }),
  Object.freeze({ id: 'maximum-separation', cyclePhase: 0.5, description: 'Maximum readable spatial separation.' }),
  Object.freeze({ id: 'edge-on-rotation', cyclePhase: 0.42, description: 'Thin edge-on glyph silhouettes during full rotation.' }),
])

export const CINEMA2_SAY_IT_BASELINE_VIEWPORTS = Object.freeze([
  Object.freeze({ id: 'wide', width: 1600, height: 900 }),
  Object.freeze({ id: 'square', width: 1000, height: 1000 }),
  Object.freeze({ id: 'portrait', width: 900, height: 1600 }),
] as const)

export function resolveCinema2SayItQualityProfile(quality: Cinema2RenderQualityLevel): Readonly<Cinema2SayItQualityProfile> {
  return CINEMA2_SAY_IT_QUALITY_PROFILES[quality]
}

export function limitCinema2SayItPosesForQuality(
  poses: readonly Readonly<Cinema2SayItGlyphPose>[],
  profile: Readonly<Cinema2SayItQualityProfile>,
): readonly Readonly<Cinema2SayItGlyphPose>[] {
  if (poses.length <= profile.maxVisibleGlyphs) return poses
  return Object.freeze(poses.slice(0, profile.maxVisibleGlyphs))
}
