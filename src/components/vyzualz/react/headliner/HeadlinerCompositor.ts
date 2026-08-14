import {
  applyCanvasResolution,
  resolveCanvasResolution,
  type CanvasResolution,
} from '../rendering/canvasResolution'
import type {
  HeadlinerCameraFrameSource,
  HeadlinerCameraSlotId,
} from './HeadlinerCameraRuntime'

export const HEADLINER_MAX_CAMERA_LAYERS = 4
export const HEADLINER_MAX_BACKING_PIXELS = 1920 * 1080

export interface HeadlinerNormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface HeadlinerLayerTransform {
  scaleX: number
  scaleY: number
  rotationDeg: number
}

export interface HeadlinerCameraLayerInput {
  slotId: HeadlinerCameraSlotId
  sourceId: 'default-front-camera'
  video: HTMLVideoElement
  enabled: boolean
  opacity: number
  viewport: HeadlinerNormalizedRect
  sourceCrop: HeadlinerNormalizedRect | null
  transform: HeadlinerLayerTransform
  effectIds: readonly string[]
}

export interface HeadlinerProgramInput {
  mode: 'fullscreen'
  layers: readonly HeadlinerCameraLayerInput[]
  masterEffectIds: readonly string[]
}

export interface HeadlinerAdaptiveQualityState {
  tier: number
  pressureFrames: number
  healthyFrames: number
}

export const HEADLINER_ADAPTIVE_SCALES = Object.freeze([1, 0.85, 0.7, 0.55] as const)
export const HEADLINER_INITIAL_ADAPTIVE_QUALITY: Readonly<HeadlinerAdaptiveQualityState> = Object.freeze({
  tier: 0,
  pressureFrames: 0,
  healthyFrames: 0,
})

const PRESSURE_FRAME_MS = 40
const HEALTHY_FRAME_MS = 28
const PRESSURE_FRAMES_TO_DEGRADE = 8
const HEALTHY_FRAMES_TO_RECOVER = 120
const FPS_SAMPLE_WINDOW_MS = 500

export function createHeadlinerFullscreenProgram(
  source: HeadlinerCameraFrameSource | null,
): HeadlinerProgramInput {
  if (!source) {
    return {
      mode: 'fullscreen',
      layers: [],
      masterEffectIds: [],
    }
  }

  return {
    mode: 'fullscreen',
    layers: [{
      slotId: source.slotId,
      sourceId: source.sourceId,
      video: source.video,
      enabled: true,
      opacity: 1,
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      sourceCrop: null,
      transform: { scaleX: 1, scaleY: 1, rotationDeg: 0 },
      effectIds: [],
    }],
    masterEffectIds: [],
  }
}

export function advanceHeadlinerAdaptiveQuality(
  state: HeadlinerAdaptiveQualityState,
  frameIntervalMs: number,
): HeadlinerAdaptiveQualityState {
  if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) return state

  if (frameIntervalMs >= PRESSURE_FRAME_MS) {
    const pressureFrames = state.pressureFrames + 1
    if (pressureFrames >= PRESSURE_FRAMES_TO_DEGRADE && state.tier < HEADLINER_ADAPTIVE_SCALES.length - 1) {
      return { tier: state.tier + 1, pressureFrames: 0, healthyFrames: 0 }
    }
    return { tier: state.tier, pressureFrames, healthyFrames: 0 }
  }

  if (frameIntervalMs <= HEALTHY_FRAME_MS) {
    const healthyFrames = state.healthyFrames + 1
    if (healthyFrames >= HEALTHY_FRAMES_TO_RECOVER && state.tier > 0) {
      return { tier: state.tier - 1, pressureFrames: 0, healthyFrames: 0 }
    }
    return {
      tier: state.tier,
      pressureFrames: Math.max(0, state.pressureFrames - 1),
      healthyFrames,
    }
  }

  return {
    tier: state.tier,
    pressureFrames: Math.max(0, state.pressureFrames - 1),
    healthyFrames: Math.max(0, state.healthyFrames - 1),
  }
}

