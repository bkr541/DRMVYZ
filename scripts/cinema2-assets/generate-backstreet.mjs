// Generates the BACKSTREET scene for Cinema 2.0: the DVYDRM wordmark as a neon sign hung on a black painted brick wall.
//   node scripts/cinema2-assets/generate-backstreet.mjs [out.glb] [textureSize=1024]
//   (default: public/cinema2/models/backstreet.glb; the preset's low tier ships a 512 px build of the same file)
//
// Neon: every contour of the owner's wordmark master (sources/dvydrm-wordmark-master.svg: nine filled shapes, the outer ring contributing its
// outer and inner contour, ten closed contours in all) is traced by one glass tube of constant radius, so the sign is an outline exactly as the
// production reference shows. The contours are sampled from the cubic Beziers, resampled evenly and lightly smoothed (a neon tube cannot make a
// sharper turn than its own radius), then a circular section is swept round each closed loop. The sign is planar, so a fixed frame (the sign's
// normal and the in-plane normal) is used and the tubes never twist.
//
// Every tube vertex carries the vertex attributes Mainframe's circuit shader reads, so BACKSTREET drives the same lighting programs as
// Mainframe without any shader of its own:
//   _GLOW_PHASE        0 at the centre of the sign to 1 at its far edges (an ellipse fitted to the sign), so Outward Bus and Inward Boot run
//                      between the middle and the edges, and route pulses travel the same way
//   _MAINFRAME_ROUTE   the contour's index (the pulse scheduler picks route groups modulo eight)
//   _MAINFRAME_BANK    A-D as 0-3: eight vertical stripes across the sign, repeating A B C D A B C D, so Bank Alternator chases like a marquee
//   _MAINFRAME_REGION  the eight 45 degree sectors round the middle of the sign, in Mainframe's region numbering (right 5, top-right 6, top 7,
//                      top-left 3, left 2, bottom-left 1, bottom 0, bottom-right 4), so Quadrant Relay circulates round the sign
//   _MAINFRAME_SYSTEM  1 (circuits)
//
// Parts: `tubeCores` (the lit neon), `clips` (the clear standoffs that hold the tubes) and `wall`. The wall is one big plane at the back with an
// in-house tileable black-painted brick texture set embedded in the model (base colour, normal, metal/roughness): running-bond bricks, recessed
// mortar, chipped edges that show red brick under the paint, glossy bumpy paint. Everything is periodic, so the tile repeats without seams.
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { fromGeometry, merged, transformed } from './cinema2-hard-surface-kit.mjs'
import { encodePng, writeGlb } from './cinema2-tube-kit.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/backstreet.glb')
const TEXTURE_SIZE = Number(process.argv[3] ?? 1024)
mkdirSync(dirname(outputPath), { recursive: true })
const SVG_PATH = join(root, 'scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg')

// ── Layout ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Width of the whole sign (ring included), in world units; the preset's camera frames it at about 87% of the picture width. */
export const SIGN_WIDTH = 8.8
/** Tube radius in SVG units: the outer ring's two contours are 12 units apart, so the pair reads as two tubes with a hairline gap. */
const TUBE_RADIUS_SVG = 5.3
/** Distance from the sign plane (z 0) back to the wall. */
export const WALL_Z = -0.3
const RADIAL_SEGMENTS = 8
const RESAMPLE_STEP = 7

