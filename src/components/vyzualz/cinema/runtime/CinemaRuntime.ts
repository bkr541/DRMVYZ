import {
  createCinemaDiagnostic,
  createCinemaDiagnosticSnapshot,
  type CinemaDiagnostic,
  type CinemaDiagnosticSnapshot,
} from '../CinemaDiagnostics'
import type { CinemaCompositionDefinition, CinemaCompositionInstance } from '../CinemaDomain'
import type { CinemaExternalAssetSnapshot } from '../CinemaAssets'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import type { CinemaComposerRuntimePreview } from '../CinemaComposerStage19'
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
import { createCinemaEmptyGraphQualitySnapshot } from './CinemaQualityManager'
import { CinemaRuntimeDiagnosticsStore, type CinemaRuntimeDiagnosticsSnapshot } from './CinemaRuntimeDiagnostics'
import { CinemaAssetManager } from './CinemaAssetManager'
import { CinemaWebGLRenderServiceImpl } from './CinemaWebGLRenderService'
import { CinemaImpulseGate } from '../CinemaImpulseGate'
import {
  sampleCinemaRuntimeFrameClock,
  type CinemaRuntimeFrameClockState,
  type CinemaRuntimeFrameSource,
} from './CinemaRuntimeFrameClock'
import { GpuFrameTimer } from '../../react/shaders/performance/GpuFrameTimer'
import { disposeCinemaShaderProgramCache } from '../CinemaShaderProgramCache'
import { prepareCinemaShaderScenePrograms } from '../CinemaShaderSceneAdapter'

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
  telemetry: CinemaRuntimeDiagnosticsSnapshot
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
 * Stage 17 executes the compiled graph through graph-aware quality, bounded
 * diagnostics, hardened context recovery, Cinema-owned targets, one authorized
 * output node, and the existing single-context/single-loop lifecycle.
 */
