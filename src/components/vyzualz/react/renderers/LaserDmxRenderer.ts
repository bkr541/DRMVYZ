// LaserDMX virtual renderer entry point.
// LaserDMX is locked to the Beam Matrix authoring/rendering path. Legacy
// production-rig data may still hydrate for compatibility, but it is not a
// selectable or renderable workspace.

import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { DEFAULT_MI_FRAME } from '../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import { resolveSectionAtTime } from '../../../../features/trackIntelligence/authoritativeTimeline'
import { useReactStore } from '../../../../stores/reactStore'
import { useVisualStore } from '../../../../stores/visualStore'
import { cueMarkerBelongsToTrack } from '../../../../types/cue'
import { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } from './LaserDmxBeamMatrixCompiler'
import { compileLaserDmxShowDirectorToBeamMatrix } from './LaserDmxShowDirectorBeamMatrixCompiler'
import { buildLaserDmxShowDirectorPerformanceContext, type LaserDmxShowDirectorPerformanceTimingContext } from '../LaserDmxShowDirectorPerformanceContext'
import { resolveLaserDmxShowDirectorPerformance } from '../LaserDmxShowDirectorPerformanceResolver'
import type { LaserDmxShowDirectorGlobalOutputOverrides } from '../LaserDmxShowDirectorPerformanceProgram'
import { clearLaserDmxShowDirectorPerformanceRuntimeStatus, publishLaserDmxShowDirectorPerformanceRuntimeStatus } from '../LaserDmxShowDirectorPerformanceRuntimeStatus'
import { renderLaserDmxBeamMatrix } from './LaserDmxBeamMatrixRenderer'
import { renderFog, resetFogState } from './LaserDmxFogRenderer'
import { useBrandKitStore } from '../../../../features/personalization/brandKitStore'
import { resolveLaserDmxPersonalization } from '../../../../features/personalization/laserDmxPersonalization'
import { resolveProductionLookTransitionRuntime } from './LaserDmxProductionLookEngine'
import {
  disposeLaserDmxRendererLifecycle,
  getLaserDmxRendererLifecycle,
  type LaserDmxRendererResetReason,
} from './LaserDmxRendererLifecycle'
import { createShowDirectorRuntime, evaluateShowDirector, resetShowDirectorRuntime, type ShowDirectorRuntime } from './LaserDmxShowDirector'
import { productionOutputController } from '../output/ProductionOutput'
import { applyLaserDmxPerformanceActions } from './LaserDmxPerformanceActionEngine'
import { createLaserDmxSceneFrame, resolveLaserDmxSceneFrameOutput } from './laserDmx/LaserDmxSceneFrame'
import { resolveLaserDmxRendererBackend } from './laserDmx/LaserDmxRendererBackend'
import { LaserDmxWebGLRuntime } from './laserDmx/LaserDmxWebGLRuntime'

/** Returns true when the LaserDMX renderer should draw. */
export const LASER_DMX_VIRTUAL_CAPTURE_LAYERS = [
  'stage', 'lasers', 'movingHeads', 'washes', 'ledBars', 'persistentHaze', 'localizedFog', 'cryoPlumes', 'flashImpacts',
] as const

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function finiteNumber(value: unknown, fallback = 0): number {
  const candidate = Number(value)
  return Number.isFinite(candidate) ? candidate : fallback
}

function positiveNumber(value: unknown, fallback = 0): number {
  const candidate = finiteNumber(value, fallback)
  return candidate > 0 ? candidate : fallback
}

function resolveLaserDmxFrameBpm(frame: ReactFrameContext, busFrame: MusicIntelligenceFrame): number {
  const frameBpm = positiveNumber(frame.bpm, 0)
  if (frameBpm > 0) return frameBpm
  const busBpm = positiveNumber(busFrame.rhythm?.bpm, 0)
  if (busBpm > 0) return busBpm
  return positiveNumber(frame.trackAnalysis?.bpmUsedForGrid ?? frame.trackAnalysis?.bpm, 0)
}

function resolveLaserDmxBeatGridOffset(frame: ReactFrameContext): number {
  const direct = finiteNumber(frame.trackAnalysis?.beatGridOffsetSec, Number.NaN)
  if (Number.isFinite(direct)) return Math.max(0, direct)
  const firstMarker = finiteNumber(frame.trackAnalysis?.beatGrid?.[0]?.timeSec, Number.NaN)
  return Number.isFinite(firstMarker) ? Math.max(0, firstMarker) : 0
}

