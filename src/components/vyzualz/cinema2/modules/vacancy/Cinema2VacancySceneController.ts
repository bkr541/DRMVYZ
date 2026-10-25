import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import {
  VACANCY_ROOM_NODE, VACANCY_TV_IDS, VACANCY_TV_NODE_PREFIX,
  type VacancyControls, type VacancyPlacement, type VacancyScreenAnchor, type VacancyTowerSize, type VacancyTvId, type VacancyTvSize,
} from './Cinema2VacancyDomain'
import { VACANCY_SCREEN_FRAGMENT, VACANCY_SCREEN_VERTEX } from './Cinema2VacancyScreens'
import type { Cinema2ManagedMediaResource } from '../../media/Cinema2MediaSlotRuntime'
import { VACANCY_NEUTRAL_PERFORMANCE, vacancyScreenLevel, type VacancyPerformanceFrame } from './Cinema2VacancyPerformance'
import { buildVacancyLayout } from './Cinema2VacancyStacking'

export interface VacancySceneFrame {
  controls: VacancyControls
  /** Seconds of visual time; drives the static. */
  timeSec: number
  quality: 'low' | 'medium' | 'high'
  performance?: VacancyPerformanceFrame
  media?: Readonly<Cinema2ManagedMediaResource> | null
}

/** Where the tower stands: the middle of the room's open floor. */
export const VACANCY_TOWER_ORIGIN = [0.46, 0, -0.1] as const
const TOWER_SIZE: VacancyTowerSize = 'standard'

