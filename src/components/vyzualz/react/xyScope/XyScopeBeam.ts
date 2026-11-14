// Sound Drawing XY: the phosphor beam. Draws point buffers as one thin line with a halo and a fading trail.
// Brightness falls with beam speed — a slow edge is bright, a long jump (a dissolving point) is dim — exactly as
// on a real scope, so the readable word is always the brightest thing on screen. Canvas2D only; the shared
// GPU phosphor pipeline can replace the stroke passes later without touching the motion model.

import type { XyScopeGlyphGeometry } from './XyScopeGeometry'
import type { XyScopePointBuffers } from './XyScopeMotion'

export const XY_SCOPE_BRIGHTNESS_BUCKETS = 6

export type XyScopeRgb = readonly [number, number, number]

export function parseXyScopeColor(hex: string, fallback: XyScopeRgb): XyScopeRgb {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : fallback
}

/** A segment shorter than this is dimmed in proportion, so a tightly packed figure is as bright per length as a letter. */
export const XY_SCOPE_REFERENCE_SEGMENT_PX = 2.4

/**
 * Brightness 0..1 of one beam segment. `jumpScale` is the length (px) at which a segment is half as bright.
 * A flash brightens a letter just after a hit; dissolved points are dimmed so clouds stay thin. Segments shorter
 * than the reference length are dimmed so the same amount of light falls on each length of line.
 */
export function xyScopeSegmentBrightness(lengthPx: number, jumpScale: number, flash: number, dissolveA: number, dissolveB: number): number {
  let value = 1 / (1 + Math.pow(lengthPx / Math.max(1e-3, jumpScale), 1.3))
  value *= Math.min(1, lengthPx / XY_SCOPE_REFERENCE_SEGMENT_PX)
  value *= 1 + 0.45 * flash
  value *= 1 - 0.78 * Math.max(dissolveA, dissolveB)
  return Math.min(1, Math.max(0, value))
}

export interface XyScopeBeamStyle {
  beamColor: XyScopeRgb
  glowColor: XyScopeRgb
  backgroundColor: XyScopeRgb
  /** Master Intensity 0..2. */
  intensity: number
  /** Glow 0..2. */
  glow: number
  trailMs: number
}

