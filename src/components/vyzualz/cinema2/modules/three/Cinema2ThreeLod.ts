import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import { cinema2RenderQualityProfile } from '../../render/Cinema2RenderQualityProfiles'

/**
 * Level-of-detail support for future models, built on `THREE.LOD`.
 *
 * A model that ships several versions of itself (an asset's `high` / `medium` / `low` files, or LOD meshes authored in Blender) is assembled into
 * one `LOD` object whose levels switch by distance from the camera. The quality tier moves the switch distances (`modelDetail.lodDistanceScale`:
 * low switches to coarser meshes sooner, high holds detail longer) and decides how many of the finest levels are available at all
 * (`modelDetail.preferredLevel`). No existing preset has a LOD; nothing here is applied automatically.
 */
export type Cinema2ThreeNamespace = typeof ThreeNamespace

export interface Cinema2LodLevel {
  /** The object shown at this level. Levels share geometry/materials/textures with their asset; the LOD does not own them. */
  object: ThreeNamespace.Object3D
  /** Camera distance (world units, before tier scaling) from which this level is shown. The first (finest) level should use 0. */
  distance: number
}

export interface Cinema2LodOptions {
  tier?: Cinema2RenderQualityLevel
  /** Fraction of a switch distance used as a dead band so a level does not flicker at the boundary. */
  hysteresis?: number
  name?: string
}

/** How many of the finest levels a tier drops: `optimized` the finer half, `balanced` the single finest (with 3+ levels), `detailed` none. */
export function cinema2LodSkippedLevels(levelCount: number, tier: Cinema2RenderQualityLevel): number {
  if (levelCount <= 1) return 0
  const preferred = cinema2RenderQualityProfile(tier).modelDetail.preferredLevel
  const skip = preferred === 'optimized' ? Math.floor(levelCount / 2) : preferred === 'balanced' ? (levelCount >= 3 ? 1 : 0) : 0
  return Math.min(skip, levelCount - 1)
}

/** Builds a `LOD` from levels (sorted by distance), applying the tier's detail cap and distance scale. Levels dropped by the tier are not added. */
export function createCinema2Lod(THREE: Cinema2ThreeNamespace, levels: readonly Readonly<Cinema2LodLevel>[], options: Readonly<Cinema2LodOptions> = {}): ThreeNamespace.LOD {
  if (levels.length === 0) throw new Error('Cinema 2.0 LOD needs at least one level.')
  const tier = options.tier ?? 'high'
  const sorted = [...levels].sort((a, b) => a.distance - b.distance)
  const skip = cinema2LodSkippedLevels(sorted.length, tier)
  const scale = cinema2RenderQualityProfile(tier).modelDetail.lodDistanceScale
  const lod = new THREE.LOD()
  lod.name = options.name ?? 'cinema2-lod'
  sorted.slice(skip).forEach((level, index) => {
    // The finest remaining level always starts at the camera, whatever the dropped levels' distances were.
    const distance = index === 0 ? 0 : level.distance * scale
    lod.addLevel(level.object, distance, options.hysteresis ?? 0.05)
  })
  return lod
}

/** Which level index a `LOD` is currently showing (0 = finest of the levels it was built with). */
export function activeCinema2LodLevel(lod: ThreeNamespace.LOD): number {
  const index = lod.getCurrentLevel()
  return index
}

/**
 * Switch distances for an asset's quality variants, from the model's bounding radius: the finest variant fills the view up close, the coarsest takes
 * over beyond `radius * 14`. A convenience for presets that have no better distances of their own.
 */
export function defaultCinema2LodDistances(boundingRadius: number, levelCount: number): number[] {
  if (levelCount <= 1) return [0]
  return Array.from({ length: levelCount }, (_, index) => (index === 0 ? 0 : boundingRadius * 14 * (index / (levelCount - 1)) ** 1.5))
}
