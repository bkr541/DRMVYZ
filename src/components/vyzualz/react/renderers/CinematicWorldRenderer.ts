import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type { CinematicWorldConfig, CinematicWorldMode } from '../CinematicWorldConfig'
import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'

export interface CinematicViewport {
  width: number
  height: number
  dpr: number
}

export interface CinematicRendererInitializeInput {
  context: CanvasRenderingContext2D
  config: CinematicWorldConfig
  presetId: string
}

export interface CinematicWorldRenderInput {
  /** Monotonic animation time owned by the existing React canvas loop. */
  elapsedTimeSec: number
  /** Clamped seconds since the previous rendered frame. */
  deltaTimeSec: number
  /** Current audio transport position in seconds. */
  transportTimeSec: number
  viewport: CinematicViewport
  audio: ReactFrameContext['audio'] & {
    beatHit: boolean
    beatPhase: number
    bpm: number
  }
  trackAnalysis: MusicIntelligenceFrame | null
  config: CinematicWorldConfig
  preset: ReactPreset
  presetId: string
  params: ReactRenderParams
  sectionType: ReactSectionType | null
}

export type CinematicRendererResetReason =
  | 'presetChanged'
  | 'worldChanged'
  | 'structuralConfigurationChanged'
  | 'manualReset'
  | 'dispose'

/**
 * Lifecycle contract for all current and future Cinematic Worlds renderers.
 * Implementations render inside the application's existing requestAnimationFrame
 * loop; they must never start a competing animation loop.
 */
export interface CinematicWorldRenderer {
  initialize(input: CinematicRendererInitializeInput): void
  resize(viewport: CinematicViewport): void
  render(input: CinematicWorldRenderInput): void
  reset(reason: CinematicRendererResetReason): void
  dispose(): void
}

export type CinematicWorldRendererFactory = () => CinematicWorldRenderer

export class CinematicWorldRendererRegistry {
  private readonly factories = new Map<CinematicWorldMode, CinematicWorldRendererFactory>()

  register(mode: CinematicWorldMode, factory: CinematicWorldRendererFactory): void {
    this.factories.set(mode, factory)
  }

  resolve(mode: CinematicWorldMode): CinematicWorldRendererFactory | null {
    return this.factories.get(mode) ?? null
  }
}

function viewportChanged(a: CinematicViewport | null, b: CinematicViewport): boolean {
  return a == null || a.width !== b.width || a.height !== b.height || a.dpr !== b.dpr
}

function structuralKey(input: CinematicWorldRenderInput): string {
  const { config } = input
  return JSON.stringify({
    presetId: input.presetId,
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
  previous: CinematicWorldRenderInput | null,
  next: CinematicWorldRenderInput,
): CinematicRendererResetReason {
  if (!previous || previous.presetId !== next.presetId) return 'presetChanged'
  if (previous.config.worldMode !== next.config.worldMode) return 'worldChanged'
  return 'structuralConfigurationChanged'
}

/**
 * Owns one renderer instance for one canvas context. A host is never shared
 * between canvases, which prevents mutable particles/camera state from leaking
 * across previews.
 */
export class CinematicWorldRendererHost {
  private renderer: CinematicWorldRenderer | null = null
  private activeFactoryMode: CinematicWorldMode | null = null
  private key: string | null = null
  private viewport: CinematicViewport | null = null
  private previousInput: CinematicWorldRenderInput | null = null

  constructor(
    private readonly context: CanvasRenderingContext2D,
    private readonly registry: CinematicWorldRendererRegistry,
    private readonly fallbackMode: CinematicWorldMode = 'legacyPortal',
  ) {}

  render(input: CinematicWorldRenderInput): void {
    const nextKey = structuralKey(input)
    const requestedFactory = this.registry.resolve(input.config.worldMode)
    const factoryMode = requestedFactory ? input.config.worldMode : this.fallbackMode
    const factory = requestedFactory ?? this.registry.resolve(this.fallbackMode)
    if (!factory) throw new Error(`No cinematic renderer registered for ${input.config.worldMode} or fallback ${this.fallbackMode}`)

    if (!this.renderer || this.key !== nextKey || this.activeFactoryMode !== factoryMode) {
      if (this.renderer) {
        this.renderer.reset(resetReason(this.previousInput, input))
        this.renderer.dispose()
      }
      this.renderer = factory()
      this.renderer.initialize({
        context: this.context,
        config: input.config,
        presetId: input.presetId,
      })
      this.key = nextKey
      this.activeFactoryMode = factoryMode
      this.viewport = null
    }

    if (viewportChanged(this.viewport, input.viewport)) {
      this.renderer.resize(input.viewport)
      this.viewport = { ...input.viewport }
    }

    this.renderer.render(input)
    this.previousInput = input
  }

  reset(): void {
    this.renderer?.reset('manualReset')
    this.key = null
    this.previousInput = null
  }

  dispose(): void {
    if (this.renderer) {
      this.renderer.reset('dispose')
      this.renderer.dispose()
    }
    this.renderer = null
    this.activeFactoryMode = null
    this.key = null
    this.viewport = null
    this.previousInput = null
  }
}

export function cinematicInputFromReactFrame(
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
  config: CinematicWorldConfig,
): CinematicWorldRenderInput {
  const deltaTimeSec = Number.isFinite(frame.deltaTimeSec)
    ? Math.min(0.1, Math.max(0, frame.deltaTimeSec ?? 1 / 60))
    : 1 / 60
  const elapsedTimeSec = Number.isFinite(frame.elapsedTimeSec)
    ? Math.max(0, frame.elapsedTimeSec ?? 0)
    : Math.max(0, frame.t / 60)

  return {
    elapsedTimeSec,
    deltaTimeSec,
    transportTimeSec: frame.audioTime,
    viewport: { width: frame.W, height: frame.H, dpr: frame.dpr },
    audio: {
      ...frame.audio,
      beatHit: frame.beatHit,
      beatPhase: frame.beatPhase,
      bpm: frame.bpm,
    },
    trackAnalysis: frame.musicIntelligence,
    config,
    preset,
    presetId: preset.id,
    params,
    sectionType,
  }
}
