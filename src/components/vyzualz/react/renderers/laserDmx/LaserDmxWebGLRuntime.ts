import { resolveCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import { ShaderWebGLRuntime } from '../../shaders/runtime/ShaderWebGLRuntime'
import type { WebGLContextDisposalMode } from '../../shaders/runtime/WebGLContextLifecycle'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  buildLaserDmxWebGLBeamRenderPlan,
  type LaserDmxWebGLApertureInstance,
  type LaserDmxWebGLBeamInstance,
} from './LaserDmxWebGLBeamPlan'

export interface LaserDmxWebGLRenderResult {
  ok: boolean
  error: string | null
  recoverable?: boolean
}

export class LaserDmxWebGLContextState {
  private _contextLost = false
  private _restorePending = false
  private _disposed = false
  private _generation = 0

  get contextLost(): boolean { return this._contextLost }
  get restorePending(): boolean { return this._restorePending }
  get disposed(): boolean { return this._disposed }
  get generation(): number { return this._generation }

  markLost(): void {
    if (this._disposed) return
    this._contextLost = true
    this._restorePending = false
  }

  markRestored(): void {
    if (this._disposed) return
    this._contextLost = false
    this._restorePending = true
    this._generation += 1
  }

  consumeRestore(): boolean {
    if (!this._restorePending || this._disposed) return false
    this._restorePending = false
    return true
  }

  dispose(): void {
    this._disposed = true
    this._contextLost = false
    this._restorePending = false
  }
}

const BEAM_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iOrigin;
layout(location = 2) in vec3 iTarget;
layout(location = 3) in vec4 iColor;
layout(location = 4) in vec4 iOptics;
layout(location = 5) in vec4 iWidths;
layout(location = 6) in vec2 iExtra;
uniform vec2 uViewportPx;
uniform vec2 uCssToBacking;
out float vAcross;
out float vAlong;
out float vBodyRatio;
flat out vec4 vColor;
flat out vec4 vOptics;
flat out vec2 vExtra;
void main() {
  vec2 originPx = vec2(iOrigin.x * uViewportPx.x, iOrigin.y * uViewportPx.y);
  vec2 targetPx = vec2(iTarget.x * uViewportPx.x, iTarget.y * uViewportPx.y);
  vec2 delta = targetPx - originPx;
  float segmentLength = max(length(delta), 0.0001);
  vec2 normal = vec2(-delta.y, delta.x) / segmentLength;
  float along = aCorner.x;
  float envelopeCssPx = mix(iWidths.z, iWidths.w, along);
  float backingScale = min(uCssToBacking.x, uCssToBacking.y);
  vec2 positionPx = mix(originPx, targetPx, along) + normal * aCorner.y * envelopeCssPx * backingScale * 0.5;
  vec2 clip = vec2(positionPx.x / uViewportPx.x * 2.0 - 1.0, 1.0 - positionPx.y / uViewportPx.y * 2.0);
  gl_Position = vec4(clip, clamp(mix(iOrigin.z, iTarget.z, along), -1.0, 1.0), 1.0);
  vAcross = aCorner.y;
  vAlong = along;
  vBodyRatio = mix(iWidths.x / max(iWidths.z, 0.001), iWidths.y / max(iWidths.w, 0.001), along);
  vColor = iColor;
  vOptics = iOptics;
  vExtra = iExtra;
}`

const BEAM_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vAcross;
in float vAlong;
in float vBodyRatio;
flat in vec4 vColor;
flat in vec4 vOptics;
flat in vec2 vExtra;
out vec4 outColor;
void main() {
  float lateral = abs(vAcross);
  float intensity = vOptics.x;
  float coreIntensity = vOptics.y;
  float hotMix = vOptics.z;
  float opacity = vOptics.w;
  float envelope = exp(-lateral * lateral * 4.8) * vExtra.x;
  float body = 1.0 - smoothstep(max(0.015, vBodyRatio * 0.58), max(0.025, vBodyRatio), lateral);
  float core = 1.0 - smoothstep(max(0.006, vBodyRatio * 0.10), max(0.012, vBodyRatio * 0.28), lateral);
  float hot = (1.0 - smoothstep(max(0.002, vBodyRatio * 0.018), max(0.006, vBodyRatio * 0.075), lateral)) * hotMix;
  float sourceLift = 1.0 - smoothstep(0.0, 0.12, vAlong);
  vec3 saturated = vColor.rgb;
  vec3 paleCore = mix(saturated, vec3(1.0), 0.08 + hotMix * 0.46);
  vec3 energy = saturated * envelope * intensity * 0.42;
  energy += saturated * body * intensity * 0.92;
  energy += paleCore * core * coreIntensity * (0.52 + sourceLift * 0.16);
  energy += vec3(1.0) * hot * intensity * 1.12;
  outColor = vec4(energy * opacity, 1.0);
}`

