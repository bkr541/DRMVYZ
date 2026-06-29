import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
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
  downbeat: boolean
}

export interface CinematicTrackSectionState {
  type: ReactSectionType | null
  startSec: number
  endSec: number
  progress: number
  changed: boolean
  analysis: MusicIntelligenceFrame | null
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
  transportTimeSec: number
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

export function cinematicStructuralKey(input: CinematicFrameContext): string {
  const { config } = input
  return JSON.stringify({
    presetId: input.presetId,
    requestedWorldId: input.requestedWorldId ?? config.worldMode,
    worldMode: config.worldMode,
    portalShape: config.portalShape,
    cameraRig: config.cameraRig,
    seed: config.seed,
    qualityTier: config.qualityTier,
    customMaskId: config.customMaskId,
    depth: config.environment.depth,
    architecture: config.environment.architecture,
  })
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
  private smoothedAudio: CinematicAudioBands | null = null
  private lastError: string | null = null

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly registry: CinematicWorldRendererRegistry,
    private readonly fallbackMode: CinematicWorldMode = 'legacyPortal',
    private readonly createWebGLRuntime?: CinematicWebGLRuntimeFactory,
  ) {}

  get error(): string | null { return this.lastError }

  render(input: CinematicFrameContext): void {
    const frame = this.prepareFrame(input)
    const requestedId = frame.requestedWorldId ?? frame.config.worldMode
    const requestedDefinition = this.registry.resolve(requestedId)
    const definition = requestedDefinition ?? this.registry.resolve(this.fallbackMode)

    if (!definition) {
      this.drawReadableError(`No cinematic renderer registered for ${requestedId} or fallback ${this.fallbackMode}`)
      return
    }

    if (definition.backend === 'webgl2') {
      const result = this.renderWebGL(definition, frame)
      if (result.ok) {
        this.lastError = null
        this.previousInput = frame
        return
      }
      this.lastError = result.error
      const fallback = this.registry.resolve(this.fallbackMode)
      if (fallback?.backend === 'canvas2d') {
        this.renderCanvas(fallback, frame, result.recoverable === true)
      } else {
        this.drawReadableError(result.error ?? 'Cinematic WebGL world failed')
      }
      this.previousInput = frame
      return
    }

    this.renderCanvas(definition, frame)
    this.lastError = null
    this.previousInput = frame
  }

  reset(): void {
    this.canvasRenderer?.reset('manualReset')
    this.webglRuntime?.reset('manualReset')
    this.canvasKey = null
    this.previousInput = null
    this.smoothedAudio = null
  }

  dispose(): void {
    this.disposeCanvasRenderer('dispose')
    this.webglRuntime?.dispose()
    this.webglRuntime = null
    this.previousInput = null
    this.smoothedAudio = null
    this.lastError = null
  }

  private prepareFrame(input: CinematicFrameContext): CinematicFrameContext {
    const raw = input.audio.raw
    const smoothingMs = input.config.audioMapping.enabled
      ? input.config.audioMapping.smoothingMs
      : 0
    const alpha = smoothingMs <= 0
      ? 1
      : 1 - Math.exp(-(input.deltaTimeSec * 1000) / Math.max(1, smoothingMs))
    const previous = this.smoothedAudio ?? raw
    const smoothed: CinematicAudioBands = {
      bass: previous.bass + (raw.bass - previous.bass) * alpha,
      mid: previous.mid + (raw.mid - previous.mid) * alpha,
      high: previous.high + (raw.high - previous.high) * alpha,
      volume: previous.volume + (raw.volume - previous.volume) * alpha,
    }
    this.smoothedAudio = smoothed
    return {
      ...input,
      audio: { ...input.audio, smoothed },
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
    rhythm?: { downbeat?: boolean }
  }) | null
  const resolved = frame.resolvedSection
  const resolvedType = (resolved?.type ?? sectionType) as ReactSectionType | null
  const sectionStart = resolved?.startSec ?? mi?.section?.startSec ?? -1
  const sectionEnd = resolved?.endSec ?? Number.POSITIVE_INFINITY
  const sectionProgress = resolved?.progress ?? mi?.section?.progress ?? -1

  return {
    elapsedTimeSec,
    deltaTimeSec,
    transportTimeSec: frame.audioTime,
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
      kick: readMiNumber(mi?.percussion?.kick),
      snare: readMiNumber(mi?.percussion?.snare),
      downbeat: Boolean(mi?.rhythm?.downbeat),
    },
    section: {
      type: resolvedType,
      startSec: sectionStart,
      endSec: sectionEnd,
      progress: sectionProgress,
      changed: Boolean(frame.sectionChanged),
      analysis: frame.musicIntelligence,
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
