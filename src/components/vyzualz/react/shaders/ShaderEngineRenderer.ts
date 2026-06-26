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

  // Current active scene
  private _activeSceneId:   string | null = null
  private _activeDef:       ShaderDefinition | null = null
  private _activeGraph:     CompiledGraph | null = null
  private _graphLoaded      = false  // true after loadGraph() for the current _activeGraph

  // Preview graph (kept alive while previewing, disposed on scene switch or reset)
  private _previewGraph:    CompiledGraph | null = null
  private _previewActive    = false

  // Outgoing scene during a transition
  private _outgoingGraph:   CompiledGraph | null = null
  private _outgoingDef:     ShaderDefinition | null = null
  private _outgoingGraph2:  ShaderRenderGraph | null = null  // second render graph for outgoing

  // Cached CSS layout dimensions for quality-change resizes
  private _lastCssW:        number = 0
  private _lastCssH:        number = 0
  private _lastPixelRatio:  number = 1

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

    store.setLiveAudioFrame(audioFrame)

    // ── Apply texture selections from store ────────────────────────────────
    if (this._activeSceneId) {
      const selections = store.textureSelectionsByShaderId[this._activeSceneId] ?? {}
      for (const [inputName, sel] of Object.entries(selections)) {
        this._texManager.setSelection(inputName, sel)
      }
      // Clear any selections that were removed
      const def = this._activeDef
      if (def?.textureInputs) {
        const knownInputs = new Set(def.textureInputs.map(ti => ti.name))
        for (const inputName of Object.keys(selections)) {
          if (!knownInputs.has(inputName)) {
            this._texManager.clearSelection(inputName)
          }
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
    const miFrame    = frame.musicIntelligence
    const transResult = this._transCtrl.tick(frameState.deltaTime * 1000, miFrame)

    if (transResult.shouldRenderDual && this._outgoingGraph && this._outgoingDef) {
      // ── Dual render: outgoing → capture, incoming → capture, composite ───
      const outGraph = this._outgoingGraph2
      if (outGraph) {
        outGraph.setOutputFbo(this._transRend.outCaptureFbo)
        outGraph.execute(dims, texMap, (prog) => {
          // Apply uniforms for outgoing scene
          this._audioBridge.applyToProgram(prog, this._gl, this._specTex, this._waveTex)
          prog.setVec2?.('uResolution', dims.W, dims.H)
          prog.setFloat('uAspect', dims.aspect)
          _applyMasterUniforms(prog, master)
        })
        outGraph.setOutputFbo(undefined)
      }

      const activeGraphForCapture = this._previewActive && this._previewGraph
        ? this._previewGraph
        : this._activeGraph!
      this._graph.setOutputFbo(this._transRend.inCaptureFbo)
      this._graph.execute(dims, texMap, applyUniforms)
      this._graph.setOutputFbo(undefined)

      // Composite to screen
      const tDef = DEFAULT_TRANSITION
      this._transRend.renderComposite(
        tDef.type,
        transResult.progress,
        tDef.intensity,
        tDef.direction,
        tDef.seed,
        dims.W,
        dims.H,
      )

      void activeGraphForCapture
    } else {
      // ── Normal single-scene render ─────────────────────────────────────
      const graphToRender = this._previewActive && this._previewGraph
        ? this._previewGraph
        : this._activeGraph!

      // Load the graph only if it changed (not every frame)
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

    // Auto quality
    if (this._qualCtrl.effectiveTier !== undefined) {
      const changed = this._qualCtrl.evaluate(this._perfMon)
      if (changed && this._lastCssW > 0 && this._lastCssH > 0) {
        const newScale = this._qualCtrl.profile.internalResolutionScale
        this._runtime.setResolutionScale(newScale)
        this._runtime.resize(this._lastCssW, this._lastCssH, this._lastPixelRatio)
        const newDims = this._runtime.dims
        this._transRend.resize(newDims.W, newDims.H)
      }
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

    useShaderPanelStore.getState().setPreviewCompileCallback(null)

    this._graph.dispose()
    this._outgoingGraph2?.dispose()

    if (this._activeGraph)   ShaderPassCompiler.disposeGraph(this._activeGraph)
    if (this._outgoingGraph) ShaderPassCompiler.disposeGraph(this._outgoingGraph)
    if (this._previewGraph)  ShaderPassCompiler.disposeGraph(this._previewGraph)

    this._specTex.dispose?.()
    this._waveTex.dispose?.()
    this._texManager.dispose?.()
    this._transRend.dispose()
    this._perfMon.dispose(this._gl)
    this._runtime.dispose()
  }

  // ── Private ───────────────────────────────────────────────────────────────

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
      // Keep previous valid scene active
      return
    }

    // Discard any preview graph before switching scenes
    if (this._previewGraph) {
      ShaderPassCompiler.disposeGraph(this._previewGraph)
      this._previewGraph  = null
      this._previewActive = false
    }

    if (this._activeGraph && this._activeSceneId) {
      // Start a transition: stash outgoing graph for dual-scene rendering
      this._cleanupOutgoing()
      this._outgoingGraph  = this._activeGraph
      this._outgoingDef    = this._activeDef
      this._outgoingGraph2 = new ShaderRenderGraph(this._gl)
      this._outgoingGraph2.loadGraph(this._outgoingGraph)
      this._transCtrl.requestTransition(id, DEFAULT_TRANSITION)
      this._transRend.beginTransition(DEFAULT_TRANSITION.direction)
    } else {
      // No outgoing scene — skip transition
      this._transCtrl.setActiveScene(id)
    }

    this._activeGraph   = result.graph
    this._activeSceneId = id
    this._activeDef     = def
    this._graphLoaded   = false  // will loadGraph() on next render()

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
    if (this._outgoingGraph) {
      ShaderPassCompiler.disposeGraph(this._outgoingGraph)
      this._outgoingGraph = null
      this._outgoingDef   = null
    }
    if (this._outgoingGraph2) {
      this._outgoingGraph2.dispose()
      this._outgoingGraph2 = null
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
        // Upload the index of the selected value in the options array
        const enumDef = param as EnumParamDef
        const selected = typeof effective === 'string' ? effective : enumDef.default
        const idx = enumDef.values.findIndex(v => v.value === selected)
        program.setFloat(param.uniformName, Math.max(0, idx))
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
  // Each FBO has one RGBA8 texture: 4 bytes per pixel
  const bytesPerFbo = w * h * 4
  const totalBytes  = fboCount * bytesPerFbo
  return totalBytes / (1024 * 1024)
}
