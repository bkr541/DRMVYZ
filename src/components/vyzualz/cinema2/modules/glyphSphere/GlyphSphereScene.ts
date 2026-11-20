import type * as THREE from 'three'
import type { Cinema2RenderQualityLevel } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
type Rgb = readonly number[]

export interface GlyphSphereControls {
  intensity: number
  coreScale: number
  coreGlow: number
  coreBreath: number
  bandSpread: number
  bandWobble: number
  bandLighting: number
  frameLighting: number
  tickLighting: number
  jointLighting: number
  halo: number
  starfield: number
  coreColor: Rgb
  innerColor: Rgb
  middleColor: Rgb
  outerColor: Rgb
  frameColor: Rgb
  background: Rgb
}

export const GLYPH_SPHERE_BANDS = [
  { role: 'inner-glyph-band', radius: 3.15, angles: [.38, .1, -.68], power: 1.29, band: .33, spin: 1, color: 'innerColor' },
  { role: 'middle-glyph-band', radius: 4.6, angles: [1.06, -.12, .44], power: 1.03, band: .24, spin: -.72, color: 'middleColor' },
  { role: 'outer-glyph-band', radius: 6.12, angles: [.83, .59, -.2], power: .95, band: .18, spin: .5, color: 'outerColor' },
] as const

/** Vertex count in the source model's radius: the band meshes are scaled from it (see `glyphArmillary` in the original presentation). */
const SOURCE_RADIUS = .7523
const TICKS = 32
const CORE_SCALE = 2.65
const STAR_COUNT: Record<Cinema2RenderQualityLevel, number> = { high: 900, medium: 450, low: 0 }

interface BandRig {
  spec: (typeof GLYPH_SPHERE_BANDS)[number]
  ring: THREE.Group
  glyphs: THREE.Group
  ticks: THREE.Group
  joints: THREE.Group
  glyphMaterial: THREE.MeshBasicMaterial
  glyphMeshes: THREE.Mesh[]
  railMaterial: THREE.MeshStandardMaterial
  jointMaterial: THREE.MeshBasicMaterial
  tickCloud: THREE.InstancedMesh
  beaconCloud: THREE.InstancedMesh
  tickAngles: number[]
  beaconAngles: number[]
}

/**
 * The Glyph Armillary: the supplied glyph sphere as a white core, three tilted glyph bands in their own ring frames, an audio-reactive halo,
 * a gradient dome and two starfield layers. Everything except the source geometry and texture is owned here and disposed here.
 */
export class GlyphSphereScene {
  private readonly geometries = new Set<THREE.BufferGeometry>()
  private readonly materials = new Set<THREE.Material>()
  private readonly rigs: BandRig[] = []
  private readonly scene: THREE.Group
  private readonly core: THREE.Group
  private readonly coreMaterial: THREE.MeshBasicMaterial
  private readonly coreMeshes: THREE.Mesh[] = []
  private readonly halo: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private readonly dome: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private readonly coreLight: THREE.PointLight
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>[] = []
  private readonly original: THREE.Object3D[]
  private readonly scratch: { color: THREE.Color; matrix: THREE.Matrix4 }
  private starQuality: Cinema2RenderQualityLevel | null = null
  private disposed = false
  private drawn = 0

