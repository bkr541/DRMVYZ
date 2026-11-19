// Sound Drawing XY › OSC 1: the Text Lab's phosphor scope renderer. Every visible glyph is sampled at 18k
// coordinates per second with blanked retraces into an energy raster that decays exponentially, then composited
// with a soft bloom and an optional graticule. The raster is capped at 1,200 px wide, as in the lab, and scaled up
// to the output canvas.

import { Osc1Phosphor, type Osc1Signal } from './XyScopeOsc1Engine'

/** A beam stream the scanner can draw: OSC 1 letters, or OSC 2's letters and environment streams. */
export interface Osc1ScanStream { advance: number; table: Float32Array | null; scanPhase: number; lastLit: boolean; lastX: number; lastY: number; rate?: number }
export interface Osc1Scannable<L extends Osc1ScanStream = Osc1ScanStream> {
  letters: L[]
  signal(l: L, i: number, u: number, pass: number, offset: number, out: Osc1Signal): Osc1Signal
  beamSamples: number
  /** Streams return screen positions in letter heights from the stage centre, so no per-letter layout is applied. */
  absolute?: boolean
  /** Width in letter heights the stage is fitted to when `absolute`. */
  fitWidth?: number
  /** Vertical centre of the stage as a share of its height (0.52 when omitted). */
  anchorY?: number
  /** Beam samples per second (18,000 when omitted). A figure with fine detail on its lines asks for more. */
  sampleRate?: number
}

export interface Osc1BeamSettings { intensity: number; persistence: number; width: number; scan: number; color: string }

const SAMPLE_RATE = 18000
const MAX_RASTER_WIDTH = 1200
const BACKGROUND = '#020807'

export interface Osc1RenderOptions {
  dt: number
  settings: Osc1BeamSettings
  grid: boolean
  hold: boolean
  /** Share of the output height available to the scene when it has a separate reference trace. */
  stageHeight?: number
  /** A wide tinted halo around the bright lines (a phosphor bloom much larger than the default). `amount` 0 turns it off. */
  halo?: { amount: number; color: string }
  background?: string
}

