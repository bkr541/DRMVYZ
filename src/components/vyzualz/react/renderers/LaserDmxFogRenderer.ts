/**
 * Beam Matrix procedural fog renderer.
 *
 * Uses a dedicated low-resolution offscreen canvas (never the main output
 * canvas directly) to generate cloud-like volumetric fog:
 *
 *   1. Fractional Brownian Motion (fBm) value noise — cloudy, spatially
 *      uneven patterns instead of per-pixel random static.
 *   2. Temporal UV drift parameterised by driftSpeed and driftDirection.
 *   3. Turbulence: second noise field displaces the UV before sampling fog.
 *   4. Beam-coloured light scatter: visible beams illuminate nearby fog.
 *   5. Diffusion: fog density buffer is written then upscaled with smooth
 *      interpolation (ctx.imageSmoothingEnabled = true) so the result looks
 *      diffused at full canvas resolution without expensive blur passes.
 *   6. Foreground wisps: a thin second pass at slightly lower frequency adds
 *      foreground depth (medium / high quality only).
 *
 * Quality levels:
 *   low:    64-px buffer, 2 fBm octaves, no wisps
 *   medium: 128-px buffer, 3 fBm octaves, wisps
 *   high:   256-px buffer, 4 fBm octaves, more wisps + extra scatter
 *
 * Quality is never changed automatically — users control it via the FX panel.
 *
 * The offscreen canvases are reused across frames (allocated once per quality
 * change or canvas resize). No large arrays are allocated per frame; the
 * ImageData buffer is reused in-place.
 *
 * Pure math functions (valueNoise, fbmNoise, fogBufferDimensions) are
 * exported for unit tests.
 *
 * Relationship to legacy rig haze: The existing drawHaze() function
 * is a simple radial colour wash around fixture origins. It is NOT used here.
 * This renderer produces its own independent atmospheric effect.
 *
 * React-global fog density does NOT double-apply: the Beam Matrix renderer
 * only reads from compiledFog (compiled from laserDmxBeamMatrix.fog), which
 * is entirely separate from the global reactFogDensity parameter used by
 * other engines.
 */

import type { CompiledLaserDmxMatrixBeam, CompiledLaserDmxFog } from './LaserDmxBeamMatrixCompiler'

// ── Pure noise math (exported for tests) ─────────────────────────────────────

/** Fast deterministic hash for two integers. Returns [0,1]. */
function hash2(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

/** Smooth-interpolated value noise at (x, y). Returns [0,1]. */
export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  // Smooth-step ease
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const h00 = hash2(ix,     iy)
  const h10 = hash2(ix + 1, iy)
  const h01 = hash2(ix,     iy + 1)
  const h11 = hash2(ix + 1, iy + 1)
  return (h00 * (1 - ux) + h10 * ux) * (1 - uy) +
         (h01 * (1 - ux) + h11 * ux) * uy
}

/**
 * Fractional Brownian Motion noise — layered octaves for cloud-like texture.
 * @param x,y      Sample coordinates (pre-scaled)
 * @param octaves  1–4; higher = more detail
 * @param scale    Initial frequency scale
 * @param time     Adds UV drift per octave for animation
 * @param turbStr  0–1 turbulence: second noise field distorts UV
 */
export function fbmNoise(
  x: number, y: number,
  octaves: number,
  scale: number,
  time: number,
  turbStr: number,
): number {
  // Turbulence distortion: shift (x,y) by a secondary noise field
  if (turbStr > 0.001) {
    const tx = valueNoise(x * 1.7 + time * 0.08, y * 1.7) * 2 - 1
    const ty = valueNoise(x * 1.7, y * 1.7 + time * 0.06) * 2 - 1
    x += tx * turbStr * 0.5
    y += ty * turbStr * 0.5
  }

  let value = 0
  let amplitude = 1
  let maxAmp = 0
  let freq = scale

  for (let oct = 0; oct < octaves; oct++) {
    // Each octave has a slightly different drift speed so layers separate over time
    const driftX = time * (0.04 + oct * 0.015)
    const driftY = time * (0.02 + oct * 0.011)
    value   += valueNoise(x * freq + driftX, y * freq + driftY) * amplitude
    maxAmp  += amplitude
    amplitude *= 0.55
    freq      *= 2.1
  }

  return value / maxAmp
}

/** Buffer dimensions for a given canvas size and quality. Width is fixed;
 *  height maintains the canvas aspect ratio. */
export function fogBufferDimensions(
  canvasW: number,
  canvasH: number,
  quality: 'low' | 'medium' | 'high' | string,
): { w: number; h: number } {
  const w = quality === 'low' ? 64 : quality === 'high' ? 256 : 128
  const h = Math.max(4, Math.round(w * (canvasH / Math.max(1, canvasW))))
  return { w, h }
}

