import type { CanvasPresetId } from './ReactTypes'
import { resolveCanvasPresetRendererKind } from './ReactTypes'
import { isCanvasFracturesProcessor } from './canvasPerformance/CanvasFracturesPerformance'
import type { CanvasResolvedPerformanceFrame } from './canvasPerformance/CanvasPerformanceTypes'

export type CanvasOutputCapability =
  | { status: 'available' }
  | { status: 'deferred'; reason: 'fractures-mvp' }
  | { status: 'unavailable'; reason: 'renderer-unresolved' }

export const CANVAS_OUTPUT_AVAILABLE: CanvasOutputCapability = Object.freeze({ status: 'available' })
export const CANVAS_FRACTURES_OUTPUT_DEFERRED: CanvasOutputCapability = Object.freeze({
  status: 'deferred',
  reason: 'fractures-mvp',
})
export const CANVAS_OUTPUT_UNAVAILABLE: CanvasOutputCapability = Object.freeze({
  status: 'unavailable',
  reason: 'renderer-unresolved',
})

export function resolveCanvasOutputCapability({
  selectedPresetId,
  orchestrationRenderable,
  orchestrationFrame,
}: {
  selectedPresetId: CanvasPresetId
  orchestrationRenderable: boolean
  orchestrationFrame: Pick<CanvasResolvedPerformanceFrame, 'layers'> | null | undefined
}): CanvasOutputCapability {
  // SHIFTGRID owns and directly publishes its renderer canvas in P1. Do not let
  // a stale authored-compositor frame decide its output capability.
  if (resolveCanvasPresetRendererKind(selectedPresetId) === 'shiftgrid') {
    return CANVAS_OUTPUT_AVAILABLE
  }
  if (orchestrationRenderable) {
    if (!orchestrationFrame) return CANVAS_OUTPUT_UNAVAILABLE
    const processors = orchestrationFrame.layers
      .map(layer => layer.processor)
      .filter((processor): processor is NonNullable<typeof processor> => processor != null)
    if (processors.some(isCanvasFracturesProcessor)) return CANVAS_FRACTURES_OUTPUT_DEFERRED
    if (processors.length > 0) return CANVAS_OUTPUT_UNAVAILABLE
    return CANVAS_OUTPUT_AVAILABLE
  }

  const rendererKind = resolveCanvasPresetRendererKind(selectedPresetId)
  if (rendererKind === 'fragmentCollage') return CANVAS_FRACTURES_OUTPUT_DEFERRED
  if (rendererKind === 'shiftgrid') return CANVAS_OUTPUT_AVAILABLE
  return CANVAS_OUTPUT_AVAILABLE
}

export function isCanvasOutputAvailable(capability: CanvasOutputCapability): boolean {
  return capability.status === 'available'
}

export function isCanvasFracturesOutputDeferred(capability: CanvasOutputCapability): boolean {
  return capability.status === 'deferred' && capability.reason === 'fractures-mvp'
}
