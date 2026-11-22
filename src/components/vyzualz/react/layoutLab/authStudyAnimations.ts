/**
 * The Auth studies' animations. Each of the four mockups has its own animation language for the same six engines of the app (Sound Drawing, Cinema 2.0,
 * CANVAS, LaserDMX, PixGrid and Headliner), driven by a synthetic 124 BPM pulse like the production sign-in panel. No audio and no engine runtime:
 *
 *   schematic  thin engineering line drawings with callouts, one engine at a time
 *   glow       full-bleed additive light, one engine at a time
 *   type       flat kinetic typography: the engine's name moves the way the engine does
 *   matrix     all six engines at once, each on its own LED dot-matrix display; the active one lights up
 *
 * Colors are the brand's: cyan, ice, mint and magenta from the Brand Kit, on the sign-in ground.
 */
export const AUTH_ENGINES = ['Sound Drawing', 'Cinema 2.0', 'CANVAS', 'LaserDMX', 'PixGrid', 'Headliner'] as const
export type AuthAnimationStyle = 'schematic' | 'glow' | 'type' | 'matrix'

const ICE = '142, 244, 255', CYAN = '74, 199, 219', MAGENTA = '184, 79, 201', MINT = '97, 214, 170'
const BPM = 124, SCENE_MS = 4600, FADE_MS = 900, TAU = Math.PI * 2
const UI = '"Space Grotesk", "Helvetica Neue", sans-serif', MONO = '"Manrope", "Helvetica Neue", sans-serif'

interface Signal { t: number; beat: number; low: number; mid: number; high: number }
type Scene = (ctx: CanvasRenderingContext2D, w: number, h: number, s: Signal, engine: number) => void
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h)
}

