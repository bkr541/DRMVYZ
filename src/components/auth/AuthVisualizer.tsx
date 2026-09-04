import { useEffect, useRef } from 'react'

/**
 * Pre-auth ambient visualizer for the login / signup emblem panel. A
 * self-driven 2D-canvas animation that cycles through stylized takes on the
 * React engines' signature looks — Sound Drawing scope, Cinematic Worlds
 * constellation, Shader Pads prism tunnel, LaserDMX beam matrix, PixGrid —
 * on a synthetic 124 BPM pulse. No audio, no engine runtime.
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

// ── Engine-name typography ───────────────────────────────────────────────────
// The label keeps one position, but each scene renders the name in its own
// letterform mode with a matched reveal. Sampled modes (constellation dots,
// PixGrid cells) rasterize the name once to an offscreen canvas and cache the
// lit-cell grid; text modes draw live.

const DISPLAY_FONT = 'Inter, "Exo 2", system-ui, sans-serif'
const MONO_FONT = '"JetBrains Mono", ui-monospace, "Courier New", monospace'

interface SampledText {
  cells: Array<{ x: number; y: number }>
  w: number
  h: number
  step: number
}

const TEXT_SAMPLE_CACHE = new Map<string, SampledText | null>()

function sampleText(name: string, fontPx: number, step: number): SampledText | null {
  const key = `${name}|${fontPx}|${step}`
  const cached = TEXT_SAMPLE_CACHE.get(key)
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') return null
  const off = document.createElement('canvas')
  const octx = off.getContext('2d')
  if (!octx) {
    TEXT_SAMPLE_CACHE.set(key, null)
    return null
  }
  const font = `800 ${fontPx}px ${DISPLAY_FONT}`
  octx.font = font
  try { octx.letterSpacing = `${Math.round(fontPx * 0.16)}px` } catch { /* older engines */ }
  const pad = 6
  const w = Math.ceil(octx.measureText(name).width) + pad * 2
  const h = Math.ceil(fontPx * 1.5) + pad * 2
  off.width = w
  off.height = h
  octx.font = font
  try { octx.letterSpacing = `${Math.round(fontPx * 0.16)}px` } catch { /* older engines */ }
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  octx.fillStyle = '#fff'
  octx.fillText(name, w / 2, h / 2)
  const data = octx.getImageData(0, 0, w, h).data
  const cells: Array<{ x: number; y: number }> = []
  for (let y = step / 2; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      if (data[(((y | 0) * w + (x | 0)) * 4) + 3] > 96) {
        cells.push({ x: x - w / 2, y: y - h / 2 })
      }
    }
  }
  const result: SampledText = { cells, w, h, step }
  TEXT_SAMPLE_CACHE.set(key, result)
  return result
}

/**
 * Draw the engine name at a fixed anchor in the mode for the given scene.
 * `reveal` 0..1 is the entrance progress; `vis` 0..1 the overall opacity
 * (drops to 0 as the scene crossfades out).
 */
