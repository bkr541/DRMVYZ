import { resolveCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import { ShaderWebGLRuntime } from '../../shaders/runtime/ShaderWebGLRuntime'
import type { WebGLContextDisposalMode } from '../../shaders/runtime/WebGLContextLifecycle'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'

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

const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec4 aColor;
uniform float uPointSize;
out vec4 vColor;
void main() {
  vec2 clip = vec2(aPosition.x * 2.0 - 1.0, 1.0 - aPosition.y * 2.0);
  gl_Position = vec4(clip, clamp(aPosition.z * 0.1, -0.9, 0.9), 1.0);
  gl_PointSize = uPointSize;
  vColor = aColor;
}`

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 vColor;
uniform bool uRoundPoint;
out vec4 outColor;
void main() {
  if (uRoundPoint) {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float radius = length(p);
    if (radius > 1.0) discard;
    float falloff = smoothstep(1.0, 0.08, radius);
    outColor = vec4(vColor.rgb * (1.0 + falloff * 0.8), vColor.a * falloff);
    return;
  }
  outColor = vColor;
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

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
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
  private program: WebGLProgram | null = null
  private vertexArray: WebGLVertexArrayObject | null = null
  private positionBuffer: WebGLBuffer | null = null
  private colorBuffer: WebGLBuffer | null = null
  private pointSizeUniform: WebGLUniformLocation | null = null
  private roundPointUniform: WebGLUniformLocation | null = null
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
      if (!frameState || !this.program || !this.vertexArray) {
        return { ok: false, error: 'LaserDMX WebGL frame could not begin', recoverable: true }
      }

      const gl = this.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, frameState.dims.W, frameState.dims.H)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if (!frame.output.blackout) {
        gl.useProgram(this.program)
        gl.bindVertexArray(this.vertexArray)
        this.drawBeams(frame)
        this.drawEmitters(frame)
        gl.bindVertexArray(null)
      }
      gl.disable(gl.BLEND)
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
    // ShaderWebGLRuntime invokes this after the browser restores the same
    // context. Resource recreation is deferred until the next render frame.
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
    this.runtime.resize(resolution)
    this.lastResolution = resolution
  }

  private drawBeams(frame: LaserDmxSceneFrame): void {
    const active = frame.beams.filter(beam => beam.enabled && beam.intensity > 0.001)
    if (active.length === 0) return
    const positions = new Float32Array(active.length * 2 * 3)
    const colors = new Float32Array(active.length * 2 * 4)
    let p = 0
    let c = 0
    for (const beam of active) {
      const intensity = Math.max(0, Math.min(2, beam.intensity * (0.55 + frame.output.globalGlow * 0.75)))
      positions.set([beam.origin.x, beam.origin.y, beam.origin.z, beam.target.x, beam.target.y, beam.target.z], p)
      p += 6
      const color = [beam.color.r * intensity, beam.color.g * intensity, beam.color.b * intensity, Math.min(1, 0.35 + intensity * 0.65)]
      colors.set(color, c)
      colors.set(color, c + 4)
      c += 8
    }
    this.uploadAndDraw(positions, colors, this.gl.LINES, active.length * 2, 1, false)
  }

  private drawEmitters(frame: LaserDmxSceneFrame): void {
    const active = frame.emitters.filter(emitter => emitter.intensity > 0.001)
    if (active.length === 0) return
    const positions = new Float32Array(active.length * 3)
    const colors = new Float32Array(active.length * 4)
    let p = 0
    let c = 0
    for (const emitter of active) {
      const intensity = Math.max(0, Math.min(2.5, emitter.intensity * 1.4))
      positions.set([emitter.position.x, emitter.position.y, emitter.position.z], p)
      p += 3
      colors.set([
        Math.min(2.5, emitter.color.r * intensity + intensity * 0.35),
        Math.min(2.5, emitter.color.g * intensity + intensity * 0.35),
        Math.min(2.5, emitter.color.b * intensity + intensity * 0.35),
        Math.min(1, 0.45 + intensity * 0.35),
      ], c)
      c += 4
    }
    const size = Math.max(3, 7 * frame.quality.devicePixelRatio)
    this.uploadAndDraw(positions, colors, this.gl.POINTS, active.length, size, true)
  }

  private uploadAndDraw(
    positions: Float32Array,
    colors: Float32Array,
    mode: number,
    count: number,
    pointSize: number,
    roundPoint: boolean,
  ): void {
    const gl = this.gl
    if (!this.positionBuffer || !this.colorBuffer) return
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW)
    if (this.pointSizeUniform) gl.uniform1f(this.pointSizeUniform, pointSize)
    if (this.roundPointUniform) gl.uniform1i(this.roundPointUniform, roundPoint ? 1 : 0)
    gl.drawArrays(mode, 0, count)
  }

  private rebuildGpuResources(): void {
    this.disposeGpuResources()
    this.createGpuResources()
  }

  private createGpuResources(): void {
    const gl = this.gl
    this.program = createProgram(gl)
    this.vertexArray = gl.createVertexArray()
    this.positionBuffer = gl.createBuffer()
    this.colorBuffer = gl.createBuffer()
    if (!this.vertexArray || !this.positionBuffer || !this.colorBuffer) {
      throw new Error('Unable to allocate LaserDMX WebGL buffers')
    }
    gl.bindVertexArray(this.vertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.pointSizeUniform = gl.getUniformLocation(this.program, 'uPointSize')
    this.roundPointUniform = gl.getUniformLocation(this.program, 'uRoundPoint')
  }

  private disposeGpuResources(): void {
    const gl = this.gl
    try { if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer) } catch { /* Context may be lost. */ }
    try { if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer) } catch { /* Context may be lost. */ }
    try { if (this.vertexArray) gl.deleteVertexArray(this.vertexArray) } catch { /* Context may be lost. */ }
    try { if (this.program) gl.deleteProgram(this.program) } catch { /* Context may be lost. */ }
    this.positionBuffer = null
    this.colorBuffer = null
    this.vertexArray = null
    this.program = null
    this.pointSizeUniform = null
    this.roundPointUniform = null
  }
}
