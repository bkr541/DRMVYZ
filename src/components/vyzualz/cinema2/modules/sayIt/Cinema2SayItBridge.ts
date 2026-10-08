import type * as ThreeNamespace from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { measureObject } from '../three/Cinema2ThreeAssetCache'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2SayItGlyphPose } from './Cinema2SayItMotion'
import type { Cinema2SayItPatternId } from './Cinema2SayItPatternController'
import type { Cinema2SayItQualityProfile } from './Cinema2SayItQuality'

interface ExternalFramebufferRenderer {
  setRenderTargetFramebuffer(target: ThreeNamespace.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void
}

export interface Cinema2SayItDrawState {
  poses: readonly Readonly<Cinema2SayItGlyphPose>[]
  color: readonly [number, number, number]
  ledOutlineEnabled: boolean
  outlineColor: readonly [number, number, number]
  pattern: Cinema2SayItPatternId
  patternPhaseBeats: number
  ledMusicIntensity: number
  roughness: number
  environmentIntensity: number
  environmentRotationRadians: number
  materialStyle: Cinema2SayItMaterialStyle
}

export const CINEMA2_SAY_IT_MATERIAL_STYLES = Object.freeze(['chrome', 'brushed', 'pearl', 'neon'] as const)
export type Cinema2SayItMaterialStyle = typeof CINEMA2_SAY_IT_MATERIAL_STYLES[number]

interface GlyphInstance {
  id: string
  meshName: string
  mesh: ThreeNamespace.Mesh
  ledMesh: ThreeNamespace.Mesh
  root: ThreeNamespace.Group
  material: ThreeNamespace.MeshStandardMaterial
  ledMaterial: ThreeNamespace.MeshStandardMaterial
}

/**
 * GPU bridge for SAY IT. The production asset stores one mesh per printable
 * Basic Latin character; this bridge makes lightweight instances for the active
 * text and receives a complete transform for every visible glyph each frame.
 */
export class Cinema2SayItBridge {
  private readonly renderer: ThreeNamespace.WebGLRenderer
  private readonly scene: ThreeNamespace.Scene
  private readonly camera: ThreeNamespace.PerspectiveCamera
  private readonly target: ThreeNamespace.WebGLRenderTarget
  private readonly warmTarget: ThreeNamespace.WebGLRenderTarget
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly guard: Cinema2GlStateGuard
  private readonly assembly: ThreeNamespace.Group
  private readonly sourceMeshes = new Map<string, ThreeNamespace.Mesh>()
  private readonly glyphs: GlyphInstance[] = []
  private glyphSignature = ''
  private warmedSignature = ''
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly library: Cinema2ThreeLibrary,
    asset: Readonly<Cinema2ThreeLoadedAsset>,
  ) {
    const { THREE } = library
    const host = getCinema2ThreeRenderer(library, gl)
    this.renderer = host.renderer
    this.guard = new Cinema2GlStateGuard(gl)
    this.scene = new THREE.Scene()
    this.scene.environment = host.getEnvironment()
    this.camera = new THREE.PerspectiveCamera()
    this.lightRig = new Cinema2ThreeLightRig(THREE, this.scene)
    this.assembly = new THREE.Group()
    this.assembly.name = 'say-it-assembly'
    this.assembly.matrixAutoUpdate = false
    this.scene.add(this.assembly)
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    ;(this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
    this.target.texture.colorSpace = THREE.SRGBColorSpace
    this.warmTarget = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true })
    this.warmTarget.texture.colorSpace = THREE.SRGBColorSpace

