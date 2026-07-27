import type { BlendMode } from '../registry/shaderRegistryTypes'
import type { TextureBinding, GeometryPassInput } from '../runtime/shaderRuntimeTypes'
import type { ShaderProgram } from '../runtime/ShaderProgram'
import type { CompiledPassNode, RenderPassInfo } from './shaderRenderGraphTypes'
import { FullscreenPass } from '../runtime/FullscreenPass'
import type { GeometryPass } from '../runtime/GeometryPass'

const EMPTY_GEOMETRY: GeometryPassInput = { data: new Float32Array(0), count: 0 }

// ── Blend state ───────────────────────────────────────────────────────────────

export interface ResolvedBlendState {
  enabled: boolean
  sfactor: number
  dfactor: number
}

/**
 * Compute the GL source/destination blend factors for a BlendMode.
 * Accepts a gl-constants-compatible object so this can be tested without a
 * real WebGL context.
 *
 * Blend mode → GL equation:
 *   none      gl.disable(BLEND)                     — full replacement
 *   alpha     SRC_ALPHA / ONE_MINUS_SRC_ALPHA        — standard alpha over
 *   additive  ONE / ONE                              — light-add
 *   multiply  DST_COLOR / ZERO                       — darkens destination
 *   screen    ONE / ONE_MINUS_SRC_COLOR              — invert-multiply-invert
 */
export function resolveBlendState(
  gl: Pick<WebGL2RenderingContext,
    'ONE' | 'ZERO' | 'SRC_ALPHA' | 'ONE_MINUS_SRC_ALPHA' |
    'DST_COLOR' | 'ONE_MINUS_SRC_COLOR'>,
  mode: BlendMode,
): ResolvedBlendState {
  switch (mode) {
    case 'none':
      return { enabled: false, sfactor: gl.ONE, dfactor: gl.ZERO }
    case 'alpha':
      return { enabled: true, sfactor: gl.SRC_ALPHA, dfactor: gl.ONE_MINUS_SRC_ALPHA }
    case 'additive':
      return { enabled: true, sfactor: gl.ONE, dfactor: gl.ONE }
    case 'multiply':
      return { enabled: true, sfactor: gl.DST_COLOR, dfactor: gl.ZERO }
    case 'screen':
      return { enabled: true, sfactor: gl.ONE, dfactor: gl.ONE_MINUS_SRC_COLOR }
  }
}

export function applyBlendState(gl: WebGL2RenderingContext, state: ResolvedBlendState): void {
  if (state.enabled) {
    gl.enable(gl.BLEND)
    gl.blendFunc(state.sfactor, state.dfactor)
  } else {
    gl.disable(gl.BLEND)
  }
}

export function restoreBlendState(gl: WebGL2RenderingContext): void {
  gl.disable(gl.BLEND)
}

// ── ShaderRenderPass ──────────────────────────────────────────────────────────

/**
 * Wraps a CompiledPassNode with the per-pass draw logic.
 *
 * Each call to execute():
 *   1. Applies the blend state for this pass.
 *   2. Activates the program and calls applyUniforms so the caller can set
 *      audio, timing, and parameter uniforms while the program is bound.
 *   3. Delegates to FullscreenPass.run() to bind input textures and draw.
 *   4. Restores blend state to a known-off condition.
 */
export class ShaderRenderPass {
  private _lastDurationMs: number | null = null

  constructor(
    private readonly _gl:      WebGL2RenderingContext,
    private readonly _fsPass:  FullscreenPass,
    private readonly _geoPass: GeometryPass,
    readonly node: CompiledPassNode,
  ) {}

  /**
   * @param geometry  Per-instance segment data for a 'geometry' drawKind
   *                  pass. Ignored for 'fullscreen' passes. Defaults to an
   *                  empty (zero-instance) buffer when a geometry pass has no
   *                  provider — draws nothing rather than throwing.
   */
  execute(
    targetFbo:     WebGLFramebuffer | null,
    w:             number,
    h:             number,
    inputs:        TextureBinding[],
    applyUniforms: (program: ShaderProgram) => void,
    geometry?:     GeometryPassInput | null,
  ): void {
    const gl    = this._gl
    const start = performance.now()

    const blendState = resolveBlendState(gl, this.node.blendMode)
    applyBlendState(gl, blendState)

    // Activate the program first so applyUniforms can call gl.uniform*() safely.
    this.node.program.activate()
    applyUniforms(this.node.program)

    if (this.node.drawKind === 'geometry') {
      this._geoPass.run(
        this.node.program,
        targetFbo,
        w, h,
        inputs,
        geometry ?? EMPTY_GEOMETRY,
        { clear: this.node.clearBeforeRender },
      )
    } else {
      this._fsPass.run(
        this.node.program,
        targetFbo,
        w, h,
        inputs,
        { clear: this.node.clearBeforeRender },
      )
    }

    // Restore blend to a known-off state before the next pass.
    restoreBlendState(gl)

    this._lastDurationMs = performance.now() - start
  }

  get lastDurationMs(): number | null { return this._lastDurationMs }

  info(dims: { w: number; h: number }): RenderPassInfo {
    return {
      passId:        this.node.passId,
      dimensions:    { ...dims },
      inputs:        this.node.inputs.map(b => `${b.source} → ${b.uniformName}`),
      outputTarget:  this.node.outputName === null ? 'screen' : 'framebuffer',
      persistent:    this.node.persistent,
      pingPong:      this.node.pingPong,
      lastDurationMs: this._lastDurationMs,
    }
  }
}
