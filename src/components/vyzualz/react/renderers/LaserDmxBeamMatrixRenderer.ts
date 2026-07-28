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
 * The caller supplies a backend-neutral, fully resolved preview result. This
 * renderer does not own React preview trims, authored master values, or safety.
 * Motion, bass reactivity, and fog remain Beam Matrix/compiler-owned domains.
 */

import type { CompiledLaserDmxMatrixBeam, CompiledLaserDmxBeamMatrixOutput } from './LaserDmxBeamMatrixCompiler'
import { computeLineGeometry, computeConeGeometry } from './LaserDmxBeamGeometry'

// ── Internal helpers ──────────────────────────────────────────────────────────

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }

export interface LaserDmxBeamVisualProfile {
  glowWidth: number
  glowAlpha: number
  bodyWidth: number
  bodyAlpha: number
  coreWidth: number
  coreAlpha: number
  coreWhiteMix: number
  coneAlpha: number
  sourceRadius: number
  sourceAlpha: number
  headRadius: number
}

export const LASER_DMX_BEAM_VISUAL_PROFILES: Readonly<Record<CompiledLaserDmxMatrixBeam['visualRole'], LaserDmxBeamVisualProfile>> = Object.freeze({
  hero: {
    glowWidth: 4.8, glowAlpha: 0.13, bodyWidth: 1.72, bodyAlpha: 0.88,
    coreWidth: 0.48, coreAlpha: 0.98, coreWhiteMix: 0.28, coneAlpha: 0.62,
    sourceRadius: 3.2, sourceAlpha: 0.94, headRadius: 2.6,
  },
  primary: {
    glowWidth: 4.1, glowAlpha: 0.1, bodyWidth: 1.5, bodyAlpha: 0.8,
    coreWidth: 0.4, coreAlpha: 0.88, coreWhiteMix: 0.16, coneAlpha: 0.5,
    sourceRadius: 2.7, sourceAlpha: 0.82, headRadius: 2.35,
  },
  secondary: {
    glowWidth: 3.1, glowAlpha: 0.07, bodyWidth: 1.16, bodyAlpha: 0.62,
    coreWidth: 0.3, coreAlpha: 0.68, coreWhiteMix: 0.08, coneAlpha: 0.34,
    sourceRadius: 2.2, sourceAlpha: 0.68, headRadius: 2,
  },
  texture: {
    glowWidth: 2.2, glowAlpha: 0.035, bodyWidth: 0.82, bodyAlpha: 0.4,
    coreWidth: 0.2, coreAlpha: 0.42, coreWhiteMix: 0, coneAlpha: 0.2,
    sourceRadius: 1.75, sourceAlpha: 0.48, headRadius: 1.65,
  },
  impact: {
    glowWidth: 5.2, glowAlpha: 0.15, bodyWidth: 1.9, bodyAlpha: 0.9,
    coreWidth: 0.58, coreAlpha: 1, coreWhiteMix: 0.58, coneAlpha: 0.68,
    sourceRadius: 3.7, sourceAlpha: 1, headRadius: 3,
  },
})

function profileFor(beam: CompiledLaserDmxMatrixBeam): LaserDmxBeamVisualProfile {
  return LASER_DMX_BEAM_VISUAL_PROFILES[beam.visualRole] ?? LASER_DMX_BEAM_VISUAL_PROFILES.primary
}

function mixedCoreColor(beam: CompiledLaserDmxMatrixBeam, whiteMix: number, alpha: number): string {
  const mix = clamp01(whiteMix)
  const { r, g, b } = beam.rgba
  const channel = (value: number) => Math.round(value + (255 - value) * mix)
  return `rgba(${channel(r)},${channel(g)},${channel(b)},${clamp01(alpha).toFixed(3)})`
}

