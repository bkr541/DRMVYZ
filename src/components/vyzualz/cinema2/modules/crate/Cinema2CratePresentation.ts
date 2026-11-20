import type * as Three from 'three'
import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'

export const CINEMA2_CRATE_PRESENTATIONS = {
  'glyph-sphere': {
    name: 'Glyph Armillary', camera: [5.7, 2.8, 11], target: [0, 0, -.3], fov: 46, background: [.018, .017, .037, 1],
  },
  'wireframe-portal': {
    name: 'Corner Truss', camera: [4.3, 2.9, 8.9], target: [0, .1, -3.7], fov: 49, background: [.026, .019, .016, 1],
  },
} as const

export type Cinema2CratePresentationId = keyof typeof CINEMA2_CRATE_PRESENTATIONS

export function isCinema2CratePresentationId(value: string): value is Cinema2CratePresentationId {
  return Object.hasOwn(CINEMA2_CRATE_PRESENTATIONS, value)
}

type Mesh = Three.Mesh<Three.BufferGeometry, Three.Material | Three.Material[]>
type Assembly = {
  position: Cinema2Vector3
  angles?: Cinema2Vector3
  scale?: number
}
type FixtureMatrices = { boxes: Three.Matrix4[]; bars: Three.Matrix4[] }

// The Three bridge owns the source geometry, textures, and cloned materials. This assembly only disposes its own additions.
export class Cinema2CratePresentation {
  private readonly THREE: Cinema2ThreeLibrary['THREE']
  private readonly ownedMaterials = new Set<Three.Material>()
  private readonly ownedGeometries = new Set<Three.BufferGeometry>()
  private readonly instances: Three.InstancedMesh[] = []
  private readonly lighting = new Map<string, Three.Group[]>()
  private readonly unitBox: Three.BoxGeometry
  private readonly unitCylinder: Three.CylinderGeometry
  private readonly lightSurface = new Map<string, Three.MeshBasicMaterial>()
  private readonly fixtures = new Map<Three.Object3D, Map<Three.Material, FixtureMatrices>>()
  private assemblyCount = 0

  constructor(library: Cinema2ThreeLibrary, private readonly id: Cinema2CratePresentationId) {
    this.THREE = library.THREE
    this.unitBox = this.ownGeometry(new this.THREE.BoxGeometry())
    this.unitCylinder = this.ownGeometry(new this.THREE.CylinderGeometry(1, 1, 1, 6))
  }

  attach(root: Three.Object3D): void {
    root.updateMatrixWorld(true)
    const source: Mesh[] = []
    root.traverse(object => { if ((object as Mesh).isMesh) source.push(object as Mesh) })
    if (!source.length) throw new Error(`Missing source geometry for ${this.id}.`)
    const original = [...root.children]
    const scene = new this.THREE.Group()
    scene.name = CINEMA2_CRATE_PRESENTATIONS[this.id].name
    this.backdrop(scene)
    switch (this.id) {
      case 'glyph-sphere': this.glyphArmillary(scene, source[0]!); break
      case 'wireframe-portal': this.cornerTruss(scene, source[0]!); break
    }
    this.mountFixtures()
    for (const child of original) child.visible = false
    root.add(scene)
  }

  inspect(): Readonly<Record<string, unknown>> {
    return { presentation: this.id, assemblyCount: this.assemblyCount, lightingFamilies: [...this.lighting.keys()] }
  }

  dispose(): void {
    for (const mesh of this.instances.splice(0)) mesh.dispose()
    for (const material of this.ownedMaterials) material.dispose()
    for (const geometry of this.ownedGeometries) geometry.dispose()
    this.ownedMaterials.clear()
    this.ownedGeometries.clear()
    this.lightSurface.clear()
    this.lighting.clear()
  }

  private ownGeometry<G extends Three.BufferGeometry>(geometry: G): G {
    this.ownedGeometries.add(geometry)
    return geometry
  }

  private ownMaterial<M extends Three.Material>(material: M): M {
    this.ownedMaterials.add(material)
    return material
  }

  private assembly(root: Three.Object3D, name: string, { position, angles = [0, 0, 0], scale = 1 }: Assembly): Three.Group {
    const group = new this.THREE.Group()
    group.name = name
    group.position.set(...position)
    group.rotation.set(...angles)
    group.scale.setScalar(scale)
    root.add(group)
    this.assemblyCount += 1
    return group
  }

  private family(parent: Three.Object3D, role: string): Three.Group {
    const group = new this.THREE.Group()
    group.name = role
    group.userData.lightingFamily = role
    parent.add(group)
    const groups = this.lighting.get(role)
    if (groups) groups.push(group)
    else this.lighting.set(role, [group])
    return group
  }

