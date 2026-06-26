// ── ShaderNoiseTextureFactory ─────────────────────────────────────────────────
//
// Generates and caches deterministic noise textures (RGBA8, REPEAT wrapping).
// All textures are keyed by (type, size, seed) and shared across inputs — a
// shader scene that uses the same noise parameters on two different inputs only
// allocates one GPU texture.
//
// LCG parameters: Knuth multiplier 1664525, addend 1013904223 (32-bit unsigned).

function lcg(seed: number) {
  let s = (seed ^ 0x12345678) >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return (s >>> 8) / 16777215  // 24-bit [0,1)
  }
}

function generateWhiteNoise(size: number, seed: number): Uint8Array {
  const rand = lcg(seed)
  const n = size * size * 4
  const data = new Uint8Array(n)
  for (let i = 0; i < n; i++) data[i] = Math.round(rand() * 255)
  return data
}

function generateValueNoise(size: number, seed: number): Uint8Array {
  const rand = lcg(seed)
  // 8×8 coarse grid, bilinearly interpolated to full resolution
  const cells = 8
  const gridR = new Float32Array(cells * cells)
  const gridG = new Float32Array(cells * cells)
  const gridB = new Float32Array(cells * cells)
  const gridA = new Float32Array(cells * cells)
  for (let i = 0; i < cells * cells; i++) {
    gridR[i] = rand(); gridG[i] = rand(); gridB[i] = rand(); gridA[i] = 1
  }

  function interp(grid: Float32Array, nx: number, ny: number): number {
    const fx = nx * cells, fy = ny * cells
    const ix = Math.floor(fx) % cells, iy = Math.floor(fy) % cells
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy)
    const u  = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty)
    const x1 = (ix + 1) % cells, y1 = (iy + 1) % cells
    return (
      grid[iy * cells + ix]  * (1 - u) * (1 - v) +
      grid[iy * cells + x1]  * u       * (1 - v) +
      grid[y1 * cells + ix]  * (1 - u) * v       +
      grid[y1 * cells + x1]  * u       * v
    )
  }

  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size
      const i  = (y * size + x) * 4
      data[i]   = Math.round(interp(gridR, nx, ny) * 255)
      data[i+1] = Math.round(interp(gridG, nx, ny) * 255)
      data[i+2] = Math.round(interp(gridB, nx, ny) * 255)
      data[i+3] = 255
    }
  }
  return data
}

export class ShaderNoiseTextureFactory {
  private readonly _cache = new Map<string, WebGLTexture>()

  constructor(private readonly _gl: WebGL2RenderingContext) {}

  getWhiteNoise(size = 128, seed = 0): WebGLTexture {
    return this._getOrCreate(`w-${size}-${seed}`, () => generateWhiteNoise(size, seed), size)
  }

  getValueNoise(size = 256, seed = 0): WebGLTexture {
    return this._getOrCreate(`v-${size}-${seed}`, () => generateValueNoise(size, seed), size)
  }

  /** Returns null — no bundled blue-noise asset.  Callers fall back to value noise. */
  getBlueNoise(): WebGLTexture | null {
    return null
  }

  disposeAll(): void {
    for (const tex of this._cache.values()) this._gl.deleteTexture(tex)
    this._cache.clear()
  }

  get cacheSize(): number { return this._cache.size }

  private _getOrCreate(key: string, gen: () => Uint8Array, size: number): WebGLTexture {
    const cached = this._cache.get(key)
    if (cached) return cached
    const tex = this._upload(gen(), size, size)
    this._cache.set(key, tex)
    return tex
  }

  private _upload(data: Uint8Array, w: number, h: number): WebGLTexture {
    const gl  = this._gl
    const tex = gl.createTexture()
    if (!tex) throw new Error('[ShaderNoiseTextureFactory] createTexture failed')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.bindTexture(gl.TEXTURE_2D, null)
    return tex
  }
}
