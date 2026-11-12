import type * as Three from 'three'
import type { Cinema2ModuleRenderExecutionContext } from '../Cinema2ModuleContracts'
import { Cinema2SayItBridge, type Cinema2SayItDrawState } from '../sayIt/Cinema2SayItBridge'
import type { Cinema2SayItQualityProfile } from '../sayIt/Cinema2SayItQuality'
import type { Cinema2ThreeLoadedAsset } from '../three/Cinema2ThreeAssetCache'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import { orbitalPattern, resolveOrbitalGlyphs, resolveOrbitalPose, type OrbitalMotionInput } from './Cinema2OrbitalMotion'

export interface OrbitalDrawSettings extends Omit<OrbitalMotionInput, 'phaseBeats'> {
  size: number
  depth: number
  planet: number
  debris: number
  material: 'artifact' | 'polished' | 'amethyst'
}

type OrbitalExecution = Cinema2ModuleRenderExecutionContext & {
  camera: NonNullable<Cinema2ModuleRenderExecutionContext['camera']>
  lightingEnvironment: NonNullable<Cinema2ModuleRenderExecutionContext['lightingEnvironment']>
}

const MAX_DEBRIS = 40

/** Draws the supplied metal sphere; lettering shares its physical material and textures. */
export class Cinema2OrbitalBridge extends Cinema2SayItBridge {
  private readonly instrument: Three.Group
  private readonly sourceMaterial: Three.MeshStandardMaterial
  private readonly mixer: Three.AnimationMixer
  private readonly normalization: number
  private readonly debris: Three.InstancedMesh
  private readonly stars: Three.Points
  private readonly dummy: Three.Object3D
  private readonly glyphGeometry = new Map<Three.BufferGeometry, Three.BufferGeometry>()
  private readonly ownedGeometries: Three.BufferGeometry[] = []
  private readonly ownedMaterials: Three.Material[] = []
  private readonly seeds: Float32Array
  private disposedOrbital = false

  constructor(
    gl: WebGL2RenderingContext, library: Cinema2ThreeLibrary, glyphs: Readonly<Cinema2ThreeLoadedAsset>,
    private readonly rig: Readonly<Cinema2ThreeLoadedAsset>, instance: Three.Object3D,
    private readonly settings: () => Readonly<OrbitalDrawSettings>,
    sample: (index: number) => number,
  ) {
    let material: Three.MeshStandardMaterial | undefined
    instance.traverse(object => {
      const mesh = object as Three.Mesh
      if (!mesh.isMesh) return
      const candidate = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if ((candidate as Three.MeshStandardMaterial)?.isMeshStandardMaterial) material ??= candidate as Three.MeshStandardMaterial
    })
    if (!material?.map || !material.normalMap) throw new Error('ORBITAL requires the supplied metal sphere and its PBR texture maps.')
    super(gl, library, glyphs)
    const { THREE } = library
    this.seeds = Float32Array.from({ length: 1100 }, (_, index) => sample(index))
    this.dummy = new THREE.Object3D()
    this.sourceMaterial = material
    this.mixer = new THREE.AnimationMixer(instance)
    for (const clip of rig.animations) this.mixer.clipAction(clip).play()
    instance.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(instance, true)
    const center = bounds.getCenter(new THREE.Vector3())
    this.normalization = 2 / Math.max(.01, ...bounds.getSize(new THREE.Vector3()).toArray())
    const centered = new THREE.Group()
    centered.position.copy(center).negate()
    centered.add(instance)
    this.instrument = new THREE.Group()
    this.instrument.add(centered)
    this.scene.add(this.instrument)

    const starGeometry = this.geometry(new THREE.BufferGeometry())
    const starPositions = new Float32Array(320 * 3)
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (this.seeds[index]! - .5) * 51
      starPositions[index + 1] = (this.seeds[index + 1]! - .5) * 45
      starPositions[index + 2] = -15 - this.seeds[index + 2]! * 19
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    this.stars = new THREE.Points(starGeometry, this.material(new THREE.PointsMaterial({ color: 0xb5c6d0, size: .065, transparent: true, opacity: .66, depthWrite: false })))
    this.scene.add(this.stars)
    this.debris = new THREE.InstancedMesh(this.geometry(new THREE.IcosahedronGeometry(1, 0)),
      this.material(new THREE.MeshStandardMaterial({ color: 0x737c82, metalness: .6, roughness: .67 })), MAX_DEBRIS)
    this.debris.frustumCulled = false
    this.scene.add(this.debris)
  }

