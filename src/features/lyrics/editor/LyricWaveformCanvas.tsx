import { useCallback, useEffect, useRef } from 'react'

interface Props {
  peaks: number[] | null
  loading: boolean
  audioDurationMs: number
  currentTimeMs: number
  className?: string
}

/**
 * Shared lightweight waveform renderer for lyric and visual timelines.
 * Peak generation remains owned by useWaveformPeaks so this component never
 * fetches, decodes, or caches audio independently.
 */
export function LyricWaveformCanvas({
  peaks,
  loading,
  audioDurationMs,
  currentTimeMs,
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ peaks, loading, audioDurationMs, currentTimeMs })
  propsRef.current = { peaks, loading, audioDurationMs, currentTimeMs }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return

    const { peaks: values, loading: isLoading, audioDurationMs: duration, currentTimeMs: current } = propsRef.current
    const width = canvas.width
    const height = canvas.height
    context.clearRect(0, 0, width, height)

    if (isLoading && !values) {
      for (let index = 0; index < 60; index += 1) {
        const barHeight = (Math.sin(index * 0.4) * 0.22 + 0.12) * height
        context.fillStyle = 'rgba(97,214,170,0.07)'
        context.fillRect((index / 60) * width + 0.5, (height - barHeight) / 2, width / 60 - 1, barHeight)
      }
      return
    }

    if (!values?.length || duration <= 0) return
    const barWidth = width / values.length
    for (let index = 0; index < values.length; index += 1) {
      const barTime = (index / values.length) * duration
      const barHeight = Math.max(1, values[index] * (height - 2))
      context.fillStyle = barTime < current
        ? 'rgba(97,214,170,0.72)'
        : 'rgba(255,255,255,0.13)'
      context.fillRect(index * barWidth, (height - barHeight) / 2, Math.max(1, barWidth - 0.3), barHeight)
    }

    const playheadX = Math.min(Math.max(0, current / duration) * width, width)
    if (playheadX > 1) {
      const gradient = context.createLinearGradient(0, 0, playheadX, 0)
      gradient.addColorStop(0, 'rgba(97,214,170,0.07)')
      gradient.addColorStop(1, 'rgba(97,214,170,0.02)')
      context.fillStyle = gradient
      context.fillRect(0, 0, playheadX, height)
    }
  }, [])

  useEffect(() => { draw() }, [draw, peaks, loading, audioDurationMs, currentTimeMs])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (typeof ResizeObserver === 'undefined') {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth || 800))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight || 80))
      draw()
      return
    }
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = Math.max(1, Math.round(entry.contentRect.width))
        canvas.height = Math.max(1, Math.round(entry.contentRect.height))
        draw()
      }
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  return <canvas ref={canvasRef} className={`lyric-waveform-canvas ${className}`.trim()} aria-hidden="true" />
}
