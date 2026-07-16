import type { ReactPreset } from '../../ReactTypes'
import type {
  PixGridRendererDiagnostics,
  PixGridState,
} from '../../pixGrid/PixGridTypes'
import { normalizePixGridState } from '../../pixGrid/PixGridValidation'
import type { PixGridBaselineRenderFrame } from './PixGridBaselineRenderer'
import {
  PIX_GRID_FULLSCREEN_VERTEX_SHADER,
  PIX_GRID_LOGICAL_FRAGMENT_SHADER,
  PIX_GRID_PRESENTATION_FRAGMENT_SHADER,
} from './PixGridGpuShaderSources'

export interface PixGridGpuRendererCallbacks {
  onContextLost?: () => void
  onContextRestored?: () => void
  onContextRestoreFailed?: (reason: string) => void
}

export type PixGridGpuRendererCreateResult =
  | { renderer: PixGridGpuRenderer; error: null }
  | { renderer: null; error: string }

interface PixGridGpuRenderInput {
  frame: PixGridBaselineRenderFrame
  preset: ReactPreset
  state: PixGridState
  presentationWidth: number
  presentationHeight: number
  blackout?: boolean
}

interface SavedWebGLState {
  framebuffer: WebGLFramebuffer | null
  program: WebGLProgram | null
  vertexArray: WebGLVertexArrayObject | null
  viewport: Int32Array
  activeTexture: number
  texture0: WebGLTexture | null
  texture1: WebGLTexture | null
  blend: boolean
  depthTest: boolean
  cullFace: boolean
  scissorTest: boolean
  unpackAlignment: number
  clearColor: Float32Array
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function hexToUnitRgb(value: string): readonly [number, number, number] {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return [
    Number.parseInt(safe.slice(1, 3), 16) / 255,
    Number.parseInt(safe.slice(3, 5), 16) / 255,
    Number.parseInt(safe.slice(5, 7), 16) / 255,
  ]
}

function resolveBackgroundColor(preset: ReactPreset, state: PixGridState): readonly [number, number, number] {
  const source = state.backgroundMode === 'black'
    ? '#000000'
    : state.backgroundMode === 'custom'
      ? state.backgroundColor
      : preset.palette.background
  const rgb = hexToUnitRgb(source)
  const brightness = state.backgroundBrightness
  return [rgb[0] * brightness, rgb[1] * brightness, rgb[2] * brightness]
}

function resolvePatternIndex(preset: ReactPreset): number {
  if (preset.pixGridSettings?.pattern === 'geometricReactor') return 1
  if (preset.pixGridSettings?.pattern === 'pixelParade') return 2
  return 0
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string, label: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error(`Unable to create ${label} shader`)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown compiler error'
    gl.deleteShader(shader)
    throw new Error(`${label} shader compilation failed: ${log}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
  label: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, PIX_GRID_FULLSCREEN_VERTEX_SHADER, `${label} vertex`)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label} fragment`)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error(`Unable to create ${label} program`)
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'Unknown linker error'
    gl.deleteProgram(program)
    throw new Error(`${label} program linking failed: ${log}`)
  }
  return program
}

function requireUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) throw new Error(`PixGrid shader uniform ${name} is unavailable`)
  return location
}

