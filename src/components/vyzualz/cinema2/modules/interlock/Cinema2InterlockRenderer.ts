import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import {
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  type Cinema2InterlockResolvedFixtureGeometry,
} from './Cinema2InterlockDomain'

export const CINEMA2_INTERLOCK_MAX_RENDER_INSTANCES = CINEMA2_INTERLOCK_FIXTURE_COUNT

export interface Cinema2InterlockRenderFixture {
  readonly fixtureId: string
  readonly geometry: Readonly<Cinema2InterlockResolvedFixtureGeometry>
}

export interface Cinema2InterlockRendererDrawRequest {
  readonly fixtures: readonly Readonly<Cinema2InterlockRenderFixture>[]
  readonly width: number
  readonly height: number
  readonly ledColor: Cinema2Color
  readonly ledIntensity: number
}

export interface Cinema2InterlockRendererSnapshot {
  readonly disposed: boolean
  readonly drawCount: number
  readonly lastInstanceCount: number
  readonly bufferUploadCount: number
}

const INSTANCE_FLOATS = 7
const INSTANCE_STRIDE_BYTES = INSTANCE_FLOATS * Float32Array.BYTES_PER_ELEMENT
const BASE_VERTICES = new Float32Array([
  -1, -1,
  -1, 1,
  1, -1,
  1, 1,
])

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aMidpointPx;
layout(location = 2) in vec2 aAxis;
layout(location = 3) in vec3 aDimensions;
uniform vec2 uViewportPx;
out vec2 vLocalPx;
out vec2 vHalfSizePx;
void main() {
  float halfLength = max(aDimensions.x, 0.0001);
  float halfThickness = max(aDimensions.y, 0.0001);
  float glowPad = max(aDimensions.z, 0.0);
  vec2 halfExtent = vec2(halfLength + glowPad, halfThickness + glowPad);
  vec2 local = aCorner * halfExtent;
  vec2 normal = vec2(-aAxis.y, aAxis.x);
  vec2 positionPx = aMidpointPx + aAxis * local.x + normal * local.y;
  vec2 safeViewport = max(uViewportPx, vec2(1.0));
  vec2 ndc = vec2(
    positionPx.x / safeViewport.x * 2.0 - 1.0,
    1.0 - positionPx.y / safeViewport.y * 2.0
  );
  gl_Position = vec4(ndc, 0.0, 1.0);
  vLocalPx = local;
  vHalfSizePx = vec2(halfLength, halfThickness);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocalPx;
in vec2 vHalfSizePx;
uniform vec4 uLedColor;
uniform float uLedIntensity;
out vec4 outColor;

float roundedBoxSdf(vec2 pointPx, vec2 halfSizePx, float radiusPx) {
  vec2 q = abs(pointPx) - max(halfSizePx - vec2(radiusPx), vec2(0.0));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radiusPx;
}

void main() {
  float intensity = clamp(uLedIntensity, 0.0, 1.0);
  if (intensity <= 0.0001) discard;

  float radius = max(0.75, min(vHalfSizePx.y * 0.92, 12.0));
  float distancePx = roundedBoxSdf(vLocalPx, vHalfSizePx, radius);
  float aa = max(fwidth(distancePx), 0.75);
  float body = 1.0 - smoothstep(-aa, aa, distancePx);
  float innerDistance = roundedBoxSdf(vLocalPx, vHalfSizePx * vec2(0.985, 0.62), max(0.5, radius * 0.58));
  float core = 1.0 - smoothstep(-aa, aa * 1.5, innerDistance);
  float glowRadius = max(vHalfSizePx.y * 2.75, 4.0);
  float glow = exp(-max(distancePx, 0.0) / glowRadius) * (1.0 - body) * 0.24;

  float alpha = clamp((body * 0.93 + glow) * intensity * clamp(uLedColor.a, 0.0, 1.0), 0.0, 1.0);
  if (alpha <= 0.001) discard;

  vec3 authored = clamp(uLedColor.rgb, vec3(0.0), vec3(1.0));
  vec3 coreColor = mix(authored, vec3(1.0), core * 0.72);
  float brightness = intensity * (0.58 + body * 0.62 + core * 0.72 + glow * 0.55);
  vec3 rgb = coreColor * brightness;
  outColor = vec4(rgb * alpha, alpha);
}`

/**
 * Screen-space GPU renderer for Interlock's rigid LED fixtures. Geometry,
 * transition policy, persisted settings and frame scheduling remain outside
 * this class; it owns only one shared program/VAO/buffer set and drawing.
 */
export class Cinema2InterlockRenderer {
  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly baseBuffer: WebGLBuffer
  private readonly instanceBuffer: WebGLBuffer
  private readonly instanceData = new Float32Array(CINEMA2_INTERLOCK_MAX_RENDER_INSTANCES * INSTANCE_FLOATS)
  private readonly viewportLocation: WebGLUniformLocation | null
  private readonly ledColorLocation: WebGLUniformLocation | null
  private readonly ledIntensityLocation: WebGLUniformLocation | null
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
      throw new Error('Cinema 2.0 Interlock could not allocate LED renderer resources.')
    }
    this.vao = vao
    this.baseBuffer = baseBuffer
    this.instanceBuffer = instanceBuffer

    try {
      createdProgram = createProgram(gl)
      this.program = createdProgram
      this.viewportLocation = gl.getUniformLocation(this.program, 'uViewportPx')
      this.ledColorLocation = gl.getUniformLocation(this.program, 'uLedColor')
      this.ledIntensityLocation = gl.getUniformLocation(this.program, 'uLedIntensity')

      gl.bindVertexArray(this.vao)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, BASE_VERTICES, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW)
      configureInstanceAttribute(gl, 1, 2, 0)
      configureInstanceAttribute(gl, 2, 2, 2)
      configureInstanceAttribute(gl, 3, 3, 4)
      gl.bindVertexArray(null)

      assertCinema2NoGlErrors(gl, 'Interlock LED renderer resource allocation')
      if (gl.isContextLost()) throw new Error('Cinema 2.0 lost WebGL2 while allocating Interlock LED resources.')
    } catch (error) {
      gl.bindVertexArray(null)
      gl.deleteBuffer(this.instanceBuffer)
      gl.deleteBuffer(this.baseBuffer)
      gl.deleteVertexArray(this.vao)
      if (createdProgram) gl.deleteProgram(createdProgram)
      throw error
    }
  }

  draw(request: Readonly<Cinema2InterlockRendererDrawRequest>): void {
    if (this.disposed) throw new Error('Cinema 2.0 Interlock renderer is disposed.')
    const instanceCount = this.packInstances(request.fixtures)
    this.lastInstanceCount = instanceCount

    const gl = this.gl
    // The current production executor can fast-path a single normal layer
    // directly into its engine-owned target without a pre-clear. Clear only
    // this dedicated Interlock surface to transparent so pixels outside the
    // finite fixtures are deterministic and remain compositable.
    gl.disable(gl.SCISSOR_TEST)
    gl.colorMask(true, true, true, true)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (instanceCount === 0) return
    gl.useProgram(this.program)
    gl.uniform2f(this.viewportLocation, finitePositive(request.width, 1), finitePositive(request.height, 1))
    gl.uniform4f(
      this.ledColorLocation,
      clamp01(request.ledColor[0]),
      clamp01(request.ledColor[1]),
      clamp01(request.ledColor[2]),
      clamp01(request.ledColor[3]),
    )
    gl.uniform1f(this.ledIntensityLocation, clamp01(request.ledIntensity))

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, instanceCount * INSTANCE_FLOATS))
    this.bufferUploadCount += 1

    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    // Fragment output is premultiplied so the fixture layer stays transparent
    // outside finite bars and can be composited safely by Cinema 2.0.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.CULL_FACE)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(null)

    assertCinema2NoGlErrors(gl, 'Interlock native LED draw', `${instanceCount} fixture instances`)
    this.drawCount += 1
  }

  getSnapshot(): Readonly<Cinema2InterlockRendererSnapshot> {
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

  private packInstances(fixtures: readonly Readonly<Cinema2InterlockRenderFixture>[]): number {
    let instanceCount = 0
    for (const fixture of fixtures) {
      if (instanceCount >= CINEMA2_INTERLOCK_MAX_RENDER_INSTANCES) break
      const geometry = fixture.geometry
      const dx = geometry.bottom[0] - geometry.top[0]
      const dy = geometry.bottom[1] - geometry.top[1]
      const length = Math.hypot(dx, dy)
      if (!Number.isFinite(length) || length <= 1e-6) continue
      const halfLength = length / 2
      const halfThickness = Math.max(0.5, finitePositive(geometry.thicknessPx, 1) / 2)
      const glowPad = Math.max(3, halfThickness * 3.4)
      const offset = instanceCount * INSTANCE_FLOATS
      this.instanceData[offset] = geometry.middle[0]
      this.instanceData[offset + 1] = geometry.middle[1]
      this.instanceData[offset + 2] = dx / length
      this.instanceData[offset + 3] = dy / length
      this.instanceData[offset + 4] = halfLength
      this.instanceData[offset + 5] = halfThickness
      this.instanceData[offset + 6] = glowPad
      instanceCount += 1
    }
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
    throw new Error('Cinema 2.0 Interlock could not allocate its LED shader program.')
  }
  try {
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Cinema 2.0 Interlock LED shader link failed: ${gl.getProgramInfoLog(program) || 'unknown link error'}`)
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
  if (!shader) throw new Error('Cinema 2.0 Interlock could not allocate an LED shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown compile error'
    gl.deleteShader(shader)
    throw new Error(`Cinema 2.0 Interlock LED shader compilation failed: ${log}`)
  }
  return shader
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}