  private emission(role: string, color: number, gain: number): Three.MeshBasicMaterial {
    const key = `${role}:${color}:${gain}`
    const existing = this.lightSurface.get(key)
    if (existing) return existing
    const material = this.ownMaterial(new this.THREE.MeshBasicMaterial({ color, toneMapped: false }))
    material.name = role
    material.color.multiplyScalar(gain)
    this.lightSurface.set(key, material)
    return material
  }

  private bar(parent: Three.Object3D, start: Cinema2Vector3, end: Cinema2Vector3, size: number, material: Three.Material): void {
    const { THREE } = this
    const from = new THREE.Vector3(...start)
    const to = new THREE.Vector3(...end)
    const direction = to.clone().sub(from)
    const length = direction.length()
    const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    this.fixtureMatrices(parent, material).bars.push(new THREE.Matrix4().compose(from.lerp(to, .5), orientation, new THREE.Vector3(size, length, size)))
  }

  private lamp(parent: Three.Object3D, at: Cinema2Vector3, scale: Cinema2Vector3, material: Three.Material): void {
    const matrix = new this.THREE.Matrix4().makeScale(...scale).setPosition(...at)
    this.fixtureMatrices(parent, material).boxes.push(matrix)
  }

  private fixtureMatrices(parent: Three.Object3D, material: Three.Material): FixtureMatrices {
    let materials = this.fixtures.get(parent)
    if (!materials) { materials = new Map(); this.fixtures.set(parent, materials) }
    let matrices = materials.get(material)
    if (!matrices) { matrices = { boxes: [], bars: [] }; materials.set(material, matrices) }
    return matrices
  }

  private mountFixtures(): void {
    for (const [parent, materials] of this.fixtures) {
      for (const [material, matrices] of materials) {
        this.mountBatch(parent, this.unitCylinder, material, matrices.bars)
        this.mountBatch(parent, this.unitBox, material, matrices.boxes)
      }
    }
    this.fixtures.clear()
  }

