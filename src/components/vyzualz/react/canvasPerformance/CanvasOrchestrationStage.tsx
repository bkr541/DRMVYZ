import { useEffect, useMemo, useRef, useState } from 'react'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { BrandKit } from '../../../../features/personalization/BrandKitTypes'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  resolveCanvasPresetRendererKind,
  type CanvasEngineSettings,
  type CanvasMediaItem,
  type CanvasPresetId,
  type CanvasPresetSettings,
  type ReactTrackSection,
} from '../ReactTypes'
import { CanvasFracturesRendererLayer } from '../renderers/CanvasFracturesRendererLayer'
import { LaserImageFxRenderer } from '../renderers/laserImageFx/LaserImageFxRenderer'
import { hasCanvasEffectPass, makeCanvasCaptureFilter, resolveCanvasEffectOpacity } from '../canvasMediaFidelity'
import type { CanvasFracturesSourceElement } from '../renderers/fractures/CanvasFracturesTypes'
import { isCanvasFracturesProcessor, resolveCanvasFracturesPresetSettings } from './CanvasFracturesPerformance'
import { resolveCanvasEffectVisualState } from './CanvasEffectRecipes'
import { CanvasLayerEffectRuntime, type CanvasLayerEffectFrameContext } from './CanvasLayerEffectRendering'
import { isCanvasPreloadHandleDrawable, type CanvasPreloadHandle, type CanvasPreloadManager } from './CanvasPreloadManager'
import { resolveCanvasTransitionVisualState } from './CanvasTransitions'
import { CanvasShowAdaptiveQualityController, resolveCanvasShowCompositionDimensions, type CanvasShowQualitySnapshot } from './CanvasShowAdaptiveQuality'
import { resolveCanvasLayerAlphaHierarchy, resolveCanvasOutputContract, type CanvasLayerAlphaHierarchy } from './CanvasOutputContract'
import type {
  CanvasAspectBehavior,
  CanvasResolvedLayer,
  CanvasResolvedPerformanceFrame,
  CanvasTransitionId,
} from './CanvasPerformanceTypes'

interface CanvasOrchestrationStageProps {
  frame: CanvasResolvedPerformanceFrame
  preloadManager: CanvasPreloadManager
  engineSettings: CanvasEngineSettings
  presetSettings: CanvasPresetSettings
  isPlaying: boolean
  isPaused: boolean
  motionIntensity: number
  selectedPresetId: CanvasPresetId
  trackIdentity?: string | null
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: readonly ReactTrackSection[]
  getAudioTime?: () => number
  analyser?: AnalyserNode | null
  brandKit?: Readonly<BrandKit> | null
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  showStatus?: boolean
}

type DrawableSource = CanvasImageSource & (HTMLVideoElement | HTMLImageElement)

function isVideoHandle(handle: CanvasPreloadHandle | null): handle is HTMLVideoElement {
  return typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement
}

function isImageHandle(handle: CanvasPreloadHandle | null): handle is HTMLImageElement {
  return typeof HTMLImageElement !== 'undefined' && handle instanceof HTMLImageElement
}

function sourceReady(handle: CanvasPreloadHandle | null): handle is DrawableSource {
  return isCanvasPreloadHandleDrawable(handle)
}

function sourceSize(handle: DrawableSource): { width: number; height: number } {
  if (isVideoHandle(handle)) return { width: handle.videoWidth, height: handle.videoHeight }
  return { width: handle.naturalWidth, height: handle.naturalHeight }
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
}

