import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  type TransitionDefinition,
  type TransitionPhase,
  type TransitionTickResult,
  type ActiveTransitionState,
  type FeedbackClearTiming,
  DEFAULT_TRANSITION,
  IDLE_TRANSITION,
  applyEasing,
} from './shaderTransitionTypes'

// ── ShaderTransitionController ────────────────────────────────────────────────

/**
 * State machine for Shader-engine scene transitions.
 *
 * Manages transition phases (idle → waiting → active → done) and handles all
 * safety scenarios: scene switch during transition, re-selecting the active
 * scene, context loss, resize, track change, and playback stop.
 *
 * This controller is pure state — it does NOT own any WebGL resources.
 * Rendering is the caller's responsibility (see ShaderTransitionRenderer).
 *
 * Typical per-frame call:
 *   const result = controller.tick(deltaMs, musicFrame)
 *   if (result.shouldRenderDual) { ... dual-scene capture + composite ... }
 *   else { ... normal single-scene render ... }
 */
export class ShaderTransitionController {
  private _state:            ActiveTransitionState = { ...IDLE_TRANSITION }
  private _currentSceneId:   string | null = null
  private _compileError:     string | null = null
  private _disposed          = false

  // Timing state used by trigger matching
  private _lastBeatIndex:    number = -1
  private _lastBarIndex:     number = -1
  private _lastSectionType:  string | null = null
  private _lastPhrase16Hit:  boolean = false
  private _contextLost       = false

  // ── Current scene access ──────────────────────────────────────────────────

  get currentSceneId():    string | null           { return this._currentSceneId }
  get incomingSceneId():   string | null           { return this._state.phase !== 'idle' ? this._state.toSceneId : null }
  get phase():             TransitionPhase         { return this._state.phase }
  get progress():          number                  { return this._state.progressEased }
  get isTransitioning():   boolean                 { return this._state.phase === 'active' || this._state.phase === 'waiting' }
  get compileError():      string | null           { return this._compileError }
  /** The transition definition currently driving an active/waiting transition. Null when idle. */
  get activeDefinition():  TransitionDefinition | null {
    return this._state.phase !== 'idle' ? this._state.definition : null
  }

  // ── Scene activation (without transition) ─────────────────────────────────

  /**
   * Set the active scene without any transition.
   * Call on initial scene load or when transitions are disabled.
   */
  setActiveScene(sceneId: string | null): void {
    this._currentSceneId = sceneId
    this._abortPending()
    this._compileError = null
  }

  // ── Transition request ────────────────────────────────────────────────────

  /**
   * Request a transition from the current scene to `toSceneId`.
   *
   * Safety behaviors:
   * - Re-selecting the current scene: no-op.
   * - Requesting a new transition while one is active: abort old, start new.
   * - If `toSceneId` === `fromSceneId`: treat as no-op.
   */
  requestTransition(toSceneId: string, def: TransitionDefinition = DEFAULT_TRANSITION): void {
    if (this._disposed) return

    // No-op: re-selecting the scene that's already displayed
    if (toSceneId === this._currentSceneId && this._state.phase === 'idle') return

    // Scene switch during active: abandon the old pending/active transition,
    // use the current displayed scene as the new outgoing.
    if (this._state.phase === 'active' || this._state.phase === 'waiting') {
      // If we're mid-transition, the "from" becomes whatever the current rendered state is.
      // Keep _currentSceneId as the from since that's what's last stably rendered.
      this._abortPending()
    }

    this._compileError = null
    this._state = {
      ...IDLE_TRANSITION,
      phase:          def.startTrigger === 'immediate' ? 'active' : 'waiting',
      fromSceneId:    this._currentSceneId,
      toSceneId,
      definition:     def,
      lastBarIndex:   this._lastBarIndex,
      lastSectionType: this._lastSectionType,
    }
  }

  /**
   * Report that the incoming scene failed to compile.
   * The controller falls back to the outgoing (current) scene and surfaces the error.
   */
  reportIncomingCompileFailure(error: string): void {
    this._compileError = error
    this._abortPending()
  }

  // ── Per-frame tick ────────────────────────────────────────────────────────

