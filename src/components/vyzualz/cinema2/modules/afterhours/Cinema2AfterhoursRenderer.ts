import type { Cinema2Color, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2Matrix4 } from '../../scene/Cinema2SceneGraph'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'

/** Every laser of the rig firing a full sheet stays inside this budget. */
export const CINEMA2_AFTERHOURS_MAX_RENDER_INSTANCES = 1536

export interface Cinema2AfterhoursRenderBeam {
  readonly fixtureId: string
  readonly originWorld: Cinema2Vector3
  readonly targetWorld: Cinema2Vector3
  readonly intensity: number
  readonly alpha: number
  readonly color: Cinema2Color
  /** Optical width multiplier: 1 for a beam, wider and softer for a sheet. */
  readonly width: number
}

export interface Cinema2AfterhoursRendererDrawRequest {
  readonly beams: readonly Cinema2AfterhoursRenderBeam[]
  readonly worldToClipMatrix: Cinema2Matrix4
  readonly cameraPosition: Cinema2Vector3
  readonly atmosphere: number
  readonly masterIntensity: number
  /** Visual time in seconds for the beams' shimmer. The module freezes it while nothing plays, so a paused show holds still. */
  readonly timeSec?: number
  readonly quality?: 'low' | 'medium' | 'high'
}

export interface Cinema2AfterhoursRendererSnapshot {
  readonly disposed: boolean
  readonly drawCount: number
  readonly lastInstanceCount: number
  readonly bufferUploadCount: number
}

const INSTANCE_FLOATS = 14
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
// One closed unit box per beam. Rasterizing its exit faces covers the entire
// illuminated volume, including end caps, without camera-facing sheet edges.
const BASE_VERTICES = new Float32Array([
  // +Z, -Z, +X, -X, +Y, -Y; outward winding.
  -1,-1,1, 1,-1,1, 1,1,1, -1,-1,1, 1,1,1, -1,1,1,
  1,-1,0, -1,-1,0, -1,1,0, 1,-1,0, -1,1,0, 1,1,0,
  1,-1,1, 1,-1,0, 1,1,0, 1,-1,1, 1,1,0, 1,1,1,
  -1,-1,0, -1,-1,1, -1,1,1, -1,-1,0, -1,1,1, -1,1,0,
  -1,1,1, 1,1,1, 1,1,0, -1,1,1, 1,1,0, -1,1,0,
  -1,-1,0, 1,-1,0, 1,-1,1, -1,-1,0, 1,-1,1, -1,-1,1,
])

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aCorner;
layout(location = 1) in vec3 aOrigin;
layout(location = 2) in vec3 aTarget;
layout(location = 3) in vec4 aColor;
layout(location = 4) in vec4 aMeta;
uniform mat4 uWorldToClip;
uniform vec3 uCameraPosition;
out vec3 vWorld;
flat out vec3 vOrigin;
flat out vec3 vEnd;
flat out vec4 vColor;
flat out vec4 vMeta;

