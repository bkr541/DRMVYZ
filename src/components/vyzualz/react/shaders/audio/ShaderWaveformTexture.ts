// ── ShaderWaveformTexture ─────────────────────────────────────────────────────
//
// A single-row R8 WebGL2 texture containing the current time-domain waveform.
//
// Format details:
//   internalFormat: gl.R8        (WebGL2 sized internal format)
//   format:         gl.RED       (single-channel)
//   type:           gl.UNSIGNED_BYTE
//   dimensions:     SAMPLE_COUNT × 1 texels
//
// GLSL usage (GLSL 300 es):
//   uniform sampler2D uWaveformTexture;
//   uniform int       uWaveformSampleCount;
//   // Sample at normalised time 0..1:
//   float t       = gl_FragCoord.x / float(uWaveformSampleCount);
//   float raw     = texture(uWaveformTexture, vec2(t, 0.5)).r;  // 0..1
//   float waveform = raw * 2.0 - 1.0;  // remap to -1..+1 (silence = 0)
//
// The analyser timeDomainData is centred at 128 (silence = 128 = 0.502 in GLSL).
// The recommended GLSL remap above centres silence at 0.0.
//
// Reuse: a single `Uint8Array` of SAMPLE_COUNT bytes is allocated at construction
// and reused on every update — no allocations in the hot path.
// Updates use texSubImage2D rather than creating a new texture each frame.

export const WAVEFORM_SAMPLE_COUNT = 1024

export class ShaderWaveformTexture {
  private readonly _tex: WebGLTexture
  // Reused upload buffer — never reallocated after construction
  private readonly _buf: Uint8Array

  constructor(private readonly _gl: WebGL2RenderingContext) {
    this._buf = new Uint8Array(WAVEFORM_SAMPLE_COUNT)
    // Silence is 128 (centre of uint8 range)
    this._buf.fill(128)

    const tex = _gl.createTexture()
    if (!tex) throw new Error('[ShaderWaveformTexture] createTexture failed')
    this._tex = tex

    _gl.bindTexture(_gl.TEXTURE_2D, tex)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE)

    // Allocate the texture storage once; subsequent updates use texSubImage2D
    _gl.texImage2D(
      _gl.TEXTURE_2D, 0,
      (_gl as WebGL2RenderingContext).R8 ?? 0x8229,
      WAVEFORM_SAMPLE_COUNT, 1, 0,
      (_gl as WebGL2RenderingContext).RED ?? 0x1903,
      _gl.UNSIGNED_BYTE,
      this._buf,
    )

    _gl.bindTexture(_gl.TEXTURE_2D, null)
  }

  /**
   * Upload new waveform data.
   *
   * `timeDomainData` is the analyser's time-domain Uint8Array (0–255 per sample,
   * centred at 128).  When null (no analyser) the texture is filled with 128
   * (digital silence) so the shader sees a flat line at 0.0 after remapping.
   *
   * Only up to `WAVEFORM_SAMPLE_COUNT` samples are consumed; extra samples are
   * ignored.  Fewer samples than SAMPLE_COUNT fill the remainder with 128.
   */
  update(timeDomainData: Uint8Array | null): void {
    const buf = this._buf
    if (timeDomainData && timeDomainData.length > 0) {
      const n = Math.min(timeDomainData.length, WAVEFORM_SAMPLE_COUNT)
      buf.set(timeDomainData.subarray(0, n), 0)
      if (n < WAVEFORM_SAMPLE_COUNT) buf.fill(128, n)
    } else {
      buf.fill(128)
    }

    const gl = this._gl
    gl.bindTexture(gl.TEXTURE_2D, this._tex)
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0,
      0, 0,
      WAVEFORM_SAMPLE_COUNT, 1,
      (gl as WebGL2RenderingContext).RED ?? 0x1903,
      gl.UNSIGNED_BYTE,
      buf,
    )
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  dispose(): void {
    this._gl.deleteTexture(this._tex)
  }

  /** The underlying WebGLTexture. Bind to a sampler unit before setting uWaveformTexture. */
  get texture(): WebGLTexture { return this._tex }

  /** Number of samples in the texture (equals WAVEFORM_SAMPLE_COUNT). */
  get sampleCount(): number { return WAVEFORM_SAMPLE_COUNT }

  /** Direct reference to the reused upload buffer (for testing / diagnostics). */
  get buffer(): Uint8Array { return this._buf }
}
