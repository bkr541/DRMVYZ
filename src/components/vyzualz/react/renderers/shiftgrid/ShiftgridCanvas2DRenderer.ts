import type { ShiftgridRenderPlan } from './ShiftgridRenderPlan'
import type { ShiftgridRenderer, ShiftgridSourceElement } from './ShiftgridRenderer'

function sourceSize(source: ShiftgridSourceElement): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

export class ShiftgridCanvas2DRenderer implements ShiftgridRenderer {
  readonly backend = 'canvas2d' as const
  private readonly context: CanvasRenderingContext2D
  private source: ShiftgridSourceElement | null = null
  private pixelRatio = 1
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('SHIFTGRID Canvas2D is unavailable')
    this.context = context; this.context.imageSmoothingEnabled = true; this.context.imageSmoothingQuality = 'high'
  }

  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void {
    if (this.disposed) return
    this.pixelRatio = Math.max(0.5, pixelRatio)
    const width = Math.max(1, Math.round(cssWidth * this.pixelRatio)); const height = Math.max(1, Math.round(cssHeight * this.pixelRatio))
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
    this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    this.context.imageSmoothingEnabled = true; this.context.imageSmoothingQuality = 'high'
  }

  setSource(source: ShiftgridSourceElement): void { this.source = source }

  render(plan: ShiftgridRenderPlan): void {
    if (this.disposed) return
    const context = this.context; context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    context.clearRect(0, 0, plan.width, plan.height)
    const source = this.source; if (!source) return
    const size = sourceSize(source); if (size.width <= 0 || size.height <= 0) return
    if (plan.assembled) {
      const bounds = plan.compositionBounds; const draw = plan.sourceDraw
      context.save(); context.beginPath(); context.rect(bounds.x, bounds.y, bounds.width, bounds.height); context.clip()
      context.drawImage(source, draw.x, draw.y, draw.width, draw.height); context.restore()
      return
    }
    for (const tile of plan.tiles) {
      const sourceRect = tile.source; const destination = tile.destination
      const u0 = Math.max(0, sourceRect.x); const v0 = Math.max(0, sourceRect.y)
      const u1 = Math.min(1, sourceRect.x + sourceRect.width); const v1 = Math.min(1, sourceRect.y + sourceRect.height)
      if (u1 <= u0 || v1 <= v0) continue
      const left = (u0 - sourceRect.x) / sourceRect.width; const top = (v0 - sourceRect.y) / sourceRect.height
      const right = (u1 - sourceRect.x) / sourceRect.width; const bottom = (v1 - sourceRect.y) / sourceRect.height
      context.drawImage(source,
        u0 * size.width, v0 * size.height, (u1 - u0) * size.width, (v1 - v0) * size.height,
        destination.x + destination.width * left, destination.y + destination.height * top,
        destination.width * (right - left), destination.height * (bottom - top))
    }
  }

  dispose(): void { this.disposed = true; this.source = null; this.context.setTransform(1, 0, 0, 1, 0, 0); this.context.clearRect(0, 0, this.canvas.width, this.canvas.height) }
}