function resolveLaserDmxFrameSection(
  frame: ReactFrameContext,
  source: MusicIntelligenceFrame,
  timeSec: number,
): MusicIntelligenceFrame['section'] | null {
  const resolved = frame.resolvedSection
  if (resolved) {
    return {
      type: resolved.type,
      label: resolved.label ?? String(resolved.type),
      startSec: finiteNumber(resolved.startSec, 0),
      endSec: finiteNumber(resolved.endSec, Infinity),
      progress: clamp01(finiteNumber(resolved.progress, 0)),
      intensity: 1,
      confidence: clamp01(finiteNumber(resolved.confidence, 1)),
      source: resolved.source ?? 'inferred',
    }
  }
  const published = source.currentResolvedSection
  if (published && timeSec >= published.startSec && timeSec <= published.endSec) {
    return {
      type: published.type,
      label: published.label,
      startSec: published.startSec,
      endSec: published.endSec,
      progress: published.progress,
      intensity: published.intensity,
      confidence: published.analysisConfidence ?? published.confidence ?? 0,
      source: published.provenance?.authority === 'imported'
        ? 'rekordbox'
        : published.provenance?.authority === 'automatic'
          ? 'analysis'
          : published.provenance?.authority === 'fallback'
            ? 'inferred'
            : 'manual',
    }
  }
  const timeline = source.resolvedSections?.length ? source.resolvedSections : frame.trackSections
  const section = resolveSectionAtTime(timeline ?? [], timeSec)
  if (!section) return null
  const startSec = finiteNumber(section.startSec, 0)
  const endSec = finiteNumber(section.endSec, startSec)
  return {
    type: section.type,
    label: section.label,
    startSec,
    endSec,
    progress: endSec > startSec ? clamp01((timeSec - startSec) / (endSec - startSec)) : 0,
    intensity: clamp01(finiteNumber(section.intensity, 1)),
    confidence: clamp01(finiteNumber(section.analysisConfidence ?? section.confidence, 1)),
    source: section.provenance?.authority === 'imported' || section.source === 'imported'
      ? 'rekordbox'
      : section.provenance?.authority === 'automatic' || section.source === 'auto'
        ? 'analysis'
        : section.provenance?.authority === 'fallback' || section.source === 'fallback'
          ? 'inferred'
          : 'manual',
  }
}

function musicIntelligenceFrameMatchesTrack(
  candidate: MusicIntelligenceFrame | null | undefined,
  trackKey: string | null | undefined,
): candidate is MusicIntelligenceFrame {
  if (!candidate) return false
  const hasPublishedTrackState = Boolean(
    candidate.analysisRevision
    || candidate.timelineRevision
    || candidate.resolvedSections?.length,
  )
  if (candidate.frameId <= 0 && !hasPublishedTrackState) return false
  if (!trackKey) return true
  const identities = [candidate.trackId, candidate.sourceId].filter((value): value is string => Boolean(value))
  return identities.length === 0 || identities.includes(trackKey)
}

/**
 * LaserDMX needs beat/bar data every render frame, even while Music Intelligence
 * is still warming up or a canvas only has the simpler ReactFrameContext timing.
 * This adapter keeps the live AudioFeatureBus frame when it exists, then patches
 * in the audio-engine BPM/playhead, fallback bands, and track-section data so
 * Show Director beat/bar/section triggers still compile into visible Beam Matrix output.
 */
