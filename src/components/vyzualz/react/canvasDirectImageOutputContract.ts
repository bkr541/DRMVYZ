import type { CanvasResolvedOutputContract } from './canvasPerformance/CanvasOutputContract'
import { CANVAS_OUTPUT_UNAVAILABLE, type CanvasOutputCapability } from './canvasFracturesOutputContract'

/** A direct image processor replaces the source, rather than adding a second copy under its alpha.
 * Legacy documents retain their composite multiplier; dryOnly keeps FX at 1. */
export function resolveCanvasDirectImageAlpha(contract: Pick<CanvasResolvedOutputContract, 'sourceMixMode' | 'drySourceMix'>): number {
  return contract.sourceMixMode === 'legacyComposite' ? Math.max(0, Math.min(1, contract.drySourceMix)) : 1
}

export function isCanvasDirectImageOwnerPending(input: {
  showId: string | null
  authored: boolean
  frame: { runtimeMode?: string; frameIdentity: string } | null
}): boolean {
  if (input.showId) return input.frame?.runtimeMode !== 'show' || !input.frame.frameIdentity.startsWith(`canvas-show:${input.showId}:`)
  return input.authored && input.frame?.runtimeMode !== 'authored'
}

/** A drawable original is a valid, visible fallback; a missing/failed source
 * and an unresolved owner handoff must never advertise stale direct capture. */
export function resolveCanvasDirectImageCapability(input: {
  base: CanvasOutputCapability
  selected: boolean
  orchestrationRenderable: boolean
  ownerPending: boolean
  sourceReady: boolean
}): CanvasOutputCapability {
  if (!input.selected) return input.base
  if (input.ownerPending || (!input.orchestrationRenderable && !input.sourceReady)) return CANVAS_OUTPUT_UNAVAILABLE
  return input.base
}
