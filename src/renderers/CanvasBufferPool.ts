/**
 * Lightweight per-frame canvas buffer pool.
 *
 * One pool instance lives for the duration of the component mount (one
 * `useRef` in LiveVisualCanvas). Each call to `acquire(key, w, h)` returns
 * a stable HTMLCanvasElement for that key, resizing in-place when dimensions
 * change. The same canvas is returned on every subsequent call with the same
 * key, so callers get canvas/context reuse without managing lifecycle.
 *
 * Frame lifecycle
 * ───────────────
 * 1. During the frame, call `acquire(key, w, h)` for every targeted-effect
 *    offscreen canvas needed.
 * 2. At the END of each frame, call `endFrame()`. This removes entries that
 *    were not accessed this frame, preventing accumulation from layer items
 *    or overlay clips that are no longer active.
 * 3. On component unmount, call `dispose()`.
 */
export class CanvasBufferPool {
  private readonly _bufs          = new Map<string, HTMLCanvasElement>()
  private readonly _usedThisFrame = new Set<string>()

  /**
   * Get (or create) a canvas for `key` at `w × h` pixels.
   * Resizes the existing canvas in-place when dimensions change.
   * Marks the entry as used for the current frame.
   */
  acquire(key: string, w: number, h: number): HTMLCanvasElement {
    this._usedThisFrame.add(key)
    let c = this._bufs.get(key)
    if (!c) {
      c = document.createElement('canvas')
      this._bufs.set(key, c)
    }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
    return c
  }

  /**
   * Call once per frame after all rendering is complete.
   * Evicts canvas entries that were not accessed this frame, preventing
   * accumulation from transient layer items or overlay clips.
   */
  endFrame(): void {
    for (const key of this._bufs.keys()) {
      if (!this._usedThisFrame.has(key)) this._bufs.delete(key)
    }
    this._usedThisFrame.clear()
  }

  /** Number of live canvas entries (for diagnostics). */
  get size(): number { return this._bufs.size }

  /** Release all canvases. Call on component unmount. */
  dispose(): void {
    this._bufs.clear()
    this._usedThisFrame.clear()
  }
}
