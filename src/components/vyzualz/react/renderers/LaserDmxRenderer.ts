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
import { renderLaserDmxSpatialStage } from './LaserDmxSpatialStageRenderer'
import {
  disposeLaserDmxRendererLifecycle,
  getLaserDmxRendererLifecycle,
} from './LaserDmxRendererLifecycle'

/** Returns true when the LaserDMX renderer should draw. */
export function shouldRenderLaserDmx(isPlaying: boolean): boolean {
  return isPlaying
}

let prevFogTimeSec = -1

function resetLaserDmxRuntimeState(): void {
  resetLaserDmxCompilerState()
  resetBeamMatrixCompilerState()
  resetFogState()
  prevFogTimeSec = -1
}

/**
 * Wipes output and resets both compiler branches. The renderer owns no rAF loop;
 * the parent React canvas remains the sole scheduler, so pause is a true stop.
 */
export function clearLaserDmxVisualState(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, W, H)
  ctx.restore()
  getLaserDmxRendererLifecycle(ctx, resetLaserDmxRuntimeState).pause()
  resetLaserDmxRuntimeState()
}

/** Releases context listeners and transient state for thumbnail/unmount cleanup. */
export function disposeLaserDmxRenderer(ctx: CanvasRenderingContext2D): void {
  disposeLaserDmxRendererLifecycle(ctx)
  resetLaserDmxRuntimeState()
}

export function renderLaserDmx(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  _sectionType: ReactSectionType | null,
): void {
  const { W, H, t } = frame
  if (!W || !H) return

  if (!shouldRenderLaserDmx(frame.isPlaying)) {
    clearLaserDmxVisualState(ctx, W, H)
    return
  }

  const state = useReactStore.getState()
  const workspaceMode = params.thumbnailLaserDmxSettings
    ? 'spatialFixtures'
    : state.laserDmxWorkspaceMode
  const mi = AudioFeatureBus.getFrame()
  const trackKey = mi.trackId ?? mi.sourceId
  const lifecycle = getLaserDmxRendererLifecycle(ctx, resetLaserDmxRuntimeState)
  if (!lifecycle.sync({
    isPlaying: frame.isPlaying,
    trackKey,
    presetKey: `${preset.id}:${workspaceMode}`,
  })) return

  const timeSec = frame.timeSec ?? (t / 60)
  const personalization = resolveLaserDmxPersonalization(useBrandKitStore.getState().activeKit, preset.id)

  if (workspaceMode === 'beamMatrix') {
    const bmSettings = state.laserDmxBeamMatrix
    const compiled = compileLaserDmxBeamMatrix({
      settings: bmSettings,
      mi,
      time: t,
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

  const settings = params.thumbnailLaserDmxSettings ?? state.laserDmxSettings
  const compiled = compileLaserDmxFrame({
    settings,
    mi,
    time: t,
    timeSec,
    canvasWidth: W,
    canvasHeight: H,
    personalization,
  })
  const global: CompiledGlobal = compiled.global
  const fadeAlpha = clamp01(global.backgroundFade) * (0.3 + 0.7 * clamp01(1 - global.beamPersistence))
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.max(0.01, fadeAlpha)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  if (global.blackout) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    return
  }

  const rig = buildProductionRig(settings)
  renderLaserDmxSpatialStage({
    ctx,
    W,
    H,
    rig,
    settings,
    frames: compiled.fixtures,
    glowAmount: clamp01(global.glowAmount * params.glow),
    hazeAmount: global.hazeAmount,
  })

  if (settings.showDmxDebug && compiled.fixtures.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.64
    ctx.fillStyle = 'rgba(0,0,0,0.72)'
    ctx.fillRect(4, 4, 244, compiled.fixtures.length * 14 + 26)
    ctx.fillStyle = '#00ffcc'
    ctx.font = '10px monospace'
    ctx.fillText(`3D stage ${rig.stage.dimensions.width}×${rig.stage.dimensions.height}×${rig.stage.dimensions.depth}m`, 8, 16)
    compiled.fixtures.forEach((fixture, index) => {
      const channels = Object.values(fixture.channels).slice(0, 6).map(value => String(value).padStart(3)).join(' ')
      ctx.fillText(`U${fixture.universe} A${fixture.startAddress} | ${channels}`, 8, 30 + index * 14)
    })
    ctx.restore()
  }
}
