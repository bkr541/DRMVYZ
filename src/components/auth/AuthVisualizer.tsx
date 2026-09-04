import { useEffect, useRef } from 'react'

/**
 * Pre-auth ambient visualizer for the login / signup emblem panel. A
 * self-driven 2D-canvas animation that cycles through stylized takes on the
 * React engines' signature looks — Sound Drawing scope, Cinema constellation,
 * CANVAS depth field, LaserDMX beam matrix, PixGrid — on a synthetic 124 BPM
 * pulse. No audio, no engine runtime.
 */

const ICE = '142, 244, 255'
const CYAN = '74, 199, 219'
const DEEP = '6, 120, 160'
const MAGENTA = '184, 79, 201'
const GREEN = '97, 214, 170'

const SCENE_MS = 6600
const FADE_MS = 950
const BPM = 124

interface Signal {
  t: number
  energy: number
  beat: number
  low: number
  mid: number
  high: number
}

type SceneFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Signal,
  alpha: number,
) => void

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

const easeOut = (v: number) => 1 - (1 - v) * (1 - v)
const easeIn = (v: number) => v * v
const TAU = Math.PI * 2
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Engine name — decode / glitch transition ───────────────────────────────
// The word scrambles in and out per-letter (staggered L→R), always ending
// locked and legible. Each engine flavours the unresolved glyphs: Sound
// Drawing warbles them through waveform noise, Cinema gathers particles into
// each letter, CANVAS shimmers them into focus through refraction blur,
// LaserDMX runs a beat-quantised scanline strobe, PixGrid does a mosaic
// block-dissolve.

const DISPLAY_FONT = 'Inter, "Exo 2", system-ui, sans-serif'
const LABEL_FONT = `700 22px ${DISPLAY_FONT}`
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789<>/\\|=+*#%&$'

/** Soft dark vignette so the label reads over a busy scene. */
function labelBacking(ctx: CanvasRenderingContext2D, cx: number, cy: number, tw: number, a: number) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, tw * 0.75 + 40)
  g.addColorStop(0, `rgba(2, 4, 7, ${0.62 * a})`)
  g.addColorStop(1, 'rgba(2, 4, 7, 0)')
  ctx.fillStyle = g
  ctx.fillRect(cx - tw, cy - 42, tw * 2, 84)
}

/**
 * The engine name, decoding in / out per-letter. `reveal` / `exit` 0..1 are
 * the scene-window in / out progress.
 */
function drawEngineLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  mode: number,
  s: Signal,
  reveal: number,
  exit: number,
) {
  const mIn = clamp01(reveal)
  const mOut = clamp01(exit)
  if (mIn <= 0.001 || mOut >= 0.999) return
  const cx = w / 2
  const cy = h * 0.56
  ctx.save()
  ctx.font = LABEL_FONT
  try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // decode progress: 0 = fully scrambled, 1 = fully locked
  const prog = mOut > 0 ? 1 - easeIn(mOut) : easeOut(mIn)
  const fade = mOut > 0 ? clamp01(prog * 1.6) : 1
  const idleY = Math.sin(s.t * 0.8) * 1.6
  const beatSlot = Math.floor(s.t * (BPM / 60) * 2)

  const GAP = 4
  const chars = [...name]
  const widths = chars.map(c => ctx.measureText(c === ' ' ? 'M' : c).width + GAP)
  const total = widths.reduce((a, b) => a + b, 0) - GAP
  labelBacking(ctx, cx, cy + idleY, total / 2 + 30, fade)

  let pen = cx - total / 2
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const lx = pen + widths[i] / 2
    pen += widths[i]
    if (ch === ' ') continue
    const lp = clamp01((prog - (i / chars.length) * 0.5) / 0.5)

    ctx.save()
    ctx.translate(lx, cy + idleY)

    if (lp >= 1) {
      ctx.shadowBlur = 10
      ctx.shadowColor = `rgba(${CYAN}, ${0.6 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${0.97 * fade})`
      ctx.fillText(ch, 0, 0)
    } else if (mode === 0) {
      // Sound Drawing — glyph warbles through waveform noise.
      const g = GLYPHS[(beatSlot * 3 + i * 7 + Math.floor(s.t * 22)) % GLYPHS.length]
      const wob = Math.sin(s.t * 26 + i * 2) * (1 - lp) * 5
        + (hash01(i + Math.floor(s.t * 30)) - 0.5) * (1 - lp) * 5
      ctx.translate(0, wob)
      ctx.scale(1, 0.7 + hash01(i * 5 + Math.floor(s.t * 18)) * 0.7)
      ctx.shadowBlur = 8
      ctx.shadowColor = `rgba(${CYAN}, ${0.5 * fade})`
      ctx.fillStyle = `rgba(${CYAN}, ${(0.35 + lp * 0.55) * fade})`
      ctx.fillText(g, 0, 0)
    } else if (mode === 1) {
      // Cinema — particles gather into the letter.
      const spread = (1 - lp) * 22
      ctx.shadowBlur = 5
      ctx.shadowColor = `rgba(${ICE}, ${0.6 * fade})`
      for (let k = 0; k < 7; k++) {
        const a = hash01(i * 13 + k) * TAU + s.t * 1.6
        const rr = spread * (0.35 + hash01(i * 7 + k * 3) * 0.65)
        ctx.fillStyle = `rgba(${ICE}, ${(0.3 + lp * 0.5) * fade})`
        ctx.beginPath()
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, 1.2, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = `rgba(${ICE}, ${lp * 0.45 * fade})`
      ctx.fillText(ch, 0, 0)
    } else if (mode === 2) {
      // CANVAS — refraction / zoom-blur shimmer resolving into focus.
      const blur = 1 - lp
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `rgba(255, 64, 92, ${(0.28 * blur + 0.04) * fade})`
      ctx.fillText(ch, -blur * 6, 0)
      ctx.fillStyle = `rgba(64, 132, 255, ${(0.28 * blur + 0.04) * fade})`
      ctx.fillText(ch, blur * 6, 0)
      ctx.globalCompositeOperation = 'source-over'
      for (let k = 2; k >= 0; k--) {
        const sc = 1 + blur * 0.06 * k
        ctx.save()
        ctx.scale(sc, sc)
        ctx.shadowBlur = 6
        ctx.shadowColor = `rgba(${CYAN}, ${0.5 * fade})`
        ctx.fillStyle = `rgba(${ICE}, ${(k === 0 ? 0.4 + lp * 0.55 : 0.14 * blur) * fade})`
        ctx.fillText(ch, 0, 0)
        ctx.restore()
      }
    } else if (mode === 3) {
      // LaserDMX — beat-quantised glyph strobe with scanline gaps.
      const g = GLYPHS[(beatSlot * 5 + i * 11) % GLYPHS.length]
      const strobe = beatSlot % 2 === 0 ? 1 : 0.45
      const skip = ((beatSlot * 4 + i) % 5) - 2
      ctx.beginPath()
      for (let b = -2; b <= 2; b++) {
        if (b === skip) continue
        ctx.rect(-15, b * 6 - 2.5, 30, 5)
      }
      ctx.clip()
      ctx.globalCompositeOperation = 'lighter'
      ctx.shadowBlur = 6
      ctx.shadowColor = `rgba(${ICE}, ${0.6 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${(0.4 + lp * 0.5) * strobe * fade})`
      ctx.fillText(g, 0, 0)
    } else {
      // PixGrid — mosaic block-dissolve.
      ctx.shadowBlur = 4
      ctx.shadowColor = `rgba(${CYAN}, ${0.5 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${(0.35 + lp * 0.6) * fade})`
      ctx.fillText(ch, 0, 0)
      const cols = 4
      const rows = 5
      const cw = widths[i] / cols
      const chh = 28 / rows
      ctx.fillStyle = 'rgba(3, 5, 8, 0.96)'
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (hash01(i * 40 + ty * 7 + tx * 13) > lp) {
            ctx.fillRect(-widths[i] / 2 + tx * cw, -14 + ty * chh, cw + 0.6, chh + 0.6)
          }
        }
      }
    }

    ctx.restore()
  }

  ctx.restore()
}

