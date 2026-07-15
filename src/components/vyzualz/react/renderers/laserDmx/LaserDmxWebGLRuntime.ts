import { resolveCanvasResolution, type CanvasResolution } from '../../rendering/canvasResolution'
import { ShaderWebGLRuntime } from '../../shaders/runtime/ShaderWebGLRuntime'
import type { WebGLContextDisposalMode } from '../../shaders/runtime/WebGLContextLifecycle'
import type { LaserDmxSceneFrame } from './LaserDmxSceneFrame'
import { resolveLaserDmxDepthTraversal } from './LaserDmxDepthCompositing'
import {
  applyLaserDmxAdaptiveQualityToFrame,
  LaserDmxAdaptiveQualityController,
  type LaserDmxAdaptiveQualitySnapshot,
} from './LaserDmxAdaptiveQuality'
import { classifyLaserDmxWebGLFailure, type LaserDmxRendererFallbackCode } from './LaserDmxRendererBackend'
import {
  LaserDmxExposureController,
  probeLaserDmxWebGLPostCapabilities,
  resolveLaserDmxHdrTargetStrategy,
  resolveLaserDmxWebGLPostProcessPlan,
  type LaserDmxHdrTargetStrategy,
  type LaserDmxWebGLPostProcessPlan,
} from './LaserDmxWebGLPostProcessing'
import {
  buildLaserDmxWebGLAtmosphereRenderPlan,
  type LaserDmxWebGLAtmosphereRenderPlan,
  type LaserDmxWebGLAtmosphereBeamInstance,
  type LaserDmxWebGLAtmosphereSourceInstance,
} from './LaserDmxWebGLAtmospherePlan'
import {
  buildLaserDmxWebGLBeamRenderPlan,
  type LaserDmxWebGLApertureInstance,
  type LaserDmxWebGLBeamInstance,
} from './LaserDmxWebGLBeamPlan'
import {
  LaserDmxTemporalOpticsController,
  type LaserDmxTemporalFramePlan,
} from './LaserDmxTemporalOptics'

export interface LaserDmxWebGLDiagnostics {
  hdrMode: 'rgba16f' | 'rgba8'
  degraded: boolean
  bloomLevels: number
  quality: LaserDmxWebGLPostProcessPlan['quality'] | null
  atmosphereQuality: LaserDmxAdaptiveQualitySnapshot['effectiveAtmosphere'] | null
  diagnosticCode: LaserDmxHdrTargetStrategy['diagnosticCode']
  temporalHistoryActive: boolean
  temporalResolutionScale: number
  laserHistoryInputCount: number
  laserHistorySliceCount: number
  depthMode: LaserDmxWebGLAtmosphereRenderPlan['depthMode']
  depthSliceCount: number
  depthBufferStatus: 'slice-accumulation' | 'binary-fallback'
  renderWidth: number
  renderHeight: number
  atmosphereWidth: number
  atmosphereHeight: number
  atmosphereSampleCount: number
  activeBeamCount: number
  requestedBeamCount: number
  activeFixtureCount: number
  cpuFrameMs: number | null
  gpuFrameMs: number | null
  contextLossCount: number
  qualityAdjustmentReason: LaserDmxAdaptiveQualitySnapshot['lastChangeReason'] | null
}

export interface LaserDmxWebGLRenderResult {
  ok: boolean
  error: string | null
  recoverable?: boolean
  failureCode?: LaserDmxRendererFallbackCode
  diagnostics?: LaserDmxWebGLDiagnostics
}

export interface LaserDmxWebGLCreateResult {
  runtime: LaserDmxWebGLRuntime | null
  error: string | null
  failureCode: LaserDmxRendererFallbackCode | null
}

export class LaserDmxWebGLContextState {
  private _contextLost = false
  private _restorePending = false
  private _disposed = false
  private _generation = 0
  private _lossCount = 0

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
  get lossCount(): number {
    return this._lossCount
  }

  markLost(): void {
    if (this._disposed || this._contextLost) return
    this._contextLost = true
    this._restorePending = false
    this._lossCount += 1
  }

  markRestored(): void {
    if (this._disposed || !this._contextLost) return
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

interface LaserDmxTimerQueryExtension {
  TIME_ELAPSED_EXT: number
  GPU_DISJOINT_EXT: number
}

/** Optional GPU timing with one in-flight query and no blocking readback. */
class LaserDmxGpuTimer {
  private readonly extension: LaserDmxTimerQueryExtension | null
  private pending: WebGLQuery | null = null
  private active = false
  private _lastFrameMs: number | null = null
  private disabled = false

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as LaserDmxTimerQueryExtension | null
  }

  get lastFrameMs(): number | null {
    return this._lastFrameMs
  }

  poll(): void {
    if (!this.extension || !this.pending || this.disabled) return
    try {
      const available = this.gl.getQueryParameter(this.pending, this.gl.QUERY_RESULT_AVAILABLE) === true
      const disjoint = this.gl.getParameter(this.extension.GPU_DISJOINT_EXT) === true
      if (!available) return
      if (!disjoint) {
        const elapsedNs = Number(this.gl.getQueryParameter(this.pending, this.gl.QUERY_RESULT))
        this._lastFrameMs = Number.isFinite(elapsedNs) ? elapsedNs / 1_000_000 : null
      }
      this.gl.deleteQuery(this.pending)
      this.pending = null
    } catch {
      this.disable()
    }
  }

  begin(): void {
    if (!this.extension || this.pending || this.active || this.disabled || this.gl.isContextLost()) return
    try {
      const query = this.gl.createQuery()
      if (!query) return
      this.pending = query
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query)
      this.active = true
    } catch {
      this.disable()
    }
  }

  end(): void {
    if (!this.extension || !this.active || this.disabled) return
    try {
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT)
    } catch {
      this.disable()
    } finally {
      this.active = false
    }
  }

  reset(): void {
    if (this.active && this.extension) {
      try { this.gl.endQuery(this.extension.TIME_ELAPSED_EXT) } catch { /* context may be lost */ }
    }
    if (this.pending) {
      try { this.gl.deleteQuery(this.pending) } catch { /* context may be lost */ }
    }
    this.active = false
    this.pending = null
    this._lastFrameMs = null
  }

  dispose(): void {
    this.reset()
    this.disabled = true
  }

  private disable(): void {
    this.reset()
    this.disabled = true
  }
}

