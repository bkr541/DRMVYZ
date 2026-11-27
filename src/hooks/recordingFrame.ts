import { isCanvasFrameReady, isCanvasFramePublisher, onCanvasFrameRendered } from '../lib/canvasFrameReadiness'
import { FrameCadence } from '../lib/frameCadence'
import { startRelayFramePump } from '../components/vyzualz/react/output/relayFramePump'
import { performanceOutputSize } from '../components/vyzualz/react/output/performanceOutputGeometry'
import type { OutputAspectRatio } from '../native/outputBridge'
import type { MutableRefObject } from 'react'

/** Preserve the composition, including when the cast owns a different aspect. */
export function drawRecordingFrame(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement): boolean {
  if (!source.width || !source.height || !isCanvasFrameReady(source)) return false
  const { width, height } = ctx.canvas
  const scale = Math.min(width / source.width, height / source.height)
  const w = source.width * scale, h = source.height * scale
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, (width - w) / 2, (height - h) / 2, w, h)
  return true
}

function makeFrame(aspect: OutputAspectRatio) {
  const canvas = document.createElement('canvas')
  const size = performanceOutputSize(aspect)
  canvas.width = size.width; canvas.height = size.height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Unable to allocate output frame')
  return { canvas, context }
}

export function createRecordingFrame(sourceRef: MutableRefObject<HTMLCanvasElement | null>, aspect: OutputAspectRatio, fps: number, onError: (error: unknown) => void) {
  const { canvas, context } = makeFrame(aspect)
  // A publisher's buffer may be cleared between renders. Start black and wait
  // for its next announced frame rather than sampling an already-presented one.
  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const initial = sourceRef.current
  if (initial && !isCanvasFramePublisher(initial)) drawRecordingFrame(context, initial)
  let first = true
  const stop = startRelayFramePump({ sourceRef, cadence: new FrameCadence(fps), copy: source => {
    if (first) { first = false; return }
    if (source) drawRecordingFrame(context, source)
  }, onError })
  return { canvas, stop }
}

export async function captureRecordingPng(source: HTMLCanvasElement, aspect: OutputAspectRatio): Promise<Blob> {
  const { canvas, context } = makeFrame(aspect)
  if (isCanvasFramePublisher(source) || !isCanvasFrameReady(source)) {
    await new Promise<void>((resolve, reject) => {
      const stop = onCanvasFrameRendered(source, () => {
        try { if (!drawRecordingFrame(context, source)) return; cleanup(); resolve() }
        catch (error) { cleanup(); reject(error) }
      })
      const timer = setTimeout(() => { cleanup(); reject(new Error('No completed visual frame received')) }, 2000)
      function cleanup() { clearTimeout(timer); stop() }
    })
  } else if (!drawRecordingFrame(context, source)) throw new Error('No completed visual frame received')
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'))
}
