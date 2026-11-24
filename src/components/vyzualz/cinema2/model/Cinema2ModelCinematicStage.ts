import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../modules/three/Cinema2ThreeLibrary'
import type { Cinema2ModuleParameterReadFacet } from '../modules/Cinema2ModuleContracts'
import type { Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import { modelFxColor, modelFxNumber } from './Cinema2ModelCinematicMaterials'

export function createCinema2Helix(T: Cinema2ThreeLibrary['THREE'], radius: number, turns: number, segments: number, thickness: number): Three.TubeGeometry {
  class Helix extends T.Curve<Three.Vector3> {
    getPoint(t: number, target = new T.Vector3()): Three.Vector3 {
      const angle = t * turns * Math.PI * 2
      return target.set(Math.cos(angle) * radius, (t - .5) * radius * 2.8, Math.sin(angle) * radius)
    }
  }
  return new T.TubeGeometry(new Helix(), segments, thickness, 6, false)
}
/** Stage is a sibling of the model pivot: light motion never inherits representation rotation. */
export class Cinema2ModelCinematicStage {
  private readonly group: Three.Group
  private readonly accent: Three.PointLight
  private readonly helix: Three.Mesh<Three.TubeGeometry, Three.MeshStandardMaterial>
  private geometryKey = ''
  private phase = 0
  constructor(private readonly library: Cinema2ThreeLibrary, root: Three.Object3D) {
    const T = library.THREE
    this.group = new T.Group(); this.group.name = 'CinematicModelStage'; root.add(this.group)
    this.accent = new T.PointLight(0x00eaff, 0, 7, 2); this.group.add(this.accent)
    this.helix = new T.Mesh(createCinema2Helix(T, 1, 3, 96, .018), new T.MeshStandardMaterial({ color: 0x00eaff, emissive: 0x00eaff, emissiveIntensity: 3, roughness: .3 }))
    this.helix.visible = false; this.group.add(this.helix)
  }
  update(p: Cinema2ModuleParameterReadFacet, dt: number, quality: Cinema2RenderQualityLevel): void {
    const T = this.library.THREE, n = (key: string, fallback: number, min = 0, max = 4) => modelFxNumber(p, key, fallback, min, max)
    this.phase = (this.phase + Math.max(0, Math.min(.1, dt)) * n('cinematicLightSpeed', .5, 0, 3)) % (Math.PI * 2)
    const pattern = p.get('cinematicLightMotion'), angle = pattern === 'orbit' ? this.phase : pattern === 'sway' ? Math.sin(this.phase) * 1.1 : 0
    const v = p.get('cinematicAccentPosition'), pos = Array.isArray(v) && v.length === 3 ? v : [2, 1.5, -2]
    this.accent.position.set(Number(pos[0]), Number(pos[1]), Number(pos[2])).applyAxisAngle(new T.Vector3(0, 1, 0), angle)
    this.accent.color.copy(modelFxColor(T, p, 'cinematicAccentColor', 0x00eaff)); this.accent.intensity = n('cinematicAccentIntensity', 0, 0, 30)
    this.accent.distance = n('cinematicAccentRange', 7, 1, 20)
    this.helix.visible = p.get('cinematicHelix') === true
    if (!this.helix.visible) return
    const radius = n('cinematicHelixRadius', 1.25, .2, 3), turns = n('cinematicHelixTurns', 3, 1, 12), segments = Math.round(Math.min(n('cinematicHelixSegments', 192, 32, 512), quality === 'low' ? 96 : quality === 'medium' ? 256 : 512)), thickness = n('cinematicHelixThickness', .018, .005, .12)
    const key = `${radius}:${turns}:${segments}:${thickness}`
    if (key !== this.geometryKey) { const next = createCinema2Helix(T, radius, turns, segments, thickness); this.helix.geometry.dispose(); this.helix.geometry = next; this.geometryKey = key }
    this.helix.rotation.y = n('cinematicHelixRotation', 0, -180, 180) * Math.PI / 180 + this.phase
    this.helix.material.color.copy(modelFxColor(T, p, 'primary', 0x00eaff)); this.helix.material.emissive.copy(this.helix.material.color); this.helix.material.emissiveIntensity = n('cinematicHelixEmission', 3, 0, 8)
  }
  dispose(): void { this.group.removeFromParent(); this.helix.geometry.dispose(); this.helix.material.dispose(); this.accent.dispose() }
}
