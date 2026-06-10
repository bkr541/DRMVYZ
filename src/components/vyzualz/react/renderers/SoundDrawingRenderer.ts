import type { ReactPreset, ReactSectionType } from '../ReactTypes'
import type { ReactFrameContext, ReactRenderParams } from './reactRenderUtils'
import { hexToRgba, getOrCreateOffscreen } from './reactRenderUtils'

// ── Trail canvas pool (per ctx) ───────────────────────────────────────────────
const trailMap = new WeakMap<CanvasRenderingContext2D, HTMLCanvasElement>()

function getTrail(ctx: CanvasRenderingContext2D, W: number, H: number): HTMLCanvasElement {
  return getOrCreateOffscreen(trailMap, ctx, W, H)
}

// ── Mode selector ─────────────────────────────────────────────────────────────

type ScopeMode = 'waveform' | 'lissajous' | 'radialScope' | 'spiralScope'

function modeForSection(type: ReactSectionType | null): ScopeMode {
  switch (type) {
    case 'intro':     return 'waveform'
    case 'verse':     return 'waveform'
    case 'build':     return 'radialScope'
    case 'drop':      return 'lissajous'
    case 'breakdown': return 'spiralScope'
    case 'outro':     return 'waveform'
    default:          return 'waveform'
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTimeDomainNorm(timeDomainData: Uint8Array<ArrayBuffer> | null, i: number): number {
  if (!timeDomainData) return 0
  const raw = timeDomainData[i % timeDomainData.length]
  return (raw / 128.0) - 1.0  // -1..1
}

function getFreqNorm(freqData: Uint8Array<ArrayBuffer> | null, i: number): number {
  if (!freqData) return 0
  return freqData[i % freqData.length] / 255
}

// Synthetic "left/right" channels from a single analyser by splitting freq bands
function getSynthStereo(
  timeDomainData: Uint8Array<ArrayBuffer> | null,
  freqData: Uint8Array<ArrayBuffer> | null,
  i: number,
  totalPts: number,
): { x: number; y: number } {
  if (timeDomainData && timeDomainData.length >= 2) {
    const half   = Math.floor(timeDomainData.length / 2)
    const idxL   = Math.floor((i / totalPts) * half)
    const idxR   = half + Math.floor((i / totalPts) * half)
    return {
      x: (timeDomainData[idxL] / 128) - 1,
      y: (timeDomainData[idxR] / 128) - 1,
    }
  }
  // Fully synthetic fallback using harmonic offset
  const phase = (i / totalPts) * Math.PI * 2
  const bassEnergy = freqData ? freqData[4] / 255 : 0.3
  return {
    x: Math.sin(phase       + bassEnergy * 0.5),
    y: Math.sin(phase * 1.5 + bassEnergy * 0.8),
  }
}

// ── Fade trail each frame ─────────────────────────────────────────────────────

function fadeTrail(
  trailCanvas: HTMLCanvasElement,
  bgColor: string,
  decayAlpha: number,
): void {
  const tctx = trailCanvas.getContext('2d')
  if (!tctx) return
  tctx.fillStyle = hexToRgba(bgColor, Math.max(0.02, decayAlpha))
  tctx.fillRect(0, 0, trailCanvas.width, trailCanvas.height)
}

// ── Waveform mode ─────────────────────────────────────────────────────────────

function drawWaveformOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, beatHit } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 256
  const stepX = W / pts

  const lineColor = preset.palette.primary
  const glowPx    = params.glow * (12 + (beatHit ? 18 : 0)) + bass * 14

  // Multi-layer with different heights for depth
  const layers = [
    { yOff: H * 0.25, scaleY: H * 0.18, color: preset.palette.secondary, alpha: 0.4 },
    { yOff: H * 0.5,  scaleY: H * 0.24, color: lineColor,                 alpha: 0.9 },
    { yOff: H * 0.75, scaleY: H * 0.18, color: preset.palette.secondary, alpha: 0.4 },
  ]

  for (const layer of layers) {
    tctx.save()
    tctx.globalAlpha              = layer.alpha * intMul
    tctx.globalCompositeOperation = 'screen'
    tctx.strokeStyle              = layer.color
    tctx.lineWidth                = (1.2 + bass * 2) * dpr * params.intensity
    tctx.shadowColor              = layer.color
    tctx.shadowBlur               = glowPx * (layer.alpha > 0.8 ? 1 : 0.4)
    tctx.lineCap                  = 'round'
    tctx.lineJoin                 = 'round'
    tctx.beginPath()
    for (let i = 0; i <= pts; i++) {
      const v = getTimeDomainNorm(timeDomainData, i)
      const x = i * stepX
      const y = layer.yOff + v * layer.scaleY * (1 + bass * 0.5) * params.intensity
      if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
    }
    tctx.stroke()
    tctx.restore()
  }
}

// ── Lissajous mode ────────────────────────────────────────────────────────────

function drawLissajousOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, freqData, beatHit } = frame
  const bass  = audio.bass * params.bassReactivity
  const pts   = 512
  const cx2   = W / 2, cy2 = H / 2
  const scale = Math.min(W, H) * 0.42 * (1 + bass * 0.12) * params.intensity

  const glowPx = params.glow * (14 + (beatHit ? 20 : 0))
  const col    = preset.palette.primary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (0.9 + bass * 1.5) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.85 * intMul
  tctx.lineCap                  = 'round'
  tctx.lineJoin                 = 'round'
  tctx.beginPath()

  for (let i = 0; i <= pts; i++) {
    const st = getSynthStereo(timeDomainData, freqData, i, pts)
    const x  = cx2 + st.x * scale
    const y  = cy2 + st.y * scale
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.stroke()

  // Second layer — accent colour at lower opacity
  tctx.strokeStyle = preset.palette.accent
  tctx.shadowColor = preset.palette.accent
  tctx.shadowBlur  = glowPx * 0.5
  tctx.lineWidth  *= 0.4
  tctx.globalAlpha = 0.3 * intMul
  tctx.stroke()

  tctx.restore()
}

// ── Radial scope mode ─────────────────────────────────────────────────────────

function drawRadialScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, timeDomainData, beatHit } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2    = W / 2, cy2 = H / 2
  const baseR  = Math.min(W, H) * 0.3 * params.intensity
  const pts    = 256
  const glowPx = params.glow * (10 + (beatHit ? 16 : 0)) + bass * 10
  const col    = preset.palette.secondary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (1.0 + bass * 1.8) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.9 * intMul
  tctx.lineCap                  = 'round'
  tctx.beginPath()

  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * Math.PI * 2
    const v     = getTimeDomainNorm(timeDomainData, i)
    const r     = baseR + v * baseR * 0.55 * (1 + bass * 0.6)
    const x     = cx2 + Math.cos(angle) * r
    const y     = cy2 + Math.sin(angle) * r
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.closePath()
  tctx.stroke()

  // Inner ring accent
  tctx.strokeStyle = preset.palette.accent
  tctx.shadowColor = preset.palette.accent
  tctx.lineWidth  *= 0.5
  tctx.globalAlpha = 0.35 * intMul
  tctx.beginPath()
  tctx.arc(cx2, cy2, baseR * 0.55, 0, Math.PI * 2)
  tctx.stroke()

  tctx.restore()
}

// ── Spiral scope mode ─────────────────────────────────────────────────────────

function drawSpiralScopeOnTrail(
  tctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  intMul: number,
): void {
  const { audio, freqData, t, beatHit } = frame
  const bass   = audio.bass * params.bassReactivity
  const cx2    = W / 2, cy2 = H / 2
  const pts    = 360
  const glowPx = params.glow * (12 + (beatHit ? 18 : 0))
  const col    = preset.palette.primary

  tctx.save()
  tctx.globalCompositeOperation = 'screen'
  tctx.strokeStyle              = col
  tctx.lineWidth                = (0.8 + bass * 1.2) * dpr * params.intensity
  tctx.shadowColor              = col
  tctx.shadowBlur               = glowPx
  tctx.globalAlpha              = 0.85 * intMul
  tctx.lineCap                  = 'round'
  tctx.beginPath()

  const spiralR   = Math.min(W, H) * 0.35 * params.intensity
  const spiralTurns = 3.5 + audio.mid * 1.5

  for (let i = 0; i <= pts; i++) {
    const frac    = i / pts
    const angle   = frac * Math.PI * 2 * spiralTurns + t * 0.001 * params.motion
    const freqVal = getFreqNorm(freqData, Math.floor(frac * (freqData ? freqData.length : 256)))
    const r       = frac * spiralR * (0.8 + freqVal * 0.5 + bass * 0.3)
    const x       = cx2 + Math.cos(angle) * r
    const y       = cy2 + Math.sin(angle) * r
    if (i === 0) tctx.moveTo(x, y); else tctx.lineTo(x, y)
  }
  tctx.stroke()

  tctx.restore()
}

// ── Public export ─────────────────────────────────────────────────────────────

export function renderSoundDrawing(
  ctx: CanvasRenderingContext2D,
  frame: ReactFrameContext,
  preset: ReactPreset,
  params: ReactRenderParams,
  sectionType: ReactSectionType | null,
): void {
  const { W, H, dpr } = frame
  const intMul    = params.intensity
  const mode      = modeForSection(sectionType)
  const trailCanvas = getTrail(ctx, W, H)
  const tctx      = trailCanvas.getContext('2d')
  if (!tctx) return

  // Fade trail
  const decayRate = params.trailDecay * 0.25 + 0.01
  fadeTrail(trailCanvas, preset.palette.background, decayRate)

  // Draw new scope frame onto trail canvas
  switch (mode) {
    case 'lissajous':
      drawLissajousOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    case 'radialScope':
      drawRadialScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    case 'spiralScope':
      drawSpiralScopeOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
      break
    default:
      drawWaveformOnTrail(tctx, W, H, dpr, frame, preset, params, intMul)
  }

  // Composite trail onto main canvas
  ctx.fillStyle = preset.palette.background
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(trailCanvas, 0, 0)
}
