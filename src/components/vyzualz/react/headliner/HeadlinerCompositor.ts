import {
  applyCanvasResolution,
  resolveCanvasResolution,
  type CanvasResolution,
} from '../rendering/canvasResolution'
import type {
  HeadlinerCameraFrameSource,
  HeadlinerCameraRuntimeStatus,
  HeadlinerCameraSlotId,
} from './HeadlinerCameraRuntime'

export const HEADLINER_MAX_CAMERA_LAYERS = 4
export const HEADLINER_MAX_BACKING_PIXELS = 1920 * 1080
export const HEADLINER_CONNECTION_LOST_TEXT = 'Connection Lost'

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
  cameraStatus: HeadlinerCameraRuntimeStatus
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

type HeadlinerRenderedState = 'live' | 'lost' | 'neutral'

export function createHeadlinerFullscreenProgram(
  source: HeadlinerCameraFrameSource | null,
  cameraStatus: HeadlinerCameraRuntimeStatus = source ? 'live' : 'idle',
): HeadlinerProgramInput {
  if (!source) {
    return {
      mode: 'fullscreen',
      cameraStatus,
      layers: [],
      masterEffectIds: [],
    }
  }

  return {
    mode: 'fullscreen',
    cameraStatus,
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
  private previousLiveFrameTimestamp: number | null = null
  private fpsWindowStartedAt: number | null = null
  private fpsFrames = 0
  private renderedState: HeadlinerRenderedState | null = null
  private lastGoodFrameCanvas: HTMLCanvasElement | null = null
  private lastGoodFrameContext: CanvasRenderingContext2D | null = null
  private hasLastGoodFrame = false

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
    this.previousFrameReset()
    this.adaptiveQuality = { ...HEADLINER_INITIAL_ADAPTIVE_QUALITY }
    this.previousResolution = null
    this.renderedState = null
    this.releaseLastGoodFrame()
    this.canvas.removeAttribute('data-headliner-output-rendered')
    this.canvas.removeAttribute('data-headliner-output-state')
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

    const program = this.getProgramInput()
    if (program.cameraStatus === 'live') {
      if (this.previousLiveFrameTimestamp !== null) {
        const nextAdaptiveQuality = advanceHeadlinerAdaptiveQuality(
          this.adaptiveQuality,
          timestamp - this.previousLiveFrameTimestamp,
        )
        if (nextAdaptiveQuality.tier !== this.adaptiveQuality.tier) this.previousResolution = null
        this.adaptiveQuality = nextAdaptiveQuality
      }
      this.previousLiveFrameTimestamp = timestamp
    } else {
      // Lost/neutral frames must not degrade quality or count the disconnected
      // interval as a slow frame when the camera comes back.
      this.previousLiveFrameTimestamp = null
    }

    const renderedState = this.renderProgramFrame(program)
    if (renderedState === 'live') {
      this.sampleFps(timestamp)
    } else if (this.renderedState === 'live') {
      this.resetFpsSample()
      this.onLiveFps?.(0)
    }
    this.renderedState = renderedState

    this.rafId = window.requestAnimationFrame(this.renderFrame)
  }

  private renderProgramFrame(program: HeadlinerProgramInput): HeadlinerRenderedState {
    const context = this.context
    if (!context) return 'neutral'

    const resolution = this.resolveBackingResolution()
    if (!resolution?.valid) return 'neutral'

    const willResize = this.canvas.width !== resolution.backingWidth || this.canvas.height !== resolution.backingHeight
    if (this.renderedState === 'live' && (program.cameraStatus === 'disconnected' || willResize)) {
      // The visible program canvas already is the latest compositor-owned frame.
      // Snapshot it only at a loss/resize boundary instead of copying every RAF.
      this.captureLastGoodFrame()
    }
    const resolutionChanged = applyCanvasResolution(this.canvas, resolution)

    if (program.cameraStatus === 'disconnected') {
      if (this.renderedState === 'lost' && !resolutionChanged && this.hasLastGoodFrame) {
        // A frozen program frame is already complete. Keep the canvas static
        // instead of spending work redrawing a dead camera source every RAF.
        return 'lost'
      }
      if (this.drawFrozenFrame()) {
        this.drawConnectionLostOverlay()
        this.markOutputRendered('lost')
        return 'lost'
      }
      this.drawNeutralSurface('Camera Unavailable')
      this.markOutputRendered('neutral')
      return 'neutral'
    }

    const layer = program.layers.find(candidate => candidate.enabled) ?? null
    const video = layer?.video ?? null
    if (
      program.mode === 'fullscreen'
      && program.cameraStatus === 'live'
      && video
      && video.readyState >= 2
      && video.videoWidth > 0
      && video.videoHeight > 0
    ) {
      const sourceRect = resolveHeadlinerCoverSourceRect(
        video.videoWidth,
        video.videoHeight,
        this.canvas.width,
        this.canvas.height,
      )
      if (sourceRect) {
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
          context.globalAlpha = 1
          this.markOutputRendered('live')
          return 'live'
        } catch {
          // Track/video readiness can race with drawImage. If the backing store
          // did not change, the existing program pixels are already the last
          // good frame. Otherwise use the boundary snapshot taken above.
          context.globalAlpha = 1
          if (!resolutionChanged && this.renderedState === 'live') {
            this.markOutputRendered('live')
            return 'live'
          }
          if (this.drawFrozenFrame()) {
            this.markOutputRendered('live')
            return 'live'
          }
        }
      }
    }

    if (program.cameraStatus === 'live') {
      if (!resolutionChanged && this.renderedState === 'live') {
        this.markOutputRendered('live')
        return 'live'
      }
      if (this.drawFrozenFrame()) {
        this.markOutputRendered('live')
        return 'live'
      }
    }

    const neutralLabel = program.cameraStatus === 'requesting' ? 'Starting Camera' : 'Camera Unavailable'
    this.drawNeutralSurface(neutralLabel)
    this.markOutputRendered('neutral')
    return 'neutral'
  }

  private captureLastGoodFrame(): void {
    const buffer = this.ensureLastGoodFrameBuffer()
    const context = this.lastGoodFrameContext
    if (!buffer || !context) return

    context.globalAlpha = 1
    context.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height)
    this.hasLastGoodFrame = true
  }

  private ensureLastGoodFrameBuffer(): HTMLCanvasElement | null {
    if (!this.lastGoodFrameCanvas) {
      const buffer = this.canvas.ownerDocument.createElement('canvas')
      const context = buffer.getContext('2d', { alpha: false })
      if (!context) return null
      context.imageSmoothingEnabled = true
      this.lastGoodFrameCanvas = buffer
      this.lastGoodFrameContext = context
    }

    const buffer = this.lastGoodFrameCanvas
    if (buffer.width !== this.canvas.width) buffer.width = this.canvas.width
    if (buffer.height !== this.canvas.height) buffer.height = this.canvas.height
    return buffer
  }

  private drawFrozenFrame(): boolean {
    if (!this.hasLastGoodFrame || !this.lastGoodFrameCanvas || !this.context) return false
    this.context.globalAlpha = 1
    this.context.drawImage(
      this.lastGoodFrameCanvas,
      0,
      0,
      this.lastGoodFrameCanvas.width,
      this.lastGoodFrameCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    )
    return true
  }

  private drawConnectionLostOverlay(): void {
    const context = this.context
    if (!context) return
    const width = this.canvas.width
    const height = this.canvas.height
    const gradient = context.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, 'rgba(20, 24, 26, 0.46)')
    gradient.addColorStop(0.55, 'rgba(78, 82, 84, 0.58)')
    gradient.addColorStop(1, 'rgba(16, 18, 19, 0.72)')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    this.drawCenteredLabel(HEADLINER_CONNECTION_LOST_TEXT)
  }

  private drawNeutralSurface(label: string): void {
    const context = this.context
    if (!context) return
    const width = this.canvas.width
    const height = this.canvas.height
    const gradient = context.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#202426')
    gradient.addColorStop(0.5, '#3a3f42')
    gradient.addColorStop(1, '#171a1c')
    context.globalAlpha = 1
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    this.drawCenteredLabel(label)
  }

  private drawCenteredLabel(label: string): void {
    const context = this.context
    if (!context) return
    const fontSize = Math.max(18, Math.round(Math.min(this.canvas.width, this.canvas.height) * 0.045))
    context.fillStyle = 'rgba(240, 244, 246, 0.94)'
    context.font = `800 ${fontSize}px Inter, system-ui, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.82)
  }

  private markOutputRendered(state: 'live' | 'lost' | 'neutral'): void {
    this.canvas.setAttribute('data-headliner-output-rendered', 'true')
    this.canvas.setAttribute('data-headliner-output-state', state)
  }

  private releaseLastGoodFrame(): void {
    if (this.lastGoodFrameCanvas) {
      this.lastGoodFrameCanvas.width = 0
      this.lastGoodFrameCanvas.height = 0
    }
    this.lastGoodFrameCanvas = null
    this.lastGoodFrameContext = null
    this.hasLastGoodFrame = false
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

  private resetFpsSample(): void {
    this.fpsWindowStartedAt = null
    this.fpsFrames = 0
  }

  private previousFrameReset(): void {
    this.previousLiveFrameTimestamp = null
    this.resetFpsSample()
  }
}
