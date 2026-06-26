import { ShaderWebGLRuntime }       from './runtime/ShaderWebGLRuntime'
import { ShaderPassCompiler }        from './rendergraph/ShaderPassCompiler'
import { ShaderRenderGraph }         from './rendergraph/ShaderRenderGraph'
import { ShaderAudioBridge }         from './audio/ShaderAudioBridge'
import { ShaderSpectrumTexture }     from './audio/ShaderSpectrumTexture'
import { ShaderWaveformTexture }     from './audio/ShaderWaveformTexture'
import { ShaderTextureInputManager } from './textures/ShaderTextureInputManager'
import { ShaderModulationEvaluator } from './modulation/ShaderModulationEvaluator'
import { ShaderModulationMatrix }    from './modulation/ShaderModulationMatrix'
import { ShaderTransitionController }from './transitions/ShaderTransitionController'
import { ShaderTransitionRenderer }  from './transitions/ShaderTransitionRenderer'
import { ShaderPerformanceMonitor }  from './performance/ShaderPerformanceMonitor'
import { ShaderQualityController }   from './performance/ShaderQualityController'
import { shaderRegistry }            from './registry'
import { useShaderPanelStore }       from './ui/shaderPanelStore'
import { useShaderLibraryStore }     from './library/ShaderLibraryStore'
import { DEFAULT_SHADER_SCENE_ID }   from './scenes'
import type { ReactFrameContext }    from '../renderers/reactRenderUtils'
import type { ShaderDefinition, ShaderParamValue, RGBA, Vec2 } from './registry/shaderRegistryTypes'
import type { CompiledGraph }        from './rendergraph/shaderRenderGraphTypes'
import type { ShaderProgram }        from './runtime/ShaderProgram'

// ── MasterParams ──────────────────────────────────────────────────────────────

export interface ShaderMasterParams {
  intensity:       number
  motion:          number
  glow:            number
  bassReactivity:  number
  trailDecay:      number
  fogDensity:      number
  particleDensity: number
}

// ── ShaderEngineRenderer ──────────────────────────────────────────────────────

/**
 * Top-level integration spine for the GLSL Shader engine.
 *
 * Owns all WebGL subsystems and orchestrates the per-frame pipeline:
 * audio → modulation → uniforms → render → performance → quality.
 *
 * Lifecycle:
 *   1. ShaderWebGLRuntime.create(canvas) → ShaderEngineRenderer(runtime)
 *   2. resize()  (from ResizeObserver in the canvas component)
 *   3. render()  (once per requestAnimationFrame)
 *   4. dispose() (on component unmount)
 *
 * The renderer reads scene selection from useShaderPanelStore (reactive) and
 * publishes compile status, performance metrics, and effective quality back.
 */
export class ShaderEngineRenderer {
  private readonly _gl:          WebGL2RenderingContext
  private readonly _compiler:    ShaderPassCompiler
  private readonly _graph:       ShaderRenderGraph
  private readonly _audioBridge: ShaderAudioBridge
  private readonly _specTex:     ShaderSpectrumTexture
  private readonly _waveTex:     ShaderWaveformTexture
  private readonly _texManager:  ShaderTextureInputManager
  private readonly _modEval:     ShaderModulationEvaluator
  private readonly _matrix:      ShaderModulationMatrix
  private readonly _transCtrl:   ShaderTransitionController
  private readonly _transRend:   ShaderTransitionRenderer
  private readonly _perfMon:     ShaderPerformanceMonitor
  private readonly _qualCtrl:    ShaderQualityController

  // Current compiled state
  private _activeSceneId:    string | null = null
  private _activeDef:        ShaderDefinition | null = null
  private _activeGraph:      CompiledGraph | null = null

  private _disposed = false