export class XyScopeBeamRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private width = 0
  private height = 0
  private dpr = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('[XyScopeBeamRenderer] a 2D canvas context is required')
    this.ctx = ctx
  }

  /** Sizes the backing store. Returns true when it changed, so callers can re-layout. */
  resize(cssWidth: number, cssHeight: number, dpr: number): boolean {
    const nextDpr = Math.min(2, Math.max(1, dpr))
    const w = Math.max(2, Math.round(cssWidth * nextDpr))
    const h = Math.max(2, Math.round(cssHeight * nextDpr))
    const changed = this.canvas.width !== w || this.canvas.height !== h || this.dpr !== nextDpr
    this.width = cssWidth
    this.height = cssHeight
    this.dpr = nextDpr
    if (changed) { this.canvas.width = w; this.canvas.height = h }
    return changed
  }

  get cssSize(): { width: number; height: number } { return { width: this.width, height: this.height } }

  /** Fills the whole screen with the background, dropping all trail. */
  clear(background: XyScopeRgb): void {
    const { ctx, canvas } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgb(${background[0]},${background[1]},${background[2]})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  /**
   * One frame: fade the previous frame toward the background by the trail time, then add every letter's beam.
   * `flashes[i]` is letter i's current flash.
   */
  draw(
    glyphs: readonly XyScopeGlyphGeometry[],
    buffers: readonly XyScopePointBuffers[],
    flashes: readonly number[],
    dtSec: number,
    style: XyScopeBeamStyle,
  ): void {
    const { ctx, canvas, dpr } = this
    const bg = style.backgroundColor
    const fade = 1 - Math.exp(-Math.max(1 / 240, Math.min(0.06, dtSec)) / (Math.max(10, style.trailMs) / 1000))
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = `rgba(${bg[0]},${bg[1]},${bg[2]},${fade.toFixed(4)})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // A canvas stores 8 bits per channel, so a slow proportional fade rounds to "no change" once a pixel is within
    // a few levels of the background, and the faint ghost of every earlier figure stays on screen for good (a grey
    // box where a waveform once swept). Taking one level off each frame, never below the background, lets every
    // trail reach the background exactly.
    ctx.globalCompositeOperation = 'color-burn'
    ctx.fillStyle = 'rgb(254,254,254)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'lighten'
    ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'source-over'
    if (style.intensity <= 0 || glyphs.length === 0) return

    // Origin at the centre of the screen; sizes are CSS px.
    ctx.setTransform(dpr, 0, 0, dpr, canvas.width / 2, canvas.height / 2)
    const jumpScale = 0.014 * this.width
    const paths = Array.from({ length: XY_SCOPE_BRIGHTNESS_BUCKETS }, () => new Path2D())
    for (let g = 0; g < glyphs.length; g += 1) {
      const glyph = glyphs[g]
      const buffer = buffers[g]
      if (!buffer) continue
      const flash = flashes[g] ?? 0
      for (let c = 0; c < glyph.starts.length - 1; c += 1) {
        const from = glyph.starts[c]
        const to = glyph.starts[c + 1]
        for (let i = from; i < to; i += 1) {
          const dashSpan = Math.max(1, Math.ceil((to - from) / 64))
          if (glyph.drawMode === 'segments' && Math.floor((i - from) / dashSpan) % 2 === 1) continue
          const pointMode = glyph.drawMode === 'points'
          if (pointMode && (i - from) % Math.max(1, Math.ceil((to - from) / 96)) !== 0) continue
          if (!pointMode && i === to - 1 && glyph.closed?.[c] === false) continue
          const j = pointMode ? i : i + 1 < to ? i + 1 : from
          const length = pointMode ? XY_SCOPE_REFERENCE_SEGMENT_PX : Math.hypot(buffer.x[j] - buffer.x[i], buffer.y[j] - buffer.y[i])
          let brightness = xyScopeSegmentBrightness(length, jumpScale, flash, buffer.dissolved[i], buffer.dissolved[j])
          // The segment that closes a letter's contour has no place in an oscillator figure: it fades as the points leave.
          if (j === from && i !== from) brightness *= 1 - 0.97 * Math.min(1, 0.5 * (buffer.form[i] + buffer.form[j]))
          // The beam lifts between separate strokes of a form (the arms of a pinwheel).
          brightness *= 1 - Math.min(1, buffer.gap[i] * 1.2)
          // A hidden segment (a closed-loop seam inside a figure, a repeated point) is not drawn at all.
          if (brightness < 0.02) continue
          const bucket = Math.min(XY_SCOPE_BRIGHTNESS_BUCKETS - 1, Math.floor(brightness * XY_SCOPE_BRIGHTNESS_BUCKETS))
          paths[bucket].moveTo(buffer.x[i], buffer.y[i])
          paths[bucket].lineTo(buffer.x[j] + (pointMode ? .7 : 0), buffer.y[j])
        }
      }
    }

    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const [gr, gg, gb] = style.glowColor
    const [cr, cg, cb] = style.beamColor
    const glow = style.glow
    const gain = style.intensity
    for (let b = 0; b < XY_SCOPE_BRIGHTNESS_BUCKETS; b += 1) {
      const level = (b + 0.7) / XY_SCOPE_BRIGHTNESS_BUCKETS
      ctx.lineWidth = 6
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${Math.min(1, level * 0.045 * glow * gain).toFixed(3)})`
      ctx.stroke(paths[b])
      ctx.lineWidth = 2.4
      ctx.strokeStyle = `rgba(${gr},${gg},${gb},${Math.min(1, level * 0.17 * Math.min(1.6, glow) * gain).toFixed(3)})`
      ctx.stroke(paths[b])
      ctx.lineWidth = 1.05
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${Math.min(1, level * 0.9 * gain).toFixed(3)})`
      ctx.stroke(paths[b])
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
