// The whole-picture tone effects of the POV document: X-Ray (priority 19) and Posterize Pulse (20). Both rework every
// pixel of the camera picture on a reduced-size copy (capped at TONE_MAX_WIDTH), then lay it over the live picture.
// Master Intensity 0 is always the clean camera, and X-Ray does no pixel work while its transition is at 0.

import { getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import {
  ReadSurface,
  clamp01,
  drawLive,
  effectStrength,
  lerp,
  readPalette,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
  type HeadlinerPalette,
} from './HeadlinerEffectKit'
import type { HeadlinerEffectTiming } from './HeadlinerTiming'

/** Pixel work happens at most this wide. */
export const HEADLINER_TONE_MAX_WIDTH = 640

export function resolveToneWorkSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 }
  const scale = Math.min(1, HEADLINER_TONE_MAX_WIDTH / width)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

type Rgb = readonly [number, number, number]

/** Colour at position t (0..1) along evenly spaced colour stops. */
export function sampleRamp(stops: readonly Rgb[], t: number): [number, number, number] {
  const clamped = clamp01(t) * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(clamped))
  const local = clamped - index
  const a = stops[index]
  const b = stops[index + 1]
  return [lerp(a[0], b[0], local), lerp(a[1], b[1], local), lerp(a[2], b[2], local)]
}

/** A 256-entry colour table (RGB triples) from a ramp, so per-pixel colouring is one lookup. */
export function buildRampTable(stops: readonly Rgb[]): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 3)
  for (let index = 0; index < 256; index += 1) {
    const [r, g, b] = sampleRamp(stops, index / 255)
    table[index * 3] = r
    table[index * 3 + 1] = g
    table[index * 3 + 2] = b
  }
  return table
}

const XRAY_RAMP: readonly Rgb[] = [[0, 4, 10], [30, 90, 130], [170, 225, 255], [255, 255, 255]]
const HEAT_RAMP: readonly Rgb[] = [[0, 0, 20], [40, 0, 140], [200, 0, 90], [255, 110, 0], [255, 230, 40], [255, 255, 255]]

/** The colour ramp for a picture mode and palette: the classic look in Original, otherwise dark → colour (→ colour) → white. */
export function resolveToneRamp(mode: string, palette: HeadlinerPalette): readonly Rgb[] {
  if (palette.mode === 'original') return mode === 'thermal' ? HEAT_RAMP : XRAY_RAMP
  if (palette.mode === 'gradient') return [[0, 0, 0], palette.primary, palette.secondary, [255, 255, 255]]
  return [[0, 0, 0], palette.primary, [255, 255, 255]]
}

// ── X-Ray ──────────────────────────────────────────────────────────────────────

export type HeadlinerXRayMode = 'invert' | 'thermal' | 'edges' | 'negative' | 'posterize' | 'scan'

export interface HeadlinerXRayOptions {
  mode: HeadlinerXRayMode
  /** 0..1 contrast boost. */
  contrast: number
  /** 0..1 edge gain for the edge-based modes. */
  edgeGain: number
  /** 0..1 vertical position of the scan sweep. */
  scanPosition: number
  /** Brightness bands for the posterize mode. */
  bands: number
  table: Uint8ClampedArray
}

/** Sobel edge strength (0..255) of a luminance image; the one-pixel border is left at 0. */
export function sobelEdges(luma: Uint8ClampedArray, width: number, height: number, gain: number, out: Uint8ClampedArray): void {
  out.fill(0)
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x
      const gx = -luma[i - width - 1] - 2 * luma[i - 1] - luma[i + width - 1] + luma[i - width + 1] + 2 * luma[i + 1] + luma[i + width + 1]
      const gy = -luma[i - width - 1] - 2 * luma[i - width] - luma[i - width + 1] + luma[i + width - 1] + 2 * luma[i + width] + luma[i + width + 1]
      const magnitude = (Math.abs(gx) + Math.abs(gy)) * 0.25 * gain
      out[i] = magnitude > 255 ? 255 : magnitude
    }
  }
}

