// Generates the OPEN DECKS asset: a stepped 3D model of a CDJ, textured with the supplied reference photograph.
//   node scripts/cinema2-assets/generate-open-decks.mjs [out.glb]      (default: public/cinema2/models/open-decks.glb)
//
// The photograph (sources/open-decks-cdj-reference.png) is a straight-on view of the top of the player. Each part of the hardware is measured
// off it in photo pixels (`PARTS` below) and built as a real volume: the chassis plate, the raised screen housing with the glass set back inside
// it, the soft keys, hot-cue pads, rotary and knobs. The tops of the parts are mapped to the photograph (a planar projection from the front,
// so from the front the model reads exactly as photographed, and from the side it has parallax, steps and edges). The sides of the parts are a
// plain dark brushed metal instead of the stretched photo. A dark wall hangs a small gap behind it, so the device is lifted off it and casts a
// shadow across the gap.
//
// Meshes: `cdj` (two primitives: the photographed tops, and the metal sides), `screen` (the glass: dark, glossy and lit by the photograph's
// own screen), `backdrop` (the wall). No normals (the loader shades flat), 16-bit positions and texture coordinates, the photograph embedded
// once as a JPEG. The file is then meshopt-compressed by the shared asset tools.
//
// Coordinates: centred on the device, 2.5 units wide, facing +Z, Y up, the chassis back plane at z = 0 and the screen housing front at z = 0.17.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ShapeUtils, Vector2 } from 'three'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const SOURCE_PATH = join(root, 'scripts/cinema2-assets/sources/open-decks-cdj-reference.png')
export const DEFAULT_OUTPUT = join(root, 'public/cinema2/models/open-decks.glb')

/** The size of the reference photograph the part measurements were taken on. */
export const PHOTO = Object.freeze({ width: 1080, height: 800 })

export const OPTIONS = Object.freeze({
  /** Width of the device (its outer chassis) in world units. */
  width: 2.5,
  /** Segments around a round part. */
  circleSegments: 40,
  /** The wall behind the device: size in world units, the gap behind the chassis back plane (the shadow falls across it), and colour. */
  wall: Object.freeze({ width: 16, height: 10, gap: 0.15, color: '#050607' }),
  /** JPEG quality of the embedded photograph. */
  jpegQuality: 90,
  /** The embedded photograph's width in pixels: the asset limit (see photographJpeg). */
  textureWidth: 2048,
})

/** Heights in world units. */
export const Z = Object.freeze({ plate: 0.09, housing: 0.17, glass: 0.158 })

const rect = (x0, y0, x1, y1, radius = 0) => ({ kind: 'rect', x0, y0, x1, y1, radius })
const circle = (cx, cy, radius) => ({ kind: 'circle', cx, cy, radius })

/**
 * Every part, measured off the photograph (x, y in photo pixels, y down). `bottom` is the height it stands on, `top` its height. The first two are
 * the chassis and the screen housing (the model is centred on them). `hole` cuts a rectangle out of the top (the glass opening of the housing).
 */
