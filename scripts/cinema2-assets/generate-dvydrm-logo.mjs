// Generates the shared 3D DVYDRM logo used by Cinema 2.0 presets from the owner's master SVG.
//   node scripts/cinema2-assets/generate-dvydrm-logo.mjs [out.glb]      (default: public/cinema2/models/dvydrm-logo.glb)
//
// The SVG only supplies outlines. Each of its three paths becomes one mesh (node) in the model, so a preset can shade the parts
// differently: `outline` (the thin outer ring), `body` (the cloud, with its cut-outs) and `star` (the lower star). The paths use
// the even-odd rule, so nesting decides which contours are holes. Colors and gradients in the SVG are ignored on purpose: the model
// carries neutral white PBR materials (metal, smooth) and each preset tints and lights them.
//
// Coordinates: the logo is centred on the origin, 2 units wide, facing +Z, Y up. Every part is an extrusion with a small bevel whose
// widest point is exactly the SVG outline (bevelOffset = -bevelSize), so the parts never grow into the gaps between them.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const sourcePath = join(root, 'scripts/cinema2-assets/sources/dvydrm-logo-master.svg')
const outputPath = process.argv[2] ? resolve(process.argv[2]) : join(root, 'public/cinema2/models/dvydrm-logo.glb')

const WIDTH_UNITS = 2
const SAMPLES_PER_CURVE = 3
/** Per part: extrusion depth (world units at 2 units wide), bevel, and the PBR look baked into the model. */
const PARTS = [
  { id: 'outline', depth: 0.05, bevel: 0.006, z: 0, roughness: 0.22 },
  { id: 'body', depth: 0.12, bevel: 0.009, z: 0, roughness: 0.16 },
  { id: 'star', depth: 0.12, bevel: 0.008, z: 0, roughness: 0.1 },
]
const CREASE_ANGLE = (38 * Math.PI) / 180

const svg = readFileSync(sourcePath, 'utf8')

function pathData(id) {
  const match = svg.match(new RegExp(`<path[^>]*\\bid="${id}"[^>]*\\bd="([^"]+)"`)) ?? svg.match(new RegExp(`<path[^>]*\\bd="([^"]+)"[^>]*\\bid="${id}"`))
  if (!match) throw new Error(`The master SVG has no <path id="${id}">.`)
  return match[1]
}

/** Absolute M / C / Z only (what the master SVG uses). Returns closed polylines of [x, y]. */
function contoursOf(d) {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []
  const contours = []
  let current = null
  let cursor = [0, 0]
  let index = 0
  const number = () => Number(tokens[index++])
  while (index < tokens.length) {
    const command = tokens[index++]
    if (command === 'M') {
      current = [[number(), number()]]
      cursor = current[0]
    } else if (command === 'C') {
      // A C command may repeat its implicit coordinates until the next letter.
      while (index < tokens.length && !/[A-Za-z]/.test(tokens[index])) {
        const p1 = [number(), number()]
        const p2 = [number(), number()]
        const p3 = [number(), number()]
        for (let step = 1; step <= SAMPLES_PER_CURVE; step += 1) {
          const t = step / SAMPLES_PER_CURVE
          const u = 1 - t
          current.push([
            u * u * u * cursor[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * cursor[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
          ])
        }
        cursor = p3
      }
    } else if (command === 'Z') {
      // Drop the duplicated closing point.
      const first = current[0]
      const last = current[current.length - 1]
      if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) current.pop()
      contours.push(current)
      current = null
    } else throw new Error(`Unsupported path command "${command}" in the master SVG.`)
  }
  return contours
}

function contains(polygon, [x, y]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Even-odd nesting: contours at even depth are outlines, the odd ones directly inside them are their holes. */
function shapesOf(contours, toWorld) {
  const depth = contours.map((contour, i) => contours.reduce((count, other, j) => (i !== j && contains(other, contour[0]) ? count + 1 : count), 0))
  const shapes = []
  contours.forEach((contour, i) => {
    if (depth[i] % 2 !== 0) return
    const shape = new THREE.Shape(toWorld(contour).map(([x, y]) => new THREE.Vector2(x, y)))
    contours.forEach((hole, j) => {
      if (depth[j] === depth[i] + 1 && contains(contour, hole[0])) shape.holes.push(new THREE.Path(toWorld(hole).map(([x, y]) => new THREE.Vector2(x, y))))
    })
    shapes.push(shape)
  })
  return shapes
}

const pathContours = Object.fromEntries(PARTS.map(part => [part.id, contoursOf(pathData(part.id === 'outline' ? 'outer-outline' : part.id === 'body' ? 'cloud-body' : 'lower-star'))]))

// One shared transform for all parts so their relative placement is exactly the SVG's.
const all = Object.values(pathContours).flat(2)
const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
const scale = WIDTH_UNITS / (maxX - minX)
const toWorld = contour => contour.map(([x, y]) => [(x - (minX + maxX) / 2) * scale, -(y - (minY + maxY) / 2) * scale])

const meshes = PARTS.map(part => {
  const shapes = shapesOf(pathContours[part.id], toWorld)
  let geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: part.depth,
    bevelEnabled: true,
    bevelThickness: part.bevel,
    bevelSize: part.bevel,
    bevelOffset: -part.bevel,
    bevelSegments: 3,
    curveSegments: 1,
    steps: 1,
  })
  geometry.deleteAttribute('uv')
  // Centre each part's depth about z = 0 so a spin turns every part about the same axis.
  geometry.translate(0, 0, -part.depth / 2 + part.z)
  geometry = toCreasedNormals(geometry, CREASE_ANGLE)
  geometry = mergeVertices(geometry, 1e-5)
  return { part, geometry, shapeCount: shapes.length }
})