  private mountBatch(parent: Three.Object3D, geometry: Three.BufferGeometry, material: Three.Material, matrices: readonly Three.Matrix4[]): void {
    if (!matrices.length) return
    const batch = new this.THREE.InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix))
    batch.computeBoundingSphere()
    parent.add(batch)
    this.instances.push(batch)
  }

  private staticLight(parent: Three.Object3D, name: string, at: Cinema2Vector3, color: number, intensity: number, range: number): void {
    const light = new this.THREE.PointLight(color, intensity, range)
    light.name = name
    light.position.set(...at)
    parent.add(light)
  }

  private backdrop(root: Three.Object3D): void {
    const { THREE } = this
    const { background, camera, target } = CINEMA2_CRATE_PRESENTATIONS[this.id]
    const material = this.ownMaterial(new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: { tint: { value: new THREE.Color(background[0] * 1.55, background[1] * 1.55, background[2] * 1.55) } },
      vertexShader: `
        varying vec2 vBackdrop;
        void main() {
          vBackdrop = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 tint;
        varying vec2 vBackdrop;
        void main() {
          vec2 p = (vBackdrop - vec2(.53, .54)) * vec2(1.5, 2.4);
          float light = .29 + .71 * exp(-6.0 * dot(p, p));
          gl_FragColor = vec4(tint * light, 1.0);
          #include <colorspace_fragment>
        }`,
    }))
    const plane = new THREE.Mesh(this.ownGeometry(new THREE.PlaneGeometry(95, 69)), material)
    plane.name = 'distant-ambient-backdrop'
    const focalPoint = new THREE.Vector3(...target)
    const cameraPosition = new THREE.Vector3(...camera)
    const awayFromCamera = focalPoint.clone().sub(cameraPosition).normalize()
    plane.position.copy(focalPoint).addScaledVector(awayFromCamera, 35)
    plane.lookAt(cameraPosition)
    root.add(plane)
  }

  private glyphArmillary(root: Three.Object3D, source: Mesh): void {
    const { THREE } = this
    const standard = (Array.isArray(source.material) ? source.material[0] : source.material) as Three.MeshStandardMaterial
    const core = this.family(root, 'glyph-core')
    const glyphMaterial = (color: number, strength: number, band?: number) => {
      const material = this.ownMaterial(new THREE.MeshBasicMaterial({
        color, map: standard.map, alphaTest: standard.alphaTest || .025, side: band ? THREE.DoubleSide : THREE.FrontSide, toneMapped: false,
      }))
      material.color.multiplyScalar(strength)
      if (band) {
        material.onBeforeCompile = shader => {
          shader.uniforms.uGlyphBand = { value: band }
          shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlyphDirection;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlyphDirection = position;')
          shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlyphDirection;\nuniform float uGlyphBand;')
            .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (abs(normalize(vGlyphDirection).y) > uGlyphBand) discard;')
        }
        material.customProgramCacheKey = () => 'cinema2-crate-glyph-band'
      }
      return material
    }
    const body = this.assembly(core, 'original-glyph-sphere', { position: [0, 0, 0], angles: [0, -.32, -.08], scale: 2.65 })
    this.sourceMesh(body, source, glyphMaterial(0xf9f4ff, 2.4))

    const shells = [
      { role: 'inner-glyph-band', radius: 3.15, angles: [.38, .1, -.68], color: 0x7aefff, power: 1.29, band: .33 },
      { role: 'middle-glyph-band', radius: 4.6, angles: [1.06, -.12, .44], color: 0xffd296, power: 1.03, band: .24 },
      { role: 'outer-glyph-band', radius: 6.12, angles: [.83, .59, -.20], color: 0xa191fa, power: .95, band: .18 },
    ] as const
    const rimBody = this.ownMaterial(new THREE.MeshStandardMaterial({ color: 0x232e42, emissive: 0x151928, roughness: .32, metalness: .58 }))
    for (const shell of shells) {
      const ring = this.assembly(root, shell.role, { position: [0, 0, 0], angles: shell.angles })
      const band = this.family(ring, shell.role)
      band.scale.setScalar(shell.radius / .7523)
      this.sourceMesh(band, source, glyphMaterial(shell.color, shell.power, shell.band))
      const ticks = this.family(ring, 'armillary-index-ticks')
      const clamps = this.family(ring, 'armillary-joint-lights')
      const frameRadius = shell.radius * Math.sqrt(1 - shell.band ** 2)
      for (const sign of [-1, 1]) {
        const rail = new THREE.Mesh(this.ownGeometry(new THREE.TorusGeometry(frameRadius, .022, 6, 100)), rimBody)
        rail.rotation.x = Math.PI / 2
        rail.position.y = sign * shell.radius * shell.band
        ring.add(rail)
      }
      for (let step = 0; step < 32; step += 1) {
        const angle = step * Math.PI / 16
        const p = (r: number, y: number): Cinema2Vector3 => [Math.cos(angle) * r, y, Math.sin(angle) * r]
        const y = shell.radius * shell.band
        this.bar(ticks, p(frameRadius, y), p(frameRadius + (step % 4 === 0 ? .22 : .095), y), .013, this.emission(ticks.name, shell.color, .7))
        if (step % 8 === 0) this.bar(clamps, p(frameRadius + .055, -y), p(frameRadius + .055, y), .033, this.emission(clamps.name, shell.color, 1.8))
      }
    }
    this.staticLight(root, 'armillary-cool-fill', [1.6, 2.8, 4.2], 0x56beff, 32, 12)
  }

  private sourceMesh(parent: Three.Object3D, source: Mesh, material: Three.Material): void {
    const visible = new this.THREE.Mesh(source.geometry, material)
    visible.matrixAutoUpdate = false
    visible.matrix.copy(source.matrixWorld)
    visible.name = source.name
    parent.add(visible)
  }

  private cornerTruss(root: Three.Object3D, source: Mesh): void {
    const { THREE } = this
    // Identical source copies occupy the same transform in the static GLB. A single source mesh is the truss module.
    const sourceGeometry = source.geometry
    const rails: number[] = []
    const corners: number[] = []
    const position = sourceGeometry.getAttribute('position')
    const index = sourceGeometry.getIndex()
    for (let offset = 0; offset < (index?.count ?? position.count); offset += 3) {
      const a = index?.getX(offset) ?? offset
      const b = index?.getX(offset + 1) ?? offset + 1
      const c = index?.getX(offset + 2) ?? offset + 2
      const x = Math.abs((position.getX(a) + position.getX(b) + position.getX(c)) / 3)
      const y = Math.abs((position.getY(a) + position.getY(b) + position.getY(c)) / 3)
      const z = Math.abs((position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3)
      ;(Math.min(x, y, z) > .61 ? corners : rails).push(a, b, c)
    }
    const railGeometry = this.ownGeometry(sourceGeometry.clone().setIndex(rails))
    const jointGeometry = this.ownGeometry(sourceGeometry.clone().setIndex(corners))
    const bronze = this.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x897764, emissive: 0x513a25, emissiveIntensity: .65, metalness: .56, roughness: .31, side: THREE.DoubleSide,
    }))
    const deepBronze = this.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x685645, emissive: 0x3a2b1c, emissiveIntensity: .48, metalness: .56, roughness: .39, side: THREE.DoubleSide,
    }))
    const joint = this.emission('truss-chamfered-joints', 0xffbb71, 1.53)
    joint.side = THREE.DoubleSide
    const deepJoint = this.emission('truss-chamfered-joints', 0xffb465, .72)
    deepJoint.side = THREE.DoubleSide
    const connector = this.ownMaterial(new THREE.MeshStandardMaterial({ color: 0x655749, emissive: 0x332719, metalness: .5, roughness: .45 }))
    const railSupport = this.ownMaterial(new THREE.MeshStandardMaterial({
      color: 0x806b53, emissive: 0x6a4934, emissiveIntensity: .84, metalness: .68, roughness: .45,
    }))
    const nearRail = this.emission('truss-edge-runs', 0xe3b990, .75)
    const farRail = this.emission('truss-edge-runs', 0x83aeae, .52)
    const linkLight = this.emission('truss-bay-links', 0xa1d4d6, 1.1)
    const beacon = this.emission('truss-wayfinding-pins', 0xffdc9f, 1.85)
    const cells: readonly Cinema2Vector3[] = [
      [-1, -1, 1], [0, -1, 1], [-1, 0, 1], [1, 1, 1],
      [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [0, -1, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0],
      [-2, 0, -1], [-1, 0, -1], [0, 0, -1], [0, 1, -1], [1, 1, -1], [1, 0, -1], [2, 0, -1], [0, -1, -1],
      [-1, 1, -2], [-1, 0, -2], [0, 0, -2], [1, 0, -2], [1, -1, -2], [2, 0, -2],
      [-1, 0, -3], [0, 0, -3], [1, 0, -3],
    ]
    const pitch = 2.48
    const halfSpan = 1.015
    const world = (cell: Cinema2Vector3): Cinema2Vector3 => [cell[0] * pitch, cell[1] * pitch, cell[2] * pitch - 1.4]
    const connectors = this.family(root, 'truss-cross-braces')
    const bridgeLamps = this.family(root, 'truss-bay-links')
    for (const [cellIndex, cell] of cells.entries()) {
      const bay = this.assembly(root, `truss-bay-${cellIndex + 1}`, { position: world(cell), scale: halfSpan })
      const railBank = this.family(bay, 'truss-frame-rails')
      const jointBank = this.family(bay, 'truss-chamfered-joints')
      const indicators = this.family(bay, 'truss-wayfinding-pins')
      const runs = this.family(bay, 'truss-edge-runs')
      railBank.add(new THREE.Mesh(railGeometry, cell[2] >= 0 ? bronze : deepBronze))
      jointBank.add(new THREE.Mesh(jointGeometry, cell[2] >= 0 ? joint : deepJoint))
      // Continuous reinforcement follows the straight portions of the exported chamfered frame.
      for (let axis = 0; axis < 3; axis += 1) {
        for (const a of [-1, 1]) for (const b of [-1, 1]) {
          const edge = (u: number): Cinema2Vector3 => axisPoint(axis, u, a * .961, b * .961)
          this.bar(railBank, edge(-.65), edge(.65), .024, railSupport)
          if (cell[2] >= -1 && (a + b + axis + cellIndex) % 3 === 0) {
            this.bar(runs, edge(-.56), edge(.57), .027, cellIndex % 3 === 0 ? farRail : nearRail)
          }
        }
      }
      if (cellIndex % 2 === 0) {
        this.bar(indicators, [-.43, .965, 1.025], [.09, .965, 1.025], .022, beacon)
        this.lamp(indicators, [.61, -.925, 1.025], [.081, .061, .069], beacon)
      }
      for (const neighbor of cells.slice(0, cellIndex)) {
        const delta = cell.map((coordinate, axis) => coordinate - neighbor[axis]!)
        const direction = delta.findIndex(value => Math.abs(value) === 1)
        if (direction < 0 || delta.filter(value => value !== 0).length !== 1) continue
        const current = world(cell)
        const previous = world(neighbor)
        const sign = Math.sign(delta[direction]!)
        for (const side of [-1, 1]) {
          const from = offsetPoint(previous, axisPoint(direction, sign * halfSpan, side * .84 * halfSpan, side * .84 * halfSpan))
          const to = offsetPoint(current, axisPoint(direction, -sign * halfSpan, side * .84 * halfSpan, side * .84 * halfSpan))
          this.bar(connectors, from, to, .036, connector)
          if (side > 0) {
            const offset = axisPoint(direction, 0, .035, .035)
            this.bar(bridgeLamps, offsetPoint(from, offset), offsetPoint(to, offset), .013, linkLight)
          }
        }
      }
    }
    this.staticLight(root, 'truss-warm-key', [3.3, 2.5, 3.1], 0xffc48d, 55, 14)
    this.staticLight(root, 'truss-cool-return', [-4.2, .4, -6.3], 0x79d7df, 45, 12)
  }
}

function axisPoint(axis: number, across: number, a: number, b: number): Cinema2Vector3 {
  if (axis === 0) return [across, a, b]
  if (axis === 1) return [a, across, b]
  return [a, b, across]
}

function offsetPoint(point: Cinema2Vector3, offset: Cinema2Vector3): Cinema2Vector3 {
  return [point[0] + offset[0], point[1] + offset[1], point[2] + offset[2]]
}
