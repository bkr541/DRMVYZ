import type { Cinema2Color } from '../../contracts/Cinema2NativePresetManifest'
import { assertCinema2NoGlErrors } from '../../runtime/Cinema2GpuValidation'
import {
  CINEMA2_INTERLOCK_FIXTURE_COUNT,
  type Cinema2InterlockResolvedFixtureGeometry,
} from './Cinema2InterlockDomain'
import {
  getCinema2InterlockSegmentProgramIndex,
  type Cinema2InterlockSegmentProgramId,
} from './Cinema2InterlockSegments'
import { resolveCinema2InterlockRendererInstanceDimensions } from './Cinema2InterlockRenderEnvelope'

export const CINEMA2_INTERLOCK_MAX_RENDER_INSTANCES = CINEMA2_INTERLOCK_FIXTURE_COUNT

export interface Cinema2InterlockRenderFixture {
  readonly fixtureId: string
  readonly geometry: Readonly<Cinema2InterlockResolvedFixtureGeometry>
  readonly cellCount: number
  readonly segmentDirection: 1 | -1
  readonly bankIndex: number
  readonly fixtureOrder: number
}

export interface Cinema2InterlockRendererDrawRequest {
  readonly target: WebGLFramebuffer | null
  readonly fixtures: readonly Readonly<Cinema2InterlockRenderFixture>[]
  readonly width: number
  readonly height: number
  readonly ledColor: Cinema2Color
  readonly ledIntensity: number
  readonly segmentProgram: Cinema2InterlockSegmentProgramId
  readonly segmentPhase: number
  readonly litDensity: number
  readonly segmentFade: number
  readonly segmentAfterglow: number
  readonly unlitVisibility: number
  readonly segmentEnergy: number
  readonly segmentImpact: number
  readonly segmentDirectionBias: number
  readonly segmentBankPhase: number
}

export interface Cinema2InterlockRendererSnapshot {
  readonly disposed: boolean
  readonly drawCount: number
  readonly lastInstanceCount: number
  readonly bufferUploadCount: number
  readonly instanceFloats: number
}

const INSTANCE_FLOATS = 11
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
layout(location = 4) in vec4 aSegmentMeta;
uniform vec2 uViewportPx;
out vec2 vLocalPx;
out vec2 vHalfSizePx;
flat out vec4 vSegmentMeta;
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
  vSegmentMeta = aSegmentMeta;
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocalPx;
in vec2 vHalfSizePx;
flat in vec4 vSegmentMeta;
uniform vec4 uLedColor;
uniform float uLedIntensity;
uniform int uSegmentProgram;
uniform float uSegmentPhase;
uniform float uLitDensity;
uniform float uSegmentFade;
uniform float uSegmentAfterglow;
uniform float uUnlitVisibility;
uniform float uSegmentEnergy;
uniform float uSegmentImpact;
uniform float uSegmentDirectionBias;
uniform float uSegmentBankPhase;
out vec4 outColor;

float roundedBoxSdf(vec2 pointPx, vec2 halfSizePx, float radiusPx) {
  vec2 q = abs(pointPx) - max(halfSizePx - vec2(radiusPx), vec2(0.0));
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - radiusPx;
}

float saturate(float value) { return clamp(value, 0.0, 1.0); }
float wrap01(float value) { return fract(value + 4.0); }
float chaseMask(float position, float phase, float density, float fade, float afterglow, float direction) {
  float head = direction > 0.0 ? phase : wrap01(1.0 - phase);
  float behind = direction > 0.0 ? wrap01(head - position) : wrap01(position - head);
  float coreWidth = 0.035 + density * 0.36;
  float softness = 0.01 + fade * 0.12;
  float core = 1.0 - smoothstep(coreWidth, coreWidth + softness, behind);
  float tailWidth = coreWidth + 0.03 + afterglow * 0.5;
  float tail = (1.0 - smoothstep(coreWidth, tailWidth, behind)) * afterglow * 0.72;
  return saturate(max(core, tail));
}