function octavesForQuality(quality: string): number {
  return quality === 'low' ? 2 : quality === 'high' ? 4 : 3
}

// ── Module-level buffer state ─────────────────────────────────────────────────
// One set of buffers; reallocated only on quality change or canvas resize.

interface FogBuffer {
  canvas:  HTMLCanvasElement
  ctx:     CanvasRenderingContext2D
  imgData: ImageData
  w: number
  h: number
}

let fogBuf: FogBuffer | null = null
let fogLastCanvasW = 0
let fogLastCanvasH = 0
let fogLastQuality = ''
// Animation state — updated every frame, reset on playback stop
let fogTime = 0
let scatterDecay = 0

/** Beam-scatter accumulator — same dimensions as fogBuf (r/g/b each 0–255). */
let scatterR: Float32Array | null = null
let scatterG: Float32Array | null = null
let scatterB: Float32Array | null = null

/** Reset fog animation state.  Call when LaserDMX stops rendering. */
export function resetFogState(): void {
  fogTime = 0
  scatterDecay = 0
  if (scatterR) scatterR.fill(0)
  if (scatterG) scatterG.fill(0)
  if (scatterB) scatterB.fill(0)
  // Clear fog buffer pixels
  if (fogBuf) {
    const img = fogBuf.imgData
    img.data.fill(0)
    fogBuf.ctx.putImageData(img, 0, 0)
  }
}

function ensureFogBuffer(
  canvasW: number,
  canvasH: number,
  quality: string,
): FogBuffer | null {
  const { w, h } = fogBufferDimensions(canvasW, canvasH, quality)
  if (
    fogBuf &&
    fogBuf.w === w && fogBuf.h === h &&
    fogLastCanvasW === canvasW && fogLastCanvasH === canvasH &&
    fogLastQuality === quality
  ) {
    return fogBuf
  }

  // (Re-)allocate
  try {
    const canvas = document.createElement('canvas')
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const imgData = ctx.createImageData(w, h)
    fogBuf = { canvas, ctx, imgData, w, h }
    fogLastCanvasW = canvasW
    fogLastCanvasH = canvasH
    fogLastQuality = quality

    // Reallocate scatter buffers
    const len = w * h
    scatterR = new Float32Array(len)
    scatterG = new Float32Array(len)
    scatterB = new Float32Array(len)

    // Reset animation on buffer resize
    fogTime = 0
  } catch {
    fogBuf = null
  }
  return fogBuf
}

// ── Beam scatter accumulation ─────────────────────────────────────────────────

function accumulateBeamScatter(
  beams:       CompiledLaserDmxMatrixBeam[],
  buf:         FogBuffer,
  canvasW:     number,
  canvasH:     number,
  scatterStr:  number,
  absorbStr:   number,
): void {
  if (!scatterR || !scatterG || !scatterB) return
  // Decay previous scatter
  const decay = 0.55
  for (let i = 0; i < scatterR.length; i++) {
    scatterR[i] *= decay
    scatterG[i] *= decay
    scatterB[i] *= decay
  }

  if (scatterStr < 0.01) return

  const scaleX = buf.w / canvasW
  const scaleY = buf.h / canvasH
  const radius = Math.max(2, buf.w * 0.08)  // scatter radius in buf pixels
  const r2max  = radius * radius

  for (const beam of beams) {
    if (!beam.strobeVisible || beam.intensity < 0.05) continue
    const contribution = beam.intensity * scatterStr * (1 + absorbStr * 0.5)
    const numSamples = 5  // sample points along beam

    for (let s = 0; s <= numSamples; s++) {
      const t = s / numSamples
      const wx = (beam.visibleOrigin.x + (beam.visibleTarget.x - beam.visibleOrigin.x) * t) * scaleX
      const wy = (beam.visibleOrigin.y + (beam.visibleTarget.y - beam.visibleOrigin.y) * t) * scaleY

      const bx0 = Math.max(0, Math.floor(wx - radius))
      const bx1 = Math.min(buf.w - 1, Math.ceil(wx + radius))
      const by0 = Math.max(0, Math.floor(wy - radius))
      const by1 = Math.min(buf.h - 1, Math.ceil(wy + radius))

      for (let by = by0; by <= by1; by++) {
        for (let bx = bx0; bx <= bx1; bx++) {
          const ddx = bx - wx, ddy = by - wy
          const r2 = ddx * ddx + ddy * ddy
          if (r2 > r2max) continue
          const att = (1 - r2 / r2max) * contribution * (1 / (numSamples + 1))
          const idx = by * buf.w + bx
          scatterR[idx] += beam.rgba.r * att
          scatterG[idx] += beam.rgba.g * att
          scatterB[idx] += beam.rgba.b * att
        }
      }
    }
  }
}

