import { CINEMA2_ASSET_RECORDS } from '../../assets/Cinema2AssetManifest.generated'

/** The supplied spiral galaxy (space.glb): 50,000 colored stars that replace Event Horizon's procedural star field. */
export const CINEMA2_EVENT_HORIZON_SPACE_ASSET_ID = 'cinema2-event-horizon-space'

/**
 * The galaxy as the renderer draws it. Recentered on the galaxy's centre of mass (where the black hole sits) and scaled so the radius that holds
 * 99% of the stars is 1; the renderer scales it to world units. Stars are in a fixed random order, so the first N of them are a fair sample
 * of the whole galaxy (quality tiers and Star Density draw a prefix).
 */
export interface Cinema2EventHorizonSpaceField {
  count: number
  /** x, y, z per star, in galaxy units (99% of stars within radius 1). Y is the galaxy's axis. */
  positions: Float32Array
  /** r, g, b per star, 0-1, as authored in the model. */
  colors: Float32Array
  /** 0-1 per star: stable variation for twinkle and for choosing which stars answer which musical event. */
  random: Float32Array
  /** Distance from the centre per star, as a fraction of the 99% radius (can exceed 1). */
  radial: Float32Array
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942
const COMPONENT_BYTES: Readonly<Record<number, number>> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COMPONENTS: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

interface GltfNode { children?: number[]; mesh?: number; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
interface GltfAccessor { bufferView: number; byteOffset?: number; componentType: number; normalized?: boolean; count: number; type: string }
interface GltfBufferView { byteOffset?: number; byteLength: number; byteStride?: number }
interface GltfDocument {
  scene?: number
  scenes?: { nodes?: number[] }[]
  nodes?: GltfNode[]
  meshes?: { primitives: { mode?: number; attributes: Record<string, number> }[] }[]
  accessors?: GltfAccessor[]
  bufferViews?: GltfBufferView[]
}

type Matrix = readonly number[]
const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function multiply(a: Matrix, b: Matrix): number[] {
  const out = new Array<number>(16).fill(0)
  for (let column = 0; column < 4; column += 1) for (let row = 0; row < 4; row += 1) {
    let sum = 0
    for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row]! * b[column * 4 + k]!
    out[column * 4 + row] = sum
  }
  return out
}

function nodeMatrix(node: GltfNode): Matrix {
  if (node.matrix?.length === 16) return node.matrix
  const [tx = 0, ty = 0, tz = 0] = node.translation ?? []
  const [qx = 0, qy = 0, qz = 0, qw = 1] = node.rotation ?? []
  const [sx = 1, sy = 1, sz = 1] = node.scale ?? []
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

/** World matrix of the first node that holds a mesh, found by walking the scene from its roots. */
function findMeshWorld(document: GltfDocument): { mesh: number; world: Matrix } | null {
  const nodes = document.nodes ?? []
  const visit = (index: number, parent: Matrix, depth: number): { mesh: number; world: Matrix } | null => {
    const node = nodes[index]
    if (!node || depth > 64) return null
    const world = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) return { mesh: node.mesh, world }
    for (const child of node.children ?? []) {
      const found = visit(child, world, depth + 1)
      if (found) return found
    }
    return null
  }
  const roots = document.scenes?.[document.scene ?? 0]?.nodes ?? nodes.map((_, index) => index)
  for (const root of roots) {
    const found = visit(root, IDENTITY, 0)
    if (found) return found
  }
  return null
}

/** Reads one accessor as floats (components per element), undoing normalization and byte stride. */
function readAccessor(document: GltfDocument, bin: DataView, accessor: GltfAccessor, wanted: number): Float32Array {
  const view = document.bufferViews?.[accessor.bufferView]
  const components = TYPE_COMPONENTS[accessor.type]
  const bytes = COMPONENT_BYTES[accessor.componentType]
  if (!view || !components || !bytes || components < wanted) throw new Error('Event Horizon space.glb has an unreadable accessor.')
  const stride = view.byteStride ?? components * bytes
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  if (start + (accessor.count - 1) * stride + components * bytes > bin.byteLength) throw new Error('Event Horizon space.glb accessor runs past its data.')
  const out = new Float32Array(accessor.count * wanted)
  const read = (offset: number): number => {
    switch (accessor.componentType) {
      case 5126: return bin.getFloat32(offset, true)
      case 5123: return accessor.normalized ? bin.getUint16(offset, true) / 65535 : bin.getUint16(offset, true)
      case 5121: return accessor.normalized ? bin.getUint8(offset) / 255 : bin.getUint8(offset)
      case 5122: return accessor.normalized ? Math.max(bin.getInt16(offset, true) / 32767, -1) : bin.getInt16(offset, true)
      case 5120: return accessor.normalized ? Math.max(bin.getInt8(offset) / 127, -1) : bin.getInt8(offset)
      default: return bin.getUint32(offset, true)
    }
  }
  for (let i = 0; i < accessor.count; i += 1) for (let c = 0; c < wanted; c += 1) out[i * wanted + c] = read(start + i * stride + c * bytes)
  return out
}

/** Deterministic generator so the star order, and every per-star random, is the same on every load. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

/** Parses the galaxy from a GLB: one point-cloud primitive with POSITION and COLOR_0. Throws a clear error for anything else. */
export function parseCinema2EventHorizonSpaceGlb(data: ArrayBuffer): Cinema2EventHorizonSpaceField {
  const header = new DataView(data)
  if (data.byteLength < 20 || header.getUint32(0, true) !== GLB_MAGIC) throw new Error('Event Horizon space.glb is not a GLB file.')
  let json: GltfDocument | null = null
  let bin: DataView | null = null
  for (let offset = 12; offset + 8 <= data.byteLength;) {
    const length = header.getUint32(offset, true), type = header.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + length > data.byteLength) throw new Error('Event Horizon space.glb is truncated.')
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, start, length))) as GltfDocument
    else if (type === CHUNK_BIN && !bin) bin = new DataView(data, start, length)
    offset = start + length
  }
  if (!json || !bin) throw new Error('Event Horizon space.glb is missing its JSON or binary chunk.')
  const found = findMeshWorld(json)
  const primitive = found ? json.meshes?.[found.mesh]?.primitives[0] : undefined
  if (!found || !primitive || primitive.mode !== 0) throw new Error('Event Horizon space.glb must hold one point-cloud mesh.')
  const positionAccessor = json.accessors?.[primitive.attributes.POSITION ?? -1]
  const colorAccessor = json.accessors?.[primitive.attributes.COLOR_0 ?? -1]
  if (!positionAccessor || !colorAccessor || positionAccessor.count !== colorAccessor.count || positionAccessor.count < 1) throw new Error('Event Horizon space.glb needs matching POSITION and COLOR_0 data.')
  const count = positionAccessor.count
  const local = readAccessor(json, bin, positionAccessor, 3)
  const rawColors = readAccessor(json, bin, colorAccessor, 3)

  // Scene transform, then the centre of mass.
  const m = found.world
  const world = new Float32Array(count * 3)
  const centre = [0, 0, 0]
  for (let i = 0; i < count; i += 1) {
    const x = local[i * 3]!, y = local[i * 3 + 1]!, z = local[i * 3 + 2]!
    for (let a = 0; a < 3; a += 1) {
      const value = m[a]! * x + m[4 + a]! * y + m[8 + a]! * z + m[12 + a]!
      world[i * 3 + a] = value
      centre[a]! += value / count
    }
  }
  const distance = new Float64Array(count)
  for (let i = 0; i < count; i += 1) {
    const dx = world[i * 3]! - centre[0]!, dy = world[i * 3 + 1]! - centre[1]!, dz = world[i * 3 + 2]! - centre[2]!
    distance[i] = Math.hypot(dx, dy, dz)
  }
  const sorted = Float64Array.from(distance).sort()
  const radius = sorted[Math.min(count - 1, Math.floor(count * 0.99))]!
  if (!Number.isFinite(radius) || radius <= 0) throw new Error('Event Horizon space.glb has no usable extent.')

  // A fixed shuffle so any prefix is a fair sample of the galaxy.
  const order = Array.from({ length: count }, (_, index) => index)
  const next = seededRandom(0x5eed1e)
  for (let i = count - 1; i > 0; i -= 1) { const j = Math.floor(next() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!] }
  const field: Cinema2EventHorizonSpaceField = {
    count,
    positions: new Float32Array(count * 3), colors: new Float32Array(count * 3), random: new Float32Array(count), radial: new Float32Array(count),
  }
  const randomOf = seededRandom(0xa11ce)
  for (let target = 0; target < count; target += 1) {
    const i = order[target]!
    for (let a = 0; a < 3; a += 1) {
      field.positions[target * 3 + a] = (world[i * 3 + a]! - centre[a]!) / radius
      field.colors[target * 3 + a] = Math.min(1, Math.max(0, rawColors[i * 3 + a]!))
    }
    field.random[target] = randomOf()
    field.radial[target] = distance[i]! / radius
  }
  if (!field.positions.every(Number.isFinite)) throw new Error('Event Horizon space.glb has non-finite stars.')
  return field
}

let loading: Promise<Cinema2EventHorizonSpaceField> | null = null

/** Fetches and parses the shipped galaxy once; every Event Horizon instance shares the result. A failed load is retried on the next call. */
export function loadCinema2EventHorizonSpaceField(): Promise<Cinema2EventHorizonSpaceField> {
  if (!loading) {
    const record = CINEMA2_ASSET_RECORDS.find(candidate => candidate.id === CINEMA2_EVENT_HORIZON_SPACE_ASSET_ID)
    const url = record && 'files' in record ? (record.files as { high?: { url?: string } }).high?.url : undefined
    if (!url) return Promise.reject(new Error('Event Horizon space.glb is not in the asset manifest.'))
    loading = fetch(url)
      .then(response => { if (!response.ok) throw new Error(`Event Horizon space.glb failed to load (${response.status}).`); return response.arrayBuffer() })
      .then(parseCinema2EventHorizonSpaceGlb)
      .catch(error => { loading = null; throw error })
  }
  return loading
}