export const PARTS = Object.freeze([
  { name: 'chassis', shape: rect(33, 155, 1047, 732, 12), bottom: 0, top: Z.plate },
  { name: 'screen housing', shape: rect(165, 59, 898, 541, 16), hole: rect(217, 152, 850, 507, 6), bottom: 0, top: Z.housing, holeFloor: Z.glass },
  ...[[200, 290], [313, 403], [427, 517], [547, 633], [660, 750], [775, 867]].map(([x0, x1], i) => ({ name: `soft key ${i + 1}`, shape: rect(x0, 95, x1, 117, 4), bottom: Z.housing, top: Z.housing + 0.008 })),
  ...[[179, 248], [272, 340], [365, 433], [457, 527], [551, 619], [645, 712], [737, 805], [830, 898]].map(([x0, x1], i) => ({ name: `hot cue pad ${'ABCDEFGH'[i]}`, shape: rect(x0, 562, x1, 603, 7), bottom: Z.plate, top: Z.plate + 0.018 })),
  { name: 'browse cluster', shape: rect(877, 193, 1017, 447, 40), bottom: Z.plate, top: Z.plate + 0.015 },
  { name: 'rotary', shape: circle(945, 319, 72), bottom: Z.plate + 0.015, top: Z.plate + 0.032 },
  { name: 'rotary knob', shape: circle(945, 319, 39), bottom: Z.plate + 0.032, top: Z.plate + 0.065 },
  { name: 'in cue', shape: circle(82, 661, 28), bottom: Z.plate, top: Z.plate + 0.026 },
  { name: 'out', shape: circle(160, 661, 28), bottom: Z.plate, top: Z.plate + 0.026 },
  { name: 'loop', shape: circle(252, 660, 27), bottom: Z.plate, top: Z.plate + 0.03 },
  { name: 'vinyl speed knob', shape: circle(965, 579, 27), bottom: Z.plate, top: Z.plate + 0.032 },
  { name: 'vinyl cdj', shape: rect(909, 635, 973, 677, 6), bottom: Z.plate, top: Z.plate + 0.012 },
  { name: 'jog mode', shape: rect(975, 635, 1025, 677, 6), bottom: Z.plate, top: Z.plate + 0.012 },
  { name: 'delete', shape: circle(805, 659, 22), bottom: Z.plate, top: Z.plate + 0.022 },
  { name: 'memory', shape: circle(863, 659, 13), bottom: Z.plate, top: Z.plate + 0.014 },
  { name: 'cue loop call left', shape: circle(683, 659, 13), bottom: Z.plate, top: Z.plate + 0.01 },
  { name: 'cue loop call right', shape: circle(738, 659, 13), bottom: Z.plate, top: Z.plate + 0.01 },
  { name: 'time mode knob', shape: circle(105, 423, 15), bottom: Z.plate, top: Z.plate + 0.018 },
  { name: 'slip', shape: rect(50, 473, 97, 499, 4), bottom: Z.plate, top: Z.plate + 0.01 },
  { name: 'quantize', shape: rect(111, 473, 158, 499, 4), bottom: Z.plate, top: Z.plate + 0.01 },
  { name: 'call delete slide', shape: rect(52, 563, 121, 617, 4), bottom: Z.plate, top: Z.plate + 0.01 },
])

// ── Outlines ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A shape as a ring of [x, y] photo pixels. */
export function outlineOf(shape, circleSegments = OPTIONS.circleSegments) {
  if (shape.kind === 'circle') {
    return Array.from({ length: circleSegments }, (_, i) => { const a = (i / circleSegments) * Math.PI * 2; return [shape.cx + Math.cos(a) * shape.radius, shape.cy + Math.sin(a) * shape.radius] })
  }
  const { x0, y0, x1, y1 } = shape
  const radius = Math.min(shape.radius, (x1 - x0) / 2, (y1 - y0) / 2)
  if (radius <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const corners = [[x1 - radius, y0 + radius, -90], [x1 - radius, y1 - radius, 0], [x0 + radius, y1 - radius, 90], [x0 + radius, y0 + radius, 180]]
  const ring = []
  for (const [cx, cy, start] of corners) for (let step = 0; step <= 4; step += 1) { const a = ((start + step * 22.5) * Math.PI) / 180; ring.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]) }
  return ring
}

const signedArea = ring => ring.reduce((sum, [x0, y0], i) => { const [x1, y1] = ring[(i + 1) % ring.length]; return sum + (x0 * y1 - x1 * y0) }, 0) / 2
/** Orients a ring in world space (y up): counter-clockwise for an outer ring, clockwise for a hole. */
const orient = (ring, counterClockwise) => ((signedArea(ring) > 0) === counterClockwise ? ring : [...ring].reverse())

// ── Building the meshes ────────────────────────────────────────────────────────────────────────────────────────────────────────

class Primitive {
  constructor(textured) { this.textured = textured; this.positions = []; this.uvs = []; this.indices = [] }
  vertex(x, y, z, u = 0, v = 0) { this.positions.push(x, y, z); if (this.textured) this.uvs.push(u, v); return this.positions.length / 3 - 1 }
}