// ── Main render function ──────────────────────────────────────────────────────

/**
 * Render procedural fog into the main output canvas.
 * Call once per frame, before beam rendering, after the background fade.
 *
 * @param ctx       Main output canvas 2D context.
 * @param W, H      Main canvas dimensions.
 * @param fog       Compiled fog settings (from LaserDmxBeamMatrixCompiler).
 * @param beams     Compiled beams (for scatter illumination).
 * @param dt        Seconds since last frame (for animation speed).
 */
export function renderFog(
  ctx:   CanvasRenderingContext2D,
  W:     number,
  H:     number,
  fog:   CompiledLaserDmxFog,
  beams: CompiledLaserDmxMatrixBeam[],
  dt:    number,
): void {
  if (!fog.enabled || fog.density < 0.01 || fog.opacity < 0.01) return

  const buf = ensureFogBuffer(W, H, fog.quality)
  if (!buf) return

  // Advance time
  fogTime += dt * fog.driftSpeed * 0.4

  // Drift direction angle (0–1 maps to 0–2π)
  const dirAngle = fog.driftDirection * Math.PI * 2
  const dirX = Math.cos(dirAngle)
  const dirY = Math.sin(dirAngle)

  // Accumulate beam scatter before writing fog pixels
  accumulateBeamScatter(beams, buf, W, H, fog.beamScatter, fog.colorAbsorption)

  // ── Write fog ImageData ───────────────────────────────────────────────────
  const { w, h, imgData } = buf
  const data = imgData.data
  const octaves = octavesForQuality(fog.quality)
  const scale = fog.noiseScale * 1.5
  const turbulence = fog.turbulence
  const density = fog.density
  const dissipation = fog.dissipation

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      // Normalized UV with directional drift
      const ux = px / w + dirX * fogTime
      const uy = py / h + dirY * fogTime

      // Main fog cloud
      let n = fbmNoise(ux, uy, octaves, scale, fogTime, turbulence)

      // Dissipation: thin out bottom portion slightly (fog settles)
      n *= 1 - dissipation * (1 - py / h) * 0.35

      // Clamp and apply density
      n = Math.max(0, Math.min(1, n * density * 1.8))

      const i = (py * w + px) * 4

      // Base fog colour: very dark neutral (fog is near-black without illumination)
      const baseA = Math.round(n * 180)

      // Blend beam scatter
      const sr = scatterR ? scatterR[py * w + px] : 0
      const sg = scatterG ? scatterG[py * w + px] : 0
      const sb = scatterB ? scatterB[py * w + px] : 0

      // Scatter illuminates the fog: adds coloured light glow
      const scatterBrightness = Math.min(1, (sr + sg + sb) / 255 * 0.015)
      const scatterA = Math.round(scatterBrightness * 120)

      data[i    ] = Math.min(255, Math.round(sr * 0.6))  // R: beam colour tint
      data[i + 1] = Math.min(255, Math.round(sg * 0.6))  // G
      data[i + 2] = Math.min(255, Math.round(sb * 0.6))  // B
      data[i + 3] = Math.min(255, baseA + scatterA)       // A: density + scatter
    }
  }

  buf.ctx.putImageData(imgData, 0, 0)

  // ── Composite fog onto main canvas ─────────────────────────────────────────
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = fog.opacity * 0.9
  // Upscale with smooth interpolation for diffusion
  ctx.imageSmoothingEnabled  = true
  ctx.imageSmoothingQuality  = fog.quality === 'high' ? 'high' : 'medium'
  ctx.drawImage(buf.canvas, 0, 0, W, H)

  // ── Foreground wisps (medium + high quality) ───────────────────────────────
  if (fog.quality !== 'low' && fog.diffusion > 0.1) {
    // Lighter, faster-drifting layer for foreground depth
    const wispTime = fogTime * 1.6
    const wi = imgData.data

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const ux = px / w + dirX * wispTime * 0.7 + 0.31
        const uy = py / h + dirY * wispTime * 0.7 + 0.17
        const n = fbmNoise(ux, uy, 2, scale * 1.5, wispTime, turbulence * 0.4)
        const wispDensity = Math.max(0, n * density * 0.6 - 0.1)
        const a = Math.round(wispDensity * 100 * fog.diffusion)
        const ii = (py * w + px) * 4
        wi[ii] = wi[ii + 1] = wi[ii + 2] = 220
        wi[ii + 3] = Math.min(255, a)
      }
    }
    buf.ctx.putImageData(imgData, 0, 0)
    ctx.globalAlpha = fog.opacity * fog.diffusion * 0.3
    ctx.drawImage(buf.canvas, 0, 0, W, H)
  }

  ctx.restore()
}