export interface HeadlinerSourceRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export function resolveHeadlinerCoverSourceRect(
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
): HeadlinerSourceRect | null {
  if (
    !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || !Number.isFinite(outputWidth)
    || !Number.isFinite(outputHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
    || outputWidth <= 0
    || outputHeight <= 0
  ) return null

  const sourceAspect = sourceWidth / sourceHeight
  const outputAspect = outputWidth / outputHeight

  if (sourceAspect > outputAspect) {
    const sw = sourceHeight * outputAspect
    return {
      sx: (sourceWidth - sw) / 2,
      sy: 0,
      sw,
      sh: sourceHeight,
    }
  }

  const sh = sourceWidth / outputAspect
  return {
    sx: 0,
    sy: (sourceHeight - sh) / 2,
    sw: sourceWidth,
    sh,
  }
}

interface HeadlinerFullscreenCompositorOptions {
  canvas: HTMLCanvasElement
  getProgramInput: () => HeadlinerProgramInput
  onLiveFps?: (fps: number) => void
}

export class HeadlinerFullscreenCompositor {
  private readonly canvas: HTMLCanvasElement
  private readonly getProgramInput: () => HeadlinerProgramInput
  private readonly onLiveFps?: (fps: number) => void
  private readonly context: CanvasRenderingContext2D | null
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private removeWindowResizeListener: (() => void) | null = null
  private active = false
  private previousResolution: CanvasResolution | null = null
  private adaptiveQuality: HeadlinerAdaptiveQualityState = { ...HEADLINER_INITIAL_ADAPTIVE_QUALITY }
  private previousFrameTimestamp: number | null = null
  private fpsWindowStartedAt: number | null = null
  private fpsFrames = 0

  constructor({ canvas, getProgramInput, onLiveFps }: HeadlinerFullscreenCompositorOptions) {
    this.canvas = canvas
    this.getProgramInput = getProgramInput
    this.onLiveFps = onLiveFps
    this.context = canvas.getContext('2d', { alpha: false, desynchronized: true })
    if (this.context) this.context.imageSmoothingEnabled = true
  }

  start(): void {
    if (this.active || !this.context) return
    this.active = true
    this.observeSize()
    this.rafId = window.requestAnimationFrame(this.renderFrame)
  }

  stop(): void {
    if (!this.active) return
    this.active = false
    if (this.rafId !== null) window.cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.removeWindowResizeListener?.()
    this.removeWindowResizeListener = null
    this.previousFrameTimestamp = null
    this.fpsWindowStartedAt = null
    this.fpsFrames = 0
    this.onLiveFps?.(0)
  }

  private observeSize(): void {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => {
        this.previousResolution = null
      })
      this.resizeObserver.observe(this.canvas)
      return
    }

    const handleResize = () => {
      this.previousResolution = null
    }
    window.addEventListener('resize', handleResize)
    this.removeWindowResizeListener = () => window.removeEventListener('resize', handleResize)
  }

  private renderFrame = (timestamp: number): void => {
    if (!this.active) return

    if (this.previousFrameTimestamp !== null) {
      const nextAdaptiveQuality = advanceHeadlinerAdaptiveQuality(
        this.adaptiveQuality,
        timestamp - this.previousFrameTimestamp,
      )
      if (nextAdaptiveQuality.tier !== this.adaptiveQuality.tier) this.previousResolution = null
      this.adaptiveQuality = nextAdaptiveQuality
    }
    this.previousFrameTimestamp = timestamp

    const rendered = this.renderProgramFrame()
    if (rendered) this.sampleFps(timestamp)

    this.rafId = window.requestAnimationFrame(this.renderFrame)
  }

  private renderProgramFrame(): boolean {
    const context = this.context
    if (!context) return false

    const resolution = this.resolveBackingResolution()
    if (!resolution?.valid) return false
    applyCanvasResolution(this.canvas, resolution)

    const program = this.getProgramInput()
    const layer = program.layers.find(candidate => candidate.enabled) ?? null
    const video = layer?.video ?? null

    context.fillStyle = '#020709'
    context.fillRect(0, 0, this.canvas.width, this.canvas.height)

    if (
      program.mode !== 'fullscreen'
      || !video
      || video.readyState < 2
      || video.videoWidth <= 0
      || video.videoHeight <= 0
    ) {
      this.canvas.removeAttribute('data-headliner-output-rendered')
      return false
    }

    const sourceRect = resolveHeadlinerCoverSourceRect(
      video.videoWidth,
      video.videoHeight,
      this.canvas.width,
      this.canvas.height,
    )
    if (!sourceRect) return false

    context.globalAlpha = layer?.opacity ?? 1
    try {
      context.drawImage(
        video,
        sourceRect.sx,
        sourceRect.sy,
        sourceRect.sw,
        sourceRect.sh,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      )
    } catch {
      // A camera track can become unreadable between readiness checks and the
      // draw itself. Keep the compositor loop alive; Stage 4 owns the final
      // frozen-frame/Connection Lost presentation for that condition.
      context.globalAlpha = 1
      this.canvas.removeAttribute('data-headliner-output-rendered')
      return false
    }
    context.globalAlpha = 1
    this.canvas.setAttribute('data-headliner-output-rendered', 'true')
    return true
  }

  private resolveBackingResolution(): CanvasResolution | null {
    const rect = this.canvas.getBoundingClientRect()
    const cssWidth = rect.width || this.canvas.clientWidth
    const cssHeight = rect.height || this.canvas.clientHeight
    if (cssWidth <= 0 || cssHeight <= 0) return null

    const scale = HEADLINER_ADAPTIVE_SCALES[this.adaptiveQuality.tier] ?? 1
    const maxPixelCount = Math.max(1, Math.floor(HEADLINER_MAX_BACKING_PIXELS * scale * scale))
    const resolution = resolveCanvasResolution({
      cssWidth,
      cssHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      quality: 'high',
      resolutionScale: scale,
      maxPixelCount,
      previous: this.previousResolution,
    })
    this.previousResolution = resolution
    return resolution
  }

  private sampleFps(timestamp: number): void {
    if (this.fpsWindowStartedAt === null) {
      this.fpsWindowStartedAt = timestamp
      this.fpsFrames = 1
      return
    }

    this.fpsFrames += 1
    const elapsed = timestamp - this.fpsWindowStartedAt
    if (elapsed < FPS_SAMPLE_WINDOW_MS) return

    this.onLiveFps?.(Math.max(0, Math.round((this.fpsFrames * 1000) / elapsed)))
    this.fpsWindowStartedAt = timestamp
    this.fpsFrames = 0
  }
}
