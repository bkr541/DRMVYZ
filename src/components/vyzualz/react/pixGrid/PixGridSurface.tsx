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
import type { PixGridAudioFrame, PixGridDiscreteAudioSource, PixGridQualityTier, PixGridRendererDiagnostics, PixGridState } from './PixGridTypes'
import { pixGridPreparedAssetCache, preparePixGridMediaAsset, type PixGridPreparedAsset } from './PixGridAssetPreparation'
import { inspectPixGridMediaCapability, resolvePixGridMediaRevision } from './PixGridMediaCapabilities'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { MusicIntelligenceAnalyserFramePump } from '../../../../features/musicIntelligence/MusicIntelligenceAnalyserFramePump'
import { resolvePixGridBusMusicIntelligenceFrame } from './PixGridMusicIntelligenceFrame'
import {
  buildSharedPerformanceContext,
  createSharedPerformanceDiagnostics,
  type SharedPerformanceContext,
} from '../../../../features/performanceCore'
import { createPixGridAudioFrame, createSilentPixGridAudioFrame, PixGridReactionRuntime } from './PixGridAudioRouting'
import type { TrackIntelligenceAnalysis } from '../../../../features/musicIntelligence/types'
import { clearPixGridPerformanceRuntimeStatus, publishPixGridPerformanceRuntimeStatus } from './PixGridPerformanceStatus'
import { clearSharedPerformanceDiagnostics, publishSharedPerformanceDiagnostics } from '../SharedPerformanceDiagnosticsStore'
import { type PixGridActionCue, type PixGridResolvedTransition } from './PixGridActionCues'
import { clearPixGridCueRuntimeStatus, publishPixGridCueRuntimeStatus } from './PixGridCueStatus'
import {
  clearPixGridPreviewSource,
  clearPixGridReactivityRuntimeStatus,
  getPixGridPreviewSource,
  publishPixGridAudioAnalysis,
  publishPixGridRendererDiagnostics,
} from './PixGridReactivityStatus'
import {
  mergePixGridReactionRuntimeDiagnostics,
  PixGridUnifiedPerformanceRuntime,
  type PixGridUnifiedRuntimeDiagnostics,
} from './PixGridUnifiedPerformanceRuntime'
import type { PixGridGroupFrameEffect } from './PixGridFrameEffects'
import { PixGridFrameGroupCompiler } from './PixGridGroupCompiler'
import { resolvePixGridMatrixDimensions } from './PixGridDefaults'
import {
  PixGridAdaptiveQualityController,
  resolvePixGridAdaptiveQualityProfile,
  type PixGridAdaptiveQualityProfile,
} from './PixGridAdaptiveQuality'
import { validatePixGridState } from './PixGridValidationAudit'
import {
  PixGridPerceptualResponseTracker,
  resolvePixGridTruthfulReactivityStatus,
  type PixGridPerceptualResponseMetrics,
  type PixGridTruthfulReactivityStatus,
} from './PixGridPerceptualResponse'
import { pixGridMaskHasCell, type PixGridCompiledMask } from './PixGridGroups'
import type { PixGridLogicalFrame } from './PixGridCompositor'
import {
  applyPixGridBassGainToPerformanceContext,
  PixGridMotionClock,
  applyPixGridRuntimeControls,
} from './PixGridRuntimeControls'
import { resolvePixGridPresentation, resolvePixGridPublishedQuality } from './PixGridPresentation'

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
  /** React-visible playhead used to schedule deterministic paused seek frames. */
  audioTimeSec?: number
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

