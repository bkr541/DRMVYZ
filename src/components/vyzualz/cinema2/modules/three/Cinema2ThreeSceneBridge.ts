import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from './Cinema2GlStateGuard'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from './Cinema2ThreeCameraLightMapping'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'
import { CINEMA2_THREE_GLOW_WAVE_COUNT, type Cinema2ThreeGlowFrame } from './Cinema2ThreeAudioGlow'
import type { Cinema2ThreeLoadedAsset } from './Cinema2ThreeAssetCache'
import { measureObject } from './Cinema2ThreeAssetCache'
import { getCinema2ThreeRenderer } from './Cinema2ThreeRendererHost'

/** The material properties one named part of a model can override on its own (a part is a mesh of the asset: `outline`, `crystal`). */
export interface Cinema2ThreePartOverrides {
  color: readonly [number, number, number] | null
  emissive: readonly [number, number, number] | null
  emissiveIntensity: number | null
  roughness: number | null
  metalness: number | null
  clearcoat: number | null
  clearcoatRoughness: number | null
  /** Thin-film iridescence (pearl, soap film, the production crystal's pastel sheen): 0-1. Any number upgrades the materials to physical ones. */
  iridescence: number | null
  /** Refractive index of the film: 1-2.333. */
  iridescenceIOR: number | null
  /** Film thickness in nanometres across the surface, thinnest to thickest: it decides which hues the facets pick up. */
  iridescenceThicknessMin: number | null
  iridescenceThicknessMax: number | null
  /** See-through glass (0-1): the part refracts what is behind it. Upgrades to physical materials; off on the low tier (it costs a second scene render). */
  transmission: number | null
  /** Index of refraction of the part (1-2.333; diamond is ~2.4, glass ~1.5). */
  ior: number | null
  /** How thick the glass reads for refraction, in world units. */
  thickness: number | null
  /** Rainbow splitting of light through the glass (0 = none, a few = cut crystal). */
  dispersion: number | null
  /** This part's share of the environment reflections and fill (multiplies the module's `environmentIntensity`): dark bark wants little, cut crystal a lot. */
  environmentIntensity: number | null
}

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
  /** Clear lacquer layer (glossy skull, alien shell): 0-1. `null` leaves the asset alone; any number upgrades its materials to physical ones. */
  clearcoat: number | null
  clearcoatRoughness: number | null
  /** Turns the environment about the vertical axis, in degrees, so its softboxes move across glossy surfaces. */
  environmentRotation: number
  /** Multiplies every configured panel light's intensity (choreography drives this to make LED panels pulse). */
  panelIntensity: number
  /** Per-part overrides keyed by part (mesh) name. For a part they replace the global value of the same property, so one model can carry different looks (gold rim, crystal body). */
  parts: Readonly<Record<string, Readonly<Cinema2ThreePartOverrides>>>
}

/** A rectangular emitter (an LED panel) that lights the Three models: `config.panels` of the `three-scene` module. */
export interface Cinema2ThreePanelSpec {
  position: readonly [number, number, number]
  /** World point the panel faces. */
  target: readonly [number, number, number]
  width: number
  height: number
  /** sRGB color. */
  color: readonly [number, number, number]
  intensity: number
}

export interface Cinema2ThreeSceneOptions {
  panels?: readonly Cinema2ThreePanelSpec[]
  /** The loaded `RectAreaLightUniformsLib` (required when `panels` is non-empty; the module fetches it only in that case). */
  areaLightTables?: { init(): void } | null
  /** Resolves the shipped environment file for a quality tier; null (or a failed load) falls back to the built-in studio room. */
  environmentUrl?: ((quality: Cinema2RenderQualityLevel) => string | null) | null
  /** Parts that glow with the music (`config.glow`), each with its own share of the glow (1 = full). */
  glow?: Readonly<Record<string, number>>
  /** Parts that cast and receive shadows from spot lights flagged `threeShadow` (`config.shadows`); none by default. */
  shadows?: Readonly<{ cast: readonly string[]; receive: readonly string[] }>
}