void main() {
  vec3 direction = normalize(aTarget - aOrigin + vec3(0.0, 0.0, .000001));
  // Targets describe aim, not a luminous end cap. Continue through a fixed
  // world volume: never extend a projected line to a viewport-dependent edge.
  vec3 roomMin = vec3(-40.0, -12.0, -8.0);
  vec3 roomMax = vec3(40.0, 26.0, 16.0);
  vec3 safeDirection = sign(direction + vec3(.000001)) * max(abs(direction), vec3(.00001));
  vec3 exits = (mix(roomMin, roomMax, step(vec3(0.0), direction)) - aOrigin) / safeDirection;
  float length = max(.1, min(36.0, min(exits.x, min(exits.y, exits.z))));
  vec3 end = aOrigin + direction * length;
  float support = (2.6 + length * .04) * sqrt(max(1.0, aMeta.w));
  vec3 right = cross(vec3(0.0, 1.0, 0.0), direction);
  if (dot(right,right) < .00001) right = cross(vec3(1.0,0.0,0.0), direction);
  right = normalize(right);
  vec3 up = cross(direction, right);
  vec3 center = mix(aOrigin - direction * support, end + direction * support, aCorner.z);
  vWorld = center + (right * aCorner.x + up * aCorner.y) * support;
  vOrigin = aOrigin; vEnd = end; vColor = aColor; vMeta = aMeta;
  gl_Position = uWorldToClip * vec4(vWorld, 1.0);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vWorld;
flat in vec3 vOrigin;
flat in vec3 vEnd;
flat in vec4 vColor;
flat in vec4 vMeta;
uniform vec3 uCameraPosition;
uniform float uAtmosphere;
uniform float uMasterIntensity;
uniform float uTimeSec;
uniform float uGlowScale;
uniform float uSampleCount;
out vec4 outColor;

// Every beam samples this same advected world field. Crossing shafts light
// the same cloud pockets, rather than carrying unrelated screen-space halos.
float airDensity(vec3 p) {
  vec3 q = p * .42 + vec3(-uTimeSec * .045, uTimeSec * .012, uTimeSec * .027);
  float coarse = sin(q.x + sin(q.z * .83)) * sin(q.y * .91 - q.z * .67);
  float detail = sin(dot(q, vec3(1.73, 1.17, .63)) + sin(q.y * 1.3));
  return clamp(.56 + .29 * coarse + .13 * detail, .12, .98);
}

void main() {
  vec3 ray = normalize(vWorld - uCameraPosition);
  vec3 axis = normalize(vEnd - vOrigin);
  float beamLength = length(vEnd - vOrigin);
  vec3 w = uCameraPosition - vOrigin;
  float alignment = dot(ray, axis);
  float denominator = max(.0001, 1.0 - alignment * alignment);
  float rayT = max(0.0, (alignment * dot(w, axis) - dot(w, ray)) / denominator);
  float along = clamp(dot(w, axis) + alignment * rayT, 0.0, beamLength);
  vec3 axisPoint = vOrigin + axis * along;
  rayT = max(0.0, dot(axisPoint - uCameraPosition, ray));
  vec3 closest = uCameraPosition + ray * rayT;
  float radial = length(closest - axisPoint);
  float width = sqrt(max(1.0, vMeta.w));
  float radius = (.006 + along * .00028) * width;
  // Differentiate signed distance: abs-distance derivatives collapse at the
  // centerline and turn subpixel shafts into dotted/dashed raster patterns.
  vec3 across = cross(ray, axis);
  float signedDistance = dot(w, across) / max(.0001, length(across));
  float aa = max(.001, fwidth(signedDistance));
  float filteredRadius = max(radius, aa * .72);
  float core = exp(-radial * radial / (filteredRadius * filteredRadius));
  float body = exp(-radial / max(.001, radius * 2.6));
  float atmosphere = clamp(uAtmosphere, 0.0, 1.0);
  float extinction = .026 * atmosphere;
  float transmission = exp(-extinction * (along + rayT));
  float source = exp(-length(closest - vOrigin) / .18);
  float forward = .4 + 1.1 * pow(max(0.0, dot(axis, -ray)), 4.0);
  float cloud = 0.0;
  if (atmosphere > .0001) {
    float spread = (.48 + along * .018) * width;
    float halfInterval = min(9.0, spread * 2.8 / sqrt(denominator));
    float begin = max(0.0, rayT - halfInterval);
    float stepLength = (rayT + halfInterval - begin) / uSampleCount;
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uSampleCount) break;
      float travel = begin + (float(i) + .5) * stepLength;
      vec3 p = uCameraPosition + ray * travel;
      float axial = dot(p - vOrigin, axis);
      vec3 nearest = vOrigin + axis * clamp(axial, 0.0, beamLength);
      float distance = length(p - nearest);
      float localSpread = (.48 + max(0.0, axial) * .018) * width;
      float light = exp(-distance * distance / (2.0 * localSpread * localSpread));
      float endFade = smoothstep(-.25, .25, axial) * (1.0 - smoothstep(beamLength - .6, beamLength + .2, axial));
      cloud += airDensity(p) * light * endFade * exp(-extinction * (max(0.0, axial) + travel)) * stepLength;
    }
    cloud *= atmosphere * .095 * forward * uGlowScale;
  }
  // Crisp core + restrained physical-width body, surrounded by illuminated
  // shared air. No ambient fog emission when lasers or Master are off.
  vec3 coreColor = mix(vColor.rgb, vec3(1.0), .48);
  float intensity = max(0.0, vMeta.x) * clamp(vMeta.y, 0.0, 1.0) * max(0.0, uMasterIntensity);
  vec3 rgb = (coreColor * (core * 1.25 + source * .2) * transmission
    + vColor.rgb * body * .35 * transmission
    + vColor.rgb * cloud) * intensity;
  float alpha = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0);
  if (alpha < .001) discard;
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
  private readonly sampleCountLocation: WebGLUniformLocation | null
  private readonly timeLocation: WebGLUniformLocation | null
  private readonly glowScaleLocation: WebGLUniformLocation | null
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
      this.sampleCountLocation = gl.getUniformLocation(this.program, 'uSampleCount')
      this.timeLocation = gl.getUniformLocation(this.program, 'uTimeSec')
      this.glowScaleLocation = gl.getUniformLocation(this.program, 'uGlowScale')

      gl.bindVertexArray(this.vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, BASE_VERTICES, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW)
      configureInstanceAttribute(gl, 1, 3, 0)
      configureInstanceAttribute(gl, 2, 3, 3)
      configureInstanceAttribute(gl, 3, 4, 6)
      configureInstanceAttribute(gl, 4, 4, 10)
      gl.bindVertexArray(null)

      assertCinema2NoGlErrors(gl, 'Afterhours laser resource allocation')
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
    gl.uniform1f(this.sampleCountLocation, request.quality === 'low' ? 8 : request.quality === 'medium' ? 12 : 16)
    gl.uniform1f(this.timeLocation, finite(request.timeSec ?? 0, 0))
    // Many overlapping beams add up, so each beam's soft glow gives way as the rig fills: the haze stays luminous without washing out.
    gl.uniform1f(this.glowScaleLocation, glowScaleFor(instanceCount))

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
    gl.enable(gl.CULL_FACE)
    gl.cullFace(gl.FRONT)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, instanceCount)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Afterhours native laser draw', `${instanceCount} beam instances`)
    this.drawCount += 1
  }

  estimateGpuBytes(): number { return BASE_VERTICES.byteLength + this.instanceData.byteLength }

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
      const offset = instanceCount * INSTANCE_FLOATS
      this.instanceData[offset] = beam.originWorld[0]
      this.instanceData[offset + 1] = beam.originWorld[1]
      this.instanceData[offset + 2] = beam.originWorld[2]
      this.instanceData[offset + 3] = beam.targetWorld[0]
      this.instanceData[offset + 4] = beam.targetWorld[1]
      this.instanceData[offset + 5] = beam.targetWorld[2]
      this.instanceData[offset + 6] = beam.color[0]
      this.instanceData[offset + 7] = beam.color[1]
      this.instanceData[offset + 8] = beam.color[2]
      this.instanceData[offset + 9] = beam.color[3]
      this.instanceData[offset + 10] = Math.max(0, finite(beam.intensity, 0))
      this.instanceData[offset + 11] = alpha
      this.instanceData[offset + 12] = clamp01(1 - temporalWeight)
      this.instanceData[offset + 13] = Math.max(1, finite(beam.width, 1))
      instanceCount += 1
    }

    for (const beam of request.beams) write(beam, 1)
    return instanceCount
  }
}

/** 1 for a sparse show, easing down to 0.3 as the number of beams grows. */
export function glowScaleFor(instanceCount: number): number {
  return Math.min(1, Math.max(0.3, Math.sqrt(28 / Math.max(1, instanceCount))))
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
