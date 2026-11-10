// Virtual Backdrop: removes the room behind the performer and puts a library picture or video there instead.
// The person comes from the same segmentation mask the silhouette effects use (with the same learned-background
// fallback while the model loads), so it follows the performer live as they move.

import { getHeadlinerNumber, getHeadlinerString } from './HeadlinerEffectCatalog'
import { fitBackdrop } from './HeadlinerBackdrop'
import {
  WorkSurface,
  applyMask,
  clamp01,
  compositeLayer,
  drawLive,
  effectStrength,
  drawVideoInto,
  hexToRgb,
  resolveHeadlinerWorkSize,
  rgba,
  type HeadlinerEffectProcessor,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffectKit'
import { HeadlinerSilhouetteSource, type HeadlinerSegmentSource } from './HeadlinerSegmentation'

export interface HeadlinerBackdropEffectDeps {
  segmenter?: () => HeadlinerSegmentSource
}

class VirtualBackdropProcessor implements HeadlinerEffectProcessor {
  readonly presetId = 'virtual-backdrop' as const
  private readonly source: HeadlinerSilhouetteSource
  private readonly person = new WorkSurface()

  constructor(deps: HeadlinerBackdropEffectDeps = {}) {
    this.source = new HeadlinerSilhouetteSource(deps.segmenter)
  }

  render(args: HeadlinerEffectRenderArgs): void {
    // Start from the plain camera: it is what shows at 0% and while the person mask is not ready yet.
    drawLive(args)
    const { context, canvas, video, sourceRect, parameters, timing, backdrop } = args
    const strength = clamp01(effectStrength(parameters, timing))
    if (strength <= 0.001 || !this.person.context) {
      this.source.release()
      return
    }
    const silhouette = this.source.update(video, sourceRect, timing.timeSec)
    if (!silhouette.mask) return

    const work = resolveHeadlinerWorkSize(canvas.width, canvas.height)
    this.person.resize(work.width, work.height)
    this.person.clear()
    if (!drawVideoInto(this.person, args)) return
    const softness = clamp01(getHeadlinerNumber(parameters, 'edgeSoftness', 0.3))
    applyMask(this.person, silhouette.mask, (0.4 + 3.6 * softness) * (work.width / 720))

    // The new room: backdrop colour first, then the picture or video over it.
    context.save()
    context.globalAlpha = strength
    context.globalCompositeOperation = 'source-over'
    context.fillStyle = rgba(hexToRgb(getHeadlinerString(parameters, 'backdropColor', '#0a1014')), 1)
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (backdrop) {
      const blur = clamp01(getHeadlinerNumber(parameters, 'backdropBlur', 0))
      if (blur > 0.01) context.filter = `blur(${(blur * 24 * (canvas.width / 1280)).toFixed(2)}px)`
      const fit = getHeadlinerString(parameters, 'backdropFit', 'cover') === 'contain' ? 'contain' : 'cover'
      const rect = fitBackdrop(backdrop, canvas, fit)
      context.drawImage(backdrop.source, rect.x, rect.y, rect.width, rect.height)
      context.filter = 'none'
    }
    const dim = clamp01(getHeadlinerNumber(parameters, 'backdropDim', 0))
    if (dim > 0.01) {
      context.fillStyle = `rgba(0, 0, 0, ${dim.toFixed(3)})`
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.restore()

    compositeLayer(args, this.person, 1, 'normal')
  }

  dispose(): void {
    this.source.dispose()
    this.person.dispose()
  }
}

export function createVirtualBackdropProcessor(deps?: HeadlinerBackdropEffectDeps): HeadlinerEffectProcessor {
  return new VirtualBackdropProcessor(deps)
}
