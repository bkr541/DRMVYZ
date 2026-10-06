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
uniform vec2 uViewportPx;
uniform float uPixelScale;
out vec4 vColor;
out vec4 vMeta;
out float vSide;
out float vLongitudinal;
out float vViewDistance;
out float vBeamLength;
out float vHalfPx;
out float vTravelPx;
flat out float vPhase;

// Half the width of a beam's quad on screen, in pixels at a 1080-pixel-tall viewport. It is wide enough to hold the whole glow, and it scales
// with the viewport so a beam looks the same at any resolution.
const float HALF_WIDTH_PX = 72.0;

float viewportExitScale(vec2 originNdc, vec2 targetNdc) {
  vec2 delta = targetNdc - originNdc;
  if (dot(delta, delta) < 0.000001) return 1.0;
  // Sources are expected to project on/near the production canvas. Avoid
  // inventing a backwards ray when a future camera intentionally hides one.
  if (abs(originNdc.x) > 1.08 || abs(originNdc.y) > 1.08) return 1.0;

  const float edge = 1.002;
  const float huge = 1000000.0;
  float xExit = huge;
  float yExit = huge;
  if (delta.x > 0.00001) xExit = (edge - originNdc.x) / delta.x;
  else if (delta.x < -0.00001) xExit = (-edge - originNdc.x) / delta.x;
  if (delta.y > 0.00001) yExit = (edge - originNdc.y) / delta.y;
  else if (delta.y < -0.00001) yExit = (-edge - originNdc.y) / delta.y;

  float exitScale = min(xExit > 0.0 ? xExit : huge, yExit > 0.0 ? yExit : huge);
  return exitScale >= huge * 0.5 ? 1.0 : max(1.0, exitScale);
}

void main() {
  vec3 beam = aTarget - aOrigin;
  float beamLength = max(length(beam), 0.0001);
  vec3 direction = beam / beamLength;
  float t = clamp(aCorner.x, 0.0, 1.0);
  vec3 center = mix(aOrigin, aTarget, t);
  float widthMul = max(aMeta.w, 1.0);
  float halfPx = HALF_WIDTH_PX * (1.0 + 0.35 * (widthMul - 1.0)) * uPixelScale;

  vec4 originClip = uWorldToClip * vec4(aOrigin, 1.0);
  vec4 targetClip = uWorldToClip * vec4(aTarget, 1.0);
  vec4 centerClip = uWorldToClip * vec4(center, 1.0);

  if (originClip.w > 0.0001 && targetClip.w > 0.0001 && centerClip.w > 0.0001) {
    // Cinema 2.0 retains its finite 3D target for depth, scanner direction and camera perspective, then projects that direction to the actual
    // visible stage boundary (the legacy stage-filling ray contract). The beam's width is laid out on screen, perpendicular to that visible
    // direction, so every beam has the same thickness whatever its distance from the camera.
    vec2 originNdc = originClip.xy / originClip.w;
    vec2 targetNdc = targetClip.xy / targetClip.w;
    float exitScale = viewportExitScale(originNdc, targetNdc);
    vec2 extendedTargetNdc = originNdc + (targetNdc - originNdc) * exitScale;
    vec2 extendedCenterNdc = mix(originNdc, extendedTargetNdc, t);
    vec2 halfViewport = max(uViewportPx * 0.5, vec2(1.0));
    vec2 travelPx = (extendedTargetNdc - originNdc) * halfViewport;
    float travelLength = length(travelPx);
    vec2 directionPx = travelLength > 0.001 ? travelPx / travelLength : vec2(0.0, 1.0);
    vec2 perpendicularPx = vec2(-directionPx.y, directionPx.x);
    vec2 offsetNdc = perpendicularPx * aCorner.y * halfPx / halfViewport;
    // The quad starts a little behind the emitter so its glow can fade out round the source instead of being cut off by a flat edge.
    float padPx = t < 0.5 ? halfPx * 0.9 : 0.0;
    offsetNdc -= directionPx * padPx / halfViewport;
    vTravelPx = max(travelLength, 1.0);
    vLongitudinal = t < 0.5 ? -padPx / vTravelPx : 1.0;
    // Every vertex shares w = 1: the beam is laid out directly in screen space, so it stays perfectly straight (a quad whose ends have different w
    // skews its centre line) and keeps one thickness along its whole length.
    gl_Position = vec4(extendedCenterNdc + offsetNdc, centerClip.z / centerClip.w, 1.0);
  } else {
    // A beam that does not project in front of the camera keeps the world-space quad (it is clipped away).
    vec3 toCamera = normalize(uCameraPosition - center + vec3(0.000001, 0.0, 0.0));
    vec3 sideAxis = cross(direction, toCamera);
    if (length(sideAxis) < 0.0001) sideAxis = cross(direction, vec3(0.0, 1.0, 0.0001));
    sideAxis = normalize(sideAxis);
    gl_Position = uWorldToClip * vec4(center + sideAxis * aCorner.y * 0.06, 1.0);
    vTravelPx = 1.0;
    vLongitudinal = t;
  }
  vColor = aColor;
  vMeta = aMeta;
  // Preserve the signed quad coordinate through raster interpolation so the
  // fragment shader receives 0.0 at the beam center.
  vSide = aCorner.y;
  vViewDistance = length(uCameraPosition - center);
  vBeamLength = beamLength;
  vHalfPx = halfPx;
  vPhase = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 vColor;
in vec4 vMeta;
in float vSide;
in float vLongitudinal;
in float vViewDistance;
in float vBeamLength;
in float vHalfPx;
in float vTravelPx;
flat in float vPhase;
uniform float uAtmosphere;
uniform float uMasterIntensity;
uniform float uPixelScale;
uniform float uTimeSec;
uniform float uGlowScale;
out vec4 outColor;

float hash11(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash11(i), hash11(i + 1.0), u);
}

