import type * as ThreeNamespace from 'three'
import { describeCinema2AnimationClips, type Cinema2AnimationClipInfo } from './Cinema2ThreeAnimation'

/**
 * What a loaded model carries beyond its picture: its names and hierarchy, per-mesh custom vertex attributes, morph targets, skins, materials,
 * animation clips and the glTF scene metadata (`extras`). Presets use it to find the parts they want to drive; the validation scene and the asset
 * tooling use it to prove an optimized file kept everything the original had.
 *
 * Three names glTF attributes it knows (`POSITION` to `position`, `TEXCOORD_0` to `uv`, `JOINTS_0` to `skinIndex`...) and lower-cases the rest, so an
 * authored `_GLOW_PHASE` attribute is `_glow_phase` on the loaded geometry.
 */
const STANDARD_ATTRIBUTES: ReadonlySet<string> = new Set(['position', 'normal', 'tangent', 'uv', 'uv1', 'uv2', 'uv3', 'color', 'skinindex', 'skinweight'])

export interface Cinema2ThreeMeshInfo {
  name: string
  triangles: number
  vertices: number
  materialNames: readonly string[]
  /** Vertex attributes that are not part of glTF's standard set (the project's `_GLOW_PHASE`, `_SEGMENT`, ...). */
  customAttributes: readonly string[]
  morphTargets: readonly string[]
  skinned: boolean
}

export interface Cinema2ThreeAssetMetadata {
  generator: string | null
  copyright: string | null
  extensionsUsed: readonly string[]
  /** glTF `scene.extras`. */
  extras: Readonly<Record<string, unknown>>
  nodeCount: number
  maxDepth: number
  /** Names of every named node (parts a preset can address). */
  nodeNames: readonly string[]
  meshes: readonly Readonly<Cinema2ThreeMeshInfo>[]
  materialNames: readonly string[]
  textureCount: number
  skinCount: number
  animations: readonly Readonly<Cinema2AnimationClipInfo>[]
}

export interface Cinema2ThreeGltfInfo {
  generator?: string
  copyright?: string
  extensionsUsed?: readonly string[]
}

export function describeCinema2LoadedModel(
  scene: ThreeNamespace.Object3D,
  animations: readonly ThreeNamespace.AnimationClip[] = [],
  gltf: Readonly<Cinema2ThreeGltfInfo> = {},
): Readonly<Cinema2ThreeAssetMetadata> {
  const nodeNames: string[] = []
  const meshes: Cinema2ThreeMeshInfo[] = []
  const materials = new Set<string>()
  const textures = new Set<ThreeNamespace.Texture>()
  const skeletons = new Set<ThreeNamespace.Skeleton>()
  let nodeCount = 0
  let maxDepth = 0

  const visit = (object: ThreeNamespace.Object3D, depth: number): void => {
    nodeCount += 1
    maxDepth = Math.max(maxDepth, depth)
    if (object.name) nodeNames.push(object.name)
    const mesh = object as ThreeNamespace.Mesh
    if (mesh.isMesh) {
      const geometry = mesh.geometry
      const vertices = geometry.attributes.position?.count ?? 0
      const triangles = (geometry.index ? geometry.index.count : vertices) / 3
      const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materialList) {
        if (material.name) materials.add(material.name)
        for (const value of Object.values(material)) if (value && (value as ThreeNamespace.Texture).isTexture) textures.add(value as ThreeNamespace.Texture)
      }
      const skinned = (mesh as ThreeNamespace.SkinnedMesh).isSkinnedMesh === true
      if (skinned) skeletons.add((mesh as ThreeNamespace.SkinnedMesh).skeleton)
      meshes.push(Object.freeze({
        name: mesh.name,
        triangles: Math.round(triangles),
        vertices,
        materialNames: Object.freeze(materialList.map(material => material.name)),
        customAttributes: Object.freeze(Object.keys(geometry.attributes).filter(name => !STANDARD_ATTRIBUTES.has(name.toLowerCase()))),
        morphTargets: Object.freeze(Object.keys(mesh.morphTargetDictionary ?? {})),
        skinned,
      }))
    }
    for (const child of object.children) visit(child, depth + 1)
  }
  visit(scene, 0)

  return Object.freeze({
    generator: gltf.generator ?? null,
    copyright: gltf.copyright ?? null,
    extensionsUsed: Object.freeze([...(gltf.extensionsUsed ?? [])]),
    extras: Object.freeze({ ...(scene.userData ?? {}) }),
    nodeCount,
    maxDepth,
    nodeNames: Object.freeze(nodeNames),
    meshes: Object.freeze(meshes),
    materialNames: Object.freeze([...materials]),
    textureCount: textures.size,
    skinCount: skeletons.size,
    animations: describeCinema2AnimationClips(animations),
  })
}
