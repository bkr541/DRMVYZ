// The silhouette effects of the POV document: Aura (priority 11), Energy Outline (12) and Outline Echo (13). All three
// follow the performer's shape from the shared person segmentation (HeadlinerSegmentation.ts). Until the model has
// produced a mask they show the plain camera, and Master Intensity 0 is always the clean camera.

import { getHeadlinerBoolean, getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import {
  HEADLINER_MAX_ECHOES,
  WorkSurface,
  clamp01,
  compositeLayer,
  drawLive,
  drawVideoInto,
  effectStrength,
  lerp,
  resolveHeadlinerWorkSize,
  rgba,
  tintSurface,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import { HeadlinerSilhouetteSource, type HeadlinerSegmentSource } from './HeadlinerSegmentation'
import {
  SilhouetteShaper,
  glowPulse,
  readGlowPalette,
  resolveGlowColor,
  type HeadlinerGlowPalette,
} from './HeadlinerSilhouetteShapes'

export interface HeadlinerSilhouetteEffectDeps {
  segmenter?: () => HeadlinerSegmentSource
}

/** Cheap repeatable noise in 0..1 for flicker and crackle (no state, so it is easy to test). */
export function glowNoise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/**
 * Paints the palette over what is already on the surface: one colour, a top-to-bottom gradient, or a hue cycle down the
 * figure. `operation` is 'source-atop' to recolour a shape, or 'multiply' to colour a black-backed picture (black stays black).
 */
function paintGlowColor(surface: WorkSurface, palette: HeadlinerGlowPalette, timeSec: number, operation: GlobalCompositeOperation = 'source-atop'): void {
  const context = surface.context
  const canvas = surface.canvas
  if (!context || !canvas) return
  context.save()
  context.globalCompositeOperation = operation
  if (palette.mode === 'tint') {
    context.fillStyle = rgba(palette.primary, 1)
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
    const stops = palette.mode === 'gradient' ? 2 : 6
    for (let stop = 0; stop < stops; stop += 1) {
      const along = stop / (stops - 1)
      gradient.addColorStop(along, rgba(resolveGlowColor(palette, along, timeSec), 1))
    }
    context.fillStyle = gradient
  }
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
}

/** Darkens the whole picture so a neon contour stands out. */
function dimCamera(args: HeadlinerEffectRenderArgs, amount: number): void {
  if (amount <= 0.001) return
  const { context, canvas } = args
  context.save()
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = `rgba(0, 0, 0, ${clamp01(amount)})`
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
}

// ── Aura ───────────────────────────────────────────────────────────────────────

/** Radius (work px at 720 wide) of the outermost aura shell for the Size setting, swollen by the beat. */
export function resolveAuraRadius(size: number, pulse: number, breath: number): number {
  return lerp(4, 64, clamp01(size)) * (1 + pulse * 0.9) * (1 + breath)
}

class AuraProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'aura' as const
  private readonly source: HeadlinerSilhouetteSource
  private readonly shaper = new SilhouetteShaper()
  private readonly layer = new WorkSurface()
  private readonly shell = new WorkSurface()
  private readonly body = new WorkSurface()

  constructor(deps: HeadlinerSilhouetteEffectDeps = {}) {
    this.source = new HeadlinerSilhouetteSource(deps.segmenter)
  }

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.source.release()
      return
    }
    const silhouette = this.source.update(video, sourceRect, timing.timeSec)
    if (!silhouette.mask) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    for (const surface of [this.layer, this.shell, this.body]) surface.resize(work.width, work.height)
    const layer = this.layer.context
    if (!layer || !this.shell.canvas || !this.body.canvas) return
    const scale = work.width / 720

    const pulse = glowPulse(parameters, timing.beat, timing.kick)
    const breath = getHeadlinerNumber(parameters, 'breathing', 0.4) * 0.35 * Math.sin((timing.beat / 4) * Math.PI * 2)
    const radius = resolveAuraRadius(getHeadlinerNumber(parameters, 'auraSize', 0.4), pulse, breath) * scale * Math.min(1.3, 0.4 + strength * 0.6)
    const shells = Math.max(1, Math.round(getHeadlinerNumber(parameters, 'shells', 3)))
    const palette = readGlowPalette(parameters)
    const glowBlur = getHeadlinerNumber(parameters, 'glow', 0.5) * 14 * scale

    this.layer.clear()
    // Outermost shell first so the inner, brighter ones stack on top of it.
    for (let index = shells - 1; index >= 0; index -= 1) {
      this.shaper.dilate(this.shell, silhouette.mask, radius * ((index + 1) / shells))
      tintSurface(this.shell, resolveGlowColor(palette, shells > 1 ? index / (shells - 1) : 0, timing.timeSec), 1)
      layer.save()
      layer.globalAlpha = clamp01((1 - (index / shells) * 0.6) * (index === shells - 1 ? 0.55 : 0.75))
      if (glowBlur > 0.25) layer.filter = `blur(${(glowBlur * (0.4 + 0.6 * ((index + 1) / shells))).toFixed(2)}px)`
      layer.drawImage(this.shell.canvas, 0, 0)
      layer.restore()
    }

    // The aura sits around the performer, not over them.
    if (!getHeadlinerBoolean(parameters, 'coverBody', false)) {
      layer.save()
      layer.globalCompositeOperation = 'destination-out'
      layer.globalAlpha = 1
      layer.drawImage(silhouette.mask, 0, 0, work.width, work.height)
      layer.restore()
    }

    // Optionally darken everything that is not the performer, so the aura reads against a busy room.
    const dim = getHeadlinerNumber(parameters, 'dimBackground', 0.3) * Math.min(1, strength)
    if (dim > 0.01 && this.body.context) {
      this.body.clear()
      this.body.context.fillStyle = `rgba(0, 0, 0, ${dim})`
      this.body.context.fillRect(0, 0, work.width, work.height)
      this.body.context.save()
      this.body.context.globalCompositeOperation = 'destination-out'
      this.body.context.filter = `blur(${(1.2 * scale).toFixed(2)}px)`
      this.body.context.drawImage(silhouette.mask, 0, 0, work.width, work.height)
      this.body.context.restore()
      compositeLayer(args, this.body, 1, 'normal')
    }

    compositeLayer(
      args,
      this.layer,
      getHeadlinerNumber(parameters, 'auraOpacity', 0.85) * Math.min(1, strength),
      getHeadlinerString(parameters, 'blendMode', 'screen'),
    )
  }

  dispose(): void {
    this.source.dispose()
    this.shaper.dispose()
    for (const surface of [this.layer, this.shell, this.body]) surface.dispose()
  }
}

