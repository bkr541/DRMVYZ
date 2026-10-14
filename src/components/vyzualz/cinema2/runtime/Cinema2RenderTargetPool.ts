/**
 * Shared pool of intermediate render targets for Cinema 2.0 effects.
 *
 * Effects that need scratch surfaces (ambient-occlusion buffers, SMAA edge/weight maps, future half-resolution passes) acquire them here for the
 * length of one `render()` call and release them straight away. A released target stays allocated for a short idle window, so the next frame
 * (and any other effect that needs the same size and format) reuses it instead of allocating, and resizes or quality changes leave no leaks:
 * targets idle for longer than `idleMs` are deleted the next time anything touches the pool.
 *
 * One pool exists per WebGL context (`getCinema2RenderTargetPool`). On context loss every handle is forgotten without GL calls (they are already
 * invalid); the pool is empty and usable again after the restore.
 */
export type Cinema2PooledFormat = 'rgba8' | 'rgba16f' | 'rg8' | 'r8'

export interface Cinema2PooledTarget {
  readonly width: number
  readonly height: number
  /** What was asked for. */
  readonly requestedFormat: Cinema2PooledFormat
  /** What was allocated (`rgba16f` falls back to `rgba8` without `EXT_color_buffer_float`). */
  readonly format: Cinema2PooledFormat
  readonly texture: WebGLTexture
  readonly framebuffer: WebGLFramebuffer
  readonly bytes: number
}

export interface Cinema2RenderTargetPoolStats {
  /** Targets currently handed out. */
  liveCount: number
  /** Targets allocated but waiting for reuse. */
  idleCount: number
  allocatedBytes: number
  peakBytes: number
  /** Total GL allocations since creation (a reuse does not count). */
  totalAllocations: number
  /** Acquires served from the idle list. */
  reuseCount: number
}

export interface Cinema2RenderTargetPoolOptions {
  /** How long a released target may sit unused before it is deleted. */
  idleMs?: number
  /** Time source (tests). */
  now?: () => number
  /** Timer seam (tests). The default is `setTimeout`; a pending trim never keeps a Node process alive. */
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

interface PoolEntry {
  target: Cinema2PooledTarget
  key: string
  filter: 'linear' | 'nearest'
  inUse: boolean
  releasedAt: number
}

const BYTES_PER_PIXEL: Readonly<Record<Cinema2PooledFormat, number>> = Object.freeze({ rgba8: 4, rgba16f: 8, rg8: 2, r8: 1 })
const DEFAULT_IDLE_MS = 2000

export class Cinema2RenderTargetPool {
  private entries: PoolEntry[] = []
  private readonly byTarget = new Map<Cinema2PooledTarget, PoolEntry>()
  private readonly idleMs: number
  private readonly now: () => number
  private readonly setTimer: NonNullable<Cinema2RenderTargetPoolOptions['setTimer']>
  private readonly clearTimer: NonNullable<Cinema2RenderTargetPoolOptions['clearTimer']>
  private trimTimer: unknown = null
  private readonly floatTargets: boolean
  private allocatedBytes = 0
  private peakBytes = 0
  private totalAllocations = 0
  private reuseCount = 0
  private disposed = false

