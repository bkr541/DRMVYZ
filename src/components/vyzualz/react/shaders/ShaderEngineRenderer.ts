import { ShaderWebGLRuntime }         from './runtime/ShaderWebGLRuntime'
import { ShaderPassCompiler }          from './rendergraph/ShaderPassCompiler'
import { ShaderRenderGraph }           from './rendergraph/ShaderRenderGraph'
import { ShaderAudioBridge }           from './audio/ShaderAudioBridge'
import { ShaderSpectrumTexture }       from './audio/ShaderSpectrumTexture'
import { ShaderWaveformTexture }       from './audio/ShaderWaveformTexture'
import { ShaderTextureInputManager }   from './textures/ShaderTextureInputManager'
import { ShaderGradientTextureCache }  from './textures/ShaderGradientTextureCache'
import { ShaderBrandTextureBridge }     from './brand/ShaderBrandTextureBridge'
import { applyShaderBrandUniforms, resolveShaderBrandPalette, resolveShaderColorParam, type ShaderBrandPaletteContext } from './brand/ShaderBrandPersonalization'
import { ShaderModulationEvaluator }   from './modulation/ShaderModulationEvaluator'
import { ShaderModulationMatrix }      from './modulation/ShaderModulationMatrix'
import { ShaderTransitionController }  from './transitions/ShaderTransitionController'
import { ShaderTransitionRenderer }    from './transitions/ShaderTransitionRenderer'
import { ShaderSectionChoreography, type ShaderSectionAction } from './transitions/ShaderSectionChoreography'
import { ShaderPerformanceMonitor }    from './performance/ShaderPerformanceMonitor'
import { ShaderPerformanceRuntime }    from './performance/ShaderPerformanceRuntime'
import { ShaderQualityController }     from './performance/ShaderQualityController'
import { shaderRegistry }              from './registry'
import { useShaderPanelStore }         from './ui/shaderPanelStore'
import { useShaderLibraryStore }       from './library/ShaderLibraryStore'
import { DEFAULT_SHADER_SCENE_ID }     from './scenes'
import { REACTOR_SCENE_ID }            from './scenes/reactor'
import { ShaderFeedbackResetTracker }  from './feedback/ShaderFeedbackResetTracker'
import type { ReactFrameContext }      from '../renderers/reactRenderUtils'
import type {
  ShaderDefinition, ShaderParamValue, RGBA, Vec2, EnumParamDef, GradientStop, QualityTier,
} from './registry/shaderRegistryTypes'
import type { CompiledGraph, RenderGraphError } from './rendergraph/shaderRenderGraphTypes'
import type { ShaderProgram }          from './runtime/ShaderProgram'
import type { ShaderTexSourceSelection, ShaderTextureMeta } from './textures/shaderTextureInputTypes'
import { DEFAULT_TRANSITION, type TransitionDefinition } from './transitions/shaderTransitionTypes'
import { resolveCanvasResolution, type CanvasResolution } from '../rendering/canvasResolution'
import { useBrandKitStore } from '../../../../features/personalization/brandKitStore'
import { getShaderReservedTextureUnits } from './runtime/shaderTextureUnits'
import { buildSharedPerformanceContext, type SharedPerformanceContext } from '../../../../features/performanceCore/context'

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
 * Renderer integration seam kept exported for deterministic unit coverage.
 * The active renderer calls this every frame after Shared Performance Core has
 * resolved authoritative section and transport state.
 */
export function resolveShaderRendererSectionAction(
  choreography: ShaderSectionChoreography,
  context: SharedPerformanceContext,
  reconstruct: boolean,
) {
  return choreography.onSection(
    context.macroSectionType ?? context.sectionType,
    { reconstruct },
  )
}

export type ShaderRendererSectionTransitionMode = 'reconstruct' | 'self' | 'scene'

export interface ShaderRendererSectionTransitionRequest {
  mode: ShaderRendererSectionTransitionMode
  toSceneId: string
  definition: TransitionDefinition
}

/**
 * Convert an authored section action into a concrete renderer request. Seeking
 * reconstructs parameter/feedback state without replaying a transient. A rule
 * targeting the current shader becomes a same-scene compositor effect.
 */
