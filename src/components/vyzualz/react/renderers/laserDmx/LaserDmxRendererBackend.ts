import type {
  LaserDmxShowDirectorPresentationMode,
  LaserDmxShowDirectorRendererMode,
} from '../../ReactTypes'

export type LaserDmxResolvedRendererBackend = 'webgl' | 'canvas2d'
export type LaserDmxAtmosphereRendererPath = 'webglVolumetric' | 'canvas2dFogFallback'

/** Keeps the legacy flat fog renderer isolated to compatibility/fallback output. */
export function resolveLaserDmxAtmosphereRendererPath(
  backend: LaserDmxResolvedRendererBackend,
): LaserDmxAtmosphereRendererPath {
  return backend === 'webgl' ? 'webglVolumetric' : 'canvas2dFogFallback'
}

export type LaserDmxRendererFallbackCode =
  | 'forced-canvas2d'
  | 'webgl2-unavailable'
  | 'context-lost'
  | 'repeated-context-loss'
  | 'shader-compile-failed'
  | 'gpu-resource-allocation-failed'
  | 'runtime-render-failed'

export interface LaserDmxRendererCapabilities {
  webgl2: boolean
  contextLost?: boolean
  repeatedContextLoss?: boolean
  runtimeFailed?: boolean
  failureCode?: Exclude<LaserDmxRendererFallbackCode, 'forced-canvas2d' | 'webgl2-unavailable' | 'context-lost' | 'repeated-context-loss'>
}

export interface LaserDmxRendererBackendDecision {
  backend: LaserDmxResolvedRendererBackend
  fallbackCode: LaserDmxRendererFallbackCode | null
  fallbackReason: string | null
}

const FALLBACK_REASON_LABELS: Record<LaserDmxRendererFallbackCode, string> = {
  'forced-canvas2d': 'Canvas2D compatibility mode is selected.',
  'webgl2-unavailable': 'WebGL2 is unavailable; Canvas2D compatibility rendering is active.',
  'context-lost': 'The WebGL context is temporarily lost; Canvas2D is active until restoration.',
  'repeated-context-loss': 'The WebGL context was lost repeatedly; Canvas2D is locked for this renderer session.',
  'shader-compile-failed': 'A WebGL shader failed to compile or link.',
  'gpu-resource-allocation-failed': 'The GPU could not allocate a required render target or buffer.',
  'runtime-render-failed': 'The WebGL render path failed repeatedly.',
}

export function laserDmxRendererFallbackReason(code: LaserDmxRendererFallbackCode): string {
  return FALLBACK_REASON_LABELS[code]
}

export function classifyLaserDmxWebGLFailure(message: string): Exclude<
  LaserDmxRendererFallbackCode,
  'forced-canvas2d' | 'webgl2-unavailable' | 'context-lost' | 'repeated-context-loss'
> {
  const normalized = message.toLowerCase()
  if (normalized.includes('shader') || normalized.includes('program link')) return 'shader-compile-failed'
  if (
    normalized.includes('allocate')
    || normalized.includes('framebuffer')
    || normalized.includes('out of memory')
    || normalized.includes('render target')
  ) return 'gpu-resource-allocation-failed'
  return 'runtime-render-failed'
}

export function resolveLaserDmxRendererBackendDecision(
  requested: LaserDmxShowDirectorRendererMode,
  capabilities: LaserDmxRendererCapabilities,
): LaserDmxRendererBackendDecision {
  let fallbackCode: LaserDmxRendererFallbackCode | null = null
  if (requested === 'canvas2d') fallbackCode = 'forced-canvas2d'
  else if (!capabilities.webgl2) fallbackCode = 'webgl2-unavailable'
  else if (capabilities.repeatedContextLoss) fallbackCode = 'repeated-context-loss'
  else if (capabilities.contextLost) fallbackCode = 'context-lost'
  else if (capabilities.runtimeFailed) fallbackCode = capabilities.failureCode ?? 'runtime-render-failed'
  return {
    backend: fallbackCode ? 'canvas2d' : 'webgl',
    fallbackCode,
    fallbackReason: fallbackCode ? laserDmxRendererFallbackReason(fallbackCode) : null,
  }
}

export function resolveLaserDmxRendererBackend(
  requested: LaserDmxShowDirectorRendererMode,
  capabilities: LaserDmxRendererCapabilities,
): LaserDmxResolvedRendererBackend {
  return resolveLaserDmxRendererBackendDecision(requested, capabilities).backend
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
