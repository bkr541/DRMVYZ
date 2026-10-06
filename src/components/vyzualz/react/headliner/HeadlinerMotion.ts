// Motion analysis shared by the Headliner effects. Everything works on a tiny greyscale copy of the
// camera picture so it stays cheap: a frame difference (where is something moving) and a block-matching
// flow field (which way, how fast). The maths is pure so it can be tested without a canvas.

import type { HeadlinerSourceRect } from './HeadlinerCompositor'

export const HEADLINER_MOTION_WIDTH = 128
export const HEADLINER_MOTION_HEIGHT = 72
/** Flow cells are 4x4 analysis pixels: 32 x 18 vectors. */
export const HEADLINER_FLOW_BLOCK = 4
export const HEADLINER_FLOW_SEARCH_RADIUS = 4

export function toGrayscale(rgba: ArrayLike<number>, out: Uint8Array): void {
  for (let pixel = 0, index = 0; pixel < out.length; pixel += 1, index += 4) {
    out[pixel] = (rgba[index] * 77 + rgba[index + 1] * 151 + rgba[index + 2] * 28) >> 8
  }
}

/** Absolute per-pixel difference between two frames of the same size. */
export function frameDifference(current: Uint8Array, previous: Uint8Array, out: Uint8Array): void {
  for (let index = 0; index < out.length; index += 1) {
    const difference = current[index] - previous[index]
    out[index] = difference < 0 ? -difference : difference
  }
}

/** Mean difference scaled so ordinary DJ movement lands around 0.3–0.7. */
export function motionSpeed(difference: Uint8Array): number {
  if (difference.length === 0) return 0
  let sum = 0
  for (let index = 0; index < difference.length; index += 1) sum += difference[index]
  return Math.min(1, sum / difference.length / 18)
}

/**
 * Block matching: for each cell of the current frame, finds where that patch came from in the previous
 * frame and writes the motion vector (analysis pixels moved since the last frame) as x,y pairs.
 * Cells whose content barely changed are left at zero so sensor noise never reads as movement.
 */
export function estimateBlockFlow(
  current: Uint8Array,
  previous: Uint8Array,
  width: number,
  height: number,
  out: Float32Array,
  block = HEADLINER_FLOW_BLOCK,
  radius = HEADLINER_FLOW_SEARCH_RADIUS,
  noiseFloor = 6,
): { cols: number; rows: number } {
  const cols = Math.floor(width / block)
  const rows = Math.floor(height / block)
  const stillSad = noiseFloor * block * block

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = col * block
      const y0 = row * block
      const slot = (row * cols + col) * 2

      let zeroSad = 0
      for (let y = 0; y < block; y += 1) {
        const base = (y0 + y) * width + x0
        for (let x = 0; x < block; x += 1) zeroSad += Math.abs(current[base + x] - previous[base + x])
      }
      if (zeroSad <= stillSad) {
        out[slot] = 0
        out[slot + 1] = 0
        continue
      }

      let bestSad = zeroSad
      let bestX = 0
      let bestY = 0
      for (let dy = -radius; dy <= radius; dy += 1) {
        const sy = y0 + dy
        if (sy < 0 || sy + block > height) continue
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const sx = x0 + dx
          if (sx < 0 || sx + block > width) continue
          let sad = 0
          for (let y = 0; y < block && sad < bestSad; y += 1) {
            const currentBase = (y0 + y) * width + x0
            const previousBase = (sy + y) * width + sx
            for (let x = 0; x < block; x += 1) sad += Math.abs(current[currentBase + x] - previous[previousBase + x])
          }
          // A shifted match has to beat standing still clearly, otherwise it is just noise.
          if (sad < bestSad * 0.85) {
            bestSad = sad
            bestX = dx
            bestY = dy
          }
        }
      }
      // The patch now at x0 came from x0 + dx, so the content moved by -dx.
      out[slot] = -bestX
      out[slot + 1] = -bestY
    }
  }
  return { cols, rows }
}

/** Blends the new flow into the running one (temporal) and softens it with its neighbours (spatial). */
export function smoothFlow(
  next: Float32Array,
  running: Float32Array,
  cols: number,
  rows: number,
  temporal = 0.55,
): void {
  const spatial = new Float32Array(next.length)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let sumX = 0
      let sumY = 0
      let weight = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighbourRow = row + dy
          const neighbourCol = col + dx
          if (neighbourRow < 0 || neighbourRow >= rows || neighbourCol < 0 || neighbourCol >= cols) continue
          const w = dx === 0 && dy === 0 ? 2 : 1
          const slot = (neighbourRow * cols + neighbourCol) * 2
          sumX += next[slot] * w
          sumY += next[slot + 1] * w
          weight += w
        }
      }
      const slot = (row * cols + col) * 2
      spatial[slot] = sumX / weight
      spatial[slot + 1] = sumY / weight
    }
  }
  for (let index = 0; index < running.length; index += 1) {
    running[index] += (spatial[index] - running[index]) * temporal
  }
}

