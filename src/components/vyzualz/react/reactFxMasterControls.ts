import type { ReactEngineId } from './ReactTypes'

export type ReactFxMasterControl =
  | 'intensity'
  | 'motion'
  | 'glow'
  | 'bassReactivity'

/**
 * Returns only the React-wide master controls consumed by the active renderer.
 * LaserDMX is Beam Matrix-only, so it consumes intensity + glow from React-wide
 * controls while matrix-specific output, fog, and editor state live below.
 */
export function getReactFxMasterControls(
  engineId: ReactEngineId,
): ReactFxMasterControl[] {
  if (engineId === 'canvas') return []
  if (engineId === 'laserDmx') return ['intensity', 'glow']
  return ['intensity', 'motion', 'glow', 'bassReactivity']
}