// ── Scene: Sound Drawing — a glowing Lissajous scope trace ────────────────────
const drawScope: SceneFn = (ctx, w, h, s, alpha) => {
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * (0.16 + 0.13 * s.energy + 0.05 * s.beat)
  const a = 3 + Math.round(s.mid * 2)
  const b = 2 + Math.round(s.low * 2)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.6 + s.beat * 1.8
  ctx.shadowBlur = 14 + s.beat * 22
  ctx.shadowColor = `rgba(${ICE}, ${0.55 * alpha})`
  ctx.strokeStyle = `rgba(${ICE}, ${0.9})`
  ctx.beginPath()
  const steps = 220
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * Math.PI * 2
    const x = cx + Math.sin(a * u + s.t * 1.3) * r * 1.7
    const y = cy + Math.sin(b * u + s.t * 0.7) * r
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

// ── Scene: Cinematic Worlds — rotating 3D node constellation ──────────────────
const NODES = Array.from({ length: 46 }, (_, i) => {
  const g = 2.3999632297286535 // golden angle
  const y = 1 - (i / 45) * 2
  const rad = Math.sqrt(1 - y * y)
  return { x: Math.cos(g * i) * rad, y, z: Math.sin(g * i) * rad }
})

const drawConstellation: SceneFn = (ctx, w, h, s, alpha) => {
  const cx = w / 2
  const cy = h / 2
  const scale = Math.min(w, h) * (0.34 + 0.05 * s.beat)
  const rot = s.t * 0.35
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const pts = NODES.map(n => {
    const x = n.x * cos - n.z * sin
    const z = n.x * sin + n.z * cos
    const persp = 1 / (1.9 - z)
    return { sx: cx + x * scale * persp, sy: cy + n.y * scale * persp * 0.9, depth: persp }
  })
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 0.8
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].sx - pts[j].sx
      const dy = pts[i].sy - pts[j].sy
      const d = Math.hypot(dx, dy)
      if (d > scale * 0.42) continue
      const edge = (1 - d / (scale * 0.42)) * 0.5 * (0.4 + s.mid * 0.6)
      ctx.strokeStyle = `rgba(${CYAN}, ${edge})`
      ctx.beginPath()
      ctx.moveTo(pts[i].sx, pts[i].sy)
      ctx.lineTo(pts[j].sx, pts[j].sy)
      ctx.stroke()
    }
  }
  ctx.shadowBlur = 10 + s.high * 16
  ctx.shadowColor = `rgba(${ICE}, ${0.6 * alpha})`
  for (const p of pts) {
    const rr = (1.1 + s.high * 2.4) * p.depth
    ctx.fillStyle = `rgba(${ICE}, ${clamp01(0.35 + p.depth * 0.5)})`
    ctx.beginPath()
    ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ── Scene: Shader Pads — receding prism tunnel ───────────────────────────────
const drawTunnel: SceneFn = (ctx, w, h, s, alpha) => {
  const cx = w / 2 + Math.sin(s.t * 0.4) * w * 0.06
  const cy = h / 2 + Math.cos(s.t * 0.33) * h * 0.05
  const rings = 15
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.4
  for (let k = rings - 1; k >= 0; k--) {
    const p = (k + (s.t * 0.9) % 1) / rings
    const size = Math.pow(1.42, p * rings) * (7 + s.energy * 5)
    const spin = s.t * (0.4 + k * 0.05) + k * 0.5
    const fade = (1 - p) * (0.5 + s.low * 0.5)
    const mix = p
    const cr = Math.round((1 - mix) * 142 + mix * 6)
    const cg = Math.round((1 - mix) * 244 + mix * 120)
    const cb = Math.round((1 - mix) * 255 + mix * 160)
    ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${fade})`
    ctx.shadowBlur = 8 * fade
    ctx.shadowColor = `rgba(${CYAN}, ${fade * alpha})`
    ctx.beginPath()
    const sides = 6
    for (let i = 0; i <= sides; i++) {
      const ang = spin + (i / sides) * Math.PI * 2
      const x = cx + Math.cos(ang) * size
      const y = cy + Math.sin(ang) * size
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Scene: LaserDMX — fanned sweeping beams ──────────────────────────────────
const BEAMS = [CYAN, ICE, CYAN, GREEN, CYAN, ICE, MAGENTA, CYAN, ICE]

const drawBeams: SceneFn = (ctx, w, h, s, alpha) => {
  const px = w / 2
  const py = h * 0.14
  const len = Math.hypot(w, h)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  BEAMS.forEach((col, i) => {
    const spread = (i - (BEAMS.length - 1) / 2) * 0.15
    const ang = Math.PI / 2 + spread + Math.sin(s.t * 0.7 + i * 0.9) * 0.32
    const bright = clamp01(0.12 + s.beat * 0.5 + 0.18 * Math.abs(Math.sin(s.t * 1.6 + i)))
    const spanA = ang - 0.012
    const spanB = ang + 0.012
    const grad = ctx.createLinearGradient(px, py, px + Math.cos(ang) * len, py + Math.sin(ang) * len)
    grad.addColorStop(0, `rgba(${col}, ${bright})`)
    grad.addColorStop(0.5, `rgba(${col}, ${bright * 0.28})`)
    grad.addColorStop(1, `rgba(${col}, 0)`)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + Math.cos(spanA) * len, py + Math.sin(spanA) * len)
    ctx.lineTo(px + Math.cos(spanB) * len, py + Math.sin(spanB) * len)
    ctx.closePath()
    ctx.fill()
  })
  ctx.shadowBlur = 18 + s.beat * 26
  ctx.shadowColor = `rgba(${ICE}, ${alpha})`
  ctx.fillStyle = `rgba(${ICE}, ${clamp01(0.5 + s.beat * 0.5) * alpha})`
  ctx.beginPath()
  ctx.arc(px, py, 3 + s.beat * 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ── Scene: PixGrid — cell field with a beat wipe ─────────────────────────────
const drawPixGrid: SceneFn = (ctx, w, h, s, alpha) => {
  const cols = 15
  const rows = 11
  const pad = Math.min(w, h) * 0.1
  const cw = (w - pad * 2) / cols
  const ch = (h - pad * 2) / rows
  const cell = Math.min(cw, ch) * 0.78
  const wipe = ((s.t * 0.35) % 1.4) * cols
  ctx.save()
  ctx.globalAlpha = alpha
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = pad + c * cw + (cw - cell) / 2
      const gy = pad + r * ch + (ch - cell) / 2
      const wave = Math.sin(c * 0.55 + s.t * 2.1) * Math.sin(r * 0.5 - s.t * 1.6)
      const near = Math.max(0, 1 - Math.abs(c - wipe) * 0.7)
      const lit = clamp01(wave * 0.5 + 0.5 + near * s.beat - 0.35)
      if (lit < 0.06) {
        ctx.fillStyle = `rgba(${CYAN}, 0.05)`
      } else {
        ctx.shadowBlur = lit * 12
        ctx.shadowColor = `rgba(${ICE}, ${0.5 * alpha})`
        ctx.fillStyle = `rgba(${lit > 0.7 ? ICE : CYAN}, ${clamp01(0.12 + lit * 0.8)})`
      }
      roundRectPath(ctx, gx, gy, cell, cell, cell * 0.22)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }
  ctx.restore()
}

const SCENES: SceneFn[] = [drawScope, drawConstellation, drawTunnel, drawBeams, drawPixGrid]
const SCENE_NAMES = ['Sound Drawing', 'Cinema', 'CANVAS', 'LaserDMX', 'PixGrid']
const LABEL_IN_MS = 900

export function AuthVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !parent || !ctx) return

    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = parent.getBoundingClientRect()
      width = rect.width || parent.clientWidth
      height = rect.height || parent.clientHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(parent)

    let raf = 0
    let prev = performance.now()
    let beatEnv = 0
    const started = prev

    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const t = (now - started) / 1000

      if (width < 2 || height < 2) {
        resize()
        if (width < 2 || height < 2) {
          raf = requestAnimationFrame(frame)
          return
        }
      }

      const beatsPerSec = BPM / 60
      if (Math.floor(t * beatsPerSec) !== Math.floor((t - dt) * beatsPerSec)) beatEnv = 1
      beatEnv = Math.max(beatEnv - dt * 3.1, 0)
      const beat = beatEnv * beatEnv

      const s: Signal = {
        t,
        beat,
        energy: clamp01(0.45 + 0.35 * Math.sin(t * 0.32)),
        low: clamp01(0.42 + 0.32 * Math.sin(t * 1.3) + beat * 0.4),
        mid: clamp01(0.45 + 0.3 * Math.sin(t * 2.1 + 1) + 0.16 * Math.sin(t * 5.1)),
        high: clamp01(0.36 + 0.28 * Math.abs(Math.sin(t * 7.7)) + beat * 0.3),
      }

      ctx.fillStyle = 'rgba(3, 5, 8, 0.24)'
      ctx.fillRect(0, 0, width, height)

      const elapsed = t * 1000
      const idx = Math.floor(elapsed / SCENE_MS) % SCENES.length
      const into = elapsed % SCENE_MS
      SCENES[idx](ctx, width, height, s, 1)
      if (into > SCENE_MS - FADE_MS) {
        const nextIdx = (idx + 1) % SCENES.length
        const k = (into - (SCENE_MS - FADE_MS)) / FADE_MS
        SCENES[nextIdx](ctx, width, height, s, k * k)
      }

      const reveal = clamp01(into / LABEL_IN_MS)
      const exit = into > SCENE_MS - FADE_MS
        ? clamp01((into - (SCENE_MS - FADE_MS)) / FADE_MS)
        : 0
      drawEngineLabel(ctx, width, height, SCENE_NAMES[idx], idx, s, reveal, exit)

      raf = requestAnimationFrame(frame)
    }

    if (reduce) {
      const paintStatic = () => {
        resize()
        if (width < 2 || height < 2) {
          raf = requestAnimationFrame(paintStatic)
          return
        }
        const staticSig: Signal = { t: 0.6, beat: 0, energy: 0.5, low: 0.5, mid: 0.6, high: 0.5 }
        ctx.fillStyle = '#030508'
        ctx.fillRect(0, 0, width, height)
        drawConstellation(ctx, width, height, staticSig, 1)
        drawEngineLabel(ctx, width, height, SCENE_NAMES[1], 1, staticSig, 1, 0)
      }
      raf = requestAnimationFrame(paintStatic)
    } else {
      raf = requestAnimationFrame(frame)
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf && !reduce) {
        prev = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="auth-visualizer" aria-hidden="true" />
}