// ── SVG → contours ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Parses the absolute M / C / Z path data of the master into closed polylines (SVG units, y down). */
function parseContours(d) {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const contours = []
  let current = null
  let at = [0, 0]
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++]
    if (command === 'M') {
      current = [[Number(tokens[i]), Number(tokens[i + 1])]]
      at = [...current[0]]
      i += 2
    } else if (command === 'C') {
      while (i < tokens.length && !/[MCZ]/.test(tokens[i])) {
        const p1 = [Number(tokens[i]), Number(tokens[i + 1])], p2 = [Number(tokens[i + 2]), Number(tokens[i + 3])], p3 = [Number(tokens[i + 4]), Number(tokens[i + 5])]
        const chord = Math.hypot(p3[0] - at[0], p3[1] - at[1]) + Math.hypot(p1[0] - at[0], p1[1] - at[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        const steps = Math.max(6, Math.ceil(chord / 3))
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps, u = 1 - t
          current.push([
            u * u * u * at[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * at[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
          ])
        }
        at = p3
        i += 6
      }
    } else if (command === 'Z') {
      if (current && current.length > 3) contours.push(current)
      current = null
    }
  }
  return contours
}

/** Evenly spaced points round a closed loop. */
function resampleClosed(points, step) {
  const loop = [...points, points[0]]
  const lengths = [0]
  for (let i = 1; i < loop.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]))
  const total = lengths[lengths.length - 1]
  const count = Math.max(24, Math.round(total / step))
  const out = []
  let segment = 0
  for (let k = 0; k < count; k += 1) {
    const target = (k / count) * total
    while (lengths[segment + 1] < target) segment += 1
    const span = lengths[segment + 1] - lengths[segment] || 1
    const f = (target - lengths[segment]) / span
    out.push([loop[segment][0] + (loop[segment + 1][0] - loop[segment][0]) * f, loop[segment][1] + (loop[segment + 1][1] - loop[segment][1]) * f])
  }
  return out
}

/** Laplacian smoothing that keeps every loop in place on average but rounds cusps, as a bent glass tube would be rounded. */
function smoothClosed(points, passes, amount) {
  let current = points
  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((p, i) => {
      const a = current[(i - 1 + current.length) % current.length], b = current[(i + 1) % current.length]
      return [p[0] + ((a[0] + b[0]) / 2 - p[0]) * amount, p[1] + ((a[1] + b[1]) / 2 - p[1]) * amount]
    })
  }
  return current
}

const svg = readFileSync(SVG_PATH, 'utf8')
const contours = [...svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)].flatMap(([, id, d]) => parseContours(d).map(points => ({ id, points })))
if (contours.length !== 10) throw new Error(`Expected the wordmark master's ten contours, found ${contours.length}.`)

