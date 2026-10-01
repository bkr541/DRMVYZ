// Generates the in-house studio environment used for image-based lighting by the Cinema 2.0 Three.js module.
//   node scripts/cinema2-assets/generate-studio-environment.mjs <out.hdr> [width=1024] [neutral | gem]
// The default room has a cool strip light and a magenta accent; `neutral` (used by GO-TO) keeps the same layout and brightness but takes every hue out
// of the room and the lights, so mirror-like surfaces reflect plain white and grey (and warm gold stays gold). `gem` (used by RELIQUARY's cut
// crystal) is a near-black room scattered with dozens of small hard lights, like a jeweller's display case: each flat facet of cut glass
// reflects either black or a brilliant point, so it sparkles facet by facet instead of reflecting one soft, even room.
// An equirectangular (2:1) Radiance RGBE image: a dark room with a large overhead softbox, a bright key softbox front-left, a cool strip light
// on the right, a dim warm bounce from the floor and a faint horizon gradient. High dynamic range on purpose (the softboxes reach 10-20), so
// glossy surfaces show crisp, bright reflections and the environment can be rotated to move them. Written with the standard Radiance RLE
// scanline encoding, which Three's RGBELoader reads.
import { writeFileSync } from 'node:fs'

const outPath = process.argv[2]
const width = Number(process.argv[3] ?? 1024)
const height = width / 2
const neutral = process.argv[4] === 'neutral'
const gem = process.argv[4] === 'gem'
if (!outPath) throw new Error('usage: generate-studio-environment.mjs <out.hdr> [width]')

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const angularDifference = (a, b) => { const d = Math.abs(a - b) % (Math.PI * 2); return d > Math.PI ? Math.PI * 2 - d : d }

/** Seeded 0-1 random for the gem room's lights. */
const seeded = n => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
/** The gem room: a smaller key in front (so the face of the glass still reads) and 48 small hard points, mostly above the horizon. */
const gemBoxes = [
  { az: 0.5 * Math.PI, el: 0.45, halfAz: 0.16, halfEl: 0.1, soft: 0.04, color: [1, 0.98, 0.95], intensity: 9 },
  ...Array.from({ length: 48 }, (_, i) => {
    const size = 0.012 + seeded(i * 5 + 1) * 0.03
    const warm = seeded(i * 5 + 2) < 0.3
    return { az: seeded(i * 5 + 3) * Math.PI * 2, el: -0.15 + seeded(i * 5 + 4) * 1.35, halfAz: size, halfEl: size, soft: size * 0.4, color: warm ? [1, 0.88, 0.7] : [0.96, 0.98, 1], intensity: 25 + seeded(i * 5 + 5) * 45 }
  }),
]

// A rectangular light in (azimuth, elevation) space with soft edges: centre, half sizes in radians, edge softness, colour and intensity.
const boxes = gem ? gemBoxes : neutral ? [
  { az: 0.55 * Math.PI, el: 0.62, halfAz: 0.42, halfEl: 0.22, soft: 0.12, color: [1, 0.98, 0.95], intensity: 14 },   // key softbox, front-left, high
  { az: 0, el: 1.35, halfAz: 0.9, halfEl: 0.32, soft: 0.2, color: [0.98, 0.98, 1], intensity: 6 },                    // large overhead panel
  { az: 1.5 * Math.PI, el: 0.25, halfAz: 0.09, halfEl: 0.5, soft: 0.05, color: [0.96, 0.98, 1], intensity: 9 },     // strip light, right
  { az: 1.05 * Math.PI, el: 0.12, halfAz: 0.05, halfEl: 0.34, soft: 0.04, color: [1, 0.95, 0.88], intensity: 5 },    // thin accent strip, back-left
] : [
  { az: 0.55 * Math.PI, el: 0.62, halfAz: 0.42, halfEl: 0.22, soft: 0.12, color: [1, 0.97, 0.92], intensity: 14 },   // key softbox, front-left, high
  { az: 0, el: 1.35, halfAz: 0.9, halfEl: 0.32, soft: 0.2, color: [0.9, 0.95, 1], intensity: 6 },                     // large overhead panel
  { az: 1.5 * Math.PI, el: 0.25, halfAz: 0.09, halfEl: 0.5, soft: 0.05, color: [0.55, 0.85, 1], intensity: 9 },     // cool strip, right
  { az: 1.05 * Math.PI, el: 0.12, halfAz: 0.05, halfEl: 0.34, soft: 0.04, color: [1, 0.55, 0.85], intensity: 5 },   // thin magenta accent, back-left
]

