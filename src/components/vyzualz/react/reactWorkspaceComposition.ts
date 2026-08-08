import type { ReactEngineId } from './ReactTypes'

export type ReactLeftTab = 'workspace' | 'media' | 'layers' | 'library' | 'fonts'
export type ReactLowerSurface = 'trackMap' | 'soundDrawing' | 'performancePads'
export type ReactPresetSurface = 'enginePresets' | 'shaderScenes'
export type ReactWorkspaceTabLabel = 'SETUP' | 'SOURCE' | 'RIG' | 'LAYOUT' | 'HOME'

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
  presetSurface: ReactPresetSurface
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
  const isShader = engineId === 'shaderPads'
  const isSoundDrawing = engineId === 'oscilloscope'
  const isCinematic = engineId === 'cinematicPortal'
  const isCinema = engineId === 'cinema'
  const isLaser = engineId === 'laserDmx'
  const isCanvas = engineId === 'canvas'
  const isPixGrid = engineId === 'pixGrid'
  void laserWorkspaceMode

  let leftTabs: ReactLeftTab[] = ['workspace']
  let workspaceTabLabel: ReactWorkspaceTabLabel = 'SETUP'

  if (isCinema) {
    leftTabs = ['workspace', 'layers', 'library']
    workspaceTabLabel = 'HOME'
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
    leftTabs = ['workspace']
    workspaceTabLabel = 'SOURCE'
  } else if (isPixGrid) {
    leftTabs = ['workspace', 'media']
    workspaceTabLabel = 'SETUP'
  }

  return {
    // React performance pads target live React presets and contextual production actions.
    // Shader uses its independent scene system and has no compatible React presets.
    showPerformancePads: !isShader && !isCinema,
    showSoundDrawingTimeline: isSoundDrawing,
    // Track sections and transport context are shared by every React engine.
    showTrackMap: true,
    showLaserBeamEditor: isLaser && beamEditorVisible,
    showLaserLayersTab: isLaser,
    presetSurface: isShader ? 'shaderScenes' : 'enginePresets',
    leftTabs,
    workspaceTabLabel,
  }
}

export function getReactPresetTabLabel(
  composition: ReactWorkspaceComposition,
): 'PRESETS' | 'SCENES' {
  return composition.presetSurface === 'shaderScenes' ? 'SCENES' : 'PRESETS'
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
  if (tab === 'library') return 'LIBRARY'
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
