import type { OutputAspectRatio } from '../../../../native/outputBridge'

export interface PerformanceSize { width: number; height: number }
export type PerformanceTransport = 'webrtc' | 'google-cast-webm'

const ASPECT_UNITS: Record<OutputAspectRatio, readonly [number, number]> = {
  '16:9': [16, 9], '16:10': [8, 5], '4:3': [4, 3],
  '3:2': [3, 2], '1:1': [1, 1], '9:16': [9, 16],
}

/** Exact, even encoder dimensions; never derived from the operator's layout. */
export function performanceOutputSize(aspectRatio: OutputAspectRatio, transport: PerformanceTransport = 'webrtc'): PerformanceSize {
  const long = transport === 'google-cast-webm' ? 1280 : 1920
  const short = transport === 'google-cast-webm' ? 720 : 1080
  return fitPerformanceSize(aspectRatio, long, short)
}

function fitPerformanceSize(aspectRatio: OutputAspectRatio, long: number, short: number): PerformanceSize {
  const [x, y] = ASPECT_UNITS[aspectRatio]
  const multiple = 2 * Math.floor(Math.min(long / Math.max(x, y), short / Math.min(x, y)) / 2)
  return { width: x * multiple, height: y * multiple }
}

/** Retain the transition controller's edge budget without changing the selected ratio. */
export function performanceTransitionSize(aspectRatio: OutputAspectRatio, maxEdge: number): PerformanceSize {
  const output = performanceOutputSize(aspectRatio)
  return fitPerformanceSize(aspectRatio, Math.min(maxEdge, Math.max(output.width, output.height)), Math.min(maxEdge, Math.min(output.width, output.height)))
}

/** Preview scale is presentation-only; renderers never consume this value. */
export function performancePreviewScale(available: PerformanceSize, output: PerformanceSize): number {
  return Math.max(0, Math.min(available.width / output.width, available.height / output.height))
}

/** Allow integer rounding in adaptive renderer allocations, but not a different composition. */
export function matchesPerformanceAspect(source: PerformanceSize, output: PerformanceSize): boolean {
  if (source.width <= 0 || source.height <= 0) return false
  const ratio = output.width / output.height
  return Math.abs(source.width - source.height * ratio) <= 1 + ratio
}

/** The fixed viewport already represents output pixels. Do not multiply it by a
 * Retina monitor's DPR and accidentally render a 4K canvas for a 1080p cast.
 * Existing per-engine quality scales can still reduce allocation below that size. */
export function performanceRenderDpr(element: HTMLElement | null, dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1): number {
  return element?.closest?.('[data-performance-geometry-locked="true"]') ? Math.min(1, dpr) : dpr
}

/** Render geometry must be measured before the preview transform is applied.
 * Keep historical DOM measurements everywhere outside the locked performance stage. */
export function measurePerformanceSurface(element: HTMLElement): PerformanceSize {
  if (element.closest?.('[data-performance-geometry-locked="true"]')) {
    return { width: element.clientWidth, height: element.clientHeight }
  }
  const { width, height } = element.getBoundingClientRect()
  return { width, height }
}

/** Hold the previous picture during a source handoff or pending format change.
 * A mismatched source must never stretch or reframe the outgoing performance. */
export function copyPerformanceFrame(context: CanvasRenderingContext2D, source: HTMLCanvasElement, output: PerformanceSize): boolean {
  if (!matchesPerformanceAspect(source, output)) return false
  context.drawImage(source, 0, 0, output.width, output.height)
  return true
}