function focusScale(beam: CompiledLaserDmxMatrixBeam): number {
  return 0.58 + clamp01(beam.focus) * 0.42
}

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
  const profile = profileFor(beam)
  const gAlpha = alpha * profile.glowAlpha * beam.glow
  if (gAlpha < 0.005) return

  ctx.globalAlpha = gAlpha
  ctx.lineWidth   = Math.max(0.5, beam.beamWidth * profile.glowWidth * beam.glow / focusScale(beam))
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
  const profile = profileFor(beam)

  ctx.globalAlpha = alpha * profile.bodyAlpha
  ctx.lineWidth   = Math.max(0.35, beam.beamWidth * profile.bodyWidth * focusScale(beam))
  ctx.shadowColor = beam.colorCss
  ctx.shadowBlur  = 3.5 * beam.glow * (1.15 - clamp01(beam.focus) * 0.35)
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
  const profile = profileFor(beam)

  ctx.globalAlpha = 1
  ctx.lineWidth   = Math.max(0.42, beam.beamWidth * profile.coreWidth * focusScale(beam))
  ctx.strokeStyle = mixedCoreColor(beam, profile.coreWhiteMix, alpha * profile.coreAlpha)
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
  const profile = profileFor(beam)

  const { quad, len } = geom
  if (len < 0.5) return

  // Gradient along beam axis: dark at origin, saturated midpoint, dim at target
  const grad = ctx.createLinearGradient(vo.x, vo.y, vt.x, vt.y)
  const { r, g, b } = beam.rgba
  grad.addColorStop(0,    `rgba(${r},${g},${b},0)`)
  grad.addColorStop(0.15, `rgba(${r},${g},${b},${(alpha * profile.coneAlpha).toFixed(3)})`)
  grad.addColorStop(0.5,  `rgba(${r},${g},${b},${(alpha * profile.coneAlpha * 0.62).toFixed(3)})`)
  grad.addColorStop(1,    `rgba(${r},${g},${b},${(alpha * profile.coneAlpha * 0.2).toFixed(3)})`)

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
  centreGrad.addColorStop(0.1, mixedCoreColor(beam, profile.coreWhiteMix * 0.45, alpha * profile.coreAlpha * 0.9))
  centreGrad.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * profile.coneAlpha * 0.7).toFixed(3)})`)
  centreGrad.addColorStop(1,   `rgba(${r},${g},${b},${(alpha * profile.coneAlpha * 0.12).toFixed(3)})`)

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
    haloGrad.addColorStop(0.2, `rgba(${r},${g},${b},${(alpha * beam.glow * profile.glowAlpha * 0.8).toFixed(3)})`)
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

// ── Head glow rendering ───────────────────────────────────────────────────────

/**
 * Draw a radial head flare at the beam's leading edge.
 * Position: always the target-facing end of the visible beam segment.
 */
function drawHeadGlow(
  ctx:       CanvasRenderingContext2D,
  beam:      CompiledLaserDmxMatrixBeam,
  intensity: number,
): void {
  if (beam.headIntensity <= 0.01) return
  const alpha = clamp01(intensity * beam.rgba.a * beam.headIntensity)
  if (alpha < 0.01) return

  const pt = beam.visibleTarget
  const { r, g, b } = beam.rgba
  const profile = profileFor(beam)
  const radius = Math.max(1.5, beam.beamWidth * profile.headRadius)

  const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius)
  grad.addColorStop(0,   mixedCoreColor(beam, Math.max(0.35, profile.coreWhiteMix), alpha * profile.coreAlpha))
  grad.addColorStop(0.3, `rgba(${r},${g},${b},${(alpha * profile.bodyAlpha).toFixed(3)})`)
  grad.addColorStop(1,   `rgba(${r},${g},${b},0)`)

  ctx.beginPath()
  ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
}

interface SourceBloomEntry {
  beam: CompiledLaserDmxMatrixBeam
  intensity: number
}

function sourceBloomKey(beam: CompiledLaserDmxMatrixBeam): string {
  if (beam.groupId) return beam.groupId
  return `${Math.round(beam.origin.x * 2) / 2}:${Math.round(beam.origin.y * 2) / 2}`
}

function roleWeight(role: CompiledLaserDmxMatrixBeam['visualRole']): number {
  switch (role) {
    case 'impact': return 5
    case 'hero': return 4
    case 'primary': return 3
    case 'secondary': return 2
    case 'texture': return 1
  }
}

function collectSourceBlooms(
  beams: CompiledLaserDmxMatrixBeam[],
  intensityScale: number,
): SourceBloomEntry[] {
  const bySource = new Map<string, SourceBloomEntry>()
  for (const beam of beams) {
    if (!beam.strobeVisible) continue
    const intensity = clamp01(beam.intensity * intensityScale * beam.rgba.a)
    if (intensity < 0.01) continue
    const key = sourceBloomKey(beam)
    const previous = bySource.get(key)
    if (!previous
      || roleWeight(beam.visualRole) > roleWeight(previous.beam.visualRole)
      || (roleWeight(beam.visualRole) === roleWeight(previous.beam.visualRole) && intensity > previous.intensity)) {
      bySource.set(key, { beam, intensity })
    } else if (intensity > previous.intensity) {
      previous.intensity = intensity
    }
  }
  return [...bySource.values()]
}

function drawSourceBloom(ctx: CanvasRenderingContext2D, entry: SourceBloomEntry): void {
  const { beam, intensity } = entry
  const profile = profileFor(beam)
  const { x, y } = beam.origin
  const { r, g, b } = beam.rgba
  const tightness = focusScale(beam)
  const haloRadius = Math.max(2.5, beam.beamWidth * profile.sourceRadius * (1.2 - tightness * 0.18))
  const coreRadius = Math.max(0.65, Math.min(1.8, haloRadius * 0.24))
  const alpha = clamp01(intensity * profile.sourceAlpha)

  const halo = ctx.createRadialGradient(x, y, coreRadius * 0.4, x, y, haloRadius)
  halo.addColorStop(0, mixedCoreColor(beam, Math.max(0.25, profile.coreWhiteMix), alpha))
  halo.addColorStop(0.22, `rgba(${r},${g},${b},${(alpha * 0.72).toFixed(3)})`)
  halo.addColorStop(0.58, `rgba(${r},${g},${b},${(alpha * 0.18).toFixed(3)})`)
  halo.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = mixedCoreColor(beam, Math.max(0.42, profile.coreWhiteMix), alpha)
  ctx.beginPath()
  ctx.arc(x, y, coreRadius, 0, Math.PI * 2)
  ctx.fill()
}

// ── Pulse train segment helpers ───────────────────────────────────────────────

/**
 * Create a temporary beam-like object with segment endpoints derived from fracs.
 * The frac endpoints are interpolated between the beam's full origin→target path.
 */
function segmentBeam(
  beam:       CompiledLaserDmxMatrixBeam,
  startFrac:  number,
  endFrac:    number,
): CompiledLaserDmxMatrixBeam {
  const ox = beam.origin.x, oy = beam.origin.y
  const tx = beam.target.x, ty = beam.target.y
  return {
    ...beam,
    visibleOrigin: { x: ox + (tx - ox) * startFrac, y: oy + (ty - oy) * startFrac, z: 0 },
    visibleTarget: { x: ox + (tx - ox) * endFrac,   y: oy + (ty - oy) * endFrac,   z: 0 },
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
 * Beam intensity and glow are already resolved by the canonical presentation contract.
 * @param showDebug   When true, overlays diagnostic text.
 */
export function renderLaserDmxBeamMatrix(
  ctx:            CanvasRenderingContext2D,
  W:              number,
  H:              number,
  output:         CompiledLaserDmxBeamMatrixOutput,
  beams:          CompiledLaserDmxMatrixBeam[],
  showDebug:      boolean,
): void {
  if (beams.length === 0) return

  // Partition beams by geometry type. Expand pulse train beams into segments.
  const lineBeams:    CompiledLaserDmxMatrixBeam[] = []
  const coneBeams:    CompiledLaserDmxMatrixBeam[] = []
  const headGlowBeams: CompiledLaserDmxMatrixBeam[] = []
  for (const beam of beams) {
    if (!beam.strobeVisible) continue
    if (beam.geometry === 'volumetricCone') {
      coneBeams.push(beam)
    } else if (beam.pulseSegments && beam.pulseSegments.length > 0) {
      // Expand each pulse segment into a virtual beam
      for (const seg of beam.pulseSegments) {
        lineBeams.push(segmentBeam(beam, seg.startFrac, seg.endFrac))
      }
    } else {
      lineBeams.push(beam)
    }
    if (beam.headIntensity > 0.01) headGlowBeams.push(beam)
  }

  // ── Volumetric cones (rendered first, behind sharp line cores) ────────────
  if (coneBeams.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap  = 'round'
    for (const beam of coneBeams) {
      drawVolumetricCone(ctx, beam, clamp01(beam.intensity))
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
      drawLineGlow(ctx, beam, clamp01(beam.intensity))
    }
    ctx.restore()

    // Pass B: saturated beam body. source-over preserves hue separation in dense scenes.
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineCap = 'round'
    for (const beam of lineBeams) {
      drawLineBody(ctx, beam, clamp01(beam.intensity))
    }
    ctx.restore()

    // Pass C: thin white/tinted core (screen composite)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.lineCap = 'round'
    for (const beam of lineBeams) {
      drawLineCore(ctx, beam, clamp01(beam.intensity))
    }
    ctx.restore()
  }

  // ── Pass D: one tight source bloom per fixture origin ─────────────────────
  // Multiple rays commonly share an origin. Deduplicating here prevents their
  // halos from stacking into a large diffuse cloud while retaining a bright,
  // readable attachment point for every active fixture bank.
  const sourceBlooms = collectSourceBlooms(beams, 1)
  if (sourceBlooms.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (const entry of sourceBlooms) drawSourceBloom(ctx, entry)
    ctx.restore()
  }

  // ── Pass E: head glow at beam leading edge ────────────────────────────────
  if (headGlowBeams.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (const beam of headGlowBeams) {
      if (!beam.strobeVisible) continue
      drawHeadGlow(ctx, beam, clamp01(beam.intensity))
    }
    ctx.restore()
  }

  // ── Debug overlay ─────────────────────────────────────────────────────────
  if (showDebug) {
    drawDebugOverlay(ctx, W, beams, output)
  }
}