function makeScratchCanvas(): HTMLCanvasElement | null {
  return typeof document === 'undefined' ? null : document.createElement('canvas')
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function drawAuthoredPresetSource({
  context,
  source,
  width,
  height,
  engineSettings,
  alpha,
  filter = 'none',
  compositeOperation = 'source-over',
  reactive = null,
}: {
  context: CanvasRenderingContext2D
  source: HTMLCanvasElement
  width: number
  height: number
  engineSettings: CanvasEngineSettings
  alpha: number
  filter?: string
  compositeOperation?: GlobalCompositeOperation
  reactive?: {
    scale: number
    offsetX: number
    offsetY: number
    rotation: number
  } | null
}): void {
  if (alpha <= 0.001) return
  context.save()
  context.globalCompositeOperation = compositeOperation
  context.globalAlpha = clamp01(alpha)
  context.translate(
    width * 0.5 + width * 0.5 * (engineSettings.positionX / 100) + (reactive?.offsetX ?? 0),
    height * 0.5 + height * 0.5 * (engineSettings.positionY / 100) + (reactive?.offsetY ?? 0),
  )
  context.rotate((engineSettings.rotation + (reactive?.rotation ?? 0)) * Math.PI / 180)
  const scale = reactive?.scale ?? engineSettings.scale
  context.scale(scale, scale)
  context.filter = filter
  try {
    context.drawImage(source, -width / 2, -height / 2, width, height)
  } catch {
    // Preserve the previous valid output if a browser rejects a transient source copy.
  }
  context.restore()
}

function drawAuthoredStandardPreset({
  context,
  source,
  width,
  height,
  engineSettings,
  presetSettings,
  outputOpacity,
  performanceContext,
  isPlaying,
  isPaused,
  nowSec,
}: {
  context: CanvasRenderingContext2D
  source: HTMLCanvasElement
  width: number
  height: number
  engineSettings: CanvasEngineSettings
  presetSettings: CanvasPresetSettings
  outputOpacity: number
  performanceContext: SharedPerformanceContext
  isPlaying: boolean
  isPaused: boolean
  nowSec: number
}): void {
  const active = isPlaying && !isPaused
  const bass = clamp01(performanceContext.bass)
  const high = clamp01(performanceContext.high)
  const beat = active ? clamp01(Math.max(performanceContext.kickStrength, performanceContext.transient)) : 0
  const drySourceAlpha = clamp01(presetSettings.drySourceMix ?? presetSettings.sourceVisibility)

  drawAuthoredPresetSource({
    context,
    source,
    width,
    height,
    engineSettings,
    alpha: drySourceAlpha * outputOpacity,
  })

  if (!hasCanvasEffectPass(presetSettings)) return
  const processedAlpha = presetSettings.sourceMixMode === 'legacyComposite' ? drySourceAlpha : 1
  const liveScale = engineSettings.scale
    + bass * presetSettings.bassReactivity * presetSettings.intensity * 0.16
    + beat * presetSettings.beatPulse * presetSettings.intensity * 0.045
  const shake = (beat * 9 + high * 4 + 0.8) * presetSettings.glitchAmount * presetSettings.intensity
  const reactive = {
    scale: liveScale,
    offsetX: Math.sin(nowSec * 48) * shake + Math.sin(nowSec * (0.9 + presetSettings.turbulence * 2.6)) * presetSettings.motionAmount * 9,
    offsetY: Math.cos(nowSec * 41) * shake + Math.cos(nowSec * (0.74 + presetSettings.turbulence * 2.1)) * presetSettings.motionAmount * 7,
    rotation: shake * 0.16,
  }

  drawAuthoredPresetSource({
    context,
    source,
    width,
    height,
    engineSettings,
    alpha: processedAlpha * resolveCanvasEffectOpacity(presetSettings) * outputOpacity,
    filter: makeCanvasCaptureFilter(presetSettings, bass, high),
    compositeOperation: 'screen',
    reactive,
  })
}

const VIDEO_PLAY_RETRY_MS = 1_500
const videoPlayRetryAt = new WeakMap<HTMLVideoElement, number>()

function syncVideo(handle: HTMLVideoElement, layer: CanvasResolvedLayer, isPlaying: boolean, isPaused: boolean): void {
  const playback = layer.playback
  handle.muted = true
  handle.playsInline = true
  handle.playbackRate = playback.playbackRate
  handle.loop = false

  const endSec = playback.loopRange.endSec
  if (endSec > playback.loopRange.startSec && handle.currentTime >= endSec - 0.035) {
    handle.currentTime = playback.loopRange.startSec
  }
  if (!handle.seeking && Math.abs(handle.currentTime - playback.phaseSec) > 0.22) {
    try { handle.currentTime = playback.phaseSec } catch { /* media metadata may still be settling */ }
  }

  if (!isPlaying || isPaused || playback.frameHold) {
    handle.pause()
    videoPlayRetryAt.delete(handle)
    return
  }
  if (!handle.paused) {
    videoPlayRetryAt.delete(handle)
    return
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if ((videoPlayRetryAt.get(handle) ?? 0) > now) return
  videoPlayRetryAt.set(handle, now + VIDEO_PLAY_RETRY_MS)
  void handle.play()
    .then(() => videoPlayRetryAt.delete(handle))
    .catch(() => videoPlayRetryAt.set(handle, now + VIDEO_PLAY_RETRY_MS))
}

function fitRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
  aspect: CanvasAspectBehavior,
): { width: number; height: number } {
  if (aspect === 'stretch') return { width: targetWidth, height: targetHeight }
  if (aspect === 'native') return { width: sourceWidth, height: sourceHeight }
  const sourceAspect = sourceWidth / Math.max(1, sourceHeight)
  const targetAspect = targetWidth / Math.max(1, targetHeight)
  const cover = aspect === 'cover'
  if ((sourceAspect > targetAspect) === cover) {
    return { width: targetHeight * sourceAspect, height: targetHeight }
  }
  return { width: targetWidth, height: targetWidth / sourceAspect }
}

function drawSource(
  context: CanvasRenderingContext2D,
  source: DrawableSource,
  layer: CanvasResolvedLayer,
  width: number,
  height: number,
  globalScale = 1,
  globalRotation = 0,
  globalOffsetX = 0,
  globalOffsetY = 0,
  alphaHierarchy: CanvasLayerAlphaHierarchy = { drySourceAlpha: 1, processedAlpha: 0 },
  motionIntensity = 1,
): void {
  const size = sourceSize(source)
  const crop = layer.crop
  const sx = Math.max(0, Math.min(size.width - 1, crop.x * size.width))
  const sy = Math.max(0, Math.min(size.height - 1, crop.y * size.height))
  const sw = Math.max(1, Math.min(size.width - sx, crop.width * size.width))
  const sh = Math.max(1, Math.min(size.height - sy, crop.height * size.height))
  const fitWithinTransformBounds = layer.fitWithinTransformBounds === true
  const fitTargetWidth = fitWithinTransformBounds ? width * Math.abs(layer.scaleX) : width
  const fitTargetHeight = fitWithinTransformBounds ? height * Math.abs(layer.scaleY) : height
  const fitted = fitRect(sw, sh, fitTargetWidth, fitTargetHeight, layer.aspectBehavior)
  const effects = resolveCanvasEffectVisualState(layer.effectChain, motionIntensity)
  const x = width * (0.5 + layer.x * 0.5) + globalOffsetX * width
  const y = height * (0.5 + layer.y * 0.5) + globalOffsetY * height
  const layoutScaleX = fitWithinTransformBounds ? 1 : layer.scaleX
  const layoutScaleY = fitWithinTransformBounds ? 1 : layer.scaleY
  const scaleX = layoutScaleX * globalScale * (1 + effects.scaleBoost) * (layer.mirrorX ? -1 : 1)
  const scaleY = layoutScaleY * globalScale * (1 + effects.scaleBoost) * (layer.mirrorY ? -1 : 1)

  context.save()
  context.globalCompositeOperation = layer.blendMode
  context.globalAlpha = alphaHierarchy.drySourceAlpha
  context.translate(x + effects.offsetX, y + effects.offsetY)
  context.rotate((layer.rotation + globalRotation + effects.rotationDeg) * Math.PI / 180)
  context.scale(scaleX, scaleY)
  context.filter = layer.showElementTreatment?.compositorFilter ?? 'none'
  if (alphaHierarchy.drySourceAlpha > 0.001) {
    context.drawImage(source, sx, sy, sw, sh, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height)
  }

  // Show-element Glow reuses the same isolated layer canvas and source transform,
  // so it cannot leak into sibling layers and adds no per-frame canvas allocation.
  const showGlow = layer.showElementTreatment?.glow ?? 0
  if (showGlow > 0.001 && alphaHierarchy.drySourceAlpha > 0.001) {
    context.globalCompositeOperation = 'screen'
    context.globalAlpha = Math.min(0.45, alphaHierarchy.drySourceAlpha * showGlow * 0.42)
    context.filter = layer.showElementTreatment?.glowFilter ?? 'none'
    context.drawImage(source, sx, sy, sw, sh, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height)
  }

  // Effects are an additive pass over an untouched source pass. Disabling a recipe
  // therefore restores the pristine frame rather than compounding filtered pixels.
  if (layer.effectChain.length > 0 && alphaHierarchy.processedAlpha > 0.001) {
    context.globalCompositeOperation = effects.rgbSplitAmount > 0.02 ? 'screen' : 'source-over'
    context.globalAlpha = Math.min(0.48, alphaHierarchy.processedAlpha * 0.34)
    context.filter = effects.filter
    context.drawImage(source, sx, sy, sw, sh, -fitted.width / 2, -fitted.height / 2, fitted.width, fitted.height)
    if (effects.rgbSplitAmount > 0.02) {
      const split = effects.rgbSplitAmount * 12
      context.globalAlpha = Math.min(0.26, alphaHierarchy.processedAlpha * effects.rgbSplitAmount * 0.3)
      context.drawImage(source, sx, sy, sw, sh, -fitted.width / 2 + split, -fitted.height / 2, fitted.width, fitted.height)
      context.drawImage(source, sx, sy, sw, sh, -fitted.width / 2 - split, -fitted.height / 2, fitted.width, fitted.height)
    }
  }
  context.restore()

  if (effects.scanlineAmount > 0.02) {
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.globalAlpha = Math.min(0.18, alphaHierarchy.processedAlpha * effects.scanlineAmount * 0.22)
    context.fillStyle = '#000'
    const gap = Math.max(3, Math.round(7 - effects.scanlineAmount * 3))
    for (let row = 0; row < height; row += gap) context.fillRect(0, row, width, 1)
    context.restore()
  }
}

function drawLayerWithOptionalMask({
  output,
  layerCanvas,
  maskCanvas,
  effectScratchA,
  effectScratchB,
  layerEffectRuntime,
  layerEffectContext,
  layer,
  source,
  mask,
  width,
  height,
  globalScale,
  globalRotation,
  globalOffsetX,
  globalOffsetY,
  alphaHierarchy,
  motionIntensity,
}: {
  output: CanvasRenderingContext2D
  layerCanvas: HTMLCanvasElement
  maskCanvas: HTMLCanvasElement
  effectScratchA: HTMLCanvasElement
  effectScratchB: HTMLCanvasElement
  layerEffectRuntime: CanvasLayerEffectRuntime
  layerEffectContext: CanvasLayerEffectFrameContext
  layer: CanvasResolvedLayer
  source: DrawableSource
  mask: DrawableSource | null
  width: number
  height: number
  globalScale: number
  globalRotation: number
  globalOffsetX: number
  globalOffsetY: number
  alphaHierarchy: CanvasLayerAlphaHierarchy
  motionIntensity: number
}): void {
  const layerContext = layerCanvas.getContext('2d', { alpha: true })
  const maskContext = maskCanvas.getContext('2d', { alpha: true })
  if (!layerContext || !maskContext) return
  layerContext.setTransform(1, 0, 0, 1, 0, 0)
  layerContext.clearRect(0, 0, width, height)
  drawSource(layerContext, source, layer, width, height, globalScale, globalRotation, globalOffsetX, globalOffsetY, alphaHierarchy, motionIntensity)

  if (mask && layer.maskMode) {
    maskContext.setTransform(1, 0, 0, 1, 0, 0)
    maskContext.clearRect(0, 0, width, height)
    const maskLayer: CanvasResolvedLayer = {
      ...layer,
      opacity: 1,
      blendMode: 'source-over',
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      aspectBehavior: 'cover',
      effectChain: [],
      mirrorX: false,
      mirrorY: false,
    }
    drawSource(maskContext, mask, maskLayer, width, height, 1, 0, 0, 0, { drySourceAlpha: 1, processedAlpha: 0 })
    layerContext.save()
    layerContext.globalCompositeOperation = layer.maskMode.startsWith('inverted') ? 'destination-out' : 'destination-in'
    // Canvas2D luma masks degrade safely to the source alpha channel. This avoids
    // per-frame pixel reads and preserves deterministic performance on live video.
    layerContext.drawImage(maskCanvas, 0, 0)
    layerContext.restore()
  }
  const processedLayer = layer.userEffects?.length && layer.source
    ? layerEffectRuntime.render({
        layerId: layer.id,
        sourceIdentity: authoredSourceIdentity(layer.source),
        mediaType: layer.source.type,
        effects: layer.userEffects,
        source: layerCanvas,
        scratchA: effectScratchA,
        scratchB: effectScratchB,
        width,
        height,
        context: layerEffectContext,
      })
    : layerCanvas

  output.save()
  output.globalCompositeOperation = layer.blendMode
  output.globalAlpha = 1
  output.drawImage(processedLayer, 0, 0)
  output.restore()
}

function applyIncomingTransitionClip(
  context: CanvasRenderingContext2D,
  transitionId: CanvasTransitionId | null,
  progress: number,
  width: number,
  height: number,
): void {
  const p = Math.max(0, Math.min(1, progress))
  if (p >= 0.999 || !transitionId) return
  context.beginPath()
  switch (transitionId) {
    case 'radialWipe':
    case 'maskExpansion': {
      const radius = Math.hypot(width, height) * 0.55 * p
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2)
      context.clip()
      break
    }
    case 'tunnelWipe': {
      const revealWidth = width * p
      const revealHeight = height * p
      context.rect((width - revealWidth) / 2, (height - revealHeight) / 2, revealWidth, revealHeight)
      context.clip()
      break
    }
    case 'shapeReveal': {
      context.moveTo(width / 2, height * (0.5 - p * 0.5))
      context.lineTo(width * (0.5 + p * 0.5), height * (0.5 + p * 0.5))
      context.lineTo(width * (0.5 - p * 0.5), height * (0.5 + p * 0.5))
      context.closePath()
      context.clip()
      break
    }
    default:
      break
  }
}