  protected override applyState(exec: OrbitalExecution, draw: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): void {
    const settings = this.settings()
    const pattern = orbitalPattern(draw.pattern)
    const motion = { ...settings, phaseBeats: draw.patternPhaseBeats }
    const movement = resolveOrbitalPose(pattern, motion)
    const sphereRadius = 3.2 * settings.size
    const wrapRadius = Math.max(8, sphereRadius * 1.8)
    const curved = resolveOrbitalGlyphs(draw.poses, pattern, motion).map(glyph => {
      const angle = glyph.position[0] / wrapRadius
      return { ...glyph, position: [Math.sin(angle)*wrapRadius, glyph.position[1], glyph.position[2] + wrapRadius*(Math.cos(angle)-1)] as const,
        rotation: [glyph.rotation[0], glyph.rotation[1]+angle, glyph.rotation[2]] as const }
    })
    super.applyState(exec, {
      ...draw, pattern: 'solid', ledOutlineEnabled: false, ledMusicIntensity: 0,
      poses: curved,
    }, profile)

    const radius = 3.2 * settings.size * (1 + movement.expansion)
    this.instrument.position.set(0, .34 + movement.lift, -2.2 - radius)
    this.instrument.rotation.set(.13 + movement.tilt[0], 1.26 + movement.tilt[1], -.13 + movement.tilt[2])
    this.instrument.scale.setScalar(radius * this.normalization)
    this.mixer.setTime((draw.absoluteBeat ?? draw.patternPhaseBeats) * .12 * settings.amount * settings.ringTravel)
    this.scene.environmentIntensity *= .25
    this.stars.geometry.setDrawRange(0, profile.quality === 'low' ? 180 : 320)
    this.updateDebris(settings, draw.absoluteBeat ?? 0, profile)
    this.applyLetterMaterial(draw, settings)
  }

  private applyLetterMaterial(draw: Readonly<Cinema2SayItDrawState>, settings: Readonly<OrbitalDrawSettings>): void {
    const mapped = settings.material === 'artifact'
    for (const glyph of this.glyphs) {
      if (!glyph.material.userData.orbitalSphere) {
        glyph.material.dispose()
        glyph.material = this.sourceMaterial.clone()
        glyph.material.userData.orbitalSphere = true
        glyph.mesh.material = glyph.material
      }
      const material = glyph.material
      const map = mapped ? this.sourceMaterial.map : null
      if (material.map !== map) {
        material.map = map
        material.normalMap = mapped ? this.sourceMaterial.normalMap : null
        material.roughnessMap = mapped ? this.sourceMaterial.roughnessMap : null
        material.metalnessMap = mapped ? this.sourceMaterial.metalnessMap : null
        material.needsUpdate = true
      }
      if (!glyph.mesh.geometry.userData.orbitalAtlas) glyph.mesh.geometry = this.atlasGeometry(glyph.mesh.geometry)
      material.color.setRGB(...draw.color, this.library.THREE.SRGBColorSpace).multiply(this.sourceMaterial.color)
      material.emissive.copy(this.sourceMaterial.emissive)
      material.emissiveIntensity = this.sourceMaterial.emissiveIntensity
      material.metalness = mapped ? this.sourceMaterial.metalness : .9
      material.roughness = mapped ? Math.min(1,this.sourceMaterial.roughness * draw.roughness / .54) : settings.material === 'amethyst' ? Math.max(.45,draw.roughness) : draw.roughness
      material.normalScale.copy(this.sourceMaterial.normalScale)
      glyph.mesh.scale.z = settings.depth
      glyph.ledMesh.scale.z = settings.depth
    }
  }

