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
import type { ShaderDefinition, ShaderParamValue, RGBA, Vec2, EnumParamDef } from './registry/shaderRegistryTypes'
import type { CompiledGraph }        from './rendergraph/shaderRenderGraphTypes'
import type { ShaderProgram }        from './runtime/ShaderProgram'
import type { ShaderTexSourceSelection } from './textures/shaderTextureInputTypes'
import { DEFAULT_TRANSITION }        from './transitions/shaderTransitionTypes'

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
 *
 * Transition architecture:
 *   - When a scene switch starts, the CURRENT `_graph` executor (with its live
 *     FBO/ping-pong state) is stashed as `_outgoingExecutor` so the outgoing
 *     scene's feedback history is preserved.
 *   - A fresh `_graph` executor is created for the incoming scene.
 *   - During dual-render frames: outgoing renders to outCapture, incoming renders
 *     to inCapture, compositor blends them to screen.
 *   - On completion, `_outgoingExecutor` is disposed and `_graph` continues as
 *     the single live executor.
 */
export class ShaderEngineRenderer {
  private readonly _gl:          WebGL2RenderingContext
  private readonly _compiler:    ShaderPassCompiler
  private _graph:                ShaderRenderGraph       // always the incoming / active executor
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

  // Current active scene
  private _activeSceneId:   string | null = null
  private _activeDef:       ShaderDefinition | null = null
  private _activeGraph:     CompiledGraph | null = null
  private _graphLoaded      = false  // true after loadGraph() for the current _activeGraph

  // Preview graph (kept alive while previewing, disposed on scene switch or reset)
  private _previewGraph:    CompiledGraph | null = null
  private _previewActive    = false

  // Outgoing scene during a transition.
  // `_outgoingExecutor` IS the former `_graph` — it carries its live FBO state.
  private _outgoingExecutor:  ShaderRenderGraph | null = null
  private _outgoingGraph:     CompiledGraph | null = null  // compiled graph stash for cleanup
  private _outgoingDef:       ShaderDefinition | null = null

  // Cached CSS layout dimensions for quality-change resizes
  private _lastCssW:          number = 0
  private _lastCssH:          number = 0
  private _lastPixelRatio:    number = 1
  private _lastEffectiveScale: number = -1  // detect scale changes each frame

  // Per-frame texture selection diff (avoids stale textures when user removes a selection)
  private _lastAppliedSelections: Map<string, ShaderTexSourceSelection> = new Map()

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

    // Initialize GPU timer queries immediately so GPU timing works from frame 1
    this._perfMon.initTimerQuery(gl)

    // Wire preview callbacks
    const store = useShaderPanelStore.getState()
    store.setPreviewCompileCallback((fragSrc, vertSrc) => { this.compilePreview(fragSrc, vertSrc) })
    store.setPreviewResetCallback(() => { this.resetPreview() })
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  resize(cssW: number, cssH: number, pixelRatio: number): void {
    if (this._disposed) return
    this._lastCssW       = cssW
    this._lastCssH       = cssH
    this._lastPixelRatio = pixelRatio
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

    const store    = useShaderPanelStore.getState()
    const libStore = useShaderLibraryStore.getState()

    // ── Scene activation check ─────────────────────────────────────────────
    const requestedId = store.activeShaderId ?? DEFAULT_SHADER_SCENE_ID

    // Check for forced recompile (e.g. after user-scene update with same ID)
    const pendingRecompile = store.consumePendingRecompile()
    if (pendingRecompile === requestedId) {
      // Force reactivation even though the ID hasn't changed
      this._activeSceneId = null
    }

    if (requestedId !== this._activeSceneId) {
      this._activateScene(requestedId, store)
    }

    if (!this._activeGraph || !this._activeDef) {
      this._runtime.clearViewport(0, 0, 0, 1)
      return
    }

    // ── Quality ────────────────────────────────────────────────────────────
    const qualPref = libStore.qualityPreference ?? 'auto'
    this._qualCtrl.setTier(qualPref)
    const profile    = this._qualCtrl.profile
    const newScale   = profile.internalResolutionScale
    if (newScale !== this._lastEffectiveScale) {
      // Quality changed (manual tier switch OR initial frame) — resize canvas
      this._lastEffectiveScale = newScale
      this._runtime.setResolutionScale(newScale)
      if (this._lastCssW > 0 && this._lastCssH > 0) {
        this._runtime.resize(this._lastCssW, this._lastCssH, this._lastPixelRatio)
        const newDims = this._runtime.dims
        this._transRend.resize(newDims.W, newDims.H)
      }
    }

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

    store.setLiveAudioFrame(audioFrame)

    // ── Apply texture selections from store — diff against last-applied ────
    if (this._activeSceneId) {
      const selections = store.textureSelectionsByShaderId[this._activeSceneId] ?? {}

      // Apply current selections
      for (const [inputName, sel] of Object.entries(selections)) {
        this._texManager.setSelection(inputName, sel)
        this._lastAppliedSelections.set(inputName, sel)
      }

      // Clear any inputs that were previously applied but are no longer in the store
      for (const inputName of [...this._lastAppliedSelections.keys()]) {
        if (!(inputName in selections)) {
          this._texManager.clearSelection(inputName)
          this._lastAppliedSelections.delete(inputName)
        }
      }
    }

    // ── Texture update ─────────────────────────────────────────────────────
    this._texManager.updateDynamic()
    const texMap     = this._texManager.getTextureMap()
    const validation = this._texManager.validate()
    if (this._activeSceneId) {
      store.setTextureValidation(this._activeSceneId, validation)
    }

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
      this._audioBridge.applyToProgram(program, this._gl, this._specTex, this._waveTex)

      program.setVec2('uResolution', dims.W, dims.H)
      program.setFloat('uAspect', dims.aspect)

      program.setFloat('uMasterIntensity',      master.intensity)
      program.setFloat('uMasterMotion',          master.motion)
      program.setFloat('uMasterGlow',            master.glow)
      program.setFloat('uMasterBassReactivity',  master.bassReactivity)
      program.setFloat('uMasterTrailDecay',      master.trailDecay)
      program.setFloat('uMasterFogDensity',      master.fogDensity)
      program.setFloat('uMasterParticleDensity', master.particleDensity)

      _applyParamUniforms(program, this._gl as WebGL2RenderingContext, def, store.paramValues, modulatedValues, consumed)
    }

