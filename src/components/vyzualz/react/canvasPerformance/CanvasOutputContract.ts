import type { CanvasPresetSettings, CanvasSourceMixMode } from '../ReactTypes'
import type { CanvasResolvedLayer } from './CanvasPerformanceTypes'

function clamp01(value: unknown, fallback = 0): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(1, number))
}

export interface CanvasResolvedOutputContract {
  canvasOutputOpacity: number
  drySourceMix: number
  sourceMixMode: CanvasSourceMixMode
}

export function resolveCanvasOutputContract(input: {
  canvasOutputOpacity: number
  presetSettings: Pick<CanvasPresetSettings, 'drySourceMix' | 'sourceVisibility' | 'sourceMixMode'>
}): CanvasResolvedOutputContract {
  return Object.freeze({
    canvasOutputOpacity: clamp01(input.canvasOutputOpacity, 1),
    drySourceMix: clamp01(input.presetSettings.drySourceMix ?? input.presetSettings.sourceVisibility, 1),
    sourceMixMode: input.presetSettings.sourceMixMode === 'legacyComposite' ? 'legacyComposite' : 'dryOnly',
  })
}

/** Layers without effects have no processed pass; every untreated pass uses Dry Source Mix. */
export function isCanvasDrySourceLayer(layer: Pick<CanvasResolvedLayer, 'effectChain'>): boolean {
  return layer.effectChain.length === 0
}

export interface CanvasLayerAlphaHierarchy {
  /** Untreated source contribution, including dry mix. */
  drySourceAlpha: number
  /** Authored effect contribution, excluding dry mix. */
  processedAlpha: number
}

export function resolveCanvasLayerAlphaHierarchy(input: {
  layer: Pick<CanvasResolvedLayer, 'effectChain' | 'opacity'>
  transitionOpacity: number
  drySourceMix: number
  sourceMixMode: CanvasSourceMixMode
}): CanvasLayerAlphaHierarchy {
  const baseAlpha = clamp01(input.layer.opacity, 1) * clamp01(input.transitionOpacity, 1)
  const legacyCompositeMultiplier = input.sourceMixMode === 'legacyComposite'
    ? clamp01(input.drySourceMix, 1)
    : 1
  return Object.freeze({
    drySourceAlpha: baseAlpha * clamp01(input.drySourceMix, 1),
    processedAlpha: isCanvasDrySourceLayer(input.layer) ? 0 : baseAlpha * legacyCompositeMultiplier,
  })
}