import {
  APERTURE_FRAGMENT_SHADER,
  BLOOM_BLUR_FRAGMENT_SHADER,
  BLOOM_DOWNSAMPLE_FRAGMENT_SHADER,
  APERTURE_VERTEX_SHADER,
  ATMOSPHERE_FRAGMENT_SHADER,
  ATMOSPHERE_VERTEX_SHADER,
  BEAM_FRAGMENT_SHADER,
  BEAM_VERTEX_SHADER,
  COMPOSITE_FRAGMENT_SHADER,
  FOREGROUND_FRAGMENT_SHADER,
  POST_COMPOSITE_FRAGMENT_SHADER,
  TEMPORAL_HISTORY_FRAGMENT_SHADER,
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

const MAX_DEPTH_SLICES = 9
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
    return LaserDmxWebGLRuntime.createWithDiagnostics(outputContext).runtime
  }

  static createWithDiagnostics(outputContext: CanvasRenderingContext2D): LaserDmxWebGLCreateResult {
    if (typeof document === 'undefined') {
      return {
        runtime: null,
        error: 'WebGL2 unavailable outside a browser document',
        failureCode: 'webgl2-unavailable',
      }
    }
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
    if (!result.runtime) {
      return {
        runtime: null,
        error: result.error,
        failureCode: 'webgl2-unavailable',
      }
    }
    try {
      owner = new LaserDmxWebGLRuntime(outputContext, canvas, result.runtime, lifecycle)
      return { runtime: owner, error: null, failureCode: null }
    } catch (error) {
      result.runtime.dispose('release-resources')
      const message = error instanceof Error ? error.message : String(error)
      return {
        runtime: null,
        error: message,
        failureCode: classifyLaserDmxWebGLFailure(message),
      }
    }
  }

  private readonly gl: WebGL2RenderingContext
  private readonly ledger = new LaserDmxWebGLResourceLedger()
  private beamProgram: WebGLProgram | null = null
  private apertureProgram: WebGLProgram | null = null
  private atmosphereProgram: WebGLProgram | null = null
  private foregroundProgram: WebGLProgram | null = null
  private compositeProgram: WebGLProgram | null = null
  private temporalProgram: WebGLProgram | null = null
  private bloomDownsampleProgram: WebGLProgram | null = null
  private bloomBlurProgram: WebGLProgram | null = null
  private postCompositeProgram: WebGLProgram | null = null
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
  private sharpSliceTarget: RenderTarget
  private laserSliceTarget: RenderTarget
  private atmosphereTarget: RenderTarget
  private readonly compositeTargets: [RenderTarget, RenderTarget]
  private readonly temporalSliceTargets: Array<[RenderTarget, RenderTarget]> = []
  private readonly temporalReadIndices = new Array<number>(MAX_DEPTH_SLICES).fill(0)
  private readonly temporalHistoryValid = new Array<boolean>(MAX_DEPTH_SLICES).fill(false)
  private readonly continuousDepthAvailable: boolean
  private readonly bloomTargets: RenderTarget[] = []
  private readonly bloomBlurTargets: RenderTarget[] = []
  private targetStrategy: LaserDmxHdrTargetStrategy
  private readonly exposureController = new LaserDmxExposureController()
  private readonly temporalController = new LaserDmxTemporalOpticsController()
  private readonly qualityController: LaserDmxAdaptiveQualityController
  private readonly gpuTimer: LaserDmxGpuTimer
  private lastPostPlan: LaserDmxWebGLPostProcessPlan | null = null
  private lastTemporalPlan: LaserDmxTemporalFramePlan | null = null
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
  private atmosphereDepthSliceUniform: WebGLUniformLocation | null = null
  private atmosphereSourceDynamicsUniform: WebGLUniformLocation | null = null
  private foregroundDepthSliceUniform: WebGLUniformLocation | null = null
  private foregroundSourceDynamicsUniform: WebGLUniformLocation | null = null
  private compositeAccumulatedUniform: WebGLUniformLocation | null = null
  private compositeSharpUniform: WebGLUniformLocation | null = null
  private compositeCurrentLaserUniform: WebGLUniformLocation | null = null
  private compositeLaserHistoryUniform: WebGLUniformLocation | null = null
  private compositeAtmosphereUniform: WebGLUniformLocation | null = null
  private compositeLayerExtinctionUniform: WebGLUniformLocation | null = null
  private temporalCurrentUniform: WebGLUniformLocation | null = null
  private temporalPreviousUniform: WebGLUniformLocation | null = null
  private temporalRetentionUniform: WebGLUniformLocation | null = null
  private temporalHistoryAvailableUniform: WebGLUniformLocation | null = null
  private bloomSourceUniform: WebGLUniformLocation | null = null
  private bloomSourceResolutionUniform: WebGLUniformLocation | null = null
  private bloomThresholdKneeUniform: WebGLUniformLocation | null = null
  private bloomFirstPassUniform: WebGLUniformLocation | null = null
  private blurSourceUniform: WebGLUniformLocation | null = null
  private blurResolutionUniform: WebGLUniformLocation | null = null
  private blurDirectionUniform: WebGLUniformLocation | null = null
  private blurRadiusUniform: WebGLUniformLocation | null = null
  private postSceneUniform: WebGLUniformLocation | null = null
  private postTemporalUniform: WebGLUniformLocation | null = null
  private postTemporalEnabledUniform: WebGLUniformLocation | null = null
  private postBloomUniforms: Array<WebGLUniformLocation | null> = []
  private postResolutionUniform: WebGLUniformLocation | null = null
  private postBloomWeightsUniform: WebGLUniformLocation | null = null
  private postBloomStrengthUniform: WebGLUniformLocation | null = null
  private postExposureWashoutUniform: WebGLUniformLocation | null = null
  private postToneParamsUniform: WebGLUniformLocation | null = null
  private postOptics0Uniform: WebGLUniformLocation | null = null
  private postOptics1Uniform: WebGLUniformLocation | null = null
  private beamInstanceData = new Float32Array(0)
  private apertureInstanceData = new Float32Array(0)
  private atmosphereInstanceData = new Float32Array(0)
  private beamGpuCapacityFloats = 0
  private apertureGpuCapacityFloats = 0
  private atmosphereGpuCapacityFloats = 0
  private readonly sharpBeamSlices = Array.from({ length: MAX_DEPTH_SLICES }, () => [] as LaserDmxWebGLBeamInstance[])
  private readonly laserBeamSlices = Array.from({ length: MAX_DEPTH_SLICES }, () => [] as LaserDmxWebGLBeamInstance[])
  private readonly apertureSlices = Array.from({ length: MAX_DEPTH_SLICES }, () => [] as LaserDmxWebGLApertureInstance[])
  private readonly atmosphereBeamSlices = Array.from({ length: MAX_DEPTH_SLICES }, () => [] as LaserDmxWebGLAtmosphereBeamInstance[])
  private sourcePositionData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private sourceDirectionData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private sourceColorData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private sourceDynamicsData = new Float32Array(MAX_HAZE_SOURCES * 4)
  private lastResolution: CanvasResolution | null = null
  private lastAtmospherePlan: LaserDmxWebGLAtmosphereRenderPlan | null = null
  private lastQualitySnapshot: LaserDmxAdaptiveQualitySnapshot | null = null
  private lastCpuFrameMs: number | null = null
  private consecutiveRenderFailures = 0
  private lastActiveBeamCount = 0
  private lastRequestedBeamCount = 0
  private lastActiveFixtureCount = 0
  private lastLaserHistoryInputCount = 0
  private lastLaserHistorySliceCount = 0
  private lastTemporalResolutionScale = 0
  private disposed = false

  private constructor(
    private readonly outputContext: CanvasRenderingContext2D,
    private readonly canvas: HTMLCanvasElement,
    private readonly runtime: ShaderWebGLRuntime,
    private readonly lifecycle: LaserDmxWebGLContextState,
  ) {
    this.gl = runtime.gl
    const maxTextureSize = Number(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)) || 0
    const maxRenderbufferSize = Number(this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE)) || 0
    this.qualityController = new LaserDmxAdaptiveQualityController({
      hdrAvailable: false,
      maxTextureSize,
      maxRenderbufferSize,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })
    this.gpuTimer = new LaserDmxGpuTimer(this.gl)
    this.continuousDepthAvailable = Number(this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS)) >= 5
    this.sharpSliceTarget = emptyTarget(this.gl.NEAREST)
    this.laserSliceTarget = emptyTarget(this.gl.NEAREST)
    this.targetStrategy = resolveLaserDmxHdrTargetStrategy(probeLaserDmxWebGLPostCapabilities(this.gl))
    this.qualityController.updateCapabilities({
      hdrAvailable: this.targetStrategy.hdrEnabled,
      maxTextureSize,
      maxRenderbufferSize,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })
    const postFilter = this.targetStrategy.linearFiltering ? this.gl.LINEAR : this.gl.NEAREST
    this.atmosphereTarget = emptyTarget(postFilter)
    this.compositeTargets = [emptyTarget(postFilter), emptyTarget(postFilter)]
    for (let sliceIndex = 0; sliceIndex < MAX_DEPTH_SLICES; sliceIndex += 1) {
      this.temporalSliceTargets.push([emptyTarget(postFilter), emptyTarget(postFilter)])
    }
    for (let index = 0; index < 4; index += 1) {
      const filter = this.targetStrategy.linearFiltering ? this.gl.LINEAR : this.gl.NEAREST
      this.bloomTargets.push(emptyTarget(filter))
      this.bloomBlurTargets.push(emptyTarget(filter))
    }
    this.createGpuResources()
  }

  get contextLost(): boolean {
    return this.lifecycle.contextLost || this.runtime.contextLost
  }

  get contextLossCount(): number {
    return this.lifecycle.lossCount
  }

  get repeatedContextLoss(): boolean {
    return this.contextLossCount >= 2
  }

  get diagnostics(): LaserDmxWebGLDiagnostics {
    const plan = this.lastPostPlan
    const atmosphere = this.lastAtmospherePlan
    const resolution = this.lastResolution
    return {
      hdrMode: plan?.targetStrategy.targetFormat ?? this.targetStrategy.targetFormat,
      degraded: plan?.degraded ?? !this.targetStrategy.hdrEnabled,
      bloomLevels: plan?.bloom.levelCount ?? 0,
      quality: plan?.quality ?? null,
      atmosphereQuality: this.lastQualitySnapshot?.effectiveAtmosphere ?? null,
      diagnosticCode: plan?.targetStrategy.diagnosticCode ?? this.targetStrategy.diagnosticCode,
      temporalHistoryActive: this.lastTemporalPlan?.history.enabled ?? false,
      temporalResolutionScale: this.lastTemporalResolutionScale,
      laserHistoryInputCount: this.lastLaserHistoryInputCount,
      laserHistorySliceCount: this.lastLaserHistorySliceCount,
      depthMode: atmosphere?.depthMode ?? (this.continuousDepthAvailable ? 'continuous-slices' : 'binary-fallback'),
      depthSliceCount: atmosphere?.sliceCount ?? 0,
      depthBufferStatus: atmosphere?.depthMode === 'binary-fallback' ? 'binary-fallback' : 'slice-accumulation',
      renderWidth: resolution?.backingWidth ?? 0,
      renderHeight: resolution?.backingHeight ?? 0,
      atmosphereWidth: atmosphere?.targetWidth ?? 0,
      atmosphereHeight: atmosphere?.targetHeight ?? 0,
      atmosphereSampleCount: atmosphere?.sampleCount ?? 0,
      activeBeamCount: this.lastActiveBeamCount,
      requestedBeamCount: this.lastRequestedBeamCount,
      activeFixtureCount: this.lastActiveFixtureCount,
      cpuFrameMs: this.lastCpuFrameMs,
      gpuFrameMs: this.gpuTimer.lastFrameMs,
      contextLossCount: this.contextLossCount,
      qualityAdjustmentReason: this.lastQualitySnapshot?.lastChangeReason ?? null,
    }
  }

  render(frame: LaserDmxSceneFrame): LaserDmxWebGLRenderResult {
    if (this.disposed || this.lifecycle.disposed) {
      return {
        ok: false,
        error: 'LaserDMX WebGL runtime is disposed',
        recoverable: false,
        failureCode: 'runtime-render-failed',
      }
    }
    if (this.contextLost) {
      return {
        ok: false,
        error: 'LaserDMX WebGL context lost',
        recoverable: !this.repeatedContextLoss,
        failureCode: this.repeatedContextLoss ? 'repeated-context-loss' : 'context-lost',
      }
    }

    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.gpuTimer.poll()
    const qualitySnapshot = this.qualityController.resolve(
      frame.quality.qualityTier,
      frame.atmosphere.qualityTier,
    )
    this.lastQualitySnapshot = qualitySnapshot
    const renderFrame = applyLaserDmxAdaptiveQualityToFrame(frame, qualitySnapshot)

    try {
      if (this.lifecycle.consumeRestore()) this.rebuildGpuResources()
      this.resize(renderFrame)
      const frameState = this.runtime.beginFrame()
      const resolution = this.lastResolution
      if (!frameState || !resolution || !this.resourcesReady()) {
        return {
          ok: false,
          error: 'LaserDMX WebGL frame could not begin',
          recoverable: true,
          failureCode: 'runtime-render-failed',
        }
      }

      this.gpuTimer.begin()
      const viewport = {
        backingWidth: frameState.dims.W,
        backingHeight: frameState.dims.H,
        cssWidth: resolution.cssWidth,
        cssHeight: resolution.cssHeight,
      }
      const temporalPlan = this.temporalController.update(renderFrame)
      this.lastTemporalPlan = temporalPlan
      const beamPlan = buildLaserDmxWebGLBeamRenderPlan(
        renderFrame,
        viewport,
        undefined,
        this.continuousDepthAvailable,
      )
      const atmospherePlan = buildLaserDmxWebGLAtmosphereRenderPlan(
        renderFrame,
        viewport,
        this.continuousDepthAvailable,
      )
      this.lastAtmospherePlan = atmospherePlan
      const sliceCount = Math.min(MAX_DEPTH_SLICES, atmospherePlan.sliceCount)
      this.ensureRenderTarget(this.sharpSliceTarget, frameState.dims.W, frameState.dims.H, 'sharp-slice')
      this.ensureRenderTarget(this.laserSliceTarget, frameState.dims.W, frameState.dims.H, 'laser-slice')
      this.ensureRenderTarget(
        this.atmosphereTarget,
        atmospherePlan.targetWidth,
        atmospherePlan.targetHeight,
        'atmosphere-slice',
      )
      this.ensureRenderTarget(this.compositeTargets[0], frameState.dims.W, frameState.dims.H, 'depth-composite-0')
      this.ensureRenderTarget(this.compositeTargets[1], frameState.dims.W, frameState.dims.H, 'depth-composite-1')
      if (temporalPlan.history.clearHistory) this.clearTemporalHistory()
      this.partitionDepthInstances(beamPlan.beams, beamPlan.apertures, atmospherePlan.beams, sliceCount)
      const activeLaserHistorySlices = Array.from({ length: sliceCount }, (_, sliceIndex) => (
        this.laserBeamSlices[sliceIndex]!.length > 0 || this.temporalHistoryValid[sliceIndex] === true
      ))
      this.ensureTemporalTargets(
        frameState.dims.W,
        frameState.dims.H,
        temporalPlan,
        sliceCount,
        activeLaserHistorySlices,
      )

      const activeTargets = [
        this.sharpSliceTarget,
        this.laserSliceTarget,
        this.atmosphereTarget,
        ...this.compositeTargets,
        ...this.temporalSliceTargets.slice(0, sliceCount).flat().filter(target => target.texture != null),
      ]
      const activeTargetStrategy = activeTargets.every(target => target.float)
        ? this.targetStrategy
        : resolveLaserDmxHdrTargetStrategy({
            webgl2: true,
            colorBufferFloat: false,
            rgba16fRenderable: false,
            floatLinearFiltering: true,
          })
      const exposure = this.exposureController.update(renderFrame)
      const postPlan = resolveLaserDmxWebGLPostProcessPlan(
        renderFrame,
        activeTargetStrategy,
        exposure.state,
        exposure.response,
      )
      this.lastPostPlan = postPlan
      this.ensurePostTargets(frameState.dims.W, frameState.dims.H, postPlan)

      let accumulatedIndex = 0
      this.clearTarget(this.compositeTargets[accumulatedIndex])
      // OpenGL clip depth is -1 at the camera-facing near plane and +1 at the far plane.
      // Accumulate far to near so each nearer atmosphere slice attenuates only light already behind it.
      for (const sliceIndex of resolveLaserDmxDepthTraversal(sliceCount)) {
        if (!renderFrame.output.blackout) {
          this.renderSharpTarget(
            this.sharpSliceTarget,
            this.sharpBeamSlices[sliceIndex]!,
            this.apertureSlices[sliceIndex]!,
            viewport,
          )
          this.renderSharpTarget(
            this.laserSliceTarget,
            this.laserBeamSlices[sliceIndex]!,
            [],
            viewport,
          )
          this.renderAtmosphereSlice(
            atmospherePlan,
            this.atmosphereBeamSlices[sliceIndex]!,
            this.apertureSlices[sliceIndex]!,
            sliceIndex,
            viewport,
          )
        } else {
          this.clearTarget(this.sharpSliceTarget)
          this.clearTarget(this.laserSliceTarget)
          this.clearTarget(this.atmosphereTarget)
        }
        const laserHistoryTarget = this.renderTemporalHistory(
          temporalPlan,
          this.laserSliceTarget,
          sliceIndex,
        )
        const nextAccumulatedIndex = accumulatedIndex === 0 ? 1 : 0
        this.drawDepthLayerComposite(
          this.compositeTargets[accumulatedIndex],
          this.sharpSliceTarget,
          this.laserSliceTarget,
          laserHistoryTarget,
          this.atmosphereTarget,
          this.compositeTargets[nextAccumulatedIndex],
          atmospherePlan.extinction,
        )
        accumulatedIndex = nextAccumulatedIndex
      }

      const gl = this.gl
      gl.disable(gl.BLEND)
      gl.disable(gl.DEPTH_TEST)
      const sceneTarget = this.compositeTargets[accumulatedIndex]
      this.renderPhotographicPost(postPlan, sceneTarget)
      this.gpuTimer.end()
      this.runtime.endFrame()

      const outCanvas = this.outputContext.canvas
      this.outputContext.save()
      this.outputContext.setTransform(1, 0, 0, 1, 0, 0)
      this.outputContext.globalCompositeOperation = 'source-over'
      this.outputContext.globalAlpha = 1
      this.outputContext.clearRect(0, 0, outCanvas.width, outCanvas.height)
      this.outputContext.drawImage(this.canvas, 0, 0, outCanvas.width, outCanvas.height)
      this.outputContext.restore()

      const endMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      this.lastCpuFrameMs = Math.max(0, endMs - startMs)
      this.gpuTimer.poll()
      this.qualityController.sample(
        this.gpuTimer.lastFrameMs ?? this.lastCpuFrameMs,
        endMs,
        frame.quality.qualityTier,
      )
      this.lastActiveBeamCount = beamPlan.beams.length
      this.lastRequestedBeamCount = atmospherePlan.requestedBeamCount
      this.lastActiveFixtureCount = renderFrame.fixtures.filter(fixture => fixture.enabled).length
      this.lastLaserHistoryInputCount = beamPlan.laserHistoryBeamCount
      this.consecutiveRenderFailures = 0
      return {
        ok: true,
        error: null,
        diagnostics: {
          hdrMode: postPlan.targetStrategy.targetFormat,
          degraded: postPlan.degraded,
          bloomLevels: postPlan.bloom.levelCount,
          quality: postPlan.quality,
          atmosphereQuality: qualitySnapshot.effectiveAtmosphere,
          diagnosticCode: postPlan.targetStrategy.diagnosticCode,
          temporalHistoryActive: temporalPlan.history.enabled,
          temporalResolutionScale: this.lastTemporalResolutionScale,
          laserHistoryInputCount: beamPlan.laserHistoryBeamCount,
          laserHistorySliceCount: this.lastLaserHistorySliceCount,
          depthMode: atmospherePlan.depthMode,
          depthSliceCount: sliceCount,
          depthBufferStatus: atmospherePlan.depthMode === 'binary-fallback' ? 'binary-fallback' : 'slice-accumulation',
          renderWidth: frameState.dims.W,
          renderHeight: frameState.dims.H,
          atmosphereWidth: atmospherePlan.targetWidth,
          atmosphereHeight: atmospherePlan.targetHeight,
          atmosphereSampleCount: atmospherePlan.sampleCount,
          activeBeamCount: this.lastActiveBeamCount,
          requestedBeamCount: this.lastRequestedBeamCount,
          activeFixtureCount: this.lastActiveFixtureCount,
          cpuFrameMs: this.lastCpuFrameMs,
          gpuFrameMs: this.gpuTimer.lastFrameMs,
          contextLossCount: this.contextLossCount,
          qualityAdjustmentReason: qualitySnapshot.lastChangeReason,
        },
      }
    } catch (error) {
      this.gpuTimer.end()
      const message = error instanceof Error ? error.message : String(error)
      const failureCode = classifyLaserDmxWebGLFailure(message)
      this.consecutiveRenderFailures += 1
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const downshifted = failureCode === 'gpu-resource-allocation-failed'
        && frame.quality.qualityTier === 'auto'
        && this.qualityController.emergencyDownshift(nowMs)
      return {
        ok: false,
        error: message,
        recoverable: downshifted || (failureCode === 'runtime-render-failed' && this.consecutiveRenderFailures < 3),
        failureCode,
      }
    }
  }

  reset(): void {
    if (this.disposed || this.contextLost) return
    try {
      this.clearTarget(this.sharpSliceTarget)
      this.clearTarget(this.laserSliceTarget)
      this.clearTarget(this.atmosphereTarget)
      for (const target of this.compositeTargets) this.clearTarget(target)
      this.clearTemporalHistory()
      for (const target of this.bloomTargets) this.clearTarget(target)
      for (const target of this.bloomBlurTargets) this.clearTarget(target)
      this.exposureController.reset()
      this.temporalController.reset()
      this.lastPostPlan = null
      this.lastTemporalPlan = null
      this.lastAtmospherePlan = null
      this.lastQualitySnapshot = null
      this.lastCpuFrameMs = null
      this.consecutiveRenderFailures = 0
      this.gpuTimer.reset()
      this.qualityController.resetTimings()
      this.lastActiveBeamCount = 0
      this.lastRequestedBeamCount = 0
      this.lastActiveFixtureCount = 0
      this.lastLaserHistoryInputCount = 0
      this.lastLaserHistorySliceCount = 0
      this.lastTemporalResolutionScale = 0
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
    this.temporalController.dispose()
    this.gpuTimer.dispose()
    this.disposeGpuResources()
    this.ledger.dispose()
    this.runtime.dispose(mode)
    this.lastResolution = null
    this.lastTemporalPlan = null
    this.lastLaserHistorySliceCount = 0
    this.lastTemporalResolutionScale = 0
    this.lastAtmospherePlan = null
    this.lastQualitySnapshot = null
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
      this.compositeProgram &&
      this.temporalProgram &&
      this.bloomDownsampleProgram &&
      this.bloomBlurProgram &&
      this.postCompositeProgram,
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
      this.disposeRenderTarget(this.sharpSliceTarget, 'sharp-slice')
      this.disposeRenderTarget(this.laserSliceTarget, 'laser-slice')
      // Atmosphere and post targets also depend on independent quality scales.
      this.disposeRenderTarget(this.atmosphereTarget, 'atmosphere-slice')
      this.disposeRenderTarget(this.compositeTargets[0], 'depth-composite-0')
      this.disposeRenderTarget(this.compositeTargets[1], 'depth-composite-1')
      this.disposeTemporalTargets()
      this.disposePostTargets()
    }
  }

  private partitionDepthInstances(
    beams: readonly LaserDmxWebGLBeamInstance[],
    apertures: readonly LaserDmxWebGLApertureInstance[],
    atmosphereBeams: readonly LaserDmxWebGLAtmosphereBeamInstance[],
    sliceCount: number,
  ): void {
    for (let sliceIndex = 0; sliceIndex < MAX_DEPTH_SLICES; sliceIndex += 1) {
      this.sharpBeamSlices[sliceIndex]!.length = 0
      this.laserBeamSlices[sliceIndex]!.length = 0
      this.apertureSlices[sliceIndex]!.length = 0
      this.atmosphereBeamSlices[sliceIndex]!.length = 0
    }
    const boundedSlice = (value: number) => Math.max(0, Math.min(sliceCount - 1, Math.round(value)))
    for (const beam of beams) {
      const sliceIndex = boundedSlice(beam.depthSlice)
      const target = beam.historyEligible
        ? this.laserBeamSlices[sliceIndex]!
        : this.sharpBeamSlices[sliceIndex]!
      target.push(beam)
    }
    for (const aperture of apertures) {
      this.apertureSlices[boundedSlice(aperture.depthSlice)]!.push(aperture)
    }
    for (const beam of atmosphereBeams) {
      this.atmosphereBeamSlices[boundedSlice(beam.depthSlice)]!.push(beam)
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

  private renderAtmosphereSlice(
    plan: LaserDmxWebGLAtmosphereRenderPlan,
    beams: readonly LaserDmxWebGLAtmosphereBeamInstance[],
    apertures: readonly LaserDmxWebGLApertureInstance[],
    sliceIndex: number,
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
    this.drawAtmosphereInstances(plan, beams, sliceIndex, atmosphereViewport)
    // Current-frame fixture sources illuminate nearby air but never enter scanner history.
    this.drawApertureInstances(apertures, atmosphereViewport)
    this.drawForegroundVeil(plan, sliceIndex)
  }

  private uploadDynamicInstanceData(
    buffer: WebGLBuffer,
    data: Float32Array<ArrayBuffer>,
    requiredFloats: number,
    capacityFloats: number,
  ): number {
    const gl = this.gl
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    if (capacityFloats < requiredFloats) {
      let nextCapacity = Math.max(64, capacityFloats || 64)
      while (nextCapacity < requiredFloats) nextCapacity *= 2
      gl.bufferData(gl.ARRAY_BUFFER, nextCapacity * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW)
      capacityFloats = nextCapacity
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, requiredFloats))
    return capacityFloats
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
    const required = beams.length * 30
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
          beam.goboAmount,
          beam.materialMode,
          beam.softness,
          beam.goboPattern,
          beam.goboRotationRad,
          beam.iris,
          beam.frost,
          beam.prismAmount,
          beam.prismFacetCount,
          beam.prismRotationRad,
          beam.phase,
        ],
        offset,
      )
      offset += 30
    }
    const gl = this.gl
    gl.useProgram(this.beamProgram)
    gl.bindVertexArray(this.beamVertexArray)
    this.beamGpuCapacityFloats = this.uploadDynamicInstanceData(
      this.beamInstanceBuffer,
      this.beamInstanceData,
      required,
      this.beamGpuCapacityFloats,
    )
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
    const required = apertures.length * 21
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
          aperture.shapeMode,
          aperture.aspect,
          aperture.segments,
          aperture.phase,
          aperture.rotationRad,
          aperture.behaviorMode,
          aperture.sourceVariant,
          aperture.softness,
        ],
        offset,
      )
      offset += 21
    }
    const gl = this.gl
    gl.useProgram(this.apertureProgram)
    gl.bindVertexArray(this.apertureVertexArray)
    this.apertureGpuCapacityFloats = this.uploadDynamicInstanceData(
      this.apertureInstanceBuffer,
      this.apertureInstanceData,
      required,
      this.apertureGpuCapacityFloats,
    )
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
    beams: readonly LaserDmxWebGLAtmosphereBeamInstance[],
    sliceIndex: number,
    viewport: {
      backingWidth: number
      backingHeight: number
      cssWidth: number
      cssHeight: number
    },
  ): void {
    if (
      beams.length === 0 ||
      !this.atmosphereProgram ||
      !this.atmosphereVertexArray ||
      !this.atmosphereInstanceBuffer
    )
      return
    const required = beams.length * 18
    this.atmosphereInstanceData = ensureFloatCapacity(this.atmosphereInstanceData, required)
    let offset = 0
    for (const beam of beams) {
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
          beam.extinctionWeight,
          beam.phase,
          beam.depthSlice,
          0,
        ],
        offset,
      )
      offset += 18
    }
    const gl = this.gl
    gl.useProgram(this.atmosphereProgram)
    gl.bindVertexArray(this.atmosphereVertexArray)
    this.atmosphereGpuCapacityFloats = this.uploadDynamicInstanceData(
      this.atmosphereInstanceBuffer,
      this.atmosphereInstanceData,
      required,
      this.atmosphereGpuCapacityFloats,
    )
    gl.uniform2f(this.atmosphereViewportUniform, viewport.backingWidth, viewport.backingHeight)
    gl.uniform2f(
      this.atmosphereCssToBackingUniform,
      viewport.backingWidth / Math.max(1, viewport.cssWidth),
      viewport.backingHeight / Math.max(1, viewport.cssHeight),
    )
    this.applyAtmosphereUniforms(plan, 'scatter', sliceIndex)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, beams.length)
    gl.bindVertexArray(null)
  }

  private drawForegroundVeil(plan: LaserDmxWebGLAtmosphereRenderPlan, sliceIndex: number): void {
    if (plan.foregroundStrength <= 0.001 || !this.foregroundProgram || !this.fullscreenVertexArray)
      return
    const gl = this.gl
    gl.useProgram(this.foregroundProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    this.applyAtmosphereUniforms(plan, 'foreground', sliceIndex)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  private applyAtmosphereUniforms(
    plan: LaserDmxWebGLAtmosphereRenderPlan,
    pass: 'scatter' | 'foreground',
    sliceIndex: number,
  ): void {
    const gl = this.gl
    this.writeSourceUniformData(plan.sources)
    const sliceCenter = plan.sliceCenters[sliceIndex] ?? 0
    const sliceHalfWidth = 1 / Math.max(1, plan.sliceCount)
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
      gl.uniform4f(
        this.atmosphereDepthSliceUniform,
        sliceCenter,
        sliceHalfWidth,
        plan.extinction,
        sliceIndex,
      )
      gl.uniform1i(this.atmosphereSourceCountUniform, Math.min(MAX_HAZE_SOURCES, plan.sources.length))
      gl.uniform4fv(this.atmosphereSourcePositionUniform, this.sourcePositionData)
      gl.uniform4fv(this.atmosphereSourceDirectionUniform, this.sourceDirectionData)
      gl.uniform4fv(this.atmosphereSourceColorUniform, this.sourceColorData)
      gl.uniform4fv(this.atmosphereSourceDynamicsUniform, this.sourceDynamicsData)
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
    gl.uniform4f(
      this.foregroundDepthSliceUniform,
      sliceCenter,
      sliceHalfWidth,
      plan.extinction,
      sliceIndex,
    )
    gl.uniform1f(this.foregroundStrengthUniform, plan.foregroundStrength)
    gl.uniform1i(this.foregroundNoiseOctavesUniform, plan.noiseOctaves)
    gl.uniform1i(this.foregroundSourceCountUniform, Math.min(MAX_HAZE_SOURCES, plan.sources.length))
    gl.uniform4fv(this.foregroundSourcePositionUniform, this.sourcePositionData)
    gl.uniform4fv(this.foregroundSourceDirectionUniform, this.sourceDirectionData)
    gl.uniform4fv(this.foregroundSourceColorUniform, this.sourceColorData)
    gl.uniform4fv(this.foregroundSourceDynamicsUniform, this.sourceDynamicsData)
  }

  private writeSourceUniformData(sources: readonly LaserDmxWebGLAtmosphereSourceInstance[]): void {
    this.sourcePositionData.fill(0)
    this.sourceDirectionData.fill(0)
    this.sourceColorData.fill(0)
    this.sourceDynamicsData.fill(0)
    for (let index = 0; index < Math.min(MAX_HAZE_SOURCES, sources.length); index += 1) {
      const source = sources[index]!
      const offset = index * 4
      this.sourcePositionData.set(
        [source.position.x, source.position.y, source.position.z, source.density],
        offset,
      )
      this.sourceDirectionData.set(
        [source.direction.x, source.direction.y, source.spread, source.kind === 'co2' ? 1 : 0],
        offset,
      )
      this.sourceColorData.set(
        [source.color.r, source.color.g, source.color.b, source.dissipation],
        offset,
      )
      this.sourceDynamicsData.set(
        [source.ageSec, source.lifetimeSec, source.expansion, source.turbulence],
        offset,
      )
    }
  }

  private drawDepthLayerComposite(
    accumulated: RenderTarget,
    sharp: RenderTarget,
    currentLaser: RenderTarget,
    laserHistory: RenderTarget,
    atmosphere: RenderTarget,
    target: RenderTarget,
    layerExtinction: number,
  ): void {
    if (
      !this.compositeProgram
      || !this.fullscreenVertexArray
      || !target.framebuffer
      || !accumulated.texture
      || !sharp.texture
      || !currentLaser.texture
      || !laserHistory.texture
      || !atmosphere.texture
    ) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.compositeProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, accumulated.texture)
    gl.uniform1i(this.compositeAccumulatedUniform, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, sharp.texture)
    gl.uniform1i(this.compositeSharpUniform, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, currentLaser.texture)
    gl.uniform1i(this.compositeCurrentLaserUniform, 2)
    gl.activeTexture(gl.TEXTURE3)
    gl.bindTexture(gl.TEXTURE_2D, laserHistory.texture)
    gl.uniform1i(this.compositeLaserHistoryUniform, 3)
    gl.activeTexture(gl.TEXTURE4)
    gl.bindTexture(gl.TEXTURE_2D, atmosphere.texture)
    gl.uniform1i(this.compositeAtmosphereUniform, 4)
    gl.uniform1f(this.compositeLayerExtinctionUniform, layerExtinction)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    for (let unit = 0; unit <= 4; unit += 1) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private ensureTemporalTargets(
    width: number,
    height: number,
    plan: LaserDmxTemporalFramePlan,
    sliceCount: number,
    activeSlices: readonly boolean[],
  ): void {
    const activeCount = plan.history.enabled
      ? activeSlices.slice(0, sliceCount).filter(Boolean).length
      : 0
    // Keep the total history allocation no larger than one legacy full-resolution
    // ping-pong pair. More depth slices trade trail resolution for bounded memory;
    // the current laser core remains full resolution in a separate target.
    const memoryBoundScale = activeCount > 0 ? 1 / Math.sqrt(activeCount) : 0
    const effectiveScale = activeCount > 0
      ? Math.min(plan.history.resolutionScale, memoryBoundScale)
      : 0
    this.lastTemporalResolutionScale = effectiveScale
    this.lastLaserHistorySliceCount = activeCount
    const targetWidth = effectiveScale > 0 ? Math.max(32, Math.round(width * effectiveScale)) : 0
    const targetHeight = effectiveScale > 0 ? Math.max(18, Math.round(height * effectiveScale)) : 0
    let resizedExistingTarget = false
    for (let sliceIndex = 0; sliceIndex < MAX_DEPTH_SLICES; sliceIndex += 1) {
      const pair = this.temporalSliceTargets[sliceIndex]!
      const shouldAllocate = sliceIndex < sliceCount
        && plan.history.enabled
        && activeSlices[sliceIndex] === true
      if (!shouldAllocate) {
        this.disposeRenderTarget(pair[0], `temporal-history-${sliceIndex}-0`)
        this.disposeRenderTarget(pair[1], `temporal-history-${sliceIndex}-1`)
        this.temporalReadIndices[sliceIndex] = 0
        this.temporalHistoryValid[sliceIndex] = false
        continue
      }
      const hadTargets = pair.every(target => target.texture != null)
      if (hadTargets && pair.some(target => target.width !== targetWidth || target.height !== targetHeight)) {
        resizedExistingTarget = true
      }
      this.ensureRenderTarget(pair[0], targetWidth, targetHeight, `temporal-history-${sliceIndex}-0`)
      this.ensureRenderTarget(pair[1], targetWidth, targetHeight, `temporal-history-${sliceIndex}-1`)
      if (!hadTargets) {
        this.clearTarget(pair[0])
        this.clearTarget(pair[1])
        this.temporalReadIndices[sliceIndex] = 0
        this.temporalHistoryValid[sliceIndex] = false
      }
    }
    if (resizedExistingTarget) this.clearTemporalHistory()
  }

  private clearTemporalHistory(): void {
    for (let sliceIndex = 0; sliceIndex < MAX_DEPTH_SLICES; sliceIndex += 1) {
      const pair = this.temporalSliceTargets[sliceIndex]!
      this.clearTarget(pair[0])
      this.clearTarget(pair[1])
      this.temporalReadIndices[sliceIndex] = 0
      this.temporalHistoryValid[sliceIndex] = false
    }
  }

  private renderTemporalHistory(
    plan: LaserDmxTemporalFramePlan,
    currentLaserTarget: RenderTarget,
    sliceIndex: number,
  ): RenderTarget {
    if (
      !this.temporalProgram
      || !this.fullscreenVertexArray
      || !currentLaserTarget.texture
    ) return currentLaserTarget
    const pair = this.temporalSliceTargets[sliceIndex]
    if (!pair) return currentLaserTarget
    const readIndex = this.temporalReadIndices[sliceIndex] ?? 0
    const readTarget = pair[readIndex]
    const writeIndex = readIndex === 0 ? 1 : 0
    const writeTarget = pair[writeIndex]
    if (!readTarget.texture || !writeTarget.framebuffer || !writeTarget.texture) {
      return currentLaserTarget
    }

    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeTarget.framebuffer)
    gl.viewport(0, 0, writeTarget.width, writeTarget.height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.temporalProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, currentLaserTarget.texture)
    gl.uniform1i(this.temporalCurrentUniform, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, readTarget.texture)
    gl.uniform1i(this.temporalPreviousUniform, 1)
    gl.uniform1f(this.temporalRetentionUniform, plan.history.retention)
    gl.uniform1f(
      this.temporalHistoryAvailableUniform,
      this.temporalHistoryValid[sliceIndex] && plan.history.enabled ? 1 : 0,
    )
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.temporalReadIndices[sliceIndex] = writeIndex
    this.temporalHistoryValid[sliceIndex] = plan.history.enabled
    return writeTarget
  }

  private ensurePostTargets(
    width: number,
    height: number,
    plan: LaserDmxWebGLPostProcessPlan,
  ): void {
    for (let index = 0; index < this.bloomTargets.length; index += 1) {
      const target = this.bloomTargets[index]!
      const blurTarget = this.bloomBlurTargets[index]!
      const id = `bloom-${index}`
      const blurId = `bloom-blur-${index}`
      if (index >= plan.bloom.levelCount) {
        this.disposeRenderTarget(target, id)
        this.disposeRenderTarget(blurTarget, blurId)
        continue
      }
      const divisor = 2 ** index
      const targetWidth = Math.max(1, Math.floor(width * plan.bloom.baseScale / divisor))
      const targetHeight = Math.max(1, Math.floor(height * plan.bloom.baseScale / divisor))
      this.ensureRenderTarget(target, targetWidth, targetHeight, id)
      this.ensureRenderTarget(blurTarget, targetWidth, targetHeight, blurId)
    }
  }

  private renderPhotographicPost(
    plan: LaserDmxWebGLPostProcessPlan,
    sceneTarget: RenderTarget,
  ): void {
    if (
      !sceneTarget.texture ||
      !this.fullscreenVertexArray ||
      !this.bloomDownsampleProgram ||
      !this.bloomBlurProgram ||
      !this.postCompositeProgram
    )
      return

    let sourceTexture = sceneTarget.texture
    let sourceWidth = sceneTarget.width
    let sourceHeight = sceneTarget.height
    for (let index = 0; index < plan.bloom.levelCount; index += 1) {
      const target = this.bloomTargets[index]!
      const blurTarget = this.bloomBlurTargets[index]!
      if (!target.framebuffer || !target.texture || !blurTarget.framebuffer || !blurTarget.texture) continue
      this.runBloomDownsample(
        sourceTexture,
        sourceWidth,
        sourceHeight,
        target,
        index === 0 ? plan.bloom.threshold : 0,
        index === 0 ? plan.bloom.softKnee : 0.0001,
        index === 0,
      )
      this.runBloomBlur(target.texture, target, blurTarget, plan.bloom.radius, true)
      this.runBloomBlur(blurTarget.texture, blurTarget, target, plan.bloom.radius, false)
      sourceTexture = target.texture
      sourceWidth = target.width
      sourceHeight = target.height
    }

    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, sceneTarget.width, sceneTarget.height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.postCompositeProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture)
    gl.uniform1i(this.postSceneUniform, 0)
    gl.activeTexture(gl.TEXTURE5)
    gl.bindTexture(gl.TEXTURE_2D, sceneTarget.texture)
    gl.uniform1i(this.postTemporalUniform, 5)
    gl.uniform1f(this.postTemporalEnabledUniform, 0)
    const fallbackBloom = this.bloomTargets[0]?.texture ?? sceneTarget.texture
    for (let index = 0; index < 4; index += 1) {
      gl.activeTexture(gl.TEXTURE1 + index)
      gl.bindTexture(gl.TEXTURE_2D, this.bloomTargets[index]?.texture ?? fallbackBloom)
      gl.uniform1i(this.postBloomUniforms[index] ?? null, 1 + index)
    }
    gl.uniform2f(
      this.postResolutionUniform,
      sceneTarget.width,
      sceneTarget.height,
    )
    gl.uniform4f(
      this.postBloomWeightsUniform,
      plan.bloom.levelWeights[0],
      plan.bloom.levelWeights[1],
      plan.bloom.levelWeights[2],
      plan.bloom.levelWeights[3],
    )
    gl.uniform1f(this.postBloomStrengthUniform, plan.bloom.strength)
    gl.uniform2f(
      this.postExposureWashoutUniform,
      plan.toneMapping.exposure,
      plan.washout,
    )
    gl.uniform4f(
      this.postToneParamsUniform,
      plan.toneMapping.whitePoint,
      plan.toneMapping.saturation,
      plan.toneMapping.highlightDesaturation,
      plan.toneMapping.blackClip,
    )
    gl.uniform4f(
      this.postOptics0Uniform,
      plan.optics.glareThreshold,
      plan.optics.glareStrength,
      plan.optics.glareStreakPx,
      plan.optics.glareStarStrength,
    )
    gl.uniform4f(
      this.postOptics1Uniform,
      plan.optics.chromaticThreshold,
      plan.optics.chromaticAmountPx,
      plan.optics.spectralEdgeStrength,
      plan.toneMapping.gamma,
    )
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    for (let unit = 0; unit <= 5; unit += 1) {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
    gl.bindVertexArray(null)
  }

  private runBloomDownsample(
    sourceTexture: WebGLTexture,
    sourceWidth: number,
    sourceHeight: number,
    target: RenderTarget,
    threshold: number,
    knee: number,
    firstPass: boolean,
  ): void {
    if (!this.bloomDownsampleProgram || !target.framebuffer) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.bloomDownsampleProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(this.bloomSourceUniform, 0)
    gl.uniform2f(this.bloomSourceResolutionUniform, sourceWidth, sourceHeight)
    gl.uniform2f(this.bloomThresholdKneeUniform, threshold, knee)
    gl.uniform1f(this.bloomFirstPassUniform, firstPass ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
  }

  private runBloomBlur(
    sourceTexture: WebGLTexture,
    source: RenderTarget,
    target: RenderTarget,
    radius: number,
    horizontal: boolean,
  ): void {
    if (!this.bloomBlurProgram || !target.framebuffer) return
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, target.width, target.height)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.bloomBlurProgram)
    gl.bindVertexArray(this.fullscreenVertexArray)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(this.blurSourceUniform, 0)
    gl.uniform2f(this.blurResolutionUniform, source.width, source.height)
    gl.uniform2f(this.blurDirectionUniform, horizontal ? 1 : 0, horizontal ? 0 : 1)
    gl.uniform1f(this.blurRadiusUniform, radius)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindVertexArray(null)
  }

  private disposeTemporalTargets(): void {
    for (let sliceIndex = 0; sliceIndex < MAX_DEPTH_SLICES; sliceIndex += 1) {
      const pair = this.temporalSliceTargets[sliceIndex]!
      this.disposeRenderTarget(pair[0], `temporal-history-${sliceIndex}-0`)
      this.disposeRenderTarget(pair[1], `temporal-history-${sliceIndex}-1`)
      this.temporalReadIndices[sliceIndex] = 0
      this.temporalHistoryValid[sliceIndex] = false
    }
  }

  private disposePostTargets(): void {
    for (let index = 0; index < this.bloomTargets.length; index += 1) {
      this.disposeRenderTarget(this.bloomTargets[index]!, `bloom-${index}`)
      this.disposeRenderTarget(this.bloomBlurTargets[index]!, `bloom-blur-${index}`)
    }
  }

  private rebuildGpuResources(): void {
    this.disposeGpuResources()
    this.targetStrategy = resolveLaserDmxHdrTargetStrategy(probeLaserDmxWebGLPostCapabilities(this.gl))
    this.qualityController.updateCapabilities({
      hdrAvailable: this.targetStrategy.hdrEnabled,
      maxTextureSize: Number(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)) || 0,
      maxRenderbufferSize: Number(this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE)) || 0,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    })
    this.gpuTimer.reset()
    const postFilter = this.targetStrategy.linearFiltering ? this.gl.LINEAR : this.gl.NEAREST
    this.atmosphereTarget.filter = postFilter
    for (const target of this.compositeTargets) target.filter = postFilter
    for (const pair of this.temporalSliceTargets) {
      pair[0].filter = postFilter
      pair[1].filter = postFilter
    }
    for (const target of [...this.bloomTargets, ...this.bloomBlurTargets]) target.filter = postFilter
    this.exposureController.reset()
    this.temporalController.reset()
    this.temporalHistoryValid.fill(false)
    this.temporalReadIndices.fill(0)
    this.lastPostPlan = null
    this.lastTemporalPlan = null
    this.lastLaserHistorySliceCount = 0
    this.lastTemporalResolutionScale = 0
    this.lastAtmospherePlan = null
    this.lastCpuFrameMs = null
    this.consecutiveRenderFailures = 0
    this.createGpuResources()
  }

  private createGpuResources(): void {
    const gl = this.gl
    this.beamProgram = createProgram(gl, BEAM_VERTEX_SHADER, BEAM_FRAGMENT_SHADER)
    this.apertureProgram = createProgram(gl, APERTURE_VERTEX_SHADER, APERTURE_FRAGMENT_SHADER)
    this.atmosphereProgram = createProgram(gl, ATMOSPHERE_VERTEX_SHADER, ATMOSPHERE_FRAGMENT_SHADER)
    this.foregroundProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, FOREGROUND_FRAGMENT_SHADER)
    this.compositeProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER)
    this.temporalProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, TEMPORAL_HISTORY_FRAGMENT_SHADER)
    this.bloomDownsampleProgram = createProgram(
      gl,
      FULLSCREEN_VERTEX_SHADER,
      BLOOM_DOWNSAMPLE_FRAGMENT_SHADER,
    )
    this.bloomBlurProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, BLOOM_BLUR_FRAGMENT_SHADER)
    this.postCompositeProgram = createProgram(
      gl,
      FULLSCREEN_VERTEX_SHADER,
      POST_COMPOSITE_FRAGMENT_SHADER,
    )
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
    const beamStride = 30 * Float32Array.BYTES_PER_ELEMENT
    enableInstancedAttribute(gl, 1, 3, beamStride, 0)
    enableInstancedAttribute(gl, 2, 3, beamStride, 3 * 4)
    enableInstancedAttribute(gl, 3, 4, beamStride, 6 * 4)
    enableInstancedAttribute(gl, 4, 4, beamStride, 10 * 4)
    enableInstancedAttribute(gl, 5, 4, beamStride, 14 * 4)
    enableInstancedAttribute(gl, 6, 4, beamStride, 18 * 4)
    enableInstancedAttribute(gl, 7, 4, beamStride, 22 * 4)
    enableInstancedAttribute(gl, 8, 4, beamStride, 26 * 4)
    gl.bindVertexArray(null)

    gl.bindVertexArray(this.apertureVertexArray)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureQuadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.apertureInstanceBuffer)
    const apertureStride = 21 * Float32Array.BYTES_PER_ELEMENT
    enableInstancedAttribute(gl, 1, 3, apertureStride, 0)
    enableInstancedAttribute(gl, 2, 4, apertureStride, 3 * 4)
    enableInstancedAttribute(gl, 3, 4, apertureStride, 7 * 4)
    enableInstancedAttribute(gl, 4, 2, apertureStride, 11 * 4)
    enableInstancedAttribute(gl, 5, 4, apertureStride, 13 * 4)
    enableInstancedAttribute(gl, 6, 4, apertureStride, 17 * 4)
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
    this.atmosphereDepthSliceUniform = gl.getUniformLocation(this.atmosphereProgram, 'uDepthSlice')
    this.atmosphereSourceDynamicsUniform = gl.getUniformLocation(
      this.atmosphereProgram,
      'uSourceDynamics[0]',
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
    this.foregroundDepthSliceUniform = gl.getUniformLocation(this.foregroundProgram, 'uDepthSlice')
    this.foregroundSourceDynamicsUniform = gl.getUniformLocation(
      this.foregroundProgram,
      'uSourceDynamics[0]',
    )
    this.compositeAccumulatedUniform = gl.getUniformLocation(this.compositeProgram, 'uAccumulatedTexture')
    this.compositeSharpUniform = gl.getUniformLocation(this.compositeProgram, 'uSharpLightTexture')
    this.compositeCurrentLaserUniform = gl.getUniformLocation(this.compositeProgram, 'uCurrentLaserTexture')
    this.compositeLaserHistoryUniform = gl.getUniformLocation(this.compositeProgram, 'uLaserHistoryTexture')
    this.compositeAtmosphereUniform = gl.getUniformLocation(this.compositeProgram, 'uAtmosphereTexture')
    this.compositeLayerExtinctionUniform = gl.getUniformLocation(this.compositeProgram, 'uLayerExtinction')
    this.temporalCurrentUniform = gl.getUniformLocation(this.temporalProgram, 'uCurrentTexture')
    this.temporalPreviousUniform = gl.getUniformLocation(this.temporalProgram, 'uPreviousTexture')
    this.temporalRetentionUniform = gl.getUniformLocation(this.temporalProgram, 'uRetention')
    this.temporalHistoryAvailableUniform = gl.getUniformLocation(
      this.temporalProgram,
      'uHistoryAvailable',
    )
    this.bloomSourceUniform = gl.getUniformLocation(this.bloomDownsampleProgram, 'uSourceTexture')
    this.bloomSourceResolutionUniform = gl.getUniformLocation(
      this.bloomDownsampleProgram,
      'uSourceResolution',
    )
    this.bloomThresholdKneeUniform = gl.getUniformLocation(
      this.bloomDownsampleProgram,
      'uThresholdKnee',
    )
    this.bloomFirstPassUniform = gl.getUniformLocation(this.bloomDownsampleProgram, 'uFirstPass')
    this.blurSourceUniform = gl.getUniformLocation(this.bloomBlurProgram, 'uSourceTexture')
    this.blurResolutionUniform = gl.getUniformLocation(this.bloomBlurProgram, 'uResolution')
    this.blurDirectionUniform = gl.getUniformLocation(this.bloomBlurProgram, 'uDirection')
    this.blurRadiusUniform = gl.getUniformLocation(this.bloomBlurProgram, 'uRadius')
    this.postSceneUniform = gl.getUniformLocation(this.postCompositeProgram, 'uSceneTexture')
    this.postTemporalUniform = gl.getUniformLocation(this.postCompositeProgram, 'uTemporalTexture')
    this.postTemporalEnabledUniform = gl.getUniformLocation(
      this.postCompositeProgram,
      'uTemporalEnabled',
    )
    this.postBloomUniforms = Array.from({ length: 4 }, (_, index) =>
      gl.getUniformLocation(this.postCompositeProgram!, `uBloom${index}`),
    )
    this.postResolutionUniform = gl.getUniformLocation(this.postCompositeProgram, 'uResolution')
    this.postBloomWeightsUniform = gl.getUniformLocation(this.postCompositeProgram, 'uBloomWeights')
    this.postBloomStrengthUniform = gl.getUniformLocation(this.postCompositeProgram, 'uBloomStrength')
    this.postExposureWashoutUniform = gl.getUniformLocation(
      this.postCompositeProgram,
      'uExposureWashout',
    )
    this.postToneParamsUniform = gl.getUniformLocation(this.postCompositeProgram, 'uToneParams')
    this.postOptics0Uniform = gl.getUniformLocation(this.postCompositeProgram, 'uOptics0')
    this.postOptics1Uniform = gl.getUniformLocation(this.postCompositeProgram, 'uOptics1')
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
    const canRenderFloat = this.targetStrategy.hdrEnabled
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
    this.disposeRenderTarget(this.sharpSliceTarget, 'sharp-slice')
    this.disposeRenderTarget(this.laserSliceTarget, 'laser-slice')
    this.disposeRenderTarget(this.atmosphereTarget, 'atmosphere-slice')
    this.disposeRenderTarget(this.compositeTargets[0], 'depth-composite-0')
    this.disposeRenderTarget(this.compositeTargets[1], 'depth-composite-1')
    this.disposeTemporalTargets()
    this.disposePostTargets()
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
    try {
      if (this.temporalProgram) gl.deleteProgram(this.temporalProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.bloomDownsampleProgram) gl.deleteProgram(this.bloomDownsampleProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.bloomBlurProgram) gl.deleteProgram(this.bloomBlurProgram)
    } catch {
      /* Context may be lost. */
    }
    try {
      if (this.postCompositeProgram) gl.deleteProgram(this.postCompositeProgram)
    } catch {
      /* Context may be lost. */
    }
    this.beamGpuCapacityFloats = 0
    this.apertureGpuCapacityFloats = 0
    this.atmosphereGpuCapacityFloats = 0
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
    this.temporalProgram = null
    this.bloomDownsampleProgram = null
    this.bloomBlurProgram = null
    this.postCompositeProgram = null
    this.temporalCurrentUniform = null
    this.temporalPreviousUniform = null
    this.temporalRetentionUniform = null
    this.temporalHistoryAvailableUniform = null
    this.postTemporalUniform = null
    this.postTemporalEnabledUniform = null
    this.postBloomUniforms = []
    this.lastPostPlan = null
    this.lastTemporalPlan = null
    this.lastLaserHistorySliceCount = 0
    this.lastTemporalResolutionScale = 0
    this.ledger.release('gpu-core')
  }
}
