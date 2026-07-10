import { ShaderPingPongBuffer } from './ShaderPingPongBuffer'
import { ShaderFeedbackPass } from './ShaderFeedbackPass'
import {
  type FeedbackParams,
  type FeedbackResetConfig,
  type FeedbackFrameSignals,
  DEFAULT_FEEDBACK_PARAMS,
} from './shaderFeedbackTypes'
import { ShaderFeedbackResetTracker } from './ShaderFeedbackResetTracker'

// ── ShaderFeedbackController ──────────────────────────────────────────────────

/**
 * High-level feedback manager for the built-in Shader feedback effect.
 *
 * Owns one ShaderPingPongBuffer and one ShaderFeedbackPass.
 * Tracks cross-frame state to detect reset conditions and automatically
 * clears the buffer when any configured condition fires.
 *
 * Beat-aware usage: the caller evaluates the modulation matrix and passes the
 * resulting FeedbackParams directly — no hard-coded audio mappings live here.
 *
 * Typical frame loop:
 *   1. Evaluate modulation → params.
 *   2. controller.update(signals, config) — may trigger an auto-reset.
 *   3. controller.execute(sceneTex, noiseTex, params, w, h).
 *   4. Pass controller.readTexture to the composite / blit pass.
 */
export class ShaderFeedbackController {
  private readonly _pingPong: ShaderPingPongBuffer
  private readonly _pass:     ShaderFeedbackPass

  private readonly _resetTracker = new ShaderFeedbackResetTracker()

  private _disposed = false

  constructor(gl: WebGL2RenderingContext) {
    this._pingPong = new ShaderPingPongBuffer(gl)
    this._pass     = new ShaderFeedbackPass(gl)
  }

  // ── Reset logic ───────────────────────────────────────────────────────────

  /**
   * Check reset conditions and clear the ping-pong buffer if any fire.
   * Call once per frame before execute().
   *
   * @param signals  Per-frame signals derived from audio + scene state.
   * @param config   Which conditions to watch for (merged with defaults).
   */
  update(signals: FeedbackFrameSignals, config: FeedbackResetConfig = {}): void {
    if (this._disposed) return

    if (this._resetTracker.update(signals, config)) this.reset()
  }

  // ── Execute ───────────────────────────────────────────────────────────────

  /**
   * Run the feedback pass for one frame.
   * Call update() first to handle auto-resets.
   *
   * @param sceneTex  The current scene's output texture.
   * @param noiseTex  Optional noise texture for displacement.
   * @param params    Live feedback parameters (from modulation evaluator).
   * @param w         Render width in pixels.
   * @param h         Render height in pixels.
   */
  execute(
    sceneTex: WebGLTexture | null,
    noiseTex: WebGLTexture | null,
    params:   FeedbackParams,
    w:        number,
    h:        number,
  ): void {
    if (this._disposed) return

    this._pingPong.resize(w, h)

    // When frozen, skip the draw and let the buffer hold its current state.
    if (params.freeze) {
      this._pingPong.freeze()
      return
    }
    this._pingPong.unfreeze()

    this._pass.execute(this._pingPong, sceneTex, noiseTex, params, w, h)
    this._pingPong.swap()
  }

  // ── Manual reset ──────────────────────────────────────────────────────────

  /**
   * Manually clear the feedback buffer.
   * Also resets the unfrozen state.
   */
  reset(): void {
    if (this._disposed) return
    this._pingPong.unfreeze()
    this._pingPong.clear()
  }

  // ── Output ────────────────────────────────────────────────────────────────

  /**
   * The current feedback result texture.
   * After execute() + swap() this is the freshly written feedback frame.
   * Bind this to the composite / blit pass.
   */
  get readTexture(): WebGLTexture | null {
    return this._pingPong.readTexture
  }

  get pingPong(): ShaderPingPongBuffer { return this._pingPong }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._pingPong.dispose()
    this._pass.dispose()
  }
}

/** Safe default params for initialising a feedback controller. */
export { DEFAULT_FEEDBACK_PARAMS }
