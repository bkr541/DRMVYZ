import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2SayItBridge, type Cinema2SayItDrawState } from '../sayIt/Cinema2SayItBridge'
import type { Cinema2SayItQualityProfile } from '../sayIt/Cinema2SayItQuality'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { resolveSubmergeGlyphPoses, submergeMotionAmount, submergePatternFromController, type Cinema2SubmergeState } from './Cinema2SubmergeMotion'

/** Extends the shared glyph renderer; all GPU work remains inside its host/GL-state guard. */
export class Cinema2SubmergeBridge extends Cinema2SayItBridge {
  private readonly architecture: Three.Group
  private readonly arches: Three.Group[] = []
  private readonly ownedGeometries = new Set<Three.BufferGeometry>()
  private readonly ownedMaterials = new Set<Three.Material>()
  private readonly bubbles: Three.InstancedMesh
  private readonly particles: Three.Points<Three.BufferGeometry, Three.PointsMaterial>
  private readonly particlePositions = new Float32Array(384 * 3)
  private readonly dummy: Three.Object3D
  private readonly fog: Three.FogExp2
  private readonly stone: Three.MeshStandardMaterial
  private readonly floorInlay: Three.MeshBasicMaterial
  private readonly causticUniforms = { time: { value: 0 }, strength: { value: 0.75 }, tint: { value: null as unknown as Three.Color } }
  private readonly seeds = Float32Array.from({ length: 384 * 3 }, (_, index) => {
    const value = Math.sin((index + 1) * 127.1) * 43758.5453
    return value - Math.floor(value)
  })
  private released = false

