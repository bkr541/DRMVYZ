import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba, seededRandom } from './reactRenderUtils'

// ── Per-canvas state ──────────────────────────────────────────────────────────

interface TunnelDot {
  x: number; y: number; z: number; hue: number
}

interface CloudParticle {
  x: number; y: number
  vx: number; vy: number
  size: number; hue: number
}

interface ShaderPadsState {
  tunnelDots: TunnelDot[]
  cloudParticles: CloudParticle[]
}

const stateMap = new WeakMap<CanvasRenderingContext2D, ShaderPadsState>()

const TUNNEL_COUNT = 220
const CLOUD_COUNT  = 90

function getState(ctx: CanvasRenderingContext2D): ShaderPadsState {
  let s = stateMap.get(ctx)
  if (!s) {
    s = {
      tunnelDots: Array.from({ length: TUNNEL_COUNT }, (_, i) => ({
        x:   (seededRandom(i * 3    ) - 0.5) * 900,
        y:   (seededRandom(i * 3 + 1) - 0.5) * 700,
        z:    seededRandom(i * 3 + 2) * 600 + 10,
        hue:  seededRandom(i * 7    ) * 60,
      })),
      cloudParticles: Array.from({ length: CLOUD_COUNT }, (_, i) => ({
        x:    seededRandom(i * 5    ) * 2 - 1,
        y:    seededRandom(i * 5 + 1) * 2 - 1,
        vx:  (seededRandom(i * 5 + 2) - 0.5) * 0.003,
        vy:  (seededRandom(i * 5 + 3) - 0.5) * 0.003,
        size: seededRandom(i * 5 + 4) * 3 + 1,
        hue:  seededRandom(i * 7    ) * 50,
      })),
    }
    stateMap.set(ctx, s)
  }
  return s
}

// ── Scene selectors ───────────────────────────────────────────────────────────

function sceneForSection(type: ReactSectionType | null): 'gradientField' | 'energyCloud' | 'dotTunnel' | 'synthSun' {
  switch (type) {
    case 'intro':     return 'gradientField'
    case 'verse':     return 'energyCloud'
    case 'build':     return 'dotTunnel'
    case 'drop':      return 'synthSun'
    case 'breakdown': return 'energyCloud'
    case 'outro':     return 'gradientField'
    default:          return 'gradientField'
  }
}

// ── Gradient field ────────────────────────────────────────────────────────────

function drawGradientField(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { W, H, t, audio } = frame
  const { primary, secondary, accent, background } = preset.palette
  const bass      = audio.bass * params.bassReactivity
  const speed     = params.motion * 0.022 + 0.004
  const glowA     = params.glow * 0.5 * intMul

  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  ctx.globalCompositeOperation = 'screen'

  const blobs = [
    { fx: 0.28, fy: 0.32, rFrac: 0.50, color: primary,   f1: 0.70, f2: 0.50 },
    { fx: 0.68, fy: 0.62, rFrac: 0.42, color: secondary, f1: 0.58, f2: 0.82 },
    { fx: 0.50, fy: 0.45, rFrac: 0.33, color: accent,    f1: 0.90, f2: 0.42 },
    { fx: 0.15, fy: 0.75, rFrac: 0.28, color: secondary, f1: 0.40, f2: 0.60 },
  ]

  for (const b of blobs) {
    const cx2 = W * (b.fx + 0.14 * Math.sin(t * speed * b.f1))
    const cy2 = H * (b.fy + 0.12 * Math.cos(t * speed * b.f2))
    const r2  = Math.max(W, H) * (b.rFrac + bass * 0.18) * intMul
    const g   = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2)
    g.addColorStop(0,   hexToRgba(b.color, glowA))
    g.addColorStop(0.5, hexToRgba(b.color, glowA * 0.35))
    g.addColorStop(1,   'transparent')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  if (frame.beatHit) {
    const fl = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55)
    fl.addColorStop(0, hexToRgba(primary, 0.14 * intMul))
    fl.addColorStop(1, 'transparent')
    ctx.fillStyle = fl
    ctx.fillRect(0, 0, W, H)
  }

  ctx.globalCompositeOperation = 'source-over'
}

// ── Energy cloud ──────────────────────────────────────────────────────────────

