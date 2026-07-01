import type { LaserDmxWorkspaceMode, ReactEngineId } from './ReactTypes'

export type ReactLeftTab = 'workspace' | 'media' | 'layers' | 'fonts'
export type ReactPresetSurface = 'enginePresets' | 'shaderScenes'
export type ReactWorkspaceTabLabel = 'SETUP' | 'WORLD' | 'SOURCE' | 'RIG' | 'LAYOUT'

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
  laserWorkspaceMode: LaserDmxWorkspaceMode,
  beamEditorVisible: boolean,
): ReactWorkspaceComposition {
  const isShader = engineId === 'shaderPads'
  const isSoundDrawing = engineId === 'oscilloscope'
  const isCinematic = engineId === 'cinematicPortal'
  const isLaser = engineId === 'laserDmx'
  const isLaserBeamMatrix = isLaser && laserWorkspaceMode === 'beamMatrix'

  let leftTabs: ReactLeftTab[] = ['workspace']
  let workspaceTabLabel: ReactWorkspaceTabLabel = 'SETUP'

  if (isCinematic) {
    leftTabs = ['workspace', 'media']
    workspaceTabLabel = 'WORLD'
  } else if (isSoundDrawing) {
    leftTabs = ['workspace', 'media', 'fonts']
    workspaceTabLabel = 'SOURCE'
  } else if (isLaser) {
    leftTabs = isLaserBeamMatrix ? ['workspace', 'layers'] : ['workspace']
    workspaceTabLabel = 'RIG'
  } else if (engineId === 'neonLattice') {
    workspaceTabLabel = 'LAYOUT'
  }

  return {
    // React performance pads target React presets (plus Neon Lattice triggers).
    // Shader uses its independent scene system and has no compatible React presets.
    showPerformancePads: !isShader,
    showSoundDrawingTimeline: isSoundDrawing,
    // Track sections and transport context are shared by every React engine.
    showTrackMap: true,
    showLaserBeamEditor: isLaserBeamMatrix && beamEditorVisible,
    showLaserLayersTab: isLaserBeamMatrix,
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
  return 'FONTS'
}

export function isReactLeftTabAvailable(
  tab: ReactLeftTab,
  composition: ReactWorkspaceComposition,
): boolean {
  return getReactLeftTabs(composition).includes(tab)
}
