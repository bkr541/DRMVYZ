// ── presetPosterArt ────────────────────────────────────────────────────────
//
// Layout Lab / Template → PRESETS tab → 01 · Poster Tile. The still that fills each preset card: one hand-composed frame per preset, drawn once
// on a 2D canvas (nothing animates), in the same palette and vocabulary as the ambient engine scenes on the login screen (AuthVisualizer): ice /
// cyan phosphor lines, additive glow, hex tunnels, laser fans. Each frame shows what the preset actually does to a picture rather than a tinted
// plate, so a card reads at a glance: Afterhours 2.0 is a laser-lit DJ floor, Fractures is a picture broken into shards sliding and glitching apart.
//
// Every frame is deterministic: the random scatter is seeded per kind, so a card looks the same on every render and in every test.

export const POSTER_ART_WIDTH = 240
export const POSTER_ART_HEIGHT = 160
/** Backing-store scale over the logical 240×160 frame, so the card stays crisp on a 2× display. */
export const POSTER_ART_SCALE = 2

export type PosterArtKind =
  | 'clean'
  | 'particleAura'
  | 'fractures'
  | 'laserImage'
  | 'tunnel'
  | 'rippleGrid'
  | 'afterhours'
  | 'reliquary'

const W = POSTER_ART_WIDTH
const H = POSTER_ART_HEIGHT
const CX = W / 2
const CY = H / 2
const TAU = Math.PI * 2

const ICE = '142, 244, 255'
const CYAN = '74, 199, 219'
const MAGENTA = '184, 79, 201'
const GREEN = '97, 214, 170'
const GOLD = '232, 195, 106'

type Rnd = () => number

/** mulberry32: a tiny seeded generator, so every frame is identical run to run. */
function seeded(seed: number): Rnd {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function verticalFill(ctx: CanvasRenderingContext2D, top: string, bottom: string) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
}

function radialGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`)
  gradient.addColorStop(1, `rgba(${rgb}, 0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

// ── Clean Playback: the source picture, untouched ────────────────────────────
function drawClean(ctx: CanvasRenderingContext2D) {
  verticalFill(ctx, '#15252b', '#0a1418')
  const fx = 34, fy = 16, fw = W - 68, fh = 104
  ctx.save()
  ctx.beginPath()
  ctx.rect(fx, fy, fw, fh)
  ctx.clip()
  const sky = ctx.createLinearGradient(0, fy, 0, fy + fh)
  sky.addColorStop(0, '#9cc4d2')
  sky.addColorStop(0.62, '#dcecf1')
  sky.addColorStop(1, '#f2e7cf')
  ctx.fillStyle = sky
  ctx.fillRect(fx, fy, fw, fh)
  ctx.fillStyle = '#fff6dd'
  ctx.beginPath()
  ctx.arc(fx + fw * 0.7, fy + fh * 0.4, 12, 0, TAU)
  ctx.fill()
  const hills: [string, number, number][] = [['#7c9aa4', 0.62, 0.9], ['#4b6b76', 0.74, 1.3], ['#243f49', 0.86, 0.7]]
  for (const [color, base, freq] of hills) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(fx, fy + fh)
    for (let x = 0; x <= fw; x += 4) ctx.lineTo(fx + x, fy + fh * base + Math.sin(x * 0.028 * freq + base * 9) * 9)
    ctx.lineTo(fx + fw, fy + fh)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(232, 244, 248, 0.5)'
  ctx.lineWidth = 1
  ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1)
  // an untouched-source tick row: no effect stack on top
  ctx.fillStyle = 'rgba(232, 244, 248, 0.32)'
  for (let i = 0; i < 5; i++) ctx.fillRect(fx + i * 12, fy + fh + 8, 8, 1.5)
}