  constructor(gl: WebGL2RenderingContext, library: Cinema2ThreeLibrary, asset: Readonly<Cinema2ThreeLoadedAsset>, private readonly getState: () => Readonly<Cinema2SubmergeState>) {
    super(gl, library, asset)
    const { THREE } = library
    this.dummy = new THREE.Object3D()
    this.fog = new THREE.FogExp2(0x07303d, 0.055)
    this.scene.fog = this.fog
    this.scene.background = new THREE.Color(0x07303d)
    this.causticUniforms.tint.value = new THREE.Color(0x70d8e5)
    this.architecture = new THREE.Group()
    this.scene.add(this.architecture)
    this.stone = this.material(new THREE.MeshStandardMaterial({ color: 0x337584, roughness: 0.65, metalness: 0.18, transparent: true }))
    this.stone.onBeforeCompile = shader => {
      shader.uniforms.uWaterTime = this.causticUniforms.time
      shader.uniforms.uWaterStrength = this.causticUniforms.strength
      shader.uniforms.uWaterTint = this.causticUniforms.tint
      shader.vertexShader = `varying vec3 vWaterPosition;\n${shader.vertexShader}`
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWaterPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = `varying vec3 vWaterPosition; uniform float uWaterTime; uniform float uWaterStrength; uniform vec3 uWaterTint;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', `#include <color_fragment>
          float floorWeight = 1.0 - smoothstep(-3.15, -3.05, vWaterPosition.y);
          float frontFade = smoothstep(-5.0, -1.5, vWaterPosition.z);
          diffuseColor.a *= 1.0 - floorWeight * frontFade;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 waterUV = vWaterPosition.xz * 2.1 + vWaterPosition.y * 0.55;
          float a = sin(waterUV.x + sin(waterUV.y * 1.31 + uWaterTime * 0.55));
          float b = sin(waterUV.y * 1.2 - cos(waterUV.x * 1.1 - uWaterTime * 0.42));
          float caustic = pow(max(0.0, 1.0 - abs(a + b)), 5.0);
          totalEmissiveRadiance += uWaterTint * caustic * uWaterStrength * 1.3;`)
    }
    this.stone.customProgramCacheKey = () => 'submerge-water-caustics-v2'
    // Keep the nearest floor edge behind the entire glyph envelope, even at maximum depth.
    const floor = new THREE.Mesh(this.geometry(new THREE.PlaneGeometry(34, 54)), this.stone)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, -3.15, -28.5)
    floor.receiveShadow = true
    this.architecture.add(floor)
    const inlay = this.floorInlay = this.material(new THREE.MeshBasicMaterial({ color: 0x5298a2, transparent: true, opacity: 0.24, depthWrite: false }))
    const seam = this.geometry(new THREE.BoxGeometry(0.018, 0.009, 51))
    for (const x of [-3.1, -2.95, 2.95, 3.1]) {
      const strip = new THREE.Mesh(seam, inlay)
      strip.position.set(x, -3.14, -30)
      this.architecture.add(strip)
    }
    const column = this.geometry(new THREE.CylinderGeometry(0.16, 0.22, 5.2, 12))
    const plinth = this.geometry(new THREE.BoxGeometry(0.7, 0.22, 0.7))
    const arch = this.geometry(new THREE.TorusGeometry(3.85, 0.16, 8, 40, Math.PI))
    for (let index = 0; index < 10; index += 1) {
      const bay = new THREE.Group()
      bay.position.z = 1.1 - index * 4.4
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(column, this.stone)
        pillar.position.set(side * 3.85, -0.45, 0)
        pillar.castShadow = true
        pillar.receiveShadow = true
        bay.add(pillar)
        for (const y of [-3.04, 2.15]) {
          const base = new THREE.Mesh(plinth, this.stone)
          base.position.set(side * 3.85, y, 0)
          bay.add(base)
        }
      }
      const crown = new THREE.Mesh(arch, this.stone)
      crown.position.y = 2.15
      bay.add(crown)
      this.architecture.add(bay)
      this.arches.push(bay)
    }
    const particleGeometry = this.geometry(new THREE.BufferGeometry())
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
    const particleMaterial = this.material(new THREE.PointsMaterial({ color: 0x9be8eb, size: 0.04, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.particles = new THREE.Points(particleGeometry, particleMaterial)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)
    const bubbleMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x92dfe8, metalness: 0.5, roughness: 0.13, transparent: true, opacity: 0.28, depthWrite: false }))
    this.bubbles = new THREE.InstancedMesh(this.geometry(new THREE.SphereGeometry(1, 8, 6)), bubbleMaterial, 96)
    this.bubbles.frustumCulled = false
    this.scene.add(this.bubbles)
  }

  protected override applyState(exec: Cinema2ModuleRenderExecutionContext & { camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>; lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']> }, draw: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): void {
    const state = this.getState()
    const pattern = submergePatternFromController(draw.pattern)
    const poses = resolveSubmergeGlyphPoses(draw.poses, pattern, draw.patternPhaseBeats, state)
    // Geometric patterns never strobe the glyphs: illumination stays continuous and readable.
    super.applyState(exec, { ...draw, poses, pattern: 'solid', ledMusicIntensity: 0.14 + state.energy * 0.10 + state.highs * 0.08 }, profile)
    const { THREE } = this.library
    const [r, g, b] = state.water
    this.fog.color.setRGB(r, g, b, THREE.SRGBColorSpace)
    this.fog.density = state.haze
    ;(this.scene.background as Three.Color).copy(this.fog.color)
    this.causticUniforms.time.value = state.beats * 0.5
    this.causticUniforms.strength.value = state.caustics * (0.65 + state.mids * 0.85 + state.bass * 0.25)
    this.causticUniforms.tint.value.setRGB(Math.min(1, r + 0.2), Math.min(1, g + 0.55), Math.min(1, b + 0.6), THREE.SRGBColorSpace)
    this.architecture.visible = state.architecture > 0
    this.stone.opacity = state.architecture
    this.floorInlay.opacity = state.architecture * (0.12 + state.bass * 0.2)
    const amount = submergeMotionAmount(state)
    const structuralMotion = amount * state.reach
    const t = draw.patternPhaseBeats * Math.PI / state.period
    for (let index = 0; index < this.arches.length; index += 1) {
      const bay = this.arches[index]!
      const phase = t - index * 0.6
      bay.position.x = pattern === 'undertow' ? Math.sin(phase) * 0.18 * structuralMotion : 0
      bay.position.y = pattern === 'upwelling' ? Math.sin(phase * 1.8) * 0.15 * structuralMotion : 0
      bay.rotation.z = pattern === 'vortex' ? Math.sin(phase) * 0.055 * structuralMotion : pattern === 'crosscurrent' ? (index % 2 ? 1 : -1) * Math.sin(t) * 0.035 * structuralMotion : 0
      const expansion = pattern === 'pressure-wave' ? Math.sin(phase * 2.2) * 0.025 * (1 + state.bass) : pattern === 'suspension' ? Math.sin(phase * 0.5) * 0.008 : 0
      bay.scale.setScalar(1 + expansion * structuralMotion)
      bay.visible = index < (profile.quality === 'low' ? 5 : profile.quality === 'medium' ? 7 : 10)
    }
    for (const glyph of this.glyphs) {
      const glass = state.material === 'glass'
      if (glyph.material.transparent !== glass) { glyph.material.transparent = glass; glyph.material.needsUpdate = true }
      glyph.material.opacity = glass ? 0.65 : 1
      glyph.material.depthWrite = !glass
      glyph.material.metalness = state.material === 'metal' ? 0.9 : glass ? 0.12 : 0.04
      glyph.material.roughness = glass ? Math.max(profile.roughnessFloor, draw.roughness * 0.5) : draw.roughness
      glyph.mesh.scale.z = state.depth
      glyph.ledMesh.scale.z = state.depth
    }
    const count = Math.round((profile.quality === 'low' ? 96 : profile.quality === 'medium' ? 192 : 384) * state.particles)
    const time = state.beats * 0.5
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      this.particlePositions[offset] = (this.seeds[offset]! - 0.5) * 17 + Math.sin(time * 0.2 + index) * 0.16 * amount
      this.particlePositions[offset + 1] = ((this.seeds[offset + 1]! * 9 + time * 0.045 * amount) % 9) - 2.5
      this.particlePositions[offset + 2] = -this.seeds[offset + 2]! * 25
    }
    this.particles.geometry.setDrawRange(0, count)
    this.particles.geometry.getAttribute('position').needsUpdate = true
    this.particles.material.opacity = 0.24 + state.highs * 0.3
    this.bubbles.count = Math.round((profile.quality === 'low' ? 24 : profile.quality === 'medium' ? 48 : 96) * state.bubbles)
    for (let index = 0; index < this.bubbles.count; index += 1) {
      const seed = this.seeds[index * 3]!
      const speed = (pattern === 'upwelling' ? 0.7 : 0.32) * (1 + state.highs * 0.7) * amount
      this.dummy.position.set((index % 2 ? 1 : -1) * (2.9 + seed * 1.1) + Math.sin(time * 0.6 + index) * 0.1 * amount,
        ((this.seeds[index * 3 + 1]! * 7 + time * speed) % 7) - 2,
        -this.seeds[index * 3 + 2]! * 13)
      this.dummy.scale.setScalar(0.018 + seed * 0.045)
      this.dummy.updateMatrix()
      this.bubbles.setMatrixAt(index, this.dummy.matrix)
    }
    this.bubbles.instanceMatrix.needsUpdate = true
  }

  override estimateGpuBytes(): number {
    let bytes = super.estimateGpuBytes() + 96 * 16 * 4
    for (const geometry of this.ownedGeometries) {
      for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength
      bytes += geometry.index?.array.byteLength ?? 0
    }
    return bytes
  }
  override dispose(): void {
    if (this.released) return
    this.released = true
    this.scene.remove(this.architecture, this.particles, this.bubbles)
    for (const geometry of this.ownedGeometries) geometry.dispose()
    for (const material of this.ownedMaterials) material.dispose()
    this.bubbles.dispose()
    super.dispose()
  }
  private geometry<T extends Three.BufferGeometry>(geometry: T): T { this.ownedGeometries.add(geometry); return geometry }
  private material<T extends Three.Material>(material: T): T { this.ownedMaterials.add(material); return material }
}
