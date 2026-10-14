import type * as ThreeNamespace from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { applyCinema2CameraFrame, Cinema2ThreeLightRig } from '../three/Cinema2ThreeCameraLightMapping'
import { Cinema2GlStateGuard } from '../three/Cinema2GlStateGuard'
import { getCinema2ThreeRenderer } from '../three/Cinema2ThreeRendererHost'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  resolveCinema2HypnotizeLedDrive,
  type Cinema2HypnotizePatternFrame,
} from './Cinema2HypnotizePatternEngine'
import {
  CINEMA2_HYPNOTIZE_STATIC_COUNTS,
  createCinema2HypnotizeGeometry,
  type Cinema2HypnotizeMaterials,
  type Cinema2HypnotizeRig,
} from './Cinema2HypnotizeGeometry'

interface ExternalFramebufferRenderer {
  setRenderTargetFramebuffer(target: ThreeNamespace.WebGLRenderTarget, framebuffer: WebGLFramebuffer): void
}

export interface Cinema2HypnotizeDrawState {
  readonly timeSeconds: number
  readonly patternFrame: Readonly<Cinema2HypnotizePatternFrame>
  readonly intensity: number
  readonly ringDensity: number
  readonly chamberRadius: number
  readonly tunnelDepth: number
  readonly coreSize: number
  readonly vaneLength: number
  readonly perspectiveReveal: number
  readonly membraneTension: number
  readonly pulseDepth: number
  readonly rotationSpeed: number
  readonly counterRotation: number
  readonly travel: number
  readonly coolGlow: number
  readonly coreGlow: number
  readonly spectralDetail: number
  readonly overallEnergy: number
  readonly bassPressure: number
  readonly lowMidAmount: number
  readonly midAmount: number
  readonly highsAmount: number
  readonly fluxAmount: number
  readonly vocalPresence: number
  readonly beatAccent: number
  readonly kickAccent: number
  readonly snareAccent: number
  readonly downbeatAccent: number
  readonly phraseAccent: number
  readonly buildAmount: number
  readonly dropAccent: number
  readonly directorIntensity: number
  readonly directorMomentum: number
  readonly directorImpact: number
  readonly dropStrength: number
  readonly flashLevel: number
  readonly colors: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
}

