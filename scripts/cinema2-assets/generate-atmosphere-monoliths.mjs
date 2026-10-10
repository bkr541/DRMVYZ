// Generates the four cracked rock monoliths of Cinema 2.0's ATMOSPHERE REFERENCE preset.
//   node scripts/cinema2-assets/generate-atmosphere-monoliths.mjs [out.glb] [textureSize=1024]
//   (default: public/cinema2/models/atmosphere-monoliths.glb; the preset's low tier ships a 512 px build of the same file)
//
// Four dark, faceted stone slabs stand on the preset's wet floor (world y -1.2) around a clear crystal monolith at the centre: a tall slab at
// the back left, a heavy one at the back right and two shorter ones leaning in from the sides. Each is its own part (`back`, `violet`, `left`,
// `right`) so the preset can give every monolith its own accent colour. Geometry is hand-parameterised and seeded, in world coordinates, with flat-shaded facets:
//   - stacked rings of an irregular 8-sided section, narrowing toward the top, with coherent jitter so the faces break into uneven planes;
//   - a leaning spine, a slanted chiselled crown and a sunken base, so they read as split stone rather than extruded rectangles.
// Everything surface-level comes from one in-house tileable rock texture set embedded in the model (all periodic noise, so it tiles without seams):
//   baseColor        cool blue-black stone, with lighter worn facet edges and darker crevices
//   normal           angular fracture plates, grain and carved cracks
//   metalRoughness   polished plates against rough, chipped ones (G roughness)
//   emissive         the crack network as a mask (white in the crack, soft halo, uneven brightness along it); the preset tints it per part
//
// The centre crystal is built from four kinds of part (see buildCrystal): `crystal` (a tall cut-glass obelisk of antiprism rings, tapering to a point;
// the preset makes it see-through and iridescent), `frame` (polished gold tubes along its facet edges), and four crack parts - `crackLeft`,
// `crackRight`, `crackBack`, `crackViolet` - thin glowing fractures running through its inside, one part per accent colour so the preset can tint
// each from the matching monolith's colour control and flare them on that monolith's beat. The low-quality build bakes a translucent crystal
// material (alpha) because that tier draws no refraction, and without it the cracks inside would be hidden.
//
// Each monolith samples the set through its own planar UV projection (own scale, offset and per-face quarter turns), so no two show the same cracks.
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { buildTaperedTube, encodePng, hash, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/atmosphere-monoliths.glb')
const TEXTURE_SIZE = Number(process.argv[3] ?? 1024)
mkdirSync(dirname(outputPath), { recursive: true })

/** World height of the preset's reflective floor plane. */
const FLOOR_Y = -1.2
/** World units one repeat of the rock texture covers. */
const TEXTURE_TILE = 3.4

// ── Noise (all periodic: lattice cells wrap around the tile) ─────────────────────────────────────────────────────────────────────────
function noiseHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function valueNoise(u, v, period, seed) {
  const x = u * period, y = v * period
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const w = i => ((i % period) + period) % period
  const a = noiseHash(w(x0), w(y0), seed), b = noiseHash(w(x0 + 1), w(y0), seed)
  const c = noiseHash(w(x0), w(y0 + 1), seed), d = noiseHash(w(x0 + 1), w(y0 + 1), seed)
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy
}
function fbm(u, v, basePeriod, octaves, seed) {
  let sum = 0, amp = 0.5, norm = 0
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(u, v, basePeriod * 2 ** o, seed + o * 17) * amp
    norm += amp
    amp *= 0.5
  }
  return sum / norm
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/** Periodic Voronoi: the exact distance (in cell units) to the nearest cell border, and the nearest cell's random identity (0-1). */
function voronoi(u, v, cells, seed) {
  const x = u * cells, y = v * cells
  const cx = Math.floor(x), cy = Math.floor(y)
  const seedAt = (gx, gy) => {
    const wx = ((gx % cells) + cells) % cells, wy = ((gy % cells) + cells) % cells
    return [gx + noiseHash(wx, wy, seed), gy + noiseHash(wx, wy, seed + 101), noiseHash(wx, wy, seed + 211)]
  }
  let nearest = null, best = 9
  for (let j = -2; j <= 2; j += 1) for (let i = -2; i <= 2; i += 1) {
    const point = seedAt(cx + i, cy + j)
    const d = Math.hypot(point[0] - x, point[1] - y)
    if (d < best) { best = d; nearest = point }
  }
  let border = 9
  for (let j = -2; j <= 2; j += 1) for (let i = -2; i <= 2; i += 1) {
    const point = seedAt(cx + i, cy + j)
    if (point[0] === nearest[0] && point[1] === nearest[1]) continue
    const dx = point[0] - nearest[0], dy = point[1] - nearest[1]
    const len = Math.hypot(dx, dy)
    border = Math.min(border, (((point[0] + nearest[0]) * 0.5 - x) * dx + ((point[1] + nearest[1]) * 0.5 - y) * dy) / len)
  }
  return { border, id: nearest[2] }
}

// ── Rock texture set ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function rockTextures(size) {
  const height = new Float32Array(size * size)
  const crack = new Float32Array(size * size)
  const halo = new Float32Array(size * size)
  const plate = new Float32Array(size * size)
  const grain = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size, i = y * size + x
    // Angular fracture plates: each Voronoi cell is a flat slab at its own height, tilted a little by a broad noise.
    const wu = u + (fbm(u, v, 4, 3, 71) - 0.5) * 0.06, wv = v + (fbm(u, v, 4, 3, 73) - 0.5) * 0.06
    const plates = voronoi(wu, wv, 5, 17)
    plate[i] = plates.id
    const edgeSoft = smooth(0, 0.02, plates.border)
    const broad = fbm(u, v, 3, 5, 11)
    const fine = fbm(u, v, 56, 3, 23)
    grain[i] = fine
    // Cracks: borders of two domain-warped Voronoi fields (so they meander and branch), kept only where a mask lets them through so they
    // are sparse and broken, with hairline cracks around the main ones.
    const cu = u + (fbm(u, v, 5, 3, 91) - 0.5) * 0.16, cv = v + (fbm(u, v, 5, 3, 93) - 0.5) * 0.16
    const mainField = voronoi(cu, cv, 2, 41)
    const hairField = voronoi(cu + 0.31, cv + 0.17, 5, 77)
    const keepMain = smooth(0.46, 0.57, fbm(u, v, 3, 3, 5))
    const keepHair = smooth(0.58, 0.68, fbm(u, v, 6, 3, 9))
    const lineMain = (1 - smooth(0.003, 0.017, mainField.border)) * keepMain
    const lineHair = (1 - smooth(0.0015, 0.007, hairField.border)) * keepHair * 0.55
    const line = Math.min(1, Math.max(lineMain, lineHair))
    crack[i] = line
    // The soft halo of heat around the stronger cracks.
    halo[i] = (1 - smooth(0.006, 0.06, mainField.border)) * keepMain * 0.38
    height[i] = (plates.id - 0.5) * 0.5 * edgeSoft + broad * 0.45 + fine * 0.22 - line * 1.15 - (1 - edgeSoft) * 0.12
  }

  const baseColor = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4)
  const metalRough = new Uint8Array(size * size * 4), emissive = new Uint8Array(size * size * 4)
  const h = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const strength = 4.2
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const i = y * size + x, o = i * 4, u = x / size, v = y / size
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1)
    normal[o] = Math.round((0.5 - 0.5 * dx / l) * 255); normal[o + 1] = Math.round((0.5 - 0.5 * dy / l) * 255); normal[o + 2] = Math.round((0.5 + 0.5 / l) * 255); normal[o + 3] = 255

    // Stone: cool blue-black, each plate a slightly different value, worn lighter where the surface turns sharply, darker in the crevices.
    const edge = Math.min(1, Math.hypot(dx, dy) * 0.55)
    const tone = 0.055 + plate[i] * 0.07 + grain[i] * 0.06 + edge * 0.13
    const inCrack = Math.min(1, crack[i] * 1.4)
    const value = tone * (1 - inCrack * 0.8)
    const warm = fbm(u, v, 5, 3, 301) - 0.5
    baseColor[o] = Math.round(Math.min(1, value * (0.92 + warm * 0.3)) * 255)
    baseColor[o + 1] = Math.round(Math.min(1, value * 0.98) * 255)
    baseColor[o + 2] = Math.round(Math.min(1, value * (1.14 - warm * 0.25)) * 255)
    baseColor[o + 3] = 255

    // glTF metal/roughness: G roughness, B metalness. Some plates are polished and wet-looking, some rough and chipped; crevices are rough.
    const polished = smooth(0.55, 0.85, plate[i])
    const roughness = Math.min(1, Math.max(0.32, 0.66 - polished * 0.3 + (grain[i] - 0.5) * 0.3 + inCrack * 0.2))
    metalRough[o] = 255; metalRough[o + 1] = Math.round(roughness * 255); metalRough[o + 2] = 0; metalRough[o + 3] = 255

    // Crack glow mask: a hot core, the halo around it, and brightness that drifts along the crack so it reads as molten rather than painted.
    const drift = 0.62 + 0.38 * fbm(u, v, 9, 3, 401)
    const glow = Math.min(1, (crack[i] * 1.0 + halo[i] * (1 - crack[i])) * drift)
    const channel = Math.round(Math.pow(glow, 0.85) * 255)
    emissive[o] = channel; emissive[o + 1] = channel; emissive[o + 2] = channel; emissive[o + 3] = 255
  }
  return {
    baseColor: encodePng(baseColor, size), normal: encodePng(normal, size),
    metallicRoughness: encodePng(metalRough, size), emissive: encodePng(emissive, size),
  }
}

