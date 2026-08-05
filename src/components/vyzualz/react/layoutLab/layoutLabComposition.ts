import {
  getReactDefaultLeftTab,
  getReactLeftTabLabel,
  getReactLeftTabs,
  getReactLowerSurfaceLabel,
  getReactLowerSurfaces,
  resolveReactWorkspaceComposition,
  type ReactLeftTab,
  type ReactLowerSurface,
} from '../reactWorkspaceComposition'
import type { ReactEngineId } from '../ReactTypes'

export interface LayoutLabComposition {
  leftTabs: Array<{ id: ReactLeftTab; label: string }>
  defaultLeftTab: ReactLeftTab
  lowerSurfaces: Array<{ id: ReactLowerSurface; label: string }>
}

/**
 * Layout Lab consumes the production resolver through this pure adapter so its
 * shell cannot drift while still avoiding production stores and runtimes.
 */
export function resolveLayoutLabComposition(engineId: ReactEngineId): LayoutLabComposition {
  const composition = resolveReactWorkspaceComposition(engineId, null, false)
  return {
    leftTabs: getReactLeftTabs(composition).map(id => ({
      id,
      label: getReactLeftTabLabel(id, composition),
    })),
    defaultLeftTab: getReactDefaultLeftTab(composition),
    lowerSurfaces: getReactLowerSurfaces(composition).map(id => ({
      id,
      label: getReactLowerSurfaceLabel(id),
    })),
  }
}
