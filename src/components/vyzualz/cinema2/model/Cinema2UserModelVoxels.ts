import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'
import { cinema2GrainSeed } from './Cinema2UserModelFormDust'
import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_VOXEL_LIMITS = Object.freeze({ resolutions: { low: 12, medium: 22, high: 28 }, cells: 30_000, triangleBoxTests: 8_000_000 })
interface Grid { mesh: Three.InstancedMesh; rest: Float32Array; colors: Float32Array; side: number; count: number; colorKey?: string; poseKey?: string; seeds: Float32Array }
/** Welded triangle-edge incidence. UV/material seams do not falsely turn a closed model into an open one. */
export function isCinema2ModelWatertight(prepared: Cinema2PreparedUserModel): boolean {
  const edges = new Map<string, number>(), epsilon = Math.max(prepared.extent * 1e-6, 1e-10)
  for (let triangle = 0; triangle < prepared.triangleCount; triangle++) {
    const vertices = [0, 1, 2].map(vertex => { const offset = triangle * 9 + vertex * 3; return `${Math.round(prepared.positions[offset] / epsilon)},${Math.round(prepared.positions[offset + 1] / epsilon)},${Math.round(prepared.positions[offset + 2] / epsilon)}` })
    for (let edge = 0; edge < 3; edge++) { const a = vertices[edge], b = vertices[(edge + 1) % 3]; if (a === b) return false; const key = a < b ? a + ':' + b : b + ':' + a; edges.set(key, (edges.get(key) ?? 0) + 1) }
  }
  return edges.size > 0 && [...edges.values()].every(count => count === 2)
}
/** Triangle/AABB SAT, including edge cross-products; box bounds alone would invent a block around the logo. */
function overlaps(v: number[], cx: number, cy: number, cz: number, half: number): boolean {
  const a = [v[0] - cx, v[1] - cy, v[2] - cz], b = [v[3] - cx, v[4] - cy, v[5] - cz], c = [v[6] - cx, v[7] - cy, v[8] - cz]
  const axis = (x: number, y: number, z: number) => {
    const p = a[0] * x + a[1] * y + a[2] * z, q = b[0] * x + b[1] * y + b[2] * z, r = c[0] * x + c[1] * y + c[2] * z, radius = half * (Math.abs(x) + Math.abs(y) + Math.abs(z))
    return Math.min(p, q, r) <= radius + 1e-10 && Math.max(p, q, r) >= -radius - 1e-10
  }
  if (!axis(1, 0, 0) || !axis(0, 1, 0) || !axis(0, 0, 1)) return false
  const ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i])
  if (!axis(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])) return false
  for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    const x = q[0] - p[0], y = q[1] - p[1], z = q[2] - p[2]
    if (!axis(0, z, -y) || !axis(-z, 0, x) || !axis(y, -x, 0)) return false
  }
  return true
}