// ── Particle Aura: a dense particle hologram, sliced and diffused ────────────
function drawParticleAura(ctx: CanvasRenderingContext2D) {
  const rnd = seeded(11)
  verticalFill(ctx, '#050d12', '#02070a')
  radialGlow(ctx, CX, 54, 92, ICE, 0.2)
  // the figure: a head and shoulders, tested by point-in-shape so the particles gather where the media is
  const inside = (x: number, y: number) => {
    const head = ((x - CX) / 27) ** 2 + ((y - 50) / 33) ** 2
    const shoulders = ((x - CX) / 62) ** 2 + ((y - 124) / 38) ** 2
    return Math.min(head, shoulders)
  }
  ctx.save()
  for (let i = 0; i < 12000; i++) {
    const x = CX - 78 + rnd() * 156
    const y = 10 + rnd() * 140
    const d = inside(x, y)
    if (d > 1.15 || rnd() > 0.85 - d * 0.5) continue
    // horizontal slices tear the hologram sideways, with a chromatic ghost either side
    const band = Math.floor(y / 9)
    const tear = (Math.sin(band * 12.9898) * 43758.5453) % 1 > 0.55 ? (rnd() < 0.5 ? -5 : 6) : 0
    // audio-reactive diffusion: particles at the rim drift out and right
    const drift = d > 0.8 ? (d - 0.8) * 26 * rnd() : 0
    const px = x + tear + drift
    const py = y - drift * 0.25
    const shade = 1 - d * 0.6
    ctx.fillStyle = `rgba(${ICE}, ${0.25 + shade * 0.7})`
    ctx.fillRect(px, py, 0.8 + shade * 0.5, 0.8 + shade * 0.5)
    if (tear !== 0 && rnd() < 0.5) {
      ctx.fillStyle = `rgba(${MAGENTA}, 0.5)`
      ctx.fillRect(px - 2.5, py, 1.2, 1.2)
      ctx.fillStyle = `rgba(${CYAN}, 0.5)`
      ctx.fillRect(px + 2.5, py, 1.2, 1.2)
    }
  }
  // scanline detail
  ctx.fillStyle = 'rgba(2, 8, 12, 0.32)'
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1)
  ctx.restore()
}

