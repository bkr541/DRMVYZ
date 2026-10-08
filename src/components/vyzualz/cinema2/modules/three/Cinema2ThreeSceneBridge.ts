import type * as ThreeNamespace from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2GlStateGuard } from './Cinema2GlStateGuard'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from './Cinema2ThreeCameraLightMapping'
import type { Cinema2ThreeLibrary } from './Cinema2ThreeLibrary'
import { CINEMA2_THREE_GLOW_WAVE_COUNT, type Cinema2ThreeGlowFrame } from './Cinema2ThreeAudioGlow'
import {
  CINEMA2_THREE_SEGMENT_GLSL,
  CINEMA2_THREE_SEGMENT_WAVE_COUNT,
  cinema2ThreeSegmentRoleCode,
  type Cinema2ThreeSegmentFrame,
  type Cinema2ThreeSegmentRole,
} from './Cinema2ThreeSegmentLighting'
import { Cinema2ThreeParticleField, type Cinema2ThreeParticleSpec } from './Cinema2ThreeParticles'
import type { Cinema2ThreeLoadedAsset } from './Cinema2ThreeAssetCache'
import { measureObject } from './Cinema2ThreeAssetCache'
import { getCinema2ThreeRenderer } from './Cinema2ThreeRendererHost'
import type { Cinema2MainframeLightingFrame } from '../mainframe/Cinema2MainframePatternEngine'

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
  /**
   * Parts lit segment by segment (`config.segments`, part -> role): their emitted light comes only from the segment pattern (see
   * Cinema2ThreeSegmentLighting), replacing the material's own emissive. Needs the `_SEGMENT` and `_GLOW_PHASE` vertex attributes.
   */
  segments?: Readonly<Record<string, Cinema2ThreeSegmentRole>>
  /** Mainframe-only semantic emissive roles. Parts must carry the generated Mainframe system/bank/region/route attributes. */
  mainframe?: Readonly<Record<string, Cinema2ThreeMainframeRole>>
  /**
   * The engine target is a float target and the preset tone-maps later (`config.hdr`): segment light is emitted unrolled, above 1. Ignored
   * where the GPU cannot render to float textures (the preset's targets then fall back to 8-bit).
   */
  hdr?: boolean
  /** Glowing point fields drifting through the scene (`config.particles`): embers, dust (see Cinema2ThreeParticles). */
  particles?: readonly Readonly<Cinema2ThreeParticleSpec>[]
  /** Parts that cast and receive shadows from spot lights flagged `threeShadow` (`config.shadows`); none by default. */
  shadows?: Readonly<{ cast: readonly string[]; receive: readonly string[] }>
}

/** How the glowing parts look this frame: the glow's color (sRGB) and overall strength, plus the audio-driven breath and climbing pulses. */
export interface Cinema2ThreeGlowDraw {
  color: readonly [number, number, number]
  strength: number
  frame: Readonly<Cinema2ThreeGlowFrame>
}

/** How the segment-lit parts look this frame: the energy color (sRGB), overall strength, and the pattern state. */
export interface Cinema2ThreeSegmentDraw {
  color: readonly [number, number, number]
  strength: number
  /**
   * 0-1: how much a segment's light gathers into a hot core where its surface faces the camera. On rounded LED bars and tubes this gives
   * a white-hot centre line with deeper-colored edges, like a real diffuser; 0 lights every surface evenly. Default 0.
   */
  core?: number
  frame: Readonly<Cinema2ThreeSegmentFrame>
}

export type Cinema2ThreeMainframeRole = 'circuit' | 'indicator' | 'radar' | 'chip' | 'logo'

export interface Cinema2ThreeMainframeDraw {
  readonly circuitColor: readonly [number, number, number]
  readonly indicatorColor: readonly [number, number, number]
  readonly logoColor: readonly [number, number, number]
  readonly strength: number
  readonly frame: Readonly<Cinema2MainframeLightingFrame>
}

