import type { LaserDmxWorkspaceMode, ReactEngineId } from './ReactTypes'

export type ReactFxMasterControl =
  | 'intensity'
  | 'motion'
  | 'glow'
  | 'bassReactivity'

/**
 * Returns only the React-wide master controls consumed by the active renderer.
 * LaserDMX intentionally uses a narrower contract than the other engines:
 * Beam Matrix consumes intensity + glow, while Spatial Fixtures consumes glow.
 */
export function getReactFxMasterControls(
  engineId: ReactEngineId,
  laserWorkspaceMode: LaserDmxWorkspaceMode,
): ReactFxMasterControl[] {
  if (engineId !== 'laserDmx') {
    return ['intensity', 'motion', 'glow', 'bassReactivity']
  }

  return laserWorkspaceMode === 'beamMatrix'
    ? ['intensity', 'glow']
    : ['glow']
}
