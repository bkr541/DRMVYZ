import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from './Cinema2GlStateGuard'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from './Cinema2ThreeCameraLightMapping'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'
import type { Cinema2ThreeLoadedAsset } from './Cinema2ThreeAssetCache'
import { measureObject } from './Cinema2ThreeAssetCache'
import { getCinema2ThreeRenderer } from './Cinema2ThreeRendererHost'

/** Material overrides exposed as module parameters. `null` means "leave the asset's own value". */
export interface Cinema2ThreeMaterialOverrides {
  /** Multiplies the base color (linear factor from an sRGB color). */
  color: readonly [number, number, number] | null
  emissive: readonly [number, number, number] | null
  emissiveIntensity: number | null
  roughness: number | null
  metalness: number | null
  /** Strength of image-based lighting (0 disables reflections from the environment). */
  environmentIntensity: number
}

export const CINEMA2_THREE_DEFAULT_OVERRIDES: Readonly<Cinema2ThreeMaterialOverrides> = Object.freeze({
  color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, environmentIntensity: 0.5,
})

export interface Cinema2ThreeSceneInstance {
  asset: Cinema2ThreeLoadedAsset
  /** Scene Graph node that places this instance; when omitted the instance sits at the world origin. */
  node: string | null
}

interface PlacedInstance {
  node: string | null
  root: ThreeNamespace.Group
  materials: OwnedMaterial[]
}

interface OwnedMaterial {
  material: ThreeNamespace.MeshStandardMaterial
  base: {
    color: ThreeNamespace.Color
    emissive: ThreeNamespace.Color
    emissiveIntensity: number
    roughness: number
    metalness: number
    normalMap: ThreeNamespace.Texture | null
    aoMap: ThreeNamespace.Texture | null
  }
}