float movingFrontMask(float position, float phase, float density, float fade, float afterglow) {
  float distanceToFront = abs(position - phase);
  float width = 0.025 + density * 0.19;
  float softness = 0.01 + fade * 0.11;
  float core = 1.0 - smoothstep(width, width + softness, distanceToFront);
  float trailing = position <= phase
    ? (1.0 - smoothstep(width, width + 0.05 + afterglow * 0.45, distanceToFront)) * afterglow * 0.65
    : 0.0;
  return saturate(max(core, trailing));
}

float thresholdMask(float position, float threshold, float fade) {
  float softness = 0.005 + fade * 0.06;
  return 1.0 - smoothstep(threshold, threshold + softness, position);
}

float segmentProgramMask(float position, float cellIndex, float cellCount) {
  float phase = wrap01(uSegmentPhase);
  float density = clamp(uLitDensity, 0.05, 1.0);
  float fade = saturate(uSegmentFade);
  float afterglow = saturate(uSegmentAfterglow);
  float direction = vSegmentMeta.y < 0.0 ? -1.0 : 1.0;
  float directed = direction < 0.0 ? 1.0 - position : position;
  directed = wrap01(directed + clamp(uSegmentDirectionBias, -1.0, 1.0) * 0.125);

  if (uSegmentProgram == 0) return 1.0;
  if (uSegmentProgram == 1) return chaseMask(directed, phase, density, fade, afterglow, 1.0);
  if (uSegmentProgram == 2) return chaseMask(directed, phase, density, fade, afterglow, -1.0);
  if (uSegmentProgram == 3) return movingFrontMask(abs(directed - 0.5) * 2.0, phase, density, fade, afterglow);
  if (uSegmentProgram == 4) return movingFrontMask(min(directed, 1.0 - directed) * 2.0, phase, density, fade, afterglow);
  if (uSegmentProgram == 5) {
    float parity = mod(cellIndex, 2.0);
    float activeParity = phase < 0.5 ? 0.0 : 1.0;
    float transition = min(abs(phase - 0.5), min(abs(phase), abs(1.0 - phase)));
    float edge = 0.08 + fade * 0.17;
    float parityLevel = abs(parity - activeParity) < 0.25 ? 1.0 : 1.0 - smoothstep(0.0, edge, transition);
    return saturate(parityLevel * (0.45 + density * 0.55));
  }
  if (uSegmentProgram == 6) {
    float threshold = saturate(saturate(uSegmentEnergy) * (0.35 + density * 0.65));
    return thresholdMask(directed, threshold, fade);
  }
  if (uSegmentProgram == 7) {
    float bankStagger = saturate(uSegmentBankPhase);
    float bankOffset = vSegmentMeta.z * 0.17 * bankStagger + vSegmentMeta.w * 0.11;
    return chaseMask(directed, wrap01(phase - bankOffset), density, fade, afterglow, 1.0);
  }
  float radial = abs(directed - 0.5) * 2.0;
  float burstPhase = wrap01(phase * 0.72);
  float wave = movingFrontMask(radial, burstPhase, max(0.18, density * 0.72), fade, afterglow);
  float envelope = 0.28 + saturate(uSegmentImpact) * 0.72;
  return saturate(wave * envelope);
}