/**
 * Builds the model. Returns { meshes: [{ name, primitives: [{ material, positions, uvs?, indices }] }], stats }.
 * Photo pixels become world units about the device's centre, scaled so the chassis is `options.width` wide.
 */
export function buildModel(options = OPTIONS) {
  const chassis = PARTS[0].shape
  const scale = options.width / (chassis.x1 - chassis.x0)
  const centerX = (chassis.x0 + chassis.x1) / 2
  const centerY = (PARTS[1].shape.y0 + chassis.y1) / 2
  const world = ([x, y]) => [(x - centerX) * scale, (centerY - y) * scale]
  const uv = ([x, y]) => [x / PHOTO.width, y / PHOTO.height]

  const tops = new Primitive(true), sides = new Primitive(false)
  for (const part of PARTS) {
    // Photo y runs down, so a ring that is clockwise in photo space is counter-clockwise in the world.
    const rings = [orient(outlineOf(part.shape, options.circleSegments), false), ...(part.hole ? [orient(outlineOf(part.hole, options.circleSegments), true)] : [])]
    const worldRings = rings.map(ring => ring.map(world))
    // Top cap: triangulated in world space, each vertex mapped to the photograph.
    const triangles = ShapeUtils.triangulateShape(worldRings[0].map(([x, y]) => new Vector2(x, y)), worldRings.slice(1).map(ring => ring.map(([x, y]) => new Vector2(x, y))))
    const capStart = tops.positions.length / 3
    rings.forEach((ring, r) => ring.forEach((point, i) => { const [x, y] = worldRings[r][i]; const [u, v] = uv(point); tops.vertex(x, y, part.top, u, v) }))
    for (const [a, b, c] of triangles) tops.indices.push(capStart + a, capStart + b, capStart + c)
    // Walls: from the height the part stands on up to its top; the glass opening's walls run from the glass up to the housing front.
    rings.forEach((ring, r) => {
      const bottom = r === 1 ? part.holeFloor : part.bottom
      const base = sides.positions.length / 3
      worldRings[r].forEach(([x, y]) => { sides.vertex(x, y, part.top); sides.vertex(x, y, bottom) })
      for (let i = 0; i < ring.length; i += 1) {
        const j = (i + 1) % ring.length
        const topA = base + 2 * i, footA = topA + 1, topB = base + 2 * j, footB = topB + 1
        sides.indices.push(footA, footB, topB, footA, topB, topA)
      }
    })
  }

  // The glass: a quad at the floor of the opening, mapped to the photograph.
  const glass = PARTS[1].hole
  const glassPrimitive = new Primitive(true)
  for (const point of [[glass.x0, glass.y1], [glass.x1, glass.y1], [glass.x1, glass.y0], [glass.x0, glass.y0]]) { const [x, y] = world(point); const [u, v] = uv(point); glassPrimitive.vertex(x, y, Z.glass, u, v) }
  glassPrimitive.indices.push(0, 1, 2, 0, 2, 3)

  // The wall: one quad facing +Z, `gap` behind the back plane and wider than any view of it.
  const { width, height, gap } = options.wall
  const wall = new Primitive(false)
  for (const [x, y] of [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]) wall.vertex(x, y, -gap)
  wall.indices.push(0, 1, 2, 0, 2, 3)

  const finish = (primitive, material) => ({ material, positions: Float32Array.from(primitive.positions), ...(primitive.textured ? { uvs: Float32Array.from(primitive.uvs) } : {}), indices: Uint32Array.from(primitive.indices) })
  return {
    meshes: [
      { name: 'cdj', primitives: [finish(tops, 'panel'), finish(sides, 'sides')] },
      { name: 'screen', primitives: [finish(glassPrimitive, 'glass')] },
      { name: 'backdrop', primitives: [finish(wall, 'wall')] },
    ],
    stats: {
      parts: PARTS.length, scale, width: options.width, height: (chassis.y1 - PARTS[1].shape.y0) * scale, depth: Z.housing,
      triangles: (tops.indices.length + sides.indices.length + glassPrimitive.indices.length + wall.indices.length) / 3,
    },
  }
}

