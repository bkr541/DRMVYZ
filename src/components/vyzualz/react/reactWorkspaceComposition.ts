import type { ReactEngineId } from './ReactTypes'

export type ReactLeftTab = 'workspace' | 'media' | 'layers' | 'fonts'
export type ReactLowerSurface = 'trackMap' | 'soundDrawing' | 'performancePads'
export type ReactWorkspaceTabLabel = 'SETUP' | 'SOURCE' | 'RIG' | 'LAYOUT'

const REACT_LOWER_SURFACE_LABELS: Record<ReactLowerSurface, string> = {
  trackMap: 'Track Map',
  soundDrawing: 'Sound Drawing',
  performancePads: 'Performance Pads',
}

export interface ReactWorkspaceComposition {
  showPerformancePads: boolean
  showSoundDrawingTimeline: boolean
  showTrackMap: boolean
  showLaserBeamEditor: boolean
  showLaserLayersTab: boolean
  leftTabs: ReactLeftTab[]
  workspaceTabLabel: ReactWorkspaceTabLabel
}

/**
 * Centralizes engine-to-workspace composition so ReactView does not mount tools
 * outside the engine families that can actually use them.
 */
export function resolveReactWorkspaceComposition(
  engineId: ReactEngineId,
  laserWorkspaceMode: unknown,
  beamEditorVisible: boolean,
): ReactWorkspaceComposition {
  const isSoundDrawing = engineId === 'oscilloscope'
  const isCinematic = engineId === 'cinematicPortal'
  const isCinema2 = engineId === 'cinema2'
  const isLaser = engineId === 'laserDmx'
  const isCanvas = engineId === 'canvas'
  const isPixGrid = engineId === 'pixGrid'
  const isHeadliner = engineId === 'headliner'
  void laserWorkspaceMode

  let leftTabs: ReactLeftTab[] = ['workspace']
  let workspaceTabLabel: ReactWorkspaceTabLabel = 'SETUP'

  if (isHeadliner) {
    // Headliner owns a minimal setup workspace; the lower workspace (Track Map and
    // performance pads) is shared with every other engine.
    leftTabs = ['workspace']
  } else if (isCinema2) {
    leftTabs = ['workspace', 'layers']
    workspaceTabLabel = 'SOURCE'
  } else if (isCinematic) {
    // Cinematic Worlds chooses its World in the left source rail while preset
    // cards remain in the right rail. It does not consume generic media.
    leftTabs = ['workspace']
    workspaceTabLabel = 'SOURCE'
  } else if (isSoundDrawing) {
    leftTabs = ['workspace', 'media', 'fonts']
    workspaceTabLabel = 'SOURCE'
  } else if (isLaser) {
    leftTabs = ['workspace', 'layers']
    workspaceTabLabel = 'RIG'
  } else if (isCanvas) {
    leftTabs = ['workspace', 'layers']
    workspaceTabLabel = 'SOURCE'
  } else if (isPixGrid) {
    leftTabs = ['workspace', 'media']
    workspaceTabLabel = 'SETUP'
  }

  return {
    // Performance pads are the live set list for the whole performance: every pad can switch to a
    // preset on any engine, so they stay mounted (and their keys armed) whichever engine is loaded,
    // including Cinema 2.0 and Headliner.
    showPerformancePads: true,
    showSoundDrawingTimeline: isSoundDrawing,
    // Track sections and transport context are shared by every React engine. ReactView resolves the
    // loaded track's audio-intelligence sections once, whichever engine is active, and feeds them to
    // the Track Map, the active renderer (Headliner included) and the music-intelligence engine.
    showTrackMap: true,
    showLaserBeamEditor: isLaser && beamEditorVisible,
    showLaserLayersTab: isLaser,
    leftTabs,
    workspaceTabLabel,
  }
}

export function getReactLeftTabs(
  composition: ReactWorkspaceComposition,
): ReactLeftTab[] {
  return composition.leftTabs
}

export function getReactLeftTabLabel(
  tab: ReactLeftTab,
  composition: ReactWorkspaceComposition,
): string {
  if (tab === 'workspace') return composition.workspaceTabLabel
  if (tab === 'media') return 'MEDIA'
  if (tab === 'layers') return 'LAYERS'
  return 'FONTS'
}

export function isReactLeftTabAvailable(
  tab: ReactLeftTab,
  composition: ReactWorkspaceComposition,
): boolean {
  return getReactLeftTabs(composition).includes(tab)
}

export function getReactDefaultLeftTab(
  composition: ReactWorkspaceComposition,
): ReactLeftTab {
  return composition.leftTabs[0] ?? 'workspace'
}

/**
 * Returns lower-workspace surfaces in their canonical left-to-right order.
 * Sound Drawing is intentionally a sibling of Track Map rather than a lane
 * nested inside it.
 */
export function getReactLowerSurfaces(
  composition: ReactWorkspaceComposition,
): ReactLowerSurface[] {
  const surfaces: ReactLowerSurface[] = []
  if (composition.showTrackMap) surfaces.push('trackMap')
  if (composition.showSoundDrawingTimeline) surfaces.push('soundDrawing')
  if (composition.showPerformancePads) surfaces.push('performancePads')
  return surfaces
}

export function getReactLowerSurfaceLabel(surface: ReactLowerSurface): string {
  return REACT_LOWER_SURFACE_LABELS[surface]
}

export function isReactLowerSurfaceAvailable(
  surface: ReactLowerSurface,
  composition: ReactWorkspaceComposition,
): boolean {
  return getReactLowerSurfaces(composition).includes(surface)
}