void main() {
  float side = clamp(abs(vSide), 0.0, 1.0);
  float widthMul = max(vMeta.w, 1.0);
  // Distance from the beam's centre in pixels at a 1080-pixel-tall viewport. A sheet (wider and softer) spreads its glow further.
  float pixelScale = max(uPixelScale, 0.05);
  float widthSoftness = inversesqrt(widthMul);
  float across = side * vHalfPx / pixelScale * widthSoftness;
  // Behind the emitter the glow closes round it instead of ending flat.
  float behind = max(0.0, -vLongitudinal * vTravelPx) / pixelScale * widthSoftness;
  float d = length(vec2(across, behind));
  float along01 = clamp(vLongitudinal, 0.0, 1.0);
  float atmosphere = clamp(uAtmosphere, 0.0, 1.0);

  // The beam is a stack, like real laser light in haze: a hair-thin white-hot core, a saturated body a few pixels wide, a soft coloured
  // envelope, and a wide scattered haze. The two outer layers fade out before the quad's edge so no edge is ever visible.
  float behindFraction = max(0.0, -vLongitudinal * vTravelPx) / max(vHalfPx * 0.9, 1.0);
  float quadEdge = (1.0 - smoothstep(0.5, 1.0, side)) * (1.0 - smoothstep(0.5, 1.0, behindFraction));
  float core = exp(-d * d / 1.7);
  float body = exp(-d / 3.1);
  float envelope = exp(-d / 9.5) * quadEdge * (0.45 + 0.55 * atmosphere);
  float scatter = exp(-d / 24.0) * quadEdge * atmosphere * atmosphere;
  float sourceBloom = exp(-along01 * 40.0) * exp(-d / 13.0) * (0.55 + atmosphere * 0.45);
  float rayFalloff = mix(1.0, 0.42, smoothstep(0.14, 1.0, along01));

  // Light travelling through haze is never perfectly even: it breathes and shimmers along the beam, each beam on its own phase.
  float along = along01 * vBeamLength * 1.4;
  float slow = noise1(along - uTimeSec * 2.6 + vPhase * 40.0);
  float fast = noise1(along * 3.7 + uTimeSec * 4.1 + vPhase * 91.0);
  float shimmer = 0.8 + 0.2 * (0.65 * slow + 0.35 * fast);
  float breathe = 1.0 + 0.045 * sin(uTimeSec * 6.3 + vPhase * 6.2832);
  float live = shimmer * breathe;

  float intensity = max(0.0, vMeta.x) * clamp(vMeta.y, 0.0, 1.0) * max(0.0, uMasterIntensity);
  // World-space distance separation keeps near paths crisp while allowing far
  // paths to recede naturally into haze instead of flattening into one plane.
  float distanceFade = mix(1.08, 0.62, smoothstep(7.0, 30.0, vViewDistance));
  float lengthDiscipline = mix(1.0, 0.88, smoothstep(10.0, 18.0, vBeamLength));
  float temporalFade = mix(1.0, 0.42, clamp(vMeta.z, 0.0, 1.0));
  float optical = rayFalloff * distanceFade * lengthDiscipline * intensity * temporalFade;

  // Colour changes across the beam: white-hot core, saturated body, and a halo that drifts slightly in hue and lightens.
  vec3 base = vColor.rgb;
  vec3 coreColor = mix(base, vec3(1.0), 0.55);
  vec3 bodyColor = base * 1.08;
  vec3 envelopeColor = mix(base, vec3(1.0), 0.10);
  vec3 hazeColor = mix(base, base.gbr, 0.14);
  vec3 rgb = (coreColor * core * (0.93 + 0.07 * live) * 1.45
    + bodyColor * body * live * 0.80 * mix(1.0, uGlowScale, 0.6)
    + envelopeColor * envelope * live * 0.30 * uGlowScale
    + hazeColor * scatter * live * 0.22 * uGlowScale
    + coreColor * sourceBloom * 0.35) * optical;
  float alpha = clamp(max(rgb.r, max(rgb.g, rgb.b)), 0.0, 1.0);
  if (alpha < 0.002) discard;
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
  private readonly viewportLocation: WebGLUniformLocation | null
  private readonly pixelScaleLocation: WebGLUniformLocation | null
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
      this.viewportLocation = gl.getUniformLocation(this.program, 'uViewportPx')
      this.pixelScaleLocation = gl.getUniformLocation(this.program, 'uPixelScale')
      this.timeLocation = gl.getUniformLocation(this.program, 'uTimeSec')
      this.glowScaleLocation = gl.getUniformLocation(this.program, 'uGlowScale')

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
    const viewport = readViewport(gl)
    gl.uniform2f(this.viewportLocation, viewport.width, viewport.height)
    gl.uniform1f(this.pixelScaleLocation, Math.min(3, Math.max(0.4, viewport.height / REFERENCE_VIEWPORT_HEIGHT)))
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
    gl.disable(gl.CULL_FACE)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, instanceCount)
    gl.disable(gl.BLEND)
    gl.depthMask(true)
    gl.bindVertexArray(null)
    assertCinema2NoGlErrors(gl, 'Afterhours native laser draw', `${instanceCount} beam instances`)
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

const REFERENCE_VIEWPORT_HEIGHT = 1080

/** The size, in pixels, of the surface the beams are drawn onto. */
function readViewport(gl: WebGL2RenderingContext): { width: number; height: number } {
  try {
    const value = typeof gl.getParameter === 'function' ? gl.getParameter(gl.VIEWPORT) as ArrayLike<number> | null : null
    if (value && value.length >= 4 && value[2]! > 0 && value[3]! > 0) return { width: value[2]!, height: value[3]! }
  } catch {
    // Fall through to the drawing buffer.
  }
  const width = gl.drawingBufferWidth
  const height = gl.drawingBufferHeight
  return width > 0 && height > 0 ? { width, height } : { width: 1920, height: REFERENCE_VIEWPORT_HEIGHT }
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