/* ── schematic ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const SPEC = ['XY scope · 2 ch', 'Wireframe · orbit camera', 'Depth field · 8 planes', 'Fixture fan · 9 beams', 'Cell grid · 10 × 10', 'Decks · mixer · crossfader']
const schematic: Scene = (ctx, w, h, s, engine) => {
  const m = Math.min(w, h) * .6, cx = w / 2, cy = h / 2 + 6, r = m / 2
  ctx.fillStyle = '#060d10'; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = `rgba(${CYAN}, .07)`; ctx.lineWidth = 1
  for (let x = cx % 28; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
  for (let y = cy % 28; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
  ctx.strokeStyle = `rgba(${CYAN}, .85)`; ctx.fillStyle = `rgba(${ICE}, .9)`; ctx.lineWidth = 1.3; ctx.lineJoin = 'round'
  ctx.save(); ctx.translate(cx, cy)
  if (engine === 0) {
    ctx.strokeStyle = `rgba(${CYAN}, .3)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke()
    ctx.strokeStyle = `rgba(${ICE}, .9)`; ctx.beginPath()
    for (let i = 0; i <= 240; i++) { const a = i / 240 * TAU, k = .55 + .4 * s.low; const x = Math.sin(3 * a + s.t * .9) * r * k, y = Math.sin(2 * a + s.t * .5) * r * k; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.stroke()
  } else if (engine === 1) {
    const a = s.t * .5, b = s.t * .33, v = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z] as const)))
    const p = v.map(([x, y, z]) => { const x1 = x * Math.cos(a) - z * Math.sin(a), z1 = x * Math.sin(a) + z * Math.cos(a), y1 = y * Math.cos(b) - z1 * Math.sin(b), z2 = y * Math.sin(b) + z1 * Math.cos(b); const f = 2.8 / (2.8 + z2); return [x1 * f * r * .46, y1 * f * r * .46] })
    ctx.beginPath(); for (let i = 0; i < 8; i++) for (const j of [1, 2, 4]) if (!(i & j)) { ctx.moveTo(p[i][0], p[i][1]); ctx.lineTo(p[i | j][0], p[i | j][1]) } ctx.stroke()
    ctx.setLineDash([3, 5]); ctx.strokeStyle = `rgba(${CYAN}, .45)`; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .32, -.35, 0, TAU); ctx.stroke(); ctx.setLineDash([])
    ctx.beginPath(); ctx.arc(Math.cos(s.t * .8) * r, Math.sin(s.t * .8) * r * .32 * Math.cos(-.35) + Math.cos(s.t * .8) * r * Math.sin(-.35) * -.6, 3.2, 0, TAU); ctx.fill()
  } else if (engine === 2) {
    for (let k = 0; k < 8; k++) { const d = (k + s.t * .35) % 8 / 8, f = d * d, side = r * (.12 + f * 1.05); ctx.strokeStyle = `rgba(${CYAN}, ${.15 + .7 * d})`; box(ctx, -side, -side * .62, side * 2, side * 1.24, 6); ctx.stroke() }
    ctx.strokeStyle = `rgba(${CYAN}, .25)`; ctx.beginPath(); for (const [x, y] of [[-1, -.62], [1, -.62], [1, .62], [-1, .62]]) { ctx.moveTo(0, 0); ctx.lineTo(x * r * 1.17, y * r * 1.17) } ctx.stroke()
  } else if (engine === 3) {
    ctx.strokeStyle = `rgba(${CYAN}, .8)`; box(ctx, -14, -r, 28, 14, 3); ctx.stroke()
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) / 4 * .62 + Math.sin(s.t * .9) * .18, len = r * 1.9, ex = Math.sin(a) * len, ey = -r + 14 + Math.cos(a) * len * .8
      ctx.strokeStyle = `rgba(${i % 4 === 0 ? MAGENTA : CYAN}, .75)`; ctx.beginPath(); ctx.moveTo(0, -r + 14); ctx.lineTo(ex, ey); ctx.stroke(); ctx.beginPath(); ctx.arc(ex, ey, 2.4, 0, TAU); ctx.stroke()
    }
    ctx.strokeStyle = `rgba(${CYAN}, .3)`; ctx.beginPath(); ctx.moveTo(-r * 1.3, r * .9); ctx.lineTo(r * 1.3, r * .9); ctx.stroke()
  } else if (engine === 4) {
    const n = 10, c = m / n
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const on = Math.sin(x * .9 + s.t * 2) + Math.cos(y * .8 - s.t * 1.6) > .8
      ctx.strokeStyle = `rgba(${CYAN}, ${on ? .95 : .3})`; ctx.fillStyle = `rgba(${CYAN}, ${on ? .42 : 0})`; box(ctx, -r + x * c + 2, -r + y * c + 2, c - 4, c - 4, 3); on && ctx.fill(); ctx.stroke()
    }
  } else {
    for (const side of [-1, 1]) {
      const px = side * r * .78, a = s.t * 1.7 * side
      ctx.strokeStyle = `rgba(${CYAN}, .85)`; ctx.beginPath(); ctx.arc(px, -r * .12, r * .46, 0, TAU); ctx.moveTo(px + Math.cos(a) * r * .46, -r * .12 + Math.sin(a) * r * .46); ctx.lineTo(px, -r * .12); ctx.stroke()
      ctx.beginPath(); ctx.arc(px, -r * .12, r * .12, 0, TAU); ctx.stroke()
    }
    box(ctx, -r * .26, -r * .58, r * .52, r * .92, 4); ctx.stroke()
    for (let i = 0; i < 4; i++) { const x = -r * .17 + i * r * .115; ctx.beginPath(); ctx.moveTo(x, -r * .46); ctx.lineTo(x, r * .04); ctx.stroke(); ctx.fillStyle = `rgba(${ICE}, .9)`; ctx.fillRect(x - 3, -r * .3 + Math.sin(s.t * 1.3 + i) * r * .1, 6, 3) }
    ctx.beginPath(); ctx.moveTo(-r * .9, r * .74); ctx.lineTo(r * .9, r * .74); ctx.stroke(); ctx.fillRect(Math.sin(s.t * .7) * r * .6 - 5, r * .74 - 6, 10, 12)
  }
  ctx.restore()
  // Callouts: corner brackets, the engine's index and its spec line.
  ctx.strokeStyle = `rgba(${CYAN}, .55)`; ctx.lineWidth = 1.3
  for (const [x, y, dx, dy] of [[18, 18, 1, 1], [w - 18, 18, -1, 1], [18, h - 18, 1, -1], [w - 18, h - 18, -1, -1]] as const) { ctx.beginPath(); ctx.moveTo(x + dx * 14, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * 14); ctx.stroke() }
  ctx.fillStyle = `rgba(${ICE}, .92)`; ctx.font = `700 12px ${UI}`; ctx.textBaseline = 'top'; try { ctx.letterSpacing = '2px' } catch { /* older engines */ }
  ctx.fillText(`${String(engine + 1).padStart(2, '0')} / 06  ${AUTH_ENGINES[engine]!.toUpperCase()}`, 34, 30)
  ctx.font = `500 10px ${MONO}`; ctx.fillStyle = `rgba(196, 207, 211, .6)`; ctx.fillText(SPEC[engine]!.toUpperCase(), 34, 50)
  ctx.textBaseline = 'alphabetic'; ctx.fillText(`124 BPM`, 34, h - 30); try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
}

