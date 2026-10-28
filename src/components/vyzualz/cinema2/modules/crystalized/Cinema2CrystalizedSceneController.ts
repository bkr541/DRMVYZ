import type * as Three from 'three'
import type { Cinema2ThreeLibrary } from '../three/Cinema2ThreeLibrary'
import type { Cinema2ModuleUpdateContext } from '../Cinema2ModuleContracts'
import { Cinema2CrystalizedPerformance } from './Cinema2CrystalizedPerformance'

/** Per-instance pivots and uniforms only; the bridge owns cloned materials and cached geometry. */
export class Cinema2CrystalizedSceneController {
  readonly performance = new Cinema2CrystalizedPerformance()
  private readonly master = { value: 1 }
  private readonly decorated = new WeakSet<Three.MeshStandardMaterial>()
  private readonly parts: { name: string; pivot: Three.Group; origin: Three.Vector3; mesh: Three.Mesh }[] = []
  private parameters: Cinema2ModuleUpdateContext['parameters'] | null = null
  private levels = [1, 1, 1, 1, 1]
  private lastTimestamp: number | null = null
  constructor(private readonly library: Cinema2ThreeLibrary) {}

  update(context: Cinema2ModuleUpdateContext): void {
    this.parameters = context.parameters
    this.performance.update(context)
    const t = context.frame.timestampMs
    const active = !context.frame.transport || (!context.frame.transport.paused && (!context.frame.transport.sourcePresent || context.frame.transport.playing))
    const dt = this.lastTimestamp == null ? .1 : Math.max(0, Math.min(.1, (t - this.lastTimestamp) / 1000))
    this.updateLevels(active ? 1 - Math.exp(-dt / .18) : 0)
    this.lastTimestamp = t
  }

  attach(root: Three.Object3D): void {
    const { THREE } = this.library
    const meshes: Three.Mesh[] = []
    root.traverse(object => { if ((object as Three.Mesh).isMesh) meshes.push(object as Three.Mesh) })
    for (const mesh of meshes) {
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Three.MeshStandardMaterial[]
      const name = materials[0].name || mesh.name
      if (!['crystal', 'left', 'violet', 'right', 'back'].includes(name)) continue
      mesh.geometry.computeBoundingBox()
      const center = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3())
      const origin = new THREE.Vector3(center.x, -1.2, center.z)
      const pivot = new THREE.Group(); pivot.name = `crystalized.${name}.pivot`; pivot.position.copy(origin)
      mesh.parent!.add(pivot); pivot.add(mesh); mesh.position.sub(origin)
      this.parts.push({ name, pivot, origin, mesh })
    }
  }

  private decorate(material: Three.MeshStandardMaterial): void {
    if (this.decorated.has(material)) return
    this.decorated.add(material)
    const prior = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material)
    material.onBeforeCompile = (shader, renderer) => {
      prior.call(material, shader, renderer)
      shader.uniforms.uCrystalizedMaster = this.master
      shader.fragmentShader = 'uniform float uCrystalizedMaster;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= uCrystalizedMaster;\n#include <opaque_fragment>')
    }
    material.customProgramCacheKey = () => `${key()}:crystalized-master-v1`
    material.needsUpdate = true
  }

  private updateLevels(blend: number): void {
    const c = this.performance.state
    const order = ['crystal', 'left', 'violet', 'right', 'back']
    const previous = this.levels
    this.levels = order.map((name, index) => {
      let level = 1
      if (c.pattern === 'orbit') level = .55 + .45 * (.5 + .5 * Math.cos(c.phase * Math.PI / 4 - index * Math.PI / 2))
      if (c.pattern === 'pulse') level = .7 + .3 * Math.max(c.beat, c.kick)
      if (c.pattern === 'cascade') level = .5 + .5 * (.5 + .5 * Math.sin(c.phase * Math.PI / 2 - index * 1.25))
      // Bounded palette/energy response. Retain the authored surface between hits.
      level *= c.significance * (1 + .2 * c.energy + .15 * c.bass + .18 * c.build + .2 * c.snare + .3 * c.drop)
      if (name !== 'crystal') level *= 1 - .15 * c.vocal
      return Math.max(.1, Math.min(3, level * blend + previous[index] * (1 - blend)))
    })
  }

  beforeDraw(): void {
    const c = this.performance.state
    this.master.value = c.master
    const order = ['crystal', 'left', 'violet', 'right', 'back']
    for (const { name, pivot, origin, mesh } of this.parts) {
      const crystal = name === 'crystal', index = order.indexOf(name)
      pivot.position.copy(origin)
      if (crystal) {
        // The center crystal stays planted on its floor pivot with a fixed orientation.
        const pulse = c.pattern === 'pulse' ? .05 * c.kick + .08 * c.drop : .02 * c.bass
        pivot.scale.setScalar(c.crystalScale * (1 + pulse * c.motion / .35))
      } else {
        const wave = c.pattern === 'cascade' ? .025 * (.5 + .5 * Math.sin(c.phase * Math.PI / 2 - index)) : 0
        pivot.scale.set(1, c.monolithHeight * (1 + wave * c.motion / .35), 1)
      }
      const authored = this.parameters?.get(`${name}.emissiveIntensity`)
      const base = typeof authored === 'number' ? authored : crystal ? 1 : 3.2
      // The shared bridge may upgrade Standard materials to Physical on its
      // first draw. Always address the live mesh material after that upgrade.
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Three.MeshStandardMaterial[]
      for (const material of materials) {
        this.decorate(material)
        material.emissiveIntensity = base * this.levels[index] * (crystal ? 1 + .12 * c.high + .15 * c.impact : 1)
      }
    }
  }

  dispose(): void { this.parts.length = 0; this.parameters = null }
}
