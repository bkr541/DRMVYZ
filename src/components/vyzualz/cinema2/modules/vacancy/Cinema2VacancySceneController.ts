import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  VACANCY_ROOM_NODE, VACANCY_TV_IDS, VACANCY_TV_NODE_PREFIX,
  type VacancyControls, type VacancyPlacement, type VacancyScreenAnchor, type VacancyTowerSize, type VacancyTvId, type VacancyTvSize,
} from './Cinema2VacancyDomain'
import { VACANCY_SCREEN_FRAGMENT, VACANCY_SCREEN_VERTEX } from './Cinema2VacancyScreens'
import { buildVacancyLayout } from './Cinema2VacancyStacking'

export interface VacancySceneFrame {
  controls: VacancyControls
  /** Seconds of visual time; drives the static. */
  timeSec: number
  quality: 'low' | 'medium' | 'high'
}

/** Where the tower stands: the middle of the room's open floor. */
export const VACANCY_TOWER_ORIGIN = [0.46, 0, -0.1] as const
const TOWER_SIZE: VacancyTowerSize = 'standard'

interface RoomMaterial { material: Three.MeshStandardMaterial; color: Three.Color; emissiveIntensity: number }
interface PlacedTv { placement: VacancyPlacement; holder: Three.Group; anchor: VacancyScreenAnchor }

const nodeName = (object: Three.Object3D): string => typeof object.userData.name === 'string' ? object.userData.name : object.name

/**
 * Owns everything VACANCY adds to the loaded set: the tower of television clones (sharing the cached geometry and materials), one instanced
 * screen layer, the glow lights and the darkening of the room. The cached source nodes stay hidden and untouched.
 */
export class Cinema2VacancySceneController {
  private tower: Three.Group | null = null
  private screens: Three.InstancedMesh | null = null
  private screenMaterial: Three.ShaderMaterial | null = null
  private readonly placed: PlacedTv[] = []
  private readonly roomMaterials: RoomMaterial[] = []
  private readonly lights: { light: Three.PointLight; base: number; quality: 'low' | 'medium' | 'high' }[] = []
  private readonly tint: Three.Color
  private readonly roomTint: Three.Color

  constructor(private readonly library: Cinema2ThreeLibrary) {
    this.tint = new library.THREE.Color()
    this.roomTint = new library.THREE.Color()
  }

  get layout(): readonly VacancyPlacement[] { return this.placed.map(p => p.placement) }

  attach(root: Three.Object3D): void {
    const { THREE } = this.library
    const templates = new Map<VacancyTvId, Three.Object3D>()
    let room: Three.Object3D | null = null
    root.traverse(object => {
      const name = nodeName(object)
      if (name === VACANCY_ROOM_NODE) room = object
      else if (name.startsWith(VACANCY_TV_NODE_PREFIX)) templates.set(name.slice(VACANCY_TV_NODE_PREFIX.length) as VacancyTvId, object)
    })
    if (!room || VACANCY_TV_IDS.some(id => !templates.has(id))) throw new Error('VACANCY requires the room and all six television models in its set.')

    const sizes = {} as Record<VacancyTvId, VacancyTvSize>
    const anchors = {} as Record<VacancyTvId, VacancyScreenAnchor>
    for (const id of VACANCY_TV_IDS) {
      const data = templates.get(id)!.userData as { size?: number[]; bodyHeight?: number; screen?: VacancyScreenAnchor }
      if (!data.size || data.size.length < 3 || typeof data.bodyHeight !== 'number' || !data.screen) throw new Error(`VACANCY model "${id}" is missing its size or screen anchor.`)
      sizes[id] = { width: data.size[0]!, height: data.size[1]!, depth: data.size[2]!, bodyHeight: data.bodyHeight }
      anchors[id] = data.screen
      templates.get(id)!.visible = false
    }

    // Room: remember each material's authored look; the draw hook scales it, because the bridge only rewrites materials when overrides change.
    ;(room as Three.Object3D).traverse(object => {
      const mesh = object as Three.Mesh
      if (!mesh.isMesh) return
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Three.MeshStandardMaterial[]) {
        if (material.isMeshStandardMaterial && !this.roomMaterials.some(entry => entry.material === material)) {
          this.roomMaterials.push({ material, color: material.color.clone(), emissiveIntensity: material.emissiveIntensity })
          // The room's baked colour doubles as a dim self-lit fill, so its bricks, doorways and floor read even where the screens' light does not reach.
          if (material.map) { material.emissiveMap = material.map; material.needsUpdate = true }
        }
      }
    })

