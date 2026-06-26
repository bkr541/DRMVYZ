import { ShaderCompiler } from '../runtime/ShaderCompiler'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import { FEEDBACK_FRAG_SRC } from '../glsl/feedback.frag'
import type { ShaderPingPongBuffer } from './ShaderPingPongBuffer'
import {
  type FeedbackParams,
  FEEDBACK_BLEND_MODE_INT,
  DEFAULT_FEEDBACK_PARAMS,
} from './shaderFeedbackTypes'

// ── Internal clamp helpers ────────────────────────────────────────────────────

function c01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
function cRange(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// ── ShaderFeedbackPass ────────────────────────────────────────────────────────

/**
 * Compiles and drives the built-in feedback.frag GLSL pass.
 *
 * Each call to execute():
 *   1. Activates the feedback program.
 *   2. Binds scene + previous-feedback + optional noise textures.
 *   3. Sets all FeedbackParams as uniforms (with clamping for safety).
 *   4. Renders to pingPong.writeFbo.
 *
 * Caller is responsible for calling pingPong.swap() after execute().
 *
 * Texture unit assignments:
 *   0 → u_scene
 *   1 → u_feedback  (ping-pong read texture)
 *   2 → u_noise     (optional)
 */
export class ShaderFeedbackPass {
  private _program:  ShaderProgram | null = null
  private _fsPass:   FullscreenPass
  private _disposed  = false

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._fsPass = new FullscreenPass(_gl)
    this._compileProgram()
  }

  private _compileProgram(): void {
    const compiler = new ShaderCompiler(this._gl)
    const result   = ShaderProgram.create(this._gl, compiler, {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: FEEDBACK_FRAG_SRC,
      label:   '__feedback__',
    })

    if (result.program !== null) {
      this._program = result.program
    } else if (import.meta.env.DEV) {
      console.error('[ShaderFeedbackPass] compile failed', result.error)
    }
  }

  get compiled(): boolean { return this._program !== null }

  // ── Execute ───────────────────────────────────────────────────────────────

  /**
   * Run the feedback pass for one frame.
   *
   * @param pingPong  The ping-pong buffer — renders to writeFbo, reads from readTexture.
   * @param sceneTex  The current scene's output texture (sampler unit 0).
   * @param noiseTex  Optional noise texture (sampler unit 2); pass null if unused.
   * @param params    Live feedback parameters (supplied by modulation evaluator).
   * @param w         Target width in pixels.
   * @param h         Target height in pixels.
   */
  execute(
    pingPong: ShaderPingPongBuffer,
    sceneTex: WebGLTexture | null,
    noiseTex: WebGLTexture | null,
    params:   FeedbackParams,
    w:        number,
    h:        number,
  ): void {
    if (!this._program || this._disposed) return
    const gl   = this._gl
    const prog = this._program

    prog.activate()

    // ── Scalar uniforms ──────────────────────────────────────────────────────
    prog.setFloat('u_decay',         c01(params.decay))
    prog.setFloat('u_zoom',          cRange(params.zoom, 0.5, 4.0))
    prog.setFloat('u_rotation',      params.rotation)
    prog.setFloat('u_translationX',  cRange(params.translationX, -1, 1))
    prog.setFloat('u_translationY',  cRange(params.translationY, -1, 1))
    prog.setFloat('u_noiseDisp',     c01(params.noiseDisp))
    prog.setFloat('u_smearAngle',    params.smearAngle)
    prog.setFloat('u_smearStrength', c01(params.smearStrength))
    prog.setFloat('u_chromaticSep',  c01(params.chromaticSep))
    prog.setFloat('u_lumaRetention', c01(params.lumaRetention))
    prog.setFloat('u_saturation',    cRange(params.saturation, 0, 4))
    prog.setFloat('u_brightness',    cRange(params.brightness, 0, 3))
    prog.setFloat('u_freeze',        params.freeze ? 1.0 : 0.0)
    prog.setFloat('u_clearPulse',    c01(params.clearPulse))
    prog.setInt('u_blendMode',       FEEDBACK_BLEND_MODE_INT[params.blendMode] ?? 0)

    // ── Texture bindings ─────────────────────────────────────────────────────
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sceneTex ?? null)
    prog.setSampler('u_scene', 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, pingPong.readTexture)
    prog.setSampler('u_feedback', 1)

    const hasNoise = noiseTex !== null
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, hasNoise ? noiseTex : null)
    prog.setSampler('u_noise', 2)
    prog.setInt('u_hasNoise', hasNoise ? 1 : 0)

    // ── Draw to write FBO ─────────────────────────────────────────────────────
    this._fsPass.run(prog, pingPong.writeFbo, w, h, [], { clear: false })

    // ── Unbind textures ───────────────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._program?.dispose()
    this._program = null
    this._fsPass.dispose()
  }
}

/** Default safe params — re-exported for convenience. */
export { DEFAULT_FEEDBACK_PARAMS }
