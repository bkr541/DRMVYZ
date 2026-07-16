export interface PixGridRendererLifecycle {
  readonly disposed: boolean
  setAnimationFrame(id: number): void
  setResizeObserver(observer: ResizeObserver | null): void
  dispose(): void
}

/**
 * Small ownership boundary shared by the Canvas2D baseline and the WebGL
 * replacement planned for Patch 2. It deliberately owns only transient
 * browser resources and never enters persisted PixGrid state.
 */
export function createPixGridRendererLifecycle(onDispose?: () => void): PixGridRendererLifecycle {
  let animationFrame = 0
  let resizeObserver: ResizeObserver | null = null
  let disposed = false

  return {
    get disposed() { return disposed },
    setAnimationFrame(id) {
      if (disposed) {
        if (id) cancelAnimationFrame(id)
        return
      }
      animationFrame = id
    },
    setResizeObserver(observer) {
      if (disposed) {
        observer?.disconnect()
        return
      }
      resizeObserver?.disconnect()
      resizeObserver = observer
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (animationFrame) cancelAnimationFrame(animationFrame)
      animationFrame = 0
      resizeObserver?.disconnect()
      resizeObserver = null
      onDispose?.()
    },
  }
}
