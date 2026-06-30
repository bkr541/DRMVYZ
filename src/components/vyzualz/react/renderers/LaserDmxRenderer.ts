// LaserDMX virtual renderer entry point.
// Beam Matrix keeps its established normalized authoring renderer. Spatial
// Fixtures compile through the same DMX path, then render against the shared
// metre-based production stage with a perspective camera.

import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { useReactStore } from '../../../../stores/reactStore'
import { compileLaserDmxFrame, clamp01, resetLaserDmxCompilerState } from './LaserDmxCompiler'
import type { CompiledGlobal } from './LaserDmxCompiler'
import { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } from './LaserDmxBeamMatrixCompiler'
import { renderLaserDmxBeamMatrix } from './LaserDmxBeamMatrixRenderer'
import { renderFog, resetFogState } from './LaserDmxFogRenderer'
import { useBrandKitStore } from '../../../../features/personalization/brandKitStore'
import { resolveLaserDmxPersonalization } from '../../../../features/personalization/laserDmxPersonalization'
import { buildProductionRig } from '../LaserDmxProductionRig'
import { resolveProductionLookTransitionRuntime } from './LaserDmxProductionLookEngine'
import { renderLaserDmxSpatialStage } from './LaserDmxSpatialStageRenderer'
import {
  disposeLaserDmxRendererLifecycle,
  getLaserDmxRendererLifecycle,
  type LaserDmxRendererResetReason,
} from './LaserDmxRendererLifecycle'
import { resetMovingHeadRuntime } from './LaserDmxMovingHeadEngine'
import { pauseProductionAtmosphere, resetProductionAtmosphereRuntime, resumeProductionAtmosphere, stepProductionAtmosphere } from './LaserDmxAtmosphereEngine'
import { createShowDirectorRuntime, evaluateShowDirector, resetShowDirectorRuntime, type ShowDirectorRuntime } from './LaserDmxShowDirector'
import { productionOutputController } from '../output/ProductionOutput'
import { applyLaserDmxPerformanceActions } from './LaserDmxPerformanceActionEngine'

/** Returns true when the LaserDMX renderer should draw. */
export const LASER_DMX_VIRTUAL_CAPTURE_LAYERS = [
  'stage', 'lasers', 'movingHeads', 'washes', 'ledBars', 'persistentHaze', 'localizedFog', 'cryoPlumes', 'flashImpacts',
] as const

export function shouldRenderLaserDmx(isPlaying: boolean): boolean {
  return isPlaying
}

let prevFogTimeSec = -1
let prevSpatialTimeSec = -1
const showDirectorRuntimeByContext = new WeakMap<CanvasRenderingContext2D, ShowDirectorRuntime>()
const pausedAudioTimeByContext = new WeakMap<CanvasRenderingContext2D, number>()
const pendingPausedDiscontinuityByContext = new WeakSet<CanvasRenderingContext2D>()

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

function resetLaserDmxTransientRuntimeState(): void {
  resetLaserDmxCompilerState()
  resetBeamMatrixCompilerState()
  resetFogState()
  resetMovingHeadRuntime()
  resetProductionAtmosphereRuntime({ consumeExistingRequests: true })
  prevFogTimeSec = -1
  prevSpatialTimeSec = -1
}

function resetLaserDmxRuntimeState(reason?: LaserDmxRendererResetReason, ctx?: CanvasRenderingContext2D): void {
  resetLaserDmxTransientRuntimeState()
  if (ctx) {
    resetShowDirectorRuntime(getShowDirectorRuntime(ctx))
    pausedAudioTimeByContext.delete(ctx)
    pendingPausedDiscontinuityByContext.delete(ctx)
  }
  if (reason === 'contextLost') {
    productionOutputController.handleRendererCrash('LaserDMX canvas context lost')
  }
}

