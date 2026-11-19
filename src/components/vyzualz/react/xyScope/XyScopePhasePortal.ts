import type { StereoScopeFrame } from '../../../../audio/scope/scopeTypes'
import { buildXyScopeLayout, type XyScopeFontSource, type XyScopeLayout } from './XyScopeGeometry'
import { PHASE_PORTAL_WINDOW_SECONDS, type XyScopePhasePortalSettings } from './XyScopePhasePortalSettings'

type TraceSource = 'stereo' | 'mono' | 'unavailable'
const LAYOUT_EDGE = 512
const BEAM_SAMPLES = 256
const CYCLE_SECONDS = 3.2
const BACKGROUND = '#040c10'
const TRACE_HEIGHT = .56
const TEXT_BANK_CENTER = .38
const TEXT_BANK_HEIGHT = .18

interface PortalContour {
  x: Float32Array
  y: Float32Array
  screenX: Float32Array
  screenY: Float32Array
  arc: Float32Array
  rowOffset: number
  sampleStart: number
}

function contourArc(x: Float32Array, y: Float32Array): Float32Array {
  const arc = new Float32Array(x.length + 1)
  for (let i = 1; i <= x.length; i++) {
    const next = i % x.length
    arc[i] = arc[i - 1] + Math.hypot(x[next] - x[i - 1], y[next] - y[i - 1])
  }
  const perimeter = arc[x.length]
  for (let i = 1; i <= x.length; i++) arc[i] /= perimeter
  return arc
}

