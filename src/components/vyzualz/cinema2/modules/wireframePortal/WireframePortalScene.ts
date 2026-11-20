import type * as THREE from 'three'
import type { Cinema2RenderQualityLevel, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  blendWireframePortalBay, blendWireframePortalBeam, evaluateWireframePortalBay, evaluateWireframePortalBeam,
  type WireframePortalBayInput, type WireframePortalPattern,
} from './WireframePortalPatterns'

type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
type Rgb = readonly number[]

export interface WireframePortalControls {
  intensity: number
  kinetics: number
  jointHeat: number
  edgeLighting: number
  pinLighting: number
  beamLighting: number
  strobe: number
  rimLighting: number
  steelRoughness: number
  emberDrift: number
  haze: number
  dust: number
  steelColor: Rgb
  hotColor: Rgb
  edgeColor: Rgb
  coldRimColor: Rgb
  redRimColor: Rgb
  background: Rgb
}

/** What the controller resolves each frame: the program on stage, the one it is easing out of, and the two music-driven channels. */
export interface WireframePortalState {
  /** Accumulated sweep phase in radians (scaled by Sweep Rate). */
  phase: number
  /** The shared beat position the programs run on. */
  beats: number
  pattern: WireframePortalPattern
  previousPattern: WireframePortalPattern
  /** 0 to 1 across the ease from the previous program to this one. */
  blend: number
  /** Kick cue, 0 to 1. */
  flash: number
  /** Drop cue, 0 to 1. */
  blast: number
  quality: Cinema2RenderQualityLevel
  /** The camera that is actually drawing, so lights and cores fade out as it flies close to them. */
  eye?: readonly [number, number, number]
}

/** Bay cells of the exported truss: the module is one chamfered cube frame, repeated on this grid. */
const CELLS: readonly Cinema2Vector3[] = [
  [-1, -1, 1], [0, -1, 1], [-1, 0, 1], [1, 1, 1],
  [-2, 0, 0], [-1, 0, 0], [0, 0, 0], [0, -1, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0],
  [-2, 0, -1], [-1, 0, -1], [0, 0, -1], [0, 1, -1], [1, 1, -1], [1, 0, -1], [2, 0, -1], [0, -1, -1],
  [-1, 1, -2], [-1, 0, -2], [0, 0, -2], [1, 0, -2], [1, -1, -2], [2, 0, -2],
  [-1, 0, -3], [0, 0, -3], [1, 0, -3],
]
const PITCH = 2.48
const HALF_SPAN = 1.015
export const WIREFRAME_PORTAL_CENTER: Cinema2Vector3 = [0, 0, -3.7]
export const WIREFRAME_PORTAL_BAY_COUNT = CELLS.length
const BEAMS: Record<Cinema2RenderQualityLevel, number> = { high: 12, medium: 8, low: 4 }
const BEAM_MAX = 12
const BEAM_LENGTH = 17
const DUST_COUNT: Record<Cinema2RenderQualityLevel, number> = { high: 700, medium: 350, low: 0 }
const world = (cell: Cinema2Vector3): Cinema2Vector3 => [cell[0] * PITCH, cell[1] * PITCH, cell[2] * PITCH - 1.4]
const smoothstep = (edge0: number, edge1: number, value: number) => { const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0))); return t * t * (3 - 2 * t) }
const hash = (a: number, b = 0) => { const value = Math.sin(a * 127.1 + b * 311.7 + 17.3) * 43758.5453; return value - Math.floor(value) }

interface Bay {
  input: WireframePortalBayInput
  origin: Cinema2Vector3
  group: THREE.Group
  joint: THREE.MeshBasicMaterial
  core: THREE.MeshBasicMaterial
  runs: THREE.MeshBasicMaterial
  /** This bay's own steady heat, so the cores are not all the same temperature. */
  heat: number
  deep: boolean
}
interface Link { from: number; to: number; direction: number; sign: number; side: number }
interface Fixture { bay: number; outward: Cinema2Vector3; beam: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; lens: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; colorRole: number }

/**
 * The Corner Truss as a kinetic light rig: 28 steel bays that push out, turn, fold in, ripple and blast apart and reassemble in six programs, each with
 * a hot core; up to twelve beams that sweep through haze in step with the program; hard rim lights; a hazed dome and dust. The connecting bars follow the
 * bays as they move. Everything except the source geometry is owned here.
 */