  /** Reproject glyphs across the supplied sphere texture without the old gyroscope atlas offsets. */
  private atlasGeometry(source: Three.BufferGeometry): Three.BufferGeometry {
    const cached = this.glyphGeometry.get(source)
    if (cached) return cached
    const geometry = source.clone()
    geometry.computeBoundingBox()
    geometry.deleteAttribute('tangent')
    geometry.userData.orbitalAtlas = true
    const bounds = geometry.boundingBox!
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const uvs = new Float32Array(position.count * 2)
    const spanX = Math.max(.001, bounds.max.x - bounds.min.x)
    const spanY = Math.max(.001, bounds.max.y - bounds.min.y)
    for (let index = 0; index < position.count; index += 1) {
      const x = (position.getX(index) - bounds.min.x) / spanX
      const y = (bounds.max.y - position.getY(index)) / spanY
      const face = Math.abs(normal.getZ(index)) > .8
      uvs[index * 2] = face ? x : (position.getZ(index) - bounds.min.z) / Math.max(.001,bounds.max.z-bounds.min.z)
      uvs[index * 2 + 1] = y
    }
    geometry.setAttribute('uv', new this.library.THREE.BufferAttribute(uvs, 2))
    this.glyphGeometry.set(source, geometry)
    return geometry
  }

  private updateDebris(settings: Readonly<OrbitalDrawSettings>, beats: number, profile: Readonly<Cinema2SayItQualityProfile>): void {
    const limit = profile.quality === 'low' ? 16 : profile.quality === 'medium' ? 28 : MAX_DEBRIS
    this.debris.count = Math.round(limit * settings.debris)
    const drift = beats * .017 * settings.amount
    for (let index = 0; index < this.debris.count; index += 1) {
      const seed = this.seeds[index * 3]!
      const radius = 3.45 + this.seeds[index * 3 + 1]! * 3.6 + settings.bass * .24 * settings.amount
      const theta = seed * Math.PI * 2 + drift
      this.dummy.position.set(Math.cos(theta) * radius, Math.sin(theta) * radius * .68, -7 - this.seeds[index * 3 + 2]! * 8)
      this.dummy.rotation.set(seed + drift, seed * 4, theta)
      this.dummy.scale.setScalar((.023 + seed * .087) * (1 + settings.highs * .42 * settings.amount))
      this.dummy.updateMatrix()
      this.debris.setMatrixAt(index, this.dummy.matrix)
    }
    this.debris.instanceMatrix.needsUpdate = true
  }

  override estimateGpuBytes(): number {
    // The parent accounts for active glyphs and their shared atlas. Count each map once.
    const parentBytes = super.estimateGpuBytes()
    const sphereMaps = new Set(Object.values(this.sourceMaterial).filter((value): value is Three.Texture => !!value && (value as Three.Texture).isTexture === true))
    const sharedMaps = new Set(this.glyphs.flatMap(glyph => Object.values(glyph.material).filter((value): value is Three.Texture => sphereMaps.has(value as Three.Texture))))
    let duplicateBytes = 0
    for (const texture of sharedMaps) {
      const image = texture?.image as { width?: number; height?: number } | undefined
      if (image?.width && image.height) duplicateBytes += image.width * image.height * 4 * (texture?.generateMipmaps ? 1.34 : 1)
    }
    let geometryBytes = 0
    const active = new Set(this.glyphs.map(glyph => glyph.mesh.geometry))
    for (const geometry of [...this.ownedGeometries, ...this.glyphGeometry.values()]) {
      if (active.has(geometry)) continue
      for (const attribute of Object.values(geometry.attributes)) geometryBytes += (attribute as Three.BufferAttribute).array.byteLength
      geometryBytes += geometry.index?.array.byteLength ?? 0
    }
    return Math.round(parentBytes + this.rig.gpuBytes - duplicateBytes + geometryBytes + MAX_DEBRIS * 64)
  }

  override dispose(): void {
    if (this.disposedOrbital) return
    this.disposedOrbital = true
    this.scene.remove(this.instrument, this.stars, this.debris)
    this.debris.dispose()
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
    for (const geometry of this.ownedGeometries) geometry.dispose()
    for (const geometry of this.glyphGeometry.values()) geometry.dispose()
    for (const material of this.ownedMaterials) material.dispose()
    this.glyphGeometry.clear()
    super.dispose()
  }

  private geometry<T extends Three.BufferGeometry>(value: T): T { this.ownedGeometries.push(value); return value }
  private material<T extends Three.Material>(value: T): T { this.ownedMaterials.push(value); return value }
}