export class Cinema2VoxelizedUserModel {
  readonly group: Three.Group
  readonly grids = new Map<Cinema2RenderQualityLevel, Grid>()
  readonly material: Three.MeshStandardMaterial
  readonly geometry: Three.BoxGeometry
  readonly solid: boolean
  tests = 0
  private disposed = false
  constructor(private readonly library: Cinema2ThreeLibrary, prepared: Cinema2PreparedUserModel, meshes: readonly Three.Mesh[]) {
    const T = library.THREE
    this.group = new T.Group(); this.group.name = 'ActualModelVoxels'
    this.material = new T.MeshStandardMaterial({ roughness: .28, metalness: .55 })
    this.geometry = new T.BoxGeometry(1, 1, 1); this.solid = isCinema2ModelWatertight(prepared)
    try {
      for (const quality of ['low', 'medium', 'high'] as const) {
        try { this.buildGrid(prepared, meshes, quality) } catch (error) { if (!this.grids.size) throw error; break }
      }
    } catch (error) { this.dispose(); throw error }
  }
  private buildGrid(prepared: Cinema2PreparedUserModel, meshes: readonly Three.Mesh[], quality: Cinema2RenderQualityLevel): void {
    const T = this.library.THREE, resolution = CINEMA2_VOXEL_LIMITS.resolutions[quality], side = prepared.extent / resolution, dimension = resolution + 3, total = dimension ** 3
    const origin = -prepared.extent / 2 - side * 1.5, surface = new Uint8Array(total), colors = new Float32Array(total * 3), owners = new Uint32Array(total)
    const index = (x: number, y: number, z: number) => x + dimension * (y + dimension * z)
    const cell = (value: number) => Math.max(0, Math.min(dimension - 1, Math.floor((value - origin) / side)))
    const average = new T.Color(0, 0, 0); let colored = 0
    for (let triangle = 0; triangle < prepared.triangleCount; triangle++) {
      const vertices = Array.from(prepared.positions.subarray(triangle * 9, triangle * 9 + 9))
      const source = meshes[prepared.meshIndices[triangle]]?.material
      const material = (Array.isArray(source) ? source[prepared.materialIndices[triangle]] : source) as Three.MeshStandardMaterial | undefined, color = material?.color
      if (color) { average.add(color); colored++ }
      const minX = cell(Math.min(vertices[0], vertices[3], vertices[6])), maxX = cell(Math.max(vertices[0], vertices[3], vertices[6]))
      const minY = cell(Math.min(vertices[1], vertices[4], vertices[7])), maxY = cell(Math.max(vertices[1], vertices[4], vertices[7]))
      const minZ = cell(Math.min(vertices[2], vertices[5], vertices[8])), maxZ = cell(Math.max(vertices[2], vertices[5], vertices[8]))
      for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (++this.tests > CINEMA2_VOXEL_LIMITS.triangleBoxTests) throw new Error('Voxel preparation exceeds its intersection-work budget. The original model is kept visible.')
        if (!overlaps(vertices, origin + (x + .5) * side, origin + (y + .5) * side, origin + (z + .5) * side, side * .50001)) continue
        const id = index(x, y, z); surface[id] = 1
        colors[id * 3] += color?.r ?? .7; colors[id * 3 + 1] += color?.g ?? .7; colors[id * 3 + 2] += color?.b ?? .7; owners[id]++
      }
    }
    average.multiplyScalar(1 / Math.max(1, colored))
    if (!colored) average.setScalar(.7)
    if (this.solid) {
      const exterior = new Uint8Array(total), queue = new Uint32Array(total); let start = 0, end = 1; queue[0] = 0; exterior[0] = 1
      while (start < end) {
        const id = queue[start++], x = id % dimension, y = Math.floor(id / dimension) % dimension, z = Math.floor(id / (dimension * dimension))
        const neighbors = [x > 0 ? id - 1 : -1, x + 1 < dimension ? id + 1 : -1, y > 0 ? id - dimension : -1, y + 1 < dimension ? id + dimension : -1, z > 0 ? id - dimension ** 2 : -1, z + 1 < dimension ? id + dimension ** 2 : -1]
        for (const next of neighbors) if (next >= 0 && !surface[next] && !exterior[next]) { exterior[next] = 1; queue[end++] = next }
      }
      for (let id = 0; id < total; id++) if (!exterior[id]) surface[id] = 1
    }
    const count = surface.reduce((n, filled) => n + filled, 0)
    if (!count || count > CINEMA2_VOXEL_LIMITS.cells) throw new Error('Voxel occupancy exceeds its bounded cell count. The original model is kept visible.')
    const rest = new Float32Array(count * 3), restColors = new Float32Array(count * 3), mesh = new T.InstancedMesh(this.geometry, this.material, count)
    mesh.instanceColor = new T.InstancedBufferAttribute(restColors.slice(), 3)
    mesh.name = `ModelVoxels-${quality}`; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false
    let vertex = 0
    for (let z = 0; z < dimension; z++) for (let y = 0; y < dimension; y++) for (let x = 0; x < dimension; x++) {
      const id = index(x, y, z); if (!surface[id]) continue
      rest.set([origin + (x + .5) * side, origin + (y + .5) * side, origin + (z + .5) * side], vertex * 3)
      restColors.set(owners[id] ? [colors[id * 3] / owners[id], colors[id * 3 + 1] / owners[id], colors[id * 3 + 2] / owners[id]] : average.toArray(), vertex * 3); vertex++
    }
    this.grids.set(quality, { mesh, rest, colors: restColors, side, count, seeds: Float32Array.from({ length: count }, (_, i) => cinema2GrainSeed(i)) }); this.group.add(mesh)
  }
  animate(quality: Cinema2RenderQualityLevel, pattern: number, phase: number, spread: number, movement: number, reaction: number, tint: boolean, primary: readonly number[], secondary: readonly number[], dummy: Three.Object3D, color: Three.Color, rotation = .5, variation = .2): void {
    const tiers = ['low', 'medium', 'high'] as const
    const selected = tiers.slice(0, tiers.indexOf(quality) + 1).reverse().find(tier => this.grids.has(tier))
    for (const [tier, grid] of this.grids) {
      grid.mesh.visible = tier === selected
      if (tier !== selected) continue
      const amount = spread * (.35 + movement) * (1 + reaction * .1)
      const colorKey = tint ? `${primary.join(',')}/${secondary.join(',')}` : 'original', recolor = grid.colorKey !== colorKey
      const poseKey = spread === 0 ? 'rest' : `${pattern}/${phase}/${spread}/${movement}/${reaction}/${rotation}/${variation}`, rematrix = grid.poseKey !== poseKey
      if (!rematrix && !recolor) continue
      for (let i = 0; i < grid.count; i++) {
        if (rematrix) {
          dummy.position.fromArray(grid.rest, i * 3); const x = dummy.position.x, y = dummy.position.y, z = dummy.position.z, extent = grid.side * CINEMA2_VOXEL_LIMITS.resolutions[tier]
          if (pattern === 0) dummy.position.multiplyScalar(1 + amount * .22)
          if (pattern === 1) dummy.position.y += Math.abs(x / extent) * extent * .55 * amount
          if (pattern === 2) dummy.position.x += (i % 2 ? 1 : -1) * extent * .2 * amount
          if (pattern === 3) { const angle = amount * .65 * Math.sin(phase * .4 + y / extent * 3); dummy.position.set(x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)) }
          if (pattern === 4) dummy.position.z += Math.sin(y / extent * 8 + phase) * extent * .18 * amount
          if (pattern === 5) dummy.position.multiplyScalar(1 - amount * .3)
          const seed = grid.seeds[i], spin = spread * rotation * (.4 + seed)
          dummy.rotation.set(spin * Math.sin(seed * 20 + phase), spin * Math.cos(seed * 17 + phase * .4), spin * Math.sin(seed * 13))
          dummy.scale.setScalar(grid.side * (1 - spread * (.1 + variation * seed * .55))); dummy.updateMatrix(); grid.mesh.setMatrixAt(i, dummy.matrix)
        }
        if (recolor) {
          color.fromArray(grid.colors, i * 3)
          if (tint) { const rgb = i % 3 ? primary : secondary; color.r *= rgb[0]; color.g *= rgb[1]; color.b *= rgb[2] }
          grid.mesh.setColorAt(i, color)
        }
      }
      if (rematrix) grid.mesh.instanceMatrix.needsUpdate = true
      if (recolor && grid.mesh.instanceColor) grid.mesh.instanceColor.needsUpdate = true
      grid.poseKey = poseKey; grid.colorKey = colorKey
    }
  }
  get additionalGpuBytes(): number { let bytes = 0; for (const grid of this.grids.values()) bytes += grid.mesh.instanceMatrix.array.byteLength + (grid.mesh.instanceColor?.array.byteLength ?? 0); return bytes }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true; this.group.removeFromParent(); for (const grid of this.grids.values()) grid.mesh.dispose()
    this.grids.clear(); this.group.clear(); this.geometry.dispose(); this.material.dispose()
  }
}