// ── Geometry ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
const rand = (seed, i) => noiseHash(i, 7, seed)

/**
 * One monolith as flat-shaded triangles. `spec`: centre (x, z), the stone's `height` above the floor, half width and depth at the base, how
 * much it `taper`s toward the top, `lean` (sideways drift of the top as a fraction of height, toward `leanAngle`), the turn about Y, the
 * slant of the crown, and the UV projection (`uvScale`, `uvOffset`).
 */
function buildMonolith(spec) {
  const sides = spec.sides ?? 7
  const bands = spec.bands ?? 6
  const sunk = 0.35
  const angles = Array.from({ length: sides }, (_, i) => ((i + (rand(spec.seed, i) - 0.5) * 0.7) / sides) * Math.PI * 2)
  const rings = []
  for (let band = 0; band <= bands; band += 1) {
    const t = band / bands
    const y = FLOOR_Y - sunk + (spec.height + sunk) * t
    // Spine: leans along `leanAngle`, with a slow S so it is never a straight line.
    const lean = spec.lean * spec.height * Math.pow(t, 1.6) + Math.sin(t * 3.1 + spec.seed) * 0.04 * spec.height * spec.lean
    const centre = [Math.cos(spec.leanAngle) * lean, Math.sin(spec.leanAngle) * lean]
    // Each corner keeps its own offset and its own extra taper all the way up, so the faces between corners are long uneven planes that
    // meet in sharp vertical ridges and lean against each other, with only a little noise from band to band.
    const ring = angles.map((angle, i) => {
      const column = 1 + (rand(spec.seed + 3, i) - 0.5) * 0.4
      const shrink = 1 - (spec.taper + (rand(spec.seed + 4, i) - 0.5) * 0.34) * t
      const bandNoise = 1 + (rand(spec.seed + 5, i * 29 + band) - 0.5) * 0.05
      const crownSlant = band === bands ? (Math.cos(angle - spec.crownAngle) * spec.crownSlant + (rand(spec.seed + 9, i) - 0.5) * 0.5) * spec.height * 0.2 : 0
      const rx = spec.halfWidth * shrink * column * bandNoise, rz = spec.halfDepth * shrink * column * bandNoise
      return [centre[0] + Math.cos(angle) * rx, y + crownSlant, centre[1] + Math.sin(angle) * rz]
    })
    rings.push(ring)
  }
  const topRing = rings[bands]
  const apex = topRing.reduce((sum, p) => [sum[0] + p[0] / sides, sum[1] + p[1] / sides, sum[2] + p[2] / sides], [0, 0, 0])
  apex[1] += spec.height * spec.crownRise

  const triangles = []
  for (let band = 0; band < bands; band += 1) {
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides
      const a = rings[band][i], b = rings[band][j], c = rings[band + 1][i], d = rings[band + 1][j]
      // Alternate the quad's diagonal so the facets do not all slant one way.
      if ((i + band) % 2 === 0) { triangles.push([a, c, b], [b, c, d]) } else { triangles.push([a, c, d], [a, d, b]) }
    }
  }
  for (let i = 0; i < sides; i += 1) triangles.push([topRing[i], apex, topRing[(i + 1) % sides]])

  // Turn about Y and place in the world; faces are flat, so every triangle gets its own normal, UVs and vertices.
  const cos = Math.cos(spec.rotY), sin = Math.sin(spec.rotY)
  const place = p => [spec.x + p[0] * cos + p[2] * sin, p[1], spec.z - p[0] * sin + p[2] * cos]
  const positions = [], normals = [], uvs = [], indices = []
  const inside = [0, FLOOR_Y + spec.height * 0.45, 0]
  triangles.forEach((triangle, index) => {
    const local = triangle
    let n = norm(cross(sub(local[1], local[0]), sub(local[2], local[0])))
    const centroid = [(local[0][0] + local[1][0] + local[2][0]) / 3, (local[0][1] + local[1][1] + local[2][1]) / 3, (local[0][2] + local[1][2] + local[2][2]) / 3]
    const out = sub(centroid, inside)
    const flip = n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0
    const ordered = flip ? [local[0], local[2], local[1]] : local
    if (flip) n = [-n[0], -n[1], -n[2]]
    // Planar projection along the face's dominant axis (in the stone's own frame), quarter-turned per face.
    const axis = Math.abs(n[0]) >= Math.abs(n[1]) && Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2
    const turn = Math.floor(rand(spec.seed + 21, index) * 4)
    const mirror = rand(spec.seed + 23, index) > 0.5 ? -1 : 1
    for (const p of ordered) {
      const planar = axis === 0 ? [p[1], p[2]] : axis === 1 ? [p[0], p[2]] : [p[0], p[1]]
      let [s, t] = [planar[0] * mirror, planar[1]]
      for (let k = 0; k < turn; k += 1) [s, t] = [-t, s]
      uvs.push(s * spec.uvScale / TEXTURE_TILE + spec.uvOffset[0], t * spec.uvScale / TEXTURE_TILE + spec.uvOffset[1])
      const world = place(p)
      positions.push(world[0], world[1], world[2])
      const wn = [n[0] * cos + n[2] * sin, n[1], -n[0] * sin + n[2] * cos]
      normals.push(wn[0], wn[1], wn[2])
      indices.push(indices.length)
    }
  })
  return {
    name: spec.name, part: spec.name,
    positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs),
    indices: Uint32Array.from(indices), phases: new Float32Array(positions.length / 3),
  }
}

