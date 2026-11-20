export const CINEMA2_USER_MODEL_PREVIEWS = {
  form: ['Frontispiece', 'Three Quarter', 'Suspended', 'Rocking Plinth', 'Breathing Form', 'Slow Turn'],
  shatter: ['Radial Burst', 'Twin Banks', 'Crown Lift', 'Pinwheel Debris', 'Ripple Break', 'Rejoined Clusters'],
  dust: ['Surface Cloud', 'Rising Drift', 'Halo Orbit', 'Twin Plumes', 'Wave Gather', 'Compressed Mist'],
  hologram: ['Wire Signal', 'Scan Sweep', 'Double Echo', 'Tilted Projection', 'Signal Pulse', 'Cross Scan'],
  slices: ['Layer Stack', 'Stair Step', 'Fan Sections', 'Alternating Bands', 'Ribbon Wave', 'Collapsed Layers'],
  voxel: ['Surface Blocks', 'Column Lift', 'Checker Split', 'Orbital Blocks', 'Wave Grid', 'Compact Blocks'],
} as const
export type Cinema2UserModelPreviewKind = keyof typeof CINEMA2_USER_MODEL_PREVIEWS
export const CINEMA2_USER_MODEL_PROXY_LIMITS = {
  low: { shatter: 24, dust: 1024, slices: 14, voxel: 20000 },
  medium: { shatter: 24, dust: 4096, slices: 14, voxel: 20000 },
  high: { shatter: 24, dust: 16384, slices: 14, voxel: 20000 },
} as const
export function isCinema2UserModelPreview(value: unknown): value is Cinema2UserModelPreviewKind {
  return typeof value === 'string' && Object.hasOwn(CINEMA2_USER_MODEL_PREVIEWS, value)
}

/** These report a usable model with a bounded effect or open-surface limitation, not a missing asset. */
export function isCinema2UserModelPreparationDiagnostic(code: string): boolean {
  return /^CINEMA2_USER_MODEL_(SLICES|SHATTER|HOLOGRAM|VOXEL)_/.test(code)
}
