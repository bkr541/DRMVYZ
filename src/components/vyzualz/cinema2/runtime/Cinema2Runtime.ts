import type { Cinema2CapabilityId, Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_AUDIO_INTELLIGENCE_RUNTIME_CAPABILITIES,
  Cinema2AudioIntelligenceBridge,
  type Cinema2AudioIntelligenceFrame,
} from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2CompiledPresetPlan } from '../presets/Cinema2PresetCompiler'
import type { Cinema2CompiledRenderPlan } from '../render/Cinema2RenderGraph'
import type { Cinema2CompiledSceneGraph } from '../scene/Cinema2SceneGraph'
import {
  Cinema2ParameterState,
  type Cinema2SerializedParameterState,
} from '../parameters/Cinema2ParameterState'
import {
  Cinema2FinalValueResolver,
} from '../parameters/Cinema2TargetRuntime'
import {
  CINEMA2_RUNTIME_FOUNDATION_PRESET_ID,
  Cinema2PresetRegistry,
  cinema2NativePresetRegistry,
} from '../presets/Cinema2PresetRegistry'
import {
  Cinema2ModuleRuntime,
  type Cinema2ModuleRuntimeSnapshot,
} from '../modules/Cinema2ModuleRuntime'
import {
  Cinema2ModuleRegistry,
  cinema2NativeModuleRegistry,
} from '../modules/Cinema2ModuleRegistry'
import type { Cinema2ModuleRenderPassProvider } from '../modules/Cinema2ModuleContracts'
import {
  Cinema2MediaSlotRuntime,
  type Cinema2MediaLoader,
  type Cinema2MediaSlotRuntimeSnapshot,
} from '../media/Cinema2MediaSlotRuntime'
import {
  Cinema2ResourceManager,
  type Cinema2ResourceManagerSnapshot,
} from './Cinema2ResourceManager'
import {
  registerDrmvyzWebGLContext,
  retireDrmvyzWebGLContext,
  type WebGLContextDiagnosticHandle,
} from '../../react/shaders/runtime/WebGLContextLifecycle'

export type Cinema2RuntimePhase =
  | 'initializing'
  | 'running'
  | 'suspended'
  | 'context-lost'
  | 'unavailable'
  | 'disposed'

export interface Cinema2Viewport {
  width: number
  height: number
  dpr: number
}

export interface Cinema2RuntimeResourceSnapshot {
  activeAnimationFrameCount: number
  activeEventListenerCount: number
  activeWebGLContextCount: number
}

export interface Cinema2RuntimeSnapshot {
  phase: Cinema2RuntimePhase
  viewport: Cinema2Viewport
  frameCount: number
  contextGeneration: number
  statusMessage: string | null
  resources: Cinema2RuntimeResourceSnapshot
}

export interface Cinema2RuntimeDiagnostics {
  createdRuntimeCount: number
  disposedRuntimeCount: number
  activeRuntimeCount: number
  activeAnimationFrameCount: number
  activeEventListenerCount: number
  activeWebGLContextCount: number
  nativePresetManifestValidationCount: number
  nativePresetCompilationCount: number
  targetResolverCreationCount: number
  activeTargetResolverCount: number
}

export interface Cinema2RuntimeCreateOptions {
  requestAnimationFrame?: typeof requestAnimationFrame
  cancelAnimationFrame?: typeof cancelAnimationFrame
  onSnapshot?: (snapshot: Cinema2RuntimeSnapshot) => void
  presetId?: Cinema2PresetId
  presetRegistry?: Cinema2PresetRegistry
  moduleRegistry?: Cinema2ModuleRegistry
  serializedParameterState?: string | Cinema2SerializedParameterState
  audioIntelligenceBridge?: Cinema2AudioIntelligenceBridge
  mediaLoader?: Cinema2MediaLoader
}

export type Cinema2RuntimeCreateResult =
  | { runtime: Cinema2Runtime; error: null; snapshot: Cinema2RuntimeSnapshot }
  | { runtime: null; error: string; snapshot: Cinema2RuntimeSnapshot }

const diagnostics: Cinema2RuntimeDiagnostics = {
  createdRuntimeCount: 0,
  disposedRuntimeCount: 0,
  activeRuntimeCount: 0,
  activeAnimationFrameCount: 0,
  activeEventListenerCount: 0,
  activeWebGLContextCount: 0,
  nativePresetManifestValidationCount: 0,
  nativePresetCompilationCount: 0,
  targetResolverCreationCount: 0,
  activeTargetResolverCount: 0,
}

