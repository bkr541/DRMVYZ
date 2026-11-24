import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import { prepareCinema2UserModel, type Cinema2PreparedUserModel } from './Cinema2UserModelPreparation'
import { cinema2GrainSeed } from './Cinema2UserModelFormDust'
import { buildCinema2UserModelSlices, type Cinema2SlicedUserModel } from './Cinema2UserModelSlices'

export const CINEMA2_SHATTER_LIMITS = Object.freeze({ fragments: 192, bytes: 64 * 1024 * 1024, triangles: 400_000, drawGroups: 1024 })
/** Three bounded, differently oriented partitions produce real model pieces with closed cut faces. No substitute primitives. */
export class Cinema2ShatteredUserModel {
  readonly group: Three.Group
  readonly fragments: Three.Group[] = []
  readonly centers: Three.Vector3[] = []
  readonly materials: Three.Material[] = []
  readonly debris: boolean[] = []
  limited = false
  private owned: Cinema2SlicedUserModel[] = []
  bytes = 0
  triangles = 0
  openContours = 0
  private disposed = false
  constructor(T: Cinema2ThreeLibrary['THREE']) { this.group = new T.Group(); this.group.name = 'ActualModelFragments' }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true; this.group.removeFromParent()
    for (const cut of this.owned) cut.dispose()
    this.owned = []; this.group.clear(); this.fragments.length = 0; this.centers.length = 0; this.materials.length = 0; this.debris.length = 0
  }
  static build(library: Cinema2ThreeLibrary, root: Three.Object3D, prepared: Cinema2PreparedUserModel, meshes: readonly Three.Mesh[], detail = 24): Cinema2ShatteredUserModel {
    const T = library.THREE, result = new Cinema2ShatteredUserModel(T), rest = new T.Group()
    root.updateWorldMatrix(true, true)
    const inverse = root.matrixWorld.clone().invert(), center = new T.Matrix4().makeTranslation(-prepared.center.x, -prepared.center.y, -prepared.center.z)
    for (const mesh of meshes) { const clone = new T.Mesh(mesh.geometry, mesh.material); clone.matrixAutoUpdate = false; clone.matrix.multiplyMatrices(center, new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)); rest.add(clone) }
    let regions: { group: Three.Group; owner?: Cinema2SlicedUserModel }[] = [{ group: rest }]
    try {
      const stages = detail <= 4 ? [4] : detail <= 12 ? [4, 3] : detail <= 24 ? [4, 3, 2] : detail <= 48 ? [4, 4, 3] : detail <= 96 ? [4, 4, 3, 2] : [4, 4, 4, 3]
      for (const [stage, count] of stages.entries()) {
        const next: typeof regions = [], owners: Cinema2SlicedUserModel[] = []
        try {
          for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
            const region = regions[regionIndex], work = new T.Group(), axes = new T.Group()
            if (stage === 0) axes.rotation.z = Math.PI / 2
            if (stage === 1) axes.rotation.z = (regionIndex % 2 ? 1 : -1) * .16
            if (stage === 2) axes.rotation.x = Math.PI / 2
            if (detail > 24 && stage > 0) {
              axes.rotation.z += (cinema2GrainSeed(regionIndex + stage * 193) - .5) * .5
              axes.rotation.y += (cinema2GrainSeed(regionIndex + stage * 397) - .5) * .6
              if (stage === 3) axes.rotation.x = .6 + cinema2GrainSeed(regionIndex + 123) * .8
            }
            work.add(axes); region.group.updateWorldMatrix(true, true)
            region.group.traverse(object => { const mesh = object as Three.Mesh; if (!mesh.isMesh) return; const copy = new T.Mesh(mesh.geometry, mesh.material); copy.matrixAutoUpdate = false; copy.matrix.copy(mesh.matrixWorld); axes.add(copy) })
            const stagePrepared = prepareCinema2UserModel(library, work, 1), sourceMeshes: Three.Mesh[] = []
            work.traverse(object => { if ((object as Three.Mesh).isMesh) sourceMeshes.push(object as Three.Mesh) })
            let cut: Cinema2SlicedUserModel
            try { cut = buildCinema2UserModelSlices(library, stagePrepared, sourceMeshes, count, 'y', detail > 24 ? .38 : 0, regionIndex + stage * 197) } finally { stagePrepared.dispose() }
            owners.push(cut)
            if (owners.reduce((sum, item) => sum + item.byteLength, 0) > CINEMA2_SHATTER_LIMITS.bytes || owners.reduce((sum, item) => sum + item.triangleCount, 0) > CINEMA2_SHATTER_LIMITS.triangles) throw new Error('Fracture stage exceeds geometry budget.')
            const undo = axes.quaternion.clone().invert(), offset = stagePrepared.center.clone().applyQuaternion(undo)
            for (const mesh of cut.meshes) {
              const group = new T.Group(); group.quaternion.copy(undo); group.position.copy(offset); group.add(mesh); next.push({ group, owner: cut })
            }
          }
          const bytes = owners.reduce((n, cut) => n + cut.byteLength, 0), triangles = owners.reduce((n, cut) => n + cut.triangleCount, 0)
          const drawGroups = owners.reduce((n, cut) => n + cut.meshes.reduce((sum, mesh) => sum + mesh.geometry.groups.length, 0), 0)
          if (next.length > CINEMA2_SHATTER_LIMITS.fragments || bytes > CINEMA2_SHATTER_LIMITS.bytes || triangles > CINEMA2_SHATTER_LIMITS.triangles || drawGroups > CINEMA2_SHATTER_LIMITS.drawGroups) throw new Error('Model fracture exceeds its bounded geometry budget. The original model is kept visible.')
        } catch (error) {
          for (const owner of owners) owner.dispose()
          if (!result.owned.length) throw error
          result.limited = true; break
        }
        for (const owner of new Set(regions.flatMap(region => region.owner ? [region.owner] : []))) owner.dispose()
        regions = next; result.owned = owners
      }
      const volumes: number[] = []
      for (const { group } of regions) {
        group.updateWorldMatrix(true, true)
        const box = new T.Box3().setFromObject(group), center = box.getCenter(new T.Vector3()), pivot = new T.Group()
        const size = box.getSize(new T.Vector3()); volumes.push(size.x * size.y * size.z)
        pivot.position.copy(center); group.position.sub(center); pivot.add(group); result.group.add(pivot)
        result.fragments.push(pivot); result.centers.push(center)
      }
      const cutoff = [...volumes].sort((a, b) => a - b)[Math.floor(volumes.length * .25)] ?? 0
      for (const volume of volumes) result.debris.push(volume <= cutoff && detail > 24)
      for (const owner of result.owned) { result.materials.push(...owner.materials); result.bytes += owner.byteLength; result.triangles += owner.triangleCount; result.openContours += owner.openContours }
      return result
    } catch (error) { result.dispose(); throw error }
  }
}

