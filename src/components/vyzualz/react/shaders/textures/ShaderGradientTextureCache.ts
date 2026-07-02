import type { ShaderDefinition, GradientStop, GradientParamDef } from '../registry/shaderRegistryTypes'
import type { ShaderParamValue } from '../registry/shaderRegistryTypes'

// ── ShaderGradientTextureCache ────────────────────────────────────────────────
//
// Encodes gradient parameter values into reusable 1-D WebGL2 textures.
//
// Encoding:
//   - 1×RESOLUTION RGBA8 texture (horizontal strip)
//   - Stops are sorted by position before sampling (original is never mutated)
//   - Positions are clamped to 0..1
//   - Alpha is preserved
//   - A stable content hash is used as cache key so unchanged gradients reuse
//     the same GPU texture
//
// Usage per frame:
//   1. buildUnitMap(def, paramValues, gl, firstUnit) → Map<paramId, texUnit>
//   2. For each param in the map, bind the texture to its unit BEFORE
//      calling applyUniforms.
//   3. applyUniforms calls program.setSampler(uniformName, unit).
//
// Lifetime:
//   clearAll()  — on scene change
//   dispose()   — on renderer dispose / context loss

const GRADIENT_RESOLUTION = 256

export class ShaderGradientTextureCache {
  private readonly _cache = new Map<string, { tex: WebGLTexture; key: string }>()

  constructor(private readonly _gl: WebGL2RenderingContext) {}

  // ── Per-frame build ───────────────────────────────────────────────────────

  /**
   * For every gradient param in `def`, ensure the GPU texture is up to date
   * and bind it to a texture unit starting at `firstUnit`.
   *
   * Returns a map of paramId → texture unit for use by applyUniforms.
   */
  buildUnitMap(
    def:         ShaderDefinition,
    paramValues: Record<string, ShaderParamValue>,
    gl:          WebGL2RenderingContext,
    firstUnit:   number,
    lastUnitExclusive = Number.POSITIVE_INFINITY,
  ): ReadonlyMap<string, number> {
    const result  = new Map<string, number>()
    let unit = firstUnit

    for (const param of def.params) {
      if (param.type !== 'gradient') continue
      if (unit >= lastUnitExclusive) {
        throw new Error(`Shader "${def.id}" declares more gradient samplers than the available texture-unit budget`)
      }
      const gradParam = param as GradientParamDef
      const stops = (paramValues[param.id] as GradientStop[] | undefined) ?? gradParam.default
      const tex   = this._getOrCreate(param.id, stops)

      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      result.set(param.id, unit)
      unit++
    }

    return result
  }

  /** Total number of gradient textures currently in cache. */
  get textureCount(): number { return this._cache.size }

  /** Remove all cached textures. Call on scene change. */
  clearAll(): void {
    for (const entry of this._cache.values()) {
      this._gl.deleteTexture(entry.tex)
    }
    this._cache.clear()
  }

  /** Delete all GPU resources. */
  dispose(): void {
    this.clearAll()
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _getOrCreate(paramId: string, stops: GradientStop[]): WebGLTexture {
    const key     = _gradientKey(stops)
    const cached  = this._cache.get(paramId)

    if (cached && cached.key === key) return cached.tex

    if (cached) this._gl.deleteTexture(cached.tex)

    const tex = _encodeGradient(this._gl, stops)
    this._cache.set(paramId, { tex, key })
    return tex
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stable content hash for a gradient. Sort order is normalised before hashing. */
function _gradientKey(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  return sorted.map(s =>
    `${s.position.toFixed(4)}:${s.color[0].toFixed(3)},${s.color[1].toFixed(3)},${s.color[2].toFixed(3)},${s.color[3].toFixed(3)}`
  ).join('|')
}

/** Encode sorted gradient stops into a 1×GRADIENT_RESOLUTION RGBA8 texture. */
function _encodeGradient(gl: WebGL2RenderingContext, stops: GradientStop[]): WebGLTexture {
  const N = GRADIENT_RESOLUTION
  const data = new Uint8Array(N * 4)

  // Sort stops without mutating the caller's array; clamp positions to [0,1]
  const sorted: GradientStop[] = stops.length === 0
    ? [{ position: 0, color: [0, 0, 0, 1] }, { position: 1, color: [0, 0, 0, 1] }]
    : [...stops]
        .map(s => ({ position: Math.max(0, Math.min(1, s.position)), color: s.color }))
        .sort((a, b) => a.position - b.position)

  // Ensure start and end stops exist for clean interpolation
  if (sorted[0].position > 0)     sorted.unshift({ position: 0, color: sorted[0].color })
  if (sorted[sorted.length - 1].position < 1) sorted.push({ position: 1, color: sorted[sorted.length - 1].color })

  for (let i = 0; i < N; i++) {
    const t  = i / (N - 1)
    const c  = _sampleGradient(sorted, t)
    data[i * 4 + 0] = Math.round(c[0] * 255)
    data[i * 4 + 1] = Math.round(c[1] * 255)
    data[i * 4 + 2] = Math.round(c[2] * 255)
    data[i * 4 + 3] = Math.round(c[3] * 255)
  }

  const tex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

function _sampleGradient(sorted: GradientStop[], t: number): [number, number, number, number] {
  // Find straddling stops
  let lo = sorted[0]
  let hi = sorted[sorted.length - 1]

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].position <= t && sorted[i + 1].position >= t) {
      lo = sorted[i]
      hi = sorted[i + 1]
      break
    }
  }

  const span = hi.position - lo.position
  const f    = span < 1e-6 ? 0 : (t - lo.position) / span
  const lc   = lo.color
  const hc   = hi.color

  return [
    lc[0] + (hc[0] - lc[0]) * f,
    lc[1] + (hc[1] - lc[1]) * f,
    lc[2] + (hc[2] - lc[2]) * f,
    lc[3] + (hc[3] - lc[3]) * f,
  ]
}
