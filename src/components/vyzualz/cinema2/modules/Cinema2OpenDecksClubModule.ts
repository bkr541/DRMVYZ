import type * as THREE from 'three'
import { cinema2StableId, type Cinema2ModuleTypeId, type Cinema2RenderQualityLevel } from '../contracts/Cinema2NativePresetManifest'
import { Cinema2BeatClock } from './Cinema2BeatClock'
import type { Cinema2ModuleUpdateContext } from './Cinema2ModuleContracts'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import type { Cinema2ThreeLibrary } from './three/Cinema2ThreeLibrary'

export const CINEMA2_OPEN_DECKS_CLUB_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('open-decks-club')
interface Dancer { index: number; row: number; pivot: THREE.Group; arms: THREE.Group[]; base: number }
interface Beam { pivot: THREE.Group; materials: THREE.MeshStandardMaterial[]; side: number }

/** Preset-owned choreography; the shared module still owns loading, materials and disposal. */
export class Cinema2OpenDecksClubController {
  readonly afterVisibility = true
  private readonly clock = new Cinema2BeatClock()
  private readonly dancers: Dancer[] = []
  private readonly beams: Beam[] = []
  private phase = 0
  private energy = .15
  constructor(private readonly library: Cinema2ThreeLibrary) {}

  attach(root: THREE.Object3D) {
    const actors = new Map<number, THREE.Object3D[]>()
    const beams: THREE.Object3D[] = []
    root.traverse(object => {
      if (Number.isInteger(object.userData.clubActor)) {
        const index = object.userData.clubActor as number
        const parts = actors.get(index) ?? []; parts.push(object); actors.set(index, parts)
      }
      if (object.userData.clubBeam === true) beams.push(object)
    })
    const reparent = (object: THREE.Object3D, pivot: THREE.Group, position: THREE.Vector3) => {
      object.position.sub(position)
      pivot.add(object)
    }
    for (const [index, parts] of actors) {
      const body = parts.find(part => part.userData.clubRole === 'body')
      if (!body?.parent) continue
      const parent = body.parent, origin = new this.library.THREE.Vector3().fromArray(body.userData.clubPivot)
      const pivot = new this.library.THREE.Group(); pivot.position.copy(origin); parent.add(pivot)
      const arms: THREE.Group[] = []
      for (const part of parts) {
        if (part === body) { reparent(part, pivot, origin); continue }
        const shoulder = new this.library.THREE.Vector3().fromArray(part.userData.clubPivot)
        const joint = new this.library.THREE.Group(); joint.position.copy(shoulder).sub(origin); pivot.add(joint)
        reparent(part, joint, shoulder); arms.push(joint)
      }
      this.dancers.push({ index, row: body.userData.clubRow, pivot, arms, base: origin.z })
    }
    for (const [index, object] of beams.entries()) {
      if (!object.parent) continue
      const parent = object.parent, origin = new this.library.THREE.Vector3().fromArray(object.userData.clubPivot)
      const pivot = new this.library.THREE.Group(); pivot.position.copy(origin); parent.add(pivot); reparent(object, pivot, origin)
      const materials: THREE.MeshStandardMaterial[] = []
      object.traverse(child => {
        const mesh = child as THREE.Mesh
        if (!mesh.isMesh) return
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const standard = material as THREE.MeshStandardMaterial
          standard.depthWrite = false
          standard.blending = this.library.THREE.AdditiveBlending
          materials.push(standard)
        }
      })
      this.beams.push({ pivot, materials, side: index === 0 ? -1 : 1 })
    }
  }

  update({ frame }: Cinema2ModuleUpdateContext) {
    const idle = frame.transport && !frame.transport.sourcePresent
    this.phase = this.clock.update(idle ? { ...frame, transport: undefined } : frame, frame.transport?.bpmSync !== false).beats * Math.PI
    if (frame.transport?.sourcePresent && frame.transport.paused) return
    const signal = frame.audio?.features.overallEnergy
    const target = signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value) ? Math.max(0, Math.min(1, signal.value)) : .15
    this.energy += (target - this.energy) * (1 - Math.exp(-Math.max(0, frame.deltaTimeSec) * 5))
  }

  beforeDraw(quality: Cinema2RenderQualityLevel) {
    for (const dancer of this.dancers) {
      dancer.pivot.visible = quality === 'high' || (quality === 'medium' ? dancer.row < 4 : dancer.index % 3 === 0)
      const phase = this.phase + dancer.index * 1.71
      dancer.pivot.rotation.y = Math.sin(phase * .5) * (.035 + this.energy * .035)
      dancer.pivot.rotation.z = Math.sin(phase * .25) * .045
      dancer.pivot.position.z = dancer.base + Math.max(0, Math.sin(phase)) * (.08 + this.energy * .16)
      dancer.arms.forEach((arm, index) => { arm.rotation.y = Math.sin(phase * .5 + index * 2) * (.13 + this.energy * .17) })
    }
    for (const beam of this.beams) {
      beam.pivot.rotation.z = Math.sin(this.phase * .125 + beam.side) * .055
      beam.pivot.rotation.x = Math.sin(this.phase * .1 + beam.side) * .025
      for (const material of beam.materials) {
        material.opacity = .055 + this.energy * .055
        material.emissiveIntensity = .75 + this.energy * .6
      }
    }
  }

  dispose() { this.dancers.length = 0; this.beams.length = 0; this.clock.reset() }
}

export const cinema2OpenDecksClubModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_OPEN_DECKS_CLUB_MODULE_TYPE_ID,
  resourceKey: 'open-decks-club:bridge',
  createModelController: library => new Cinema2OpenDecksClubController(library),
})
