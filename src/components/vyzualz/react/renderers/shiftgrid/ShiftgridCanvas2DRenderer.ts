import type { ShiftgridRenderPlan } from './ShiftgridRenderPlan'
import type { ShiftgridRenderer, ShiftgridRendererSource, ShiftgridSourceElement } from './ShiftgridRenderer'

function sourceSize(source: ShiftgridSourceElement): { width: number; height: number } {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

export class ShiftgridCanvas2DRenderer implements ShiftgridRenderer {
  readonly backend = 'canvas2d' as const
  private readonly context: CanvasRenderingContext2D
  private sources: readonly ShiftgridSourceElement[] = []
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

  setSource(source: ShiftgridSourceElement): void { this.sources = [source] }
  setSources(sources: readonly ShiftgridRendererSource[]): void {
    if (sources.length === 0 || sources.length > 10) throw new Error('SHIFTGRID supports one to ten retained image sources')
    this.sources = sources.map(source => source.element)
  }

  render(plan: ShiftgridRenderPlan): void {
    if (this.disposed) return
    const context = this.context; context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    context.clearRect(0, 0, plan.width, plan.height)
    if (this.sources.length === 0) return
    if (plan.assembled) {
      const source = this.sources[plan.tiles[0]?.sourceIndex ?? 0]; if (!source) return
      const bounds = plan.compositionBounds; const draw = plan.sourceDraw
      context.save(); context.beginPath(); context.rect(bounds.x, bounds.y, bounds.width, bounds.height); context.clip()
      context.drawImage(source, draw.x, draw.y, draw.width, draw.height); context.restore()
      return
    }
    const drawTile = (source: ShiftgridSourceElement, sourceRect: typeof plan.tiles[number]['source'], destination: typeof plan.tiles[number]['destination'], alpha: number) => {
      const size = sourceSize(source); if (size.width <= 0 || size.height <= 0 || alpha <= 0) return
      const u0 = Math.max(0, sourceRect.x); const v0 = Math.max(0, sourceRect.y)
      const u1 = Math.min(1, sourceRect.x + sourceRect.width); const v1 = Math.min(1, sourceRect.y + sourceRect.height)
      if (u1 <= u0 || v1 <= v0) return
      const left = (u0 - sourceRect.x) / sourceRect.width; const top = (v0 - sourceRect.y) / sourceRect.height
      const right = (u1 - sourceRect.x) / sourceRect.width; const bottom = (v1 - sourceRect.y) / sourceRect.height
      const previousAlpha = context.globalAlpha; context.globalAlpha = previousAlpha * alpha
      context.drawImage(source,
        u0 * size.width, v0 * size.height, (u1 - u0) * size.width, (v1 - v0) * size.height,
        destination.x + destination.width * left, destination.y + destination.height * top,
        destination.width * (right - left), destination.height * (bottom - top))
      context.globalAlpha = previousAlpha
    }
    for (const tile of plan.tiles) {
      const current = this.sources[tile.sourceIndex]; const pending = this.sources[tile.pendingSourceIndex]
      const mix = tile.sourceIndex === tile.pendingSourceIndex ? 0 : tile.sourceTransitionProgress
      if (current) drawTile(current, tile.source, tile.destination, 1 - mix)
      if (pending && mix > 0) drawTile(pending, tile.pendingSource, tile.destination, mix)
    }
  }

  dispose(): void { this.disposed = true; this.sources = []; this.context.setTransform(1, 0, 0, 1, 0, 0); this.context.clearRect(0, 0, this.canvas.width, this.canvas.height) }
}