const APERTURE_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec3 iPosition;
layout(location = 2) in vec4 iColor;
layout(location = 3) in vec4 iRadii;
layout(location = 4) in vec2 iGlareDirection;
uniform vec2 uViewportPx;
uniform vec2 uCssToBacking;
out vec2 vLocal;
flat out vec4 vColor;
flat out vec4 vRadii;
flat out vec2 vGlareDirection;
void main() {
  float backingScale = min(uCssToBacking.x, uCssToBacking.y);
  vec2 centerPx = vec2(iPosition.x * uViewportPx.x, iPosition.y * uViewportPx.y);
  vec2 positionPx = centerPx + aCorner * iRadii.z * backingScale;
  vec2 clip = vec2(positionPx.x / uViewportPx.x * 2.0 - 1.0, 1.0 - positionPx.y / uViewportPx.y * 2.0);
  gl_Position = vec4(clip, clamp(iPosition.z, -1.0, 1.0), 1.0);
  vLocal = aCorner;
  vColor = iColor;
  vRadii = iRadii;
  vGlareDirection = iGlareDirection;
}`

const APERTURE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocal;
flat in vec4 vColor;
flat in vec4 vRadii;
flat in vec2 vGlareDirection;
out vec4 outColor;
void main() {
  float radius = length(vLocal);
  if (radius > 1.0) discard;
  float coreRatio = clamp(vRadii.x / max(vRadii.z, 0.001), 0.02, 0.9);
  float ringRatio = clamp(vRadii.y / max(vRadii.z, 0.001), coreRatio, 0.96);
  float intensity = vRadii.w;
  float core = exp(-pow(radius / max(coreRatio, 0.001), 2.0) * 3.6);
  float ring = (1.0 - smoothstep(ringRatio * 0.72, ringRatio, radius)) * smoothstep(coreRatio * 0.88, coreRatio * 1.42, radius);
  float halo = exp(-radius * radius * 4.2);
  vec2 localDirection = radius > 0.0001 ? vLocal / radius : vec2(1.0, 0.0);
  float glareAxis = abs(dot(localDirection, normalize(vGlareDirection)));
  float glare = pow(glareAxis, 22.0) * exp(-radius * 5.8) * 0.12;
  vec3 energy = vColor.rgb * halo * intensity * 0.18;
  energy += vColor.rgb * ring * intensity * 0.34;
  energy += mix(vColor.rgb, vec3(1.0), 0.7) * core * intensity * 0.92;
  energy += mix(vColor.rgb, vec3(1.0), 0.48) * glare * intensity;
  outColor = vec4(energy, 1.0);
}`

