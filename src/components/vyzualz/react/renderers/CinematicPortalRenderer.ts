import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba, seededRandom } from './reactRenderUtils'

// ── Per-canvas state ──────────────────────────────────────────────────────────

interface FogParticle {
  x: number; y: number
  vx: number; vy: number
  size: number
  alpha: number
  alphaSpeed: number
}

interface Ember {
  x: number; y: number
  vy: number; vx: number
  life: number; maxLife: number
  size: number
}

interface PortalRing {
  r: number
  maxR: number
  alpha: number
}

interface CinematicState {
  fogParticles: FogParticle[]
  embers:       Ember[]
  rings:        PortalRing[]
  cameraX:      number
  cameraY:      number
}

const stateMap = new WeakMap<CanvasRenderingContext2D, CinematicState>()

const FOG_COUNT   = 130
const EMBER_COUNT = 50
const MAX_RINGS   = 8

function createFogParticle(i: number): FogParticle {
  return {
    x:          seededRandom(i * 7    ) * 2 - 1,
    y:          seededRandom(i * 7 + 1) * 2 - 1,
    vx:        (seededRandom(i * 7 + 2) - 0.5) * 0.0006,
    vy:        (seededRandom(i * 7 + 3) - 0.5) * 0.0004,
    size:       seededRandom(i * 7 + 4) * 5 + 2,
    alpha:      seededRandom(i * 7 + 5) * 0.3 + 0.05,
    alphaSpeed: (seededRandom(i * 7 + 6) - 0.5) * 0.002,
  }
}

function createEmber(W: number, H: number): Ember {
  return {
    x:       (Math.random() - 0.5) * W * 0.6 + W * 0.5,
    y:        H * 0.8 + Math.random() * H * 0.2,
    vx:      (Math.random() - 0.5) * 0.8,
    vy:      -(Math.random() * 1.2 + 0.4),
    life:     0,
    maxLife:  Math.random() * 120 + 60,
    size:     Math.random() * 2.5 + 0.5,
  }
}

function getState(ctx: CanvasRenderingContext2D): CinematicState {
  let s = stateMap.get(ctx)
  if (!s) {
    s = {
      fogParticles: Array.from({ length: FOG_COUNT },  (_, i) => createFogParticle(i)),
      embers:       Array.from({ length: EMBER_COUNT }, () => ({
        x: 0, y: 0, vx: 0, vy: 0, life: Math.random() * 180, maxLife: 180, size: 1,
      })),
      rings:   [],
      cameraX: 0,
      cameraY: 0,
    }
    stateMap.set(ctx, s)
  }
  return s
}

// ── Scene atmosphere levels per section ───────────────────────────────────────

interface SectionAtmosphere {
  fogIntensity: number
  portalGlow:   number
  ringRate:     number
  cameraShake:  number
  emberRate:    number
}

function atmosphereForSection(type: ReactSectionType | null): SectionAtmosphere {
  switch (type) {
    case 'intro':     return { fogIntensity: 0.30, portalGlow: 0.35, ringRate: 0.02, cameraShake: 0.0, emberRate: 0.3 }
    case 'verse':     return { fogIntensity: 0.50, portalGlow: 0.55, ringRate: 0.04, cameraShake: 0.0, emberRate: 0.5 }
    case 'build':     return { fogIntensity: 0.70, portalGlow: 0.75, ringRate: 0.08, cameraShake: 0.2, emberRate: 0.7 }
    case 'drop':      return { fogIntensity: 1.00, portalGlow: 1.00, ringRate: 0.25, cameraShake: 1.0, emberRate: 1.0 }
    case 'breakdown': return { fogIntensity: 0.55, portalGlow: 0.45, ringRate: 0.03, cameraShake: 0.0, emberRate: 0.4 }
    case 'outro':     return { fogIntensity: 0.25, portalGlow: 0.28, ringRate: 0.01, cameraShake: 0.0, emberRate: 0.2 }
    default:          return { fogIntensity: 0.50, portalGlow: 0.50, ringRate: 0.05, cameraShake: 0.0, emberRate: 0.5 }
  }
}

// ── Background ────────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  atm: SectionAtmosphere,
): void {
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)

  const cx2 = W / 2, cy2 = H / 2

  // Deep space nebula blob
  const nebG = ctx.createRadialGradient(cx2, cy2 * 0.7, 0, cx2, cy2, Math.max(W, H) * 0.7)
  nebG.addColorStop(0,   hexToRgba(preset.palette.primary, 0.04 * atm.fogIntensity * params.glow))
  nebG.addColorStop(0.4, hexToRgba(preset.palette.secondary, 0.02 * atm.fogIntensity * params.glow))
  nebG.addColorStop(1,   'transparent')
  ctx.fillStyle = nebG
  ctx.fillRect(0, 0, W, H)
}