export function resolveLaserDmxMusicIntelligenceFrame(
  frame: ReactFrameContext,
  busFrame: MusicIntelligenceFrame,
): MusicIntelligenceFrame {
  const trackKey = frame.trackKey ?? null
  const source = musicIntelligenceFrameMatchesTrack(busFrame, trackKey)
    ? busFrame
    : musicIntelligenceFrameMatchesTrack(frame.musicIntelligence, trackKey)
      ? frame.musicIntelligence
      : DEFAULT_MI_FRAME
  const timeSec = Math.max(0, finiteNumber(frame.audioTime, finiteNumber(source.timeSec, 0)))
  const bpm = resolveLaserDmxFrameBpm(frame, source)
  const beatsPerBar = Math.max(1, Math.round(finiteNumber(frame.trackAnalysis?.timeSignature, 4)))
  const beatDurationSec = bpm > 0 ? 60 / bpm : 0
  const beatFloat = beatDurationSec > 0
    ? Math.max(0, (timeSec - resolveLaserDmxBeatGridOffset(frame)) / beatDurationSec)
    : 0
  const computedBeatIndex = Math.floor(beatFloat)
  const computedBeatPhase = beatFloat - computedBeatIndex
  const sourceHasBeatGrid = source.frameId > 0 && positiveNumber(source.rhythm.bpm, 0) > 0
  const beatIndex = sourceHasBeatGrid
    ? Math.max(0, finiteNumber(source.rhythm.beatIndex, computedBeatIndex))
    : computedBeatIndex
  const beatPhase = sourceHasBeatGrid
    ? clamp01(finiteNumber(source.rhythm.beatPhase, computedBeatPhase))
    : clamp01(finiteNumber(frame.beatPhase, computedBeatPhase))
  const beatInBar = Math.floor(beatIndex) % beatsPerBar
  const barIndex = Math.floor(Math.floor(beatIndex) / beatsPerBar)
  const beatHit = source.frameId > 0 ? source.rhythm.beatHit : Boolean(frame.beatHit)
  const downbeatHit = source.frameId > 0 ? source.rhythm.downbeatHit : beatHit && beatInBar === 0
  const phraseHit = (phraseBeats: number) => beatHit && Math.floor(beatIndex) % phraseBeats === 0
  const phraseProgress = (phraseBeats: number) => clamp01(((beatIndex + beatPhase) % phraseBeats) / phraseBeats)
  const bass = clamp01(finiteNumber(frame.audio.bass, source.bands.bass))
  const mid = clamp01(finiteNumber(frame.audio.mid, source.bands.mid))
  const high = clamp01(finiteNumber(frame.audio.high, source.bands.high))
  const volume = clamp01(finiteNumber(frame.audio.volume, source.bands.volume))
  const authoritativeTimeline = source.resolvedSections?.length ? source.resolvedSections : frame.trackSections ?? []
  const timelineSection = resolveSectionAtTime(authoritativeTimeline, timeSec)
  const currentResolvedSection = timelineSection
    ? {
        ...timelineSection,
        progress: timelineSection.endSec > timelineSection.startSec
          ? clamp01((timeSec - timelineSection.startSec) / (timelineSection.endSec - timelineSection.startSec))
          : 0,
      }
    : source.currentResolvedSection
      && timeSec >= source.currentResolvedSection.startSec
      && timeSec <= source.currentResolvedSection.endSec
      ? source.currentResolvedSection
      : null
  const activeSection = resolveLaserDmxFrameSection(frame, { ...source, currentResolvedSection }, timeSec)
  const hasFallbackSignal = bpm > 0 || volume > 0 || bass > 0 || mid > 0 || high > 0 || activeSection != null

  return {
    ...DEFAULT_MI_FRAME,
    ...source,
    timeSec,
    frameId: source.frameId > 0 ? source.frameId : hasFallbackSignal ? 1 : 0,
    sourceId: source.sourceId ?? trackKey,
    trackId: source.trackId ?? trackKey,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      ...source.bands,
      bass: Math.max(clamp01(source.bands.bass), bass),
      lowMid: Math.max(clamp01(source.bands.lowMid), mid),
      mid: Math.max(clamp01(source.bands.mid), mid),
      high: Math.max(clamp01(source.bands.high), high),
      volume: Math.max(clamp01(source.bands.volume), volume),
      normalizedBass: Math.max(clamp01(source.bands.normalizedBass), bass),
      normalizedLowMid: Math.max(clamp01(source.bands.normalizedLowMid), mid),
      normalizedMid: Math.max(clamp01(source.bands.normalizedMid), mid),
      normalizedHigh: Math.max(clamp01(source.bands.normalizedHigh), high),
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      ...source.rhythm,
      bpm,
      bpmConfidence: Math.max(clamp01(source.rhythm.bpmConfidence), bpm > 0 ? 0.75 : 0),
      beatPhase,
      beatHit,
      beatIndex,
      beatInBar,
      barIndex,
      downbeatHit,
      phrase4Progress: phraseProgress(4),
      phrase8Progress: phraseProgress(8),
      phrase16Progress: phraseProgress(16),
      phrase32Progress: phraseProgress(32),
      phrase4Hit: source.frameId > 0 ? source.rhythm.phrase4Hit : phraseHit(4),
      phrase8Hit: source.frameId > 0 ? source.rhythm.phrase8Hit : phraseHit(8),
      phrase16Hit: source.frameId > 0 ? source.rhythm.phrase16Hit : phraseHit(16),
      phrase32Hit: source.frameId > 0 ? source.rhythm.phrase32Hit : phraseHit(32),
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      ...source.energy,
      instant: Math.max(clamp01(source.energy.instant), volume),
      shortTerm: Math.max(clamp01(source.energy.shortTerm), volume),
      rms: Math.max(clamp01(source.energy.rms), volume),
    },
    section: activeSection ?? {
      ...DEFAULT_MI_FRAME.section,
      ...source.section,
    },
    harmonic: {
      ...DEFAULT_MI_FRAME.harmonic,
      ...source.harmonic,
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      ...source.stems,
    },
    lyrics: {
      ...DEFAULT_MI_FRAME.lyrics,
      ...source.lyrics,
    },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      ...source.semantics,
    },
    resolvedSections: authoritativeTimeline,
    currentResolvedSection,
    phraseMarkers: source.phraseMarkers ?? frame.trackAnalysis?.phrases ?? [],
    semanticMoments: source.semanticMoments ?? frame.trackAnalysis?.semanticMoments ?? [],
    gridConfidence: source.gridConfidence ?? frame.trackAnalysis?.musicalGrid?.confidence ?? null,
    analysisSource: source.analysisSource ?? 'none',
    analysisCapabilities: source.analysisCapabilities,
    analysisRevision: source.analysisRevision ?? null,
    timelineRevision: source.timelineRevision ?? null,
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      ...source.capabilities,
      liveBands: Boolean(source.capabilities?.liveBands || volume > 0),
      rhythmEvents: Boolean(source.capabilities?.rhythmEvents || beatHit),
      beatGrid: Boolean(source.capabilities?.beatGrid || bpm > 0),
      sections: Boolean(source.capabilities?.sections || activeSection != null || (frame.trackSections?.length ?? 0) > 0),
    },
    raw: {
      freqData: source.raw?.freqData ?? frame.freqData,
      timeDomainData: source.raw?.timeDomainData ?? frame.timeDomainData,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      ...source.confidence,
      rhythm: Math.max(clamp01(source.confidence.rhythm), bpm > 0 ? 0.75 : 0),
    },
  }
}