// The authored layout, framed by ATMOSPHERE REFERENCE's dolly camera (a slow loop 6-8 m out around (0, -0.4, -1.2)).
const MONOLITHS = [
  { name: 'back', seed: 11, x: -1.55, z: -4.1, height: 3.15, halfWidth: 0.66, halfDepth: 0.52, taper: 0.24, lean: 0.035, leanAngle: 0.6, rotY: 0.3, crownSlant: 0.9, crownAngle: 0.9, crownRise: 0.05, uvScale: 1, uvOffset: [0.13, 0.41], tint: [1, 0.9, 0.82] },
  { name: 'violet', seed: 23, x: 3.1, z: -3.6, height: 2.1, halfWidth: 0.74, halfDepth: 0.56, taper: 0.2, lean: -0.03, leanAngle: 2.2, rotY: -0.25, crownSlant: 1.1, crownAngle: 2.4, crownRise: 0.04, uvScale: 1.05, uvOffset: [0.57, 0.08], tint: [0.86, 0.86, 1.08] },
  { name: 'left', seed: 37, x: -2.6, z: -0.2, height: 1.2, halfWidth: 0.86, halfDepth: 0.7, taper: 0.1, lean: 0.14, leanAngle: 3.4, rotY: 0.5, crownSlant: 1.4, crownAngle: 3.9, crownRise: 0.05, uvScale: 0.95, uvOffset: [0.83, 0.66], tint: [0.8, 0.92, 1.1] },
  { name: 'right', seed: 53, x: 2.75, z: -0.65, height: 1.55, halfWidth: 0.64, halfDepth: 0.6, taper: 0.26, lean: 0.2, leanAngle: -0.3, rotY: -0.55, crownSlant: 1.2, crownAngle: -0.5, crownRise: 0.06, uvScale: 1.1, uvOffset: [0.29, 0.94], tint: [1.05, 0.84, 1.02] },
]