function activeMedia(frame: CanvasResolvedPerformanceFrame): CanvasMediaItem[] {
  const byId = new Map<string, CanvasMediaItem>()
  for (const layer of frame.layers) if (layer.enabled && layer.source) byId.set(layer.source.id, layer.source)
  return [...byId.values()]
}

function authoredSourceIdentity(media: CanvasMediaItem): string {
  return `${media.id}:${media.type}:${media.mediaRevision ?? 0}:${media.objectUrl}`
}

function CanvasGenericOrchestrationStage({
  frame,
  preloadManager,
  engineSettings,
  presetSettings,
  isPlaying,
  isPaused,
  motionIntensity,
  selectedPresetId,
  onCanvasReady,
  onLiveFps,
  showStatus,
}: CanvasOrchestrationStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const transitionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const effectScratchARef = useRef<HTMLCanvasElement | null>(null)
  const effectScratchBRef = useRef<HTMLCanvasElement | null>(null)
  const layerEffectRuntimeRef = useRef<CanvasLayerEffectRuntime | null>(null)
  const previousIdentityRef = useRef<string | null>(null)
  const previousTransitionScopeRef = useRef(false)
  const qualityControllerRef = useRef(new CanvasShowAdaptiveQualityController())
  const [qualitySnapshot, setQualitySnapshot] = useState<CanvasShowQualitySnapshot | null>(null)
  const frameRef = useRef(frame)
  const propsRef = useRef({ isPlaying, isPaused, engineSettings, presetSettings, motionIntensity })
  const authoredSourceHandlesRef = useRef(new Map<string, { identity: string; handle: CanvasPreloadHandle }>())
  frameRef.current = frame
  propsRef.current = { isPlaying, isPaused, engineSettings, presetSettings, motionIntensity }

  const mediaSummary = useMemo(() => activeMedia(frame), [frame])
  const mediaErrors = frame.mediaErrors ?? []
  const selectedRendererKind = resolveCanvasPresetRendererKind(selectedPresetId)
  const outputContract = useMemo(() => resolveCanvasOutputContract({
    canvasOutputOpacity: engineSettings.opacity,
    presetSettings,
  }), [engineSettings.opacity, presetSettings])

  useEffect(() => {
    onCanvasReady?.(canvasRef.current)
    return () => onCanvasReady?.(null)
  }, [onCanvasReady])

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = shellRef.current
    if (!canvas || !shell) return
    const outputContext = canvas.getContext('2d', { alpha: true })
    if (!outputContext) return
    compositionCanvasRef.current ??= makeScratchCanvas()
    previousCanvasRef.current ??= makeScratchCanvas()
    transitionCanvasRef.current ??= makeScratchCanvas()
    layerCanvasRef.current ??= makeScratchCanvas()
    maskCanvasRef.current ??= makeScratchCanvas()
    effectScratchARef.current ??= makeScratchCanvas()
    effectScratchBRef.current ??= makeScratchCanvas()
    layerEffectRuntimeRef.current ??= new CanvasLayerEffectRuntime(makeScratchCanvas)
    const compositionCanvas = compositionCanvasRef.current
    const previousCanvas = previousCanvasRef.current
    const transitionCanvas = transitionCanvasRef.current
    const layerCanvas = layerCanvasRef.current
    const maskCanvas = maskCanvasRef.current
    const effectScratchA = effectScratchARef.current
    const effectScratchB = effectScratchBRef.current
    const layerEffectRuntime = layerEffectRuntimeRef.current
    if (!compositionCanvas || !previousCanvas || !transitionCanvas || !layerCanvas || !maskCanvas || !effectScratchA || !effectScratchB || !layerEffectRuntime) return
    const context = compositionCanvas.getContext('2d', { alpha: true })
    if (!context) return
    const laserCanvas = selectedRendererKind === 'laserImageFx' ? makeScratchCanvas() : null
    const laserCreateResult = laserCanvas ? LaserImageFxRenderer.create(laserCanvas) : null
    const laserRenderer = laserCreateResult?.renderer ?? null

    let animationFrame = 0
    let fpsFrames = 0
    let fpsStartedAt = performance.now()
    let previousDrawAt = fpsStartedAt
    let qualityPublishAt = fpsStartedAt
    const initialFrame = frameRef.current
    let quality = qualityControllerRef.current.reset(initialFrame.decoderCount)
    setQualitySnapshot(initialFrame.runtimeMode === 'show' ? quality : null)

    const draw = () => {
      const liveFrame = frameRef.current
      const liveProps = propsRef.current
      const rect = shell.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(rect.width || 1280))
      const cssHeight = Math.max(1, Math.round(rect.height || 720))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const outputWidth = Math.max(1, Math.round(cssWidth * dpr))
      const outputHeight = Math.max(1, Math.round(cssHeight * dpr))
      const now = performance.now()
      const adaptiveCompositionQuality = liveFrame.runtimeMode === 'show' || liveFrame.runtimeMode === 'authored'
      if (adaptiveCompositionQuality) {
        quality = qualityControllerRef.current.sample(now - previousDrawAt, liveFrame.decoderCount)
        if (liveFrame.runtimeMode === 'show' && now - qualityPublishAt >= 500) {
          setQualitySnapshot(quality)
          qualityPublishAt = now
        }
      }
      previousDrawAt = now
      const qualityScale = adaptiveCompositionQuality ? quality.scale : 1
      const compositionSize = adaptiveCompositionQuality
        ? resolveCanvasShowCompositionDimensions({ outputWidth, outputHeight, qualityScale })
        : { width: outputWidth, height: outputHeight }
      const width = compositionSize.width
      const height = compositionSize.height
      resizeCanvas(canvas, outputWidth, outputHeight)
      resizeCanvas(compositionCanvas, width, height)
      resizeCanvas(previousCanvas, width, height)
      resizeCanvas(transitionCanvas, width, height)
      resizeCanvas(layerCanvas, width, height)
      resizeCanvas(maskCanvas, width, height)
      resizeCanvas(effectScratchA, width, height)
      resizeCanvas(effectScratchB, width, height)

      const transitionLayerIds = liveFrame.runtimeMode === 'authored' && liveFrame.transitionLayerIds?.length
        ? new Set(liveFrame.transitionLayerIds)
        : null
      const scopedTransition = transitionLayerIds !== null
      if (previousIdentityRef.current && previousIdentityRef.current !== liveFrame.frameIdentity) {
        const previousContext = previousCanvas.getContext('2d', { alpha: true })
        previousContext?.clearRect(0, 0, width, height)
        if (scopedTransition === previousTransitionScopeRef.current) {
          previousContext?.drawImage(scopedTransition ? transitionCanvas : compositionCanvas, 0, 0)
        }
      }
      previousIdentityRef.current = liveFrame.frameIdentity
      previousTransitionScopeRef.current = scopedTransition

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, width, height)
      const transition = resolveCanvasTransitionVisualState(liveFrame.transition)
      const showDriven = liveFrame.runtimeMode === 'show'
      const liveOutputContract = showDriven
        ? { canvasOutputOpacity: 1, drySourceMix: 1, sourceMixMode: 'legacyComposite' as const }
        : resolveCanvasOutputContract({
            canvasOutputOpacity: liveProps.engineSettings.opacity,
            presetSettings: liveProps.presetSettings,
          })
      const layers = [...liveFrame.layers].filter(layer => layer.enabled && layer.sourceMediaId).sort((a, b) => a.zIndex - b.zIndex)
      layerEffectRuntime.reconcile(layers
        .filter(layer => Boolean(layer.userEffects?.length && layer.source))
        .map(layer => ({
          id: layer.id,
          sourceIdentity: layer.source ? authoredSourceIdentity(layer.source) : '',
          effects: layer.userEffects ?? [],
        })))
      const layerEffectContext: CanvasLayerEffectFrameContext = {
        bass: clamp01(liveFrame.context.bass),
        high: clamp01(liveFrame.context.high),
        beat: clamp01(Math.max(liveFrame.context.kickStrength, liveFrame.context.transient)),
        transient: clamp01(liveFrame.context.transient),
        bpm: Math.max(0, liveFrame.context.bpm),
        absoluteBeat: Math.max(0, liveFrame.context.absoluteBeat),
        audioTimeSec: Math.max(0, liveFrame.context.audioTimeSec),
        isPlaying: liveProps.isPlaying,
        isPaused: liveProps.isPaused,
      }
      const motion = Math.max(0, Math.min(1, liveProps.motionIntensity))
      const drawLayers = (
        output: CanvasRenderingContext2D,
        targetLayers: readonly CanvasResolvedLayer[],
        transitionOpacity: number,
        incomingScale: number,
        incomingRotation: number,
        incomingOffsetX: number,
        incomingOffsetY: number,
      ) => {
        for (const layer of targetLayers) {
          const managerHandle = layer.sourceMediaId ? preloadManager.getHandle(layer.sourceMediaId) : null
          const localEntry = layer.sourceMediaId ? authoredSourceHandlesRef.current.get(layer.sourceMediaId) ?? null : null
          const localHandle = layer.source && localEntry?.identity === authoredSourceIdentity(layer.source)
            ? localEntry.handle
            : null
          const handle = sourceReady(managerHandle)
            ? managerHandle
            : sourceReady(localHandle)
              ? localHandle
              : null
          if (!handle) continue
          if (isVideoHandle(handle)) syncVideo(handle, layer, liveProps.isPlaying, liveProps.isPaused)
          const maskHandle = layer.maskSourceMediaId ? preloadManager.getHandle(layer.maskSourceMediaId) : null
          const mask = sourceReady(maskHandle) ? maskHandle : null
          const authoredSourceComposition = liveFrame.runtimeMode === 'authored'
          const globalScale = showDriven
            ? 1
            : (1 + (incomingScale - 1) * motion) * (authoredSourceComposition ? 1 : liveProps.engineSettings.scale)
          const globalRotation = showDriven
            ? 0
            : incomingRotation * motion + (authoredSourceComposition ? 0 : liveProps.engineSettings.rotation)
          const globalOffsetX = showDriven
            ? 0
            : incomingOffsetX * motion + (authoredSourceComposition ? 0 : liveProps.engineSettings.positionX / 100)
          const globalOffsetY = showDriven
            ? 0
            : incomingOffsetY * motion + (authoredSourceComposition ? 0 : liveProps.engineSettings.positionY / 100)
          drawLayerWithOptionalMask({
            output,
            layerCanvas,
            maskCanvas,
            effectScratchA,
            effectScratchB,
            layerEffectRuntime,
            layerEffectContext,
            layer,
            source: handle,
            mask,
            width,
            height,
            globalScale,
            globalRotation,
            globalOffsetX,
            globalOffsetY,
            alphaHierarchy: resolveCanvasLayerAlphaHierarchy({
              layer,
              transitionOpacity,
              // Authored Layers mode first builds a full-strength source composition.
              // The selected CANVAS preset is applied once to that composite below.
              // This prevents reconstructive presets such as Laser Image FX from
              // leaving only their tiny dry-source contribution on screen.
              drySourceMix: liveFrame.runtimeMode === 'authored' ? 1 : liveOutputContract.drySourceMix,
              sourceMixMode: liveFrame.runtimeMode === 'authored' ? 'dryOnly' : liveOutputContract.sourceMixMode,
            }),
            motionIntensity: motion,
          })
        }
      }
      const drawOutgoingTransition = () => {
        if (transition.outgoingOpacity <= 0.001) return
        context.save()
        context.globalAlpha = transition.outgoingOpacity
        context.filter = transition.smear > 0.01 ? `blur(${(transition.smear * 8).toFixed(2)}px)` : 'none'
        context.translate(width * 0.5 + transition.outgoingOffsetX * width, height * 0.5 + transition.outgoingOffsetY * height)
        context.rotate(transition.outgoingRotation * Math.PI / 180)
        context.scale(transition.outgoingScale, transition.outgoingScale)
        context.drawImage(previousCanvas, -width / 2, -height / 2)
        if (transition.rgbSplit > 0.02) {
          const split = transition.rgbSplit * 16
          context.globalCompositeOperation = 'screen'
          context.globalAlpha = transition.outgoingOpacity * 0.22
          context.drawImage(previousCanvas, -width / 2 + split, -height / 2)
          context.drawImage(previousCanvas, -width / 2 - split, -height / 2)
        }
        context.restore()
      }
      const drawTransitionFlash = () => {
        if (transition.flash <= 0.01) return
        context.save()
        context.globalAlpha = Math.min(0.5, transition.flash * 0.45)
        context.fillStyle = '#fff'
        context.fillRect(0, 0, width, height)
        context.restore()
      }

      if (scopedTransition) {
        const transitionContext = transitionCanvas.getContext('2d', { alpha: true })
        transitionContext?.setTransform(1, 0, 0, 1, 0, 0)
        transitionContext?.clearRect(0, 0, width, height)
        const automaticLayers = layers.filter(layer => transitionLayerIds.has(layer.id))
        const fixedLayers = layers.filter(layer => !transitionLayerIds.has(layer.id))
        if (transitionContext) drawLayers(transitionContext, automaticLayers, 1, 1, 0, 0, 0)

        drawOutgoingTransition()
        context.save()
        applyIncomingTransitionClip(context, liveFrame.transition?.id ?? null, transition.clipProgress, width, height)
        context.globalAlpha = transition.incomingOpacity
        context.translate(
          width * 0.5 + transition.incomingOffsetX * motion * width,
          height * 0.5 + transition.incomingOffsetY * motion * height,
        )
        context.rotate(transition.incomingRotation * motion * Math.PI / 180)
        const incomingScale = 1 + (transition.incomingScale - 1) * motion
        context.scale(incomingScale, incomingScale)
        context.drawImage(transitionCanvas, -width / 2, -height / 2)
        context.restore()
        drawTransitionFlash()

        // Pool automation owns only the transient automatic sub-composition.
        // Draw pinned/manual layers last with neutral transition values so their
        // rendered geometry and opacity remain fixed throughout an automatic swap.
        drawLayers(context, fixedLayers, 1, 1, 0, 0, 0)
      } else {
        drawOutgoingTransition()
        context.save()
        applyIncomingTransitionClip(context, liveFrame.transition?.id ?? null, transition.clipProgress, width, height)
        drawLayers(
          context,
          layers,
          transition.incomingOpacity,
          transition.incomingScale,
          transition.incomingRotation,
          transition.incomingOffsetX,
          transition.incomingOffsetY,
        )
        context.restore()
      }

      if (liveFrame.feedbackPasses > 0) {
        context.save()
        context.globalCompositeOperation = 'screen'
        context.globalAlpha = 0.08 + liveProps.presetSettings.trailAmount * 0.12
        context.translate(width * 0.5, height * 0.5)
        context.scale(0.985, 0.985)
        context.drawImage(previousCanvas, -width / 2, -height / 2)
        context.restore()
      }
      if (!scopedTransition) drawTransitionFlash()

      outputContext.setTransform(1, 0, 0, 1, 0, 0)
      outputContext.clearRect(0, 0, outputWidth, outputHeight)
      outputContext.globalCompositeOperation = 'source-over'
      outputContext.globalAlpha = 1
      outputContext.filter = 'none'

      if (liveFrame.runtimeMode === 'authored') {
        const nowSec = liveFrame.context.audioTimeSec > 0
          ? liveFrame.context.audioTimeSec
          : now / 1000
        if (selectedRendererKind === 'laserImageFx') {
          const dryAlpha = liveOutputContract.drySourceMix * liveOutputContract.canvasOutputOpacity
          let renderedLaser = false
          if (laserRenderer && laserCanvas) {
            laserRenderer.resize(outputWidth, outputHeight)
            renderedLaser = laserRenderer.render({
              source: compositionCanvas,
              settings: liveProps.presetSettings,
              fitMode: liveProps.engineSettings.fitMode,
              sourceTransform: {
                scale: liveProps.engineSettings.scale,
                positionX: liveProps.engineSettings.positionX,
                positionY: liveProps.engineSettings.positionY,
                rotation: liveProps.engineSettings.rotation,
              },
              audio: {
                bass: clamp01(liveFrame.context.bass),
                mid: clamp01(liveFrame.context.mid),
                high: clamp01(liveFrame.context.high),
                beat: liveProps.isPlaying && !liveProps.isPaused
                  ? clamp01(Math.max(liveFrame.context.kickStrength, liveFrame.context.transient))
                  : 0,
                bpm: Math.max(0, liveFrame.context.bpm),
                absoluteBeat: Math.max(0, liveFrame.context.absoluteBeat),
              },
              timeSec: nowSec,
            })
          }

          // Match the single-source Laser Image FX contract: retain the configured
          // dry source underneath the processed GPU frame. If WebGL cannot render,
          // fall back to a fully visible source instead of an unusable 8% ghost.
          drawAuthoredPresetSource({
            context: outputContext,
            source: compositionCanvas,
            width: outputWidth,
            height: outputHeight,
            engineSettings: liveProps.engineSettings,
            alpha: (renderedLaser ? dryAlpha : liveOutputContract.canvasOutputOpacity),
          })
          if (renderedLaser && laserCanvas) {
            outputContext.save()
            outputContext.globalCompositeOperation = 'source-over'
            outputContext.globalAlpha = liveOutputContract.sourceMixMode === 'legacyComposite'
              ? liveOutputContract.drySourceMix * liveOutputContract.canvasOutputOpacity
              : liveOutputContract.canvasOutputOpacity
            outputContext.filter = 'none'
            outputContext.drawImage(laserCanvas, 0, 0, outputWidth, outputHeight)
            outputContext.restore()
          }
        } else {
          drawAuthoredStandardPreset({
            context: outputContext,
            source: compositionCanvas,
            width: outputWidth,
            height: outputHeight,
            engineSettings: liveProps.engineSettings,
            presetSettings: liveProps.presetSettings,
            outputOpacity: liveOutputContract.canvasOutputOpacity,
            performanceContext: liveFrame.context,
            isPlaying: liveProps.isPlaying,
            isPaused: liveProps.isPaused,
            nowSec,
          })
        }
      } else {
        outputContext.globalAlpha = liveOutputContract.canvasOutputOpacity
        outputContext.drawImage(compositionCanvas, 0, 0, outputWidth, outputHeight)
        outputContext.globalAlpha = 1
      }

      fpsFrames += 1
      if (now - fpsStartedAt >= 1000) {
        onLiveFps?.(fpsFrames * 1000 / (now - fpsStartedAt))
        fpsFrames = 0
        fpsStartedAt = now
      }
      animationFrame = window.requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.cancelAnimationFrame(animationFrame)
      layerEffectRuntime.dispose()
      laserRenderer?.dispose()
    }
  }, [onLiveFps, preloadManager, selectedRendererKind])

  const authoredSourceHosts = frame.runtimeMode === 'authored'
    ? mediaSummary.map(media => {
        const identity = authoredSourceIdentity(media)
        const adopt = (handle: CanvasPreloadHandle) => {
          if (!sourceReady(handle)) return
          authoredSourceHandlesRef.current.set(media.id, { identity, handle })
          preloadManager.adoptDrawableHandle(media, handle)
        }
        const sharedProps = {
          key: identity,
          crossOrigin: 'anonymous' as const,
          src: media.objectUrl,
          'data-canvas-authored-source': media.id,
          'aria-hidden': true,
          style: {
            position: 'absolute' as const,
            width: '1px',
            height: '1px',
            left: '-10000px',
            top: '-10000px',
            opacity: 0,
            pointerEvents: 'none' as const,
          },
        }
        return media.type === 'video'
          ? (
              <video
                {...sharedProps}
                muted
                playsInline
                preload="auto"
                onLoadedData={event => adopt(event.currentTarget)}
                onCanPlay={event => adopt(event.currentTarget)}
              />
            )
          : <img {...sharedProps} alt="" onLoad={event => adopt(event.currentTarget)} />
      })
    : null

  return (
    <div
      ref={shellRef}
      className="rv-canvas-engine-surface rv-canvas-orchestration-stage"
      role="region"
      aria-label="CANVAS orchestrated media surface"
      data-authored-preset-renderer={frame.runtimeMode === 'authored' ? selectedRendererKind : undefined}
    >
      {authoredSourceHosts}
      <canvas
        ref={canvasRef}
        className="rv-canvas-orchestration-canvas"
        data-output-opacity={outputContract.canvasOutputOpacity.toFixed(3)}
      />
      {showStatus !== false && <div className="rv-canvas-orchestration-status" role="status">
        <strong>{frame.showLabel} · {frame.template.label}</strong>
        <span>{frame.layers.filter(layer => layer.enabled).length} layers · {frame.decoderCount} video decoders · {mediaSummary.length} sources</span>
        {frame.anticipatoryStage !== 'none' && <span>Queued: {frame.anticipatoryStage}{frame.nextSectionType ? ` → ${frame.nextSectionType}` : ''}</span>}
        {frame.pendingMediaIds.length > 0 && <span>Preloading {frame.pendingMediaIds.length} upcoming source{frame.pendingMediaIds.length === 1 ? '' : 's'}</span>}
        {mediaErrors.length > 0 && (
          <span role="alert">
            Failed to load {mediaErrors.length} source{mediaErrors.length === 1 ? '' : 's'} · {mediaErrors[0]?.message}
          </span>
        )}
        {frame.runtimeMode === 'show' && qualitySnapshot && (
          <span data-testid="canvas-show-quality-diagnostics">
            Quality {qualitySnapshot.tier} · {Math.round(qualitySnapshot.scale * 100)}% composition · {qualitySnapshot.activeVideoCount} video{qualitySnapshot.activeVideoCount === 1 ? '' : 's'} · {qualitySnapshot.averageFrameMs.toFixed(1)}ms
            {qualitySnapshot.fallbackReason ? ` · ${qualitySnapshot.fallbackReason}` : ''}
          </span>
        )}
      </div>}
    </div>
  )
}

