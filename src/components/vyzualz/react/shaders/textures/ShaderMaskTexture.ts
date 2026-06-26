import type { MaskType } from './shaderTextureInputTypes'

// ── ShaderMaskTexture ─────────────────────────────────────────────────────────
//
// Generates procedural mask textures (RGBA8 where R=G=B=mask value, A=255)
// and single-pixel solid-colour textures.  Allocation only; callers cache.

export class ShaderMaskTexture {
  static generate(
    gl:     WebGL2RenderingContext,
    type:   MaskType,
    size  = 256,
    invert = false,
  ): WebGLTexture {
    return ShaderMaskTexture._upload(gl, ShaderMaskTexture._buildData(type, size, invert), size, size)
  }

  static createSolidColor(
    gl: WebGL2RenderingContext,
    r: number, g: number, b: number, a = 255,
  ): WebGLTexture {
    return ShaderMaskTexture._upload(gl, new Uint8Array([r, g, b, a]), 1, 1)
  }

  private static _buildData(type: MaskType, size: number, invert: boolean): Uint8Array {
    const data = new Uint8Array(size * size * 4)
    const s1   = size - 1 || 1   // avoid divide-by-zero on size=1

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / s1, ny = y / s1  // [0,1]
        let m: number

        if (type === 'radial') {
          m = 1 - Math.min(1, 2 * Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2))
        } else if (type === 'linear-h') {
          m = nx
        } else if (type === 'linear-v') {
          m = ny
        } else if (type === 'vignette') {
          const dx = (nx - 0.5) * 2, dy = (ny - 0.5) * 2
          m = Math.max(0, 1 - (dx * dx + dy * dy))
        } else {
          // box
          m = Math.max(0, 1 - Math.max(Math.abs(nx - 0.5) * 2, Math.abs(ny - 0.5) * 2))
        }

        m = Math.max(0, Math.min(1, invert ? 1 - m : m))
        const b = Math.round(m * 255)
        const i = (y * size + x) * 4
        data[i] = data[i + 1] = data[i + 2] = b
        data[i + 3] = 255
      }
    }
    return data
  }

  private static _upload(
    gl:   WebGL2RenderingContext,
    data: Uint8Array,
    w:    number,
    h:    number,
  ): WebGLTexture {
    const tex = gl.createTexture()
    if (!tex) throw new Error('[ShaderMaskTexture] createTexture failed')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }
}