/* ── glow ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const glow: Scene = (ctx, w, h, s, engine) => {
  ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  const big = Math.max(w, h)
  if (engine === 0) {
    for (let k = 0; k < 6; k++) {
      ctx.beginPath(); ctx.lineWidth = 1.5 + k * .9; ctx.strokeStyle = `rgba(${k % 3 === 2 ? MAGENTA : k % 3 ? ICE : CYAN}, ${.4 - k * .04})`; ctx.shadowBlur = 16; ctx.shadowColor = `rgba(${CYAN}, .8)`
      for (let x = 0; x <= w; x += 8) { const y = h * .5 + Math.sin(x * .008 + s.t * (.9 + k * .22) + k) * h * (.1 + .12 * s.mid) + Math.sin(x * .023 - s.t * 1.4) * h * .03 * s.high * (k + 1) * .5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
      ctx.stroke()
    }
  } else if (engine === 1) {
    for (let i = 0; i < 170; i++) {
      const z = (hash(i) + s.t * .12) % 1, a = hash(i + 9) * TAU, d = z * z * big * .75, px = w / 2 + Math.cos(a) * d, py = h / 2 + Math.sin(a) * d * .7, tail = z * z * 34
      ctx.strokeStyle = `rgba(${i % 7 === 0 ? MAGENTA : ICE}, ${.15 + z * .7})`; ctx.lineWidth = .6 + z * 1.8
      ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * tail, py - Math.sin(a) * tail * .7); ctx.lineTo(px, py); ctx.stroke()
    }
    const g = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, big * .5); g.addColorStop(0, `rgba(${MAGENTA}, .14)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  } else if (engine === 2) {
    for (let k = 0; k < 6; k++) {
      const x = w * (.5 + .36 * Math.sin(s.t * (.21 + k * .07) + k * 2)), y = h * (.5 + .34 * Math.cos(s.t * (.17 + k * .05) + k)), r = big * (.24 + .04 * s.low)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = [CYAN, MAGENTA, MINT][k % 3]; g.addColorStop(0, `rgba(${c}, .38)`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    }
  } else if (engine === 3) {
    for (let k = 0; k < 14; k++) {
      const ox = [.12, .5, .88][k % 3]! * w, oy = k % 3 === 1 ? 0 : h, a = (k % 3 === 1 ? Math.PI / 2 : k % 3 ? Math.PI * 1.08 : Math.PI * 1.92) + Math.sin(s.t * .8 + k) * .5, len = big * 1.3
      ctx.strokeStyle = `rgba(${k % 5 === 0 ? MAGENTA : ICE}, ${.28 + s.beat * .3})`; ctx.lineWidth = 1.2; ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${CYAN}, .9)`
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * len, oy + Math.sin(a) * len * (k % 3 === 1 ? 1 : -.45)); ctx.stroke()
    }
  } else if (engine === 4) {
    const c = 34
    for (let y = 0; y < h / c; y++) for (let x = 0; x < w / c; x++) {
      const v = clamp01((Math.sin(x * .55 + s.t * 1.7) + Math.cos(y * .6 - s.t * 1.3) + Math.sin((x + y) * .3 + s.t)) / 2.2 - .2)
      if (v < .06) continue
      ctx.fillStyle = `rgba(${(x + y) % 9 === 0 ? MAGENTA : CYAN}, ${v * .55})`; ctx.shadowBlur = 10; ctx.shadowColor = `rgba(${CYAN}, .6)`; box(ctx, x * c + 3, y * c + 3, c - 6, c - 6, 5); ctx.fill()
    }
  } else {
    for (let k = 0; k < 4; k++) {
      const ox = w * (.2 + k * .2), a = Math.sin(s.t * .6 + k * 1.7) * .5, wid = .13 + .04 * s.beat, len = h * 1.15
      const g = ctx.createLinearGradient(ox, 0, ox + Math.sin(a) * len, len); g.addColorStop(0, `rgba(${k % 2 ? MAGENTA : ICE}, .34)`); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox + Math.sin(a - wid) * len * 1.1, len); ctx.lineTo(ox + Math.sin(a + wid) * len * 1.1, len); ctx.closePath(); ctx.fill()
    }
    const f = ctx.createLinearGradient(0, h * .8, 0, h); f.addColorStop(0, 'rgba(0,0,0,0)'); f.addColorStop(1, `rgba(${CYAN}, .2)`); ctx.fillStyle = f; ctx.fillRect(0, h * .8, w, h * .2)
  }
  ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over'
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .3, w / 2, h / 2, big * .75); v.addColorStop(0, 'rgba(4,6,10,0)'); v.addColorStop(1, 'rgba(4,6,10,.72)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h)
  ctx.font = `500 10px ${UI}`; ctx.textAlign = 'left'; ctx.fillStyle = `rgba(${ICE}, .75)`; try { ctx.letterSpacing = '3px' } catch { /* older engines */ }
  ctx.fillText(`NOW SHOWING  ·  ${AUTH_ENGINES[engine]!.toUpperCase()}`, 24, h - 22); try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
}

