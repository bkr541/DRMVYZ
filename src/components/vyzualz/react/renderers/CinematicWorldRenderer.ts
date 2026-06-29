import type { MusicIntelligenceFrame, SectionSource } from '../../../../features/musicIntelligence/types'
import type {
  CinematicAudioTarget,
  CinematicCameraRig,
  CinematicTransitionMode,
  CinematicWorldConfig,
  CinematicWorldMode,
} from '../CinematicWorldConfig'
import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import type { FullscreenPass } from '../shaders/runtime/FullscreenPass'
import type { ShaderCompiler } from '../shaders/runtime/ShaderCompiler'
import type { ShaderFramebuffer } from '../shaders/runtime/ShaderFramebuffer'
import type { ShaderProgram, ShaderProgramDescriptor } from '../shaders/runtime/ShaderProgram'
import type { ShaderResourceManager } from '../shaders/runtime/ShaderResourceManager'
import type { ShaderTexture } from '../shaders/runtime/ShaderTexture'
import type { FramebufferDescriptor, TextureDescriptor } from '../shaders/runtime/shaderRuntimeTypes'
import {
  CinematicAudioFrameNormalizer,
  CinematicModulationEngine,
  type CinematicMappingValidationIssue,
  type CinematicModulationSnapshot,
  type CinematicNormalizedAudioFrame,
} from './cinematic/CinematicAudioModulation'
import {
  CinematicCameraSystem,
  type CinematicCameraFrame,
} from './cinematic/CinematicCameraDirector'
import type { CinematicWorldDirection } from './cinematic/CinematicWorldDirection'

export const CINEMATIC_DIAGNOSTIC_WORLD_ID = '__diagnostic' as const
export type CinematicWorldId = CinematicWorldMode | typeof CINEMATIC_DIAGNOSTIC_WORLD_ID
export type CinematicWorldBackend = 'canvas2d' | 'webgl2'

export interface CinematicViewport {
  /** Backing-store width in device pixels. */
  width: number
  /** Backing-store height in device pixels. */
  height: number
  /** Effective device-pixel ratio used to produce the backing store. */
  dpr: number
}

export interface CinematicAudioBands {
  bass: number
  mid: number
  high: number
  volume: number
}

export interface CinematicBeatState {
  hit: boolean
  phase: number
  bpm: number
  kick: number
  snare: number
  transient: number
  beatIndex: number
  beatInBar: number
  barIndex: number
  barProgress: number
  downbeat: boolean
}

export interface CinematicTrackSectionState {
  type: ReactSectionType | null
  startSec: number
  endSec: number
  progress: number
  changed: boolean
  analysis: MusicIntelligenceFrame | null
  label?: string
  intensity?: number
  confidence?: number
  source?: SectionSource | 'unknown'
}

export interface CinematicTransitionState {
  mode: CinematicTransitionMode
  active: boolean
  progress: number
  fromWorld: CinematicWorldId | null
  toWorld: CinematicWorldId
}

/**
 * One normalized, renderer-agnostic frame object supplied to every Cinematic
 * World. Future worlds must consume this contract rather than reaching back
 * into React component state or starting their own animation loops.
 */
export interface CinematicFrameContext {
  elapsedTimeSec: number
  deltaTimeSec: number
  /** Set on the first frame after a long suspension or visibility-clock reset. */
  timingDiscontinuity?: boolean
  transportTimeSec: number
  isPlaying?: boolean
  frameIndex: number
  resolution: { width: number; height: number }
  devicePixelRatio: number
  audio: {
    raw: CinematicAudioBands
    smoothed: CinematicAudioBands
    spectrum: Uint8Array<ArrayBuffer> | null
    waveform: Uint8Array<ArrayBuffer> | null
  }
  beat: CinematicBeatState
  /** Capability-safe, analyzer-backed musical values prepared by the host. */
  musicalAudio?: CinematicNormalizedAudioFrame
  /** Bounded source-to-target modulation values prepared once per frame. */
  modulation?: CinematicModulationSnapshot
  /** Reusable camera/director output. Only Cinematic Worlds consume this field. */
  camera?: CinematicCameraFrame
  section: CinematicTrackSectionState
  config: CinematicWorldConfig
  transition: CinematicTransitionState
  randomSeed: number
  preset: ReactPreset
  presetId: string
  params: ReactRenderParams
  /** Internal-only override used by diagnostics and focused lifecycle tests. */
  requestedWorldId?: CinematicWorldId
}