export function shouldRenderLaserDmx(isPlaying: boolean): boolean {
  return isPlaying
}

let prevFogTimeSec = -1
const showDirectorRuntimeByContext = new WeakMap<CanvasRenderingContext2D, ShowDirectorRuntime>()
const pausedAudioTimeByContext = new WeakMap<CanvasRenderingContext2D, number>()
const pendingPausedDiscontinuityByContext = new WeakSet<CanvasRenderingContext2D>()
const performanceContextByCanvas = new WeakMap<CanvasRenderingContext2D, LaserDmxShowDirectorPerformanceTimingContext>()
const performanceStatusCanvas = new WeakSet<CanvasRenderingContext2D>()
const laserDmxWebGLRuntimeByContext = new WeakMap<CanvasRenderingContext2D, LaserDmxWebGLRuntime>()
const laserDmxWebGLUnavailableContexts = new WeakSet<CanvasRenderingContext2D>()

export interface LaserDmxRendererBoundaryOptions {
  /** Offscreen previews must never arm, submit to, stop, or disarm physical output. */
  affectProductionOutput?: boolean
}

export function shouldAffectLaserDmxProductionOutput(params: Pick<ReactRenderParams, 'thumbnailLaserDmxSettings'>): boolean {
  return params.thumbnailLaserDmxSettings == null
}

function getShowDirectorRuntime(ctx: CanvasRenderingContext2D): ShowDirectorRuntime {
  const current = showDirectorRuntimeByContext.get(ctx)
  if (current) return current
  const created = createShowDirectorRuntime()
  showDirectorRuntimeByContext.set(ctx, created)
  return created
}

function getLaserDmxWebGLRuntime(ctx: CanvasRenderingContext2D): LaserDmxWebGLRuntime | null {
  const current = laserDmxWebGLRuntimeByContext.get(ctx)
  if (current) return current
  if (laserDmxWebGLUnavailableContexts.has(ctx)) return null
  const created = LaserDmxWebGLRuntime.create(ctx)
  if (!created) {
    laserDmxWebGLUnavailableContexts.add(ctx)
    return null
  }
  laserDmxWebGLRuntimeByContext.set(ctx, created)
  return created
}