/** Optional per-draw placement used by dedicated native modules that share the Three bridge. */
export interface Cinema2ThreeDrawPlacement {
  /** Uniform scale about the model origin. The Scene Graph placement is still applied first. */
  scale?: number
  /** Visibility by mesh or material name. Unlisted parts remain visible. */
  parts?: Readonly<Record<string, boolean>>
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

type WarmStage = 'environment' | 'textures' | 'compile' | 'ready' | 'failed'

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
  private readonly scaleMatrix: ThreeNamespace.Matrix4
  private readonly pendingTextures: ThreeNamespace.Texture[] = []
  private readonly guard: Cinema2GlStateGuard
  private stage: WarmStage = 'environment'
  private environmentLoad: 'idle' | 'loading' | 'done' = 'idle'
  private readonly panels: { light: ThreeNamespace.RectAreaLight; spec: Readonly<Cinema2ThreePanelSpec> }[] = []
  private readonly particleFields: Cinema2ThreeParticleField[] = []
  /** The audio glow's breath this frame (0 without a glow), which lifts the particle fields. */
  private glowBreath = 0
  private readonly diagnostics: Cinema2ThreeBridgeDiagnostic[] = []
  private upgraded = false
  private compiling = false
  private quality: Cinema2RenderQualityLevel | null = null
  private appliedOverrides: Readonly<Cinema2ThreeMaterialOverrides> | null = null
  private disposed = false
  /** Shared by every glowing material, so one write a frame drives them all. */
  private readonly glowUniforms: GlowUniforms
  /** Shared by every segment-lit material. */
  private readonly segmentUniforms: SegmentUniforms
  /** Shared by the five independently colored Mainframe emissive material families. */
  private readonly mainframeUniforms: MainframeUniforms

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
    this.scaleMatrix = new THREE.Matrix4()
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
      // An HDR preset (config.hdr) on a GPU without float targets renders 8-bit: roll the glow off softly instead of clipping it.
      uCinema2GlowRolloff: { value: options.hdr === true && gl.getExtension('EXT_color_buffer_float') == null ? 1 : 0 },
    }
    this.segmentUniforms = {
      uCinema2SegColor: { value: new THREE.Color(1, 0.62, 0.2) },
      uCinema2SegStrength: { value: 0 },
      uCinema2Seg0: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2Seg1: { value: new THREE.Vector4(0, -1, 0, 1) },
      uCinema2SegWeights: { value: new THREE.Vector4(1, 0, 0, 0) },
      uCinema2SegFront: { value: new THREE.Vector4(-10, -10, -10, -10) },
      uCinema2SegGain: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2SegCore: { value: 0 },
      uCinema2SegHdr: { value: options.hdr === true && gl.getExtension('EXT_color_buffer_float') != null ? 1 : 0 },
    }
    this.mainframeUniforms = {
      uCinema2MainframeCircuit: { value: new THREE.Color(0.24, 1, 0.12) },
      uCinema2MainframeIndicator: { value: new THREE.Color(0.4, 1, 0.22) },
      uCinema2MainframeLogo: { value: new THREE.Color(0.3, 1, 0.18) },
      uCinema2MainframeStrength: { value: 0 },
      uCinema2MainframeState0: { value: new THREE.Vector4(0, 0, -10, 0.1) },
      uCinema2MainframeState1: { value: new THREE.Vector4(0, 1, 0, 0) },
      uCinema2MainframeBanks: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeRegions0: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeRegions1: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeSystems0: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeSystems1: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeSystems2: { value: new THREE.Vector4(0, 0, 0, 0) },
      uCinema2MainframeHdr: { value: options.hdr === true && gl.getExtension('EXT_color_buffer_float') != null ? 1 : 0 },
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

    ;(options.particles ?? []).forEach((spec, index) => {
      const field = new Cinema2ThreeParticleField(THREE, spec, index)
      this.scene.add(field.points)
      this.particleFields.push(field)
    })
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

  draw(
    exec: Cinema2ModuleRenderExecutionContext,
    overrides: Readonly<Cinema2ThreeMaterialOverrides>,
    spinRadians = 0,
    glow: Readonly<Cinema2ThreeGlowDraw> | null = null,
    segments: Readonly<Cinema2ThreeSegmentDraw> | null = null,
    placement: Readonly<Cinema2ThreeDrawPlacement> | null = null,
    mainframe: Readonly<Cinema2ThreeMainframeDraw> | null = null,
  ): void {
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
      this.applySegments(segments)
      this.applyMainframe(mainframe)
      this.applyPartVisibility(placement?.parts ?? null)
      this.place(exec, spinRadians, placement?.scale ?? 1)
      applyCinema2CameraFrame(this.camera, camera)
      if (this.particleFields.length > 0) {
        const scale = (exec.height * this.camera.projectionMatrix.elements[5]!) / 2
        const glowColor = this.glowUniforms.uCinema2GlowStrength.value > 0 ? this.glowUniforms.uCinema2GlowColor.value : null
        for (const field of this.particleFields) field.update(exec.frame.elapsedTimeSec, lighting.quality, this.glowBreath, glowColor, scale)
      }
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
    for (const field of this.particleFields) { this.scene.remove(field.points); field.dispose() }
    this.particleFields.length = 0
    this.placed.length = 0
    this.pendingTextures.length = 0
    // Geometry and textures belong to the shared asset (freed when its last holder releases it); the renderer belongs to the context.
    this.target.dispose()
  }

  private appliedEnvironment(): boolean {
    return this.scene.environment != null
  }

  private place(exec: Cinema2ModuleRenderExecutionContext, spinRadians: number, scale: number): void {
    const nodes = exec.spatialNodes ?? []
    const resolvedScale = Number.isFinite(scale) ? Math.max(0.01, scale) : 1
    for (const placed of this.placed) {
      const node = placed.node ? nodes.find(candidate => candidate.id === placed.node) : null
      if (placed.node && !node) { placed.root.visible = false; continue }
      placed.root.visible = node ? node.visible : true
      if (node) placed.root.matrix.fromArray(node.worldMatrix as unknown as number[])
      else placed.root.matrix.identity()
      // A turntable spin: about the instance's own vertical axis, applied after the node's placement.
      if (placed.spin && spinRadians !== 0) placed.root.matrix.multiply(this.spinMatrix.makeRotationY(spinRadians))
      if (resolvedScale !== 1) placed.root.matrix.multiply(this.scaleMatrix.makeScale(resolvedScale, resolvedScale, resolvedScale))
      placed.root.matrixWorldNeedsUpdate = true
    }
  }

  private applyPartVisibility(parts: Readonly<Record<string, boolean>> | null): void {
    for (const { materials } of this.placed) {
      for (const owned of materials) {
        const requested = parts?.[owned.part] ?? parts?.[owned.materialName]
        owned.slot.mesh.visible = requested ?? true
      }
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
  /** The segment role of a part, when it has one and its mesh carries the segment attributes. */
  private segmentRoleOf(owned: Readonly<OwnedMaterial>): Cinema2ThreeSegmentRole | null {
    const role = this.options.segments?.[owned.part] ?? this.options.segments?.[owned.materialName]
    const geometry = owned.slot.mesh.geometry
    return role && geometry.getAttribute(CINEMA2_SEGMENT_ATTRIBUTE) && geometry.getAttribute(CINEMA2_GLOW_PHASE_ATTRIBUTE) ? role : null
  }

  private mainframeRoleOf(owned: Readonly<OwnedMaterial>): Cinema2ThreeMainframeRole | null {
    const role = this.options.mainframe?.[owned.part] ?? this.options.mainframe?.[owned.materialName]
    if (!role) return null
    const geometry = owned.slot.mesh.geometry
    // Missing semantic attributes must not silently downgrade a whole emitter family
    // to the dim static glTF material. This contract is Mainframe-only.
    for (const name of [CINEMA2_MAINFRAME_SYSTEM_ATTRIBUTE, CINEMA2_MAINFRAME_ROUTE_ATTRIBUTE,
      CINEMA2_MAINFRAME_BANK_ATTRIBUTE, CINEMA2_MAINFRAME_REGION_ATTRIBUTE, CINEMA2_GLOW_PHASE_ATTRIBUTE]) {
      const attribute = geometry.getAttribute(name)
      if (!attribute || attribute.itemSize !== 1 || attribute.count !== geometry.getAttribute('position')?.count) {
        throw new Error(`Mainframe ${owned.part} (${role}) requires a per-vertex ${name} attribute.`)
      }
    }
    return role
  }

  private decorate(owned: OwnedMaterial): void {
    const material = owned.material
    const geometry = owned.slot.mesh.geometry
    const film = (material as Partial<ThreeNamespace.MeshPhysicalMaterial>).isMeshPhysicalMaterial === true && !!geometry.getAttribute(CINEMA2_FILM_THICKNESS_ATTRIBUTE)
    const role = this.segmentRoleOf(owned)
    if (role) {
      // Segment-lit parts take their light only from the pattern; the audio glow does not also apply.
      const roleUniform = { value: cinema2ThreeSegmentRoleCode(role) }
      const segmentShared = this.segmentUniforms
      material.onBeforeCompile = shader => {
        if (film) addVertexFilmThickness(shader)
        addSegmentLighting(shader, segmentShared, roleUniform)
      }
      material.customProgramCacheKey = () => `cinema2${film ? '-film' : ''}-segments`
      material.needsUpdate = true
      return
    }
    const mainframeRole = this.mainframeRoleOf(owned)
    if (mainframeRole) {
      const roleUniform = { value: cinema2MainframeRoleCode(mainframeRole) }
      const mainframeShared = this.mainframeUniforms
      material.onBeforeCompile = shader => {
        if (film) addVertexFilmThickness(shader)
        addMainframeLighting(shader, mainframeShared, roleUniform)
      }
      material.customProgramCacheKey = () => `cinema2${film ? '-film' : ''}-mainframe`
      material.needsUpdate = true
      return
    }
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
    this.glowBreath = glow ? Math.max(0, glow.frame.breath) : 0
    if (!glow) { uniforms.uCinema2GlowStrength.value = 0; return }
    uniforms.uCinema2GlowColor.value.setRGB(glow.color[0], glow.color[1], glow.color[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2GlowStrength.value = Math.max(0, glow.strength)
    uniforms.uCinema2GlowBreath.value = Math.max(0, glow.frame.breath)
    const fronts = glow.frame.fronts, gains = glow.frame.gains
    uniforms.uCinema2GlowFront.value.set(fronts[0] ?? -10, fronts[1] ?? -10, fronts[2] ?? -10, fronts[3] ?? -10)
    uniforms.uCinema2GlowGain.value.set(gains[0] ?? 0, gains[1] ?? 0, gains[2] ?? 0, gains[3] ?? 0)
    uniforms.uCinema2GlowBeats.value = Number.isFinite(glow.frame.beats) ? glow.frame.beats % 4096 : 0
  }

  private applySegments(segments: Readonly<Cinema2ThreeSegmentDraw> | null): void {
    const uniforms = this.segmentUniforms
    if (!segments) { uniforms.uCinema2SegStrength.value = 0; return }
    const frame = segments.frame
    uniforms.uCinema2SegColor.value.setRGB(segments.color[0], segments.color[1], segments.color[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2SegStrength.value = Math.max(0, segments.strength)
    uniforms.uCinema2SegCore.value = Math.min(1, Math.max(0, segments.core ?? 0))
    uniforms.uCinema2Seg0.value.set(Number.isFinite(frame.beats) ? frame.beats % 4096 : 0, frame.level, frame.drop, frame.quiet)
    uniforms.uCinema2Seg1.value.set(frame.chase, frame.splitSide, frame.flicker, frame.reactivity)
    uniforms.uCinema2SegWeights.value.set(frame.weights[0], frame.weights[1], frame.weights[2], frame.weights[3])
    const f = frame.fronts, g = frame.gains
    uniforms.uCinema2SegFront.value.set(f[0] ?? -10, f[1] ?? -10, f[2] ?? -10, f[3] ?? -10)
    uniforms.uCinema2SegGain.value.set(g[0] ?? 0, g[1] ?? 0, g[2] ?? 0, g[3] ?? 0)
  }

  private applyMainframe(draw: Readonly<Cinema2ThreeMainframeDraw> | null): void {
    const uniforms = this.mainframeUniforms
    if (!draw || !draw.frame.active) { uniforms.uCinema2MainframeStrength.value = 0; return }
    const { frame } = draw
    uniforms.uCinema2MainframeCircuit.value.setRGB(draw.circuitColor[0], draw.circuitColor[1], draw.circuitColor[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2MainframeIndicator.value.setRGB(draw.indicatorColor[0], draw.indicatorColor[1], draw.indicatorColor[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2MainframeLogo.value.setRGB(draw.logoColor[0], draw.logoColor[1], draw.logoColor[2], this.library.THREE.SRGBColorSpace)
    uniforms.uCinema2MainframeStrength.value = Math.max(0, draw.strength)
    uniforms.uCinema2MainframeState0.value.set(frame.beats % 4096, frame.level, frame.chaseFront, frame.chaseWidth)
    uniforms.uCinema2MainframeState1.value.set(frame.chaseGain, frame.chaseDirection, frame.flicker, 1)
    uniforms.uCinema2MainframeBanks.value.set(...frame.bankWeights)
    uniforms.uCinema2MainframeRegions0.value.set(frame.regionWeights[0], frame.regionWeights[1], frame.regionWeights[2], frame.regionWeights[3])
    uniforms.uCinema2MainframeRegions1.value.set(frame.regionWeights[4], frame.regionWeights[5], frame.regionWeights[6], frame.regionWeights[7])
    uniforms.uCinema2MainframeSystems0.value.set(frame.systemGains[0], frame.systemGains[1], frame.systemGains[2], frame.systemGains[3])
    uniforms.uCinema2MainframeSystems1.value.set(frame.systemGains[4], frame.systemGains[5], frame.systemGains[6], frame.systemGains[7])
    uniforms.uCinema2MainframeSystems2.value.set(frame.systemGains[8], 0, 0, 0)
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
        error => {
          this.compiling = false
          if (this.disposed) return
          // Do not mask Mainframe shader failures as a successfully prepared render.
          // Other Three presets keep the pre-existing warm-up behavior.
          if (!this.options.mainframe) { this.stage = 'ready'; return }
          this.stage = 'failed'
          this.diagnostics.push({
            code: 'CINEMA2_THREE_MAINFRAME_SHADER_COMPILE_FAILED',
            message: `Mainframe shader compilation failed: ${error instanceof Error ? error.message : String(error)}`,
          })
        },
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
  /** 1: roll the glow off toward white (an HDR preset that fell back to 8-bit targets); 0: emit it as is. */
  uCinema2GlowRolloff: { value: number }
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
      'uniform float uCinema2GlowRolloff;',
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
      'vec3 cinema2GlowLight = uCinema2GlowColor * ( uCinema2GlowStrength * uCinema2GlowShare * cinema2TreeGain * cinema2Glow );',
      'totalEmissiveRadiance += mix( cinema2GlowLight, 1.0 - exp( - cinema2GlowLight ), uCinema2GlowRolloff );',
    ].join('\n'))
}

/**
 * A model's custom glTF attribute `_SEGMENT` (vec4 per vertex; the loader lower-cases it): which group (ring, rib, tube) the vertex's LED segment
 * belongs to (0-1), where along that group it sits (0-1), which side of the stage (-1 left, 1 right, 0 centre), and a random 0-1 identity per
 * segment. Read by the segment lighting of parts listed in `config.segments`.
 */
export const CINEMA2_SEGMENT_ATTRIBUTE = '_segment'

interface SegmentUniforms {
  uCinema2SegColor: { value: ThreeNamespace.Color }
  uCinema2SegStrength: { value: number }
  uCinema2Seg0: { value: ThreeNamespace.Vector4 }
  uCinema2Seg1: { value: ThreeNamespace.Vector4 }
  uCinema2SegWeights: { value: ThreeNamespace.Vector4 }
  uCinema2SegFront: { value: ThreeNamespace.Vector4 }
  uCinema2SegGain: { value: ThreeNamespace.Vector4 }
  uCinema2SegCore: { value: number }
  /** 1: emit the full (HDR) light; 0: roll it off toward white for an 8-bit target. */
  uCinema2SegHdr: { value: number }
}

/**
 * Replaces the material's emitted light with the segment pattern's brightness times the energy color: at full strength into a float target,
 * otherwise rolled off softly toward white.
 */
export function addSegmentLighting(shader: ShaderSource, shared: SegmentUniforms, role: { value: number }): void {
  Object.assign(shader.uniforms, shared, { uCinema2SegRole: role })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', [
      '#include <common>',
      `attribute vec4 ${CINEMA2_SEGMENT_ATTRIBUTE};`,
      `attribute float ${CINEMA2_GLOW_PHASE_ATTRIBUTE};`,
      'varying vec4 vCinema2Segment;',
      'varying float vCinema2SegPhase;',
    ].join('\n'))
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCinema2Segment = ${CINEMA2_SEGMENT_ATTRIBUTE};\nvCinema2SegPhase = ${CINEMA2_GLOW_PHASE_ATTRIBUTE};`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', [
      '#include <common>',
      'uniform vec3 uCinema2SegColor;',
      'uniform float uCinema2SegStrength;',
      'uniform float uCinema2SegRole;',
      'uniform float uCinema2SegHdr;',
      'uniform float uCinema2SegCore;',
      'varying vec4 vCinema2Segment;',
      'varying float vCinema2SegPhase;',
      CINEMA2_THREE_SEGMENT_GLSL,
    ].join('\n'))
    .replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      // Hot core: only the front-facing middle of a diffuser tends toward white. Its edges retain Energy Color, so changing that control
      // still recolors the tube, chamber and perimeter together. The flatter logo perimeter gets less white to preserve its thin amber line.
      'float cinema2SegFacing = saturate( dot( normal, normalize( vViewPosition ) ) );',
      'float cinema2SegCore = mix( 1.0, 0.1 + 0.9 * cinema2SegFacing * cinema2SegFacing * cinema2SegFacing, uCinema2SegCore );',
      'float cinema2SegBrightness = cinema2SegmentBrightness( uCinema2SegRole, vCinema2Segment, vCinema2SegPhase );',
      'float cinema2SegHotCore = pow( cinema2SegFacing, 6.0 ) * smoothstep( 0.08, 0.45, cinema2SegBrightness );',
      'cinema2SegHotCore *= uCinema2SegRole < 0.5 ? 0.72 : ( uCinema2SegRole < 1.5 ? 0.12 : 0.4 );',
      // An amber Energy Color warms its white core; a blue Energy Color retains a neutral white core instead of inheriting an orange cast.
      'float cinema2SegWarmth = saturate( uCinema2SegColor.r - uCinema2SegColor.b );',
      'vec3 cinema2SegWhite = vec3( 1.0, 1.0 - 0.06 * cinema2SegWarmth, 1.0 - 0.25 * cinema2SegWarmth );',
      'vec3 cinema2SegHotColor = mix( uCinema2SegColor, cinema2SegWhite, cinema2SegHotCore );',
      // The logo's thin perimeter can be brighter without growing into the letter faces: phase still fades its emission up the walls.
      'float cinema2SegReach = uCinema2SegRole > 0.5 && uCinema2SegRole < 1.5 ? min( 1.0, 1.3 * vCinema2SegPhase ) : 1.0;',
      'vec3 cinema2SegLight = cinema2SegHotColor * ( uCinema2SegStrength * cinema2SegBrightness * cinema2SegCore * cinema2SegReach );',
      // Into a float target the light goes out as is, and the finish's tone curve turns the brightest into a warm-white core. Into an 8-bit
      // target a hard per-channel clip would turn a bright amber yellow (its green channel clips first), so it rolls off softly (1 - e^-x).
      'totalEmissiveRadiance = mix( 1.0 - exp( - cinema2SegLight ), cinema2SegLight, uCinema2SegHdr );',
    ].join('\n'))
}

// The shader loop unrolls over the wave count; keep the two modules agreeing.
if (CINEMA2_THREE_SEGMENT_WAVE_COUNT !== 4) throw new Error('Cinema 2.0 segment lighting packs its waves into vec4 uniforms.')

export const CINEMA2_MAINFRAME_ROUTE_ATTRIBUTE = '_mainframe_route'
export const CINEMA2_MAINFRAME_BANK_ATTRIBUTE = '_mainframe_bank'
export const CINEMA2_MAINFRAME_REGION_ATTRIBUTE = '_mainframe_region'
export const CINEMA2_MAINFRAME_SYSTEM_ATTRIBUTE = '_mainframe_system'

interface MainframeUniforms {
  uCinema2MainframeCircuit: { value: ThreeNamespace.Color }
  uCinema2MainframeIndicator: { value: ThreeNamespace.Color }
  uCinema2MainframeLogo: { value: ThreeNamespace.Color }
  uCinema2MainframeStrength: { value: number }
  uCinema2MainframeState0: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeState1: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeBanks: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeRegions0: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeRegions1: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeSystems0: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeSystems1: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeSystems2: { value: ThreeNamespace.Vector4 }
  uCinema2MainframeHdr: { value: number }
}

function cinema2MainframeRoleCode(role: Cinema2ThreeMainframeRole): number {
  return role === 'circuit' ? 0 : role === 'indicator' ? 1 : role === 'radar' ? 2 : role === 'chip' ? 3 : 4
}

function addMainframeLighting(shader: ShaderSource, shared: MainframeUniforms, role: { value: number }): void {
  Object.assign(shader.uniforms, shared, { uCinema2MainframeRole: role })
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', [
      '#include <common>',
      `attribute float ${CINEMA2_GLOW_PHASE_ATTRIBUTE};`,
      `attribute float ${CINEMA2_MAINFRAME_ROUTE_ATTRIBUTE};`,
      `attribute float ${CINEMA2_MAINFRAME_BANK_ATTRIBUTE};`,
      `attribute float ${CINEMA2_MAINFRAME_REGION_ATTRIBUTE};`,
      `attribute float ${CINEMA2_MAINFRAME_SYSTEM_ATTRIBUTE};`,
      'varying vec4 vCinema2MainframeMeta;',
      'varying float vCinema2MainframePhase;',
    ].join('\n'))
    .replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      `vCinema2MainframeMeta = vec4( ${CINEMA2_MAINFRAME_ROUTE_ATTRIBUTE}, ${CINEMA2_MAINFRAME_BANK_ATTRIBUTE}, ${CINEMA2_MAINFRAME_REGION_ATTRIBUTE}, ${CINEMA2_MAINFRAME_SYSTEM_ATTRIBUTE} );`,
      `vCinema2MainframePhase = ${CINEMA2_GLOW_PHASE_ATTRIBUTE};`,
    ].join('\n'))
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', [
      '#include <common>',
      'uniform vec3 uCinema2MainframeCircuit;',
      'uniform vec3 uCinema2MainframeIndicator;',
      'uniform vec3 uCinema2MainframeLogo;',
      'uniform float uCinema2MainframeStrength;',
      'uniform float uCinema2MainframeRole;',
      'uniform float uCinema2MainframeHdr;',
      'uniform vec4 uCinema2MainframeState0;',
      'uniform vec4 uCinema2MainframeState1;',
      'uniform vec4 uCinema2MainframeBanks;',
      'uniform vec4 uCinema2MainframeRegions0;',
      'uniform vec4 uCinema2MainframeRegions1;',
      'uniform vec4 uCinema2MainframeSystems0;',
      'uniform vec4 uCinema2MainframeSystems1;',
      'uniform vec4 uCinema2MainframeSystems2;',
      'varying vec4 vCinema2MainframeMeta;',
      'varying float vCinema2MainframePhase;',
      'float cinema2MainframePick4( vec4 values, float index ) {',
      '  return index < 0.5 ? values.x : ( index < 1.5 ? values.y : ( index < 2.5 ? values.z : values.w ) );',
      '}',
      'float cinema2MainframeSystem( float index ) {',
      '  return index < 3.5 ? cinema2MainframePick4( uCinema2MainframeSystems0, index )',
      '    : ( index < 7.5 ? cinema2MainframePick4( uCinema2MainframeSystems1, index - 4.0 ) : uCinema2MainframeSystems2.x );',
      '}',
    ].join('\n'))
    .replace('#include <emissivemap_fragment>', [
      '#include <emissivemap_fragment>',
      'float cinema2MFRoute = vCinema2MainframeMeta.x;',
      'float cinema2MFBank = vCinema2MainframeMeta.y;',
      'float cinema2MFRegion = vCinema2MainframeMeta.z;',
      'float cinema2MFSystem = vCinema2MainframeMeta.w;',
      'float cinema2MFBankLight = cinema2MFBank < -0.5 ? 0.0 : cinema2MainframePick4( uCinema2MainframeBanks, cinema2MFBank );',
      'float cinema2MFRegionLight = cinema2MFRegion < -0.5 ? 0.0 : ( cinema2MFRegion < 3.5',
      '  ? cinema2MainframePick4( uCinema2MainframeRegions0, cinema2MFRegion )',
      '  : cinema2MainframePick4( uCinema2MainframeRegions1, cinema2MFRegion - 4.0 ) );',
      'float cinema2MFTravel = uCinema2MainframeState1.y > 0.0 ? vCinema2MainframePhase : 1.0 - vCinema2MainframePhase;',
      'float cinema2MFDistance = ( cinema2MFTravel - uCinema2MainframeState0.z ) / max( 0.025, uCinema2MainframeState0.w );',
      'float cinema2MFWave = exp( - cinema2MFDistance * cinema2MFDistance ) * uCinema2MainframeState1.x;',
      // Keep dormant paths visibly present but genuinely dark. Authored system gains and travelling pulses then have enough HDR headroom to
      // ignite above Conduit's peak emitters instead of modulating an already-green wall.
      'float cinema2MFBase = uCinema2MainframeRole < 0.5 ? 0.035 : ( uCinema2MainframeRole < 3.5 ? 0.05 : 0.065 );',
      'float cinema2MFSystemLight = cinema2MainframeSystem( cinema2MFSystem );',
      // The previous squared response made ordinary track energy almost invisible
      // (e.g. a 0.2 system gain became 0.04). Keep idle signals dim, but let
      // authored midrange gains reach visible pixels without changing their timing.
      'cinema2MFSystemLight = pow( clamp( cinema2MFSystemLight, 0.0, 1.0 ), 1.25 );',
      'float cinema2MFSystemPeak = uCinema2MainframeRole < 0.5 ? 6.5 : ( uCinema2MainframeRole < 3.5 ? 9.0 : 12.0 );',
      'float cinema2MFLight = cinema2MFBase + cinema2MFSystemPeak * cinema2MFSystemLight;',
      'if ( cinema2MFSystem > 0.5 && cinema2MFSystem < 1.5 ) cinema2MFLight += 1.1 * cinema2MFBankLight + 1.2 * cinema2MFRegionLight + 14.0 * cinema2MFWave;',
      'else if ( cinema2MFSystem > 3.5 && cinema2MFSystem < 5.5 ) cinema2MFLight += 5.0 * cinema2MFWave;',
      'float cinema2MFNoise = sin( uCinema2MainframeState0.x * 5.7 + cinema2MFRoute * 17.3 + vCinema2MainframePhase * 31.0 );',
      'cinema2MFLight *= 1.0 + cinema2MFNoise * uCinema2MainframeState1.z * 0.16;',
      'vec3 cinema2MFColor = uCinema2MainframeRole < 0.5 ? uCinema2MainframeCircuit',
      '  : ( uCinema2MainframeRole < 3.5 ? uCinema2MainframeIndicator : uCinema2MainframeLogo );',
      'float cinema2MFFacing = saturate( dot( normal, normalize( vViewPosition ) ) );',
      'float cinema2MFHot = pow( cinema2MFFacing, 5.0 ) * smoothstep( 0.65, 3.5, cinema2MFLight );',
      'vec3 cinema2MFEmission = mix( cinema2MFColor, vec3( 1.0 ), cinema2MFHot * 0.78 )',
      '  * ( uCinema2MainframeStrength * max( 0.0, cinema2MFLight ) );',
      'vec3 cinema2MFFinal = mix( 1.0 - exp( - cinema2MFEmission ), cinema2MFEmission, uCinema2MainframeHdr );',
      // Static/no-source rendering retains the approved Stage 3 material. During playback the semantic shader owns emission so its dark-to-hot
      // range remains visible instead of adding a small modulation on top of an already-bright material.
      'totalEmissiveRadiance = mix( totalEmissiveRadiance, cinema2MFFinal, step( 0.0001, uCinema2MainframeStrength ) );',
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