export function animateCinema2Shatter(model: Cinema2ShatteredUserModel, pattern: number, phase: number, spread: number, extent: number, movement: number, reaction: number, motion = 1, debris = .35, impulse = 0): void {
  const amount = spread * (.35 + movement) * (1 + reaction * .12)
  for (let i = 0; i < model.fragments.length; i++) {
    const fragment = model.fragments[i], center = model.centers[i], x = center.x / extent, y = center.y / extent, z = center.z / extent
    fragment.position.copy(center); fragment.rotation.set(0, 0, 0); fragment.scale.setScalar(1)
    let dx = x * .65, dy = y * .65, dz = z * .65
    if (pattern === 1) { dx = (x < 0 ? -1 : 1) * .32; dy = Math.sin(i * .7 + phase) * .05 }
    if (pattern === 2) { dx = x * .3; dy = .16 + (x * x + z * z) * .9; dz = z * .3 }
    if (pattern === 3) { dx = Math.cos(i * 2.399 + phase * .3) * .25; dy = Math.sin(i * 2.399 + phase * .3) * .25; dz = Math.sin(i * .7) * .16 }
    if (pattern === 4) { dx = Math.sin(y * 7 + phase) * .22; dy = y * .25; dz = Math.cos(x * 7 + phase) * .25 }
    if (pattern === 5) { dx = -x * .18; dy = y * .28; dz = (i % 2 ? 1 : -1) * .16 }
    const seed = cinema2GrainSeed(i), jitter = .65 + seed * .85, chip = model.debris[i] ? 1 + debris * 1.7 : 1
    const travel = amount * jitter * chip
    fragment.position.x += dx * extent * travel; fragment.position.y += dy * extent * travel; fragment.position.z += dz * extent * travel
    // The pulse is a continuous bounded radial offset, independent of the chosen movement path.
    const burst = Math.max(0, Math.min(1, impulse)) * extent * .25 * jitter
    const radial = Math.max(.12, Math.hypot(x, y, z))
    fragment.position.x += x / radial * burst; fragment.position.y += y / radial * burst; fragment.position.z += z / radial * burst
    const spin = amount * motion * (1.15 + seed * 2) * chip
    fragment.rotation.set(Math.sin(i * .7 + phase * .15) * spin, Math.cos(i * .4 + phase * .1) * spin, Math.sin(i + phase * .12) * spin)
    if (model.debris[i]) fragment.scale.setScalar(1 - spread * (1 - debris) * .85)
  }
}
