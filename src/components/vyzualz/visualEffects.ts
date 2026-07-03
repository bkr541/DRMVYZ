// Canvas 2D visual effect helpers for VYZUALZ.
// Each function is stateless or accepts a mutable ref for per-effect state.
// Import these into VyzualzView and call them from the RAF loop.

// ── Stateful effect state types ───────────────────────────────────────────────

export interface BeatRing {
  r:     number
  maxR:  number
  alpha: number
}

export interface BurstParticle {
  x:       number
  y:       number
  vx:      number
  vy:      number
  life:    number
  maxLife: number
  size:    number
}

// ── A) Spectrum Bars ──────────────────────────────────────────────────────────
// Vertical frequency bars along the bottom of the canvas.
export function drawSpectrumBars(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  buf: Uint8Array,
  intensity: number,
  bass: number,
  masterIntensity: number,
) {
  const barCount = Math.min(80, Math.floor(buf.length * 0.6))
  if (barCount < 1) return
  const barW = W / barCount
  ctx.save()
  ctx.globalAlpha = intensity
  for (let i = 0; i < barCount; i++) {
    const binIdx    = Math.floor((i / barCount) * (buf.length * 0.65))
    const freq      = buf[binIdx] / 255
    const bassBoost = i < barCount * 0.15 ? 1 + bass * 1.2 : 1
    const bh        = Math.max(2 * dpr, freq * H * 0.35 * masterIntensity * bassBoost)
    const x         = i * barW
    const alpha     = 0.4 + freq * 0.6
    const grad = ctx.createLinearGradient(0, H, 0, H - bh)
    grad.addColorStop(0, `rgba(74,199,219,${alpha * 0.85})`)
    grad.addColorStop(1, `rgba(74,199,219,${alpha * 0.15})`)
    ctx.fillStyle = grad
    if (freq > 0.55) {
      ctx.shadowColor = '#4ac7db'
      ctx.shadowBlur  = 6 * dpr * freq * intensity
    }
    ctx.fillRect(x, H - bh, Math.max(1, barW - 1), bh)
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── B) Circular Spectrum ──────────────────────────────────────────────────────
// Radial bars around the canvas center that pulse with bass.
export function drawCircularSpectrum(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  buf: Uint8Array,
  intensity: number,
  bass: number,
) {
  const cx      = W / 2, cy = H / 2
  const minDim  = Math.min(W, H)
  const baseR   = minDim * 0.22 * (1 + bass * intensity * 0.25)
  const barCount = Math.min(120, buf.length)
  const lineW    = Math.max(1, (Math.PI * 2 * baseR / barCount) * 0.65)
  ctx.save()
  ctx.globalAlpha = intensity * 0.85
  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
    const freq  = buf[Math.floor((i / barCount) * buf.length)] / 255
    const bh    = freq * minDim * 0.15 * intensity
    const x1 = cx + Math.cos(angle) * baseR
    const y1 = cy + Math.sin(angle) * baseR
    const x2 = cx + Math.cos(angle) * (baseR + bh)
    const y2 = cy + Math.sin(angle) * (baseR + bh)
    ctx.strokeStyle = `rgba(74,199,219,${0.3 + freq * 0.7})`
    ctx.lineWidth   = lineW * dpr
    if (freq > 0.65) {
      ctx.shadowColor = '#4ac7db'
      ctx.shadowBlur  = 4 * dpr
    }
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── C) Oscilloscope ───────────────────────────────────────────────────────────
// Live waveform line; uses time-domain buffer when available, otherwise synth fallback.
export function drawOscilloscope(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  timeBuf: Uint8Array<ArrayBuffer> | null,
  intensity: number,
  volume: number,
  mid: number,
  high: number,
  t: number,
) {
  const cy = H / 2
  ctx.save()
  ctx.globalAlpha = intensity * (0.5 + volume * 0.5)
  ctx.strokeStyle = 'rgba(74,199,219,1)'
  ctx.lineWidth   = 1.5 * dpr
  ctx.shadowColor = '#4ac7db'
  ctx.shadowBlur  = 5 * dpr * intensity
  ctx.beginPath()
  if (timeBuf && timeBuf.length > 4) {
    const pts    = Math.min(timeBuf.length, 512)
    const sliceW = W / pts
    for (let i = 0; i < pts; i++) {
      const v = (timeBuf[Math.floor((i / pts) * timeBuf.length)] / 128) - 1
      const x = i * sliceW
      const y = cy + v * H * 0.35 * intensity
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
  } else {
    // Synthetic wave fallback when no analyser is connected
    const pts = 256
    for (let i = 0; i <= pts; i++) {
      const x  = (i / pts) * W
      const ph = (i / pts) * Math.PI * 4
      const v  = Math.sin(ph + t * 0.003) * volume
        + Math.sin(ph * 1.7 + t * 0.005) * mid * 0.4
        + Math.sin(ph * 3.1 + t * 0.008) * high * 0.2
      const y = cy + v * H * 0.3 * intensity
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── D) Beat Ring ──────────────────────────────────────────────────────────────
// Expanding rings that fade as they expand; triggered on beat hits.
export function updateAndDrawBeatRings(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  rings: BeatRing[],
  intensity: number,
  bass: number,
  beatHit: boolean,
) {
  const cx = W / 2, cy = H / 2
  if (beatHit && rings.length < 5) {
    rings.push({
      r:     Math.min(W, H) * 0.06,
      maxR:  Math.min(W, H) * (0.42 + bass * 0.2) * intensity,
      alpha: 0.8 * intensity,
    })
  }
  ctx.save()
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i]
    ring.r    += (ring.maxR - ring.r) * 0.065
    ring.alpha *= 0.93
    if (ring.alpha < 0.02 || ring.r > ring.maxR * 1.05) {
      rings.splice(i, 1)
      continue
    }
    ctx.strokeStyle = `rgba(74,199,219,${ring.alpha})`
    ctx.lineWidth   = (1.5 + intensity * 1.5) * dpr
    ctx.shadowColor = '#4ac7db'
    ctx.shadowBlur  = 6 * dpr * ring.alpha
    ctx.beginPath()
    ctx.arc(cx, cy, Math.max(1, ring.r), 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  ctx.restore()
}

// ── E) Particle Burst ─────────────────────────────────────────────────────────
// Particles emitted from center on beat hits; fade and drift outward.
export function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  particles: BurstParticle[],
  intensity: number,
  bass: number,
  beatHit: boolean,
  maxParticles = 80,
) {
  const cx = W / 2, cy = H / 2
  if (beatHit && particles.length < maxParticles) {
    const count = Math.floor(6 + bass * 14 * intensity)
    for (let i = 0; i < count && particles.length < maxParticles; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = (1.5 + Math.random() * 3) * intensity * (1 + bass * 1.5)
      particles.push({
        x:       cx + (Math.random() - 0.5) * 20,
        y:       cy + (Math.random() - 0.5) * 20,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed,
        life:    0,
        maxLife: 40 + Math.random() * 40,
        size:    (2 + Math.random() * 2.5) * dpr * intensity,
      })
    }
  }
  ctx.save()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x  += p.vx; p.y  += p.vy
    p.vx *= 0.96;  p.vy *= 0.96
    p.vy += 0.05   // mild gravity
    p.life++
    if (p.life >= p.maxLife) { particles.splice(i, 1); continue }
    const ratio = 1 - p.life / p.maxLife
    ctx.globalAlpha = ratio * intensity * 0.85
    ctx.fillStyle   = '#4ac7db'
    ctx.shadowColor = '#4ac7db'
    ctx.shadowBlur  = 4 * dpr * ratio
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * ratio), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.shadowBlur  = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── F) Reactive Grid ──────────────────────────────────────────────────────────
// Perspective emissive grid drawn behind media; warps with bass / low-mid.
export function drawReactiveGrid(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, dpr: number,
  t: number,
  intensity: number,
  bass: number,
  lowMid: number,
) {
  const cx = W / 2, cy = H / 2
  const warp      = (bass * 0.3 + lowMid * 0.15) * intensity
  const lineCount = 10
  ctx.save()
  ctx.globalAlpha = intensity * 0.14
  ctx.strokeStyle = 'rgba(74,199,219,1)'
  ctx.lineWidth   = dpr
  ctx.shadowColor = '#4ac7db'
  ctx.shadowBlur  = 3 * dpr * intensity
  // Horizontal perspective lines
  for (let i = 0; i <= lineCount; i++) {
    const frac   = i / lineCount
    const wobble = Math.sin(frac * Math.PI + t * 0.001) * warp * H * 0.04
    const y      = cy + (frac - 0.5) * H + wobble
    const spread = 0.5 + frac * 0.5
    ctx.beginPath()
    ctx.moveTo(cx - W * spread, y)
    ctx.lineTo(cx + W * spread, y)
    ctx.stroke()
  }
  // Vertical lines converging to vanishing point
  for (let i = 0; i <= lineCount; i++) {
    const frac   = (i / lineCount - 0.5) * 2
    const wobble = Math.sin(frac * Math.PI * 2 + t * 0.0012) * warp * W * 0.02
    ctx.beginPath()
    ctx.moveTo(cx + wobble, cy)
    ctx.lineTo(cx + frac * W * 0.7 + wobble * 2, H)
    ctx.stroke()
  }
  ctx.shadowBlur  = 0
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── G) Camera Shake ───────────────────────────────────────────────────────────
// Returns pixel offsets; mutates shakeRef.current for decay across frames.
export function getCameraShakeOffset(
  shakeRef: { current: number },
  bass: number,
  beatHit: boolean,
  intensity: number,
): { dx: number; dy: number } {
  if (beatHit) {
    shakeRef.current = Math.max(shakeRef.current, bass * intensity * 14)
  }
  shakeRef.current *= 0.80
  if (shakeRef.current < 0.3) return { dx: 0, dy: 0 }
  return {
    dx: (Math.random() - 0.5) * shakeRef.current * 2,
    dy: (Math.random() - 0.5) * shakeRef.current,
  }
}

// ── H) Kaleidoscope ───────────────────────────────────────────────────────────
// Draws rotated/mirrored copies of the current canvas around the center.
export function drawKaleidoscope(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
) {
  if (intensity < 0.04) return
  const canvas   = ctx.canvas
  const cx = W / 2, cy = H / 2
  const segments = 6
  ctx.save()
  ctx.globalAlpha             = intensity * 0.3
  ctx.globalCompositeOperation = 'screen'
  for (let i = 1; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    if (i % 2 === 1) ctx.scale(-1, 1)
    ctx.drawImage(canvas, -cx, -cy, W, H)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── I) Mirror Split ───────────────────────────────────────────────────────────
// Horizontal mirror (and vertical at high intensity) blended over the scene.
export function drawMirrorSplit(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
) {
  if (intensity < 0.04) return
  const canvas = ctx.canvas
  ctx.save()
  ctx.globalAlpha             = intensity * 0.45
  ctx.globalCompositeOperation = 'screen'
  // Horizontal mirror
  ctx.save()
  ctx.translate(W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(canvas, 0, 0, W, H)
  ctx.restore()
  // Vertical mirror at higher intensity
  if (intensity > 0.5) {
    ctx.save()
    ctx.globalAlpha = (intensity - 0.5) * 0.55
    ctx.translate(0, H)
    ctx.scale(1, -1)
    ctx.drawImage(canvas, 0, 0, W, H)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── J) Radial Blur ────────────────────────────────────────────────────────────
// Scaled transparent copies expanding from center, stronger on beats.
export function drawRadialBlur(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
  bass: number,
) {
  if (intensity < 0.04) return
  const canvas   = ctx.canvas
  const cx = W / 2, cy = H / 2
  const steps    = 5
  const maxScale = 1 + intensity * 0.09 * (1 + bass * 0.5)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 1; i <= steps; i++) {
    const s = 1 + (maxScale - 1) * (i / steps)
    const a = intensity * 0.07 * (1 - i / steps)
    if (a < 0.005) continue
    ctx.globalAlpha = a
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(s, s)
    ctx.drawImage(canvas, -cx, -cy, W, H)
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── K) VHS Static ─────────────────────────────────────────────────────────────
// Analog noise dots and horizontal tracking lines.
export function drawVhsStatic(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
  t: number,
) {
  if (intensity < 0.02) return
  ctx.save()
  // Random noise dots
  const noiseCount = Math.floor(intensity * 350)
  ctx.globalAlpha  = 0.3 * intensity
  for (let i = 0; i < noiseCount; i++) {
    const x = Math.random() * W
    const y = Math.random() * H
    const w = Math.random() * 3 + 1
    const h = Math.random() * 2 + 1
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 + 0.2})`
    ctx.fillRect(x, y, w, h)
  }
  // Horizontal tracking glitch lines
  const lineCount = Math.max(1, Math.floor(intensity * 2))
  ctx.globalAlpha = 0.12 * intensity
  ctx.fillStyle   = 'rgba(255,255,255,1)'
  for (let i = 0; i < lineCount; i++) {
    const y      = (t * 0.06 + i * 173.1) % H
    const lh     = 1 + Math.random() * 1.5
    const jitter = (Math.random() - 0.5) * intensity * 8
    ctx.fillRect(jitter, y, W, lh)
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── L) Datamosh Smear ─────────────────────────────────────────────────────────
// Draws the previous frame at a horizontal/vertical offset for a smear trail.
export function drawDatamoshSmear(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  offscreen: HTMLCanvasElement,
  intensity: number,
  volume: number,
) {
  if (intensity < 0.02) return
  const offX = (Math.random() - 0.5) * intensity * 18
  const offY = (Math.random() - 0.5) * intensity * 5
  ctx.save()
  ctx.globalAlpha             = intensity * 0.8 * (0.25 + volume * 0.25)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(offscreen, offX, offY)
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── M) Edge Glow ──────────────────────────────────────────────────────────────
// Radial glow around the canvas boundary reacting to volume / highs.
export function drawEdgeGlow(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  intensity: number,
  volume: number,
  high: number,
) {
  if (intensity < 0.02) return
  const glow = intensity * (0.45 + volume * 0.35 + high * 0.2)
  const minD = Math.min(W, H)
  ctx.save()
  const grad = ctx.createRadialGradient(W / 2, H / 2, minD * 0.28, W / 2, H / 2, minD * 0.68)
  grad.addColorStop(0,    'rgba(74,199,219,0)')
  grad.addColorStop(0.65, 'rgba(74,199,219,0)')
  grad.addColorStop(1,    `rgba(74,199,219,${glow * 0.55})`)
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

// ── N) Color Cycle ────────────────────────────────────────────────────────────
// Slowly rotating hue-gradient overlay; speed reacts to mid / volume.
export function drawColorCycle(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  hueRef: { current: number },
  intensity: number,
  mid: number,
  volume: number,
) {
  if (intensity < 0.02) return
  hueRef.current = (hueRef.current + (0.15 + mid * 0.7 + volume * 0.4) * intensity) % 360
  const hue = hueRef.current
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = intensity * 0.15
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0,   `hsl(${hue}, 100%, 50%)`)
  grad.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 100%, 55%)`)
  grad.addColorStop(1,   `hsl(${(hue + 240) % 360}, 100%, 50%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.restore()
}
