// A preset can reuse its DOM canvas while replacing every renderer resource.
// Relay consumers must wait for a completed replacement frame, not copy setup clears.
const pending = new WeakSet<HTMLCanvasElement>()

export function markCanvasFramePending(canvas: HTMLCanvasElement): void { pending.add(canvas) }
export function markCanvasFrameReady(canvas: HTMLCanvasElement): void { pending.delete(canvas) }
export function isCanvasFrameReady(canvas: HTMLCanvasElement): boolean { return !pending.has(canvas) }

// A WebGL canvas keeps its picture only until the browser presents the frame; copied after that (or before the next render), it reads back as cleared. So a consumer that
// copies a canvas from its own animation-frame callback gets a blank picture whenever its callback happens to run before the canvas's own renderer in a frame, and the order
// follows who registered first (a relay started before a preset change runs before the new preset's renderer). A renderer that can announce each finished frame lets
// consumers copy it in the same task, right after the draw, when it is guaranteed to be intact.
const rendered = new WeakMap<HTMLCanvasElement, { listeners: Set<() => void>; lastAt: number }>()
const entry = (canvas: HTMLCanvasElement) => { let value = rendered.get(canvas); if (!value) { value = { listeners: new Set(), lastAt: Number.NEGATIVE_INFINITY }; rendered.set(canvas, value) } return value }

/** Called by a renderer right after it finishes drawing a frame into `canvas`, in the same task as the draw. */
export function notifyCanvasFrameRendered(canvas: HTMLCanvasElement, now: number = performance.now()): void {
  const value = entry(canvas)
  value.lastAt = now
  for (const listener of [...value.listeners]) {
    try { listener() } catch { /* A consumer must never stop the renderer. */ }
  }
}

/** Runs `listener` after every frame the canvas's renderer announces. Returns the unsubscribe. */
export function onCanvasFrameRendered(canvas: HTMLCanvasElement, listener: () => void): () => void {
  const value = entry(canvas)
  value.listeners.add(listener)
  return () => { value.listeners.delete(listener) }
}

/** True while something (a cast relay) is waiting for this canvas's frames. A renderer that stops drawing when idle or paused should keep producing frames while this is true: a WebGL canvas cannot be read back between frames. */
export function hasCanvasFrameListeners(canvas: HTMLCanvasElement): boolean {
  const value = rendered.get(canvas)
  return value != null && value.listeners.size > 0
}

/** True while the canvas's renderer announces its frames (it did within `withinMs`), so consumers should copy on the announcement instead of on their own timer. */
export function isCanvasFramePublisher(canvas: HTMLCanvasElement, withinMs = 250, now: number = performance.now()): boolean {
  const value = rendered.get(canvas)
  return value != null && now - value.lastAt <= withinMs
}