void main() {
  float intensity = clamp(uLedIntensity, 0.0, 1.0);
  if (intensity <= 0.0001) discard;

  float radius = max(0.75, min(vHalfSizePx.y * 0.92, 12.0));
  float distancePx = roundedBoxSdf(vLocalPx, vHalfSizePx, radius);
  float aa = max(fwidth(distancePx), 0.75);
  float body = 1.0 - smoothstep(-aa, aa, distancePx);

  float cellCount = max(1.0, floor(vSegmentMeta.x + 0.5));
  float normalizedX = clamp(vLocalPx.x / max(vHalfSizePx.x * 2.0, 0.0001) + 0.5, 0.0, 0.999999);
  float cellCoordinate = normalizedX * cellCount;
  float cellIndex = floor(cellCoordinate);
  float cellLocal = fract(cellCoordinate) - 0.5;
  float cellEdgeAa = max(fwidth(cellCoordinate), 0.015);
  float cellShape = 1.0 - smoothstep(0.39 - cellEdgeAa, 0.48 + cellEdgeAa, abs(cellLocal));
  float segmentedBody = body * cellShape;

  float pattern = segmentProgramMask((cellIndex + 0.5) / cellCount, cellIndex, cellCount);
  float cellIntensity = mix(clamp(uUnlitVisibility, 0.0, 0.15), 1.0, pattern);

  float innerDistance = roundedBoxSdf(vLocalPx, vHalfSizePx * vec2(0.985, 0.62), max(0.5, radius * 0.58));
  float core = (1.0 - smoothstep(-aa, aa * 1.5, innerDistance)) * cellShape;
  float glowRadius = max(vHalfSizePx.y * 2.75, 4.0);
  float glow = exp(-max(distancePx, 0.0) / glowRadius) * (1.0 - body) * 0.16 * cellIntensity;

  float alpha = clamp((segmentedBody * (0.72 + cellIntensity * 0.25) + glow) * intensity * clamp(uLedColor.a, 0.0, 1.0), 0.0, 1.0);
  if (alpha <= 0.001) discard;

  vec3 authored = clamp(uLedColor.rgb, vec3(0.0), vec3(1.0));
  // Keep a restrained white-hot core for depth without bleaching the selected LED color.
  // The bounded brightness curve is deliberately monotonic and keeps max intensity from
  // turning most fixture cells into clipped white rectangles.
  vec3 coreColor = mix(authored, vec3(1.0), core * (0.10 + cellIntensity * 0.18));
  float brightness = intensity * cellIntensity * (0.68 + segmentedBody * 0.18 + core * 0.16 + glow * 0.18);
  vec3 rgb = coreColor * brightness;
  outColor = vec4(rgb * alpha, alpha);
}`

/**
 * One shared screen-space GPU renderer for all 28 fixtures. Segmentation is
 * evaluated analytically in the fragment shader, so cell count changes do not
 * allocate scene nodes, buffers, programs, or draw calls per LED cell.
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
  private readonly segmentProgramLocation: WebGLUniformLocation | null
  private readonly segmentPhaseLocation: WebGLUniformLocation | null
  private readonly litDensityLocation: WebGLUniformLocation | null
  private readonly segmentFadeLocation: WebGLUniformLocation | null
  private readonly segmentAfterglowLocation: WebGLUniformLocation | null
  private readonly unlitVisibilityLocation: WebGLUniformLocation | null
  private readonly segmentEnergyLocation: WebGLUniformLocation | null
  private readonly segmentImpactLocation: WebGLUniformLocation | null
  private readonly segmentDirectionBiasLocation: WebGLUniformLocation | null
  private readonly segmentBankPhaseLocation: WebGLUniformLocation | null
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
      this.segmentProgramLocation = gl.getUniformLocation(this.program, 'uSegmentProgram')
      this.segmentPhaseLocation = gl.getUniformLocation(this.program, 'uSegmentPhase')
      this.litDensityLocation = gl.getUniformLocation(this.program, 'uLitDensity')
      this.segmentFadeLocation = gl.getUniformLocation(this.program, 'uSegmentFade')
      this.segmentAfterglowLocation = gl.getUniformLocation(this.program, 'uSegmentAfterglow')
      this.unlitVisibilityLocation = gl.getUniformLocation(this.program, 'uUnlitVisibility')
      this.segmentEnergyLocation = gl.getUniformLocation(this.program, 'uSegmentEnergy')
      this.segmentImpactLocation = gl.getUniformLocation(this.program, 'uSegmentImpact')
      this.segmentDirectionBiasLocation = gl.getUniformLocation(this.program, 'uSegmentDirectionBias')
      this.segmentBankPhaseLocation = gl.getUniformLocation(this.program, 'uSegmentBankPhase')

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
      configureInstanceAttribute(gl, 4, 4, 7)
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
    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    gl.bindFramebuffer(gl.FRAMEBUFFER, request.target)
    gl.viewport(0, 0, finitePositive(request.width, 1), finitePositive(request.height, 1))
    gl.disable(gl.SCISSOR_TEST)
    gl.colorMask(true, true, true, true)
    if (instanceCount === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer)
      return
    }
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
    gl.uniform1i(this.segmentProgramLocation, Math.max(0, getCinema2InterlockSegmentProgramIndex(request.segmentProgram)))
    gl.uniform1f(this.segmentPhaseLocation, wrap01(request.segmentPhase))
    gl.uniform1f(this.litDensityLocation, clamp(request.litDensity, 0.05, 1))
    gl.uniform1f(this.segmentFadeLocation, clamp01(request.segmentFade))
    gl.uniform1f(this.segmentAfterglowLocation, clamp01(request.segmentAfterglow))
    gl.uniform1f(this.unlitVisibilityLocation, clamp(request.unlitVisibility, 0, 0.15))
    gl.uniform1f(this.segmentEnergyLocation, clamp01(request.segmentEnergy))
    gl.uniform1f(this.segmentImpactLocation, clamp01(request.segmentImpact))
    gl.uniform1f(this.segmentDirectionBiasLocation, clamp(request.segmentDirectionBias, -1, 1))
    gl.uniform1f(this.segmentBankPhaseLocation, clamp01(request.segmentBankPhase))

    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, instanceCount * INSTANCE_FLOATS))
    this.bufferUploadCount += 1

    gl.disable(gl.DEPTH_TEST)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.disable(gl.CULL_FACE)
    try {
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount)
      assertCinema2NoGlErrors(gl, 'Interlock native segmented LED draw', `${instanceCount} fixture instances`)
      this.drawCount += 1
    } finally {
      gl.disable(gl.BLEND)
      gl.depthMask(true)
      gl.bindVertexArray(null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer)
    }
  }

  getSnapshot(): Readonly<Cinema2InterlockRendererSnapshot> {
    return Object.freeze({
      disposed: this.disposed,
      drawCount: this.drawCount,
      lastInstanceCount: this.lastInstanceCount,
      bufferUploadCount: this.bufferUploadCount,
      instanceFloats: INSTANCE_FLOATS,
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
      const { halfLengthPx: halfLength, halfThicknessPx: halfThickness, glowPaddingPx: glowPad } =
        resolveCinema2InterlockRendererInstanceDimensions(length, geometry.thicknessPx)
      const offset = instanceCount * INSTANCE_FLOATS
      this.instanceData[offset] = geometry.middle[0]
      this.instanceData[offset + 1] = geometry.middle[1]
      this.instanceData[offset + 2] = dx / length
      this.instanceData[offset + 3] = dy / length
      this.instanceData[offset + 4] = halfLength
      this.instanceData[offset + 5] = halfThickness
      this.instanceData[offset + 6] = glowPad
      this.instanceData[offset + 7] = clamp(Math.round(fixture.cellCount), 1, 256)
      this.instanceData[offset + 8] = fixture.segmentDirection < 0 ? -1 : 1
      this.instanceData[offset + 9] = clamp(Math.round(fixture.bankIndex), 0, 3)
      this.instanceData[offset + 10] = clamp01(fixture.fixtureOrder)
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function wrap01(value: number): number {
  const finite = Number.isFinite(value) ? value : 0
  return finite - Math.floor(finite)
}