/** Reworks an RGBA picture in place into the chosen X-Ray look. `luma` and `edges` are scratch arrays of width x height. */
export function applyXRay(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: HeadlinerXRayOptions,
  luma: Uint8ClampedArray,
  edges: Uint8ClampedArray,
): void {
  const pixels = width * height
  for (let p = 0, i = 0; p < pixels; p += 1, i += 4) luma[p] = (data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8
  const { mode, table } = options
  const boost = 1 + options.contrast * 2.5
  const useEdges = mode === 'edges' || mode === 'scan'
  if (useEdges) sobelEdges(luma, width, height, 1 + options.edgeGain * 5, edges)
  const bands = Math.max(2, Math.round(options.bands))

  for (let p = 0, i = 0; p < pixels; p += 1, i += 4) {
    if (mode === 'negative') {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
      continue
    }
    let value: number
    if (mode === 'invert') {
      value = 255 - luma[p]
    } else if (mode === 'thermal') {
      value = luma[p]
    } else if (mode === 'posterize') {
      value = (Math.round((luma[p] / 255) * (bands - 1)) / (bands - 1)) * 255
    } else if (mode === 'edges') {
      value = edges[p]
    } else {
      // Scan: contours, plus a bright sweep band and fine scan lines.
      const y = (p / width) | 0
      const sweep = Math.max(0, 1 - Math.abs(y / height - options.scanPosition) * 9)
      const line = (y & 3) === 0 ? 0.55 : 1
      value = Math.min(255, (edges[p] * 1.3 + luma[p] * 0.18 * sweep + sweep * 40) * line)
    }
    value = Math.min(255, Math.max(0, (value - 128) * boost + 128))
    const t = (value | 0) * 3
    data[i] = table[t]
    data[i + 1] = table[t + 1]
    data[i + 2] = table[t + 2]
    data[i + 3] = 255
  }
}

/** Transition amounts for the X-Ray triggers that follow the beat grid or the build: 0 is the normal camera, 1 the full X-Ray. */
export function resolveXRayTrigger(trigger: string, timing: Pick<HeadlinerEffectTiming, 'beat' | 'build'>): number {
  if (trigger === 'always') return 1
  if (trigger === 'build') return clamp01(timing.build)
  if (trigger === 'beat') return Math.exp(-3 * (timing.beat - Math.floor(timing.beat)))
  return 0
}

class XRayProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'x-ray' as const
  private readonly work = new ReadSurface()
  private luma: Uint8ClampedArray = new Uint8ClampedArray(0)
  private edges: Uint8ClampedArray = new Uint8ClampedArray(0)
  private hit = 0
  private tableKey = ''
  private table: Uint8ClampedArray = new Uint8ClampedArray(0)

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect, context } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.work.canvas) {
      this.hit = 0
      return
    }

    if (timing.kickHit || timing.snareHit) this.hit = 1
    else this.hit = Math.max(0, this.hit - timing.dtSec / Math.max(0.05, getHeadlinerNumber(parameters, 'holdSeconds', 0.35)))
    const trigger = getHeadlinerString(parameters, 'trigger', 'always')
    const env = trigger === 'hit' ? this.hit : resolveXRayTrigger(trigger, timing)
    const floor = getHeadlinerNumber(parameters, 'baseAmount', 0)
    const amount = clamp01((floor + (1 - floor) * env) * Math.min(1, strength))
    if (amount < 0.01) return

    const size = resolveToneWorkSize(canvas.width, canvas.height)
    this.work.resize(size.width, size.height)
    const image = this.work.readImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh)
    if (!image) return
    if (this.luma.length !== size.width * size.height) {
      this.luma = new Uint8ClampedArray(size.width * size.height)
      this.edges = new Uint8ClampedArray(size.width * size.height)
    }
    const mode = getHeadlinerString(parameters, 'xrayMode', 'invert') as HeadlinerXRayMode
    const palette = readPalette(parameters)
    const key = `${mode === 'thermal' ? 't' : 'x'}${palette.mode}${palette.primary}${palette.secondary}`
    if (key !== this.tableKey) {
      this.table = buildRampTable(resolveToneRamp(mode, palette))
      this.tableKey = key
    }
    applyXRay(image.data, size.width, size.height, {
      mode,
      contrast: getHeadlinerNumber(parameters, 'contrast', 0.4),
      edgeGain: getHeadlinerNumber(parameters, 'edgeGain', 0.5),
      scanPosition: (timing.beat / 4) % 1,
      bands: getHeadlinerNumber(parameters, 'bands', 5),
      table: this.table,
    }, this.luma, this.edges)
    this.work.put(image)

    context.save()
    context.globalAlpha = amount
    context.globalCompositeOperation = 'source-over'
    context.drawImage(this.work.canvas, 0, 0, size.width, size.height, 0, 0, canvas.width, canvas.height)
    context.restore()
  }

  dispose(): void {
    this.work.dispose()
  }
}

export function createXRayProcessor(): HeadlinerEffectProcessor {
  return new XRayProcessor()
}

// ── Posterize Pulse ────────────────────────────────────────────────────────────