function CanvasFracturesOrchestrationStage({
  frame,
  preloadManager,
  engineSettings,
  presetSettings,
  selectedPresetId,
  trackIdentity,
  trackAnalysis,
  trackSections,
  getAudioTime,
  analyser,
  brandKit,
  isPlaying,
  isPaused,
  onCanvasReady,
  onLiveFps,
  showStatus,
}: CanvasOrchestrationStageProps) {
  const layer = frame.layers.find(candidate => isCanvasFracturesProcessor(candidate.processor)) ?? null
  const processor = layer?.processor && isCanvasFracturesProcessor(layer.processor) ? layer.processor : null
  const sourceHandle = layer?.sourceMediaId ? preloadManager.getHandle(layer.sourceMediaId) : null
  const sourceRef = useRef<CanvasFracturesSourceElement | null>(null)
  const performanceContextRef = useRef<SharedPerformanceContext | null>(frame.context)
  performanceContextRef.current = frame.context
  sourceRef.current = sourceReady(sourceHandle) ? sourceHandle : null

  const resolvedSettings = useMemo(() => resolveCanvasFracturesPresetSettings({
    selectedPresetId,
    userSettings: presetSettings,
    autoPerformance: frame.orchestrationActive,
    processor,
  }), [frame.orchestrationActive, presetSettings, processor, selectedPresetId])

  const source = layer?.source ?? null
  const sourceIdentity = source && processor
    ? `${source.id}:${source.type}:${source.mediaRevision ?? 0}`
    : 'canvas-fractures:pending'
  const active = Boolean(source && processor && sourceRef.current)

  return (
    <div
      className="rv-canvas-engine-surface rv-canvas-orchestration-stage rv-canvas-orchestration-stage--fractures"
      role="region"
      aria-label="CANVAS orchestrated Fractures surface"
      data-specialized-processor="fractures"
      data-logical-layer-count={frame.layers.length}
    >
      {source && processor && (
        <CanvasFracturesRendererLayer
          active={active}
          sourceRef={sourceRef}
          sourceIdentity={sourceIdentity}
          mediaType={source.type}
          mediaRevision={source.mediaRevision ?? 0}
          trackIdentity={trackIdentity}
          trackAnalysis={trackAnalysis}
          trackSections={trackSections}
          getAudioTime={getAudioTime}
          analyser={analyser}
          performanceContextRef={performanceContextRef}
          isPlaying={isPlaying}
          isPaused={isPaused}
          fitMode={engineSettings.fitMode}
          sourceTransform={{
            scale: engineSettings.scale,
            positionX: engineSettings.positionX,
            positionY: engineSettings.positionY,
            rotation: engineSettings.rotation,
          }}
          settings={resolvedSettings}
          brandKit={brandKit}
          outputOpacity={engineSettings.opacity * (layer?.opacity ?? 1)}
          orchestrationIdentity={processor.identity}
          sourcePlayback={layer?.playback ?? null}
          onCanvasReady={onCanvasReady}
          onLiveFps={onLiveFps}
        />
      )}
      {showStatus !== false && <div className="rv-canvas-orchestration-status" role="status">
        <strong>{frame.showLabel} · Fractures</strong>
        <span>1 logical layer · {frame.decoderCount} video decoder{frame.decoderCount === 1 ? '' : 's'} · internal fragment compositor</span>
        {!active && <span>Preloading the Fractures source</span>}
        {frame.anticipatoryStage !== 'none' && <span>Queued: {frame.anticipatoryStage}{frame.nextSectionType ? ` → ${frame.nextSectionType}` : ''}</span>}
      </div>}
    </div>
  )
}

export function CanvasOrchestrationStage(props: CanvasOrchestrationStageProps) {
  const fracturesLayer = props.frame.layers.find(layer => isCanvasFracturesProcessor(layer.processor))
  if (fracturesLayer) return <CanvasFracturesOrchestrationStage {...props} />
  return <CanvasGenericOrchestrationStage {...props} />
}