function normalizedControl(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function resolveSectionScene(preset: ReactPreset, sections: readonly ReactTrackSection[], audioTime: number): string | null {
  const section = sections.find((candidate) => audioTime >= candidate.startSec && audioTime < candidate.endSec)
  if (!section) return null
  return preset.sectionMappings.find((mapping) => mapping.sectionType === section.type)?.sceneId ?? null
}

const PREVIEW_EVENT_FLAGS: Partial<Record<PixGridDiscreteAudioSource, keyof PixGridAudioFrame>> = {
  beat: 'beatHit',
  downbeat: 'downbeatHit',
  kick: 'kickHit',
  snare: 'snareHit',
  hat: 'hatHit',
  transient: 'transientHit',
  barEntry: 'barEntry',
  fourBarBoundary: 'fourBarBoundary',
  eightBarBoundary: 'eightBarBoundary',
  sixteenBarBoundary: 'sixteenBarBoundary',
  phraseEntry: 'phraseEntry',
  sectionEntry: 'sectionEntry',
  sectionExit: 'sectionExit',
  dropImpact: 'dropImpactHit',
  dropOccurrenceChange: 'dropOccurrenceChange',
  semanticMoment: 'semanticMomentHit',
  trackMapCueEvent: 'trackMapCueEvent',
}

function applyPixGridEditorPreview(frame: PixGridAudioFrame): PixGridAudioFrame {
  const preview = getPixGridPreviewSource()
  if (!preview) return frame
  const next: PixGridAudioFrame = {
    ...frame,
    sourceValues: { ...frame.sourceValues, [preview.source]: 1 },
    unscaledSourceValues: { ...frame.unscaledSourceValues, [preview.source]: 1 },
    inputSource: 'editor-preview',
    capabilities: { ...frame.capabilities, [preview.source]: true },
    confidence: { ...frame.confidence, [preview.source]: 1 },
  }
  const flag = PREVIEW_EVENT_FLAGS[preview.source as PixGridDiscreteAudioSource]
  if (flag) (next as unknown as Record<string, unknown>)[flag] = true
  if (flag) next.eventIdentities = { ...frame.eventIdentities, [preview.source]: preview.identity }
  return next
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
  return (
    a.path === b.path &&
    a.logicalWidth === b.logicalWidth &&
    a.logicalHeight === b.logicalHeight &&
    a.presentationWidth === b.presentationWidth &&
    a.presentationHeight === b.presentationHeight &&
    a.fps === b.fps &&
    a.logicalFramebufferAllocated === b.logicalFramebufferAllocated &&
    a.logicalAllocationCount === b.logicalAllocationCount &&
    a.contextState === b.contextState &&
    a.fallbackReason === b.fallbackReason &&
    a.approximateGpuResourceCount === b.approximateGpuResourceCount &&
    a.requestedQuality === b.requestedQuality &&
    a.effectiveQuality === b.effectiveQuality &&
    a.adaptiveStage === b.adaptiveStage &&
    a.adaptiveReason === b.adaptiveReason &&
    a.qualityPromotionBackend === b.qualityPromotionBackend &&
    a.qualityPromotionReason === b.qualityPromotionReason &&
    a.outputIntensity === b.outputIntensity &&
    a.authoredPerformanceTrim === b.authoredPerformanceTrim &&
    a.cellCalibration === b.cellCalibration &&
    a.resolvedOutputIntensity === b.resolvedOutputIntensity &&
    a.glow === b.glow &&
    a.haloRadius === b.haloRadius &&
    a.resolvedDiffusion === b.resolvedDiffusion &&
    a.preparedMediaCacheEntries === b.preparedMediaCacheEntries &&
    a.preparedMediaCacheBytes === b.preparedMediaCacheBytes &&
    a.enabledGroupCount === b.enabledGroupCount &&
    a.activeGroupMaskCount === b.activeGroupMaskCount &&
    a.activeContinuousAssignmentCount === b.activeContinuousAssignmentCount &&
    a.activeDiscreteAssignmentCount === b.activeDiscreteAssignmentCount &&
    a.activeEventEnvelopeCount === b.activeEventEnvelopeCount &&
    a.activePerformanceActionCount === b.activePerformanceActionCount &&
    a.activeCueActionCount === b.activeCueActionCount &&
    a.activeTransitionCount === b.activeTransitionCount &&
    a.manualOverrideCount === b.manualOverrideCount &&
    a.degradedSignalCount === b.degradedSignalCount &&
    a.totalGroupCount === b.totalGroupCount &&
    a.programGeneratedRouteCount === b.programGeneratedRouteCount &&
    a.userAuthoredRouteCount === b.userAuthoredRouteCount &&
    a.missingTargetCount === b.missingTargetCount &&
    a.assignmentCompilerWarningCount === b.assignmentCompilerWarningCount &&
    a.rendererWarningCount === b.rendererWarningCount &&
    a.groupMaskUploadCount === b.groupMaskUploadCount &&
    a.groupMaskApproximateBytes === b.groupMaskApproximateBytes &&
    a.stateSchemaVersion === b.stateSchemaVersion &&
    a.presetConfigurationVersion === b.presetConfigurationVersion &&
    a.layerGraphVersion === b.layerGraphVersion &&
    a.canonicalMigrationCompleted === b.canonicalMigrationCompleted &&
    a.migrationApplied === b.migrationApplied &&
    a.migrationDetectedPresetLineage === b.migrationDetectedPresetLineage &&
    a.migrationCanonicalLayersAdded === b.migrationCanonicalLayersAdded &&
    a.migrationLegacyLayersMapped === b.migrationLegacyLayersMapped &&
    a.migrationSceneReferencesRepaired === b.migrationSceneReferencesRepaired &&
    a.migrationEmptyGroupCount === b.migrationEmptyGroupCount &&
    a.migrationMissingLayerGroupCount === b.migrationMissingLayerGroupCount &&
    a.migrationIneffectiveAssignmentCount === b.migrationIneffectiveAssignmentCount &&
    a.migrationEffectiveLiveRouteCount === b.migrationEffectiveLiveRouteCount &&
    a.migrationSafeRecoveryUsed === b.migrationSafeRecoveryUsed &&
    a.migrationGroupsAdded === b.migrationGroupsAdded &&
    a.migrationGroupsPreserved === b.migrationGroupsPreserved &&
    a.migrationGroupsUpgraded === b.migrationGroupsUpgraded &&
    a.migrationAssignmentsAdded === b.migrationAssignmentsAdded &&
    a.migrationAssignmentsPreserved === b.migrationAssignmentsPreserved &&
    a.migrationAssignmentsUpgraded === b.migrationAssignmentsUpgraded &&
    a.activeAudioSourceCount === b.activeAudioSourceCount &&
    a.activeAssignmentCount === b.activeAssignmentCount &&
    a.fallbackRoutesActive === b.fallbackRoutesActive &&
    a.effectiveBassReactivityGain === b.effectiveBassReactivityGain &&
    a.effectiveMotionMultiplier === b.effectiveMotionMultiplier &&
    a.affectedGroupCount === b.affectedGroupCount &&
    a.affectedCellCount === b.affectedCellCount &&
    (a.activeAffectedGroupIds ?? []).join('|') === (b.activeAffectedGroupIds ?? []).join('|') &&
    a.activeRouteCount === b.activeRouteCount &&
    a.activeEnvelopePhase === b.activeEnvelopePhase &&
    a.audioInputStatus === b.audioInputStatus &&
    a.analyserActive === b.analyserActive &&
    a.sharedPerformanceCoreAvailable === b.sharedPerformanceCoreAvailable &&
    a.validationErrorCount === b.validationErrorCount &&
    a.validationWarningCount === b.validationWarningCount &&
    a.migrationProgramsUpgraded === b.migrationProgramsUpgraded &&
    a.migrationCustomizationsPreserved === b.migrationCustomizationsPreserved &&
    a.migrationConflictCount === b.migrationConflictCount &&
    a.migrationSkippedUpgradeCount === b.migrationSkippedUpgradeCount &&
    a.perceptualSampleSequence === b.perceptualSampleSequence &&
    a.truthfulReactivityState === b.truthfulReactivityState
  )
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
  const activeScene =
    props.pixGridState.scenes.find((scene) => scene.id === props.pixGridState.selectedSceneId) ?? props.pixGridState.scenes[0]
  const mediaIds = useMemo(() => {
    const activeLayerIds = new Set(activeScene?.layerIds ?? [])
    const ids = props.pixGridState.layers.flatMap((layer) => (activeLayerIds.has(layer.id) && layer.mediaId ? [layer.mediaId] : []))
    if (props.pixGridState.conversion.selectedMediaId) ids.push(props.pixGridState.conversion.selectedMediaId)
    return [...new Set(ids)]
  }, [activeScene?.layerIds, props.pixGridState.conversion.selectedMediaId, props.pixGridState.layers])
  const mediaKey = mediaIds.join('|')
  const mediaItems = useMediaStore((state) => state.items)
  const ensureMediaSigned = useMediaStore((state) => state.ensureMediaSigned)
  const [preparedAssets, setPreparedAssets] = useState<ReadonlyMap<string, PixGridPreparedAsset>>(new Map())
  const [mediaPreparationStatus, setMediaPreparationStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle')
  const [mediaPreparationMessage, setMediaPreparationMessage] = useState<string | null>(null)
  const preparedAssetRef = useRef<ReadonlyMap<string, PixGridPreparedAsset>>(new Map())
  preparedAssetRef.current = preparedAssets
  const selectedMediaId = props.pixGridState.conversion.selectedMediaId
  const selectedMedia = selectedMediaId ? (mediaItems.find((item) => item.id === selectedMediaId) ?? null) : null
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
    const requestedItems = mediaIds.map((id) => mediaItems.find((item) => item.id === id) ?? null)
    const missingId = mediaIds.find((_, index) => !requestedItems[index])
    if (missingId) {
      setPreparedAssets(new Map())
      setMediaPreparationStatus('missing')
      setMediaPreparationMessage(
        'The selected Media Library item is missing or a referenced layer is temporarily unavailable. The project reference is preserved and will recover automatically.',
      )
      requestRenderRef.current(true)
      return
    }
    const unsupported = requestedItems.find((item) => item && !inspectPixGridMediaCapability(item).supported)
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
        const entries = await Promise.all(
          mediaIds.map(async (mediaId) => {
            const media = currentItems.find((item) => item.id === mediaId) ?? requestedItems.find((item) => item?.id === mediaId)
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
          }),
        )
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
    let previousTrackIdentity: string | null = propsRef.current.trackIdentity ?? null
    let previousPresetIdentity: string | null = preset.id
    let previousTransportState: NonNullable<PixGridAudioFrame['transportState']> = propsRef.current.isPaused
      ? 'paused'
      : propsRef.current.isPlaying
        ? 'playing'
        : 'stopped'
    let lastValidatedState: PixGridState | null = null
    let lastValidationCounts = { errors: 0, warnings: 0 }
    let lastAudioTime = 0
    const analyserFramePump = new MusicIntelligenceAnalyserFramePump({ publisherId: 'react:pixGrid' })
    const unifiedReactionRuntime = new PixGridReactionRuntime()
    const unifiedPerformanceRuntime = new PixGridUnifiedPerformanceRuntime()
    const motionClock = new PixGridMotionClock()
    const fallbackGroupCompiler = new PixGridFrameGroupCompiler()
    const perceptualTracker = new PixGridPerceptualResponseTracker()
    let animationFrame = 0
    let gpuRenderer: PixGridGpuRenderer | null = null
    let activePath: PixGridRendererDiagnostics['path'] = 'canvas2d-fallback'
    let fallbackReason: string | null = null
    let forcedRender = false
    let frameCount = 0
    let fpsWindowStarted = performance.now()
    let lastFps = 0
    let lastDiagnostics = EMPTY_DIAGNOSTICS
    let latestRuntimeDiagnostics: PixGridUnifiedRuntimeDiagnostics | null = null
    let latestPerceptualMetrics: PixGridPerceptualResponseMetrics | null = null
    let latestTruthfulStatus: PixGridTruthfulReactivityStatus | null = null
    let latestGroupCoverage = new Map<string, { compiled: number; visible: number }>()
    let latestVisibleFrameCellCount = 0
    let latestRenderedPresentationState: PixGridState | null = null
    let latestRenderedPresentationFrame: Pick<PixGridBaselineRenderFrame, 'intensity' | 'glow'> | null = null
    let lastRouteDiagnosticsAt = Number.NEGATIVE_INFINITY
    let mounted = true
    let gpuRetryAttempts = 0
    let gpuRetryTimer: ReturnType<typeof setTimeout> | null = null
    let createGpuRenderer: () => void = () => {}

    const fpsReporter = createLiveFpsReporter(() => propsRef.current.onLiveFps)

    const publishDiagnostics = (next: PixGridRendererDiagnostics) => {
      const profile = adaptiveProfileRef.current
      const currentState = propsRef.current.pixGridState
      if (lastValidatedState !== currentState) {
        const report = validatePixGridState(currentState, {
          builtInPresetId: currentState.configuration.origin === 'builtInPreset' ? currentState.selectedPresetId : null,
        })
        lastValidatedState = currentState
        lastValidationCounts = { errors: report.errors.length, warnings: report.warnings.length }
        if (report.errors.length > 0 && currentState.diagnostics.logLifecycle) {
          console.warn('[PixGrid] Invalid music-reactive configuration', report.issues)
        }
      }
      const quality = resolvePixGridPublishedQuality(currentState.quality, profile, next.path)
      const presentation = resolvePixGridPresentation(
        latestRenderedPresentationState ?? currentState,
        latestRenderedPresentationFrame ?? {
          intensity: propsRef.current.intensity,
          glow: propsRef.current.glow,
        },
      )
      const enriched: PixGridRendererDiagnostics = {
        ...next,
        requestedQuality: quality.requestedQuality,
        effectiveQuality: quality.effectiveQuality,
        logicalWidth: next.logicalWidth || quality.logicalWidth,
        logicalHeight: next.logicalHeight || quality.logicalHeight,
        adaptiveStage: profile.stage,
        adaptiveReason: profile.reason,
        qualityPromotionBackend: quality.promotionSource,
        qualityPromotionReason: quality.promotionReason,
        outputIntensity: presentation.outputIntensity,
        authoredPerformanceTrim: presentation.authoredPerformanceTrim,
        cellCalibration: presentation.cellCalibration,
        resolvedOutputIntensity: presentation.resolvedOutputIntensity,
        glow: presentation.glow,
        haloRadius: presentation.haloRadius,
        resolvedDiffusion: presentation.diffusion,
        preparedMediaCacheEntries: pixGridPreparedAssetCache.size,
        preparedMediaCacheBytes: pixGridPreparedAssetCache.approximateBytes,
        enabledGroupCount: latestRuntimeDiagnostics?.enabledGroups.length ?? 0,
        activeGroupMaskCount: latestRuntimeDiagnostics?.compiledMaskGroups.length ?? next.activeGroupMaskCount ?? 0,
        activeContinuousAssignmentCount: latestRuntimeDiagnostics?.activeContinuousAssignments.length ?? 0,
        activeDiscreteAssignmentCount: latestRuntimeDiagnostics?.activeDiscreteAssignments.length ?? 0,
        activeEventEnvelopeCount: latestRuntimeDiagnostics?.activeEventEnvelopes.length ?? 0,
        activePerformanceActionCount: latestRuntimeDiagnostics?.activePerformanceActions.length ?? 0,
        activeCueActionCount: latestRuntimeDiagnostics?.activeCueActions.length ?? 0,
        activeTransitionCount: latestRuntimeDiagnostics?.activeTransitions.length ?? 0,
        manualOverrideCount: latestRuntimeDiagnostics?.manualOverrides.length ?? 0,
        degradedSignalCount: latestRuntimeDiagnostics?.degradedSignals.length ?? 0,
        totalGroupCount: propsRef.current.pixGridState.groups.length,
        programGeneratedRouteCount: (latestRuntimeDiagnostics?.activeProgramContinuousRoutes.length ?? 0) + (latestRuntimeDiagnostics?.activeProgramEventRoutes.length ?? 0),
        userAuthoredRouteCount: propsRef.current.pixGridState.audioAssignments.length + propsRef.current.pixGridState.groups.reduce((sum, group) => sum + group.reactions.length, 0),
        missingTargetCount: (latestRuntimeDiagnostics?.missingTargets.length ?? 0) + (latestRuntimeDiagnostics?.programBindingWarnings.length ?? 0),
        assignmentCompilerWarningCount: latestRuntimeDiagnostics?.compilationWarnings.length ?? 0,
        rendererWarningCount: next.fallbackReason ? 1 : 0,
        stateSchemaVersion: latestRuntimeDiagnostics?.stateSchemaVersion ?? propsRef.current.pixGridState.version,
        presetConfigurationVersion: latestRuntimeDiagnostics?.presetConfigurationVersion ?? propsRef.current.pixGridState.configuration.presetConfigurationVersion,
        layerGraphVersion: latestRuntimeDiagnostics?.layerGraphVersion ?? propsRef.current.pixGridState.configuration.layerGraphVersion,
        canonicalMigrationCompleted: latestRuntimeDiagnostics?.canonicalMigrationCompleted ?? propsRef.current.pixGridState.configuration.canonicalMigrationCompleted,
        migrationApplied: latestRuntimeDiagnostics?.migrationApplied ?? propsRef.current.pixGridState.configuration.lastMigration?.applied ?? false,
        migrationDetectedPresetLineage: latestRuntimeDiagnostics?.migrationDetectedPresetLineage ?? propsRef.current.pixGridState.configuration.lastMigration?.detectedPresetLineage ?? 'unknown',
        migrationCanonicalLayersAdded: latestRuntimeDiagnostics?.migrationCanonicalLayersAdded.length ?? propsRef.current.pixGridState.configuration.lastMigration?.canonicalLayersAdded?.length ?? 0,
        migrationLegacyLayersMapped: latestRuntimeDiagnostics?.migrationLegacyLayersMapped.length ?? propsRef.current.pixGridState.configuration.lastMigration?.legacyLayersMapped?.length ?? 0,
        migrationSceneReferencesRepaired: latestRuntimeDiagnostics?.migrationSceneReferencesRepaired ?? propsRef.current.pixGridState.configuration.lastMigration?.sceneReferencesRepaired ?? 0,
        migrationEmptyGroupCount: latestRuntimeDiagnostics?.migrationEmptyGroups.length ?? propsRef.current.pixGridState.configuration.lastMigration?.emptyGroups?.length ?? 0,
        migrationMissingLayerGroupCount: latestRuntimeDiagnostics?.migrationMissingLayerGroups.length ?? propsRef.current.pixGridState.configuration.lastMigration?.missingLayerGroups?.length ?? 0,
        migrationIneffectiveAssignmentCount: latestRuntimeDiagnostics?.migrationIneffectiveAssignments.length ?? propsRef.current.pixGridState.configuration.lastMigration?.ineffectiveAssignments?.length ?? 0,
        migrationEffectiveLiveRouteCount: latestRuntimeDiagnostics?.migrationEffectiveLiveRouteCount ?? propsRef.current.pixGridState.configuration.lastMigration?.effectiveLiveRouteCount ?? 0,
        migrationSafeRecoveryUsed: latestRuntimeDiagnostics?.migrationSafeRecoveryUsed ?? propsRef.current.pixGridState.configuration.lastMigration?.safeRecoveryUsed ?? false,
        migrationGroupsAdded: latestRuntimeDiagnostics?.migrationGroupsAdded ?? propsRef.current.pixGridState.configuration.lastMigration?.groupsAdded ?? 0,
        migrationGroupsPreserved: latestRuntimeDiagnostics?.migrationGroupsPreserved ?? propsRef.current.pixGridState.configuration.lastMigration?.groupsPreserved ?? 0,
        migrationGroupsUpgraded: latestRuntimeDiagnostics?.migrationGroupsUpgraded ?? propsRef.current.pixGridState.configuration.lastMigration?.groupsUpgraded ?? 0,
        migrationAssignmentsAdded: latestRuntimeDiagnostics?.migrationAssignmentsAdded ?? propsRef.current.pixGridState.configuration.lastMigration?.assignmentsAdded ?? 0,
        migrationAssignmentsPreserved: latestRuntimeDiagnostics?.migrationAssignmentsPreserved ?? propsRef.current.pixGridState.configuration.lastMigration?.assignmentsPreserved ?? 0,
        migrationAssignmentsUpgraded: latestRuntimeDiagnostics?.migrationAssignmentsUpgraded ?? propsRef.current.pixGridState.configuration.lastMigration?.assignmentsUpgraded ?? 0,
        activeAudioSourceCount: latestRuntimeDiagnostics?.activeAudioSourceCount ?? 0,
        activeAssignmentCount: latestRuntimeDiagnostics?.activeAssignmentCount ?? 0,
        fallbackRoutesActive: latestRuntimeDiagnostics?.fallbackRoutesActive ?? false,
        effectiveBassReactivityGain: latestRuntimeDiagnostics?.effectiveBassReactivityGain ?? normalizedControl(propsRef.current.bassReactivity),
        effectiveMotionMultiplier: latestRuntimeDiagnostics?.effectiveMotionMultiplier ?? normalizedControl(propsRef.current.motion),
        affectedGroupCount: latestRuntimeDiagnostics?.affectedGroupCount ?? 0,
        affectedCellCount: latestRuntimeDiagnostics?.affectedCellCount ?? 0,
        activeAffectedGroupIds: latestRuntimeDiagnostics?.activeAffectedGroupIds ?? [],
        activeRouteCount: latestRuntimeDiagnostics?.routeActivity.filter(route => route.state === 'active' || route.state === 'fallback').length ?? 0,
        activeEnvelopePhase: latestRuntimeDiagnostics?.currentEnvelopePhase ?? 'idle',
        audioInputStatus: latestRuntimeDiagnostics?.audioInputStatus ?? 'idle',
        analyserActive: latestRuntimeDiagnostics?.analyserActive ?? false,
        sharedPerformanceCoreAvailable: latestRuntimeDiagnostics?.sharedPerformanceCoreAvailable ?? false,
        validationErrorCount: lastValidationCounts.errors,
        validationWarningCount: lastValidationCounts.warnings,
        migrationProgramsUpgraded: latestRuntimeDiagnostics?.migrationProgramsUpgraded ?? 0,
        migrationCustomizationsPreserved: latestRuntimeDiagnostics?.migrationCustomizationsPreserved ?? false,
        migrationConflictCount: latestRuntimeDiagnostics?.migrationConflicts.length ?? 0,
        migrationSkippedUpgradeCount: latestRuntimeDiagnostics?.migrationSkippedUpgrades.length ?? 0,
        perceptualSampleSequence: latestPerceptualMetrics?.sampleSequence,
        changedVisibleCellCount: latestPerceptualMetrics?.changedVisibleCellCount,
        changedVisibleCellPercentage: latestPerceptualMetrics?.changedVisibleCellPercentage,
        meanBrightnessDelta: latestPerceptualMetrics?.meanBrightnessDelta,
        peakBrightnessDelta: latestPerceptualMetrics?.peakBrightnessDelta,
        meanPerceptualColorDistance: latestPerceptualMetrics?.meanPerceptualColorDistance,
        localizedGroupChangePercentage: latestPerceptualMetrics?.localizedGroupChangePercentage,
        currentAudioOnsetStrength: latestPerceptualMetrics?.currentAudioOnsetStrength,
        recentOnsetToPixelCorrelation: latestPerceptualMetrics?.recentOnsetToPixelCorrelation,
        silenceBaselineDifference: latestPerceptualMetrics?.silenceBaselineDifference,
        sceneTransitionActivity: latestPerceptualMetrics?.sceneTransitionActivity,
        perceptualVisibleCellCount: latestPerceptualMetrics?.visibleCellCount,
        perceptualAffectedGroupCellCount: latestPerceptualMetrics?.affectedGroupCellCount,
        truthfulReactivityState: latestTruthfulStatus?.state,
        truthfulReactivityLabel: latestTruthfulStatus?.label,
        truthfulReactivityTone: latestTruthfulStatus?.tone,
        truthfulReactivityMessage: latestTruthfulStatus?.message,
        truthfulReactivityFlags: latestTruthfulStatus?.flags,
      }
      lastDiagnostics = enriched
      publishPixGridRendererDiagnostics(enriched)
      propsRef.current.onDiagnostics?.(enriched)
      if (mounted) setDiagnostics((previous) => (diagnosticsEqual(previous, enriched) ? previous : enriched))
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

    const currentFrameInput = (force: boolean): {
      frame: PixGridBaselineRenderFrame
      state: PixGridState
      blackout: boolean
      preset: ReactPreset
      transition: PixGridResolvedTransition | null
      groupEffects: readonly PixGridGroupFrameEffect[]
      audioFrame: PixGridAudioFrame
    } | null => {
      const current = propsRef.current
      const activePreset = current.activePreset
      if (!activePreset) return null
      const transportState: NonNullable<PixGridAudioFrame['transportState']> = current.isPaused
        ? 'paused'
        : current.isPlaying
          ? 'playing'
          : 'stopped'
      const presetChanged = previousPresetIdentity !== activePreset.id
      const transportBoundary = previousTransportState !== transportState
        && (previousTransportState === 'stopped' || transportState === 'stopped')
      if (presetChanged || transportBoundary) {
        previousPresetIdentity = activePreset.id
        previousTransportState = transportState
        previousPerformanceContext = null
        unifiedPerformanceRuntime.reset(current.trackIdentity ?? null)
        unifiedReactionRuntime.reset()
        motionClock.reset(current.trackIdentity ?? null)
        fallbackGroupCompiler.reset()
        perceptualTracker.reset()
        latestGroupCoverage = new Map()
        latestVisibleFrameCellCount = 0
        lastRouteDiagnosticsAt = Number.NEGATIVE_INFINITY
      } else {
        previousTransportState = transportState
      }
      const shouldAnimate = transportState === 'playing'
      const propAudioTime = Number.isFinite(current.audioTimeSec)
        ? Math.max(0, current.audioTimeSec as number)
        : lastAudioTime
      const shouldReadLivePlayhead = shouldAnimate || (force && current.isPaused === true)
      const sampledAudioTime = shouldReadLivePlayhead ? current.getAudioTime() : propAudioTime
      const audioTime = Number.isFinite(sampledAudioTime) ? Math.max(0, sampledAudioTime) : propAudioTime
      const trackIdentity = current.trackIdentity ?? null
      if (trackIdentity !== previousTrackIdentity) {
        previousTrackIdentity = trackIdentity
        previousPerformanceContext = null
        lastAudioTime = audioTime
        unifiedPerformanceRuntime.reset(trackIdentity)
        unifiedReactionRuntime.reset()
        motionClock.reset(trackIdentity)
        fallbackGroupCompiler.reset()
        perceptualTracker.reset()
        latestGroupCoverage = new Map()
        latestVisibleFrameCellCount = 0
        lastRouteDiagnosticsAt = Number.NEGATIVE_INFINITY
      }
      const busPublication = current.analyser ? null : AudioFeatureBus.getFramePublicationMeta()
      const intelligenceFrame = current.analyser
        ? analyserFramePump.sample({
            analyser: current.analyser,
            audioTime,
            isPlaying: shouldAnimate,
            trackIdentity,
          })
        : resolvePixGridBusMusicIntelligenceFrame({
            frame: AudioFeatureBus.getFrame(),
            publication: busPublication!,
            audioTimeSec: audioTime,
            trackIdentity,
          })
      const publicationAgeMs = busPublication?.publishedAtMs
        ? Math.max(0, globalThis.performance.now() - busPublication.publishedAtMs)
        : null
      const usingFreshBusFrame = !current.analyser
        && busPublication?.kind === 'frame'
        && publicationAgeMs != null
        && publicationAgeMs <= 250
        && intelligenceFrame.frameId > 0
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
      const liveAudioFrame = createPixGridAudioFrame(context, {
        isPlaying: shouldAnimate,
        deltaTimeSec,
        autoPerformanceEnabled: current.pixGridState.performance.enabled,
      })
      const authoredAudioFrame = transportState === 'stopped'
        ? createSilentPixGridAudioFrame({
            audioTime,
            deltaTimeSec: 0,
            timingDiscontinuity: true,
            trackIdentity,
            sectionType: liveAudioFrame.sectionType,
            sectionPhase: liveAudioFrame.sectionPhase,
            sectionOccurrence: liveAudioFrame.sectionOccurrence,
            dropOccurrence: liveAudioFrame.dropOccurrence,
            phraseIndex: liveAudioFrame.phraseIndex,
            barIndex: liveAudioFrame.barIndex,
            beatIndex: liveAudioFrame.beatIndex,
            beatsSinceSectionStart: liveAudioFrame.beatsSinceSectionStart,
            barsSinceSectionStart: liveAudioFrame.barsSinceSectionStart,
            capabilities: liveAudioFrame.capabilities,
            confidence: liveAudioFrame.confidence,
            isPlaying: false,
          })
        : liveAudioFrame
      const confidenceValues = Object.entries(authoredAudioFrame.confidence ?? {})
        .filter(([, value]) => typeof value === 'number')
        .map(([, value]) => value as number)
      const analyserActive = Boolean(current.analyser) && (
        (authoredAudioFrame.volume ?? 0) > 0.001
        || (authoredAudioFrame.energy ?? 0) > 0.001
        || (authoredAudioFrame.spectralFlux ?? 0) > 0.001
      )
      const inputSource: NonNullable<PixGridAudioFrame['inputSource']> = current.analyser
        ? 'analyser'
        : usingFreshBusFrame
          ? 'shared-bus'
          : 'neutral'
      const audioFrame = motionClock.apply(applyPixGridRuntimeControls(applyPixGridEditorPreview({
        ...authoredAudioFrame,
        transportState,
        inputSource,
        analyserConnected: current.analyser != null,
        analyserActive,
        sharedPerformanceCoreAvailable: true,
        inputFrameAgeMs: current.analyser ? 0 : publicationAgeMs,
        inputSourceId: intelligenceFrame.sourceId ?? intelligenceFrame.trackId ?? null,
        aggregateSourceConfidence: confidenceValues.length
          ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
          : 0,
        stemAvailability: (['bassStemActivity', 'drumActivity', 'melodyActivity', 'vocalActivity'] as const)
          .filter(source => authoredAudioFrame.capabilities?.[source] !== false),
      }), {
        bassReactivity: current.bassReactivity,
        motion: current.motion,
      }))
      const pixGridPerformanceContext = applyPixGridBassGainToPerformanceContext(
        context,
        audioFrame.bassReactivityGain ?? 1,
      )
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
      const selectedSceneId = resolveSectionScene(
        activePreset,
        current.trackSections ?? intelligenceFrame.resolvedSections ?? [],
        audioTime,
      )
      const mappedState = selectedSceneId ? { ...runtimeState, selectedSceneId } : runtimeState
      const resolvedRuntime = unifiedPerformanceRuntime.resolve({
        authoredState: mappedState,
        context: pixGridPerformanceContext,
        audioFrame,
        presetId: activePreset.id,
        cues: current.pixGridActionCues ?? [],
        trackId: current.trackIdentity ?? null,
      })
      const state = transportState === 'stopped' ? mappedState : resolvedRuntime.state
      latestRuntimeDiagnostics = transportState === 'stopped'
        ? {
            ...resolvedRuntime.diagnostics,
            activeAssignmentCount: 0,
            affectedGroupCount: 0,
            affectedCellCount: 0,
            activeAffectedGroupIds: [],
            routeActivity: [],
            currentEnvelopePhase: 'idle',
            audioEnvelopeActionCount: 0,
            performanceProgramActionCount: 0,
            sceneTransitionActionCount: 0,
            activeCompiledAssignments: [],
            activeContinuousAssignments: [],
            activeDiscreteAssignments: [],
            activeEventEnvelopes: [],
            activePerformanceActions: [],
            activeCueActions: [],
            activeGroupEffects: [],
            activeTransitions: [],
          }
        : resolvedRuntime.diagnostics
      const performance = resolvedRuntime.performance
      const cueFrame = resolvedRuntime.cues
      const activeCueIdentity = cueFrame.snapshot.activeCueIds.join('|')
      const routedAudioFrame = activeCueIdentity
        ? {
            ...audioFrame,
            trackMapCueEvent: true,
            trackMapCueIdentity: `track-map:${activeCueIdentity}`,
            sourceValues: { ...audioFrame.sourceValues, trackMapCueEvent: 1 },
            capabilities: { ...audioFrame.capabilities, trackMapCueEvent: true },
            confidence: { ...audioFrame.confidence, trackMapCueEvent: 1 },
            eventIdentities: { ...audioFrame.eventIdentities, trackMapCueEvent: `track-map:${activeCueIdentity}` },
          }
        : audioFrame
      publishPixGridPerformanceRuntimeStatus(performance.snapshot)
      publishPixGridCueRuntimeStatus(cueFrame.snapshot)
      publishPixGridAudioAnalysis(routedAudioFrame, resolvedRuntime.diagnostics)
      publishSharedPerformanceDiagnostics(
        createSharedPerformanceDiagnostics(context, {
          engine: 'pixGrid',
          active: performance.snapshot.active || cueFrame.snapshot.active,
          performanceShow: performance.snapshot.programName,
          scene: state.selectedSceneId ?? performance.snapshot.sceneId,
          motifOrComposition: performance.snapshot.currentFourBarMotif ?? performance.snapshot.variationId,
          activeLayers: [
            ...state.layers.filter((layer) => layer.visible).map((layer) => layer.id),
            ...performance.snapshot.activeVisualRoles.map((role) => `role:${role}`),
            ...performance.snapshot.resolvedBanks.map((bank) => `bank:${bank}`),
          ],
          activeEventEnvelopes: [
            ...performance.snapshot.activeEventRoutes.map((route) => `route:${route}`),
            ...resolvedRuntime.diagnostics.activeEventEnvelopes,
            ...resolvedRuntime.diagnostics.activeDiscreteAssignments,
          ],
          recentActions: [
            `plan:${performance.snapshot.activeSectionPlanId ?? 'none'}`,
            `phase:${performance.snapshot.sectionPhase}`,
            ...(performance.snapshot.currentEightBarRecruitment ? [`recruit:${performance.snapshot.currentEightBarRecruitment}`] : []),
            ...(performance.snapshot.currentSixteenBarEvolution ? [`evolve:${performance.snapshot.currentSixteenBarEvolution}`] : []),
            ...resolvedRuntime.diagnostics.activePerformanceActions,
            ...resolvedRuntime.diagnostics.activeCueActions.map((id) => `cue:${id}`),
          ].slice(-16),
          continuousRoutes: [
            ...performance.snapshot.activeContinuousRoutes.map((route) => `program:${route}`),
            ...resolvedRuntime.diagnostics.activeContinuousAssignments,
          ],
          lockedParameters: [...new Set([...performance.snapshot.manualOverrideRoutes, ...cueFrame.snapshot.manualOverrideRoutes])],
          fallbackState: performance.snapshot.fallbackState,
          resourceLimitDecisions: [
            `arcs:density=${performance.snapshot.arcState.density.toFixed(2)},palette=${performance.snapshot.arcState.paletteIntensity.toFixed(2)},motion=${performance.snapshot.arcState.motion.toFixed(2)},negativeSpace=${performance.snapshot.arcState.negativeSpace.toFixed(2)}`,
            `precedence:${performance.snapshot.manualOverridePrecedence}`,
            ...performance.snapshot.missingBindings.map((binding) => `Missing PixGrid binding: ${binding}`),
            ...performance.snapshot.degradedBindings.map((binding) => `Degraded PixGrid binding: ${binding}`),
            ...performance.actionLimitDecisions,
            ...resolvedRuntime.diagnostics.degradedSignals.map((route) => `Degraded PixGrid signal: ${route}`),
          ],
        }),
      )
      return {
        preset: activePreset,
        state,
        transition: transportState === 'stopped' ? null : resolvedRuntime.transition,
        groupEffects: transportState === 'stopped' ? [] : resolvedRuntime.groupEffects,
        audioFrame: routedAudioFrame,
        blackout: !current.isPlaying && !current.isPaused && state.stoppedBehavior === 'blackout',
        frame: {
          width: activePath === 'webgl2' ? gpuCanvas.width : fallbackCanvas.width,
          height: activePath === 'webgl2' ? gpuCanvas.height : fallbackCanvas.height,
          ...routedAudioFrame,
          motion: current.motion,
          intensity: current.intensity,
          glow: current.glow,
          bassReactivity: current.bassReactivity,
        },
      }
    }

    const publishResolvedRouteDiagnostics = (
      input: NonNullable<ReturnType<typeof currentFrameInput>>,
      resolveMask: (group: PixGridState['groups'][number]) => PixGridCompiledMask,
      logicalFrame: PixGridLogicalFrame | null,
    ): readonly PixGridCompiledMask[] => {
      if (!latestRuntimeDiagnostics) return []
      const nowMs = globalThis.performance.now()
      if (nowMs - lastRouteDiagnosticsAt < 80 && latestTruthfulStatus) return []
      lastRouteDiagnosticsAt = nowMs
      const reactionDiagnostics = unifiedReactionRuntime.getDiagnostics()
      const activeGroupIds = new Set<string>()
      for (const route of reactionDiagnostics.routeActivity) {
        if (route.state !== 'active' && route.state !== 'fallback') continue
        route.affectedGroupIds.forEach(groupId => activeGroupIds.add(groupId))
      }
      const groupCellCounts = new Map<string, { compiled: number; visible: number }>()
      const activeMasks: PixGridCompiledMask[] = []
      const shouldMeasurePixels = logicalFrame != null && perceptualTracker.shouldSample(nowMs)
      if (shouldMeasurePixels && logicalFrame) {
        latestVisibleFrameCellCount = 0
        for (let cell = 0; cell < logicalFrame.width * logicalFrame.height; cell += 1) {
          if (logicalFrame.pixels[cell * 4 + 3]! > 0) latestVisibleFrameCellCount += 1
        }
      }
      for (const groupId of activeGroupIds) {
        const group = input.state.groups.find(candidate => candidate.id === groupId)
        if (!group) continue
        const mask = resolveMask(group)
        let visible = latestGroupCoverage.get(groupId)?.visible ?? 0
        if (shouldMeasurePixels && logicalFrame) {
          visible = 0
          for (let cell = 0; cell < logicalFrame.width * logicalFrame.height; cell += 1) {
            if (pixGridMaskHasCell(mask.bits, cell) && logicalFrame.pixels[cell * 4 + 3]! > 0) visible += 1
          }
        }
        groupCellCounts.set(groupId, { compiled: mask.cellCount, visible })
        if (mask.cellCount > 0) activeMasks.push(mask)
      }
      latestGroupCoverage = groupCellCounts
      latestRuntimeDiagnostics = mergePixGridReactionRuntimeDiagnostics(
        latestRuntimeDiagnostics,
        reactionDiagnostics,
        input.state,
        groupCellCounts,
        latestVisibleFrameCellCount,
      )
      if (logicalFrame) {
        latestPerceptualMetrics = perceptualTracker.sample({
          frame: logicalFrame,
          audioFrame: input.audioFrame,
          activeGroupMasks: activeMasks,
          activeEnvelopeCount: latestRuntimeDiagnostics.activeEventEnvelopes.length,
          sceneTransitionActivity: latestRuntimeDiagnostics.sceneTransitionActionCount,
          nowMs,
        })
      }
      latestTruthfulStatus = resolvePixGridTruthfulReactivityStatus({
        state: input.state,
        runtime: latestRuntimeDiagnostics,
        metrics: latestPerceptualMetrics,
        validationErrorCount: lastValidationCounts.errors,
      })
      publishPixGridAudioAnalysis(input.audioFrame, latestRuntimeDiagnostics)
      return activeMasks
    }

    const renderFallback = (input: NonNullable<ReturnType<typeof currentFrameInput>>) => {
      const frame = input.blackout ? { ...input.frame, intensity: 0 } : input.frame
      const fallbackState = input.blackout ? { ...input.state, backgroundMode: 'black' as const, backgroundBrightness: 0 } : input.state
      const fallbackLogical = renderPixGridCanvasFallback(
        fallbackContext,
        { canvas: logicalCanvas, context: logicalContext },
        frame,
        input.preset,
        fallbackState,
        preparedAssetRef.current,
        unifiedReactionRuntime,
        input.transition,
        input.groupEffects,
        fallbackGroupCompiler,
      )
      if (latestRuntimeDiagnostics) {
        latestRuntimeDiagnostics = { ...latestRuntimeDiagnostics, compiledMaskGroups: fallbackGroupCompiler.compiledGroupIds }
      }
      publishResolvedRouteDiagnostics(input, group => fallbackGroupCompiler.compile(group), fallbackLogical.logicalFrame)
      latestRenderedPresentationState = fallbackState
      latestRenderedPresentationFrame = frame
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
        activeGroupMaskCount: latestRuntimeDiagnostics?.compiledMaskGroups.length ?? 0,
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

      const input = currentFrameInput(force)
      if (!input) return
      let rendered = false
      if (activePath === 'webgl2' && gpuRenderer?.isReady) {
        try {
          const gpuFrame = input.blackout ? { ...input.frame, intensity: 0 } : input.frame
          const gpuState = input.blackout ? { ...input.state, backgroundMode: 'black' as const, backgroundBrightness: 0 } : input.state
          rendered = gpuRenderer.render({
            frame: gpuFrame,
            preset: input.preset,
            state: gpuState,
            presentationWidth: gpuCanvas.width,
            presentationHeight: gpuCanvas.height,
            blackout: input.blackout,
            preparedAsset: preparedAssetRef.current,
            transition: input.transition,
            groupEffects: input.groupEffects,
            reactionRuntime: unifiedReactionRuntime,
          })
          if (rendered) {
            const gpuDiagnostics = gpuRenderer.diagnostics
            if (latestRuntimeDiagnostics) {
              latestRuntimeDiagnostics = { ...latestRuntimeDiagnostics, compiledMaskGroups: gpuRenderer.compiledGroupIds }
            }
            publishResolvedRouteDiagnostics(input, group => gpuRenderer!.compiledMaskForGroup(group), gpuRenderer.logicalFrame)
            latestRenderedPresentationState = gpuState
            latestRenderedPresentationFrame = gpuFrame
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
        lastFps = current.isPlaying && !current.isPaused
          ? Math.round((frameCount * 1000) / elapsed)
          : 0
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
        onContextRestoreFailed: (reason) => {
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
      requestRender(true)
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
      requestRender(true)
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
      unifiedPerformanceRuntime.reset()
      unifiedReactionRuntime.reset()
      analyserFramePump.dispose()
      fallbackGroupCompiler.reset()
      perceptualTracker.reset()
      latestGroupCoverage.clear()
      latestVisibleFrameCellCount = 0
      clearPixGridPerformanceRuntimeStatus()
      clearPixGridCueRuntimeStatus()
      clearPixGridPreviewSource()
      clearPixGridReactivityRuntimeStatus()
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
    // State, preset, editor, and playhead changes need one deterministic frame
    // even while transport animation is paused. The render loop itself remains
    // stopped after that single forced frame.
    requestRenderRef.current(true)
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
    props.audioTimeSec,
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
      <canvas ref={gpuCanvasRef} className="rv-preview-canvas rv-pix-grid-surface rv-pix-grid-surface--gpu" hidden={fallbackActive} />
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
          <button type="button" onClick={() => retryGpuRef.current()}>
            Retry GPU
          </button>
        </div>
      )}
    </div>
  )
}
