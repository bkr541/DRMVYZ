import { ShaderFramebuffer } from '../runtime/ShaderFramebuffer'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../runtime/FullscreenPass'
import { ShaderProgram } from '../runtime/ShaderProgram'
import { ShaderCompiler } from '../runtime/ShaderCompiler'
import type { TransitionType, TransitionDirection } from './shaderTransitionTypes'

import { CROSSFADE_FRAG_SRC }          from '../glsl/transitions/crossfade.frag'
import { LUMA_DISSOLVE_FRAG_SRC }      from '../glsl/transitions/luma-dissolve.frag'
import { NOISE_DISSOLVE_FRAG_SRC }     from '../glsl/transitions/noise-dissolve.frag'
import { RADIAL_WIPE_FRAG_SRC }        from '../glsl/transitions/radial-wipe.frag'
import { PIXEL_SCATTER_FRAG_SRC }      from '../glsl/transitions/pixel-scatter.frag'
import { RGB_SPLIT_DISSOLVE_FRAG_SRC } from '../glsl/transitions/rgb-split-dissolve.frag'
import { LIQUID_MELT_FRAG_SRC }        from '../glsl/transitions/liquid-melt.frag'
import { ZOOM_TUNNEL_FRAG_SRC }        from '../glsl/transitions/zoom-tunnel.frag'
import { FEEDBACK_COLLAPSE_FRAG_SRC }  from '../glsl/transitions/feedback-collapse.frag'
import { FLASH_CUT_FRAG_SRC }          from '../glsl/transitions/flash-cut.frag'

const FRAG_SOURCES: Record<TransitionType, string> = {
  'crossfade':           CROSSFADE_FRAG_SRC,
  'luma-dissolve':       LUMA_DISSOLVE_FRAG_SRC,
  'noise-dissolve':      NOISE_DISSOLVE_FRAG_SRC,
  'radial-wipe':         RADIAL_WIPE_FRAG_SRC,
  'pixel-scatter':       PIXEL_SCATTER_FRAG_SRC,
  'rgb-split-dissolve':  RGB_SPLIT_DISSOLVE_FRAG_SRC,
  'liquid-melt':         LIQUID_MELT_FRAG_SRC,
  'zoom-tunnel':         ZOOM_TUNNEL_FRAG_SRC,
  'feedback-collapse':   FEEDBACK_COLLAPSE_FRAG_SRC,
  'flash-cut':           FLASH_CUT_FRAG_SRC,
}

// ── ShaderTransitionRenderer ──────────────────────────────────────────────────

/**
 * WebGL rendering layer for shader-to-shader transitions.
 *
 * Owns two capture FBOs (one for the outgoing scene, one for the incoming)
 * and a lazily-compiled set of transition shader programs.
 *
 * Usage per transition frame:
 *   1. outGraph.setOutputFbo(renderer.outCaptureFbo) — redirect outgoing scene
 *   2. Render outgoing scene via its ShaderRenderGraph
 *   3. inGraph.setOutputFbo(renderer.inCaptureFbo)   — redirect incoming scene
 *   4. Render incoming scene via its ShaderRenderGraph
 *   5. outGraph.setOutputFbo(undefined); inGraph.setOutputFbo(undefined)
 *   6. renderer.renderComposite(type, progress, intensity, direction, seed, w, h)
 */
export class ShaderTransitionRenderer {
  private readonly _compiler: ShaderCompiler
  private readonly _outFbo:   ShaderFramebuffer
  private readonly _inFbo:    ShaderFramebuffer
  private readonly _fsPass:   FullscreenPass
  private readonly _programs  = new Map<TransitionType, ShaderProgram>()
  private _compileErrors      = new Map<TransitionType, string>()
  private _disposed = false

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._compiler = new ShaderCompiler(_gl)
    this._outFbo   = new ShaderFramebuffer(_gl, { format: 'rgba8', filter: 'linear', wrap: 'clamp' })
    this._inFbo    = new ShaderFramebuffer(_gl, { format: 'rgba8', filter: 'linear', wrap: 'clamp' })
    this._fsPass   = new FullscreenPass(_gl)
  }

  // ── Capture FBO handles ───────────────────────────────────────────────────

  /** Framebuffer to redirect the outgoing scene output into. */
  get outCaptureFbo(): WebGLFramebuffer | null { return this._outFbo.framebuffer }
  /** Framebuffer to redirect the incoming scene output into. */
  get inCaptureFbo():  WebGLFramebuffer | null { return this._inFbo.framebuffer }

  /** Texture containing the captured outgoing scene. */
  get outTexture(): WebGLTexture | null { return this._outFbo.texture }
  /** Texture containing the captured incoming scene. */
  get inTexture():  WebGLTexture | null { return this._inFbo.texture }

  // ── Resize ────────────────────────────────────────────────────────────────

  resize(w: number, h: number): void {
    if (this._disposed) return
    this._outFbo.resize(w, h)
    this._inFbo.resize(w, h)
  }

  // ── Composite render ──────────────────────────────────────────────────────

  /**
   * Composite outgoing (A) and incoming (B) scenes using the selected
   * transition shader.  Renders to the default framebuffer (screen).
   *
   * Returns false if the shader program could not be compiled.
   */
  renderComposite(
    type:      TransitionType,
    progress:  number,
    intensity: number,
    direction: TransitionDirection,
    seed:      number,
    w:         number,
    h:         number,
  ): boolean {
    if (this._disposed) return false

    const prog = this._getOrCompile(type)
    if (!prog) return false

    const texA = this._outFbo.texture
    const texB = this._inFbo.texture
    if (!texA || !texB) return false

    const clampedProgress = Math.max(0, Math.min(1, progress))

    prog.activate()
    prog.setFloat('uTransitionProgress', clampedProgress)
    prog.setFloat('u_intensity', Math.max(0, Math.min(1, intensity)))
    prog.setFloat('u_seed', seed)
    prog.setInt('u_direction', direction === 'backward' ? 1 : 0)

    this._fsPass.run(prog, null, w, h, [
      { unit: 0, texture: texA, uniformName: 'u_texA' },
      { unit: 1, texture: texB, uniformName: 'u_texB' },
    ])

    return true
  }

  // ── Disposal ──────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return
    this._disposed = true
    this._outFbo.dispose()
    this._inFbo.dispose()
    this._fsPass.dispose()
    for (const prog of this._programs.values()) prog.dispose()
    this._programs.clear()
    this._compileErrors.clear()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _getOrCompile(type: TransitionType): ShaderProgram | null {
    const existing = this._programs.get(type)
    if (existing) return existing
    if (this._compileErrors.has(type)) return null

    const fragSrc = FRAG_SOURCES[type]
    if (!fragSrc) return null

    const result = ShaderProgram.create(this._gl, this._compiler, {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc,
      label:   `transition:${type}`,
      optionalUniforms: ['u_intensity', 'u_seed', 'u_direction'],
    })

    if (result.error) {
      this._compileErrors.set(type, result.error.log)
      return null
    }

    this._programs.set(type, result.program!)
    return result.program!
  }
}
