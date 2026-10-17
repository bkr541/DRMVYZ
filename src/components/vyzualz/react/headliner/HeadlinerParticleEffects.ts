// The particle effects of the POV document: Particle Body (priority 14) and Particle Shed (15).
//   - Particle Body rebuilds the performer's silhouette out of coloured particles that spring to their place on the
//     body, and can drift, explode, collapse or swirl on the music. It follows the shared person segmentation.
//   - Particle Shed leaves the live picture alone and throws particles off whatever is moving, along the motion
//     direction from the block-matching flow field.
// Both draw with the 2D canvas into a work-size layer. Master Intensity 0 is always the clean camera.

import { getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  clamp01,
  compositeLayer,
  drawLive,
  effectStrength,
  lerp,
  readPalette,
  resolveHeadlinerWorkSize,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
  type HeadlinerPalette,
} from './HeadlinerEffectKit'
import { HeadlinerMotionAnalyzer } from './HeadlinerMotion'
import { HeadlinerSilhouetteSource, type HeadlinerSegmentSource } from './HeadlinerSegmentation'
import { glowNoise } from './HeadlinerSilhouetteEffects'

export interface HeadlinerParticleEffectDeps {
  segmenter?: () => HeadlinerSegmentSource
}

// ── Shared ─────────────────────────────────────────────────────────────────────

/** Fill styles for 4096 quantised colours, built on demand, so thousands of particles do not each format a string. */
class ColorStyles {
  private readonly cache: string[] = new Array<string>(4096)

  get(r: number, g: number, b: number): string {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    return this.cache[key] ??= `rgb(${(r >> 4) * 17}, ${(g >> 4) * 17}, ${(b >> 4) * 17})`
  }
}

/** Colour of a particle: the camera's own, tinted, or blended top to bottom, by the standard palette. */
export function resolveParticleColor(
  palette: HeadlinerPalette,
  camera: readonly [number, number, number],
  down: number,
): [number, number, number] {
  if (palette.mode === 'original') return [camera[0], camera[1], camera[2]]
  const target = palette.mode === 'gradient'
    ? [lerp(palette.primary[0], palette.secondary[0], down), lerp(palette.primary[1], palette.secondary[1], down), lerp(palette.primary[2], palette.secondary[2], down)]
    : palette.primary
  return [lerp(camera[0], target[0], palette.amount), lerp(camera[1], target[1], palette.amount), lerp(camera[2], target[2], palette.amount)]
}

class ReadSurface {
  readonly canvas: HTMLCanvasElement | null
  readonly context: CanvasRenderingContext2D | null

  constructor() {
    this.canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
    this.context = this.canvas?.getContext('2d', { willReadFrequently: true }) ?? null
  }

  resize(width: number, height: number): void {
    if (this.canvas && (this.canvas.width !== width || this.canvas.height !== height)) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  read(source: CanvasImageSource, sx?: number, sy?: number, sw?: number, sh?: number): Uint8ClampedArray | null {
    const canvas = this.canvas
    const context = this.context
    if (!canvas || !context) return null
    try {
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (sx === undefined) context.drawImage(source, 0, 0, canvas.width, canvas.height)
      else context.drawImage(source, sx, sy as number, sw as number, sh as number, 0, 0, canvas.width, canvas.height)
      return context.getImageData(0, 0, canvas.width, canvas.height).data
    } catch {
      return null
    }
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
  }
}

// ── Particle Body ──────────────────────────────────────────────────────────────

export const HEADLINER_PARTICLE_BODY_GRID: Readonly<Record<string, number>> = Object.freeze({ low: 96, medium: 128, high: 192 })

/**
 * How much of the body is particles at this beat, 0..1: normal video → partial → full particle body → normal video.
 * 'off' leaves it to the Particle Amount setting alone; 'bar' and 'two' run one cycle over 4 or 8 beats.
 */
export function resolveParticleBodyCycle(cycle: string, beat: number): number {
  const length = cycle === 'bar' ? 4 : cycle === 'two' ? 8 : 0
  if (length === 0) return 1
  const phase = (((beat / length) % 1) + 1) % 1
  if (phase < 0.25) return phase / 0.25
  if (phase < 0.75) return 1
  return (1 - phase) / 0.25
}

class ParticleBodyProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'particle-body' as const
  private readonly source: HeadlinerSilhouetteSource
  private readonly layer = new WorkSurface()
  private readonly cover = new WorkSurface()
  private readonly video = new ReadSurface()
  private readonly maskRead = new ReadSurface()
  private readonly styles = new ColorStyles()
  private cols = 0
  private rows = 0
  private x = new Float32Array(0)
  private y = new Float32Array(0)
  private vx = new Float32Array(0)
  private vy = new Float32Array(0)
  private alpha = new Float32Array(0)
  private seed = new Float32Array(0)
  private centerX = 0
  private centerY = 0

