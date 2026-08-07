import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from '../CinemaDiagnostics'
import type { CinemaCompositionDefinition, CinemaCompositionInstance } from '../CinemaDomain'
import type { CinemaExternalAssetSnapshot } from '../CinemaAssets'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import { CINEMA_PRODUCTION_RUNTIME_REGISTRY } from '../CinemaFoundation'
import type { CinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import type {
  CinemaFrameContext,
  CinemaPlatformCapabilities,
  CinemaRuntimeDiagnosticSink,
  CinemaViewport,
} from '../CinemaRendererContracts'
import { applyCanvasResolution, type CanvasResolution } from '../../react/rendering/canvasResolution'
import {
  registerDrmvyzWebGLContext,
  retireDrmvyzWebGLContext,
  type WebGLContextDiagnosticHandle,
} from '../../react/shaders/runtime/WebGLContextLifecycle'
import { CinemaRenderTargetPool } from './CinemaRenderTargetPool'
import { CinemaTextureManager } from './CinemaTextureManager'
import { CinemaGraphExecutor, type CinemaGraphExecutorSnapshot } from './CinemaGraphExecutor'
import { CinemaAssetManager } from './CinemaAssetManager'
import { CinemaWebGLRenderServiceImpl } from './CinemaWebGLRenderService'

export type CinemaRuntimePhase =
  | 'initializing'
  | 'running'
  | 'suspended'
  | 'context-lost'
  | 'unavailable'
  | 'disposed'

export interface CinemaRuntimeSnapshot {
  phase: CinemaRuntimePhase
  viewport: CinemaViewport
  frameCount: number
  contextGeneration: number
  diagnostics: CinemaDiagnosticSnapshot
  capabilities: CinemaPlatformCapabilities
  graph: CinemaGraphExecutorSnapshot
}

export interface CinemaRuntimeCreateOptions {
  requestAnimationFrame?: typeof requestAnimationFrame
  cancelAnimationFrame?: typeof cancelAnimationFrame
  onSnapshot?: (snapshot: CinemaRuntimeSnapshot) => void
  onLiveFps?: (fps: number) => void
  runtimeRegistry?: CinemaRuntimeNodeRegistry
}

export type CinemaRuntimeCreateResult =
  | { runtime: CinemaRuntime; error: null; diagnostics: CinemaDiagnosticSnapshot }
  | { runtime: null; error: string; diagnostics: CinemaDiagnosticSnapshot }

/**
 * Single-owner Cinema WebGL2 runtime.
 *
 * Stage 12 executes native and adapter-backed nodes through runtime-only
 * plugins, deterministic performance choreography, Cinema-owned targets, one
 * authorized output node, and the existing single-context/single-loop lifecycle.
 */
export class CinemaRuntime implements CinemaRuntimeDiagnosticSink {
  static create(canvas: HTMLCanvasElement, options: CinemaRuntimeCreateOptions = {}): CinemaRuntimeCreateResult {
    let gl: WebGL2RenderingContext | null = null
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        desynchronized: true,
      }) as WebGL2RenderingContext | null
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return unavailableResult(`WebGL2 initialization failed: ${message}`)
    }

    if (!gl) return unavailableResult('WebGL2 is unavailable in this environment')

    try {
      const runtime = new CinemaRuntime(canvas, gl, options)
      return { runtime, error: null, diagnostics: runtime.getSnapshot().diagnostics }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return unavailableResult(`Cinema runtime setup failed: ${message}`)
    }
  }

  readonly textures: CinemaTextureManager
  readonly targets: CinemaRenderTargetPool
  readonly assets: CinemaAssetManager
  readonly capabilities: CinemaPlatformCapabilities
  readonly webgl: CinemaWebGLRenderServiceImpl
  readonly executor: CinemaGraphExecutor

  private readonly requestFrame: typeof requestAnimationFrame
  private readonly cancelFrame: typeof cancelAnimationFrame
  private readonly onSnapshot: ((snapshot: CinemaRuntimeSnapshot) => void) | null
  private readonly onLiveFps: ((fps: number) => void) | null
  private readonly diagnostics: CinemaDiagnostic[] = []
  private readonly contextDiagnosticHandle: WebGLContextDiagnosticHandle | null
  private readonly onContextLostHandler: (event: Event) => void
  private readonly onContextRestoredHandler: () => void

  private phase: CinemaRuntimePhase = 'initializing'
  private viewport: CinemaViewport = { width: 1, height: 1, dpr: 1 }
  private lastResolution: CanvasResolution | null = null
  private frame: Readonly<CinemaFrameContext> | null = null
  private composition: Readonly<CinemaCompositionDefinition> | null = null
  private instance: Readonly<CinemaCompositionInstance> | null = null
  private animationFrameId = 0
  private runningRequested = false
  private visibilitySuspended = false
  private contextLost = false
  private disposed = false
  private frameCount = 0
  private contextGeneration = 1
  private graphSnapshot: CinemaGraphExecutorSnapshot = {
    compositionId: null, compositionRevision: null, planCacheKey: null, planCacheSize: 0,
    activeNodeCount: 0, initializedNodeCount: 0, failedNodeCount: 0, outputNodeId: null,
    outputRendered: false, safeOutputActive: true, modulationRouteCount: 0, activeModulationRouteCount: 0, diagnostics: createCinemaDiagnosticSnapshot([]),
    performanceRuleCount: 0, activePerformanceRuleCount: 0, activePerformanceTransientCount: 0,
  }
  private fpsFrameCount = 0
  private fpsWindowStartedMs = 0

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    options: CinemaRuntimeCreateOptions,
  ) {
    this.requestFrame = options.requestAnimationFrame ?? requestAnimationFrame
    this.cancelFrame = options.cancelAnimationFrame ?? cancelAnimationFrame
    this.onSnapshot = options.onSnapshot ?? null
    this.onLiveFps = options.onLiveFps ?? null
    this.capabilities = detectPlatformCapabilities(gl)
    this.textures = new CinemaTextureManager()
    this.assets = new CinemaAssetManager(gl, this)
    this.targets = new CinemaRenderTargetPool(gl, this.textures, this.viewport, this)
    this.webgl = new CinemaWebGLRenderServiceImpl(gl, this.targets, this.textures)
    this.executor = new CinemaGraphExecutor({
      runtimeRegistry: options.runtimeRegistry ?? CINEMA_PRODUCTION_RUNTIME_REGISTRY,
      platform: this.capabilities, targets: this.targets, textures: this.textures, assetManager: this.assets, webgl: this.webgl, diagnostics: this,
      onSnapshot: snapshot => {
        this.graphSnapshot = snapshot
        if (!this.disposed) this.emitSnapshot()
      },
    })
    this.contextDiagnosticHandle = registerDrmvyzWebGLContext(gl, {
      lifetime: 'live-reusable',
      role: 'react-live-canvas',
      engine: 'cinema',
      expectedMaxActive: 1,
    })

    this.onContextLostHandler = event => {
      if (this.disposed) return
      event.preventDefault()
      this.contextLost = true
      this.phase = 'context-lost'
      this.cancelScheduledFrame()
      this.executor.handleContextLost()
      this.assets.handleContextLost()
      this.targets.abandonContext()
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_CONTEXT_LOST',
        severity: 'warning',
        message: 'Cinema paused rendering because its WebGL2 context was lost.',
        attribution: { stage: 'cinema-runtime' },
      }))
      this.emitSnapshot()
    }
    this.onContextRestoredHandler = () => {
      if (this.disposed) return
      this.contextLost = false
      this.contextGeneration += 1
      try {
        this.targets.rebuildAfterContextRestore()
        this.assets.rebuildAfterContextRestore()
        if (this.lastResolution) this.applyResolution(this.lastResolution)
        this.executor.rebuildAfterContextRestore()
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_CONTEXT_RESTORED',
          severity: 'info',
          message: 'Cinema rebuilt runtime-owned resources after WebGL2 context restoration.',
          attribution: { stage: 'cinema-runtime' },
          details: { contextGeneration: this.contextGeneration },
        }))
        this.phase = this.visibilitySuspended ? 'suspended' : 'running'
        this.emitSnapshot()
        this.scheduleFrame()
      } catch (error) {
        this.phase = 'unavailable'
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_CAPABILITY_UNAVAILABLE',
          severity: 'error',
          message: `Cinema could not rebuild after context restoration: ${errorMessage(error)}`,
          attribution: { stage: 'cinema-runtime' },
        }))
        this.emitSnapshot()
      }
    }

    canvas.addEventListener('webglcontextlost', this.onContextLostHandler)
    canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler)
    this.report(createCinemaDiagnostic({
      code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
      severity: 'info',
      message: 'Cinema runtime is active with deterministic performance choreography, compiled graph execution, adapter-backed state commands, and safe-output isolation.',
      attribution: { stage: 'cinema-runtime' },
    }))
  }

  setGraph(
    composition: Readonly<CinemaCompositionDefinition> | null,
    instance: Readonly<CinemaCompositionInstance> | null,
    definitions: readonly CinemaPersistedDefinition[],
  ): void {
    if (this.disposed) return
    this.composition = composition
    this.instance = instance
    if (composition) this.assets.validateAuthoredBindings(composition, instance)
    this.executor.setGraph({ composition, instance, definitions })
  }

  setAssetSources(sources: readonly Readonly<CinemaExternalAssetSnapshot>[]): void {
    if (this.disposed) return
    this.assets.setSources(sources)
    if (this.composition) this.assets.validateAuthoredBindings(this.composition, this.instance)
  }

  setFrame(frame: Readonly<CinemaFrameContext> | null): void {
    if (this.disposed) return
    this.frame = frame
  }

  resize(resolution: CanvasResolution): boolean {
    if (this.disposed || !resolution.valid || this.phase === 'unavailable') return false
    this.lastResolution = resolution
    try {
      return this.applyResolution(resolution)
    } catch (error) {
      this.phase = 'unavailable'
      this.runningRequested = false
      this.cancelScheduledFrame()
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: `Cinema stopped after a render-target resize failure: ${errorMessage(error)}`,
        attribution: { stage: 'cinema-runtime' },
      }))
      this.emitSnapshot()
      return false
    }
  }

  start(): void {
    if (this.disposed || this.phase === 'unavailable') return
    this.runningRequested = true
    this.phase = this.visibilitySuspended ? 'suspended' : this.contextLost ? 'context-lost' : 'running'
    this.fpsWindowStartedMs = performance.now()
    this.emitSnapshot()
    this.scheduleFrame()
  }

  setVisibilitySuspended(suspended: boolean): void {
    if (this.disposed || this.phase === 'unavailable' || this.visibilitySuspended === suspended) return
    this.visibilitySuspended = suspended
    if (suspended) {
      this.phase = 'suspended'
      this.cancelScheduledFrame()
      this.emitSnapshot()
      return
    }
    this.phase = this.contextLost ? 'context-lost' : 'running'
    this.fpsFrameCount = 0
    this.fpsWindowStartedMs = performance.now()
    this.emitSnapshot()
    this.scheduleFrame()
  }

  renderNeutralFrame(): void {
    if (this.disposed || this.contextLost) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.flush()
  }

  report(diagnostic: CinemaDiagnostic): void {
    if (this.disposed) return
    if (!this.diagnostics.some(existing => existing.id === diagnostic.id)) {
      this.diagnostics.push(diagnostic)
      if (this.diagnostics.length > 100) this.diagnostics.splice(0, this.diagnostics.length - 100)
    }
  }

  getSnapshot(): CinemaRuntimeSnapshot {
    return {
      phase: this.phase,
      viewport: { ...this.viewport },
      frameCount: this.frameCount,
      contextGeneration: this.contextGeneration,
      diagnostics: createCinemaDiagnosticSnapshot(this.diagnostics),
      capabilities: { ...this.capabilities },
      graph: this.graphSnapshot,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.runningRequested = false
    this.cancelScheduledFrame()
    this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler)
    try { this.executor.dispose() } catch { /* Continue deterministic cleanup. */ }
    try { this.assets.dispose() } catch { /* Continue deterministic cleanup. */ }
    try { this.targets.dispose() } catch { /* Continue deterministic cleanup. */ }
    try { this.textures.dispose() } catch { /* Continue deterministic cleanup. */ }
    retireDrmvyzWebGLContext(this.contextDiagnosticHandle, 'release-resources')
    this.phase = 'disposed'
    this.onLiveFps?.(0)
    this.emitSnapshot()
  }

  private applyResolution(resolution: CanvasResolution): boolean {
    const storageChanged = applyCanvasResolution(this.canvas, resolution)
    const nextViewport = {
      width: resolution.backingWidth,
      height: resolution.backingHeight,
      dpr: resolution.effectiveDpr,
    }
    const previousViewport = this.viewport
    const viewportChanged = !sameViewport(previousViewport, nextViewport)
    this.viewport = nextViewport
    if (!this.contextLost) {
      this.gl.viewport(0, 0, nextViewport.width, nextViewport.height)
      if (viewportChanged) {
        this.targets.resize(nextViewport)
        this.executor.resize(previousViewport, nextViewport)
      }
    }
    if (viewportChanged || storageChanged) this.emitSnapshot()
    return viewportChanged || storageChanged
  }

  private scheduleFrame(): void {
    if (
      this.disposed
      || !this.runningRequested
      || this.contextLost
      || this.visibilitySuspended
      || this.animationFrameId !== 0
      || this.phase === 'unavailable'
    ) return
    this.animationFrameId = this.requestFrame(this.runFrame)
  }

  private readonly runFrame = (nowMs: number): void => {
    this.animationFrameId = 0
    if (this.disposed || !this.runningRequested || this.contextLost || this.visibilitySuspended) return
    try {
      this.executor.render(this.frame)
      this.frameCount += 1
      this.fpsFrameCount += 1
      const elapsed = nowMs - this.fpsWindowStartedMs
      if (elapsed >= 1000) {
        this.onLiveFps?.(Math.round((this.fpsFrameCount * 1000) / Math.max(1, elapsed)))
        this.fpsWindowStartedMs = nowMs
        this.fpsFrameCount = 0
      }
    } catch (error) {
      this.phase = 'unavailable'
      this.runningRequested = false
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: `Cinema stopped its render loop after a graph-execution failure: ${errorMessage(error)}`,
        attribution: { stage: 'cinema-runtime' },
      }))
      this.emitSnapshot()
      return
    }
    this.scheduleFrame()
  }

  private cancelScheduledFrame(): void {
    if (this.animationFrameId === 0) return
    this.cancelFrame(this.animationFrameId)
    this.animationFrameId = 0
  }

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot())
  }
}

