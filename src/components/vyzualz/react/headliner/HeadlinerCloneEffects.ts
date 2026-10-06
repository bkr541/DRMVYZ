// The clone-family effects of the POV document: Freeze Ghost (priority 5), Strobe Clone (6) and Clone Spread (7).
// They share a bank of captured pictures and the performer isolation in HeadlinerIsolation.ts.

import {
  getHeadlinerBoolean,
  getHeadlinerNumber,
  getHeadlinerString,
} from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  applyMask,
  clamp01,
  compositeLayer,
  drawLive,
  drawVideoInto,
  effectStrength,
  hexToRgb,
  mixRgb,
  readPalette,
  resolveHeadlinerWorkSize,
  tintSurface,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
  type HeadlinerPalette,
} from './HeadlinerEffectKit'
import { HeadlinerPerformerIsolator } from './HeadlinerIsolation'
import { HeadlinerTriggerReader } from './HeadlinerTriggers'

type CloneStyle = 'normal' | 'alt'

interface Clone {
  surface: WorkSurface
  bornBeat: number
  style: CloneStyle
}

/** Captured pictures, oldest first. Surfaces are recycled so capturing never allocates after warm-up. */
class CloneBank {
  clones: Clone[] = []
  private spare: WorkSurface[] = []
  private width = 0
  private height = 0

  /** Resizing drops the captures: they no longer match the work size. */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.clear()
  }

  capture(args: HeadlinerEffectRenderArgs, mask: HTMLCanvasElement | null, bornBeat: number, style: CloneStyle): void {
    const surface = this.spare.pop() ?? new WorkSurface()
    surface.resize(this.width, this.height)
    surface.clear()
    if (!drawVideoInto(surface, args)) {
      this.spare.push(surface)
      return
    }
    if (mask) applyMask(surface, mask, 1.2)
    this.clones.push({ surface, bornBeat, style })
  }

  /** Drops the oldest clones beyond `max`. */
  limit(max: number): void {
    while (this.clones.length > max) this.recycle(this.clones.shift())
  }

  /** Drops clones older than `lifeBeats` (0 keeps them until cleared). */
  expire(beat: number, lifeBeats: number): void {
    if (lifeBeats <= 0) return
    this.clones = this.clones.filter(clone => {
      const keep = beat - clone.bornBeat < lifeBeats
      if (!keep) this.recycle(clone)
      return keep
    })
  }

  clear(): void {
    for (const clone of this.clones) this.spare.push(clone.surface)
    this.clones = []
  }

  private recycle(clone: Clone | undefined): void {
    if (clone) this.spare.push(clone.surface)
  }

  dispose(): void {
    for (const surface of [...this.clones.map(clone => clone.surface), ...this.spare]) surface.dispose()
    this.clones = []
    this.spare = []
  }
}

/** The picture to draw for a clone: tinted when the palette asks for it. */
function tintedCopy(scratch: WorkSurface, source: WorkSurface, color: readonly number[] | null, amount: number): HTMLCanvasElement | null {
  if (!source.canvas) return null
  if (!color || !scratch.context || !scratch.canvas) return source.canvas
  scratch.resize(source.canvas.width, source.canvas.height)
  scratch.clear()
  scratch.context.globalAlpha = 1
  scratch.context.drawImage(source.canvas, 0, 0)
  tintSurface(scratch, color, amount)
  return scratch.canvas
}

/** Colour for the clone at `along` (0 newest/first … 1 oldest/last), or null for Original. */
function paletteColor(palette: HeadlinerPalette, along: number): readonly number[] | null {
  if (palette.mode === 'tint') return palette.primary
  if (palette.mode === 'gradient') return mixRgb(palette.primary, palette.secondary, along)
  return null
}