/**
 * Wipes output and resets both compiler branches. The renderer owns no rAF loop;
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
  if (prevSpatialTimeSec >= 0) pauseProductionAtmosphere(prevSpatialTimeSec)
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
  pauseProductionAtmosphere(canonicalAudioTime)
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
  showDirectorRuntimeByContext.delete(ctx)
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
  const workspaceMode = params.thumbnailLaserDmxSettings
    ? 'spatialFixtures'
    : state.laserDmxWorkspaceMode
  const mi = AudioFeatureBus.getFrame()
  const trackKey = frame.trackKey ?? mi.trackId ?? mi.sourceId
  const lifecycle = getLaserDmxRendererLifecycle(ctx, reason => resetLaserDmxRuntimeState(reason, ctx))
  if (!lifecycle.sync({
    isPlaying: frame.isPlaying,
    trackKey,
    presetKey: `${preset.id}:${workspaceMode}`,
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
  const directorPresetKey = `${preset.id}:${workspaceMode}:${state.activeLaserDmxBeamMatrixPresetId ?? 'custom'}:${resolvedAuthoredSettings.rigId ?? 'rig'}`
  const timingDiscontinuity = consumeLaserDmxTimingDiscontinuity(ctx, frame.timingDiscontinuity)
  const director = evaluateShowDirector(getShowDirectorRuntime(ctx), {
    settings: resolvedAuthoredSettings,
    beamMatrix: state.laserDmxBeamMatrix,
    audioTimeSec: timeSec,
    isPlaying: frame.isPlaying,
    timingDiscontinuity,
    bpm: frame.bpm,
    analysis: frame.trackAnalysis,
    sections: frame.trackSections,
    trackKey,
    presetKey: directorPresetKey,
    manualRequest: resolvedAuthoredSettings.runtime?.showDirectorManualRequest as { cueId: string; sequence: number } | undefined,
    musicIntelligence: mi.frameId > 0 ? mi : null,
  })
  if (director.timingDiscontinuity) resetLaserDmxTransientRuntimeState()
  const personalization = resolveLaserDmxPersonalization(useBrandKitStore.getState().activeKit, preset.id)

  if (workspaceMode === 'beamMatrix') {
    if (affectProductionOutput) {
      productionOutputController.transportStopped('Beam Matrix has no patched production output frame')
    }
    const bmSettings = director.beamMatrix
    const compiled = compileLaserDmxBeamMatrix({
      settings: bmSettings,
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
    return
  }

  const settings = director.settings
  const compiled = compileLaserDmxFrame({
    settings,
    mi,
    timeSec,
    canvasWidth: W,
    canvasHeight: H,
    personalization,
  })
  if (affectProductionOutput) {
    productionOutputController.submitFrame(compiled.outputFrame, compiled.productionRig)
  }
  const global: CompiledGlobal = compiled.global
  const fadeAlpha = clamp01(global.backgroundFade) * (0.3 + 0.7 * clamp01(1 - global.beamPersistence))
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.max(0.01, fadeAlpha)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  const rig = buildProductionRig(settings)
  resumeProductionAtmosphere(timeSec)
  const rawSpatialDt = prevSpatialTimeSec >= 0 ? timeSec - prevSpatialTimeSec : 1 / 60
  const seeked = director.timingDiscontinuity || rawSpatialDt < -0.001 || rawSpatialDt > 0.75
  const atmosphere = stepProductionAtmosphere({ settings, timeSec, dt: Math.max(0, Math.min(0.1, rawSpatialDt)), seeked })
  prevSpatialTimeSec = timeSec

  // Blackout masks visible output only. The stage, moving heads, and atmosphere
  // continue advancing so a subsequent reveal does not jump or replay effects.
  if (global.blackout) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    return
  }

  renderLaserDmxSpatialStage({
    ctx,
    W,
    H,
    dpr: frame.dpr,
    rig,
    settings,
    frames: compiled.fixtures,
    glowAmount: clamp01(global.glowAmount * params.glow),
    hazeAmount: global.hazeAmount,
    atmosphere,
  })

  if (settings.showDmxDebug && compiled.fixtures.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.64
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(4, 4, 244, compiled.fixtures.length * 14 + 26)
    ctx.fillStyle = '#00ffcc'
    ctx.font = '10px monospace'
    ctx.fillText(`3D stage ${rig.stage.dimensions.width}×${rig.stage.dimensions.height}×${rig.stage.dimensions.depth}m · atmosphere ${atmosphere.particles.length}/${atmosphere.budget}`, 8, 16)
    const actionDiagnostic = actionResult.diagnostics.find(item => item.severity === 'warning')
    if (actionDiagnostic) ctx.fillText(`Action: ${actionDiagnostic.message}`, 8, 28)
    compiled.fixtures.forEach((fixture, index) => {
      const channels = Object.values(fixture.channels).slice(0, 6).map(value => String(value).padStart(3)).join(' ')
      ctx.fillText(`U${fixture.universe} A${fixture.startAddress} | ${channels}`, 8, 30 + index * 14)
    })
    ctx.restore()
  }
}
