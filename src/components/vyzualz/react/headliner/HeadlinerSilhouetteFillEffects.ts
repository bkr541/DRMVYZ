// The silhouette-fill effects of the POV document: Digital Silhouette (priority 17) and Portal Body (18). Both follow
// the performer's shape from the shared person segmentation and fill it with a generated picture
// (HeadlinerFillPatterns.ts). Digital Silhouette replaces the performer with a clean flat fill and can process the room
// separately; Portal Body leaves the room alone and makes the performer a window into another world. Until the model
// has produced a mask they show the plain camera, and Master Intensity 0 is always the clean camera.

import { getHeadlinerNumber, getHeadlinerString, type HeadlinerPresetId } from './HeadlinerEffectCatalog'
import {
  WorkSurface,
  clamp01,
  compositeLayer,
  drawLive,
  effectStrength,
  resolveHeadlinerWorkSize,
  tintSurface,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import { FillPatternPainter, fillAccentColor, type HeadlinerFillKind } from './HeadlinerFillPatterns'
import { HeadlinerSilhouetteSource } from './HeadlinerSegmentation'
import type { HeadlinerSilhouetteEffectDeps } from './HeadlinerSilhouetteEffects'
import { SilhouetteShaper, glowPulse, readGlowPalette } from './HeadlinerSilhouetteShapes'

const FILL_KINDS: readonly HeadlinerFillKind[] = ['gradient', 'plasma', 'stripes', 'bars', 'tunnel', 'starfield', 'grid']

/** How the room outside the performer is treated in Digital Silhouette. */
export type HeadlinerEnvironmentMode = 'keep' | 'dim' | 'mono' | 'blur' | 'black'

/** Darkens, desaturates, blurs or blacks out the whole live picture by `amount` (0..1); the silhouette is drawn over it afterwards. */
export function applyEnvironment(args: HeadlinerEffectRenderArgs, mode: string, amount: number, scale: number): void {
  if (amount <= 0.01 || mode === 'keep') return
  const { context, canvas, video, sourceRect } = args
  context.save()
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'
  if (mode === 'dim' || mode === 'black') {
    context.fillStyle = `rgba(0, 0, 0, ${clamp01(mode === 'black' ? amount : amount * 0.85)})`
    context.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    context.filter = mode === 'mono' ? `grayscale(${clamp01(amount)})` : `blur(${(amount * 14 * scale).toFixed(2)}px)`
    context.drawImage(video, sourceRect.sx, sourceRect.sy, sourceRect.sw, sourceRect.sh, 0, 0, canvas.width, canvas.height)
  }
  context.restore()
}

class SilhouetteFillProcessor implements HeadlinerEffectProcessor {
  private readonly source: HeadlinerSilhouetteSource
  private readonly shaper = new SilhouetteShaper()
  private readonly painter = new FillPatternPainter()
  private readonly layer = new WorkSurface()
  private readonly rim = new WorkSurface()

  constructor(readonly presetId: Extract<HeadlinerPresetId, 'digital-silhouette' | 'portal-body'>, deps: HeadlinerSilhouetteEffectDeps = {}) {
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
    this.layer.resize(work.width, work.height)
    this.rim.resize(work.width, work.height)
    const layer = this.layer.context
    if (!layer || !this.layer.canvas) return
    const scale = work.width / 720
    const digital = this.presetId === 'digital-silhouette'
    const level = Math.min(1, strength)

    if (digital) applyEnvironment(args, getHeadlinerString(parameters, 'environment', 'dim'), getHeadlinerNumber(parameters, 'environmentAmount', 0.6) * level, scale)
    else {
      const outside = getHeadlinerNumber(parameters, 'outsideDim', 0) * level
      if (outside > 0.01) applyEnvironment(args, 'dim', outside, scale)
    }

    const kindSetting = getHeadlinerString(parameters, 'fill', digital ? 'gradient' : 'tunnel') as HeadlinerFillKind
    const kind = FILL_KINDS.includes(kindSetting) ? kindSetting : digital ? 'gradient' : 'tunnel'
    const palette = readGlowPalette(parameters)
    const pulse = glowPulse(parameters, timing.beat, timing.kick)
    this.painter.draw(this.layer, kind, {
      timeSec: timing.timeSec,
      beat: timing.beat,
      energy: timing.energy,
      kick: Math.max(timing.kick, pulse),
      speed: getHeadlinerNumber(parameters, 'patternSpeed', 1),
      scale: getHeadlinerNumber(parameters, 'patternScale', 1),
    }, palette)

    // Keep the fill only inside the performer, with a slightly softened edge.
    layer.save()
    layer.globalCompositeOperation = 'destination-in'
    layer.filter = `blur(${(1.1 * scale).toFixed(2)}px)`
    layer.drawImage(silhouette.mask, 0, 0, work.width, work.height)
    layer.restore()
    compositeLayer(args, this.layer, getHeadlinerNumber(parameters, 'fillOpacity', 1) * level, getHeadlinerString(parameters, 'blendMode', 'normal'))

    // A bright rim where the performer meets the room: the edge of the window, or the clean cut-out.
    const rim = getHeadlinerNumber(parameters, 'rimLight', digital ? 0.4 : 0.7)
    if (rim > 0.01 && this.rim.context) {
      this.shaper.outline(this.rim, silhouette.mask, (2 + 3 * pulse) * scale)
      tintSurface(this.rim, fillAccentColor(palette, timing.timeSec), 1)
      const glow = getHeadlinerNumber(parameters, 'glow', 0.4)
      if (glow > 0.01) compositeLayer(args, this.rim, rim * level * glow, 'add', glow * 10 * scale * (canvas.width / work.width))
      compositeLayer(args, this.rim, rim * level, 'add')
    }
  }

  dispose(): void {
    this.source.dispose()
    this.shaper.dispose()
    this.painter.dispose()
    this.layer.dispose()
    this.rim.dispose()
  }
}

export function createDigitalSilhouetteProcessor(deps?: HeadlinerSilhouetteEffectDeps): HeadlinerEffectProcessor {
  return new SilhouetteFillProcessor('digital-silhouette', deps)
}

export function createPortalBodyProcessor(deps?: HeadlinerSilhouetteEffectDeps): HeadlinerEffectProcessor {
  return new SilhouetteFillProcessor('portal-body', deps)
}