// ── Centre crystal ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const CRYSTAL = { x: 0.35, z: -1.75, height: 3.9, halfWidth: 1.02, halfDepth: 0.86, sides: 6, sink: 0.25 }
/** Ring profile, bottom to top: height fraction and radius fraction. The crystal swells toward the middle and tapers to a point. */
const CRYSTAL_RINGS = [[0, 0.66], [0.11, 0.84], [0.3, 0.98], [0.5, 1], [0.69, 0.84], [0.84, 0.52], [0.94, 0.24]]

/** The crystal's vertices as rings (alternate rings turned half a step, so every band is a strip of triangles) plus the apex. */
function crystalShape() {
  const { sides } = CRYSTAL
  const rings = CRYSTAL_RINGS.map(([heightFraction, radiusFraction], k) => {
    const turn = (k % 2) * (Math.PI / sides) + k * 0.045
    const y = FLOOR_Y - CRYSTAL.sink + (CRYSTAL.height + CRYSTAL.sink) * heightFraction
    return Array.from({ length: sides }, (_, i) => {
      const angle = (i / sides) * Math.PI * 2 + turn
      const wobble = 1 + (hash(`crystal-v-${k}-${i}`) - 0.5) * 0.14
      const lean = Math.pow(heightFraction, 1.7) * 0.1 * CRYSTAL.height
      return new THREE.Vector3(
        CRYSTAL.x + Math.cos(angle) * CRYSTAL.halfWidth * radiusFraction * wobble + lean,
        y + (hash(`crystal-h-${k}-${i}`) - 0.5) * 0.09,
        CRYSTAL.z + Math.sin(angle) * CRYSTAL.halfDepth * radiusFraction * wobble,
      )
    })
  })
  const apex = new THREE.Vector3(CRYSTAL.x + 0.1 * CRYSTAL.height + 0.02, FLOOR_Y + CRYSTAL.height, CRYSTAL.z)
  return { rings, apex }
}

