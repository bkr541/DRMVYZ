// ── ShaderSpectrumTexture ─────────────────────────────────────────────────────
//
// A single-row R8 WebGL2 texture containing the current FFT frequency spectrum.
//
// Format details:
//   internalFormat: gl.R8        (WebGL2 sized internal format)
//   format:         gl.RED       (single-channel)
//   type:           gl.UNSIGNED_BYTE
//   dimensions:     BIN_COUNT × 1 texels
//
// GLSL usage (GLSL 300 es):
//   uniform sampler2D uSpectrumTexture;
//   uniform int       uSpectrumBinCount;
//   // Sample at normalized frequency 0..1:
//   float bin   = someFrequency;            // 0.0 = DC, 1.0 = Nyquist
//   float mag   = texture(uSpectrumTexture, vec2(bin, 0.5)).r;  // 0..1
//
// The raw analyser Uint8Array (0–255) is stored directly; WebGL normalises to
// 0.0–1.0 in the GLSL sampler automatically via gl.R8 + UNSIGNED_BYTE.
//
// Reuse: a single `Uint8Array` of BIN_COUNT bytes is allocated at construction
// time and reused on every update — no allocations in the hot path.
// Updates use texSubImage2D rather than creating a new texture each frame.

export const SPECTRUM_BIN_COUNT = 512

export class ShaderSpectrumTexture {
  private readonly _tex: WebGLTexture
  // Reused upload buffer — never reallocated after construction
  private readonly _buf: Uint8Array

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._buf = new Uint8Array(SPECTRUM_BIN_COUNT)

    const tex = _gl.createTexture()
    if (!tex) throw new Error('[ShaderSpectrumTexture] createTexture failed')
    this._tex = tex

    _gl.bindTexture(_gl.TEXTURE_2D, tex)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE)

    // Allocate the texture storage once; subsequent updates use texSubImage2D
    _gl.texImage2D(
      _gl.TEXTURE_2D, 0,
      (_gl as WebGL2RenderingContext).R8 ?? 0x8229,  // gl.R8 = 33321
      SPECTRUM_BIN_COUNT, 1, 0,
      (_gl as WebGL2RenderingContext).RED ?? 0x1903,  // gl.RED = 6403
      _gl.UNSIGNED_BYTE,
      this._buf,
    )

    _gl.bindTexture(_gl.TEXTURE_2D, null)
  }

  /**
   * Upload new spectrum data.
   *
   * `freqData` is the analyser's frequency-domain Uint8Array (0–255 per bin).
   * When null (no analyser) the texture is filled with zeros — the shader sees
   * silence (all bins 0.0) rather than stale or undefined data.
   *
   * Only up to `SPECTRUM_BIN_COUNT` bins are consumed; extra bins are ignored.
   * Fewer bins than BIN_COUNT zero-fill the remainder.
   */
  update(freqData: Uint8Array | null): void {
    const buf = this._buf
    if (freqData && freqData.length > 0) {
      const n = Math.min(freqData.length, SPECTRUM_BIN_COUNT)
      buf.set(freqData.subarray(0, n), 0)
      if (n < SPECTRUM_BIN_COUNT) buf.fill(0, n)
    } else {
      buf.fill(0)
    }

    const gl = this._gl
    gl.bindTexture(gl.TEXTURE_2D, this._tex)
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0,
      0, 0,
      SPECTRUM_BIN_COUNT, 1,
      (gl as WebGL2RenderingContext).RED ?? 0x1903,
      gl.UNSIGNED_BYTE,
      buf,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  dispose(): void {
    this._gl.deleteTexture(this._tex)
  }

  /** The underlying WebGLTexture. Bind to a sampler unit before setting uSpectrumTexture. */
  get texture(): WebGLTexture { return this._tex }

  /** Number of frequency bins in the texture (equals SPECTRUM_BIN_COUNT). */
  get binCount(): number { return SPECTRUM_BIN_COUNT }

  /** Direct reference to the reused upload buffer (for testing / diagnostics). */
  get buffer(): Uint8Array { return this._buf }
}