const EMPTY_VIEWPORT: Cinema2Viewport = { width: 1, height: 1, dpr: 1 }
const CINEMA2_RUNTIME_AVAILABLE_CAPABILITIES = Object.freeze([
  'render.webgl2',
  'media.image',
  'media.video',
  'media.svg',
  ...CINEMA2_AUDIO_INTELLIGENCE_RUNTIME_CAPABILITIES,
] satisfies readonly Cinema2CapabilityId[])

function unavailableSnapshot(message: string): Cinema2RuntimeSnapshot {
  return {
    phase: 'unavailable',
    viewport: { ...EMPTY_VIEWPORT },
    frameCount: 0,
    contextGeneration: 0,
    statusMessage: message,
    resources: {
      activeAnimationFrameCount: 0,
      activeEventListenerCount: 0,
      activeWebGLContextCount: 0,
    },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Process-local lifecycle diagnostics for the Cinema 2.0 runtime family.
 * These counts intentionally describe owned resources, not browser-global
 * WebGL objects, so engine switching can prove deterministic retirement.
 */
export function getCinema2RuntimeDiagnostics(): Readonly<Cinema2RuntimeDiagnostics> {
  return { ...diagnostics }
}

/**
 * Minimal native Cinema 2.0 runtime foundation.
 *
 * This runtime deliberately owns only lifecycle, one WebGL2 context, one RAF
 * loop, a deterministic safe frame, resize state, context recovery and the
 * canonical read-only Audio Intelligence bridge and focused module lifecycle.
 * Native preset/module registration gates activation; render-graph scheduling
 * remains a later Cinema 2.0 stage.
 */
export class Cinema2Runtime {
  static create(
    canvas: HTMLCanvasElement,
    options: Cinema2RuntimeCreateOptions = {},
  ): Cinema2RuntimeCreateResult {
    diagnostics.nativePresetManifestValidationCount += 1
    diagnostics.nativePresetCompilationCount += 1
    const presetRegistry = options.presetRegistry ?? cinema2NativePresetRegistry
    const presetId = options.presetId ?? CINEMA2_RUNTIME_FOUNDATION_PRESET_ID
    const compilation = presetRegistry.compile(presetId, {
      availableCapabilities: CINEMA2_RUNTIME_AVAILABLE_CAPABILITIES,
    })
    if (!compilation.ok) {
      const message = `Cinema 2.0 preset activation was rejected before runtime setup: ${compilation.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('; ')}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    const moduleRegistry = options.moduleRegistry ?? cinema2NativeModuleRegistry
    const moduleValidation = moduleRegistry.validateModules(compilation.plan.manifest.modules ?? [])
    if (!moduleValidation.ok) {
      const message = `Cinema 2.0 module activation was rejected before runtime setup: ${moduleValidation.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('; ')}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    const parameterState = new Cinema2ParameterState(compilation.plan.parameters)
    if (options.serializedParameterState != null) {
      const restored = parameterState.restore(options.serializedParameterState)
      if (!restored.ok) {
        const message = `Cinema 2.0 parameter state was rejected before runtime setup: ${restored.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('; ')}`
        return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
      }
    }

    let gl: WebGL2RenderingContext | null = null
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        desynchronized: true,
      }) as WebGL2RenderingContext | null
    } catch (error) {
      const message = `Cinema 2.0 could not initialize WebGL2: ${errorMessage(error)}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    if (!gl) {
      const message = 'Cinema 2.0 requires WebGL2, but WebGL2 is unavailable.'
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }

    let runtime: Cinema2Runtime | null = null
    try {
      runtime = new Cinema2Runtime(canvas, gl, compilation.plan, parameterState, moduleRegistry, options)
      runtime.renderSafeFrame()
      const snapshot = runtime.getSnapshot()
      return { runtime, error: null, snapshot }
    } catch (error) {
      runtime?.dispose()
      const message = `Cinema 2.0 runtime setup failed: ${errorMessage(error)}`
      return { runtime: null, error: message, snapshot: unavailableSnapshot(message) }
    }
  }

  private readonly requestFrame: typeof requestAnimationFrame
  private readonly cancelFrame: typeof cancelAnimationFrame
  private readonly onSnapshot: ((snapshot: Cinema2RuntimeSnapshot) => void) | null
  private readonly contextHandle: WebGLContextDiagnosticHandle | null
  private readonly onContextLostHandler: (event: Event) => void
  private readonly onContextRestoredHandler: () => void
  private readonly audioIntelligenceBridge: Cinema2AudioIntelligenceBridge
  private readonly targetResolver: Cinema2FinalValueResolver
  private readonly mediaSlotRuntime: Cinema2MediaSlotRuntime
  private readonly moduleRuntime: Cinema2ModuleRuntime
  private readonly resourceManager: Cinema2ResourceManager

  private phase: Cinema2RuntimePhase = 'initializing'
  private viewport: Cinema2Viewport = { ...EMPTY_VIEWPORT }
  private frameCount = 0
  private contextGeneration = 1
  private statusMessage: string | null = null
  private animationFrameId: number | null = null
  private runningRequested = false
  private suspended = false
  private contextLost = false
  private disposed = false
  private audioIntelligenceFrame: Readonly<Cinema2AudioIntelligenceFrame> | null = null
  private listenersAttached = false
  private contextOwned = false
  private firstFrameTimestampMs: number | null = null
  private lastFrameTimestampMs: number | null = null

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly compiledPresetPlan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly parameterState: Cinema2ParameterState,
    moduleRegistry: Cinema2ModuleRegistry,
    options: Cinema2RuntimeCreateOptions,
  ) {
    this.requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
    this.cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
    this.onSnapshot = options.onSnapshot ?? null
    this.audioIntelligenceBridge = options.audioIntelligenceBridge ?? new Cinema2AudioIntelligenceBridge()
    this.targetResolver = new Cinema2FinalValueResolver(compiledPresetPlan.targets, {
      resolveBaseValue: target => target.parameterId == null
        ? target.authoredBaseValue
        : parameterState.getValue(target.parameterId),
    })
    this.resourceManager = new Cinema2ResourceManager(gl)
    this.mediaSlotRuntime = new Cinema2MediaSlotRuntime(gl, compiledPresetPlan.manifest.mediaSlots ?? [], options.mediaLoader)
    this.moduleRuntime = new Cinema2ModuleRuntime(gl, compiledPresetPlan, this.targetResolver, moduleRegistry, this.mediaSlotRuntime)
    this.contextHandle = registerDrmvyzWebGLContext(gl, {
      lifetime: 'live-reusable',
      role: 'react-live-canvas',
      engine: 'cinema2',
      expectedMaxActive: 1,
    })

    this.onContextLostHandler = event => {
      if (this.disposed) return
      event.preventDefault()
      this.contextLost = true
      this.phase = 'context-lost'
      this.statusMessage = 'Cinema 2.0 paused because its WebGL2 context was lost.'
      this.moduleRuntime.handleContextLost()
      this.mediaSlotRuntime.handleContextLost()
      this.resourceManager.handleContextLost()
      this.lastFrameTimestampMs = null
      this.cancelScheduledFrame()
      this.emitSnapshot()
    }

    this.onContextRestoredHandler = () => {
      if (this.disposed) return
      this.contextLost = false
      this.contextGeneration += 1
      this.statusMessage = null
      try {
        this.resourceManager.handleContextRestored()
        this.mediaSlotRuntime.handleContextRestored()
        this.moduleRuntime.handleContextRestored()
        this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
        this.renderSafeFrame()
        this.phase = this.suspended ? 'suspended' : this.runningRequested ? 'running' : 'initializing'
        this.emitSnapshot()
        this.scheduleFrame()
      } catch (error) {
        this.runningRequested = false
        this.phase = 'unavailable'
        this.statusMessage = `Cinema 2.0 could not recover its WebGL2 context: ${errorMessage(error)}`
        this.cancelScheduledFrame()
        this.emitSnapshot()
      }
    }

    let contextLostListenerAttached = false
    try {
      canvas.addEventListener('webglcontextlost', this.onContextLostHandler)
      contextLostListenerAttached = true
      canvas.addEventListener('webglcontextrestored', this.onContextRestoredHandler)
    } catch (error) {
      if (contextLostListenerAttached) {
        canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
      }
      this.moduleRuntime.dispose()
      this.mediaSlotRuntime.dispose()
      this.resourceManager.dispose()
      retireDrmvyzWebGLContext(this.contextHandle, 'release-resources')
      throw error
    }

    this.contextOwned = true
    this.listenersAttached = true
    diagnostics.createdRuntimeCount += 1
    diagnostics.activeRuntimeCount += 1
    diagnostics.activeWebGLContextCount += 1
    diagnostics.activeEventListenerCount += 2
    diagnostics.targetResolverCreationCount += 1
    diagnostics.activeTargetResolverCount += 1
    this.moduleRuntime.activate()
  }

  start(): void {
    if (this.disposed || this.phase === 'unavailable') return
    this.runningRequested = true
    this.phase = this.contextLost ? 'context-lost' : this.suspended ? 'suspended' : 'running'
    this.statusMessage = this.contextLost
      ? 'Cinema 2.0 paused because its WebGL2 context was lost.'
      : null
    this.emitSnapshot()
    this.scheduleFrame()
  }

  setSuspended(suspended: boolean): void {
    if (this.disposed || this.phase === 'unavailable' || this.suspended === suspended) return
    this.suspended = suspended
    if (suspended) {
      this.phase = 'suspended'
      this.cancelScheduledFrame()
      this.emitSnapshot()
      return
    }

    this.phase = this.contextLost ? 'context-lost' : this.runningRequested ? 'running' : 'initializing'
    this.emitSnapshot()
    this.scheduleFrame()
  }

  resize(viewport: Cinema2Viewport): boolean {
    if (this.disposed || this.phase === 'unavailable') return false
    const nextViewport: Cinema2Viewport = {
      width: Math.max(1, Math.round(finitePositive(viewport.width, 1))),
      height: Math.max(1, Math.round(finitePositive(viewport.height, 1))),
      dpr: finitePositive(viewport.dpr, 1),
    }
    const changed = this.viewport.width !== nextViewport.width
      || this.viewport.height !== nextViewport.height
      || Math.abs(this.viewport.dpr - nextViewport.dpr) > 1e-6
      || this.canvas.width !== nextViewport.width
      || this.canvas.height !== nextViewport.height
    if (!changed) return false

    this.viewport = nextViewport
    this.canvas.width = nextViewport.width
    this.canvas.height = nextViewport.height
    this.resourceManager.resize(nextViewport)
    if (!this.contextLost) {
      this.gl.viewport(0, 0, nextViewport.width, nextViewport.height)
      this.renderSafeFrame()
    }
    this.emitSnapshot()
    return true
  }

  getCompiledPresetPlan(): Readonly<Cinema2CompiledPresetPlan> {
    return this.compiledPresetPlan
  }

  /** Immutable renderer-independent Scene Graph compiled at preset activation. */
  getSceneGraph(): Readonly<Cinema2CompiledSceneGraph> {
    return this.compiledPresetPlan.scene
  }

  /** Immutable frame-production plan compiled before any render execution. */
  getRenderGraph(): Readonly<Cinema2CompiledRenderPlan> {
    return this.compiledPresetPlan.render
  }

  /** Canonical authored/user parameter state owned by this preset runtime. */
  getParameterState(): Cinema2ParameterState {
    return this.parameterState
  }

  serializeParameterState(): string {
    return this.parameterState.serialize()
  }

  /** Single final-value authority for all compiled shared writable targets. */
  getTargetResolver(): Cinema2FinalValueResolver {
    return this.targetResolver
  }

  /** Most recent immutable Audio Intelligence snapshot captured for a visual frame. */
  getAudioIntelligenceFrame(): Readonly<Cinema2AudioIntelligenceFrame> | null {
    return this.audioIntelligenceFrame
  }

  getModuleRuntimeSnapshot(): Readonly<Cinema2ModuleRuntimeSnapshot> {
    return this.moduleRuntime.getSnapshot()
  }

  /** Canonical engine-owned media-slot lifecycle and managed texture service. */
  getMediaSlotRuntime(): Cinema2MediaSlotRuntime {
    return this.mediaSlotRuntime
  }

  getMediaSlotRuntimeSnapshot(): Readonly<Cinema2MediaSlotRuntimeSnapshot> {
    return this.mediaSlotRuntime.getSnapshot()
  }

  /** Canonical Cinema 2.0 GPU render-target owner used by later render-graph stages. */
  getResourceManager(): Cinema2ResourceManager {
    return this.resourceManager
  }

  getResourceManagerSnapshot(): Readonly<Cinema2ResourceManagerSnapshot> {
    return this.resourceManager.getSnapshot()
  }

  /** Stage 07 consumes these providers; modules never own the frame scheduler. */
  getModuleRenderPassProviders(): readonly Readonly<Cinema2ModuleRenderPassProvider>[] {
    return this.moduleRuntime.getRenderPassProviders()
  }

  getSnapshot(): Cinema2RuntimeSnapshot {
    return {
      phase: this.phase,
      viewport: { ...this.viewport },
      frameCount: this.frameCount,
      contextGeneration: this.contextGeneration,
      statusMessage: this.statusMessage,
      resources: {
        activeAnimationFrameCount: this.animationFrameId == null ? 0 : 1,
        activeEventListenerCount: this.listenersAttached ? 2 : 0,
        activeWebGLContextCount: this.contextOwned ? 1 : 0,
      },
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.runningRequested = false
    this.cancelScheduledFrame()

    if (this.listenersAttached) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler)
      this.listenersAttached = false
      diagnostics.activeEventListenerCount = Math.max(0, diagnostics.activeEventListenerCount - 2)
    }

    this.moduleRuntime.dispose()
    this.mediaSlotRuntime.dispose()
    this.resourceManager.dispose()

    if (this.contextOwned) {
      retireDrmvyzWebGLContext(this.contextHandle, 'release-resources')
      this.contextOwned = false
      diagnostics.activeWebGLContextCount = Math.max(0, diagnostics.activeWebGLContextCount - 1)
    }

    diagnostics.activeRuntimeCount = Math.max(0, diagnostics.activeRuntimeCount - 1)
    diagnostics.activeTargetResolverCount = Math.max(0, diagnostics.activeTargetResolverCount - 1)
    diagnostics.disposedRuntimeCount += 1
    this.phase = 'disposed'
    this.statusMessage = null
    this.emitSnapshot()
  }

  private renderSafeFrame(): void {
    if (this.disposed || this.contextLost) return
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
    this.gl.disable(this.gl.SCISSOR_TEST)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.colorMask(true, true, true, true)
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.gl.flush()
  }

  private scheduleFrame(): void {
    if (
      this.disposed
      || !this.runningRequested
      || this.suspended
      || this.contextLost
      || this.phase === 'unavailable'
      || this.animationFrameId != null
    ) return
    this.animationFrameId = this.requestFrame(this.runFrame)
    diagnostics.activeAnimationFrameCount += 1
  }

  private readonly runFrame = (timestampMs: number): void => {
    if (this.animationFrameId != null) {
      this.animationFrameId = null
      diagnostics.activeAnimationFrameCount = Math.max(0, diagnostics.activeAnimationFrameCount - 1)
    }
    if (this.disposed || !this.runningRequested || this.suspended || this.contextLost || this.phase === 'unavailable') return

    try {
      const visualFrameId = this.frameCount + 1
      const safeTimestampMs = Number.isFinite(timestampMs) ? Math.max(0, timestampMs) : (this.lastFrameTimestampMs ?? 0)
      if (this.firstFrameTimestampMs == null) this.firstFrameTimestampMs = safeTimestampMs
      const deltaTimeSec = this.lastFrameTimestampMs == null
        ? 0
        : Math.min(0.1, Math.max(0, (safeTimestampMs - this.lastFrameTimestampMs) / 1000))
      this.lastFrameTimestampMs = safeTimestampMs
      this.audioIntelligenceFrame = this.audioIntelligenceBridge.capture(visualFrameId)
      this.mediaSlotRuntime.updateVideoTextures()
      this.moduleRuntime.update(Object.freeze({
        frameId: visualFrameId,
        timestampMs: safeTimestampMs,
        deltaTimeSec,
        elapsedTimeSec: Math.max(0, (safeTimestampMs - this.firstFrameTimestampMs) / 1000),
        viewport: Object.freeze({ ...this.viewport }),
        contextGeneration: this.contextGeneration,
        audio: this.audioIntelligenceFrame,
      }))
      this.renderSafeFrame()
      this.frameCount = visualFrameId
    } catch (error) {
      this.runningRequested = false
      this.phase = 'unavailable'
      this.statusMessage = `Cinema 2.0 stopped after a WebGL2 render failure: ${errorMessage(error)}`
      this.emitSnapshot()
      return
    }
    this.scheduleFrame()
  }

  private cancelScheduledFrame(): void {
    if (this.animationFrameId == null) return
    this.cancelFrame(this.animationFrameId)
    this.animationFrameId = null
    diagnostics.activeAnimationFrameCount = Math.max(0, diagnostics.activeAnimationFrameCount - 1)
  }

  private emitSnapshot(): void {
    if (!this.onSnapshot) return
    try {
      this.onSnapshot(this.getSnapshot())
    } catch (error) {
      if (import.meta.env.DEV) console.error('[Cinema2Runtime] snapshot listener failed:', error)
    }
  }
}
