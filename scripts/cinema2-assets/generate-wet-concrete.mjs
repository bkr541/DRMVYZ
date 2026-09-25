// Generates the in-house tileable wet-concrete surface texture used by the Cinema 2.0 reflective floor.
//   node scripts/cinema2-assets/generate-wet-concrete.mjs <out.png> [size=1024]
// Layout `surface-normal-crack-roughness`: R,G = tangent-space normal xy (0.5 = flat), B = crack mask, A = roughness.
// Everything is periodic (value noise on a wrapped lattice, wrapped Worley cells), so the texture tiles without seams.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const outPath = process.argv[2]
const size = Number(process.argv[3] ?? 1024)
if (!outPath) throw new Error('usage: generate-wet-concrete.mjs <out.png> [size]')

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
// Periodic value noise: `period` lattice cells wrap around the tile.
function valueNoise(u, v, period, seed) {
  const x = u * period
  const y = v * period
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const w = (i) => ((i % period) + period) % period
  const a = hash(w(x0), w(y0), seed)
  const b = hash(w(x0 + 1), w(y0), seed)
  const c = hash(w(x0), w(y0 + 1), seed)
  const d = hash(w(x0 + 1), w(y0 + 1), seed)
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy
}
function fbm(u, v, basePeriod, octaves, seed) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(u, v, basePeriod * 2 ** o, seed + o * 17) * amp
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}
// Periodic Voronoi: exact distance (in cell units) from the point to the nearest cell border, so crack widths stay even.
function voronoiBorder(u, v, cells, seed) {
  const x = u * cells
  const y = v * cells
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const seedAt = (gx, gy) => {
    const wx = ((gx % cells) + cells) % cells
    const wy = ((gy % cells) + cells) % cells
    return [gx + hash(wx, wy, seed), gy + hash(wx, wy, seed + 101)]
  }
  let nearest = null
  let best = 9
  for (let j = -2; j <= 2; j += 1) {
    for (let i = -2; i <= 2; i += 1) {
      const [px, py] = seedAt(cx + i, cy + j)
      const d = Math.hypot(px - x, py - y)
      if (d < best) { best = d; nearest = [px, py] }
    }
  }
  let border = 9
  for (let j = -2; j <= 2; j += 1) {
    for (let i = -2; i <= 2; i += 1) {
      const [px, py] = seedAt(cx + i, cy + j)
      if (px === nearest[0] && py === nearest[1]) continue
      const dx = px - nearest[0]
      const dy = py - nearest[1]
      const len = Math.hypot(dx, dy)
      const mx = (px + nearest[0]) * 0.5 - x
      const my = (py + nearest[1]) * 0.5 - y
      border = Math.min(border, (mx * dx + my * dy) / len)
    }
  }
  return border
}

const height = new Float32Array(size * size)
const crack = new Float32Array(size * size)
const rough = new Float32Array(size * size)
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const u = x / size
    const v = y / size
    const broad = fbm(u, v, 3, 5, 11)
    const grain = fbm(u, v, 48, 3, 23)
    // Cracks: borders of a domain-warped Voronoi field (so they meander instead of forming a clean polygon net), kept only where a
    // noise mask lets them through, so they are sparse and broken. A finer field adds hairline cracks around the main ones.
    const wu = u + (fbm(u, v, 5, 3, 91) - 0.5) * 0.09
    const wv = v + (fbm(u, v, 5, 3, 93) - 0.5) * 0.09
    const borderA = voronoiBorder(wu, wv, 4, 41)
    const borderB = voronoiBorder(wu + 0.31, wv + 0.17, 9, 77)
    const keepA = smooth(0.5, 0.58, fbm(u, v, 3, 3, 5))
    const keepB = smooth(0.58, 0.66, fbm(u, v, 6, 3, 9))
    const lineA = (1 - smooth(0.004, 0.02, borderA)) * keepA
    const lineB = (1 - smooth(0.003, 0.011, borderB)) * keepB * 0.75
    const c = Math.min(1, Math.max(lineA, lineB))
    const i = y * size + x
    crack[i] = c
    height[i] = broad * 0.6 + grain * 0.5 - c * 1.1
    rough[i] = Math.min(1, Math.max(0, 0.42 + (fbm(u, v, 6, 4, 61) - 0.5) * 0.9 + (grain - 0.5) * 0.25 + c * 0.35))
  }
}
function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const rgba = Buffer.alloc(size * size * 4)
const strength = 6.5
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const l = height[y * size + ((x - 1 + size) % size)]
    const r = height[y * size + ((x + 1) % size)]
    const t = height[((y - 1 + size) % size) * size + x]
    const b = height[((y + 1) % size) * size + x]
    const nx = (l - r) * strength
    const ny = (t - b) * strength
    const inv = 1 / Math.hypot(nx, ny, 1)
    const i = (y * size + x) * 4
    rgba[i] = Math.round((nx * inv * 0.5 + 0.5) * 255)
    rgba[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255)
    rgba[i + 2] = Math.round(crack[y * size + x] * 255)
    rgba[i + 3] = Math.round(rough[y * size + x] * 255)
  }
}

// Minimal PNG encoder (RGBA8, filter 0).
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0)
header.writeUInt32BE(size, 4)
header[8] = 8
header[9] = 6
const raw = Buffer.alloc((size * 4 + 1) * size)
for (let y = 0; y < size; y += 1) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${size}x${size}, ${(png.length / 1024).toFixed(0)} KB)`)