function layoutLine(layout: XyScopeLayout, width: number, height: number, rowOffset: number, startPoint: number): PortalContour[] {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
  for (const glyph of layout.glyphs) {
    for (let i = 0; i < glyph.count; i++) {
      const x = glyph.centerX + glyph.x[i], y = glyph.y[i]
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
  const spanX = Math.max(1, right - left), spanY = Math.max(1, bottom - top)
  const centerX = (left + right) * .5, centerY = (top + bottom) * .5
  const scale = Math.min(width / spanX, height / spanY, 1 / LAYOUT_EDGE)
  const contours: PortalContour[] = []
  let sampleStart = startPoint
  for (const glyph of layout.glyphs) {
    for (let c = 0; c < glyph.starts.length - 1; c++) {
      const start = glyph.starts[c], end = glyph.starts[c + 1], count = end - start
      const x = new Float32Array(count), y = new Float32Array(count)
      for (let i = start; i < end; i++) {
        x[i - start] = (glyph.centerX + glyph.x[i] - centerX) * scale
        y[i - start] = (glyph.y[i] - centerY) * scale
      }
      contours.push({ x, y, screenX: new Float32Array(count), screenY: new Float32Array(count), arc: contourArc(x, y), rowOffset, sampleStart })
      sampleStart += count
    }
  }
  return contours
}

function beamSample(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0
}

function stereoDeflection(samples: Float32Array, index: number, gain: number): number {
  const first = Math.floor(index)
  const next = Math.min(first + 1, samples.length - 1)
  const value = (samples[first] + (samples[next] - samples[first]) * (index - first)) * gain
  return value / (1 + Math.abs(value))
}

/** Draws the original stereo trace and a continuous XY lettering scan on the same stage. */
export class PhasePortalScope {
  source: TraceSource = 'unavailable'
  length = 0
  private left = new Float32Array(0)
  private right = new Float32Array(0)
  private readonly beamX = new Float32Array(BEAM_SAMPLES)
  private readonly beamY = new Float32Array(BEAM_SAMPLES)
  private contours: PortalContour[] = []
  private textKey = ''
  private phase = 0
  private beamReady = false
  text = ''
  letters = 0
  points = 0
  textPulse = 0

  reset(): void {
    this.update(null)
    this.phase = 0
    this.beamReady = false
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
    const length = Math.min(available, Math.round(frame.sampleRate * PHASE_PORTAL_WINDOW_SECONDS))
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

  setTexts(texts: readonly string[], font: XyScopeFontSource, size: number): void {
    const key = JSON.stringify([font.id, texts, size])
    if (this.textKey === key) return
    this.textKey = key
    const entries = texts.map(text => text.trim().toUpperCase()).filter(Boolean).map(text => ({
      text, layout: buildXyScopeLayout({ text, font, size, width: LAYOUT_EDGE, height: LAYOUT_EDGE * .82,
        letterSpacing: .07, minPieceSize: 0, pointBudget: 960 }),
    })).filter(({ layout }) => layout.totalPoints > 0)
    const topRows = Math.ceil(entries.length / 2)
    const height = TEXT_BANK_HEIGHT / Math.max(1, topRows)
    let startPoint = 0
    this.contours = entries.flatMap(({ layout }, i) => {
      const above = i < topRows
      const rows = above ? topRows : entries.length - topRows
      const row = above ? i : i - topRows
      const offset = (above ? -TEXT_BANK_CENTER : TEXT_BANK_CENTER) + ((row + .5) / rows - .5) * TEXT_BANK_HEIGHT
      const line = layoutLine(layout, size, height, offset, startPoint)
      startPoint += layout.totalPoints
      return line
    })
    this.text = entries.map(({ text }) => text).join('\n')
    this.letters = entries.reduce((count, { layout }) => count + layout.glyphs.length, 0)
    this.points = startPoint
  }

  advance(dt: number, speed: number, accent: number): void {
    this.phase = (this.phase + dt * speed / CYCLE_SECONDS) % 1
    this.textPulse = Math.max(accent, this.textPulse * Math.exp(-dt / .18))

    if (this.source !== 'stereo') {
      this.beamReady = false
      return
    }

    const sampleMix = this.beamReady ? 1 - Math.exp(-dt * 32) : 1
    for (let i = 0; i < BEAM_SAMPLES; i++) {
      const index = Math.round(i * (this.length - 1) / (BEAM_SAMPLES - 1))
      const left = beamSample(this.left[index]), right = beamSample(this.right[index])
      this.beamX[i] += (left - this.beamX[i]) * sampleMix
      this.beamY[i] += (right - this.beamY[i]) * sampleMix
    }
    this.beamReady = true
  }

  draw(ctx: CanvasRenderingContext2D, settings: XyScopePhasePortalSettings, dpr: number, playing = false): void {
    const { width, height } = ctx.canvas
    if (Math.min(width, height) <= 0) return
    const edge = Math.min(width * .92, height * .85)
    const lettering = this.points > 0 && !(settings.hold && this.source === 'stereo')
    const traceEdge = lettering ? Math.min(edge, height * TRACE_HEIGHT) : edge
    const cx = width * .5, cy = height * .5, moving = playing && !settings.hold
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = BACKGROUND
    ctx.fillRect(0, 0, width, height)
    if (settings.grid) this.drawGraticule(ctx, cx, cy, traceEdge, dpr)

    if (this.source === 'stereo') {
      ctx.save()
      if (lettering) {
        // Blank the trace at the scan limits before it reaches the lettering.
        const band = height * TRACE_HEIGHT
        ctx.beginPath()
        ctx.rect(0, cy - band / 2, width, band)
        ctx.clip()
      }
      this.drawTrace(ctx, cx, cy, traceEdge, settings.values, dpr)
      ctx.restore()
    }
    if (lettering) this.drawBeam(ctx, cx, cy, edge, settings.values, dpr, moving)
    ctx.restore()
  }

  private drawGraticule(ctx: CanvasRenderingContext2D, cx: number, cy: number, edge: number, dpr: number): void {
    const x = cx - edge * .5, y = cy - edge * .5
    ctx.lineWidth = dpr
    ctx.strokeStyle = '#142b35'
    ctx.beginPath()
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue
      const offset = edge * i / 8
      ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + edge)
      ctx.moveTo(x, y + offset); ctx.lineTo(x + edge, y + offset)
    }
    ctx.stroke()
    ctx.strokeStyle = '#244551'
    ctx.beginPath()
    ctx.moveTo(cx, y); ctx.lineTo(cx, y + edge)
    ctx.moveTo(x, cy); ctx.lineTo(x + edge, cy)
    ctx.stroke()
  }

  private drawBeam(ctx: CanvasRenderingContext2D, cx: number, cy: number, edge: number, values: XyScopePhasePortalSettings['values'], dpr: number, moving: boolean): void {
    const phase = moving ? this.phase : 0
    const strength = moving && this.source === 'stereo' && this.beamReady ? .0075 * values.traceCoupling : 0
    for (const contour of this.contours) {
      const rowY = cy + ctx.canvas.height * contour.rowOffset
      for (let i = 0; i < contour.x.length; i++) {
        const x = contour.x[i], y = contour.y[i]
        const index = (.5 + x) * (BEAM_SAMPLES - 1)
        // Glyph scan coordinates are the carrier. A synchronized L/R pair deflects
        // that position on X/Y, bounded so the beam preserves the letter's shape.
        const dx = strength * stereoDeflection(this.beamX, index, values.gain)
        const dy = strength * stereoDeflection(this.beamY, index, values.gain)
        contour.screenX[i] = cx + (x + dx) * edge
        contour.screenY[i] = rowY + (y - dy) * edge
      }
    }

    // The dim return and bright moving head are passes over the same scan coordinates.
    const intensity = values.intensity / 100
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.strokeStyle = values.color
    ctx.beginPath()
    for (const { screenX, screenY } of this.contours) {
      ctx.moveTo(screenX[0], screenY[0])
      for (let i = 1; i < screenX.length; i++) ctx.lineTo(screenX[i], screenY[i])
      ctx.closePath()
    }
    ctx.globalAlpha = intensity * (.20 + this.textPulse * .12)
    ctx.lineWidth = dpr * 5
    ctx.stroke()
    ctx.globalAlpha = intensity * .82
    ctx.lineWidth = dpr * 1.45
    ctx.stroke()

    ctx.beginPath()
    for (const contour of this.contours) {
      const head = (phase * 3 + contour.sampleStart / this.points) % 1
      const tail = head - .32
      if (tail < 0) this.appendArc(ctx, contour, 1 + tail, 1)
      this.appendArc(ctx, contour, Math.max(0, tail), head)
    }
    ctx.strokeStyle = '#d9f6ff'
    ctx.globalAlpha = intensity * (.84 + this.textPulse * .16)
    ctx.lineWidth = dpr * (1.65 + this.textPulse * .4)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private appendArc(ctx: CanvasRenderingContext2D, { screenX, screenY, arc }: PortalContour, start: number, end: number): void {
    if (start >= end) return
    let i = 1
    while (arc[i] <= start) i++
    const count = screenX.length
    const startMix = (start - arc[i - 1]) / (arc[i] - arc[i - 1])
    ctx.moveTo(
      screenX[i - 1] + (screenX[i % count] - screenX[i - 1]) * startMix,
      screenY[i - 1] + (screenY[i % count] - screenY[i - 1]) * startMix,
    )
    while (arc[i] < end) {
      ctx.lineTo(screenX[i], screenY[i])
      i++
    }
    const endMix = (end - arc[i - 1]) / (arc[i] - arc[i - 1])
    ctx.lineTo(
      screenX[i - 1] + (screenX[i % count] - screenX[i - 1]) * endMix,
      screenY[i - 1] + (screenY[i % count] - screenY[i - 1]) * endMix,
    )
  }

  private drawTrace(ctx: CanvasRenderingContext2D, cx: number, cy: number, edge: number, values: XyScopePhasePortalSettings['values'], dpr: number): void {
    const scale = edge * .5 * values.gain
    ctx.beginPath()
    let continuing = false
    for (let i = 0; i < this.length; i++) {
      const left = this.left[i], right = this.right[i]
      if (!Number.isFinite(left) || !Number.isFinite(right)) { continuing = false; continue }
      if (continuing) ctx.lineTo(cx + left * scale, cy - right * scale)
      else ctx.moveTo(cx + left * scale, cy - right * scale)
      continuing = true
    }
    ctx.lineJoin = ctx.lineCap = 'round'
    ctx.strokeStyle = values.color
    ctx.globalAlpha = values.intensity / 100
    ctx.lineWidth = dpr * 1.35
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