export interface HeadlinerMotionFrame {
  width: number
  height: number
  /** Per-pixel absolute difference with the previous analysis frame. */
  difference: Uint8Array
  /** 0..1 overall amount of movement. */
  speed: number
  /** Present only when flow was requested: x,y per cell, analysis pixels per frame. */
  flow: Float32Array | null
  cols: number
  rows: number
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** Reads the camera into a small greyscale frame and compares it with the one before. */
export class HeadlinerMotionAnalyzer {
  private readonly canvas: HTMLCanvasElement | null
  private readonly context: CanvasRenderingContext2D | null
  private readonly maskCanvas: HTMLCanvasElement | null
  private readonly maskContext: CanvasRenderingContext2D | null
  private current = new Uint8Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private previous = new Uint8Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private readonly difference = new Uint8Array(HEADLINER_MOTION_WIDTH * HEADLINER_MOTION_HEIGHT)
  private readonly rawFlow = new Float32Array((HEADLINER_MOTION_WIDTH / HEADLINER_FLOW_BLOCK) * (HEADLINER_MOTION_HEIGHT / HEADLINER_FLOW_BLOCK) * 2)
  private readonly flow = new Float32Array(this.rawFlow.length)
  private hasPrevious = false
  private speed = 0

  constructor() {
    this.canvas = createCanvas(HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
    this.context = this.canvas?.getContext('2d', { willReadFrequently: true }) ?? null
    this.maskCanvas = createCanvas(HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
    this.maskContext = this.maskCanvas?.getContext('2d') ?? null
  }

  /** Analyses one camera frame. Returns null when the picture could not be read. */
  update(video: CanvasImageSource, sourceRect: HeadlinerSourceRect, withFlow: boolean): HeadlinerMotionFrame | null {
    const context = this.context
    if (!context) return null
    let pixels: ImageData
    try {
      context.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
      pixels = context.getImageData(0, 0, HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT)
    } catch {
      return null
    }

    const swap = this.previous
    this.previous = this.current
    this.current = swap
    toGrayscale(pixels.data, this.current)

    let cols = HEADLINER_MOTION_WIDTH / HEADLINER_FLOW_BLOCK
    let rows = HEADLINER_MOTION_HEIGHT / HEADLINER_FLOW_BLOCK
    if (!this.hasPrevious) {
      this.hasPrevious = true
      this.difference.fill(0)
      this.flow.fill(0)
      this.speed = 0
    } else {
      frameDifference(this.current, this.previous, this.difference)
      // Smooth the headline number so a single noisy frame does not flash the effect.
      this.speed += (motionSpeed(this.difference) - this.speed) * 0.5
      if (withFlow) {
        ;({ cols, rows } = estimateBlockFlow(this.current, this.previous, HEADLINER_MOTION_WIDTH, HEADLINER_MOTION_HEIGHT, this.rawFlow))
        smoothFlow(this.rawFlow, this.flow, cols, rows)
      }
    }

    return {
      width: HEADLINER_MOTION_WIDTH,
      height: HEADLINER_MOTION_HEIGHT,
      difference: this.difference,
      speed: this.speed,
      flow: withFlow ? this.flow : null,
      cols,
      rows,
    }
  }

  /**
   * A small white canvas whose alpha is where things move (0 = still, 1 = moving), for use as a
   * `destination-in` mask. `floor` keeps that much of the picture regardless of motion.
   */
  buildMask(frame: HeadlinerMotionFrame, gain: number, threshold: number, floor = 0): HTMLCanvasElement | null {
    const context = this.maskContext
    if (!context || !this.maskCanvas) return null
    const image = context.createImageData(frame.width, frame.height)
    const data = image.data
    for (let pixel = 0, index = 0; pixel < frame.difference.length; pixel += 1, index += 4) {
      const motion = Math.min(1, Math.max(0, (frame.difference[pixel] - threshold) * gain / 255))
      data[index] = 255
      data[index + 1] = 255
      data[index + 2] = 255
      data[index + 3] = Math.round(255 * (floor + (1 - floor) * motion))
    }
    context.putImageData(image, 0, 0)
    return this.maskCanvas
  }

  reset(): void {
    this.hasPrevious = false
    this.speed = 0
    this.flow.fill(0)
  }

  dispose(): void {
    for (const canvas of [this.canvas, this.maskCanvas]) {
      if (canvas) {
        canvas.width = 0
        canvas.height = 0
      }
    }
  }
}
