import type {
  CinemaRenderTargetLease,
  CinemaTextureView,
  CinemaViewport,
  CinemaWebGLTargetBinding,
  CinemaWebGLRenderService as CinemaWebGLRenderServiceContract,
} from '../CinemaRendererContracts'
import { CinemaRenderTargetPool } from './CinemaRenderTargetPool'
import { CinemaTextureManager } from './CinemaTextureManager'
import { CinemaObject3DRenderer } from '../CinemaObject3DRenderer'
import { Cinema3DObjectRuntimeService } from '../Cinema3DObjectRuntime'

/** WebGL2 facade that preserves Cinema's context, target, and texture ownership. */
export class CinemaWebGLRenderServiceImpl implements CinemaWebGLRenderServiceContract {
  readonly objects3d: CinemaObject3DRenderer
  readonly objectInstances: Cinema3DObjectRuntimeService

  constructor(
    readonly gl: WebGL2RenderingContext,
    private readonly targets: CinemaRenderTargetPool,
    private readonly textures: CinemaTextureManager,
  ) {
    this.objects3d = new CinemaObject3DRenderer(gl)
    this.objectInstances = new Cinema3DObjectRuntimeService(this.objects3d)
  }

  bindTarget(lease: CinemaRenderTargetLease): Readonly<CinemaWebGLTargetBinding> {
    return this.targets.bindDrawTarget(lease)
  }

  bindDefaultFramebuffer(viewport: CinemaViewport): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, Math.max(1, viewport.width), Math.max(1, viewport.height))
  }

  resolveTexture(view: CinemaTextureView): WebGLTexture | null {
    return this.textures.resolveRuntimeTexture(view)
  }

  handleContextLost(): void {
    this.objects3d.handleContextLost()
  }

  rebuildAfterContextRestore(): void {
    this.objects3d.rebuildAfterContextRestore()
  }

  dispose(): void {
    this.objectInstances.dispose()
    this.objects3d.dispose()
  }

  resetState(): void {
    const gl = this.gl
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.colorMask(true, true, true, true)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
    gl.useProgram(null)
  }
}
