import type { CinemaColor, CinemaVector3 } from './CinemaDomain'
import type { CinemaCameraUniformSnapshot, CinemaViewport } from './CinemaRendererContracts'
import type {
  CinemaMeshIndexRange,
  CinemaVectorCpuMesh,
  CinemaVectorMeshComponentRanges,
  CinemaVectorMeshRegionRanges,
} from './CinemaVectorGeometry'

export type CinemaCpuMeshKey = string

export interface CinemaGpuMeshLease {
  readonly leaseId: string
  readonly meshKey: CinemaCpuMeshKey
  readonly indexCount: number
  readonly indexType: 'uint32'
  readonly surfaces: Readonly<{
    front: CinemaMeshIndexRange
    back: CinemaMeshIndexRange
    sides: CinemaMeshIndexRange
  }>
  readonly components: readonly Readonly<CinemaVectorMeshComponentRanges>[]
  readonly regions: readonly Readonly<CinemaVectorMeshRegionRanges>[]
  release(): void
}

export interface CinemaObject3DTransform {
  position?: CinemaVector3
  rotation?: CinemaVector3
  scale?: CinemaVector3
  pivot?: CinemaVector3
}

export interface CinemaObject3DMaterial {
  frontColor?: CinemaColor
  sideColor?: CinemaColor
  emissiveIntensity?: number
  ambientIntensity?: number
  lightDirection?: CinemaVector3
}

export interface CinemaObject3DDrawRequest {
  mesh: CinemaGpuMeshLease
  viewport: Readonly<CinemaViewport>
  camera: Readonly<CinemaCameraUniformSnapshot> | null
  transform?: Readonly<CinemaObject3DTransform>
  /** Precomposed world model matrix. When provided it is authoritative over transform. */
  modelMatrix?: ArrayLike<number>
  material?: Readonly<CinemaObject3DMaterial>
}

export interface CinemaObject3DRenderService {
  acquireMesh(meshKey: CinemaCpuMeshKey, mesh: Readonly<CinemaVectorCpuMesh>): CinemaGpuMeshLease
  draw(request: Readonly<CinemaObject3DDrawRequest>): boolean
  getDiagnostics(): Readonly<CinemaObject3DRendererDiagnostics>
}

export interface CinemaObject3DRendererDiagnostics {
  contextGeneration: number
  contextLost: boolean
  cachedMeshCount: number
  meshCapacity: number
  activeLeaseCount: number
  gpuUploadCount: number
  gpuDeleteCount: number
  programCreateCount: number
  programDeleteCount: number
  drawCount: number
}

interface CinemaGpuMeshResource {
  vao: WebGLVertexArrayObject
  positionBuffer: WebGLBuffer
  normalBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  contextGeneration: number
}

interface CinemaGpuMeshEntry {
  key: CinemaCpuMeshKey
  fingerprint: string
  mesh: Readonly<CinemaVectorCpuMesh>
  resource: CinemaGpuMeshResource | null
  referenceCount: number
}

interface CinemaObject3DProgram {
  program: WebGLProgram
  uniforms: {
    model: WebGLUniformLocation | null
    view: WebGLUniformLocation | null
    projection: WebGLUniformLocation | null
    normalMatrix: WebGLUniformLocation | null
    color: WebGLUniformLocation | null
    lightDirection: WebGLUniformLocation | null
    ambientIntensity: WebGLUniformLocation | null
    emissiveIntensity: WebGLUniformLocation | null
  }
}

