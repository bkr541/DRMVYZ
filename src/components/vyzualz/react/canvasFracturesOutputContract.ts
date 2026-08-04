import type { ReactEngineId, CanvasPresetId } from './ReactTypes'
import { resolveCanvasPresetRendererKind } from './ReactTypes'

export function isCanvasFracturesOutputDeferred(
  activeEngineId: ReactEngineId,
  selectedPresetId: CanvasPresetId,
): boolean {
  return activeEngineId === 'canvas' && resolveCanvasPresetRendererKind(selectedPresetId) === 'fragmentCollage'
}
