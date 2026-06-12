// LaserDMX virtual canvas renderer.
// Reads LaserDmxSettings from the Zustand store singleton and MI from
// AudioFeatureBus — no prop-threading needed, same pattern as the canvas loop.
// Never writes to Zustand. Zero allocations outside of compileLaserDmxFrame.

import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { AudioFeatureBus } from '../../../../features/musicIntelligence/AudioFeatureBus'
import { useReactStore } from '../../../../stores/reactStore'
import { compileLaserDmxFrame } from './LaserDmxCompiler'
import type { LaserDmxFixtureFrame } from '../ReactTypes'
import { clamp, clamp01 } from './LaserDmxCompiler'

// ── Drawing helpers ───────────────────────────────────────────────────────────

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

  // Layer 1 — wide soft glow
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = color
  ctx.lineWidth   = width * 6 * glow
  ctx.globalAlpha = alpha * 0.18 * glow
  ctx.shadowBlur  = 0
  ctx.lineCap     = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()

  // Layer 2 — medium colored stroke
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

  // Layer 3 — thin bright core
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

// Path kinds that render as connected curves rather than individual beams-to-origin
const CONNECTED_PATH_KINDS = new Set(['circle', 'spiral', 'lissajous', 'grid', 'constellation', 'tunnel', 'svgPath', 'textPath'])

function renderFixtureFrame(
  ctx:     CanvasRenderingContext2D,
  frame:   LaserDmxFixtureFrame,
  glowAmt: number,
  beamWidthGlobal: number,
  showFixtureOrigins: boolean,
  showPathPoints:     boolean,
  pathKind: string,
): void {
  if (!frame.visual.strobeVisible) return
  if (frame.visual.points.length === 0) return

  const { origin, points, color, rgba, intensity, beamWidth } = frame.visual
  const bw   = beamWidth * beamWidthGlobal
  const glow = clamp01(glowAmt)
  const ox   = origin.x, oy = origin.y

  const isConnected = CONNECTED_PATH_KINDS.has(pathKind)

  if (isConnected) {
    // Draw connected path around the target area
    drawConnectedPath(ctx, points, color, bw * 1.5, glow, clamp01(intensity * rgba.a))
    // Also draw one representative beam from origin to first point
    if (points.length > 0) {
      drawBeam(ctx, ox, oy, points[0].x, points[0].y, color, bw * 0.8, glow, intensity * 0.5)
    }
  } else {
    // Fan / staticBeam / lineSweep / cone: draw from origin to every point
    for (const pt of points) {
      drawBeam(ctx, ox, oy, pt.x, pt.y, color, bw, glow, intensity * rgba.a)
    }
  }

  // Endpoint dots
  const dotR = Math.max(1, bw * 1.4)
  for (const pt of points) {
    drawEndDot(ctx, pt.x, pt.y, color, dotR, intensity * rgba.a * 0.9, glow)
  }

  // Debug: fixture origin marker
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

  // Debug: path point markers
  if (showPathPoints) {
    ctx.save()
    ctx.fillStyle  = '#ffff00'
    ctx.globalAlpha = 0.4
    for (const pt of points) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

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

// ── Public entry point ────────────────────────────────────────────────────────

export function renderLaserDmx(
  ctx:          CanvasRenderingContext2D,
  frame:        ReactFrameContext,
  _preset:      ReactPreset,
  params:       ReactRenderParams,
  _sectionType: ReactSectionType | null,
): void {
  const { W, H, t } = frame
  if (!W || !H) return

  // Read settings and MI without props (singleton reads — safe in rAF context)
  const settings = useReactStore.getState().laserDmxSettings
  const mi       = AudioFeatureBus.getFrame()

  // ── Background fade ────────────────────────────────────────────────────────
  const bgFade = clamp01(1 - settings.beamPersistence * 0.92)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = bgFade
  ctx.fillStyle   = '#000000'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = 1

  if (settings.blackout) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, W, H)
    return
  }

  // ── Compile fixture frames ─────────────────────────────────────────────────
  const compiled = compileLaserDmxFrame({
    settings,
    mi,
    time:        t,
    canvasWidth:  W,
    canvasHeight: H,
  })

  if (compiled.length === 0) return

  // ── Haze atmosphere layer ──────────────────────────────────────────────────
  drawHaze(ctx, W, H, settings.hazeAmount, compiled)

  // ── Draw each fixture ──────────────────────────────────────────────────────
  const glowAmt = clamp01(settings.glowAmount * params.glow)
  const bwGlobal = clamp(settings.globalBeamWidth, 0.2, 6)

  for (let i = 0; i < compiled.length; i++) {
    const f = compiled[i]
    const fixture = settings.fixtures.find(fx => fx.id === f.fixtureId)
    const pathKind = fixture?.path.kind ?? 'staticBeam'
    renderFixtureFrame(
      ctx, f,
      glowAmt,
      bwGlobal,
      settings.showFixtureOrigins ?? false,
      settings.showPathPoints     ?? false,
      pathKind,
    )
  }

  // ── Virtual DMX debug overlay (non-invasive: small top-left text) ──────────
  if (settings.showDmxDebug && compiled.length > 0) {
    ctx.save()
    ctx.globalAlpha = 0.55
    ctx.fillStyle   = 'rgba(0,0,0,0.6)'
    ctx.fillRect(4, 4, 200, compiled.length * 14 + 10)
    ctx.fillStyle   = '#00ffcc'
    ctx.font        = '10px monospace'
    compiled.forEach((f, idx) => {
      const ch = Object.values(f.channels).slice(0, 6).map(v => String(v).padStart(3)).join(' ')
      ctx.fillText(`U${f.universe} A${f.startAddress} | ${ch}`, 8, 16 + idx * 14)
    })
    ctx.restore()
  }
}