    asset.scene.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (mesh.isMesh) this.sourceMeshes.set(mesh.name, mesh)
    })
    const baseGlyphCount = [...this.sourceMeshes.keys()].filter(name => !name.endsWith('-led')).length
    const ledGlyphCount = [...this.sourceMeshes.keys()].filter(name => name.endsWith('-led')).length
    if (baseGlyphCount < 94 || ledGlyphCount < 94) {
      throw new Error('The SAY IT production asset does not contain the complete printable Basic Latin glyph and LED contour sets.')
    }
  }

  estimateGpuBytes(): number {
    let bytes = measureObject(this.glyphs.map(glyph => glyph.root)).bytes
    if (this.scene.environment) bytes += 256 * 256 * 6 * 8 * 1.34
    return Math.round(bytes)
  }

  /**
   * Compiles the active material/light variant and uploads the active glyph
   * buffers into an offscreen 2x2 target. A changed glyph set or quality tier
   * gets one non-visible warmup frame before draw() is allowed to present it.
   */
  prewarm(
    exec: Cinema2ModuleRenderExecutionContext,
    state: Readonly<Cinema2SayItDrawState>,
    profile: Readonly<Cinema2SayItQualityProfile>,
  ): boolean {
    if (this.disposed) return false
    this.validateExecution(exec)
    const requestedSignature = `${state.poses.map(pose => `${pose.id}:${pose.mesh}`).join('|')}@${profile.quality}:led${state.ledOutlineEnabled ? 1 : 0}`
    if (requestedSignature === this.warmedSignature) return true

    this.guard.capture()
    try {
      this.renderer.resetState()
      this.applyState(exec, state, profile)
      this.warmTarget.viewport.set(0, 0, 2, 2)
      this.warmTarget.scissor.set(0, 0, 2, 2)
      this.renderer.setRenderTarget(this.warmTarget)
      this.renderer.compile(this.scene, this.camera)
      this.renderer.render(this.scene, this.camera)
      this.renderer.setRenderTarget(null)
      this.warmedSignature = requestedSignature
      return false
    } finally {
      this.renderer.resetState()
      this.guard.restore()
    }
  }

  draw(
    exec: Cinema2ModuleRenderExecutionContext,
    state: Readonly<Cinema2SayItDrawState>,
    profile: Readonly<Cinema2SayItQualityProfile>,
  ): void {
    if (this.disposed) return
    this.validateExecution(exec)

    this.guard.capture()
    try {
      this.renderer.resetState()
      this.applyState(exec, state, profile)

      ;(this.renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target, exec.target as WebGLFramebuffer)
      this.target.viewport.set(0, 0, exec.width, exec.height)
      this.target.scissor.set(0, 0, exec.width, exec.height)
      this.renderer.setRenderTarget(this.target)
      this.renderer.render(this.scene, this.camera)
      this.renderer.setRenderTarget(null)
    } finally {
      this.renderer.resetState()
      this.guard.restore()
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const glyph of this.glyphs) {
      this.assembly.remove(glyph.root)
      glyph.material.dispose()
      glyph.ledMaterial.dispose()
    }
    this.glyphs.length = 0
    this.glyphSignature = ''
    this.warmedSignature = ''
    this.scene.remove(this.assembly)
    // Geometry and the environment are shared; the asset cache and renderer host own them.
    this.target.dispose()
    this.warmTarget.dispose()
  }

  private validateExecution(exec: Cinema2ModuleRenderExecutionContext): asserts exec is Cinema2ModuleRenderExecutionContext & {
    camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
    lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
  } {
    if (!exec.depthAvailable) throw new Error('The SAY IT module requires a render target with a depth attachment.')
    if (!exec.camera || !exec.lightingEnvironment) throw new Error('The SAY IT module requires final Camera and Lighting state.')
  }

  private applyState(
    exec: Cinema2ModuleRenderExecutionContext & {
      camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
      lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
    },
    state: Readonly<Cinema2SayItDrawState>,
    profile: Readonly<Cinema2SayItQualityProfile>,
  ): void {
    const { THREE } = this.library
    this.syncGlyphs(state.poses)
    for (let index = 0; index < this.glyphs.length; index += 1) {
      const glyph = this.glyphs[index]!
      const pose = state.poses[index]
      if (!pose || pose.id !== glyph.id || pose.mesh !== glyph.meshName) throw new Error('The SAY IT motion state does not match the active text layout.')
      glyph.root.position.set(pose.position[0], pose.position[1], pose.position[2])
      glyph.root.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ')
      glyph.root.scale.setScalar(pose.scale)
      glyph.mesh.castShadow = profile.castShadows
      glyph.mesh.receiveShadow = profile.castShadows
      glyph.ledMesh.castShadow = false
      glyph.ledMesh.receiveShadow = false
      glyph.ledMesh.visible = state.ledOutlineEnabled
      glyph.material.color.setRGB(state.color[0], state.color[1], state.color[2], THREE.SRGBColorSpace)
      glyph.material.emissive.setRGB(0, 0, 0)
      glyph.material.emissiveIntensity = 0
      if (state.materialStyle === 'brushed') {
        glyph.material.metalness = 0.88
        glyph.material.roughness = Math.min(1, Math.max(0.38, profile.roughnessFloor, state.roughness))
      } else if (state.materialStyle === 'pearl') {
        glyph.material.metalness = 0.18
        glyph.material.roughness = Math.min(1, Math.max(0.22, profile.roughnessFloor, state.roughness))
      } else if (state.materialStyle === 'neon') {
        glyph.material.metalness = 0.32
        glyph.material.roughness = Math.min(1, Math.max(0.14, profile.roughnessFloor, state.roughness))
        glyph.material.emissive.setRGB(state.color[0], state.color[1], state.color[2], THREE.SRGBColorSpace)
        glyph.material.emissiveIntensity = 0.42
      } else {
        glyph.material.metalness = 1
        glyph.material.roughness = Math.min(1, Math.max(profile.roughnessFloor, state.roughness))
      }
      glyph.ledMaterial.color.setRGB(
        state.outlineColor[0] * 0.025,
        state.outlineColor[1] * 0.025,
        state.outlineColor[2] * 0.025,
        THREE.SRGBColorSpace,
      )
      glyph.ledMaterial.emissive.setRGB(
        state.outlineColor[0],
        state.outlineColor[1],
        state.outlineColor[2],
        THREE.SRGBColorSpace,
      )
      const ledDrive = resolveLedPatternIntensity(state.pattern, state.patternPhaseBeats, index, this.glyphs.length)
        * state.ledMusicIntensity
      glyph.ledMaterial.emissiveIntensity = state.ledOutlineEnabled
        ? 5.5 * ledDrive
        : 0
      glyph.ledMaterial.metalness = 0.05
      glyph.ledMaterial.roughness = 0.3
      if (state.ledOutlineEnabled && state.materialStyle !== 'neon') {
        glyph.material.emissive.setRGB(
          state.outlineColor[0], state.outlineColor[1], state.outlineColor[2], THREE.SRGBColorSpace,
        )
        glyph.material.emissiveIntensity = 0.07 * ledDrive
      }
    }

    this.scene.environmentIntensity = Math.max(0, state.environmentIntensity)
      * profile.environmentIntensityScale
      * Math.max(0, exec.lightingEnvironment.environment.exposure)
    this.scene.environmentRotation.set(0, state.environmentRotationRadians, 0)
    const placement = exec.spatialNodes?.[0]
    if (placement) this.assembly.matrix.fromArray(placement.worldMatrix as unknown as number[])
    else this.assembly.matrix.identity()
    this.assembly.visible = placement?.visible ?? true
    this.assembly.matrixWorldNeedsUpdate = true
    applyCinema2CameraFrame(this.camera, exec.camera)
    this.lightRig.update(exec.lightingEnvironment)
    this.renderer.shadowMap.enabled = profile.castShadows && this.lightRig.shadowCasterCount > 0
    this.renderer.shadowMap.type = THREE.PCFShadowMap
  }

  private syncGlyphs(poses: readonly Readonly<Cinema2SayItGlyphPose>[]): void {
    const signature = poses.map(pose => `${pose.id}:${pose.mesh}`).join('|')
    if (signature === this.glyphSignature) return
    const { THREE } = this.library
    for (const glyph of this.glyphs) {
      this.assembly.remove(glyph.root)
      glyph.material.dispose()
      glyph.ledMaterial.dispose()
    }
    this.glyphs.length = 0
    this.warmedSignature = ''
    for (const pose of poses) {
      const source = this.sourceMeshes.get(pose.mesh)
      if (!source) throw new Error(`The SAY IT glyph package is missing mesh "${pose.mesh}".`)
      const ledSourceName = `${pose.mesh}-led`
      const ledSource = this.sourceMeshes.get(ledSourceName)
      if (!ledSource) throw new Error(`The SAY IT glyph package is missing LED contour mesh "${ledSourceName}".`)
      const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material
      const ledSourceMaterial = Array.isArray(ledSource.material) ? ledSource.material[0] : ledSource.material
      if (!sourceMaterial || !(sourceMaterial as ThreeNamespace.MeshStandardMaterial).isMeshStandardMaterial) {
        throw new Error(`The SAY IT mesh "${pose.mesh}" does not use a standard PBR material.`)
      }
      if (!ledSourceMaterial || !(ledSourceMaterial as ThreeNamespace.MeshStandardMaterial).isMeshStandardMaterial) {
        throw new Error(`The SAY IT LED contour "${ledSourceName}" does not use a standard PBR material.`)
      }
      const material = (sourceMaterial as ThreeNamespace.MeshStandardMaterial).clone()
      const ledMaterial = (ledSourceMaterial as ThreeNamespace.MeshStandardMaterial).clone()
      const mesh = new THREE.Mesh(source.geometry, material)
      const ledMesh = new THREE.Mesh(ledSource.geometry, ledMaterial)
      mesh.name = pose.mesh
      ledMesh.name = ledSourceName
      mesh.castShadow = true
      mesh.receiveShadow = true
      ledMesh.castShadow = false
      ledMesh.receiveShadow = false
      const root = new THREE.Group()
      root.name = pose.id
      root.add(mesh, ledMesh)
      this.assembly.add(root)
      this.glyphs.push({ id: pose.id, meshName: pose.mesh, mesh, ledMesh, root, material, ledMaterial })
    }
    this.glyphSignature = signature
  }
}

function resolveLedPatternIntensity(
  pattern: Cinema2SayItPatternId,
  phaseBeats: number,
  glyphIndex: number,
  glyphCount: number,
): number {
  const phase = Math.max(0, phaseBeats)
  if (pattern === 'pulse') return 0.48 + 0.52 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2))
  if (pattern === 'letter-chase') {
    const head = phase * 2 % Math.max(1, glyphCount)
    const distance = Math.min(Math.abs(glyphIndex - head), Math.max(1, glyphCount) - Math.abs(glyphIndex - head))
    return 0.18 + 0.82 * Math.exp(-distance * 1.7)
  }
  if (pattern === 'alternate') return glyphIndex % 2 === Math.floor(phase * 2) % 2 ? 1 : 0.2
  if (pattern === 'center-wave') {
    const centerDistance = Math.abs(glyphIndex - (glyphCount - 1) / 2)
    return 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.cos(phase * Math.PI * 2 - centerDistance * 1.15), 3)
  }
  if (pattern === 'strobe') return phase * 4 % 1 < 0.32 ? 1 : 0.12
  return 1
}
