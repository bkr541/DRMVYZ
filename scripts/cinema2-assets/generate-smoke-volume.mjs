// Generates the in-house tileable smoke/noise VOLUME used by the Cinema 2.0 volumetric atmosphere.
//   node scripts/cinema2-assets/generate-smoke-volume.mjs <out.png> [size=64]
// The volume is `size` x `size` x `size` texels, written as one tall image (width `size`, height `size * size`, slice z after slice z, top to
// bottom), which WebGL2 uploads straight into a 3D texture. Everything is periodic on all three axes, so it tiles without seams, and the noise is a
// continuous function of position, so a smaller `size` samples the very same field more coarsely (the low-quality variant matches the full one).
// Channels (each stretched to 0..1): R billowy puffs (Perlin-Worley, 4 cells), G wispy ridged strands (6 cells), B fine puffs (inverted Worley,
// 8 cells), A large-scale patchiness (2 cells).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const outPath = process.argv[2]
const size = Number(process.argv[3] ?? 64)
if (!outPath) throw new Error('usage: generate-smoke-volume.mjs <out.png> [size]')

function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1274126177) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  h = (h ^ (h >>> 16)) * 2246822519 | 0
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}
const wrap = (i, period) => ((i % period) + period) % period
const fade = t => t * t * t * (t * (t * 6 - 15) + 10)
const lerp = (a, b, t) => a + (b - a) * t

// Periodic gradient (Perlin) noise in about -1..1.
function gradient(ix, iy, iz, period, seed, fx, fy, fz) {
  const h = Math.floor(hash3(wrap(ix, period), wrap(iy, period), wrap(iz, period), seed) * 12)
  const g = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1], [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]][h]
  return g[0] * fx + g[1] * fy + g[2] * fz
}
function perlin(u, v, w, period, seed) {
  const x = u * period
  const y = v * period
  const z = w * period
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fy = y - y0
  const fz = z - z0
  const sx = fade(fx)
  const sy = fade(fy)
  const sz = fade(fz)
  const c = (dx, dy, dz) => gradient(x0 + dx, y0 + dy, z0 + dz, period, seed, fx - dx, fy - dy, fz - dz)
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), sx), lerp(c(0, 1, 0), c(1, 1, 0), sx), sy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), sx), lerp(c(0, 1, 1), c(1, 1, 1), sx), sy),
    sz,
  )
}
function perlinFbm(u, v, w, period, octaves, seed) {
  let sum = 0
  let amp = 0.5
  let total = 0
  for (let o = 0; o < octaves; o += 1) {
    sum += perlin(u, v, w, period * 2 ** o, seed + o * 31) * amp
    total += amp
    amp *= 0.5
  }
  return sum / total
}
// Periodic Worley: distance to the nearest feature point, in cell units (0 at a point, about 0.8 far from one).
function worley(u, v, w, cells, seed) {
  const x = u * cells
  const y = v * cells
  const z = w * cells
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  const cz = Math.floor(z)
  let best = 9
  for (let k = -1; k <= 1; k += 1) {
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const gx = cx + i
        const gy = cy + j
        const gz = cz + k
        const wx = wrap(gx, cells)
        const wy = wrap(gy, cells)
        const wz = wrap(gz, cells)
        const px = gx + hash3(wx, wy, wz, seed)
        const py = gy + hash3(wx, wy, wz, seed + 7)
        const pz = gz + hash3(wx, wy, wz, seed + 13)
        best = Math.min(best, Math.hypot(px - x, py - y, pz - z))
      }
    }
  }
  return best
}
const worleyFbm = (u, v, w, cells, seed) => (worley(u, v, w, cells, seed) * 0.62 + worley(u, v, w, cells * 2, seed + 5) * 0.26 + worley(u, v, w, cells * 4, seed + 9) * 0.12)

const count = size * size * size
const channels = [new Float32Array(count), new Float32Array(count), new Float32Array(count), new Float32Array(count)]
for (let z = 0; z < size; z += 1) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const w = z / size
      const i = (z * size + y) * size + x
      // R: Perlin-Worley puffs (Perlin remapped into the inverted Worley, the classic cloud/smoke base).
      const perlinBase = perlinFbm(u, v, w, 4, 4, 11) * 0.5 + 0.5
      const puffs = 1 - worleyFbm(u, v, w, 4, 21)
      channels[0][i] = puffs + (1 - puffs) * Math.max(0, perlinBase - 0.35) * 1.4 * 0.5 + perlinBase * 0.35
      // G: ridged strands: thin bright lines where the noise crosses zero, so smoke gets wisps and filaments.
      const ridge = 1 - Math.abs(perlinFbm(u, v, w, 6, 3, 41))
      channels[1][i] = ridge * ridge
      // B: fine inverted Worley puffs.
      channels[2][i] = 1 - worleyFbm(u, v, w, 8, 61)
      // A: broad patchiness.
      channels[3][i] = perlinFbm(u, v, w, 2, 2, 81) * 0.5 + 0.5
    }
  }
}
// Stretch each channel to the full 0..1 range (1st to 99th percentile) so the shader can rely on it.
for (const channel of channels) {
  const sorted = Float32Array.from(channel).sort()
  const lo = sorted[Math.floor(count * 0.01)]
  const hi = sorted[Math.floor(count * 0.99)]
  for (let i = 0; i < count; i += 1) channel[i] = Math.min(1, Math.max(0, (channel[i] - lo) / Math.max(hi - lo, 1e-6)))
}
const width = size
const height = size * size
const rgba = Buffer.alloc(width * height * 4)
for (let i = 0; i < count; i += 1) for (let c = 0; c < 4; c += 1) rgba[i * 4 + c] = Math.round(channels[c][i] * 255)

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
header.writeUInt32BE(width, 0)
header.writeUInt32BE(height, 4)
header[8] = 8
header[9] = 6
const raw = Buffer.alloc((width * 4 + 1) * height)
for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])
writeFileSync(outPath, png)
console.log(`wrote ${outPath} (${size}^3 volume as ${width}x${height}, ${(png.length / 1024).toFixed(0)} KB)`)