    // ── Transition tick ────────────────────────────────────────────────────
    const miFrame     = frame.musicIntelligence
    const transResult = this._transCtrl.tick(frameState.deltaTime * 1000, miFrame)

    // Consume feedback-clear policy when the transition controller fires it
    if (transResult.feedbackClearNow) {
      this._graph.clearFeedbackBuffers()
      this._outgoingExecutor?.clearFeedbackBuffers()
    }

    if (transResult.shouldRenderDual && this._outgoingExecutor) {
      // ── Dual render: outgoing (stashed executor with FB history) ──────────
      this._outgoingExecutor.setOutputFbo(this._transRend.outCaptureFbo)
      this._outgoingExecutor.execute(dims, texMap, (prog) => {
        this._audioBridge.applyToProgram(prog, this._gl, this._specTex, this._waveTex)
        prog.setVec2('uResolution', dims.W, dims.H)
        prog.setFloat('uAspect', dims.aspect)
        _applyMasterUniforms(prog, master)
      })
      this._outgoingExecutor.setOutputFbo(undefined)

      // Incoming: load the graph if not yet done (first transition frame)
      if (!this._graphLoaded) {
        const incomingCompiledGraph = this._previewActive && this._previewGraph
          ? this._previewGraph
          : this._activeGraph!
        this._graph.loadGraph(incomingCompiledGraph)
        this._graphLoaded = true
      }

      this._graph.setOutputFbo(this._transRend.inCaptureFbo)
      this._graph.execute(dims, texMap, applyUniforms)
      this._graph.setOutputFbo(undefined)

      // Composite to screen using the ACTUAL transition definition (not always DEFAULT)
      const tDef = this._transCtrl.activeDefinition ?? DEFAULT_TRANSITION
      this._transRend.renderComposite(
        tDef.type,
        transResult.progress,
        tDef.intensity,
        tDef.direction,
        tDef.seed,
        dims.W,
        dims.H,
      )
    } else {
      // ── Normal single-scene render ─────────────────────────────────────
      const graphToRender = this._previewActive && this._previewGraph
        ? this._previewGraph
        : this._activeGraph!

      if (!this._graphLoaded) {
        this._graph.loadGraph(graphToRender)
        this._graphLoaded = true
      }

      this._graph.execute(dims, texMap, applyUniforms)
    }

    // ── Transition completion ──────────────────────────────────────────────
    if (transResult.justCompleted) {
      this._cleanupOutgoing()
    }

    // ── Performance ──────────────────────────────────────────────────────
    this._perfMon.endFrame(this._gl)
    const cpuMs   = performance.now() - cpuStart
    const totalMs = performance.now() - t0

