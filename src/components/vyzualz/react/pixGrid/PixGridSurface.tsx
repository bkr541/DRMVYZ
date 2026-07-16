import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactPreset, ReactTrackSection } from '../ReactTypes'
import { useMediaStore } from '../../../../stores/mediaStore'
import { createLiveFpsReporter } from '../fpsDiagnostics'
import { acquireReactLiveEngineOwnership } from '../renderers/ReactLiveEngineOwnership'
import { applyCanvasResolution, resolveCanvasResolution, type CanvasResolution } from '../rendering/canvasResolution'
import {
  disposePixGridBaselineRenderer,
  renderPixGridCanvasFallback,
  type PixGridBaselineRenderFrame,
} from '../renderers/pixGrid/PixGridBaselineRenderer'
import { PixGridGpuRenderer } from '../renderers/pixGrid/PixGridGpuRenderer'
import { resolvePixGridFallbackResolution } from '../renderers/pixGrid/PixGridRenderMath'
import { createPixGridRendererLifecycle } from '../renderers/pixGrid/PixGridRendererLifecycle'
import type {
  PixGridQualityTier,
  PixGridRendererDiagnostics,
  PixGridState,
} from './PixGridTypes'
import { pixGridPreparedAssetCache, preparePixGridMediaAsset, type PixGridPreparedAsset } from './PixGridAssetPreparation'
import { inspectPixGridMediaCapability, resolvePixGridMediaRevision } from './PixGridMediaCapabilities'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { buildSharedPerformanceContext, createSharedPerformanceDiagnostics, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { createPixGridAudioFrame, PixGridReactionRuntime } from './PixGridAudioRouting'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import { resolvePixGridPerformanceFrame } from './PixGridPerformanceRuntime'
import { clearPixGridPerformanceRuntimeStatus, publishPixGridPerformanceRuntimeStatus } from './PixGridPerformanceStatus'
import { clearSharedPerformanceDiagnostics, publishSharedPerformanceDiagnostics } from '../SharedPerformanceDiagnosticsStore'
import {
  PixGridCueExecutionRuntime,
  resolvePixGridActionCueFrame,
  type PixGridActionCue,
  type PixGridResolvedTransition,
} from './PixGridActionCues'
import { clearPixGridCueRuntimeStatus, publishPixGridCueRuntimeStatus } from './PixGridCueStatus'
import { resolvePixGridMatrixDimensions } from './PixGridDefaults'
import {
  PixGridAdaptiveQualityController,
  resolvePixGridAdaptiveQualityProfile,
  type PixGridAdaptiveQualityProfile,
} from './PixGridAdaptiveQuality'

export interface PixGridSurfaceProps {
  analyser: AnalyserNode | null
  activePreset: ReactPreset | null
  pixGridState: PixGridState
  pixGridActionCues?: readonly PixGridActionCue[]
  intensity: number
  motion: number
  glow: number
  bassReactivity: number
  isPlaying: boolean
  isPaused?: boolean
  trackSections?: readonly ReactTrackSection[]
  trackAnalysis?: TrackIntelligenceAnalysis | null
  trackIdentity?: string | null
  durationSec?: number
  getAudioTime: () => number
  effectiveBpm?: number
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void
  onLiveFps?: (fps: number) => void
  onDiagnostics?: (diagnostics: PixGridRendererDiagnostics) => void
}

function canvasQuality(quality: PixGridQualityTier): 'low' | 'medium' | 'high' | 'ultra' {
  if (quality === 'draft') return 'low'
  if (quality === 'low') return 'medium'
  return quality
}



function resolveSectionScene(preset: ReactPreset, sections: readonly ReactTrackSection[], audioTime: number): string | null {
  const section = sections.find(candidate => audioTime >= candidate.startSec && audioTime < candidate.endSec)
  if (!section) return null
  return preset.sectionMappings.find(mapping => mapping.sectionType === section.type)?.sceneId ?? null
}

const EMPTY_DIAGNOSTICS: PixGridRendererDiagnostics = {
  path: 'canvas2d-fallback',
  logicalWidth: 96,
  logicalHeight: 54,
  presentationWidth: 0,
  presentationHeight: 0,
  fps: 0,
  logicalFramebufferAllocated: false,
  logicalAllocationCount: 0,
  contextState: 'unavailable',
  fallbackReason: null,
  approximateGpuResourceCount: 0,
}

function diagnosticsEqual(a: PixGridRendererDiagnostics, b: PixGridRendererDiagnostics): boolean {
  return a.path === b.path
    && a.logicalWidth === b.logicalWidth
    && a.logicalHeight === b.logicalHeight
    && a.presentationWidth === b.presentationWidth
    && a.presentationHeight === b.presentationHeight
    && a.fps === b.fps
    && a.logicalFramebufferAllocated === b.logicalFramebufferAllocated
    && a.logicalAllocationCount === b.logicalAllocationCount
    && a.contextState === b.contextState
    && a.fallbackReason === b.fallbackReason
    && a.approximateGpuResourceCount === b.approximateGpuResourceCount
    && a.requestedQuality === b.requestedQuality
    && a.effectiveQuality === b.effectiveQuality
    && a.adaptiveStage === b.adaptiveStage
    && a.adaptiveReason === b.adaptiveReason
    && a.preparedMediaCacheEntries === b.preparedMediaCacheEntries
    && a.preparedMediaCacheBytes === b.preparedMediaCacheBytes
}

export function PixGridSurface(props: PixGridSurfaceProps) {
  const gpuCanvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackCanvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  const requestRenderRef = useRef<(force?: boolean) => void>(() => {})
  const retryGpuRef = useRef<() => void>(() => {})
  const resizeRef = useRef<() => void>(() => {})
  const adaptiveControllerRef = useRef(new PixGridAdaptiveQualityController())
  const initialProfile = resolvePixGridAdaptiveQualityProfile(props.pixGridState.quality, props.pixGridState.qualityMode, 0)
  const adaptiveProfileRef = useRef<PixGridAdaptiveQualityProfile>(initialProfile)
  const runtimeQualityRef = useRef<PixGridQualityTier>(initialProfile.logicalQuality)
  const [runtimeQuality, setRuntimeQuality] = useState<PixGridQualityTier>(initialProfile.logicalQuality)
  const runtimeDimensions = resolvePixGridMatrixDimensions(runtimeQuality)
  const [diagnostics, setDiagnostics] = useState<PixGridRendererDiagnostics>(EMPTY_DIAGNOSTICS)
  const activeScene = props.pixGridState.scenes.find(scene => scene.id === props.pixGridState.selectedSceneId)
    ?? props.pixGridState.scenes[0]
  const mediaIds = useMemo(() => {
    const activeLayerIds = new Set(activeScene?.layerIds ?? [])
    const ids = props.pixGridState.layers.flatMap(layer => activeLayerIds.has(layer.id) && layer.mediaId ? [layer.mediaId] : [])
    if (props.pixGridState.conversion.selectedMediaId) ids.push(props.pixGridState.conversion.selectedMediaId)
    return [...new Set(ids)]
  }, [activeScene?.layerIds, props.pixGridState.conversion.selectedMediaId, props.pixGridState.layers])
  const mediaKey = mediaIds.join('|')
  const mediaItems = useMediaStore(state => state.items)
  const ensureMediaSigned = useMediaStore(state => state.ensureMediaSigned)
  const [preparedAssets, setPreparedAssets] = useState<ReadonlyMap<string, PixGridPreparedAsset>>(new Map())
  const [mediaPreparationStatus, setMediaPreparationStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
  const [mediaPreparationMessage, setMediaPreparationMessage] = useState<string | null>(null)
  const preparedAssetRef = useRef<ReadonlyMap<string, PixGridPreparedAsset>>(new Map())
  preparedAssetRef.current = preparedAssets
  const selectedMediaId = props.pixGridState.conversion.selectedMediaId
  const selectedMedia = selectedMediaId ? mediaItems.find(item => item.id === selectedMediaId) ?? null : null
  propsRef.current = props
  const hasActivePreset = props.activePreset != null

  useEffect(() => {
    adaptiveControllerRef.current.reset()
    const profile = resolvePixGridAdaptiveQualityProfile(props.pixGridState.quality, props.pixGridState.qualityMode, 0)
    adaptiveProfileRef.current = profile
    runtimeQualityRef.current = profile.logicalQuality
    setRuntimeQuality(profile.logicalQuality)
    resizeRef.current()
    requestRenderRef.current(true)
  }, [props.pixGridState.quality, props.pixGridState.qualityMode])

  useEffect(() => {
    if (mediaIds.length === 0 || !props.activePreset) {
      setPreparedAssets(new Map())
      setMediaPreparationStatus('idle')
      setMediaPreparationMessage(null)
      requestRenderRef.current(true)
      return
    }
    const requestedItems = mediaIds.map(id => mediaItems.find(item => item.id === id) ?? null)
    const missingId = mediaIds.find((_, index) => !requestedItems[index])
    if (missingId) {
      setPreparedAssets(new Map())
      setMediaPreparationStatus('missing')
      setMediaPreparationMessage('The selected Media Library item is missing or a referenced layer is temporarily unavailable. The project reference is preserved and will recover automatically.')
      requestRenderRef.current(true)
      return
    }
    const unsupported = requestedItems.find(item => item && !inspectPixGridMediaCapability(item).supported)
    if (unsupported) {
      setPreparedAssets(new Map())
      setMediaPreparationStatus('error')
      setMediaPreparationMessage(inspectPixGridMediaCapability(unsupported).reason)
      requestRenderRef.current(true)
      return
    }

    const controller = new AbortController()
    let active = true
    setMediaPreparationStatus('loading')
    setMediaPreparationMessage(`Preparing ${mediaIds.length} PixGrid media layer${mediaIds.length === 1 ? '' : 's'}…`)
    void (async () => {
      try {
        await ensureMediaSigned(mediaIds, 'visible')
        if (!active) return
        const currentItems = useMediaStore.getState().items
        const entries = await Promise.all(mediaIds.map(async mediaId => {
          const media = currentItems.find(item => item.id === mediaId) ?? requestedItems.find(item => item?.id === mediaId)
          if (!media) throw new Error('A PixGrid media layer is temporarily unavailable.')
          pixGridPreparedAssetCache.invalidateMedia(media.id, resolvePixGridMediaRevision(media))
          const prepared = await preparePixGridMediaAsset({
            media,
            width: runtimeDimensions.width,
            height: runtimeDimensions.height,
            settings: props.pixGridState.conversion,
            palette: props.activePreset!.palette,
            signal: controller.signal,
          })
          return [mediaId, prepared] as const
        }))
        if (!active) return
        setPreparedAssets(new Map(entries))
        setMediaPreparationStatus('ready')
        setMediaPreparationMessage(null)
        requestRenderRef.current(true)
      } catch (error) {
        if (!active || controller.signal.aborted) return
        setPreparedAssets(new Map())
        setMediaPreparationStatus('error')
        setMediaPreparationMessage(error instanceof Error ? error.message : 'PixGrid could not prepare the selected media.')
        requestRenderRef.current(true)
      }
    })()
    return () => {
      active = false
      controller.abort()
    }
  }, [
    ensureMediaSigned,
    mediaIds,
    mediaItems,
    mediaKey,
    props.activePreset,
    props.pixGridState.conversion,
    runtimeDimensions.height,
    runtimeDimensions.width,
  ])

  useEffect(() => {
    const gpuCanvas = gpuCanvasRef.current
    const fallbackCanvas = fallbackCanvasRef.current
    const preset = propsRef.current.activePreset
    if (!gpuCanvas || !fallbackCanvas || !preset) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }

    const fallbackContext = fallbackCanvas.getContext('2d', { alpha: false })
    const logicalCanvas = document.createElement('canvas')
    const logicalContext = logicalCanvas.getContext('2d', { alpha: true })
    if (!fallbackContext || !logicalContext) {
      propsRef.current.onCanvasReady?.(null)
      propsRef.current.onLiveFps?.(0)
      return
    }

    let resolution: CanvasResolution | null = null
    let previousPerformanceContext: SharedPerformanceContext | null = null
    let lastAudioTime = 0
    const fallbackReactionRuntime = new PixGridReactionRuntime()
    const cueExecutionRuntime = new PixGridCueExecutionRuntime()
    let animationFrame = 0
    let gpuRenderer: PixGridGpuRenderer | null = null
    let activePath: PixGridRendererDiagnostics['path'] = 'canvas2d-fallback'
    let fallbackReason: string | null = null
    let forcedRender = false
    let frameCount = 0
    let fpsWindowStarted = performance.now()
    let lastFps = 0
    let lastDiagnostics = EMPTY_DIAGNOSTICS
    let mounted = true
    let gpuRetryAttempts = 0
    let gpuRetryTimer: ReturnType<typeof setTimeout> | null = null
    let createGpuRenderer: () => void = () => {}

    const fpsReporter = createLiveFpsReporter(() => propsRef.current.onLiveFps)

    const publishDiagnostics = (next: PixGridRendererDiagnostics) => {
      const profile = adaptiveProfileRef.current
      const enriched: PixGridRendererDiagnostics = {
        ...next,
        requestedQuality: propsRef.current.pixGridState.quality,
        effectiveQuality: profile.logicalQuality,
        adaptiveStage: profile.stage,
        adaptiveReason: profile.reason,
        preparedMediaCacheEntries: pixGridPreparedAssetCache.size,
        preparedMediaCacheBytes: pixGridPreparedAssetCache.approximateBytes,
      }
      lastDiagnostics = enriched
      propsRef.current.onDiagnostics?.(enriched)
      if (mounted) setDiagnostics(previous => diagnosticsEqual(previous, enriched) ? previous : enriched)
    }

    const activatePath = (path: PixGridRendererDiagnostics['path'], reason: string | null) => {
      activePath = path
      fallbackReason = reason
      gpuCanvas.hidden = path !== 'webgl2'
      fallbackCanvas.hidden = path !== 'canvas2d-fallback'
      propsRef.current.onCanvasReady?.(path === 'webgl2' ? gpuCanvas : fallbackCanvas)
    }

    const clearGpuRetry = () => {
      if (gpuRetryTimer != null) clearTimeout(gpuRetryTimer)
      gpuRetryTimer = null
    }

    const scheduleGpuRetry = () => {
      if (gpuRetryTimer != null || !mounted) return
      const delays = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000] as const
      const delay = delays[Math.min(gpuRetryAttempts, delays.length - 1)]
      gpuRetryAttempts += 1
      gpuRetryTimer = setTimeout(() => {
        gpuRetryTimer = null
        if (mounted) createGpuRenderer()
      }, delay)
    }

    const currentFrameInput = (): {
      frame: PixGridBaselineRenderFrame
      state: PixGridState
      blackout: boolean
      preset: ReactPreset
      transition: PixGridResolvedTransition | null
    } | null => {
      const current = propsRef.current
      const activePreset = current.activePreset
      if (!activePreset) return null
      const shouldAnimate = current.isPlaying && !current.isPaused
      const intelligenceFrame = AudioFeatureBus.getFrame()
      const sampledAudioTime = shouldAnimate ? current.getAudioTime() : lastAudioTime
      const audioTime = Number.isFinite(sampledAudioTime) ? Math.max(0, sampledAudioTime) : lastAudioTime
      const deltaTimeSec = shouldAnimate ? Math.max(0, Math.min(0.25, audioTime - lastAudioTime)) : 0
      const context = buildSharedPerformanceContext({
        audioTimeSec: audioTime,
        frame: intelligenceFrame,
        analysis: current.trackAnalysis ?? null,
        resolvedSections: current.trackSections ?? intelligenceFrame.resolvedSections ?? null,
        durationSec: current.durationSec,
        trackIdentity: current.trackIdentity ?? intelligenceFrame.trackId ?? intelligenceFrame.sourceId,
        previous: previousPerformanceContext,
      })
      previousPerformanceContext = context
      lastAudioTime = audioTime
      const audioFrame = createPixGridAudioFrame(context, { isPlaying: shouldAnimate, deltaTimeSec })
      const qualityProfile = adaptiveProfileRef.current
      const runtimeState: PixGridState = {
        ...current.pixGridState,
        matrixWidth: qualityProfile.logicalWidth,
        matrixHeight: qualityProfile.logicalHeight,
        glowAmount: current.pixGridState.glowAmount * qualityProfile.glowScale,
        diffusion: current.pixGridState.diffusion * qualityProfile.diffusionScale,
        rgbSubpixelMode: current.pixGridState.rgbSubpixelMode && qualityProfile.rgbSubpixelEnabled,
        diagnostics: {
          ...current.pixGridState.diagnostics,
          showMatrixBounds: current.pixGridState.diagnostics.showMatrixBounds && qualityProfile.diagnosticsEnabled,
        },
      }
      const selectedSceneId = resolveSectionScene(activePreset, current.trackSections ?? intelligenceFrame.resolvedSections ?? [], audioTime)
      const mappedState = selectedSceneId
        ? { ...runtimeState, selectedSceneId }
        : runtimeState
      const performance = resolvePixGridPerformanceFrame(mappedState, context, activePreset.id)
      const cueFrame = resolvePixGridActionCueFrame(
        performance.state,
        current.pixGridActionCues ?? [],
        audioTime,
        { trackId: current.trackIdentity ?? null, runtime: cueExecutionRuntime },
      )
      const state = cueFrame.state
      publishPixGridPerformanceRuntimeStatus(performance.snapshot)
      publishPixGridCueRuntimeStatus(cueFrame.snapshot)
      publishSharedPerformanceDiagnostics(createSharedPerformanceDiagnostics(context, {
        engine: 'pixGrid',
        active: performance.snapshot.active || cueFrame.snapshot.active,
        performanceShow: performance.snapshot.programName,
        scene: state.selectedSceneId ?? performance.snapshot.sceneId,
        motifOrComposition: performance.snapshot.variationId,
        activeLayers: state.layers.filter(layer => layer.visible).map(layer => layer.id),
        activeEventEnvelopes: performance.snapshot.recentActionReasons.filter(reason => ['beat', 'downbeat', 'kick', 'snare', 'hat', 'transient', 'semanticMoment'].includes(reason)),
        recentActions: [
          ...performance.snapshot.recentActionTypes,
          ...cueFrame.snapshot.activeCueIds.map(id => `cue:${id}`),
        ].slice(-16),
        continuousRoutes: state.groups.filter(group => group.enabled).map(group => group.id),
        lockedParameters: [...new Set([...performance.snapshot.manualOverrideRoutes, ...cueFrame.snapshot.manualOverrideRoutes])],
        fallbackState: performance.snapshot.fallbackState,
        resourceLimitDecisions: performance.actionLimitDecisions,
      }))
      return {
        preset: activePreset,
        state,
        transition: cueFrame.transition as PixGridResolvedTransition | null,
        blackout: !shouldAnimate && state.stoppedBehavior === 'blackout',
        frame: {
          width: activePath === 'webgl2' ? gpuCanvas.width : fallbackCanvas.width,
          height: activePath === 'webgl2' ? gpuCanvas.height : fallbackCanvas.height,
          ...audioFrame,
          motion: current.motion,
          intensity: current.intensity,
          glow: current.glow,
          bassReactivity: current.bassReactivity,
        },
      }
    }

    const renderFallback = (input: NonNullable<ReturnType<typeof currentFrameInput>>) => {
      const frame = input.blackout
        ? { ...input.frame, intensity: 0 }
        : input.frame
      const fallbackState = input.blackout
        ? { ...input.state, backgroundMode: 'black' as const, backgroundBrightness: 0 }
        : input.state
      const fallbackLogical = renderPixGridCanvasFallback(
        fallbackContext,
        { canvas: logicalCanvas, context: logicalContext },
        frame,
        input.preset,
        fallbackState,
        preparedAssetRef.current,
        fallbackReactionRuntime,
        input.transition,
      )
      publishDiagnostics({
        path: 'canvas2d-fallback',
        logicalWidth: fallbackLogical.logicalWidth,
        logicalHeight: fallbackLogical.logicalHeight,
        presentationWidth: fallbackCanvas.width,
        presentationHeight: fallbackCanvas.height,
        fps: lastFps,
        logicalFramebufferAllocated: false,
        logicalAllocationCount: 0,
        contextState: gpuRenderer?.diagnostics.contextState ?? 'unavailable',
        fallbackReason,
        approximateGpuResourceCount: gpuRenderer?.diagnostics.approximateGpuResourceCount ?? 0,
        activeGroupMaskCount: input.state.groups.filter(group => group.enabled).length,
        groupMaskUploadCount: gpuRenderer?.diagnostics.groupMaskUploadCount ?? 0,
        groupMaskApproximateBytes: gpuRenderer?.diagnostics.groupMaskApproximateBytes ?? 0,
      })
    }

    const requestRender = (force = false) => {
      forcedRender = forcedRender || force
      if (animationFrame || lifecycle.disposed || !ownership.isCurrent()) return
      if (propsRef.current.isPaused && !forcedRender) return
      animationFrame = requestAnimationFrame(render)
      lifecycle.setAnimationFrame(animationFrame)
    }

    const render = (now: number) => {
      animationFrame = 0
      if (lifecycle.disposed || !ownership.isCurrent()) return
      const force = forcedRender
      forcedRender = false
      const current = propsRef.current
      if (current.isPaused && !force) {
        lastFps = 0
        fpsReporter.unavailable()
        publishDiagnostics({ ...lastDiagnostics, fps: 0 })
        return
      }

      const input = currentFrameInput()
      if (!input) return
      let rendered = false
      if (activePath === 'webgl2' && gpuRenderer?.isReady) {
        try {
          rendered = gpuRenderer.render({
            frame: input.frame,
            preset: input.preset,
            state: input.blackout
              ? { ...input.state, backgroundMode: 'black', backgroundBrightness: 0 }
              : input.state,
            presentationWidth: gpuCanvas.width,
            presentationHeight: gpuCanvas.height,
            blackout: input.blackout,
            preparedAsset: preparedAssetRef.current,
            transition: input.transition,
          })
          if (rendered) {
            const gpuDiagnostics = gpuRenderer.diagnostics
            publishDiagnostics({ ...gpuDiagnostics, fps: lastFps })
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          gpuRenderer.dispose()
          gpuRenderer = null
          activatePath('canvas2d-fallback', `PixGrid GPU rendering failed temporarily: ${reason}`)
          scheduleGpuRetry()
        }
      }
      if (!rendered) {
        if (activePath !== 'canvas2d-fallback') {
          activatePath('canvas2d-fallback', fallbackReason ?? 'The PixGrid GPU renderer is temporarily unavailable.')
        }
        try {
          renderFallback(input)
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          fallbackReason = `PixGrid transition allocation failed; rendering the stable frame instead: ${reason}`
          renderFallback({ ...input, transition: null })
        }
      }

      frameCount += 1
      const elapsed = now - fpsWindowStarted
      if (elapsed >= 1000) {
        lastFps = current.isPlaying ? Math.round(frameCount * 1000 / elapsed) : 0
        fpsReporter.report(lastFps)
        frameCount = 0
        fpsWindowStarted = now
        if (current.isPlaying && !current.isPaused) {
          const previousProfile = adaptiveProfileRef.current
          const nextProfile = adaptiveControllerRef.current.sample({
            fps: lastFps,
            nowMs: now,
            requestedQuality: current.pixGridState.quality,
            mode: current.pixGridState.qualityMode,
          })
          if (nextProfile.stage !== previousProfile.stage || nextProfile.logicalQuality !== previousProfile.logicalQuality) {
            adaptiveProfileRef.current = nextProfile
            if (nextProfile.logicalQuality !== runtimeQualityRef.current) {
              runtimeQualityRef.current = nextProfile.logicalQuality
              setRuntimeQuality(nextProfile.logicalQuality)
              resizeRef.current()
            }
            requestRender(true)
          }
        }
        publishDiagnostics({ ...lastDiagnostics, fps: lastFps })
      }
      if (current.isPlaying && !current.isPaused) requestRender()
      else fpsReporter.unavailable()
    }

    createGpuRenderer = () => {
      gpuRenderer?.dispose()
      gpuRenderer = null
      const result = PixGridGpuRenderer.create(gpuCanvas, {
        onContextLost: () => {
          activatePath('canvas2d-fallback', 'PixGrid WebGL context was lost. Canvas2D fallback is active while recovery is attempted.')
          scheduleGpuRetry()
          requestRender(true)
        },
        onContextRestored: () => {
          clearGpuRetry()
          gpuRetryAttempts = 0
          activatePath('webgl2', null)
          requestRender(true)
        },
        onContextRestoreFailed: reason => {
          activatePath('canvas2d-fallback', `PixGrid context restoration failed: ${reason}`)
          scheduleGpuRetry()
          requestRender(true)
        },
      })
      if (result.renderer) {
        clearGpuRetry()
        gpuRetryAttempts = 0
        gpuRenderer = result.renderer
        activatePath('webgl2', null)
        publishDiagnostics({
          ...result.renderer.diagnostics,
          presentationWidth: gpuCanvas.width,
          presentationHeight: gpuCanvas.height,
          fps: lastFps,
        })
      } else {
        activatePath('canvas2d-fallback', result.error)
        const fallbackResolution = resolvePixGridFallbackResolution(runtimeQualityRef.current)
        publishDiagnostics({
          path: 'canvas2d-fallback',
          logicalWidth: fallbackResolution.width,
          logicalHeight: fallbackResolution.height,
          presentationWidth: fallbackCanvas.width,
          presentationHeight: fallbackCanvas.height,
          fps: lastFps,
          logicalFramebufferAllocated: false,
          logicalAllocationCount: 0,
          contextState: 'unavailable',
          fallbackReason: result.error,
          approximateGpuResourceCount: 0,
        })
        scheduleGpuRetry()
      }
      requestRender()
    }

    const resize = () => {
      const bounds = gpuCanvas.getBoundingClientRect()
      const next = resolveCanvasResolution({
        cssWidth: bounds.width,
        cssHeight: bounds.height,
        devicePixelRatio: window.devicePixelRatio,
        quality: canvasQuality(runtimeQualityRef.current),
        previous: resolution,
      })
      if (!next.valid) return
      applyCanvasResolution(gpuCanvas, next)
      applyCanvasResolution(fallbackCanvas, next)
      resolution = next
      requestRender()
    }

    const lifecycle = createPixGridRendererLifecycle(() => {
      mounted = false
      clearGpuRetry()
      gpuRenderer?.dispose()
      gpuRenderer = null
      disposePixGridBaselineRenderer()
      propsRef.current.onCanvasReady?.(null)
      fpsReporter.unavailable()
      propsRef.current.onDiagnostics?.({ ...lastDiagnostics, fps: 0 })
      requestRenderRef.current = () => {}
      retryGpuRef.current = () => {}
      resizeRef.current = () => {}
      clearPixGridPerformanceRuntimeStatus()
      clearPixGridCueRuntimeStatus()
      clearSharedPerformanceDiagnostics('pixGrid')
    })
    const ownership = acquireReactLiveEngineOwnership('pixGrid', () => lifecycle.dispose())

    requestRenderRef.current = requestRender
    retryGpuRef.current = () => {
      clearGpuRetry()
      gpuRetryAttempts = 0
      createGpuRenderer()
    }
    resizeRef.current = resize
    const observer = new ResizeObserver(resize)
    lifecycle.setResizeObserver(observer)
    observer.observe(gpuCanvas)
    resize()
    createGpuRenderer()
    ownership.markStable()

    return () => ownership.retire('unmount')
  }, [hasActivePreset])

  useEffect(() => {
    requestRenderRef.current()
  }, [
    props.activePreset,
    props.bassReactivity,
    props.glow,
    props.intensity,
    props.isPaused,
    props.isPlaying,
    props.motion,
    props.pixGridState,
    props.pixGridActionCues,
    props.trackSections,
    props.trackAnalysis,
    props.trackIdentity,
    props.durationSec,
    preparedAssets,
  ])

  const fallbackActive = diagnostics.path === 'canvas2d-fallback'
  return (
    <div
      className="rv-pix-grid-surface-host"
      role="img"
      aria-label={props.activePreset ? `PixGrid visualization: ${props.activePreset.name}` : 'PixGrid visualization'}
      data-authoring={props.pixGridState.authoringOverlayVisible ? 'true' : undefined}
      data-pix-grid-matrix={`${props.pixGridState.matrixWidth}x${props.pixGridState.matrixHeight}`}
      data-pix-grid-runtime-matrix={`${diagnostics.logicalWidth}x${diagnostics.logicalHeight}`}
      data-pix-grid-quality={`${diagnostics.requestedQuality ?? props.pixGridState.quality}:${diagnostics.effectiveQuality ?? runtimeQuality}`}
      data-pix-grid-adaptive-stage={diagnostics.adaptiveStage ?? 0}
      data-pix-grid-renderer={diagnostics.path}
      data-pix-grid-context={diagnostics.contextState}
      data-pix-grid-presentation={`${diagnostics.presentationWidth}x${diagnostics.presentationHeight}`}
      data-pix-grid-resources={diagnostics.approximateGpuResourceCount}
      data-pix-grid-media-status={mediaPreparationStatus}
      data-pix-grid-media-revision={selectedMedia ? resolvePixGridMediaRevision(selectedMedia) : undefined}
    >
      <canvas
        ref={gpuCanvasRef}
        className="rv-preview-canvas rv-pix-grid-surface rv-pix-grid-surface--gpu"
        hidden={fallbackActive}
      />
      <canvas
        ref={fallbackCanvasRef}
        className="rv-preview-canvas rv-pix-grid-surface rv-pix-grid-surface--fallback"
        hidden={!fallbackActive}
      />
      {selectedMediaId && mediaPreparationMessage && (
        <div className="rv-pix-grid-diagnostic rv-pix-grid-diagnostic--media" role="status" aria-live="polite">
          <span>{mediaPreparationMessage}</span>
        </div>
      )}
      {fallbackActive && diagnostics.fallbackReason && (
        <div className="rv-pix-grid-diagnostic" role="status" aria-live="polite">
          <span>{diagnostics.fallbackReason}</span>
          <button type="button" onClick={() => retryGpuRef.current()}>Retry GPU</button>
        </div>
      )}
    </div>
  )
}
