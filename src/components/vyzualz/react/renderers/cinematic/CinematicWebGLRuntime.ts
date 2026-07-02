import { resolveCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import { FullscreenPass } from '../../shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../../shaders/runtime/ShaderCompiler'
import { ShaderFramebuffer } from '../../shaders/runtime/ShaderFramebuffer'
import { ShaderProgram, type ShaderProgramDescriptor } from '../../shaders/runtime/ShaderProgram'
import { ShaderResourceManager } from '../../shaders/runtime/ShaderResourceManager'
import { ShaderTexture } from '../../shaders/runtime/ShaderTexture'
import { ShaderWebGLRuntime } from '../../shaders/runtime/ShaderWebGLRuntime'
import type { WebGLContextDisposalMode, WebGLContextLifetime } from '../../shaders/runtime/WebGLContextLifecycle'
import type { FramebufferDescriptor, TextureDescriptor } from '../../shaders/runtime/shaderRuntimeTypes'
import {
  cinematicStructuralKey,
  type CinematicFrameContext,
  type CinematicRendererResetReason,
  type CinematicViewport,
  type CinematicWebGLRuntimeLike,
  type CinematicWebGLRuntimeRenderResult,
  type CinematicWebGLServices,
  type CinematicWebGLWorldDefinition,
  type CinematicWebGLWorldRenderer,
} from '../CinematicWorldRenderer'
import type { CinematicAudioResetReason } from './CinematicAudioModulation'
import { CinematicPostProcessingPipeline } from './CinematicPostProcessingPipeline'
import { reactiveConstellationResolutionScale } from './worlds/reactiveConstellation/ConstellationQuality'

export interface CinematicWebGLRuntimeCreateOptions {
  createCanvas?: () => HTMLCanvasElement
  lifetime?: WebGLContextLifetime
}

/**
 * Dedicated WebGL2 runtime for Cinematic Worlds. It deliberately reuses the
 * shader engine's runtime, compiler, program, texture, framebuffer, fullscreen
 * pass, and canvas-resolution infrastructure instead of creating a second GPU
 * platform beside it.
 */
export function cinematicLifecycleResetReason(frame: CinematicFrameContext): CinematicRendererResetReason | null {
  if (frame.timingDiscontinuity) return 'timingDiscontinuity'
  const reasons = frame.musicalAudio?.resetReasons ?? []
  const priority: readonly Exclude<CinematicAudioResetReason, 'manual'>[] = [
    'trackReplacement',
    'seek',
    'presetReplacement',
    'worldReplacement',
    'transportRestart',
  ]
  return priority.find(reason => reasons.includes(reason)) ?? null
}

export class CinematicWebGLRuntime implements CinematicWebGLRuntimeLike {
  static create(
    outputContext: CanvasRenderingContext2D,
    options: CinematicWebGLRuntimeCreateOptions = {},
  ): CinematicWebGLRuntime | null {
    const createCanvas = options.createCanvas ?? (() => document.createElement('canvas'))
    let canvas: HTMLCanvasElement
    try {
      canvas = createCanvas()
    } catch {
      return null
    }

    const lifetime = options.lifetime ?? 'live-reusable'
    let owner: CinematicWebGLRuntime | null = null
    const supportsRestoration = lifetime === 'live-reusable'
    const result = ShaderWebGLRuntime.create(canvas, {
      ownership: {
        lifetime,
        role: lifetime === 'transient-thumbnail' ? 'preset-thumbnail' : 'react-preview',
        engine: 'cinematic-worlds',
        expectedMaxActive: 1,
      },
      restoreContext: supportsRestoration,
      onContextLost: supportsRestoration ? () => owner?.handleContextLost() : undefined,
      onContextRestored: supportsRestoration ? () => owner?.handleContextRestored() : undefined,
    })
    if (!result.runtime) return null
    owner = new CinematicWebGLRuntime(outputContext, canvas, result.runtime, lifetime)
    return owner
  }

  private readonly gl: WebGL2RenderingContext
  private compiler: ShaderCompiler
  private fullscreenPass: FullscreenPass
  private resources: ShaderResourceManager
  private sceneTarget: ShaderFramebuffer
  private post: CinematicPostProcessingPipeline
  private readonly worldPrograms = new Set<ShaderProgram>()
  private readonly worldFramebuffers = new Set<ShaderFramebuffer>()
  private readonly worldTextures = new Set<ShaderTexture>()
  private activeWorld: CinematicWebGLWorldRenderer | null = null
  private activeDefinition: CinematicWebGLWorldDefinition | null = null
  private activeKey: string | null = null
  private previousFrame: CinematicFrameContext | null = null
  private lastResolution: CanvasResolution | null = null
  private viewport: CinematicViewport | null = null
  private contextLost = false
  private restoreRequested = false
  private disposed = false

  private constructor(
    private readonly outputContext: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
    private readonly runtime: ShaderWebGLRuntime,
    private readonly lifetime: WebGLContextLifetime,
  ) {
    this.gl = runtime.gl
    this.compiler = new ShaderCompiler(this.gl)
    this.fullscreenPass = new FullscreenPass(this.gl)
    this.resources = new ShaderResourceManager(this.gl)
    this.sceneTarget = new ShaderFramebuffer(this.gl, { depth: true })
    this.post = new CinematicPostProcessingPipeline(this.gl)
  }

  render(
    definition: CinematicWebGLWorldDefinition,
    frame: CinematicFrameContext,
  ): CinematicWebGLRuntimeRenderResult {
    if (this.disposed) return { ok: false, error: 'Cinematic WebGL runtime is disposed' }
    if (this.contextLost || this.runtime.contextLost) {
      return { ok: false, error: 'Cinematic WebGL context lost; using legacyPortal until restoration', recoverable: true }
    }

    let frameBegan = false
    try {
      if (this.restoreRequested) this.rebuildAfterContextRestore()
      this.resize(frame)
      this.activateWorld(definition, frame)
      const lifecycleResetReason = cinematicLifecycleResetReason(frame)
      if (lifecycleResetReason) {
        this.post.clearFeedback()
        this.activeWorld?.reset(lifecycleResetReason)
      }
      const state = this.runtime.beginFrame()
      if (!state || !this.activeWorld) {
        return { ok: false, error: 'Cinematic WebGL frame could not begin', recoverable: true }
      }
      frameBegan = true

      const target = {
        framebuffer: this.sceneTarget.framebuffer,
        texture: this.sceneTarget.texture,
        width: state.dims.W,
        height: state.dims.H,
      }
      this.activeWorld.render(frame, target)
      if (!target.texture) throw new Error('Cinematic scene render target is unavailable')
      this.post.render(target.texture, frame)
      this.runtime.endFrame()
      frameBegan = false

      const outCanvas = this.outputContext.canvas
      this.outputContext.save()
      this.outputContext.globalCompositeOperation = 'source-over'
      this.outputContext.globalAlpha = 1
      this.outputContext.drawImage(this.canvas, 0, 0, outCanvas.width, outCanvas.height)
      this.outputContext.restore()
      this.previousFrame = frame
      return { ok: true, error: null, warning: this.activeWorld.getDiagnostic?.() ?? null }
    } catch (error) {
      if (frameBegan) {
        try { this.runtime.endFrame() } catch { /* Continue into the readable fallback path. */ }
      }
      this.restoreSafeGlState()
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  reset(reason: CinematicRendererResetReason): void {
    this.activeWorld?.reset(reason)
    this.post.clearFeedback()
    this.activeKey = null
    this.previousFrame = null
    this.restoreSafeGlState(true)
  }

  dispose(mode: WebGLContextDisposalMode = 'release-resources'): void {
    if (this.disposed) return
    this.disposed = true
    const effectiveMode = mode === 'terminal-retire' && this.lifetime === 'transient-thumbnail'
      ? 'terminal-retire'
      : 'release-resources'

    // Disposal is deliberately best-effort. A context can be lost between any
    // two WebGL calls, and one misbehaving world must not prevent terminal
    // retirement of the transient context that owns it.
    this.disposeActiveWorld('dispose', false)
    try { this.post.dispose() } catch { /* Continue cleanup. */ }
    try { this.sceneTarget.dispose() } catch { /* Continue cleanup. */ }
    try { this.fullscreenPass.dispose() } catch { /* Continue cleanup. */ }
    try { this.resources.disposeAll() } catch { /* Continue cleanup. */ }
    this.worldPrograms.clear()
    this.worldFramebuffers.clear()
    this.worldTextures.clear()
    this.activeWorld = null
    this.activeDefinition = null
    this.activeKey = null
    this.previousFrame = null
    this.lastResolution = null
    this.viewport = null
    this.runtime.dispose(effectiveMode)
  }

  private restoreSafeGlState(clearBuffers = false): void {
    try {
      const gl = this.gl
      const dims = this.runtime.dims
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.bindRenderbuffer(gl.RENDERBUFFER, null)
      gl.bindVertexArray(null)
      gl.bindBuffer(gl.ARRAY_BUFFER, null)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, null)
      gl.disable(gl.BLEND)
      gl.disable(gl.CULL_FACE)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.SCISSOR_TEST)
      gl.disable(gl.STENCIL_TEST)
      gl.colorMask(true, true, true, true)
      gl.depthMask(true)
      gl.stencilMask(0xffffffff)
      gl.clearColor(0, 0, 0, 1)
      gl.clearDepth(1)
      gl.clearStencil(0)
      gl.viewport(0, 0, dims.W, dims.H)
      gl.scissor(0, 0, dims.W, dims.H)
      if (clearBuffers) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT)
      }
    } catch {
      // A lost context rejects state repair; restoration will rebuild resources.
    }
  }

  private resize(frame: CinematicFrameContext): void {
    const cssWidth = frame.resolution.width / Math.max(0.1, frame.devicePixelRatio)
    const cssHeight = frame.resolution.height / Math.max(0.1, frame.devicePixelRatio)
    const resolution = resolveCanvasResolution({
      cssWidth,
      cssHeight,
      devicePixelRatio: frame.devicePixelRatio,
      quality: frame.config.qualityTier,
      resolutionScale: frame.config.worldMode === 'reactiveConstellation'
        ? reactiveConstellationResolutionScale(frame.config.qualityTier)
        : 1,
      previous: this.lastResolution,
    })
    if (!resolution.valid) return

    const changed = this.runtime.resize(resolution)
    this.lastResolution = resolution
    const dims = this.runtime.dims
    const nextViewport = { width: dims.W, height: dims.H, dpr: dims.pixelRatio }
    if (changed || !this.viewport || this.viewport.width !== dims.W || this.viewport.height !== dims.H) {
      this.sceneTarget.resize(dims.W, dims.H)
      this.post.resize(dims.W, dims.H)
      this.activeWorld?.resize(nextViewport)
      this.viewport = nextViewport
    }
  }

  private activateWorld(
    definition: CinematicWebGLWorldDefinition,
    frame: CinematicFrameContext,
  ): void {
    const key = cinematicStructuralKey(frame)
    if (this.activeWorld && this.activeDefinition?.id === definition.id && this.activeKey === key) return

    const worldChanged = this.activeDefinition?.id !== definition.id
    const reason = !this.previousFrame
      ? 'presetChanged'
      : (worldChanged ? 'worldChanged' : 'structuralConfigurationChanged')
    this.disposeActiveWorld(reason)
    if (worldChanged) this.post.clearFeedback()

    const world = definition.create()
    this.activeDefinition = definition
    this.activeWorld = world
    this.activeKey = key
    try {
      world.initialize({
        services: this.createServices(),
        config: frame.config,
        presetId: frame.presetId,
      })
      if (this.viewport) world.resize(this.viewport)
    } catch (error) {
      this.disposeActiveWorld('dispose')
      throw error
    }
  }

  private createServices(): CinematicWebGLServices {
    return {
      gl: this.gl,
      compiler: this.compiler,
      fullscreenPass: this.fullscreenPass,
      resources: this.resources,
      compileProgram: (descriptor: ShaderProgramDescriptor) => {
        const result = ShaderProgram.create(this.gl, this.compiler, descriptor)
        if (!result.program) {
          throw new Error(`${descriptor.label} failed: ${result.error.log}`)
        }
        this.worldPrograms.add(result.program)
        return result.program
      },
      createFramebuffer: (descriptor?: FramebufferDescriptor) => {
        const framebuffer = new ShaderFramebuffer(this.gl, descriptor)
        this.worldFramebuffers.add(framebuffer)
        return framebuffer
      },
      createTexture: (descriptor?: TextureDescriptor) => {
        const texture = new ShaderTexture(this.gl, descriptor)
        this.worldTextures.add(texture)
        return texture
      },
    }
  }

  private disposeActiveWorld(
    reason: CinematicRendererResetReason,
    recreateResourceManager = true,
  ): void {
    const world = this.activeWorld
    this.activeWorld = null
    this.activeDefinition = null
    this.activeKey = null

    if (world) {
      try { world.reset(reason) } catch { /* Continue owned-resource cleanup. */ }
      try { world.dispose() } catch { /* Continue owned-resource cleanup. */ }
    }
    for (const program of this.worldPrograms) {
      try { program.dispose() } catch { /* Context may already be lost. */ }
    }
    for (const framebuffer of this.worldFramebuffers) {
      try { framebuffer.dispose() } catch { /* Context may already be lost. */ }
    }
    for (const texture of this.worldTextures) {
      try { texture.dispose() } catch { /* Context may already be lost. */ }
    }
    this.worldPrograms.clear()
    this.worldFramebuffers.clear()
    this.worldTextures.clear()
    try { this.resources.disposeAll() } catch { /* Context may already be lost. */ }
    if (recreateResourceManager) this.resources = new ShaderResourceManager(this.gl)
  }

  private handleContextLost(): void {
    this.contextLost = true
    this.activeWorld?.onContextLost?.()
  }

  private handleContextRestored(): void {
    this.contextLost = false
    this.restoreRequested = true
    this.activeWorld?.onContextRestored?.()
  }

  private rebuildAfterContextRestore(): void {
    this.restoreRequested = false
    // All prior WebGL handles were invalidated by the loss. Dispose world-owned
    // DOM/media resources, then drop GPU ownership without deleting stale handles.
    this.activeWorld?.reset('contextRestored')
    this.activeWorld?.dispose()
    this.activeWorld = null
    this.activeDefinition = null
    this.activeKey = null
    this.worldPrograms.clear()
    this.worldFramebuffers.clear()
    this.worldTextures.clear()
    this.resources.resetForRestore()
    this.resources = new ShaderResourceManager(this.gl)
    this.compiler = new ShaderCompiler(this.gl)
    this.fullscreenPass = new FullscreenPass(this.gl)
    this.sceneTarget = new ShaderFramebuffer(this.gl, { depth: true })
    this.post = new CinematicPostProcessingPipeline(this.gl)
    this.lastResolution = null
    this.viewport = null
  }
}
