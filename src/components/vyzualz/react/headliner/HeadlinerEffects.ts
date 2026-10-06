// The Headliner effect processors (Motion Echo, Ghost Trails, Velocity Smear). Each one draws the live
// camera picture first and then layers its effect on top, so Master Intensity 0 is always the clean
// camera. They work on reduced-size surfaces (capped at WORK_MAX_WIDTH) to keep history and feedback
// buffers cheap, and read every setting from the Design-tab values passed in per frame.

import {
  HEADLINER_BLEND_OPERATIONS,
  getHeadlinerBoolean,
  getHeadlinerNumber,
  getHeadlinerString,
  type HeadlinerParameterValues,
  type HeadlinerPresetId,
} from './HeadlinerEffectCatalog'
import type { HeadlinerSourceRect } from './HeadlinerCompositor'
import { HeadlinerMotionAnalyzer } from './HeadlinerMotion'
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount

export function hexToRgb(hex: string): [number, number, number] {
  const value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ffffff'
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)]
}

function rgba([r, g, b]: readonly number[], alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp01(alpha)})`
}

function mixRgb(a: readonly number[], b: readonly number[], amount: number): [number, number, number] {
  return [lerp(a[0], b[0], amount), lerp(a[1], b[1], amount), lerp(a[2], b[2], amount)]
}

export function resolveHeadlinerWorkSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 }
  const scale = Math.min(1, HEADLINER_WORK_MAX_WIDTH / width)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

class WorkSurface {
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

function drawLive({ context, canvas, video, sourceRect }: HeadlinerEffectRenderArgs): void {
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, canvas.width, canvas.height)
}

function drawVideoInto(surface: WorkSurface, { video, sourceRect }: HeadlinerEffectRenderArgs): boolean {
  const target = surface.context
  if (!target || !surface.canvas) return false
  target.globalAlpha = 1
  target.globalCompositeOperation = 'source-over'
  target.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, surface.canvas.width, surface.canvas.height)
  return true
}

/** Strength shared by all three effects: Master Intensity times the music and kick reactions. */
function effectStrength(parameters: HeadlinerParameterValues, timing: HeadlinerEffectTiming): number {
  return getHeadlinerNumber(parameters, 'masterIntensity', 1) * headlinerReactiveGain(
    timing,
    getHeadlinerNumber(parameters, 'musicReactivity', 0),
    getHeadlinerNumber(parameters, 'kickReactivity', 0),
  )
}

interface HeadlinerPalette {
  mode: string
  primary: [number, number, number]
  secondary: [number, number, number]
  amount: number
}

function readPalette(parameters: HeadlinerParameterValues): HeadlinerPalette {
  return {
    mode: getHeadlinerString(parameters, 'colorMode', 'original'),
    primary: hexToRgb(getHeadlinerString(parameters, 'primaryColor', '#67f7ff')),
    secondary: hexToRgb(getHeadlinerString(parameters, 'secondaryColor', '#ff4fd8')),
    amount: getHeadlinerNumber(parameters, 'tintAmount', 0.7),
  }
}

/** Recolours what is already drawn on a surface toward `color`, leaving transparent areas alone. */
function tintSurface(surface: WorkSurface, color: readonly number[], amount: number): void {
  const target = surface.context
  if (!target || !surface.canvas || amount <= 0) return
  target.save()
  target.globalCompositeOperation = 'source-atop'
  target.globalAlpha = 1
  target.fillStyle = rgba(color, amount)
  target.fillRect(0, 0, surface.canvas.width, surface.canvas.height)
  target.restore()
}

function compositeLayer(
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
function applyMask(layer: WorkSurface, mask: HTMLCanvasElement | null, blurPx: number): void {
  const target = layer.context
  if (!target || !layer.canvas || !mask) return
  target.save()
  target.globalCompositeOperation = 'destination-in'
  target.globalAlpha = 1
  if (blurPx > 0.25) target.filter = `blur(${blurPx.toFixed(2)}px)`
  target.drawImage(mask, 0, 0, mask.width, mask.height, 0, 0, layer.canvas.width, layer.canvas.height)
  target.restore()
}

// ── Motion Echo ────────────────────────────────────────────────────────────────

class MotionEchoProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'motion-echo' as const
  /** Newest first. */
  private history: WorkSurface[] = []
  private spare: WorkSurface[] = []
  private readonly layer = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private readonly analyzer = new HeadlinerMotionAnalyzer()
  private lastSlot = Number.NaN
  private lastCaptureSec = Number.NEGATIVE_INFINITY

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.clearHistory()
      return
    }

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    if (this.layer.resize(work.width, work.height)) this.clearHistory()
    this.scratch.resize(work.width, work.height)

    const count = Math.round(getHeadlinerNumber(parameters, 'echoCount', 5))
    this.captureIfDue(args, work.width, work.height)

    const echoes = this.history.slice(0, count)
    if (echoes.length === 0) return

    const motionOnly = getHeadlinerNumber(parameters, 'motionOnly', 0)
    const frame = motionOnly > 0 ? this.analyzer.update(video, sourceRect, false) : null

    const layer = this.layer.context
    if (!layer) return
    this.layer.clear()
    const palette = readPalette(parameters)
    const opacity = getHeadlinerNumber(parameters, 'echoOpacity', 0.55)
    const falloff = getHeadlinerNumber(parameters, 'echoFalloff', 0.78)
    const drift = getHeadlinerNumber(parameters, 'echoDrift', 0) * 0.045
    const angle = (getHeadlinerNumber(parameters, 'driftAngle', 270) * Math.PI) / 180
    const zoom = getHeadlinerNumber(parameters, 'echoZoom', 0)

    // Oldest first so the newest clone ends up on top.
    for (let k = echoes.length - 1; k >= 0; k -= 1) {
      const echo = echoes[k]
      if (!echo.canvas) continue
      let source: HTMLCanvasElement = echo.canvas
      if (palette.mode !== 'original' && this.scratch.context && this.scratch.canvas) {
        this.scratch.clear()
        this.scratch.context.globalAlpha = 1
        this.scratch.context.drawImage(echo.canvas, 0, 0)
        const along = echoes.length > 1 ? k / (echoes.length - 1) : 0
        tintSurface(this.scratch, palette.mode === 'gradient' ? mixRgb(palette.primary, palette.secondary, along) : palette.primary, palette.amount)
        source = this.scratch.canvas
      }
      layer.save()
      layer.globalAlpha = clamp01(opacity * Math.pow(falloff, k) * strength)
      layer.translate(work.width / 2 + Math.cos(angle) * drift * work.width * (k + 1), work.height / 2 + Math.sin(angle) * drift * work.width * (k + 1))
      const scale = Math.max(0.05, 1 + zoom * (k + 1))
      layer.scale(scale, scale)
      layer.drawImage(source, -work.width / 2, -work.height / 2)
      layer.restore()
    }

    if (frame) applyMask(this.layer, this.analyzer.buildMask(frame, 8, 10, 1 - motionOnly), 1.5)
    compositeLayer(args, this.layer, 1, getHeadlinerString(parameters, 'blendMode', 'normal'))
  }

  private captureIfDue(args: HeadlinerEffectRenderArgs, width: number, height: number): void {
    const { parameters, timing } = args
    const synced = getHeadlinerBoolean(parameters, 'bpmSync', true)
    let due: boolean
    if (synced) {
      const division = Number(getHeadlinerString(parameters, 'echoSpacingBeats', '0.25')) || 0.25
      const slot = Math.floor(timing.beat / division)
      due = slot !== this.lastSlot
      this.lastSlot = slot
    } else {
      const delaySec = getHeadlinerNumber(parameters, 'echoDelayMs', 130) / 1000
      due = timing.timeSec - this.lastCaptureSec >= delaySec
    }
    if (!due && this.history.length > 0) return
    this.lastCaptureSec = timing.timeSec

    const surface = this.spare.pop() ?? new WorkSurface()
    surface.resize(width, height)
    if (!drawVideoInto(surface, args)) {
      this.spare.push(surface)
      return
    }
    this.history.unshift(surface)
    while (this.history.length > HEADLINER_MAX_ECHOES) {
      const old = this.history.pop()
      if (old) this.spare.push(old)
    }
  }

  private clearHistory(): void {
    this.spare.push(...this.history)
    this.history = []
    this.lastSlot = Number.NaN
    this.lastCaptureSec = Number.NEGATIVE_INFINITY
  }

  dispose(): void {
    for (const surface of [...this.history, ...this.spare, this.layer, this.scratch]) surface.dispose()
    this.history = []
    this.spare = []
    this.analyzer.dispose()
  }
}

// ── Ghost Trails ───────────────────────────────────────────────────────────────

class GhostTrailsProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'ghost-trails' as const
  private trail = new WorkSurface()
  private fade = new WorkSurface()
  private readonly deposit = new WorkSurface()
  private readonly analyzer = new HeadlinerMotionAnalyzer()

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.trail.context || !this.fade.context) {
      this.trail.clear()
      return
    }

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    const resized = this.trail.resize(work.width, work.height)
    this.fade.resize(work.width, work.height)
    this.deposit.resize(work.width, work.height)
    if (resized) this.analyzer.reset()

    const frame = this.analyzer.update(video, sourceRect, false)
    const speed = frame?.speed ?? 0
    const palette = readPalette(parameters)

    // Half-life in seconds: beats of the track with BPM Sync on, plain seconds with it off. Faster movement
    // stretches it, and a louder track lengthens it a little.
    const synced = getHeadlinerBoolean(parameters, 'bpmSync', true)
    const baseHalfLife = synced
      ? (Number(getHeadlinerString(parameters, 'trailBeats', '1')) || 1) * timing.secondsPerBeat
      : getHeadlinerNumber(parameters, 'trailSeconds', 0.6)
    const halfLife = Math.max(0.03, baseHalfLife
      * (1 + getHeadlinerNumber(parameters, 'speedBoost', 0.6) * speed * 3)
      * Math.min(1.8, Math.max(0.6, strength)))
    const keep = Math.pow(0.5, timing.dtSec / halfLife)

    // Age the existing trail: fade, float, blur and (Gradient) shift toward the end colour.
    const fadeContext = this.fade.context
    this.fade.clear()
    fadeContext.save()
    fadeContext.globalAlpha = keep
    const softness = getHeadlinerNumber(parameters, 'softness', 0.4)
    if (softness > 0.02) fadeContext.filter = `blur(${(softness * 2.4 * (work.width / 720)).toFixed(2)}px)`
    const rise = getHeadlinerNumber(parameters, 'vaporRise', 0.15) * work.height * 0.003 * timing.dtSec * 60
    fadeContext.drawImage(this.trail.canvas as HTMLCanvasElement, 0, -rise)
    fadeContext.restore()
    if (palette.mode === 'gradient') tintSurface(this.fade, palette.secondary, 0.06 * timing.dtSec * 60 * palette.amount)
    // Multiplying alone leaves faint 8-bit residue that never clears, so also take a little away.
    fadeContext.save()
    fadeContext.globalCompositeOperation = 'destination-out'
    fadeContext.fillStyle = 'rgba(0, 0, 0, 0.012)'
    fadeContext.fillRect(0, 0, work.width, work.height)
    fadeContext.restore()
    const aged = this.trail
    this.trail = this.fade
    this.fade = aged

    // Deposit only the parts of the picture that are moving, so a still performer stays clean.
    if (frame && this.deposit.context && drawVideoInto(this.deposit, args)) {
      if (palette.mode !== 'original') tintSurface(this.deposit, palette.primary, palette.amount)
      const sensitivity = getHeadlinerNumber(parameters, 'motionSensitivity', 0.6)
      applyMask(this.deposit, this.analyzer.buildMask(frame, lerp(3, 14, sensitivity), lerp(24, 4, sensitivity)), 1.5)
      const trail = this.trail.context
      if (trail && this.deposit.canvas) {
        trail.save()
        trail.globalCompositeOperation = 'source-over'
        trail.globalAlpha = clamp01(0.6 * Math.min(1.5, strength))
        trail.drawImage(this.deposit.canvas, 0, 0)
        trail.restore()
      }
    }

    compositeLayer(
      args,
      this.trail,
      getHeadlinerNumber(parameters, 'ghostOpacity', 0.7) * Math.min(1, strength),
      getHeadlinerString(parameters, 'blendMode', 'screen'),
    )
  }

  dispose(): void {
    this.trail.dispose()
    this.fade.dispose()
    this.deposit.dispose()
    this.analyzer.dispose()
  }
}

// ── Velocity Smear ─────────────────────────────────────────────────────────────

/** How many frames of movement the longest smear extrapolates. */
const SMEAR_MAX_FRAMES = 18

class VelocitySmearProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'velocity-smear' as const
  private readonly picture = new WorkSurface()
  private readonly layer = new WorkSurface()
  private readonly analyzer = new HeadlinerMotionAnalyzer()

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context || !this.picture.context) return

    const frame = this.analyzer.update(video, sourceRect, true)
    if (!frame?.flow) return
    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.picture.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)
    if (!drawVideoInto(this.picture, args) || !this.picture.canvas) return

    const threshold = getHeadlinerNumber(parameters, 'motionThreshold', 0.25) * 3
    const beatFraction = timing.beat - Math.floor(timing.beat)
    const pump = 1 + getHeadlinerNumber(parameters, 'beatPump', 0) * 1.5 * Math.exp(-4 * beatFraction)
    const frames = getHeadlinerNumber(parameters, 'smearLength', 0.5) * SMEAR_MAX_FRAMES * pump * Math.min(1.5, strength)
    const direction = getHeadlinerString(parameters, 'smearDirection', 'with')
    const signs = direction === 'both' ? [1, -1] : direction === 'behind' ? [-1] : [1]
    const quality = Number(getHeadlinerString(parameters, 'smearQuality', '10')) || 10

    // Cells that are moving fast enough to smear.
    const cells: { col: number; row: number; vx: number; vy: number; weight: number }[] = []
    for (let row = 0; row < frame.rows; row += 1) {
      for (let col = 0; col < frame.cols; col += 1) {
        const slot = (row * frame.cols + col) * 2
        const vx = frame.flow[slot]
        const vy = frame.flow[slot + 1]
        const magnitude = Math.hypot(vx, vy)
        if (magnitude <= threshold) continue
        cells.push({ col, row, vx, vy, weight: clamp01((magnitude - threshold) / 3) })
      }
    }
    if (cells.length === 0) return

    const taps = Math.max(2, Math.min(quality, Math.floor(HEADLINER_SMEAR_DRAW_BUDGET / (cells.length * signs.length))))
    const layer = this.layer.context
    if (!layer) return
    this.layer.clear()
    const cellWidth = work.width / frame.cols
    const cellHeight = work.height / frame.rows
    const padX = cellWidth * 0.5
    const padY = cellHeight * 0.5
    for (const cell of cells) {
      const sourceX = Math.max(0, cell.col * cellWidth - padX)
      const sourceY = Math.max(0, cell.row * cellHeight - padY)
      const sourceW = Math.min(work.width - sourceX, cellWidth + padX * 2)
      const sourceH = Math.min(work.height - sourceY, cellHeight + padY * 2)
      // Analysis pixels per frame -> work pixels over the smear length.
      const stepX = (cell.vx / frame.width) * work.width * frames
      const stepY = (cell.vy / frame.height) * work.height * frames
      for (const sign of signs) {
        for (let tap = 1; tap <= taps; tap += 1) {
          const along = tap / taps
          layer.globalAlpha = clamp01(0.9 * cell.weight * Math.pow(1 - along, 1.1))
          layer.drawImage(
            this.picture.canvas,
            sourceX, sourceY, sourceW, sourceH,
            sourceX + stepX * along * sign, sourceY + stepY * along * sign, sourceW, sourceH,
          )
        }
      }
    }
    layer.globalAlpha = 1

    const palette = readPalette(parameters)
    if (palette.mode === 'tint') {
      tintSurface(this.layer, palette.primary, palette.amount)
    } else if (palette.mode === 'gradient') {
      layer.save()
      layer.globalCompositeOperation = 'source-atop'
      const gradient = layer.createLinearGradient(0, 0, work.width, 0)
      gradient.addColorStop(0, rgba(palette.primary, palette.amount))
      gradient.addColorStop(1, rgba(palette.secondary, palette.amount))
      layer.fillStyle = gradient
      layer.fillRect(0, 0, work.width, work.height)
      layer.restore()
    }

    const softness = getHeadlinerNumber(parameters, 'smearSoftness', 0.35)
    compositeLayer(
      args,
      this.layer,
      getHeadlinerNumber(parameters, 'smearOpacity', 0.8) * Math.min(1, strength),
      getHeadlinerString(parameters, 'blendMode', 'normal'),
      softness * 6 * (canvas.width / 1280),
    )
  }

  dispose(): void {
    this.picture.dispose()
    this.layer.dispose()
    this.analyzer.dispose()
  }
}

export function createHeadlinerEffectProcessor(presetId: HeadlinerPresetId): HeadlinerEffectProcessor {
  switch (presetId) {
    case 'ghost-trails':
      return new GhostTrailsProcessor()
    case 'velocity-smear':
      return new VelocitySmearProcessor()
    case 'motion-echo':
    default:
      return new MotionEchoProcessor()
  }
}