/** Phase D Three.js world with polished materials, lighting, pattern transitions, and shared-intelligence choreography. */
export class Cinema2HypnotizeRenderer {
  private readonly renderer: ThreeNamespace.WebGLRenderer
  private readonly scene: ThreeNamespace.Scene
  private readonly camera: ThreeNamespace.PerspectiveCamera
  private readonly target: ThreeNamespace.WebGLRenderTarget
  private readonly lightRig: Cinema2ThreeLightRig
  private readonly guard: Cinema2GlStateGuard
  private readonly rig: Cinema2HypnotizeRig
  private readonly materials: Cinema2HypnotizeMaterials
  private readonly materialList: readonly ThreeNamespace.Material[]
  private readonly coolSpill: ThreeNamespace.PointLight
  private readonly warmSpill: ThreeNamespace.PointLight
  private readonly coreSpill: ThreeNamespace.PointLight
  private readonly faceFill: ThreeNamespace.PointLight
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
    this.rig = createCinema2HypnotizeGeometry(THREE, this.materials)
    this.materialList = [
      ...Object.values(this.materials),
      ...this.rig.exteriorResonators.map(resonator => resonator.emitter),
      ...this.rig.ledSegments.map(segment => segment.material),
    ]
    this.tempColor = new THREE.Color()
    this.coolSpill = new THREE.PointLight(0x35d9ff, 24, 10, 2)
    this.warmSpill = new THREE.PointLight(0xff7a26, 12, 8, 2)
    this.coreSpill = new THREE.PointLight(0xd7f8ff, 34, 12, 2)
    this.faceFill = new THREE.PointLight(0x7896c8, 3, 34, 2)
    this.coolSpill.position.set(-2.8, 1.6, -5.2)
    this.warmSpill.position.set(2.6, -1.4, -5.7)
    this.coreSpill.position.set(0, 0, -6.7)
    this.faceFill.position.set(0, 1.8, 8.5)
    this.scene.add(this.rig.root, this.coolSpill, this.warmSpill, this.coreSpill, this.faceFill)
  }

  estimateGpuBytes(): number {
    let bytes = 256 * 256 * 6 * 8 * 1.34
    for (const geometry of this.rig.geometries) {
      bytes += geometry.index?.array.byteLength ?? 0
      for (const name of Object.keys(geometry.attributes)) bytes += geometry.getAttribute(name)?.array.byteLength ?? 0
    }
    return Math.round(bytes)
  }

  draw(execution: Cinema2ModuleRenderExecutionContext, state: Readonly<Cinema2HypnotizeDrawState>): void {
    if (this.disposed) return
    if (!execution.depthAvailable || !execution.camera || !execution.lightingEnvironment) {
      throw new Error('Hypnotize requires final depth, camera, and lighting state.')
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
    this.scene.remove(this.rig.root, this.coolSpill, this.warmSpill, this.coreSpill, this.faceFill)
    for (const geometry of this.rig.geometries) geometry.dispose()
    for (const material of this.materialList) material.dispose()
    this.target.dispose()
  }

  private applyState(execution: Cinema2ModuleRenderExecutionContext & {
    camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
    lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
  }, state: Readonly<Cinema2HypnotizeDrawState>): void {
    const { THREE } = this.library
    const [structure, cool, warm, core, spectrum] = state.colors
    const pattern = state.patternFrame
    const profile = pattern.profile
    const phase = pattern.beats * Math.PI * 2
    const responseGain = 1 + state.overallEnergy * 0.32 + state.directorIntensity * 0.18
    const vocalRestraint = 1 - state.vocalPresence * 0.34
    const dropAmount = state.dropAccent * state.dropStrength
    const collapseBlackout = pattern.pattern === 'radiantCollapse' ? dropAmount * state.flashLevel * 0.68 : 0
    const emissionGate = 1 - collapseBlackout
    setSrgb(this.materials.structure.color, structure, THREE)
    this.materials.structure.color.multiplyScalar(0.25)
    setSrgb(this.materials.support.color, structure, THREE)
    this.materials.support.color.lerp(this.tempColor.setRGB(0.2, 0.24, 0.33), 0.48)
    setSrgb(this.materials.membrane.color, structure, THREE)
    this.materials.membrane.color.multiplyScalar(0.14)
    setEmitter(this.materials.cool, cool, THREE, (1.8 + state.coolGlow * 2.2) * state.intensity * responseGain * emissionGate)
    setEmitter(this.materials.warm, warm, THREE, (1.45 + state.coolGlow * (1.1 + profile.warmBias * 0.7)) * state.intensity * responseGain * emissionGate)
    setEmitter(this.materials.spectrum, spectrum, THREE, (1.5 + state.spectralDetail * 2.2 + state.highsAmount * 1.1 + state.snareAccent * 0.9) * state.intensity * vocalRestraint * emissionGate)
    setSrgb(this.materials.core.color, core, THREE)
    this.materials.core.color.multiplyScalar(0.44)
    setSrgb(this.materials.core.emissive, core, THREE)
    this.materials.core.emissiveIntensity = (0.9 + state.coreGlow * 1.9 + state.kickAccent * 1.6 + dropAmount * 2.1) * state.intensity * emissionGate
    setSrgb(this.materials.optical.color, core, THREE)
    this.materials.optical.color.multiplyScalar(0.42)
    setSrgb(this.materials.optical.emissive, spectrum, THREE)
    this.materials.optical.emissiveIntensity = (0.24 + state.coreGlow * 0.18 + state.highsAmount * 0.22) * state.intensity * emissionGate

    this.coolSpill.color.setRGB(cool[0], cool[1], cool[2], THREE.SRGBColorSpace)
    this.warmSpill.color.setRGB(warm[0], warm[1], warm[2], THREE.SRGBColorSpace)
    this.coreSpill.color.setRGB(core[0], core[1], core[2], THREE.SRGBColorSpace)
    this.coolSpill.intensity = (10 + state.coolGlow * 18) * state.intensity * responseGain * vocalRestraint * emissionGate
    this.warmSpill.intensity = (6 + state.coolGlow * (7 + profile.warmBias * 5)) * state.intensity * responseGain * emissionGate
    this.coreSpill.intensity = (14 + state.coreGlow * 24 + state.kickAccent * 15 + dropAmount * 22) * state.intensity * emissionGate
    this.faceFill.intensity = 2.4 + state.overallEnergy * 0.9

    const chamberBreath = 1 + state.pulseDepth * (state.bassPressure * 0.035 + state.kickAccent * 0.045 + state.directorImpact * 0.018)
    this.rig.root.scale.set(state.chamberRadius * chamberBreath, state.chamberRadius * chamberBreath, 1)
    this.rig.root.rotation.y = (state.perspectiveReveal - 0.5) * 0.42
    this.rig.root.rotation.x = (state.perspectiveReveal - 0.5) * -0.13
    this.rig.root.rotation.z = Math.sin(phase * 0.125) * profile.roll * state.rotationSpeed * 0.055
    const depthScale = state.tunnelDepth / 1.45
    const visibleCollars = Math.max(4, Math.round(4 + state.ringDensity * 4))
    for (let index = 0; index < this.rig.collars.length; index += 1) {
      const collar = this.rig.collars[index]!
      collar.visible = index < visibleCollars
      const depthChase = Math.sin(phase * (0.2 + profile.depthWave * 0.16) - index * 0.72) * state.travel * profile.depthWave * 0.42
      collar.position.z = 0.65 - index * 1.48 * depthScale + depthChase + state.downbeatAccent * (index % 2 === 0 ? 0.22 : -0.08)
      collar.rotation.z = phase * profile.collarRate * state.rotationSpeed * (1 + state.directorMomentum * 0.3) + index * state.counterRotation * 0.035
    }
    this.rig.architecture.scale.z = depthScale
    this.rig.architecture.position.z = Math.sin(phase * 0.25) * state.travel * profile.depthWave * 0.3
    this.rig.turbine.position.z = -3.8 * depthScale
    this.rig.turbine.rotation.z = phase * profile.turbineRate * state.rotationSpeed * (1 + state.directorMomentum * 0.35)
    const turbineHit = state.midAmount * 0.05 + state.kickAccent * state.pulseDepth * 0.13 + state.downbeatAccent * 0.07
    this.rig.turbine.scale.setScalar(1.22 * (1 + turbineHit + dropAmount * 0.08))
    this.rig.conductors.position.z = -3.1 * depthScale
    this.rig.conductors.rotation.z = phase * profile.conductorRate * state.rotationSpeed * (0.45 + state.counterRotation * 0.9)
    this.rig.conductors.scale.setScalar(1.08)
    this.rig.membrane.position.z = -3.4 * depthScale
    this.rig.membrane.rotation.z = phase * profile.membraneRate * state.rotationSpeed
    this.rig.core.position.z = -4.65 * depthScale
    this.rig.core.rotation.z = -phase * profile.conductorRate * state.rotationSpeed * 0.18
    this.rig.halo.position.z = -2.85 * depthScale
    const corePulse = state.pulseDepth * (state.bassPressure * 0.1 + state.kickAccent * 0.15 + state.directorImpact * 0.06) + dropAmount * 0.28
    this.rig.core.scale.setScalar(state.coreSize / 0.74 * profile.coreBias * (1 + corePulse))
    for (let index = 0; index < this.rig.vanes.length; index += 1) {
      const vane = this.rig.vanes[index]!
      const wave = Math.sin(phase * (0.5 + profile.vaneWave * 0.35) - index * 0.55)
      const extension = 1 + profile.vaneWave * (0.06 + wave * 0.055) + turbineHit * (0.35 + (index % 3) * 0.08)
      vane.scale.set(state.vaneLength / 1.08 * extension, 1, 1)
      vane.rotation.z = wave * profile.vaneWave * 0.035
    }
    const membraneWarp = state.membraneTension * (0.12 + state.lowMidAmount * 0.11 + state.fluxAmount * 0.06) * vocalRestraint
    const membraneScale = 1.08 + membraneWarp
    this.rig.membrane.scale.set(membraneScale, membraneScale, 1)
    this.rig.halo.visible = state.spectralDetail > 0.04
    this.rig.halo.rotation.z = phase * (0.04 + profile.haloGain * 0.09) * state.rotationSpeed
    this.rig.halo.scale.setScalar((0.96 + state.spectralDetail * 0.08 + state.phraseAccent * 0.1 + dropAmount * 0.18) * profile.haloGain)
    for (let index = 0; index < this.rig.exteriorResonators.length; index += 1) {
      const resonator = this.rig.exteriorResonators[index]!
      const relay = pattern.pattern === 'chromaticRelay' ? 0.5 + Math.sin(phase * 0.5 - index * 0.82) * 0.5 : 1
      const response = clamp((state.overallEnergy * 0.54 + state.bassPressure * (0.76 + index % 4 * 0.045) + state.kickAccent * 0.22) * profile.exteriorGain * relay, 0, 1)
      const pulse = 0.5 + Math.sin(state.timeSeconds * (1.4 + index * 0.13) + index * 1.7) * 0.5
      const scale = 1.5 * (1 + response * (0.045 + index % 4 * 0.008) * (0.42 + pulse * 0.58))
      const radialDrift = Math.sin(state.timeSeconds * (0.5 + index * 0.025) + index) * state.overallEnergy * profile.exteriorGain * 0.04
      resonator.group.scale.setScalar(scale)
      resonator.group.position.x = resonator.baseX + Math.cos(resonator.angle) * radialDrift
      resonator.group.position.y = resonator.baseY + Math.sin(resonator.angle) * radialDrift
      resonator.group.rotation.z = resonator.baseRotation + (index % 2 === 0 ? 1 : -1) * phase * (0.018 + state.counterRotation * 0.025) * state.rotationSpeed
      setEmitter(resonator.emitter, resonator.style === 0 ? cool : warm, THREE, (2.4 + response * 5.2 + state.snareAccent * 1.1) * state.intensity * emissionGate)
    }

    const ledSignals = {
      overallEnergy: state.overallEnergy,
      bassPressure: state.bassPressure,
      highsAmount: state.highsAmount,
      fluxAmount: state.fluxAmount,
      kickAccent: state.kickAccent,
      snareAccent: state.snareAccent,
      downbeatAccent: state.downbeatAccent,
      phraseAccent: state.phraseAccent,
      dropAccent: state.dropAccent,
    }
    for (const led of this.rig.ledSegments) {
      const drive = resolveCinema2HypnotizeLedDrive(pattern, led, ledSignals)
      const source = led.colorRole === 'warm' ? warm : led.colorRole === 'spectrum' ? spectrum : cool
      setSrgb(led.material.color, source, THREE)
      led.material.color.multiplyScalar(0.1 + Math.min(1, drive) * 0.16)
      setSrgb(led.material.emissive, source, THREE)
      const authoredDrive = Math.pow(Math.min(1.4, drive), 1.55)
      led.material.emissiveIntensity = (
        3.1
        + state.coolGlow * 0.8
        + profile.ledBloom * 0.7
        + authoredDrive * 12.5
        + state.highsAmount * 1.2
      ) * state.intensity * emissionGate
      const segmentPulse = 1 + Math.min(1.4, drive) * 0.13 + state.kickAccent * state.pulseDepth * 0.035
      led.mesh.scale.set(
        led.baseScale[0] * segmentPulse,
        led.baseScale[1] * segmentPulse,
        led.baseScale[2] * (1 + Math.min(1.4, drive) * 0.08),
      )
      led.mesh.position.z = led.baseZ + Math.min(1.4, drive) * 0.045
    }

    const quality = execution.lightingEnvironment.quality
    if (quality === 'low') this.rig.halo.visible = false
    this.scene.environmentIntensity = 0.68 * Math.max(0, execution.lightingEnvironment.environment.exposure)
    applyCinema2CameraFrame(this.camera, execution.camera)
    this.lightRig.update(execution.lightingEnvironment)
    this.renderer.shadowMap.enabled = quality === 'high' && this.lightRig.shadowCasterCount > 0
    this.renderer.shadowMap.type = THREE.PCFShadowMap
  }
}