// ── Binary glTF ──────────────────────────────────────────────────────────────
const binaryChunks = []
let byteLength = 0
const bufferViews = []
const accessors = []
const gltfMeshes = []
const nodes = []
const materials = []

function pushView(typedArray, target) {
  const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
  const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)])
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target })
  binaryChunks.push(padded)
  byteLength += padded.length
  return bufferViews.length - 1
}

let triangles = 0
for (const { part, geometry } of meshes) {
  const positions = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.count; i += 1) for (let k = 0; k < 3; k += 1) {
    const value = positions.array[i * 3 + k]
    min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value)
  }
  const indices = Uint32Array.from(index.array)
  accessors.push({ bufferView: pushView(new Float32Array(positions.array), 34962), componentType: 5126, count: positions.count, type: 'VEC3', min, max })
  const positionAccessor = accessors.length - 1
  accessors.push({ bufferView: pushView(new Float32Array(normals.array), 34962), componentType: 5126, count: normals.count, type: 'VEC3' })
  const normalAccessor = accessors.length - 1
  accessors.push({ bufferView: pushView(indices, 34963), componentType: 5125, count: indices.length, type: 'SCALAR' })
  const indexAccessor = accessors.length - 1
  materials.push({ name: part.id, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: part.roughness } })
  gltfMeshes.push({ name: part.id, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material: materials.length - 1, mode: 4 }] })
  nodes.push({ name: part.id, mesh: gltfMeshes.length - 1 })
  triangles += indices.length / 3
}

const json = {
  asset: { version: '2.0', generator: 'DRMVYZ scripts/cinema2-assets/generate-dvydrm-logo.mjs' },
  scene: 0,
  scenes: [{ name: 'dvydrm-logo', nodes: nodes.map((_, i) => i) }],
  nodes, meshes: gltfMeshes, materials, accessors, bufferViews,
  buffers: [{ byteLength }],
}
const jsonBytes = Buffer.from(JSON.stringify(json))
const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)])
const binaryChunk = Buffer.concat(binaryChunks)
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binaryChunk.length, 8)
const chunkHeader = (length, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(length, 0); b.writeUInt32LE(type, 4); return b }
writeFileSync(outputPath, Buffer.concat([header, chunkHeader(jsonChunk.length, 0x4e4f534a), jsonChunk, chunkHeader(binaryChunk.length, 0x004e4942), binaryChunk]))

console.log(`Wrote ${outputPath}`)
for (const { part, geometry, shapeCount } of meshes) console.log(`  ${part.id}: ${shapeCount} outline(s), ${geometry.getIndex().count / 3} triangles, ${geometry.getAttribute('position').count} vertices`)
console.log(`  total ${triangles} triangles, logo ${WIDTH_UNITS} x ${(((maxY - minY) * scale)).toFixed(3)} units, ${(byteLength / 1024).toFixed(0)} KB`)