    const graphInfo = this._graph.info
    store.setPassInfo(graphInfo.passes)

    this._perfMon.recordFrame({
      cpuPrepMs:         cpuMs,
      totalMs,
      passCount:         graphInfo.passCount,
      renderTargetCount: graphInfo.pooledResourceCount,
      textureMb:         _estimateTextureMb(graphInfo.pooledResourceCount, dims.W, dims.H),
      internalW:         dims.W,
      internalH:         dims.H,
      gl:                this._gl,
    })

    // Auto quality evaluation (only adjusts in 'auto' mode)
    if (this._qualCtrl.selectedTier === 'auto') {
      const changed = this._qualCtrl.evaluate(this._perfMon)
      if (changed && this._lastCssW > 0 && this._lastCssH > 0) {
        const autoScale = this._qualCtrl.profile.internalResolutionScale
        this._lastEffectiveScale = autoScale
        this._runtime.setResolutionScale(autoScale)
        this._runtime.resize(this._lastCssW, this._lastCssH, this._lastPixelRatio)
        const newDims = this._runtime.dims
        this._transRend.resize(newDims.W, newDims.H)
      }
      store.setEffectiveQualityTier(this._qualCtrl.effectiveTier)
    } else {
      store.setEffectiveQualityTier(this._qualCtrl.effectiveTier)
    }

    store.setPerformanceMetrics(this._perfMon.lastMetrics)
    this._runtime.endFrame()
  }

  // ── Preview compile (from ShaderCodeEditor) ───────────────────────────────

  /**
   * Compile `fragSrc` into a temporary preview graph.
   * If compilation succeeds, the preview is rendered instead of the saved graph.
   * On failure, the previous valid graph (saved or preview) continues.
   * Call resetPreview() to return to the saved scene graph.
   */
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
      const msg = result.error.programError?.log ?? result.error.message
      store.setCompileStatus({
        state:         'error',
        errorLog:      msg,
        compiledDefId: this._activeDef.id,
      })
      store.setCompileError(msg)
      return
    }

    // Dispose previous preview graph if any
    if (this._previewGraph) {
      this._graph.loadGraph(this._activeGraph!)  // reload saved to free old preview bindings
      ShaderPassCompiler.disposeGraph(this._previewGraph)
    }

    this._previewGraph  = result.graph!
    this._previewActive = true
    this._graph.loadGraph(this._previewGraph)
    this._graphLoaded = true

    store.setCompileStatus({
      state:        'ok',
      lastOkAt:     new Date().toISOString(),
      compiledDefId: this._activeDef.id,
    })
    store.setCompileError(null)
  }

  /** Discard the preview graph and return to the saved scene graph. */
  resetPreview(): void {
    if (!this._previewGraph) return
    ShaderPassCompiler.disposeGraph(this._previewGraph)
    this._previewGraph  = null
    this._previewActive = false
    if (this._activeGraph) {
      this._graph.loadGraph(this._activeGraph)
      this._graphLoaded = true
    }
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._cleanupCallbacks()
    this._disposeResources()
    this._runtime.dispose()
  }

  /**
   * Dispose all renderer resources WITHOUT calling `_runtime.dispose()`.
   * Use inside an `onContextRestored` handler where the old runtime's GL
   * handles are already invalid — calling `loseContext()` would re-lose the
   * freshly restored context.
   */
  disposeAfterContextLoss(): void {
    if (this._disposed) return
    this._disposed = true
    this._cleanupCallbacks()
    this._disposeResources()
    // Deregister the runtime's event listeners without calling loseContext()
    this._runtime.disposeHandlers()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _cleanupCallbacks(): void {
    const store = useShaderPanelStore.getState()
    store.setPreviewCompileCallback(null)
    store.setPreviewResetCallback(null)
  }

  private _disposeResources(): void {
    this._graph.dispose()
    this._outgoingExecutor?.dispose()
    this._outgoingExecutor = null

    if (this._activeGraph)   ShaderPassCompiler.disposeGraph(this._activeGraph)
    if (this._outgoingGraph) ShaderPassCompiler.disposeGraph(this._outgoingGraph)
    if (this._previewGraph)  ShaderPassCompiler.disposeGraph(this._previewGraph)

    this._specTex.dispose?.()
    this._waveTex.dispose?.()
    this._texManager.dispose?.()
    this._transRend.dispose()
    this._perfMon.dispose(this._gl)
  }

  private _activateScene(
    id: string,
    store: ReturnType<typeof useShaderPanelStore.getState>,
  ): void {
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
      store.setCompileStatus({ state: 'error', errorLog: msg, compiledDefId: id })
      return
    }

    // Discard any preview graph before switching scenes
    if (this._previewGraph) {
      ShaderPassCompiler.disposeGraph(this._previewGraph)
      this._previewGraph  = null
      this._previewActive = false
    }

    if (this._activeGraph && this._activeSceneId) {
      // Start a transition: stash the CURRENT executor (with its live FBO state)
      // as the outgoing renderer so feedback history is preserved during the transition.
      this._cleanupOutgoing()
      this._outgoingExecutor = this._graph                  // transfer live executor
      this._outgoingGraph    = this._activeGraph            // keep for cleanup
      this._outgoingDef      = this._activeDef
      this._graph            = new ShaderRenderGraph(this._gl)  // fresh executor for incoming

      const tDef = DEFAULT_TRANSITION
      this._transCtrl.requestTransition(id, tDef)
      this._transRend.beginTransition(tDef.direction)
    } else {
      this._transCtrl.setActiveScene(id)
    }

    this._activeGraph   = result.graph
    this._activeSceneId = id
    this._activeDef     = def
    this._graphLoaded   = false  // loadGraph() deferred to first render frame

    // Reset texture diff state on scene change
    this._lastAppliedSelections.clear()

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

  private _cleanupOutgoing(): void {
    if (this._outgoingExecutor) {
      this._outgoingExecutor.dispose()
      this._outgoingExecutor = null
    }
    if (this._outgoingGraph) {
      ShaderPassCompiler.disposeGraph(this._outgoingGraph)
      this._outgoingGraph = null
      this._outgoingDef   = null
    }
    this._transCtrl.setActiveScene(this._activeSceneId)
  }
}

