import type { Group } from 'three'
interface ViewportBridge { group: Group; capture(edge?: number, fit?: boolean): Promise<Blob>; fit(): void; resetCamera(): void }
let bridge: ViewportBridge | null = null
const listeners = new Set<() => void>()
export function registerModelViewport(value: ViewportBridge): () => void {
  bridge = value; listeners.forEach(listener => listener())
  return () => { if (bridge === value) bridge = null }
}
export async function captureModelPreview(group: Group, signal?: AbortSignal, edge = 256, fit = true): Promise<Blob> {
  if (bridge?.group !== group) await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); listeners.delete(check); signal?.removeEventListener('abort', abort) }
    const check = () => { if (bridge?.group === group) { cleanup(); resolve() } }
    const abort = () => { cleanup(); reject(new DOMException('Preview capture cancelled.', 'AbortError')) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('The 3D viewport is not ready. Restore it before saving.')) }, 5000)
    listeners.add(check); signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort(); else check()
  })
  if (signal?.aborted) throw new DOMException('Preview capture cancelled.', 'AbortError')
  if (!bridge || bridge.group !== group) throw new Error('The model viewport changed before capture.')
  return bridge.capture(edge, fit)
}

/** The camera actions of the model viewport that is showing now. They do nothing when there is no viewport, so a key that calls them
 * needs no knowledge of the stage. */
export function fitModelViewport(): void { bridge?.fit() }
export function resetModelCamera(): void { bridge?.resetCamera() }
