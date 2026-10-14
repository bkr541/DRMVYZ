/**
 * DEVELOPER-ONLY rendering validation scene for the Cinema 2.0 engine upgrade. It is a technical fixture, not a preset: it is not registered in
 * any preset registry, is not reachable from the app, and lives under src/test so it cannot ship.
 *
 * It lays out simple reference objects that each exercise one new capability:
 *   polished chrome sphere ........ environment reflections (HDR / EXR profiles)
 *   anisotropic rough knot ........ rough metal, anisotropy, shadow casting
 *   glass sphere .................. transmission / IOR / thickness (material kit)
 *   textured sphere ............... normal map, metallic-roughness map, clearcoat; loaded from plain / Meshopt / Draco / KTX2 GLBs
 *   recessed block ................ ambient occlusion (crevices, bolts, joints)
 *   diagonal bars ................. anti-aliasing (fine geometry, bright emissive edges)
 *   shadow floor .................. soft shadow filtering by tier
 *   instanced bolts ............... InstancedMesh batch (one draw call)
 *   LOD spheres ................... THREE.LOD with tier-scaled distances
 *   animated model ................ rotating part, morph target and skinned strip from a GLB, driven by the timeline
 */
import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest'
import { Cinema2ThreeAnimationController, cloneCinema2AssetScene } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAnimation'
import type { Cinema2ThreeLoadedAsset } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetCache'
import { Cinema2InstancedBatch, cinema2RingLayout } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeInstancing'
import { createCinema2Lod } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeLod'
import { buildCinema2LightingRig, type Cinema2LightingRigInstance } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeLightingRigs'
import { applyCinema2MaterialProfile } from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeMaterialKit'
import {
  applyCinema2ShadowToLight,
  fitCinema2DirectionalShadow,
  resolveCinema2ShadowProfile,
  setCinema2ShadowParticipation,
} from '../../components/vyzualz/cinema2/modules/three/Cinema2ThreeShadowProfiles'

export type ValidationModelKind = 'plain' | 'meshopt' | 'draco' | 'ktx2'

export interface ValidationSceneInputs {
  THREE: typeof ThreeNamespace
  tier: Cinema2RenderQualityLevel
  maxAnisotropy: number
  models: Readonly<Record<ValidationModelKind | 'animated', Cinema2ThreeLoadedAsset>>
}

export interface ValidationScene {
  scene: ThreeNamespace.Scene
  camera: ThreeNamespace.PerspectiveCamera
  rig: Cinema2LightingRigInstance
  keyLight: ThreeNamespace.DirectionalLight
  /** The textured-model slot; swap its content with `setTexturedModel`. */
  setTexturedModel(kind: ValidationModelKind): Promise<void>
  texturedModel(): ValidationModelKind
  setShadows(enabled: boolean): void
  update(timeSec: number): void
  lodLevelAt(distance: number): number
  stats(): Readonly<Record<string, unknown>>
  dispose(): void
}

export const VALIDATION_ASPECT = 16 / 9

