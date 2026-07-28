import { useEffect, useMemo, useRef } from 'react'
import type { CanvasEngineSettings, CanvasMediaItem, CanvasPresetSettings } from '../ReactTypes'
import { resolveCanvasEffectVisualState } from './CanvasEffectRecipes'
import type { CanvasPreloadHandle, CanvasPreloadManager } from './CanvasPreloadManager'
import { resolveCanvasTransitionVisualState } from './CanvasTransitions'
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
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
}

type DrawableSource = CanvasImageSource & (HTMLVideoElement | HTMLImageElement)

function isVideoHandle(handle: CanvasPreloadHandle | null): handle is HTMLVideoElement {
  return typeof HTMLVideoElement !== 'undefined' && handle instanceof HTMLVideoElement
}

function isImageHandle(handle: CanvasPreloadHandle | null): handle is HTMLImageElement {
  return typeof HTMLImageElement !== 'undefined' && handle instanceof HTMLImageElement
}

function sourceReady(handle: CanvasPreloadHandle | null): handle is DrawableSource {
  if (isVideoHandle(handle)) return handle.readyState >= 2 && handle.videoWidth > 0 && handle.videoHeight > 0
  if (isImageHandle(handle)) return handle.complete && handle.naturalWidth > 0 && handle.naturalHeight > 0
  return false
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
    return
  }
  if (handle.paused) void handle.play().catch(() => undefined)
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
  const fitted = fitRect(sw, sh, width, height, layer.aspectBehavior)
  const effects = resolveCanvasEffectVisualState(layer.effectChain, motionIntensity)
  const x = width * (0.5 + layer.x * 0.5) + globalOffsetX * width
  const y = height * (0.5 + layer.y * 0.5) + globalOffsetY * height
  const scaleX = layer.scaleX * globalScale * (1 + effects.scaleBoost) * (layer.mirrorX ? -1 : 1)
  const scaleY = layer.scaleY * globalScale * (1 + effects.scaleBoost) * (layer.mirrorY ? -1 : 1)

  context.save()
  context.globalCompositeOperation = layer.blendMode
  context.globalAlpha = alphaHierarchy.drySourceAlpha
  context.translate(x + effects.offsetX, y + effects.offsetY)
  context.rotate((layer.rotation + globalRotation + effects.rotationDeg) * Math.PI / 180)
  context.scale(scaleX, scaleY)
  context.filter = 'none'
  if (alphaHierarchy.drySourceAlpha > 0.001) {
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
  output.save()
  output.globalCompositeOperation = layer.blendMode
  output.globalAlpha = 1
  output.drawImage(layerCanvas, 0, 0)
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

export function CanvasOrchestrationStage({
  frame,
  preloadManager,
  engineSettings,
  presetSettings,
  isPlaying,
  isPaused,
  motionIntensity,
  onCanvasReady,
  onLiveFps,
}: CanvasOrchestrationStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const previousIdentityRef = useRef<string | null>(null)
  const frameRef = useRef(frame)
  const propsRef = useRef({ isPlaying, isPaused, engineSettings, presetSettings, motionIntensity })
  frameRef.current = frame
  propsRef.current = { isPlaying, isPaused, engineSettings, presetSettings, motionIntensity }

  const mediaSummary = useMemo(() => activeMedia(frame), [frame])
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
    layerCanvasRef.current ??= makeScratchCanvas()
    maskCanvasRef.current ??= makeScratchCanvas()
    const compositionCanvas = compositionCanvasRef.current
    const previousCanvas = previousCanvasRef.current
    const layerCanvas = layerCanvasRef.current
    const maskCanvas = maskCanvasRef.current
    if (!compositionCanvas || !previousCanvas || !layerCanvas || !maskCanvas) return
    const context = compositionCanvas.getContext('2d', { alpha: true })
    if (!context) return

    let animationFrame = 0
    let fpsFrames = 0
    let fpsStartedAt = performance.now()

    const draw = () => {
      const liveFrame = frameRef.current
      const liveProps = propsRef.current
      const rect = shell.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(rect.width || 1280))
      const cssHeight = Math.max(1, Math.round(rect.height || 720))
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      const width = Math.max(1, Math.round(cssWidth * dpr))
      const height = Math.max(1, Math.round(cssHeight * dpr))
      resizeCanvas(canvas, width, height)
      resizeCanvas(compositionCanvas, width, height)
      resizeCanvas(previousCanvas, width, height)
      resizeCanvas(layerCanvas, width, height)
      resizeCanvas(maskCanvas, width, height)

      if (previousIdentityRef.current && previousIdentityRef.current !== liveFrame.frameIdentity) {
        const previousContext = previousCanvas.getContext('2d', { alpha: true })
        previousContext?.clearRect(0, 0, width, height)
        previousContext?.drawImage(compositionCanvas, 0, 0)
      }
      previousIdentityRef.current = liveFrame.frameIdentity

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, width, height)
      const transition = resolveCanvasTransitionVisualState(liveFrame.transition)
      if (transition.outgoingOpacity > 0.001) {
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

      context.save()
      applyIncomingTransitionClip(context, liveFrame.transition?.id ?? null, transition.clipProgress, width, height)
      const liveOutputContract = resolveCanvasOutputContract({
        canvasOutputOpacity: liveProps.engineSettings.opacity,
        presetSettings: liveProps.presetSettings,
      })
      const layers = [...liveFrame.layers].filter(layer => layer.enabled && layer.sourceMediaId).sort((a, b) => a.zIndex - b.zIndex)
      for (const layer of layers) {
        const handle = layer.sourceMediaId ? preloadManager.getHandle(layer.sourceMediaId) : null
        if (!sourceReady(handle)) continue
        if (isVideoHandle(handle)) syncVideo(handle, layer, liveProps.isPlaying, liveProps.isPaused)
        const maskHandle = layer.maskSourceMediaId ? preloadManager.getHandle(layer.maskSourceMediaId) : null
        const mask = sourceReady(maskHandle) ? maskHandle : null
        const motion = Math.max(0, Math.min(1, liveProps.motionIntensity))
        const globalScale = (1 + (transition.incomingScale - 1) * motion) * liveProps.engineSettings.scale
        const globalRotation = transition.incomingRotation * motion + liveProps.engineSettings.rotation
        const globalOffsetX = transition.incomingOffsetX * motion + liveProps.engineSettings.positionX / 100
        const globalOffsetY = transition.incomingOffsetY * motion + liveProps.engineSettings.positionY / 100
        drawLayerWithOptionalMask({
          output: context,
          layerCanvas,
          maskCanvas,
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
            transitionOpacity: transition.incomingOpacity,
            drySourceMix: liveOutputContract.drySourceMix,
            sourceMixMode: liveOutputContract.sourceMixMode,
          }),
          motionIntensity: motion,
        })
      }
      context.restore()

      if (liveFrame.feedbackPasses > 0) {
        context.save()
        context.globalCompositeOperation = 'screen'
        context.globalAlpha = 0.08 + liveProps.presetSettings.trailAmount * 0.12
        context.translate(width * 0.5, height * 0.5)
        context.scale(0.985, 0.985)
        context.drawImage(previousCanvas, -width / 2, -height / 2)
        context.restore()
      }
      if (transition.flash > 0.01) {
        context.save()
        context.globalAlpha = Math.min(0.5, transition.flash * 0.45)
        context.fillStyle = '#fff'
        context.fillRect(0, 0, width, height)
        context.restore()
      }

      outputContext.setTransform(1, 0, 0, 1, 0, 0)
      outputContext.clearRect(0, 0, width, height)
      outputContext.globalCompositeOperation = 'source-over'
      outputContext.globalAlpha = liveOutputContract.canvasOutputOpacity
      outputContext.filter = 'none'
      outputContext.drawImage(compositionCanvas, 0, 0)
      outputContext.globalAlpha = 1

      fpsFrames += 1
      const now = performance.now()
      if (now - fpsStartedAt >= 1000) {
        onLiveFps?.(fpsFrames * 1000 / (now - fpsStartedAt))
        fpsFrames = 0
        fpsStartedAt = now
      }
      animationFrame = window.requestAnimationFrame(draw)
    }

    draw()
    return () => window.cancelAnimationFrame(animationFrame)
  }, [onLiveFps, preloadManager])

  return (
    <div ref={shellRef} className="rv-canvas-engine-surface rv-canvas-orchestration-stage" role="region" aria-label="CANVAS orchestrated media surface">
      <canvas
        ref={canvasRef}
        className="rv-canvas-orchestration-canvas"
        data-output-opacity={outputContract.canvasOutputOpacity.toFixed(3)}
      />
      <div className="rv-canvas-orchestration-status" role="status">
        <strong>{frame.showLabel} · {frame.template.label}</strong>
        <span>{frame.layers.filter(layer => layer.enabled).length} layers · {frame.decoderCount} video decoders · {mediaSummary.length} sources</span>
        {frame.anticipatoryStage !== 'none' && <span>Queued: {frame.anticipatoryStage}{frame.nextSectionType ? ` → ${frame.nextSectionType}` : ''}</span>}
        {frame.pendingMediaIds.length > 0 && <span>Preloading {frame.pendingMediaIds.length} upcoming source{frame.pendingMediaIds.length === 1 ? '' : 's'}</span>}
      </div>
    </div>
  )
}