// Sign bounds over the raw contours (the ring's outer contour overshoots the viewBox a little).
const bounds = contours.reduce((acc, { points }) => {
  for (const [x, y] of points) { acc.minX = Math.min(acc.minX, x); acc.maxX = Math.max(acc.maxX, x); acc.minY = Math.min(acc.minY, y); acc.maxY = Math.max(acc.maxY, y) }
  return acc
}, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
const centreX = (bounds.minX + bounds.maxX) / 2, centreY = (bounds.minY + bounds.maxY) / 2
const halfWidth = (bounds.maxX - bounds.minX) / 2, halfHeight = (bounds.maxY - bounds.minY) / 2
const SCALE = SIGN_WIDTH / (bounds.maxX - bounds.minX)
const TUBE_RADIUS = TUBE_RADIUS_SVG * SCALE
const toWorld = ([x, y]) => [(x - centreX) * SCALE, -(y - centreY) * SCALE]

const SECTOR_REGION = [5, 6, 7, 3, 2, 1, 0, 4]
function neonAttributes([x, y], contourIndex) {
  const u = (x - centreX) / halfWidth, v = -(y - centreY) / halfHeight
  const phase = Math.min(1, Math.hypot(u, v))
  const stripe = Math.min(7, Math.max(0, Math.floor(((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 8)))
  const angle = (Math.atan2(v, u) + Math.PI * 2) % (Math.PI * 2)
  return { phase, route: contourIndex, bank: stripe % 4, region: SECTOR_REGION[Math.round(angle / (Math.PI / 4)) % 8] }
}

// ── Neon tubes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function buildTubes() {
  const positions = [], normals = [], indices = [], phases = [], route = [], bank = [], region = [], system = []
  const loops = contours.map(({ points }, index) => {
    // Orient every loop the same way (counter-clockwise on screen) and sweep it round.
    let ring = smoothClosed(resampleClosed(points, RESAMPLE_STEP), 7, 0.5)
    let area = 0
    ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1] })
    if (area > 0) ring = ring.reverse() // SVG y is down, so this makes the loop counter-clockwise in the world's y-up frame
    return { index, ring }
  })
  for (const { index, ring } of loops) {
    const base = positions.length / 3
    const count = ring.length
    for (let i = 0; i < count; i += 1) {
      const prev = toWorld(ring[(i - 1 + count) % count]), next = toWorld(ring[(i + 1) % count]), here = toWorld(ring[i])
      const tx = next[0] - prev[0], ty = next[1] - prev[1]
      const length = Math.hypot(tx, ty) || 1
      // In-plane normal (pointing out of the loop's left side) and the sign's normal (+z).
      const bx = -ty / length, by = tx / length
      const attributes = neonAttributes(ring[i], index)
      for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
        const theta = (j / RADIAL_SEGMENTS) * Math.PI * 2
        const nx = Math.cos(theta) * bx, ny = Math.cos(theta) * by, nz = Math.sin(theta)
        positions.push(here[0] + nx * TUBE_RADIUS, here[1] + ny * TUBE_RADIUS, nz * TUBE_RADIUS)
        normals.push(nx, ny, nz)
        phases.push(attributes.phase); route.push(attributes.route); bank.push(attributes.bank); region.push(attributes.region); system.push(1)
      }
    }
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count
      for (let j = 0; j < RADIAL_SEGMENTS; j += 1) {
        const j2 = (j + 1) % RADIAL_SEGMENTS
        const a = base + i * RADIAL_SEGMENTS + j, b = base + i * RADIAL_SEGMENTS + j2
        const c = base + next * RADIAL_SEGMENTS + j, d = base + next * RADIAL_SEGMENTS + j2
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  return {
    mesh: {
      name: 'tubeCores', part: 'tubeCores',
      positions: new Float32Array(positions), normals: new Float32Array(normals), indices: Uint32Array.from(indices), phases: new Float32Array(phases),
      attributes: {
        _MAINFRAME_ROUTE: { array: new Float32Array(route), type: 'SCALAR' },
        _MAINFRAME_BANK: { array: new Float32Array(bank), type: 'SCALAR' },
        _MAINFRAME_REGION: { array: new Float32Array(region), type: 'SCALAR' },
        _MAINFRAME_SYSTEM: { array: new Float32Array(system), type: 'SCALAR' },
      },
    },
    loops,
  }
}

// ── Clips ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Clear standoff clips: a short collar round the tube and a post back to the wall, at even spacing round the sign's outer contour. */
function buildClips(loops) {
  const outer = loops[0].ring
  const COUNT = 16
  const parts = []
  for (let k = 0; k < COUNT; k += 1) {
    const i = Math.floor((k / COUNT) * outer.length)
    const here = toWorld(outer[i]), next = toWorld(outer[(i + 1) % outer.length]), prev = toWorld(outer[(i - 1 + outer.length) % outer.length])
    const tangent = new THREE.Vector3(next[0] - prev[0], next[1] - prev[1], 0).normalize()
    const collarGeometry = new THREE.CylinderGeometry(TUBE_RADIUS * 1.4, TUBE_RADIUS * 1.4, TUBE_RADIUS * 1.7, 12, 1, true)
    const collar = fromGeometry(collarGeometry, null)
    const orient = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
    parts.push(transformed(collar, new THREE.Matrix4().compose(new THREE.Vector3(here[0], here[1], 0), orient, new THREE.Vector3(1, 1, 1))))
    const postLength = Math.abs(WALL_Z) - TUBE_RADIUS * 0.4
    const post = fromGeometry(new THREE.CylinderGeometry(TUBE_RADIUS * 0.34, TUBE_RADIUS * 0.46, postLength, 10), null)
    const aim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1))
    parts.push(transformed(post, new THREE.Matrix4().compose(new THREE.Vector3(here[0], here[1], -TUBE_RADIUS * 0.4 - postLength / 2), aim, new THREE.Vector3(1, 1, 1))))
    const foot = fromGeometry(new THREE.CylinderGeometry(TUBE_RADIUS * 1.1, TUBE_RADIUS * 1.1, TUBE_RADIUS * 0.5, 12), null)
    parts.push(transformed(foot, new THREE.Matrix4().compose(new THREE.Vector3(here[0], here[1], WALL_Z + TUBE_RADIUS * 0.25), aim, new THREE.Vector3(1, 1, 1))))
  }
  const all = merged(parts)
  return { name: 'clips', part: 'clips', positions: all.positions, normals: all.normals, indices: all.indices, phases: new Float32Array(all.positions.length / 3) }
}

