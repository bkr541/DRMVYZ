// Shared building blocks for Cinema 2.0's hand-authored organic assets (golden roots, RELIQUARY trees): deterministic hashing, tapered tubes
// swept along splines with a rotation-minimizing frame, bark perturbation, vein strands, teardrop leaves, and a small binary glTF writer.
// Every mesh carries a `_GLOW_PHASE` attribute (see three-scene's audio glow); a mesh may also carry `seeds`, written as `_GLOW_SEED` (one random
// value per tree, so each tree's glow pulses on its own).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function hash(value) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) { h ^= value.charCodeAt(index); h = Math.imul(h, 16777619) }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13
  return ((h >>> 0) % 1_000_003) / 1_000_003
}
export const jitter = (key, spread) => (hash(key) - 0.5) * 2 * spread

// ── Curve-frame math ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Samples a Catmull-Rom spline through `controlPoints` and returns, at each sample, the point and a rotation-minimizing frame
 * (sequential parallel transport: each frame is the previous one rotated by the angle between consecutive tangents, about their cross
 * product - Rodrigues rotation). Three's Frenet frames flip when a space curve's curvature passes through zero, which these gently
 * twisting, near-straight branch curves do constantly; this does not.
 */
export function frameSamples(controlPoints, samples) {
  const curve = new THREE.CatmullRomCurve3(controlPoints.map(p => new THREE.Vector3(...p)), false, 'centripetal')
  const centres = curve.getSpacedPoints(samples)
  const tangents = centres.map((_, i) => {
    const a = centres[Math.max(0, i - 1)], b = centres[Math.min(centres.length - 1, i + 1)]
    return new THREE.Vector3().subVectors(b, a).normalize()
  })
  const seedUp = Math.abs(tangents[0].y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const normals = [new THREE.Vector3().crossVectors(tangents[0], seedUp).normalize()]
  for (let i = 1; i < tangents.length; i += 1) {
    const axis = new THREE.Vector3().crossVectors(tangents[i - 1], tangents[i])
    const prev = normals[i - 1]
    if (axis.lengthSq() < 1e-10) { normals.push(prev.clone()); continue }
    const angle = Math.acos(Math.min(1, Math.max(-1, tangents[i - 1].dot(tangents[i]))))
    normals.push(prev.clone().applyAxisAngle(axis.normalize(), angle))
  }
  const binormals = centres.map((_, i) => new THREE.Vector3().crossVectors(tangents[i], normals[i]).normalize())
  return { centres, tangents, normals, binormals }
}

/** A few sine waves in (length, angle) space, seeded per curve: reads as a gnarled, ridged bark surface rather than a smooth pipe. */
export function barkOffset(t, angleTurns, seed) {
  const a = Math.sin((angleTurns * 3 + seed * 7.1) * Math.PI * 2 + t * 11)
  const b = Math.sin((angleTurns * 5.3 - seed * 3.7) * Math.PI * 2 - t * 7.4)
  const c = Math.sin((angleTurns * 8.7 + seed * 2.3) * Math.PI * 2 + t * 19)
  return a * 0.5 + b * 0.32 + c * 0.18
}

/**
 * Sweeps a circular (optionally bark-perturbed) cross-section of varying radius down the curve.
 *
 * `uv` ({ around, along }): also emit texture coordinates - `around` texture repeats round the tube, and `along` world units per repeat down
 * it - with a duplicated seam vertex on every ring so the texture wraps without smearing. `surfaceNormals`: shade the actual (bark-perturbed)
 * surface instead of the smooth radial direction, so the lumps catch the light. Both are opt-in; without them the output is unchanged.
 */
export function buildTaperedTube(controlPoints, { samples = 48, radiusAt, radialSegments = 8, capStart = true, capEnd = true, bark = null, phaseAt = () => 0, uv = null, surfaceNormals = false }) {
  const { centres, tangents, normals, binormals } = frameSamples(controlPoints, samples)
  const positions = [], vertexNormals = [], indices = [], phases = [], uvs = []
  const ringSize = uv ? radialSegments + 1 : radialSegments
  let travelled = 0
  for (let i = 0; i < centres.length; i += 1) {
    const t = i / (centres.length - 1)
    const radius = radiusAt(t)
    if (i > 0) travelled += centres[i].distanceTo(centres[i - 1])
    for (let j = 0; j < ringSize; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2
      const dir = new THREE.Vector3().addScaledVector(normals[i], Math.cos(theta)).addScaledVector(binormals[i], Math.sin(theta)).normalize()
      const local = bark ? radius * (1 + bark.amplitude * barkOffset(t, j / radialSegments, bark.seed)) : radius
      const point = new THREE.Vector3().copy(centres[i]).addScaledVector(dir, local)
      positions.push(point.x, point.y, point.z)
      vertexNormals.push(dir.x, dir.y, dir.z)
      phases.push(phaseAt(t))
      if (uv) uvs.push((j / radialSegments) * uv.around, travelled / uv.along)
    }
  }
  const next = j => (uv ? j + 1 : (j + 1) % radialSegments)
  for (let i = 0; i < centres.length - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * ringSize + j, b = i * ringSize + next(j)
      const c = (i + 1) * ringSize + j, d = (i + 1) * ringSize + next(j)
      indices.push(a, c, b, b, c, d)
    }
  }
  if (surfaceNormals) {
    // Area-weighted face normals averaged per vertex (the seam's duplicate vertices are averaged together so the seam does not show).
    const sum = new Float32Array(positions.length)
    const p = i => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    for (let k = 0; k < indices.length; k += 3) {
      const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]]
      const n = new THREE.Vector3().crossVectors(p(b).sub(p(a)), p(c).sub(p(a)))
      for (const v of [a, b, c]) { sum[v * 3] += n.x; sum[v * 3 + 1] += n.y; sum[v * 3 + 2] += n.z }
    }
    if (uv) for (let i = 0; i < centres.length; i += 1) {
      const a = i * ringSize, b = i * ringSize + radialSegments
      for (let k = 0; k < 3; k += 1) { const m = sum[a * 3 + k] + sum[b * 3 + k]; sum[a * 3 + k] = m; sum[b * 3 + k] = m }
    }
    for (let v = 0; v < sum.length / 3; v += 1) {
      const n = new THREE.Vector3(sum[v * 3], sum[v * 3 + 1], sum[v * 3 + 2])
      if (n.lengthSq() < 1e-18) continue
      // Keep the normal on the outward side of the radial direction (the winding above faces outward).
      n.normalize()
      if (n.x * vertexNormals[v * 3] + n.y * vertexNormals[v * 3 + 1] + n.z * vertexNormals[v * 3 + 2] < 0) n.negate()
      vertexNormals[v * 3] = n.x; vertexNormals[v * 3 + 1] = n.y; vertexNormals[v * 3 + 2] = n.z
    }
  }
  const capAt = (index, flip) => {
    const base = positions.length / 3
    positions.push(centres[index].x, centres[index].y, centres[index].z)
    const n = flip ? -1 : 1
    vertexNormals.push(tangents[index].x * n, tangents[index].y * n, tangents[index].z * n)
    phases.push(phaseAt(index / (centres.length - 1)))
    if (uv) uvs.push(0.5 * uv.around, index === 0 ? 0 : travelled / uv.along)
    const ring = index === 0 ? 0 : (centres.length - 1) * ringSize
    for (let j = 0; j < radialSegments; j += 1) {
      const j2 = next(j)
      if (flip) indices.push(base, ring + j2, ring + j); else indices.push(base, ring + j, ring + j2)
    }
  }
  if (capStart) capAt(0, true)
  if (capEnd) capAt(centres.length - 1, false)
  return { positions: new Float32Array(positions), normals: new Float32Array(vertexNormals), indices: Uint32Array.from(indices), phases: new Float32Array(phases), ...(uv ? { uvs: new Float32Array(uvs) } : {}) }
}