function radiance(u, v) {
  const az = u * Math.PI * 2
  const el = (0.5 - v) * Math.PI
  // Base room: near-black with a faint cool gradient toward the horizon and a dim warm floor bounce.
  const horizon = Math.exp(-Math.abs(el) / 0.35)
  // The neutral room is brighter overhead (a pale ceiling) and dark below, so facets tilted up read light and facets tilted down read dark.
  let r = gem ? 0.006 + 0.012 * horizon : neutral ? 0.045 + 0.11 * horizon + 0.17 * smooth(-0.1, 0.85, el) : 0.012 + 0.03 * horizon
  let g = neutral || gem ? r : 0.014 + 0.034 * horizon
  let b = neutral || gem ? r : 0.02 + 0.05 * horizon
  if (el < 0) {
    const floor = smooth(0, -1.2, el) * 0.06
    if (gem) { r += floor * 0.2; g += floor * 0.2; b += floor * 0.2 } else if (neutral) { r += floor; g += floor; b += floor } else { r += floor * 1.0; g += floor * 0.78; b += floor * 0.55 }
  }
  for (const box of boxes) {
    const dAz = angularDifference(az, box.az)
    const dEl = Math.abs(el - box.el)
    const mask = (1 - smooth(box.halfAz - box.soft, box.halfAz + box.soft, dAz)) * (1 - smooth(box.halfEl - box.soft, box.halfEl + box.soft, dEl))
    if (mask <= 0) continue
    r += box.color[0] * box.intensity * mask
    g += box.color[1] * box.intensity * mask
    b += box.color[2] * box.intensity * mask
  }
  return [r, g, b]
}

/** Radiance RGBE: three 8-bit mantissas sharing one exponent (frexp-style, mantissa in [0.5, 1) scaled by 256). */
function toRgbe([r, g, b]) {
  const max = Math.max(r, g, b)
  if (max < 1e-32) return [0, 0, 0, 0]
  const e = Math.floor(Math.log2(max)) + 1
  const s = 256 / 2 ** e
  return [Math.min(255, Math.floor(r * s)), Math.min(255, Math.floor(g * s)), Math.min(255, Math.floor(b * s)), e + 128]
}

// Radiance "new" RLE: each scanline starts 2, 2, width high byte, width low byte, then four channels, each run-length coded.
function encodeChannel(values, out) {
  let i = 0
  while (i < values.length) {
    let run = 1
    while (i + run < values.length && run < 127 && values[i + run] === values[i]) run += 1
    if (run >= 4) {
      out.push(128 + run, values[i])
      i += run
    } else {
      // Literal stretch up to the next run of 4+ (at most 128 values).
      let end = i
      while (end < values.length && end - i < 128) {
        let ahead = 1
        while (end + ahead < values.length && ahead < 4 && values[end + ahead] === values[end]) ahead += 1
        if (ahead >= 4) break
        end += 1
      }
      if (end === i) end = i + 1
      out.push(end - i)
      for (let k = i; k < end; k += 1) out.push(values[k])
      i = end
    }
  }
}

const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\nEXPOSURE=1.0\n\n-Y ${height} +X ${width}\n`, 'ascii')
const body = []
for (let y = 0; y < height; y += 1) {
  const channels = [new Array(width), new Array(width), new Array(width), new Array(width)]
  for (let x = 0; x < width; x += 1) {
    const rgbe = toRgbe(radiance((x + 0.5) / width, (y + 0.5) / height))
    for (let c = 0; c < 4; c += 1) channels[c][x] = rgbe[c]
  }
  body.push(2, 2, (width >> 8) & 0xff, width & 0xff)
  for (const channel of channels) encodeChannel(channel, body)
}
const file = Buffer.concat([header, Buffer.from(body)])
writeFileSync(outPath, file)
console.log(`wrote ${outPath} (${width}x${height} RGBE, ${(file.length / 1024).toFixed(0)} KB)`)
