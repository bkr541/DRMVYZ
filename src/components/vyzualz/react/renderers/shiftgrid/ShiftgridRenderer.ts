import type { ShiftgridRenderPlan } from './ShiftgridRenderPlan'
import { ShiftgridCanvas2DRenderer } from './ShiftgridCanvas2DRenderer'
import { ShiftgridWebGLRenderer } from './ShiftgridWebGLRenderer'

export type ShiftgridSourceElement = HTMLImageElement | HTMLCanvasElement | ImageBitmap
export interface ShiftgridRendererSource { id: string; element: ShiftgridSourceElement }
export interface ShiftgridSourceUploadOptions { preferredCellSize?: number }
export type ShiftgridRendererBackend = 'webgl2' | 'canvas2d'
export interface ShiftgridRenderer {
  readonly backend: ShiftgridRendererBackend
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  setSource(source: ShiftgridSourceElement): void
  setSources(sources: readonly ShiftgridRendererSource[], options?: ShiftgridSourceUploadOptions): void
  render(plan: ShiftgridRenderPlan): void
  dispose(): void
}

export function createShiftgridRenderer(canvas: HTMLCanvasElement, options: { forceCanvas2D?: boolean } = {}): ShiftgridRenderer {
  if (!options.forceCanvas2D) {
    try { return new ShiftgridWebGLRenderer(canvas) } catch { /* Canvas2D is the explicit no-GPU fallback. */ }
  }
  return new ShiftgridCanvas2DRenderer(canvas)
}
