// Sound Drawing XY › OSC 1: the Text Lab's phosphor scope renderer. Every visible glyph is sampled at 18k
// coordinates per second with blanked retraces into an energy raster that decays exponentially, then composited
// with a soft bloom and an optional graticule. The raster is capped at 1,200 px wide, as in the lab, and scaled up
// to the output canvas.

import { Osc1Phosphor, type Osc1Engine, type Osc1Settings, type Osc1Signal } from './XyScopeOsc1Engine'

const SAMPLE_RATE = 18000
const MAX_RASTER_WIDTH = 1200
const BACKGROUND = '#020807'

export interface Osc1RenderOptions {
  dt: number
  settings: Osc1Settings
  grid: boolean
  hold: boolean
}

export class Osc1Renderer {
  private readonly ctx: CanvasRenderingContext2D | null
  private raster: HTMLCanvasElement | null = null
  private rasterCtx: CanvasRenderingContext2D | null = null
  private phosphor = new Osc1Phosphor(2, 2)
  private imageData: ImageData | null = null
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
  render(engine: Osc1Engine, { dt, settings: s, grid, hold }: Osc1RenderOptions): void {
    const { W, H, phosphor } = this
    if (!this.ctx || !this.rasterCtx || !this.raster || !this.imageData || W === 0) return
    if (!hold) {
      const step = 1 / SAMPLE_RATE
      const n = Math.min(1200, Math.floor(dt * SAMPLE_RATE + this.sampleCarry))
      this.sampleCarry = dt * SAMPLE_RATE + this.sampleCarry - n
      const count = engine.letters.length
      const total = engine.letters.reduce((sum, l) => sum + l.advance + .30, 0)
      const size = Math.min(H * .40, W * .82 / Math.max(1, total)), cy = H * .52
      let cursor = W / 2 - total * size / 2
      const out = this.out
      for (let i = 0; i < count; i++) {
        const l = engine.letters[i], center = cursor + (l.advance + .30) * size / 2
        cursor += (l.advance + .30) * size
        if (!l.table) continue
        const hz = s.scan * (1 + ((i % 5) - 2) * .0017), inc = hz / SAMPLE_RATE
        let absolute = l.scanPhase
        for (let k = 0; k < n; k++) {
          absolute += inc
          const u = absolute % 1, cycle = Math.floor(absolute), offset = -dt + k * step
          engine.signal(l, i, u, cycle, offset, out)
          const x = center + out.x * size, y = cy + out.y * size, lit = out.z > 0
          const energy = out.energy * .65 * (18000 / SAMPLE_RATE)
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
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, cw, ch)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = .65
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
