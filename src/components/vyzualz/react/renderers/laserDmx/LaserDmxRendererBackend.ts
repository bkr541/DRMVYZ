import type {
  LaserDmxShowDirectorPresentationMode,
  LaserDmxShowDirectorRendererMode,
} from '../../ReactTypes'

export type LaserDmxResolvedRendererBackend = 'webgl' | 'canvas2d'

export interface LaserDmxRendererCapabilities {
  webgl2: boolean
  contextLost?: boolean
  runtimeFailed?: boolean
}

export function resolveLaserDmxRendererBackend(
  requested: LaserDmxShowDirectorRendererMode,
  capabilities: LaserDmxRendererCapabilities,
): LaserDmxResolvedRendererBackend {
  if (requested === 'canvas2d') return 'canvas2d'
  if (!capabilities.webgl2 || capabilities.contextLost || capabilities.runtimeFailed) return 'canvas2d'
  return 'webgl'
}

export interface LaserDmxPresentationVisibility {
  mountStageEditor: boolean
  showAllFixtures: boolean
  showSelectedFixtures: boolean
  showGrid: boolean
  showAxes: boolean
  showBeamHandles: boolean
  showSelection: boolean
  showDiagnosticOverlays: boolean
}

export function resolveLaserDmxPresentationVisibility(
  mode: LaserDmxShowDirectorPresentationMode,
): LaserDmxPresentationVisibility {
  switch (mode) {
    case 'hybrid':
      return {
        mountStageEditor: true,
        showAllFixtures: false,
        showSelectedFixtures: true,
        showGrid: false,
        showAxes: false,
        showBeamHandles: true,
        showSelection: true,
        showDiagnosticOverlays: false,
      }
    case 'live':
    case 'capture':
      return {
        mountStageEditor: false,
        showAllFixtures: false,
        showSelectedFixtures: false,
        showGrid: false,
        showAxes: false,
        showBeamHandles: false,
        showSelection: false,
        showDiagnosticOverlays: false,
      }
    case 'edit':
    default:
      return {
        mountStageEditor: true,
        showAllFixtures: true,
        showSelectedFixtures: true,
        showGrid: true,
        showAxes: true,
        showBeamHandles: true,
        showSelection: true,
        showDiagnosticOverlays: true,
      }
  }
}

export interface LaserDmxAuthoringOverlayVisibility {
  showDirectorStageEditor: boolean
  showBeamMatrixEditor: boolean
}

export function resolveLaserDmxAuthoringOverlayVisibility(input: {
  showDirectorModeActive: boolean
  beamMatrixEditorRequested: boolean
  presentationMode: LaserDmxShowDirectorPresentationMode
}): LaserDmxAuthoringOverlayVisibility {
  const presentation = resolveLaserDmxPresentationVisibility(input.presentationMode)
  return {
    showDirectorStageEditor: input.showDirectorModeActive && presentation.mountStageEditor,
    // A hidden Show Director overlay must never reveal the manual Beam Matrix
    // authoring layer underneath it in Live or Capture.
    showBeamMatrixEditor: input.beamMatrixEditorRequested && !input.showDirectorModeActive,
  }
}
