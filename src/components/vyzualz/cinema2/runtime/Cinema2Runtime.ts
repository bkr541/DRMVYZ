import type { Cinema2CapabilityId, Cinema2ParameterId, Cinema2PresetId, Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER_ID, readCinema2QualityMode, type Cinema2QualityMode } from '../parameters/Cinema2PerformanceParameters'
import { Cinema2PerformanceDiagnostics, type Cinema2PerformanceSnapshot } from './Cinema2PerformanceDiagnostics'
import {
  CINEMA2_AUDIO_INTELLIGENCE_RUNTIME_CAPABILITIES,
  Cinema2AudioIntelligenceBridge,
  type Cinema2AudioIntelligenceFrame,
} from '../audio/Cinema2AudioIntelligenceBridge'
import { Cinema2VisualDirector, type Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'
import {
  Cinema2ChoreographyRuntime,
  type Cinema2ChoreographyRuntimeSnapshot,
} from '../choreography/Cinema2ChoreographyRuntime'
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
import type { Cinema2ModuleRenderPassProvider, Cinema2TransportFrameState } from '../modules/Cinema2ModuleContracts'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'
import { Cinema2CameraRuntime, type Cinema2CameraRuntimeSnapshot } from '../spatial/Cinema2CameraRuntime'
import {
  Cinema2LightingEnvironmentRuntime,
  type Cinema2LightingEnvironmentRuntimeSnapshot,
} from '../spatial/Cinema2LightingEnvironmentRuntime'
import { Cinema2EffectRuntime } from '../effects/Cinema2EffectRuntime'
import { Cinema2EffectRegistry, cinema2NativeEffectRegistry } from '../effects/Cinema2EffectRegistry'
import type { Cinema2EffectRuntimeSnapshot } from '../effects/Cinema2EffectContracts'
import {
  Cinema2MediaSlotRuntime,
  type Cinema2MediaLoader,
  type Cinema2MediaSlotRuntimeSnapshot,
} from '../media/Cinema2MediaSlotRuntime'
import {
  Cinema2ResourceManager,
  type Cinema2ResourceManagerSnapshot,
} from './Cinema2ResourceManager'
import { Cinema2RenderGraphExecutor, type Cinema2RenderGraphExecutorSnapshot } from './Cinema2RenderGraphExecutor'
import { Cinema2HistoryService, type Cinema2HistoryServiceSnapshot } from './Cinema2HistoryService'
import { Cinema2ShadowService, type Cinema2ShadowServiceSnapshot } from './Cinema2ShadowService'
import { Cinema2AssetTextureService, type Cinema2AssetTextureServiceSnapshot } from '../assets/Cinema2AssetTextureService'
import { cinema2TextureAssetRegistry } from '../assets/Cinema2TextureAssetManifest'
import {
  Cinema2RandomService,
  type Cinema2RandomSeed,
  type Cinema2RandomnessMode,
} from './Cinema2RandomService'
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
  performance?: Readonly<Cinema2PerformanceSnapshot>
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

export interface Cinema2RuntimeRandomnessOptions {
  mode?: Cinema2RandomnessMode
  seed?: Cinema2RandomSeed
  activationEntropy?: () => Cinema2RandomSeed
}

export interface Cinema2RuntimeTransportSnapshot {
  sourcePresent: boolean
  playing: boolean
  analysisActive: boolean
  paused: boolean
  trackId: string | null
  timeSec: number
  /** Optional for backward-compatible test/legacy hosts; omitted means Sync OFF. */
  bpmSync?: boolean
  /** Optional canonical host BPM fallback for visual timing. */
  bpm?: number | null
}

/** Host-owned transport source. Cinema 2.0 samples it once per visual frame. */
export interface Cinema2RuntimeTransportSource {
  getState(): Readonly<Cinema2RuntimeTransportSnapshot>
}

export interface Cinema2RuntimeCreateOptions {
  requestAnimationFrame?: typeof requestAnimationFrame
  cancelAnimationFrame?: typeof cancelAnimationFrame
  onSnapshot?: (snapshot: Cinema2RuntimeSnapshot) => void
  presetId?: Cinema2PresetId
  presetRegistry?: Cinema2PresetRegistry
  moduleRegistry?: Cinema2ModuleRegistry
  effectRegistry?: Cinema2EffectRegistry
  renderQuality?: Cinema2RenderQualityLevel
  diagnosticsEnabled?: boolean
  /** Explicit development/test-only sparse render-target/canvas readback. */
  debugVisibilityReadback?: boolean
  serializedParameterState?: string | Cinema2SerializedParameterState
  audioIntelligenceBridge?: Cinema2AudioIntelligenceBridge
  /**
   * Optional so isolated/runtime tests can remain autonomous. Production Stage
   * supplies the real DRMVYZ transport and therefore freezes animation while
   * analysis is inactive or file playback is paused.
   */
  transportSource?: Cinema2RuntimeTransportSource
  mediaLoader?: Cinema2MediaLoader
  randomness?: Readonly<Cinema2RuntimeRandomnessOptions>
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
  'render.depth',
  'render.history',
  'scene.3d',
  'camera.world',
  'lighting',
  'media.image',
  'media.video',
  'media.svg',
  'visual-director.significance',
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
    performance: {
      diagnosticsEnabled: false,
      requestedMode: 'auto',
      resolvedQuality: 'high',
      renderTargetScale: 1,
      gpuMemoryBudgetBytes: 256 * 1024 * 1024,
      cpuFrameTimeMs: null,
      cpuFrameTimeAverageMs: null,
      gpuFrameTimeMs: null,
      gpuTimingSupported: false,
      degraded: false,
      degradationReason: null,
    },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const AUTONOMOUS_TRANSPORT_STATE: Readonly<Cinema2TransportFrameState> = Object.freeze({
  sourcePresent: true,
  playing: true,
  analysisActive: true,
  paused: false,
  animationActive: true,
  trackId: null,
  timeSec: 0,
  bpmSync: false,
  bpm: null,
})

function normalizeTransportState(
  source: Cinema2RuntimeTransportSource | null,
): Readonly<Cinema2TransportFrameState> {
  if (!source) return AUTONOMOUS_TRANSPORT_STATE
  let state: Readonly<Cinema2RuntimeTransportSnapshot>
  try {
    state = source.getState()
  } catch {
    return Object.freeze({
      sourcePresent: false,
      playing: false,
      analysisActive: false,
      paused: false,
      animationActive: false,
      trackId: null,
      timeSec: 0,
      bpmSync: false,
      bpm: null,
    })
  }
  const analysisActive = state.analysisActive === true
  const paused = state.paused === true
  return Object.freeze({
    sourcePresent: state.sourcePresent === true || analysisActive || state.trackId != null,
    playing: state.playing === true,
    analysisActive,
    paused,
    animationActive: analysisActive && !paused,
    trackId: state.trackId ?? null,
    timeSec: Number.isFinite(state.timeSec) ? Math.max(0, state.timeSec) : 0,
    bpmSync: state.bpmSync === true,
    bpm: typeof state.bpm === 'number' && Number.isFinite(state.bpm) && state.bpm > 0 ? state.bpm : null,
  })
}

/**
 * Process-local lifecycle diagnostics for the Cinema 2.0 runtime family.
 * These counts intentionally describe owned resources, not browser-global
 * WebGL objects, so engine switching can prove deterministic retirement.
 */
export function getCinema2RuntimeDiagnostics(): Readonly<Cinema2RuntimeDiagnostics> {
  return { ...diagnostics }
}

function indexBoundActionParameters(plan: Readonly<Cinema2CompiledPresetPlan>): ReadonlyMap<string, Cinema2ParameterId> {
  const result = new Map<string, Cinema2ParameterId>()
  const boundParameters = new Set<Cinema2ParameterId>()
  for (const effect of plan.manifest.effects ?? []) {
    for (const ref of Object.values(effect.actionBindings ?? {})) boundParameters.add(ref.$ref)
  }
  for (const module of plan.manifest.modules ?? []) {
    for (const ref of Object.values(module.actionBindings ?? {})) boundParameters.add(ref.$ref)
  }
  for (const target of plan.targets.targets) {
    if (target.channel === 'action' && target.parameterId && boundParameters.has(target.parameterId)) {
      result.set(target.id, target.parameterId)
    }
  }
  return result
}

/**
 * Minimal native Cinema 2.0 runtime foundation.
 *
 * This runtime deliberately owns only lifecycle, one WebGL2 context, one RAF
 * loop, a deterministic safe frame, resize state, context recovery and the
 * canonical read-only Audio Intelligence bridge, focused module lifecycle and
 * compiled render-graph execution. Native preset/module registration gates
 * activation before the engine-owned frame executor can run.
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
    const effectRegistry = options.effectRegistry ?? cinema2NativeEffectRegistry
    const effectValidation = effectRegistry.validateEffects(compilation.plan.manifest.effects ?? [])
    if (!effectValidation.ok) {
      const message = `Cinema 2.0 effect activation was rejected before runtime setup: ${effectValidation.diagnostics.map(diagnostic => `${diagnostic.path}: ${diagnostic.message}`).join('; ')}`
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
      runtime = new Cinema2Runtime(canvas, gl, compilation.plan, parameterState, moduleRegistry, effectRegistry, options)
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
  private readonly transportSource: Cinema2RuntimeTransportSource | null
  private readonly visualDirector: Cinema2VisualDirector
  private readonly randomService: Cinema2RandomService
  private readonly targetResolver: Cinema2FinalValueResolver
  private readonly spatialRuntime: Cinema2SpatialRuntime
  private readonly cameraRuntime: Cinema2CameraRuntime
  private readonly lightingEnvironmentRuntime: Cinema2LightingEnvironmentRuntime
  private readonly choreographyRuntime: Cinema2ChoreographyRuntime
  private readonly mediaSlotRuntime: Cinema2MediaSlotRuntime
  private readonly moduleRuntime: Cinema2ModuleRuntime
  private readonly effectRuntime: Cinema2EffectRuntime
  private readonly resourceManager: Cinema2ResourceManager
  private readonly historyService: Cinema2HistoryService
  private readonly textureService: Cinema2AssetTextureService
  private readonly shadowService: Cinema2ShadowService
  private readonly renderGraphExecutor: Cinema2RenderGraphExecutor
  private readonly performanceDiagnostics: Cinema2PerformanceDiagnostics
  private readonly renderQualityOverride: Cinema2RenderQualityLevel | null
  private activeRenderQuality: Cinema2RenderQualityLevel

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
  private servicesRetired = false
  private audioIntelligenceFrame: Readonly<Cinema2AudioIntelligenceFrame> | null = null
  private visualDirectorFrame: Readonly<Cinema2VisualDirectorFrame> | null = null
  private listenersAttached = false
  private contextOwned = false
  private lastFrameTimestampMs: number | null = null
  private visualElapsedTimeSec = 0
  private lastTransportState: Readonly<Cinema2TransportFrameState> | null = null

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly compiledPresetPlan: Readonly<Cinema2CompiledPresetPlan>,
    private readonly parameterState: Cinema2ParameterState,
    moduleRegistry: Cinema2ModuleRegistry,
    effectRegistry: Cinema2EffectRegistry,
    options: Cinema2RuntimeCreateOptions,
  ) {
    this.requestFrame = options.requestAnimationFrame ?? (callback => window.requestAnimationFrame(callback))
    this.cancelFrame = options.cancelAnimationFrame ?? (handle => window.cancelAnimationFrame(handle))
    this.onSnapshot = options.onSnapshot ?? null
    this.audioIntelligenceBridge = options.audioIntelligenceBridge ?? new Cinema2AudioIntelligenceBridge()
    this.transportSource = options.transportSource ?? null
    this.visualDirector = new Cinema2VisualDirector()
    this.randomService = new Cinema2RandomService({
      presetId: compiledPresetPlan.presetId,
      revision: compiledPresetPlan.manifest.revision,
      stateKey: parameterState.serialize(),
      ...options.randomness,
    })
    this.renderQualityOverride = options.renderQuality ?? null
    const initialMode = this.resolveRequestedQualityMode()
    this.performanceDiagnostics = new Cinema2PerformanceDiagnostics(gl, initialMode, options.diagnosticsEnabled !== false)
    const initialPolicy = this.performanceDiagnostics.getPolicy()
    this.activeRenderQuality = this.renderQualityOverride ?? initialPolicy.resolvedQuality
    this.resourceManager = new Cinema2ResourceManager(gl, {
      maximumEstimatedGpuMemoryBytes: initialPolicy.gpuMemoryBudgetBytes,
      renderTargetScale: initialPolicy.renderTargetScale,
    })
    this.historyService = new Cinema2HistoryService(gl, this.resourceManager, compiledPresetPlan.presetId)
    this.textureService = new Cinema2AssetTextureService(gl, cinema2TextureAssetRegistry, { budgetBytes: textureBudgetBytes(initialPolicy.gpuMemoryBudgetBytes) })
    this.shadowService = new Cinema2ShadowService(gl, this.activeRenderQuality)
    let effectRuntime: Cinema2EffectRuntime | null = null
    let moduleRuntime: Cinema2ModuleRuntime | null = null
    const boundActionParameters = indexBoundActionParameters(compiledPresetPlan)
    this.targetResolver = new Cinema2FinalValueResolver(compiledPresetPlan.targets, {
      resolveBaseValue: target => target.parameterId == null
        ? target.authoredBaseValue
        : parameterState.getValue(target.parameterId),
      dispatchAction: event => {
        const parameterId = boundActionParameters.get(event.targetId)
        if (!parameterId) return
        effectRuntime?.dispatchParameterAction(parameterId, event.eventId)
        moduleRuntime?.dispatchParameterAction(parameterId, event)
      },
    })
    this.spatialRuntime = new Cinema2SpatialRuntime(compiledPresetPlan.scene, compiledPresetPlan.targets.targets, this.targetResolver)
    this.cameraRuntime = new Cinema2CameraRuntime(compiledPresetPlan, parameterState, this.targetResolver, this.spatialRuntime)
    const renderQuality = this.activeRenderQuality
    this.lightingEnvironmentRuntime = new Cinema2LightingEnvironmentRuntime(
      compiledPresetPlan,
      this.targetResolver,
      this.spatialRuntime,
      renderQuality,
    )
    this.choreographyRuntime = new Cinema2ChoreographyRuntime(compiledPresetPlan, parameterState, this.targetResolver, this.randomService)
    this.mediaSlotRuntime = new Cinema2MediaSlotRuntime(gl, compiledPresetPlan.manifest.mediaSlots ?? [], options.mediaLoader)
    this.moduleRuntime = new Cinema2ModuleRuntime(gl, compiledPresetPlan, this.targetResolver, moduleRegistry, this.mediaSlotRuntime, this.randomService, this.textureService)
    moduleRuntime = this.moduleRuntime
    this.effectRuntime = new Cinema2EffectRuntime(gl, compiledPresetPlan, this.targetResolver, effectRegistry, renderQuality, this.historyService, this.textureService)
    effectRuntime = this.effectRuntime
    this.renderGraphExecutor = new Cinema2RenderGraphExecutor(gl, compiledPresetPlan.render, compiledPresetPlan.scene, parameterState, this.resourceManager, {
      quality: renderQuality,
      availableCapabilities: CINEMA2_RUNTIME_AVAILABLE_CAPABILITIES,
      effectRuntime: this.effectRuntime,
      spatialRuntime: this.spatialRuntime,
      cameraRuntime: this.cameraRuntime,
      lightingEnvironmentRuntime: this.lightingEnvironmentRuntime,
      shadowService: this.shadowService,
      targetResolver: this.targetResolver,
      debugVisibilityReadback: options.debugVisibilityReadback === true,
    })
    this.contextHandle = registerDrmvyzWebGLContext(gl, {
      lifetime: 'live-reusable',
      role: 'react-live-canvas',
      engine: 'cinema2',
      expectedMaxActive: 1,
    })

    this.onContextLostHandler = event => {
      if (this.disposed || this.phase === 'unavailable') return
      event.preventDefault()
      this.contextLost = true
      this.phase = 'context-lost'
      this.statusMessage = 'Cinema 2.0 paused because its WebGL2 context was lost.'
      this.cancelScheduledFrame()
      this.lastFrameTimestampMs = null
      this.runCleanupSteps('context loss', [
        ['choreography', () => this.choreographyRuntime.reset('context-lost')],
        ['camera', () => this.cameraRuntime.reset()],
        ['render graph', () => this.renderGraphExecutor.handleContextLost()],
        ['effects', () => this.effectRuntime.handleContextLost()],
        ['textures', () => this.textureService.handleContextLost()],
        ['shadows', () => this.shadowService.handleContextLost()],
        ['history', () => this.historyService.handleContextLost()],
        ['modules', () => this.moduleRuntime.handleContextLost()],
        ['media', () => this.mediaSlotRuntime.handleContextLost()],
        ['resources', () => this.resourceManager.handleContextLost()],
        ['performance diagnostics', () => this.performanceDiagnostics.handleContextLost()],
      ])
      this.emitSnapshot()
    }

    this.onContextRestoredHandler = () => {
      if (this.disposed || this.phase === 'unavailable') return
      this.contextLost = false
      this.contextGeneration += 1
      this.statusMessage = null
      try {
        this.cameraRuntime.reset()
        this.performanceDiagnostics.handleContextRestored()
        this.resourceManager.handleContextRestored()
        this.textureService.handleContextRestored()
        this.shadowService.handleContextRestored()
        this.historyService.handleContextRestored()
        this.renderGraphExecutor.handleContextRestored()
        this.effectRuntime.handleContextRestored()
        this.mediaSlotRuntime.handleContextRestored()
        this.moduleRuntime.handleContextRestored()
        this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)
        this.renderSafeFrame()
        this.phase = this.suspended ? 'suspended' : this.runningRequested ? 'running' : 'initializing'
        this.refreshRecoverableStatus()
        this.emitSnapshot()
        this.scheduleFrame()
      } catch (error) {
        this.failUnrecoverably('Cinema 2.0 could not recover its WebGL2 context', error)
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
      this.retireOwnedServices('setup failure')
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

    try {
      this.resourceManager.resize(nextViewport)
    } catch (error) {
      this.performanceDiagnostics.markDegraded(`Resize was isolated: ${errorMessage(error)}`)
      this.statusMessage = 'Cinema 2.0 kept the previous output size because render targets could not be resized safely.'
      this.emitSnapshot()
      return false
    }

    this.viewport = nextViewport
    this.canvas.width = nextViewport.width
    this.canvas.height = nextViewport.height
    this.historyService.handleResize()
    if (!this.contextLost) {
      try {
        this.gl.viewport(0, 0, nextViewport.width, nextViewport.height)
        this.renderSafeFrame()
      } catch (error) {
        this.failUnrecoverably('Cinema 2.0 stopped after an unrecoverable resize output failure', error)
        return false
      }
    }
    if (this.performanceDiagnostics.getSnapshot().degradationReason?.startsWith('Resize was isolated:')) {
      this.performanceDiagnostics.markDegraded(null)
    }
    this.refreshRecoverableStatus()
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

  /** Final target-resolved world/screen Scene Graph view used by native render providers. */
  getSpatialRuntime(): Cinema2SpatialRuntime {
    return this.spatialRuntime
  }

  /** Final semantic world-camera authority for the active Cinema 2.0 preset. */
  getCameraRuntimeSnapshot(): Readonly<Cinema2CameraRuntimeSnapshot> {
    return this.cameraRuntime.getSnapshot()
  }

  /** Shared target-resolved Lighting/Environment service used by native spatial rendering. */
  getLightingEnvironmentRuntimeSnapshot(): Readonly<Cinema2LightingEnvironmentRuntimeSnapshot> {
    return this.lightingEnvironmentRuntime.getSnapshot()
  }

  /** Current host transport truth sampled by the visual clock. */
  getTransportFrameState(): Readonly<Cinema2TransportFrameState> | null {
    return this.lastTransportState
  }

  /** Audio-gated visual time supplied to modules, cameras, choreography and effects. */
  getVisualElapsedTimeSec(): number {
    return this.visualElapsedTimeSec
  }

  /** Most recent immutable Audio Intelligence snapshot captured for a visual frame. */
  getAudioIntelligenceFrame(): Readonly<Cinema2AudioIntelligenceFrame> | null {
    return this.audioIntelligenceFrame
  }

  /** Most recent generic, read-only significance frame derived from Audio Intelligence. */
  getVisualDirectorFrame(): Readonly<Cinema2VisualDirectorFrame> | null {
    return this.visualDirectorFrame
  }

  /** Engine-owned namespaced randomness used by choreography and future native modules. */
  getRandomService(): Cinema2RandomService {
    return this.randomService
  }

  /** Transient preset-mapping state owned by the engine choreography service. */
  getChoreographyRuntimeSnapshot(): Readonly<Cinema2ChoreographyRuntimeSnapshot> {
    return this.choreographyRuntime.getSnapshot()
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

  /** Canonical temporal service snapshot for lifecycle/resource diagnostics. */
  getHistoryServiceSnapshot(): Readonly<Cinema2HistoryServiceSnapshot> {
    return this.historyService.getSnapshot()
  }

  getShadowServiceSnapshot(): Readonly<Cinema2ShadowServiceSnapshot> {
    return this.shadowService.getSnapshot()
  }

  getTextureServiceSnapshot(): Readonly<Cinema2AssetTextureServiceSnapshot> {
    return this.textureService.getSnapshot()
  }

  getEffectRuntimeSnapshot(): Readonly<Cinema2EffectRuntimeSnapshot> {
    return this.effectRuntime.getSnapshot()
  }

  getRenderGraphExecutorSnapshot(): Readonly<Cinema2RenderGraphExecutorSnapshot> {
    return this.renderGraphExecutor.getSnapshot()
  }

  getPerformanceSnapshot(): Readonly<Cinema2PerformanceSnapshot> {
    return this.performanceDiagnostics.getSnapshot()
  }

  getDiagnosticsSnapshot(): Readonly<{
    presetId: Cinema2PresetId
    performance: Readonly<Cinema2PerformanceSnapshot>
    resources: Readonly<Cinema2ResourceManagerSnapshot>
    render: Readonly<Cinema2RenderGraphExecutorSnapshot>
    modules: Readonly<Cinema2ModuleRuntimeSnapshot>
  }> {
    return Object.freeze({
      presetId: this.compiledPresetPlan.presetId,
      performance: this.performanceDiagnostics.getSnapshot(),
      resources: this.resourceManager.getSnapshot(),
      render: this.renderGraphExecutor.getSnapshot(),
      modules: this.moduleRuntime.getSnapshot(),
    })
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
      performance: this.performanceDiagnostics.getSnapshot(),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.runningRequested = false
    this.cancelScheduledFrame()

    this.releaseExternalOwnership()
    this.retireOwnedServices('runtime disposal')

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
    const background = this.lightingEnvironmentRuntime.getFrame().environment.backgroundColor
    this.gl.clearColor(background[0], background[1], background[2], background[3])
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
      const cpuFrameStartedAt = readMonotonicTimeMs()
      const qualityChanged = this.applyPerformancePolicy()
      const visualFrameId = this.frameCount + 1
      const safeTimestampMs = Number.isFinite(timestampMs) ? Math.max(0, timestampMs) : (this.lastFrameTimestampMs ?? 0)
      const rawDeltaTimeSec = this.lastFrameTimestampMs == null
        ? 0
        : Math.min(0.1, Math.max(0, (safeTimestampMs - this.lastFrameTimestampMs) / 1000))
      this.lastFrameTimestampMs = safeTimestampMs

      const transport = normalizeTransportState(this.transportSource)
      const deltaTimeSec = transport.animationActive ? rawDeltaTimeSec : 0
      this.visualElapsedTimeSec = Math.max(0, this.visualElapsedTimeSec + deltaTimeSec)

      const sourceRemoved = this.lastTransportState?.sourcePresent === true && !transport.sourcePresent
      if (sourceRemoved) {
        this.visualDirector.reset()
        this.visualDirectorFrame = null
        this.choreographyRuntime.reset('transport-inactive')
        this.cameraRuntime.reset()
        this.historyService.resetAll('deactivation')
      }
      this.lastTransportState = transport

      this.audioIntelligenceFrame = this.audioIntelligenceBridge.capture(visualFrameId)
      const frameAudio = transport.analysisActive ? this.audioIntelligenceFrame : null
      this.visualDirectorFrame = frameAudio ? this.visualDirector.capture(frameAudio) : null
      if (frameAudio?.discontinuity.occurred && frameAudio.discontinuity.reason !== 'activation') {
        this.historyService.resetAll('discontinuity')
      }
      this.mediaSlotRuntime.updateVideoTextures()
      const frame = Object.freeze({
        frameId: visualFrameId,
        timestampMs: safeTimestampMs,
        deltaTimeSec,
        elapsedTimeSec: this.visualElapsedTimeSec,
        viewport: Object.freeze({ ...this.viewport }),
        contextGeneration: this.contextGeneration,
        transport,
        audio: frameAudio,
        director: this.visualDirectorFrame,
      })
      this.choreographyRuntime.update(frame)
      this.lightingEnvironmentRuntime.update()
      this.cameraRuntime.update(frame)
      this.moduleRuntime.update(frame)
      this.performanceDiagnostics.beginGpuFrame()
      try {
        this.renderGraphExecutor.executeFrame(frame, this.moduleRuntime.getRenderPassProviders())
      } finally {
        this.performanceDiagnostics.endGpuFrame()
      }
      const budgetDiagnostic = this.renderGraphExecutor.getSnapshot().diagnostics.find(
        diagnostic => diagnostic.code === 'CINEMA2_RENDER_RESOURCE_BUDGET_EXCEEDED',
      )
      this.performanceDiagnostics.markDegraded(budgetDiagnostic?.message ?? null)
      this.frameCount = visualFrameId
      const autoQualityChanged = this.performanceDiagnostics.sampleCpuFrame(Math.max(0, readMonotonicTimeMs() - cpuFrameStartedAt))
      if (autoQualityChanged) this.applyPerformancePolicy()
      const recoveryStatusChanged = this.refreshRecoverableStatus()
      if (qualityChanged || autoQualityChanged || recoveryStatusChanged) this.emitSnapshot()
    } catch (error) {
      this.runCleanupSteps('frame failure', [['choreography', () => this.choreographyRuntime.reset('frame-failure')]])
      this.failUnrecoverably('Cinema 2.0 stopped after an unrecoverable frame failure', error)
      return
    }
    this.scheduleFrame()
  }

  private refreshRecoverableStatus(): boolean {
    if (this.phase === 'unavailable' || this.phase === 'context-lost') return false
    const performanceSnapshot = this.performanceDiagnostics.getSnapshot()
    const renderSnapshot = this.renderGraphExecutor.getSnapshot()
    const moduleSnapshot = this.moduleRuntime.getSnapshot()
    const effectSnapshot = this.effectRuntime.getSnapshot()
    const mediaSnapshot = this.mediaSlotRuntime.getSnapshot()
    const textureSnapshot = this.textureService.getSnapshot()
    const loadedAssetBytes = moduleSnapshot.estimatedGpuBytes + textureSnapshot.estimatedGpuBytes + this.shadowService.getSnapshot().estimatedGpuBytes
    let next: string | null = null
    if (performanceSnapshot.degradationReason?.startsWith('Resize was isolated:')) {
      next = 'Cinema 2.0 kept the previous output size because render targets could not be resized safely.'
    } else if (renderSnapshot.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA2_RENDER_RESOURCE_BUDGET_EXCEEDED')) {
      next = 'Cinema 2.0 is running with a constrained render path because the GPU resource budget was reached.'
    } else if (
      loadedAssetBytes > 0
      && loadedAssetBytes + this.resourceManager.getSnapshot().estimatedGpuMemoryBytes > performanceSnapshot.gpuMemoryBudgetBytes
    ) {
      next = 'Cinema 2.0 is running above its GPU memory budget because of loaded 3D assets.'
    } else if (moduleSnapshot.failedModuleCount > 0) {
      next = 'Cinema 2.0 is still running after isolating a failed visual module.'
    } else if (moduleSnapshot.degradedModuleCount > 0) {
      next = 'Cinema 2.0 is still running while a visual module skips an asset it could not load.'
    } else if (textureSnapshot.failedTextureCount > 0) {
      next = 'Cinema 2.0 is still running while an effect skips a texture it could not load.'
    } else if (effectSnapshot.failedEffectCount > 0) {
      next = 'Cinema 2.0 is still running with a failed effect safely bypassed.'
    } else if (renderSnapshot.diagnostics.length > 0) {
      next = 'Cinema 2.0 is still running with a failed render pass isolated safely.'
    } else if (mediaSnapshot.errorCount > 0) {
      next = 'Cinema 2.0 is still running while a media source failed or is unavailable.'
    }
    if (next === this.statusMessage) return false
    this.statusMessage = next
    return true
  }

  private failUnrecoverably(prefix: string, error: unknown): void {
    this.runningRequested = false
    this.cancelScheduledFrame()
    this.phase = 'unavailable'
    this.statusMessage = `${prefix}: ${errorMessage(error)} Reselect the preset or engine to retry.`
    this.releaseExternalOwnership()
    this.retireOwnedServices('unrecoverable failure')
    this.emitSnapshot()
  }

  private releaseExternalOwnership(): void {
    if (this.listenersAttached) {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLostHandler)
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredHandler)
      this.listenersAttached = false
      diagnostics.activeEventListenerCount = Math.max(0, diagnostics.activeEventListenerCount - 2)
    }
    if (this.contextOwned) {
      retireDrmvyzWebGLContext(this.contextHandle, 'release-resources')
      this.contextOwned = false
      diagnostics.activeWebGLContextCount = Math.max(0, diagnostics.activeWebGLContextCount - 1)
    }
  }

  private retireOwnedServices(reason: string): void {
    if (this.servicesRetired) return
    this.servicesRetired = true
    this.runCleanupSteps(reason, [
      ['render graph', () => this.renderGraphExecutor.dispose()],
      ['performance diagnostics', () => this.performanceDiagnostics.dispose()],
      ['camera', () => this.cameraRuntime.dispose()],
      ['lighting/environment', () => this.lightingEnvironmentRuntime.dispose()],
      ['spatial runtime', () => this.spatialRuntime.dispose()],
      ['choreography', () => this.choreographyRuntime.dispose()],
      ['effects', () => this.effectRuntime.dispose()],
      ['textures', () => this.textureService.dispose()],
      ['shadows', () => this.shadowService.dispose()],
      ['history', () => this.historyService.dispose()],
      ['modules', () => this.moduleRuntime.dispose()],
      ['media', () => this.mediaSlotRuntime.dispose()],
      ['resources', () => this.resourceManager.dispose()],
    ])
  }

  private runCleanupSteps(reason: string, steps: readonly (readonly [string, () => void])[]): void {
    for (const [label, cleanup] of steps) {
      try {
        cleanup()
      } catch (error) {
        if (import.meta.env.DEV) console.warn(`[Cinema2Runtime] ${reason} ${label} cleanup failed:`, error)
      }
    }
  }

  private resolveRequestedQualityMode(): Cinema2QualityMode {
    if (this.renderQualityOverride === 'low') return 'performance'
    if (this.renderQualityOverride === 'medium') return 'balanced'
    if (this.renderQualityOverride === 'high') return 'quality'
    return readCinema2QualityMode(this.parameterState.getValue(CINEMA2_QUALITY_MODE_PARAMETER_ID))
  }

  private applyPerformancePolicy(): boolean {
    const mode = this.resolveRequestedQualityMode()
    this.performanceDiagnostics.setRequestedMode(mode)
    const policy = this.performanceDiagnostics.getPolicy()
    const quality = this.renderQualityOverride ?? policy.resolvedQuality
    const currentResources = this.resourceManager.getSnapshot()
    const changed = quality !== this.activeRenderQuality
      || Math.abs(currentResources.renderTargetScale - policy.renderTargetScale) > 1e-6
      || Math.abs(currentResources.maximumEstimatedGpuMemoryBytes - policy.gpuMemoryBudgetBytes) > 1
    if (!changed) return false
    this.activeRenderQuality = quality
    this.renderGraphExecutor.setQuality(quality)
    this.effectRuntime.setQuality(quality)
    this.textureService.setBudgetBytes(textureBudgetBytes(policy.gpuMemoryBudgetBytes))
    this.shadowService.setQuality(quality)
    this.lightingEnvironmentRuntime.setQuality(quality)
    try {
      const resourceSnapshot = this.resourceManager.getSnapshot()
      if (Math.abs(resourceSnapshot.renderTargetScale - policy.renderTargetScale) > 1e-6) this.historyService.handleResize()
      this.resourceManager.setBudgetPolicy({
        maximumEstimatedGpuMemoryBytes: policy.gpuMemoryBudgetBytes,
        renderTargetScale: policy.renderTargetScale,
      })
      this.performanceDiagnostics.markDegraded(null)
    } catch (error) {
      this.performanceDiagnostics.markDegraded(`Resource policy update was constrained: ${errorMessage(error)}`)
    }
    return true
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

function readMonotonicTimeMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
  return Date.now()
}

/** Shipped textures may take at most a fifth of the tier's GPU budget, so render targets, history and models keep the rest. */
function textureBudgetBytes(gpuMemoryBudgetBytes: number): number {
  return Math.max(8 * 1024 * 1024, Math.floor(gpuMemoryBudgetBytes * 0.2))
}
