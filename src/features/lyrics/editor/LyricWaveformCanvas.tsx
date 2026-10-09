import { useCallback, useEffect, useRef } from 'react'
import type { TimelineViewport } from '../../timeline/timelineViewport'
import { timeToPixel } from '../../timeline/timelineViewport'

/** Empty space above and below the waveform, in CSS pixels, so the loudest peak never touches the row edges. */
const WAVEFORM_PADDING_PX = 10

interface Props {
  peaks: number[] | null
  loading: boolean
  durationSec: number
  currentTimeSec: number
  viewport: TimelineViewport
  className?: string
}

/**
 * Lightweight shared-peak renderer for lyric authoring. It consumes the same
 * peak cache and viewport geometry as the Audio Dock, but owns no audio fetch,
 * decoder, AudioContext, timer, or transport state.
 */
export function LyricWaveformCanvas({
  peaks,
  loading,
  durationSec,
  currentTimeSec,
  viewport,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ peaks, loading, durationSec, currentTimeSec, viewport })
  propsRef.current = { peaks, loading, durationSec, currentTimeSec, viewport }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return

    const values = propsRef.current.peaks
    const isLoading = propsRef.current.loading
    const duration = Math.max(0.001, propsRef.current.durationSec)
    const current = propsRef.current.currentTimeSec
    const visible = propsRef.current.viewport
    const width = canvas.width
    const height = canvas.height
    context.clearRect(0, 0, width, height)

    if (isLoading && !values) {
      for (let index = 0; index < 72; index += 1) {
        const barHeight = (Math.sin(index * 0.4) * 0.22 + 0.18) * height
        context.fillStyle = 'rgba(97,214,170,0.08)'
        context.fillRect((index / 72) * width + 0.5, (height - barHeight) / 2, width / 72 - 1, barHeight)
      }
      return
    }

    if (!values?.length) return
    // Fractional peak positions for the visible window, so every pixel column samples exactly the peaks it covers.
    const peaksPerSec = values.length / duration
    const firstPeak = visible.startSec * peaksPerSec
    const peaksAcross = Math.max(1e-6, (visible.endSec - visible.startSec) * peaksPerSec)
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const columnWidth = Math.max(1, Math.round(dpr * 2))
    const columnStep = columnWidth + Math.max(1, Math.round(dpr))
    const padding = Math.round(WAVEFORM_PADDING_PX * dpr)
    const plotHeight = Math.max(2, height - padding * 2)

    for (let x = 0; x < width; x += columnStep) {
      const from = Math.max(0, Math.floor(firstPeak + (x / width) * peaksAcross))
      const to = Math.min(values.length, Math.max(from + 1, Math.ceil(firstPeak + ((x + columnStep) / width) * peaksAcross)))
      let peak = 0
      for (let index = from; index < to; index += 1) peak = Math.max(peak, values[index] ?? 0)
      const columnTime = (from / values.length) * duration
      const barHeight = Math.max(2, Math.min(1, peak) * plotHeight)
      context.fillStyle = columnTime < current
        ? 'rgba(97,214,170,0.78)'
        : 'rgba(183,223,231,0.20)'
      context.fillRect(x, Math.round((height - barHeight) / 2), columnWidth, Math.round(barHeight))
    }

    const playheadX = timeToPixel(current, visible, width)
    if (playheadX > 0 && playheadX < width) {
      const gradient = context.createLinearGradient(0, 0, playheadX, 0)
      gradient.addColorStop(0, 'rgba(97,214,170,0.06)')
      gradient.addColorStop(1, 'rgba(97,214,170,0.015)')
      context.fillStyle = gradient
      context.fillRect(0, 0, playheadX, height)
    }
  }, [])

  useEffect(() => { draw() }, [draw, peaks, loading, durationSec, currentTimeSec, viewport])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      draw()
    }
    resize()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  return <canvas ref={canvasRef} className={`lyric-waveform-canvas ${className}`.trim()} aria-hidden="true" />
}