  /**
   * Advance the transition state by `deltaMs` milliseconds.
   *
   * @param deltaMs   Time since the last frame in milliseconds. Clamped to [0, 100].
   * @param frame     Current Music Intelligence frame (may be null when audio is stopped).
   * @returns         What happened this frame and what the caller should render.
   */
  tick(deltaMs: number, frame: MusicIntelligenceFrame | null): TransitionTickResult {
    const dt = Math.max(0, Math.min(deltaMs, 100))
    let triggerFired   = false
    let justCompleted  = false
    let feedbackClearNow: FeedbackClearTiming | null = null

    // ── Update rhythm tracking ─────────────────────────────────────────────
    const rhythm  = frame?.rhythm  ?? null
    const section = frame?.section ?? null
    const currentBeatIndex   = rhythm?.beatIndex   ?? this._lastBeatIndex
    const currentBarIndex    = rhythm?.barIndex    ?? this._lastBarIndex
    const currentSectionType = section?.type       ?? this._lastSectionType

    const beatHit      = rhythm?.beatHit      ?? false
    const downbeatHit  = rhythm?.downbeatHit  ?? false
    const phrase16Hit  = rhythm?.phrase16Hit  ?? false
    const barChanged   = currentBarIndex  !== this._lastBarIndex  && currentBarIndex  > 0
    const sectionChanged = currentSectionType !== this._lastSectionType

    // ── Phase: waiting ─────────────────────────────────────────────────────
    if (this._state.phase === 'waiting') {
      const trigger = this._state.definition.startTrigger
      let shouldFire = false

      switch (trigger) {
        case 'immediate':
          shouldFire = true
          break
        case 'next-beat':
          shouldFire = beatHit && currentBeatIndex !== this._lastBeatIndex
          break
        case 'next-downbeat':
          shouldFire = downbeatHit
          break
        case 'next-bar':
          shouldFire = barChanged
          break
        case 'next-phrase':
          shouldFire = phrase16Hit && !this._lastPhrase16Hit
          break
        case 'next-section':
          shouldFire = sectionChanged
          break
      }

      if (shouldFire) {
        this._state = { ...this._state, phase: 'active', elapsedMs: 0 }
        triggerFired = true

        // Feed clear at start
        if (this._state.definition.clearFeedback === 'at-start') {
          feedbackClearNow = 'at-start'
        }
      }
    }

    // ── Phase: active ──────────────────────────────────────────────────────
    if (this._state.phase === 'active') {
      this._state.elapsedMs += dt

      const raw   = this._state.definition.durationMs > 0
        ? this._state.elapsedMs / this._state.definition.durationMs
        : 1
      const clamped = Math.max(0, Math.min(1, raw))
      const eased   = applyEasing(clamped, this._state.definition.easing)

      this._state.progressRaw    = clamped
      this._state.progressEased  = eased

      // Feedback clear at midpoint
      const clearAt = this._state.definition.clearFeedback
      if (clearAt === 'at-midpoint' && eased >= 0.5 && !this._state.feedbackMidpointFired) {
        this._state.feedbackMidpointFired = true
        feedbackClearNow = 'at-midpoint'
      }

      // Completion
      if (clamped >= 1) {
        if (clearAt === 'at-completion') feedbackClearNow = 'at-completion'
        this._currentSceneId = this._state.toSceneId
        this._state = { ...this._state, phase: 'done', progressRaw: 1, progressEased: 1 }
        justCompleted = true
      }
    }

    // ── Phase: done ────────────────────────────────────────────────────────
    if (this._state.phase === 'done') {
      this._state = { ...IDLE_TRANSITION }
    }

    // ── Advance tracking ───────────────────────────────────────────────────
    this._lastBeatIndex   = currentBeatIndex
    this._lastBarIndex    = currentBarIndex
    this._lastSectionType = currentSectionType
    this._lastPhrase16Hit = phrase16Hit

    return {
      triggerFired,
      justCompleted,
      feedbackClearNow,
      fromSceneId:      this._state.phase !== 'idle' ? this._state.fromSceneId : null,
      toSceneId:        this._state.phase !== 'idle' ? this._state.toSceneId   : null,
      phase:            this._state.phase,
      progress:         this._state.progressEased,
      shouldRenderDual: this._state.phase === 'active',
    }
  }

  // ── Safety handlers ───────────────────────────────────────────────────────

  /** Resize during transition — caller must resize the ShaderTransitionRenderer too. */
  onResize(w: number, h: number): void {
    // State machine doesn't own FBOs; caller resizes the renderer.
    // Transition continues with correct dimensions automatically.
    void w; void h
  }

  /** WebGL context lost. Abort all transitions; caller must dispose and recreate. */
  onContextLost(): void {
    this._contextLost = true
    this._abortPending()
  }

  /** WebGL context restored. Caller should recreate the renderer. */
  onContextRestored(): void {
    this._contextLost = false
  }

  /** Track changed. Abort any waiting or active transition. */
  onTrackChange(): void {
    this._abortPending()
    this._lastBeatIndex   = -1
    this._lastBarIndex    = -1
    this._lastSectionType = null
  }

  /** Playback stopped. Abort any waiting transition; keep active if in progress. */
  onPlaybackStop(): void {
    if (this._state.phase === 'waiting') this._abortPending()
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    this._disposed = true
    this._abortPending()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _abortPending(): void {
    if (this._state.phase !== 'idle') {
      // When aborting an active transition mid-flight, snap to the incoming
      // scene if progress is past the midpoint; otherwise keep the outgoing scene.
      if (this._state.phase === 'active' && this._state.progressEased >= 0.5) {
        this._currentSceneId = this._state.toSceneId
      }
      this._state = { ...IDLE_TRANSITION }
    }
  }
}