// ── Brick wall ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
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

/** Bricks per row and rows per tile; the tile covers `WALL_TILE_UNITS` world units both ways, so a brick is 0.8 x 0.27 units. */
const BRICKS_PER_ROW = 4
const BRICK_ROWS = 12
export const WALL_TILE_UNITS = 3.2

function brickTextures(size) {
  const cellW = size / BRICKS_PER_ROW, cellH = size / BRICK_ROWS
  const height = new Float32Array(size * size)
  const chip = new Float32Array(size * size)
  const faceId = new Float32Array(size * size)
  const mortarMask = new Float32Array(size * size)
  const bumps = new Float32Array(size * size)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const i = y * size + x
    const u = x / size, v = y / size
    const row = Math.floor(y / cellH)
    const xx = (x + (row % 2) * cellW / 2) % size
    const col = Math.floor(xx / cellW)
    const localX = xx - col * cellW, localY = y - row * cellH
    const edge = Math.min(localX, cellW - localX, localY, cellH - localY)
    const id = noiseHash(col, row, 5)
    // Chipped, uneven edges: the distance to the edge is eroded by noise, so the paint breaks away along the brick's rim.
    const erosion = (fbm(u, v, 24, 4, 31) - 0.5) * cellH * 0.34 + (fbm(u, v, 96, 3, 33) - 0.5) * cellH * 0.18
    const e = edge + erosion
    const mortarWidth = cellH * 0.1
    const face = smooth(mortarWidth, mortarWidth + cellH * 0.07, e)
    const rim = 1 - smooth(mortarWidth + cellH * 0.07, mortarWidth + cellH * 0.3, e)
    faceId[i] = id
    mortarMask[i] = 1 - face
    // Paint: heavy bubbled, wrinkled relief on the face, rough in the recesses.
    const coarse = fbm(u, v, 18, 4, 41)
    const fine = fbm(u, v, 120, 3, 43)
    const wrinkle = Math.abs(fbm(u, v, 40, 3, 47) - 0.5) * 2
    bumps[i] = coarse * 0.5 + fine * 0.3 + wrinkle * 0.2
    chip[i] = rim * smooth(0.56, 0.78, fbm(u, v, 36, 3, 53)) * face
    height[i] = face * (0.62 + (id - 0.5) * 0.1 + bumps[i] * 0.34 - chip[i] * 0.22) + (1 - face) * (0.1 + fine * 0.12)
  }
  const baseColor = new Uint8Array(size * size * 4), normal = new Uint8Array(size * size * 4), metalRough = new Uint8Array(size * size * 4)
  const h = (x, y) => height[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const strength = 9
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const i = y * size + x, o = i * 4, u = x / size, v = y / size
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength
    const l = Math.hypot(dx, dy, 1)
    normal[o] = Math.round((0.5 - 0.5 * dx / l) * 255); normal[o + 1] = Math.round((0.5 - 0.5 * dy / l) * 255); normal[o + 2] = Math.round((0.5 + 0.5 / l) * 255); normal[o + 3] = 255

    // Black paint: near-black with a faint warm cast, lighter on the high bumps; chipped rims show the red brick; mortar is dusty grey-brown.
    const mortar = mortarMask[i], chipped = chip[i]
    const paint = 0.035 + faceId[i] * 0.02 + bumps[i] * 0.05
    const dust = fbm(u, v, 14, 3, 61)
    const mortarTone = 0.09 + dust * 0.07
    const brickRed = [0.12 + dust * 0.05, 0.07, 0.055]
    const r = (paint * 1.04 * (1 - chipped) + brickRed[0] * chipped) * (1 - mortar) + mortarTone * 1.05 * mortar
    const g = (paint * 0.98 * (1 - chipped) + brickRed[1] * chipped) * (1 - mortar) + mortarTone * 0.98 * mortar
    const b = (paint * 0.95 * (1 - chipped) + brickRed[2] * chipped) * (1 - mortar) + mortarTone * 0.9 * mortar
    baseColor[o] = Math.round(Math.min(1, r) * 255); baseColor[o + 1] = Math.round(Math.min(1, g) * 255); baseColor[o + 2] = Math.round(Math.min(1, b) * 255); baseColor[o + 3] = 255

    // Glossy paint on the high bumps, rough where it has chipped and in the mortar.
    const gloss = smooth(0.35, 0.8, bumps[i]) * (1 - mortar) * (1 - chipped)
    const roughness = Math.min(1, Math.max(0.2, 0.78 - gloss * 0.46 + mortar * 0.1 + chipped * 0.1))
    metalRough[o] = 255; metalRough[o + 1] = Math.round(roughness * 255); metalRough[o + 2] = 0; metalRough[o + 3] = 255
  }
  return { baseColor: encodePng(baseColor, size), normal: encodePng(normal, size), metallicRoughness: encodePng(metalRough, size) }
}

