import type * as ThreeNamespace from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import { measureObject } from '../three/Cinema2ThreeAssetCache'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2SayItGlyphPose } from './Cinema2SayItMotion'

interface ExternalFramebufferRenderer {
  setRenderTargetFramebuffer(target: ThreeNamespace.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void
}

export interface Cinema2SayItDrawState {
  poses: readonly Readonly<Cinema2SayItGlyphPose>[]
  color: readonly [number, number, number]
  roughness: number
  environmentIntensity: number
  environmentRotationRadians: number
}

interface GlyphInstance {
  id: string
  mesh: string
  root: ThreeNamespace.Group
  material: ThreeNamespace.MeshStandardMaterial
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
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly guard: Cinema2GlStateGuard
  private readonly assembly: ThreeNamespace.Group
  private readonly sourceMeshes = new Map<string, ThreeNamespace.Mesh>()
  private readonly glyphs: GlyphInstance[] = []
  private glyphSignature = ''
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

    asset.scene.traverse(object => {
      const mesh = object as ThreeNamespace.Mesh
      if (mesh.isMesh) this.sourceMeshes.set(mesh.name, mesh)
    })
    if (this.sourceMeshes.size < 94) throw new Error('The SAY IT production asset does not contain the complete printable Basic Latin glyph set.')
  }

  estimateGpuBytes(): number {
    let bytes = measureObject(this.glyphs.map(glyph => glyph.root)).bytes
    if (this.scene.environment) bytes += 256 * 256 * 6 * 8 * 1.34
    return Math.round(bytes)
  }

  draw(exec: Cinema2ModuleRenderExecutionContext, state: Readonly<Cinema2SayItDrawState>): void {
    if (this.disposed) return
    if (!exec.depthAvailable) throw new Error('The SAY IT module requires a render target with a depth attachment.')
    if (!exec.camera || !exec.lightingEnvironment) throw new Error('The SAY IT module requires final Camera and Lighting state.')

    this.guard.capture()
    const { THREE } = this.library
    try {
      this.renderer.resetState()
      this.syncGlyphs(state.poses)
      for (let index = 0; index < this.glyphs.length; index += 1) {
        const glyph = this.glyphs[index]!
        const pose = state.poses[index]
        if (!pose || pose.id !== glyph.id || pose.mesh !== glyph.mesh) throw new Error('The SAY IT motion state does not match the active text layout.')
        glyph.root.position.set(pose.position[0], pose.position[1], pose.position[2])
        glyph.root.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2], 'XYZ')
        glyph.root.scale.setScalar(pose.scale)
        glyph.material.color.setRGB(state.color[0], state.color[1], state.color[2], THREE.SRGBColorSpace)
        glyph.material.metalness = 1
        glyph.material.roughness = Math.min(1, Math.max(0.04, state.roughness))
      }

      this.scene.environmentIntensity = Math.max(0, state.environmentIntensity) * Math.max(0, exec.lightingEnvironment.environment.exposure)
      this.scene.environmentRotation.set(0, state.environmentRotationRadians, 0)
      const placement = exec.spatialNodes?.[0]
      if (placement) this.assembly.matrix.fromArray(placement.worldMatrix as unknown as number[])
      else this.assembly.matrix.identity()
      this.assembly.visible = placement?.visible ?? true
      this.assembly.matrixWorldNeedsUpdate = true
      applyCinema2CameraFrame(this.camera, exec.camera)
      this.lightRig.update(exec.lightingEnvironment)
      this.renderer.shadowMap.enabled = this.lightRig.shadowCasterCount > 0
      this.renderer.shadowMap.type = THREE.PCFShadowMap

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
    }
    this.glyphs.length = 0
    this.glyphSignature = ''
    this.scene.remove(this.assembly)
    // Geometry and the environment are shared; the asset cache and renderer host own them.
    this.target.dispose()
  }

  private syncGlyphs(poses: readonly Readonly<Cinema2SayItGlyphPose>[]): void {
    const signature = poses.map(pose => `${pose.id}:${pose.mesh}`).join('|')
    if (signature === this.glyphSignature) return
    const { THREE } = this.library
    for (const glyph of this.glyphs) {
      this.assembly.remove(glyph.root)
      glyph.material.dispose()
    }
    this.glyphs.length = 0
    for (const pose of poses) {
      const source = this.sourceMeshes.get(pose.mesh)
      if (!source) throw new Error(`The SAY IT glyph package is missing mesh "${pose.mesh}".`)
      const sourceMaterial = Array.isArray(source.material) ? source.material[0] : source.material
      if (!sourceMaterial || !(sourceMaterial as ThreeNamespace.MeshStandardMaterial).isMeshStandardMaterial) {
        throw new Error(`The SAY IT mesh "${pose.mesh}" does not use a standard PBR material.`)
      }
      const material = (sourceMaterial as ThreeNamespace.MeshStandardMaterial).clone()
      const mesh = new THREE.Mesh(source.geometry, material)
      mesh.name = pose.mesh
      mesh.castShadow = true
      mesh.receiveShadow = true
      const root = new THREE.Group()
      root.name = pose.id
      root.add(mesh)
      this.assembly.add(root)
      this.glyphs.push({ id: pose.id, mesh: pose.mesh, root, material })
    }
    this.glyphSignature = signature
  }
}