/** Flat-shaded cut-glass body: every triangle of every band and the pointed crown gets its own normal. */
function buildCrystalBody({ rings, apex }) {
  const { sides } = CRYSTAL
  const centre = new THREE.Vector3(CRYSTAL.x, FLOOR_Y + CRYSTAL.height * 0.5, CRYSTAL.z)
  const triangles = []
  for (let k = 0; k < rings.length - 1; k += 1) {
    const lower = rings[k], upper = rings[k + 1]
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides
      if (k % 2 === 0) triangles.push([lower[i], lower[j], upper[i]], [lower[j], upper[j], upper[i]])
      else triangles.push([lower[i], upper[j], upper[i]], [lower[i], lower[j], upper[j]])
    }
  }
  const top = rings[rings.length - 1]
  for (let i = 0; i < sides; i += 1) triangles.push([top[i], top[(i + 1) % sides], apex])
  const positions = [], normals = [], indices = []
  for (const triangle of triangles) {
    let [a, b, c] = triangle
    let n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a)).normalize()
    const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3)
    if (n.dot(mid.sub(centre)) < 0) { [b, c] = [c, b]; n.negate() }
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); normals.push(n.x, n.y, n.z); indices.push(indices.length) }
  }
  return { name: 'crystal', part: 'crystal', positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(positions.length / 3) }
}

