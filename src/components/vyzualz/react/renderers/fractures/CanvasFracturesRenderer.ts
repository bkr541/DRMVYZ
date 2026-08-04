import { CanvasFracturesCanvas2DRenderer } from './CanvasFracturesCanvas2DRenderer'
import type {
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
  CanvasFracturesRendererBackend,
} from './CanvasFracturesTypes'

export type CanvasFracturesRendererCreateResult =
  | { renderer: CanvasFracturesRenderer; error: null }
  | { renderer: null; error: string }

/**
 * Fractures renderer lifecycle. Canvas2D is the functional baseline and fallback
 * for this stage; a later WebGL backend can be added behind the same contract.
 */
export class CanvasFracturesRenderer {
  readonly backend: CanvasFracturesRendererBackend = 'canvas2d'

  static create(canvas: HTMLCanvasElement): CanvasFracturesRendererCreateResult {
    const canvas2d = CanvasFracturesCanvas2DRenderer.create(canvas)
    if (!canvas2d) return { renderer: null, error: 'Canvas2D unavailable for CANVAS Fractures' }
    return { renderer: new CanvasFracturesRenderer(canvas2d), error: null }
  }

  private constructor(private readonly canvas2d: CanvasFracturesCanvas2DRenderer) {}

  setPlan(plan: CanvasFracturesPlan): void {
    this.canvas2d.setPlan(plan)
  }

  get planIdentity(): string | null {
    return this.canvas2d.planIdentity
  }

  resize(width: number, height: number, dpr: number): void {
    this.canvas2d.resize(width, height, dpr)
  }

  render(params: CanvasFracturesRenderParams): boolean {
    return this.canvas2d.render(params)
  }

  dispose(): void {
    this.canvas2d.dispose()
  }
}