/* ── type ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
let pixelCanvas: HTMLCanvasElement | null = null
/** In a tall, narrow panel the type wall turns on its side and runs up the panel, as editorial layouts do. */
const kinetic: Scene = (ctx, w, h, s, engine) => {
  if (w >= h * .9) { kineticWall(ctx, w, h, s, engine); return }
  ctx.save(); ctx.translate(0, h); ctx.rotate(-Math.PI / 2); kineticWall(ctx, h, w, s, engine); ctx.restore()
}
const kineticWall: Scene = (ctx, w, h, s, engine) => {
  const name = AUTH_ENGINES[engine]!.toUpperCase()
  ctx.fillStyle = '#090d0f'; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(154, 178, 188, .12)'; ctx.lineWidth = 1
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(w * i / 6, 0); ctx.lineTo(w * i / 6, h); ctx.stroke() }
  // Size the name to the panel's width, then set it big.
  ctx.font = `800 100px ${UI}`; const size = Math.min(h * .34, 100 * (w * .88) / Math.max(1, ctx.measureText(name).width)), font = `800 ${size}px ${UI}`
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  const cx = w / 2, cy = h / 2, fill = (c: string) => { ctx.fillStyle = c }
  if (engine === 0) {
    // Each letter stretches like a level bar.
    const chars = [...name], widths = chars.map(c => ctx.measureText(c).width), total = widths.reduce((a, b) => a + b, 0); let x = cx - total / 2
    chars.forEach((c, i) => { const k = .55 + .95 * Math.abs(Math.sin(s.t * 3 + i * .9)) * (.5 + .5 * s.low); ctx.save(); ctx.translate(x + widths[i]! / 2, cy); ctx.scale(1, k); fill(i % 2 ? `rgb(${CYAN})` : `rgb(${ICE})`); ctx.fillText(c, 0, 0); ctx.restore(); x += widths[i]! })
  } else if (engine === 1) {
    for (let k = 3; k >= 0; k--) { const z = ((s.t * .35 + k / 4) % 1), sc = .45 + z * 1.1; ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.lineWidth = 1.5 / sc; ctx.strokeStyle = `rgba(${k % 2 ? MINT : ICE}, ${1 - z})`; ctx.strokeText(name, 0, 0); ctx.restore() }
  } else if (engine === 2) {
    ctx.globalCompositeOperation = 'lighter'
    for (const [c, off] of [[MAGENTA, -1], [CYAN, 0], [MINT, 1]] as const) { fill(`rgba(${c}, .75)`); ctx.fillText(name, cx + off * (6 + 10 * s.beat + Math.sin(s.t * 1.6) * 5), cy + off * Math.cos(s.t * 1.3) * 5) }
    ctx.globalCompositeOperation = 'source-over'
  } else if (engine === 3) {
    ctx.strokeStyle = `rgba(${CYAN}, .55)`; ctx.lineWidth = 1.2; ctx.strokeText(name, cx, cy)
    const bx = ((s.t * .32) % 1.3 - .15) * w, bw = w * .13
    ctx.save(); ctx.beginPath(); ctx.rect(bx, 0, bw, h); ctx.clip(); fill(`rgb(${ICE})`); ctx.fillText(name, cx, cy); ctx.restore()
    fill(`rgba(${MAGENTA}, .9)`); ctx.fillRect(bx, h * .16, 2, h * .68)
  } else if (engine === 4) {
    pixelCanvas ??= document.createElement('canvas')
    const px = Math.max(5, 8 + 14 * (1 - s.beat)), sw = Math.max(8, Math.floor(w / px)), sh = Math.max(8, Math.floor(h / px))
    pixelCanvas.width = sw; pixelCanvas.height = sh
    const p = pixelCanvas.getContext('2d')!; p.fillStyle = '#090d0f'; p.fillRect(0, 0, sw, sh); p.font = `800 ${size / px}px ${UI}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillStyle = `rgb(${CYAN})`; p.fillText(name, sw / 2, sh / 2)
    ctx.imageSmoothingEnabled = false; ctx.drawImage(pixelCanvas, 0, 0, w, h)
  } else {
    for (let row = -1; row <= 1; row++) {
      const dir = row === 0 ? -1 : 1, shift = ((s.t * 38 * dir) % (w * .95)); ctx.save(); ctx.translate(shift, cy + row * size * 1.05)
      for (const rep of [-1, 0, 1]) { const x = cx + rep * w * .95; if (row === 0) { fill(`rgb(${ICE})`); ctx.fillText(name, x, 0) } else { ctx.strokeStyle = `rgba(${row < 0 ? MAGENTA : CYAN}, .8)`; ctx.lineWidth = 1.4; ctx.strokeText(name, x, 0) } }
      ctx.restore()
    }
  }
  // Flat colour block on the beat, and the running order.
  fill(`rgba(${engine % 2 ? MAGENTA : CYAN}, ${.55 + .45 * s.beat})`); ctx.fillRect(w - 22, 0, 22, 12 + 28 * s.beat)
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; fill(`rgba(${ICE}, .8)`); ctx.font = `500 10px ${MONO}`; try { ctx.letterSpacing = '2px' } catch { /* older engines */ }
  ctx.fillText(`${String(engine + 1).padStart(2, '0')} — 06`, 20, h - 20); try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
}

/* ── matrix ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
const FIELD: ((x: number, y: number, s: Signal) => number)[] = [
  (x, y, s) => Math.exp(-(((y - (.5 + .3 * Math.sin(x * 12 + s.t * 3) * (.5 + s.low))) * 9) ** 2)),
  (x, y, s) => { const dx = x - .5, dy = (y - .5) * 1.4, d = Math.hypot(dx, dy), a = s.t * 1.1; return Math.exp(-(((d - .34) * 13) ** 2)) * .45 + Math.exp((-(((x - .5 - Math.cos(a) * .34) ** 2) + ((y - .5 - Math.sin(a) * .24) ** 2))) * 260) },
  (x, y, s) => .5 + .5 * Math.sin(Math.hypot(x - .5, (y - .5) * 1.5) * 20 - s.t * 4),
  (x, y, s) => { const ang = Math.atan2(y + .1, x - .5); let v = 0; for (let k = 0; k < 6; k++) v = Math.max(v, Math.exp(-(((ang - (Math.PI / 2 + (k - 2.5) * .28 + Math.sin(s.t + k) * .12)) * 22) ** 2))); return v },
  (x, y, s) => (Math.sin(Math.floor(x * 7) * 1.7 + s.t * 2) + Math.cos(Math.floor(y * 4) * 1.3 - s.t * 2.4) > .6 ? 1 : .1),
  (x, y, s) => { let v = 0; for (const c of [.27, .73]) { const d = Math.hypot((x - c) * 1.6, y - .5), a = Math.atan2(y - .5, (x - c) * 1.6) - s.t * (c < .5 ? 1.6 : -1.6); v = Math.max(v, Math.exp(-(((d - .3) * 14) ** 2)) * .6, d < .3 ? Math.exp(-((Math.sin(a) * d * 18) ** 2)) * (Math.cos(a) > 0 ? 1 : 0) : 0) } return Math.max(v, Math.abs(x - .5) < .06 && y > .75 - .35 * Math.abs(Math.sin(s.t * 3 + x * 30)) ? .9 : 0) },
]
const matrixTiles = (ctx: CanvasRenderingContext2D, w: number, h: number, s: Signal, activeEngine: number) => {
  ctx.fillStyle = '#04060a'; ctx.fillRect(0, 0, w, h)
  const pad = 14, gap = 10, cols = w > 460 ? 3 : 2, rows = Math.ceil(6 / cols), tw = (w - pad * 2 - gap * (cols - 1)) / cols, th = (h - pad * 2 - gap * (rows - 1)) / rows
  for (let e = 0; e < 6; e++) {
    const x = pad + (e % cols) * (tw + gap), y = pad + Math.floor(e / cols) * (th + gap), on = e === activeEngine, lh = 16
    ctx.fillStyle = on ? '#0b1318' : '#080d10'; box(ctx, x, y, tw, th, 6); ctx.fill()
    ctx.strokeStyle = on ? `rgba(${CYAN}, .7)` : 'rgba(154, 178, 188, .2)'; ctx.lineWidth = 1; ctx.stroke()
    const dot = Math.max(5, Math.min(9, tw / 28)), ncols = Math.floor((tw - 20) / dot), nrows = Math.floor((th - lh - 22) / dot)
    for (let j = 0; j < nrows; j++) for (let i = 0; i < ncols; i++) {
      const v = clamp01(FIELD[e]!((i + .5) / ncols, (j + .5) / nrows, s)) * (on ? 1 : .5)
      ctx.fillStyle = v > .08 ? `rgba(${e % 3 === 2 ? MAGENTA : e % 3 === 1 ? MINT : CYAN}, ${.2 + v * .8})` : `rgba(${CYAN}, .06)`
      ctx.beginPath(); ctx.arc(x + 10 + (i + .5) * dot, y + 10 + (j + .5) * dot, dot * .34, 0, TAU); ctx.fill()
    }
    ctx.fillStyle = on ? `rgb(${ICE})` : 'rgba(196, 207, 211, .5)'; ctx.font = `700 9px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; try { ctx.letterSpacing = '1.6px' } catch { /* older engines */ }
    ctx.fillText(AUTH_ENGINES[e]!.toUpperCase(), x + 22, y + th - lh / 2 - 3); try { ctx.letterSpacing = '0px' } catch { /* older engines */ }
    ctx.fillStyle = on ? `rgba(${MINT}, ${.55 + .45 * s.beat})` : 'rgba(154, 178, 188, .25)'; ctx.beginPath(); ctx.arc(x + 14, y + th - lh / 2 - 3, 2.6, 0, TAU); ctx.fill()
  }
}