/** Per-channel colour table that quantises 0..255 into `levels` bands; a fractional count blends two whole counts so recovery is smooth. */
export function buildPosterizeTable(levels: number): Uint8ClampedArray {
  const clamped = Math.min(64, Math.max(2, levels))
  const low = Math.floor(clamped)
  const high = Math.min(64, low + 1)
  const mix = clamped - low
  const table = new Uint8ClampedArray(256)
  for (let value = 0; value < 256; value += 1) {
    const a = (Math.round((value / 255) * (low - 1)) / (low - 1)) * 255
    const b = (Math.round((value / 255) * (high - 1)) / (high - 1)) * 255
    table[value] = lerp(a, b, mix)
  }
  return table
}

export interface HeadlinerPosterizeEvents {
  /** The level count each musical event pushes the picture down to. */
  beat: number
  bass: number
  drop: number
}

/**
 * One step of the level count. An event snaps it down to that event's level (never up); with no event it recovers toward
 * `base`, or toward the build-up's own lowered level while a build is under way. Recovery is exponential in log2(levels),
 * so going from 2 to 16 looks as steady as going from 8 to 16.
 */
export function stepPosterizeLevels(
  current: number,
  base: number,
  event: number | null,
  build: number,
  dtSec: number,
  recoverySec: number,
  floor: number,
): number {
  const resting = lerp(base, floor, clamp01(build) * 0.8)
  let next = current
  if (event !== null && event < next) next = event
  const rate = 1 - Math.exp(-Math.max(0, dtSec) / Math.max(0.02, recoverySec))
  const logNext = Math.log2(next)
  const logRest = Math.log2(Math.max(2, resting))
  return Math.pow(2, logNext + (logRest - logNext) * rate)
}

class PosterizePulseProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'posterize-pulse' as const
  private readonly work = new ReadSurface()
  private levels = 16
  private lastSlot = Number.NaN

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect, context } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.work.canvas) {
      this.levels = getHeadlinerNumber(parameters, 'normalLevels', 16)
      this.lastSlot = Number.NaN
      return
    }

    const base = getHeadlinerNumber(parameters, 'normalLevels', 16)
    const slot = Math.floor(timing.beat)
    const onBeat = slot !== this.lastSlot && Number.isFinite(this.lastSlot)
    this.lastSlot = slot
    // The strongest event this frame wins: a drop beats a bass hit beats a plain beat.
    let event: number | null = null
    if (onBeat) event = getHeadlinerNumber(parameters, 'beatLevels', 8)
    if (timing.kickHit) event = Math.min(event ?? Infinity, getHeadlinerNumber(parameters, 'bassLevels', 4))
    if (timing.downbeatHit) event = Math.min(event ?? Infinity, getHeadlinerNumber(parameters, 'dropLevels', 2))
    this.levels = stepPosterizeLevels(
      this.levels,
      base,
      event,
      timing.build,
      timing.dtSec,
      getHeadlinerNumber(parameters, 'recovery', 0.45),
      getHeadlinerNumber(parameters, 'dropLevels', 2),
    )

    const size = resolveToneWorkSize(canvas.width, canvas.height)
    this.work.resize(size.width, size.height)
    const image = this.work.readImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh)
    if (!image) return
    const palette = readPalette(parameters)
    const table = buildPosterizeTable(this.levels)
    const data = image.data
    if (palette.mode === 'original') {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = table[data[i]]
        data[i + 1] = table[data[i + 1]]
        data[i + 2] = table[data[i + 2]]
      }
    } else {
      const ramp = buildRampTable(palette.mode === 'gradient' ? [[0, 0, 0], palette.primary, palette.secondary] : [[0, 0, 0], palette.primary, [255, 255, 255]])
      const amount = palette.amount
      for (let i = 0; i < data.length; i += 4) {
        const luma = table[(data[i] * 77 + data[i + 1] * 151 + data[i + 2] * 28) >> 8] * 3
        data[i] = lerp(table[data[i]], ramp[luma], amount)
        data[i + 1] = lerp(table[data[i + 1]], ramp[luma + 1], amount)
        data[i + 2] = lerp(table[data[i + 2]], ramp[luma + 2], amount)
      }
    }
    this.work.put(image)

    context.save()
    context.globalAlpha = clamp01(Math.min(1, strength) * getHeadlinerNumber(parameters, 'posterAmount', 1))
    context.globalCompositeOperation = 'source-over'
    // Hard-edged bands read as posterisation; smoothing the upscale would soften them back into gradients.
    context.imageSmoothingEnabled = false
    context.drawImage(this.work.canvas, 0, 0, size.width, size.height, 0, 0, canvas.width, canvas.height)
    context.restore()
  }

  dispose(): void {
    this.work.dispose()
  }
}

export function createPosterizePulseProcessor(): HeadlinerEffectProcessor {
  return new PosterizePulseProcessor()
}
