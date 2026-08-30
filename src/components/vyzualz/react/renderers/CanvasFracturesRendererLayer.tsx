import { useEffect, useRef, useState, type RefObject } from 'react'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import type { BrandKit } from '../../../../features/personalization/BrandKitTypes'
import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type {
  CanvasFitMode,
  CanvasMediaItemType,
  CanvasPresetSettings,
  ReactTrackSection,
} from '../ReactTypes'
import { CanvasFracturesRenderer } from './fractures/CanvasFracturesRenderer'
import { CanvasFracturesRuntime } from './fractures/CanvasFracturesRuntime'
import { CanvasFracturesAudioAdapter } from './fractures/CanvasFracturesAudio'
import { CanvasFracturesAdaptiveQualityController, resolveCanvasFracturesQualityProfile } from './fractures/CanvasFracturesAdaptiveQuality'
import type {
  CanvasFracturesSourceElement,
  CanvasFracturesSourceTransform,
} from './fractures/CanvasFracturesTypes'

export interface CanvasFracturesRendererLayerProps {
  active: boolean
  sourceRef: RefObject<CanvasFracturesSourceElement | null>
  sourceIdentity: string
  mediaType: CanvasMediaItemType
  mediaRevision: number
  trackIdentity?: string | null
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackSections?: readonly ReactTrackSection[]
  getAudioTime?: () => number
  analyser?: AnalyserNode | null
  performanceContextRef?: RefObject<SharedPerformanceContext | null>
  isPlaying: boolean
  analysisActive?: boolean
  isPaused: boolean
  fitMode: CanvasFitMode
  sourceTransform: CanvasFracturesSourceTransform
  settings: CanvasPresetSettings
  brandKit?: Readonly<BrandKit> | null
  outputOpacity?: number
  orchestrationIdentity?: string | null
  sourcePlayback?: {
    playbackRate: number
    phaseSec: number
    loopRange: { startSec: number; endSec: number }
    frameHold: boolean
  } | null
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  onPreviewReady?: (ready: boolean) => void
  onStatusChange?: (message: string | null) => void
}