export class Osc1Renderer {
  private readonly ctx: CanvasRenderingContext2D | null
  private raster: HTMLCanvasElement | null = null
  private rasterCtx: CanvasRenderingContext2D | null = null
  private phosphor = new Osc1Phosphor(2, 2)
  private imageData: ImageData | null = null
  private halo: HTMLCanvasElement | null = null
  private W = 0
  private H = 0
  private sampleCarry = 0
  private readonly out: Osc1Signal = { x: 0, y: 0, z: 0, energy: 0, q: 0 }

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })
  }

  /** Sizes the raster from the CSS size of the stage, capped like the Text Lab. Returns true when it changed. */
  resize(cssWidth: number, cssHeight: number): boolean {
    const ratio = Math.min(1, MAX_RASTER_WIDTH / Math.max(1, cssWidth))
    const nw = Math.max(200, Math.round(cssWidth * ratio)), nh = Math.max(150, Math.round(cssHeight * ratio))
    if (nw === this.W && nh === this.H) return false
    this.W = nw; this.H = nh
    this.phosphor.resize(nw, nh)
    if (typeof document !== 'undefined') {
      this.raster ??= document.createElement('canvas')
      this.raster.width = nw; this.raster.height = nh
      this.rasterCtx = this.raster.getContext('2d')
      this.imageData = typeof ImageData === 'undefined' ? null : new ImageData(nw, nh)
    }
    return true
  }

  clear(): void {
    this.phosphor.clear()
  }

  get beamSamples(): number { return this.phosphor.deposits }

  /** One frame: scan every letter into the phosphor (unless held), then composite to the output canvas. */
  render<L extends Osc1ScanStream>(engine: Osc1Scannable<L>, { dt, settings: s, grid, hold, stageHeight = 1, halo, background = BACKGROUND }: Osc1RenderOptions): void {
    const { W, H, phosphor } = this
    if (!this.ctx || !this.rasterCtx || !this.raster || !this.imageData || W === 0) return
    if (!hold) {
      const rate = engine.sampleRate ?? SAMPLE_RATE
      const step = 1 / rate
      const n = Math.min(Math.round(rate / 15), Math.floor(dt * rate + this.sampleCarry))
      this.sampleCarry = dt * rate + this.sampleCarry - n
      const count = engine.letters.length
      const fixedLayout = engine.absolute === true
      const total = fixedLayout ? (engine.fitWidth ?? 6) : engine.letters.reduce((sum, l) => sum + l.advance + .30, 0)
      const stage = H * stageHeight
      const size = Math.min(stage * .40, W * .82 / Math.max(1, total)), cy = stage * (engine.anchorY ?? .52)
      let cursor = W / 2 - total * size / 2
      const out = this.out
      for (let i = 0; i < count; i++) {
        const l = engine.letters[i], center = fixedLayout ? W / 2 : cursor + (l.advance + .30) * size / 2
        if (!fixedLayout) cursor += (l.advance + .30) * size
        if (!l.table) continue
        const hz = s.scan * (l.rate ?? 1) * (1 + ((i % 5) - 2) * .0017), inc = hz / rate
        let absolute = l.scanPhase
        for (let k = 0; k < n; k++) {
          absolute += inc
          const u = absolute % 1, cycle = Math.floor(absolute), offset = -dt + k * step
          engine.signal(l, i, u, cycle, offset, out)
          const x = center + out.x * size, y = cy + out.y * size, lit = out.z > 0
          const energy = out.energy * .65 * (18000 / rate)
          if (lit) {
            if (l.lastLit) phosphor.segment(l.lastX, l.lastY, x, y, energy, s.width)
            else phosphor.deposit(x, y, energy, s.width)
          }
          l.lastX = x; l.lastY = y; l.lastLit = lit
        }
        l.scanPhase = absolute % 10000
        engine.beamSamples += n
      }
      this.imageData.data.set(phosphor.image(dt, s.persistence, s.color, s.intensity))
      this.rasterCtx.putImageData(this.imageData, 0, 0)
    }
    const { ctx, canvas } = this
    const cw = canvas.width, ch = canvas.height, scale = cw / W
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = background
    ctx.fillRect(0, 0, cw, ch)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = .65
    if (halo && halo.amount > 0 && typeof document !== 'undefined') {
      // A tinted halo: the raster blurred wide, multiplied by the glow colour, added under the line.
      const buffer = this.halo ??= document.createElement('canvas')
      if (buffer.width !== cw || buffer.height !== ch) { buffer.width = cw; buffer.height = ch }
      const h = buffer.getContext('2d')
      if (h) {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(halo.color.slice(i, i + 2), 16) || 0), top = Math.max(1, r, g, b)
        for (const [radius, alpha] of [[10, .55], [30, .6]] as const) {
          h.globalCompositeOperation = 'source-over'
          h.filter = `blur(${(radius * halo.amount * scale).toFixed(2)}px)`
          h.fillStyle = '#000'; h.fillRect(0, 0, cw, ch)
          h.drawImage(this.raster, 0, 0, cw, ch)
          h.filter = 'none'
          h.globalCompositeOperation = 'multiply'
          h.fillStyle = `rgb(${Math.round(r / top * 255)},${Math.round(g / top * 255)},${Math.round(b / top * 255)})`
          h.fillRect(0, 0, cw, ch)
          ctx.globalAlpha = alpha * Math.min(1.4, .6 + halo.amount * .4)
          ctx.drawImage(buffer, 0, 0)
        }
        ctx.globalAlpha = .65
      }
    }
    ctx.filter = `blur(${(4 * scale).toFixed(2)}px)`
    ctx.drawImage(this.raster, 0, 0, cw, ch)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    ctx.drawImage(this.raster, 0, 0, cw, ch)
    ctx.restore()
    if (grid) {
      ctx.save()
      ctx.strokeStyle = 'rgba(64,104,84,.11)'
      ctx.lineWidth = .6 * scale
      ctx.beginPath()
      const unit = ch / 10
      for (let x = cw / 2 % unit; x < cw; x += unit) { ctx.moveTo(x, 0); ctx.lineTo(x, ch) }
      for (let y = ch / 2 % unit; y < ch; y += unit) { ctx.moveTo(0, y); ctx.lineTo(cw, y) }
      ctx.stroke()
      ctx.restore()
    }
  }
}