const mergeTubes = (name, part, tubes) => {
  const vertexCount = tubes.reduce((sum, tube) => sum + tube.positions.length / 3, 0)
  const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), phases = new Float32Array(vertexCount)
  const indices = new Uint32Array(tubes.reduce((sum, tube) => sum + tube.indices.length, 0))
  let vertexOffset = 0, indexOffset = 0
  for (const tube of tubes) {
    positions.set(tube.positions, vertexOffset * 3); normals.set(tube.normals, vertexOffset * 3)
    for (let i = 0; i < tube.indices.length; i += 1) indices[indexOffset + i] = tube.indices[i] + vertexOffset
    vertexOffset += tube.positions.length / 3; indexOffset += tube.indices.length
  }
  return { name, part, positions, normals, indices, phases }
}

/** Polished gold bands along the facet edges: each meridian edge between neighbouring rings, and the loops round the wide middle. */
function buildCrystalFrame({ rings }) {
  const { sides } = CRYSTAL
  const out = (p, scale) => [CRYSTAL.x + (p.x - CRYSTAL.x) * scale, p.y, CRYSTAL.z + (p.z - CRYSTAL.z) * scale]
  const straight = (a, b, radius) => buildTaperedTube([a, b], { samples: 2, radiusAt: () => radius, radialSegments: 6 })
  const tubes = []
  for (let i = 0; i < sides; i += 1) {
    for (let k = 0; k < rings.length - 1; k += 1) tubes.push(straight(out(rings[k][i], 1.012), out(rings[k + 1][i], 1.012), 0.026))
  }
  for (const k of [2, 3, 4]) {
    for (let i = 0; i < sides; i += 1) tubes.push(straight(out(rings[k][i], 1.012), out(rings[k][(i + 1) % sides], 1.012), 0.022))
  }
  return mergeTubes('frame', 'frame', tubes)
}

/** Fractures inside the crystal: a few meandering main cracks and short branches per accent colour, thin tapered tubes that stay inside the glass. */
function buildCrystalCracks({ rings }, colourName, seedKey, mainCount) {
  const bottom = FLOOR_Y + 0.05, top = FLOOR_Y + CRYSTAL.height * 0.9
  const radiusAt = y => {
    const f = Math.min(1, Math.max(0, (y - (FLOOR_Y - CRYSTAL.sink)) / (CRYSTAL.height + CRYSTAL.sink)))
    for (let k = 0; k < CRYSTAL_RINGS.length - 1; k += 1) {
      const [f0, r0] = CRYSTAL_RINGS[k], [f1, r1] = CRYSTAL_RINGS[k + 1]
      if (f <= f1) return r0 + (r1 - r0) * ((f - f0) / (f1 - f0))
    }
    return 0.1
  }
  const lean = y => Math.pow(Math.min(1, Math.max(0, (y - FLOOR_Y) / CRYSTAL.height)), 1.7) * 0.1 * CRYSTAL.height
  const inside = p => {
    const r = radiusAt(p.y) * 0.8
    const dx = (p.x - CRYSTAL.x - lean(p.y)) / (CRYSTAL.halfWidth * r), dz = (p.z - CRYSTAL.z) / (CRYSTAL.halfDepth * r)
    return p.y > bottom && p.y < top && dx * dx + dz * dz < 1
  }
  const walk = (start, direction, steps, step, key) => {
    const points = [start.clone()]
    const dir = direction.clone().normalize()
    for (let s = 0; s < steps; s += 1) {
      dir.add(new THREE.Vector3(hash(`${key}-x${s}`) - 0.5, (hash(`${key}-y${s}`) - 0.5) * 0.9, hash(`${key}-z${s}`) - 0.5).multiplyScalar(0.55)).normalize()
      const next = points[points.length - 1].clone().addScaledVector(dir, step * (0.7 + hash(`${key}-l${s}`) * 0.6))
      if (!inside(next)) {
        // Turn back toward the axis rather than leaving the glass.
        dir.add(new THREE.Vector3(CRYSTAL.x - next.x, 0, CRYSTAL.z - next.z).normalize().multiplyScalar(1.2)).normalize()
        continue
      }
      points.push(next)
    }
    return points
  }
  const radius = t => 0.004 + 0.011 * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), 0.7)
  const tubes = []
  for (let m = 0; m < mainCount; m += 1) {
    const key = `${seedKey}-main-${m}`
    const y = bottom + 0.4 + hash(`${key}-start`) * (top - bottom - 0.8)
    const angle = hash(`${key}-angle`) * Math.PI * 2
    const reach = 0.45 * radiusAt(y)
    const start = new THREE.Vector3(CRYSTAL.x + lean(y) + Math.cos(angle) * CRYSTAL.halfWidth * reach, y, CRYSTAL.z + Math.sin(angle) * CRYSTAL.halfDepth * reach)
    const main = walk(start, new THREE.Vector3(hash(`${key}-dx`) - 0.5, 0.3 + hash(`${key}-dy`) * 0.7, hash(`${key}-dz`) - 0.5), 12, 0.3, key)
    if (main.length >= 4) tubes.push(buildTaperedTube(main.map(p => [p.x, p.y, p.z]), { samples: main.length * 3, radiusAt: radius, radialSegments: 4 }))
    for (let b = 0; b < 3 && main.length >= 4; b += 1) {
      const bk = `${key}-branch-${b}`
      const from = main[1 + Math.floor(hash(`${bk}-at`) * (main.length - 2))]
      const branch = walk(from, new THREE.Vector3(hash(`${bk}-dx`) - 0.5, hash(`${bk}-dy`) - 0.5, hash(`${bk}-dz`) - 0.5), 5, 0.17, bk)
      if (branch.length >= 3) tubes.push(buildTaperedTube(branch.map(p => [p.x, p.y, p.z]), { samples: branch.length * 3, radiusAt: t => radius(t) * 0.6, radialSegments: 4 }))
    }
  }
  return mergeTubes(colourName, colourName, tubes)
}

