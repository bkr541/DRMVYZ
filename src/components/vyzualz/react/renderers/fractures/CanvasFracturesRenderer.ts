import { CanvasFracturesCanvas2DRenderer } from './CanvasFracturesCanvas2DRenderer'
import { CanvasFracturesWebGLRenderer } from './CanvasFracturesWebGLRenderer'
import type {
  CanvasFracturesPlan,
  CanvasFracturesRenderParams,
  CanvasFracturesRendererBackend,
} from './CanvasFracturesTypes'

export type CanvasFracturesRendererHealth = 'ready' | 'recovering' | 'failed'

export interface CanvasFracturesRendererCreateOptions {
  forceCanvas2D?: boolean
}

export type CanvasFracturesRendererCreateResult =
  | { renderer: CanvasFracturesRenderer; error: null }
  | { renderer: null; error: string }

interface CanvasFracturesRendererImplementation {
  readonly health: CanvasFracturesRendererHealth
  setPlan(plan: CanvasFracturesPlan): void
  readonly planIdentity: string | null
  resize(width: number, height: number, dpr: number): void
  render(params: CanvasFracturesRenderParams): boolean
  invalidateFeedback(): void
  dispose(): void
}

/**
 * Fractures renderer lifecycle. WebGL2 is preferred for the full per-fragment
 * shader suite; Canvas2D remains the reduced functional fallback.
 */
export class CanvasFracturesRenderer {
  static create(
    canvas: HTMLCanvasElement,
    options: CanvasFracturesRendererCreateOptions = {},
  ): CanvasFracturesRendererCreateResult {
    const webgl2 = options.forceCanvas2D ? null : CanvasFracturesWebGLRenderer.create(canvas)
    if (webgl2) return { renderer: new CanvasFracturesRenderer('webgl2', webgl2), error: null }
    const canvas2d = CanvasFracturesCanvas2DRenderer.create(canvas)
    if (canvas2d) return { renderer: new CanvasFracturesRenderer('canvas2d', canvas2d), error: null }
    return { renderer: null, error: 'WebGL2 and Canvas2D are unavailable for CANVAS Fractures' }
  }

  private constructor(
    readonly backend: CanvasFracturesRendererBackend,
    private readonly implementation: CanvasFracturesRendererImplementation,
  ) {}

  setPlan(plan: CanvasFracturesPlan): void {
    this.implementation.setPlan(plan)
  }

  get health(): CanvasFracturesRendererHealth {
    return this.implementation.health
  }

  get planIdentity(): string | null {
    return this.implementation.planIdentity
  }

  resize(width: number, height: number, dpr: number): void {
    this.implementation.resize(width, height, dpr)
  }

  render(params: CanvasFracturesRenderParams): boolean {
    return this.implementation.render(params)
  }

  invalidateFeedback(): void {
    this.implementation.invalidateFeedback()
  }

  dispose(): void {
    this.implementation.dispose()
  }
}
