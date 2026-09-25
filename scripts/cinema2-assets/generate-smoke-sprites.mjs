// Generates the in-house smoke puff sprite sheet used by Threshold's ground-smoke billboards.
//   node scripts/cinema2-assets/generate-smoke-sprites.mjs <out.png> [size=512]
// Layout `sprite-sheet-rgba`: a 2x2 grid of soft, billowy puffs. RGB is a grey shading (lit from the upper left, darker in the crevices) and
// A is the puff density, fading to 0 well inside each cell so neighbouring cells never bleed into each other under filtering or mipmapping.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const outPath = process.argv[2]
const size = Number(process.argv[3] ?? 512)
if (!outPath) throw new Error('usage: generate-smoke-sprites.mjs <out.png> [size]')

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function valueNoise(x, y, seed) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy
}
function fbm(x, y, seed, octaves = 5) {
  let sum = 0
  let amp = 0.5
  let total = 0
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x, y, seed + o * 17) * amp
    total += amp
    x *= 2.02
    y *= 2.02
    amp *= 0.5
  }
  return sum / total
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

const cell = size / 2
const rgba = Buffer.alloc(size * size * 4)
for (let py = 0; py < size; py += 1) {
  for (let px = 0; px < size; px += 1) {
    const cx = Math.floor(px / cell)
    const cy = Math.floor(py / cell)
    const seed = 100 + cy * 2 + cx
    const u = ((px % cell) / cell) * 2 - 1
    const v = ((py % cell) / cell) * 2 - 1
    const r = Math.hypot(u, v)
    // Billowy edge: the radius is pushed in and out by multi-octave noise, and a domain warp curls the interior.
    const wx = u + (fbm(u * 2.4 + 5, v * 2.4, seed) - 0.5) * 0.55
    const wy = v + (fbm(u * 2.4, v * 2.4 + 9, seed + 3) - 0.5) * 0.55
    const body = fbm(wx * 3.2 + 2, wy * 3.2 + 7, seed + 11)
    const edge = r + (body - 0.5) * 0.9
    const density = smooth(0.92, 0.18, edge) * (0.55 + 0.45 * fbm(wx * 6 + 13, wy * 6, seed + 23))
    // Nothing reaches the cell border, so cells stay independent.
    const alpha = density * smooth(1, 0.82, r)
    const shade = 0.72 + 0.28 * fbm(wx * 4 + 1 - u * 0.6, wy * 4 + 3 - v * 0.6, seed + 31) - 0.12 * Math.max(0, u * 0.5 + v * 0.5)
    const i = (py * size + px) * 4
    const grey = Math.round(Math.min(1, Math.max(0, shade)) * 255)
    rgba[i] = rgba[i + 1] = rgba[i + 2] = grey
    rgba[i + 3] = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
  }
}

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
console.log(`wrote ${outPath} (${size}x${size} sprite sheet, ${(png.length / 1024).toFixed(0)} KB)`)
