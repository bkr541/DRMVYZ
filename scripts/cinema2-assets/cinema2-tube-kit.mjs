// Shared building blocks for Cinema 2.0's hand-authored organic assets (golden roots, RELIQUARY trees): deterministic hashing, tapered tubes
// swept along splines with a rotation-minimizing frame, bark perturbation, vein strands, teardrop leaves, and a small binary glTF writer.
// Every mesh carries a `_GLOW_PHASE` attribute (see three-scene's audio glow); a mesh may also carry `seeds`, written as `_GLOW_SEED` (one random
// value per tree, so each tree's glow pulses on its own).
import { writeFileSync } from 'node:fs'
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

/** Sweeps a circular (optionally bark-perturbed) cross-section of varying radius down the curve. */
export function buildTaperedTube(controlPoints, { samples = 48, radiusAt, radialSegments = 8, capStart = true, capEnd = true, bark = null, phaseAt = () => 0 }) {
  const { centres, tangents, normals, binormals } = frameSamples(controlPoints, samples)
  const positions = [], vertexNormals = [], indices = [], phases = []
  for (let i = 0; i < centres.length; i += 1) {
    const t = i / (centres.length - 1)
    const radius = radiusAt(t)
    for (let j = 0; j < radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2
      const dir = new THREE.Vector3().addScaledVector(normals[i], Math.cos(theta)).addScaledVector(binormals[i], Math.sin(theta)).normalize()
      const local = bark ? radius * (1 + bark.amplitude * barkOffset(t, j / radialSegments, bark.seed)) : radius
      const point = new THREE.Vector3().copy(centres[i]).addScaledVector(dir, local)
      positions.push(point.x, point.y, point.z)
      vertexNormals.push(dir.x, dir.y, dir.z)
      phases.push(phaseAt(t))
    }
  }
  for (let i = 0; i < centres.length - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * radialSegments + j, b = i * radialSegments + ((j + 1) % radialSegments)
      const c = (i + 1) * radialSegments + j, d = (i + 1) * radialSegments + ((j + 1) % radialSegments)
      indices.push(a, c, b, b, c, d)
    }
  }
  const capAt = (index, flip) => {
    const base = positions.length / 3
    positions.push(centres[index].x, centres[index].y, centres[index].z)
    const n = flip ? -1 : 1
    vertexNormals.push(tangents[index].x * n, tangents[index].y * n, tangents[index].z * n)
    phases.push(phaseAt(index / (centres.length - 1)))
    const ring = index === 0 ? 0 : (centres.length - 1) * radialSegments
    for (let j = 0; j < radialSegments; j += 1) {
      const j2 = (j + 1) % radialSegments
      if (flip) indices.push(base, ring + j2, ring + j); else indices.push(base, ring + j, ring + j2)
    }
  }
  if (capStart) capAt(0, true)
  if (capEnd) capAt(centres.length - 1, false)
  return { positions: new Float32Array(positions), normals: new Float32Array(vertexNormals), indices: Uint32Array.from(indices), phases: new Float32Array(phases) }
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
export function writeGlb(outputPath, meshes, materials, generator, sceneName) {
  const MATERIALS = materials
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
      materialList.push({ name: mesh.part, pbrMetallicRoughness: { baseColorFactor: MATERIALS[mesh.part].baseColorFactor, metallicFactor: MATERIALS[mesh.part].metallicFactor, roughnessFactor: MATERIALS[mesh.part].roughnessFactor }, ...(MATERIALS[mesh.part].emissiveFactor ? { emissiveFactor: MATERIALS[mesh.part].emissiveFactor } : {}) })
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
