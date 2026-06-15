/**
 * Beam Matrix Canvas2D renderer.
 *
 * Renders CompiledLaserDmxMatrixBeam[] onto the main output canvas.
 * Never writes to Zustand. Never creates offscreen canvases per-frame.
 * No endpoint dots. No grid dots. No editor guides.
 *
 * Render order (per spec):
 *   1. Background fade + persistence  (caller: renderLaserDmxBeamMatrix)
 *   2. Blackout check                 (caller)
 *   3. Base fog density               (via renderFog — called before this)
 *   4. Broad volumetric beam scatter  (inside renderFog)
 *   5. Volumetric cone bodies         (drawVolumetricCone)
 *   6. Line beam glow                 (drawLineBeam — layer 1)
 *   7. Bright beam bodies             (drawLineBeam — layer 2)
 *   8. Thin white/tinted cores        (drawLineBeam — layer 3)
 *   9. Foreground fog wisps           (inside renderFog)
 *  10. Debug info (when enabled)
 *
 * Line beams are rendered in three layered passes to allow batching of like
 * layers before ctx.save()/restore() operations, reducing state-switch cost
 * at high beam counts.  Batching pattern:
 *   Pass A (glow):  all glow layers for all beams
 *   Pass B (body):  all body layers
 *   Pass C (core):  all core layers
 *
 * Volumetric cones are rendered before line glow so they appear "behind"
 * the sharp line cores.
 *
 * Relationship to global React params:
 *   - params.intensity: scales the final master-dimmer contribution from the
 *     React-wide intensity slider (kept intentional, maps linearly).
 *   - params.glow: scales effectiveGlow; user can turn glow fully off here.
 *   - params.motion: NOT applied to Beam Matrix (motion alters coordinate
 *     paths, which are explicitly saved grid positions — must not move).
 *   - params.bassReactivity: NOT applied (Beam Matrix has its own group routes).
 *   - params.fogDensity: NOT applied (Beam Matrix has its own fog.density setting).
 */

import type { CompiledLaserDmxMatrixBeam, CompiledLaserDmxBeamMatrixOutput } from './LaserDmxBeamMatrixCompiler'
import { computeLineGeometry, computeConeGeometry } from './LaserDmxBeamGeometry'

// ── Internal helpers ──────────────────────────────────────────────────────────

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }

// ── Line beam rendering (3-pass batched) ──────────────────────────────────────

/**
 * Draw a single beam's glow layer.
 * Called in a batched glow pass; ctx must already be in screen composite mode.
 */
