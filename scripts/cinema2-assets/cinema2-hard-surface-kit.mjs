// Shared hard-surface building blocks for Cinema 2.0's machined assets (CONDUIT's tubes and chamber): parametric grid surfaces with computed
// normals, lathe-turned parts from a 2D profile (collars, flanges, grooves, rounded LED rings), rounded boxes, placement along an axis, merging
// and mirroring. Meshes are plain { positions, normals, indices } with typed or plain arrays; every builder returns typed arrays.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const DEFAULT_CREASE = (40 * Math.PI) / 180

/** An indexed BufferGeometry as a plain mesh, optionally re-shaded with crease normals (hard edges sharper than `crease`). */
export function fromGeometry(geometry, crease = DEFAULT_CREASE) {
  let g = geometry.index ? geometry : mergeVertices(geometry, 1e-6)
  if (g.getAttribute('uv')) g.deleteAttribute('uv')
  if (crease !== null) g = mergeVertices(toCreasedNormals(g, crease), 1e-6)
  return {
    positions: new Float32Array(g.getAttribute('position').array),
    normals: new Float32Array(g.getAttribute('normal').array),
    indices: Uint32Array.from(g.getIndex().array),
  }
}

/**
 * A (rows + 1) x (cols + 1) grid surface: `at(r, c)` gives each vertex (a Vector3). Normals come from the grid's own tangents (central
 * differences), oriented to agree with `outward(r, c)` (a Vector3 roughly pointing out of the surface), and the winding follows them.
 * `closed` joins the last column back to the first (a full revolution).
 */
export function gridMesh(rows, cols, at, outward, { closed = false } = {}) {
  const width = closed ? cols : cols + 1
  const grid = []
  for (let r = 0; r <= rows; r += 1) for (let c = 0; c < width; c += 1) grid.push(at(r, c))
  const vertex = (r, c) => grid[Math.min(rows, Math.max(0, r)) * width + (closed ? ((c % width) + width) % width : Math.min(cols, Math.max(0, c)))]
  const positions = new Float32Array(grid.length * 3), normals = new Float32Array(grid.length * 3)
  let flips = 0
  for (let r = 0; r <= rows; r += 1) for (let c = 0; c < width; c += 1) {
    const i = r * width + c
    const du = vertex(r + 1, c).clone().sub(vertex(r - 1, c))
    const dv = vertex(r, c + 1).clone().sub(vertex(r, c - 1))
    const n = new THREE.Vector3().crossVectors(du, dv)
    if (n.lengthSq() < 1e-16) n.copy(outward(r, c))
    n.normalize()
    if (n.dot(outward(r, c)) < 0) { n.negate(); flips += 1 }
    positions.set([grid[i].x, grid[i].y, grid[i].z], i * 3)
    normals.set([n.x, n.y, n.z], i * 3)
  }
  // (a, d, b) winds counter-clockwise about du x dv; when most normals had to flip, the surface faces the other way and so must the triangles.
  const flipped = flips > grid.length / 2
  const indices = []
  for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
    const a = r * width + c, b = r * width + ((c + 1) % width), d = (r + 1) * width + c, e = (r + 1) * width + ((c + 1) % width)
    if (flipped) indices.push(a, b, d, b, e, d); else indices.push(a, d, b, b, d, e)
  }
  return { positions, normals, indices: Uint32Array.from(indices) }
}

/**
 * A lathe-turned part about +Y: `profile` is a list of [radius, y] points from one end to the other (a closed silhouette needs its end points on
 * the axis). Hard corners (sharper than `crease`) stay crisp.
 */
export function lathe(profile, segments = 48, crease = DEFAULT_CREASE) {
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments)
  return fromGeometry(geometry, crease)
}

/** A rounded box of the given size, centred on the origin. */
export function roundedBox(width, height, depth, radius, segments = 2) {
  return fromGeometry(new RoundedBoxGeometry(width, height, depth, segments, radius), DEFAULT_CREASE)
}

/** Applies a Matrix4 to a mesh (normals by its normal matrix); a mirroring matrix also flips the winding. */
export function transformed(mesh, matrix) {
  const positions = Float32Array.from(mesh.positions), normals = Float32Array.from(mesh.normals)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
  const v = new THREE.Vector3()
  for (let i = 0; i < positions.length; i += 3) {
    v.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(matrix)
    positions.set([v.x, v.y, v.z], i)
    v.set(normals[i], normals[i + 1], normals[i + 2]).applyMatrix3(normalMatrix).normalize()
    normals.set([v.x, v.y, v.z], i)
  }
  const indices = Uint32Array.from(mesh.indices)
  if (matrix.determinant() < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
  return { ...mesh, positions, normals, indices }
}

/** Stands a part built about +Y at `origin` with its axis along `axis`, spun by `spin` radians about that axis. */
export function placed(mesh, origin, axis, spin = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize())
  const matrix = new THREE.Matrix4().compose(origin, q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin)), new THREE.Vector3(1, 1, 1))
  return transformed(mesh, matrix)
}

export const mirroredX = mesh => transformed(mesh, new THREE.Matrix4().makeScale(-1, 1, 1))

/** Concatenates meshes; per-vertex extras listed in `extras` (arrays keyed by name on each mesh) are concatenated too. */
export function merged(list, extras = []) {
  const offsets = []
  let count = 0
  for (const mesh of list) { offsets.push(count); count += mesh.positions.length / 3 }
  const out = {
    positions: new Float32Array(list.flatMap(mesh => Array.from(mesh.positions))),
    normals: new Float32Array(list.flatMap(mesh => Array.from(mesh.normals))),
    indices: Uint32Array.from(list.flatMap((mesh, k) => Array.from(mesh.indices, i => i + offsets[k]))),
  }
  for (const name of extras) out[name] = list.flatMap(mesh => Array.from(mesh[name]))
  return out
}