export async function buildValidationScene(inputs: ValidationSceneInputs): Promise<ValidationScene> {
  const { THREE, tier, maxAnisotropy, models } = inputs
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x04060a)

  const camera = new THREE.PerspectiveCamera(34, VALIDATION_ASPECT, 0.1, 80)
  camera.position.set(0, 5.0, 14)
  camera.lookAt(0, 0.5, 0)
  camera.updateMatrixWorld(true)

  const owned: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(resource: T): T => { owned.push(resource); return resource }

  // ---- lighting: the studio three-point rig, key light casting
  const rig = buildCinema2LightingRig(THREE, 'three-point', { center: [0, 1, 0], scale: 1.6, shadows: { tier } })
  scene.add(rig.group)
  const keyLight = rig.lights.key as ThreeNamespace.DirectionalLight
  applyCinema2ShadowToLight(keyLight, resolveCinema2ShadowProfile(tier, { cameraFar: 40 }))
  keyLight.castShadow = false

  // ---- floor (glossy, receives shadows)
  const floorMaterial = track(new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.3, metalness: 0 }))
  applyCinema2MaterialProfile(THREE, floorMaterial, { roughness: 0.3 })
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 16)), floorMaterial)
  floor.name = 'shadowFloor'
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const addMesh = (name: string, geometry: ThreeNamespace.BufferGeometry, material: ThreeNamespace.Material, x: number, y: number, z: number): ThreeNamespace.Mesh => {
    const mesh = new THREE.Mesh(track(geometry), material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  }

  // ---- polished chrome sphere
  addMesh('chromeSphere', new THREE.SphereGeometry(0.85, 64, 32), track(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.03 })), -4.0, 0.85, 0.3)

  // ---- rough anisotropic knot
  const knotMaterial = track(new THREE.MeshStandardMaterial({ color: 0xb08a5a, metalness: 1, roughness: 0.45 }))
  const knot = applyCinema2MaterialProfile(THREE, knotMaterial, { anisotropy: 0.8, anisotropyRotation: 0.6 }, { features: undefined })
  track(knot.material)
  addMesh('roughKnot', new THREE.TorusKnotGeometry(0.55, 0.19, 160, 24), knot.material, -2.3, 1.0, 0.1)

  // ---- glass sphere
  const glass = applyCinema2MaterialProfile(THREE, track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0 })), { transmission: 1, ior: 1.5, thickness: 0.7, attenuationColor: 0xcfeaff, attenuationDistance: 3 })
  track(glass.material)
  addMesh('glassSphere', new THREE.SphereGeometry(0.75, 48, 24), glass.material, -0.4, 0.75, 0.6)

  // ---- textured model slot (normal map, metallic-roughness map, clearcoat)
  const modelSlot = new THREE.Group()
  modelSlot.name = 'texturedModelSlot'
  modelSlot.position.set(1.6, 0.55, 0.3)
  scene.add(modelSlot)
  let currentModel: ValidationModelKind = 'plain'
  const textureReports: Record<string, unknown>[] = []
  const setTexturedModel = async (kind: ValidationModelKind): Promise<void> => {
    modelSlot.clear()
    const clone = await cloneCinema2AssetScene(models[kind].scene)
    setCinema2ShadowParticipation(clone, { cast: true, receive: true })
    clone.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (!mesh.isMesh) return
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        for (const value of Object.values(material)) {
          const texture = value as ThreeNamespace.Texture
          if (texture?.isTexture) texture.anisotropy = Math.min(maxAnisotropy, 8)
        }
      }
    })
    modelSlot.add(clone)
    currentModel = kind
    textureReports.length = 0
    clone.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as ThreeNamespace.MeshStandardMaterial
      for (const slot of ['map', 'normalMap', 'metalnessMap'] as const) {
        const texture = material[slot]
        if (texture) textureReports.push({ slot, compressed: (texture as ThreeNamespace.CompressedTexture).isCompressedTexture === true, format: texture.format, colorSpace: texture.colorSpace, mipmaps: (texture as ThreeNamespace.CompressedTexture).mipmaps?.length ?? 0 })
      }
    })
  }
  await setTexturedModel('plain')

  // ---- recessed block for ambient occlusion: a plate with a raised frame, deep pockets and bolts
  const block = new THREE.Group()
  block.name = 'recessedBlock'
  block.position.set(3.7, 0, 0.2)
  const metal = track(new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.85, roughness: 0.35 }))
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x555d66, metalness: 0.8, roughness: 0.5 }))
  const slab = new THREE.Mesh(track(new THREE.BoxGeometry(2.0, 0.22, 2.0)), metal)
  slab.position.y = 0.11
  block.add(slab)
  // A grid of tall pillars with 4 cm gaps: tight crevices at every depth.
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const pillar = new THREE.Mesh(track(new THREE.BoxGeometry(0.58, 0.55 + 0.1 * ((row + column) % 3), 0.58)), dark)
      pillar.position.set((column - 1) * 0.62, 0.22 + 0.275, (row - 1) * 0.62)
      block.add(pillar)
    }
  }
  const boltGeometry = track(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16))
  for (const [x, z] of [[-0.92, -0.92], [0.92, -0.92], [-0.92, 0.92], [0.92, 0.92]] as const) {
    const bolt = new THREE.Mesh(boltGeometry, metal)
    bolt.position.set(x, 0.245, z)
    block.add(bolt)
  }
  block.traverse(object => { const mesh = object as ThreeNamespace.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true } })
  scene.add(block)

  // ---- fine diagonal bars (bright emissive lines on a dark panel) for anti-aliasing
  const panel = new THREE.Group()
  panel.name = 'diagonalPanel'
  panel.position.set(6.1, 1.25, 0)
  const panelBase = new THREE.Mesh(track(new THREE.BoxGeometry(1.8, 2.2, 0.06)), track(new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.6, metalness: 0.2 })))
  panel.add(panelBase)
  const barMaterial = track(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2d6, emissiveIntensity: 3.2 }))
  const barGeometry = track(new THREE.BoxGeometry(0.012, 2.4, 0.02))
  for (let index = 0; index < 9; index += 1) {
    const bar = new THREE.Mesh(barGeometry, barMaterial)
    bar.position.set(-0.7 + index * 0.175, 0, 0.045)
    bar.rotation.z = 0.35 + index * 0.05
    bar.scale.y = 0.62
    panel.add(bar)
  }
  panel.rotation.y = -0.32
  scene.add(panel)

  // ---- instanced bolts: one draw call for 96 objects
  const instanceMaterial = track(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.3 }))
  const batch = new Cinema2InstancedBatch(THREE, track(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12)), instanceMaterial, 128, { name: 'instancedBolts', perInstanceColor: true, castShadow: true, receiveShadow: true })
  batch.setAll(cinema2RingLayout(96, 4.8, { y: 0.08 }).map((transform, index) => ({ ...transform, scale: 0.8 + (index % 4) * 0.12, color: index % 3 === 0 ? 0xffa45c : index % 3 === 1 ? 0xb8c4d6 : 0x7fb0ff })))
  batch.mesh.position.set(0, 0, -0.6)
  scene.add(batch.mesh)
  owned.push(batch)

  // ---- LOD: three tessellations of one sphere, switching with camera distance
  const lodMaterial = track(new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.2, roughness: 0.35, flatShading: true }))
  const lodLevels = [48, 14, 6].map((segments, index) => ({ object: new THREE.Mesh(track(new THREE.SphereGeometry(0.4, segments, Math.max(4, segments / 2))), lodMaterial), distance: [0, 14, 22][index]! }))
  const lod = createCinema2Lod(THREE, lodLevels, { tier, name: 'lodSphere' })
  lod.position.set(-7.0, 0.4, 1.4)
  scene.add(lod)

  // ---- animated model
  const animatedRoot = await cloneCinema2AssetScene(models.animated.scene)
  animatedRoot.position.set(-5.6, 0.4, -2.2)
  setCinema2ShadowParticipation(animatedRoot, { cast: true, receive: true })
  scene.add(animatedRoot)
  const controller = new Cinema2ThreeAnimationController(THREE, animatedRoot, models.animated.animations)
  for (const name of controller.clipNames) controller.play(name, { loop: 'repeat' })

  const bounds = new THREE.Box3(new THREE.Vector3(-8, 0, -5), new THREE.Vector3(8, 3, 4))
  const setShadows = (enabled: boolean): void => {
    keyLight.castShadow = enabled
    if (enabled) fitCinema2DirectionalShadow(THREE, keyLight, bounds)
  }

  const lodCamera = new THREE.PerspectiveCamera()
  return {
    scene,
    camera,
    rig,
    keyLight,
    setTexturedModel,
    texturedModel: () => currentModel,
    setShadows,
    update(timeSec) {
      controller.sync(timeSec)
      scene.updateMatrixWorld(true)
    },
    lodLevelAt(distance) {
      lodCamera.position.set(lod.position.x, lod.position.y, lod.position.z + distance)
      lodCamera.updateMatrixWorld(true)
      lod.update(lodCamera)
      return lod.getCurrentLevel()
    },
    stats: () => ({
      instanced: batch.getStats(),
      textures: [...textureReports],
      animatedClips: controller.clipNames,
      lodLevels: lod.levels.length,
      meshCount: (() => { let count = 0; scene.traverse(object => { if ((object as ThreeNamespace.Mesh).isMesh) count += 1 }); return count })(),
    }),
    dispose() {
      controller.dispose()
      rig.dispose()
      scene.clear()
      for (const resource of owned) resource.dispose()
    },
  }
}
