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
  low: { shatter: 24, dust: 256, slices: 6, voxel: 64 },
  medium: { shatter: 48, dust: 768, slices: 10, voxel: 160 },
  high: { shatter: 96, dust: 1536, slices: 14, voxel: 320 },
} as const
export function isCinema2UserModelPreview(value: unknown): value is Cinema2UserModelPreviewKind {
  return typeof value === 'string' && Object.hasOwn(CINEMA2_USER_MODEL_PREVIEWS, value)
}
