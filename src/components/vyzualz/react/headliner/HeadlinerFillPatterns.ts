// Generated pictures that fill the performer's silhouette in Digital Silhouette (gradient, plasma, stripes, bars) or
// show through it as another world in Portal Body (tunnel, starfield, grid, plasma). They are drawn procedurally into
// a work surface, move with time and react to the music's energy and kicks, and take their colours from the glow palette.

import { WorkSurface, clamp01, lerp, mixRgb, rgba } from './HeadlinerEffectKit'
import { glowNoise } from './HeadlinerSilhouetteEffects'
import { hslToRgb, resolveGlowColor, type HeadlinerGlowPalette } from './HeadlinerSilhouetteShapes'

export type HeadlinerFillKind = 'gradient' | 'plasma' | 'stripes' | 'bars' | 'tunnel' | 'starfield' | 'grid'

export interface HeadlinerFillContext {
  timeSec: number
  beat: number
  energy: number
  kick: number
  /** Speed multiplier (the Pattern Speed setting). */
  speed: number
  /** Size multiplier (the Pattern Scale setting). */
  scale: number
}

const PLASMA_WIDTH = 96
const PLASMA_HEIGHT = 54

/** A three-stop colour ramp for a palette: solid is shade → colour → light, gradient is dark → start → end, spectrum cycles hue. */
export function fillRampColor(palette: HeadlinerGlowPalette, t: number, timeSec: number): [number, number, number] {
  const v = clamp01(t)
  if (palette.mode === 'spectrum') return hslToRgb(v * 300 + timeSec * 40, 0.85, 0.35 + v * 0.3)
  if (palette.mode === 'gradient') return v < 0.5 ? mixRgb([0, 0, 0], palette.primary, v * 2) : mixRgb(palette.primary, palette.secondary, (v - 0.5) * 2)
  return v < 0.6 ? mixRgb(mixRgb(palette.primary, [0, 0, 0], 0.8), palette.primary, v / 0.6) : mixRgb(palette.primary, [255, 255, 255], (v - 0.6) / 0.4 * 0.6)
}

export class FillPatternPainter {
  private readonly plasma = new WorkSurface()

  /** Clears `surface` and draws the pattern over all of it. */
  draw(surface: WorkSurface, kind: HeadlinerFillKind, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
    const context = surface.context
    const canvas = surface.canvas
    if (!context || !canvas) return
    surface.clear()
    context.save()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    switch (kind) {
      case 'plasma': this.drawPlasma(surface, context, fill, palette); break
      case 'stripes': drawStripes(context, canvas, fill, palette); break
      case 'bars': drawBars(context, canvas, fill, palette); break
      case 'tunnel': drawTunnel(context, canvas, fill, palette); break
      case 'starfield': drawStarfield(context, canvas, fill, palette); break
      case 'grid': drawGrid(context, canvas, fill, palette); break
      default: drawGradient(context, canvas, fill, palette)
    }
    context.restore()
  }

  private drawPlasma(surface: WorkSurface, context: CanvasRenderingContext2D, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
    const canvas = surface.canvas as HTMLCanvasElement
    this.plasma.resize(PLASMA_WIDTH, PLASMA_HEIGHT)
    const small = this.plasma.context
    if (!small) return
    const image = small.createImageData(PLASMA_WIDTH, PLASMA_HEIGHT)
    const table = new Uint8ClampedArray(256 * 3)
    for (let index = 0; index < 256; index += 1) {
      const [r, g, b] = fillRampColor(palette, index / 255, fill.timeSec)
      table[index * 3] = r
      table[index * 3 + 1] = g
      table[index * 3 + 2] = b
    }
    const t = fill.timeSec * fill.speed * (0.9 + fill.energy * 0.8)
    const zoom = 0.16 / Math.max(0.2, fill.scale)
    for (let y = 0; y < PLASMA_HEIGHT; y += 1) {
      for (let x = 0; x < PLASMA_WIDTH; x += 1) {
        const v = Math.sin(x * zoom + t) + Math.sin(y * zoom * 1.3 - t * 1.3) + Math.sin((x + y) * zoom * 0.7 + t * 0.7)
          + Math.sin(Math.hypot(x - PLASMA_WIDTH / 2, y - PLASMA_HEIGHT / 2) * zoom * 1.2 - t)
        const index = (((v + 4) / 8) * 255) | 0
        const at = (y * PLASMA_WIDTH + x) * 4
        image.data[at] = table[index * 3]
        image.data[at + 1] = table[index * 3 + 1]
        image.data[at + 2] = table[index * 3 + 2]
        image.data[at + 3] = 255
      }
    }
    small.putImageData(image, 0, 0)
    context.drawImage(this.plasma.canvas as HTMLCanvasElement, 0, 0, canvas.width, canvas.height)
  }

