// Shared building blocks of the Headliner effect processors: work surfaces, the render contract, palette
// handling and layer compositing. Kept apart from the processors so each effect file stays focused.

import {
  HEADLINER_BLEND_OPERATIONS,
  getHeadlinerNumber,
  getHeadlinerString,
  type HeadlinerParameterValues,
  type HeadlinerPresetId,
} from './HeadlinerEffectCatalog'
import type { HeadlinerSourceRect } from './HeadlinerCompositor'
import { headlinerReactiveGain, type HeadlinerEffectTiming } from './HeadlinerTiming'

export interface HeadlinerEffectRenderArgs {
  context: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  video: HTMLVideoElement
  sourceRect: HeadlinerSourceRect
  parameters: HeadlinerParameterValues
  timing: HeadlinerEffectTiming
}

export interface HeadlinerEffectProcessor {
  readonly presetId: HeadlinerPresetId
  /** Draws the finished frame (live picture plus effect) onto `args.canvas`. */
  render(args: HeadlinerEffectRenderArgs): void
  dispose(): void
}

export const HEADLINER_WORK_MAX_WIDTH = 720
export const HEADLINER_MAX_ECHOES = 12
/** Upper bound on drawImage calls one Velocity Smear frame may issue. */
export const HEADLINER_SMEAR_DRAW_BUDGET = 3600

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export function hexToRgb(hex: string): [number, number, number] {
  const value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ffffff'
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)]
}

export function rgba([r, g, b]: readonly number[], alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(alpha)})`
}

export function mixRgb(a: readonly number[], b: readonly number[], amount: number): [number, number, number] {
  return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount), lerp(a[2], b[2], amount)]
}

export function resolveHeadlinerWorkSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 }
  const scale = Math.min(1, HEADLINER_WORK_MAX_WIDTH / width)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export class WorkSurface {
  readonly canvas: HTMLCanvasElement | null
  readonly context: CanvasRenderingContext2D | null

  constructor() {
    this.canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
    this.context = this.canvas?.getContext('2d') ?? null
  }

  /** Returns true when the size changed (which also clears the surface). */
  resize(width: number, height: number): boolean {
    if (!this.canvas || (this.canvas.width === width && this.canvas.height === height)) return false
    this.canvas.width = width
    this.canvas.height = height
    return true
  }

  clear(): void {
    if (this.canvas) this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
  }
}

export function drawLive({ context, canvas, video, sourceRect }: HeadlinerEffectRenderArgs): void {
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, canvas.width, canvas.height)
}

export function drawVideoInto(surface: WorkSurface, { video, sourceRect }: HeadlinerEffectRenderArgs): boolean {
  const target = surface.context
  if (!target || !surface.canvas) return false
  target.globalAlpha = 1
  target.globalCompositeOperation = 'source-over'
  target.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, surface.canvas.width, surface.canvas.height)
  return true
}

/** Strength shared by every effect: Master Intensity times the music and kick reactions. */
export function effectStrength(parameters: HeadlinerParameterValues, timing: HeadlinerEffectTiming): number {
  return getHeadlinerNumber(parameters, 'masterIntensity', 1) * headlinerReactiveGain(
    timing,
    getHeadlinerNumber(parameters, 'musicReactivity', 0),
    getHeadlinerNumber(parameters, 'kickReactivity', 0),
  )
}

export interface HeadlinerPalette {
  mode: string
  primary: [number, number, number]
  secondary: [number, number, number]
  amount: number
}

export function readPalette(parameters: HeadlinerParameterValues): HeadlinerPalette {
  return {
    mode: getHeadlinerString(parameters, 'colorMode', 'original'),
    primary: hexToRgb(getHeadlinerString(parameters, 'primaryColor', '#67f7ff')),
    secondary: hexToRgb(getHeadlinerString(parameters, 'secondaryColor', '#ff4fd8')),
    amount: getHeadlinerNumber(parameters, 'tintAmount', 0.7),
  }
}

/** Recolours what is already drawn on a surface toward `color`, leaving transparent areas alone. */
export function tintSurface(surface: WorkSurface, color: readonly number[], amount: number): void {
  const target = surface.context
  if (!target || !surface.canvas || amount <= 0) return
  target.save()
  target.globalCompositeOperation = 'source-atop'
  target.globalAlpha = 1
  target.fillStyle = rgba(color, amount)
  target.fillRect(0, 0, surface.canvas.width, surface.canvas.height)
  target.restore()
}

export function compositeLayer(
  args: HeadlinerEffectRenderArgs,
  layer: WorkSurface,
  alpha: number,
  blend: string,
  blurPx = 0,
): void {
  if (!layer.canvas || alpha <= 0) return
  const { context, canvas } = args
  context.save()
  context.globalAlpha = clamp01(alpha)
  context.globalCompositeOperation = HEADLINER_BLEND_OPERATIONS[blend] ?? 'source-over'
  if (blurPx > 0.25) context.filter = `blur(${blurPx.toFixed(2)}px)`
  context.drawImage(layer.canvas, 0, 0, layer.canvas.width, layer.canvas.height, 0, 0, canvas.width, canvas.height)
  context.restore()
}

/** Keeps only the part of `layer` where the mask is opaque. */
export function applyMask(layer: WorkSurface, mask: HTMLCanvasElement | null, blurPx: number): void {
  const target = layer.context
  if (!target || !layer.canvas || !mask) return
  target.save()
  target.globalCompositeOperation = 'destination-in'
  target.globalAlpha = 1
  if (blurPx > 0.25) target.filter = `blur(${blurPx.toFixed(2)}px)`
  target.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, layer.canvas.width, layer.canvas.height)
  target.restore()
}

