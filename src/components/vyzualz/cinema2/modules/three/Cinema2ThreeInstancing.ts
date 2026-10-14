import type * as ThreeNamespace from 'three'
import type { Cinema2ColorInput, Cinema2Vec2Input } from './Cinema2ThreeMaterialKit'

/**
 * Instanced rendering for repeated objects (bolts, crystals, lights, mechanical elements, decorative structures): one `InstancedMesh` draws
 * hundreds of copies of one geometry in a single draw call. `Cinema2InstancedBatch` wraps the bookkeeping presets would otherwise repeat:
 * a fixed capacity, a live count, per-instance transform and optional color, change tracking so GPU buffers are re-uploaded once per commit, and
 * bounds for frustum culling.
 *
 * The batch shares the geometry and material it is given with whoever else uses them; `dispose()` frees only the instance buffers it created.
 */
export type Cinema2Vec3 = readonly [x: number, y: number, z: number]

export interface Cinema2InstanceTransform {
  position: Cinema2Vec3
  /** Euler angles in radians (XYZ). */
  rotation?: Cinema2Vec3
  /** Uniform scale or per-axis scale. */
  scale?: number | Cinema2Vec3
  color?: Cinema2ColorInput
}

export interface Cinema2InstancedBatchOptions {
  name?: string
  /** `true` when instance transforms change every frame: culling bounds are not recomputed on commit and the batch is never culled. */
  dynamic?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  /** Allocate the per-instance color buffer (needed for `color` in transforms and `setColor`). */
  perInstanceColor?: boolean
}

export interface Cinema2InstancedBatchStats {
  capacity: number
  count: number
  /** Draw calls the batch costs (always 1 while `count > 0`). */
  drawCalls: number
  /** Triangles drawn per frame. */
  triangles: number
  /** Bytes of per-instance GPU buffers (matrices, and colors when allocated). */
  instanceBytes: number
}

export class Cinema2InstancedBatch {
  readonly mesh: ThreeNamespace.InstancedMesh
  private readonly matrix: ThreeNamespace.Matrix4
  private readonly position: ThreeNamespace.Vector3
  private readonly quaternion: ThreeNamespace.Quaternion
  private readonly euler: ThreeNamespace.Euler
  private readonly scaleVector: ThreeNamespace.Vector3
  private readonly colorScratch: ThreeNamespace.Color
  private readonly dynamic: boolean
  private colorsDirty = false
  private matricesDirty = false
  private disposed = false

  constructor(
    private readonly THREE: typeof ThreeNamespace,
    geometry: ThreeNamespace.BufferGeometry,
    material: ThreeNamespace.Material | ThreeNamespace.Material[],
    readonly capacity: number,
    options: Readonly<Cinema2InstancedBatchOptions> = {},
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Cinema 2.0 instanced batch capacity must be a positive integer.')
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.name = options.name ?? 'cinema2-instances'
    this.mesh.count = 0
    this.mesh.castShadow = options.castShadow ?? false
    this.mesh.receiveShadow = options.receiveShadow ?? false
    this.dynamic = options.dynamic ?? false
    if (this.dynamic) {
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      this.mesh.frustumCulled = false
    }
    if (options.perInstanceColor) {
      // Allocating the buffer now (white) means later `setColor` calls never change the shader program.
      this.mesh.setColorAt(0, new THREE.Color(1, 1, 1))
      for (let index = 1; index < capacity; index += 1) this.mesh.setColorAt(index, new THREE.Color(1, 1, 1))
      if (this.dynamic && this.mesh.instanceColor) this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
    }
    this.matrix = new THREE.Matrix4()
    this.position = new THREE.Vector3()
    this.quaternion = new THREE.Quaternion()
    this.euler = new THREE.Euler()
    this.scaleVector = new THREE.Vector3()
    this.colorScratch = new THREE.Color()
  }

  get count(): number {
    return this.mesh.count
  }

  /** Number of instances drawn. Cannot exceed the capacity. */
  setCount(count: number): void {
    this.mesh.count = Math.max(0, Math.min(this.capacity, Math.floor(count)))
    this.matricesDirty = true
  }