  constructor(private readonly library: Cinema2ThreeLibrary, private readonly root: THREE.Object3D) {
    const T = library.THREE
    root.updateMatrixWorld(true)
    const sources: Mesh[] = []
    root.traverse(object => { if ((object as Mesh).isMesh) sources.push(object as Mesh) })
    if (!sources.length) throw new Error('Missing source geometry for the glyph sphere.')
    const source = sources[0]!
    this.original = [...root.children]
    this.scratch = { color: new T.Color(), matrix: new T.Matrix4() }
    this.scene = new T.Group()
    this.scene.name = 'Glyph Armillary'
    this.dome = this.buildDome()
    this.scene.add(this.dome)

    const standard = (Array.isArray(source.material) ? source.material[0] : source.material) as THREE.MeshStandardMaterial
    this.core = new T.Group()
    this.core.name = 'glyph-core'
    this.scene.add(this.core)
    const body = new T.Group()
    body.name = 'original-glyph-sphere'
    body.rotation.set(0, -.32, -.08)
    body.scale.setScalar(CORE_SCALE)
    this.core.add(body)
    this.coreMaterial = this.glyphMaterial(standard, null)
    this.coreMeshes.push(this.sourceMesh(body, source, this.coreMaterial))
    this.halo = this.buildHalo()
    this.core.add(this.halo)
    this.coreLight = new T.PointLight(0xfff2e0, 24, 16)
    this.coreLight.name = 'glyph-core-light'
    this.scene.add(this.coreLight)

    const bar = new T.CylinderGeometry(1, 1, 1, 6)
    const box = new T.BoxGeometry()
    this.geometries.add(bar); this.geometries.add(box)
    for (const spec of GLYPH_SPHERE_BANDS) this.rigs.push(this.buildBand(spec, source, standard, bar, box))

    const light = new T.PointLight(0x56beff, 32, 12)
    light.name = 'armillary-cool-fill'
    light.position.set(1.6, 2.8, 4.2)
    this.scene.add(light)

    for (const child of this.original) child.visible = false
    root.add(this.scene)
  }

  /** Posed once per frame by the controller. `phase` is accumulated in radians from the shared beat clock. */
  draw(c: GlyphSphereControls, phase: number, quality: Cinema2RenderQualityLevel = 'high'): void {
    if (this.disposed) return
    const T = this.library.THREE
    const { color } = this.scratch
    const level = Math.max(0, c.intensity)
    this.drawn += 1
    this.scene.visible = level > 0.001

    const set = (target: THREE.Color, rgb: Rgb, gain: number) => target.setRGB(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, T.SRGBColorSpace).multiplyScalar(gain)

    // Core: the sphere turns slowly under the bands and breathes through the model's own morph targets.
    this.core.scale.setScalar(c.coreScale)
    this.core.rotation.y = phase * .12
    set(this.coreMaterial.color, c.coreColor, 2.4 * level * (.45 + .55 * Math.min(2, c.coreGlow)))
    const breath = Math.max(0, Math.min(1, c.coreBreath))
    for (const mesh of this.coreMeshes) this.breathe(mesh, breath, phase, 0)
    this.halo.scale.setScalar(2.95 * (1 + .06 * Math.sin(phase * .5)))
    set(this.halo.material.uniforms.uColor!.value as THREE.Color, c.coreColor, 1)
    this.halo.material.uniforms.uStrength!.value = c.halo * c.coreGlow * level * .9
    this.halo.visible = this.halo.material.uniforms.uStrength!.value > 0.002
    this.coreLight.intensity = 24 * level * (.3 + .7 * Math.min(2, c.coreGlow))
    this.coreLight.visible = this.coreLight.intensity > .01

    set(this.dome.material.uniforms.uTint!.value as THREE.Color, c.background, 8 * Math.max(.4, level))
    this.dome.material.uniforms.uGlow!.value = .55 + .25 * Math.min(1.5, c.halo * c.coreGlow)
    this.updateStars(c, phase, quality)

    this.rigs.forEach((rig, index) => {
      const { spec } = rig
      const spread = 1 + (c.bandSpread - 1) * (.6 + .2 * index)
      rig.ring.scale.setScalar(spread)
      const wobble = Math.max(0, Math.min(1, c.bandWobble)) * .11
      rig.ring.rotation.set(spec.angles[0] + Math.sin(phase * .31 + index * 2.1) * wobble, spec.angles[1], spec.angles[2] + Math.cos(phase * .23 + index * 1.7) * wobble)
      const turn = phase * .25 * spec.spin
      rig.glyphs.rotation.y = turn
      rig.ticks.rotation.y = -turn * .5
      rig.joints.rotation.y = -turn * .5
      set(rig.glyphMaterial.color, c[spec.color], spec.power * level * Math.max(0, c.bandLighting))
      rig.glyphMeshes.forEach(mesh => this.breathe(mesh, breath * .6, phase, index + 1))
      // Frame rails glow in the band's own colour on top of the metal.
      set(rig.railMaterial.color, c.frameColor, 1)
      set(rig.railMaterial.emissive, c[spec.color], .1 * level * Math.max(0, c.frameLighting))
      set(rig.jointMaterial.color, c[spec.color], 1.8 * level * Math.max(0, c.jointLighting))
      this.lightCloud(rig.tickCloud, rig.tickAngles, c[spec.color], .5 * level * c.tickLighting, 1.25 * level * c.tickLighting, phase * 1.5 * Math.sign(spec.spin), 6)
      this.lightCloud(rig.beaconCloud, rig.beaconAngles, c[spec.color], 1.1 * level * c.jointLighting, 1.6 * level * c.jointLighting, phase * 1.5 * Math.sign(spec.spin), 3)
      rig.ticks.visible = c.tickLighting > .001 && level > .001
      rig.joints.visible = c.jointLighting > .001 && level > .001
    })
  }

