// LaserDMX virtual canvas renderer — mode-branching entry point.
//
// LaserDMX renders only the SELECTED workspace mode each frame:
//
//   if (workspaceMode === 'beamMatrix') {
//     compile and render Beam Matrix only → return
//   }
//   compile and render Spatial Fixtures only
//
// The inactive mode is never compiled or rendered.  Both modes share the
// existing two-level playback gate (shouldRenderLaserDmx /
// clearLaserDmxVisualState); clearLaserDmxVisualState now also resets the
// Beam Matrix compiler state and fog animation state.
//
// Reads from Zustand once per frame (singleton read — safe in rAF context).
// Never writes to Zustand.
//
// Relationship to global React params (params.*):
//   Spatial Fixtures: unchanged from previous behaviour.
//   Beam Matrix:
//     - params.intensity → scales master dimmer contribution (documented).
//     - params.glow      → scales beam glow (documented).
//     - params.motion    → NOT applied (beam coordinates are saved positions).
//     - params.bassReactivity → NOT applied (Beam Matrix has its own group routes).
//     - params.fogDensity    → NOT applied (Beam Matrix has dedicated fog settings).

import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { useReactStore } from '../../../../stores/reactStore'
import { compileLaserDmxFrame } from './LaserDmxCompiler'
import type { LaserDmxFixtureFrame } from '../ReactTypes'
import type { CompiledGlobal } from './LaserDmxCompiler'
import { clamp, clamp01, resetLaserDmxCompilerState } from './LaserDmxCompiler'
import { compileLaserDmxBeamMatrix, resetBeamMatrixCompilerState } from './LaserDmxBeamMatrixCompiler'
import { renderLaserDmxBeamMatrix } from './LaserDmxBeamMatrixRenderer'
import { renderFog, resetFogState } from './LaserDmxFogRenderer'
import { useBrandKitStore } from '../../../../features/personalization/brandKitStore'
import { resolveLaserDmxPersonalization } from '../../../../features/personalization/laserDmxPersonalization'

// ── Drawing helpers (Spatial Fixtures — unchanged) ────────────────────────────

