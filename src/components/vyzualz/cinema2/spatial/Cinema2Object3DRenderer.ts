import type { Cinema2Color, Cinema2Vector3 } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../scene/Cinema2SceneGraph'
import type { Cinema2LightingEnvironmentFrame, Cinema2ResolvedLightFrame } from './Cinema2LightingEnvironmentRuntime'
import type { CinemaVectorCpuMesh } from '../../cinema/CinemaVectorGeometry'

export interface Cinema2Object3DMaterial {
  color?: Cinema2Color
  emissiveIntensity?: number
}

export interface Cinema2Object3DDrawRequest {
  modelMatrix: Cinema2Matrix4
  worldToClipMatrix: Cinema2Matrix4
  cameraPosition?: Cinema2Vector3
  lightingEnvironment?: Readonly<Cinema2LightingEnvironmentFrame>
  material?: Readonly<Cinema2Object3DMaterial>
}

export interface Cinema2Object3DRendererSnapshot {
  disposed: boolean
  meshKey: string
  drawCount: number
  createdBufferCount: number
  deletedBufferCount: number
}

const MAX_LIGHTS = 8
const DEFAULT_COLOR = Object.freeze([1, 1, 1, 1]) as Cinema2Color
const DEFAULT_CAMERA_POSITION = Object.freeze([0, 0, 5]) as Cinema2Vector3
const DEFAULT_BACKGROUND = Object.freeze([0, 0, 0, 1]) as Cinema2Color
const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uWorldToClip;
uniform mat3 uNormalMatrix;
out vec3 vWorldPosition;
out vec3 vNormal;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uWorldToClip * world;
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
#define MAX_LIGHTS ${MAX_LIGHTS}
in vec3 vWorldPosition;
in vec3 vNormal;
uniform vec4 uColor;
uniform float uEmissiveIntensity;
uniform int uLightCount;
uniform int uLightType[MAX_LIGHTS];
uniform vec3 uLightColor[MAX_LIGHTS];
uniform float uLightIntensity[MAX_LIGHTS];
uniform vec3 uLightPosition[MAX_LIGHTS];
uniform vec3 uLightDirection[MAX_LIGHTS];
uniform vec3 uCameraPosition;
uniform float uExposure;
uniform int uFogMode;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uFogNear;
uniform float uFogFar;
out vec4 outColor;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 lighting = uLightCount == 0 ? vec3(1.0) : vec3(0.0);
  for (int index = 0; index < MAX_LIGHTS; index += 1) {
    if (index >= uLightCount) break;
    int lightType = uLightType[index];
    vec3 lightColor = uLightColor[index] * max(0.0, uLightIntensity[index]);
    if (lightType == 0) {
      lighting += lightColor;
      continue;
    }
    vec3 toLight;
    float attenuation = 1.0;
    if (lightType == 1) {
      toLight = normalize(-uLightDirection[index]);
    } else {
      vec3 delta = uLightPosition[index] - vWorldPosition;
      float distanceSquared = max(dot(delta, delta), 0.0001);
      toLight = normalize(delta);
      attenuation = 1.0 / (1.0 + 0.05 * distanceSquared);
      if (lightType == 3) {
        vec3 fromLight = normalize(vWorldPosition - uLightPosition[index]);
        float cone = dot(fromLight, normalize(uLightDirection[index]));
        attenuation *= smoothstep(0.8660254, 0.9396926, cone);
      }
    }
    lighting += lightColor * max(dot(normal, toLight), 0.0) * attenuation;
  }
  vec3 rgb = uColor.rgb * lighting + uColor.rgb * max(0.0, uEmissiveIntensity);
  rgb *= max(0.0, uExposure);
  float distanceToCamera = length(vWorldPosition - uCameraPosition);
  float fogAmount = 0.0;
  if (uFogMode == 1) {
    fogAmount = clamp((distanceToCamera - uFogNear) / max(0.0001, uFogFar - uFogNear), 0.0, 1.0);
  } else if (uFogMode == 2) {
    fogAmount = 1.0 - exp(-max(0.0, uFogDensity) * distanceToCamera);
  }
  rgb = mix(rgb, uFogColor, clamp(fogAmount, 0.0, 1.0));
  outColor = vec4(rgb, uColor.a);
}`

/** Focused mesh renderer. Camera, lighting and environment authority are supplied by shared Cinema 2.0 services. */
export class Cinema2Object3DRenderer {
  private readonly vao: WebGLVertexArrayObject
  private readonly positionBuffer: WebGLBuffer
  private readonly normalBuffer: WebGLBuffer
  private readonly indexBuffer: WebGLBuffer
  private readonly program: WebGLProgram
  private readonly modelLocation: WebGLUniformLocation | null
  private readonly worldToClipLocation: WebGLUniformLocation | null
  private readonly normalMatrixLocation: WebGLUniformLocation | null
  private readonly colorLocation: WebGLUniformLocation | null
  private readonly emissiveLocation: WebGLUniformLocation | null
  private readonly lightCountLocation: WebGLUniformLocation | null
  private readonly lightTypeLocations: readonly (WebGLUniformLocation | null)[]
  private readonly lightColorLocations: readonly (WebGLUniformLocation | null)[]
  private readonly lightIntensityLocations: readonly (WebGLUniformLocation | null)[]
  private readonly lightPositionLocations: readonly (WebGLUniformLocation | null)[]
  private readonly lightDirectionLocations: readonly (WebGLUniformLocation | null)[]
  private readonly cameraPositionLocation: WebGLUniformLocation | null
  private readonly exposureLocation: WebGLUniformLocation | null
  private readonly fogModeLocation: WebGLUniformLocation | null
  private readonly fogColorLocation: WebGLUniformLocation | null
  private readonly fogDensityLocation: WebGLUniformLocation | null
  private readonly fogNearLocation: WebGLUniformLocation | null
  private readonly fogFarLocation: WebGLUniformLocation | null
  private drawCount = 0
  private deletedBufferCount = 0
  private disposed = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly meshKey: string,
    private readonly mesh: Readonly<CinemaVectorCpuMesh>,
  ) {
    if (!meshKey.trim()) throw new Error('Cinema 2.0 Object3D mesh key must be non-empty.')
    validateMesh(mesh)
    const vao = gl.createVertexArray()
    const positionBuffer = gl.createBuffer()
    const normalBuffer = gl.createBuffer()
    const indexBuffer = gl.createBuffer()
    if (!vao || !positionBuffer || !normalBuffer || !indexBuffer) {
      if (vao) gl.deleteVertexArray(vao)
      if (positionBuffer) gl.deleteBuffer(positionBuffer)
      if (normalBuffer) gl.deleteBuffer(normalBuffer)
      if (indexBuffer) gl.deleteBuffer(indexBuffer)
      throw new Error('Cinema 2.0 could not allocate Object3D mesh GPU resources.')
    }
    this.vao = vao
    this.positionBuffer = positionBuffer
    this.normalBuffer = normalBuffer
    this.indexBuffer = indexBuffer

    try {
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
      gl.bindVertexArray(null)
      if (gl.getError() === gl.OUT_OF_MEMORY) throw new Error('Cinema 2.0 could not allocate GPU memory for an Object3D mesh.')
      if (gl.isContextLost()) throw new Error('Cinema 2.0 lost WebGL2 while allocating an Object3D mesh.')
      this.program = createProgram(gl)
      this.modelLocation = gl.getUniformLocation(this.program, 'uModel')
      this.worldToClipLocation = gl.getUniformLocation(this.program, 'uWorldToClip')
      this.normalMatrixLocation = gl.getUniformLocation(this.program, 'uNormalMatrix')
      this.colorLocation = gl.getUniformLocation(this.program, 'uColor')
      this.emissiveLocation = gl.getUniformLocation(this.program, 'uEmissiveIntensity')
      this.lightCountLocation = gl.getUniformLocation(this.program, 'uLightCount')
      this.lightTypeLocations = createUniformLocationArray(gl, this.program, 'uLightType')
      this.lightColorLocations = createUniformLocationArray(gl, this.program, 'uLightColor')
      this.lightIntensityLocations = createUniformLocationArray(gl, this.program, 'uLightIntensity')
      this.lightPositionLocations = createUniformLocationArray(gl, this.program, 'uLightPosition')
      this.lightDirectionLocations = createUniformLocationArray(gl, this.program, 'uLightDirection')
      this.cameraPositionLocation = gl.getUniformLocation(this.program, 'uCameraPosition')
      this.exposureLocation = gl.getUniformLocation(this.program, 'uExposure')
      this.fogModeLocation = gl.getUniformLocation(this.program, 'uFogMode')
      this.fogColorLocation = gl.getUniformLocation(this.program, 'uFogColor')
      this.fogDensityLocation = gl.getUniformLocation(this.program, 'uFogDensity')
      this.fogNearLocation = gl.getUniformLocation(this.program, 'uFogNear')
      this.fogFarLocation = gl.getUniformLocation(this.program, 'uFogFar')
    } catch (error) {
      gl.bindVertexArray(null)
      gl.deleteBuffer(indexBuffer)
      gl.deleteBuffer(normalBuffer)
      gl.deleteBuffer(positionBuffer)
      gl.deleteVertexArray(vao)
      this.deletedBufferCount = 3
      throw error
    }
  }

  draw(request: Readonly<Cinema2Object3DDrawRequest>): void {
    if (this.disposed) throw new Error('Cinema 2.0 Object3D renderer is disposed.')
    const color = normalizeColor(request.material?.color ?? DEFAULT_COLOR)
    const emissive = Math.max(0, finite(request.material?.emissiveIntensity, 0))
    const lightingEnvironment = request.lightingEnvironment
    const lights = (lightingEnvironment?.lights ?? []).slice(0, MAX_LIGHTS)
    const environment = lightingEnvironment?.environment
    const cameraPosition = normalizeVector3(request.cameraPosition ?? DEFAULT_CAMERA_POSITION)
    const gl = this.gl
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.enable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(true)
    gl.disable(gl.CULL_FACE)
    gl.uniformMatrix4fv(this.modelLocation, false, new Float32Array(request.modelMatrix))
    gl.uniformMatrix4fv(this.worldToClipLocation, false, new Float32Array(request.worldToClipMatrix))
    gl.uniformMatrix3fv(this.normalMatrixLocation, false, createNormalMatrix(request.modelMatrix))
    gl.uniform4fv(this.colorLocation, new Float32Array(color))
    gl.uniform1f(this.emissiveLocation, emissive)
    gl.uniform1i(this.lightCountLocation, lights.length)
    lights.forEach((light, index) => this.uploadLight(light, index))
    gl.uniform3f(this.cameraPositionLocation, cameraPosition[0], cameraPosition[1], cameraPosition[2])
    gl.uniform1f(this.exposureLocation, Math.max(0, finite(environment?.exposure, 1)))
    const fog = environment?.fog ?? null
    gl.uniform1i(this.fogModeLocation, fog?.mode === 'linear' ? 1 : fog?.mode === 'exponential' ? 2 : 0)
    const fogColor = normalizeColor(fog?.color ?? DEFAULT_BACKGROUND)
    gl.uniform3f(this.fogColorLocation, fogColor[0], fogColor[1], fogColor[2])
    gl.uniform1f(this.fogDensityLocation, Math.max(0, finite(fog?.density, 0)))
    gl.uniform1f(this.fogNearLocation, Math.max(0, finite(fog?.near, 0)))
    gl.uniform1f(this.fogFarLocation, Math.max(0.0001, finite(fog?.far, 1000)))
    gl.drawElements(gl.TRIANGLES, this.mesh.indices.length, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null)
    this.drawCount += 1
  }

  getSnapshot(): Readonly<Cinema2Object3DRendererSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      meshKey: this.meshKey,
      drawCount: this.drawCount,
      createdBufferCount: 3,
      deletedBufferCount: this.deletedBufferCount,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gl.deleteProgram(this.program)
    this.gl.deleteBuffer(this.indexBuffer)
    this.gl.deleteBuffer(this.normalBuffer)
    this.gl.deleteBuffer(this.positionBuffer)
    this.deletedBufferCount = 3
    this.gl.deleteVertexArray(this.vao)
  }

  private uploadLight(light: Readonly<Cinema2ResolvedLightFrame>, index: number): void {
    const type = light.type === 'ambient' ? 0 : light.type === 'directional' ? 1 : light.type === 'point' ? 2 : 3
    const color = normalizeColor(light.color)
    const position = normalizeVector3(light.position)
    const direction = normalizeVector3(light.direction)
    this.gl.uniform1i(this.lightTypeLocations[index] ?? null, type)
    this.gl.uniform3f(this.lightColorLocations[index] ?? null, color[0], color[1], color[2])
    this.gl.uniform1f(this.lightIntensityLocations[index] ?? null, Math.max(0, finite(light.intensity, 0)))
    this.gl.uniform3f(this.lightPositionLocations[index] ?? null, position[0], position[1], position[2])
    this.gl.uniform3f(this.lightDirectionLocations[index] ?? null, direction[0], direction[1], direction[2])
  }
}

function createUniformLocationArray(gl: WebGL2RenderingContext, program: WebGLProgram, name: string) {
  return Object.freeze(Array.from({ length: MAX_LIGHTS }, (_, index) => gl.getUniformLocation(program, `${name}[${index}]`)))
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema 2.0 could not allocate an Object3D shader program.')
  }
  try {
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Cinema 2.0 Object3D shader link failed: ${gl.getProgramInfoLog(program) || 'unknown link error'}`)
    }
    return program
  } catch (error) {
    gl.deleteProgram(program)
    throw error
  } finally {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
  }
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema 2.0 could not allocate an Object3D shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error'
    gl.deleteShader(shader)
    throw new Error(`Cinema 2.0 Object3D shader compilation failed: ${log}`)
  }
  return shader
}

