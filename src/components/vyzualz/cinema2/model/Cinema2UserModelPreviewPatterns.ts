import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_USER_MODEL_PREVIEWS = {
  form: ['Frontispiece', 'Three Quarter', 'Suspended', 'Rocking Plinth', 'Breathing Form', 'Slow Turn'],
  shatter: ['Radial Burst', 'Twin Banks', 'Crown Lift', 'Pinwheel Debris', 'Ripple Break', 'Rejoined Clusters'],
  dust: ['Surface Cloud', 'Rising Drift', 'Halo Orbit', 'Twin Plumes', 'Wave Gather', 'Compressed Mist'],
  hologram: ['Wire Signal', 'Scan Sweep', 'Double Echo', 'Tilted Projection', 'Signal Pulse', 'Cross Scan'],
  slices: ['Layer Stack', 'Stair Step', 'Fan Sections', 'Alternating Bands', 'Ribbon Wave', 'Collapsed Layers'],
  voxel: ['Surface Blocks', 'Column Lift', 'Checker Split', 'Orbital Blocks', 'Wave Grid', 'Compact Blocks'],
} as const
export type Cinema2UserModelPreviewKind = keyof typeof CINEMA2_USER_MODEL_PREVIEWS
/** Only these model effects are shipped as selectable previews. Form and Voxel remain internal algorithms. */
export const CINEMA2_SELECTABLE_USER_MODEL_PREVIEWS = ['shatter', 'dust', 'hologram', 'slices'] as const
export const cinema2RepresentationPatternProperty = (mode: Cinema2UserModelPreviewKind) => `patternFor${mode[0].toUpperCase()}${mode.slice(1)}`
export const CINEMA2_USER_MODEL_PROXY_LIMITS = {
  low: { shatter: 48, dust: 4096, slices: 14, voxel: 30000 },
  medium: { shatter: 96, dust: 16384, slices: 24, voxel: 30000 },
  high: { shatter: 192, dust: 32768, slices: 24, voxel: 30000 },
} as const
export function isCinema2UserModelPreview(value: unknown): value is Cinema2UserModelPreviewKind {
  return typeof value === 'string' && Object.hasOwn(CINEMA2_USER_MODEL_PREVIEWS, value)
}

/** These report a usable model with a bounded effect or open-surface limitation, not a missing asset. */
export function isCinema2UserModelPreparationDiagnostic(code: string): boolean {
  return /^CINEMA2_USER_MODEL_(FORM|DUST|SLICES|SHATTER|HOLOGRAM|VOXEL)_/.test(code)
}

/** Authored legacy values remain valid. Auto follows the live renderer tier, capped by source complexity. */
export function cinema2ResolveFractureDetail(value: unknown, quality: Cinema2RenderQualityLevel, triangles: number): number {
  const tier = CINEMA2_USER_MODEL_PROXY_LIMITS[quality].shatter
  const numeric = typeof value === 'string' && value !== 'auto' ? Number(value) : value === undefined ? 24 : typeof value === 'number' ? value : tier
  const requested = Number.isFinite(numeric) ? numeric : tier
  const complexity = triangles > 100_000 ? 24 : triangles > 40_000 ? 48 : triangles > 15_000 ? 96 : 192
  const max = Math.min(requested, tier, complexity)
  return [192, 96, 48, 24, 12, 4].find(detail => detail <= max) ?? 4
}