interface RoomMaterial { material: Three.MeshStandardMaterial; color: Three.Color }
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
  private readonly highlight: Three.Color
  private readonly glow: Three.Color
  private readonly sizes = {} as Record<VacancyTvId, VacancyTvSize>
  private currentSize: VacancyTowerSize = 'standard'
  private readonly layouts = new Map<VacancyTowerSize, VacancyPlacement[]>()
  private mediaTexture: Three.Texture | null = null
  private mediaResource: Readonly<Cinema2ManagedMediaResource> | null = null
  private mediaRenderer: Three.WebGLRenderer | null = null

  constructor(private readonly library: Cinema2ThreeLibrary) {
    this.tint = new library.THREE.Color()
    this.roomTint = new library.THREE.Color()
    this.highlight = new library.THREE.Color()
    this.glow = new library.THREE.Color()
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

    const sizes = this.sizes
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
          this.roomMaterials.push({ material, color: material.color.clone() })
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
    this.layouts.set(TOWER_SIZE, layout)
    for (const placement of layout) {
      const holder = new THREE.Group()
      holder.position.set(placement.x, placement.y, placement.z)
      holder.rotation.y = placement.yaw
      holder.scale.setScalar(placement.scale ?? 1)
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
      uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: 1.45 }, uGrain: { value: 1 }, uScan: { value: 1 }, uHighlight: { value: new THREE.Color(1, 1, 1) }, uAccent: { value: 0 }, uInterference: { value: 0 },
        uWallBounds: { value: new THREE.Vector4(-2, 0, 4, 2.5) }, uMedia: { value: null }, uHasMedia: { value: 0 }, uMediaLayout: { value: 0 },
        uMediaAspect: { value: 1 }, uMediaOpacity: { value: 1 }, uStaticOverMedia: { value: .12 }, uMediaFit: { value: 1 },
        uMediaTransform: { value: new THREE.Vector4(.5, .5, 1, 1) }, uMediaRotation: { value: 0 } },
    })
    this.screens = new THREE.InstancedMesh(plane, this.screenMaterial, this.placed.length)
    this.screens.name = 'vacancy.screens'
    this.mediaTexture = new THREE.Texture()
    this.screenMaterial.uniforms.uMedia!.value = this.mediaTexture
    // Borrow the engine-managed texture in the same GL context. It is never uploaded or deleted by Three.
    this.screens.onBeforeRender = renderer => {
      this.mediaRenderer = renderer
      if (this.mediaTexture) {
        const properties = renderer.properties.get(this.mediaTexture) as { __webglTexture?: WebGLTexture; __version?: number }
        if (this.mediaResource) {
          properties.__webglTexture = this.mediaResource.texture
          properties.__version = this.mediaTexture.version
        } else {
          // A removed slot deletes its engine texture. Never bind that stale handle, even with the media branch disabled.
          delete properties.__webglTexture
          delete properties.__version
        }
      }
    }
    this.screens.frustumCulled = false
    this.updateScreenMatrices()
    this.tower.add(this.screens)

    // Screen spill covers the front, rear and side of the volume. Low quality keeps the front light.
    const rig: [number, number, number, number, 'low' | 'medium' | 'high'][] = [
      [0, 1.0, 1.8, 5, 'low'], [0, 0.9, -1.8, 3, 'medium'], [1.8, 1.4, 0, 3, 'high'],
    ]
    for (const [x, y, z, base, quality] of rig) {
      const light = new THREE.PointLight(0xffffff, 0, 9, 2)
      light.position.set(x, y, z)
      this.tower.add(light)
      this.lights.push({ light, base, quality })
    }
  }

  private updateScreenMatrices(): void {
    const { THREE } = this.library
    if (!this.screens || !this.screenMaterial) return
    const local = new THREE.Matrix4()
    let minX = Infinity, maxX = -Infinity, maxY = 0
    this.placed.forEach(({ holder, anchor }, index) => {
      holder.updateMatrix()
      local.makeTranslation(anchor.cx, anchor.cy, anchor.z).scale(new THREE.Vector3(anchor.width, anchor.height, 1))
      const matrix = new THREE.Matrix4().multiplyMatrices(holder.matrix, local)
      this.screens!.setMatrixAt(index, matrix)
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) {
        const corner = new THREE.Vector3(x, y, 0).applyMatrix4(matrix)
        minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x); maxY = Math.max(maxY, corner.y)
      }
    })
    ;(this.screenMaterial.uniforms.uWallBounds!.value as Three.Vector4).set(minX, 0, maxX - minX, maxY)
    this.screens.instanceMatrix.needsUpdate = true
  }

  private resizeTower(size: VacancyTowerSize): void {
    if (size === this.currentSize) return
    let layout = this.layouts.get(size)
    if (!layout) { layout = buildVacancyLayout(size, this.sizes); this.layouts.set(size, layout) }
    this.placed.forEach((tv, index) => {
      const p = layout![index]!
      tv.placement = p
      tv.holder.position.set(p.x, p.y, p.z); tv.holder.rotation.y = p.yaw; tv.holder.scale.setScalar(p.scale ?? 1)
    })
    this.currentSize = size; this.updateScreenMatrices()
  }

  apply(frame: VacancySceneFrame): void {
    const { controls: c } = frame
    const { THREE } = this.library
    if (!this.screenMaterial) return
    const material = this.screenMaterial
    this.resizeTower(c.towerSize ?? 'standard')
    const performance = frame.performance ?? VACANCY_NEUTRAL_PERFORMANCE
    const attribute = this.screens!.geometry.getAttribute('aScreen') as Three.InstancedBufferAttribute
    let total = 0
    this.placed.forEach(({ placement }, index) => {
      const gain = vacancyScreenLevel(placement, index, this.placed.length, performance)
      attribute.setX(index, gain); total += gain
    })
    attribute.needsUpdate = true
    const rattle = c.bassRattle * performance.significance * Math.min(1, performance.bass + performance.kick) * .004
    this.tower!.position.x = VACANCY_TOWER_ORIGIN[0] + Math.sin(frame.timeSec * 73) * rattle
    this.tower!.position.z = VACANCY_TOWER_ORIGIN[2] + Math.sin(frame.timeSec * 91 + 1) * rattle * .6
    material.uniforms.uTime!.value = frame.timeSec
    this.tint.setRGB(...c.colors.screen, THREE.SRGBColorSpace)
    ;(material.uniforms.uTint!.value as Three.Color).copy(this.tint)
    material.uniforms.uIntensity!.value = 1.45 * c.master / 0.85
    material.uniforms.uGrain!.value = c.static * performance.grain
    material.uniforms.uScan!.value = c.scanlines * (1 + .5 * performance.snare)
    material.uniforms.uInterference!.value = performance.pattern === 'interference' ? 1 : 0
    this.highlight.setRGB(...c.colors.highlight, THREE.SRGBColorSpace)
    ;(material.uniforms.uHighlight!.value as Three.Color).copy(this.highlight)
    material.uniforms.uAccent!.value = Math.min(1, performance.drop + performance.snare * .35 + performance.kick * .2)
    this.mediaResource = c.mediaOnScreens ? frame.media ?? null : null
    const media = this.mediaResource
    material.uniforms.uHasMedia!.value = media ? 1 : 0
    material.uniforms.uMediaLayout!.value = c.mediaLayout === 'stack-wall' ? 1 : 0
    material.uniforms.uStaticOverMedia!.value = c.staticOverMedia
    if (media) {
      material.uniforms.uMediaAspect!.value = media.width / Math.max(1, media.height)
      material.uniforms.uMediaOpacity!.value = media.presentation.opacity
      material.uniforms.uMediaFit!.value = media.presentation.fit === 'contain' ? 0 : media.presentation.fit === 'cover' ? 1 : 2
      ;(material.uniforms.uMediaTransform!.value as Three.Vector4).set(...media.presentation.position, ...media.presentation.scale)
      material.uniforms.uMediaRotation!.value = media.presentation.rotation * Math.PI / 180
    }
    this.glow.setRGB(...c.colors.glow, THREE.SRGBColorSpace)

    const order = { low: 0, medium: 1, high: 2 } as const
    for (const { light, base, quality } of this.lights) {
      const on = order[frame.quality] >= order[quality]
      light.visible = on
      light.color.copy(this.glow)
      light.intensity = on ? base * c.master / 0.85 * (total / this.placed.length) * (1 + .15 * performance.bass) : 0
    }

    // Visible baked room, tinted by the Background colour; Room Visibility controls its fill independently of quality.
    const bg = c.colors.background
    const peak = Math.max(bg[0], bg[1], bg[2], 1e-3)
    this.roomTint.setRGB(.5 + .5 * bg[0] / peak, .5 + .5 * bg[1] / peak, .5 + .5 * bg[2] / peak, THREE.SRGBColorSpace)
    // The supplied room's base map already contains deep baked shadows. It needs enough linear emission to survive
    // the scene/output passes; a small multiplier crushes its bricks and doorways into black behind the bright CRTs.
    const fill = Math.pow(c.roomVisibility, 0.8) * 6 * c.master / 0.85
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
    if (this.mediaTexture) { this.mediaRenderer?.properties.remove(this.mediaTexture); this.mediaTexture.dispose() }
    this.mediaTexture = null; this.mediaResource = null; this.mediaRenderer = null; this.layouts.clear()
    this.tower = null; this.screens = null; this.screenMaterial = null
    this.placed.length = 0; this.roomMaterials.length = 0; this.lights.length = 0
  }
}