/** How the glowing parts look this frame: the glow's color (sRGB) and overall strength, plus the audio-driven breath and climbing pulses. */
export interface Cinema2ThreeGlowDraw {
  color: readonly [number, number, number]
  strength: number
  frame: Readonly<Cinema2ThreeGlowFrame>
}

export interface Cinema2ThreeBridgeDiagnostic {
  code: string
  message: string
}

/** Panel (RectAreaLight) budget per quality tier: they cost per pixel per light, so low has none. */
export const CINEMA2_THREE_PANEL_LIMITS: Readonly<Record<Cinema2RenderQualityLevel, number>> = Object.freeze({ low: 0, medium: 2, high: 4 })

export const CINEMA2_THREE_DEFAULT_OVERRIDES: Readonly<Cinema2ThreeMaterialOverrides> = Object.freeze({
  color: null, emissive: null, emissiveIntensity: null, roughness: null, metalness: null, environmentIntensity: 0.5,
  clearcoat: null, clearcoatRoughness: null, environmentRotation: 0, panelIntensity: 1, parts: Object.freeze({}),
})

export interface Cinema2ThreeSceneInstance {
  asset: Cinema2ThreeLoadedAsset
  /** Scene Graph node that places this instance; when omitted the instance sits at the world origin. */
  node: string | null
  /** The instance turns about its own vertical axis by the angle the module passes to `draw` (a turntable spin). */
  spin?: boolean
}

interface PlacedInstance {
  node: string | null
  spin: boolean
  root: ThreeNamespace.Group
  materials: OwnedMaterial[]
}

