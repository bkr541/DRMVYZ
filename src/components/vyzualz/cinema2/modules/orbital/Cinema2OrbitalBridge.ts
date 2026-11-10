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

interface RingJoint {
  bone: Three.Bone
  restRotation: Three.Quaternion
  restPosition: Three.Vector3
  pivot: Three.Vector3
  axis: Three.Vector3
}

const MAX_DEBRIS = 40

/** Draws the imported skinned gyroscope and applies the same PBR atlas to the text. */
export class Cinema2OrbitalBridge extends Cinema2SayItBridge {
  private readonly instrument: Three.Group
  private readonly skinnedMesh: Three.SkinnedMesh
  private readonly sourceMaterial: Three.MeshStandardMaterial
  private readonly artifactMaterial: Three.MeshStandardMaterial
  private readonly rings: RingJoint[]
  private readonly normalization: number
  private readonly arms: Three.Group
  private readonly markerMaterial: Three.MeshStandardMaterial
  private readonly planetMaterial: Three.ShaderMaterial
  private readonly planet: Three.Mesh
  private readonly debris: Three.InstancedMesh
  private readonly stars: Three.Points
  private readonly dummy: Three.Object3D
  private readonly amethyst: Three.Color
  private readonly rotation: Three.Quaternion
  private readonly offset: Three.Vector3
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
    // Validate the imported asset before acquiring render targets and material instances.
    const skinned = instance.getObjectByProperty('isSkinnedMesh', true) as Three.SkinnedMesh | undefined
    const material = skinned?.material as Three.MeshStandardMaterial | undefined
    const joints = ['ringouter', 'ringmiddle', 'ringinner'].map(name => skinned?.skeleton.bones.find(bone => bone.name.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(name)))
    if (!skinned || !material?.isMeshStandardMaterial || !material.map || !material.normalMap || joints.some(bone => !bone)) {
      throw new Error('ORBITAL requires the supplied gyroscope rig and its PBR texture atlas.')
    }
    super(gl, library, glyphs)
    const { THREE } = library
    this.seeds = Float32Array.from({ length: 1100 }, (_, index) => sample(index))
    this.dummy = new THREE.Object3D()
    this.rotation = new THREE.Quaternion()
    this.amethyst = new THREE.Color(0x9a50d6)
    this.offset = new THREE.Vector3()
    this.sourceMaterial = material
    this.artifactMaterial = this.material(material.clone())
    this.skinnedMesh = skinned
    skinned.material = this.artifactMaterial
    skinned.frustumCulled = false
    instance.updateMatrixWorld(true)
    skinned.skeleton.update()
    const bounds = new THREE.Box3().setFromObject(instance, true)
    const center = bounds.getCenter(new THREE.Vector3())
    this.normalization = 1 / Math.max(.01, bounds.getSize(new THREE.Vector3()).length() * .5)
    // Each authored joint shares the center of the instrument as its rotation pivot.
    this.rings = joints.map((joint, index) => {
      const bone = joint!
      return {
        bone, restRotation: bone.quaternion.clone(), restPosition: bone.position.clone(),
        pivot: bone.worldToLocal(center.clone()),
        axis: new THREE.Vector3(index === 1 ? 0 : 1, index === 1 ? 1 : 0, 0),
      }
    })
    const centered = new THREE.Group()
    centered.position.copy(center).negate()
    centered.add(instance)
    this.instrument = new THREE.Group()
    this.instrument.add(centered)
    this.scene.add(this.instrument)

