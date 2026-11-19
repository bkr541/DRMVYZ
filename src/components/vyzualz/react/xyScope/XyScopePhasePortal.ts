import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import type { Osc1Signal } from './XyScopeOsc1Engine'
import type { PhasePortalTraceMode } from './XyScopeOsc2Settings'
import { projectPoint, quatFromAxisAngle, quatMul, quatRotate, rotateProject4 } from './XyScopeWireProject'
import { routeEdges } from './XyScopeWireRoute'
import { buildCluster } from './XyScopeWireShape'

const cage = buildCluster(['tesseract'])
const route = routeEdges(cage.vertexW.length, cage.edges)
const view = quatMul(quatFromAxisAngle(1, 0, 0, -.24), quatFromAxisAngle(0, 1, 0, .42))
const camera = { perspective: .64, distance: 5, near: 1 }
const TURN_BEATS = 4
const RESOLVE_BEATS = 4
const CUE_BEATS = TURN_BEATS + RESOLVE_BEATS
export const PHASE_PORTAL_SCENE_HEIGHT = .73
export const PHASE_PORTAL_WINDOW_MS = 10
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

export class PhasePortal {
  private readonly projected = new Float32Array(cage.vertexW.length * 2)
  private readonly point = new Float32Array(3)
  private cueBeats = CUE_BEATS
  private opening = 0

  reset(): void {
    this.cueBeats = CUE_BEATS
    this.opening = 0
  }

  tick(beats: number, bass: number, build: number, drop: boolean, kick: boolean, fitWidth: number): void {
    this.cueBeats = Math.min(CUE_BEATS, this.cueBeats + beats)
    // Complete the turn and resolve before accepting another cue.
    if ((drop || kick) && this.cueBeats === CUE_BEATS) this.cueBeats = 0
    const eased = smoothstep(clamp01(this.cueBeats / TURN_BEATS))
    const resolve = smoothstep(clamp01((this.cueBeats - TURN_BEATS) / RESOLVE_BEATS))
    const turn = eased * Math.PI * 2
    const arc = Math.sin(eased * Math.PI)
    const accent = Math.sin(eased * Math.PI / 2) * (1 - resolve)
    const target = clamp01(bass * .55 + build * .65)
    this.opening += (target - this.opening) * (1 - Math.exp(-beats * 2))

    let extentX = 0, extentY = 0
    const p = this.point
    for (let i = 0; i < cage.vertexW.length; i++) {
      const v = i * 3
      rotateProject4(cage.vertices[v], cage.vertices[v + 1], cage.vertices[v + 2], cage.vertexW[i],
        .16 + turn, .18 + arc * .64, -.1 + arc * .33, p)
      quatRotate(view, p[0], p[1], p[2], p)
      projectPoint(p[0], p[1], p[2], camera, this.projected, i * 2)
      extentX = Math.max(extentX, Math.abs(this.projected[i * 2]))
      extentY = Math.max(extentY, Math.abs(this.projected[i * 2 + 1]))
    }
    // Fit the backdrop to the stage. Scale uniformly so the projected hypercube keeps its proportions.
    const reveal = .71 + this.opening * .17 + accent * .12
    const scale = Math.min(fitWidth * .32 / extentX, 1 / extentY) * reveal
    for (let i = 0; i < this.projected.length; i += 2) {
      this.projected[i] = this.projected[i] * scale + fitWidth * .16
      this.projected[i + 1] = -this.projected[i + 1] * scale - .47
    }
  }

  signal(phase: number, out: Osc1Signal): void {
    const position = phase * route.length
    const edge = Math.floor(position)
    const a = route.from[edge] * 2, b = route.to[edge] * 2
    const t = position - edge
    out.x = this.projected[a] + (this.projected[b] - this.projected[a]) * t
    out.y = this.projected[a + 1] + (this.projected[b + 1] - this.projected[a + 1]) * t
    out.z = 1
    out.energy = 1.63 + this.opening * .37
    out.q = 1
  }
}

type TraceSource = 'stereo' | 'mono' | 'unavailable'
const amplitude = (sample: number) => Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0

/** The reference trace uses captured PCM at a fixed scale, independently of the scene's camera and phosphor history. */
export class PhasePortalScope {
  source: TraceSource = 'unavailable'
  length = 0
  left = new Float32Array(0)
  right = new Float32Array(0)

  reset(): void {
    this.source = 'unavailable'
    this.length = 0
  }

  update(frame: StereoScopeFrame | null): void {
    this.reset()
    if (!frame || !Number.isFinite(frame.sampleRate) || frame.sampleRate <= 0) return
    const stereo = frame.channelCount > 1
    const available = stereo ? Math.min(frame.left.length, frame.right.length) : frame.left.length
    const length = Math.round(frame.sampleRate * PHASE_PORTAL_WINDOW_MS / 1000) + 1
    if (length < 2 || available < length) return

    // Find the most recent rising crossing with room for a full window. A constant signal is free-running.
    let start = available - length
    for (let i = start; i > 0; i--) {
      if (frame.left[i - 1] <= 0 && frame.left[i] > 0) { start = i; break }
    }
    if (this.left.length < length) {
      this.left = new Float32Array(length)
      this.right = new Float32Array(length)
    }
    this.left.set(frame.left.subarray(start, start + length))
    if (stereo) this.right.set(frame.right.subarray(start, start + length))
    this.source = stereo ? 'stereo' : 'mono'
    this.length = length
  }

  draw(ctx: CanvasRenderingContext2D, mode: PhasePortalTraceMode, color: string, dpr: number): void {
    const { width, height } = ctx.canvas
    const top = height * PHASE_PORTAL_SCENE_HEIGHT
    const inset = width * .09
    const strip = height - top
    const middle = top + strip * .46
    ctx.save()
    ctx.fillStyle = '#020807'
    ctx.fillRect(0, top, width, strip)
    ctx.strokeStyle = color
    ctx.lineWidth = dpr
    ctx.globalAlpha = .22
    ctx.beginPath()
    ctx.moveTo(inset, top)
    ctx.lineTo(width - inset, top)
    ctx.stroke()
    if (mode === 'xy') {
      const gain = Math.min(strip * .31, width * .37)
      ctx.beginPath()
      ctx.moveTo(width / 2 - gain, middle)
      ctx.lineTo(width / 2 + gain, middle)
      ctx.moveTo(width / 2, middle - gain)
      ctx.lineTo(width / 2, middle + gain)
      ctx.stroke()
      if (this.source === 'stereo') this.trace(ctx, i => width / 2 + amplitude(this.left[i]) * gain, i => middle - amplitude(this.right[i]) * gain, 1)
    } else {
      const stereo = this.source === 'stereo'
      const span = width - inset * 2
      const x = (i: number) => inset + i / (this.length - 1) * span
      const leftY = stereo ? top + strip * .26 : middle
      const rightY = top + strip * .64
      const gain = strip * .15
      ctx.beginPath()
      for (const y of stereo ? [leftY, rightY] : [leftY]) {
        ctx.moveTo(inset, y)
        ctx.lineTo(width - inset, y)
      }
      ctx.stroke()
      if (this.length > 0) this.trace(ctx, x, i => leftY - amplitude(this.left[i]) * gain, 1)
      if (stereo) this.trace(ctx, x, i => rightY - amplitude(this.right[i]) * gain, .72)
    }
    ctx.restore()
  }

  private trace(ctx: CanvasRenderingContext2D, x: (index: number) => number, y: (index: number) => number, alpha: number): void {
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(x(0), y(0))
    for (let i = 1; i < this.length; i++) ctx.lineTo(x(i), y(i))
    ctx.stroke()
  }
}