const DEFAULT_POSITION: CinemaVector3 = Object.freeze([0, 0, 0])
const DEFAULT_ROTATION: CinemaVector3 = Object.freeze([0, 0, 0])
const DEFAULT_SCALE: CinemaVector3 = Object.freeze([1, 1, 1])
const DEFAULT_PIVOT: CinemaVector3 = Object.freeze([0, 0, 0])
const DEFAULT_FRONT_COLOR: CinemaColor = Object.freeze([1, 1, 1, 1])
const DEFAULT_SIDE_COLOR: CinemaColor = Object.freeze([0.42, 0.46, 0.52, 1])
const DEFAULT_LIGHT_DIRECTION: CinemaVector3 = Object.freeze([0.35, 0.72, 0.6])
const DEFAULT_AMBIENT_INTENSITY = 0.28
export const CINEMA_OBJECT_3D_DEFAULT_GPU_MESH_CAPACITY = 64

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat3 uNormalMatrix;
out vec3 vNormal;
void main() {
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform float uAmbientIntensity;
uniform float uEmissiveIntensity;
out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 lightDirection = normalize(uLightDirection);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float lighting = uAmbientIntensity + (1.0 - uAmbientIntensity) * diffuse;
  vec3 color = uColor * lighting + uColor * max(0.0, uEmissiveIntensity);
  outColor = vec4(color, 1.0);
}`

/** Context-owned bridge from Stage 1 CPU meshes to reusable Cinema WebGL objects. */
export class CinemaObject3DRenderer implements CinemaObject3DRenderService {
  private readonly entries = new Map<CinemaCpuMeshKey, CinemaGpuMeshEntry>()
  private readonly leaseToKey = new Map<string, CinemaCpuMeshKey>()
  private nextLeaseId = 1
  private program: CinemaObject3DProgram | null = null
  private recreateProgramAfterRestore = false
  private contextGeneration = 1
  private contextLost = false
  private disposed = false
  private gpuUploadCount = 0
  private gpuDeleteCount = 0
  private programCreateCount = 0
  private programDeleteCount = 0
  private drawCount = 0

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly maximumMeshEntries = CINEMA_OBJECT_3D_DEFAULT_GPU_MESH_CAPACITY,
  ) {
    if (!Number.isInteger(maximumMeshEntries) || maximumMeshEntries <= 0) {
      throw new RangeError('Cinema 3D GPU mesh capacity must be a positive integer.')
    }
  }

  acquireMesh(meshKey: CinemaCpuMeshKey, mesh: Readonly<CinemaVectorCpuMesh>): CinemaGpuMeshLease {
    this.assertActive()
    if (this.contextLost) throw new Error('Cinema 3D GPU meshes cannot be acquired while the WebGL context is lost.')
    const key = meshKey.trim()
    if (!key) throw new Error('Cinema 3D CPU mesh key must be a non-empty stable string.')
    validateCpuMesh(mesh)
    const fingerprint = fingerprintCpuMesh(mesh)
    let entry = this.entries.get(key)
    if (entry && entry.fingerprint !== fingerprint) {
      throw new Error(`Cinema 3D CPU mesh key collision for "${key}".`)
    }
    if (!entry) {
      if (this.entries.size >= this.maximumMeshEntries) {
        throw new Error(`Cinema 3D GPU mesh capacity (${this.maximumMeshEntries}) is exhausted.`)
      }
      entry = { key, fingerprint, mesh, resource: this.uploadMesh(mesh), referenceCount: 0 }
      this.entries.set(key, entry)
    } else if (!entry.resource) {
      entry.resource = this.uploadMesh(entry.mesh)
    }
    entry.referenceCount += 1

    const leaseId = `cinema-3d-mesh:${this.nextLeaseId++}`
    this.leaseToKey.set(leaseId, key)
    let released = false
    return Object.freeze({
      leaseId,
      meshKey: key,
      indexCount: mesh.indices.length,
      indexType: 'uint32' as const,
      surfaces: Object.freeze({
        front: Object.freeze({ ...mesh.surfaces.front }),
        back: Object.freeze({ ...mesh.surfaces.back }),
        sides: Object.freeze({ ...mesh.surfaces.sides }),
      }),
      components: Object.freeze(mesh.components.map(component => Object.freeze({
        ...component,
        front: Object.freeze({ ...component.front }),
        back: Object.freeze({ ...component.back }),
        sides: Object.freeze({ ...component.sides }),
      }))),
      regions: Object.freeze(mesh.regions.map(region => Object.freeze({
        ...region,
        front: Object.freeze({ ...region.front }),
        back: Object.freeze({ ...region.back }),
        sides: Object.freeze({ ...region.sides }),
      }))),
      release: () => {
        if (released) return
        released = true
        this.releaseLease(leaseId)
      },
    })
  }

  draw(request: Readonly<CinemaObject3DDrawRequest>): boolean {
    if (this.disposed || this.contextLost || !request.camera) return false
    const key = this.leaseToKey.get(request.mesh.leaseId)
    if (!key || key !== request.mesh.meshKey) return false
    const entry = this.entries.get(key)
    if (!entry || entry.referenceCount <= 0) return false
    if (!entry.resource) entry.resource = this.uploadMesh(entry.mesh)

    const program = this.ensureProgram()
    const transform = request.transform ?? {}
    const material = request.material ?? {}
    const model = request.modelMatrix
      ? copyCinemaModelMatrix(request.modelMatrix)
      : createCinemaObjectModelMatrix({
          position: transform.position ?? DEFAULT_POSITION,
          rotation: transform.rotation ?? DEFAULT_ROTATION,
          scale: transform.scale ?? DEFAULT_SCALE,
          pivot: transform.pivot ?? entry.mesh.pivot ?? DEFAULT_PIVOT,
        })
    const normalMatrix = createCinemaObjectNormalMatrix(model)
    const view = createCinemaObjectViewMatrix(request.camera)
    const projection = createCinemaObjectProjectionMatrix(request.camera, request.viewport)
    const lightDirection = normalize3(material.lightDirection ?? DEFAULT_LIGHT_DIRECTION, DEFAULT_LIGHT_DIRECTION)
    const ambientIntensity = clamp01(material.ambientIntensity ?? DEFAULT_AMBIENT_INTENSITY)
    const emissiveIntensity = Math.max(0, finiteOr(material.emissiveIntensity, 0))

    const gl = this.gl
    gl.useProgram(program.program)
    gl.bindVertexArray(entry.resource.vao)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.disable(gl.CULL_FACE)
    gl.uniformMatrix4fv(program.uniforms.model, false, model)
    gl.uniformMatrix4fv(program.uniforms.view, false, view)
    gl.uniformMatrix4fv(program.uniforms.projection, false, projection)
    gl.uniformMatrix3fv(program.uniforms.normalMatrix, false, normalMatrix)
    gl.uniform3f(program.uniforms.lightDirection, lightDirection[0], lightDirection[1], lightDirection[2])
    gl.uniform1f(program.uniforms.ambientIntensity, ambientIntensity)
    gl.uniform1f(program.uniforms.emissiveIntensity, emissiveIntensity)

    const frontColor = material.frontColor ?? DEFAULT_FRONT_COLOR
    const sideColor = material.sideColor ?? DEFAULT_SIDE_COLOR
    drawRange(gl, program.uniforms.color, frontColor, entry.mesh.surfaces.front)
    drawRange(gl, program.uniforms.color, frontColor, entry.mesh.surfaces.back)
    drawRange(gl, program.uniforms.color, sideColor, entry.mesh.surfaces.sides)
    gl.bindVertexArray(null)
    this.drawCount += 1
    return true
  }

  handleContextLost(): void {
    if (this.disposed || this.contextLost) return
    this.contextLost = true
    this.recreateProgramAfterRestore = this.program != null
    this.program = null
    for (const entry of this.entries.values()) entry.resource = null
  }

  rebuildAfterContextRestore(): void {
    this.assertActive()
    if (!this.contextLost) return
    const recreateProgram = this.recreateProgramAfterRestore
    this.contextLost = false
    this.contextGeneration += 1
    const rebuiltEntries: CinemaGpuMeshEntry[] = []
    try {
      for (const entry of this.entries.values()) {
        if (entry.referenceCount <= 0) continue
        entry.resource = this.uploadMesh(entry.mesh)
        rebuiltEntries.push(entry)
      }
      if (recreateProgram) this.program = this.createProgram()
      this.recreateProgramAfterRestore = false
    } catch (error) {
      for (const entry of rebuiltEntries) {
        this.deleteMeshResource(entry.resource)
        entry.resource = null
      }
      this.deleteProgram()
      this.contextLost = true
      this.recreateProgramAfterRestore = recreateProgram
      throw error
    }
  }

  dispose(): void {
    if (this.disposed) return
    if (!this.contextLost) {
      for (const entry of this.entries.values()) this.deleteMeshResource(entry.resource)
      this.deleteProgram()
    }
    this.entries.clear()
    this.leaseToKey.clear()
    this.program = null
    this.recreateProgramAfterRestore = false
    this.disposed = true
  }

  getDiagnostics(): Readonly<CinemaObject3DRendererDiagnostics> {
    let activeLeaseCount = 0
    for (const entry of this.entries.values()) activeLeaseCount += entry.referenceCount
    return Object.freeze({
      contextGeneration: this.contextGeneration,
      contextLost: this.contextLost,
      cachedMeshCount: this.entries.size,
      meshCapacity: this.maximumMeshEntries,
      activeLeaseCount,
      gpuUploadCount: this.gpuUploadCount,
      gpuDeleteCount: this.gpuDeleteCount,
      programCreateCount: this.programCreateCount,
      programDeleteCount: this.programDeleteCount,
      drawCount: this.drawCount,
    })
  }

  private releaseLease(leaseId: string): void {
    const key = this.leaseToKey.get(leaseId)
    if (!key) return
    this.leaseToKey.delete(leaseId)
    const entry = this.entries.get(key)
    if (!entry) return
    entry.referenceCount = Math.max(0, entry.referenceCount - 1)
    if (entry.referenceCount > 0) return
    if (!this.contextLost) this.deleteMeshResource(entry.resource)
    this.entries.delete(key)
  }

  private uploadMesh(mesh: Readonly<CinemaVectorCpuMesh>): CinemaGpuMeshResource {
    const gl = this.gl
    let vao: WebGLVertexArrayObject | null = null
    let positionBuffer: WebGLBuffer | null = null
    let normalBuffer: WebGLBuffer | null = null
    let indexBuffer: WebGLBuffer | null = null
    try {
      vao = gl.createVertexArray()
      positionBuffer = gl.createBuffer()
      normalBuffer = gl.createBuffer()
      indexBuffer = gl.createBuffer()
      if (!vao || !positionBuffer || !normalBuffer || !indexBuffer) {
        throw new Error('Cinema could not allocate the GPU resources for a 3D CPU mesh.')
      }
      gl.bindVertexArray(vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(1)
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
      const allocationError = gl.getError()
      if (allocationError === gl.OUT_OF_MEMORY) {
        throw new Error('Cinema could not allocate GPU memory for a 3D mesh.')
      }
      if (gl.isContextLost()) {
        throw new Error('Cinema lost the WebGL context while allocating a 3D mesh.')
      }
      gl.bindVertexArray(null)
      this.gpuUploadCount += 1
      return { vao, positionBuffer, normalBuffer, indexBuffer, contextGeneration: this.contextGeneration }
    } catch (error) {
      gl.bindVertexArray(null)
      if (indexBuffer) gl.deleteBuffer(indexBuffer)
      if (normalBuffer) gl.deleteBuffer(normalBuffer)
      if (positionBuffer) gl.deleteBuffer(positionBuffer)
      if (vao) gl.deleteVertexArray(vao)
      throw error
    }
  }

  private deleteMeshResource(resource: CinemaGpuMeshResource | null): void {
    if (!resource) return
    this.gl.deleteBuffer(resource.indexBuffer)
    this.gl.deleteBuffer(resource.normalBuffer)
    this.gl.deleteBuffer(resource.positionBuffer)
    this.gl.deleteVertexArray(resource.vao)
    this.gpuDeleteCount += 1
  }

  private ensureProgram(): CinemaObject3DProgram {
    if (!this.program) this.program = this.createProgram()
    return this.program
  }

  private createProgram(): CinemaObject3DProgram {
    const gl = this.gl
    let vertex: WebGLShader | null = null
    let fragment: WebGLShader | null = null
    let program: WebGLProgram | null = null
    try {
      vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
      fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
      program = gl.createProgram()
      if (!program) throw new Error('Cinema could not allocate the shared 3D object shader program.')
      gl.attachShader(program, vertex)
      gl.attachShader(program, fragment)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) || 'Unknown Cinema 3D shader program link failure.'
        throw new Error(message)
      }
    } catch (error) {
      if (program) gl.deleteProgram(program)
      throw error
    } finally {
      if (vertex) gl.deleteShader(vertex)
      if (fragment) gl.deleteShader(fragment)
    }
    this.programCreateCount += 1
    return {
      program,
      uniforms: {
        model: gl.getUniformLocation(program, 'uModel'),
        view: gl.getUniformLocation(program, 'uView'),
        projection: gl.getUniformLocation(program, 'uProjection'),
        normalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
        color: gl.getUniformLocation(program, 'uColor'),
        lightDirection: gl.getUniformLocation(program, 'uLightDirection'),
        ambientIntensity: gl.getUniformLocation(program, 'uAmbientIntensity'),
        emissiveIntensity: gl.getUniformLocation(program, 'uEmissiveIntensity'),
      },
    }
  }

  private deleteProgram(): void {
    if (!this.program) return
    this.gl.deleteProgram(this.program.program)
    this.program = null
    this.programDeleteCount += 1
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Cinema 3D object renderer is disposed.')
  }
}


function copyCinemaModelMatrix(matrix: ArrayLike<number>): Float32Array {
  if (matrix.length !== 16) throw new Error('Cinema 3D model matrix must contain exactly 16 values.')
  const copy = new Float32Array(16)
  for (let index = 0; index < 16; index += 1) {
    const value = Number(matrix[index])
    if (!Number.isFinite(value)) throw new Error('Cinema 3D model matrix contains a non-finite value.')
    copy[index] = value
  }
  return copy
}

export function createCinemaObjectModelMatrix(transform: Required<CinemaObject3DTransform>): Float32Array {
  const [px, py, pz] = transform.position.map(value => finiteOr(value, 0)) as [number, number, number]
  const [rx, ry, rz] = transform.rotation.map(value => finiteOr(value, 0)) as [number, number, number]
  const [sx, sy, sz] = transform.scale.map(value => finiteScale(value)) as [number, number, number]
  const [ox, oy, oz] = transform.pivot.map(value => finiteOr(value, 0)) as [number, number, number]
  const translation = translationMatrix(px, py, pz)
  const rotation = multiplyMat4(multiplyMat4(rotationZMatrix(rz), rotationYMatrix(ry)), rotationXMatrix(rx))
  const scale = scaleMatrix(sx, sy, sz)
  const pivot = translationMatrix(-ox, -oy, -oz)
  return multiplyMat4(multiplyMat4(multiplyMat4(translation, rotation), scale), pivot)
}

export function createCinemaObjectNormalMatrix(model: ArrayLike<number>): Float32Array {
  const a00 = model[0]; const a01 = model[4]; const a02 = model[8]
  const a10 = model[1]; const a11 = model[5]; const a12 = model[9]
  const a20 = model[2]; const a21 = model[6]; const a22 = model[10]
  const b01 = a22 * a11 - a12 * a21
  const b11 = -a22 * a10 + a12 * a20
  const b21 = a21 * a10 - a11 * a20
  const determinant = a00 * b01 + a01 * b11 + a02 * b21
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('Cinema 3D object transform has a singular normal matrix.')
  }
  const inverseDeterminant = 1 / determinant
  const inverse = [
    b01 * inverseDeterminant,
    (-a22 * a01 + a02 * a21) * inverseDeterminant,
    (a12 * a01 - a02 * a11) * inverseDeterminant,
    b11 * inverseDeterminant,
    (a22 * a00 - a02 * a20) * inverseDeterminant,
    (-a12 * a00 + a02 * a10) * inverseDeterminant,
    b21 * inverseDeterminant,
    (-a21 * a00 + a01 * a20) * inverseDeterminant,
    (a11 * a00 - a01 * a10) * inverseDeterminant,
  ]
  return new Float32Array(inverse)
}

export function createCinemaObjectViewMatrix(camera: Readonly<CinemaCameraUniformSnapshot>): Float32Array {
  const eye = finiteVec3(camera.position, [0, 0, 5])
  const target = finiteVec3(camera.target, [0, 0, 0])
  let forward = normalize3(subtract3(target, eye), [0, 0, -1])
  if (lengthSquared3(subtract3(target, eye)) < 1e-12) {
    const pitch = finiteOr(camera.rotation[0], 0)
    const yaw = finiteOr(camera.rotation[1], 0)
    forward = normalize3([
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ], [0, 0, -1])
  }
  const upReference: CinemaVector3 = Math.abs(forward[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0]
  let right = normalize3(cross3(forward, upReference), [1, 0, 0])
  let up = normalize3(cross3(right, forward), [0, 1, 0])
  const roll = finiteOr(camera.rollRadians, 0)
  if (roll !== 0) {
    const cosine = Math.cos(roll)
    const sine = Math.sin(roll)
    const rolledRight: CinemaVector3 = [
      right[0] * cosine + up[0] * sine,
      right[1] * cosine + up[1] * sine,
      right[2] * cosine + up[2] * sine,
    ]
    const rolledUp: CinemaVector3 = [
      up[0] * cosine - right[0] * sine,
      up[1] * cosine - right[1] * sine,
      up[2] * cosine - right[2] * sine,
    ]
    right = rolledRight
    up = rolledUp
  }
  return new Float32Array([
    right[0], up[0], -forward[0], 0,
    right[1], up[1], -forward[1], 0,
    right[2], up[2], -forward[2], 0,
    -dot3(right, eye), -dot3(up, eye), dot3(forward, eye), 1,
  ])
}

export function createCinemaObjectProjectionMatrix(
  camera: Readonly<CinemaCameraUniformSnapshot>,
  viewport: Readonly<CinemaViewport>,
): Float32Array {
  const width = Math.max(1, finiteOr(viewport.width, 1))
  const height = Math.max(1, finiteOr(viewport.height, 1))
  const aspect = width / height
  const near = Math.max(1e-4, finiteOr(camera.near, 0.1))
  const far = Math.max(near + 1e-3, finiteOr(camera.far, 1000))
  const fovDegrees = Math.min(179, Math.max(1, finiteOr(camera.fovDegrees, 50)))
  const f = 1 / Math.tan((fovDegrees * Math.PI / 180) * 0.5)
  const rangeInverse = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * rangeInverse, -1,
    0, 0, 2 * far * near * rangeInverse, 0,
  ])
}

function validateCpuMesh(mesh: Readonly<CinemaVectorCpuMesh>): void {
  if (!(mesh.positions instanceof Float32Array) || mesh.positions.length === 0 || mesh.positions.length % 3 !== 0) {
    throw new Error('Cinema 3D CPU mesh positions must be a non-empty Float32Array of XYZ vertices.')
  }
  if (!(mesh.normals instanceof Float32Array) || mesh.normals.length !== mesh.positions.length) {
    throw new Error('Cinema 3D CPU mesh normals must match the position vertex layout.')
  }
  if (!(mesh.indices instanceof Uint32Array) || mesh.indices.length === 0 || mesh.indices.length % 3 !== 0) {
    throw new Error('Cinema 3D CPU mesh indices must be a non-empty Uint32Array of triangles.')
  }
  for (const value of mesh.positions) {
    if (!Number.isFinite(value)) throw new Error('Cinema 3D CPU mesh positions must contain only finite values.')
  }
  for (const value of mesh.normals) {
    if (!Number.isFinite(value)) throw new Error('Cinema 3D CPU mesh normals must contain only finite values.')
  }
  const vertexCount = mesh.positions.length / 3
  for (const index of mesh.indices) {
    if (index >= vertexCount) throw new Error('Cinema 3D CPU mesh contains an out-of-range vertex index.')
  }
  for (const value of [...mesh.bounds.min, ...mesh.bounds.max, ...mesh.pivot, mesh.boundingRadius]) {
    if (!Number.isFinite(value)) throw new Error('Cinema 3D CPU mesh bounds and pivot must contain only finite values.')
  }
  validateRange(mesh.surfaces.front, mesh.indices.length, 'front')
  validateRange(mesh.surfaces.back, mesh.indices.length, 'back')
  validateRange(mesh.surfaces.sides, mesh.indices.length, 'sides')
  for (const component of mesh.components) {
    validateRange(component.front, mesh.indices.length, `component ${component.componentId} front`)
    validateRange(component.back, mesh.indices.length, `component ${component.componentId} back`)
    validateRange(component.sides, mesh.indices.length, `component ${component.componentId} sides`)
  }
  for (const region of mesh.regions) {
    validateRange(region.front, mesh.indices.length, `region ${region.regionId} front`)
    validateRange(region.back, mesh.indices.length, `region ${region.regionId} back`)
    validateRange(region.sides, mesh.indices.length, `region ${region.regionId} sides`)
  }
}

function validateRange(range: CinemaMeshIndexRange, indexCount: number, label: string): void {
  if (!Number.isInteger(range.indexStart) || !Number.isInteger(range.indexCount) || range.indexStart < 0 || range.indexCount < 0) {
    throw new Error(`Cinema 3D CPU mesh ${label} draw range is invalid.`)
  }
  if (range.indexStart + range.indexCount > indexCount) {
    throw new Error(`Cinema 3D CPU mesh ${label} draw range exceeds the index buffer.`)
  }
}

function fingerprintCpuMesh(mesh: Readonly<CinemaVectorCpuMesh>): string {
  let hash = 2166136261
  const mix = (value: number) => {
    hash ^= value >>> 0
    hash = Math.imul(hash, 16777619)
  }
  const floatBits = new Uint32Array(1)
  const floatValue = new Float32Array(floatBits.buffer)
  for (const value of mesh.positions) { floatValue[0] = value; mix(floatBits[0]) }
  for (const value of mesh.normals) { floatValue[0] = value; mix(floatBits[0]) }
  for (const value of mesh.indices) mix(value)
  for (const value of [...mesh.bounds.min, ...mesh.bounds.max, ...mesh.pivot, mesh.boundingRadius]) { floatValue[0] = value; mix(floatBits[0]) }
  for (const range of [mesh.surfaces.front, mesh.surfaces.back, mesh.surfaces.sides]) {
    mix(range.indexStart)
    mix(range.indexCount)
  }
  for (const component of mesh.components) {
    for (const value of component.componentId) mix(value.charCodeAt(0))
    for (const range of [component.front, component.back, component.sides]) { mix(range.indexStart); mix(range.indexCount) }
  }
  for (const region of mesh.regions) {
    for (const value of region.componentId) mix(value.charCodeAt(0))
    for (const value of region.regionId) mix(value.charCodeAt(0))
    for (const range of [region.front, region.back, region.sides]) { mix(range.indexStart); mix(range.indexCount) }
  }
  return `${mesh.positions.length}:${mesh.indices.length}:${(hash >>> 0).toString(16)}`
}

function drawRange(
  gl: WebGL2RenderingContext,
  colorUniform: WebGLUniformLocation | null,
  color: CinemaColor,
  range: CinemaMeshIndexRange,
): void {
  if (range.indexCount <= 0) return
  gl.uniform3f(colorUniform, clamp01(color[0]), clamp01(color[1]), clamp01(color[2]))
  gl.drawElements(gl.TRIANGLES, range.indexCount, gl.UNSIGNED_INT, range.indexStart * Uint32Array.BYTES_PER_ELEMENT)
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema could not allocate a shared 3D object shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown Cinema 3D shader compile failure.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function multiplyMat4(left: ArrayLike<number>, right: ArrayLike<number>): Float32Array {
  const result = new Float32Array(16)
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] = (
        left[row] * right[column * 4]
        + left[4 + row] * right[column * 4 + 1]
        + left[8 + row] * right[column * 4 + 2]
        + left[12 + row] * right[column * 4 + 3]
      )
    }
  }
  return result
}

function translationMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1])
}

function scaleMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1])
}

function rotationXMatrix(angle: number): Float32Array {
  const c = Math.cos(angle); const s = Math.sin(angle)
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1])
}

function rotationYMatrix(angle: number): Float32Array {
  const c = Math.cos(angle); const s = Math.sin(angle)
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1])
}

function rotationZMatrix(angle: number): Float32Array {
  const c = Math.cos(angle); const s = Math.sin(angle)
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}

function finiteVec3(value: CinemaVector3, fallback: CinemaVector3): CinemaVector3 {
  return [finiteOr(value[0], fallback[0]), finiteOr(value[1], fallback[1]), finiteOr(value[2], fallback[2])]
}

function normalize3(value: CinemaVector3, fallback: CinemaVector3): CinemaVector3 {
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length < 1e-12) return fallback
  return [value[0] / length, value[1] / length, value[2] / length]
}

function subtract3(left: CinemaVector3, right: CinemaVector3): CinemaVector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
}

function cross3(left: CinemaVector3, right: CinemaVector3): CinemaVector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ]
}

function dot3(left: CinemaVector3, right: CinemaVector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2]
}

function lengthSquared3(value: CinemaVector3): number {
  return dot3(value, value)
}

function finiteScale(value: number): number {
  const finite = finiteOr(value, 1)
  if (Math.abs(finite) < 1e-6) return finite < 0 ? -1e-6 : 1e-6
  return finite
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}