/** Control points for a thin curve that hugs just under a branch's surface, slowly spiralling along it - the "vein" stand-in for a crack texture. */
export function veinControlPoints(controlPoints, radiusAt, baseAngle, driftTurns, offsetFactor, samples = 10) {
  const { centres, normals, binormals } = frameSamples(controlPoints, samples)
  return centres.map((c, i) => {
    const t = i / (centres.length - 1) // frameSamples returns samples + 1 points: t runs exactly 0..1
    const theta = baseAngle + driftTurns * Math.PI * 2 * t
    const r = radiusAt(t) * offsetFactor
    const dir = new THREE.Vector3().addScaledVector(normals[i], Math.cos(theta)).addScaledVector(binormals[i], Math.sin(theta))
    return [c.x + dir.x * r, c.y + dir.y * r, c.z + dir.z * r]
  })
}

/**
 * A plump teardrop leaf (rounded at the stem end, pointed at the tip), extruded thin and softly bevelled, with its stem end at `at`, its
 * length along `along`, and its face turned as far toward the camera (+Z) as that allows, so it reads as a leaf, not an edge-on sliver.
 */
export function buildLeaf(at, along, size, twist) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(size * 0.05, size * 0.32, size * 0.55, size * 0.36, size, 0)
  shape.bezierCurveTo(size * 0.55, -size * 0.36, size * 0.05, -size * 0.32, 0, 0)
  let geometry = new THREE.ExtrudeGeometry(shape, { depth: size * 0.04, bevelEnabled: true, bevelThickness: size * 0.04, bevelSize: size * 0.03, bevelSegments: 2, curveSegments: 10 })
  geometry.translate(0, 0, -size * 0.02)
  geometry.rotateX(twist) // a little roll about the leaf's own length, so the leaves do not all face the camera identically
  const x = along.clone().normalize()
  const toCamera = new THREE.Vector3(0, 0, 1)
  let z = toCamera.clone().addScaledVector(x, -toCamera.dot(x))
  if (z.lengthSq() < 1e-6) z = new THREE.Vector3(0, 1, 0).addScaledVector(x, -x.y)
  z.normalize()
  const y = new THREE.Vector3().crossVectors(z, x)
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z))
  geometry.translate(at.x, at.y, at.z)
  geometry = mergeVertices(geometry, 1e-6)
  geometry.computeVertexNormals()
  return { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: Uint32Array.from(geometry.getIndex().array) }
}

