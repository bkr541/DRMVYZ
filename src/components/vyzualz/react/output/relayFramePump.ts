import type { MutableRefObject } from 'react'
import { isCanvasFramePublisher, onCanvasFrameRendered } from '../../../../lib/canvasFrameReadiness'

/**
 * Drives a cast relay's copy of the live visualizer canvas.
 *
 * A WebGL canvas holds its picture only until the browser presents the frame; copied from a timer callback that ran before the canvas's own renderer in that frame, it reads back
 * cleared, which sent a black, frozen picture to the output after every Cinema 2.0 preset change (the new preset's render loop registers after the relay's, so the relay always ran
 * first) while the app still said "connected". So:
 *  - when the canvas's renderer announces each finished frame (lib/canvasFrameReadiness.ts), the frame is copied in the announcement, in the same task as the draw;
 *  - a canvas that does not announce (a 2D canvas, another engine) is copied on the frame timer as before;
 *  - nothing a copy throws can end the loop: the timer always schedules the next tick, and only repeated, different failures are reported.
 */
export interface RelayFramePumpOptions {
  sourceRef: MutableRefObject<HTMLCanvasElement | null>
  /** Decides whether a frame is due now (limits the relay's frame rate). */
  cadence: { due(timestamp: number): boolean }
  /** Copies the current source (null when there is none) into the relay. */
  copy(source: HTMLCanvasElement | null): void
  /** Called with a failure the pump swallowed, at most once per distinct message. */
  onError?: (error: unknown) => void
}

export function startRelayFramePump({ sourceRef, cadence, copy, onError }: RelayFramePumpOptions): () => void {
  let stopped = false
  let frameId = 0
  let subscribedTo: HTMLCanvasElement | null = null
  let unsubscribe: (() => void) | null = null
  const reported = new Set<string>()

  const copyOnce = () => {
    if (stopped) return
    try {
      copy(sourceRef.current)
    } catch (error) {
      // A nonzero canvas can still be undrawable during renderer teardown; nothing here may stop the relay.
      if (error instanceof DOMException && error.name === 'InvalidStateError') return
      const key = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      if (!reported.has(key) && reported.size < 5) { reported.add(key); try { onError?.(error) } catch { /* Reporting is best effort. */ } }
    }
  }

  /** Follows the source: a new preset or engine can hand the relay a different canvas at any time. */
  const follow = () => {
    const source = sourceRef.current
    if (source === subscribedTo) return
    unsubscribe?.()
    unsubscribe = null
    subscribedTo = source
    if (source) unsubscribe = onCanvasFrameRendered(source, () => { if (cadence.due(performance.now())) copyOnce() })
  }

  const tick = (now: number) => {
    if (stopped) return
    try {
      follow()
      const source = sourceRef.current
      // A canvas whose renderer announces its frames is copied on the announcement; copying it here could read a cleared buffer.
      if (!(source && isCanvasFramePublisher(source)) && cadence.due(now)) copyOnce()
    } finally {
      if (!stopped) frameId = window.requestAnimationFrame(tick)
    }
  }

  follow()
  // The first frame is copied at once (so the relay has a picture before it is captured) and, as before, a failure here fails the start.
  copy(sourceRef.current)
  frameId = window.requestAnimationFrame(tick)

  return () => {
    stopped = true
    window.cancelAnimationFrame(frameId)
    unsubscribe?.()
    unsubscribe = null
    subscribedTo = null
  }
}