// ── Portal monolith ───────────────────────────────────────────────────────────

function drawPortal(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  bass: number,
  atm: SectionAtmosphere,
  t: number,
): void {
  const { primary, secondary, accent } = preset.palette
  const cx2    = W / 2, cy2 = H / 2
  const portalW = Math.min(W * 0.22, 180 * dpr)
  const portalH = Math.min(H * 0.58, 360 * dpr)
  const glow    = atm.portalGlow * params.glow * (1 + bass * 0.6)

  const px = cx2 - portalW / 2
  const py = cy2 - portalH / 2

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // Outer glow layers
  for (let layer = 4; layer >= 1; layer--) {
    const expand = layer * 18 * dpr * glow
    const layerA = (glow * 0.18 / layer) * params.intensity
    const layerG = ctx.createLinearGradient(px, py, px + portalW, py)
    layerG.addColorStop(0,   hexToRgba(primary, layerA))
    layerG.addColorStop(0.5, hexToRgba(secondary, layerA * 1.4))
    layerG.addColorStop(1,   hexToRgba(primary, layerA))
    ctx.fillStyle = layerG
    ctx.beginPath()
    ctx.roundRect(px - expand, py - expand, portalW + expand * 2, portalH + expand * 2, 4 * dpr)
    ctx.fill()
  }

  // Inner fill — dark with subtle radial from top
  ctx.globalCompositeOperation = 'source-over'
  const innerG = ctx.createRadialGradient(cx2, py + portalH * 0.3, 0, cx2, py + portalH * 0.5, portalH * 0.6)
  innerG.addColorStop(0,   hexToRgba(primary, 0.12 + Math.sin(t * 0.003) * 0.04))
  innerG.addColorStop(0.4, hexToRgba(preset.palette.background, 0.85))
  innerG.addColorStop(1,   hexToRgba(preset.palette.background, 0.97))
  ctx.fillStyle = innerG
  ctx.beginPath()
  ctx.rect(px, py, portalW, portalH)
  ctx.fill()

  // Edge lines
  ctx.globalCompositeOperation = 'screen'
  ctx.strokeStyle = hexToRgba(accent, 0.7 * glow)
  ctx.lineWidth   = 1.5 * dpr
  ctx.shadowColor = accent
  ctx.shadowBlur  = 16 * params.glow
  ctx.beginPath()
  ctx.rect(px, py, portalW, portalH)
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.restore()
}

// ── Expanding rings ───────────────────────────────────────────────────────────

