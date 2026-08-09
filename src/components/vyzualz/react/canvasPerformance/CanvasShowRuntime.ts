import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { CanvasShowManagerShow } from '../../showManager/CanvasShowManagerDomain'
import {
  getActiveCanvasShowManagerMediaElements,
  getCanvasShowManagerTotalDuration,
  resolveCanvasShowManagerElementVisual,
  resolveCanvasShowManagerElementSourceTime,
  validateCanvasShowManagerShow,
} from '../../showManager/CanvasShowManagerDomain'
import type { CanvasMediaItem } from '../ReactTypes'
import type {
  CanvasCompositionTemplate,
  CanvasResolvedLayer,
  CanvasResolvedPerformanceFrame,
} from './CanvasPerformanceTypes'

const SHOW_TEMPLATE: CanvasCompositionTemplate = {
  id: 'fullScreenHero',
  label: 'Four-layer Show',
  maxLayers: 4,
  maxVideoDecoders: 4,
  feedbackPasses: 0,
  slots: [],
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveShowElementFilters(input: {
  brightness: number
  blur: number
  contrast: number
  saturation: number
  hue: number
  glow: number
}): { compositorFilter: string; glowFilter: string } {
  const parts = [
    `brightness(${input.brightness.toFixed(3)})`,
    `contrast(${input.contrast.toFixed(3)})`,
    `saturate(${input.saturation.toFixed(3)})`,
    `blur(${input.blur.toFixed(2)}px)`,
    `hue-rotate(${input.hue.toFixed(1)}deg)`,
  ]
  const neutral = input.brightness === 1 && input.blur === 0 && input.contrast === 1
    && input.saturation === 1 && input.hue === 0
  return {
    compositorFilter: neutral ? 'none' : parts.join(' '),
    glowFilter: input.glow <= 0
      ? 'none'
      : [
          `brightness(${(input.brightness + input.glow * 0.5).toFixed(3)})`,
          `contrast(${input.contrast.toFixed(3)})`,
          `saturate(${(input.saturation + input.glow * 0.2).toFixed(3)})`,
          `blur(${(input.blur + input.glow * 12).toFixed(2)}px)`,
          `hue-rotate(${input.hue.toFixed(1)}deg)`,
        ].join(' '),
  }
}

export function normalizeCanvasShowRuntimeTime(show: CanvasShowManagerShow, timeSec: number): number {
  const duration = getCanvasShowManagerTotalDuration(show)
  if (duration <= 0) return 0
  if (!Number.isFinite(timeSec)) return 0
  if (timeSec === duration) return Math.max(0, duration - 0.000001)
  return ((timeSec % duration) + duration) % duration
}

export function resolveCanvasShowRuntimeFrame({
  show,
  showTimeSec,
  mediaItems,
  context,
  isMediaReady = () => true,
  selectedElementId = null,
}: {
  show: CanvasShowManagerShow
  showTimeSec: number
  mediaItems: readonly CanvasMediaItem[]
  context: SharedPerformanceContext
  isMediaReady?: (mediaId: string) => boolean
  selectedElementId?: string | null
}): CanvasResolvedPerformanceFrame | null {
  const validation = validateCanvasShowManagerShow(show)
  if (!validation.valid) return null
  const timeSec = normalizeCanvasShowRuntimeTime(show, showTimeSec)
  const byId = new Map(mediaItems.map(item => [item.id, item]))
  const diagnostics: string[] = []
  const readyMediaIds: string[] = []
  const pendingMediaIds: string[] = []
  let decoderCount = 0

  const layers: CanvasResolvedLayer[] = getActiveCanvasShowManagerMediaElements(show, timeSec)
    .slice(0, 4)
    .map(element => {
      const visual = resolveCanvasShowManagerElementVisual(element, timeSec)
      const filters = resolveShowElementFilters({
        brightness: visual.brightness,
        blur: visual.fx.blur,
        contrast: visual.fx.contrast,
        saturation: visual.fx.saturation,
        hue: visual.fx.hue,
        glow: visual.fx.glow,
      })
      const media = byId.get(element.mediaId) ?? null
      // Runtime identity is element-scoped. Reusing one library video on two lanes
      // must create two decoder handles because their trim phases may differ.
      const source = media ? { ...media, id: `${media.id}::canvas-show-element::${element.id}` } : null
      const ready = Boolean(source && isMediaReady(source.id))
      if (!source) diagnostics.push(`Missing media for Layer ${element.layer + 1}: ${element.mediaId}`)
      else if (ready) readyMediaIds.push(source.id)
      else pendingMediaIds.push(source.id)
      if (source?.type === 'video') decoderCount += 1
      const duration = Math.max(0, source?.durationSec ?? 0)
      const sourceIn = source?.type === 'video' ? clamp(element.sourceInSec ?? 0, 0, duration || Number.MAX_SAFE_INTEGER) : 0
      const requestedOut = element.sourceOutSec ?? duration
      const sourceOut = source?.type === 'video'
        ? Math.max(sourceIn + 0.001, duration > 0 ? clamp(requestedOut || duration, sourceIn + 0.001, duration) : requestedOut)
        : 0
      const sourceTime = source?.type === 'video'
        ? resolveCanvasShowManagerElementSourceTime({ ...element, sourceInSec: sourceIn, sourceOutSec: sourceOut }, timeSec)
        : 0
      return {
        id: element.id,
        role: element.layer === 0 ? 'background' : element.layer === 1 ? 'hero' : element.layer === 2 ? 'texture' : 'foregroundAccent',
        sourceMediaId: source?.id ?? null,
        source,
        enabled: Boolean(source),
        opacity: visual.opacity,
        blendMode: 'source-over',
        x: visual.x,
        y: visual.y,
        scaleX: visual.scale,
        scaleY: visual.scale,
        rotation: visual.rotation,
        crop: { x: 0, y: 0, width: 1, height: 1 },
        aspectBehavior: 'cover',
        zIndex: element.layer,
        mirrorX: false,
        mirrorY: false,
        maskSourceMediaId: null,
        maskMode: null,
        playback: {
          playbackRate: 1,
          inPointSec: sourceIn,
          phaseSec: sourceTime ?? sourceIn,
          loopRange: { startSec: sourceIn, endSec: sourceOut, bars: null },
          quantizeBars: null,
          startOnDownbeat: false,
          phraseAlignedReset: false,
          sectionAligned: false,
          frameHold: false,
          releaseOnDropImpact: false,
        },
        effectChain: [],
        modulationRoutes: [],
        userLocked: true,
        showElementTreatment: {
          brightness: visual.brightness,
          blurPx: visual.fx.blur,
          contrast: visual.fx.contrast,
          saturation: visual.fx.saturation,
          hueDeg: visual.fx.hue,
          glow: visual.fx.glow,
          ...filters,
          transitionInProgress: visual.transition.inProgress,
          transitionOutProgress: visual.transition.outProgress,
        },
      }
    })

  if (decoderCount >= 4) diagnostics.push('Four-video Show path: reduced initial composition resolution enabled')
  return {
    programId: `canvas-show:${show.id}`,
    frameIdentity: `canvas-show:${show.id}:${layers.map(layer => layer.id).join('|')}`,
    sceneId: show.id,
    showLabel: show.name,
    context: { ...context, audioTimeSec: timeSec },
    template: SHOW_TEMPLATE,
    layers,
    transition: null,
    effectRecipeId: 'none',
    fallbackUsed: diagnostics.some(item => item.startsWith('Missing')),
    readyMediaIds,
    pendingMediaIds,
    decoderCount,
    textureHandleCount: layers.length,
    feedbackPasses: 0,
    orchestrationActive: false,
    nextSectionType: null,
    anticipatoryStage: 'none',
    diagnostics,
    runtimeMode: 'show',
    selectedElementId,
  }
}
