// Shape operations on a silhouette mask for the silhouette effects: grow it (Aura), shrink it and take the
// difference for a contour (Energy Outline, Outline Echo), and colour it. Canvas 2D has no morphology, so growing
// is a union of copies shifted around a ring and shrinking is the intersection of the same copies. Everything is
// drawn at the target surface's size, with the mask stretched over the whole surface.

import {
  WorkSurface,
  hexToRgb,
  mixRgb,
  tintSurface,
} from './HeadlinerEffectKit'
import { getHeadlinerNumber, getHeadlinerString, type HeadlinerParameterValues } from './HeadlinerEffectCatalog'

/** Offsets (px) of the shifted copies used to grow or shrink a shape by `radius`: a ring, plus an inner ring for large radii so no gaps open up. */
export function ringOffsets(radius: number): [number, number][] {
  if (radius <= 0.25) return []
  const offsets: [number, number][] = []
  const directions = radius > 6 ? 16 : 12
  const rings = radius > 3 ? [radius, radius * 0.5] : [radius]
  for (const ring of rings) {
    for (let index = 0; index < directions; index += 1) {
      const angle = (index / directions) * Math.PI * 2
      offsets.push([Math.cos(angle) * ring, Math.sin(angle) * ring])
    }
  }
  return offsets
}

export class SilhouetteShaper {
  private readonly eroded = new WorkSurface()

  /** Draws the mask grown by `radius` px into `out` (cleared first). */
  dilate(out: WorkSurface, mask: HTMLCanvasElement, radius: number): void {
    const context = out.context
    const canvas = out.canvas
    if (!context || !canvas) return
    out.clear()
    context.save()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    context.drawImage(mask, 0, 0, canvas.width, canvas.height)
    for (const [dx, dy] of ringOffsets(radius)) context.drawImage(mask, dx, dy, canvas.width, canvas.height)
    context.restore()
  }

  /** Draws the mask shrunk by `radius` px into `out` (cleared first). */
  erode(out: WorkSurface, mask: HTMLCanvasElement, radius: number): void {
    const context = out.context
    const canvas = out.canvas
    if (!context || !canvas) return
    out.clear()
    context.save()
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'
    context.drawImage(mask, 0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'destination-in'
    for (const [dx, dy] of ringOffsets(radius)) context.drawImage(mask, dx, dy, canvas.width, canvas.height)
    context.restore()
  }

  /** Draws a contour of `thickness` px centred on the silhouette edge into `out` (cleared first). */
  outline(out: WorkSurface, mask: HTMLCanvasElement, thickness: number): void {
    const canvas = out.canvas
    const context = out.context
    if (!canvas || !context) return
    this.eroded.resize(canvas.width, canvas.height)
    this.dilate(out, mask, thickness / 2)
    this.erode(this.eroded, mask, thickness / 2)
    if (!this.eroded.canvas) return
    context.save()
    context.globalCompositeOperation = 'destination-out'
    context.globalAlpha = 1
    context.drawImage(this.eroded.canvas, 0, 0)
    context.restore()
  }

  dispose(): void {
    this.eroded.dispose()
  }
}

// ── Colour ─────────────────────────────────────────────────────────────────────

export function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const h = ((hue % 360) + 360) % 360
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lightness - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

export interface HeadlinerGlowPalette {
  mode: 'tint' | 'gradient' | 'spectrum'
  primary: [number, number, number]
  secondary: [number, number, number]
}

export function readGlowPalette(parameters: HeadlinerParameterValues): HeadlinerGlowPalette {
  const mode = getHeadlinerString(parameters, 'colorMode', 'tint')
  return {
    mode: mode === 'gradient' || mode === 'spectrum' ? mode : 'tint',
    primary: hexToRgb(getHeadlinerString(parameters, 'primaryColor', '#67f7ff')),
    secondary: hexToRgb(getHeadlinerString(parameters, 'secondaryColor', '#ff4fd8')),
  }
}

/** Colour at position `along` (0..1) of a glow: one colour, a blend of two, or a hue cycle that also drifts with time. */
export function resolveGlowColor(palette: HeadlinerGlowPalette, along: number, timeSec: number): [number, number, number] {
  if (palette.mode === 'gradient') return mixRgb(palette.primary, palette.secondary, Math.min(1, Math.max(0, along)))
  if (palette.mode === 'spectrum') return hslToRgb(along * 240 + timeSec * 40, 0.9, 0.6)
  return palette.primary
}

/** Solid colour on everything already drawn on the surface. */
export function fillWithColor(surface: WorkSurface, color: readonly number[]): void {
  tintSurface(surface, color, 1)
}

/** Strength of a beat swell for the glow effects: 0..1, kicks punch it. */
export function glowPulse(parameters: HeadlinerParameterValues, beat: number, kick: number): number {
  const phase = beat - Math.floor(beat)
  return getHeadlinerNumber(parameters, 'beatPulse', 0) * Math.max(Math.exp(-4 * phase), kick)
}
