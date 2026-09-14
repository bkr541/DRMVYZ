import type { Cinema2Color, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../../scene/Cinema2SceneGraph'
import { CINEMA2_AFTERHOURS_MAX_BEAMS } from './Cinema2AfterhoursDomain'

export const CINEMA2_AFTERHOURS_MAX_RENDER_INSTANCES = CINEMA2_AFTERHOURS_MAX_BEAMS

export interface Cinema2AfterhoursRenderBeam {
  readonly fixtureId: string
  readonly originWorld: Cinema2Vector3
  readonly targetWorld: Cinema2Vector3
  readonly intensity: number
  readonly alpha: number
  readonly accentWeight: number
}

export interface Cinema2AfterhoursRendererDrawRequest {
  readonly beams: readonly Cinema2AfterhoursRenderBeam[]
  readonly worldToClipMatrix: Cinema2Matrix4
  readonly cameraPosition: Cinema2Vector3
  readonly primaryColor: Cinema2Color
  readonly accentColor: Cinema2Color
  readonly accentMix: number
  readonly atmosphere: number
  readonly masterIntensity: number
}

export interface Cinema2AfterhoursRendererSnapshot {
  readonly disposed: boolean
  readonly drawCount: number
  readonly lastInstanceCount: number
  readonly bufferUploadCount: number
}

const INSTANCE_FLOATS = 14
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const BASE_VERTICES = new Float32Array([
  0, -1,
  0, 1,
  1, -1,
  1, 1,
])

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 aOrigin;
layout(location = 2) in vec3 aTarget;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aMeta;
uniform mat4 uWorldToClip;
uniform vec3 uCameraPosition;
uniform float uAtmosphere;
out vec4 vColor;
out vec4 vMeta;
out float vSide;
out float vLongitudinal;
out float vViewDistance;
out float vBeamLength;
void main() {
  vec3 beam = aTarget - aOrigin;
  float beamLength = max(length(beam), 0.0001);
  vec3 direction = beam / beamLength;
  float t = clamp(aCorner.x, 0.0, 1.0);
  vec3 center = mix(aOrigin, aTarget, t);
  vec3 toCamera = normalize(uCameraPosition - center + vec3(0.000001, 0.0, 0.0));
  vec3 sideAxis = cross(direction, toCamera);
  float sideLength = length(sideAxis);
  if (sideLength < 0.0001) sideAxis = cross(direction, vec3(0.0, 1.0, 0.0001));
  sideAxis = normalize(sideAxis);
  float sourceBloom = exp(-t * 34.0);
  float widthWorld = mix(0.045, 0.085, clamp(uAtmosphere, 0.0, 1.0)) * (1.0 + sourceBloom * 1.35);
  vec3 worldPosition = center + sideAxis * aCorner.y * widthWorld;
  gl_Position = uWorldToClip * vec4(worldPosition, 1.0);
  vColor = aColor;
  vMeta = aMeta;
  // Preserve the signed quad coordinate through raster interpolation so the
  // fragment shader receives 0.0 at the beam center.
  vSide = aCorner.y;
  vLongitudinal = t;
  vViewDistance = length(uCameraPosition - center);
  vBeamLength = beamLength;
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 vColor;
in vec4 vMeta;
in float vSide;
in float vLongitudinal;
in float vViewDistance;
in float vBeamLength;
uniform float uAtmosphere;
uniform float uMasterIntensity;
out vec4 outColor;
void main() {
  float side = clamp(abs(vSide), 0.0, 1.0);
  float core = exp(-side * side * 118.0);
  float body = exp(-side * side * 34.0);
  float halo = exp(-side * side * 6.4);
  float sourceBloom = exp(-vLongitudinal * 56.0);
  float rayFalloff = mix(1.0, 0.50, smoothstep(0.14, 1.0, vLongitudinal));
  float atmosphere = clamp(uAtmosphere, 0.0, 1.0);
  float temporal = clamp(vMeta.z, 0.0, 1.0);
  float intensity = max(0.0, vMeta.x) * clamp(vMeta.y, 0.0, 1.0) * max(0.0, uMasterIntensity);
  // World-space distance separation keeps near paths crisp while allowing far
  // paths to recede naturally into haze instead of flattening into one plane.
  float distanceFade = mix(1.08, 0.62, smoothstep(7.0, 30.0, vViewDistance));
  float lengthDiscipline = mix(1.0, 0.88, smoothstep(10.0, 18.0, vBeamLength));
  float temporalFade = mix(1.0, 0.42, temporal);
  float optical = core * 1.72 + body * 0.40 + halo * atmosphere * 0.22 + sourceBloom * (0.22 + atmosphere * 0.12);
  optical *= rayFalloff * distanceFade * lengthDiscipline * intensity * temporalFade;
  vec3 coreColor = mix(vColor.rgb, vec3(1.0), core * 0.10);
  vec3 rgb = coreColor * optical;
  float alpha = clamp((core * 0.98 + body * 0.40 + halo * atmosphere * 0.12 + sourceBloom * 0.16) * distanceFade * intensity * temporalFade, 0.0, 1.0);
  if (alpha < 0.001) discard;
  outColor = vec4(rgb, alpha);
}`

/**
 * Laser-specific GPU renderer. It deliberately owns only beam optics and its
 * buffers/program; camera, render scheduling, depth targets and effect history
 * remain Cinema 2.0 host concerns.
 */
export class Cinema2AfterhoursRenderer {
  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly baseBuffer: WebGLBuffer
  private readonly instanceBuffer: WebGLBuffer
  private readonly instanceData = new Float32Array(CINEMA2_AFTERHOURS_MAX_RENDER_INSTANCES * INSTANCE_FLOATS)
  private readonly worldToClipData = new Float32Array(16)
  private readonly worldToClipLocation: WebGLUniformLocation | null
  private readonly cameraPositionLocation: WebGLUniformLocation | null
  private readonly atmosphereLocation: WebGLUniformLocation | null
  private readonly masterIntensityLocation: WebGLUniformLocation | null
  private disposed = false
  private drawCount = 0
  private lastInstanceCount = 0
  private bufferUploadCount = 0

  constructor(private readonly gl: WebGL2RenderingContext) {
    let createdProgram: WebGLProgram | null = null
    const vao = gl.createVertexArray()
    const baseBuffer = gl.createBuffer()
    const instanceBuffer = gl.createBuffer()
    if (!vao || !baseBuffer || !instanceBuffer) {
      if (vao) gl.deleteVertexArray(vao)
      if (baseBuffer) gl.deleteBuffer(baseBuffer)
      if (instanceBuffer) gl.deleteBuffer(instanceBuffer)
      throw new Error('Cinema 2.0 Afterhours could not allocate laser geometry resources.')
    }
    this.vao = vao
    this.baseBuffer = baseBuffer
    this.instanceBuffer = instanceBuffer

    try {
      createdProgram = createProgram(gl)
      this.program = createdProgram
      this.worldToClipLocation = gl.getUniformLocation(this.program, 'uWorldToClip')
      this.cameraPositionLocation = gl.getUniformLocation(this.program, 'uCameraPosition')
      this.atmosphereLocation = gl.getUniformLocation(this.program, 'uAtmosphere')
      this.masterIntensityLocation = gl.getUniformLocation(this.program, 'uMasterIntensity')

      gl.bindVertexArray(this.vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, BASE_VERTICES, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW)
      configureInstanceAttribute(gl, 1, 3, 0)
      configureInstanceAttribute(gl, 2, 3, 3)
      configureInstanceAttribute(gl, 3, 4, 6)
      configureInstanceAttribute(gl, 4, 4, 10)
      gl.bindVertexArray(null)

      if (gl.getError() === gl.OUT_OF_MEMORY) throw new Error('Cinema 2.0 Afterhours could not allocate GPU memory for laser instances.')
      if (gl.isContextLost()) throw new Error('Cinema 2.0 lost WebGL2 while allocating Afterhours laser resources.')
    } catch (error) {
      gl.bindVertexArray(null)
      gl.deleteBuffer(this.instanceBuffer)
      gl.deleteBuffer(this.baseBuffer)
      gl.deleteVertexArray(this.vao)
      if (createdProgram) gl.deleteProgram(createdProgram)
      throw error
    }
  }

  draw(request: Readonly<Cinema2AfterhoursRendererDrawRequest>): void {
    if (this.disposed) throw new Error('Cinema 2.0 Afterhours renderer is disposed.')
    const instanceCount = this.packInstances(request)
    this.lastInstanceCount = instanceCount
    if (instanceCount === 0) return

    const gl = this.gl
    gl.useProgram(this.program)
    for (let index = 0; index < 16; index += 1) this.worldToClipData[index] = request.worldToClipMatrix[index] ?? 0
    gl.uniformMatrix4fv(this.worldToClipLocation, false, this.worldToClipData)
    gl.uniform3f(this.cameraPositionLocation, request.cameraPosition[0], request.cameraPosition[1], request.cameraPosition[2])
    gl.uniform1f(this.atmosphereLocation, clamp01(request.atmosphere))
    gl.uniform1f(this.masterIntensityLocation, clamp01(request.masterIntensity))

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, instanceCount * INSTANCE_FLOATS))
    this.bufferUploadCount += 1

    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    // RGB is already intensity-weighted in the fragment shader, so use pure
    // additive blending instead of multiplying the contribution by alpha again.
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.disable(gl.CULL_FACE)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(null)
    this.drawCount += 1
  }

  getSnapshot(): Readonly<Cinema2AfterhoursRendererSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      drawCount: this.drawCount,
      lastInstanceCount: this.lastInstanceCount,
      bufferUploadCount: this.bufferUploadCount,
    })
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.gl.deleteProgram(this.program)
    this.gl.deleteBuffer(this.instanceBuffer)
    this.gl.deleteBuffer(this.baseBuffer)
    this.gl.deleteVertexArray(this.vao)
  }

  private packInstances(request: Readonly<Cinema2AfterhoursRendererDrawRequest>): number {
    let instanceCount = 0
    const write = (beam: Readonly<Cinema2AfterhoursRenderBeam>, temporalWeight: number) => {
      if (instanceCount >= CINEMA2_AFTERHOURS_MAX_RENDER_INSTANCES) return
      const alpha = clamp01(beam.alpha) * temporalWeight
      if (alpha <= 0.0001 || beam.intensity <= 0.0001) return
      const accent = clamp01(request.accentMix) * clamp01(beam.accentWeight)
      const inverseAccent = 1 - accent
      const offset = instanceCount * INSTANCE_FLOATS
      this.instanceData[offset] = beam.originWorld[0]
      this.instanceData[offset + 1] = beam.originWorld[1]
      this.instanceData[offset + 2] = beam.originWorld[2]
      this.instanceData[offset + 3] = beam.targetWorld[0]
      this.instanceData[offset + 4] = beam.targetWorld[1]
      this.instanceData[offset + 5] = beam.targetWorld[2]
      this.instanceData[offset + 6] = request.primaryColor[0] * inverseAccent + request.accentColor[0] * accent
      this.instanceData[offset + 7] = request.primaryColor[1] * inverseAccent + request.accentColor[1] * accent
      this.instanceData[offset + 8] = request.primaryColor[2] * inverseAccent + request.accentColor[2] * accent
      this.instanceData[offset + 9] = request.primaryColor[3] * inverseAccent + request.accentColor[3] * accent
      this.instanceData[offset + 10] = Math.max(0, finite(beam.intensity, 0))
      this.instanceData[offset + 11] = alpha
      this.instanceData[offset + 12] = clamp01(1 - temporalWeight)
      this.instanceData[offset + 13] = 0
      instanceCount += 1
    }

    for (const beam of request.beams) write(beam, 1)
    return instanceCount
  }
}

function configureInstanceAttribute(gl: WebGL2RenderingContext, location: number, size: number, floatOffset: number): void {
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, INSTANCE_STRIDE_BYTES, floatOffset * Float32Array.BYTES_PER_ELEMENT)
  gl.vertexAttribDivisor(location, 1)
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema 2.0 Afterhours could not allocate its laser shader program.')
  }
  try {
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Cinema 2.0 Afterhours laser shader link failed: ${gl.getProgramInfoLog(program) || 'unknown link error'}`)
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
  if (!shader) throw new Error('Cinema 2.0 Afterhours could not allocate a laser shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error'
    gl.deleteShader(shader)
    throw new Error(`Cinema 2.0 Afterhours laser shader compilation failed: ${log}`)
  }
  return shader
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