export class PixGridGpuRenderer {
  static create(
    canvas: HTMLCanvasElement,
    callbacks: PixGridGpuRendererCallbacks = {},
  ): PixGridGpuRendererCreateResult {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null
    if (!gl) return { renderer: null, error: 'WebGL2 is unavailable; using the Canvas2D PixGrid fallback.' }

    let renderer: PixGridGpuRenderer | null = null
    try {
      renderer = new PixGridGpuRenderer(canvas, gl, callbacks)
      return { renderer, error: null }
    } catch (error) {
      renderer?.dispose()
      return {
        renderer: null,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly callbacks: PixGridGpuRendererCallbacks
  private logicalProgram: WebGLProgram | null = null
  private presentationProgram: WebGLProgram | null = null
  private vertexArray: WebGLVertexArrayObject | null = null
  private logicalFramebuffer: WebGLFramebuffer | null = null
  private logicalTexture: WebGLTexture | null = null
  private overrideTexture: WebGLTexture | null = null
  private logicalUniforms = new Map<string, WebGLUniformLocation>()
  private presentationUniforms = new Map<string, WebGLUniformLocation>()
  private logicalWidth = 0
  private logicalHeight = 0
  private logicalAllocationCount = 0
  private overrideSignature = ''
  private contextState: PixGridRendererDiagnostics['contextState'] = 'ready'
  private disposed = false

  private readonly contextLostHandler = (event: Event) => {
    if (this.disposed) return
    event.preventDefault()
    this.contextState = 'lost'
    this.callbacks.onContextLost?.()
  }

  private readonly contextRestoredHandler = () => {
    if (this.disposed) return
    this.contextState = 'restoring'
    try {
      this.releaseResourceReferences(false)
      this.initializeResources()
      this.contextState = 'ready'
      this.callbacks.onContextRestored?.()
    } catch (error) {
      this.contextState = 'unavailable'
      this.callbacks.onContextRestoreFailed?.(error instanceof Error ? error.message : String(error))
    }
  }

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    callbacks: PixGridGpuRendererCallbacks,
  ) {
    this.canvas = canvas
    this.gl = gl
    this.callbacks = callbacks
    canvas.addEventListener('webglcontextlost', this.contextLostHandler)
    canvas.addEventListener('webglcontextrestored', this.contextRestoredHandler)
    try {
      this.initializeResources()
    } catch (error) {
      canvas.removeEventListener('webglcontextlost', this.contextLostHandler)
      canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler)
      this.releaseResourceReferences(true)
      this.disposed = true
      throw error
    }
  }

  get isReady(): boolean {
    return !this.disposed && this.contextState === 'ready'
  }

  get diagnostics(): PixGridRendererDiagnostics {
    return {
      path: 'webgl2',
      logicalWidth: this.logicalWidth,
      logicalHeight: this.logicalHeight,
      presentationWidth: this.canvas.width,
      presentationHeight: this.canvas.height,
      fps: 0,
      logicalFramebufferAllocated: this.logicalFramebuffer != null && this.logicalTexture != null,
      logicalAllocationCount: this.logicalAllocationCount,
      contextState: this.contextState,
      fallbackReason: null,
      approximateGpuResourceCount: this.approximateResourceCount(),
    }
  }

  render(input: PixGridGpuRenderInput): boolean {
    if (!this.isReady) return false
    const state = normalizePixGridState(input.state)
    const width = Math.max(1, Math.floor(input.presentationWidth))
    const height = Math.max(1, Math.floor(input.presentationHeight))
    if (width !== this.canvas.width || height !== this.canvas.height) return false

    const gl = this.gl
    const saved = this.captureState()
    try {
      this.ensureLogicalTarget(state.matrixWidth, state.matrixHeight)
      this.updateOverrideTexture(state)
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)
      gl.disable(gl.CULL_FACE)
      gl.disable(gl.SCISSOR_TEST)
      gl.bindVertexArray(this.vertexArray)

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.logicalFramebuffer)
      gl.viewport(0, 0, state.matrixWidth, state.matrixHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(this.logicalProgram)
      this.applyLogicalUniforms(input, state)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.overrideTexture)
      gl.uniform1i(this.logicalUniform('uOverrideTexture'), 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, width, height)
      gl.useProgram(this.presentationProgram)
      this.applyPresentationUniforms(input, state)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.logicalTexture)
      gl.uniform1i(this.presentationUniform('uLogicalTexture'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.flush()
      return true
    } finally {
      this.restoreState(saved)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.contextLostHandler)
    this.canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler)
    this.releaseResourceReferences(this.contextState !== 'lost')
    this.contextState = 'unavailable'
  }

  private initializeResources(): void {
    this.logicalProgram = createProgram(this.gl, PIX_GRID_LOGICAL_FRAGMENT_SHADER, 'PixGrid logical composition')
    this.presentationProgram = createProgram(this.gl, PIX_GRID_PRESENTATION_FRAGMENT_SHADER, 'PixGrid LED presentation')
    this.vertexArray = this.gl.createVertexArray()
    this.logicalFramebuffer = this.gl.createFramebuffer()
    this.logicalTexture = this.gl.createTexture()
    this.overrideTexture = this.gl.createTexture()
    if (!this.vertexArray || !this.logicalFramebuffer || !this.logicalTexture || !this.overrideTexture) {
      throw new Error('Unable to allocate PixGrid GPU resources')
    }

    this.logicalUniforms = new Map([
      'uLogicalSize', 'uPattern', 'uPrimary', 'uSecondary', 'uAccent', 'uTime', 'uBass', 'uMid',
      'uHigh', 'uBeat', 'uBeatPhase', 'uMotion', 'uBassReactivity', 'uBlackout', 'uOverrideTexture',
    ].map(name => [name, requireUniform(this.gl, this.logicalProgram!, name)]))
    this.presentationUniforms = new Map([
      'uLogicalTexture', 'uLogicalSize', 'uPresentationSize', 'uBackground', 'uGap', 'uRoundness',
      'uCellBrightness', 'uGlow', 'uDiffusion', 'uGlobalIntensity', 'uRgbSubpixel', 'uShowBounds',
    ].map(name => [name, requireUniform(this.gl, this.presentationProgram!, name)]))

    this.logicalWidth = 0
    this.logicalHeight = 0
    this.overrideSignature = ''
  }

  private ensureLogicalTarget(width: number, height: number): void {
    if (width === this.logicalWidth && height === this.logicalHeight) return
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.logicalTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.overrideTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.logicalFramebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.logicalTexture, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      throw new Error(`PixGrid logical framebuffer is incomplete at ${width} × ${height}`)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.logicalWidth = width
    this.logicalHeight = height
    this.logicalAllocationCount += 1
    this.overrideSignature = ''
  }

  private updateOverrideTexture(state: PixGridState): void {
    const signature = `${state.matrixWidth}x${state.matrixHeight}:${JSON.stringify(state.pixelOverrides)}`
    if (signature === this.overrideSignature) return
    const pixels = new Uint8Array(state.matrixWidth * state.matrixHeight * 4)
    for (const [x, y, color, brightness] of state.pixelOverrides) {
      const offset = (y * state.matrixWidth + x) * 4
      const rgb = hexToUnitRgb(color)
      pixels[offset] = Math.round(rgb[0] * clamp01(brightness) * 255)
      pixels[offset + 1] = Math.round(rgb[1] * clamp01(brightness) * 255)
      pixels[offset + 2] = Math.round(rgb[2] * clamp01(brightness) * 255)
      pixels[offset + 3] = 255
    }
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.overrideTexture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      state.matrixWidth,
      state.matrixHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    )
    this.overrideSignature = signature
  }

  private applyLogicalUniforms(input: PixGridGpuRenderInput, state: PixGridState): void {
    const gl = this.gl
    const frame = input.frame
    const primary = hexToUnitRgb(input.preset.palette.primary)
    const secondary = hexToUnitRgb(input.preset.palette.secondary)
    const accent = hexToUnitRgb(input.preset.palette.accent)
    gl.uniform2f(this.logicalUniform('uLogicalSize'), state.matrixWidth, state.matrixHeight)
    gl.uniform1i(this.logicalUniform('uPattern'), resolvePatternIndex(input.preset))
    gl.uniform3f(this.logicalUniform('uPrimary'), primary[0], primary[1], primary[2])
    gl.uniform3f(this.logicalUniform('uSecondary'), secondary[0], secondary[1], secondary[2])
    gl.uniform3f(this.logicalUniform('uAccent'), accent[0], accent[1], accent[2])
    gl.uniform1f(this.logicalUniform('uTime'), frame.audioTime)
    gl.uniform1f(this.logicalUniform('uBass'), frame.bass)
    gl.uniform1f(this.logicalUniform('uMid'), frame.mid)
    gl.uniform1f(this.logicalUniform('uHigh'), frame.high)
    gl.uniform1f(this.logicalUniform('uBeat'), frame.beatHit ? 1 : Math.max(0, 1 - frame.beatPhase * 3.2))
    gl.uniform1f(this.logicalUniform('uBeatPhase'), frame.beatPhase)
    gl.uniform1f(this.logicalUniform('uMotion'), frame.motion)
    gl.uniform1f(this.logicalUniform('uBassReactivity'), frame.bassReactivity)
    gl.uniform1i(this.logicalUniform('uBlackout'), input.blackout ? 1 : 0)
  }

  private applyPresentationUniforms(input: PixGridGpuRenderInput, state: PixGridState): void {
    const gl = this.gl
    const background = resolveBackgroundColor(input.preset, state)
    const effectiveGlow = clamp01((input.frame.glow + state.glowAmount) * 0.5)
    const effectiveIntensity = clamp01(input.frame.intensity) * state.globalIntensity
    gl.uniform2f(this.presentationUniform('uLogicalSize'), state.matrixWidth, state.matrixHeight)
    gl.uniform2f(this.presentationUniform('uPresentationSize'), input.presentationWidth, input.presentationHeight)
    gl.uniform3f(this.presentationUniform('uBackground'), background[0], background[1], background[2])
    gl.uniform1f(this.presentationUniform('uGap'), state.cellGap)
    gl.uniform1f(this.presentationUniform('uRoundness'), state.cellRoundness)
    gl.uniform1f(this.presentationUniform('uCellBrightness'), state.cellBrightness)
    gl.uniform1f(this.presentationUniform('uGlow'), effectiveGlow)
    gl.uniform1f(this.presentationUniform('uDiffusion'), state.diffusion)
    gl.uniform1f(this.presentationUniform('uGlobalIntensity'), effectiveIntensity)
    gl.uniform1i(this.presentationUniform('uRgbSubpixel'), state.rgbSubpixelMode ? 1 : 0)
    gl.uniform1i(this.presentationUniform('uShowBounds'), state.diagnostics.showMatrixBounds ? 1 : 0)
  }

  private logicalUniform(name: string): WebGLUniformLocation {
    const uniform = this.logicalUniforms.get(name)
    if (!uniform) throw new Error(`Missing PixGrid logical uniform ${name}`)
    return uniform
  }

  private presentationUniform(name: string): WebGLUniformLocation {
    const uniform = this.presentationUniforms.get(name)
    if (!uniform) throw new Error(`Missing PixGrid presentation uniform ${name}`)
    return uniform
  }

  private captureState(): SavedWebGLState {
    const gl = this.gl
    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number
    gl.activeTexture(gl.TEXTURE0)
    const texture0 = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
    gl.activeTexture(gl.TEXTURE1)
    const texture1 = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
    gl.activeTexture(activeTexture)
    return {
      framebuffer: gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null,
      program: gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null,
      vertexArray: gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null,
      viewport: new Int32Array(gl.getParameter(gl.VIEWPORT) as Int32Array),
      activeTexture,
      texture0,
      texture1,
      blend: gl.isEnabled(gl.BLEND),
      depthTest: gl.isEnabled(gl.DEPTH_TEST),
      cullFace: gl.isEnabled(gl.CULL_FACE),
      scissorTest: gl.isEnabled(gl.SCISSOR_TEST),
      unpackAlignment: gl.getParameter(gl.UNPACK_ALIGNMENT) as number,
      clearColor: new Float32Array(gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array),
    }
  }

  private restoreState(state: SavedWebGLState): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.framebuffer)
    gl.useProgram(state.program)
    gl.bindVertexArray(state.vertexArray)
    gl.viewport(state.viewport[0], state.viewport[1], state.viewport[2], state.viewport[3])
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, state.texture0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, state.texture1)
    gl.activeTexture(state.activeTexture)
    this.restoreCapability(gl.BLEND, state.blend)
    this.restoreCapability(gl.DEPTH_TEST, state.depthTest)
    this.restoreCapability(gl.CULL_FACE, state.cullFace)
    this.restoreCapability(gl.SCISSOR_TEST, state.scissorTest)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, state.unpackAlignment)
    gl.clearColor(state.clearColor[0], state.clearColor[1], state.clearColor[2], state.clearColor[3])
  }

  private restoreCapability(capability: number, enabled: boolean): void {
    if (enabled) this.gl.enable(capability)
    else this.gl.disable(capability)
  }

  private approximateResourceCount(): number {
    return [
      this.logicalProgram,
      this.presentationProgram,
      this.vertexArray,
      this.logicalFramebuffer,
      this.logicalTexture,
      this.overrideTexture,
    ].filter(Boolean).length
  }

  private releaseResourceReferences(deleteResources: boolean): void {
    if (deleteResources) {
      if (this.logicalProgram) this.gl.deleteProgram(this.logicalProgram)
      if (this.presentationProgram) this.gl.deleteProgram(this.presentationProgram)
      if (this.vertexArray) this.gl.deleteVertexArray(this.vertexArray)
      if (this.logicalFramebuffer) this.gl.deleteFramebuffer(this.logicalFramebuffer)
      if (this.logicalTexture) this.gl.deleteTexture(this.logicalTexture)
      if (this.overrideTexture) this.gl.deleteTexture(this.overrideTexture)
    }
    this.logicalProgram = null
    this.presentationProgram = null
    this.vertexArray = null
    this.logicalFramebuffer = null
    this.logicalTexture = null
    this.overrideTexture = null
    this.logicalUniforms.clear()
    this.presentationUniforms.clear()
    this.logicalWidth = 0
    this.logicalHeight = 0
    this.overrideSignature = ''
  }
}
