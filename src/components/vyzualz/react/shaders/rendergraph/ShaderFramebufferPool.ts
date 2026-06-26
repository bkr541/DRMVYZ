import { ShaderFramebuffer } from '../runtime/ShaderFramebuffer'
import type { TextureFormat, TextureFilter, TextureWrap } from '../runtime/shaderRuntimeTypes'

// ── Pool key ──────────────────────────────────────────────────────────────────

type PoolKey = string

function makeKey(
  w: number, h: number,
  format: TextureFormat,
  filter: TextureFilter,
  wrap:   TextureWrap,
): PoolKey {
  return `${w}x${h}x${format}x${filter}x${wrap}`
}

// ── ShaderFramebufferPool ─────────────────────────────────────────────────────

/**
 * Reusable pool of ShaderFramebuffer objects, keyed by dimensions and format.
 *
 * Hot path contract: no FBO is allocated inside execute() unless the pool has
 * no free entry matching the requested dimensions.  Temporary FBOs are returned
 * to the pool via release(); the pool's free list is consulted first on the
 * next acquire() call.
 */
export class ShaderFramebufferPool {
  private readonly _free   = new Map<PoolKey, ShaderFramebuffer[]>()
  private readonly _active = new Map<ShaderFramebuffer, PoolKey>()

  constructor(private readonly _gl: WebGL2RenderingContext) {}

  /**
   * Acquire a framebuffer of the given size and format.
   * If a matching free entry exists it is reused; otherwise a new one is
   * allocated and sized immediately.
   */
  acquire(
    w: number,
    h: number,
    format: TextureFormat = 'rgba8',
    filter: TextureFilter = 'linear',
    wrap:   TextureWrap   = 'clamp',
  ): ShaderFramebuffer {
    const key  = makeKey(w, h, format, filter, wrap)
    const list = this._free.get(key)

    if (list && list.length > 0) {
      const fbo = list.pop()!
      this._active.set(fbo, key)
      return fbo
    }

    const fbo = new ShaderFramebuffer(this._gl, { format, filter, wrap })
    fbo.resize(w, h)
    this._active.set(fbo, key)
    return fbo
  }

  /** Return a specific FBO to the free list for reuse next frame. */
  release(fbo: ShaderFramebuffer): void {
    const key = this._active.get(fbo)
    if (!key) return
    this._active.delete(fbo)
    const list = this._free.get(key) ?? []
    list.push(fbo)
    this._free.set(key, list)
  }

  /** Return all active FBOs to the free list at once (end of frame). */
  releaseAll(): void {
    for (const [fbo, key] of this._active) {
      const list = this._free.get(key) ?? []
      list.push(fbo)
      this._free.set(key, list)
    }
    this._active.clear()
  }

  /** Dispose and destroy all FBOs in the pool, active and free. */
  disposeAll(): void {
    for (const fbo of this._active.keys()) fbo.dispose()
    for (const arr of this._free.values()) arr.forEach(f => f.dispose())
    this._active.clear()
    this._free.clear()
  }

  get activeCount(): number {
    return this._active.size
  }

  get freeCount(): number {
    let n = 0
    for (const arr of this._free.values()) n += arr.length
    return n
  }

  get totalCount(): number {
    return this.activeCount + this.freeCount
  }
}