  constructor(deps: HeadlinerParticleEffectDeps = {}) {
    this.source = new HeadlinerSilhouetteSource(deps.segmenter)
  }

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.source.release()
      this.reset()
      return
    }
    const silhouette = this.source.update(video, sourceRect, timing.timeSec)
    if (!silhouette.mask) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.layer.resize(work.width, work.height)
    this.cover.resize(work.width, work.height)
    const gridWidth = HEADLINER_PARTICLE_BODY_GRID[getHeadlinerString(parameters, 'detail', 'medium')] ?? 128
    const gridHeight = Math.max(2, Math.round(gridWidth * (work.height / work.width)))
    if (gridWidth !== this.cols || gridHeight !== this.rows) this.allocate(gridWidth, gridHeight, work.width, work.height)
    this.video.resize(this.cols, this.rows)
    this.maskRead.resize(this.cols, this.rows)
    const colors = this.video.read(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh)
    const maskPixels = this.maskRead.read(silhouette.mask)
    const layer = this.layer.context
    if (!colors || !maskPixels || !layer) return

    const cellWidth = work.width / this.cols
    const cellHeight = work.height / this.rows
    const amount = clamp01(getHeadlinerNumber(parameters, 'particleAmount', 1) * resolveParticleBodyCycle(getHeadlinerString(parameters, 'cycle', 'bar'), timing.beat))
    const dt60 = Math.min(3, timing.dtSec * 60)
    const mode = getHeadlinerString(parameters, 'reaction', 'drift')
    const power = getHeadlinerNumber(parameters, 'reactionPower', 0.6) * Math.min(1.5, strength)
    const cohesion = lerp(0.03, 0.22, getHeadlinerNumber(parameters, 'cohesion', 0.5))
    const drift = getHeadlinerNumber(parameters, 'driftAmount', 0.3) * work.width * 0.012
    const scatter = getHeadlinerNumber(parameters, 'scatter', 0.15) * work.width * 0.03
    const size = getHeadlinerNumber(parameters, 'particleSize', 1) * Math.max(cellWidth, cellHeight)
    const palette = readPalette(parameters)
    const impulse = timing.kickHit || (mode === 'collapse' && timing.downbeatHit)
    const wasCenterX = this.centerX
    const wasCenterY = this.centerY
    let sumX = 0
    let sumY = 0
    let active = 0

    this.layer.clear()
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const cell = row * this.cols + col
        const base = cell * 4
        const body = maskPixels[base + 3] > 128 && this.seed[cell] < amount
        const homeX = (col + 0.5) * cellWidth
        const homeY = (row + 0.5) * cellHeight
        const target = body ? 1 : 0
        this.alpha[cell] += (target - this.alpha[cell]) * Math.min(1, 0.25 * dt60)
        const visible = this.alpha[cell]
        if (visible < 0.02) {
          // Resting particles wait on their cell, so a body that moves onto them is rebuilt from the right place.
          this.x[cell] = homeX
          this.y[cell] = homeY
          this.vx[cell] = 0
          this.vy[cell] = 0
          continue
        }
        if (body) { sumX += homeX; sumY += homeY; active += 1 }

        // Aim: home, plus a slow wander, plus the scatter that keeps the body loose.
        const phase = this.seed[cell] * 40
        const wander = drift * (0.6 + 0.4 * Math.sin(timing.timeSec * 0.7 + phase))
        let aimX = homeX + Math.cos(timing.timeSec * 0.9 + phase) * wander + (glowNoise(cell * 1.7) - 0.5) * scatter
        let aimY = homeY + Math.sin(timing.timeSec * 1.1 + phase * 1.3) * wander + (glowNoise(cell * 2.3) - 0.5) * scatter
        const fromCenterX = homeX - wasCenterX
        const fromCenterY = homeY - wasCenterY
        const distance = Math.max(1, Math.hypot(fromCenterX, fromCenterY))
        if (mode === 'swirl') {
          aimX += (-fromCenterY / distance) * power * work.width * 0.03
          aimY += (fromCenterX / distance) * power * work.width * 0.03
        }
        if (impulse && (mode === 'explode' || mode === 'collapse')) {
          const sign = mode === 'explode' ? 1 : -1
          const kick = power * work.width * 0.035 * (0.4 + glowNoise(cell * 5.1 + timing.timeSec))
          this.vx[cell] += (fromCenterX / distance) * kick * sign
          this.vy[cell] += (fromCenterY / distance) * kick * sign
        }

        this.vx[cell] = (this.vx[cell] + (aimX - this.x[cell]) * cohesion * dt60) * Math.pow(0.82, dt60)
        this.vy[cell] = (this.vy[cell] + (aimY - this.y[cell]) * cohesion * dt60) * Math.pow(0.82, dt60)
        this.x[cell] += this.vx[cell] * dt60
        this.y[cell] += this.vy[cell] * dt60

        const camera: [number, number, number] = [colors[base], colors[base + 1], colors[base + 2]]
        const [r, g, b] = resolveParticleColor(palette, camera, row / this.rows)
        const grain = size * (0.75 + 0.5 * this.seed[cell])
        layer.globalAlpha = clamp01(visible)
        layer.fillStyle = this.styles.get(r, g, b)
        layer.fillRect(this.x[cell] - grain / 2, this.y[cell] - grain / 2, grain, grain)
      }
    }
    layer.globalAlpha = 1
    this.centerX = active > 0 ? sumX / active : work.width / 2
    this.centerY = active > 0 ? sumY / active : work.height / 2

    // The real body fades out as it turns into particles, leaving the room around it untouched.
    const hide = getHeadlinerNumber(parameters, 'hideBody', 0.9) * amount * Math.min(1, strength)
    if (hide > 0.01 && this.cover.context && silhouette.mask) {
      const cover = this.cover.context
      this.cover.clear()
      cover.fillStyle = 'rgb(0, 0, 0)'
      cover.fillRect(0, 0, work.width, work.height)
      cover.save()
      cover.globalCompositeOperation = 'destination-in'
      cover.filter = `blur(${(1.5 * (work.width / 720)).toFixed(2)}px)`
      cover.drawImage(silhouette.mask, 0, 0, work.width, work.height)
      cover.restore()
      compositeLayer(args, this.cover, hide, 'normal')
    }

    const level = Math.min(1, strength)
    const glow = getHeadlinerNumber(parameters, 'glow', 0.3)
    const blend = getHeadlinerString(parameters, 'blendMode', 'normal')
    if (glow > 0.01) compositeLayer(args, this.layer, level * glow, 'add', glow * 10 * (canvas.width / 1280))
    compositeLayer(args, this.layer, level, blend)
  }

  private allocate(cols: number, rows: number, workWidth: number, workHeight: number): void {
    this.cols = cols
    this.rows = rows
    const count = cols * rows
    this.x = new Float32Array(count)
    this.y = new Float32Array(count)
    this.vx = new Float32Array(count)
    this.vy = new Float32Array(count)
    this.alpha = new Float32Array(count)
    this.seed = new Float32Array(count)
    for (let cell = 0; cell < count; cell += 1) this.seed[cell] = glowNoise(cell + 0.5)
    this.centerX = workWidth / 2
    this.centerY = workHeight / 2
  }

  private reset(): void {
    this.alpha.fill(0)
    this.vx.fill(0)
    this.vy.fill(0)
  }

  dispose(): void {
    this.source.dispose()
    for (const surface of [this.layer, this.cover, this.video, this.maskRead]) surface.dispose()
  }
}

