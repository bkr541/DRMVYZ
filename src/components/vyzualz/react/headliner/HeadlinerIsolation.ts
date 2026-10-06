// Separates the performer from the rest of the picture for the clone effects. There is no person
// segmentation model here, so it uses two honest, cheap approximations on a tiny greyscale copy:
//   - Moving Parts: whatever changed since the previous frame (a still performer drops out).
//   - Learned Background: whatever differs from a slowly learned picture of the empty scene.
// Both give a soft white-on-transparent mask for `destination-in`.

import type { HeadlinerSourceRect } from './HeadlinerCompositor'
import {
  HEADLINER_MOTION_HEIGHT,
  HEADLINER_MOTION_WIDTH,
  HeadlinerMotionAnalyzer,
  toGrayscale,
} from './HeadlinerMotion'

export type HeadlinerIsolationMode = 'off' | 'motion' | 'background'

export const HEADLINER_ISOLATION_OPTIONS = [
  { value: 'off', label: 'Full Frame' },
  { value: 'motion', label: 'Moving Parts' },
  { value: 'background', label: 'Learned Background' },
] as const

/** Background learning rates per frame: quick where the scene matches it, near zero where something stands out. */
export const HEADLINER_BACKGROUND_RATE_NEAR = 0.02
export const HEADLINER_BACKGROUND_RATE_FAR = 0.0015

/** Moves the learned background toward the current frame, barely at all where the performer stands out. */
export function updateBackground(background: Float32Array, gray: Uint8Array, threshold: number): void {
  for (let index = 0; index < background.length; index += 1) {
    const difference = Math.abs(gray[index] - background[index])
    background[index] += (gray[index] - background[index]) * (difference < threshold ? HEADLINER_BACKGROUND_RATE_NEAR : HEADLINER_BACKGROUND_RATE_FAR)
  }
}

/** 0..255 foreground weight per pixel: how far each pixel sits from the learned background. */
export function foregroundWeights(background: Float32Array, gray: Uint8Array, threshold: number, gain: number, out: Uint8Array): void {
  for (let index = 0; index < out.length; index += 1) {
    const weight = (Math.abs(gray[index] - background[index]) - threshold) * gain
    out[index] = weight <= 0 ? 0 : weight >= 255 ? 255 : weight
  }
}

function createCanvas(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = HEADLINER_MOTION_WIDTH
  canvas.height = HEADLINER_MOTION_HEIGHT
  return canvas
}

export class HeadlinerPerformerIsolator {
  private readonly analyzer = new HeadlinerMotionAnalyzer()
  private readonly readCanvas = createCanvas()
  private readonly readContext = this.readCanvas?.getContext('2d', { willReadFrequently: true }) ?? null
  private readonly maskCanvas = createCanvas()
  private readonly maskContext = this.maskCanvas?.getContext('2d') ?? null
  private readonly gray = new Uint8Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private readonly weights = new Uint8Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private readonly background = new Float32Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private learned = false

  /** Forget the learned background; it is relearned from the next frames. */
  relearn(): void {
    this.learned = false
  }

  /** The mask for this frame, or null for Full Frame (or when the picture could not be read). `strength` is 0..1. */
  update(video: CanvasImageSource, sourceRect: HeadlinerSourceRect, mode: string, strength: number): HTMLCanvasElement | null {
    const gain = 3 + 11 * strength
    const threshold = 24 - 20 * strength
    if (mode === 'motion') {
      const frame = this.analyzer.update(video, sourceRect, false)
      return frame ? this.analyzer.buildMask(frame, gain, threshold) : null
    }
    if (mode !== 'background') return null

    const context = this.readContext
    const maskContext = this.maskContext
    if (!context || !maskContext || !this.maskCanvas) return null
    let pixels: ImageData
    try {
      context.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
      pixels = context.getImageData(0, 0, HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
    } catch {
      return null
    }
    toGrayscale(pixels.data, this.gray)
    if (!this.learned) {
      this.background.set(this.gray)
      this.learned = true
    }
    foregroundWeights(this.background, this.gray, threshold, gain, this.weights)
    updateBackground(this.background, this.gray, threshold)

    const image = maskContext.createImageData(HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
    for (let pixel = 0, index = 0; pixel < this.weights.length; pixel += 1, index += 4) {
      image.data[index] = 255
      image.data[index + 1] = 255
      image.data[index + 2] = 255
      image.data[index + 3] = this.weights[pixel]
    }
    maskContext.putImageData(image, 0, 0)
    return this.maskCanvas
  }

  dispose(): void {
    this.analyzer.dispose()
    for (const canvas of [this.readCanvas, this.maskCanvas]) {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }
}