// ── Uniform helpers ───────────────────────────────────────────────────────────

function _applyMasterUniforms(program: ShaderProgram, master: ShaderMasterParams): void {
  program.setFloat('uMasterIntensity',      master.intensity)
  program.setFloat('uMasterMotion',          master.motion)
  program.setFloat('uMasterGlow',            master.glow)
  program.setFloat('uMasterBassReactivity',  master.bassReactivity)
  program.setFloat('uMasterTrailDecay',      master.trailDecay)
  program.setFloat('uMasterFogDensity',      master.fogDensity)
  program.setFloat('uMasterParticleDensity', master.particleDensity)
}

function _applyParamUniforms(
  program:         ShaderProgram,
  _gl:             WebGL2RenderingContext,
  def:             ShaderDefinition,
  paramValues:     Record<string, ShaderParamValue>,
  modulatedValues: Record<string, number>,
  consumed:        string[],
): void {
  for (const param of def.params) {
    const base   = paramValues[param.id] ?? def.defaults[param.id]
    const effNum = modulatedValues[param.id]

    if (param.type === 'trigger') {
      const triggered = consumed.includes(param.id) || base === true
      program.setFloat(param.uniformName, triggered ? 1.0 : 0.0)
      continue
    }

    const effective: ShaderParamValue = effNum !== undefined ? effNum : base

    switch (param.type) {
      case 'float':
      case 'integer':
        program.setFloat(param.uniformName, typeof effective === 'number' ? effective : 0)
        break
      case 'boolean':
        program.setFloat(param.uniformName, effective ? 1.0 : 0.0)
        break
      case 'color': {
        const c = (effective as RGBA | undefined) ?? [1, 1, 1, 1] as RGBA
        program.setVec4(param.uniformName, c[0], c[1], c[2], c[3])
        break
      }
      case 'vec2': {
        const v = (effective as Vec2 | undefined) ?? [0, 0] as Vec2
        program.setVec2(param.uniformName, v[0], v[1])
        break
      }
      case 'enum': {
        const enumDef = param as EnumParamDef
        const selected = typeof effective === 'string' ? effective : enumDef.default
        const idx = enumDef.values.findIndex(v => v.value === selected)
        // Upload as int when the def requests it; default to float for GLSL float uniforms
        const numericValue = Math.max(0, idx)
        if (enumDef.uniformType === 'int') {
          program.setInt?.(param.uniformName, numericValue)
        } else {
          program.setFloat(param.uniformName, numericValue)
        }
        break
      }
      case 'gradient':
        // Gradient textures require a separate texture encoding pass; not yet wired.
        break
      case 'texture':
        // Bound via texture manager
        break
    }
  }
}


function _estimateTextureMb(fboCount: number, w: number, h: number): number {
  const bytesPerFbo = w * h * 4
  const totalBytes  = fboCount * bytesPerFbo
  return totalBytes / (1024 * 1024)
}