function updateAndDrawRings(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  state: CinematicState,
  bass: number,
  beatHit: boolean,
  atm: SectionAtmosphere,
): void {
  const cx2 = W / 2, cy2 = H / 2
  const portalW = Math.min(W * 0.22, 180 * dpr)
  const portalH = Math.min(H * 0.58, 360 * dpr)

  // Spawn ring on beat or random
  const spawnChance = atm.ringRate * (1 + bass * 2)
  if ((beatHit || Math.random() < spawnChance * 0.05) && state.rings.length < MAX_RINGS) {
    state.rings.push({ r: 1, maxR: Math.max(W, H) * (0.4 + Math.random() * 0.4), alpha: 0.6 * atm.portalGlow * params.glow })
  }

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let i = state.rings.length - 1; i >= 0; i--) {
    const ring = state.rings[i]
    ring.r     += 1.5 * params.motion + bass * 3
    ring.alpha *= 0.965

    if (ring.alpha < 0.005) { state.rings.splice(i, 1); continue }

    const rx = ring.r * (portalW / portalH)  // maintain portal aspect
    const ry = ring.r

    ctx.strokeStyle = hexToRgba(preset.palette.primary, ring.alpha)
    ctx.shadowColor = preset.palette.primary
    ctx.shadowBlur  = 10 * params.glow
    ctx.lineWidth   = (1.2 + bass) * dpr
    ctx.beginPath()
    ctx.ellipse(cx2, cy2, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.shadowBlur = 0
  ctx.restore()
}

// ── Fog particles ─────────────────────────────────────────────────────────────

function updateAndDrawFog(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  state: CinematicState,
  bass: number,
  atm: SectionAtmosphere,
): void {
  const count = Math.floor(FOG_COUNT * atm.fogIntensity * params.fogDensity)
  if (count < 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (let i = 0; i < count; i++) {
    const p = state.fogParticles[i]
    p.x     += p.vx * (1 + bass) * params.motion
    p.y     += p.vy * (1 + bass) * params.motion
    p.alpha += p.alphaSpeed
    if (p.alpha > 0.45 || p.alpha < 0.02) p.alphaSpeed *= -1
    p.alpha = Math.max(0.02, Math.min(0.45, p.alpha))

    if (p.x >  1.15 || p.x < -1.15) { Object.assign(p, createFogParticle(i)); continue }
    if (p.y >  1.15 || p.y < -1.15) { Object.assign(p, createFogParticle(i)); continue }

    const px2 = (p.x + 1) * 0.5 * W
    const py2 = (p.y + 1) * 0.5 * H
    const r2  = (p.size + bass * 3) * dpr
    const g   = ctx.createRadialGradient(px2, py2, 0, px2, py2, r2 * 3)
    g.addColorStop(0, hexToRgba(preset.palette.secondary, p.alpha * atm.fogIntensity * params.glow))
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(px2, py2, r2 * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

// ── Embers ────────────────────────────────────────────────────────────────────

function updateAndDrawEmbers(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  state: CinematicState,
  bass: number,
  atm: SectionAtmosphere,
): void {
  const count = Math.floor(EMBER_COUNT * atm.emberRate * params.particleDensity)
  if (count < 1) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.shadowColor = preset.palette.accent
  ctx.shadowBlur  = 6 * params.glow

  for (let i = 0; i < count; i++) {
    const e = state.embers[i]
    e.life += 1 + bass * 2
    if (e.life >= e.maxLife) { Object.assign(e, createEmber(W, H)); continue }

    e.x  += e.vx * params.motion
    e.y  += e.vy * (1 + bass) * params.motion

    const progress = e.life / e.maxLife
    const alpha    = Math.sin(progress * Math.PI) * 0.7 * atm.emberRate * params.glow
    const r2       = e.size * (1 - progress * 0.5) * dpr

    ctx.globalAlpha = alpha
    ctx.fillStyle   = progress < 0.5 ? preset.palette.accent : preset.palette.primary
    ctx.beginPath()
    ctx.arc(e.x, e.y, r2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.shadowBlur  = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Light beams ───────────────────────────────────────────────────────────────

function drawLightBeams(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  preset: ReactPreset,
  params: ReactRenderParams,
  bass: number,
  t: number,
  atm: SectionAtmosphere,
): void {
  if (atm.portalGlow < 0.2) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  const cx2 = W / 2, cy2 = H * 0.15
  const beamCount = 7

  for (let i = 0; i < beamCount; i++) {
    const angle = ((i / beamCount) - 0.5) * 0.9 + Math.sin(t * 0.001 + i) * 0.03
    const len   = Math.max(W, H) * (0.7 + bass * 0.3)
    const endX  = cx2 + Math.sin(angle) * len
    const endY  = cy2 + Math.cos(angle) * len
    const a     = atm.portalGlow * params.glow * 0.06 * (1 + bass * 0.5)

    const g = ctx.createLinearGradient(cx2, cy2, endX, endY)
    g.addColorStop(0, hexToRgba(preset.palette.primary, a))
    g.addColorStop(1, 'transparent')

    const bw = W * 0.06 * (1 + i * 0.03)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(cx2, cy2)
    ctx.lineTo(endX - bw, endY)
    ctx.lineTo(endX + bw, endY)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

// ── Public export ─────────────────────────────────────────────────────────────

export function renderCinematicPortal(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): void {
  const { W, H, dpr, t, audio, beatHit } = frame
  const bass  = audio.bass * params.bassReactivity
  const state = getState(ctx)
  const atm   = atmosphereForSection(sectionType)

  // Camera drift for drop sections
  const shakeX = atm.cameraShake > 0 && beatHit
    ? (Math.random() - 0.5) * 6 * dpr * atm.cameraShake
    : 0
  const shakeY = atm.cameraShake > 0 && beatHit
    ? (Math.random() - 0.5) * 4 * dpr * atm.cameraShake
    : 0

  state.cameraX = state.cameraX * 0.85 + shakeX * 0.15
  state.cameraY = state.cameraY * 0.85 + shakeY * 0.15

  ctx.save()
  if (Math.abs(state.cameraX) + Math.abs(state.cameraY) > 0.1) {
    ctx.translate(state.cameraX, state.cameraY)
  }

  drawBackground(ctx, W, H, preset, params, atm)
  drawLightBeams(ctx, W, H, preset, params, bass, t, atm)
  drawPortal(ctx, W, H, dpr, preset, params, bass, atm, t)
  updateAndDrawRings(ctx, W, H, dpr, preset, params, state, bass, beatHit, atm)
  updateAndDrawFog(ctx, W, H, dpr, preset, params, state, bass, atm)
  updateAndDrawEmbers(ctx, W, H, dpr, preset, params, state, bass, atm)

  ctx.restore()
}