// ── Fractures: the picture broken into shards that slide, turn and glitch ────
function drawFractures(ctx: CanvasRenderingContext2D) {
  const rnd = seeded(23)
  const source = document.createElement('canvas')
  source.width = W
  source.height = H
  const s = source.getContext('2d')
  if (!s) return
  // the whole picture, before it breaks: a lit disc over a horizon
  const sky = s.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#1c3f52')
  sky.addColorStop(0.6, '#0e2733')
  sky.addColorStop(1, '#061119')
  s.fillStyle = sky
  s.fillRect(0, 0, W, H)
  const disc = s.createRadialGradient(CX - 8, CY - 12, 4, CX, CY, 56)
  disc.addColorStop(0, '#f2fdff')
  disc.addColorStop(0.5, '#7fdcf0')
  disc.addColorStop(1, '#1c8fb0')
  s.fillStyle = disc
  s.beginPath()
  s.arc(CX, CY, 52, 0, TAU)
  s.fill()
  s.fillStyle = 'rgba(6, 17, 25, 0.9)'
  s.fillRect(0, CY + 8, W, 3)
  s.fillRect(0, CY + 22, W, 6)
  s.fillStyle = '#e83a86'
  s.fillRect(CX - 64, CY - 30, 128, 3)

  // the ground the shards fall away from
  verticalFill(ctx, '#040a0f', '#02050a')
  radialGlow(ctx, CX, CY, 100, CYAN, 0.1)

  // a jittered lattice of triangles that tile the frame exactly, each then moved on its own
  const cols = 6
  const rows = 4
  const pts: [number, number][][] = []
  for (let r = 0; r <= rows; r++) {
    pts.push([])
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || r === rows || c === 0 || c === cols
      pts[r].push([(c / cols) * W + (edge ? 0 : (rnd() - 0.5) * 22), (r / rows) * H + (edge ? 0 : (rnd() - 0.5) * 20)])
    }
  }
  const shards: { tri: [number, number][]; cx: number; cy: number; d: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c], b = pts[r][c + 1], d = pts[r + 1][c], e = pts[r + 1][c + 1]
      const split: [number, number][][] = rnd() < 0.5 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]]
      for (const tri of split) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
        shards.push({ tri, cx, cy, d: Math.hypot(cx - CX, cy - CY) })
      }
    }
  }
  // far shards first, so the broken centre sits on top
  shards.sort((p, q) => q.d - p.d)
  for (const shard of shards) {
    const push = 0.04 + (shard.d / 140) * 0.24
    const dx = (shard.cx - CX) * push + (rnd() - 0.5) * 14
    const dy = (shard.cy - CY) * push + (rnd() - 0.5) * 12
    const turn = (rnd() - 0.5) * 0.34 * Math.min(1, 0.3 + shard.d / 90)
    ctx.save()
    ctx.translate(shard.cx + dx, shard.cy + dy)
    ctx.rotate(turn)
    ctx.translate(-shard.cx, -shard.cy)
    ctx.beginPath()
    shard.tri.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(source, 0, 0)
    // a share of the shards glitch: the picture inside slips sideways in strips, with a chromatic fringe
    if (rnd() < 0.36) {
      const strips = 3 + Math.floor(rnd() * 3)
      for (let i = 0; i < strips; i++) {
        const sy = shard.cy - 16 + rnd() * 32
        const sh = 2 + rnd() * 5
        const slip = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 16)
        ctx.drawImage(source, 0, sy, W, sh, slip, sy, W, sh)
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? MAGENTA : ICE}, 0.5)`
        ctx.fillRect(shard.cx - 24 + slip, sy, 48, 1)
      }
    }
    ctx.restore()
    // the bright cut edge
    ctx.save()
    ctx.translate(shard.cx + dx, shard.cy + dy)
    ctx.rotate(turn)
    ctx.translate(-shard.cx, -shard.cy)
    ctx.beginPath()
    shard.tri.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
    ctx.strokeStyle = `rgba(${ICE}, 0.34)`
    ctx.lineWidth = 0.7
    ctx.stroke()
    ctx.restore()
  }
}

// ── Laser Image FX: laser lines scanned across an edge-traced picture ────────
function drawLaserImage(ctx: CanvasRenderingContext2D) {
  const rnd = seeded(37)
  verticalFill(ctx, '#03110e', '#010604')
  radialGlow(ctx, CX, CY, 92, GREEN, 0.12)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  // scan lines, warped by perspective so they bow around the subject
  for (let i = 0; i < 12; i++) {
    const y = 18 + i * 11.5
    const bow = Math.sin(i * 0.9) * 6 + (i - 5.5) * 1.4
    ctx.strokeStyle = `rgba(${i % 3 === 0 ? ICE : GREEN}, ${0.32 + rnd() * 0.36})`
    ctx.shadowColor = `rgba(${GREEN}, 0.9)`
    ctx.shadowBlur = 8
    ctx.lineWidth = 0.8 + rnd() * 0.9
    ctx.beginPath()
    ctx.moveTo(-4, y + bow)
    ctx.bezierCurveTo(W * 0.3, y - bow * 2, W * 0.7, y + bow * 2, W + 4, y - bow)
    ctx.stroke()
  }
  // the laserized edge of the subject: a peaked skyline with a ring
  ctx.strokeStyle = `rgba(${ICE}, 0.95)`
  ctx.shadowColor = `rgba(${ICE}, 1)`
  ctx.shadowBlur = 12
  ctx.lineWidth = 1.5
  ctx.beginPath()
  const ridge = [[10, 132], [48, 96], [72, 112], [112, 52], [140, 86], [164, 68], [198, 118], [230, 104]]
  ridge.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(CX + 46, 38, 15, 0, TAU)
  ctx.stroke()
  // the bright scan point where the beam meets the edge
  ctx.shadowBlur = 0
  radialGlow(ctx, 112, 52, 18, '255, 255, 255', 0.85)
  ctx.restore()
}

// ── Kaleidoscope Bloom Tunnel: mirrored hex rings rushing at the camera ──────
function drawTunnel(ctx: CanvasRenderingContext2D) {
  verticalFill(ctx, '#0c0614', '#04020a')
  const sides = 6
  ctx.save()
  ctx.translate(CX, CY)
  // mirrored wedges: the kaleidoscope, alternate slices lit
  for (let i = 0; i < sides * 2; i++) {
    const a0 = (i / (sides * 2)) * TAU
    const a1 = ((i + 1) / (sides * 2)) * TAU
    ctx.fillStyle = `rgba(${MAGENTA}, ${i % 2 === 0 ? 0.13 : 0.04})`
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, 190, a0, a1)
    ctx.closePath()
    ctx.fill()
  }
  const rings = 15
  ctx.lineJoin = 'round'
  for (let k = rings - 1; k >= 0; k--) {
    const p = k / rings
    const size = 5 * 1.33 ** k
    const fade = 1 - p * 0.86
    const spin = k * 0.22
    ctx.strokeStyle = `rgba(${p < 0.5 ? ICE : MAGENTA}, ${fade * 0.9})`
    ctx.shadowColor = `rgba(${MAGENTA}, ${fade})`
    ctx.shadowBlur = 8 * fade
    ctx.lineWidth = 0.7 + (1 - p) * 1.4
    ctx.beginPath()
    for (let i = 0; i <= sides; i++) {
      const ang = spin + (i / sides) * TAU
      const x = Math.cos(ang) * size
      const y = Math.sin(ang) * size
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
  // the bloom at the vanishing point
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  radialGlow(ctx, CX, CY, 46, MAGENTA, 0.55)
  radialGlow(ctx, CX, CY, 16, '255, 235, 255', 0.8)
  ctx.restore()
}

// ── Audio Reactive Ripple Grid: a golden grid pushed into waves ──────────────
function drawRippleGrid(ctx: CanvasRenderingContext2D) {
  verticalFill(ctx, '#120e05', '#060402')
  radialGlow(ctx, CX - 20, CY + 4, 96, GOLD, 0.13)
  const ox = CX - 20
  const oy = CY + 4
  const warp = (x: number, y: number): [number, number] => {
    const dx = x - ox
    const dy = y - oy
    const dist = Math.hypot(dx, dy) || 1
    const push = Math.sin(dist * 0.21) * 7 * Math.exp(-dist / 105)
    return [x + (dx / dist) * push, y + (dy / dist) * push]
  }
  ctx.save()
  ctx.lineWidth = 0.8
  const drawLine = (from: [number, number], to: [number, number]) => {
    const steps = 30
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const [x, y] = warp(from[0] + (to[0] - from[0]) * (i / steps), from[1] + (to[1] - from[1]) * (i / steps))
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let r = 0; r <= 14; r++) {
    const y = 4 + r * 11.4
    ctx.strokeStyle = `rgba(${GOLD}, ${0.25 + 0.4 * Math.exp(-Math.abs(y - oy) / 50)})`
    drawLine([0, y], [W, y])
  }
  for (let c = 0; c <= 22; c++) {
    const x = c * 11
    ctx.strokeStyle = `rgba(${GOLD}, ${0.25 + 0.4 * Math.exp(-Math.abs(x - ox) / 70)})`
    drawLine([x, 0], [x, H])
  }
  // the ripple crests lit brighter where the wave peaks
  ctx.globalCompositeOperation = 'lighter'
  ctx.shadowColor = `rgba(${GOLD}, 0.9)`
  ctx.shadowBlur = 6
  for (let ring = 1; ring <= 4; ring++) {
    ctx.strokeStyle = `rgba(255, 233, 170, ${0.7 / ring})`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(ox, oy, ring * 24, ring * 17, 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

// ── Afterhours 2.0: a laser-lit DJ floor ─────────────────────────────────────
function drawAfterhours(ctx: CanvasRenderingContext2D) {
  const rnd = seeded(53)
  verticalFill(ctx, '#05030b', '#10071a')
  // haze the beams scatter in
  const haze = ctx.createLinearGradient(0, 30, 0, H)
  haze.addColorStop(0, 'rgba(120, 60, 170, 0)')
  haze.addColorStop(0.7, 'rgba(120, 60, 170, 0.2)')
  haze.addColorStop(1, 'rgba(60, 200, 220, 0.12)')
  ctx.fillStyle = haze
  ctx.fillRect(0, 0, W, H)

  // laser emitters along the overhead truss, each fanning into the room
  const emitters = [22, 66, 120, 174, 218]
  const colors = [MAGENTA, CYAN, GREEN, CYAN, MAGENTA]
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  emitters.forEach((ex, i) => {
    const rgb = colors[i]
    const fan = 5
    for (let b = 0; b < fan; b++) {
      const aim = -0.95 + (b / (fan - 1)) * 1.9 + (ex - CX) * -0.0035
      const tx = ex + Math.sin(aim) * 230
      const ty = Math.cos(aim) * 230
      // the cone the beam lights in the haze
      const cone = ctx.createLinearGradient(ex, 0, tx, ty)
      cone.addColorStop(0, `rgba(${rgb}, 0.2)`)
      cone.addColorStop(1, `rgba(${rgb}, 0)`)
      ctx.fillStyle = cone
      ctx.beginPath()
      ctx.moveTo(ex, 0)
      ctx.lineTo(tx - 7, ty)
      ctx.lineTo(tx + 7, ty)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = `rgba(${rgb}, ${0.55 + rnd() * 0.4})`
      ctx.shadowColor = `rgba(${rgb}, 1)`
      ctx.shadowBlur = 7
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(ex, 0)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    radialGlow(ctx, ex, 3, 14, rgb, 0.9)
  })
  ctx.restore()

  // the truss, the booth and the DJ
  ctx.fillStyle = '#0a0612'
  ctx.fillRect(0, 0, W, 4)
  ctx.fillStyle = '#07040d'
  ctx.fillRect(CX - 42, 100, 84, 34)
  ctx.fillStyle = `rgba(${ICE}, 0.85)`
  ctx.fillRect(CX - 40, 100, 80, 1.5)
  for (const dx of [-22, 22]) {
    ctx.strokeStyle = `rgba(${MAGENTA}, 0.9)`
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(CX + dx, 108, 8, 0, TAU)
    ctx.stroke()
  }
  ctx.fillStyle = '#04020a'
  ctx.beginPath()
  ctx.arc(CX, 78, 8, 0, TAU)
  ctx.fill()
  ctx.fillRect(CX - 12, 86, 24, 16)
  // crowd: heads and raised hands along the foot
  ctx.fillStyle = '#030108'
  for (let i = 0; i < 26; i++) {
    const x = 4 + i * 9.4 + (rnd() - 0.5) * 4
    const y = 142 + rnd() * 10
    ctx.beginPath()
    ctx.arc(x, y, 6 + rnd() * 2, 0, TAU)
    ctx.fill()
    if (rnd() < 0.4) ctx.fillRect(x + (rnd() < 0.5 ? -7 : 5), y - 16, 2, 14)
  }
  ctx.fillRect(0, 152, W, 8)
}

// ── RELIQUARY: a crystal cloud with a golden tree through it, in a dark wood ──
function branch(ctx: CanvasRenderingContext2D, rnd: Rnd, x: number, y: number, angle: number, length: number, depth: number, width: number) {
  if (depth <= 0) return
  const x2 = x + Math.cos(angle) * length
  const y2 = y + Math.sin(angle) * length
  ctx.lineWidth = Math.max(0.5, width)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const kids = depth > 2 ? 2 : 1 + Math.floor(rnd() * 2)
  for (let i = 0; i < kids; i++) {
    const turn = (i === 0 ? -1 : 1) * (0.3 + rnd() * 0.5)
    branch(ctx, rnd, x2, y2, angle + turn, length * (0.66 + rnd() * 0.12), depth - 1, width * 0.66)
  }
}

function cloudPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x - 46 * s, y + 14 * s)
  ctx.bezierCurveTo(x - 64 * s, y + 14 * s, x - 64 * s, y - 14 * s, x - 40 * s, y - 12 * s)
  ctx.bezierCurveTo(x - 40 * s, y - 38 * s, x - 6 * s, y - 42 * s, x + 4 * s, y - 22 * s)
  ctx.bezierCurveTo(x + 14 * s, y - 40 * s, x + 46 * s, y - 30 * s, x + 42 * s, y - 6 * s)
  ctx.bezierCurveTo(x + 62 * s, y - 4 * s, x + 62 * s, y + 16 * s, x + 44 * s, y + 14 * s)
  ctx.closePath()
}

function drawReliquary(ctx: CanvasRenderingContext2D) {
  const rnd = seeded(71)
  verticalFill(ctx, '#020706', '#07120f')
  radialGlow(ctx, CX, 70, 100, ICE, 0.11)

  // flanking forest, near-black with a faint rim light from the centre
  ctx.save()
  ctx.lineCap = 'round'
  const trees: [number, number, number, number][] = [[14, 132, 34, 6], [44, 128, 24, 3.6], [226, 132, 34, 6], [196, 128, 24, 3.6]]
  for (const [tx, ty, len, width] of trees) {
    ctx.strokeStyle = `rgba(3, 9, 8, ${width > 4 ? 1 : 0.9})`
    branch(ctx, rnd, tx, ty, -Math.PI / 2 + (tx < CX ? 0.12 : -0.12), len, 6, width)
    ctx.strokeStyle = `rgba(${ICE}, 0.13)`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(tx + (tx < CX ? 2 : -2), ty)
    ctx.lineTo(tx + (tx < CX ? 3 : -3), ty - len * 1.5)
    ctx.stroke()
  }
  ctx.restore()

  // overhead cue lights: pale cones raking down from above the logo
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const [lx, tilt] of [[70, 0.16], [104, 0.05], [136, -0.05], [170, -0.16]] as const) {
    const cone = ctx.createLinearGradient(lx, 0, lx + tilt * 120, 120)
    cone.addColorStop(0, 'rgba(255, 244, 214, 0.26)')
    cone.addColorStop(1, 'rgba(255, 244, 214, 0)')
    ctx.fillStyle = cone
    ctx.beginPath()
    ctx.moveTo(lx - 1.5, 0)
    ctx.lineTo(lx + tilt * 120 - 13, 120)
    ctx.lineTo(lx + tilt * 120 + 13, 120)
    ctx.lineTo(lx + 1.5, 0)
    ctx.closePath()
    ctx.fill()
    radialGlow(ctx, lx, 2, 9, '255, 244, 214', 0.95)
  }
  ctx.restore()

  // the wet floor: the glow lying on a dark mirror
  const floor = ctx.createLinearGradient(0, 118, 0, H)
  floor.addColorStop(0, 'rgba(142, 244, 255, 0.16)')
  floor.addColorStop(1, 'rgba(2, 6, 5, 0.95)')
  ctx.fillStyle = floor
  ctx.fillRect(0, 118, W, H - 118)

  // the crystal cloud logo: a faceted glass body with a bright edge
  ctx.save()
  cloudPath(ctx, CX, 66, 1.05)
  const glass = ctx.createLinearGradient(CX - 60, 30, CX + 60, 90)
  glass.addColorStop(0, 'rgba(226, 250, 255, 0.5)')
  glass.addColorStop(0.5, 'rgba(142, 220, 240, 0.2)')
  glass.addColorStop(1, 'rgba(230, 210, 255, 0.4)')
  ctx.fillStyle = glass
  ctx.fill()
  ctx.clip()
  for (let i = 0; i < 20; i++) {
    const ax = CX - 60 + rnd() * 120
    const ay = 26 + rnd() * 62
    const bx = ax + (rnd() - 0.5) * 60
    const by = ay + (rnd() - 0.5) * 44
    const tri = ctx.createLinearGradient(ax, ay, bx, by)
    tri.addColorStop(0, `rgba(255, 255, 255, ${0.05 + rnd() * 0.18})`)
    tri.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = tri
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.lineTo(bx + (rnd() - 0.5) * 40, by + (rnd() - 0.5) * 30)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + rnd() * 0.22})`
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
  ctx.restore()
  ctx.save()
  cloudPath(ctx, CX, 66, 1.05)
  ctx.strokeStyle = 'rgba(232, 250, 255, 0.95)'
  ctx.shadowColor = `rgba(${ICE}, 0.95)`
  ctx.shadowBlur = 10
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  // the golden tree threading up through the logo, its roots spread below
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = `rgba(${GOLD}, 0.95)`
  ctx.shadowColor = `rgba(${GOLD}, 0.95)`
  ctx.shadowBlur = 8
  branch(ctx, rnd, CX, 134, -Math.PI / 2, 30, 5, 3.2)
  ctx.strokeStyle = `rgba(${GOLD}, 0.8)`
  for (const side of [-1, 1]) {
    branch(ctx, rnd, CX + side * 1.5, 134, Math.PI / 2 + side * 0.75, 15, 4, 1.8)
    branch(ctx, rnd, CX + side * 1.5, 134, Math.PI / 2 + side * 1.25, 13, 3, 1.4)
  }
  ctx.restore()
}

const DRAWERS: Record<PosterArtKind, (ctx: CanvasRenderingContext2D) => void> = {
  clean: drawClean,
  particleAura: drawParticleAura,
  fractures: drawFractures,
  laserImage: drawLaserImage,
  tunnel: drawTunnel,
  rippleGrid: drawRippleGrid,
  afterhours: drawAfterhours,
  reliquary: drawReliquary,
}

/** Paints one still onto a canvas context sized POSTER_ART_WIDTH × POSTER_ART_HEIGHT × POSTER_ART_SCALE. */
export function drawPosterArt(ctx: CanvasRenderingContext2D, kind: PosterArtKind) {
  ctx.save()
  ctx.setTransform(POSTER_ART_SCALE, 0, 0, POSTER_ART_SCALE, 0, 0)
  ctx.beginPath()
  ctx.rect(0, 0, W, H)
  ctx.clip()
  DRAWERS[kind](ctx)
  ctx.restore()
}