function disposeLaserDmxWebGLRuntime(ctx: CanvasRenderingContext2D): void {
  const runtime = laserDmxWebGLRuntimeByContext.get(ctx)
  runtime?.dispose('release-resources')
  laserDmxWebGLRuntimeByContext.delete(ctx)
}

function resetLaserDmxTransientRuntimeState(): void {
  resetBeamMatrixCompilerState()
  resetFogState()
  prevFogTimeSec = -1
}

function resetLaserDmxRuntimeState(reason?: LaserDmxRendererResetReason, ctx?: CanvasRenderingContext2D): void {
  resetLaserDmxTransientRuntimeState()
  if (ctx) {
    resetShowDirectorRuntime(getShowDirectorRuntime(ctx))
    pausedAudioTimeByContext.delete(ctx)
    pendingPausedDiscontinuityByContext.delete(ctx)
    performanceContextByCanvas.delete(ctx)
    laserDmxWebGLRuntimeByContext.get(ctx)?.reset()
    if (performanceStatusCanvas.has(ctx)) {
      performanceStatusCanvas.delete(ctx)
      clearLaserDmxShowDirectorPerformanceRuntimeStatus()
    }
  }
  if (reason === 'contextLost') {
    productionOutputController.handleRendererCrash('LaserDMX canvas context lost')
  }
}

/**
 * Wipes output and resets the Beam Matrix compiler. The renderer owns no rAF loop;
 * the parent React canvas remains the sole scheduler, so pause is a true stop.
 */
export function clearLaserDmxVisualState(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  options: LaserDmxRendererBoundaryOptions = {},
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, W, H)
  ctx.restore()
  getLaserDmxRendererLifecycle(ctx, reason => resetLaserDmxRuntimeState(reason, ctx)).pause()
  if (options.affectProductionOutput !== false) {
    productionOutputController.transportStopped('LaserDMX rendering stopped')
  }
  resetLaserDmxRuntimeState(undefined, ctx)
}

/**
 * Holds the last virtual frame during a user pause while making the physical
 * output boundary fail dark. No canvas clear occurs, so pause remains a visual
 * frame hold rather than a transport reset.
 */
export function pauseLaserDmxRenderer(
  ctx: CanvasRenderingContext2D,
  audioTimeSec: number,
  options: LaserDmxRendererBoundaryOptions = {},
): void {
  const canonicalAudioTime = Math.max(0, Number.isFinite(audioTimeSec) ? audioTimeSec : 0)
  const previousPausedTime = pausedAudioTimeByContext.get(ctx)
  if (previousPausedTime != null && Math.abs(canonicalAudioTime - previousPausedTime) > 0.001) {
    pendingPausedDiscontinuityByContext.add(ctx)
  }
  pausedAudioTimeByContext.set(ctx, canonicalAudioTime)
  getLaserDmxRendererLifecycle(ctx, reason => resetLaserDmxRuntimeState(reason, ctx)).pause()
  if (options.affectProductionOutput !== false) {
    productionOutputController.transportStopped('LaserDMX playback paused')
  }
}

/** @internal Retains seeks observed during pause until Show Director can rebuild on resume. */
export function consumeLaserDmxTimingDiscontinuity(
  ctx: CanvasRenderingContext2D,
  frameTimingDiscontinuity: boolean | undefined,
): boolean {
  const pausedDiscontinuity = pendingPausedDiscontinuityByContext.has(ctx)
  pendingPausedDiscontinuityByContext.delete(ctx)
  pausedAudioTimeByContext.delete(ctx)
  return Boolean(frameTimingDiscontinuity || pausedDiscontinuity)
}

/** Releases context listeners and transient state for thumbnail/unmount cleanup. */
export function disposeLaserDmxRenderer(
  ctx: CanvasRenderingContext2D,
  options: LaserDmxRendererBoundaryOptions = {},
): void {
  if (options.affectProductionOutput !== false) {
    productionOutputController.transportStopped('LaserDMX renderer disposed')
  }
  disposeLaserDmxRendererLifecycle(ctx)
  resetLaserDmxRuntimeState(undefined, ctx)
  disposeLaserDmxWebGLRuntime(ctx)
  laserDmxWebGLUnavailableContexts.delete(ctx)
  showDirectorRuntimeByContext.delete(ctx)
}