  set(index: number, transform: Readonly<Cinema2InstanceTransform>): void {
    this.assertIndex(index)
    this.position.set(transform.position[0], transform.position[1], transform.position[2])
    const rotation = transform.rotation ?? [0, 0, 0]
    this.quaternion.setFromEuler(this.euler.set(rotation[0], rotation[1], rotation[2]))
    const scale = transform.scale ?? 1
    if (typeof scale === 'number') this.scaleVector.set(scale, scale, scale)
    else this.scaleVector.set(scale[0], scale[1], scale[2])
    this.mesh.setMatrixAt(index, this.matrix.compose(this.position, this.quaternion, this.scaleVector))
    this.matricesDirty = true
    if (transform.color !== undefined) this.setColor(index, transform.color)
  }

  setMatrix(index: number, matrix: ThreeNamespace.Matrix4): void {
    this.assertIndex(index)
    this.mesh.setMatrixAt(index, matrix)
    this.matricesDirty = true
  }

  setColor(index: number, color: Cinema2ColorInput): void {
    this.assertIndex(index)
    if (!this.mesh.instanceColor) throw new Error('Cinema 2.0 instanced batch was created without perInstanceColor.')
    if (typeof color === 'string' || typeof color === 'number') this.colorScratch.set(color as ThreeNamespace.ColorRepresentation)
    else this.colorScratch.setRGB(color[0], color[1], color[2])
    this.mesh.setColorAt(index, this.colorScratch)
    this.colorsDirty = true
  }

  /** Replaces every instance: sets the count and each transform. */
  setAll(transforms: readonly Readonly<Cinema2InstanceTransform>[]): void {
    if (transforms.length > this.capacity) throw new Error(`Cinema 2.0 instanced batch holds ${this.capacity} instances; ${transforms.length} were given.`)
    this.setCount(transforms.length)
    transforms.forEach((transform, index) => this.set(index, transform))
    this.commit()
  }

  /** Uploads changed instance data. Static batches also refresh their culling bounds. */
  commit(): void {
    if (this.matricesDirty) {
      this.mesh.instanceMatrix.needsUpdate = true
      this.matricesDirty = false
      if (!this.dynamic) this.mesh.computeBoundingSphere()
    }
    if (this.colorsDirty && this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true
      this.colorsDirty = false
    }
  }

  getStats(): Readonly<Cinema2InstancedBatchStats> {
    const geometry = this.mesh.geometry
    const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0) / 3
    return Object.freeze({
      capacity: this.capacity,
      count: this.mesh.count,
      drawCalls: this.mesh.count > 0 ? 1 : 0,
      triangles: Math.round(triangles * this.mesh.count),
      instanceBytes: this.mesh.instanceMatrix.array.byteLength + (this.mesh.instanceColor?.array.byteLength ?? 0),
    })
  }

  /** Frees the per-instance buffers. The geometry and material belong to whoever supplied them. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.mesh.removeFromParent()
    this.mesh.dispose()
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.capacity) throw new RangeError(`Cinema 2.0 instanced batch index ${index} is outside 0..${this.capacity - 1}.`)
  }
}

/** Convenience for placing instances on a grid or ring layout without every preset rewriting the math. */
export function cinema2RingLayout(count: number, radius: number, options: { y?: number; startAngle?: number; faceCenter?: boolean } = {}): Cinema2InstanceTransform[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (options.startAngle ?? 0) + (index / count) * Math.PI * 2
    return {
      position: [Math.cos(angle) * radius, options.y ?? 0, Math.sin(angle) * radius] as const,
      ...(options.faceCenter ? { rotation: [0, -angle - Math.PI / 2, 0] as const } : {}),
    }
  })
}

export function cinema2GridLayout(columns: number, rows: number, spacing: Cinema2Vec2Input, options: { y?: number } = {}): Cinema2InstanceTransform[] {
  const result: Cinema2InstanceTransform[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      result.push({ position: [(column - (columns - 1) / 2) * spacing[0], options.y ?? 0, (row - (rows - 1) / 2) * spacing[1]] })
    }
  }
  return result
}
