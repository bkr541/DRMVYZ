// A preset can reuse its DOM canvas while replacing every renderer resource.
// Relay consumers must wait for a completed replacement frame, not copy setup clears.
const pending = new WeakSet<HTMLCanvasElement>()

export function markCanvasFramePending(canvas: HTMLCanvasElement): void { pending.add(canvas) }
export function markCanvasFrameReady(canvas: HTMLCanvasElement): void { pending.delete(canvas) }
export function isCanvasFrameReady(canvas: HTMLCanvasElement): boolean { return !pending.has(canvas) }