function drawEnergyCloud(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  state: ShaderPadsState,
  intMul: number,
): void {
  const { W, H, audio } = frame
  const { primary, secondary, background } = preset.palette
  const bass     = audio.bass * params.bassReactivity
  const motSpeed = params.motion

  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  for (const p of state.cloudParticles) {
    p.x += p.vx * (1 + bass * 3) * motSpeed
    p.y += p.vy * (1 + bass * 3) * motSpeed
    if (p.x >  1.15) p.x = -1.15
    if (p.x < -1.15) p.x =  1.15
    if (p.y >  1.15) p.y = -1.15
    if (p.y < -1.15) p.y =  1.15
  }

  const cx2 = W / 2, cy2 = H / 2
  const scale = Math.min(W, H) * 0.44
  const connDist  = (0.32 + audio.mid * 0.18 + bass * 0.14) * params.intensity
  const connDist2 = connDist * connDist

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // Connections
  for (let i = 0; i < state.cloudParticles.length; i++) {
    const pi = state.cloudParticles[i]
    const px1 = cx2 + pi.x * scale
    const py1 = cy2 + pi.y * scale
    for (let j = i + 1; j < state.cloudParticles.length; j++) {
      const pj  = state.cloudParticles[j]
      const dx  = pi.x - pj.x
      const dy  = pi.y - pj.y
      const d2  = dx * dx + dy * dy
      if (d2 > connDist2) continue
      const a   = (1 - d2 / connDist2) * 0.3 * params.glow * intMul
      ctx.strokeStyle = hexToRgba(secondary, a)
      ctx.lineWidth   = 0.9 * frame.dpr
      ctx.beginPath()
      ctx.moveTo(px1, py1)
      ctx.lineTo(cx2 + pj.x * scale, cy2 + pj.y * scale)
      ctx.stroke()
    }
  }

  // Nodes
  ctx.shadowColor = primary
  ctx.shadowBlur  = 10 * params.glow
  for (const p of state.cloudParticles) {
    const r2  = Math.max(0.5, (p.size + bass * 4) * frame.dpr * params.intensity * intMul)
    const px2 = cx2 + p.x * scale
    const py2 = cy2 + p.y * scale
    ctx.globalAlpha = 0.75 * intMul
    ctx.fillStyle   = p.hue > 30 ? secondary : primary
    ctx.beginPath(); ctx.arc(px2, py2, r2, 0, Math.PI * 2); ctx.fill()
  }

  ctx.shadowBlur  = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Dot tunnel ────────────────────────────────────────────────────────────────

function drawDotTunnel(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  state: ShaderPadsState,
  intMul: number,
): void {
  const { W, H, audio } = frame
  const { primary, secondary, background } = preset.palette
  const bass  = audio.bass * params.bassReactivity
  const speed = (params.motion * 2.0 + 0.5) * (1 + bass * 2.0) * (frame.beatHit ? 1.8 : 1.0)
  const fov   = 480

  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  const cx2 = W / 2, cy2 = H / 2

  for (const dot of state.tunnelDots) {
    dot.z -= speed
    if (dot.z < 5) {
      dot.z  = 620
      dot.x  = (Math.random() - 0.5) * 900
      dot.y  = (Math.random() - 0.5) * 700
    }
  }

  // Sort back-to-front for correct overdraw
  state.tunnelDots.sort((a, b) => b.z - a.z)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (const dot of state.tunnelDots) {
    const sc2 = fov / dot.z
    const sx  = cx2 + dot.x * sc2
    const sy  = cy2 + dot.y * sc2
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue

    const nearness = 1 - dot.z / 620
    const r2 = Math.max(0.5, 3.5 * sc2 * frame.dpr * params.intensity * intMul)
    const a  = nearness * 0.85 * params.glow * intMul
    if (a < 0.01) continue

    const col = dot.hue > 28 ? secondary : primary
    ctx.globalAlpha = a
    ctx.fillStyle   = col
    ctx.shadowColor = col
    ctx.shadowBlur  = 5 * params.glow * nearness
    ctx.beginPath(); ctx.arc(sx, sy, r2, 0, Math.PI * 2); ctx.fill()
  }

  ctx.shadowBlur  = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Synth sun ─────────────────────────────────────────────────────────────────

function drawSynthSun(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { W, H, t, audio, freqData, dpr } = frame
  const { primary, secondary, accent, background } = preset.palette
  const bass = audio.bass * params.bassReactivity
  const cx2  = W / 2, cy2 = H / 2

  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  // Core ambient glow
  const coreR = Math.min(W, H) * (0.10 + bass * 0.07) * intMul
  const coreG = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, coreR * 5)
  coreG.addColorStop(0,   hexToRgba(accent,    0.85 * intMul))
  coreG.addColorStop(0.2, hexToRgba(primary,   0.40 * intMul))
  coreG.addColorStop(0.7, hexToRgba(secondary, 0.10 * intMul))
  coreG.addColorStop(1,   'transparent')
  ctx.fillStyle = coreG
  ctx.fillRect(0, 0, W, H)

  // Frequency-mapped rays
  const rayCount = 72
  const baseLen  = Math.min(W, H) * 0.28 * intMul

  for (let i = 0; i < rayCount; i++) {
    const angle   = (i / rayCount) * Math.PI * 2 + t * 0.0006 * params.motion
    const fi      = Math.floor((i / rayCount) * (freqData ? Math.min(freqData.length, 200) : 0))
    const freqVal = freqData ? freqData[fi] / 255 : 0.5
    const len     = baseLen * (0.35 + freqVal * 0.9 + bass * 0.45)
    const glowPx  = params.glow * 18 * freqVal

    const col     = i % 3 === 0 ? accent : i % 3 === 1 ? primary : secondary
    const a       = (0.4 + freqVal * 0.5) * intMul

    ctx.strokeStyle = hexToRgba(col, a)
    ctx.shadowColor = col
    ctx.shadowBlur  = glowPx
    ctx.lineWidth   = (1.2 + freqVal * 2.0) * dpr * params.intensity
    ctx.beginPath()
    ctx.moveTo(cx2, cy2)
    ctx.lineTo(cx2 + Math.cos(angle) * len, cy2 + Math.sin(angle) * len)
    ctx.stroke()
  }

  // Inner star burst ring
  const ringR = coreR * 0.8
  ctx.strokeStyle = hexToRgba(accent, 0.6 * intMul)
  ctx.shadowColor = accent
  ctx.shadowBlur  = 20 * params.glow
  ctx.lineWidth   = 1.5 * dpr
  ctx.beginPath()
  ctx.arc(cx2, cy2, ringR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.shadowBlur  = 0
  ctx.restore()
}

// ── Public export ─────────────────────────────────────────────────────────────

export function renderShaderPads(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): void {
  const state  = getState(ctx)
  const intMul = params.intensity
  const scene  = sceneForSection(sectionType)

  switch (scene) {
    case 'energyCloud':
      drawEnergyCloud(ctx, frame, preset, params, state, intMul)
      break
    case 'dotTunnel':
      drawDotTunnel(ctx, frame, preset, params, state, intMul)
      break
    case 'synthSun':
      drawSynthSun(ctx, frame, preset, params, intMul)
      break
    default:
      drawGradientField(ctx, frame, preset, params, intMul)
  }
}