const SCENES: Record<Exclude<AuthAnimationStyle, 'matrix'>, Scene> = { schematic, glow, type: kinetic }

/** Starts an animation on a canvas that fills its parent; returns what stops it. It pauses while hidden or off screen and draws one still frame for reduced motion. */
export function startAuthAnimation(canvas: HTMLCanvasElement, style: AuthAnimationStyle): () => void {
  const parent = canvas.parentElement, ctx = canvas.getContext('2d')
  if (!parent || !ctx) return () => undefined
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  let w = 0, h = 0, raf = 0, last = -Infinity, disposed = false, visible = true, prev = performance.now(), beatEnv = 0
  const started = prev
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5), rect = parent.getBoundingClientRect(); w = rect.width; h = rect.height
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const signal = (t: number, dt: number): Signal => {
    const bps = BPM / 60; if (Math.floor(t * bps) !== Math.floor((t - dt) * bps)) beatEnv = 1; beatEnv = Math.max(beatEnv - dt * 3.1, 0)
    const beat = beatEnv * beatEnv
    return { t, beat, low: clamp01(.42 + .32 * Math.sin(t * 1.3) + beat * .4), mid: clamp01(.45 + .3 * Math.sin(t * 2.1 + 1)), high: clamp01(.36 + .28 * Math.abs(Math.sin(t * 7.7)) + beat * .3) }
  }
  const paint = (t: number, dt: number) => {
    const s = signal(t, dt), elapsed = t * 1000, index = Math.floor(elapsed / SCENE_MS) % 6, into = elapsed % SCENE_MS
    ctx.save(); ctx.shadowBlur = 0
    if (style === 'matrix') matrixTiles(ctx, w, h, s, Math.floor(elapsed / 2300) % 6)
    else {
      const scene = SCENES[style]; scene(ctx, w, h, s, index)
      // Cross-fade into the next engine: draw it into a layer over the end of this one.
      if (into > SCENE_MS - FADE_MS) { const k = (into - (SCENE_MS - FADE_MS)) / FADE_MS; ctx.globalAlpha = k * k; scene(ctx, w, h, s, (index + 1) % 6) }
    }
    ctx.restore()
  }
  const frame = (now: number) => {
    if (disposed || !visible || document.hidden || w < 2 || h < 2) return
    if (now - last < 1000 / 30 - 1) { raf = requestAnimationFrame(frame); return }
    last = now; const dt = Math.min((now - prev) / 1000, .05); prev = now; paint(Math.max(0, (now - started) / 1000), dt); raf = requestAnimationFrame(frame)
  }
  const start = () => {
    if (disposed) return
    cancelAnimationFrame(raf); resize()
    if (w < 2 || h < 2) return
    if (reduce) { paint(.6, 0); return }
    prev = performance.now(); last = -Infinity; raf = requestAnimationFrame(frame)
  }
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(start) : null
  resizeObserver?.observe(parent)
  const intersection = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); if (visible) start(); else cancelAnimationFrame(raf) }) : null
  intersection?.observe(canvas)
  const onVisibility = () => { if (document.hidden) cancelAnimationFrame(raf); else start() }
  document.addEventListener('visibilitychange', onVisibility)
  start()
  if (typeof document.fonts?.ready?.then === 'function') document.fonts.ready.then(start).catch(() => undefined)
  return () => { disposed = true; cancelAnimationFrame(raf); resizeObserver?.disconnect(); intersection?.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
}