export function createParticleBodyProcessor(deps?: HeadlinerParticleEffectDeps): HeadlinerEffectProcessor {
  return new ParticleBodyProcessor(deps)
}

// ── Particle Shed ──────────────────────────────────────────────────────────────

export const HEADLINER_SHED_MAX_PARTICLES = 5000

/** Particles to emit from one moving cell this frame (fractional parts become a chance, so low rates still emit). */
export function resolveShedEmission(rate: number, weight: number, dt60: number, burst: number, random: number): number {
  return Math.floor(rate * weight * dt60 * burst + random)
}

class ParticleShedProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'particle-shed' as const
  private readonly analyzer = new HeadlinerMotionAnalyzer()
  private readonly layer = new WorkSurface()
  private readonly styles = new ColorStyles()
  private readonly x = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly y = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly vx = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly vy = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly life = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly span = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly red = new Uint8Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly green = new Uint8Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly blue = new Uint8Array(HEADLINER_SHED_MAX_PARTICLES)
  private readonly rise = new Float32Array(HEADLINER_SHED_MAX_PARTICLES)
  private next = 0
  private frameCount = 0

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.life.fill(0)
      return
    }
    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    if (this.layer.resize(work.width, work.height)) this.life.fill(0)
    const layer = this.layer.context
    if (!layer) return
    const frame = this.analyzer.update(video, sourceRect, true)
    const dt = Math.min(0.1, timing.dtSec)
    const dt60 = dt * 60
    const scale = work.width / 720
    const palette = readPalette(parameters)

    if (frame?.flow) {
      const threshold = 0.3 + getHeadlinerNumber(parameters, 'motionThreshold', 0.3) * 1.6
      const rate = getHeadlinerNumber(parameters, 'emission', 0.5) * 3.2 * Math.min(1.5, strength)
      const burst = 1 + getHeadlinerNumber(parameters, 'kickBurst', 0.5) * 3 * timing.kick
      const throwGain = getHeadlinerNumber(parameters, 'throwSpeed', 0.6) * 1.4 + 0.2
      const spread = getHeadlinerNumber(parameters, 'spread', 0.4)
      const lifetime = getHeadlinerNumber(parameters, 'lifetime', 1.2)
      const cellWidth = work.width / frame.cols
      const cellHeight = work.height / frame.rows
      const pixelWidth = frame.width / work.width
      this.frameCount += 1
      for (let row = 0; row < frame.rows; row += 1) {
        for (let col = 0; col < frame.cols; col += 1) {
          const slot = (row * frame.cols + col) * 2
          const fx = frame.flow[slot]
          const fy = frame.flow[slot + 1]
          const magnitude = Math.hypot(fx, fy)
          if (magnitude <= threshold) continue
          const weight = clamp01((magnitude - threshold) / 3)
          const emit = resolveShedEmission(rate, weight, dt60, burst, Math.random())
          for (let n = 0; n < emit; n += 1) {
            const index = this.next
            this.next = (this.next + 1) % HEADLINER_SHED_MAX_PARTICLES
            const px = (col + Math.random()) * cellWidth
            const py = (row + Math.random()) * cellHeight
            const angle = Math.random() * Math.PI * 2
            const kick = (0.3 + Math.random()) * spread * 2.2 * scale
            this.x[index] = px
            this.y[index] = py
            // The cell's flow is analysis pixels per frame; scale it into work pixels and throw along it.
            this.vx[index] = (fx / pixelWidth) * throwGain * 2.4 + Math.cos(angle) * kick
            this.vy[index] = (fy / pixelWidth) * throwGain * 2.4 + Math.sin(angle) * kick
            this.span[index] = lifetime * (0.5 + Math.random() * 0.7)
            this.life[index] = this.span[index]
            this.rise[index] = 0.6 + Math.random() * 0.8
            const sample = (Math.min(frame.height - 1, Math.floor(py * pixelWidth)) * frame.width + Math.min(frame.width - 1, Math.floor(px * pixelWidth))) * 4
            const [r, g, b] = resolveParticleColor(palette, [frame.rgba[sample], frame.rgba[sample + 1], frame.rgba[sample + 2]], py / work.height)
            this.red[index] = r
            this.green[index] = g
            this.blue[index] = b
          }
        }
      }
    }

    const gravity = getHeadlinerNumber(parameters, 'gravity', 0.15) * 0.35 * scale
    const drag = Math.pow(lerp(0.99, 0.9, getHeadlinerNumber(parameters, 'drag', 0.4)), dt60)
    const size = getHeadlinerNumber(parameters, 'particleSize', 1) * 3 * scale
    this.layer.clear()
    for (let index = 0; index < HEADLINER_SHED_MAX_PARTICLES; index += 1) {
      if (this.life[index] <= 0) continue
      this.life[index] -= dt
      this.vx[index] *= drag
      this.vy[index] = this.vy[index] * drag + gravity * this.rise[index] * dt60
      this.x[index] += this.vx[index] * dt60
      this.y[index] += this.vy[index] * dt60
      const left = clamp01(this.life[index] / this.span[index])
      if (left <= 0 || this.x[index] < -10 || this.x[index] > work.width + 10 || this.y[index] < -10 || this.y[index] > work.height + 10) {
        this.life[index] = 0
        continue
      }
      const grain = size * (0.4 + 0.6 * left)
      layer.globalAlpha = clamp01(left * 1.4)
      layer.fillStyle = this.styles.get(this.red[index], this.green[index], this.blue[index])
      layer.fillRect(this.x[index] - grain / 2, this.y[index] - grain / 2, grain, grain)
    }
    layer.globalAlpha = 1

    const level = Math.min(1, strength)
    const glow = getHeadlinerNumber(parameters, 'glow', 0.4)
    const blend = getHeadlinerString(parameters, 'blendMode', 'screen')
    if (glow > 0.01) compositeLayer(args, this.layer, level * glow, 'add', glow * 8 * (canvas.width / 1280))
    compositeLayer(args, this.layer, level, blend)
  }

  dispose(): void {
    this.analyzer.dispose()
    this.layer.dispose()
  }
}

export function createParticleShedProcessor(): HeadlinerEffectProcessor {
  return new ParticleShedProcessor()
}