  inspect(): Readonly<Record<string, unknown>> {
    return {
      presentation: 'glyph-sphere', bands: this.rigs.length, ticksPerBand: TICKS, ownedGeometryCount: this.geometries.size, ownedMaterialCount: this.materials.size,
      starLayers: this.stars.length, morphTargets: this.coreMeshes[0]?.morphTargetInfluences?.length ?? 0, drawn: this.drawn,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const rig of this.rigs) { rig.tickCloud.dispose(); rig.beaconCloud.dispose() }
    this.scene.removeFromParent()
    for (const child of this.original) child.visible = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.geometries.clear(); this.materials.clear(); this.rigs.length = 0; this.stars.length = 0
  }

  private own<G extends THREE.BufferGeometry>(geometry: G): G { this.geometries.add(geometry); return geometry }
  private mat<M extends THREE.Material>(material: M): M { this.materials.add(material); return material }

  private sourceMesh(parent: THREE.Object3D, source: Mesh, material: THREE.Material): THREE.Mesh {
    const T = this.library.THREE
    const visible = new T.Mesh(source.geometry, material)
    visible.matrixAutoUpdate = false
    visible.matrix.copy(source.matrixWorld)
    visible.name = source.name
    parent.add(visible)
    return visible
  }

  /** The source mesh carries three baked morph targets. Each mesh gets its own slow, offset weights so the glyph slats ripple instead of pulsing together. */
  private breathe(mesh: THREE.Mesh, amount: number, phase: number, offset: number): void {
    const influences = mesh.morphTargetInfluences
    if (!influences) return
    for (let index = 0; index < influences.length; index += 1) influences[index] = amount * (.5 + .5 * Math.sin(phase * (.42 + index * .17) + index * 2.1 + offset * 1.3))
  }

  private glyphMaterial(standard: THREE.MeshStandardMaterial, band: number | null): THREE.MeshBasicMaterial {
    const T = this.library.THREE
    const material = this.mat(new T.MeshBasicMaterial({
      color: 0xffffff, map: standard.map, alphaTest: standard.alphaTest || .025, side: band ? T.DoubleSide : T.FrontSide, toneMapped: false,
    }))
    if (band) {
      material.onBeforeCompile = shader => {
        shader.uniforms.uGlyphBand = { value: band }
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlyphDirection;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlyphDirection = position;')
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlyphDirection;\nuniform float uGlyphBand;')
          .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (abs(normalize(vGlyphDirection).y) > uGlyphBand) discard;')
      }
      // The band is part of the program, so each band needs its own program key.
      material.customProgramCacheKey = () => `cinema2-glyph-sphere-band-${band}`
    }
    return material
  }