export const taper = (start, end) => t => start + (end - start) * t
/** A glow phase running linearly from `from` at the start of a curve to `to` at its end. */
export const phaseRamp = (from, to) => t => from + (to - from) * t

/**
 * Writes `meshes` ([{ name, part, positions, normals, indices, phases, seeds?, attributes? }]) as a binary glTF, one node per mesh, one material per part from
 * `materials` ({ [part]: { baseColorFactor, metallicFactor, roughnessFactor, emissiveFactor? } }). Returns counts for the console summary.
 */
/** Encodes an RGBA8 buffer (`size` x `size`) as a PNG (filter 0). */
export function encodePng(rgba, width, height = width) {
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = buf => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
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
  const source = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength)
  for (let y = 0; y < height; y += 1) source.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

export function writeGlb(outputPath, meshes, materials, generator, sceneName) {
  const MATERIALS = materials
  // Embedded PNG textures (a material's optional `textures`: { normal, metallicRoughness } PNG buffers, `normalScale`); a mesh with textures
  // needs `uvs` (TEXCOORD_0). Images are written once each and shared by a repeating sampler.
  const images = [], textures = []
  const textureIndexOf = new Map()
  const binaryChunks = []
  let byteLength = 0
  const bufferViews = []
  const accessors = []
  const gltfMeshes = []
  const nodes = []
  const materialList = []
  const materialIndexOf = new Map()

  function pushView(typedArray, target) {
    const bytes = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
    const padded = Buffer.concat([bytes, Buffer.alloc((4 - (bytes.length % 4)) % 4)])
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target })
    binaryChunks.push(padded)
    byteLength += padded.length
    return bufferViews.length - 1
  }

  let triangles = 0
  for (const mesh of meshes) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < mesh.positions.length / 3; i += 1) for (let k = 0; k < 3; k += 1) {
      const value = mesh.positions[i * 3 + k]
      min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value)
    }
    accessors.push({ bufferView: pushView(mesh.positions, 34962), componentType: 5126, count: mesh.positions.length / 3, type: 'VEC3', min, max })
    const positionAccessor = accessors.length - 1
    accessors.push({ bufferView: pushView(mesh.normals, 34962), componentType: 5126, count: mesh.normals.length / 3, type: 'VEC3' })
    const normalAccessor = accessors.length - 1
    accessors.push({ bufferView: pushView(mesh.phases, 34962), componentType: 5126, count: mesh.phases.length, type: 'SCALAR' })
    const phaseAccessor = accessors.length - 1
    const extra = {}
    if (mesh.uvs) {
      if (mesh.uvs.length !== (mesh.positions.length / 3) * 2) throw new Error(`${mesh.name}: ${mesh.uvs.length / 2} uvs for ${mesh.positions.length / 3} vertices.`)
      accessors.push({ bufferView: pushView(mesh.uvs, 34962), componentType: 5126, count: mesh.uvs.length / 2, type: 'VEC2' })
      extra.TEXCOORD_0 = accessors.length - 1
    }
    if (mesh.seeds) {
      if (mesh.seeds.length !== mesh.positions.length / 3) throw new Error(`${mesh.name}: ${mesh.seeds.length} glow seeds for ${mesh.positions.length / 3} vertices.`)
      accessors.push({ bufferView: pushView(mesh.seeds, 34962), componentType: 5126, count: mesh.seeds.length, type: 'SCALAR' })
      extra._GLOW_SEED = accessors.length - 1
    }
    // Optional extra per-vertex attributes: { _NAME: { array: Float32Array, type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4' } }.
    for (const [name, attribute] of Object.entries(mesh.attributes ?? {})) {
      const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[attribute.type]
      if (!name.startsWith('_') || !size) throw new Error(`${mesh.name}: custom attribute ${name} must start with _ and be SCALAR/VEC2/VEC3/VEC4.`)
      if (attribute.array.length !== (mesh.positions.length / 3) * size) throw new Error(`${mesh.name}: ${name} has ${attribute.array.length / size} values for ${mesh.positions.length / 3} vertices.`)
      accessors.push({ bufferView: pushView(attribute.array, 34962), componentType: 5126, count: attribute.array.length / size, type: attribute.type })
      extra[name] = accessors.length - 1
    }
    if (mesh.phases.length !== mesh.positions.length / 3) throw new Error(`${mesh.name}: ${mesh.phases.length} glow phases for ${mesh.positions.length / 3} vertices.`)
    accessors.push({ bufferView: pushView(mesh.indices, 34963), componentType: 5125, count: mesh.indices.length, type: 'SCALAR' })
    const indexAccessor = accessors.length - 1
    if (!materialIndexOf.has(mesh.part)) {
      materialIndexOf.set(mesh.part, materialList.length)
      const spec = MATERIALS[mesh.part]
      const textureOf = png => {
        if (!textureIndexOf.has(png)) {
          images.push({ bufferView: pushView(new Uint8Array(png.buffer, png.byteOffset, png.byteLength)), mimeType: 'image/png' })
          textures.push({ source: images.length - 1, sampler: 0 })
          textureIndexOf.set(png, textures.length - 1)
        }
        return textureIndexOf.get(png)
      }
      if (spec.textures && !mesh.uvs) throw new Error(`${mesh.name}: material ${mesh.part} has textures but the mesh has no uvs.`)
      materialList.push({
        name: mesh.part,
        pbrMetallicRoughness: {
          baseColorFactor: spec.baseColorFactor, metallicFactor: spec.metallicFactor, roughnessFactor: spec.roughnessFactor,
          ...(spec.textures?.metallicRoughness ? { metallicRoughnessTexture: { index: textureOf(spec.textures.metallicRoughness) } } : {}),
        },
        ...(spec.textures?.normal ? { normalTexture: { index: textureOf(spec.textures.normal), scale: spec.textures.normalScale ?? 1 } } : {}),
        ...(spec.emissiveFactor ? { emissiveFactor: spec.emissiveFactor } : {}),
      })
    }
    gltfMeshes.push({ name: mesh.name, primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, _GLOW_PHASE: phaseAccessor, ...extra }, indices: indexAccessor, material: materialIndexOf.get(mesh.part), mode: 4 }] })
    nodes.push({ name: mesh.name, mesh: gltfMeshes.length - 1 })
    triangles += mesh.indices.length / 3
  }

  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ name: sceneName, nodes: nodes.map((_, i) => i) }],
    nodes, meshes: gltfMeshes, materials: materialList, accessors, bufferViews,
    ...(images.length > 0 ? { images, textures, samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }] } : {}),
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

  return { triangles, byteLength, parts: [...materialIndexOf.keys()] }
}