export function enforceLaserDmxFinalBlackoutAuthority<T extends { output: { blackout: boolean } }>(
  authoritative: T,
  evaluated: T,
): T {
  return authoritative.output.blackout && !evaluated.output.blackout
    ? { ...evaluated, output: { ...evaluated.output, blackout: true } }
    : evaluated
}

export function applyShowDirectorPerformanceGlobalOverrides(
  beamMatrix: ReturnType<typeof compileLaserDmxShowDirectorToBeamMatrix>,
  overrides: LaserDmxShowDirectorGlobalOutputOverrides,
): ReturnType<typeof compileLaserDmxShowDirectorToBeamMatrix> {
  const dimmer = overrides.dimmer == null ? 1 : clamp01(overrides.dimmer)
  const haze = overrides.haze == null ? null : clamp01(overrides.haze)
  return {
    ...beamMatrix,
    output: {
      ...beamMatrix.output,
      masterDimmer: clamp01(beamMatrix.output.masterDimmer * dimmer),
      blackout: beamMatrix.output.blackout || overrides.blackout === true,
      backgroundFade: overrides.backgroundFade == null ? beamMatrix.output.backgroundFade : clamp01(overrides.backgroundFade),
      beamPersistence: overrides.beamPersistence == null ? beamMatrix.output.beamPersistence : clamp01(overrides.beamPersistence),
      globalBeamWidth: overrides.globalBeamWidth == null ? beamMatrix.output.globalBeamWidth : Math.max(0.1, Math.min(6, overrides.globalBeamWidth)),
      globalGlow: overrides.globalGlow == null ? beamMatrix.output.globalGlow : clamp01(overrides.globalGlow),
      globalStrobeRate: overrides.globalStrobeRate == null ? beamMatrix.output.globalStrobeRate : clamp01(overrides.globalStrobeRate),
    },
    fog: haze == null
      ? beamMatrix.fog
      : {
          ...beamMatrix.fog,
          enabled: haze > 0.01,
          density: haze * 0.62,
          opacity: haze * 0.52,
          beamScatter: haze * 0.78,
          turbulence: Math.min(beamMatrix.fog.turbulence, 0.18),
        },
  }
}