const COMPOSITE_VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const COMPOSITE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLightTexture;
out vec4 outColor;
void main() {
  vec3 light = texture(uLightTexture, vUv).rgb;
  outColor = vec4(clamp(light, 0.0, 1.0), 1.0);
}`

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to allocate LaserDMX shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Unable to allocate LaserDMX shader program')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown program link error'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function enableInstancedAttribute(
  gl: WebGL2RenderingContext,
  location: number,
  size: number,
  strideBytes: number,
  offsetBytes: number,
): void {
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, strideBytes, offsetBytes)
  gl.vertexAttribDivisor(location, 1)
}

export class LaserDmxWebGLRuntime {
  static create(outputContext: CanvasRenderingContext2D): LaserDmxWebGLRuntime | null {
    if (typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    const lifecycle = new LaserDmxWebGLContextState()
    let owner: LaserDmxWebGLRuntime | null = null
    const result = ShaderWebGLRuntime.create(canvas, {
      resolutionScale: 1,
      restoreContext: true,
      ownership: {
        lifetime: 'live-reusable',
        role: 'laser-dmx-live-output',
        engine: 'laserDmx',
        expectedMaxActive: 1,
      },
      onContextLost: () => lifecycle.markLost(),
      onContextRestored: () => {
        lifecycle.markRestored()
        owner?.handleContextRestored()
      },
    })
    if (!result.runtime) return null
    try {
      owner = new LaserDmxWebGLRuntime(outputContext, canvas, result.runtime, lifecycle)
      return owner
    } catch {
      result.runtime.dispose('release-resources')
      return null
    }
  }

  private readonly gl: WebGL2RenderingContext
  private beamProgram: WebGLProgram | null = null
  private apertureProgram: WebGLProgram | null = null
  private compositeProgram: WebGLProgram | null = null
  private beamVertexArray: WebGLVertexArrayObject | null = null
  private apertureVertexArray: WebGLVertexArrayObject | null = null
  private compositeVertexArray: WebGLVertexArrayObject | null = null
  private beamQuadBuffer: WebGLBuffer | null = null
  private beamInstanceBuffer: WebGLBuffer | null = null
  private apertureQuadBuffer: WebGLBuffer | null = null
  private apertureInstanceBuffer: WebGLBuffer | null = null
  private lightFramebuffer: WebGLFramebuffer | null = null
  private lightTexture: WebGLTexture | null = null
  private lightTargetWidth = 0
  private lightTargetHeight = 0
  private floatLightTarget = false
  private beamViewportUniform: WebGLUniformLocation | null = null
  private beamCssToBackingUniform: WebGLUniformLocation | null = null
  private apertureViewportUniform: WebGLUniformLocation | null = null
  private apertureCssToBackingUniform: WebGLUniformLocation | null = null
  private compositeTextureUniform: WebGLUniformLocation | null = null
  private lastResolution: CanvasResolution | null = null
  private disposed = false

  private constructor(
    private readonly outputContext: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
    private readonly runtime: ShaderWebGLRuntime,
    private readonly lifecycle: LaserDmxWebGLContextState,
  ) {
    this.gl = runtime.gl
    this.createGpuResources()
  }

  get contextLost(): boolean {
    return this.lifecycle.contextLost || this.runtime.contextLost
  }

  render(frame: LaserDmxSceneFrame): LaserDmxWebGLRenderResult {
    if (this.disposed || this.lifecycle.disposed) return { ok: false, error: 'LaserDMX WebGL runtime is disposed' }
    if (this.contextLost) return { ok: false, error: 'LaserDMX WebGL context lost', recoverable: true }

    try {
      if (this.lifecycle.consumeRestore()) this.rebuildGpuResources()
      this.resize(frame)
      const frameState = this.runtime.beginFrame()
      const resolution = this.lastResolution
      if (!frameState || !resolution || !this.beamProgram || !this.apertureProgram || !this.compositeProgram) {
        return { ok: false, error: 'LaserDMX WebGL frame could not begin', recoverable: true }
      }
      this.ensureLightTarget(frameState.dims.W, frameState.dims.H)
      if (!this.lightFramebuffer || !this.lightTexture) {
        return { ok: false, error: 'LaserDMX light accumulation target unavailable', recoverable: true }
      }

      const gl = this.gl
      const viewport = {
        backingWidth: frameState.dims.W,
        backingHeight: frameState.dims.H,
        cssWidth: resolution.cssWidth,
        cssHeight: resolution.cssHeight,
      }
      const plan = buildLaserDmxWebGLBeamRenderPlan(frame, viewport)

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFramebuffer)
      gl.viewport(0, 0, frameState.dims.W, frameState.dims.H)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if (!frame.output.blackout) {
        this.drawBeamInstances(plan.beams, viewport)
        this.drawApertureInstances(plan.apertures, viewport)
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, frameState.dims.W, frameState.dims.H)
      gl.disable(gl.BLEND)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      this.drawComposite()
      this.runtime.endFrame()

      const outCanvas = this.outputContext.canvas
      this.outputContext.save()
      this.outputContext.setTransform(1, 0, 0, 1, 0, 0)
      this.outputContext.globalCompositeOperation = 'source-over'
      this.outputContext.globalAlpha = 1
      this.outputContext.clearRect(0, 0, outCanvas.width, outCanvas.height)
      this.outputContext.drawImage(this.canvas, 0, 0, outCanvas.width, outCanvas.height)
      this.outputContext.restore()
      return { ok: true, error: null }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        recoverable: true,
      }
    }
  }

  reset(): void {
    if (this.disposed || this.contextLost) return
    try {
      const gl = this.gl
      if (this.lightFramebuffer) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFramebuffer)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      this.runtime.clearViewport(0, 0, 0, 1)
      this.runtime.endFrame()
    } catch {
      // Best-effort reset. A context may be lost between lifecycle checks.
    }
  }

  dispose(mode: WebGLContextDisposalMode = 'release-resources'): void {
    if (this.disposed) return
    this.disposed = true
    this.lifecycle.dispose()
    this.disposeGpuResources()
    this.runtime.dispose(mode)
    this.lastResolution = null
  }

  handleContextRestored(): void {
    if (this.disposed) return
    // Resource recreation is deferred until the first restored render frame.
  }

  private resize(frame: LaserDmxSceneFrame): void {
    const outputCanvas = this.outputContext.canvas
    const dpr = Math.max(0.5, frame.quality.devicePixelRatio)
    const cssWidth = outputCanvas.clientWidth > 0 ? outputCanvas.clientWidth : outputCanvas.width / dpr
    const cssHeight = outputCanvas.clientHeight > 0 ? outputCanvas.clientHeight : outputCanvas.height / dpr
    const resolution = resolveCanvasResolution({
      cssWidth,
      cssHeight,
      devicePixelRatio: dpr,
      quality: frame.quality.qualityTier,
      resolutionScale: frame.quality.renderScale,
      previous: this.lastResolution,
    })
    if (!resolution.valid) return
    const changed = this.runtime.resize(resolution)
    this.lastResolution = resolution
    if (changed) this.disposeLightTarget()
  }

  private drawBeamInstances(beams: readonly LaserDmxWebGLBeamInstance[], viewport: {
    backingWidth: number
    backingHeight: number
    cssWidth: number
    cssHeight: number
  }): void {
    if (beams.length === 0 || !this.beamProgram || !this.beamVertexArray || !this.beamInstanceBuffer) return
    const data = new Float32Array(beams.length * 20)
    let offset = 0
    for (const beam of beams) {
      data.set([
        beam.origin.x, beam.origin.y, beam.origin.z,
        beam.target.x, beam.target.y, beam.target.z,
        beam.color.r, beam.color.g, beam.color.b, beam.color.a,
        beam.intensity, beam.coreIntensity, beam.whiteHotMix, beam.opacity,
        beam.bodyStartWidthCssPx, beam.bodyEndWidthCssPx,
        beam.envelopeStartWidthCssPx, beam.envelopeEndWidthCssPx,
        beam.envelopeAlpha, beam.phase,
      ], offset)
      offset += 20
    }
    const gl = this.gl
    gl.useProgram(this.beamProgram)
    gl.bindVertexArray(this.beamVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamInstanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.uniform2f(this.beamViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.beamCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, beams.length)
    gl.bindVertexArray(null)
  }

  private drawApertureInstances(apertures: readonly LaserDmxWebGLApertureInstance[], viewport: {
    backingWidth: number
    backingHeight: number
    cssWidth: number
    cssHeight: number
  }): void {
    if (apertures.length === 0 || !this.apertureProgram || !this.apertureVertexArray || !this.apertureInstanceBuffer) return
    const data = new Float32Array(apertures.length * 13)
    let offset = 0
    for (const aperture of apertures) {
      data.set([
        aperture.position.x, aperture.position.y, aperture.position.z,
        aperture.color.r, aperture.color.g, aperture.color.b, aperture.color.a,
        aperture.coreRadiusCssPx, aperture.ringRadiusCssPx, aperture.haloRadiusCssPx, aperture.intensity,
        aperture.glareDirection.x, aperture.glareDirection.y,
      ], offset)
      offset += 13
    }
    const gl = this.gl
    gl.useProgram(this.apertureProgram)
    gl.bindVertexArray(this.apertureVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureInstanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
    gl.uniform2f(this.apertureViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.apertureCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, apertures.length)
    gl.bindVertexArray(null)
  }

  private drawComposite(): void {
    if (!this.compositeProgram || !this.compositeVertexArray || !this.lightTexture) return
    const gl = this.gl
    gl.useProgram(this.compositeProgram)
    gl.bindVertexArray(this.compositeVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.lightTexture)
    gl.uniform1i(this.compositeTextureUniform, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
  }

  private rebuildGpuResources(): void {
    this.disposeGpuResources()
    this.createGpuResources()
  }

  private createGpuResources(): void {
    const gl = this.gl
    this.beamProgram = createProgram(gl, BEAM_VERTEX_SHADER, BEAM_FRAGMENT_SHADER)
    this.apertureProgram = createProgram(gl, APERTURE_VERTEX_SHADER, APERTURE_FRAGMENT_SHADER)
    this.compositeProgram = createProgram(gl, COMPOSITE_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER)
    this.beamVertexArray = gl.createVertexArray()
    this.apertureVertexArray = gl.createVertexArray()
    this.compositeVertexArray = gl.createVertexArray()
    this.beamQuadBuffer = gl.createBuffer()
    this.beamInstanceBuffer = gl.createBuffer()
    this.apertureQuadBuffer = gl.createBuffer()
    this.apertureInstanceBuffer = gl.createBuffer()
    if (
      !this.beamVertexArray || !this.apertureVertexArray || !this.compositeVertexArray
      || !this.beamQuadBuffer || !this.beamInstanceBuffer
      || !this.apertureQuadBuffer || !this.apertureInstanceBuffer
    ) {
      throw new Error('Unable to allocate LaserDMX WebGL buffers')
    }

    gl.bindVertexArray(this.beamVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamInstanceBuffer)
    const beamStride = 20 * Float32Array.BYTES_PER_ELEMENT
    enableInstancedAttribute(gl, 1, 3, beamStride, 0)
    enableInstancedAttribute(gl, 2, 3, beamStride, 3 * 4)
    enableInstancedAttribute(gl, 3, 4, beamStride, 6 * 4)
    enableInstancedAttribute(gl, 4, 4, beamStride, 10 * 4)
    enableInstancedAttribute(gl, 5, 4, beamStride, 14 * 4)
    enableInstancedAttribute(gl, 6, 2, beamStride, 18 * 4)
    gl.bindVertexArray(null)

    gl.bindVertexArray(this.apertureVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureInstanceBuffer)
    const apertureStride = 13 * Float32Array.BYTES_PER_ELEMENT
    enableInstancedAttribute(gl, 1, 3, apertureStride, 0)
    enableInstancedAttribute(gl, 2, 4, apertureStride, 3 * 4)
    enableInstancedAttribute(gl, 3, 4, apertureStride, 7 * 4)
    enableInstancedAttribute(gl, 4, 2, apertureStride, 11 * 4)
    gl.bindVertexArray(null)

    this.beamViewportUniform = gl.getUniformLocation(this.beamProgram, 'uViewportPx')
    this.beamCssToBackingUniform = gl.getUniformLocation(this.beamProgram, 'uCssToBacking')
    this.apertureViewportUniform = gl.getUniformLocation(this.apertureProgram, 'uViewportPx')
    this.apertureCssToBackingUniform = gl.getUniformLocation(this.apertureProgram, 'uCssToBacking')
    this.compositeTextureUniform = gl.getUniformLocation(this.compositeProgram, 'uLightTexture')
  }

  private ensureLightTarget(width: number, height: number): void {
    if (
      this.lightFramebuffer && this.lightTexture
      && this.lightTargetWidth === width && this.lightTargetHeight === height
    ) return
    this.disposeLightTarget()
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    const texture = gl.createTexture()
    if (!framebuffer || !texture) throw new Error('Unable to allocate LaserDMX light target')
    const canRenderFloat = gl.getExtension('EXT_color_buffer_float') != null

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      canRenderFloat ? gl.RGBA16F : gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      canRenderFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null,
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    let complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    if (!complete && canRenderFloat) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (!complete) {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      throw new Error('LaserDMX light accumulation framebuffer is incomplete')
    }
    this.lightFramebuffer = framebuffer
    this.lightTexture = texture
    this.lightTargetWidth = width
    this.lightTargetHeight = height
    this.floatLightTarget = canRenderFloat
  }

  private disposeLightTarget(): void {
    const gl = this.gl
    try { if (this.lightFramebuffer) gl.deleteFramebuffer(this.lightFramebuffer) } catch { /* Context may be lost. */ }
    try { if (this.lightTexture) gl.deleteTexture(this.lightTexture) } catch { /* Context may be lost. */ }
    this.lightFramebuffer = null
    this.lightTexture = null
    this.lightTargetWidth = 0
    this.lightTargetHeight = 0
    this.floatLightTarget = false
  }

  private disposeGpuResources(): void {
    const gl = this.gl
    this.disposeLightTarget()
    try { if (this.beamQuadBuffer) gl.deleteBuffer(this.beamQuadBuffer) } catch { /* Context may be lost. */ }
    try { if (this.beamInstanceBuffer) gl.deleteBuffer(this.beamInstanceBuffer) } catch { /* Context may be lost. */ }
    try { if (this.apertureQuadBuffer) gl.deleteBuffer(this.apertureQuadBuffer) } catch { /* Context may be lost. */ }
    try { if (this.apertureInstanceBuffer) gl.deleteBuffer(this.apertureInstanceBuffer) } catch { /* Context may be lost. */ }
    try { if (this.beamVertexArray) gl.deleteVertexArray(this.beamVertexArray) } catch { /* Context may be lost. */ }
    try { if (this.apertureVertexArray) gl.deleteVertexArray(this.apertureVertexArray) } catch { /* Context may be lost. */ }
    try { if (this.compositeVertexArray) gl.deleteVertexArray(this.compositeVertexArray) } catch { /* Context may be lost. */ }
    try { if (this.beamProgram) gl.deleteProgram(this.beamProgram) } catch { /* Context may be lost. */ }
    try { if (this.apertureProgram) gl.deleteProgram(this.apertureProgram) } catch { /* Context may be lost. */ }
    try { if (this.compositeProgram) gl.deleteProgram(this.compositeProgram) } catch { /* Context may be lost. */ }
    this.beamQuadBuffer = null
    this.beamInstanceBuffer = null
    this.apertureQuadBuffer = null
    this.apertureInstanceBuffer = null
    this.beamVertexArray = null
    this.apertureVertexArray = null
    this.compositeVertexArray = null
    this.beamProgram = null
    this.apertureProgram = null
    this.compositeProgram = null
    this.beamViewportUniform = null
    this.beamCssToBackingUniform = null
    this.apertureViewportUniform = null
    this.apertureCssToBackingUniform = null
    this.compositeTextureUniform = null
  }
}