const smoothstep = (value: number) => {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

// ── Freeze Ghost ───────────────────────────────────────────────────────────────

class FreezeGhostProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'freeze-ghost' as const
  private readonly bank = new CloneBank()
  private readonly layer = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private readonly isolator = new HeadlinerPerformerIsolator()
  private readonly triggers = new HeadlinerTriggerReader()
  private lastSlot = Number.NaN

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.bank.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)

    // Button presses are consumed even at Master Intensity 0 so they never fire later by surprise.
    const wantsClear = this.triggers.take('clear-ghosts')
    const wantsCapture = this.triggers.take('capture-pose')
    if (this.triggers.take('relearn-background')) this.isolator.relearn()
    if (wantsClear) this.bank.clear()

    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) return

    const isolation = getHeadlinerString(parameters, 'isolation', 'off')
    const mask = this.isolator.update(video, sourceRect, isolation, getHeadlinerNumber(parameters, 'isolationStrength', 0.6))

    const every = Number(getHeadlinerString(parameters, 'autoCapture', '0')) || 0
    let auto = false
    if (every > 0) {
      const slot = Math.floor(timing.beat / every)
      auto = !Number.isNaN(this.lastSlot) && slot !== this.lastSlot
      this.lastSlot = slot
    } else {
      this.lastSlot = Number.NaN
    }
    if (wantsCapture || auto) {
      this.bank.capture(args, mask, timing.beat, 'normal')
      this.bank.limit(Math.round(getHeadlinerNumber(parameters, 'maxGhosts', 4)))
    }
    const life = Number(getHeadlinerString(parameters, 'ghostLife', '0')) || 0
    this.bank.expire(timing.beat, life)
    this.bank.limit(Math.round(getHeadlinerNumber(parameters, 'maxGhosts', 4)))
    if (this.bank.clones.length === 0) return

    const layer = this.layer.context
    this.layer.clear()
    const palette = readPalette(parameters)
    const opacity = getHeadlinerNumber(parameters, 'ghostOpacity', 0.6)
    const count = this.bank.clones.length
    // Oldest first so the newest ghost ends up on top.
    this.bank.clones.forEach((clone, index) => {
      const rank = count - 1 - index
      const fade = life > 0 ? 1 - smoothstep((timing.beat - clone.bornBeat - life * 0.75) / (life * 0.25)) : 1
      const source = tintedCopy(this.scratch, clone.surface, paletteColor(palette, count > 1 ? rank / (count - 1) : 0), palette.amount)
      if (!source) return
      layer.globalAlpha = clamp01(opacity * fade)
      layer.drawImage(source, 0, 0)
    })
    layer.globalAlpha = 1
    compositeLayer(args, this.layer, Math.min(1, strength), getHeadlinerString(parameters, 'blendMode', 'normal'))
  }

  dispose(): void {
    this.bank.dispose()
    this.layer.dispose()
    this.scratch.dispose()
    this.isolator.dispose()
  }
}

// ── Strobe Clone ───────────────────────────────────────────────────────────────

class StrobeCloneProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'strobe-clone' as const
  private readonly bank = new CloneBank()
  private readonly layer = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private readonly isolator = new HeadlinerPerformerIsolator()
  private readonly triggers = new HeadlinerTriggerReader()
  private lastSlot = Number.NaN
  private lastBuildSlot = Number.NaN
  private bars = 0

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.bank.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)
    if (this.triggers.take('relearn-background')) this.isolator.relearn()

    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context) return

    const mask = this.isolator.update(video, sourceRect, getHeadlinerString(parameters, 'isolation', 'off'), getHeadlinerNumber(parameters, 'isolationStrength', 0.6))

    // Downbeat reset first, so a clone captured on the same frame survives it.
    const resetEvery = Number(getHeadlinerString(parameters, 'resetEvery', '4')) || 0
    if (timing.downbeatHit) {
      this.bars += 1
      if (resetEvery > 0 && this.bars % resetEvery === 0) this.bank.clear()
    }

    const source = getHeadlinerString(parameters, 'captureSource', 'kick')
    let capture = false
    if (source === 'kick') {
      capture = timing.kickHit
    } else {
      const slot = Math.floor(timing.beat * (source === 'half' ? 2 : 1))
      capture = !Number.isNaN(this.lastSlot) && slot !== this.lastSlot
      this.lastSlot = slot
    }

    // A build-up adds captures that come faster the further it gets: every beat down to every sixteenth.
    const acceleration = getHeadlinerNumber(parameters, 'buildAcceleration', 0.7)
    if (acceleration > 0 && timing.build > 0.02) {
      const interval = 1 / (1 + 3 * timing.build * acceleration)
      const slot = Math.floor(timing.beat / interval)
      if (!Number.isNaN(this.lastBuildSlot) && slot !== this.lastBuildSlot) capture = true
      this.lastBuildSlot = slot
    } else {
      this.lastBuildSlot = Number.NaN
    }

    const max = Math.round(getHeadlinerNumber(parameters, 'maxClones', 6))
    if (capture) this.bank.capture(args, mask, timing.beat, 'normal')
    if (timing.snareHit && getHeadlinerBoolean(parameters, 'snareClones', true)) this.bank.capture(args, mask, timing.beat, 'alt')
    this.bank.limit(max)
    const life = Number(getHeadlinerString(parameters, 'cloneLife', '8')) || 0
    this.bank.expire(timing.beat, life)
    if (this.bank.clones.length === 0) return

    const layer = this.layer.context
    this.layer.clear()
    const palette = readPalette(parameters)
    const altStyle = getHeadlinerString(parameters, 'altStyle', 'color')
    const altColor = hexToRgb(getHeadlinerString(parameters, 'altColor', '#ff4fd8'))
    const opacity = getHeadlinerNumber(parameters, 'cloneOpacity', 0.55)
    const count = this.bank.clones.length
    this.bank.clones.forEach((clone, index) => {
      const rank = count - 1 - index
      const fade = life > 0 ? 1 - smoothstep((timing.beat - clone.bornBeat - life * 0.7) / (life * 0.3)) : 1
      const alt = clone.style === 'alt'
      const color = alt && altStyle === 'color' ? altColor : paletteColor(palette, count > 1 ? rank / (count - 1) : 0)
      const picture = tintedCopy(this.scratch, clone.surface, color, alt && altStyle === 'color' ? 0.75 : palette.amount)
      if (!picture) return
      layer.save()
      layer.globalAlpha = clamp01(opacity * fade * Math.pow(0.92, rank))
      if (alt && altStyle === 'negative') layer.filter = 'invert(1)'
      if (alt && altStyle === 'mirror') {
        layer.translate(work.width, 0)
        layer.scale(-1, 1)
      }
      layer.drawImage(picture, 0, 0)
      layer.restore()
    })
    compositeLayer(args, this.layer, Math.min(1, strength), getHeadlinerString(parameters, 'blendMode', 'normal'))
  }

  dispose(): void {
    this.bank.dispose()
    this.layer.dispose()
    this.scratch.dispose()
    this.isolator.dispose()
  }
}

// ── Clone Spread ───────────────────────────────────────────────────────────────

export interface CloneSpreadPlacement {
  x: number
  y: number
  flip: boolean
}

/**
 * Where each copy sits, in work pixels from the centre. `distance` is the base spacing already scaled by the
 * motion; `shift` is the number of shift steps taken so far (a fraction while a step is in progress).
 */
export function placeCloneSpreadCopies(
  layout: string,
  copies: number,
  distance: number,
  shift: number,
  aspect: number,
): CloneSpreadPlacement[] {
  const placements: CloneSpreadPlacement[] = []
  // Linear layouts swap sides on each shift; the ring turns one place per shift.
  const side = Math.cos(Math.PI * shift)
  for (let index = 0; index < copies; index += 1) {
    if (layout === 'radial') {
      const angle = (index / copies) * Math.PI * 2 + shift * ((Math.PI * 2) / copies) - Math.PI / 2
      placements.push({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * aspect, flip: false })
      continue
    }
    const direction = index % 2 === 0 ? 1 : -1
    const rank = Math.floor(index / 2) + 1
    const offset = direction * rank * distance * side
    if (layout === 'vertical') placements.push({ x: 0, y: offset * aspect, flip: false })
    else placements.push({ x: offset, y: 0, flip: layout === 'mirror' && direction * side < 0 })
  }
  return placements
}

class CloneSpreadProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'clone-spread' as const
  private readonly performer = new WorkSurface()
  private readonly layer = new WorkSurface()
  private readonly scratch = new WorkSurface()
  private readonly isolator = new HeadlinerPerformerIsolator()
  private readonly triggers = new HeadlinerTriggerReader()

  render(args: HeadlinerEffectRenderArgs): void {
    drawLive(args)
    const { parameters, timing, canvas, video, sourceRect } = args
    if (this.triggers.take('relearn-background')) this.isolator.relearn()
    const strength = effectStrength(parameters, timing)
    if (strength <= 0.001 || !this.layer.context || !this.performer.context) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.performer.resize(work.width, work.height)
    this.layer.resize(work.width, work.height)
    this.performer.clear()
    if (!drawVideoInto(this.performer, args) || !this.performer.canvas) return
    const mask = this.isolator.update(video, sourceRect, getHeadlinerString(parameters, 'isolation', 'off'), getHeadlinerNumber(parameters, 'isolationStrength', 0.6))
    if (mask) applyMask(this.performer, mask, 1.2)

    const amount = getHeadlinerNumber(parameters, 'motionAmount', 0.6)
    const motion = getHeadlinerString(parameters, 'spreadMotion', 'pulse')
    const beatPhase = timing.beat - Math.floor(timing.beat)
    let factor = 1
    let shift = 0
    if (motion === 'pulse') {
      // Fully spread on the beat, collapsing toward the middle between beats.
      factor = 1 - amount * (0.5 - 0.5 * Math.cos(Math.PI * 2 * beatPhase))
    } else if (motion === 'kick') {
      factor = 1 - amount + amount * timing.kick
    } else if (motion === 'shift') {
      const unit = getHeadlinerString(parameters, 'shiftEvery', 'bar') === 'beat' ? 1 : 4
      const position = timing.beat / unit
      // Moves quickly at the start of each step, then holds.
      shift = Math.floor(position) + smoothstep((position - Math.floor(position)) * 4)
    }

    const copies = Math.round(getHeadlinerNumber(parameters, 'copies', 4))
    const spread = getHeadlinerNumber(parameters, 'spread', 0.5)
    const placements = placeCloneSpreadCopies(
      getHeadlinerString(parameters, 'layout', 'horizontal'),
      copies,
      spread * 0.32 * work.width * factor * Math.min(1.5, strength),
      shift,
      0.6,
    )
    const scale = Math.max(0.05, getHeadlinerNumber(parameters, 'copyScale', 0.7))
    const palette = readPalette(parameters)
    const layer = this.layer.context
    this.layer.clear()
    layer.globalAlpha = clamp01(getHeadlinerNumber(parameters, 'copyOpacity', 0.75))
    // Farthest copies first so the nearest sit on top.
    const order = placements.map((placement, index) => ({ placement, index }))
      .sort((a, b) => Math.hypot(b.placement.x, b.placement.y) - Math.hypot(a.placement.x, a.placement.y))
    for (const { placement, index } of order) {
      const picture = tintedCopy(this.scratch, this.performer, paletteColor(palette, copies > 1 ? index / (copies - 1) : 0), palette.amount)
      if (!picture) continue
      layer.save()
      layer.translate(work.width / 2 + placement.x, work.height / 2 + placement.y)
      layer.scale(placement.flip ? -scale : scale, scale)
      layer.drawImage(picture, -work.width / 2, -work.height / 2)
      layer.restore()
    }
    layer.globalAlpha = 1
    compositeLayer(args, this.layer, Math.min(1, strength), getHeadlinerString(parameters, 'blendMode', 'normal'))
  }

  dispose(): void {
    this.performer.dispose()
    this.layer.dispose()
    this.scratch.dispose()
    this.isolator.dispose()
  }
}

export function createFreezeGhostProcessor(): HeadlinerEffectProcessor {
  return new FreezeGhostProcessor()
}

export function createStrobeCloneProcessor(): HeadlinerEffectProcessor {
  return new StrobeCloneProcessor()
}

export function createCloneSpreadProcessor(): HeadlinerEffectProcessor {
  return new CloneSpreadProcessor()
}