    this.tower = new THREE.Group()
    this.tower.name = 'vacancy.tower'
    this.tower.position.set(...VACANCY_TOWER_ORIGIN)
    root.add(this.tower)

    const layout = buildVacancyLayout(TOWER_SIZE, sizes)
    for (const placement of layout) {
      const holder = new THREE.Group()
      holder.position.set(placement.x, placement.y, placement.z)
      holder.rotation.y = placement.yaw
      holder.add(templates.get(placement.tv)!.clone(true))
      holder.traverse(object => { object.visible = true })
      this.tower.add(holder)
      this.placed.push({ placement, holder, anchor: anchors[placement.tv] })
    }
    this.tower.updateMatrixWorld(true)

    const plane = new THREE.PlaneGeometry(1, 1)
    const params = new Float32Array(this.placed.length * 4)
    this.placed.forEach(({ anchor, placement }, index) => {
      params.set([1, ((placement.tier * 13 + placement.index * 5 + 3) % 17) / 17, anchor.radius / anchor.height, anchor.width / anchor.height], index * 4)
    })
    plane.setAttribute('aScreen', new THREE.InstancedBufferAttribute(params, 4))
    this.screenMaterial = new THREE.ShaderMaterial({
      vertexShader: VACANCY_SCREEN_VERTEX, fragmentShader: VACANCY_SCREEN_FRAGMENT, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: 1.45 }, uGrain: { value: 1 }, uScan: { value: 1 } },
    })
    this.screens = new THREE.InstancedMesh(plane, this.screenMaterial, this.placed.length)
    this.screens.name = 'vacancy.screens'
    this.screens.frustumCulled = false
    const local = new THREE.Matrix4()
    this.placed.forEach(({ holder, anchor }, index) => {
      holder.updateMatrix()
      local.makeTranslation(anchor.cx, anchor.cy, anchor.z).scale(new THREE.Vector3(anchor.width, anchor.height, 1))
      this.screens!.setMatrixAt(index, new THREE.Matrix4().multiplyMatrices(holder.matrix, local))
    })
    this.screens.instanceMatrix.needsUpdate = true
    this.tower.add(this.screens)

    // Glow lights: the screens are the only light in the room. Low quality keeps one.
    const rig: [number, number, number, number, 'low' | 'medium' | 'high'][] = [
      [0, 1.0, 1.8, 5, 'low'], [0, 0.55, 1.2, 1.5, 'medium'], [0, 2.3, 2.6, 3, 'high'],
    ]
    for (const [x, y, z, base, quality] of rig) {
      const light = new THREE.PointLight(0xffffff, 0, 9, 2)
      light.position.set(x, y, z)
      this.tower.add(light)
      this.lights.push({ light, base, quality })
    }
  }

  apply(frame: VacancySceneFrame): void {
    const { controls: c } = frame
    const { THREE } = this.library
    if (!this.screenMaterial) return
    const material = this.screenMaterial
    material.uniforms.uTime!.value = frame.timeSec
    this.tint.setRGB(...c.colors.screen, THREE.SRGBColorSpace)
    ;(material.uniforms.uTint!.value as Three.Color).copy(this.tint)
    material.uniforms.uIntensity!.value = 1.45 * c.master / 0.85

    const order = { low: 0, medium: 1, high: 2 } as const
    for (const { light, base, quality } of this.lights) {
      const on = order[frame.quality] >= order[quality]
      light.visible = on
      light.color.copy(this.tint)
      light.intensity = on ? base * c.master / 0.85 : 0
    }

    // Near-black room, tinted by the Background colour; Room Visibility raises it toward the authored baked look.
    const bg = c.colors.background
    const peak = Math.max(bg[0], bg[1], bg[2], 1e-3)
    this.roomTint.setRGB(.5 + .5 * bg[0] / peak, .5 + .5 * bg[1] / peak, .5 + .5 * bg[2] / peak, THREE.SRGBColorSpace)
    const fill = Math.pow(c.roomVisibility, 1.2) * 1.5
    for (const entry of this.roomMaterials) {
      entry.material.color.copy(entry.color).multiply(this.roomTint).multiplyScalar(.55)
      entry.material.emissive.copy(this.roomTint)
      entry.material.emissiveIntensity = fill
    }
  }

  dispose(): void {
    this.screens?.removeFromParent(); this.screens?.geometry.dispose(); this.screens?.dispose()
    this.screenMaterial?.dispose()
    for (const { light } of this.lights) { light.removeFromParent(); light.dispose() }
    this.tower?.removeFromParent()
    this.tower = null; this.screens = null; this.screenMaterial = null
    this.placed.length = 0; this.roomMaterials.length = 0; this.lights.length = 0
  }
}