const CINEMA_RUNTIME_SNAPSHOT_INTERVAL_MS = 250

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
  private readonly runtimeDiagnostics = new CinemaRuntimeDiagnosticsStore()

  private phase: CinemaRuntimePhase = 'initializing'
  private viewport: CinemaViewport = { width: 1, height: 1, dpr: 1 }
  private lastResolution: CanvasResolution | null = null
  private frame: Readonly<CinemaFrameContext> | null = null
  private frameSource: CinemaRuntimeFrameSource | null = null
  private frameClock: CinemaRuntimeFrameClockState = { lastNowMs: null }
  private readonly impulseGate = new CinemaImpulseGate()
  private composition: Readonly<CinemaCompositionDefinition> | null = null
  private instance: Readonly<CinemaCompositionInstance> | null = null
  private preparedCompositionKey: string | null = null
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
    parameterResolutionCount: 0, parameterReuseCount: 0, snapshotPublicationCount: 0,
    profile: { sampleCount: 0, performanceMs: 0, qualityMs: 0, parameterMs: 0, cameraMs: 0, graphRenderMs: 0 },
    quality: createCinemaEmptyGraphQualitySnapshot(),
  }
  private fpsFrameCount = 0
  private fpsWindowStartedMs = 0
  private lastFrameDrivenSnapshotMs = Number.NEGATIVE_INFINITY
  private gpuTimer: GpuFrameTimer
  private observedGpuSampleCount = 0

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    options: CinemaRuntimeCreateOptions,
  ) {
    // Browser animation-frame APIs are Window methods in Chromium/Electron. Keeping an
    // unbound reference and later invoking it as `this.requestFrame(...)` gives the
    // CinemaRuntime instance as the receiver, which Chromium rejects with
    // `TypeError: Illegal invocation`. Wrap the native methods so Window remains the
    // receiver while preserving injectable schedulers for deterministic tests.
    this.requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
    this.cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
    this.onSnapshot = options.onSnapshot ?? null
    this.onLiveFps = options.onLiveFps ?? null
    this.capabilities = detectPlatformCapabilities(gl)
    this.gpuTimer = new GpuFrameTimer(gl)
    this.textures = new CinemaTextureManager()
    this.assets = new CinemaAssetManager(gl, this)
    this.targets = new CinemaRenderTargetPool(gl, this.textures, this.viewport, this)
    this.webgl = new CinemaWebGLRenderServiceImpl(gl, this.targets, this.textures)
    this.executor = new CinemaGraphExecutor({
      runtimeRegistry: options.runtimeRegistry ?? CINEMA_PRODUCTION_RUNTIME_REGISTRY,
      platform: this.capabilities, targets: this.targets, textures: this.textures, assetManager: this.assets, webgl: this.webgl, diagnostics: this,
      onSnapshot: snapshot => {
        const previousOutputRendered = this.graphSnapshot.outputRendered
        const previousSafeOutputActive = this.graphSnapshot.safeOutputActive
        this.graphSnapshot = snapshot
        if (this.disposed) return
        const outputStateChanged = previousOutputRendered !== snapshot.outputRendered
          || previousSafeOutputActive !== snapshot.safeOutputActive
        if (outputStateChanged) this.emitSnapshot()
        else this.emitFrameDrivenSnapshot()
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
      this.webgl.handleContextLost()
      this.executor.handleContextLost()
      disposeCinemaShaderProgramCache(this.gl)
      this.gpuTimer.dispose()
      this.assets.handleContextLost()
      this.targets.abandonContext()
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_CONTEXT_LOST',
        severity: 'warning',
        message: 'Cinema paused rendering because its WebGL2 context was lost.',
        attribution: { stage: 'cinema-runtime' },
      }))
      this.runtimeDiagnostics.recordRecovery({
        type: 'context-lost', contextGeneration: this.contextGeneration, frameCount: this.frameCount, message: null,
      })
      this.emitSnapshot()
    }
    this.onContextRestoredHandler = () => {
      if (this.disposed) return
      this.contextLost = false
      this.resetFrameTiming()
      this.contextGeneration += 1
      this.runtimeDiagnostics.recordRecovery({
        type: 'restore-started', contextGeneration: this.contextGeneration, frameCount: this.frameCount, message: null,
      })
      try {
        this.gpuTimer = new GpuFrameTimer(this.gl)
        this.observedGpuSampleCount = 0
        this.targets.rebuildAfterContextRestore()
        this.assets.rebuildAfterContextRestore()
        this.webgl.rebuildAfterContextRestore()
        if (this.lastResolution) this.applyResolution(this.lastResolution)
        this.executor.rebuildAfterContextRestore()
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_CONTEXT_RESTORED',
          severity: 'info',
          message: 'Cinema rebuilt the complete reachable graph and runtime-owned resources after WebGL2 context restoration.',
          attribution: { stage: 'cinema-runtime' },
          details: { contextGeneration: this.contextGeneration },
        }))
        this.runtimeDiagnostics.recordRecovery({
          type: 'restore-succeeded', contextGeneration: this.contextGeneration, frameCount: this.frameCount, message: null,
        })
        this.phase = this.visibilitySuspended ? 'suspended' : this.runningRequested ? 'running' : 'initializing'
        this.emitSnapshot()
        if (this.runningRequested) this.scheduleFrame()
      } catch (error) {
        const message = errorMessage(error)
        this.runningRequested = false
        this.cancelScheduledFrame()
        try { this.webgl.dispose() } catch { /* Retire any shared 3D GPU resources rebuilt before the failure. */ }
        try { this.executor.handleContextLost() } catch { /* Keep recovery failure cleanup best-effort and bounded. */ }
        try { this.assets.dispose() } catch { /* Retire any media/GPU resources rebuilt before the failure. */ }
        try { this.targets.dispose() } catch { /* Retire any target attachments rebuilt before the failure. */ }
        this.phase = 'unavailable'
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_CONTEXT_RECOVERY_FAILED',
          severity: 'error',
          message: `Cinema could not rebuild after context restoration: ${message}`,
          attribution: { stage: 'cinema-runtime' },
          details: { contextGeneration: this.contextGeneration },
        }))
        this.runtimeDiagnostics.recordRecovery({
          type: 'restore-failed', contextGeneration: this.contextGeneration, frameCount: this.frameCount, message,
        })
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
    if (!this.gpuTimer.available) {
      this.report(createCinemaDiagnostic({
        code: 'CINEMA_GPU_TIMER_UNAVAILABLE',
        severity: 'info',
        message: 'Cinema GPU timer queries are unavailable; adaptive quality is using CPU submission and presentation cadence.',
        attribution: { stage: 'quality-manager' },
      }))
    }
  }

  setGraph(
    composition: Readonly<CinemaCompositionDefinition> | null,
    instance: Readonly<CinemaCompositionInstance> | null,
    definitions: readonly CinemaPersistedDefinition[],
  ): void {
    if (this.disposed) return
    if (composition) {
      const preparationKey = `${composition.id}:${composition.revision}`
      if (preparationKey !== this.preparedCompositionKey) {
        const preparation = prepareCinemaShaderScenePrograms(this.gl, composition)
        if (!preparation.ok) {
          this.report(createCinemaDiagnostic({
            code: 'CINEMA_SHADER_COMPILE_FAILED',
            severity: 'error',
            message: `Cinema kept the active preset because the replacement Shader scene failed preparation: ${preparation.message}`,
            attribution: { compositionId: composition.id, stage: 'shader-scene-adapter' },
            details: { sceneId: preparation.sceneId },
          }))
          this.emitSnapshot()
          return
        }
        this.preparedCompositionKey = preparationKey
      }
    } else {
      this.preparedCompositionKey = null
    }
    this.composition = composition
    this.instance = instance
    if (composition) this.assets.validateAuthoredBindings(composition, instance)
    this.executor.setGraph({ composition, instance, definitions })
  }

  setComposerRuntimePreview(preview: Readonly<CinemaComposerRuntimePreview>): void {
    if (this.disposed) return
    this.executor.setComposerRuntimePreview(preview)
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

  setFrameSource(source: CinemaRuntimeFrameSource | null): void {
    if (this.disposed) return
    this.frameSource = source
    this.resetFrameTiming()
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
    if (!this.runningRequested) this.resetFrameTiming()
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
    this.resetFrameTiming()
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
    // Pull on demand so tests/diagnostics and immediate state transitions never
    // observe a stale frame merely because automatic publication is throttled.
    this.graphSnapshot = this.executor.getSnapshot()
    const diagnostics = createCinemaDiagnosticSnapshot(this.diagnostics)
    const telemetry = this.runtimeDiagnostics.capture({
      phase: this.phase,
      contextGeneration: this.contextGeneration,
      contextLost: this.contextLost,
      frameCount: this.frameCount,
      graph: this.graphSnapshot,
      diagnostics,
      targets: this.targets.getDiagnostics(),
      textures: this.textures.getDiagnostics(),
      assets: this.assets.getDiagnostics(),
    })
    return {
      phase: this.phase,
      viewport: { ...this.viewport },
      frameCount: this.frameCount,
      contextGeneration: this.contextGeneration,
      diagnostics,
      capabilities: { ...this.capabilities },
      graph: this.graphSnapshot,
      telemetry,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.runningRequested = false
    this.cancelScheduledFrame()
    this.frameSource = null
    this.impulseGate.reset()
    this.resetFrameTiming()
    this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler)
    try { this.executor.dispose() } catch { /* Continue deterministic cleanup. */ }
    try { this.webgl.dispose() } catch { /* Continue deterministic cleanup. */ }
    try { disposeCinemaShaderProgramCache(this.gl) } catch { /* Continue deterministic cleanup. */ }
    try { this.gpuTimer.dispose() } catch { /* Continue deterministic cleanup. */ }
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
      const clock = sampleCinemaRuntimeFrameClock(this.frameClock, nowMs)
      this.frameClock = clock.state
      const sourcedFrame = this.frameSource?.({
        nowMs,
        deltaTimeSec: clock.deltaTimeSec,
        timingDiscontinuity: clock.timingDiscontinuity,
        viewport: this.viewport,
      }) ?? this.frame
      this.frame = sourcedFrame
      const renderStartedMs = performance.now()
      this.gpuTimer.beginFrame()
      try {
        this.executor.render(sourcedFrame ? this.impulseGate.consume(sourcedFrame) : null)
      } finally {
        this.gpuTimer.endFrame()
      }
      const renderTimeMs = Math.max(0, performance.now() - renderStartedMs)
      const presentationTimeMs = clock.timingDiscontinuity ? 0 : clock.deltaTimeSec * 1000
      this.gpuTimer.poll()
      const gpuTimerSnapshot = this.gpuTimer.getSnapshot()
      const gpuTimeMs = gpuTimerSnapshot.completedSampleCount > this.observedGpuSampleCount
        ? gpuTimerSnapshot.lastGpuMs
        : null
      this.observedGpuSampleCount = gpuTimerSnapshot.completedSampleCount
      if (gpuTimerSnapshot.state === 'disjoint') {
        this.report(createCinemaDiagnostic({
          code: 'CINEMA_GPU_TIMER_DISJOINT',
          severity: 'warning',
          message: 'Cinema ignored a disjoint GPU timing sample and kept presentation/CPU quality fallbacks active.',
          attribution: { stage: 'quality-manager' },
        }))
      }
      this.executor.observeFrameMetrics({ cpuMs: renderTimeMs, presentationMs: presentationTimeMs, gpuMs: gpuTimeMs })
      this.runtimeDiagnostics.recordFrameMetrics({ cpuMs: renderTimeMs, presentationMs: presentationTimeMs, gpuMs: gpuTimeMs })
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

  private resetFrameTiming(): void {
    this.frameClock = { lastNowMs: null }
    this.impulseGate.reset()
  }

  private emitFrameDrivenSnapshot(): void {
    const nowMs = performance.now()
    if (nowMs - this.lastFrameDrivenSnapshotMs < CINEMA_RUNTIME_SNAPSHOT_INTERVAL_MS) return
    this.lastFrameDrivenSnapshotMs = nowMs
    this.emitSnapshot()
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
