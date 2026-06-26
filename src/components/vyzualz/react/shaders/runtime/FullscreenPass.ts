import type { RenderPassOptions, TextureBinding } from './shaderRuntimeTypes'
import type { ShaderProgram } from './ShaderProgram'

// ── Shared vertex shader ──────────────────────────────────────────────────────
//
// Produces a fullscreen triangle from vertex indices alone — no VBO or VAO
// needed. Calls drawArrays(TRIANGLES, 0, 3):
//   gl_VertexID 0 → (-1, -1)  uv (0, 0)
//   gl_VertexID 1 → ( 3, -1)  uv (2, 0)
//   gl_VertexID 2 → (-1,  3)  uv (0, 2)
// The UV extends beyond [0,1] on purpose; fragment shaders clamp via
// CLAMP_TO_EDGE on their samplers.

export const FULLSCREEN_VERT_SRC = `#version 300 es
out vec2 v_uv;
void main() {
  // gl_VertexID: 0 → (-1,-1), 1 → (3,-1), 2 → (-1,3)
  vec2 pos = vec2(
    float(gl_VertexID == 1 ? 1 : 0) * 4.0 - 1.0,
    float(gl_VertexID == 2 ? 1 : 0) * 4.0 - 1.0
  );
  v_uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`

// ── FullscreenPass ────────────────────────────────────────────────────────────

export class FullscreenPass {
  private readonly gl: WebGL2RenderingContext
  private _disposed = false

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
  }

  /**
   * Execute a fullscreen render pass.
   *
   * @param program  Compiled ShaderProgram whose fragment shader will run.
   * @param target   Destination FBO, or null for the default framebuffer.
   * @param w        Target width in pixels.
   * @param h        Target height in pixels.
   * @param textures Texture units to bind before the draw call.
   * @param opts     Optional clear and viewport overrides.
   */
  run(
    program:  ShaderProgram,
    target:   WebGLFramebuffer | null,
    w:        number,
    h:        number,
    textures: TextureBinding[],
    opts:     RenderPassOptions = {},
  ): void {
    if (this._disposed) return
    const gl = this.gl

    gl.bindFramebuffer(gl.FRAMEBUFFER, target)

    const vp = opts.viewport
    gl.viewport(
      vp?.x ?? 0,
      vp?.y ?? 0,
      vp?.w ?? w,
      vp?.h ?? h,
    )

    if (opts.clear) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }

    program.activate()

    for (const b of textures) {
      gl.activeTexture(gl.TEXTURE0 + b.unit)
      gl.bindTexture(gl.TEXTURE_2D, b.texture)
      program.setSampler(b.uniformName, b.unit)
    }

    // Fullscreen triangle: 3 vertices, no geometry buffer.
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    for (const b of textures) {
      gl.activeTexture(gl.TEXTURE0 + b.unit)
      gl.bindTexture(gl.TEXTURE_2D, null)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  dispose(): void {
    this._disposed = true
  }
}