/** One large plane at the back of the sign. Its UVs run in world units / tile, so the brick scale is the same however big the plane is. */
function buildWall() {
  const width = 36, height = 22
  const z = WALL_Z
  const positions = [-width / 2, -height / 2, z, width / 2, -height / 2, z, -width / 2, height / 2, z, width / 2, height / 2, z]
  const uvs = [0, 1 * (height / WALL_TILE_UNITS), width / WALL_TILE_UNITS, height / WALL_TILE_UNITS, 0, 0, width / WALL_TILE_UNITS, 0]
  return {
    name: 'wall', part: 'wall',
    positions: new Float32Array(positions), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), uvs: new Float32Array(uvs),
    indices: Uint32Array.from([0, 1, 2, 1, 3, 2]), phases: new Float32Array(4),
  }
}

const { mesh: tubes, loops } = buildTubes()
const clips = buildClips(loops)
const wall = buildWall()
const brick = brickTextures(TEXTURE_SIZE)
const MATERIALS = {
  // Dark glass: with no base colour of its own the tube shows only its emission, so the wall's point lights do not wash it out to white.
  tubeCores: { baseColorFactor: [0.03, 0.03, 0.032, 1], metallicFactor: 0, roughnessFactor: 0.2, emissiveFactor: [1, 1, 1] },
  clips: { baseColorFactor: [0.62, 0.64, 0.68, 1], metallicFactor: 0.85, roughnessFactor: 0.28 },
  wall: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 1, textures: { baseColor: brick.baseColor, normal: brick.normal, metallicRoughness: brick.metallicRoughness, normalScale: 1.4 } },
}

const { triangles, byteLength, parts } = writeGlb(outputPath, [tubes, clips, wall], MATERIALS, 'DRMVYZ scripts/cinema2-assets/generate-backstreet.mjs', 'backstreet')
console.log(`Wrote ${outputPath}`)
console.log(`  ${parts.join(', ')}: ${triangles} triangles, ${(byteLength / 1024).toFixed(0)} KB, ${contours.length} neon contours, brick textures ${TEXTURE_SIZE}px`)