interface OwnedMaterial {
  /** The part this material belongs to, for per-part overrides: the mesh's name, or its material's name when the mesh's is not a listed part
   * (a model can name many meshes `roots-3`, `leaf-12` ... that share one `roots` / `leaves` material). */
  part: string
  materialName: string
  /** This part's share of the environment (null = the scene's level, no override). */
  environmentShare?: number | null
  material: ThreeNamespace.MeshStandardMaterial
  /** Where the mesh keeps this material, so it can be swapped for a physical one. */
  slot: { mesh: ThreeNamespace.Mesh; index: number | null }
  base: {
    clearcoat: number
    clearcoatRoughness: number
    iridescence: number
    iridescenceIOR: number
    iridescenceThicknessRange: readonly [number, number]
    transmission: number
    ior: number
    thickness: number
    dispersion: number
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
  private readonly loadEnvironment: (url: string) => Promise<ThreeNamespace.Texture>
  private readonly scene: ThreeNamespace.Scene
  private readonly camera: ThreeNamespace.PerspectiveCamera
  private readonly target: ThreeNamespace.WebGLRenderTarget
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly placed: PlacedInstance[] = []
  private readonly spinMatrix: ThreeNamespace.Matrix4
  private readonly pendingTextures: ThreeNamespace.Texture[] = []
  private readonly guard: Cinema2GlStateGuard
  private stage: WarmStage = 'environment'
  private environmentLoad: 'idle' | 'loading' | 'done' = 'idle'
  private readonly panels: { light: ThreeNamespace.RectAreaLight; spec: Readonly<Cinema2ThreePanelSpec> }[] = []
  private readonly diagnostics: Cinema2ThreeBridgeDiagnostic[] = []
  private upgraded = false
  private compiling = false
  private quality: Cinema2RenderQualityLevel | null = null
  private appliedOverrides: Readonly<Cinema2ThreeMaterialOverrides> | null = null
  private disposed = false
  /** Shared by every glowing material, so one write a frame drives them all. */
  private readonly glowUniforms: GlowUniforms

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly library: Cinema2ThreeLibrary,
    instances: readonly Readonly<Cinema2ThreeSceneInstance>[],
    private readonly options: Readonly<Cinema2ThreeSceneOptions> = {},
  ) {
    const { THREE } = library
    const host = getCinema2ThreeRenderer(library, gl)
    this.renderer = host.renderer
    this.getEnvironment = host.getEnvironment
    this.loadEnvironment = host.loadEnvironment
    this.guard = new Cinema2GlStateGuard(gl)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera()
    this.spinMatrix = new THREE.Matrix4()
    this.lightRig = new Cinema2ThreeLightRig(THREE, this.scene)
    // A render target that only points at the engine's framebuffer: Three allocates nothing for it. Flagged like an XR target
    // so Three encodes display-referred sRGB itself (the engine's targets are plain RGBA8 with no hardware sRGB write).
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    ;(this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
    this.target.texture.colorSpace = THREE.SRGBColorSpace
    this.glowUniforms = {
      uCinema2GlowColor: { value: new THREE.Color(1, 0.62, 0.2) },
      uCinema2GlowStrength: { value: 0 },
      uCinema2GlowBreath: { value: 0 },
      uCinema2GlowFront: { value: new THREE.Vector4(-10, -10, -10, -10) },
      uCinema2GlowGain: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2GlowBeats: { value: 0 },
    }

    for (const instance of instances) {
      const root = new THREE.Group()
      root.matrixAutoUpdate = false
      const model = instance.asset.scene.clone(true)
      const materials: OwnedMaterial[] = []
      model.traverse(object => {
        const mesh = object as ThreeNamespace.Mesh
        if (!mesh.isMesh) return
        // Per-instance material clones so overrides never touch the shared asset; textures and geometry stay shared.
        const cloned = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material, index) => {
          const standard = material.clone() as ThreeNamespace.MeshStandardMaterial
          if ((standard as { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) {
            const physical = standard as Partial<ThreeNamespace.MeshPhysicalMaterial>
            materials.push({
              part: mesh.name || standard.name,
              materialName: standard.name,
              material: standard,
              slot: { mesh, index: Array.isArray(mesh.material) ? index : null },
              base: {
                clearcoat: physical.clearcoat ?? 0, clearcoatRoughness: physical.clearcoatRoughness ?? 0,
                iridescence: physical.iridescence ?? 0, iridescenceIOR: physical.iridescenceIOR ?? 1.3,
                iridescenceThicknessRange: [physical.iridescenceThicknessRange?.[0] ?? 100, physical.iridescenceThicknessRange?.[1] ?? 400],
                transmission: physical.transmission ?? 0, ior: physical.ior ?? 1.5, thickness: physical.thickness ?? 0, dispersion: physical.dispersion ?? 0,
                color: standard.color.clone(), emissive: standard.emissive.clone(), emissiveIntensity: standard.emissiveIntensity,
                roughness: standard.roughness, metalness: standard.metalness, normalMap: standard.normalMap, aoMap: standard.aoMap,
              },
            })
          }
          return standard
        })
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!
      })
      for (const owned of materials) this.decorate(owned)
      const shadows = options.shadows
      if (shadows) {
        for (const owned of materials) {
          const inList = (list: readonly string[]) => list.includes(owned.part) || list.includes(owned.materialName)
          owned.slot.mesh.castShadow ||= inList(shadows.cast)
          owned.slot.mesh.receiveShadow ||= inList(shadows.receive)
        }
      }
      root.add(model)
      this.scene.add(root)
      this.placed.push({ node: instance.node, spin: instance.spin === true, root, materials })
    }

    // Panel lights: a fixed pool (unused ones simply hidden per tier), so the shader's light count only changes when the quality tier does.
    const panelSpecs = options.panels ?? []
    if (panelSpecs.length > 0) {
      initializeAreaLightTables(options.areaLightTables ?? null)
      for (const spec of panelSpecs) {
        const light = new THREE.RectAreaLight(0xffffff, 0, spec.width, spec.height)
        light.color.setRGB(spec.color[0], spec.color[1], spec.color[2], THREE.SRGBColorSpace)
        light.position.set(spec.position[0], spec.position[1], spec.position[2])
        light.lookAt(spec.target[0], spec.target[1], spec.target[2])
        light.visible = false
        this.scene.add(light)
        this.panels.push({ light, spec })
      }
    }
  }

  /** Non-fatal problems (for example a shipped environment that failed to load and fell back to the built-in room). */
  getDiagnostics(): readonly Cinema2ThreeBridgeDiagnostic[] {
    return this.diagnostics
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

  draw(exec: Cinema2ModuleRenderExecutionContext, overrides: Readonly<Cinema2ThreeMaterialOverrides>, spinRadians = 0, glow: Readonly<Cinema2ThreeGlowDraw> | null = null): void {
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
      this.applyEnvironmentAndPanels(overrides, lighting.environment.exposure)
      this.applyGlow(glow)
      this.place(exec, spinRadians)
      applyCinema2CameraFrame(this.camera, camera)
      this.lightRig.update(lighting)
      // Shadows only while a flagged spot casts (the renderer is shared per context, so this is set every draw).
      renderer.shadowMap.enabled = this.lightRig.shadowCasterCount > 0
      renderer.shadowMap.type = this.library.THREE.PCFShadowMap
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
    for (const { light } of this.panels) this.scene.remove(light)
    this.panels.length = 0
    this.placed.length = 0
    this.pendingTextures.length = 0
    // Geometry and textures belong to the shared asset (freed when its last holder releases it); the renderer belongs to the context.
    this.target.dispose()
  }

  private appliedEnvironment(): boolean {
    return this.scene.environment != null
  }

  private place(exec: Cinema2ModuleRenderExecutionContext, spinRadians: number): void {
    const nodes = exec.spatialNodes ?? []
    for (const placed of this.placed) {
      const node = placed.node ? nodes.find(candidate => candidate.id === placed.node) : null
      if (placed.node && !node) { placed.root.visible = false; continue }
      placed.root.visible = node ? node.visible : true
      if (node) placed.root.matrix.fromArray(node.worldMatrix as unknown as number[])
      else placed.root.matrix.identity()
      // A turntable spin: about the instance's own vertical axis, applied after the node's placement.
      if (placed.spin && spinRadians !== 0) placed.root.matrix.multiply(this.spinMatrix.makeRotationY(spinRadians))
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
    this.appliedOverrides = null // clearcoat and panel visibility depend on the tier: reapply them
    const limit = CINEMA2_THREE_PANEL_LIMITS[quality]
    this.panels.forEach(({ light }, index) => { light.visible = index < limit })
  }

  /**
   * Swaps standard materials for physical ones the first time a clearcoat or iridescence is requested. A clearcoat (or iridescence) of
   * exactly 0 removes that layer from the shader, so anything the parameter can reach is held at a tiny positive value on the tiers that
   * draw it: turning the control up never recompiles a shader mid-show.
   */
  private upgradeToPhysical(): void {
    if (this.upgraded) return
    this.upgraded = true
    const { THREE } = this.library
    for (const { materials } of this.placed) {
      for (const owned of materials) {
        const physical = new THREE.MeshPhysicalMaterial()
        THREE.MeshStandardMaterial.prototype.copy.call(physical, owned.material)
        // The standard copy resets `defines` to { STANDARD }; without PHYSICAL the shader drops IOR and specular (and glass cannot compile).
        physical.defines = { STANDARD: '', PHYSICAL: '' }
        physical.clearcoat = owned.base.clearcoat
        physical.clearcoatRoughness = owned.base.clearcoatRoughness
        physical.iridescence = owned.base.iridescence
        physical.iridescenceIOR = owned.base.iridescenceIOR
        physical.iridescenceThicknessRange = [owned.base.iridescenceThicknessRange[0], owned.base.iridescenceThicknessRange[1]]
        physical.transmission = owned.base.transmission
        physical.ior = owned.base.ior
        physical.thickness = owned.base.thickness
        physical.dispersion = owned.base.dispersion
        const { mesh, index } = owned.slot
        if (index == null) mesh.material = physical
        else (mesh.material as ThreeNamespace.Material[])[index] = physical
        owned.material.dispose()
        owned.material = physical
        this.decorate(owned)
      }
    }
  }

  /** The glow a part gets (0 when it does not glow). */
  private glowShareOf(owned: Readonly<OwnedMaterial>): number {
    const glow = this.options.glow
    if (!glow) return 0
    const share = glow[owned.part] ?? glow[owned.materialName]
    return typeof share === 'number' && Number.isFinite(share) ? Math.max(0, share) : 0
  }

  /**
   * Installs this material's shader hooks: the per-vertex film thickness (physical materials on meshes that carry it) and the audio glow
   * (parts listed in `config.glow`). Re-run after a material is swapped for a physical one, since a copy does not carry the hooks.
   */
  private decorate(owned: OwnedMaterial): void {
    const material = owned.material
    const geometry = owned.slot.mesh.geometry
    const film = (material as Partial<ThreeNamespace.MeshPhysicalMaterial>).isMeshPhysicalMaterial === true && !!geometry.getAttribute(CINEMA2_FILM_THICKNESS_ATTRIBUTE)
    const share = this.glowShareOf(owned)
    const phase = share > 0 && !!geometry.getAttribute(CINEMA2_GLOW_PHASE_ATTRIBUTE)
    const seed = share > 0 && !!geometry.getAttribute(CINEMA2_GLOW_SEED_ATTRIBUTE)
    if (!film && share <= 0) return
    const shareUniform = { value: share }
    const shared = this.glowUniforms
    material.onBeforeCompile = shader => {
      if (film) addVertexFilmThickness(shader)
      if (share > 0) addAudioGlow(shader, shared, shareUniform, phase, seed)
    }
    material.customProgramCacheKey = () => `cinema2${film ? '-film' : ''}${share > 0 ? (phase ? '-glow-phase' : '-glow') : ''}${seed ? '-seed' : ''}`
    material.needsUpdate = true
  }

  private applyGlow(glow: Readonly<Cinema2ThreeGlowDraw> | null): void {
    const uniforms = this.glowUniforms
    if (!glow) { uniforms.uCinema2GlowStrength.value = 0; return }
    uniforms.uCinema2GlowColor.value.setRGB(glow.color[0], glow.color[1], glow.color[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2GlowStrength.value = Math.max(0, glow.strength)
    uniforms.uCinema2GlowBreath.value = Math.max(0, glow.frame.breath)
    const fronts = glow.frame.fronts, gains = glow.frame.gains
    uniforms.uCinema2GlowFront.value.set(fronts[0] ?? -10, fronts[1] ?? -10, fronts[2] ?? -10, fronts[3] ?? -10)
    uniforms.uCinema2GlowGain.value.set(gains[0] ?? 0, gains[1] ?? 0, gains[2] ?? 0, gains[3] ?? 0)
    uniforms.uCinema2GlowBeats.value = Number.isFinite(glow.frame.beats) ? glow.frame.beats % 4096 : 0
  }

  private applyEnvironmentAndPanels(overrides: Readonly<Cinema2ThreeMaterialOverrides>, exposure: number): void {
    // The environment follows the Cinema 2.0 environment exposure, so a preset's global exposure control dims reflections too.
    this.scene.environmentIntensity = overrides.environmentIntensity * Math.max(0, exposure)
    this.scene.environmentRotation.set(0, (overrides.environmentRotation * Math.PI) / 180, 0)
    for (const { light, spec } of this.panels) light.intensity = spec.intensity * overrides.panelIntensity
    // Three uses the scene-wide intensity for anything lit only by scene.environment; a part with its own share gets the environment as its
    // own envMap instead, so its envMapIntensity (scene level x share) is honoured.
    const environment = this.scene.environment
    for (const { materials } of this.placed) {
      for (const owned of materials) {
        const share = owned.environmentShare
        const material = owned.material
        const wanted = share != null && environment ? environment : null
        if (material.envMap !== wanted) { material.envMap = wanted; material.needsUpdate = true }
        if (wanted) material.envMapIntensity = this.scene.environmentIntensity * (share ?? 1)
      }
    }
  }

  private applyOverrides(overrides: Readonly<Cinema2ThreeMaterialOverrides>): void {
    if (this.appliedOverrides && sameOverrides(this.appliedOverrides, overrides)) return
    this.appliedOverrides = overrides
    const { THREE } = this.library
    if (overrides.clearcoat != null || Object.values(overrides.parts).some(part => part.clearcoat != null || part.iridescence != null || part.transmission != null)) this.upgradeToPhysical()
    const detailed = this.quality !== 'low'
    const tint = overrides.color ? new THREE.Color().setRGB(overrides.color[0], overrides.color[1], overrides.color[2], THREE.SRGBColorSpace) : null
    const emissive = overrides.emissive ? new THREE.Color().setRGB(overrides.emissive[0], overrides.emissive[1], overrides.emissive[2], THREE.SRGBColorSpace) : null
    const colorOf = (rgb: readonly [number, number, number]) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace)
    for (const { materials } of this.placed) {
      for (const owned of materials) {
        const { material, base, part, materialName } = owned
        const own = overrides.parts[part] ?? overrides.parts[materialName]
        const partTint = own?.color ? colorOf(own.color) : null
        const partEmissive = own?.emissive ? colorOf(own.emissive) : null
        // A part's own value wins over the global one; the tint multiplies the asset's base color.
        material.color.copy(base.color)
        const effectiveTint = partTint ?? tint
        if (effectiveTint) material.color.multiply(effectiveTint)
        material.emissive.copy(partEmissive ?? emissive ?? base.emissive)
        material.emissiveIntensity = own?.emissiveIntensity ?? overrides.emissiveIntensity ?? base.emissiveIntensity
        material.roughness = own?.roughness ?? overrides.roughness ?? base.roughness
        material.metalness = own?.metalness ?? overrides.metalness ?? base.metalness
        owned.environmentShare = own?.environmentIntensity ?? null
        const physical = material as Partial<ThreeNamespace.MeshPhysicalMaterial>
        if ('clearcoat' in physical && this.upgraded) {
          const requested = own?.clearcoat ?? overrides.clearcoat
          const wanted = requested ?? base.clearcoat
          physical.clearcoat = detailed && (requested != null || base.clearcoat > 0) ? Math.max(0.001, wanted) : 0
          physical.clearcoatRoughness = own?.clearcoatRoughness ?? overrides.clearcoatRoughness ?? base.clearcoatRoughness
          // Iridescence stays on every tier: the thin-film term is a few instructions per pixel, and dropping it would change the logo's color.
          const iridescence = own?.iridescence
          physical.iridescence = iridescence != null || base.iridescence > 0 ? Math.max(0.001, iridescence ?? base.iridescence) : 0
          physical.iridescenceIOR = own?.iridescenceIOR ?? base.iridescenceIOR
          const thinnest = own?.iridescenceThicknessMin ?? base.iridescenceThicknessRange[0]
          physical.iridescenceThicknessRange = [thinnest, Math.max(thinnest, own?.iridescenceThicknessMax ?? base.iridescenceThicknessRange[1])]
          // Glass: held above zero once requested (a transmission of exactly 0 drops the refraction pass from the shader), off on low.
          const transmission = own?.transmission
          physical.transmission = detailed && (transmission != null || base.transmission > 0) ? Math.max(0.001, transmission ?? base.transmission) : 0
          physical.ior = own?.ior ?? base.ior
          physical.thickness = own?.thickness ?? base.thickness
          physical.dispersion = own?.dispersion ?? base.dispersion
        }
      }
    }
  }

  /** One preparation step per frame so the first visible frame does not hitch: environment, textures (one each), shader compile. */
  private warmUp(): void {
    const { renderer } = this
    if (this.stage === 'environment') {
      const url = this.options.environmentUrl?.(this.quality ?? 'high') ?? null
      if (url && this.environmentLoad !== 'done') {
        if (this.environmentLoad === 'idle') {
          this.environmentLoad = 'loading'
          this.loadEnvironment(url).then(
            texture => { if (!this.disposed) { this.scene.environment = texture; this.environmentLoad = 'done' } },
            error => {
              if (this.disposed) return
              this.diagnostics.push({ code: 'CINEMA2_THREE_ENVIRONMENT_LOAD_FAILED', message: `A shipped environment could not be loaded and the built-in studio room is used instead: ${error instanceof Error ? error.message : String(error)}` })
              this.environmentLoad = 'done'
            },
          )
        }
        return // nothing draws until the environment is ready (or has failed over)
      }
      if (!this.scene.environment) this.scene.environment = this.getEnvironment()
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
    && a.clearcoat === b.clearcoat && a.clearcoatRoughness === b.clearcoatRoughness
    && a.environmentRotation === b.environmentRotation && a.panelIntensity === b.panelIntensity
    && samePartOverrides(a.parts, b.parts)
}

/** True when both hold the same values for the same parts (module parameter reads produce a fresh object every time). */
export function samePartOverrides(a: Readonly<Cinema2ThreeMaterialOverrides['parts']>, b: Readonly<Cinema2ThreeMaterialOverrides['parts']>): boolean {
  if (a === b) return true
  const names = Object.keys(a)
  if (names.length !== Object.keys(b).length) return false
  const same = (x: readonly number[] | null, y: readonly number[] | null) => x === y || (x != null && y != null && x.length === y.length && x.every((value, index) => value === y[index]))
  return names.every(name => {
    const x = a[name], y = b[name]
    return !!x && !!y && same(x.color, y.color) && same(x.emissive, y.emissive) && x.emissiveIntensity === y.emissiveIntensity
      && x.roughness === y.roughness && x.metalness === y.metalness && x.clearcoat === y.clearcoat && x.clearcoatRoughness === y.clearcoatRoughness
      && x.iridescence === y.iridescence && x.iridescenceIOR === y.iridescenceIOR
      && x.iridescenceThicknessMin === y.iridescenceThicknessMin && x.iridescenceThicknessMax === y.iridescenceThicknessMax
      && x.transmission === y.transmission && x.ior === y.ior && x.thickness === y.thickness && x.dispersion === y.dispersion
      && x.environmentIntensity === y.environmentIntensity
  })
}

/**
 * A model's custom glTF attribute `_FILM_THICKNESS` (0-1 per vertex; the loader lower-cases it). Three only varies the iridescence film across a
 * surface through a UV texture; for a mesh that carries this attribute the film instead runs from the thinnest to the thickest value per
 * vertex, so neighbouring facets of the logo's crystal pick up different hues without needing UVs.
 */
export const CINEMA2_FILM_THICKNESS_ATTRIBUTE = '_film_thickness'

type ShaderSource = { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }

function addVertexFilmThickness(shader: ShaderSource): void {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute float ${CINEMA2_FILM_THICKNESS_ATTRIBUTE};\nvarying float vCinema2FilmThickness;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCinema2FilmThickness = ${CINEMA2_FILM_THICKNESS_ATTRIBUTE};`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vCinema2FilmThickness;')
    .replace('#include <lights_physical_fragment>', [
      '#include <lights_physical_fragment>',
      '#if defined( USE_IRIDESCENCE ) && !defined( USE_IRIDESCENCE_THICKNESSMAP )',
      '  material.iridescenceThickness = mix( iridescenceThicknessMinimum, iridescenceThicknessMaximum, clamp( vCinema2FilmThickness, 0.0, 1.0 ) );',
      '#endif',
    ].join('\n'))
}

/**
 * A model's custom glTF attribute `_GLOW_PHASE` (0-1 per vertex; the loader lower-cases it): how far up the structure a vertex is, 0 at the
 * root tips and 1 at the top, so a pulse of glow can climb it. A glowing part without it still breathes, but pulses cannot travel.
 */
export const CINEMA2_GLOW_PHASE_ATTRIBUTE = '_glow_phase'
/**
 * Optional custom glTF attribute `_GLOW_SEED` (0-1, one value per tree): parts carrying it glow as separate trees - each swells on its own slow
 * cycle and strength, its climbing pulses arrive a little early or late, and its brightest spots flicker like embers.
 */
export const CINEMA2_GLOW_SEED_ATTRIBUTE = '_glow_seed'

interface GlowUniforms {
  uCinema2GlowColor: { value: ThreeNamespace.Color }
  uCinema2GlowStrength: { value: number }
  uCinema2GlowBreath: { value: number }
  uCinema2GlowFront: { value: ThreeNamespace.Vector4 }
  uCinema2GlowGain: { value: ThreeNamespace.Vector4 }
  uCinema2GlowBeats: { value: number }
}

/** Adds the audio glow to the material's emitted light: the breath everywhere, plus each climbing pulse as a soft band around its front. */
function addAudioGlow(shader: ShaderSource, shared: GlowUniforms, share: { value: number }, phase: boolean, seed: boolean): void {
  Object.assign(shader.uniforms, shared, { uCinema2GlowShare: share })
  const attributes = [phase ? CINEMA2_GLOW_PHASE_ATTRIBUTE : null, seed ? CINEMA2_GLOW_SEED_ATTRIBUTE : null].filter((name): name is string => name != null)
  if (attributes.length > 0) {
    const varying = (name: string) => (name === CINEMA2_GLOW_PHASE_ATTRIBUTE ? 'vCinema2GlowPhase' : 'vCinema2GlowSeed')
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', ['#include <common>', ...attributes.map(name => `attribute float ${name};\nvarying float ${varying(name)};`)].join('\n'))
      .replace('#include <begin_vertex>', ['#include <begin_vertex>', ...attributes.map(name => `${varying(name)} = ${name};`)].join('\n'))
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', [
      '#include <common>',
      'uniform vec3 uCinema2GlowColor;',
      'uniform float uCinema2GlowStrength;',
      'uniform float uCinema2GlowBreath;',
      'uniform float uCinema2GlowShare;',
      `uniform vec4 uCinema2GlowFront;`,
      `uniform vec4 uCinema2GlowGain;`,
      'uniform float uCinema2GlowBeats;',
      phase ? 'varying float vCinema2GlowPhase;' : '',
      seed ? 'varying float vCinema2GlowSeed;' : '',
    ].join('\n'))
    .replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      // Per tree (with a seed): its own slow swell (0.45-1.35x) over 6-14 beats, pulses arriving up to a third of the climb early or late.
      seed ? [
        'float cinema2Tree = vCinema2GlowSeed;',
        'float cinema2TreeGain = 0.9 + 0.45 * sin( uCinema2GlowBeats * 6.2832 / ( 6.0 + 8.0 * cinema2Tree ) + cinema2Tree * 40.0 );',
        'float cinema2Stagger = ( cinema2Tree - 0.5 ) * 0.66;',
      ].join('\n') : 'float cinema2TreeGain = 1.0;\nfloat cinema2Stagger = 0.0;',
      'float cinema2Glow = uCinema2GlowBreath;',
      phase ? [
        `for ( int i = 0; i < ${CINEMA2_THREE_GLOW_WAVE_COUNT}; i ++ ) {`,
        '  float d = ( vCinema2GlowPhase - ( uCinema2GlowFront[ i ] - cinema2Stagger ) ) / 0.09;',
        '  cinema2Glow += uCinema2GlowGain[ i ] * exp( - d * d );',
        '}',
      ].join('\n') : '',
      // Embers: seeded parts flicker a little along their length, strongest where the glow is already bright.
      seed && phase ? 'cinema2Glow *= 0.85 + 0.3 * sin( uCinema2GlowBeats * 5.1 + vCinema2GlowPhase * 37.0 + vCinema2GlowSeed * 91.0 );' : '',
      'totalEmissiveRadiance += uCinema2GlowColor * ( uCinema2GlowStrength * uCinema2GlowShare * cinema2TreeGain * cinema2Glow );',
    ].join('\n'))
}

const initializedAreaLightTables = new WeakSet<object>()

/** `RectAreaLightUniformsLib.init()` fills global look-up tables: run it once per loaded Three library. */
function initializeAreaLightTables(tables: { init(): void } | null): void {
  if (!tables) throw new Error('Cinema 2.0 Three scene has panel lights but the area-light tables were not loaded.')
  if (initializedAreaLightTables.has(tables)) return
  initializedAreaLightTables.add(tables)
  tables.init()
}