  constructor(private readonly _runtime: ShaderWebGLRuntime) {
    const gl = _runtime.gl
    this._gl          = gl
    this._compiler    = new ShaderPassCompiler(gl)
    this._graph       = new ShaderRenderGraph(gl)
    this._audioBridge = new ShaderAudioBridge()
    this._specTex     = new ShaderSpectrumTexture(gl)
    this._waveTex     = new ShaderWaveformTexture(gl)
    this._texManager  = new ShaderTextureInputManager(gl)
    this._modEval     = new ShaderModulationEvaluator()
    this._matrix      = new ShaderModulationMatrix()
    this._transCtrl   = new ShaderTransitionController()
    this._transRend   = new ShaderTransitionRenderer(gl)
    this._perfMon     = new ShaderPerformanceMonitor()
    this._qualCtrl    = new ShaderQualityController()

    // Wire preview compile callback
    useShaderPanelStore.getState().setPreviewCompileCallback((fragSrc, vertSrc) => {
      this.compilePreview(fragSrc, vertSrc)
    })
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  resize(cssW: number, cssH: number, pixelRatio: number): void {
    if (this._disposed) return
    this._runtime.resize(cssW, cssH, pixelRatio)
    const dims = this._runtime.dims
    this._transRend.resize(dims.W, dims.H)
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render(
    frame: ReactFrameContext,
    durationSec: number,
    master: ShaderMasterParams,
  ): void {
    if (this._disposed || this._runtime.contextLost) return

    const t0 = performance.now()

    // Read panel store state
    const store = useShaderPanelStore.getState()
    const libStore = useShaderLibraryStore.getState()

    // ── Scene activation check ─────────────────────────────────────────────
    const requestedId = store.activeShaderId ?? DEFAULT_SHADER_SCENE_ID
    if (requestedId !== this._activeSceneId) {
      this._activateScene(requestedId, store)
    }

    // If still no active graph, bail
    if (!this._activeGraph || !this._activeDef) {
      this._runtime.clearViewport(0, 0, 0, 1)
      return
    }

    // ── Quality ────────────────────────────────────────────────────────────
    const qualPref = libStore.qualityPreference ?? 'auto'
    this._qualCtrl.setTier(qualPref)
    const profile = this._qualCtrl.profile
    this._runtime.setResolutionScale(profile.internalResolutionScale)

    // ── Frame begin ────────────────────────────────────────────────────────
    const frameState = this._runtime.beginFrame()
    if (!frameState) return

    this._perfMon.beginFrame(this._gl)

    const cpuStart = performance.now()

    // ── Audio ──────────────────────────────────────────────────────────────
    this._audioBridge.update(frame, frameState.time, frameState.deltaTime, durationSec)
    const audioFrame  = this._audioBridge.audioFrame
    const timingFrame = this._audioBridge.timingFrame

    this._specTex.update(frame.freqData)
    this._waveTex.update(frame.timeDomainData)
    this._texManager.setAudioTextures(this._specTex.texture, this._waveTex.texture)

    // Publish audio frame to store for modulation panel readouts
    store.setLiveAudioFrame(audioFrame)

    // ── Apply texture selections from store ────────────────────────────────
    // (basic audio textures injected above; user selections are store-driven)

    // ── Texture update ─────────────────────────────────────────────────────
    this._texManager.updateDynamic()
    const texMap = this._texManager.getTextureMap()
    const validation = this._texManager.validate()
    store.setTextureValidation(validation)

    // ── Modulation ─────────────────────────────────────────────────────────
    const routes = store.routesByShaderId[this._activeSceneId ?? ''] ?? []
    this._matrix.fromArray(routes)
    const evalFrame = this._modEval.evaluate(
      this._matrix,
      this._activeDef,
      audioFrame,
      timingFrame,
      store.paramValues,
      frameState.deltaTime,
      this._activeSceneId ?? '',
    )
    store.setEvaluationFrame(evalFrame)

    // Build effective values map from evaluation result
    const modulatedValues: Record<string, number> = {}
    for (const [pid, result] of Object.entries(evalFrame.params)) {
      if (typeof result.effectiveValue === 'number') {
        modulatedValues[pid] = result.effectiveValue
      }
    }
    store.setModulatedValues(modulatedValues)

    // ── Consume triggered params ───────────────────────────────────────────
    const consumed = store.consumeTriggeredParams()

    // ── Uniform callback ────────────────────────────────────────────────────
    const dims = this._runtime.dims
    const def  = this._activeDef

    const applyUniforms = (program: ShaderProgram) => {
      // Audio + timing uniforms
      this._audioBridge.applyToProgram(program, this._gl, this._specTex, this._waveTex)

      // Resolution
      program.setVec2?.('uResolution', dims.W, dims.H)
      try { (program as unknown as { setFloat2?: (n: string, x: number, y: number) => void }).setFloat2?.('uResolution', dims.W, dims.H) } catch {}
      program.setFloat('uAspect', dims.aspect)

      // Master controls
      program.setFloat('uMasterIntensity',      master.intensity)
      program.setFloat('uMasterMotion',          master.motion)
      program.setFloat('uMasterGlow',            master.glow)
      program.setFloat('uMasterBassReactivity',  master.bassReactivity)
      program.setFloat('uMasterTrailDecay',      master.trailDecay)
      program.setFloat('uMasterFogDensity',      master.fogDensity)
      program.setFloat('uMasterParticleDensity', master.particleDensity)

      // Shader parameters — use effective (modulated) value when available
      for (const param of def.params) {
        const base   = store.paramValues[param.id] ?? def.defaults[param.id]
        const effNum = modulatedValues[param.id]

        // Triggers: true for one frame, then consumed
        if (param.type === 'trigger') {
          const triggered = consumed.includes(param.id) || base === true
          program.setFloat(param.uniformName, triggered ? 1.0 : 0.0)
          continue
        }

        const effective: ShaderParamValue = effNum !== undefined ? effNum : base

        switch (param.type) {
          case 'float':
          case 'integer':
            program.setFloat(param.uniformName, typeof effective === 'number' ? effective : (param as { default: number }).default)
            break
          case 'boolean':
            program.setFloat(param.uniformName, effective ? 1.0 : 0.0)
            break
          case 'color': {
            const c = (effective as RGBA | undefined) ?? [1, 1, 1, 1] as RGBA
            _setVec4(program, this._gl, param.uniformName, c[0], c[1], c[2], c[3])
            break
          }
          case 'vec2': {
            const v = (effective as Vec2 | undefined) ?? [0, 0] as Vec2
            _setVec2(program, this._gl, param.uniformName, v[0], v[1])
            break
          }
          case 'enum':
            program.setFloat(param.uniformName, 0)
            break
          case 'gradient':
            // Gradients require texture encoding — not handled in the uniform path
            break
          case 'texture':
            // Bound via texture manager
            break
        }
      }
    }

    // ── Render ────────────────────────────────────────────────────────────
    this._graph.loadGraph(this._activeGraph)
    this._graph.execute(dims, texMap, applyUniforms)

    // ── Performance ──────────────────────────────────────────────────────
    this._perfMon.endFrame(this._gl)
    const cpuMs   = performance.now() - cpuStart
    const totalMs = performance.now() - t0

    this._perfMon.recordFrame({
      cpuPrepMs:         cpuMs,
      totalMs,
      passCount:         this._activeGraph.passes.length,
      renderTargetCount: 1,
      textureMb:         0,
      internalW:         dims.W,
      internalH:         dims.H,
      gl:                this._gl,
    })

    // Auto quality
    if (this._qualCtrl.effectiveTier !== undefined) {
      const changed = this._qualCtrl.evaluate(this._perfMon)
      if (changed) {
        const newScale = this._qualCtrl.profile.internalResolutionScale
        this._runtime.setResolutionScale(newScale)
        this._runtime.resize(0, 0, 1) // re-apply scale with current CSS size
      }
      store.setEffectiveQualityTier(this._qualCtrl.effectiveTier)
    }

    const metrics = this._perfMon.lastMetrics
    store.setPerformanceMetrics(metrics)

    // ── Frame end ─────────────────────────────────────────────────────────
    this._runtime.endFrame()
  }

  // ── Preview compile (from ShaderCodeEditor) ───────────────────────────────

  compilePreview(fragSrc: string, vertSrc?: string): void {
    if (!this._activeDef) return
    const store = useShaderPanelStore.getState()
    store.setCompileStatus({ state: 'compiling' })
    const previewDef: ShaderDefinition = {
      ...this._activeDef,
      fragSrc,
      vertSrc: vertSrc ?? 'shared',
      passes:  [],
    }
    const result = this._compiler.compile(previewDef)
    if (result.error) {
      store.setCompileStatus({
        state:    'error',
        errorLog: result.error.programError?.log ?? result.error.message,
        compiledDefId: this._activeDef.id,
      })
      store.setCompileError(result.error.message)
    } else {
      store.setCompileStatus({
        state:        'ok',
        lastOkAt:     new Date().toISOString(),
        compiledDefId: this._activeDef.id,
      })
      store.setCompileError(null)
      if (result.graph) {
        ShaderPassCompiler.disposeGraph(result.graph)
      }
    }
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true

    useShaderPanelStore.getState().setPreviewCompileCallback(null)

    this._graph.dispose()
    if (this._activeGraph)   ShaderPassCompiler.disposeGraph(this._activeGraph)

    this._specTex.dispose?.()
    this._waveTex.dispose?.()
    this._texManager.dispose?.()
    this._transRend.dispose()
    this._perfMon.dispose(this._gl)
    this._runtime.dispose()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _activateScene(id: string, store: ReturnType<typeof useShaderPanelStore.getState>): void {
    const def = shaderRegistry.get(id)
    if (!def) {
      if (import.meta.env.DEV) console.warn(`[ShaderEngineRenderer] scene not found: ${id}`)
      return
    }

    store.setCompileStatus({ state: 'compiling' })

    const result = this._compiler.compile(def)

    if (result.error || !result.graph) {
      const msg = result.error?.programError?.log ?? result.error?.message ?? 'compile failed'
      store.setCompileError(msg)
      store.setCompileStatus({
        state:        'error',
        errorLog:     msg,
        compiledDefId: id,
      })
      // Keep previous valid scene active
      return
    }

    // Dispose previous graph
    if (this._activeGraph) {
      ShaderPassCompiler.disposeGraph(this._activeGraph)
    }

    this._activeGraph    = result.graph
    this._activeSceneId  = id
    this._activeDef      = def

    this._graph.loadGraph(result.graph)
    this._texManager.setDefinition(def)
    this._matrix.setDefinition(def)
    this._qualCtrl.setSceneQualityRequirements(def.quality)

    store.setCompileError(null)
    store.setCompileStatus({
      state:        'ok',
      lastOkAt:     new Date().toISOString(),
      compiledDefId: id,
    })
  }
}

// ── Uniform helpers ───────────────────────────────────────────────────────────

function _setVec4(
  program: ShaderProgram,
  gl: WebGL2RenderingContext,
  name: string,
  r: number, g: number, b: number, a: number,
): void {
  // ShaderProgram may have setVec4 or we fall back to the raw GL uniform
  const p = program as unknown as Record<string, unknown>
  if (typeof p['setVec4'] === 'function') {
    (p['setVec4'] as Function)(name, r, g, b, a)
    return
  }
  // Fallback: look up location and set directly
  const loc = (program as unknown as { _getUniformLocation?: (n: string) => WebGLUniformLocation | null })._getUniformLocation?.(name)
  if (loc != null) gl.uniform4f(loc, r, g, b, a)
}

function _setVec2(
  program: ShaderProgram,
  gl: WebGL2RenderingContext,
  name: string,
  x: number, y: number,
): void {
  const p = program as unknown as Record<string, unknown>
  if (typeof p['setVec2'] === 'function') {
    (p['setVec2'] as Function)(name, x, y)
    return
  }
  const loc = (program as unknown as { _getUniformLocation?: (n: string) => WebGLUniformLocation | null })._getUniformLocation?.(name)
  if (loc != null) gl.uniform2f(loc, x, y)
}