export class WireframePortalScene {
  private readonly geometries = new Set<THREE.BufferGeometry>()
  private readonly materials = new Set<THREE.Material>()
  private readonly instances: THREE.InstancedMesh[] = []
  private readonly bays: Bay[] = []
  private readonly links: Link[] = []
  private readonly fixtures: Fixture[] = []
  private readonly scene: THREE.Group
  private readonly steel: THREE.MeshStandardMaterial
  private readonly deepSteel: THREE.MeshStandardMaterial
  private readonly support: THREE.MeshStandardMaterial
  private readonly connector: THREE.MeshStandardMaterial
  private readonly beacon: THREE.MeshBasicMaterial
  private readonly link: THREE.MeshBasicMaterial
  private readonly connectors: THREE.InstancedMesh
  private readonly linkLights: THREE.InstancedMesh
  private readonly dome: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private readonly rig: THREE.Group
  private readonly coldRim: THREE.SpotLight
  private readonly redRim: THREE.SpotLight
  private readonly underKey: THREE.PointLight
  private dust: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null
  private dustQuality: Cinema2RenderQualityLevel | null = null
  private readonly original: THREE.Object3D[]
  private readonly scratch: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; q: THREE.Quaternion; e: THREE.Euler; m: THREE.Matrix4; down: THREE.Vector3; up: THREE.Vector3; s: THREE.Vector3 }
  private disposed = false
  private drawn = 0

  constructor(private readonly library: Cinema2ThreeLibrary, root: THREE.Object3D) {
    const T = library.THREE
    root.updateMatrixWorld(true)
    const sources: Mesh[] = []
    root.traverse(object => { if ((object as Mesh).isMesh) sources.push(object as Mesh) })
    if (!sources.length) throw new Error('Missing source geometry for the wireframe portal.')
    // Identical source copies occupy the same transform in the static GLB. A single source mesh is the truss module.
    const sourceGeometry = sources[0]!.geometry
    this.original = [...root.children]
    this.scratch = {
      a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), q: new T.Quaternion(), e: new T.Euler(), m: new T.Matrix4(),
      down: new T.Vector3(0, -1, 0), up: new T.Vector3(0, 1, 0), s: new T.Vector3(),
    }
    this.scene = new T.Group()
    this.scene.name = 'Kinetic Truss'
    this.dome = this.buildDome()
    this.scene.add(this.dome)

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
    const railGeometry = this.own(sourceGeometry.clone().setIndex(rails))
    const jointGeometry = this.own(sourceGeometry.clone().setIndex(corners))
    this.steel = this.mat(new T.MeshStandardMaterial({ color: 0x3a4048, metalness: .7, roughness: .36, side: T.DoubleSide }))
    this.deepSteel = this.mat(new T.MeshStandardMaterial({ color: 0x20252b, metalness: .7, roughness: .42, side: T.DoubleSide }))
    this.support = this.mat(new T.MeshStandardMaterial({ color: 0x4a525b, metalness: .7, roughness: .4 }))
    this.connector = this.mat(new T.MeshStandardMaterial({ color: 0x2a3036, metalness: .7, roughness: .45 }))
    this.beacon = this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))
    this.link = this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }))

    const bar = this.own(new T.CylinderGeometry(1, 1, 1, 6))
    const box = this.own(new T.BoxGeometry())
    const coreGeometry = this.own(new T.OctahedronGeometry(.13, 0))
    const up = this.scratch.up
    type Matrices = THREE.Matrix4[]
    const barMatrix = (list: Matrices, from: Cinema2Vector3, to: Cinema2Vector3, size: number) => {
      const a = new T.Vector3(...from), b = new T.Vector3(...to)
      const direction = b.clone().sub(a)
      const length = direction.length()
      list.push(new T.Matrix4().compose(a.clone().lerp(b, .5), new T.Quaternion().setFromUnitVectors(up, direction.normalize()), new T.Vector3(size, length, size)))
    }
    const centre = new T.Vector3(...WIREFRAME_PORTAL_CENTER)
    for (const [cellIndex, cell] of CELLS.entries()) {
      const origin = world(cell)
      const away = new T.Vector3(...origin).sub(centre)
      const axis = Math.abs(away.x) >= Math.abs(away.y) && Math.abs(away.x) >= Math.abs(away.z) ? 0 : Math.abs(away.y) >= Math.abs(away.z) ? 1 : 2
      const outward = away.lengthSq() > 1e-6 ? away.clone().normalize() : new T.Vector3(0, 1, 0)
      const deep = cell[2] < 0
      const group = new T.Group()
      group.name = `truss-bay-${cellIndex + 1}`
      group.position.set(...origin)
      group.scale.setScalar(HALF_SPAN)
      this.scene.add(group)
      const bay: Bay = {
        input: { cell, index: cellIndex, count: CELLS.length, outward: [outward.x, outward.y, outward.z], axis, sign: Math.sign(away.getComponent(axis)) || 1, drift: cell[2] * .9 + cell[0] * .5 + cell[1] * .3 },
        origin, group,
        joint: this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: T.DoubleSide })),
        core: this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
        runs: this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
        heat: .6 + hash(cellIndex, 2) * .6, deep,
      }
      this.bays.push(bay)
      for (const [part, geometry, material] of [['rails', railGeometry, deep ? this.deepSteel : this.steel], ['joints', jointGeometry, bay.joint]] as const) {
        const mesh = new T.Mesh(geometry, material)
        mesh.name = `truss-bay-${cellIndex + 1}-${part}`
        group.add(mesh)
      }
      const core = new T.Mesh(coreGeometry, bay.core)
      core.name = `truss-bay-${cellIndex + 1}-core`
      group.add(core)
      // Everything below is in the bay's own unit space, so it moves, turns and scales with the bay.
      const supports: Matrices = [], runs: Matrices = [], pinBars: Matrices = [], pinLamps: Matrices = []
      for (let a = 0; a < 3; a += 1) {
        for (const s of [-1, 1]) for (const t of [-1, 1]) {
          const edge = (u: number): Cinema2Vector3 => axisPoint(a, u, s * .961, t * .961)
          barMatrix(supports, edge(-.65), edge(.65), .024)
          if (cell[2] >= -1 && (s + t + a + cellIndex) % 3 === 0) barMatrix(runs, edge(-.56), edge(.57), .027)
        }
      }
      this.cloud(group, bar, this.support, supports)
      this.cloud(group, bar, bay.runs, runs)
      if (cellIndex % 2 === 0) {
        barMatrix(pinBars, [-.43, .965, 1.025], [.09, .965, 1.025], .022)
        pinLamps.push(new T.Matrix4().compose(new T.Vector3(.61, -.925, 1.025), new T.Quaternion(), new T.Vector3(.081, .061, .069)))
      }
      this.cloud(group, bar, this.beacon, pinBars)
      this.cloud(group, box, this.beacon, pinLamps)
      for (const [neighbor, neighborCell] of CELLS.slice(0, cellIndex).entries()) {
        const delta = cell.map((coordinate, axisIndex) => coordinate - neighborCell[axisIndex]!)
        const direction = delta.findIndex(value => Math.abs(value) === 1)
        if (direction < 0 || delta.filter(value => value !== 0).length !== 1) continue
        for (const side of [-1, 1]) this.links.push({ from: neighbor, to: cellIndex, direction, sign: Math.sign(delta[direction]!), side })
      }
    }
    // The bars between bays are rebuilt every frame from where the bays actually are.
    this.connectors = this.dynamicCloud(bar, this.connector, this.links.length)
    this.linkLights = this.dynamicCloud(bar, this.link, this.links.filter(link => link.side > 0).length)

    this.rig = new T.Group()
    this.rig.name = 'truss-rim-rig'
    this.rig.position.set(...WIREFRAME_PORTAL_CENTER)
    this.scene.add(this.rig)
    this.coldRim = this.spot(0xbfd8ff, [-9, 6, -11])
    this.redRim = this.spot(0xff2a1a, [9, -2.5, -10])
    this.underKey = new T.PointLight(0xff7a2a, 0, 26, 2)
    this.underKey.name = 'truss-under-key'
    this.underKey.position.set(2, -5, 7)
    this.scene.add(this.underKey)

    this.buildBeams()
    for (const child of this.original) child.visible = false
    root.add(this.scene)
  }

  /** Posed once per frame by the controller. */
  draw(c: WireframePortalControls, s: WireframePortalState): void {
    if (this.disposed) return
    const T = this.library.THREE
    const level = Math.max(0, c.intensity)
    this.drawn += 1
    this.scene.visible = level > .001
    const rgb = (target: THREE.Color, value: Rgb, gain: number) => target.setRGB(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0, T.SRGBColorSpace).multiplyScalar(gain)
    const { quality } = s

    this.steel.roughness = Math.min(1, Math.max(.05, c.steelRoughness))
    this.deepSteel.roughness = Math.min(1, c.steelRoughness + .06)
    rgb(this.steel.color, c.steelColor, 1)
    rgb(this.deepSteel.color, c.steelColor, .55)
    rgb(this.support.color, c.steelColor, 1.35)
    rgb(this.connector.color, c.steelColor, .75)

    // Kinetic bays: the program on stage, blended out of the previous one, scaled by Kinetics, plus the drop's blast.
    const kinetics = Math.max(0, c.kinetics)
    const ease = s.blend * s.blend * (3 - 2 * s.blend)
    const drift = Math.max(0, Math.min(1, c.emberDrift))
    const { e, q: quaternion } = this.scratch
    for (const bay of this.bays) {
      let pose = evaluateWireframePortalBay(s.pattern, s.beats, bay.input, s.blast)
      if (ease < 1) pose = blendWireframePortalBay(evaluateWireframePortalBay(s.previousPattern, s.beats, bay.input, s.blast), pose, ease)
      const { group } = bay
      group.position.set(bay.origin[0] + pose.offset[0] * kinetics, bay.origin[1] + pose.offset[1] * kinetics, bay.origin[2] + pose.offset[2] * kinetics)
      e.set(pose.rotate[0] * kinetics, pose.rotate[1] * kinetics, pose.rotate[2] * kinetics)
      quaternion.setFromEuler(e)
      group.quaternion.copy(quaternion)
      group.scale.setScalar(HALF_SPAN * (1 + (pose.scale - 1) * Math.min(1.5, kinetics)))
      group.updateMatrix()
      const wave = .5 + .5 * Math.sin(s.phase * .5 - bay.input.drift * .8)
      const heat = bay.heat * (1 - drift * .55 + drift * 1.1 * wave ** 2) * (bay.deep ? .8 : 1)
      // A core the camera is flying right past fades out instead of filling the frame.
      const near = s.eye ? smoothstep(.6, 3, Math.hypot(group.position.x - s.eye[0], group.position.y - s.eye[1], group.position.z - s.eye[2])) : 1
      rgb(bay.core.color, c.hotColor, 2.6 * level * c.jointHeat * heat * pose.core * (1 + 1.5 * s.flash) * near)
      rgb(bay.joint.color, c.hotColor, .9 * level * c.jointHeat * heat * (.6 + .4 * pose.core))
      const edge = .5 + .5 * Math.sin(s.phase * .35 - bay.input.drift * .6 + 1.3)
      rgb(bay.runs.color, c.edgeColor, .2 * level * c.edgeLighting * (1 - drift * .4 + drift * .8 * edge))
    }
    rgb(this.beacon.color, c.hotColor, 1.8 * level * c.pinLighting)
    rgb(this.link.color, c.edgeColor, .25 * level * c.edgeLighting)
    this.updateLinks()
    this.updateBeams(c, s, level)

    this.rig.rotation.y = Math.sin(s.phase * .06) * .45
    this.rig.rotation.x = Math.sin(s.phase * .043 + 1) * .12
    const rim = level * Math.max(0, c.rimLighting)
    this.setSpot(this.coldRim, c.coldRimColor, 4200 * rim * (1 + .8 * s.flash))
    this.setSpot(this.redRim, c.redRimColor, 1800 * rim * (.85 + .15 * Math.sin(s.phase * .8)) * (1 + 1.2 * s.blast))
    rgb(this.underKey.color, c.hotColor, 1)
    this.underKey.intensity = 90 * rim * Math.min(1.5, c.jointHeat)
    this.underKey.visible = quality !== 'low' && this.underKey.intensity > .01
    this.redRim.visible = quality !== 'low' && this.redRim.intensity > .01

    rgb(this.dome.material.uniforms.uTint!.value as THREE.Color, c.background, 1)
    this.dome.material.uniforms.uHaze!.value = Math.max(0, Math.min(1, c.haze)) * Math.max(.4, level) * (1 + .6 * s.blast)
    this.updateDust(c, s.phase, quality, level)
  }

  inspect(): Readonly<Record<string, unknown>> {
    return {
      presentation: 'wireframe-portal', bayCount: this.bays.length, fixtureCount: this.fixtures.length, visibleBeams: this.fixtures.filter(fixture => fixture.beam.visible).length,
      ownedGeometryCount: this.geometries.size, ownedMaterialCount: this.materials.size, instancedBatches: this.instances.length,
      lights: ['truss-cold-rim', 'truss-red-rim', 'truss-under-key'], dustPoints: this.dust?.geometry.getAttribute('position').count ?? 0, drawn: this.drawn,
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const mesh of this.instances) mesh.dispose()
    this.scene.removeFromParent()
    for (const child of this.original) child.visible = true
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    this.geometries.clear(); this.materials.clear(); this.instances.length = 0; this.bays.length = 0; this.fixtures.length = 0; this.links.length = 0
    this.dust = null
  }

  private own<G extends THREE.BufferGeometry>(geometry: G): G { this.geometries.add(geometry); return geometry }
  private mat<M extends THREE.Material>(material: M): M { this.materials.add(material); return material }

  private cloud(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, matrices: readonly THREE.Matrix4[]): void {
    if (!matrices.length) return
    const mesh = new this.library.THREE.InstancedMesh(geometry, material, matrices.length)
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.computeBoundingSphere()
    mesh.frustumCulled = false
    parent.add(mesh)
    this.instances.push(mesh)
  }

  private dynamicCloud(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
    const mesh = new this.library.THREE.InstancedMesh(geometry, material, Math.max(1, count))
    mesh.count = count
    mesh.instanceMatrix.setUsage(this.library.THREE.DynamicDrawUsage)
    mesh.frustumCulled = false
    this.scene.add(mesh)
    this.instances.push(mesh)
    return mesh
  }

  /** The connecting bars and their light runs follow the bays: each is rebuilt from where its two bays' faces are now. */
  private updateLinks(): void {
    const { a, b, c, m, up, s, q } = this.scratch
    let bars = 0, lights = 0
    for (const link of this.links) {
      const from = this.bays[link.from]!, to = this.bays[link.to]!
      const at = (bay: Bay, along: number, target: THREE.Vector3) => {
        const p = axisPoint(link.direction, along, link.side * .84, link.side * .84)
        return target.set(p[0], p[1], p[2]).applyMatrix4(bay.group.matrix)
      }
      at(from, link.sign, a)
      at(to, -link.sign, b)
      c.copy(b).sub(a)
      const length = Math.max(1e-4, c.length())
      q.setFromUnitVectors(up, c.normalize())
      m.compose(c.copy(a).lerp(b, .5), q, s.set(.036, length, .036))
      this.connectors.setMatrixAt(bars++, m)
      if (link.side > 0) {
        c.copy(a).lerp(b, .5)
        c.y += .035
        m.compose(c, q, s.set(.013, length, .013))
        this.linkLights.setMatrixAt(lights++, m)
      }
    }
    this.connectors.instanceMatrix.needsUpdate = true
    this.linkLights.instanceMatrix.needsUpdate = true
  }

  private buildBeams(): void {
    const T = this.library.THREE
    // The cone runs from its apex at the origin along -Y, so it can be turned onto any direction.
    const cone = this.own(new T.CylinderGeometry(.02, 1, 1, 24, 1, true).translate(0, -.5, 0))
    const lensGeometry = this.own(new T.SphereGeometry(.13, 12, 8))
    // The fixtures stand on the bays furthest from the centre, one per bay, spread around it.
    const order = this.bays.map((bay, index) => ({
      index, distance: Math.hypot(bay.origin[0] - WIREFRAME_PORTAL_CENTER[0], bay.origin[1] - WIREFRAME_PORTAL_CENTER[1], bay.origin[2] - WIREFRAME_PORTAL_CENTER[2]),
      angle: Math.atan2(bay.input.outward[0], bay.input.outward[2]),
    })).sort((p, q) => q.distance - p.distance).slice(0, BEAM_MAX).sort((p, q) => p.angle - q.angle)
    for (const [slot, entry] of order.entries()) {
      const bay = this.bays[entry.index]!
      const beam = new T.Mesh(cone, this.mat(new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, side: T.DoubleSide,
        uniforms: { uColor: { value: new T.Color(1, 1, 1) }, uStrength: { value: 0 } },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            vUv = uv;
            vec4 view = modelViewMatrix * vec4(position, 1.0);
            vNormalView = normalize(normalMatrix * normal);
            vViewDirection = normalize(-view.xyz);
            gl_Position = projectionMatrix * view;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uStrength;
          varying vec2 vUv;
          varying vec3 vNormalView;
          varying vec3 vViewDirection;
          void main() {
            // Bright at the lens, fading along the beam, and soft at the silhouette so it reads as light in haze.
            float along = pow(clamp(vUv.y, 0.0, 1.0), 1.5);
            float facing = pow(clamp(abs(dot(normalize(vNormalView), normalize(vViewDirection))), 0.0, 1.0), 1.4);
            gl_FragColor = vec4(uColor * along * facing * uStrength, 1.0);
          }`,
      })))
      beam.name = `truss-beam-${slot + 1}`
      beam.frustumCulled = false
      beam.renderOrder = 5
      const lens = new T.Mesh(lensGeometry, this.mat(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })))
      lens.name = `truss-beam-lens-${slot + 1}`
      this.scene.add(beam, lens)
      this.fixtures.push({ bay: entry.index, outward: bay.input.outward as unknown as Cinema2Vector3, beam, lens, colorRole: slot % 3 })
    }
  }

  private updateBeams(c: WireframePortalControls, s: WireframePortalState, level: number): void {
    const T = this.library.THREE
    const { a, b, q, down } = this.scratch
    const visibleCount = BEAMS[s.quality]
    const ease = s.blend * s.blend * (3 - 2 * s.blend)
    const strobe = Math.max(0, Math.min(1, c.strobe))
    // The kick flashes the whole rig; during a blast the beams chop on and off four times a beat.
    const chop = s.beats * 4 % 1 < .5 ? 1 : .15
    const gate = s.blast > .05 && strobe > 0 ? 1 - (1 - chop) * Math.min(1, s.blast * 1.5) * strobe : 1
    const power = level * Math.max(0, c.beamLighting) * (1 + 1.4 * strobe * s.flash) * gate
    const roles: Rgb[] = [c.hotColor, c.coldRimColor, c.redRimColor]
    this.fixtures.forEach((fixture, index) => {
      const on = index < visibleCount && power > .003
      fixture.beam.visible = on
      fixture.lens.visible = on
      if (!on) return
      const input = { index, count: this.fixtures.length, outward: fixture.outward }
      let pose = evaluateWireframePortalBeam(s.pattern, s.beats, input, s.blast)
      if (ease < 1) pose = blendWireframePortalBeam(evaluateWireframePortalBeam(s.previousPattern, s.beats, input, s.blast), pose, ease)
      // The fixture rides on its bay, a little outside it.
      const bay = this.bays[fixture.bay]!
      a.set(bay.group.position.x + fixture.outward[0] * 1.25, bay.group.position.y + fixture.outward[1] * 1.25, bay.group.position.z + fixture.outward[2] * 1.25)
      fixture.beam.position.copy(a)
      fixture.lens.position.copy(a)
      q.setFromUnitVectors(down, b.set(pose.direction[0], pose.direction[1], pose.direction[2]))
      fixture.beam.quaternion.copy(q)
      const open = 1.2 * Math.max(.3, pose.width)
      fixture.beam.scale.set(open, BEAM_LENGTH, open)
      // The lens and the beam fade as the camera flies close to the fixture, so they never fill the screen.
      const near = s.eye ? Math.hypot(a.x - s.eye[0], a.y - s.eye[1], a.z - s.eye[2]) : Infinity
      const lensFade = s.eye ? smoothstep(.8, 4, near) : 1
      const beamFade = s.eye ? smoothstep(1.5, 7, near) : 1
      fixture.lens.visible = lensFade > .01
      const color = roles[fixture.colorRole]!
      ;(fixture.beam.material.uniforms.uColor!.value as THREE.Color).setRGB(color[0] ?? 1, color[1] ?? 1, color[2] ?? 1, T.SRGBColorSpace)
      fixture.beam.material.uniforms.uStrength!.value = .55 * power * Math.max(0, pose.power) * (.2 + .8 * beamFade)
      fixture.lens.material.color.setRGB(color[0] ?? 1, color[1] ?? 1, color[2] ?? 1, T.SRGBColorSpace).multiplyScalar(2.2 * power * Math.max(.3, pose.power) * lensFade)
    })
  }

  private spot(color: number, at: Cinema2Vector3): THREE.SpotLight {
    const T = this.library.THREE
    const light = new T.SpotLight(color, 0, 70, .75, .55, 2)
    light.position.set(at[0], at[1], at[2] - WIREFRAME_PORTAL_CENTER[2])
    light.target.position.set(0, 0, 0)
    this.rig.add(light, light.target)
    light.name = color === 0xbfd8ff ? 'truss-cold-rim' : 'truss-red-rim'
    return light
  }

  private setSpot(light: THREE.SpotLight, color: Rgb, intensity: number): void {
    light.color.setRGB(color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, this.library.THREE.SRGBColorSpace)
    light.intensity = intensity
    light.visible = intensity > .01
  }

  private buildDome(): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const T = this.library.THREE
    const material = this.mat(new T.ShaderMaterial({
      toneMapped: false, side: T.BackSide, depthWrite: false,
      uniforms: { uTint: { value: new T.Color(.012, .014, .02) }, uHaze: { value: .35 } },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTint;
        uniform float uHaze;
        varying vec3 vDirection;
        void main() {
          // A low cold band of haze along the horizon, fading to black overhead.
          float horizon = exp(-7.0 * vDirection.y * vDirection.y);
          float light = .35 + uHaze * 1.6 * horizon;
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

  /** A little dust drifting up through the lit volume. Built on first use at the current tier; the low tier draws none. */
  private updateDust(c: WireframePortalControls, phase: number, quality: Cinema2RenderQualityLevel, level: number): void {
    const T = this.library.THREE
    if (this.dustQuality !== quality) {
      if (this.dust) { this.dust.removeFromParent(); this.geometries.delete(this.dust.geometry); this.dust.geometry.dispose(); this.materials.delete(this.dust.material); this.dust.material.dispose(); this.dust = null }
      this.dustQuality = quality
      const count = DUST_COUNT[quality]
      if (count) {
        const positions = new Float32Array(count * 3)
        for (let i = 0; i < count; i += 1) positions.set([(hash(i, 1) - .5) * 26, (hash(i, 2) - .5) * 14, WIREFRAME_PORTAL_CENTER[2] + (hash(i, 3) - .5) * 26], i * 3)
        const geometry = this.own(new T.BufferGeometry())
        geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
        const material = this.mat(new T.PointsMaterial({ size: .05, sizeAttenuation: true, color: 0xffffff, transparent: true, opacity: .4, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false }))
        this.dust = new T.Points(geometry, material)
        this.dust.name = 'truss-dust'
        this.dust.frustumCulled = false
        this.scene.add(this.dust)
      }
    }
    if (!this.dust) return
    const amount = Math.max(0, Math.min(1, c.dust)) * Math.min(1.5, level)
    this.dust.visible = amount > .003
    this.dust.material.opacity = Math.min(1, amount * .55)
    this.dust.material.color.setRGB(c.coldRimColor[0] ?? 1, c.coldRimColor[1] ?? 1, c.coldRimColor[2] ?? 1, T.SRGBColorSpace)
    this.dust.position.y = (phase * .012) % 3
    this.dust.rotation.y = phase * .004
  }
}

function axisPoint(axis: number, across: number, a: number, b: number): Cinema2Vector3 {
  if (axis === 0) return [across, a, b]
  if (axis === 1) return [a, across, b]
  return [a, b, across]
}