function drawLineGlow(
  ctx:       CanvasRenderingContext2D,
  beam:      CompiledLaserDmxMatrixBeam,
  intensity: number,
): void {
  const { x1, y1, x2, y2 } = computeLineGeometry(
    beam.visibleOrigin.x, beam.visibleOrigin.y,
    beam.visibleTarget.x, beam.visibleTarget.y,
  )
  const alpha  = clamp01(intensity * beam.rgba.a)
  const gAlpha = alpha * 0.18 * beam.glow
  if (gAlpha < 0.005) return

  ctx.globalAlpha = gAlpha
  ctx.lineWidth   = beam.beamWidth * 7 * beam.glow
  ctx.strokeStyle = beam.colorCss
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

/** Draw a single beam's saturated body layer. */
function drawLineBody(
  ctx:       CanvasRenderingContext2D,
  beam:      CompiledLaserDmxMatrixBeam,
  intensity: number,
): void {
  const { x1, y1, x2, y2 } = computeLineGeometry(
    beam.visibleOrigin.x, beam.visibleOrigin.y,
    beam.visibleTarget.x, beam.visibleTarget.y,
  )
  const alpha = clamp01(intensity * beam.rgba.a)
  if (alpha < 0.005) return

  ctx.globalAlpha = alpha * 0.70
  ctx.lineWidth   = beam.beamWidth * 2
  ctx.shadowColor = beam.colorCss
  ctx.shadowBlur  = 10 * beam.glow
  ctx.strokeStyle = beam.colorCss
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.shadowBlur = 0
}

/** Draw a single beam's thin bright core. */
function drawLineCore(
  ctx:       CanvasRenderingContext2D,
  beam:      CompiledLaserDmxMatrixBeam,
  intensity: number,
): void {
  const { x1, y1, x2, y2 } = computeLineGeometry(
    beam.visibleOrigin.x, beam.visibleOrigin.y,
    beam.visibleTarget.x, beam.visibleTarget.y,
  )
  const alpha = clamp01(intensity * beam.rgba.a)
  if (alpha < 0.005) return

  ctx.globalAlpha = 1
  ctx.lineWidth   = Math.max(0.5, beam.beamWidth * 0.35)
  ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// ── Volumetric cone rendering ─────────────────────────────────────────────────

function drawVolumetricCone(
  ctx:  CanvasRenderingContext2D,
  beam: CompiledLaserDmxMatrixBeam,
  intensity: number,
): void {
  const vo = beam.visibleOrigin
  const vt = beam.visibleTarget
  const geom = computeConeGeometry(
    vo.x, vo.y, vo.z,
    vt.x, vt.y, vt.z,
    beam.beamWidth,
    beam.divergence,
  )

  const alpha = clamp01(intensity * beam.rgba.a)
  if (alpha < 0.005) return

  const { quad, len } = geom
  if (len < 0.5) return

  // Gradient along beam axis: dark at origin, saturated midpoint, dim at target
  const grad = ctx.createLinearGradient(vo.x, vo.y, vt.x, vt.y)
  const { r, g, b } = beam.rgba
  grad.addColorStop(0,    `rgba(${r},${g},${b},0)`)
  grad.addColorStop(0.15, `rgba(${r},${g},${b},${(alpha * 0.6).toFixed(3)})`)
  grad.addColorStop(0.5,  `rgba(${r},${g},${b},${(alpha * 0.4).toFixed(3)})`)
  grad.addColorStop(1,    `rgba(${r},${g},${b},${(alpha * 0.15).toFixed(3)})`)

  // Outer body (gradient fill)
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 1
  ctx.fillStyle   = grad
  ctx.beginPath()
  ctx.moveTo(quad[0].x, quad[0].y)
  ctx.lineTo(quad[1].x, quad[1].y)
  ctx.lineTo(quad[2].x, quad[2].y)
  ctx.lineTo(quad[3].x, quad[3].y)
  ctx.closePath()
  ctx.fill()

  // Brighter centre strip (60% width)
  const halfW  = geom.originHalfWidth * 0.6
  const tHalfW = geom.targetHalfWidth * 0.6
  const { nx, ny } = geom
  const centreGrad = ctx.createLinearGradient(vo.x, vo.y, vt.x, vt.y)
  centreGrad.addColorStop(0,   `rgba(${r},${g},${b},0)`)
  centreGrad.addColorStop(0.1, `rgba(${r},${g},${b},${(alpha * 0.9).toFixed(3)})`)
  centreGrad.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * 0.5).toFixed(3)})`)
  centreGrad.addColorStop(1,   `rgba(${r},${g},${b},${(alpha * 0.1).toFixed(3)})`)

  ctx.fillStyle = centreGrad
  ctx.beginPath()
  ctx.moveTo(vo.x - nx * halfW,  vo.y - ny * halfW)
  ctx.lineTo(vo.x + nx * halfW,  vo.y + ny * halfW)
  ctx.lineTo(vt.x + nx * tHalfW, vt.y + ny * tHalfW)
  ctx.lineTo(vt.x - nx * tHalfW, vt.y - ny * tHalfW)
  ctx.closePath()
  ctx.fill()

  // Glow halo around the cone (soft extra fill)
  if (beam.glow > 0.05) {
    const haloGrad = ctx.createLinearGradient(vo.x, vo.y, vt.x, vt.y)
    haloGrad.addColorStop(0,   `rgba(${r},${g},${b},0)`)
    haloGrad.addColorStop(0.2, `rgba(${r},${g},${b},${(alpha * beam.glow * 0.12).toFixed(3)})`)
    haloGrad.addColorStop(1,   `rgba(${r},${g},${b},0)`)
    const hW = geom.targetHalfWidth * 1.8
    ctx.fillStyle = haloGrad
    ctx.beginPath()
    ctx.moveTo(vo.x - nx * geom.originHalfWidth * 1.5, vo.y - ny * geom.originHalfWidth * 1.5)
    ctx.lineTo(vo.x + nx * geom.originHalfWidth * 1.5, vo.y + ny * geom.originHalfWidth * 1.5)
    ctx.lineTo(vt.x + nx * hW, vt.y + ny * hW)
    ctx.lineTo(vt.x - nx * hW, vt.y - ny * hW)
    ctx.closePath()
    ctx.fill()
  }
}

// ── Debug overlay ─────────────────────────────────────────────────────────────

function drawDebugOverlay(
  ctx:        CanvasRenderingContext2D,
  W:          number,
  beams:      CompiledLaserDmxMatrixBeam[],
  output:     CompiledLaserDmxBeamMatrixOutput,
): void {
  ctx.save()
  ctx.globalAlpha = 0.7
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle   = 'rgba(0,0,0,0.55)'
  ctx.fillRect(4, 4, 220, 58)
  ctx.fillStyle = '#00ffcc'
  ctx.font      = '10px monospace'
  ctx.fillText(`BM Beams: ${beams.length}  master: ${output.masterDimmer.toFixed(2)}`, 8, 18)
  const active  = beams.filter(b => b.strobeVisible).length
  const cones   = beams.filter(b => b.geometry === 'volumetricCone').length
  ctx.fillText(`Active: ${active}  Cones: ${cones}  Lines: ${beams.length - cones}`, 8, 32)
  const groups  = new Set(beams.map(b => b.groupId).filter(Boolean)).size
  ctx.fillText(`Groups active: ${groups}  W: ${W}`, 8, 46)
  ctx.restore()
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Render the compiled Beam Matrix frame.
 * Caller is responsible for background fade, blackout check, and fog (via renderFog).
 *
 * @param ctx         Main output canvas context.
 * @param W, H        Canvas dimensions.
 * @param output      Compiled global output settings.
 * @param beams       Array of compiled beams.
 * @param intensityScale  React-wide intensity multiplier (0–1).
 * @param glowScale       React-wide glow multiplier (0–1).
 * @param showDebug   When true, overlays diagnostic text.
 */
export function renderLaserDmxBeamMatrix(
  ctx:            CanvasRenderingContext2D,
  W:              number,
  H:              number,
  output:         CompiledLaserDmxBeamMatrixOutput,
  beams:          CompiledLaserDmxMatrixBeam[],
  intensityScale: number,
  glowScale:      number,
  showDebug:      boolean,
): void {
  if (beams.length === 0) return

  // Partition beams by geometry type
  const lineBeams: CompiledLaserDmxMatrixBeam[] = []
  const coneBeams: CompiledLaserDmxMatrixBeam[] = []
  for (const beam of beams) {
    if (!beam.strobeVisible) continue
    if (beam.geometry === 'volumetricCone') coneBeams.push(beam)
    else lineBeams.push(beam)
  }

  // ── Volumetric cones (rendered first, behind sharp line cores) ────────────
  if (coneBeams.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap  = 'round'
    for (const beam of coneBeams) {
      const effectiveGlow = clamp01(beam.glow * glowScale)
      const beamWithGlow  = effectiveGlow !== beam.glow
        ? { ...beam, glow: effectiveGlow }
        : beam
      drawVolumetricCone(ctx, beamWithGlow, clamp01(beam.intensity * intensityScale))
    }
    ctx.restore()
  }

  // ── Line beams: batched 3-pass ────────────────────────────────────────────
  if (lineBeams.length > 0) {
    // Pass A: glow (wide soft layer, screen composite)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap = 'round'
    for (const beam of lineBeams) {
      const eg = clamp01(beam.glow * glowScale)
      drawLineGlow(ctx, eg !== beam.glow ? { ...beam, glow: eg } : beam, clamp01(beam.intensity * intensityScale))
    }
    ctx.restore()

    // Pass B: saturated beam body (screen composite)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap = 'round'
    for (const beam of lineBeams) {
      const eg = clamp01(beam.glow * glowScale)
      drawLineBody(ctx, eg !== beam.glow ? { ...beam, glow: eg } : beam, clamp01(beam.intensity * intensityScale))
    }
    ctx.restore()

    // Pass C: thin white/tinted core (screen composite)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap = 'round'
    for (const beam of lineBeams) {
      drawLineCore(ctx, beam, clamp01(beam.intensity * intensityScale))
    }
    ctx.restore()
  }

  // ── Debug overlay ─────────────────────────────────────────────────────────
  if (showDebug) {
    drawDebugOverlay(ctx, W, beams, output)
  }
}