export type CinematicWorldRenderInput = CinematicFrameContext

export interface CinematicRendererInitializeInput {
  context: CanvasRenderingContext2D
  config: CinematicWorldConfig
  presetId: string
}

export type CinematicRendererResetReason =
  | 'presetChanged'
  | 'worldChanged'
  | 'structuralConfigurationChanged'
  | 'contextRestored'
  | 'manualReset'
  | 'dispose'

/** Canvas2D compatibility renderer contract, currently used by legacyPortal. */
export interface CinematicWorldRenderer {
  initialize(input: CinematicRendererInitializeInput): void
  resize(viewport: CinematicViewport): void
  render(input: CinematicFrameContext): void
  reset(reason: CinematicRendererResetReason): void
  dispose(): void
}

export interface CinematicWorldRenderTarget {
  framebuffer: WebGLFramebuffer | null
  texture: WebGLTexture | null
  width: number
  height: number
}

/** Reusable WebGL services owned by the dedicated cinematic runtime. */
export interface CinematicWebGLServices {
  gl: WebGL2RenderingContext
  compiler: ShaderCompiler
  fullscreenPass: FullscreenPass
  resources: ShaderResourceManager
  compileProgram(descriptor: ShaderProgramDescriptor): ShaderProgram
  createFramebuffer(descriptor?: FramebufferDescriptor): ShaderFramebuffer
  createTexture(descriptor?: TextureDescriptor): ShaderTexture
}

export interface CinematicWebGLWorldInitializeInput {
  services: CinematicWebGLServices
  config: CinematicWorldConfig
  presetId: string
}

export interface CinematicWebGLWorldRenderer {
  initialize(input: CinematicWebGLWorldInitializeInput): void
  resize(viewport: CinematicViewport): void
  render(frame: CinematicFrameContext, target: CinematicWorldRenderTarget): void
  reset(reason: CinematicRendererResetReason): void
  onContextLost?(): void
  onContextRestored?(): void
  /** Optional non-fatal status rendered as a readable overlay by the host. */
  getDiagnostic?(): string | null
  dispose(): void
}

export interface CinematicWorldCapabilities {
  backend: CinematicWorldBackend
  cameraRigs: readonly CinematicCameraRig[]
  modulationTargets: readonly CinematicAudioTarget[]
  supportsGeometryPasses: boolean
  supportsFullscreenPasses: boolean
  supportsTextureInputs: boolean
  supportsPostProcessing: boolean
  supportsFeedback: boolean
}

interface CinematicWorldDefinitionBase {
  id: CinematicWorldId
  label: string
  internal?: boolean
  capabilities: CinematicWorldCapabilities
  direction?: CinematicWorldDirection
}

export interface CinematicCanvasWorldDefinition extends CinematicWorldDefinitionBase {
  backend: 'canvas2d'
  create: () => CinematicWorldRenderer
}

export interface CinematicWebGLWorldDefinition extends CinematicWorldDefinitionBase {
  backend: 'webgl2'
  create: () => CinematicWebGLWorldRenderer
}

export type CinematicWorldDefinition = CinematicCanvasWorldDefinition | CinematicWebGLWorldDefinition

/** Formal world registry. Duplicate IDs are rejected instead of silently overwritten. */
export class CinematicWorldRendererRegistry {
  private readonly definitions = new Map<CinematicWorldId, CinematicWorldDefinition>()