function drawEngineLabel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  mode: number,
  s: Signal,
  reveal: number,
  vis: number,
) {
  if (vis <= 0.002) return
  const eased = easeOut(reveal)
  const cx = w / 2
  const cy = h * 0.58 - (1 - vis) * 10
  ctx.save()

  if (mode === 0) {
    // Sound Drawing — hollow outline that traces on, plotter style.
    ctx.font = `800 22px ${DISPLAY_FONT}`
    try { ctx.letterSpacing = '5px' } catch { /* */ }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(name).width
    const x0 = cx - tw / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0 - 6, cy - 24, (tw + 12) * eased, 48)
    ctx.clip()
    ctx.lineWidth = 1.4
    ctx.lineJoin = 'round'
    ctx.strokeStyle = `rgba(${ICE}, ${0.92 * vis})`
    ctx.shadowBlur = 12
    ctx.shadowColor = `rgba(${CYAN}, ${0.6 * vis})`
    ctx.strokeText(name, x0, cy)
    if (reveal >= 1) {
      ctx.fillStyle = `rgba(${ICE}, ${0.12 * vis})`
      ctx.fillText(name, x0, cy)
    }
    ctx.restore()
    if (reveal < 1) {
      const ex = x0 - 6 + (tw + 12) * eased
      ctx.shadowBlur = 16
      ctx.shadowColor = `rgba(${ICE}, ${vis})`
      ctx.fillStyle = `rgba(${ICE}, ${0.55 * vis})`
      ctx.fillRect(ex - 1, cy - 15, 2, 30)
    }
  } else if (mode === 1) {
    // Cinematic Worlds — letters as connected dot-nodes, twinkling in L→R.
    const st = sampleText(name, 30, 5)
    if (st) {
      ctx.translate(cx, cy)
      ctx.scale(0.72, 0.72)
      const pv = (c: { x: number }) => clamp01((eased - ((c.x + st.w / 2) / st.w) * 0.72) / 0.3)
      ctx.strokeStyle = `rgba(${CYAN}, ${0.3 * vis})`
      ctx.lineWidth = 0.6
      for (let i = 0; i + 1 < st.cells.length; i += 2) {
        const a = st.cells[i]
        const b = st.cells[i + 1]
        if (Math.hypot(a.x - b.x, a.y - b.y) > st.step * 2.4) continue
        const k = Math.min(pv(a), pv(b))
        if (k <= 0) continue
        ctx.globalAlpha = 0.3 * k * vis
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.shadowColor = `rgba(${ICE}, ${0.6 * vis})`
      ctx.shadowBlur = 6
      for (let i = 0; i < st.cells.length; i++) {
        const c = st.cells[i]
        const k = pv(c)
        if (k <= 0) continue
        const jx = Math.sin(s.t * 3 + i) * 0.6 * s.high
        const jy = Math.cos(s.t * 2.4 + i * 1.7) * 0.6 * s.high
        ctx.fillStyle = `rgba(${ICE}, ${0.85 * k * vis})`
        ctx.beginPath()
        ctx.arc(c.x + jx, c.y + jy, 1.15 * k, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (mode === 2) {
    // Shader Pads — neon fill, rolling gradient sweep and bloom, wipe reveal.
    ctx.font = `800 23px ${DISPLAY_FONT}`
    try { ctx.letterSpacing = '6px' } catch { /* */ }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(name).width
    const x0 = cx - tw / 2
    const slide = Math.sin(s.t * 1.1) * tw * 0.5
    const grad = ctx.createLinearGradient(x0 - tw + slide, 0, x0 + tw + slide, 0)
    grad.addColorStop(0, `rgba(${DEEP}, ${vis})`)
    grad.addColorStop(0.5, `rgba(${ICE}, ${vis})`)
    grad.addColorStop(1, `rgba(${DEEP}, ${vis})`)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0 - 8, cy - 24, (tw + 16) * eased, 48)
    ctx.clip()
    ctx.shadowBlur = 22
    ctx.shadowColor = `rgba(${CYAN}, ${0.7 * vis})`
    ctx.fillStyle = grad
    ctx.fillText(name, x0, cy)
    ctx.restore()
    if (reveal < 1) {
      const ex = x0 - 8 + (tw + 16) * eased
      ctx.globalCompositeOperation = 'lighter'
      ctx.shadowBlur = 24
      ctx.shadowColor = `rgba(${ICE}, ${vis})`
      ctx.fillStyle = `rgba(${ICE}, ${0.5 * vis})`
      ctx.fillRect(ex - 2, cy - 18, 4, 36)
    }
  } else if (mode === 3) {
    // LaserDMX — hard mono weight, RGB fringing, strobe flicker, char step-in.
    ctx.font = `700 21px ${MONO_FONT}`
    try { ctx.letterSpacing = '3px' } catch { /* */ }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(name).width
    const x0 = cx - tw / 2
    const shown = Math.ceil(eased * name.length)
    const partial = name.slice(0, shown)
    const flick = reveal < 1
      ? (Math.sin(s.t * 46 + shown * 1.7) > -0.35 ? 1 : 0.2)
      : 0.8 + 0.2 * Math.abs(Math.sin(s.t * 11))
    const o = 1.2 + s.beat * 2 + (1 - eased) * 3.5
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowBlur = 5
    const pass = (dx: number, col: string) => {
      ctx.fillStyle = `rgba(${col}, ${0.5 * flick * vis})`
      ctx.shadowColor = `rgba(${col}, ${0.45 * vis})`
      ctx.fillText(partial, x0 + dx, cy)
    }
    pass(-o, '255, 64, 92')
    pass(o, '64, 132, 255')
    pass(0, ICE)
  } else {
    // PixGrid — blocky bitmap cells populating in L→R with a pop.
    const st = sampleText(name, 28, 4)
    if (st) {
      ctx.translate(cx, cy)
      ctx.scale(0.74, 0.74)
      const cell = st.step * 0.8
      for (let i = 0; i < st.cells.length; i++) {
        const c = st.cells[i]
        const delay = ((c.x + st.w / 2) / st.w) * 0.76
        const k = clamp01((eased - delay) / 0.16)
        if (k <= 0) continue
        const sz = cell * (k < 1 ? 1 + (1 - k) * 0.7 : 1)
        const fresh = k < 0.5
        ctx.shadowBlur = fresh ? 8 : 0
        ctx.shadowColor = `rgba(${ICE}, ${0.5 * vis})`
        ctx.fillStyle = `rgba(${fresh ? ICE : CYAN}, ${(0.24 + 0.66 * k) * vis})`
        roundRectPath(ctx, c.x - sz / 2, c.y - sz / 2, sz, sz, sz * 0.24)
        ctx.fill()
      }
    }
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
const SCENE_NAMES = ['Sound Drawing', 'Cinematic Worlds', 'Shader Pads', 'LaserDMX', 'PixGrid']
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
      drawEngineLabel(ctx, width, height, SCENE_NAMES[idx], idx, s, reveal, 1 - exit)

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
        drawEngineLabel(ctx, width, height, SCENE_NAMES[1], 1, staticSig, 1, 1)
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
