// Sound Drawing XY › INIT: draws the oscilloscope lines onto the shared canvas. Each frame fades the previous one
// by the phosphor decay, then strokes every trace with a glow in its own colour.

import { INIT_TRACE_POINTS, type InitEngine } from './XyScopeInitEngine'
import type { InitValues } from './XyScopeInitSettings'

const FALLBACK_BACKGROUND = '#02070a'

export interface InitRenderOptions {
  dt: number
  count: number
  values: InitValues
  hold: boolean
}

/** Pixel path of one scope: the straight line from A to B with the waveform carried along its normal. */
export function initTracePoints(
  engine: Pick<InitEngine, 'scopes' | 'waves'>, index: number, width: number, height: number, waveHeight: number, out: Float32Array,
): void {
  const s = engine.scopes[index], wave = engine.waves[index]
  const sx = width / 2 * .94, sy = height / 2 * .94, cx = width / 2, cy = height / 2
  const ax = cx + s.ax * sx, ay = cy - s.ay * sy, bx = cx + s.bx * sx, by = cy - s.by * sy
  const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1
  const nx = -dy / length, ny = dx / length, amp = waveHeight * height * .22
  for (let k = 0; k < INIT_TRACE_POINTS; k++) {
    const t = k / (INIT_TRACE_POINTS - 1)
    out[k * 2] = ax + dx * t + nx * wave[k] * amp
    out[k * 2 + 1] = ay + dy * t + ny * wave[k] * amp
  }
}

export class InitRenderer {
  private readonly ctx: CanvasRenderingContext2D | null
  private readonly points = new Float32Array(INIT_TRACE_POINTS * 2)
  private needsClear = true

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })
  }

  clear(): void { this.needsClear = true }

  render(engine: InitEngine, { dt, count, values, hold }: InitRenderOptions): void {
    const { ctx, canvas } = this
    if (!ctx || canvas.width <= 0 || canvas.height <= 0) return
    const W = canvas.width, H = canvas.height, scale = Math.max(.5, H / 700)
    const background = values.backgroundColor || FALLBACK_BACKGROUND
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.shadowBlur = 0
    if (this.needsClear) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = background; ctx.fillRect(0, 0, W, H); this.needsClear = false }
    if (hold) return
    // Phosphor decay: each frame fades the last by the share of a decay time that has passed.
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = Math.min(1, 1 - Math.exp(-dt * 1000 / Math.max(10, values.trail)))
    ctx.fillStyle = background
    ctx.fillRect(0, 0, W, H)
    const colors = [values.color1, values.color2, values.color3]
    const swell = 1 + engineKick(engine) * 1.2
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let i = 0; i < count; i++) {
      initTracePoints(engine, i, W, H, values.waveHeight, this.points)
      ctx.beginPath()
      ctx.moveTo(this.points[0], this.points[1])
      for (let k = 1; k < INIT_TRACE_POINTS; k++) ctx.lineTo(this.points[k * 2], this.points[k * 2 + 1])
      ctx.globalAlpha = Math.min(1, .85 * values.intensity)
      ctx.strokeStyle = colors[i]
      ctx.shadowColor = colors[i]
      ctx.shadowBlur = values.glow * 9 * scale * (1 + engine.snarePulse * 1.5)
      ctx.lineWidth = values.width * scale * swell
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

function engineKick(engine: InitEngine): number { return Math.min(1, engine.kickPulse) }