  private buildBand(spec: (typeof GLYPH_SPHERE_BANDS)[number], source: Mesh, standard: THREE.MeshStandardMaterial, bar: THREE.BufferGeometry, box: THREE.BufferGeometry): BandRig {
    const T = this.library.THREE
    const ring = new T.Group()
    ring.name = spec.role
    ring.rotation.set(spec.angles[0], spec.angles[1], spec.angles[2])
    this.scene.add(ring)
    const glyphs = new T.Group()
    glyphs.userData.lightingFamily = spec.role
    glyphs.scale.setScalar(spec.radius / SOURCE_RADIUS)
    ring.add(glyphs)
    const glyphMaterial = this.glyphMaterial(standard, spec.band)
    const glyphMeshes = [this.sourceMesh(glyphs, source, glyphMaterial)]
    const ticks = new T.Group(); ticks.name = 'armillary-index-ticks'; ticks.userData.lightingFamily = 'armillary-index-ticks'; ring.add(ticks)
    const joints = new T.Group(); joints.name = 'armillary-joint-lights'; joints.userData.lightingFamily = 'armillary-joint-lights'; ring.add(joints)

    const frameRadius = spec.radius * Math.sqrt(1 - spec.band ** 2)
    const y = spec.radius * spec.band
    const railMaterial = this.mat(new T.MeshStandardMaterial({ color: 0x232e42, emissive: 0x000000, roughness: .3, metalness: .7 }))
    const rail = this.own(new T.TorusGeometry(frameRadius, .02, 6, 120))
    for (const sign of [-1, 1]) {
      const mesh = new T.Mesh(rail, railMaterial)
      mesh.rotation.x = Math.PI / 2
      mesh.position.y = sign * y
      ring.add(mesh)
    }
    const jointMaterial = this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    const instanceMaterial = () => this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    const tickMatrices: THREE.Matrix4[] = []
    const tickAngles: number[] = []
    const beaconMatrices: THREE.Matrix4[] = []
    const beaconAngles: number[] = []
    const jointMatrices: THREE.Matrix4[] = []
    const up = new T.Vector3(0, 1, 0)
    const bars = (list: THREE.Matrix4[], from: THREE.Vector3, to: THREE.Vector3, size: number) => {
      const direction = to.clone().sub(from)
      const length = direction.length()
      list.push(new T.Matrix4().compose(from.clone().lerp(to, .5), new T.Quaternion().setFromUnitVectors(up, direction.normalize()), new T.Vector3(size, length, size)))
    }
    for (let step = 0; step < TICKS; step += 1) {
      const angle = step * Math.PI / (TICKS / 2)
      const at = (r: number, height: number) => new T.Vector3(Math.cos(angle) * r, height, Math.sin(angle) * r)
      const long = step % 4 === 0
      for (const sign of [-1, 1]) {
        // The lower rail shows the shorter ticks only, so the frame reads as a ruled ring rather than a cage.
        if (sign < 0 && long === false) continue
        bars(tickMatrices, at(frameRadius, sign * y), at(frameRadius + (long ? .26 : .105), sign * y), .014)
        tickAngles.push(angle)
        if (long && sign > 0) {
          beaconMatrices.push(new T.Matrix4().compose(at(frameRadius + .3, y), new T.Quaternion(), new T.Vector3(.07, .07, .07)))
          beaconAngles.push(angle)
        }
      }
      if (step % 8 === 0) bars(jointMatrices, at(frameRadius + .055, -y), at(frameRadius + .055, y), .036)
    }
    const tickCloud = this.cloud(ticks, bar, instanceMaterial(), tickMatrices)
    const beaconCloud = this.cloud(ticks, box, instanceMaterial(), beaconMatrices)
    this.cloud(joints, bar, jointMaterial, jointMatrices)
    return { spec, ring, glyphs, ticks, joints, glyphMaterial, glyphMeshes, railMaterial, jointMaterial, tickCloud, beaconCloud, tickAngles, beaconAngles }
  }

  private cloud(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, matrices: readonly THREE.Matrix4[]): THREE.InstancedMesh {
    const T = this.library.THREE
    const mesh = new T.InstancedMesh(geometry, material, Math.max(1, matrices.length))
    mesh.count = matrices.length
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.setColorAt(0, this.scratch.color.setRGB(1, 1, 1))
    mesh.computeBoundingSphere()
    mesh.frustumCulled = false
    parent.add(mesh)
    return mesh
  }