// ── The photograph ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The reference photograph as JPEG bytes, enlarged to the asset limit (2048 px wide) with a high-quality resample and a light sharpen. The photograph is only
 * 1080 px wide and is shown larger than that, so the graphics card would otherwise stretch each texel with plain bilinear filtering; enlarging it here with a
 * better filter keeps edges and text crisper. It adds no detail the photograph does not have.
 */
export async function photographJpeg(options = OPTIONS) {
  const { default: sharp } = await import('sharp')
  const image = sharp(SOURCE_PATH)
  const { width, height } = await image.metadata()
  if (width !== PHOTO.width || height !== PHOTO.height) throw new Error(`The reference photograph must be ${PHOTO.width} x ${PHOTO.height} (the part measurements were taken on it); it is ${width} x ${height}.`)
  const outputWidth = options.textureWidth
  return image
    .resize({ width: outputWidth, height: Math.round(outputWidth * height / width), kernel: 'lanczos3' })
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.2 })
    .jpeg({ quality: options.jpegQuality, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

// ── Writing the GLB ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const srgbToLinear = channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export const hexToRgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
const linearColor = hex => [...hexToRgb(hex).map(srgbToLinear), 1]

/** The materials by name. The photograph is texture 0. */
export function materialsOf(options = OPTIONS) {
  return {
    // The tops show the photograph as their own colour (an emissive share keeps it faithful where the lights and shadows do not reach) and are also lit,
    // so the key's shadows and the studio reflections still work on them.
    // A plastic or metal surface reflects the studio lighting even where the photograph is black, which lifted every black to grey and washed out the colour.
    // KHR_materials_specular turns most of that reflection off (a little stays so the edges still catch the key), so the photograph's own blacks and colours show.
    panel: { name: 'open-decks-panel', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [0.4, 0.4, 0.4, 1], metallicFactor: 0, roughnessFactor: 0.6 }, emissiveTexture: { index: 0 }, emissiveFactor: [0.34, 0.34, 0.34], extensions: { KHR_materials_specular: { specularFactor: 0.06 } } },
    sides: { name: 'open-decks-sides', pbrMetallicRoughness: { baseColorFactor: linearColor('#202226'), metallicFactor: 0.65, roughnessFactor: 0.42 } },
    // The screen is the photograph's own screen: it lights itself, under a glossy surface.
    glass: { name: 'open-decks-glass', pbrMetallicRoughness: { baseColorFactor: [0, 0, 0, 1], metallicFactor: 0, roughnessFactor: 0.25 }, emissiveTexture: { index: 0 }, emissiveFactor: [1, 1, 1], extensions: { KHR_materials_specular: { specularFactor: 0.03 } } },
    wall: { name: 'open-decks-wall', pbrMetallicRoughness: { baseColorFactor: linearColor(options.wall.color), metallicFactor: 0, roughnessFactor: 0.82 } },
  }
}

/**
 * A GLB: each mesh is a node, each primitive uses one named material. Positions are 16-bit normalised against the mesh's bounds
 * (KHR_mesh_quantization) and placed by the node; texture coordinates are 16-bit normalised.
 * @param meshes  [{ name, primitives: [{ material, positions, uvs?, indices }] }]
 * @param jpeg    the photograph, embedded once
 */
export function writeGlb(meshes, jpeg, name = 'open-decks', options = OPTIONS) {
  const materialTable = materialsOf(options)
  const pad = buffer => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)])
  const chunks = [], accessors = [], bufferViews = [], nodes = [], gltfMeshes = [], materials = [], materialIndex = new Map()
  let offset = 0
  const add = (buffer, extra = {}) => {
    chunks.push(pad(buffer))
    const view = bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, ...extra }) - 1
    offset += pad(buffer).length
    return view
  }
  const imageView = add(jpeg)
  const useMaterial = key => {
    if (!materialIndex.has(key)) { materialIndex.set(key, materials.length); materials.push(materialTable[key]) }
    return materialIndex.get(key)
  }
  meshes.forEach((mesh, meshIndex) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (const { positions } of mesh.primitives) for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k += 1) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]) }
    const center = min.map((v, k) => (v + max[k]) / 2), half = min.map((v, k) => Math.max((max[k] - v) / 2, 1e-6))
    const primitives = mesh.primitives.map(primitive => {
      const count = primitive.positions.length / 3
      const quantised = new Int16Array(count * 4) // x y z + padding so each vertex is 8 bytes
      for (let i = 0; i < count; i += 1) for (let k = 0; k < 3; k += 1) quantised[i * 4 + k] = Math.round(((primitive.positions[i * 3 + k] - center[k]) / half[k]) * 32767)
      const big = count > 65535
      const indexBytes = big ? Buffer.from(primitive.indices.buffer) : Buffer.from(Uint16Array.from(primitive.indices).buffer)
      const indexAccessor = accessors.push({ bufferView: add(indexBytes, { target: 34963 }), componentType: big ? 5125 : 5123, count: primitive.indices.length, type: 'SCALAR' }) - 1
      const attributes = {}
      attributes.POSITION = accessors.push({ bufferView: add(Buffer.from(quantised.buffer), { byteStride: 8, target: 34962 }), componentType: 5122, normalized: true, count, type: 'VEC3', min: [-1, -1, -1], max: [1, 1, 1] }) - 1
      if (primitive.uvs) {
        const packed = new Uint16Array(count * 2)
        for (let i = 0; i < packed.length; i += 1) packed[i] = Math.round(Math.min(1, Math.max(0, primitive.uvs[i])) * 65535)
        attributes.TEXCOORD_0 = accessors.push({ bufferView: add(Buffer.from(packed.buffer), { byteStride: 4, target: 34962 }), componentType: 5123, normalized: true, count, type: 'VEC2' }) - 1
      }
      return { attributes, indices: indexAccessor, material: useMaterial(primitive.material) }
    })
    gltfMeshes.push({ name: mesh.name, primitives })
    nodes.push({ name: mesh.name, mesh: meshIndex, translation: center, scale: half })
  })
  const json = {
    asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-open-decks.mjs' },
    extensionsUsed: ['KHR_mesh_quantization', 'KHR_materials_specular'], extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0, scenes: [{ name, nodes: nodes.map((_, i) => i) }],
    nodes, meshes: gltfMeshes, materials, accessors, bufferViews,
    images: [{ bufferView: imageView, mimeType: 'image/jpeg', name: 'open-decks-photograph' }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    textures: [{ source: 0, sampler: 0 }],
    buffers: [{ byteLength: offset }],
  }
  const jsonBytes = Buffer.from(JSON.stringify(json))
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)])
  const binaryChunk = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8)
  const chunkHeader = (length, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(length, 0); b.writeUInt32LE(type, 4); return b }
  return Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binaryChunk.length, 0x004e4942), binaryChunk])
}

// ── Running ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const output = resolve(process.argv.slice(2).find(argument => !argument.startsWith('--')) ?? DEFAULT_OUTPUT)
  const model = buildModel()
  const raw = writeGlb(model.meshes, await photographJpeg())
  // The shared asset tools compress it (meshopt) and check the result against the raw file.
  const { readAsset } = await import('./asset-tools/io.mjs')
  const { optimizeAsset } = await import('./asset-tools/optimize.mjs')
  const scratch = `${output}.raw.glb`
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(scratch, raw)
  const [high] = await optimizeAsset(await readAsset(scratch), { tiers: ['high'], geometry: 'meshopt' })
  rmSync(scratch)
  if (!high.ok) throw new Error(`Optimising failed: ${high.failures.join('; ')}`)
  writeFileSync(output, high.bytes)
  console.log(JSON.stringify({ output, rawBytes: raw.length, bytes: high.bytes.length, ...model.stats }, null, 1))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