export function resolveShaderRendererSectionTransitionRequest(
  action: ShaderSectionAction | null,
  activeSceneId: string | null,
  reconstruct: boolean,
): ShaderRendererSectionTransitionRequest | null {
  if (!action) return null
  const definition: TransitionDefinition = {
    ...action.transition,
    clearFeedback: action.clearFeedback,
  }
  return {
    mode: reconstruct
      ? 'reconstruct'
      : action.toSceneId === activeSceneId
        ? 'self'
        : 'scene',
    toSceneId: action.toSceneId,
    definition,
  }
}

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
  private readonly _gl:             WebGL2RenderingContext
  private readonly _compiler:       ShaderPassCompiler
  private _graph:                   ShaderRenderGraph       // always the incoming / active executor
  private readonly _audioBridge:    ShaderAudioBridge
  private readonly _specTex:        ShaderSpectrumTexture
  private readonly _waveTex:        ShaderWaveformTexture
  private readonly _texManager:     ShaderTextureInputManager
  private readonly _gradientCache:  ShaderGradientTextureCache
  private readonly _brandTextureBridge: ShaderBrandTextureBridge
  private readonly _modEval:        ShaderModulationEvaluator
  private readonly _matrix:         ShaderModulationMatrix
  private readonly _transCtrl:      ShaderTransitionController
  private readonly _transRend:      ShaderTransitionRenderer
  private readonly _perfMon:        ShaderPerformanceMonitor
  private readonly _qualCtrl:       ShaderQualityController
  private readonly _performanceRuntime: ShaderPerformanceRuntime
  private readonly _sectionChoreography: ShaderSectionChoreography
  private _performanceContext: SharedPerformanceContext | null = null
  private _timingDiscontinuityRevision = 0

  // Current active scene
  private _activeSceneId:   string | null = null
  private _activeDef:       ShaderDefinition | null = null
  private _activeGraph:     CompiledGraph | null = null
  private _graphLoaded      = false  // true after loadGraph() for the current _activeGraph
  private readonly _feedbackResetTracker = new ShaderFeedbackResetTracker()
  private _pendingFeedbackReset = false
  private _lastReactorRecipe: string | null = null

  // Preview graph (kept alive while previewing, disposed on scene switch or reset)
  private _previewGraph:    CompiledGraph | null = null
  private _previewActive    = false

  // Outgoing scene during a transition.
  // `_outgoingExecutor` IS the former `_graph` — it carries its live FBO state.
  private _outgoingExecutor:  ShaderRenderGraph | null = null
  private _outgoingGraph:     CompiledGraph | null = null  // compiled graph stash for cleanup
  private _outgoingDef:       ShaderDefinition | null = null
  private _selfTransitionActive = false
  private _pendingSectionSceneTransition: {
    toSceneId: string
    definition: TransitionDefinition
  } | null = null

  // Cached CSS layout dimensions for quality-change resizes
  private _lastCssW:          number = 0
  private _lastCssH:          number = 0
  private _lastDevicePixelRatio: number = 1
  private _lastResolution:     CanvasResolution | null = null
  private _lastEffectiveScale: number = -1  // detect scale changes each frame
  private _lastEffectiveTier:  QualityTier | null = null

  // Per-frame texture selection diff (avoids stale textures when user removes a selection)
  private _lastAppliedSelections: Map<string, ShaderTexSourceSelection> = new Map()

  // Throttle timestamps for diagnostic store updates (~10Hz for perf/pass, ~5Hz for validation)
  private _lastDiagPublishMs: number = 0
  private _lastValidationPublishMs: number = 0
  private static readonly _DIAG_INTERVAL_MS       = 100  // 10 Hz
  private static readonly _VALIDATION_INTERVAL_MS = 200  //  5 Hz

  private _disposed = false

  constructor(private readonly _runtime: ShaderWebGLRuntime) {
    const gl = _runtime.gl
    this._gl          = gl
    this._compiler       = new ShaderPassCompiler(gl)
    this._graph          = new ShaderRenderGraph(gl)
    this._audioBridge    = new ShaderAudioBridge()
    this._specTex        = new ShaderSpectrumTexture(gl)
    this._waveTex        = new ShaderWaveformTexture(gl)
    this._texManager     = new ShaderTextureInputManager(gl)
    this._gradientCache  = new ShaderGradientTextureCache(gl)
    this._brandTextureBridge = new ShaderBrandTextureBridge(gl)
    this._modEval        = new ShaderModulationEvaluator()
    this._matrix      = new ShaderModulationMatrix()
    this._transCtrl   = new ShaderTransitionController()
    this._transRend   = new ShaderTransitionRenderer(gl)
    this._perfMon     = new ShaderPerformanceMonitor()
    this._qualCtrl    = new ShaderQualityController()
    this._performanceRuntime = new ShaderPerformanceRuntime()
    this._sectionChoreography = new ShaderSectionChoreography()

    // Initialize GPU timer queries immediately so GPU timing works from frame 1
    this._perfMon.initTimerQuery(gl)

    // Wire preview callbacks
    const store = useShaderPanelStore.getState()
    store.setPreviewCompileCallback((fragSrc, vertSrc) => { this.compilePreview(fragSrc, vertSrc) })
    store.setPreviewResetCallback(() => { this.resetPreview() })
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  get effectivePixelRatio(): number {
    return this._runtime.dims.pixelRatio
  }

  resize(cssW: number, cssH: number, devicePixelRatio: number): void {
    if (this._disposed) return
    if (!Number.isFinite(cssW) || !Number.isFinite(cssH) || cssW <= 0 || cssH <= 0) return

    this._lastCssW             = cssW
    this._lastCssH             = cssH
    this._lastDevicePixelRatio = devicePixelRatio
    this._syncQualityProfile()
    this._applyCanvasResolution()
  }

  private _syncQualityProfile(): boolean {
    const qualPref = useShaderLibraryStore.getState().qualityPreference ?? 'auto'
    this._qualCtrl.setTier(qualPref)

    const effectiveTier = this._qualCtrl.effectiveTier
    const scale         = this._qualCtrl.profile.internalResolutionScale
    const changed       = effectiveTier !== this._lastEffectiveTier || scale !== this._lastEffectiveScale

    if (changed) {
      this._lastEffectiveTier  = effectiveTier
      this._lastEffectiveScale = scale
      this._runtime.setResolutionScale(scale)
    }
    return changed
  }

  private _applyCanvasResolution(): boolean {
    if (this._lastCssW <= 0 || this._lastCssH <= 0) return false

    const next = resolveCanvasResolution({
      cssWidth: this._lastCssW,
      cssHeight: this._lastCssH,
      devicePixelRatio: this._lastDevicePixelRatio,
      quality: this._qualCtrl.effectiveTier,
      resolutionScale: this._runtime.resolutionScale,
      previous: this._lastResolution,
    })
    if (!next.valid) return false

    const changed = this._runtime.resize(next)
    this._lastResolution = next
    if (changed) {
      const dims = this._runtime.dims
      this._transRend.resize(dims.W, dims.H)
    }
    return changed
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render(
    frame: ReactFrameContext,
    durationSec: number,
    master: ShaderMasterParams,
  ): void {
    if (this._disposed || this._runtime.contextLost) return

    const t0 = performance.now()

    const store      = useShaderPanelStore.getState()
    const libStore   = useShaderLibraryStore.getState()
    const brandState = useBrandKitStore.getState()

    // ── Scene activation / recompile check ────────────────────────────────
    const requestedId = store.activeShaderId ?? DEFAULT_SHADER_SCENE_ID

    // Forced same-ID recompile (e.g. after the user saves an edited user scene).
    // Must NOT null out _activeSceneId (that loses the old compiled graph pointer
    // and creates a GPU leak).  Instead, recompile in-place.
    const pendingRecompile = store.consumePendingRecompile()
    if (pendingRecompile === requestedId && this._activeSceneId === requestedId) {
      this._recompileActiveScene(store)
    }

    if (requestedId !== this._activeSceneId) {
      this._activateScene(requestedId, store)
    }

    if (!this._activeGraph || !this._activeDef) {
      this._runtime.clearViewport(0, 0, 0, 1)
      return
    }

    // ── Quality ────────────────────────────────────────────────────────────
    // DPR ceiling and internal resolution scale are resolved as one allocation
    // policy so the canvas, viewport, transition captures, and render graph all
    // observe the same integer dimensions.
    if (this._syncQualityProfile()) this._applyCanvasResolution()

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
    const texMap = this._texManager.getTextureMap()

    // Throttle validation publication to ~5 Hz (it doesn't change every frame)
    const nowMs = performance.now()
    if (this._activeSceneId &&
        nowMs - this._lastValidationPublishMs >= ShaderEngineRenderer._VALIDATION_INTERVAL_MS) {
      store.setTextureValidation(this._activeSceneId, this._texManager.validate())
      this._lastValidationPublishMs = nowMs
    }

    // ── Shared Performance Core + native Shader program ───────────────────
    if (frame.timingDiscontinuity) this._timingDiscontinuityRevision += 1
    const previousPerformanceContext = this._performanceContext
    const performanceContext = buildSharedPerformanceContext({
      audioTimeSec: frame.audioTime,
      frame: frame.musicIntelligence,
      analysis: frame.trackAnalysis,
      resolvedSections: frame.trackSections,
      durationSec,
      trackIdentity: frame.trackKey ?? null,
      timingDiscontinuityIdentity: this._timingDiscontinuityRevision,
      previous: previousPerformanceContext,
    })
    this._performanceContext = performanceContext
    const reconstructed = previousPerformanceContext === null
      || performanceContext.seekDetected
      || performanceContext.loopWrapDetected
      || performanceContext.trackReplacementDetected
      || performanceContext.boundaries.timingDiscontinuity
    const sectionType = performanceContext.macroSectionType ?? performanceContext.sectionType
    const choreography = resolveShaderRendererSectionAction(
      this._sectionChoreography,
      performanceContext,
      reconstructed,
    )
    const choreographyAction = choreography
      ? `${sectionType ?? 'unknown'}:${choreography.transition.type}`
      : null
    const sectionTransitionRequest = resolveShaderRendererSectionTransitionRequest(
      choreography,
      this._activeSceneId,
      reconstructed,
    )
    if (reconstructed && this._transCtrl.isTransitioning) {
      this._cancelActiveTransition()
    }
    if (sectionTransitionRequest?.mode === 'reconstruct') {
      if (sectionTransitionRequest.definition.clearFeedback !== 'preserve') {
        if (this._graphLoaded) this._graph.clearFeedbackBuffers()
        else this._pendingFeedbackReset = true
      }
    } else if (sectionTransitionRequest?.mode === 'self') {
      this._startSelfTransition(sectionTransitionRequest.definition)
    } else if (sectionTransitionRequest?.mode === 'scene') {
      this._pendingSectionSceneTransition = {
        toSceneId: sectionTransitionRequest.toSceneId,
        definition: sectionTransitionRequest.definition,
      }
      store.setActiveShaderId(sectionTransitionRequest.toSceneId)
    }

    // ── Modulation ─────────────────────────────────────────────────────────
    const routes = this._activeSceneId
      ? (useShaderPanelStore.getState().routesByShaderId[this._activeSceneId] ?? [])
      : []
    const performanceResolution = this._performanceRuntime.resolve(
      this._activeDef,
      store.paramValues,
      performanceContext,
      routes,
      0,
      choreographyAction,
    )
    this._matrix.fromArray(routes)
    const evalFrame = this._modEval.evaluate(
      this._matrix,
      this._activeDef,
      audioFrame,
      timingFrame,
      performanceResolution.paramValues,
      frameState.deltaTime,
      this._activeSceneId ?? '',
      frame.musicIntelligence,
      performanceContext,
    )
    store.setEvaluationFrame(evalFrame)
    store.setPerformanceSnapshot({
      ...performanceResolution.snapshot,
      activeRouteCount: evalFrame.activeRouteCount,
    })

    const effectiveValues: Record<string, ShaderParamValue> = {}
    const numericModulatedValues: Record<string, number> = {}
    for (const [pid, result] of Object.entries(evalFrame.params)) {
      effectiveValues[pid] = result.effectiveValue
      if (typeof result.effectiveValue === 'number') {
        numericModulatedValues[pid] = result.effectiveValue
      }
    }
    store.setModulatedValues(numericModulatedValues)

    // ── Consume triggered params ───────────────────────────────────────────
    const consumed = store.consumeTriggeredParams()

    // ── Uniform callback ────────────────────────────────────────────────────
    const dims    = this._runtime.dims
    const def     = this._activeDef

    // Graph-owned ping-pong history must obey the same lifecycle contract as
    // the standalone feedback controller. Recipe changes reset only when a
    // named bundle is selected; ordinary slider edits become Custom without
    // destroying useful trails.
    const feedbackResetRequested = this._feedbackResetTracker.update({
      sceneId: this._activeSceneId ?? '',
      trackId: frame.trackKey ?? null,
      playbackTime: timingFrame.playbackTime,
      sectionType: frame.resolvedSection?.type ?? null,
      dropImpact: audioFrame.dropImpact,
      w: dims.W,
      h: dims.H,
    }, def.feedbackReset)
    const currentReactorRecipe = this._activeSceneId === REACTOR_SCENE_ID
      && typeof store.paramValues.recipe === 'string'
      ? store.paramValues.recipe
      : null
    const namedRecipeChanged = currentReactorRecipe !== null
      && currentReactorRecipe !== 'custom'
      && this._lastReactorRecipe !== null
      && currentReactorRecipe !== this._lastReactorRecipe
    this._lastReactorRecipe = currentReactorRecipe

    if (feedbackResetRequested || namedRecipeChanged || performanceResolution.feedbackResetRequested) {
      if (this._graphLoaded) this._graph.clearFeedbackBuffers()
      else this._pendingFeedbackReset = true
    }
    // Build texture metadata snapshot once per frame (not per program)
    const texMeta = this._texManager.getAllMetadata()
    const reservedUnits = getShaderReservedTextureUnits(this._gl)
    const firstGradientUnit = _maxPassInputCount(def)
    const gradientUnits = this._gradientCache.buildUnitMap(
      def,
      store.paramValues,
      this._gl,
      firstGradientUnit,
      reservedUnits.firstReserved,
    )
    const brandContext = resolveShaderBrandPalette(def, effectiveValues, brandState.activeKit)
    this._brandTextureBridge.update(brandState.activeKit, brandState.activeAssets, brandContext.enabled)

    const applyUniforms = (program: ShaderProgram) => {
      this._audioBridge.applyToProgram(program, this._gl, this._specTex, this._waveTex)
      applyShaderBrandUniforms(program, brandContext)
      this._brandTextureBridge.applyToProgram(program)

      program.setVec2('uResolution', dims.W, dims.H)
      program.setFloat('uAspect', dims.aspect)

      program.setFloat('uMasterIntensity',      master.intensity)
      program.setFloat('uMasterMotion',          master.motion)
      program.setFloat('uMasterGlow',            master.glow)
      program.setFloat('uMasterBassReactivity',  master.bassReactivity)
      program.setFloat('uMasterTrailDecay',      master.trailDecay)
      program.setFloat('uMasterFogDensity',      master.fogDensity)
      program.setFloat('uMasterParticleDensity', master.particleDensity)

      _applyParamUniforms(program, this._gl as WebGL2RenderingContext, def, store.paramValues, effectiveValues, consumed, gradientUnits, brandContext)
      _applyTextureMetaUniforms(program, def, texMeta)
    }

    // ── Transition tick ────────────────────────────────────────────────────
    const miFrame     = frame.musicIntelligence
    const transResult = this._transCtrl.tick(frameState.deltaTime * 1000, miFrame)

    // Consume feedback-clear policy when the transition controller fires it
    if (transResult.feedbackClearNow) {
      if (this._graphLoaded) this._graph.clearFeedbackBuffers()
      else this._pendingFeedbackReset = true
      this._outgoingExecutor?.clearFeedbackBuffers()
    }

    const renderingSelfTransition = transResult.shouldRenderDual && this._selfTransitionActive
    const renderingSceneTransition = transResult.shouldRenderDual && this._outgoingExecutor !== null

    // Ensure transition capture FBOs are allocated before either compositor path.
    // Same-scene section effects use the incoming capture as both sources; scene
    // switches continue to preserve the outgoing executor and its feedback state.
    if ((renderingSelfTransition || renderingSceneTransition) && !this._transRend.ensureCaptureTargets()) {
      const allocErr = this._transRend.allocationError
      if (allocErr) store.setCompileError(`Transition FBO: ${allocErr}`)
      this._cancelActiveTransition()
    }

    if (transResult.shouldRenderDual && this._selfTransitionActive) {
      const graphToRender = this._previewActive && this._previewGraph
        ? this._previewGraph
        : this._activeGraph!
      if (!this._graphLoaded) {
        this._graph.loadGraph(graphToRender)
        this._graphLoaded = true
        this._flushPendingFeedbackReset()
      }

      this._graph.setOutputFbo(this._transRend.inCaptureFbo)
      this._graph.execute(dims, texMap, applyUniforms)
      this._graph.setOutputFbo(undefined)

      const tDef = this._transCtrl.activeDefinition ?? DEFAULT_TRANSITION
      const composited = this._transRend.renderComposite(
        tDef.type,
        transResult.progress,
        tDef.intensity,
        tDef.direction,
        tDef.seed,
        dims.W,
        dims.H,
        true,
      )
      if (!composited) {
        const transitionError = this._transRend.getCompileError(tDef.type)
        if (transitionError) store.setCompileError(`Transition ${tDef.type}: ${transitionError}`)
        this._cancelActiveTransition()
        this._graph.execute(dims, texMap, applyUniforms)
      }
    } else if (transResult.shouldRenderDual && this._outgoingExecutor) {
      // ── Dual render: outgoing (stashed executor with FB history) ──────────
      this._outgoingExecutor.setOutputFbo(this._transRend.outCaptureFbo)
      this._outgoingExecutor.execute(dims, texMap, (prog) => {
        this._audioBridge.applyToProgram(prog, this._gl, this._specTex, this._waveTex)
        applyShaderBrandUniforms(prog, brandContext)
        this._brandTextureBridge.applyToProgram(prog)
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
        this._flushPendingFeedbackReset()
      }

      this._graph.setOutputFbo(this._transRend.inCaptureFbo)
      this._graph.execute(dims, texMap, applyUniforms)
      this._graph.setOutputFbo(undefined)

      const tDef = this._transCtrl.activeDefinition ?? DEFAULT_TRANSITION
      const composited = this._transRend.renderComposite(
        tDef.type,
        transResult.progress,
        tDef.intensity,
        tDef.direction,
        tDef.seed,
        dims.W,
        dims.H,
      )
      if (!composited) {
        const transitionError = this._transRend.getCompileError(tDef.type)
        if (transitionError) store.setCompileError(`Transition ${tDef.type}: ${transitionError}`)
        this._cancelActiveTransition()
        this._graph.execute(dims, texMap, applyUniforms)
      }
    } else {
      // ── Normal single-scene render ─────────────────────────────────────
      const graphToRender = this._previewActive && this._previewGraph
        ? this._previewGraph
        : this._activeGraph!

      if (!this._graphLoaded) {
        this._graph.loadGraph(graphToRender)
        this._graphLoaded = true
        this._flushPendingFeedbackReset()
      }

      this._graph.execute(dims, texMap, applyUniforms)
    }

    // ── Transition completion ──────────────────────────────────────────────
    if (transResult.justCompleted) {
      if (this._selfTransitionActive) this._selfTransitionActive = false
      else this._cleanupOutgoing()
    }

    // ── Performance ──────────────────────────────────────────────────────
    this._perfMon.endFrame(this._gl)
    const cpuMs   = performance.now() - cpuStart
    const totalMs = performance.now() - t0

    const graphInfo = this._graph.info

    const estimatedMb = _estimateTextureMbFromPasses(graphInfo.passes)
      + (this._gradientCache.textureCount * 256 * 4) / (1024 * 1024)
      + (this._texManager.ownedTextureCount * 1024) / (1024 * 1024) // rough overhead

    this._perfMon.recordFrame({
      cpuPrepMs:         cpuMs,
      totalMs,
      passCount:         graphInfo.passCount,
      renderTargetCount: graphInfo.pooledResourceCount + this._texManager.ownedTextureCount,
      textureMb:         estimatedMb,
      internalW:         dims.W,
      internalH:         dims.H,
      gl:                this._gl,
    })

    // Auto quality evaluation (only adjusts in 'auto' mode)
    if (this._qualCtrl.selectedTier === 'auto') {
      const changed = this._qualCtrl.evaluate(this._perfMon)
      if (changed && this._lastCssW > 0 && this._lastCssH > 0) {
        const autoScale = this._qualCtrl.profile.internalResolutionScale
        this._lastEffectiveTier  = this._qualCtrl.effectiveTier
        this._lastEffectiveScale = autoScale
        this._runtime.setResolutionScale(autoScale)
        this._applyCanvasResolution()
      }
    }

    // Throttle diagnostic publications to ~10 Hz to prevent 60fps UI rerenders
    const nowDiagMs = performance.now()
    if (nowDiagMs - this._lastDiagPublishMs >= ShaderEngineRenderer._DIAG_INTERVAL_MS) {
      store.setPassInfo(graphInfo.passes)
      store.setPerformanceMetrics(this._perfMon.lastMetrics)
      store.setEffectiveQualityTier(this._qualCtrl.effectiveTier)
      this._lastDiagPublishMs = nowDiagMs
    }

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
      this._publishCompileFailure(this._activeDef, result.error, store)
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
   * Dispose all renderer resources after a real WebGL context loss.
   *
   * The runtime's GL handles are already invalid at this point.
   * `disposeHandlers()` / `dispose()` no longer calls `loseContext()`,
   * so either method is safe here — but `disposeHandlers()` is kept for
   * clarity of intent.
   */
  disposeAfterContextLoss(): void {
    if (this._disposed) return
    this._disposed = true
    this._cleanupCallbacks()
    this._disposeResources()
    this._runtime.disposeHandlers()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _cleanupCallbacks(): void {
    const store = useShaderPanelStore.getState()
    store.setPreviewCompileCallback(null)
    store.setPreviewResetCallback(null)
    store.setPerformanceSnapshot(null)
  }

  private _disposeResources(): void {
    this._graph.dispose()
    this._outgoingExecutor?.dispose()
    this._outgoingExecutor = null
    this._selfTransitionActive = false
    this._pendingSectionSceneTransition = null

    if (this._activeGraph)   ShaderPassCompiler.disposeGraph(this._activeGraph)
    if (this._outgoingGraph) ShaderPassCompiler.disposeGraph(this._outgoingGraph)
    if (this._previewGraph)  ShaderPassCompiler.disposeGraph(this._previewGraph)

    this._specTex.dispose?.()
    this._waveTex.dispose?.()
    this._texManager.dispose?.()
    this._gradientCache.dispose()
    this._brandTextureBridge.dispose()
    this._transRend.dispose()
    this._perfMon.dispose(this._gl)
  }

  /**
   * Recompile the currently active scene in place after its source changed.
   *
   * On success:  replaces `_activeGraph` and reloads `_graph` executor.
   *              Disposes the previous compiled graph exactly once.
   *              Disposes any stale preview graph.
   *              Does NOT start a scene transition.
   *
   * On failure:  leaves the current valid graph in place and continues rendering.
   *              Publishes the compile error.
   */
  private _recompileActiveScene(
    store: ReturnType<typeof useShaderPanelStore.getState>,
  ): void {
    const id  = this._activeSceneId!
    const def = shaderRegistry.get(id)
    if (!def) return

    store.setCompileStatus({ state: 'compiling' })

    const result = this._compiler.compile(def)

    if (result.error || !result.graph) {
      if (result.error) this._publishCompileFailure(def, result.error, store)
      return
    }

    // Dispose stale preview graph
    if (this._previewGraph) {
      ShaderPassCompiler.disposeGraph(this._previewGraph)
      this._previewGraph  = null
      this._previewActive = false
    }

    // Swap compiled graph — dispose old one exactly once
    const oldGraph = this._activeGraph
    this._activeGraph = result.graph
    this._activeDef   = def
    this._graphLoaded = false  // loadGraph() called on next render frame
    this._pendingFeedbackReset = true
    this._feedbackResetTracker.resetTracking()

    if (oldGraph) ShaderPassCompiler.disposeGraph(oldGraph)

    store.setCompileError(null)
    store.setCompileStatus({
      state:        'ok',
      lastOkAt:     new Date().toISOString(),
      compiledDefId: id,
    })
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
      if (result.error) this._publishCompileFailure(def, result.error, store)
      return
    }

    // Discard any preview graph before switching scenes
    if (this._previewGraph) {
      ShaderPassCompiler.disposeGraph(this._previewGraph)
      this._previewGraph  = null
      this._previewActive = false
    }

    const pendingSectionTransition = this._pendingSectionSceneTransition?.toSceneId === id
      ? this._pendingSectionSceneTransition
      : null
    if (this._pendingSectionSceneTransition && !pendingSectionTransition) {
      this._pendingSectionSceneTransition = null
    }

    if (this._activeGraph && this._activeSceneId) {
      // Start a transition: stash the CURRENT executor (with its live FBO state)
      // as the outgoing renderer so feedback history is preserved during the transition.
      this._cleanupOutgoing()
      this._outgoingExecutor = this._graph                  // transfer live executor
      this._outgoingGraph    = this._activeGraph            // keep for cleanup
      this._outgoingDef      = this._activeDef
      this._graph            = new ShaderRenderGraph(this._gl)  // fresh executor for incoming

      const tDef = pendingSectionTransition?.definition ?? DEFAULT_TRANSITION
      this._pendingSectionSceneTransition = null
      this._transCtrl.requestTransition(id, tDef)
      this._transRend.beginTransition(tDef.direction)
    } else {
      this._pendingSectionSceneTransition = null
      this._transCtrl.setActiveScene(id)
    }

    this._activeGraph   = result.graph
    this._activeSceneId = id
    this._activeDef     = def
    this._graphLoaded   = false  // loadGraph() deferred to first render frame
    this._pendingFeedbackReset = def.resetOnActivation === true
    this._feedbackResetTracker.resetTracking()
    this._performanceRuntime.reset()
    this._performanceContext = null
    this._sectionChoreography.reset()
    this._sectionChoreography.enabled = Boolean(def.performanceProgram)
    this._sectionChoreography.setRules([...(def.performanceProgram?.sectionChoreography ?? [])])
    this._sectionChoreography.setCurrentScene(id)
    store.ensureNativeProgram(id)
    this._lastReactorRecipe = id === REACTOR_SCENE_ID
      && typeof store.paramValues.recipe === 'string'
      ? store.paramValues.recipe
      : null

    // Clear previous scene's runtime texture bindings before applying the new
    // scene's selections.  Without this, two scenes sharing the same input name
    // could inherit each other's GPU textures.
    this._texManager.clearAllSelections()
    this._lastAppliedSelections.clear()
    // Gradient textures are scene-specific — clear cache on scene change.
    this._gradientCache.clearAll()

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


  private _startSelfTransition(definition: TransitionDefinition): void {
    const sceneId = this._activeSceneId
    if (!sceneId) return
    this._cleanupOutgoing()
    this._selfTransitionActive = true
    this._transCtrl.requestTransition(sceneId, definition, { allowSameScene: true })
    this._transRend.beginTransition(definition.direction)
  }

  private _cancelActiveTransition(): void {
    if (this._outgoingExecutor || this._outgoingGraph) {
      this._cleanupOutgoing()
      return
    }
    this._selfTransitionActive = false
    this._transCtrl.setActiveScene(this._activeSceneId)
  }

  private _flushPendingFeedbackReset(): void {
    if (!this._pendingFeedbackReset || !this._graphLoaded) return
    this._graph.clearFeedbackBuffers()
    this._pendingFeedbackReset = false
  }

  private _publishCompileFailure(
    def: ShaderDefinition,
    error: RenderGraphError,
    store: ReturnType<typeof useShaderPanelStore.getState>,
  ): void {
    const stage = error.programError?.stage ?? 'render-graph'
    const compilerError = error.programError?.log || error.message || 'Unknown shader compiler error'
    const passLabel = error.passId ? `\nPass: ${error.passId}` : ''
    const annotatedSource = error.programError && 'annotatedSource' in error.programError
      ? error.programError.annotatedSource
      : undefined

    if (import.meta.env.DEV) {
      console.error(
        `[ShaderEngineRenderer] Shader compilation failed\n` +
        `Scene ID: ${def.id}\n` +
        `Scene name: ${def.name}\n` +
        `Shader stage: ${stage}${passLabel}\n` +
        `Compiler error: ${compilerError}`,
        annotatedSource ?? '',
      )
    }

    store.setCompileError(compilerError)
    store.setCompileStatus({
      state: 'error',
      errorLog: compilerError,
      compiledDefId: def.id,
    })
  }

  private _cleanupOutgoing(): void {
    this._selfTransitionActive = false
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
  gl:              WebGL2RenderingContext,
  def:             ShaderDefinition,
  paramValues:     Record<string, ShaderParamValue>,
  effectiveValues: Record<string, ShaderParamValue>,
  consumed:        string[],
  gradientUnits:   ReadonlyMap<string, number>,
  brandContext:    ShaderBrandPaletteContext,
): void {
  for (const param of def.params) {
    const base   = paramValues[param.id] ?? def.defaults[param.id]
    const evaluated = effectiveValues[param.id]

    if (param.type === 'trigger') {
      const triggered = consumed.includes(param.id) || base === true
      program.setFloat(param.uniformName, triggered ? 1.0 : 0.0)
      continue
    }

    const effective: ShaderParamValue = evaluated !== undefined ? evaluated : base

    switch (param.type) {
      case 'float':
      case 'integer':
        program.setFloat(param.uniformName, typeof effective === 'number' ? effective : 0)
        break
      case 'boolean':
        program.setFloat(param.uniformName, effective ? 1.0 : 0.0)
        break
      case 'color': {
        const authored = (effective as RGBA | undefined) ?? [1, 1, 1, 1] as RGBA
        const c = resolveShaderColorParam(authored, param.brandRole, brandContext)
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
        let idx = enumDef.values.findIndex(v => v.value === selected)
        if (idx < 0) {
          // Invalid stored value — fall back to the declared default, not index 0
          idx = enumDef.values.findIndex(v => v.value === enumDef.default)
          if (idx < 0) idx = 0
        }
        if (enumDef.uniformType === 'int') {
          program.setInt(param.uniformName, idx)
        } else {
          program.setFloat(param.uniformName, idx)
        }
        break
      }
      case 'gradient': {
        const unit = gradientUnits.get(param.id)
        if (unit !== undefined) {
          program.setSampler(param.uniformName, unit)
          program.setFloat(param.uniformName + 'StopCount',
            (effective as GradientStop[] | undefined)?.length ?? 0)
        }
        break
      }
      case 'texture':
        // Bound via texture manager
        break
    }
  }
}

function _applyTextureMetaUniforms(
  program:  ShaderProgram,
  def:      ShaderDefinition,
  metaMap:  ReadonlyMap<string, ShaderTextureMeta>,
): void {
  for (const input of (def.textureInputs ?? [])) {
    const meta = metaMap.get(input.name)
    if (!meta) continue
    const base = input.name
    // Optional uniforms — ShaderProgram.setFloat silently skips missing locations
    program.setVec2(base + 'Resolution', meta.w, meta.h)
    program.setFloat(base + 'Aspect', meta.h > 0 ? meta.w / meta.h : 1)
    program.setFloat(base + 'Available', meta.available ? 1.0 : 0.0)
    program.setVec2(base + 'UvScale', meta.uvScaleX, meta.uvScaleY)
    program.setVec2(base + 'UvOffset', meta.uvOffsetX, meta.uvOffsetY)
  }
}


function _maxPassInputCount(def: ShaderDefinition): number {
  if (def.passes && def.passes.length > 0) {
    return def.passes.reduce((max, pass) => Math.max(max, pass.inputs.length), 0)
  }
  return def.textureInputs?.length ?? 0
}

function _estimateTextureMbFromPasses(passes: { dimensions: { w: number; h: number }; pingPong: boolean; persistent: boolean }[]): number {
  // Use actual per-pass dimensions for the estimate.
  // Ping-pong passes own 2 FBOs.
  let bytes = 0
  for (const p of passes) {
    const { w, h } = p.dimensions
    const fboCount = p.pingPong ? 2 : 1
    bytes += w * h * 4 * fboCount
  }
  return bytes / (1024 * 1024)
}