export function createAuraProcessor(deps?: HeadlinerSilhouetteEffectDeps): HeadlinerEffectProcessor {
  return new AuraProcessor(deps)
}

// ── Energy Outline ─────────────────────────────────────────────────────────────

/** Stroke width (work px at 720 wide) for the Line Width setting, thickened by the beat. */
export function resolveOutlineThickness(width: number, pulse: number): number {
  return lerp(1.5, 14, clamp01(width)) * (1 + pulse * 0.8)
}

/** Brightness multiplier for the Flicker setting at a moment in time: 1 when steady, dipping at random up to `flicker`. */
export function resolveFlickerGain(flicker: number, timeSec: number): number {
  return 1 - clamp01(flicker) * 0.75 * glowNoise(Math.floor(timeSec * 24))
}

/** Draws the outline layer in horizontal slices, each nudged sideways by noise, for a crackling electric edge. */
function crackleInto(target: WorkSurface, source: WorkSurface, amount: number, timeSec: number): void {
  const context = target.context
  if (!context || !source.canvas || !target.canvas) return
  target.clear()
  const slices = 18
  const tick = Math.floor(timeSec * 20)
  for (let slice = 0; slice < slices; slice += 1) {
    const offset = (glowNoise(slice * 3.1 + tick * 7.7) - 0.5) * 2 * amount * target.canvas.width * 0.02
    // Whole-pixel, non-overlapping slices, so no bright seam appears where two slices meet.
    const y = Math.round((slice * target.canvas.height) / slices)
    const height = Math.round(((slice + 1) * target.canvas.height) / slices) - y
    context.drawImage(source.canvas, 0, y, source.canvas.width, height, offset, y, source.canvas.width, height)
  }
}

class EnergyOutlineProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'energy-outline' as const
  private readonly source: HeadlinerSilhouetteSource
  private readonly shaper = new SilhouetteShaper()
  private readonly line = new WorkSurface()
  private readonly cracked = new WorkSurface()
  private readonly detail = new WorkSurface()
  private readonly picture = new WorkSurface()

  constructor(deps: HeadlinerSilhouetteEffectDeps = {}) {
    this.source = new HeadlinerSilhouetteSource(deps.segmenter)
  }

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.line.context) {
      this.source.release()
      return
    }
    const silhouette = this.source.update(video, sourceRect, timing.timeSec)
    if (!silhouette.mask) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    for (const surface of [this.line, this.cracked, this.detail, this.picture]) surface.resize(work.width, work.height)
    const scale = work.width / 720
    const pulse = glowPulse(parameters, timing.beat, timing.kick)

    this.shaper.outline(this.line, silhouette.mask, resolveOutlineThickness(getHeadlinerNumber(parameters, 'lineWidth', 0.35), pulse) * scale)
    const palette = readGlowPalette(parameters)
    paintGlowColor(this.line, palette, timing.timeSec)
    this.addInnerDetail(args, silhouette.mask, scale, palette, timing.timeSec)

    let shown = this.line
    const crackle = getHeadlinerNumber(parameters, 'crackle', 0.25)
    if (crackle > 0.01 && this.cracked.context) {
      crackleInto(this.cracked, this.line, crackle, timing.timeSec)
      shown = this.cracked
    }

    dimCamera(args, getHeadlinerNumber(parameters, 'cameraDim', 0.8) * Math.min(1, strength))
    const flicker = resolveFlickerGain(getHeadlinerNumber(parameters, 'flicker', 0.2), timing.timeSec)
    const opacity = getHeadlinerNumber(parameters, 'lineOpacity', 0.95) * Math.min(1, strength) * flicker
    const blend = getHeadlinerString(parameters, 'blendMode', 'add')
    const glow = getHeadlinerNumber(parameters, 'glow', 0.6)
    // A wide, soft copy under a crisp one reads as bloom.
    if (glow > 0.01) compositeLayer(args, shown, opacity * glow, blend, glow * 12 * scale * (canvas.width / work.width))
    compositeLayer(args, shown, opacity, blend)
  }

  /** Adds the camera's own edges inside the figure (hair, face, clothing folds) to the contour, in the outline colour. */
  private addInnerDetail(args: HeadlinerEffectRenderArgs, mask: HTMLCanvasElement, scale: number, palette: HeadlinerGlowPalette, timeSec: number): void {
    const amount = getHeadlinerNumber(args.parameters, 'innerDetail', 0.3)
    const line = this.line.context
    const edges = this.detail.context
    const picture = this.picture.context
    if (amount <= 0.01 || !line || !edges || !picture || !this.picture.canvas || !this.detail.canvas) return
    if (!drawVideoInto(this.picture, args)) return
    // An image minus a slightly shifted copy of itself is a cheap edge map (opaque, black where nothing changes).
    this.detail.clear()
    edges.save()
    edges.globalCompositeOperation = 'source-over'
    edges.filter = 'grayscale(1)'
    edges.drawImage(this.picture.canvas, 0, 0)
    edges.globalCompositeOperation = 'difference'
    edges.drawImage(this.picture.canvas, Math.max(1, 1.5 * scale), Math.max(1, 1.5 * scale))
    edges.restore()
    // Boost the faint edges into lines, colour them (black stays black), then keep only the figure.
    this.picture.clear()
    picture.save()
    picture.filter = 'contrast(5) brightness(1.6)'
    picture.drawImage(this.detail.canvas, 0, 0)
    picture.restore()
    paintGlowColor(this.picture, palette, timeSec, 'multiply')
    picture.save()
    picture.globalCompositeOperation = 'destination-in'
    picture.drawImage(mask, 0, 0, this.picture.canvas.width, this.picture.canvas.height)
    picture.restore()
    line.save()
    line.globalCompositeOperation = 'lighter'
    line.globalAlpha = clamp01(amount)
    line.drawImage(this.picture.canvas, 0, 0)
    line.restore()
  }

  dispose(): void {
    this.source.dispose()
    this.shaper.dispose()
    for (const surface of [this.line, this.cracked, this.detail, this.picture]) surface.dispose()
  }
}

export function createEnergyOutlineProcessor(deps?: HeadlinerSilhouetteEffectDeps): HeadlinerEffectProcessor {
  return new EnergyOutlineProcessor(deps)
}

// ── Outline Echo ───────────────────────────────────────────────────────────────

class OutlineEchoProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'outline-echo' as const
  private readonly source: HeadlinerSilhouetteSource
  private readonly shaper = new SilhouetteShaper()
  private readonly liveShaper = new SilhouetteShaper()
  /** Outlines of previous poses, newest first, at half the work size. */
  private history: WorkSurface[] = []
  private spare: WorkSurface[] = []
  private readonly layer = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private readonly live = new WorkSurface()
  private lastSlot = Number.NaN
  private lastCaptureSec = Number.NEGATIVE_INFINITY

  constructor(deps: HeadlinerSilhouetteEffectDeps = {}) {
    this.source = new HeadlinerSilhouetteSource(deps.segmenter)
  }

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) {
      this.source.release()
      this.clearHistory()
      return
    }
    const silhouette = this.source.update(video, sourceRect, timing.timeSec)
    if (!silhouette.mask) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    const stored = { width: Math.max(2, Math.round(work.width / 2)), height: Math.max(2, Math.round(work.height / 2)) }
    if (this.layer.resize(work.width, work.height)) this.clearHistory()
    this.scratch.resize(stored.width, stored.height)
    this.live.resize(work.width, work.height)
    const scale = work.width / 720
    const pulse = glowPulse(parameters, timing.beat, timing.kick)
    const thickness = resolveOutlineThickness(getHeadlinerNumber(parameters, 'lineWidth', 0.3), pulse) * scale

    this.captureIfDue(args, silhouette.mask, stored.width, stored.height, thickness / 2)

    const count = Math.min(this.history.length, Math.round(getHeadlinerNumber(parameters, 'echoCount', 5)))
    const palette = readGlowPalette(parameters)
    const opacity = getHeadlinerNumber(parameters, 'echoOpacity', 0.7)
    const falloff = getHeadlinerNumber(parameters, 'echoFalloff', 0.78)
    const drift = getHeadlinerNumber(parameters, 'echoDrift', 0) * 0.045
    const angle = (getHeadlinerNumber(parameters, 'driftAngle', 270) * Math.PI) / 180
    const zoom = getHeadlinerNumber(parameters, 'echoZoom', 0)
    const layer = this.layer.context
    if (!layer || !this.scratch.context || !this.scratch.canvas) return
    this.layer.clear()

    // Oldest first, so the newest echo ends up on top.
    for (let k = count - 1; k >= 0; k -= 1) {
      const echo = this.history[k]
      if (!echo.canvas) continue
      this.scratch.clear()
      this.scratch.context.drawImage(echo.canvas, 0, 0)
      tintSurface(this.scratch, resolveGlowColor(palette, count > 1 ? k / (count - 1) : 0, timing.timeSec), 1)
      layer.save()
      layer.globalAlpha = clamp01(opacity * Math.pow(falloff, k))
      layer.translate(work.width / 2 + Math.cos(angle) * drift * work.width * (k + 1), work.height / 2 + Math.sin(angle) * drift * work.width * (k + 1))
      const grow = Math.max(0.05, 1 + zoom * (k + 1))
      layer.scale(grow, grow)
      layer.drawImage(this.scratch.canvas, -work.width / 2, -work.height / 2, work.width, work.height)
      layer.restore()
    }

    // The live outline, brightest, on top.
    if (getHeadlinerBoolean(parameters, 'showLive', true) && this.live.context) {
      this.liveShaper.outline(this.live, silhouette.mask, thickness)
      tintSurface(this.live, resolveGlowColor(palette, 0, timing.timeSec), 1)
      layer.save()
      layer.globalAlpha = 1
      layer.drawImage(this.live.canvas as HTMLCanvasElement, 0, 0)
      layer.restore()
    }

    dimCamera(args, getHeadlinerNumber(parameters, 'cameraDim', 0.6) * Math.min(1, strength))
    const blend = getHeadlinerString(parameters, 'blendMode', 'add')
    const glow = getHeadlinerNumber(parameters, 'glow', 0.5)
    const level = Math.min(1, strength)
    if (glow > 0.01) compositeLayer(args, this.layer, level * glow, blend, glow * 10 * scale * (canvas.width / work.width))
    compositeLayer(args, this.layer, level, blend)
  }

  private captureIfDue(args: HeadlinerEffectRenderArgs, mask: HTMLCanvasElement, width: number, height: number, halfThickness: number): void {
    const { parameters, timing } = args
    const synced = getHeadlinerBoolean(parameters, 'bpmSync', true)
    let due: boolean
    if (synced) {
      const division = Number(getHeadlinerString(parameters, 'echoSpacingBeats', '0.25')) || 0.25
      const slot = Math.floor(timing.beat / division)
      due = slot !== this.lastSlot
      this.lastSlot = slot
    } else {
      due = timing.timeSec - this.lastCaptureSec >= getHeadlinerNumber(parameters, 'echoDelayMs', 160) / 1000
    }
    if (!due && this.history.length > 0) return
    this.lastCaptureSec = timing.timeSec

    const surface = this.spare.pop() ?? new WorkSurface()
    surface.resize(width, height)
    this.shaper.outline(surface, mask, halfThickness)
    this.history.unshift(surface)
    while (this.history.length > HEADLINER_MAX_ECHOES) {
      const old = this.history.pop()
      if (old) this.spare.push(old)
    }
  }

  private clearHistory(): void {
    this.spare.push(...this.history)
    this.history = []
    this.lastSlot = Number.NaN
    this.lastCaptureSec = Number.NEGATIVE_INFINITY
  }

  dispose(): void {
    this.source.dispose()
    this.shaper.dispose()
    this.liveShaper.dispose()
    for (const surface of [...this.history, ...this.spare, this.layer, this.scratch, this.live]) surface.dispose()
    this.history = []
    this.spare = []
  }
}

export function createOutlineEchoProcessor(deps?: HeadlinerSilhouetteEffectDeps): HeadlinerEffectProcessor {
  return new OutlineEchoProcessor(deps)
}