  register(definition: CinematicWorldDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Cinematic world "${definition.id}" is already registered`)
    }
    if (definition.capabilities.backend !== definition.backend) {
      throw new Error(`Cinematic world "${definition.id}" capability backend does not match its renderer backend`)
    }
    this.definitions.set(definition.id, definition)
  }

  resolve(id: CinematicWorldId): CinematicWorldDefinition | null {
    return this.definitions.get(id) ?? null
  }

  list(options: { includeInternal?: boolean } = {}): CinematicWorldDefinition[] {
    return [...this.definitions.values()].filter(definition => options.includeInternal || !definition.internal)
  }
}

export interface CinematicWebGLRuntimeRenderResult {
  ok: boolean
  error: string | null
  /** True when the same runtime may recover, for example after context restoration. */
  recoverable?: boolean
  /** Non-fatal issue while a valid frame is still produced. */
  warning?: string | null
}

export interface CinematicWebGLRuntimeLike {
  render(definition: CinematicWebGLWorldDefinition, frame: CinematicFrameContext): CinematicWebGLRuntimeRenderResult
  reset(reason: CinematicRendererResetReason): void
  dispose(): void
}

export type CinematicWebGLRuntimeFactory = (
  outputContext: CanvasRenderingContext2D,
) => CinematicWebGLRuntimeLike | null

function viewportOf(frame: CinematicFrameContext): CinematicViewport {
  return {
    width: frame.resolution.width,
    height: frame.resolution.height,
    dpr: frame.devicePixelRatio,
  }
}

function viewportChanged(a: CinematicViewport | null, b: CinematicViewport): boolean {
  return a == null || a.width !== b.width || a.height !== b.height || a.dpr !== b.dpr
}

/** Resource identity only. Live controls and presets are supplied as uniforms. */
export function cinematicStructuralKey(input: CinematicFrameContext): string {
  return JSON.stringify({
    requestedWorldId: input.requestedWorldId ?? input.config.worldMode,
    seed: input.config.seed,
  })
}

export function cinematicPresentationKey(input: CinematicFrameContext): string {
  return `${input.requestedWorldId ?? input.config.worldMode}::${input.presetId}`
}

function cinematicFailureKey(input: CinematicFrameContext): string {
  return JSON.stringify({
    world: input.requestedWorldId ?? input.config.worldMode,
    presetId: input.presetId,
    config: input.config,
    resolution: input.resolution,
    devicePixelRatio: input.devicePixelRatio,
  })
}

export function cinematicTransitionProgress(
  elapsedTimeSec: number,
  startedAtSec: number,
  durationMs: number,
  easing: CinematicWorldConfig['transition']['easing'],
): number {
  const durationSec = Math.max(0, durationMs) / 1000
  const linear = durationSec <= 0 ? 1 : clamp01((elapsedTimeSec - startedAtSec) / durationSec)
  switch (easing) {
    case 'easeIn': return linear * linear
    case 'easeOut': return 1 - (1 - linear) * (1 - linear)
    case 'easeInOut': return linear * linear * (3 - 2 * linear)
    default: return linear
  }
}

function resetReason(
  previous: CinematicFrameContext | null,
  next: CinematicFrameContext,
): CinematicRendererResetReason {
  if (!previous || previous.presetId !== next.presetId) return 'presetChanged'
  const previousWorld = previous.requestedWorldId ?? previous.config.worldMode
  const nextWorld = next.requestedWorldId ?? next.config.worldMode
  if (previousWorld !== nextWorld) return 'worldChanged'
  return 'structuralConfigurationChanged'
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function readMiNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : 0
}

const EMPTY_AUDIO_ROUTES: readonly [] = []

/**
 * Owns one active renderer for one visible Canvas2D context. WebGL worlds render
 * on a dedicated offscreen WebGL2 canvas and are composited into this context;
 * legacyPortal continues to draw directly into the existing shared canvas.
 */
export class CinematicWorldRendererHost {
  private canvasRenderer: CinematicWorldRenderer | null = null
  private canvasDefinitionId: CinematicWorldId | null = null
  private canvasKey: string | null = null
  private canvasViewport: CinematicViewport | null = null
  private webglRuntime: CinematicWebGLRuntimeLike | null = null
  private previousInput: CinematicFrameContext | null = null
  private readonly audioNormalizer = new CinematicAudioFrameNormalizer()
  private readonly modulationEngine = new CinematicModulationEngine()
  private readonly cameraSystem = new CinematicCameraSystem()
  private mappingIssues: readonly CinematicMappingValidationIssue[] = []
  private lastError: string | null = null
  private lastWarning: string | null = null
  private presentationKey: string | null = null
  private presentationWorld: CinematicWorldId | null = null
  private transitionSnapshot: HTMLCanvasElement | null = null
  private transitionStartedAtSec = 0
  private transitionFromWorld: CinematicWorldId | null = null
  private failedWebglKey: string | null = null
  private failedWebglError: string | null = null

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly registry: CinematicWorldRendererRegistry,
    private readonly fallbackMode: CinematicWorldMode = 'legacyPortal',
    private readonly createWebGLRuntime?: CinematicWebGLRuntimeFactory,
  ) {}

  get error(): string | null { return this.lastError }
  get warning(): string | null { return this.lastWarning }
  get audioMappingIssues(): readonly CinematicMappingValidationIssue[] { return this.mappingIssues }

  render(input: CinematicFrameContext): void {
    const requestedId = input.requestedWorldId ?? input.config.worldMode
    const requestedDefinition = this.registry.resolve(requestedId)
    const definition = requestedDefinition ?? this.registry.resolve(this.fallbackMode)

    if (!definition) {
      this.drawReadableError(`No cinematic renderer registered for ${requestedId} or fallback ${this.fallbackMode}`)
      return
    }

    const transitionStarted = this.beginTransition(input)
    if (transitionStarted && !input.config.transition.preserveCamera) this.cameraSystem.reset()
    const frame = this.withTransitionState(this.prepareFrame(input, definition), requestedId)

    try {
      if (definition.backend === 'webgl2') {
        const failureKey = cinematicFailureKey(frame)
        const result = this.failedWebglKey === failureKey
          ? { ok: false, error: this.failedWebglError ?? 'Cinematic WebGL world failed', recoverable: false }
          : this.renderWebGL(definition, frame)
        if (result.ok) {
          this.failedWebglKey = null
          this.failedWebglError = null
          this.lastError = null
          this.lastWarning = result.warning ?? null
          this.drawTransition(frame)
          if (this.lastWarning) this.drawReadableWarning(this.lastWarning)
          this.completeFrame(frame, requestedId)
          return
        }
        this.lastError = result.error
        this.lastWarning = result.error
        if (result.recoverable !== true) {
          this.failedWebglKey = failureKey
          this.failedWebglError = result.error
        }
        const fallback = this.registry.resolve(this.fallbackMode)
        if (fallback?.backend === 'canvas2d') {
          this.renderCanvas(fallback, frame, result.recoverable === true)
          this.drawTransition(frame)
          this.drawReadableWarning(result.error ?? 'Cinematic WebGL world failed; legacy fallback active')
        } else {
          this.drawReadableError(result.error ?? 'Cinematic WebGL world failed')
        }
        this.completeFrame(frame, requestedId)
        return
      }

      this.renderCanvas(definition, frame)
      this.lastError = null
      this.lastWarning = null
      this.drawTransition(frame)
      this.completeFrame(frame, requestedId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastError = message
      this.lastWarning = message
      this.drawReadableError(message)
      this.completeFrame(frame, requestedId)
    }
  }

  reset(): void {
    this.canvasRenderer?.reset('manualReset')
    this.webglRuntime?.reset('manualReset')
    this.canvasKey = null
    this.previousInput = null
    this.audioNormalizer.reset()
    this.modulationEngine.reset('manual')
    this.cameraSystem.reset()
    this.mappingIssues = []
    this.clearTransition()
    this.presentationKey = null
    this.presentationWorld = null
    this.failedWebglKey = null
    this.failedWebglError = null
  }

  dispose(): void {
    this.disposeCanvasRenderer('dispose')
    this.webglRuntime?.dispose()
    this.webglRuntime = null
    this.previousInput = null
    this.audioNormalizer.reset()
    this.modulationEngine.reset('manual')
    this.cameraSystem.reset()
    this.mappingIssues = []
    this.lastError = null
    this.lastWarning = null
    this.clearTransition()
    this.presentationKey = null
    this.presentationWorld = null
    this.failedWebglKey = null
    this.failedWebglError = null
  }

  private prepareFrame(
    input: CinematicFrameContext,
    definition: CinematicWorldDefinition,
  ): CinematicFrameContext {
    const analysis = input.section.analysis
    const musicalAudio = this.audioNormalizer.update({
      frameIndex: input.frameIndex,
      deltaTimeSec: input.deltaTimeSec,
      transportTimeSec: input.transportTimeSec,
      isPlaying: input.isPlaying ?? true,
      beatHit: input.beat.hit,
      beatPhase: input.beat.phase,
      bpm: input.beat.bpm,
      broadBands: input.audio.raw,
      musicIntelligence: analysis,
      section: {
        type: input.section.type,
        label: input.section.label ?? analysis?.section.label ?? '',
        startSec: input.section.startSec,
        endSec: input.section.endSec,
        progress: input.section.progress,
        intensity: input.section.intensity,
        confidence: input.section.confidence ?? analysis?.section.confidence,
        source: input.section.source ?? analysis?.section.source ?? 'unknown',
      },
      sectionChanged: input.section.changed,
      worldId: definition.id,
      presetId: input.presetId,
    })

    const routes = input.config.audioMapping.enabled ? input.config.audioMapping.routes : EMPTY_AUDIO_ROUTES
    const modulation = this.modulationEngine.update(
      musicalAudio,
      routes,
      definition.capabilities.modulationTargets,
      input.deltaTimeSec,
      input.config.audioMapping.smoothingMs,
      input.randomSeed,
    )
    this.mappingIssues = modulation.issues

    const values = musicalAudio.values
    const smoothed: CinematicAudioBands = {
      bass: values.bass,
      mid: values.mid,
      high: values.highs,
      volume: values.overallEnergy,
    }
    const direction = definition.direction ?? {
      supportedCameraRigs: definition.capabilities.cameraRigs,
      safeCameraRange: {
        minDistance: 0.45, maxDistance: 4.5, maxLateral: 1.25,
        minElevation: -0.85, maxElevation: 1.25, minFieldOfView: 34, maxFieldOfView: 82,
      },
      shots: [{
        id: `${definition.id}-compatibility-shot`,
        rig: (definition.capabilities.cameraRigs.find(rig => rig !== 'autoDirector') ?? 'locked') as Exclude<CinematicCameraRig, 'autoDirector'>,
        sections: ['unknown'] as const,
        action: 'hold' as const,
      }],
      dropActions: ['impact'] as const,
      revealActions: ['reveal'] as const,
      retreatActions: ['retreat'] as const,
    }
    const camera = this.cameraSystem.update({
      worldId: definition.id,
      direction,
      requestedRig: input.config.cameraRig,
      camera: input.config.camera,
      audio: musicalAudio,
      transportTimeSec: input.transportTimeSec,
      deltaTimeSec: input.deltaTimeSec,
      isPlaying: musicalAudio.isPlaying,
      seed: input.randomSeed,
    })
    return {
      ...input,
      isPlaying: musicalAudio.isPlaying,
      audio: { ...input.audio, smoothed },
      beat: {
        hit: musicalAudio.events.beat,
        phase: musicalAudio.timing.beatPhase,
        bpm: musicalAudio.timing.bpm,
        kick: values.kickStrength,
        snare: values.snareStrength,
        transient: values.transientIntensity,
        beatIndex: musicalAudio.timing.beatIndex,
        beatInBar: musicalAudio.timing.beatInBar,
        barIndex: musicalAudio.timing.barIndex,
        barProgress: musicalAudio.timing.barPosition,
        downbeat: musicalAudio.events.downbeat,
      },
      section: {
        ...input.section,
        type: musicalAudio.section.type,
        label: musicalAudio.section.label,
        startSec: musicalAudio.section.startSec,
        endSec: musicalAudio.section.endSec,
        progress: musicalAudio.section.progress,
        intensity: musicalAudio.section.intensity,
        confidence: musicalAudio.section.confidence,
        source: musicalAudio.section.source,
      },
      musicalAudio,
      modulation,
      camera,
    }
  }

  private renderCanvas(
    definition: CinematicCanvasWorldDefinition,
    frame: CinematicFrameContext,
    preserveWebGLRuntime = false,
  ): void {
    if (this.webglRuntime && !preserveWebGLRuntime) {
      this.webglRuntime.dispose()
      this.webglRuntime = null
    }

    const nextKey = cinematicStructuralKey(frame)
    if (!this.canvasRenderer || this.canvasDefinitionId !== definition.id || this.canvasKey !== nextKey) {
      this.disposeCanvasRenderer(resetReason(this.previousInput, frame))
      this.canvasRenderer = definition.create()
      this.canvasRenderer.initialize({
        context: this.context,
        config: frame.config,
        presetId: frame.presetId,
      })
      this.canvasDefinitionId = definition.id
      this.canvasKey = nextKey
      this.canvasViewport = null
    }

    const viewport = viewportOf(frame)
    if (viewportChanged(this.canvasViewport, viewport)) {
      this.canvasRenderer.resize(viewport)
      this.canvasViewport = { ...viewport }
    }
    this.canvasRenderer.render(frame)
  }

  private renderWebGL(
    definition: CinematicWebGLWorldDefinition,
    frame: CinematicFrameContext,
  ): CinematicWebGLRuntimeRenderResult {
    this.disposeCanvasRenderer(resetReason(this.previousInput, frame))
    if (!this.createWebGLRuntime) {
      return { ok: false, error: 'Cinematic WebGL runtime is unavailable' }
    }
    if (!this.webglRuntime) {
      this.webglRuntime = this.createWebGLRuntime(this.context)
      if (!this.webglRuntime) {
        return { ok: false, error: 'WebGL2 is unavailable; using legacyPortal fallback' }
      }
    }

    const result = this.webglRuntime.render(definition, frame)
    if (!result.ok && result.recoverable !== true) {
      this.webglRuntime.dispose()
      this.webglRuntime = null
    }
    return result
  }

  private beginTransition(input: CinematicFrameContext): boolean {
    const nextKey = cinematicPresentationKey(input)
    if (this.presentationKey == null || this.presentationKey === nextKey) return false

    this.clearTransition()
    if (input.config.transition.mode === 'cut' || input.config.transition.durationMs <= 0) return true

    const sourceCanvas = this.context.canvas
    if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !(sourceCanvas instanceof HTMLCanvasElement)) {
      return true
    }
    try {
      const snapshot = document.createElement('canvas')
      snapshot.width = Math.max(1, sourceCanvas.width)
      snapshot.height = Math.max(1, sourceCanvas.height)
      const snapshotContext = snapshot.getContext('2d')
      if (!snapshotContext) return true
      snapshotContext.drawImage(sourceCanvas, 0, 0, snapshot.width, snapshot.height)
      this.transitionSnapshot = snapshot
      this.transitionStartedAtSec = input.elapsedTimeSec
      this.transitionFromWorld = this.presentationWorld
    } catch {
      this.clearTransition()
    }
    return true
  }

  private withTransitionState(
    frame: CinematicFrameContext,
    requestedId: CinematicWorldId,
  ): CinematicFrameContext {
    if (!this.transitionSnapshot) {
      return {
        ...frame,
        transition: { ...frame.transition, active: false, progress: 1, fromWorld: null, toWorld: requestedId },
      }
    }
    const progress = cinematicTransitionProgress(
      frame.elapsedTimeSec,
      this.transitionStartedAtSec,
      frame.config.transition.durationMs,
      frame.config.transition.easing,
    )
    return {
      ...frame,
      transition: {
        mode: frame.config.transition.mode,
        active: progress < 1,
        progress,
        fromWorld: this.transitionFromWorld,
        toWorld: requestedId,
      },
    }
  }

  private drawTransition(frame: CinematicFrameContext): void {
    const snapshot = this.transitionSnapshot
    if (!snapshot) return
    const progress = frame.transition.progress
    if (progress >= 1) {
      this.clearTransition()
      return
    }

    const width = this.context.canvas.width || 1
    const height = this.context.canvas.height || 1
    this.context.save()
    this.context.globalCompositeOperation = 'source-over'
    if (frame.transition.mode === 'portalWipe') {
      const radius = Math.hypot(width, height) * 0.55 * (1 - progress)
      this.context.beginPath()
      this.context.arc(width / 2, height / 2, Math.max(0.5, radius), 0, Math.PI * 2)
      this.context.clip()
      this.context.globalAlpha = 1
      this.context.drawImage(snapshot, 0, 0, width, height)
    } else if (frame.transition.mode === 'morph') {
      const insetX = width * progress * 0.025
      const insetY = height * progress * 0.025
      this.context.globalAlpha = (1 - progress) * (1 - progress)
      this.context.drawImage(snapshot, insetX, insetY, width - insetX * 2, height - insetY * 2)
    } else {
      this.context.globalAlpha = 1 - progress
      this.context.drawImage(snapshot, 0, 0, width, height)
    }
    this.context.restore()
  }

  private completeFrame(frame: CinematicFrameContext, requestedId: CinematicWorldId): void {
    this.previousInput = frame
    this.presentationKey = cinematicPresentationKey(frame)
    this.presentationWorld = requestedId
  }

  private clearTransition(): void {
    if (this.transitionSnapshot) {
      this.transitionSnapshot.width = 1
      this.transitionSnapshot.height = 1
    }
    this.transitionSnapshot = null
    this.transitionFromWorld = null
  }

  private disposeCanvasRenderer(reason: CinematicRendererResetReason): void {
    if (this.canvasRenderer) {
      this.canvasRenderer.reset(reason)
      this.canvasRenderer.dispose()
    }
    this.canvasRenderer = null
    this.canvasDefinitionId = null
    this.canvasKey = null
    this.canvasViewport = null
  }

  private drawReadableWarning(message: string): void {
    const canvas = this.context.canvas
    const width = canvas.width || 1
    const height = canvas.height || 1
    this.context.save()
    this.context.fillStyle = 'rgba(6, 8, 12, 0.88)'
    this.context.fillRect(width * 0.08, height * 0.82, width * 0.84, Math.max(34, height * 0.10))
    this.context.fillStyle = '#ffd36a'
    this.context.font = `${Math.max(12, Math.round(14 * (width / 1280)))}px system-ui, sans-serif`
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.context.fillText(`Cinematic Worlds: ${message}`, width / 2, height * 0.87, width * 0.78)
    this.context.restore()
  }

  private drawReadableError(message: string): void {
    const canvas = this.context.canvas
    const width = canvas.width || 1
    const height = canvas.height || 1
    this.context.save()
    this.context.fillStyle = '#06080c'
    this.context.fillRect(0, 0, width, height)
    this.context.fillStyle = '#ff5f7a'
    this.context.font = `${Math.max(12, Math.round(14 * (width / 1280)))}px system-ui, sans-serif`
    this.context.textAlign = 'center'
    this.context.textBaseline = 'middle'
    this.context.fillText(`Cinematic engine error: ${message}`, width / 2, height / 2, width * 0.9)
    this.context.restore()
    this.lastError = message
  }
}

export function cinematicInputFromReactFrame(
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
  config: CinematicWorldConfig,
): CinematicFrameContext {
  const deltaTimeSec = Number.isFinite(frame.deltaTimeSec)
    ? Math.min(0.1, Math.max(0, frame.deltaTimeSec ?? 1 / 60))
    : 1 / 60
  const elapsedTimeSec = Number.isFinite(frame.elapsedTimeSec)
    ? Math.max(0, frame.elapsedTimeSec ?? 0)
    : Math.max(0, frame.t / 60)
  const raw: CinematicAudioBands = {
    bass: clamp01(frame.audio.bass),
    mid: clamp01(frame.audio.mid),
    high: clamp01(frame.audio.high),
    volume: clamp01(frame.audio.volume),
  }
  const mi = frame.musicIntelligence as (MusicIntelligenceFrame & {
    percussion?: { kick?: number; snare?: number }
    rhythm: MusicIntelligenceFrame['rhythm'] & { downbeat?: boolean }
  }) | null
  const rhythm = mi?.rhythm
  const beatInBar = Number.isFinite(rhythm?.beatInBar)
    ? Math.max(0, Math.min(3, Math.floor(rhythm?.beatInBar ?? 0)))
    : -1
  const barProgress = beatInBar >= 0
    ? clamp01((beatInBar + clamp01(frame.beatPhase)) / 4)
    : clamp01(frame.beatPhase)
  const resolved = frame.resolvedSection
  const resolvedType = (resolved?.type ?? sectionType) as ReactSectionType | null
  const sectionStart = resolved?.startSec ?? mi?.section?.startSec ?? -1
  const sectionEnd = resolved?.endSec ?? Number.POSITIVE_INFINITY
  const sectionProgress = resolved?.progress ?? mi?.section?.progress ?? -1

  return {
    elapsedTimeSec,
    deltaTimeSec,
    timingDiscontinuity: Boolean(frame.timingDiscontinuity),
    transportTimeSec: frame.audioTime,
    isPlaying: frame.isPlaying,
    frameIndex: Math.max(0, Math.floor(frame.t)),
    resolution: { width: frame.W, height: frame.H },
    devicePixelRatio: Math.max(0.1, frame.dpr || 1),
    audio: {
      raw,
      smoothed: { ...raw },
      spectrum: frame.freqData,
      waveform: frame.timeDomainData,
    },
    beat: {
      hit: Boolean(frame.beatHit),
      phase: clamp01(frame.beatPhase),
      bpm: Number.isFinite(frame.bpm) ? Math.max(0, frame.bpm) : 0,
      kick: readMiNumber(rhythm?.kickStrength ?? mi?.percussion?.kick),
      snare: readMiNumber(rhythm?.snareStrength ?? mi?.percussion?.snare),
      transient: readMiNumber(rhythm?.transient),
      beatIndex: Number.isFinite(rhythm?.beatIndex) ? Math.floor(rhythm?.beatIndex ?? -1) : -1,
      beatInBar,
      barIndex: Number.isFinite(rhythm?.barIndex) ? Math.floor(rhythm?.barIndex ?? -1) : -1,
      barProgress,
      downbeat: Boolean(rhythm?.downbeatHit ?? rhythm?.downbeat),
    },
    section: {
      type: resolvedType,
      startSec: sectionStart,
      endSec: sectionEnd,
      progress: sectionProgress,
      changed: Boolean(frame.sectionChanged),
      analysis: frame.musicIntelligence,
      label: mi?.section.label ?? '',
      intensity: undefined,
      confidence: mi?.section.confidence,
      source: resolved?.source ?? mi?.section.source ?? 'unknown',
    },
    config,
    transition: {
      mode: config.transition.mode,
      active: false,
      progress: 1,
      fromWorld: null,
      toWorld: config.worldMode,
    },
    randomSeed: config.seed,
    preset,
    presetId: preset.id,
    params,
  }
}