  constructor(private readonly gl: WebGL2RenderingContext, options: Cinema2RenderTargetPoolOptions = {}) {
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS
    this.now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))
    this.setTimer = options.setTimer ?? ((callback, ms) => {
      const handle = setTimeout(callback, ms) as unknown as { unref?: () => void }
      handle.unref?.()
      return handle
    })
    this.clearTimer = options.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.floatTargets = typeof gl.getExtension === 'function' && gl.getExtension('EXT_color_buffer_float') != null
  }

  /** The format a request resolves to on this context. */
  resolveFormat(format: Cinema2PooledFormat): Cinema2PooledFormat {
    return format === 'rgba16f' && !this.floatTargets ? 'rgba8' : format
  }

  acquire(width: number, height: number, format: Cinema2PooledFormat, filter: 'linear' | 'nearest' = 'linear'): Cinema2PooledTarget {
    if (this.disposed) throw new Error('Cinema 2.0 render-target pool was disposed.')
    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    const resolved = this.resolveFormat(format)
    const key = `${w}x${h}:${resolved}:${filter}`
    const now = this.now()
    this.trim(now)
    const reusable = this.entries.find(entry => !entry.inUse && entry.key === key)
    if (reusable) {
      reusable.inUse = true
      this.reuseCount += 1
      return reusable.target
    }
    const target = this.allocate(w, h, format, resolved, filter)
    const entry: PoolEntry = { target, key, filter, inUse: true, releasedAt: now }
    this.entries.push(entry)
    this.byTarget.set(target, entry)
    this.totalAllocations += 1
    this.allocatedBytes += target.bytes
    this.peakBytes = Math.max(this.peakBytes, this.allocatedBytes)
    return target
  }

  release(target: Cinema2PooledTarget): void {
    const entry = this.byTarget.get(target)
    if (!entry || !entry.inUse) return
    entry.inUse = false
    entry.releasedAt = this.now()
    this.scheduleTrim()
  }

  /**
   * Idle targets are deleted by a timer, not only when something next acquires: a preset that turns its effects off (or a resize that leaves
   * old-size targets behind) must not hold that memory until some later effect happens to touch the pool.
   */
  private scheduleTrim(): void {
    if (this.trimTimer != null || this.disposed) return
    this.trimTimer = this.setTimer(() => {
      this.trimTimer = null
      if (this.disposed) return
      this.trim()
      if (this.entries.some(entry => !entry.inUse)) this.scheduleTrim()
    }, this.idleMs + 25)
  }

  /** Deletes idle targets older than the idle window (pass `Infinity` age through `flush` to delete all idle targets). */
  trim(now: number = this.now()): void {
    this.removeWhere(entry => !entry.inUse && now - entry.releasedAt > this.idleMs)
  }

  /** Deletes every idle target now (resize, quality change, preset switch). Targets still handed out are untouched. */
  flush(): void {
    this.removeWhere(entry => !entry.inUse)
  }

  /** The context is gone: forget every handle without touching GL. */
  handleContextLost(): void {
    if (this.trimTimer != null) { this.clearTimer(this.trimTimer); this.trimTimer = null }
    this.entries = []
    this.byTarget.clear()
    this.allocatedBytes = 0
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.trimTimer != null) { this.clearTimer(this.trimTimer); this.trimTimer = null }
    this.removeWhere(() => true)
  }

  getStats(): Readonly<Cinema2RenderTargetPoolStats> {
    let live = 0
    for (const entry of this.entries) if (entry.inUse) live += 1
    return Object.freeze({
      liveCount: live,
      idleCount: this.entries.length - live,
      allocatedBytes: this.allocatedBytes,
      peakBytes: this.peakBytes,
      totalAllocations: this.totalAllocations,
      reuseCount: this.reuseCount,
    })
  }

  private removeWhere(predicate: (entry: PoolEntry) => boolean): void {
    if (this.entries.length === 0) return
    const kept: PoolEntry[] = []
    for (const entry of this.entries) {
      if (!predicate(entry)) { kept.push(entry); continue }
      this.byTarget.delete(entry.target)
      this.allocatedBytes -= entry.target.bytes
      if (!this.gl.isContextLost()) {
        this.gl.deleteFramebuffer(entry.target.framebuffer)
        this.gl.deleteTexture(entry.target.texture)
      }
    }
    this.entries = kept
  }

  private allocate(width: number, height: number, requested: Cinema2PooledFormat, format: Cinema2PooledFormat, filter: 'linear' | 'nearest'): Cinema2PooledTarget {
    const { gl } = this
    const texture = gl.createTexture()
    const framebuffer = gl.createFramebuffer()
    if (!texture || !framebuffer) {
      if (texture) gl.deleteTexture(texture)
      if (framebuffer) gl.deleteFramebuffer(framebuffer)
      throw new Error(`Cinema 2.0 render-target pool could not allocate a ${width}x${height} ${format} target.`)
    }
    const glFilter = filter === 'linear' ? gl.LINEAR : gl.NEAREST
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, glFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, glFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    if (format === 'rgba16f') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else if (format === 'rg8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, width, height, 0, gl.RG, gl.UNSIGNED_BYTE, null)
    else if (format === 'r8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
      throw new Error(`Cinema 2.0 render-target pool: ${width}x${height} ${format} target is incomplete (status 0x${status.toString(16)}).`)
    }
    return Object.freeze({ width, height, requestedFormat: requested, format, texture, framebuffer, bytes: width * height * BYTES_PER_PIXEL[format] })
  }
}

const pools = new WeakMap<WebGL2RenderingContext, Cinema2RenderTargetPool>()

/** The pool for a context, created on first use. It forgets its handles when that context is lost. */
export function getCinema2RenderTargetPool(gl: WebGL2RenderingContext): Cinema2RenderTargetPool {
  const existing = pools.get(gl)
  if (existing) return existing
  const pool = new Cinema2RenderTargetPool(gl)
  pools.set(gl, pool)
  const canvas = gl.canvas as Partial<HTMLCanvasElement> | undefined
  if (canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('webglcontextlost', () => pool.handleContextLost())
  }
  return pool
}

/** Test seam: forget the pool for a context. */
export function forgetCinema2RenderTargetPoolForTests(gl: WebGL2RenderingContext): void {
  pools.get(gl)?.dispose()
  pools.delete(gl)
}