function unavailableResult(message: string): CinemaRuntimeCreateResult {
  const diagnostics = createCinemaDiagnosticSnapshot([
    createCinemaDiagnostic({
      code: 'CINEMA_CAPABILITY_UNAVAILABLE',
      severity: 'error',
      message,
      attribution: { stage: 'cinema-runtime' },
      details: { capability: 'webgl2' },
    }),
    createCinemaDiagnostic({
      code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
      severity: 'warning',
      message: 'Cinema remained in a non-crashing safe-output state because WebGL2 could not initialize.',
      attribution: { stage: 'cinema-runtime' },
    }),
  ])
  return { runtime: null, error: message, diagnostics }
}

function detectPlatformCapabilities(gl: WebGL2RenderingContext): CinemaPlatformCapabilities {
  return Object.freeze({
    webgl2: true,
    canvas2d: typeof CanvasRenderingContext2D !== 'undefined',
    floatColorTargets: Boolean(gl.getExtension('EXT_color_buffer_float')),
    floatBlending: Boolean(gl.getExtension('EXT_float_blend')),
    textureArrays: true,
    instancing: true,
    timerQueries: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
    maximumTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0,
    maximumTextureUnits: Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)) || 0,
  })
}

function sameViewport(left: CinemaViewport, right: CinemaViewport): boolean {
  return left.width === right.width && left.height === right.height && Math.abs(left.dpr - right.dpr) < 1e-6
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