function drawBeam(
  ctx:       CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  color:     string,
  width:     number,
  glow:      number,
  intensity: number,
): void {
  if (intensity < 0.001) return
  const alpha = clamp01(intensity)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineWidth   = width * 6 * glow
  ctx.globalAlpha = alpha * 0.18 * glow
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineWidth   = width * 2
  ctx.globalAlpha = alpha * 0.65
  ctx.shadowColor = color
  ctx.shadowBlur  = 10 * glow
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`
  ctx.lineWidth   = Math.max(0.5, width * 0.35)
  ctx.globalAlpha = 1
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()
}

function drawEndDot(
  ctx:       CanvasRenderingContext2D,
  x: number, y: number,
  color:     string,
  r:         number,
  intensity: number,
  glow:      number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = clamp01(intensity)
  ctx.shadowColor = color
  ctx.shadowBlur  = 12 * glow
  ctx.fillStyle   = color
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawConnectedPath(
  ctx:    CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  color:  string,
  width:  number,
  glow:   number,
  alpha:  number,
): void {
  if (points.length < 2) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineWidth   = width
  ctx.globalAlpha = alpha
  ctx.shadowColor = color
  ctx.shadowBlur  = 8 * glow
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
  ctx.restore()
}

const CONNECTED_PATH_KINDS = new Set(['circle', 'spiral', 'lissajous', 'grid', 'constellation', 'tunnel', 'svgPath', 'textPath'])

function renderFixtureFrame(
  ctx:                CanvasRenderingContext2D,
  frame:              LaserDmxFixtureFrame,
  glowAmt:            number,
  showFixtureOrigins: boolean,
  showPathPoints:     boolean,
  pathKind:           string,
): void {
  if (!frame.visual.strobeVisible) return
  if (frame.visual.points.length === 0) return

  const { origin, points, color, rgba, intensity, beamWidth, focusFactor } = frame.visual
  const bw  = beamWidth
  const focusedGlow = clamp01(glowAmt * lerp(1.0, 0.15, clamp01(focusFactor)))
  const ox  = origin.x, oy = origin.y

  const isConnected = CONNECTED_PATH_KINDS.has(pathKind)

  if (isConnected) {
    drawConnectedPath(ctx, points, color, bw * 1.5, focusedGlow, clamp01(intensity * rgba.a))
    if (points.length > 0) {
      drawBeam(ctx, ox, oy, points[0].x, points[0].y, color, bw * 0.8, focusedGlow, intensity * 0.5)
    }
  } else {
    for (const pt of points) {
      drawBeam(ctx, ox, oy, pt.x, pt.y, color, bw, focusedGlow, intensity * rgba.a)
    }
  }

  const dotR = Math.max(1, bw * 1.4)
  for (const pt of points) {
    drawEndDot(ctx, pt.x, pt.y, color, dotR, intensity * rgba.a * 0.9, focusedGlow)
  }

  if (showFixtureOrigins) {
    ctx.save()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 1
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(ox, oy, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy)
    ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8)
    ctx.stroke()
    ctx.restore()
  }

  if (showPathPoints) {
    ctx.save()
    ctx.fillStyle   = '#ffff00'
    ctx.globalAlpha = 0.4
    for (const pt of points) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * clamp01(t) }

function drawHaze(
  ctx:        CanvasRenderingContext2D,
  W: number,  H: number,
  hazeAmount: number,
  frames:     LaserDmxFixtureFrame[],
): void {
  if (hazeAmount < 0.01 || frames.length === 0) return
  const alpha = hazeAmount * 0.06
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = alpha
  for (const f of frames) {
    if (!f.visual.strobeVisible) continue
    const { origin, rgba } = f.visual
    const grad = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, Math.max(W, H) * 0.55)
    grad.addColorStop(0, `rgba(${rgba.r},${rgba.g},${rgba.b},0.5)`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  }
  ctx.restore()
}

// ── Playback gate ─────────────────────────────────────────────────────────────

/** Returns true when the LaserDMX renderer should draw. */
export function shouldRenderLaserDmx(isPlaying: boolean): boolean {
  return isPlaying
}

// Module-level fog dt tracking — gives real frame delta instead of a constant.
let prevFogTimeSec = -1

/**
 * Wipes all LaserDMX canvas output and resets all compiler / fog state.
 * Covers both workspace modes: resets Spatial Fixtures compiler dt,
 * Beam Matrix compiler dt + trigger envelopes, and fog animation state.
 */
export function clearLaserDmxVisualState(
  ctx: CanvasRenderingContext2D,
  W:   number,
  H:   number,
): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, W, H)
  ctx.restore()
  // Reset both mode compilers
  resetLaserDmxCompilerState()
  resetBeamMatrixCompilerState()
  // Reset fog animation so stale fog is not visible on resume
  resetFogState()
  prevFogTimeSec = -1
}

// ── Public entry point ────────────────────────────────────────────────────────

export function renderLaserDmx(
  ctx:          CanvasRenderingContext2D,
  frame:        ReactFrameContext,
  preset:       ReactPreset,
  params:       ReactRenderParams,
  _sectionType: ReactSectionType | null,
): void {
  const { W, H, t } = frame
  if (!W || !H) return

  // Level-2 playback gate (Level-1 is in ReactEngineRenderer)
  if (!shouldRenderLaserDmx(frame.isPlaying)) {
    clearLaserDmxVisualState(ctx, W, H)
    return
  }

  const timeSec = frame.timeSec ?? (t / 60)

  // Read workspace mode from store (singleton read — safe in rAF context)
  const state = useReactStore.getState()
  const workspaceMode = state.laserDmxWorkspaceMode
  // Zustand is read only at the outer render boundary. The compilers remain pure
  // and receive an immutable transient context rather than reading stores.
  const personalization = resolveLaserDmxPersonalization(useBrandKitStore.getState().activeKit, preset.id)

  // ── BEAM MATRIX mode ──────────────────────────────────────────────────────
  if (workspaceMode === 'beamMatrix') {
    const bmSettings = state.laserDmxBeamMatrix
    const mi         = AudioFeatureBus.getFrame()

    const compiled = compileLaserDmxBeamMatrix({
      settings:     bmSettings,
      mi,
      time:         t,
      timeSec,
      canvasWidth:  W,
      canvasHeight: H,
      personalization,
    })

    const out = compiled.output

    // Background fade (persistence)
    const fadeAlpha = clamp01(out.backgroundFade) *
      (0.3 + 0.7 * clamp01(1 - out.beamPersistence))
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = Math.max(0.01, fadeAlpha)
    ctx.fillStyle   = '#000000'
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1

    // Blackout
    if (out.blackout) {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      return
    }

    // Real frame delta for fog animation (clamped to avoid spikes after pause/tab-switch).
    const fogDt = prevFogTimeSec >= 0
      ? Math.min(0.1, timeSec - prevFogTimeSec)
      : 1 / 60
    prevFogTimeSec = timeSec

    // Fog (behind beams)
    renderFog(ctx, W, H, compiled.fog, compiled.beams, fogDt)

    // Beams
    // params.intensity → scales master dimmer intentionally.
    // params.glow      → scales beam glow intentionally.
    // Other params.*   → not applied to Beam Matrix (see module docblock).
    renderLaserDmxBeamMatrix(
      ctx, W, H,
      out,
      compiled.beams,
      clamp01(params.intensity),
      clamp01(params.glow),
      false, // showDebug: TODO wire to a dedicated debug toggle when needed
    )

    // Return — do NOT fall through to Spatial Fixtures rendering
    return
  }

  // ── SPATIAL FIXTURES mode (existing behaviour — unchanged) ────────────────
  const settings = params.thumbnailLaserDmxSettings ?? state.laserDmxSettings
  const mi       = AudioFeatureBus.getFrame()

  const compiled = compileLaserDmxFrame({
    settings,
    mi,
    time:    t,
    timeSec,
    canvasWidth:  W,
    canvasHeight: H,
    personalization,
  })

  const g: CompiledGlobal = compiled.global

  const fadeAlpha = clamp01(g.backgroundFade) * (0.3 + 0.7 * clamp01(1 - g.beamPersistence))
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.max(0.01, fadeAlpha)
  ctx.fillStyle   = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  if (g.blackout) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    return
  }

  if (compiled.fixtures.length === 0) return

  drawHaze(ctx, W, H, g.hazeAmount, compiled.fixtures)

  const glowAmt = clamp01(g.glowAmount * params.glow)

  for (let i = 0; i < compiled.fixtures.length; i++) {
    const f       = compiled.fixtures[i]
    const fixture = settings.fixtures.find(fx => fx.id === f.fixtureId)
    const pathKind = fixture?.path.kind ?? 'staticBeam'
    renderFixtureFrame(
      ctx, f,
      glowAmt,
      settings.showFixtureOrigins ?? false,
      settings.showPathPoints     ?? false,
      pathKind,
    )
  }

  if (settings.showDmxDebug && compiled.fixtures.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle   = 'rgba(0,0,0,0.6)'
    ctx.fillRect(4, 4, 200, compiled.fixtures.length * 14 + 10)
    ctx.fillStyle   = '#00ffcc'
    ctx.font        = '10px monospace'
    compiled.fixtures.forEach((f, idx) => {
      const ch = Object.values(f.channels).slice(0, 6).map(v => String(v).padStart(3)).join(' ')
      ctx.fillText(`U${f.universe} A${f.startAddress} | ${ch}`, 8, 16 + idx * 14)
    })
    ctx.restore()
  }
}