    this.arms = new THREE.Group()
    const strutMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x8c6635, metalness: .78, roughness: .5 }))
    this.markerMaterial = this.material(new THREE.MeshStandardMaterial({ color: 0x391c68, emissive: 0x6737cc, metalness: .45, roughness: .3 }))
    const strut = this.geometry(new THREE.BoxGeometry(1.05, .055, .12))
    const collar = this.geometry(new THREE.CylinderGeometry(.11, .12, .16, 8))
    const lamp = this.geometry(new THREE.SphereGeometry(.067, 8, 6))
    for (let index = 0; index < 8; index += 1) {
      const mount = new THREE.Group()
      mount.rotation.z = index * Math.PI / 4
      const spar = new THREE.Mesh(strut, strutMaterial)
      spar.position.x = 3.58
      const socket = new THREE.Mesh(collar, strutMaterial)
      socket.rotation.z = Math.PI / 2
      socket.position.x = 3.1
      const indicator = new THREE.Mesh(lamp, this.markerMaterial)
      indicator.position.set(3.04, 0, .11)
      mount.add(spar, socket, indicator)
      this.arms.add(mount)
    }
    this.arms.position.z = -5.7
    this.scene.add(this.arms)

    this.planetMaterial = this.material(new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { visibility: { value: .8 }, limb: { value: new THREE.Color(0x7f55d8) } },
      vertexShader: `varying vec3 vViewNormal; varying vec3 vViewPosition; varying vec3 vLocal;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -viewPosition.xyz;
          vViewNormal = normalize(normalMatrix * normal);
          vLocal = position;
          gl_Position = projectionMatrix * viewPosition;
        }`,
      fragmentShader: `uniform float visibility; uniform vec3 limb;
        varying vec3 vViewNormal; varying vec3 vViewPosition; varying vec3 vLocal;
        void main() {
          float facing = max(0.0, dot(normalize(vViewNormal), normalize(vViewPosition)));
          float rim = pow(1.0 - facing, 5.0);
          float bands = 0.5 + 0.5 * sin(vLocal.y * 2.3 + sin(vLocal.x * 1.9) * 0.45);
          vec3 body = vec3(0.016, 0.008, 0.043) * (0.7 + bands * 0.6);
          gl_FragColor = vec4(body + limb * rim * 0.95, visibility * smoothstep(0.0, 0.045, facing));
          #include <colorspace_fragment>
        }`,
    }))
    this.planet = new THREE.Mesh(this.geometry(new THREE.SphereGeometry(15, 48, 24)), this.planetMaterial)
    this.planet.position.set(7, -19, -23)
    this.scene.add(this.planet)

    const starGeometry = this.geometry(new THREE.BufferGeometry())
    const starPositions = new Float32Array(320 * 3)
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (this.seeds[index]! - .5) * 51
      starPositions[index + 1] = (this.seeds[index + 1]! - .5) * 45
      starPositions[index + 2] = -15 - this.seeds[index + 2]! * 19
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    this.stars = new THREE.Points(starGeometry, this.material(new THREE.PointsMaterial({ color: 0xc7c3f8, size: .065, transparent: true, opacity: .66, depthWrite: false })))
    this.scene.add(this.stars)
    this.debris = new THREE.InstancedMesh(this.geometry(new THREE.IcosahedronGeometry(1, 0)),
      this.material(new THREE.MeshStandardMaterial({ color: 0x847082, metalness: .6, roughness: .67, emissive: 0x251747, emissiveIntensity: .17 })), MAX_DEBRIS)
    this.debris.frustumCulled = false
    this.scene.add(this.debris)
  }

  protected override applyState(exec: OrbitalExecution, draw: Readonly<Cinema2SayItDrawState>, profile: Readonly<Cinema2SayItQualityProfile>): void {
    const settings = this.settings()
    const pattern = orbitalPattern(draw.pattern)
    const motion = { ...settings, phaseBeats: draw.patternPhaseBeats }
    const movement = resolveOrbitalPose(pattern, motion)
    super.applyState(exec, {
      ...draw, pattern: 'solid', ledMusicIntensity: .10 + settings.highs * .07,
      poses: resolveOrbitalGlyphs(draw.poses, pattern, motion),
    }, profile)

    const { THREE } = this.library
    const radius = 4.8 * settings.size * (1 + movement.expansion)
    this.instrument.position.set(0, .34 + movement.lift, -1.2 - radius)
    this.instrument.rotation.set(.13 + movement.tilt[0], 1.26 + movement.tilt[1], -.13 + movement.tilt[2])
    this.instrument.scale.setScalar(radius * this.normalization)
    for (const [index, ring] of this.rings.entries()) {
      ring.bone.quaternion.copy(ring.restRotation).multiply(this.rotation.setFromAxisAngle(ring.axis, movement.rings[index]!))
      this.offset.copy(ring.pivot).applyQuaternion(ring.restRotation)
      ring.bone.position.copy(ring.restPosition).add(this.offset)
      this.offset.copy(ring.pivot).applyQuaternion(ring.bone.quaternion)
      ring.bone.position.sub(this.offset)
    }
    this.artifactMaterial.emissiveIntensity = 1 + settings.highs * 1.6 + settings.beat * .4
    this.arms.rotation.set(.12, movement.tilt[1] * .6, movement.armPhase - .18)
    this.arms.scale.setScalar(settings.size * (1 + movement.expansion * .7))
    this.arms.position.z = -1.2 - radius
    this.markerMaterial.emissive.setRGB(...draw.outlineColor, THREE.SRGBColorSpace)
    this.markerMaterial.emissiveIntensity = .6 + settings.highs * 1.3 + settings.beat * .5
    this.planet.visible = settings.planet > 0
    this.planetMaterial.uniforms.visibility!.value = settings.planet
    ;(this.planetMaterial.uniforms.limb!.value as Three.Color).setRGB(...draw.outlineColor, THREE.SRGBColorSpace)
    this.stars.geometry.setDrawRange(0, profile.quality === 'low' ? 180 : 320)
    this.updateDebris(settings, draw.absoluteBeat ?? 0, profile)
    this.applyLetterMaterial(draw, settings)
  }

  private applyLetterMaterial(draw: Readonly<Cinema2SayItDrawState>, settings: Readonly<OrbitalDrawSettings>): void {
    const mapped = settings.material === 'artifact'
    for (const glyph of this.glyphs) {
      const material = glyph.material
      const map = mapped ? this.sourceMaterial.map : null
      if (material.map !== map) {
        material.map = map
        material.normalMap = mapped ? this.sourceMaterial.normalMap : null
        material.roughnessMap = mapped ? this.sourceMaterial.roughnessMap : null
        material.metalnessMap = mapped ? this.sourceMaterial.metalnessMap : null
        material.needsUpdate = true
      }
      if (mapped && !glyph.mesh.geometry.userData.orbitalAtlas) glyph.mesh.geometry = this.atlasGeometry(glyph.mesh.geometry)
      material.metalness = mapped ? .85 : settings.material === 'polished' ? .82 : .39
      material.roughness = mapped ? Math.min(1, .28 + draw.roughness) : draw.roughness
      material.normalScale.set(.48, -.48)
      if (settings.material === 'amethyst') material.color.multiply(this.amethyst)
      glyph.mesh.scale.z = settings.depth
      glyph.ledMesh.scale.z = settings.depth
    }
  }

  /** Each glyph samples the brass face and engraved strip of the supplied atlas in local space. */
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
      uvs[index * 2] = face ? .244 + x * .088 : .129 + x * .226
      uvs[index * 2 + 1] = face ? .44 + y * .27 : .053 + y * .062
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
    const sharedMaps = this.settings().material === 'artifact' && this.glyphs.length
      ? new Set([this.sourceMaterial.map, this.sourceMaterial.normalMap, this.sourceMaterial.roughnessMap, this.sourceMaterial.metalnessMap]) : new Set<Three.Texture | null>()
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
    this.scene.remove(this.instrument, this.arms, this.planet, this.stars, this.debris)
    this.debris.dispose()
    this.skinnedMesh.skeleton.dispose()
    for (const geometry of this.ownedGeometries) geometry.dispose()
    for (const geometry of this.glyphGeometry.values()) geometry.dispose()
    for (const material of this.ownedMaterials) material.dispose()
    this.glyphGeometry.clear()
    super.dispose()
  }

  private geometry<T extends Three.BufferGeometry>(value: T): T { this.ownedGeometries.push(value); return value }
  private material<T extends Three.Material>(value: T): T { this.ownedMaterials.push(value); return value }
}
