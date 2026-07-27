import { detectShaderFloatTargetCapability, type ShaderFloatTargetCapability } from '../runtime/ShaderCapabilities'

// ── ShaderWaveformTextureXY ───────────────────────────────────────────────────
//
// A two-channel, higher-precision variant of ShaderWaveformTexture for XY
// (vectorscope/Lissajous-style) drawing. The mono ShaderWaveformTexture is
// left completely intact for its existing consumers — this is an additive
// sibling, not a replacement.
//
// Why a new class instead of extending the mono one: R8 has only 256
// quantization levels, which shows as visible stair-stepping on slow beam
// segments — exactly where inverse-velocity intensity makes a segment
// brightest and thus most visible. XY drawing also fundamentally needs two
// independent channels (X and Y), not one.
//
// Storage precision, in priority order:
//   1. RG16F (format=RG, type=FLOAT upload — the GPU stores it at half-float
//      precision; uploading as FLOAT rather than hand-packed HALF_FLOAT bits
//      avoids manual half-float encoding while still landing in 16-bit
//      storage). Samples are stored RAW (no 0..1 bias): texture() returns the
//      signed value directly, unlike an 8-bit texture which always normalizes.
//   2. Fallback (device lacks reliable float-texture support): RGBA8 with two
//      channels each packed across an (R,G) or (B,A) byte pair —
//      value ∈ [-1,1] → u = (value+1)*0.5 ∈ [0,1] → 16-bit integer → hi/lo
//      bytes. The corresponding GLSL unpack is:
//        float unpack16(vec2 hiLo) {
//          return (hiLo.x * 65280.0 + hiLo.y * 255.0) / 65535.0 * 2.0 - 1.0;
//        }
//      (hiLo sampled 0..1 per channel per WebGL's UNSIGNED_BYTE normalization)
//
// GLSL usage (primary path):
//   uniform sampler2D uWaveformTextureXY;
//   uniform int       uWaveformXYSampleCount;
//   float t = gl_FragCoord.x / float(uWaveformXYSampleCount);
//   vec2  xy = texture(uWaveformTextureXY, vec2(t, 0.5)).rg;  // already -1..1
//
// Reuse: both the logical (Float32) sample buffer and the GPU upload buffer
// are allocated once at construction and reused on every update() — no
// allocations in the hot path. Updates use texSubImage2D.

export const WAVEFORM_XY_SAMPLE_COUNT_DEFAULT = 2048
export const WAVEFORM_XY_MIN_SAMPLE_COUNT = 2048

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
function clampSigned(v: number): number { return v < -1 ? -1 : v > 1 ? 1 : v }

function pack16(value: number): [hi: number, lo: number] {
  const u = clamp01((clampSigned(value) + 1) * 0.5)
  const q = Math.round(u * 65535)
  return [(q >> 8) & 0xff, q & 0xff]
}

export class ShaderWaveformTextureXY {
  private readonly _tex: WebGLTexture
  private readonly _sampleCount: number
  private readonly _capability: ShaderFloatTargetCapability
  private readonly _usesFloat: boolean

  // Logical per-channel sample buffers — reused every update(), never reallocated.
  private readonly _channelA: Float32Array
  private readonly _channelB: Float32Array

  // GPU upload buffer — Float32 (RG16F path) or Uint8 (RGBA8-packed fallback).
  private readonly _uploadFloat: Float32Array | null
  private readonly _uploadBytes: Uint8Array | null

  constructor(
    private readonly _gl: WebGL2RenderingContext,
    sampleCount: number = WAVEFORM_XY_SAMPLE_COUNT_DEFAULT,
    capability?: ShaderFloatTargetCapability,
  ) {
    this._sampleCount = Math.max(WAVEFORM_XY_MIN_SAMPLE_COUNT, Math.floor(sampleCount))
    this._capability = capability ?? detectShaderFloatTargetCapability(_gl)
    this._usesFloat = this._capability.colorBufferFloat

    this._channelA = new Float32Array(this._sampleCount)
    this._channelB = new Float32Array(this._sampleCount)

    const tex = _gl.createTexture()
    if (!tex) throw new Error('[ShaderWaveformTextureXY] createTexture failed')
    this._tex = tex

    _gl.bindTexture(_gl.TEXTURE_2D, tex)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE)
    _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE)

    if (this._usesFloat) {
      this._uploadFloat = new Float32Array(this._sampleCount * 2)
      this._uploadBytes = null
      _gl.texImage2D(
        _gl.TEXTURE_2D, 0,
        _gl.RG16F,
        this._sampleCount, 1, 0,
        _gl.RG, _gl.FLOAT,
        this._uploadFloat,
      )
    } else {
      this._uploadFloat = null
      this._uploadBytes = new Uint8Array(this._sampleCount * 4)
      _gl.texImage2D(
        _gl.TEXTURE_2D, 0,
        _gl.RGBA8,
        this._sampleCount, 1, 0,
        _gl.RGBA, _gl.UNSIGNED_BYTE,
        this._uploadBytes,
      )
    }

    _gl.bindTexture(_gl.TEXTURE_2D, null)
  }

  /**
   * Upload new XY sample data. `channelA`/`channelB` are read as signed
   * amplitudes; values outside [-1,1] are clamped. Passing null for either
   * (or both) fills that channel with silence (0). Only up to `sampleCount`
   * samples are consumed; shorter input zero-fills the remainder.
   */
  update(channelA: Float32Array | null, channelB: Float32Array | null): void {
    const n = this._sampleCount
    const a = this._channelA
    const b = this._channelB

    const na = channelA ? Math.min(channelA.length, n) : 0
    const nb = channelB ? Math.min(channelB.length, n) : 0
    for (let i = 0; i < n; i++) {
      a[i] = i < na ? channelA![i] : 0
      b[i] = i < nb ? channelB![i] : 0
    }

    const gl = this._gl
    gl.bindTexture(gl.TEXTURE_2D, this._tex)

    if (this._usesFloat) {
      const up = this._uploadFloat!
      for (let i = 0; i < n; i++) {
        up[i * 2] = clampSigned(a[i])
        up[i * 2 + 1] = clampSigned(b[i])
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, 1, gl.RG, gl.FLOAT, up)
    } else {
      const up = this._uploadBytes!
      for (let i = 0; i < n; i++) {
        const [hiA, loA] = pack16(a[i])
        const [hiB, loB] = pack16(b[i])
        up[i * 4] = hiA
        up[i * 4 + 1] = loA
        up[i * 4 + 2] = hiB
        up[i * 4 + 3] = loB
      }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, up)
    }

    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  dispose(): void {
    this._gl.deleteTexture(this._tex)
  }

  /** The underlying WebGLTexture. Bind to a sampler unit before setting uWaveformTextureXY. */
  get texture(): WebGLTexture { return this._tex }

  /** Number of samples per channel in the texture. */
  get sampleCount(): number { return this._sampleCount }

  /** True when using the RG16F storage path; false when using the RGBA8-packed fallback. */
  get usesFloatStorage(): boolean { return this._usesFloat }

  /** Direct reference to the reused channel-A sample buffer (for testing / diagnostics). */
  get channelABuffer(): Float32Array { return this._channelA }

  /** Direct reference to the reused channel-B sample buffer (for testing / diagnostics). */
  get channelBBuffer(): Float32Array { return this._channelB }
}