  dispose(): void {
    this.plasma.dispose()
  }
}

function drawGradient(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  const angle = fill.timeSec * 0.25 * fill.speed
  const radius = Math.hypot(canvas.width, canvas.height) / 2
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const gradient = context.createLinearGradient(cx - Math.cos(angle) * radius, cy - Math.sin(angle) * radius, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
  const shift = (fill.timeSec * 0.1 * fill.speed) % 1
  for (let stop = 0; stop <= 4; stop += 1) {
    const along = stop / 4
    gradient.addColorStop(along, rgba(fillRampColor(palette, 0.25 + 0.75 * Math.abs(Math.sin((along + shift) * Math.PI)), fill.timeSec), 1))
  }
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  if (fill.kick > 0.01) {
    context.fillStyle = `rgba(255, 255, 255, ${clamp01(fill.kick * 0.3)})`
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
}

function drawStripes(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  const width = (canvas.height / (7 * Math.max(0.2, fill.scale))) * (1 + fill.kick * 0.35)
  const reach = Math.hypot(canvas.width, canvas.height)
  const count = Math.ceil(reach / width) + 2
  const offset = (fill.timeSec * fill.speed * width * 1.2) % (width * 2)
  context.fillStyle = rgba(fillRampColor(palette, 0.1, fill.timeSec), 1)
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(0.6)
  for (let k = -count; k < count; k += 2) {
    context.fillStyle = rgba(fillRampColor(palette, 0.55 + 0.4 * ((k / 2) % 2 === 0 ? 1 : 0.4) * (0.7 + fill.energy * 0.5), fill.timeSec), 1)
    context.fillRect(-reach, k * width + offset, reach * 2, width)
  }
  context.restore()
}

function drawBars(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  context.fillStyle = rgba(fillRampColor(palette, 0.05, fill.timeSec), 1)
  context.fillRect(0, 0, canvas.width, canvas.height)
  const bars = Math.round(28 / Math.max(0.4, fill.scale))
  const barWidth = canvas.width / bars
  const tick = Math.floor(fill.timeSec * 9 * fill.speed)
  for (let index = 0; index < bars; index += 1) {
    const height = clamp01((0.18 + 0.82 * glowNoise(index * 1.9 + tick * 5.3)) * (0.45 + fill.energy * 0.7) + fill.kick * 0.35)
    context.fillStyle = rgba(fillRampColor(palette, 0.35 + 0.65 * height, fill.timeSec + index * 0.05), 1)
    context.fillRect(index * barWidth + barWidth * 0.08, canvas.height * (1 - height), barWidth * 0.84, canvas.height * height)
  }
}

function drawTunnel(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  context.fillStyle = rgba(fillRampColor(palette, 0, fill.timeSec), 1)
  context.fillRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const reach = Math.hypot(cx, cy) * 1.1
  const rings = 22
  const travel = (fill.timeSec * fill.speed * 0.5 + fill.kick * 0.04) % 1
  context.lineJoin = 'round'
  for (let k = rings - 1; k >= 0; k -= 1) {
    const depth = (k + travel) / rings
    const size = Math.pow(depth, 2.2) * reach / Math.max(0.3, fill.scale) * 1.2
    context.save()
    context.translate(cx, cy)
    context.rotate(fill.timeSec * 0.25 * fill.speed + depth * 0.9)
    context.beginPath()
    for (let corner = 0; corner < 6; corner += 1) {
      const angle = (corner / 6) * Math.PI * 2
      context.lineTo(Math.cos(angle) * size, Math.sin(angle) * size)
    }
    context.closePath()
    context.lineWidth = Math.max(1, size * 0.045)
    context.strokeStyle = rgba(fillRampColor(palette, 0.45 + 0.55 * depth, fill.timeSec), clamp01(0.25 + depth))
    context.stroke()
    context.restore()
  }
}

function drawStarfield(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  context.fillStyle = rgba(fillRampColor(palette, 0, fill.timeSec), 1)
  context.fillRect(0, 0, canvas.width, canvas.height)
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  const stars = Math.round(180 * Math.max(0.5, fill.scale))
  const travel = fill.timeSec * fill.speed * 0.35 + fill.kick * 0.03
  context.lineCap = 'round'
  for (let index = 0; index < stars; index += 1) {
    const z = (glowNoise(index * 1.37) + travel) % 1
    const near = 1 - z
    const streak = 0.025 + fill.energy * 0.03
    const angle = glowNoise(index * 3.11) * Math.PI * 2
    const spread = glowNoise(index * 7.7) * canvas.width * 0.7
    const x0 = cx + Math.cos(angle) * spread / Math.max(0.05, z)
    const y0 = cy + Math.sin(angle) * spread / Math.max(0.05, z)
    const z1 = Math.max(0.02, z - streak)
    const x1 = cx + Math.cos(angle) * spread / z1
    const y1 = cy + Math.sin(angle) * spread / z1
    context.strokeStyle = rgba(fillRampColor(palette, 0.5 + 0.5 * near, fill.timeSec), clamp01(near * 1.3))
    context.lineWidth = lerp(0.6, 2.6, near)
    context.beginPath()
    context.moveTo(x0, y0)
    context.lineTo(x1, y1)
    context.stroke()
  }
}

function drawGrid(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fill: HeadlinerFillContext, palette: HeadlinerGlowPalette): void {
  const horizon = canvas.height * 0.45
  const sky = context.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, rgba(fillRampColor(palette, 0, fill.timeSec), 1))
  sky.addColorStop(1, rgba(fillRampColor(palette, 0.55, fill.timeSec), 1))
  context.fillStyle = sky
  context.fillRect(0, 0, canvas.width, horizon)
  context.fillStyle = rgba(fillRampColor(palette, 0.02, fill.timeSec), 1)
  context.fillRect(0, horizon, canvas.width, canvas.height - horizon)
  const lines = 14
  const travel = (fill.timeSec * fill.speed * 0.6 + fill.kick * 0.05) % 1
  context.lineWidth = Math.max(1, canvas.height * 0.004)
  context.strokeStyle = rgba(fillRampColor(palette, 0.9, fill.timeSec), 0.9)
  for (let k = 0; k < lines; k += 1) {
    const y = horizon + (canvas.height - horizon) * Math.pow((k + travel) / lines, 2)
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(canvas.width, y)
    context.stroke()
  }
  const columns = Math.round(18 / Math.max(0.4, fill.scale))
  for (let column = -columns; column <= columns; column += 1) {
    context.beginPath()
    context.moveTo(canvas.width / 2 + column * canvas.width * 0.012, horizon)
    context.lineTo(canvas.width / 2 + column * canvas.width * 0.16 / Math.max(0.4, fill.scale), canvas.height)
    context.stroke()
  }
}

/** Accent colour of a fill (used for the silhouette rim): the palette's own colour rather than a ramp shade. */
export function fillAccentColor(palette: HeadlinerGlowPalette, timeSec: number): [number, number, number] {
  return resolveGlowColor(palette, 0.5, timeSec)
}
