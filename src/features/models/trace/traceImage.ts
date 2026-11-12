import { checkAbort, checkDimensions, ModelGenerationError } from '../geometry/modelQualityBudget'
import { sanitizeModelSvg } from './svgSanitize'
export const VTRACER_VERSION = '1.0.0-alpha.4'
export interface RasterTraceRequest { pixels: Uint8Array; width: number; height: number; options: { smoothing: number }; signal?: AbortSignal }
export interface RasterVectorizer { trace(input: RasterTraceRequest): Promise<string> }
export class VTracerVectorizer implements RasterVectorizer {
  async trace(input: RasterTraceRequest): Promise<string> {
    checkAbort(input.signal); checkDimensions(input.width, input.height)
    if (input.pixels.byteLength !== input.width * input.height * 4) throw new ModelGenerationError('trace_input', 'Invalid RGBA trace buffer.')
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./traceImageWorker.ts', import.meta.url), { type: 'module' })
      const cleanup = () => { worker.terminate(); clearTimeout(timeout); input.signal?.removeEventListener('abort', onAbort) }
      const fail = (error: unknown) => { cleanup(); reject(error) }
      const onAbort = () => fail(new DOMException('Model tracing cancelled.', 'AbortError'))
      const timeout = setTimeout(() => fail(new ModelGenerationError('trace_timeout', 'Model tracing exceeded the 30-second budget.')), 30_000)
      worker.onmessage = ({ data }: MessageEvent<{ svg?: unknown; error?: string }>) => {
        cleanup()
        try {
          checkAbort(input.signal)
          if (typeof data.svg !== 'string') throw new ModelGenerationError('trace_failed', data.error ?? 'VTracer returned no vector geometry.')
          resolve(sanitizeModelSvg(data.svg))
        } catch (error) { reject(error) }
      }
      worker.onerror = event => fail(new ModelGenerationError('trace_failed', event.message || 'VTracer worker failed.'))
      input.signal?.addEventListener('abort', onAbort, { once: true })
      // Own the copy so callers retain their editable source pixels.
      const pixels = new Uint8Array(input.pixels)
      worker.postMessage({ pixels, width: input.width, height: input.height, smoothing: input.options.smoothing }, [pixels.buffer])
    })
  }
}