function finitePosition(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function syncOrchestratedSourcePlayback(
  source: CanvasFracturesSourceElement | null,
  playback: CanvasFracturesRendererLayerProps['sourcePlayback'],
  isPlaying: boolean,
  isPaused: boolean,
): void {
  if (!playback || typeof HTMLVideoElement === 'undefined' || !(source instanceof HTMLVideoElement)) return
  source.muted = true
  source.playsInline = true
  source.loop = false
  source.playbackRate = playback.playbackRate
  if (playback.loopRange.endSec > playback.loopRange.startSec && source.currentTime >= playback.loopRange.endSec - 0.035) {
    source.currentTime = playback.loopRange.startSec
  }
  if (!source.seeking && Math.abs(source.currentTime - playback.phaseSec) > 0.22) {
    try { source.currentTime = playback.phaseSec } catch { /* metadata may still be settling */ }
  }
  if (!isPlaying || isPaused || playback.frameHold) source.pause()
  else if (source.paused) void source.play().catch(() => undefined)
}

export function CanvasFracturesRendererLayer(props: CanvasFracturesRendererLayerProps) {
  const {
    active,
    sourceRef,
    sourceIdentity,
    mediaType,
    mediaRevision,
    trackIdentity,
    onPreviewReady,
    onStatusChange,
  } = props
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [rendererBackend, setRendererBackend] = useState<'webgl2' | 'canvas2d'>('canvas2d')
  const [rendererMode, setRendererMode] = useState<'auto' | 'canvas2d'>('auto')
  const livePropsRef = useRef(props)
  livePropsRef.current = props

  useEffect(() => {
    props.onCanvasReady?.(active ? canvasRef.current : null)
    return () => props.onCanvasReady?.(null)
  }, [active, props.onCanvasReady, rendererMode])

  useEffect(() => {
    const canvas = canvasRef.current
    onPreviewReady?.(false)
    onStatusChange?.(null)
    if (!active || !canvas) return

    const result = CanvasFracturesRenderer.create(canvas, { forceCanvas2D: rendererMode === 'canvas2d' })
    if (!result.renderer) {
      if (rendererMode === 'auto') {
        onStatusChange?.(`${result.error}. Retrying with a fresh Canvas2D surface.`)
        setRendererMode('canvas2d')
      } else {
        onStatusChange?.(result.error)
      }
      return
    }
    const renderer = result.renderer
    canvas.dataset.rendererBackend = renderer.backend
    setRendererBackend(renderer.backend)
    canvas.dataset.fracturesContextState = 'ready'
    if (rendererMode === 'canvas2d') {
      onStatusChange?.('Fractures recovered with the Canvas2D compatibility renderer after WebGL became unavailable.')
    } else if (renderer.backend === 'canvas2d') {
      onStatusChange?.('WebGL2 is unavailable. Fractures is using the Canvas2D compatibility renderer.')
    }
    const runtime = new CanvasFracturesRuntime()
    const audioAdapter = new CanvasFracturesAudioAdapter()
    const qualityController = new CanvasFracturesAdaptiveQualityController()
    let resolvedQuality = qualityController.reset(livePropsRef.current.settings.fractureQuality)
    let frameId = 0
    let previewReady = false
    let fallbackPositionSec = 0
    let previousFrameNowSec: number | null = null
    let previousFrameNowMs: number | null = null
    let lastQualityMode = livePropsRef.current.settings.fractureQuality
    let lastPlanIdentity = ''
    let fpsFrames = 0
    let fpsStartedAt = performance.now()
    let contextRecoveryStartedAtMs: number | null = null
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const draw = (frameNowMs = performance.now()) => {
      const live = livePropsRef.current
      if (renderer.health === 'failed') {
        onStatusChange?.('Fractures WebGL recovery failed. Switching to the Canvas2D compatibility renderer.')
        setRendererMode('canvas2d')
        return
      }
      if (renderer.health === 'recovering') {
        contextRecoveryStartedAtMs ??= frameNowMs
        canvas.dataset.fracturesContextState = 'recovering'
        if (frameNowMs - contextRecoveryStartedAtMs >= 1500) {
          onStatusChange?.('Fractures WebGL recovery timed out. Switching to the Canvas2D compatibility renderer.')
          setRendererMode('canvas2d')
          return
        }
        frameId = window.requestAnimationFrame(draw)
        return
      }
      if (contextRecoveryStartedAtMs !== null) {
        contextRecoveryStartedAtMs = null
        canvas.dataset.fracturesContextState = 'ready'
        onStatusChange?.(null)
        renderer.invalidateFeedback()
      }
      const frameMs = previousFrameNowMs === null ? 16.67 : Math.max(1, Math.min(100, frameNowMs - previousFrameNowMs))
      previousFrameNowMs = frameNowMs
      if (live.settings.fractureQuality !== lastQualityMode) {
        lastQualityMode = live.settings.fractureQuality
        resolvedQuality = qualityController.reset(lastQualityMode)
        renderer.invalidateFeedback()
      } else {
        const nextQuality = qualityController.sample(lastQualityMode, frameMs)
        if (nextQuality !== resolvedQuality) {
          resolvedQuality = nextQuality
          renderer.invalidateFeedback()
        }
      }
      const qualityProfile = resolveCanvasFracturesQualityProfile(resolvedQuality)
      canvas.dataset.fracturesRequestedQuality = lastQualityMode
      canvas.dataset.fracturesResolvedQuality = resolvedQuality
      const bounds = canvas.parentElement?.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.round(bounds?.width || 1280))
      const cssHeight = Math.max(1, Math.round(bounds?.height || 720))
      renderer.resize(cssWidth, cssHeight, Math.min(window.devicePixelRatio || 1, qualityProfile.dprCap))

      const frameNowSec = finitePosition(frameNowMs / 1000)
      const analysisActive = (live.analysisActive ?? live.isPlaying) && !live.isPaused
      if (previousFrameNowSec !== null && !live.trackIdentity && analysisActive) {
        fallbackPositionSec += Math.max(0, Math.min(0.25, frameNowSec - previousFrameNowSec))
      }
      previousFrameNowSec = frameNowSec
      const transportPositionSec = live.trackIdentity
        ? finitePosition(live.getAudioTime?.())
        : fallbackPositionSec
      const intelligenceFrame = AudioFeatureBus.getFrame()
      const frameMatchesTrack = Boolean(
        live.trackIdentity
        && (intelligenceFrame.trackId === live.trackIdentity || intelligenceFrame.sourceId === live.trackIdentity),
      )
      const performanceContext = live.performanceContextRef?.current ?? null
      const bpm = live.trackAnalysis?.bpm
        ?? (frameMatchesTrack && intelligenceFrame.rhythm.bpm > 0 ? intelligenceFrame.rhythm.bpm : null)
      const transitionBpm = performanceContext && performanceContext.bpm > 0
        ? performanceContext.bpm
        : (bpm ?? 0)
      const settings = live.settings
      syncOrchestratedSourcePlayback(live.sourceRef.current, live.sourcePlayback, live.isPlaying, live.isPaused)
      const audioFrame = audioAdapter.update({
        context: performanceContext,
        analyser: live.analyser,
        isPlaying: analysisActive,
        isPaused: live.isPaused,
        nowSec: frameNowSec,
        positionSec: transportPositionSec,
        trackIdentity: live.trackIdentity,
        controls: {
          audioResponse: settings.fractureAudioResponse,
          bassMotion: settings.fractureBassMotion,
          transientGlitch: settings.fractureTransientGlitch,
          structuralResponse: settings.fractureStructuralResponse,
          reducedMotion,
        },
      })
      if (audioFrame.resetReason) renderer.invalidateFeedback()
      const motionAmount = clamp01(settings.fractureMotionAmount)
      const motionAudio = {
        ...audioFrame.render,
        bassMotion: audioFrame.render.bassMotion * motionAmount,
        anchorBreathing: audioFrame.render.anchorBreathing * motionAmount,
        buildSeparation: audioFrame.render.buildSeparation * motionAmount,
        dropImpact: audioFrame.render.dropImpact * motionAmount,
      }
      const plan = runtime.resolveFrame({
        planInput: {
          presetId: 'canvas-fractures',
          sourceIdentity: live.sourceIdentity,
          mediaType: live.mediaType,
          mediaRevision: live.mediaRevision,
          trackIdentity: live.trackIdentity,
          variationSeed: settings.fractureVariationSeed,
          topologyRevision: settings.fractureTopologyRevision,
          layoutRevision: settings.fractureLayoutRevision,
          mode: settings.fractureMode,
          intensity: settings.fractureIntensity,
          focusProtection: settings.fractureFocusProtection,
          focusX: settings.fractureFocusX,
          focusY: settings.fractureFocusY,
          composition: settings.fractureComposition,
          placementMode: settings.fracturePlacementMode,
          quality: 'ultra',
          anchorMode: settings.fractureAnchorMode,
          returnToAnchor: settings.fractureReturnToAnchor,
          effectRoleWeights: settings.fractureEffectRoleWeights,
        },
        timelineInput: {
          positionSec: transportPositionSec,
          bpm,
          timeSignature: live.trackAnalysis?.timeSignature,
          beatGridOffsetSec: live.trackAnalysis?.beatGridOffsetSec,
          barMarkers: live.trackAnalysis?.barMarkers,
          sections: live.trackSections,
          topologyInterval: settings.fractureTopologyInterval,
          layoutInterval: settings.fractureLayoutInterval,
          freezeLayout: settings.fractureFreezeLayout,
          freezePositionSec: settings.fractureFreezePositionSec,
        },
        runtimeSettings: {
          topologyInterval: settings.fractureTopologyInterval,
          layoutInterval: settings.fractureLayoutInterval,
          freezeLayout: settings.fractureFreezeLayout,
          freezePositionSec: settings.fractureFreezePositionSec,
          topologyRevision: settings.fractureTopologyRevision,
          layoutRevision: settings.fractureLayoutRevision,
          returnToAnchor: settings.fractureReturnToAnchor,
          lastManualAction: settings.fractureLastManualAction,
          manualTransitionPositionSec: settings.fractureManualTransitionPositionSec,
          transitionMode: settings.fractureTransitionMode,
          transitionSpeed: settings.fractureTransitionSpeed,
          bpmSync: settings.fractureBpmSync,
          bpm: transitionBpm,
          staggerAmount: settings.fractureStaggerAmount,
          zoomAmount: settings.fractureZoomAmount,
        },
        structuralIdentity: settings.fractureFreezeLayout ? null : audioFrame.structure,
        isPlaying: analysisActive,
        isPaused: live.isPaused,
      })
      renderer.setPlan(plan)
      if (plan.id !== lastPlanIdentity) {
        lastPlanIdentity = plan.id
        canvas.dataset.fracturesPlanId = plan.id
        canvas.dataset.fracturesTopologyId = plan.topologyIdentity
        canvas.dataset.fracturesLayoutId = plan.layoutIdentity
        canvas.dataset.fracturesPlacementMode = plan.placementMode
        canvas.dataset.fracturesFragmentCount = String(plan.fragments.length)
        canvas.dataset.fracturesAnchorMode = plan.anchor.mode
        canvas.dataset.fracturesTransitionMode = plan.transition?.mode ?? 'settled'
        canvas.dataset.fracturesTransitionProgress = String(plan.transition?.progress ?? 1)
        canvas.dataset.fracturesReturnToAnchor = String(plan.returnToAnchor)
        canvas.dataset.fracturesEffectRoles = plan.fragments.map(fragment => fragment.effectRole).join(',')
      }
      const rendered = renderer.render({
        source: live.sourceRef.current,
        fitMode: live.fitMode,
        sourceTransform: {
          ...live.sourceTransform,
          scale: Math.max(0.01, live.sourceTransform.scale * (1 + motionAudio.anchorBreathing * 0.022)),
        },
        outputOpacity: live.outputOpacity ?? 1,
        framePositionSec: transportPositionSec,
        effects: {
          intensity: settings.fractureEffectsIntensity,
          glow: clamp01(settings.fractureGlowAmount
            + audioFrame.render.kickImpulse * 0.34
            + audioFrame.render.highShimmer * 0.08),
          glitch: clamp01(settings.fractureGlitchAmount
            + audioFrame.render.snareImpulse * 0.42
            + audioFrame.render.distortion * 0.3),
          texture: clamp01(settings.fractureTextureAmount
            + audioFrame.render.highShimmer * 0.2
            + audioFrame.render.distortion * 0.14),
          trails: settings.fractureTrailsAmount,
          depth: clamp01(settings.fractureDepthAmount + audioFrame.render.bassMotion * 0.38),
          duplication: settings.fractureDuplicationAmount,
          colorTreatment: settings.fractureColorTreatmentAmount,
          outlineIntensity: clamp01(settings.fractureOutlineAmount + audioFrame.render.highShimmer * 0.32),
          outlineThickness: settings.fractureOutlineThickness,
          bloomIntensity: clamp01(settings.fractureGlowAmount + audioFrame.render.kickImpulse * 0.5),
          rgbSplit: clamp01(settings.fractureRgbSplitAmount + audioFrame.render.snareImpulse * 0.55),
          lumaMode: settings.fractureLumaMode,
          lumaThreshold: settings.fractureLumaThreshold,
          displacement: clamp01(settings.fractureSliceDisplacementAmount
            + audioFrame.render.snareImpulse * 0.54
            + audioFrame.render.distortion * 0.34),
          pixelation: settings.fracturePixelationAmount,
          scanlines: clamp01(settings.fractureScanlineAmount + audioFrame.render.highShimmer * 0.44),
          noise: clamp01(settings.fractureNoiseAmount
            + audioFrame.render.highShimmer * 0.18
            + audioFrame.render.distortion * 0.34),
          quality: resolvedQuality,
          activeFragmentCap: qualityProfile.fragmentCap,
          colorSourceMode: settings.fractureColorSourceMode,
          manualPrimaryColor: settings.fractureManualPrimaryColor,
          manualSupportingColor: settings.fractureManualSupportingColor,
          flashTrigger: reducedMotion
            ? 0
            : Math.max(
                audioFrame.render.flash,
                Math.max(0, Math.min(1, 1 - (plan.transition?.progress ?? 1) / 0.18)),
              ),
          reducedMotion,
        },
        audio: motionAudio,
        brandKit: live.brandKit ?? null,
      })
      if (rendered && !previewReady) {
        previewReady = true
        onPreviewReady?.(true)
      }
      fpsFrames += 1
      if (frameNowMs - fpsStartedAt >= 1000) {
        live.onLiveFps?.(fpsFrames * 1000 / (frameNowMs - fpsStartedAt))
        fpsFrames = 0
        fpsStartedAt = frameNowMs
      }
      frameId = window.requestAnimationFrame(draw)
    }

    draw()
    return () => {
      window.cancelAnimationFrame(frameId)
      previousFrameNowMs = null
      runtime.clear()
      audioAdapter.reset()
      renderer.dispose()
      onPreviewReady?.(false)
      onStatusChange?.(null)
    }
  }, [active, mediaRevision, mediaType, onPreviewReady, onStatusChange, rendererMode, sourceIdentity, sourceRef, trackIdentity])

  if (!active) return null

  return (
    <canvas
      key={rendererMode}
      ref={canvasRef}
      className="rv-canvas-fractures-renderer-layer"
      data-renderer-kind="fragmentCollage"
      data-renderer-backend={rendererBackend}
      data-fractures-source-path={mediaType === 'video' ? 'video-frame' : mediaType === 'svg' ? 'svg-raster-image' : 'raster-image'}
      data-fractures-media-revision={mediaRevision}
      data-fractures-anchor-mode={props.settings.fractureAnchorMode}
      data-fractures-orchestration-identity={props.orchestrationIdentity ?? undefined}
      aria-hidden="true"
    />
  )
}