const crystalShapeData = crystalShape()
const crystalMeshes = [
  buildCrystalBody(crystalShapeData),
  buildCrystalFrame(crystalShapeData),
  buildCrystalCracks(crystalShapeData, 'crackLeft', 'cyan', 1),
  buildCrystalCracks(crystalShapeData, 'crackRight', 'magenta', 1),
  buildCrystalCracks(crystalShapeData, 'crackBack', 'amber', 1),
  buildCrystalCracks(crystalShapeData, 'crackViolet', 'violet', 1),
]

const meshes = [...MONOLITHS.map(buildMonolith), ...crystalMeshes]
const rock = rockTextures(TEXTURE_SIZE)
const LOW_QUALITY_BUILD = TEXTURE_SIZE <= 512
const CRACK_MATERIAL = { baseColorFactor: [0.01, 0.01, 0.01, 1], metallicFactor: 0, roughnessFactor: 1, emissiveFactor: [1, 1, 1] }
const MATERIALS = {
  ...Object.fromEntries(MONOLITHS.map(monolith => [monolith.name, {
    baseColorFactor: [...monolith.tint, 1], metallicFactor: 1, roughnessFactor: 1, emissiveFactor: [1, 1, 1],
    textures: { baseColor: rock.baseColor, normal: rock.normal, metallicRoughness: rock.metallicRoughness, emissive: rock.emissive, normalScale: 1.1 },
  }])),
  // Clear glass; the preset adds transmission, iridescence and dispersion. The low build is drawn without refraction, so it is translucent instead.
  crystal: { baseColorFactor: LOW_QUALITY_BUILD ? [0.78, 0.88, 1, 0.5] : [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0, ...(LOW_QUALITY_BUILD ? { alphaMode: 'BLEND' } : {}) },
  frame: { baseColorFactor: [1, 0.66, 0.22, 1], metallicFactor: 1, roughnessFactor: 0.2 },
  crackLeft: CRACK_MATERIAL, crackRight: CRACK_MATERIAL, crackBack: CRACK_MATERIAL, crackViolet: CRACK_MATERIAL,
}

const { triangles, byteLength, parts } = writeGlb(outputPath, meshes, MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-atmosphere-monoliths.mjs', 'atmosphere-monoliths')
console.log(`Wrote ${outputPath}`)
console.log(`  ${parts.join(', ')}: ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB, rock textures ${TEXTURE_SIZE}px`)
