import { resolveCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import { ShaderWebGLRuntime } from '../../shaders/runtime/ShaderWebGLRuntime'
import type { WebGLContextDisposalMode } from '../../shaders/runtime/WebGLContextLifecycle'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import {
  buildLaserDmxWebGLAtmosphereRenderPlan,
  type LaserDmxWebGLAtmosphereRenderPlan,
  type LaserDmxWebGLAtmosphereSourceInstance,
} from './LaserDmxWebGLAtmospherePlan'
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

  get contextLost(): boolean {
    return this._contextLost
  }
  get restorePending(): boolean {
    return this._restorePending
  }
  get disposed(): boolean {
    return this._disposed
  }
  get generation(): number {
    return this._generation
  }

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

/** Small testable ledger mirroring the runtime's reusable GPU ownership. */
export class LaserDmxWebGLResourceLedger {
  private readonly active = new Set<string>()
  private _disposed = false

  get activeCount(): number {
    return this.active.size
  }
  get disposed(): boolean {
    return this._disposed
  }

  allocate(id: string): void {
    if (this._disposed) return
    this.active.add(id)
  }

  release(id: string): void {
    this.active.delete(id)
  }

  dispose(): void {
    this.active.clear()
    this._disposed = true
  }
}

import {
  APERTURE_FRAGMENT_SHADER,
  APERTURE_VERTEX_SHADER,
  ATMOSPHERE_FRAGMENT_SHADER,
  ATMOSPHERE_VERTEX_SHADER,
  BEAM_FRAGMENT_SHADER,
  BEAM_VERTEX_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  FOREGROUND_FRAGMENT_SHADER,
  FULLSCREEN_VERTEX_SHADER,
} from './LaserDmxWebGLShaderSources'
export { getLaserDmxWebGLShaderProgramSources } from './LaserDmxWebGLShaderSources'

interface RenderTarget {
  framebuffer: WebGLFramebuffer | null
  texture: WebGLTexture | null
  width: number
  height: number
  float: boolean
  filter: number
}

const FRONT_DEPTH_SPLIT = 0.18
const MAX_HAZE_SOURCES = 8

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

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
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

function emptyTarget(filter: number): RenderTarget {
  return {
    framebuffer: null,
    texture: null,
    width: 0,
    height: 0,
    float: false,
    filter,
  }
}

function ensureFloatCapacity(
  current: Float32Array<ArrayBuffer>,
  required: number,
): Float32Array<ArrayBuffer> {
  if (current.length >= required) return current
  let capacity = Math.max(64, current.length || 64)
  while (capacity < required) capacity *= 2
  return new Float32Array(capacity)
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
  private readonly ledger = new LaserDmxWebGLResourceLedger()
  private beamProgram: WebGLProgram | null = null
  private apertureProgram: WebGLProgram | null = null
  private atmosphereProgram: WebGLProgram | null = null
  private foregroundProgram: WebGLProgram | null = null
  private compositeProgram: WebGLProgram | null = null
  private beamVertexArray: WebGLVertexArrayObject | null = null
  private apertureVertexArray: WebGLVertexArrayObject | null = null
  private atmosphereVertexArray: WebGLVertexArrayObject | null = null
  private fullscreenVertexArray: WebGLVertexArrayObject | null = null
  private beamQuadBuffer: WebGLBuffer | null = null
  private beamInstanceBuffer: WebGLBuffer | null = null
  private apertureQuadBuffer: WebGLBuffer | null = null
  private apertureInstanceBuffer: WebGLBuffer | null = null
  private atmosphereQuadBuffer: WebGLBuffer | null = null
  private atmosphereInstanceBuffer: WebGLBuffer | null = null
  private rearTarget: RenderTarget
  private frontTarget: RenderTarget
  private atmosphereTarget: RenderTarget
  private beamViewportUniform: WebGLUniformLocation | null = null
  private beamCssToBackingUniform: WebGLUniformLocation | null = null
  private apertureViewportUniform: WebGLUniformLocation | null = null
  private apertureCssToBackingUniform: WebGLUniformLocation | null = null
  private atmosphereViewportUniform: WebGLUniformLocation | null = null
  private atmosphereCssToBackingUniform: WebGLUniformLocation | null = null
  private atmosphereUniform: WebGLUniformLocation | null = null
  private atmosphereDriftUniform: WebGLUniformLocation | null = null
  private atmosphereQualityUniform: WebGLUniformLocation | null = null
  private atmosphereTimeSeedUniform: WebGLUniformLocation | null = null
  private atmosphereSourceCountUniform: WebGLUniformLocation | null = null
  private atmosphereSourcePositionUniform: WebGLUniformLocation | null = null
  private atmosphereSourceDirectionUniform: WebGLUniformLocation | null = null
  private atmosphereSourceColorUniform: WebGLUniformLocation | null = null
  private foregroundAtmosphereUniform: WebGLUniformLocation | null = null
  private foregroundDriftUniform: WebGLUniformLocation | null = null
  private foregroundTimeSeedUniform: WebGLUniformLocation | null = null
  private foregroundStrengthUniform: WebGLUniformLocation | null = null
  private foregroundNoiseOctavesUniform: WebGLUniformLocation | null = null
  private foregroundSourceCountUniform: WebGLUniformLocation | null = null
  private foregroundSourcePositionUniform: WebGLUniformLocation | null = null
  private foregroundSourceDirectionUniform: WebGLUniformLocation | null = null
  private foregroundSourceColorUniform: WebGLUniformLocation | null = null
  private compositeRearUniform: WebGLUniformLocation | null = null
  private compositeFrontUniform: WebGLUniformLocation | null = null
  private compositeAtmosphereUniform: WebGLUniformLocation | null = null
  private beamInstanceData = new Float32Array(0)
  private apertureInstanceData = new Float32Array(0)
  private atmosphereInstanceData = new Float32Array(0)
  private readonly rearBeamInstances: LaserDmxWebGLBeamInstance[] = []
  private readonly frontBeamInstances: LaserDmxWebGLBeamInstance[] = []
  private readonly rearApertureInstances: LaserDmxWebGLApertureInstance[] = []
  private readonly frontApertureInstances: LaserDmxWebGLApertureInstance[] = []
  private sourcePositionData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private sourceDirectionData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private sourceColorData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private lastResolution: CanvasResolution | null = null
  private disposed = false

  private constructor(
    private readonly outputContext: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
    private readonly runtime: ShaderWebGLRuntime,
    private readonly lifecycle: LaserDmxWebGLContextState,
  ) {
    this.gl = runtime.gl
    this.rearTarget = emptyTarget(this.gl.NEAREST)
    this.frontTarget = emptyTarget(this.gl.NEAREST)
    this.atmosphereTarget = emptyTarget(this.gl.LINEAR)
    this.createGpuResources()
  }

  get contextLost(): boolean {
    return this.lifecycle.contextLost || this.runtime.contextLost
  }

  render(frame: LaserDmxSceneFrame): LaserDmxWebGLRenderResult {
    if (this.disposed || this.lifecycle.disposed)
      return { ok: false, error: 'LaserDMX WebGL runtime is disposed' }
    if (this.contextLost)
      return {
        ok: false,
        error: 'LaserDMX WebGL context lost',
        recoverable: true,
      }

    try {
      if (this.lifecycle.consumeRestore()) this.rebuildGpuResources()
      this.resize(frame)
      const frameState = this.runtime.beginFrame()
      const resolution = this.lastResolution
      if (!frameState || !resolution || !this.resourcesReady()) {
        return {
          ok: false,
          error: 'LaserDMX WebGL frame could not begin',
          recoverable: true,
        }
      }

      const viewport = {
        backingWidth: frameState.dims.W,
        backingHeight: frameState.dims.H,
        cssWidth: resolution.cssWidth,
        cssHeight: resolution.cssHeight,
      }
      const beamPlan = buildLaserDmxWebGLBeamRenderPlan(frame, viewport)
      const atmospherePlan = buildLaserDmxWebGLAtmosphereRenderPlan(frame, viewport)
      this.ensureRenderTarget(this.rearTarget, frameState.dims.W, frameState.dims.H, 'rear-light')
      this.ensureRenderTarget(this.frontTarget, frameState.dims.W, frameState.dims.H, 'front-light')
      this.ensureRenderTarget(
        this.atmosphereTarget,
        atmospherePlan.targetWidth,
        atmospherePlan.targetHeight,
        'atmosphere',
      )

      if (!frame.output.blackout) {
        this.partitionSharpInstances(beamPlan.beams, beamPlan.apertures)
        this.renderAtmosphere(atmospherePlan, beamPlan.apertures, viewport)
        this.renderSharpTarget(
          this.rearTarget,
          this.rearBeamInstances,
          this.rearApertureInstances,
          viewport,
        )
        this.renderSharpTarget(
          this.frontTarget,
          this.frontBeamInstances,
          this.frontApertureInstances,
          viewport,
        )
      } else {
        this.clearTarget(this.rearTarget)
        this.clearTarget(this.frontTarget)
        this.clearTarget(this.atmosphereTarget)
      }

      const gl = this.gl
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, frameState.dims.W, frameState.dims.H)
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)
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
      this.clearTarget(this.rearTarget)
      this.clearTarget(this.frontTarget)
      this.clearTarget(this.atmosphereTarget)
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
      this.runtime.clearViewport(0, 0, 0, 1)
      this.runtime.endFrame()
    } catch {
      // Best effort. A context can be lost between lifecycle checks.
    }
  }

  dispose(mode: WebGLContextDisposalMode = 'release-resources'): void {
    if (this.disposed) return
    this.disposed = true
    this.lifecycle.dispose()
    this.disposeGpuResources()
    this.ledger.dispose()
    this.runtime.dispose(mode)
    this.lastResolution = null
  }

  handleContextRestored(): void {
    if (this.disposed) return
    // Resource recreation is deferred until the first restored render frame.
  }

  private resourcesReady(): boolean {
    return Boolean(
      this.beamProgram &&
      this.apertureProgram &&
      this.atmosphereProgram &&
      this.foregroundProgram &&
      this.compositeProgram,
    )
  }

  private resize(frame: LaserDmxSceneFrame): void {
    const outputCanvas = this.outputContext.canvas
    const dpr = Math.max(0.5, frame.quality.devicePixelRatio)
    const cssWidth =
      outputCanvas.clientWidth > 0 ? outputCanvas.clientWidth : outputCanvas.width / dpr
    const cssHeight =
      outputCanvas.clientHeight > 0 ? outputCanvas.clientHeight : outputCanvas.height / dpr
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
    if (changed) {
      this.disposeRenderTarget(this.rearTarget, 'rear-light')
      this.disposeRenderTarget(this.frontTarget, 'front-light')
      // Atmosphere target also depends on the independent quality scale.
      this.disposeRenderTarget(this.atmosphereTarget, 'atmosphere')
    }
  }

  private partitionSharpInstances(
    beams: readonly LaserDmxWebGLBeamInstance[],
    apertures: readonly LaserDmxWebGLApertureInstance[],
  ): void {
    this.rearBeamInstances.length = 0
    this.frontBeamInstances.length = 0
    this.rearApertureInstances.length = 0
    this.frontApertureInstances.length = 0
    for (const beam of beams) {
      const target =
        beam.sortDepth > FRONT_DEPTH_SPLIT ? this.frontBeamInstances : this.rearBeamInstances
      target.push(beam)
    }
    for (const aperture of apertures) {
      const target =
        aperture.sortDepth > FRONT_DEPTH_SPLIT
          ? this.frontApertureInstances
          : this.rearApertureInstances
      target.push(aperture)
    }
  }

  private renderSharpTarget(
    target: RenderTarget,
    beams: readonly LaserDmxWebGLBeamInstance[],
    apertures: readonly LaserDmxWebGLApertureInstance[],
    viewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (!target.framebuffer) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.drawBeamInstances(beams, viewport)
    this.drawApertureInstances(apertures, viewport)
  }

  private renderAtmosphere(
    plan: LaserDmxWebGLAtmosphereRenderPlan,
    apertures: readonly LaserDmxWebGLApertureInstance[],
    fullViewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (!this.atmosphereTarget.framebuffer) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.atmosphereTarget.framebuffer)
    gl.viewport(0, 0, this.atmosphereTarget.width, this.atmosphereTarget.height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (!plan.enabled) return

    const atmosphereViewport = {
      backingWidth: this.atmosphereTarget.width,
      backingHeight: this.atmosphereTarget.height,
      cssWidth: fullViewport.cssWidth,
      cssHeight: fullViewport.cssHeight,
    }
    this.drawAtmosphereInstances(plan, atmosphereViewport)
    // Projector sources also illuminate nearby air, independent from the narrow
    // sharp aperture pass rendered later at full resolution.
    this.drawApertureInstances(apertures, atmosphereViewport)
    this.drawForegroundVeil(plan)
  }

  private drawBeamInstances(
    beams: readonly LaserDmxWebGLBeamInstance[],
    viewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (
      beams.length === 0 ||
      !this.beamProgram ||
      !this.beamVertexArray ||
      !this.beamInstanceBuffer
    )
      return
    const required = beams.length * 20
    this.beamInstanceData = ensureFloatCapacity(this.beamInstanceData, required)
    let offset = 0
    for (const beam of beams) {
      this.beamInstanceData.set(
        [
          beam.origin.x,
          beam.origin.y,
          beam.origin.z,
          beam.target.x,
          beam.target.y,
          beam.target.z,
          beam.color.r,
          beam.color.g,
          beam.color.b,
          beam.color.a,
          beam.intensity,
          beam.coreIntensity,
          beam.whiteHotMix,
          beam.opacity,
          beam.bodyStartWidthCssPx,
          beam.bodyEndWidthCssPx,
          beam.envelopeStartWidthCssPx,
          beam.envelopeEndWidthCssPx,
          beam.envelopeAlpha,
          beam.phase,
        ],
        offset,
      )
      offset += 20
    }
    const gl = this.gl
    gl.useProgram(this.beamProgram)
    gl.bindVertexArray(this.beamVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.beamInstanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.beamInstanceData, gl.DYNAMIC_DRAW)
    gl.uniform2f(this.beamViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.beamCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, beams.length)
    gl.bindVertexArray(null)
  }

  private drawApertureInstances(
    apertures: readonly LaserDmxWebGLApertureInstance[],
    viewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (
      apertures.length === 0 ||
      !this.apertureProgram ||
      !this.apertureVertexArray ||
      !this.apertureInstanceBuffer
    )
      return
    const required = apertures.length * 13
    this.apertureInstanceData = ensureFloatCapacity(this.apertureInstanceData, required)
    let offset = 0
    for (const aperture of apertures) {
      this.apertureInstanceData.set(
        [
          aperture.position.x,
          aperture.position.y,
          aperture.position.z,
          aperture.color.r,
          aperture.color.g,
          aperture.color.b,
          aperture.color.a,
          aperture.coreRadiusCssPx,
          aperture.ringRadiusCssPx,
          aperture.haloRadiusCssPx,
          aperture.intensity,
          aperture.glareDirection.x,
          aperture.glareDirection.y,
        ],
        offset,
      )
      offset += 13
    }
    const gl = this.gl
    gl.useProgram(this.apertureProgram)
    gl.bindVertexArray(this.apertureVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureInstanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.apertureInstanceData, gl.DYNAMIC_DRAW)
    gl.uniform2f(this.apertureViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.apertureCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, apertures.length)
    gl.bindVertexArray(null)
  }

  private drawAtmosphereInstances(
    plan: LaserDmxWebGLAtmosphereRenderPlan,
    viewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (
      plan.beams.length === 0 ||
      !this.atmosphereProgram ||
      !this.atmosphereVertexArray ||
      !this.atmosphereInstanceBuffer
    )
      return
    const required = plan.beams.length * 18
    this.atmosphereInstanceData = ensureFloatCapacity(this.atmosphereInstanceData, required)
    let offset = 0
    for (const beam of plan.beams) {
      this.atmosphereInstanceData.set(
        [
          beam.origin.x,
          beam.origin.y,
          beam.origin.z,
          beam.target.x,
          beam.target.y,
          beam.target.z,
          beam.color.r,
          beam.color.g,
          beam.color.b,
          beam.color.a,
          beam.intensity,
          beam.startWidthCssPx,
          beam.endWidthCssPx,
          beam.depthWeight,
          beam.rearVeilWeight,
          beam.phase,
          0,
          0,
        ],
        offset,
      )
      offset += 18
    }
    const gl = this.gl
    gl.useProgram(this.atmosphereProgram)
    gl.bindVertexArray(this.atmosphereVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.atmosphereInstanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.atmosphereInstanceData, gl.DYNAMIC_DRAW)
    gl.uniform2f(this.atmosphereViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.atmosphereCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    this.applyAtmosphereUniforms(plan, 'scatter')
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, plan.beams.length)
    gl.bindVertexArray(null)
  }

  private drawForegroundVeil(plan: LaserDmxWebGLAtmosphereRenderPlan): void {
    if (plan.foregroundStrength <= 0.001 || !this.foregroundProgram || !this.fullscreenVertexArray)
      return
    const gl = this.gl
    gl.useProgram(this.foregroundProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    this.applyAtmosphereUniforms(plan, 'foreground')
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  private applyAtmosphereUniforms(
    plan: LaserDmxWebGLAtmosphereRenderPlan,
    pass: 'scatter' | 'foreground',
  ): void {
    const gl = this.gl
    this.writeSourceUniformData(plan.sources)
    if (pass === 'scatter') {
      gl.uniform4f(
        this.atmosphereUniform,
        plan.baselineDensity + plan.opacity * plan.beamScatter * 0.12,
        plan.opacity,
        plan.turbulence,
        plan.noiseScale,
      )
      gl.uniform4f(
        this.atmosphereDriftUniform,
        plan.driftSpeed,
        plan.driftDirection,
        plan.diffusion,
        plan.dissipation,
      )
      gl.uniform4f(
        this.atmosphereQualityUniform,
        plan.sampleCount,
        plan.noiseOctaves,
        plan.colorAbsorption,
        plan.beamScatter,
      )
      gl.uniform2f(
        this.atmosphereTimeSeedUniform,
        plan.deterministicTimeSec,
        plan.deterministicSeed,
      )
      gl.uniform1i(this.atmosphereSourceCountUniform, plan.sources.length)
      gl.uniform4fv(this.atmosphereSourcePositionUniform, this.sourcePositionData)
      gl.uniform4fv(this.atmosphereSourceDirectionUniform, this.sourceDirectionData)
      gl.uniform4fv(this.atmosphereSourceColorUniform, this.sourceColorData)
      return
    }
    gl.uniform4f(
      this.foregroundAtmosphereUniform,
      plan.baselineDensity,
      plan.opacity,
      plan.turbulence,
      plan.noiseScale,
    )
    gl.uniform4f(
      this.foregroundDriftUniform,
      plan.driftSpeed,
      plan.driftDirection,
      plan.diffusion,
      plan.dissipation,
    )
    gl.uniform2f(this.foregroundTimeSeedUniform, plan.deterministicTimeSec, plan.deterministicSeed)
    gl.uniform1f(this.foregroundStrengthUniform, plan.foregroundStrength)
    gl.uniform1i(this.foregroundNoiseOctavesUniform, plan.noiseOctaves)
    gl.uniform1i(this.foregroundSourceCountUniform, plan.sources.length)
    gl.uniform4fv(this.foregroundSourcePositionUniform, this.sourcePositionData)
    gl.uniform4fv(this.foregroundSourceDirectionUniform, this.sourceDirectionData)
    gl.uniform4fv(this.foregroundSourceColorUniform, this.sourceColorData)
  }

  private writeSourceUniformData(sources: readonly LaserDmxWebGLAtmosphereSourceInstance[]): void {
    this.sourcePositionData.fill(0)
    this.sourceDirectionData.fill(0)
    this.sourceColorData.fill(0)
    for (let index = 0; index < Math.min(MAX_HAZE_SOURCES, sources.length); index += 1) {
      const source = sources[index]!
      const offset = index * 4
      this.sourcePositionData.set(
        [source.position.x, source.position.y, source.position.z, source.density],
        offset,
      )
      this.sourceDirectionData.set(
        [source.direction.x, source.direction.y, source.spread, 0],
        offset,
      )
      this.sourceColorData.set(
        [source.color.r, source.color.g, source.color.b, source.dissipation],
        offset,
      )
    }
  }

  private drawComposite(): void {
    if (
      !this.compositeProgram ||
      !this.fullscreenVertexArray ||
      !this.rearTarget.texture ||
      !this.frontTarget.texture ||
      !this.atmosphereTarget.texture
    )
      return
    const gl = this.gl
    gl.useProgram(this.compositeProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.rearTarget.texture)
    gl.uniform1i(this.compositeRearUniform, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.frontTarget.texture)
    gl.uniform1i(this.compositeFrontUniform, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.atmosphereTarget.texture)
    gl.uniform1i(this.compositeAtmosphereUniform, 2)
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
    this.atmosphereProgram = createProgram(gl, ATMOSPHERE_VERTEX_SHADER, ATMOSPHERE_FRAGMENT_SHADER)
    this.foregroundProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, FOREGROUND_FRAGMENT_SHADER)
    this.compositeProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER)
    this.beamVertexArray = gl.createVertexArray()
    this.apertureVertexArray = gl.createVertexArray()
    this.atmosphereVertexArray = gl.createVertexArray()
    this.fullscreenVertexArray = gl.createVertexArray()
    this.beamQuadBuffer = gl.createBuffer()
    this.beamInstanceBuffer = gl.createBuffer()
    this.apertureQuadBuffer = gl.createBuffer()
    this.apertureInstanceBuffer = gl.createBuffer()
    this.atmosphereQuadBuffer = gl.createBuffer()
    this.atmosphereInstanceBuffer = gl.createBuffer()
    if (
      !this.beamVertexArray ||
      !this.apertureVertexArray ||
      !this.atmosphereVertexArray ||
      !this.fullscreenVertexArray ||
      !this.beamQuadBuffer ||
      !this.beamInstanceBuffer ||
      !this.apertureQuadBuffer ||
      !this.apertureInstanceBuffer ||
      !this.atmosphereQuadBuffer ||
      !this.atmosphereInstanceBuffer
    )
      throw new Error('Unable to allocate LaserDMX WebGL buffers')

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

    gl.bindVertexArray(this.atmosphereVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.atmosphereQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.atmosphereInstanceBuffer)
    const atmosphereStride = 18 * Float32Array.BYTES_PER_ELEMENT
    enableInstancedAttribute(gl, 1, 3, atmosphereStride, 0)
    enableInstancedAttribute(gl, 2, 3, atmosphereStride, 3 * 4)
    enableInstancedAttribute(gl, 3, 4, atmosphereStride, 6 * 4)
    enableInstancedAttribute(gl, 4, 4, atmosphereStride, 10 * 4)
    enableInstancedAttribute(gl, 5, 4, atmosphereStride, 14 * 4)
    gl.bindVertexArray(null)

    this.beamViewportUniform = gl.getUniformLocation(this.beamProgram, 'uViewportPx')
    this.beamCssToBackingUniform = gl.getUniformLocation(this.beamProgram, 'uCssToBacking')
    this.apertureViewportUniform = gl.getUniformLocation(this.apertureProgram, 'uViewportPx')
    this.apertureCssToBackingUniform = gl.getUniformLocation(this.apertureProgram, 'uCssToBacking')
    this.atmosphereViewportUniform = gl.getUniformLocation(this.atmosphereProgram, 'uViewportPx')
    this.atmosphereCssToBackingUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uCssToBacking',
    )
    this.atmosphereUniform = gl.getUniformLocation(this.atmosphereProgram, 'uAtmosphere')
    this.atmosphereDriftUniform = gl.getUniformLocation(this.atmosphereProgram, 'uDrift')
    this.atmosphereQualityUniform = gl.getUniformLocation(this.atmosphereProgram, 'uQuality')
    this.atmosphereTimeSeedUniform = gl.getUniformLocation(this.atmosphereProgram, 'uTimeSeed')
    this.atmosphereSourceCountUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uSourceCount',
    )
    this.atmosphereSourcePositionUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uSourcePositionDensity[0]',
    )
    this.atmosphereSourceDirectionUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uSourceDirectionSpread[0]',
    )
    this.atmosphereSourceColorUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uSourceColorDissipation[0]',
    )
    this.foregroundAtmosphereUniform = gl.getUniformLocation(this.foregroundProgram, 'uAtmosphere')
    this.foregroundDriftUniform = gl.getUniformLocation(this.foregroundProgram, 'uDrift')
    this.foregroundTimeSeedUniform = gl.getUniformLocation(this.foregroundProgram, 'uTimeSeed')
    this.foregroundStrengthUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uForegroundStrength',
    )
    this.foregroundNoiseOctavesUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uNoiseOctaves',
    )
    this.foregroundSourceCountUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uSourceCount',
    )
    this.foregroundSourcePositionUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uSourcePositionDensity[0]',
    )
    this.foregroundSourceDirectionUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uSourceDirectionSpread[0]',
    )
    this.foregroundSourceColorUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uSourceColorDissipation[0]',
    )
    this.compositeRearUniform = gl.getUniformLocation(this.compositeProgram, 'uRearLightTexture')
    this.compositeFrontUniform = gl.getUniformLocation(this.compositeProgram, 'uFrontLightTexture')
    this.compositeAtmosphereUniform = gl.getUniformLocation(
      this.compositeProgram,
      'uAtmosphereTexture',
    )
    this.ledger.allocate('gpu-core')
  }

  private ensureRenderTarget(
    target: RenderTarget,
    width: number,
    height: number,
    id: string,
  ): void {
    if (target.framebuffer && target.texture && target.width === width && target.height === height)
      return
    this.disposeRenderTarget(target, id)
    const gl = this.gl
    const framebuffer = gl.createFramebuffer()
    const texture = gl.createTexture()
    if (!framebuffer || !texture) throw new Error(`Unable to allocate LaserDMX ${id} target`)
    const floatColorBuffer = gl.getExtension('EXT_color_buffer_float') != null
    const floatLinear =
      target.filter !== gl.LINEAR || gl.getExtension('OES_texture_float_linear') != null
    const canRenderFloat = floatColorBuffer && floatLinear
    let allocatedFloat = canRenderFloat

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, target.filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, target.filter)
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
      allocatedFloat = false
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    if (!complete) {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      throw new Error(`LaserDMX ${id} framebuffer is incomplete`)
    }
    target.framebuffer = framebuffer
    target.texture = texture
    target.width = width
    target.height = height
    target.float = allocatedFloat
    this.ledger.allocate(id)
  }

  private clearTarget(target: RenderTarget): void {
    if (!target.framebuffer) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  private disposeRenderTarget(target: RenderTarget, id: string): void {
    const gl = this.gl
    try {
      if (target.framebuffer) gl.deleteFramebuffer(target.framebuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (target.texture) gl.deleteTexture(target.texture)
    } catch {
      /* Context may be lost. */
    }
    target.framebuffer = null
    target.texture = null
    target.width = 0
    target.height = 0
    target.float = false
    this.ledger.release(id)
  }

  private disposeGpuResources(): void {
    const gl = this.gl
    this.disposeRenderTarget(this.rearTarget, 'rear-light')
    this.disposeRenderTarget(this.frontTarget, 'front-light')
    this.disposeRenderTarget(this.atmosphereTarget, 'atmosphere')
    try {
      if (this.beamQuadBuffer) gl.deleteBuffer(this.beamQuadBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.beamInstanceBuffer) gl.deleteBuffer(this.beamInstanceBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.apertureQuadBuffer) gl.deleteBuffer(this.apertureQuadBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.apertureInstanceBuffer) gl.deleteBuffer(this.apertureInstanceBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.atmosphereQuadBuffer) gl.deleteBuffer(this.atmosphereQuadBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.atmosphereInstanceBuffer) gl.deleteBuffer(this.atmosphereInstanceBuffer)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.beamVertexArray) gl.deleteVertexArray(this.beamVertexArray)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.apertureVertexArray) gl.deleteVertexArray(this.apertureVertexArray)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.atmosphereVertexArray) gl.deleteVertexArray(this.atmosphereVertexArray)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.fullscreenVertexArray) gl.deleteVertexArray(this.fullscreenVertexArray)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.beamProgram) gl.deleteProgram(this.beamProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.apertureProgram) gl.deleteProgram(this.apertureProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.atmosphereProgram) gl.deleteProgram(this.atmosphereProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.foregroundProgram) gl.deleteProgram(this.foregroundProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.compositeProgram) gl.deleteProgram(this.compositeProgram)
    } catch {
      /* Context may be lost. */
    }
    this.beamQuadBuffer = null
    this.beamInstanceBuffer = null
    this.apertureQuadBuffer = null
    this.apertureInstanceBuffer = null
    this.atmosphereQuadBuffer = null
    this.atmosphereInstanceBuffer = null
    this.beamVertexArray = null
    this.apertureVertexArray = null
    this.atmosphereVertexArray = null
    this.fullscreenVertexArray = null
    this.beamProgram = null
    this.apertureProgram = null
    this.atmosphereProgram = null
    this.foregroundProgram = null
    this.compositeProgram = null
    this.ledger.release('gpu-core')
  }
}
