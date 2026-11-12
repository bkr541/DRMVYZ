import wasmUrl from './vendor/vtracer.wasm?url'
import { initialize, vectorize_rgba } from './vendor/vtracer.js'
import { checkDimensions } from '../geometry/modelQualityBudget'
export interface TraceWorkerRequest { pixels: Uint8Array; width: number; height: number; smoothing: number }
const scope = self as unknown as { onmessage: ((event: MessageEvent<TraceWorkerRequest>) => Promise<void>) | null; postMessage(value: unknown): void }
scope.onmessage = async ({ data }) => {
  try {
    checkDimensions(data.width, data.height)
    if (data.pixels.byteLength !== data.width * data.height * 4 || !Number.isFinite(data.smoothing) || data.smoothing < 0 || data.smoothing > 1) throw new Error('Invalid trace worker input.')
    const response = await fetch(wasmUrl)
    if (!response.ok) throw new Error('VTracer WASM could not be loaded.')
    await initialize(await response.arrayBuffer())
    const svg = vectorize_rgba(data.pixels, data.width, data.height, {
      clustering: 'bw', mode: data.smoothing > 0 ? 'spline' : 'polygon', filterSpeckle: 1,
      binaryThreshold: 128, cornerThreshold: 60, lengthThreshold: 1 + data.smoothing * 5,
      maxIterations: 10, spliceThreshold: 45, pathPrecision: 3,
    })
    scope.postMessage({ svg })
  } catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'VTracer tracing failed.' }) }
}