/** Three's XR-oriented hook for drawing into a framebuffer it did not create (present in the pinned 0.186; not in the type package). */
interface ExternalFramebufferRenderer {
  setRenderTargetFramebuffer(target: ThreeNamespace.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void
}

type WarmStage = 'environment' | 'textures' | 'compile' | 'ready'

/**
 * Everything one `three-scene` module owns on the GPU side: a Three scene of its instances, the light rig, the camera, and the
 * draw into the engine's framebuffer. The Three renderer itself is shared per context (see Cinema2ThreeRendererHost).
 *
 * Draw path (validated in the #5 spike): Three renders straight into the engine framebuffer through a render target that
 * wraps it, so colour and depth land where the floor, volumetric and bloom passes read them, with no copy. Every entry into
 * Three is wrapped by the GL state guard.
 */
export class Cinema2ThreeSceneBridge {
  private readonly renderer: ThreeNamespace.WebGLRenderer
  private readonly getEnvironment: () => ThreeNamespace.Texture
  private readonly scene: ThreeNamespace.Scene
  private readonly camera: ThreeNamespace.PerspectiveCamera
  private readonly target: ThreeNamespace.WebGLRenderTarget
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly placed: PlacedInstance[] = []
  private readonly pendingTextures: ThreeNamespace.Texture[] = []
  private readonly guard: Cinema2GlStateGuard
  private stage: WarmStage = 'environment'
  private compiling = false
  private quality: Cinema2RenderQualityLevel | null = null
  private appliedOverrides: Readonly<Cinema2ThreeMaterialOverrides> | null = null
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly library: Cinema2ThreeLibrary,
    instances: readonly Readonly<Cinema2ThreeSceneInstance>[],
  ) {
    const { THREE } = library
    const host = getCinema2ThreeRenderer(library, gl)
    this.renderer = host.renderer
    this.getEnvironment = host.getEnvironment
    this.guard = new Cinema2GlStateGuard(gl)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera()
    this.lightRig = new Cinema2ThreeLightRig(THREE, this.scene)
    // A render target that only points at the engine's framebuffer: Three allocates nothing for it. Flagged like an XR target
    // so Three encodes display-referred sRGB itself (the engine's targets are plain RGBA8 with no hardware sRGB write).
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    ;(this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
    this.target.texture.colorSpace = THREE.SRGBColorSpace

    for (const instance of instances) {
      const root = new THREE.Group()
      root.matrixAutoUpdate = false
      const model = instance.asset.scene.clone(true)
      const materials: OwnedMaterial[] = []
      model.traverse(object => {
        const mesh = object as ThreeNamespace.Mesh
        if (!mesh.isMesh) return
        // Per-instance material clones so overrides never touch the shared asset; textures and geometry stay shared.
        const cloned = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => {
          const standard = material.clone() as ThreeNamespace.MeshStandardMaterial
          if ((standard as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) {
            materials.push({
              material: standard,
              base: {
                color: standard.color.clone(), emissive: standard.emissive.clone(), emissiveIntensity: standard.emissiveIntensity,
                roughness: standard.roughness, metalness: standard.metalness, normalMap: standard.normalMap, aoMap: standard.aoMap,
              },
            })
          }
          return standard
        })
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!
      })
      root.add(model)
      this.scene.add(root)
      this.placed.push({ node: instance.node, root, materials })
    }
  }

  /** True once the shaders are compiled and the textures uploaded; until then `draw` prepares one step per frame and draws nothing. */
  get ready(): boolean {
    return this.stage === 'ready'
  }

  /** GPU byte estimate for everything this bridge keeps alive (used for the engine's memory budget). */
  estimateGpuBytes(): number {
    // Instances share geometry and textures, so measure them together (each shared resource counts once).
    let bytes = measureObject(this.placed.map(placed => placed.root)).bytes
    if (this.appliedEnvironment()) bytes += 256 * 256 * 6 * 8 * 1.34
    return Math.round(bytes)
  }

  draw(exec: Cinema2ModuleRenderExecutionContext, overrides: Readonly<Cinema2ThreeMaterialOverrides>): void {
    if (this.disposed) return
    if (!exec.depthAvailable) throw new Error('Cinema 2.0 Three scene module requires a render target with a depth attachment.')
    const camera = exec.camera
    const lighting = exec.lightingEnvironment
    if (!camera || !lighting) throw new Error('Cinema 2.0 Three scene module requires final Camera and Lighting state.')

    this.guard.capture()
    const { renderer } = this
    try {
      renderer.resetState()
      this.applyQuality(lighting.quality)
      this.applyOverrides(overrides)
      this.place(exec)
      applyCinema2CameraFrame(this.camera, camera)
      this.lightRig.update(lighting)
      if (this.stage !== 'ready') {
        this.warmUp()
        return
      }
      ;(renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target, exec.target as WebGLFramebuffer)
      this.target.viewport.set(0, 0, exec.width, exec.height)
      this.target.scissor.set(0, 0, exec.width, exec.height)
      renderer.setRenderTarget(this.target)
      renderer.render(this.scene, this.camera)
      renderer.setRenderTarget(null)
    } finally {
      renderer.resetState()
      this.guard.restore()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const { root, materials } of this.placed) {
      this.scene.remove(root)
      for (const { material } of materials) material.dispose()
    }
    this.placed.length = 0
    this.pendingTextures.length = 0
    // Geometry and textures belong to the shared asset (freed when its last holder releases it); the renderer belongs to the context.
    this.target.dispose()
  }

  private appliedEnvironment(): boolean {
    return this.scene.environment != null
  }

  private place(exec: Cinema2ModuleRenderExecutionContext): void {
    const nodes = exec.spatialNodes ?? []
    for (const placed of this.placed) {
      const node = placed.node ? nodes.find(candidate => candidate.id === placed.node) : null
      if (placed.node && !node) { placed.root.visible = false; continue }
      placed.root.visible = node ? node.visible : true
      if (node) placed.root.matrix.fromArray(node.worldMatrix as unknown as number[])
      else placed.root.matrix.identity()
      placed.root.matrixWorldNeedsUpdate = true
    }
  }

  /**
   * Quality tiers. low: no normal or ambient-occlusion maps (cheaper shaders, less texture bandwidth); medium and high: the full map
   * set. Image-based lighting stays on for every tier: metal without an environment renders almost black, and the environment
   * lookup is a small part of the shader cost. (Per-tier model and texture variants come from the asset registry.)
   */
  private applyQuality(quality: Cinema2RenderQualityLevel): void {
    if (quality === this.quality) return
    this.quality = quality
    const detailed = quality !== 'low'
    for (const { materials } of this.placed) {
      for (const { material, base } of materials) {
        material.normalMap = detailed ? base.normalMap : null
        material.aoMap = detailed ? base.aoMap : null
        material.needsUpdate = true
      }
    }
  }

  private applyOverrides(overrides: Readonly<Cinema2ThreeMaterialOverrides>): void {
    if (this.appliedOverrides && sameOverrides(this.appliedOverrides, overrides)) return
    this.appliedOverrides = overrides
    const { THREE } = this.library
    const tint = overrides.color ? new THREE.Color().setRGB(overrides.color[0], overrides.color[1], overrides.color[2], THREE.SRGBColorSpace) : null
    const emissive = overrides.emissive ? new THREE.Color().setRGB(overrides.emissive[0], overrides.emissive[1], overrides.emissive[2], THREE.SRGBColorSpace) : null
    for (const { materials } of this.placed) {
      for (const { material, base } of materials) {
        material.color.copy(base.color)
        if (tint) material.color.multiply(tint)
        material.emissive.copy(emissive ?? base.emissive)
        material.emissiveIntensity = overrides.emissiveIntensity ?? base.emissiveIntensity
        material.roughness = overrides.roughness ?? base.roughness
        material.metalness = overrides.metalness ?? base.metalness
      }
    }
    this.scene.environmentIntensity = overrides.environmentIntensity
  }

  /** One preparation step per frame so the first visible frame does not hitch: environment, textures (one each), shader compile. */
  private warmUp(): void {
    const { renderer } = this
    if (this.stage === 'environment') {
      this.scene.environment = this.getEnvironment()
      // Upload only textures the current tier actually samples (low drops normal and ambient-occlusion maps).
      const textures = new Set<ThreeNamespace.Texture>()
      for (const { materials } of this.placed) {
        for (const { material } of materials) {
          for (const value of Object.values(material)) if (value && (value as ThreeNamespace.Texture).isTexture) textures.add(value as ThreeNamespace.Texture)
        }
      }
      this.pendingTextures.push(...textures)
      this.stage = 'textures'
      return
    }
    if (this.stage === 'textures') {
      const texture = this.pendingTextures.pop()
      if (texture) { renderer.initTexture(texture); return }
      this.stage = 'compile'
    }
    if (this.stage === 'compile' && !this.compiling) {
      this.compiling = true
      renderer.compileAsync(this.scene, this.camera).then(
        () => { this.compiling = false; if (!this.disposed) this.stage = 'ready' },
        () => { this.compiling = false; if (!this.disposed) this.stage = 'ready' },
      )
    }
  }
}

function sameOverrides(a: Readonly<Cinema2ThreeMaterialOverrides>, b: Readonly<Cinema2ThreeMaterialOverrides>): boolean {
  const same = (x: readonly number[] | null, y: readonly number[] | null) => x === y || (x != null && y != null && x.length === y.length && x.every((value, index) => value === y[index]))
  return same(a.color, b.color) && same(a.emissive, b.emissive)
    && a.emissiveIntensity === b.emissiveIntensity && a.roughness === b.roughness && a.metalness === b.metalness
    && a.environmentIntensity === b.environmentIntensity
}