export function renderLaserDmx(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  _sectionType: ReactSectionType | null,
): void {
  const { W, H } = frame
  if (!W || !H) return

  if (!shouldRenderLaserDmx(frame.isPlaying)) {
    clearLaserDmxVisualState(ctx, W, H)
    return
  }

  const state = useReactStore.getState()
  const affectProductionOutput = shouldAffectLaserDmxProductionOutput(params)
  const busMi = AudioFeatureBus.getFrame()
  const mi = resolveLaserDmxMusicIntelligenceFrame(frame, busMi)
  const authoritativeSections = mi.resolvedSections?.length ? mi.resolvedSections : frame.trackSections
  const trackKey = frame.trackKey ?? mi.trackId ?? mi.sourceId
  const beamMatrixAuthoringMode = state.laserDmxBeamMatrixAuthoringMode === 'showDirector'
    ? 'showDirector'
    : 'manual'
  const lifecycle = getLaserDmxRendererLifecycle(ctx, reason => resetLaserDmxRuntimeState(reason, ctx))
  if (!lifecycle.sync({
    isPlaying: frame.isPlaying,
    trackKey,
    presetKey: `${preset.id}:beamMatrix:${beamMatrixAuthoringMode}`,
  })) return

  // The audio engine playhead is the only Show Director clock. Wall time is intentionally excluded.
  const timeSec = Math.max(0, frame.audioTime)
  const authoredSettings = params.thumbnailLaserDmxSettings ?? state.laserDmxSettings
  const actionEvents = params.thumbnailLaserDmxSettings
    ? []
    : params.performanceActionEvents && params.performanceActionEvents.length > 0
      ? params.performanceActionEvents
      : params.performanceActionEvent ? [params.performanceActionEvent] : []
  const actionResult = applyLaserDmxPerformanceActions(authoredSettings, actionEvents)
  const resolvedAuthoredSettings = resolveProductionLookTransitionRuntime(actionResult.settings)
  const timingDiscontinuity = consumeLaserDmxTimingDiscontinuity(ctx, frame.timingDiscontinuity)
  const performanceState = state.laserDmxShowDirectorPerformance
  const previousPerformanceContext = performanceContextByCanvas.get(ctx) ?? null
  const loopWrapped = previousPerformanceContext != null && timeSec + 0.05 < previousPerformanceContext.audioTimeSec
  const performanceContext = buildLaserDmxShowDirectorPerformanceContext({
    audioTimeSec: timeSec,
    frame: mi,
    analysis: frame.trackAnalysis,
    resolvedSections: authoritativeSections,
    durationSec: Math.max(
      finiteNumber(frame.trackAnalysis?.durationMs, 0) / 1000,
      authoritativeSections?.reduce((maximum, section) => Math.max(maximum, finiteNumber(section.endSec, 0)), 0) ?? 0,
    ),
    trackIdentity: trackKey,
    seekIdentity: timingDiscontinuity ? `seek:${timeSec.toFixed(4)}` : previousPerformanceContext?.seekIdentity ?? 'seek:initial',
    loopIdentity: loopWrapped ? `loop:${timeSec.toFixed(4)}` : previousPerformanceContext?.loopIdentity ?? 'loop:initial',
    trackChangeIdentity: trackKey ?? 'track:none',
    timingDiscontinuityIdentity: timingDiscontinuity ? `discontinuity:${timeSec.toFixed(4)}` : 'continuous',
    previous: previousPerformanceContext,
  })
  performanceContextByCanvas.set(ctx, performanceContext)

  const shouldResolvePerformance = beamMatrixAuthoringMode === 'showDirector'
    && params.thumbnailLaserDmxSettings == null
    && performanceState.enabled
    && performanceState.activeProgramDefinition != null
  const performanceResolution = shouldResolvePerformance
    ? resolveLaserDmxShowDirectorPerformance({
        authoredShowDirector: state.laserDmxShowDirector,
        program: performanceState.activeProgramDefinition,
        context: performanceContext,
        tuning: performanceState.tuning,
        programSeed: performanceState.deterministicSeed,
        enabled: performanceState.enabled,
        audioIntelligenceEnabled: performanceState.audioIntelligenceEnabled,
        fallbackBehavior: performanceState.fallbackBehavior,
        runtimeInvalidationId: performanceState.runtimeInvalidationId,
        transportDiscontinuityIdentity: `${performanceContext.seekIdentity}:${performanceContext.loopIdentity}:${performanceContext.timingDiscontinuityIdentity}`,
      })
    : null
  const showDirectorRuntimeRig = performanceResolution?.showDirector ?? state.laserDmxShowDirector
  const sceneDeltaTimeSec = previousPerformanceContext && !loopWrapped
    ? Math.max(0, Math.min(0.1, timeSec - previousPerformanceContext.audioTimeSec))
    : 1 / 60
  // Build the engine-neutral geometry frame from continuous Show Director
  // coordinates before the compatibility compiler rounds fixtures into 15 × 10.
  const unresolvedSceneFrame = beamMatrixAuthoringMode === 'showDirector'
    ? createLaserDmxSceneFrame({
        showDirector: showDirectorRuntimeRig,
        evaluatedBeamMatrix: state.laserDmxBeamMatrix,
        audioTimeSec: timeSec,
        deltaTimeSec: sceneDeltaTimeSec,
        isPlaying: frame.isPlaying,
        timingDiscontinuity,
        trackKey: trackKey ?? null,
        bpm: frame.bpm,
        beatIndex: performanceContext.absoluteBeat,
        barIndex: performanceContext.absoluteBar,
        phraseIndex: performanceContext.phraseIndex,
        section: performanceContext.sectionType,
        sectionProgress: performanceContext.sectionProgress,
        energy: performanceContext.energy,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      })
    : null
  let renderBeamMatrix = beamMatrixAuthoringMode === 'showDirector'
    ? compileLaserDmxShowDirectorToBeamMatrix({
        showDirector: showDirectorRuntimeRig,
        beamMatrix: state.laserDmxBeamMatrix,
        analysis: frame.trackAnalysis,
        sections: authoritativeSections,
        cueMarkers: useVisualStore.getState().cueMarkers.filter(marker => cueMarkerBelongsToTrack(marker, trackKey)),
        fixturePriorityById: performanceResolution?.fixturePriorityById,
        fixturePriorityRoleById: performanceResolution?.fixturePriorityRoleById,
      })
    : state.laserDmxBeamMatrix
  if (performanceResolution) {
    renderBeamMatrix = applyShowDirectorPerformanceGlobalOverrides(renderBeamMatrix, performanceResolution.requestedGlobalOutputOverrides)
    publishLaserDmxShowDirectorPerformanceRuntimeStatus(
      performanceState.activeProgramDefinition?.name ?? performanceState.activeProgramId ?? 'Performance Show',
      performanceResolution,
      performanceState.activeProgramId,
      performanceContext,
    )
    performanceStatusCanvas.add(ctx)
  } else if (params.thumbnailLaserDmxSettings == null && performanceStatusCanvas.has(ctx)) {
    performanceStatusCanvas.delete(ctx)
    clearLaserDmxShowDirectorPerformanceRuntimeStatus()
  }
  const directorPresetKey = `${preset.id}:beamMatrix:${beamMatrixAuthoringMode}:${state.activeLaserDmxBeamMatrixPresetId ?? 'custom'}:${performanceState.runtimeInvalidationId}:${resolvedAuthoredSettings.rigId ?? 'rig'}`
  const director = evaluateShowDirector(getShowDirectorRuntime(ctx), {
    settings: resolvedAuthoredSettings,
    beamMatrix: renderBeamMatrix,
    audioTimeSec: timeSec,
    isPlaying: frame.isPlaying,
    timingDiscontinuity,
    bpm: frame.bpm,
    analysis: frame.trackAnalysis,
    sections: authoritativeSections,
    trackKey,
    presetKey: directorPresetKey,
    manualRequest: resolvedAuthoredSettings.runtime?.showDirectorManualRequest as { cueId: string; sequence: number } | undefined,
    musicIntelligence: mi.frameId > 0 ? mi : null,
  })
  if (director.timingDiscontinuity) resetLaserDmxTransientRuntimeState()
  const finalBeamMatrix = enforceLaserDmxFinalBlackoutAuthority(renderBeamMatrix, director.beamMatrix)
  const personalization = resolveLaserDmxPersonalization(useBrandKitStore.getState().activeKit, preset.id)

  if (affectProductionOutput) {
    productionOutputController.transportStopped('Beam Matrix has no patched production output frame')
  }

  const sceneFrame = unresolvedSceneFrame
    ? resolveLaserDmxSceneFrameOutput(unresolvedSceneFrame, finalBeamMatrix)
    : null
  const requestedRenderer = showDirectorRuntimeRig.settings.rendererMode
  if (sceneFrame && requestedRenderer !== 'canvas2d' && params.thumbnailLaserDmxSettings == null) {
    const webglRuntime = getLaserDmxWebGLRuntime(ctx)
    const backend = resolveLaserDmxRendererBackend(requestedRenderer, {
      webgl2: webglRuntime != null,
      contextLost: webglRuntime?.contextLost ?? false,
    })
    if (backend === 'webgl' && webglRuntime) {
      const result = webglRuntime.render(sceneFrame)
      if (result.ok) return
      if (!result.recoverable) {
        disposeLaserDmxWebGLRuntime(ctx)
        laserDmxWebGLUnavailableContexts.add(ctx)
      }
    }
  } else {
    if (laserDmxWebGLRuntimeByContext.has(ctx)) disposeLaserDmxWebGLRuntime(ctx)
    if (requestedRenderer === 'canvas2d') laserDmxWebGLUnavailableContexts.delete(ctx)
  }

  const compiled = compileLaserDmxBeamMatrix({
    settings: finalBeamMatrix,
    mi,
    timeSec,
    canvasWidth: W,
    canvasHeight: H,
    personalization,
  })
  const out = compiled.output
  const fadeAlpha = clamp01(out.backgroundFade) * (0.3 + 0.7 * clamp01(1 - out.beamPersistence))
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.max(0.01, fadeAlpha)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  if (out.blackout) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    return
  }

  const fogDt = prevFogTimeSec >= 0 ? Math.max(0, Math.min(0.1, timeSec - prevFogTimeSec)) : 1 / 60
  prevFogTimeSec = timeSec
  renderFog(ctx, W, H, compiled.fog, compiled.beams, fogDt)
  renderLaserDmxBeamMatrix(
    ctx,
    W,
    H,
    out,
    compiled.beams,
    clamp01(params.intensity),
    clamp01(params.glow),
    false,
  )

}
