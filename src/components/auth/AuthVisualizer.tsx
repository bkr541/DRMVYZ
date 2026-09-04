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

// Matches the React main-engine dropdown label (inherits body's Zen Dots stack).
const DISPLAY_FONT = '"Zen Dots", "Exo 2", system-ui, sans-serif'
const LABEL_PX = 34
const LABEL_K = LABEL_PX / 22 // decode-geometry scale vs the base 22px tuning
const LABEL_FONT = `700 ${LABEL_PX}px ${DISPLAY_FONT}`
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789<>/\\|=+*#%&$'

/**
 * Glyph-hugging dark keyline drawn under the fill — a tight silhouette halo
 * (two round-joined strokes) so the label separates from the animation
 * without a plate behind it. Call at the same origin/transform as the fill.
 */
function glyphHalo(ctx: CanvasRenderingContext2D, str: string, alpha: number) {
  if (alpha <= 0.01) return
  ctx.save()
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.globalCompositeOperation = 'source-over'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = LABEL_PX * 0.16
  ctx.strokeStyle = `rgba(2, 4, 7, ${0.42 * alpha})`
  ctx.strokeText(str, 0, 0)
  ctx.lineWidth = LABEL_PX * 0.09
  ctx.strokeStyle = `rgba(2, 4, 7, ${0.72 * alpha})`
  ctx.strokeText(str, 0, 0)
  ctx.restore()
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
  // vertically centred in the emblem panel; small optical nudge for the
  // 'middle' baseline sitting slightly low with all-caps Latin.
  const cy = h / 2 - LABEL_K
  ctx.save()
  ctx.font = LABEL_FONT
  try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // decode progress: 0 = fully scrambled, 1 = fully locked
  const prog = mOut > 0 ? 1 - easeIn(mOut) : easeOut(mIn)
  const fade = mOut > 0 ? clamp01(prog * 1.6) : 1
  const idleY = Math.sin(s.t * 0.8) * 1.2 * LABEL_K
  const beatSlot = Math.floor(s.t * (BPM / 60) * 2)
  const K = LABEL_K

  const GAP = 4 * K
  const chars = [...name]
  const widths = chars.map(c => ctx.measureText(c === ' ' ? 'M' : c).width + GAP)
  const total = widths.reduce((a, b) => a + b, 0) - GAP

  // shrink-to-fit: the doubled font can overrun the narrow emblem panel, so
  // long names scale down about the centre; short ones stay at full size.
  const fit = Math.min(1, (w - 28) / total)
  ctx.translate(cx, cy)
  ctx.scale(fit, fit)
  ctx.translate(-cx, -cy)

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
      glyphHalo(ctx, ch, fade)
      ctx.shadowBlur = 8 * K
      ctx.shadowColor = `rgba(${CYAN}, ${0.6 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${0.97 * fade})`
      ctx.fillText(ch, 0, 0)
    } else if (mode === 0) {
      // Sound Drawing — glyph warbles through waveform noise.
      const g = GLYPHS[(beatSlot * 3 + i * 7 + Math.floor(s.t * 22)) % GLYPHS.length]
      const wob = (Math.sin(s.t * 26 + i * 2) + (hash01(i + Math.floor(s.t * 30)) - 0.5))
        * (1 - lp) * 4.5 * K
      ctx.translate(0, wob)
      ctx.scale(1, 0.7 + hash01(i * 5 + Math.floor(s.t * 18)) * 0.7)
      const a0 = (0.35 + lp * 0.55) * fade
      glyphHalo(ctx, g, a0)
      ctx.shadowBlur = 6.5 * K
      ctx.shadowColor = `rgba(${CYAN}, ${0.5 * fade})`
      ctx.fillStyle = `rgba(${CYAN}, ${a0})`
      ctx.fillText(g, 0, 0)
    } else if (mode === 1) {
      // Cinema — particles gather into the letter.
      const spread = (1 - lp) * 20 * K
      ctx.shadowBlur = 4 * K
      ctx.shadowColor = `rgba(${ICE}, ${0.6 * fade})`
      for (let k = 0; k < 7; k++) {
        const a = hash01(i * 13 + k) * TAU + s.t * 1.6
        const rr = spread * (0.35 + hash01(i * 7 + k * 3) * 0.65)
        ctx.fillStyle = `rgba(${ICE}, ${(0.3 + lp * 0.5) * fade})`
        ctx.beginPath()
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7, K, 0, TAU)
        ctx.fill()
      }
      glyphHalo(ctx, ch, lp * 0.55 * fade)
      ctx.shadowBlur = 3 * K
      ctx.fillStyle = `rgba(${ICE}, ${lp * 0.55 * fade})`
      ctx.fillText(ch, 0, 0)
    } else if (mode === 2) {
      // CANVAS — refraction / zoom-blur shimmer resolving into focus.
      const blur = 1 - lp
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = `rgba(255, 64, 92, ${(0.28 * blur + 0.04) * fade})`
      ctx.fillText(ch, -blur * 5.5 * K, 0)
      ctx.fillStyle = `rgba(64, 132, 255, ${(0.28 * blur + 0.04) * fade})`
      ctx.fillText(ch, blur * 5.5 * K, 0)
      ctx.globalCompositeOperation = 'source-over'
      glyphHalo(ctx, ch, (0.35 + lp * 0.5) * fade)
      for (let k = 2; k >= 0; k--) {
        const sc = 1 + blur * 0.06 * k
        ctx.save()
        ctx.scale(sc, sc)
        ctx.shadowBlur = 5 * K
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
      glyphHalo(ctx, g, (0.4 + lp * 0.5) * strobe * fade)
      ctx.beginPath()
      for (let b = -2; b <= 2; b++) {
        if (b === skip) continue
        ctx.rect(-15 * K, b * 5.5 * K - 2.25 * K, 30 * K, 4.5 * K)
      }
      ctx.clip()
      ctx.globalCompositeOperation = 'lighter'
      ctx.shadowBlur = 5 * K
      ctx.shadowColor = `rgba(${ICE}, ${0.6 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${(0.4 + lp * 0.5) * strobe * fade})`
      ctx.fillText(g, 0, 0)
    } else {
      // PixGrid — mosaic block-dissolve.
      glyphHalo(ctx, ch, (0.35 + lp * 0.6) * fade)
      ctx.shadowBlur = 3.5 * K
      ctx.shadowColor = `rgba(${CYAN}, ${0.5 * fade})`
      ctx.fillStyle = `rgba(${ICE}, ${(0.35 + lp * 0.6) * fade})`
      ctx.fillText(ch, 0, 0)
      const cols = 4
      const rows = 5
      const cw = widths[i] / cols
      const chh = (28 * K) / rows
      ctx.fillStyle = 'rgba(3, 5, 8, 0.96)'
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (hash01(i * 40 + ty * 7 + tx * 13) > lp) {
            ctx.fillRect(-widths[i] / 2 + tx * cw, -14 * K + ty * chh, cw + 0.5 * K, chh + 0.5 * K)
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
  const rx = w * (0.38 + 0.06 * s.energy + 0.03 * s.beat)
  const ry = h * (0.33 + 0.06 * s.energy + 0.03 * s.beat)
  const a = 3 + Math.round(s.mid * 2)
  const b = 2 + Math.round(s.low * 2)
  const steps = 260
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.5 + s.beat * 1.6
  ctx.shadowColor = `rgba(${ICE}, ${0.5 * alpha})`
  // three phosphor-persistence passes so the trace fills the panel
  for (let pass = 2; pass >= 0; pass--) {
    ctx.strokeStyle = `rgba(${ICE}, ${pass === 0 ? 0.9 : 0.26 / pass})`
    ctx.shadowBlur = pass === 0 ? 14 + s.beat * 20 : 5
    const ph = s.t - pass * 0.05
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const u = (i / steps) * Math.PI * 2
      const x = cx + Math.sin(a * u + ph * 1.3) * rx
      const y = cy + Math.sin(b * u + ph * 0.7) * ry
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

// ── Scene: Cinematic Worlds — rotating 3D node constellation ──────────────────
const NODES = Array.from({ length: 46 }, (_, i) => {
  const g = 2.3999632297286535 // golden angle
  const y = 1 - (i / 45) * 2
  const rad = Math.sqrt(1 - y * y)
  return { x: Math.cos(g * i) * rad, y, z: Math.sin(g * i) * rad }
})

interface NodeCloudCfg {
  cx: number
  cy: number
  sx: number
  sy: number
  rotSpeed: number
  rotPhase: number
  nodeAlpha: number
  edgeAlpha: number
  nodeScale: number
}

function drawNodeCloud(ctx: CanvasRenderingContext2D, s: Signal, alpha: number, c: NodeCloudCfg) {
  const rot = s.t * c.rotSpeed + c.rotPhase
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const near = Math.min(c.sx, c.sy) * 0.5
  const pts = NODES.map(n => {
    const x = n.x * cos - n.z * sin
    const z = n.x * sin + n.z * cos
    const persp = 1 / (1.9 - z)
    return { sx: c.cx + x * c.sx * persp, sy: c.cy + n.y * c.sy * persp, depth: persp }
  })
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = 0.8
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].sx - pts[j].sx, pts[i].sy - pts[j].sy)
      if (d > near) continue
      const edge = (1 - d / near) * c.edgeAlpha * (0.4 + s.mid * 0.6)
      ctx.strokeStyle = `rgba(${CYAN}, ${edge})`
      ctx.beginPath()
      ctx.moveTo(pts[i].sx, pts[i].sy)
      ctx.lineTo(pts[j].sx, pts[j].sy)
      ctx.stroke()
    }
  }
  ctx.shadowBlur = 8 + s.high * 14
  ctx.shadowColor = `rgba(${ICE}, ${0.55 * alpha})`
  for (const p of pts) {
    const rr = (1.0 + s.high * 2.3) * p.depth * c.nodeScale
    ctx.fillStyle = `rgba(${ICE}, ${clamp01((0.3 + p.depth * 0.5) * c.nodeAlpha)})`
    ctx.beginPath()
    ctx.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// Three node clouds — different sizes, overlapping, together filling the panel.
// Each pans on its own slow path (parallax) so the field drifts behind the
// label. Drawn back (faint, small, drifts most) → front (bright, large).
const drawConstellation: SceneFn = (ctx, w, h, s, alpha) => {
  const pulse = 1 + 0.03 * s.beat
  drawNodeCloud(ctx, s, alpha, {
    cx: w * 0.72 + Math.sin(s.t * 0.11) * w * 0.17 + Math.sin(s.t * 0.37) * w * 0.03,
    cy: h * 0.26 + Math.cos(s.t * 0.13) * h * 0.15,
    sx: w * 0.30 * pulse, sy: h * 0.26 * pulse,
    rotSpeed: -0.22, rotPhase: 1.7,
    nodeAlpha: 0.5, edgeAlpha: 0.3, nodeScale: 0.8,
  })
  drawNodeCloud(ctx, s, alpha, {
    cx: w * 0.3 + Math.cos(s.t * 0.09) * w * 0.11,
    cy: h * 0.7 + Math.sin(s.t * 0.1) * h * 0.1,
    sx: w * 0.40 * pulse, sy: h * 0.34 * pulse,
    rotSpeed: 0.16, rotPhase: 4.1,
    nodeAlpha: 0.72, edgeAlpha: 0.4, nodeScale: 0.95,
  })
  drawNodeCloud(ctx, s, alpha, {
    cx: w * 0.5 + Math.sin(s.t * 0.07) * w * 0.06,
    cy: h * 0.47 + Math.cos(s.t * 0.08) * h * 0.05,
    sx: w * 0.50 * pulse, sy: h * 0.44 * pulse,
    rotSpeed: 0.35, rotPhase: 0,
    nodeAlpha: 1, edgeAlpha: 0.5, nodeScale: 1,
  })
}

// ── Scene: CANVAS — receding wireframe prism tunnel ──────────────────────────
const drawTunnel: SceneFn = (ctx, w, h, s, alpha) => {
  const cx = w / 2 + Math.sin(s.t * 0.4) * w * 0.05
  const cy = h / 2 + Math.cos(s.t * 0.33) * h * 0.04
  const rings = 18
  const sides = 6
  ctx.save()
  ctx.globalAlpha = alpha

  // central vanishing glow
  const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.16)
  vg.addColorStop(0, `rgba(${ICE}, ${0.12 + s.beat * 0.1})`)
  vg.addColorStop(1, `rgba(${ICE}, 0)`)
  ctx.fillStyle = vg
  ctx.fillRect(cx - w, cy - h, w * 2, h * 2)

  // build every ring's vertices once
  const ringPts: Array<Array<[number, number]>> = []
  const ringFade: number[] = []
  const ringDepth: number[] = []
  for (let k = 0; k < rings; k++) {
    const p = (k + (s.t * 0.9) % 1) / rings
    const size = Math.pow(1.4, p * rings) * (6 + s.energy * 5)
    const spin = s.t * (0.35 + k * 0.04) + k * 0.42
    const verts: Array<[number, number]> = []
    for (let i = 0; i <= sides; i++) {
      const ang = spin + (i / sides) * Math.PI * 2
      verts.push([cx + Math.cos(ang) * size, cy + Math.sin(ang) * size])
    }
    ringPts.push(verts)
    ringFade.push((1 - p) * (0.5 + s.low * 0.5))
    ringDepth.push(1 - p)
  }

  // spokes: connect each ring's corners to the next ring's — a tunnel mesh
  ctx.lineWidth = 0.7
  for (let k = 0; k < rings - 1; k++) {
    const a = ringPts[k]
    const b = ringPts[k + 1]
    ctx.strokeStyle = `rgba(${CYAN}, ${Math.min(ringFade[k], ringFade[k + 1]) * 0.45})`
    ctx.beginPath()
    for (let i = 0; i < sides; i++) {
      ctx.moveTo(a[i][0], a[i][1])
      ctx.lineTo(b[i][0], b[i][1])
    }
    ctx.stroke()
  }

  // ring outlines + corner nodes, far → near
  for (let k = rings - 1; k >= 0; k--) {
    const mix = (k + (s.t * 0.9) % 1) / rings
    const cr = Math.round((1 - mix) * 142 + mix * 6)
    const cg = Math.round((1 - mix) * 244 + mix * 120)
    const cb = Math.round((1 - mix) * 255 + mix * 160)
    const fade = ringFade[k]
    const v = ringPts[k]
    ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${fade})`
    ctx.lineWidth = 1.3
    ctx.shadowBlur = 7 * fade
    ctx.shadowColor = `rgba(${CYAN}, ${fade * alpha})`
    ctx.beginPath()
    for (let i = 0; i <= sides; i++) i === 0 ? ctx.moveTo(v[i][0], v[i][1]) : ctx.lineTo(v[i][0], v[i][1])
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = `rgba(${ICE}, ${clamp01(fade * 1.2)})`
    for (let i = 0; i < sides; i++) {
      ctx.beginPath()
      ctx.arc(v[i][0], v[i][1], 0.9 + ringDepth[k] * 1.7, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // speck field streaming outward past the camera
  ctx.fillStyle = `rgba(${ICE}, 1)`
  for (let i = 0; i < 40; i++) {
    const sp = (s.t * 0.5 + i * 0.137) % 1
    const dd = Math.pow(1.4, sp * rings) * (6 + s.energy * 5) * 0.9
    const ang = i * 2.399 + s.t * 0.2
    ctx.globalAlpha = alpha * (1 - sp) * 0.55
    ctx.beginPath()
    ctx.arc(cx + Math.cos(ang) * dd, cy + Math.sin(ang) * dd, 0.8 + sp * 1.3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = alpha
  ctx.restore()
}

// ── Scene: LaserDMX — festival rig, cue-sequenced to the beat grid ───────────
const LASER_COLS = [CYAN, ICE, MAGENTA, GREEN, CYAN, ICE, CYAN, GREEN, ICE, MAGENTA, CYAN, ICE]

const drawBeams: SceneFn = (ctx, w, h, s, alpha) => {
  const beat = s.t * (BPM / 60)
  const bar = Math.floor(beat / 4)
  const cue = bar % 5
  const eighth = Math.floor(beat * 2)
  const kick = s.beat
  const beatInBar = beat % 4
  // pre-drop blackout: last half beat of every 4th bar
  const blackout = bar % 4 === 3 && beatInBar > 3.5
  const N = LASER_COLS.length
  // Rig around the whole frame: 0-2 ceiling truss, 3-4 side walls, 5-6 floor.
  const E: Array<[number, number]> = [
    [w * 0.12, h * 0.05],
    [w * 0.5, h * 0.03],
    [w * 0.88, h * 0.05],
    [w * 0.03, h * 0.52],
    [w * 0.97, h * 0.52],
    [w * 0.26, h * 0.97],
    [w * 0.74, h * 0.97],
  ]

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha

  for (let i = 0; i < N; i++) {
    let eIdx = i % 7
    let tx = 0
    let ty = 0
    let on = true

    if (cue === 0) {
      // full cage — every emitter fires across to the opposite side
      eIdx = i % 7
      const [ex, ey] = E[eIdx]
      tx = w - ex + Math.sin(s.t * 0.6 + i) * w * 0.22
      ty = h - ey + Math.cos(s.t * 0.5 + i) * h * 0.16
    } else if (cue === 1) {
      // side-wall criss-cross — left↔right, sweeping the vertical
      eIdx = i % 2 === 0 ? 3 : 4
      tx = (eIdx === 3 ? w * 0.98 : w * 0.02) + Math.sin(s.t * 0.9 + i) * w * 0.12
      ty = h * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(s.t * 0.7 + i * 0.6)))
    } else if (cue === 2) {
      // vertical strobe — ceiling AND floor, hard 8th-note chase
      eIdx = i % 3 === 0 ? 5 : i % 3 === 1 ? 6 : 1
      const [ex, ey] = E[eIdx]
      tx = ex + (i / (N - 1) - 0.5) * w * 0.12
      ty = ey < h / 2 ? h * 1.12 : h * -0.12
      on = (eighth + i) % 2 === 0
    } else if (cue === 3) {
      // slow arcing sweep — a few from ceiling, a few from the floor
      on = i < 5
      eIdx = i % 2 === 0 ? 1 : i % 4 === 1 ? 5 : 6
      const a = s.t * 0.7 + i * 0.55
      tx = w * (0.5 + Math.cos(a) * 0.72)
      ty = h * (0.5 + Math.sin(a) * 0.55)
    } else {
      // X-wall — fan up from the floor and down from the ceiling at once
      eIdx = i % 4 === 0 ? 5 : i % 4 === 1 ? 6 : i % 4 === 2 ? 0 : 2
      const [, ey] = E[eIdx]
      const f = (i / (N - 1)) * 2 - 1
      tx = w * 0.5 + f * w * 0.72 + Math.sin(s.t * 0.4) * w * 0.05
      ty = ey < h / 2 ? h * 1.08 : h * -0.08
    }
    if (blackout) on = false
    if (!on) continue

    const [sx, sy] = E[eIdx]
    const dx = tx - sx
    const dy = ty - sy
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    const perpX = -ny
    const perpY = nx
    const bl = dist * 1.02
    const flick = 0.65 + 0.35 * Math.sin(s.t * 32 + i * 3.3)
    const base = cue === 2 ? 0.5 : 0.16
    const bright = clamp01(base + kick * 0.55 + 0.12 * Math.sin(s.t * 1.7 + i)) * flick
    const hw = 1 + kick * 1.4
    const col = LASER_COLS[i]

    const g = ctx.createLinearGradient(sx, sy, sx + nx * bl, sy + ny * bl)
    g.addColorStop(0, `rgba(${col}, ${bright})`)
    g.addColorStop(0.45, `rgba(${col}, ${bright * 0.3})`)
    g.addColorStop(1, `rgba(${col}, 0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(sx + perpX * hw, sy + perpY * hw)
    ctx.lineTo(sx + nx * bl + perpX * hw * 3.4, sy + ny * bl + perpY * hw * 3.4)
    ctx.lineTo(sx + nx * bl - perpX * hw * 3.4, sy + ny * bl - perpY * hw * 3.4)
    ctx.lineTo(sx - perpX * hw, sy - perpY * hw)
    ctx.closePath()
    ctx.fill()

    // hot core + landing splash where it hits
    ctx.strokeStyle = `rgba(${ICE}, ${bright * 0.5})`
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + nx * bl, sy + ny * bl)
    ctx.stroke()
    ctx.fillStyle = `rgba(${ICE}, ${bright * 0.7})`
    ctx.beginPath()
    ctx.arc(tx, ty, 1.4 + kick * 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // emitter housings
  ctx.shadowColor = `rgba(${ICE}, ${alpha})`
  for (const [ex, ey] of E) {
    ctx.shadowBlur = 10 + kick * 20
    ctx.fillStyle = `rgba(${ICE}, ${clamp01(0.28 + kick * 0.5)})`
    ctx.beginPath()
    ctx.arc(ex, ey, 2.4 + kick * 3, 0, Math.PI * 2)
    ctx.fill()
  }
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
const SCENE_NAMES = ['SOUND DRAWING', 'CINEMA', 'CANVAS', 'LASERDMX', 'PIXGRID']
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
    window.addEventListener('resize', resize)

    let raf = 0
    let bootTimer = 0
    let disposed = false
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

    const paintStatic = () => {
      const staticSig: Signal = { t: 0.6, beat: 0, energy: 0.5, low: 0.5, mid: 0.6, high: 0.5 }
      ctx.fillStyle = '#030508'
      ctx.fillRect(0, 0, width, height)
      drawConstellation(ctx, width, height, staticSig, 1)
      drawEngineLabel(ctx, width, height, SCENE_NAMES[1], 1, staticSig, 1, 0)
    }

    // (Re)start the loop. Runs on a setTimeout watchdog until the emblem panel
    // has a real size — rAF alone can't self-heal here because it's paused
    // while the Electron window is still coming up, and the panel is 0×0 until
    // its `vh`-based layout settles.
    const start = () => {
      if (disposed) return
      cancelAnimationFrame(raf)
      resize()
      if (width < 2 || height < 2) {
        window.clearTimeout(bootTimer)
        bootTimer = window.setTimeout(start, 80)
        return
      }
      prev = performance.now()
      raf = requestAnimationFrame(reduce ? paintStatic : frame)
    }
    start()

    const onVisibility = () => {
      if (!document.hidden) start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (typeof document.fonts?.ready?.then === 'function') {
      document.fonts.ready.then(start).catch(() => { /* metrics stay on fallback */ })
    }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearTimeout(bootTimer)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={canvasRef} className="auth-visualizer" aria-hidden="true" />
}
