import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { buildXyScopeLayout, EMPTY_XY_SCOPE_LAYOUT, type XyScopeFontSource } from './XyScopeGeometry'
import type { XyScopePhasePortalSettings } from './XyScopePhasePortalSettings'

type TraceSource = 'stereo' | 'mono' | 'unavailable'
const WINDOW_SECONDS = .02
const LAYOUT_EDGE = 512
const BACKGROUND = '#040c10'
const SCREEN = '#08151a'

/** Both axes use one scale. Text is an independent phosphor outline in the same graticule. */
export class PhasePortalScope {
  source: TraceSource = 'unavailable'
  length = 0
  private left = new Float32Array(0)
  private right = new Float32Array(0)
  private layout = EMPTY_XY_SCOPE_LAYOUT
  private textKey = ''
  private textCenterX = 0
  private textCenterY = 0
  private textExtent = 1
  textPulse = 0

  reset(): void {
    this.update(null)
    this.textPulse = 0
  }

  update(frame: StereoScopeFrame | null): void {
    this.source = 'unavailable'
    this.length = 0
    if (!frame || !(frame.sampleRate > 0) || !Number.isFinite(frame.sampleRate)) return
    if (frame.channelCount === 1) {
      if (frame.left.length > 1) this.source = 'mono'
      return
    }
    if (frame.channelCount < 2) return
    const available = Math.min(frame.left.length, frame.right.length)
    const length = Math.min(available, Math.round(frame.sampleRate * WINDOW_SECONDS))
    if (length < 2) return
    if (this.left.length < length) {
      this.left = new Float32Array(length)
      this.right = new Float32Array(length)
    }
    this.left.set(frame.left.subarray(available - length, available))
    this.right.set(frame.right.subarray(available - length, available))
    this.source = 'stereo'
    this.length = length
  }

  setText(text: string, font: XyScopeFontSource, size: number): void {
    const key = JSON.stringify([font.id, text, size])
    if (this.textKey === key) return
    this.textKey = key
    this.layout = buildXyScopeLayout({
      text, font, size, width: LAYOUT_EDGE, height: LAYOUT_EDGE * .64,
      letterSpacing: .07, minPieceSize: 0, pointBudget: 1200,
    })
    if (!this.layout.totalPoints) return
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
    for (const glyph of this.layout.glyphs) {
      for (let i = 0; i < glyph.count; i++) {
        const x = glyph.centerX + glyph.x[i], y = glyph.y[i]
        left = Math.min(left, x)
        right = Math.max(right, x)
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    }
    this.textCenterX = (left + right) * .5
    this.textCenterY = (top + bottom) * .5
    // The visible outline can exceed its advance or cap height in an uploaded font.
    this.textExtent = Math.max(1, (right - left) / (LAYOUT_EDGE * size), (bottom - top) / (LAYOUT_EDGE * .36))
  }

  react(dt: number, accent: number): void {
    this.textPulse = Math.max(accent, this.textPulse * Math.exp(-dt / .18))
  }

  draw(ctx: CanvasRenderingContext2D, settings: XyScopePhasePortalSettings, dpr: number): void {
    const { width, height } = ctx.canvas
    const edge = Math.min(width * .92, height * .85)
    const x = (width - edge) * .5, y = (height - edge) * .5
    const cx = width * .5, cy = height * .5
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = SCREEN
    ctx.fillRect(x, y, edge, edge)
    ctx.lineWidth = dpr
    if (settings.grid) {
      ctx.strokeStyle = '#14303a'
      ctx.beginPath()
      for (let i = 1; i < 8; i++) {
        if (i === 4) continue
        const offset = edge * i / 8
        ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + edge)
        ctx.moveTo(x, y + offset); ctx.lineTo(x + edge, y + offset)
      }
      ctx.stroke()
      ctx.strokeStyle = '#25505e'
      ctx.beginPath()
      ctx.moveTo(cx, y); ctx.lineTo(cx, y + edge)
      ctx.moveTo(x, cy); ctx.lineTo(x + edge, cy)
      ctx.stroke()
    }
    ctx.strokeStyle = '#29505b'
    ctx.strokeRect(x, y, edge, edge)
    ctx.beginPath()
    ctx.rect(x, y, edge, edge)
    ctx.clip()
    this.drawTrace(ctx, cx, cy, edge * .5 * settings.values.gain, settings.values, dpr)
    this.drawText(ctx, cx, cy, edge / (LAYOUT_EDGE * this.textExtent), settings.values.color, dpr)
    ctx.restore()
  }

  private drawTrace(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, values: XyScopePhasePortalSettings['values'], dpr: number): void {
    if (this.source !== 'stereo') return
    ctx.beginPath()
    let continuing = false
    for (let i = 0; i < this.length; i++) {
      const left = this.left[i], right = this.right[i]
      if (!Number.isFinite(left) || !Number.isFinite(right)) { continuing = false; continue }
      const x = cx + left * scale, y = cy - right * scale
      if (continuing) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      continuing = true
    }
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.strokeStyle = values.color
    ctx.globalAlpha = values.intensity * .0018
    ctx.lineWidth = dpr * 3.5
    ctx.stroke()
    ctx.globalAlpha = values.intensity / 100
    ctx.lineWidth = dpr * 1.35
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private drawText(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, color: string, dpr: number): void {
    if (!this.layout.totalPoints) return
    ctx.beginPath()
    for (const glyph of this.layout.glyphs) {
      for (let c = 0; c < glyph.starts.length - 1; c++) {
        const start = glyph.starts[c], end = glyph.starts[c + 1]
        const left = cx + (glyph.centerX - this.textCenterX) * scale
        const top = cy - this.textCenterY * scale
        ctx.moveTo(left + glyph.x[start] * scale, top + glyph.y[start] * scale)
        for (let i = start + 1; i < end; i++) ctx.lineTo(left + glyph.x[i] * scale, top + glyph.y[i] * scale)
        ctx.closePath()
      }
    }
    ctx.lineJoin = 'round'
    // A narrow dark keyline preserves the letter edges even where the trace crosses them.
    ctx.strokeStyle = SCREEN
    ctx.lineWidth = dpr * 4.2
    ctx.stroke()
    ctx.strokeStyle = color
    ctx.globalAlpha = .32 + this.textPulse * .26
    ctx.lineWidth = dpr * 3
    ctx.stroke()
    ctx.strokeStyle = '#e1fff9'
    ctx.globalAlpha = .9 + this.textPulse * .1
    ctx.lineWidth = dpr * 1.45
    ctx.stroke()
  }
}
