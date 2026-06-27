import type { LaserDmxWorkspaceMode, ReactEngineId } from './ReactTypes'

export type ReactLeftTab = 'engine' | 'media' | 'layers' | 'fonts'
export type ReactPresetSurface = 'enginePresets' | 'shaderScenes'

export interface ReactWorkspaceComposition {
  showPerformancePads: boolean
  showSoundDrawingTimeline: boolean
  showTrackMap: boolean
  showLaserBeamEditor: boolean
  showLaserLayersTab: boolean
  presetSurface: ReactPresetSurface
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
  const isLaserBeamMatrix = engineId === 'laserDmx' && laserWorkspaceMode === 'beamMatrix'

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
  return composition.showLaserLayersTab
    ? ['engine', 'media', 'layers', 'fonts']
    : ['engine', 'media', 'fonts']
}

export function isReactLeftTabAvailable(
  tab: ReactLeftTab,
  composition: ReactWorkspaceComposition,
): boolean {
  return getReactLeftTabs(composition).includes(tab)
}
