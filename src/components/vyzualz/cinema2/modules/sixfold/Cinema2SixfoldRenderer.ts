import type * as ThreeNamespace from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { Cinema2SixfoldChoreography } from './Cinema2SixfoldChoreography'
import {
  CINEMA2_SIXFOLD_FRAME_SCALE_STEP,
  createCinema2SixfoldGeometry,
  type Cinema2SixfoldMaterials,
  type Cinema2SixfoldRig,
} from './Cinema2SixfoldGeometry'

interface ExternalFramebufferRenderer {
  setRenderTargetFramebuffer(target: ThreeNamespace.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void
}

export interface Cinema2SixfoldDrawState {
  readonly timeSeconds: number
  readonly pattern: number
  readonly patternPhaseBeats: number
  readonly intensity: number
  readonly chamberRadius: number
  readonly chamberDepth: number
  readonly facetScale: number
  readonly mechanicalDetail: number
  readonly perspectiveReveal: number
  readonly idleDrift: number
  readonly railGlow: number
  readonly irisGlow: number
  readonly fineDetail: number
  readonly fold: number
  readonly rotation: number
  readonly responses: readonly [number, number, number, number, number, number]
  readonly build: number
  readonly drop: number
  readonly vocalPresence: number
  readonly colors: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
}

/**
 * Production Three.js world for Sixfold. The geometry is constructed once as six
 * semantic mechanisms, then updated through stable group handles without any
 * frame-time mesh creation. Authored pattern poses drive the persistent groups.
 */
export class Cinema2SixfoldRenderer {
  private readonly renderer: ThreeNamespace.WebGLRenderer
  private readonly scene: ThreeNamespace.Scene
  private readonly camera: ThreeNamespace.PerspectiveCamera
  private readonly target: ThreeNamespace.WebGLRenderTarget
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly guard: Cinema2GlStateGuard
  private readonly rig: Cinema2SixfoldRig
  private readonly materials: Cinema2SixfoldMaterials
  private readonly materialList: ThreeNamespace.Material[]
  private readonly choreography = new Cinema2SixfoldChoreography()
  private readonly tempColor: ThreeNamespace.Color
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly library: Cinema2ThreeLibrary,
  ) {
    const { THREE } = library
    const host = getCinema2ThreeRenderer(library, gl)
    this.renderer = host.renderer
    this.guard = new Cinema2GlStateGuard(gl)
    this.scene = new THREE.Scene()
    this.scene.environment = host.getEnvironment()
    this.camera = new THREE.PerspectiveCamera()
    this.lightRig = new Cinema2ThreeLightRig(THREE, this.scene)
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    ;(this.target as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true
    this.target.texture.colorSpace = THREE.SRGBColorSpace

    this.materials = createMaterials(THREE)
    this.rig = createCinema2SixfoldGeometry(THREE, this.materials)
    this.materialList = [...Object.values(this.materials), ...this.rig.ledBars.map(bar => bar.material)]
    this.tempColor = new THREE.Color()
    this.scene.add(this.rig.root)
  }

  estimateGpuBytes(): number {
    let bytes = 256 * 256 * 6 * 8 * 1.34
    for (const geometry of this.rig.geometries) {
      bytes += geometry.index?.array.byteLength ?? 0
      for (const name of Object.keys(geometry.attributes)) bytes += geometry.getAttribute(name)?.array.byteLength ?? 0
    }
    return Math.round(bytes)
  }

  draw(execution: Cinema2ModuleRenderExecutionContext, state: Readonly<Cinema2SixfoldDrawState>): void {
    if (this.disposed) return
    if (!execution.depthAvailable || !execution.camera || !execution.lightingEnvironment) {
      throw new Error('Sixfold requires final depth, camera, and lighting state.')
    }
    this.applyState(execution as Cinema2ModuleRenderExecutionContext & {
      camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
      lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
    }, state)
    this.guard.capture()
    try {
      this.renderer.resetState()
      ;(this.renderer as unknown as ExternalFramebufferRenderer).setRenderTargetFramebuffer(this.target, execution.target as WebGLFramebuffer)
      this.target.viewport.set(0, 0, execution.width, execution.height)
      this.target.scissor.set(0, 0, execution.width, execution.height)
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
    this.scene.remove(this.rig.root)
    for (const geometry of this.rig.geometries) geometry.dispose()
    for (const material of this.materialList) material.dispose()
    this.target.dispose()
  }

  private applyState(execution: Cinema2ModuleRenderExecutionContext & {
    camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
    lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
  }, state: Readonly<Cinema2SixfoldDrawState>): void {
    const { THREE } = this.library
    const structure = state.colors[0]
    const mirror = state.colors[1]
    const light = state.colors[2]
    const core = state.colors[3]
    const irisResponse = clamp(state.responses[0], 0, 1)
    const facetResponse = clamp(state.responses[1], 0, 1)
    const illuminationResponse = clamp(state.responses[4], 0, 1)
    const pose = this.choreography.resolve({
      pattern: state.pattern,
      phaseBeats: state.patternPhaseBeats,
      responses: state.responses,
      build: state.build,
      drop: state.drop,
      vocalPresence: state.vocalPresence,
    })

    setSrgb(this.materials.structure.color, structure, THREE)
    this.materials.structure.color.multiplyScalar(0.38)
    setSrgb(this.materials.support.color, structure, THREE)
    this.materials.support.color.lerp(this.tempColor.setRGB(0.16, 0.19, 0.24), 0.48)
    setSrgb(this.materials.mirror.color, mirror, THREE)
    setSrgb(this.materials.light.color, light, THREE)
    this.materials.light.color.multiplyScalar(0.035)
    setSrgb(this.materials.light.emissive, light, THREE)
    for (const bar of this.rig.ledBars) {
      bar.material.color.copy(this.materials.light.color)
      bar.material.emissive.copy(this.materials.light.emissive)
    }
    setSrgb(this.materials.core.color, core, THREE)
    this.materials.core.color.multiplyScalar(0.58)
    setSrgb(this.materials.core.emissive, core, THREE)
    setSrgb(this.materials.glass.color, mirror, THREE)

    // Physical structure remains visible at intensity zero; intensity owns only performance illumination.
    const performanceLight = pose.illumination * (0.38 + illuminationResponse * 0.82)
    this.materials.light.emissiveIntensity = (0.28 + state.railGlow * 0.42 + performanceLight * 1.5) * state.intensity
    this.materials.core.emissiveIntensity = (0.08 + state.irisGlow * 0.2 + irisResponse * 1.25 + state.drop * 0.8) * state.intensity
    this.materials.mirror.emissive.copy(this.materials.light.emissive)
    this.materials.mirror.emissiveIntensity = (0.018 + facetResponse * 0.045 + state.drop * 0.08) * state.intensity

    this.rig.root.scale.set(state.chamberRadius, state.chamberRadius, 1)
    this.rig.root.rotation.z = state.rotation * 0.055 + pose.globalRotation
    this.rig.root.rotation.y = (state.perspectiveReveal - 0.56) * 0.34 + Math.sin(state.timeSeconds * 0.11) * state.idleDrift * 0.008
    this.rig.root.rotation.x = Math.cos(state.timeSeconds * 0.09) * state.idleDrift * 0.004
    this.rig.root.position.z = 0.32 - (state.chamberDepth - 1.42) * 0.42
    const depthScale = state.chamberDepth / 1.42
    for (let index = 0; index < this.rig.frames.length; index += 1) {
      const frame = this.rig.frames[index]!
      const authoredScale = 1 - index * CINEMA2_SIXFOLD_FRAME_SCALE_STEP
      const performanceScale = 1 + pose.frameScale[index]!
      frame.scale.set(authoredScale * performanceScale, authoredScale * performanceScale, 1)
      frame.position.z = -index * 1.18 * depthScale + pose.frameDepth[index]! * state.fold
      this.rig.frameLights[index]!.scale.setScalar(1 + illuminationResponse * 0.008 * (index + 1))
    }
    for (const bar of this.rig.ledBars) {
      const phaseSide = bar.cell === 0 ? bar.side : (bar.side + bar.cell - 1) % 6
      const channel = phaseSide * 3 + bar.segment
      const layerLight = bar.cell === 0
        ? pose.frameLight[bar.layer]!
        : 0.58 + pose.frameLight[(bar.cell - 1) % pose.frameLight.length]! * 0.38
      bar.material.emissiveIntensity = (
        0.055
        + state.railGlow * 0.11
        + pose.ledLight[channel]! * layerLight * (0.58 + illuminationResponse * 1.42)
      ) * state.intensity
    }
    for (let index = 0; index < this.rig.satelliteCells.length; index += 1) {
      this.rig.satelliteCells[index]!.position.z = -0.38 - pose.frameDepth[index % pose.frameDepth.length]! * state.fold * 0.32
    }
    this.rig.iris.position.z = -4.82 * depthScale
    this.rig.iris.scale.setScalar(pose.irisScale)
    this.rig.rearBaffle.position.z = -6.05 * depthScale
    this.rig.illumination.scale.z = depthScale
    this.rig.detailMedium.scale.z = depthScale
    this.rig.detailHigh.scale.z = depthScale
    for (let index = 0; index < this.rig.locks.length; index += 1) {
      const angle = index * Math.PI / 3 + Math.PI / 6
      const lock = this.rig.locks[index]!
      lock.position.set(Math.cos(angle) * pose.lockRadial[index]!, Math.sin(angle) * pose.lockRadial[index]!, -2.15 * depthScale)
      lock.rotation.z = angle + pose.lockFold[index]!
    }
    for (let index = 0; index < this.rig.facets.length; index += 1) {
      const angle = index * Math.PI / 3
      const facet = this.rig.facets[index]!
      facet.scale.setScalar(0.92 + state.facetScale * 0.08)
      facet.position.set(Math.cos(angle) * pose.facetRadial[index]!, Math.sin(angle) * pose.facetRadial[index]!, -0.62 * depthScale + pose.facetDepth[index]!)
      facet.rotation.z = angle + pose.facetTwist[index]!
      facet.rotation.x = (index % 2 === 0 ? 1 : -1) * (0.018 + pose.facetFold[index]!) * state.fold
    }
    for (let index = 0; index < this.rig.irisBlades.length; index += 1) {
      this.rig.irisBlades[index]!.rotation.z = index * Math.PI / 6 + 0.15 + pose.irisBladeOffset
    }
    this.rig.mechanisms[0]!.rotation.z = pose.outerMechanismRotation
    this.rig.mechanisms[1]!.rotation.z = pose.innerMechanismRotation

    const quality = execution.lightingEnvironment.quality
    this.rig.detailMedium.visible = quality !== 'low' && state.mechanicalDetail >= 0.34
    this.rig.detailHigh.visible = quality === 'high' && state.mechanicalDetail >= 0.68 && state.fineDetail >= 0.08
    this.scene.environmentIntensity = 0.72 * Math.max(0, execution.lightingEnvironment.environment.exposure)
    applyCinema2CameraFrame(this.camera, execution.camera)
    this.lightRig.update(execution.lightingEnvironment)
    this.renderer.shadowMap.enabled = quality !== 'low' && this.lightRig.shadowCasterCount > 0
    this.renderer.shadowMap.type = THREE.PCFShadowMap
  }
}

function createMaterials(THREE: typeof ThreeNamespace): Cinema2SixfoldMaterials {
  return Object.freeze({
    structure: new THREE.MeshStandardMaterial({ color: 0x17202b, metalness: 0.94, roughness: 0.38 }),
    support: new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.82, roughness: 0.5 }),
    mirror: new THREE.MeshPhysicalMaterial({ color: 0x4a3fa8, metalness: 0.96, roughness: 0.075, clearcoat: 1, clearcoatRoughness: 0.08 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x15234e, metalness: 0.08, roughness: 0.08, transmission: 0.58, thickness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04 }),
    light: new THREE.MeshStandardMaterial({ color: 0x03121a, emissive: 0x2bdcff, emissiveIntensity: 1.8, metalness: 0.04, roughness: 0.28 }),
    core: new THREE.MeshPhysicalMaterial({ color: 0xeafcff, emissive: 0xa4f4ff, emissiveIntensity: 0.45, metalness: 0.32, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 }),
    blackout: new THREE.MeshStandardMaterial({ color: 0x06080f, metalness: 0.72, roughness: 0.66, side: THREE.DoubleSide }),
  })
}

function setSrgb(
  target: ThreeNamespace.Color,
  source: readonly [number, number, number],
  THREE: typeof ThreeNamespace,
): void {
  target.setRGB(source[0], source[1], source[2], THREE.SRGBColorSpace)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
