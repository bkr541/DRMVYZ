// The face effects of the POV document: Face Warp (priority 9) and Face Echo (10). Both follow the head with the
// shared face tracker (HeadlinerFaceTracking.ts). With no face found they show the plain camera, and Master
// Intensity 0 is always the clean camera.

import {
  HEADLINER_BLEND_OPERATIONS,
  getHeadlinerBoolean,
  getHeadlinerNumber,
  getHeadlinerString,
} from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  clamp01,
  drawLive,
  effectStrength,
  lerp,
  mixRgb,
  readPalette,
  tintSurface,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import {
  HeadlinerFaceFilter,
  getHeadlinerFaceTracker,
  mapHeadlinerFaceToCanvas,
  type HeadlinerFaceBox,
  type HeadlinerFaceSource,
} from './HeadlinerFaceTracking'
import {
  FaceWarpGlRenderer,
  HEADLINER_FACE_WARP_STYLES,
  type HeadlinerFaceWarpRenderer,
  type HeadlinerFaceWarpStyle,
} from './HeadlinerFaceWarpGL'

/** Face Echo keeps at most this many captured heads. */
export const HEADLINER_FACE_ECHO_MAX_COPIES = 8
/** The longest side, in pixels, of a stored head picture; heads are kept at full camera resolution below this. */
export const HEADLINER_FACE_ECHO_PATCH_MAX = 1024

/** Follow-smoothing time constant for the 0..1 Face Follow setting: 0 sticks to the detection, 1 glides slowly. */
export function resolveFaceFollowSmoothing(setting: number): number {
  return lerp(0.02, 0.3, clamp01(setting))
}

/** Grows the face outline to the region an effect works on, keeping the tilt. */
export function scaleFaceBox(box: HeadlinerFaceBox, size: number): HeadlinerFaceBox {
  return { ...box, width: box.width * size, height: box.height * size }
}

/** Smooth 1 → 0 swell that restarts on every beat, used to pulse an effect in time with the music. */
export function beatPulseEnvelope(beat: number): number {
  const phase = beat - Math.floor(beat)
  return Math.exp(-4 * phase)
}

/** Offsets for Face Echo's spread: copies alternate to the right and left of the live head, each one a head-width further out. */
export function faceEchoSpreadOffset(index: number, headWidth: number): number {
  const side = index % 2 === 0 ? 1 : -1
  return side * (Math.floor(index / 2) + 1) * headWidth * 1.1
}

// ── Face Warp ──────────────────────────────────────────────────────────────────

export interface HeadlinerFaceEffectDeps {
  tracker?: () => HeadlinerFaceSource
  createWarpRenderer?: () => HeadlinerFaceWarpRenderer | null
}

class FaceWarpProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'face-warp' as const
  private readonly filter = new HeadlinerFaceFilter()
  private renderer: HeadlinerFaceWarpRenderer | null = null
  private rendererFailed = false
  private tracker: HeadlinerFaceSource | null = null

  constructor(private readonly deps: HeadlinerFaceEffectDeps = {}) {}

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect, context } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001) {
      this.releaseTracker()
      return
    }

    const tracker = this.acquireTracker()
    const sample = tracker.sample(video, timing.timeSec)
    const follow = this.filter.update(sample, timing.timeSec, resolveFaceFollowSmoothing(getHeadlinerNumber(parameters, 'faceSmoothing', 0.4)))
    if (!follow.pose || follow.presence < 0.01) return

    const renderer = this.ensureRenderer()
    if (!renderer) return

    const box = mapHeadlinerFaceToCanvas(follow.pose, video.videoWidth, video.videoHeight, sourceRect, canvas.width, canvas.height)
    const region = scaleFaceBox(box, getHeadlinerNumber(parameters, 'regionSize', 1.3))
    const pulse = getHeadlinerNumber(parameters, 'beatPulse', 0.5) * Math.max(beatPulseEnvelope(timing.beat), timing.kick)
    const amount = Math.min(1.5, getHeadlinerNumber(parameters, 'warpAmount', 0.6) * Math.min(1.5, strength) * (1 + pulse)) * follow.presence
    const palette = readPalette(parameters)
    const style = getHeadlinerString(parameters, 'warpStyle', 'bulge') as HeadlinerFaceWarpStyle

    const patch = renderer.render({
      video,
      sourceRect,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      face: region,
      params: {
        style: HEADLINER_FACE_WARP_STYLES.includes(style) ? style : 'bulge',
        amount,
        timeSec: timing.timeSec * getHeadlinerNumber(parameters, 'warpSpeed', 1),
        softness: getHeadlinerNumber(parameters, 'edgeSoftness', 0.5),
        tint: { mode: palette.mode as 'original' | 'tint' | 'gradient', primary: palette.primary, secondary: palette.secondary, amount: palette.amount * follow.presence },
      },
    })
    if (!patch) return
    context.save()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    context.drawImage(patch.canvas, patch.x, patch.y)
    context.restore()
  }

  private acquireTracker(): HeadlinerFaceSource {
    if (!this.tracker) {
      this.tracker = (this.deps.tracker ?? getHeadlinerFaceTracker)()
      this.tracker.acquire()
    }
    return this.tracker
  }

  private releaseTracker(): void {
    this.tracker?.release()
    this.tracker = null
    this.filter.reset()
  }

  private ensureRenderer(): HeadlinerFaceWarpRenderer | null {
    if (!this.renderer && !this.rendererFailed) {
      this.renderer = (this.deps.createWarpRenderer ?? (() => FaceWarpGlRenderer.create()))()
      if (!this.renderer) this.rendererFailed = true
    }
    return this.renderer
  }

  dispose(): void {
    this.releaseTracker()
    this.renderer?.dispose()
    this.renderer = null
  }
}

export function createFaceWarpProcessor(deps?: HeadlinerFaceEffectDeps): HeadlinerEffectProcessor {
  return new FaceWarpProcessor(deps)
}

// ── Face Echo ──────────────────────────────────────────────────────────────────

interface HeadCopy {
  surface: WorkSurface
  /** Centre of the stored head in the canvas, as a fraction of its width (x) and height (y). */
  cx: number
  cy: number
  /** Size of the stored crop, as a fraction of the canvas width. */
  width: number
  height: number
}

/** Axis-aligned pixel rectangle that holds the head oval, tilt included. */
export function resolveHeadCrop(box: HeadlinerFaceBox): { halfWidth: number; halfHeight: number } {
  const rx = box.width / 2
  const ry = box.height / 2
  const cos = Math.cos(box.roll)
  const sin = Math.sin(box.roll)
  return { halfWidth: Math.hypot(rx * cos, ry * sin), halfHeight: Math.hypot(rx * sin, ry * cos) }
}

class FaceEchoProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'face-echo' as const
  private readonly filter = new HeadlinerFaceFilter()
  /** Newest first. */
  private history: HeadCopy[] = []
  private spare: WorkSurface[] = []
  private readonly live = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private tracker: HeadlinerFaceSource | null = null
  private lastSlot = Number.NaN
  private lastCaptureSec = Number.NEGATIVE_INFINITY

  constructor(private readonly deps: HeadlinerFaceEffectDeps = {}) {}

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect, context } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001) {
      this.releaseTracker()
      this.clearHistory()
      return
    }

    const tracker = this.acquireTracker()
    const sample = tracker.sample(video, timing.timeSec)
    const follow = this.filter.update(sample, timing.timeSec, resolveFaceFollowSmoothing(getHeadlinerNumber(parameters, 'faceSmoothing', 0.4)))
    if (!follow.pose || follow.presence < 0.01) return

    const box = mapHeadlinerFaceToCanvas(follow.pose, video.videoWidth, video.videoHeight, sourceRect, canvas.width, canvas.height)
    const headBox = scaleFaceBox(box, getHeadlinerNumber(parameters, 'headSize', 1.15))
    if (!this.extractHead(this.live, args, headBox)) return
    this.captureIfDue(args, headBox)

    const count = Math.min(this.history.length, Math.round(getHeadlinerNumber(parameters, 'echoCount', 4)))
    if (count === 0) return

    const palette = readPalette(parameters)
    const opacity = getHeadlinerNumber(parameters, 'echoOpacity', 0.55)
    const falloff = getHeadlinerNumber(parameters, 'echoFalloff', 0.78)
    const spread = getHeadlinerNumber(parameters, 'echoSpread', 0.6)
    const growth = getHeadlinerNumber(parameters, 'echoScale', 0)
    const mirror = getHeadlinerBoolean(parameters, 'mirrorCopies', false)
    const blend = HEADLINER_BLEND_OPERATIONS[getHeadlinerString(parameters, 'blendMode', 'normal')] ?? 'source-over'
    const liveCx = headBox.cx
    const liveCy = headBox.cy

    // Oldest first, so the newest copy lands on top.
    for (let k = count - 1; k >= 0; k -= 1) {
      const copy = this.history[k]
      const source = copy.surface.canvas
      if (!source) continue
      const trailX = copy.cx * canvas.width
      const trailY = copy.cy * canvas.height
      const targetX = liveCx + faceEchoSpreadOffset(k, copy.width * canvas.width)
      const x = lerp(trailX, targetX, spread)
      const y = lerp(trailY, liveCy, spread)
      const scale = Math.max(0.05, 1 + growth * (k + 1))
      const width = copy.width * canvas.width * scale
      const height = copy.height * canvas.width * scale

      let image: HTMLCanvasElement = source
      if (palette.mode !== 'original' && this.scratch.context) {
        this.scratch.resize(source.width, source.height)
        this.scratch.clear()
        this.scratch.context.globalAlpha = 1
        this.scratch.context.drawImage(source, 0, 0)
        const along = count > 1 ? k / (count - 1) : 0
        tintSurface(this.scratch, palette.mode === 'gradient' ? mixRgb(palette.primary, palette.secondary, along) : palette.primary, palette.amount)
        image = this.scratch.canvas as HTMLCanvasElement
      }

      context.save()
      context.globalAlpha = clamp01(opacity * Math.pow(falloff, k) * Math.min(1, strength) * follow.presence)
      context.globalCompositeOperation = blend
      context.translate(x, y)
      if (mirror && k % 2 === 1) context.scale(-1, 1)
      context.drawImage(image, -width / 2, -height / 2, width, height)
      context.restore()
    }

    // The real head goes back on top so the performer is never hidden behind their own echoes.
    if (getHeadlinerBoolean(parameters, 'liveHeadOnTop', true) && this.live.canvas) {
      const crop = resolveHeadCrop(headBox)
      context.save()
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      context.drawImage(this.live.canvas, headBox.cx - crop.halfWidth, headBox.cy - crop.halfHeight, crop.halfWidth * 2, crop.halfHeight * 2)
      context.restore()
    }
  }

  /** Cuts the head out of the camera picture onto `surface`: an oval with a soft edge, tilted with the head. */
  private extractHead(surface: WorkSurface, args: HeadlinerEffectRenderArgs, headBox: HeadlinerFaceBox): boolean {
    const { canvas, video, sourceRect } = args
    const target = surface.context
    if (!target) return false
    const crop = resolveHeadCrop(headBox)
    const cropWidth = crop.halfWidth * 2
    const cropHeight = crop.halfHeight * 2
    if (cropWidth < 2 || cropHeight < 2) return false
    const scale = Math.min(1, HEADLINER_FACE_ECHO_PATCH_MAX / Math.max(cropWidth, cropHeight))
    const patchWidth = Math.max(2, Math.round(cropWidth * scale))
    const patchHeight = Math.max(2, Math.round(cropHeight * scale))
    surface.resize(patchWidth, patchHeight)
    surface.clear()

    const sx = sourceRect.sx + ((headBox.cx - crop.halfWidth) / canvas.width) * sourceRect.sw
    const sy = sourceRect.sy + ((headBox.cy - crop.halfHeight) / canvas.height) * sourceRect.sh
    const sw = (cropWidth / canvas.width) * sourceRect.sw
    const sh = (cropHeight / canvas.height) * sourceRect.sh
    target.save()
    target.globalAlpha = 1
    target.globalCompositeOperation = 'source-over'
    try {
      target.drawImage(video, sx, sy, sw, sh, 0, 0, patchWidth, patchHeight)
    } catch {
      target.restore()
      return false
    }
    // Keep only the head oval, fading to nothing at its edge.
    target.globalCompositeOperation = 'destination-in'
    target.translate(patchWidth / 2, patchHeight / 2)
    target.rotate(headBox.roll)
    target.scale((headBox.width / 2) * scale, (headBox.height / 2) * scale)
    const mask = target.createRadialGradient(0, 0, 0, 0, 0, 1)
    mask.addColorStop(0, 'rgba(255, 255, 255, 1)')
    mask.addColorStop(0.78, 'rgba(255, 255, 255, 1)')
    mask.addColorStop(1, 'rgba(255, 255, 255, 0)')
    target.fillStyle = mask
    target.fillRect(-1.6, -1.6, 3.2, 3.2)
    target.restore()
    return true
  }

  private captureIfDue(args: HeadlinerEffectRenderArgs, headBox: HeadlinerFaceBox): void {
    const { parameters, timing, canvas } = args
    const synced = getHeadlinerBoolean(parameters, 'bpmSync', true)
    let due: boolean
    if (synced) {
      const division = Number(getHeadlinerString(parameters, 'echoSpacingBeats', '0.25')) || 0.25
      const slot = Math.floor(timing.beat / division)
      due = slot !== this.lastSlot
      this.lastSlot = slot
    } else {
      due = timing.timeSec - this.lastCaptureSec >= getHeadlinerNumber(parameters, 'echoDelayMs', 250) / 1000
    }
    if (!due && this.history.length > 0) return
    this.lastCaptureSec = timing.timeSec

    const surface = this.spare.pop() ?? new WorkSurface()
    if (!this.live.canvas || !this.copyInto(surface)) {
      this.spare.push(surface)
      return
    }
    const crop = resolveHeadCrop(headBox)
    this.history.unshift({
      surface,
      cx: headBox.cx / canvas.width,
      cy: headBox.cy / canvas.height,
      width: (crop.halfWidth * 2) / canvas.width,
      height: (crop.halfHeight * 2) / canvas.width,
    })
    while (this.history.length > HEADLINER_FACE_ECHO_MAX_COPIES) {
      const old = this.history.pop()
      if (old) this.spare.push(old.surface)
    }
  }

  private copyInto(surface: WorkSurface): boolean {
    const source = this.live.canvas
    if (!source) return false
    surface.resize(source.width, source.height)
    const target = surface.context
    if (!target) return false
    surface.clear()
    target.globalAlpha = 1
    target.globalCompositeOperation = 'source-over'
    target.drawImage(source, 0, 0)
    return true
  }

  private acquireTracker(): HeadlinerFaceSource {
    if (!this.tracker) {
      this.tracker = (this.deps.tracker ?? getHeadlinerFaceTracker)()
      this.tracker.acquire()
    }
    return this.tracker
  }

  private releaseTracker(): void {
    this.tracker?.release()
    this.tracker = null
    this.filter.reset()
  }

  private clearHistory(): void {
    for (const copy of this.history) this.spare.push(copy.surface)
    this.history = []
    this.lastSlot = Number.NaN
    this.lastCaptureSec = Number.NEGATIVE_INFINITY
  }

  dispose(): void {
    this.releaseTracker()
    for (const surface of [...this.history.map(copy => copy.surface), ...this.spare, this.live, this.scratch]) surface.dispose()
    this.history = []
    this.spare = []
  }
}

export function createFaceEchoProcessor(deps?: HeadlinerFaceEffectDeps): HeadlinerEffectProcessor {
  return new FaceEchoProcessor(deps)
}