function createMaterials(THREE: typeof ThreeNamespace): Cinema2HypnotizeMaterials {
  const materials = {
    structure: new THREE.MeshPhysicalMaterial({ color: 0x111722, metalness: 0.94, roughness: 0.29, clearcoat: 0.34, clearcoatRoughness: 0.2 }),
    support: new THREE.MeshPhysicalMaterial({ color: 0x252d3b, metalness: 0.84, roughness: 0.4, clearcoat: 0.18, clearcoatRoughness: 0.34 }),
    membrane: new THREE.MeshPhysicalMaterial({ color: 0x080b12, metalness: 0.72, roughness: 0.52, clearcoat: 0.5, clearcoatRoughness: 0.32 }),
    cool: new THREE.MeshStandardMaterial({ color: 0x0a5368, emissive: 0x25d8ff, emissiveIntensity: 4.8, metalness: 0.02, roughness: 0.16 }),
    warm: new THREE.MeshStandardMaterial({ color: 0x6b2408, emissive: 0xff6f23, emissiveIntensity: 4.4, metalness: 0.02, roughness: 0.17 }),
    core: new THREE.MeshPhysicalMaterial({ color: 0xd6f7ff, emissive: 0x8beeff, emissiveIntensity: 2.1, metalness: 0.14, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.035 }),
    optical: new THREE.MeshPhysicalMaterial({ color: 0x7edbff, emissive: 0x925cff, emissiveIntensity: 0.32, metalness: 0.02, roughness: 0.06, transmission: 0.72, thickness: 0.32, transparent: true, opacity: 0.34, clearcoat: 1, clearcoatRoughness: 0.025, depthWrite: false }),
    spectrum: new THREE.MeshStandardMaterial({ color: 0x351066, emissive: 0x9a4dff, emissiveIntensity: 4.6, metalness: 0.02, roughness: 0.18 }),
    blackout: new THREE.MeshStandardMaterial({ color: 0x010205, metalness: 0.78, roughness: 0.7, side: THREE.DoubleSide }),
  }
  materials.cool.toneMapped = false
  materials.warm.toneMapped = false
  materials.spectrum.toneMapped = false
  return Object.freeze(materials)
}

function setEmitter(
  material: ThreeNamespace.MeshStandardMaterial,
  source: readonly [number, number, number],
  THREE: typeof ThreeNamespace,
  intensity: number,
): void {
  material.color.setRGB(source[0], source[1], source[2], THREE.SRGBColorSpace).multiplyScalar(0.11)
  material.emissive.setRGB(source[0], source[1], source[2], THREE.SRGBColorSpace)
  material.emissiveIntensity = intensity
}

function setSrgb(target: ThreeNamespace.Color, source: readonly [number, number, number], THREE: typeof ThreeNamespace): void {
  target.setRGB(source[0], source[1], source[2], THREE.SRGBColorSpace)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
