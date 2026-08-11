export type CanvasShowQualityTier = 'full' | 'balanced' | 'reduced' | 'minimum'

export interface CanvasShowQualitySnapshot {
  tier: CanvasShowQualityTier
  scale: number
  averageFrameMs: number
  budgetState: 'recovering' | 'within-budget' | 'over-budget'
  activeVideoCount: number
  fallbackReason: string | null
}

const TIERS: readonly CanvasShowQualityTier[] = ['full', 'balanced', 'reduced', 'minimum']
const SCALE: Record<CanvasShowQualityTier, number> = { full: 1, balanced: 0.8, reduced: 0.62, minimum: 0.48 }

export const MAX_CANVAS_SHOW_COMPOSITION_PIXELS = 1920 * 1080
export const MIN_CANVAS_SHOW_COMPOSITION_EDGE = 180

/**
 * Keeps Show composition work bounded independently of the published output
 * canvas. The output surface remains at device/output resolution and receives
 * the scaled composition in the canonical compositor pass.
 */
export function resolveCanvasShowCompositionDimensions({
  outputWidth,
  outputHeight,
  qualityScale,
}: {
  outputWidth: number
  outputHeight: number
  qualityScale: number
}): { width: number; height: number } {
  const safeWidth = Math.max(1, Math.round(Number.isFinite(outputWidth) ? outputWidth : 1))
  const safeHeight = Math.max(1, Math.round(Number.isFinite(outputHeight) ? outputHeight : 1))
  const requestedScale = Math.max(0.1, Math.min(1, Number.isFinite(qualityScale) ? qualityScale : 1))
  const outputPixels = safeWidth * safeHeight
  const baseLimitScale = outputPixels > MAX_CANVAS_SHOW_COMPOSITION_PIXELS
    ? Math.sqrt(MAX_CANVAS_SHOW_COMPOSITION_PIXELS / outputPixels)
    : 1
  const effectiveScale = baseLimitScale * requestedScale
  let width = Math.max(1, Math.min(safeWidth, Math.round(safeWidth * effectiveScale)))
  let height = Math.max(1, Math.min(safeHeight, Math.round(safeHeight * effectiveScale)))
  const minEdge = Math.min(MIN_CANVAS_SHOW_COMPOSITION_EDGE, safeWidth, safeHeight)
  if (Math.min(width, height) < minEdge) {
    const lift = minEdge / Math.max(1, Math.min(width, height))
    width = Math.min(safeWidth, Math.max(1, Math.round(width * lift)))
    height = Math.min(safeHeight, Math.max(1, Math.round(height * lift)))
  }
  return { width, height }
}

export class CanvasShowAdaptiveQualityController {
  private index = 0
  private averageFrameMs = 16.67
  private slowFrames = 0
  private recoveryFrames = 0
  private cooldown = 0
  private activeVideoCount = 0

  reset(activeVideoCount: number): CanvasShowQualitySnapshot {
    this.activeVideoCount = Math.max(0, Math.min(4, Math.round(activeVideoCount)))
    this.index = this.activeVideoCount >= 4 ? 2 : this.activeVideoCount === 3 ? 1 : 0
    this.averageFrameMs = 16.67
    this.slowFrames = 0
    this.recoveryFrames = 0
    this.cooldown = 0
    return this.snapshot()
  }

  sample(frameMs: number, activeVideoCount = this.activeVideoCount): CanvasShowQualitySnapshot {
    const count = Math.max(0, Math.min(4, Math.round(activeVideoCount)))
    if (count !== this.activeVideoCount) return this.reset(count)
    const sample = Number.isFinite(frameMs) ? Math.max(1, Math.min(100, frameMs)) : 16.67
    this.averageFrameMs = this.averageFrameMs * 0.9 + sample * 0.1
    if (this.cooldown > 0) this.cooldown -= 1
    if (this.averageFrameMs > 20) {
      this.slowFrames += 1
      this.recoveryFrames = 0
    } else if (this.averageFrameMs < 15.5) {
      this.recoveryFrames += 1
      this.slowFrames = 0
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1)
      this.recoveryFrames = Math.max(0, this.recoveryFrames - 1)
    }
    if (this.cooldown === 0 && this.slowFrames >= 24 && this.index < TIERS.length - 1) {
      this.index += 1
      this.slowFrames = 0
      this.cooldown = 60
    } else if (this.cooldown === 0 && this.recoveryFrames >= 180 && this.index > (count >= 4 ? 2 : count === 3 ? 1 : 0)) {
      this.index -= 1
      this.recoveryFrames = 0
      this.cooldown = 120
    }
    return this.snapshot()
  }

  snapshot(): CanvasShowQualitySnapshot {
    const tier = TIERS[this.index]!
    return {
      tier,
      scale: SCALE[tier],
      averageFrameMs: this.averageFrameMs,
      budgetState: this.averageFrameMs > 20 ? 'over-budget' : this.averageFrameMs < 15.5 ? 'recovering' : 'within-budget',
      activeVideoCount: this.activeVideoCount,
      fallbackReason: this.index === TIERS.length - 1 && this.averageFrameMs > 20
        ? 'Frame budget remains exceeded at minimum composition resolution'
        : null,
    }
  }
}