function createNormalMatrix(model: ArrayLike<number>): Float32Array {
  const a00 = model[0]; const a01 = model[4]; const a02 = model[8]
  const a10 = model[1]; const a11 = model[5]; const a12 = model[9]
  const a20 = model[2]; const a21 = model[6]; const a22 = model[10]
  const b01 = a22 * a11 - a12 * a21
  const b11 = -a22 * a10 + a12 * a20
  const b21 = a21 * a10 - a11 * a20
  const determinant = a00 * b01 + a01 * b11 + a02 * b21
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) {
    throw new Error('Cinema 2.0 Object3D transform has a singular normal matrix.')
  }
  const inverseDeterminant = 1 / determinant
  return new Float32Array([
    b01 * inverseDeterminant,
    (-a22 * a01 + a02 * a21) * inverseDeterminant,
    (a12 * a01 - a02 * a11) * inverseDeterminant,
    b11 * inverseDeterminant,
    (a22 * a00 - a02 * a20) * inverseDeterminant,
    (-a12 * a00 + a02 * a10) * inverseDeterminant,
    b21 * inverseDeterminant,
    (-a21 * a00 + a01 * a20) * inverseDeterminant,
    (a11 * a00 - a01 * a10) * inverseDeterminant,
  ])
}

function normalizeColor(value: Cinema2Color): Cinema2Color {
  return Object.freeze([
    clamp01(finite(value[0], 1)),
    clamp01(finite(value[1], 1)),
    clamp01(finite(value[2], 1)),
    clamp01(finite(value[3], 1)),
  ]) as Cinema2Color
}

function normalizeVector3(value: Cinema2Vector3): Cinema2Vector3 {
  return Object.freeze([
    finite(value[0], 0),
    finite(value[1], 0),
    finite(value[2], 0),
  ]) as Cinema2Vector3
}

function validateMesh(mesh: Readonly<CinemaVectorCpuMesh>): void {
  if (mesh.positions.length === 0 || mesh.positions.length % 3 !== 0) throw new Error('Cinema 2.0 Object3D mesh positions must contain xyz triplets.')
  if (!(mesh.normals instanceof Float32Array) || mesh.normals.length !== mesh.positions.length) throw new Error('Cinema 2.0 Object3D mesh normals must match the position vertex layout.')
  if (mesh.normals.some(value => !Number.isFinite(value))) throw new Error('Cinema 2.0 Object3D mesh normals must contain finite values.')
  if (mesh.indices.length === 0 || mesh.indices.length % 3 !== 0) throw new Error('Cinema 2.0 Object3D mesh indices must contain triangles.')
  const vertexCount = mesh.positions.length / 3
  for (const index of mesh.indices) if (!Number.isInteger(index) || index < 0 || index >= vertexCount) throw new Error('Cinema 2.0 Object3D mesh contains an out-of-range index.')
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
