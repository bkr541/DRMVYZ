// The Headliner effect processors (Motion Echo, Ghost Trails, Velocity Smear, Motion Melt, Freeze Ghost, Strobe
// Clone, Clone Spread, RGB Ghost, Face Warp, Face Echo). Each one draws the live camera picture first and then layers its effect on top, so Master
// Intensity 0 is always the clean camera. They work on reduced-size surfaces (capped at WORK_MAX_WIDTH) to keep
// history and feedback buffers cheap, and read every setting from the Design-tab values passed in per frame.

import {
  getHeadlinerBoolean,
  getHeadlinerNumber,
  getHeadlinerString,
  type HeadlinerPresetId,
} from './HeadlinerEffectCatalog'
import { createCloneSpreadProcessor, createFreezeGhostProcessor, createStrobeCloneProcessor } from './HeadlinerCloneEffects'
import {
  HEADLINER_MAX_ECHOES,
  HEADLINER_SMEAR_DRAW_BUDGET,
  WorkSurface,
  applyMask,
  clamp01,
  compositeLayer,
  drawLive,
  drawVideoInto,
  effectStrength,
  lerp,
  mixRgb,
  readPalette,
  resolveHeadlinerWorkSize,
  rgba,
  tintSurface,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import { HeadlinerMotionAnalyzer } from './HeadlinerMotion'
import { createFaceEchoProcessor, createFaceWarpProcessor } from './HeadlinerFaceEffects'
import { createRgbGhostProcessor } from './HeadlinerTemporalEffects'

export { HEADLINER_MAX_ECHOES, HEADLINER_SMEAR_DRAW_BUDGET, HEADLINER_WORK_MAX_WIDTH, hexToRgb, resolveHeadlinerWorkSize } from './HeadlinerEffectKit'
export type { HeadlinerEffectProcessor, HeadlinerEffectRenderArgs } from './HeadlinerEffectKit'

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

// ── Motion Melt ────────────────────────────────────────────────────────────────

/**
 * One step of the melt's displacement field (x,y per flow cell, in work pixels): movement adds to it, drip
 * pulls it down, it spreads into neighbouring cells like a liquid, and it settles back over time.
 */
export function stepMeltField(
  field: Float32Array,
  scratch: Float32Array,
  flow: Float32Array,
  cols: number,
  rows: number,
  options: { pixelsPerFlow: number; threshold: number; gain: number; drip: number; settle: number; limit: number },
): void {
  const { pixelsPerFlow, threshold, gain, drip, settle, limit } = options
  for (let cell = 0; cell < cols * rows; cell += 1) {
    const slot = cell * 2
    const vx = flow[slot]
    const vy = flow[slot + 1]
    const magnitude = Math.hypot(vx, vy)
    if (magnitude > threshold) {
      const weight = clamp01((magnitude - threshold) / 3)
      field[slot] += vx * pixelsPerFlow * gain
      field[slot + 1] += vy * pixelsPerFlow * gain + drip * weight * pixelsPerFlow * 1.6
    }
  }
  // Viscous spreading: each cell leans toward the average of its four neighbours.
  scratch.set(field)
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const slot = (row * cols + col) * 2
      for (let axis = 0; axis < 2; axis += 1) {
        let sum = 0
        let neighbours = 0
        if (col > 0) { sum += scratch[slot - 2 + axis]; neighbours += 1 }
        if (col < cols - 1) { sum += scratch[slot + 2 + axis]; neighbours += 1 }
        if (row > 0) { sum += scratch[slot - cols * 2 + axis]; neighbours += 1 }
        if (row < rows - 1) { sum += scratch[slot + cols * 2 + axis]; neighbours += 1 }
        const spread = neighbours > 0 ? sum / neighbours : scratch[slot + axis]
        const blended = scratch[slot + axis] * 0.7 + spread * 0.3
        field[slot + axis] = Math.max(-limit, Math.min(limit, blended * settle))
      }
    }
  }
}

class MotionMeltProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'motion-melt' as const
  private readonly picture = new WorkSurface()
  private readonly layer = new WorkSurface()
  private readonly analyzer = new HeadlinerMotionAnalyzer()
  private field = new Float32Array(0)
  private scratch = new Float32Array(0)

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context || !this.picture.context) {
      this.field.fill(0)
      return
    }

    const frame = this.analyzer.update(video, sourceRect, true)
    if (!frame?.flow) return
    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.picture.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)
    if (this.field.length !== frame.cols * frame.rows * 2) {
      this.field = new Float32Array(frame.cols * frame.rows * 2)
      this.scratch = new Float32Array(this.field.length)
    }

    const amount = getHeadlinerNumber(parameters, 'meltAmount', 0.6)
    const beatFraction = timing.beat - Math.floor(timing.beat)
    const surge = 1 + getHeadlinerNumber(parameters, 'beatSurge', 0) * 1.5 * Math.exp(-4 * beatFraction)
    const viscosity = getHeadlinerNumber(parameters, 'viscosity', 0.5)
    const cellWidth = work.width / frame.cols
    const cellHeight = work.height / frame.rows
    stepMeltField(this.field, this.scratch, frame.flow, frame.cols, frame.rows, {
      pixelsPerFlow: work.width / frame.width,
      threshold: getHeadlinerNumber(parameters, 'motionThreshold', 0.2) * 3,
      gain: amount * 5 * surge * Math.min(1.5, strength),
      drip: getHeadlinerNumber(parameters, 'drip', 0.35),
      // Per-frame retention, scaled so settling takes the same time at any frame rate.
      settle: Math.pow(lerp(0.8, 0.985, viscosity), timing.dtSec * 60),
      limit: work.width * 0.18 * (0.5 + amount),
    })

    if (!drawVideoInto(this.picture, args) || !this.picture.canvas) return
    const layer = this.layer.context
    if (!layer) return
    this.layer.clear()
    const dripStretch = getHeadlinerNumber(parameters, 'drip', 0.35)
    let drawn = 0
    for (let row = 0; row < frame.rows; row += 1) {
      for (let col = 0; col < frame.cols; col += 1) {
        const slot = (row * frame.cols + col) * 2
        const dx = this.field[slot]
        const dy = this.field[slot + 1]
        const magnitude = Math.hypot(dx, dy)
        if (magnitude < 0.6) continue
        // The cell shows the picture from where the melt has pushed it from: content is dragged along.
        const padX = cellWidth * 0.5
        const padY = cellHeight * 0.5
        const destX = col * cellWidth - padX
        const destY = row * cellHeight - padY
        const destW = cellWidth + padX * 2
        const destH = (cellHeight + padY * 2) * (1 + dripStretch * clamp01(Math.abs(dy) / (cellHeight * 2)) * 0.8)
        const sourceX = Math.max(0, Math.min(work.width - destW, destX - dx))
        const sourceY = Math.max(0, Math.min(work.height - cellHeight - padY * 2, destY - dy))
        layer.globalAlpha = clamp01(magnitude / (cellHeight * 0.6))
        layer.drawImage(
          this.picture.canvas,
          sourceX, sourceY, Math.min(destW, work.width - sourceX), Math.min(cellHeight + padY * 2, work.height - sourceY),
          destX, destY, destW, destH,
        )
        drawn += 1
      }
    }
    layer.globalAlpha = 1
    if (drawn === 0) return

    const palette = readPalette(parameters)
    if (palette.mode === 'tint') {
      tintSurface(this.layer, palette.primary, palette.amount)
    } else if (palette.mode === 'gradient') {
      layer.save()
      layer.globalCompositeOperation = 'source-atop'
      const gradient = layer.createLinearGradient(0, 0, 0, work.height)
      gradient.addColorStop(0, rgba(palette.primary, palette.amount))
      gradient.addColorStop(1, rgba(palette.secondary, palette.amount))
      layer.fillStyle = gradient
      layer.fillRect(0, 0, work.width, work.height)
      layer.restore()
    }

    compositeLayer(
      args,
      this.layer,
      Math.min(1, strength),
      getHeadlinerString(parameters, 'blendMode', 'normal'),
      getHeadlinerNumber(parameters, 'fluidity', 0.5) * 5 * (canvas.width / 1280),
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
    case 'motion-melt':
      return new MotionMeltProcessor()
    case 'freeze-ghost':
      return createFreezeGhostProcessor()
    case 'strobe-clone':
      return createStrobeCloneProcessor()
    case 'clone-spread':
      return createCloneSpreadProcessor()
    case 'rgb-ghost':
      return createRgbGhostProcessor()
    case 'face-warp':
      return createFaceWarpProcessor()
    case 'face-echo':
      return createFaceEchoProcessor()
    case 'motion-echo':
    default:
      return new MotionEchoProcessor()
  }
}