  /** Per-instance brightness: a base glow plus a bright pulse that circles the ring, so the ticks cascade with the beat clock. */
  private lightCloud(mesh: THREE.InstancedMesh, angles: readonly number[], rgb: Rgb, base: number, peak: number, travel: number, sharpness: number): void {
    const T = this.library.THREE
    const { color } = this.scratch
    for (let index = 0; index < angles.length; index += 1) {
      const pulse = Math.pow(Math.max(0, Math.cos(angles[index]! - travel)), sharpness)
      color.setRGB(rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, T.SRGBColorSpace).multiplyScalar(Math.max(0, base + (peak - base) * pulse))
      mesh.setColorAt(index, color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  private buildHalo(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const T = this.library.THREE
    const material = this.mat(new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.FrontSide,
      uniforms: { uColor: { value: new T.Color(1, 1, 1) }, uStrength: { value: 0 } },
      vertexShader: `
        varying vec3 vNormalView;
        varying vec3 vViewDirection;
        void main() {
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vViewDirection = normalize(-view.xyz);
          gl_Position = projectionMatrix * view;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec3 vNormalView;
        varying vec3 vViewDirection;
        void main() {
          float facing = clamp(abs(dot(normalize(vNormalView), normalize(vViewDirection))), 0.0, 1.0);
          float body = pow(facing, 3.2) * .13;
          float rim = pow(1.0 - facing, 2.4) * .42;
          gl_FragColor = vec4(uColor * (body + rim) * uStrength, 1.0);
        }`,
    }))
    const mesh = new T.Mesh(this.own(new T.SphereGeometry(1, 40, 24)), material)
    mesh.name = 'glyph-core-halo'
    mesh.renderOrder = 4
    return mesh
  }

  private buildDome(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const T = this.library.THREE
    const material = this.mat(new T.ShaderMaterial({
      toneMapped: false, side: T.BackSide, depthWrite: false,
      uniforms: { uTint: { value: new T.Color(.03, .03, .06) }, uGlow: { value: .55 } },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTint;
        uniform float uGlow;
        varying vec3 vDirection;
        void main() {
          float horizon = exp(-5.5 * vDirection.y * vDirection.y);
          float zenith = smoothstep(-1.0, 1.0, vDirection.y);
          float light = .4 + uGlow * .8 * horizon + .25 * zenith;
          gl_FragColor = vec4(uTint * light, 1.0);
          #include <colorspace_fragment>
        }`,
    }))
    const mesh = new T.Mesh(this.own(new T.SphereGeometry(70, 32, 16)), material)
    mesh.name = 'distant-ambient-backdrop'
    mesh.renderOrder = -10
    mesh.frustumCulled = false
    return mesh
  }

  /** Two shells of points drift at different rates for parallax. Built on first use at the current tier; the low tier draws none. */
  private updateStars(c: GlyphSphereControls, phase: number, quality: Cinema2RenderQualityLevel): void {
    if (this.starQuality !== quality) this.buildStars(quality)
    const amount = Math.max(0, Math.min(1, c.starfield)) * Math.min(1.5, Math.max(0, c.intensity))
    this.stars.forEach((layer, index) => {
      layer.visible = amount > .003
      layer.material.opacity = Math.min(1, amount * (index === 0 ? .85 : .6))
      layer.rotation.y = phase * (index === 0 ? .004 : -.0065)
      layer.rotation.x = phase * (index === 0 ? .002 : .0035)
    })
  }

  private buildStars(quality: Cinema2RenderQualityLevel): void {
    const T = this.library.THREE
    for (const layer of this.stars.splice(0)) { layer.removeFromParent(); this.geometries.delete(layer.geometry); layer.geometry.dispose(); this.materials.delete(layer.material); layer.material.dispose() }
    this.starQuality = quality
    const total = STAR_COUNT[quality]
    if (!total) return
    let seed = 90210
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    for (const [index, share] of [.6, .4].entries()) {
      const count = Math.round(total * share)
      const positions = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i += 1) {
        const u = random() * 2 - 1, a = random() * Math.PI * 2, radius = (index === 0 ? 34 : 22) + random() * 20, s = Math.sqrt(1 - u * u)
        positions.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3)
        const tint = random()
        colors.set(tint < .33 ? [.55, .8, 1] : tint < .66 ? [1, .85, .6] : [.7, .65, 1], i * 3)
      }
      const geometry = this.own(new T.BufferGeometry())
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3))
      const material = this.mat(new T.PointsMaterial({ size: index === 0 ? .14 : .2, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: .6, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }))
      const points = new T.Points(geometry, material)
      points.name = index === 0 ? 'glyph-starfield-far' : 'glyph-starfield-near'
      points.frustumCulled = false
      this.scene.add(points)
      this.stars.push(points)
    }
  }
}
