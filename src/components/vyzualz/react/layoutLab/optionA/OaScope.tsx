import { useCallback, useEffect, useRef } from 'react'
import type { RgbWaveformAnalysis } from '../../../../../features/waveform/rgbWaveformTypes'
import type { VzCueMarker } from '../../../../../types/cue'
import { clientXToTimelineTime, computeWaveformViewport } from '../../../../../features/timeline/timelineViewport'

// ── Option A · waveform scope ──────────────────────────────────────────────────────────────────────────────────
//
// Option A's own deck waveform. It reads the same analysis the production canvas does (the peaks and the low / mid /
// high energy per bin) and the same zoom viewport, but draws it as an instrument: mirrored bars that run from graphite
// (what is still to come) to a lit ember-to-ice gradient (what has played), a white playhead with a square head, and the
// cue flags as small LED squares with their names on a ruler at the top. Click or drag to seek, as on the production deck.

const BAR = 3
const GAP = 2
const RULER = 16

function cssVar(element: Element, name: string, fallback: string) {
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback
}

export function OaScope({ analysis, duration, currentTime, markers, zoom, onSeek }: {
  analysis: RgbWaveformAnalysis
  duration: number
  currentTime: number
  markers: readonly VzCueMarker[]
  zoom: number
  onSeek: (timeSec: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ analysis, duration, currentTime, markers, zoom })
  stateRef.current = { analysis, duration, currentTime, markers, zoom }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.('2d')
    if (!canvas || !ctx) return
    const { analysis: data, duration: total, currentTime: now, markers: flags, zoom: level } = stateRef.current
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const ember = cssVar(canvas, '--oa-ember', '#f3a58f')
    const emberDeep = cssVar(canvas, '--oa-ember-deep', '#e5765f')
    const ice = cssVar(canvas, '--oa-ice', '#c4e7ff')
    const faint = cssVar(canvas, '--oa-bar-idle', 'rgba(255,255,255,0.13)')

    const viewport = computeWaveformViewport(total, now, level)
    const span = Math.max(0.001, viewport.endSec - viewport.startSec)
    const timeToX = (t: number) => ((t - viewport.startSec) / span) * width
    const playX = timeToX(now)
    const mid = RULER + (height - RULER) / 2
    const half = (height - RULER) / 2 - 6

    const lit = ctx.createLinearGradient(0, 0, Math.max(1, playX), 0)
    lit.addColorStop(0, emberDeep)
    lit.addColorStop(0.7, ember)
    lit.addColorStop(1, ice)

    const columns = Math.floor(width / (BAR + GAP))
    for (let column = 0; column < columns; column += 1) {
      const x = column * (BAR + GAP)
      const t = viewport.startSec + ((x + BAR / 2) / width) * span
      const bin = Math.min(data.binCount - 1, Math.max(0, Math.floor((t / total) * data.binCount)))
      const up = Math.max(0.03, data.positivePeaks[bin] ?? 0)
      const down = Math.max(0.03, -(data.negativePeaks[bin] ?? 0))
      ctx.fillStyle = x + BAR <= playX ? lit : faint
      ctx.beginPath()
      ctx.roundRect(x, mid - up * half, BAR, (up + down) * half, 1.5)
      ctx.fill()
    }

    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.fillRect(0, mid, width, 1)

    ctx.font = '600 8px Michroma, Manrope, sans-serif'
    ctx.textBaseline = 'top'
    const visibleFlags = [...flags]
      .sort((first, second) => first.time - second.time)
      .filter(flag => flag.time >= viewport.startSec && flag.time <= viewport.endSec)
    visibleFlags.forEach((flag, position) => {
      const x = Math.round(timeToX(flag.time))
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.fillRect(x, RULER, 1, height - RULER)
      ctx.fillStyle = flag.color ?? ember
      ctx.fillRect(x - 3, 3, 6, 6)
      // A name is written only when it fits before the next flag, so labels never run into one another.
      const nextX = position + 1 < visibleFlags.length ? Math.round(timeToX(visibleFlags[position + 1]!.time)) - 8 : width
      const label = flag.label.toUpperCase()
      if (x + 8 + ctx.measureText(label).width < nextX) {
        ctx.fillStyle = 'rgba(233,232,234,0.78)'
        ctx.fillText(label, x + 8, 3)
      }
    })

    ctx.fillStyle = '#fff'
    ctx.fillRect(Math.round(playX) - 1, RULER - 2, 2, height - RULER + 2)
    ctx.beginPath()
    ctx.roundRect(Math.round(playX) - 4, RULER - 7, 8, 8, 2)
    ctx.fill()
  }, [])

  useEffect(() => { draw() }, [draw, analysis, duration, currentTime, markers, zoom])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => draw())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [draw])

  const seek = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { duration: total, currentTime: now, zoom: level } = stateRef.current
    onSeek(clientXToTimelineTime(event.clientX, canvas.getBoundingClientRect(), computeWaveformViewport(total, now, level), total))
  }

  return (
    <canvas
      ref={canvasRef}
      className="oa-scope"
      role="img"
      aria-label="Track waveform. Click or drag to seek."
      title="Click or drag to seek"
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); seek(event) }}
      onPointerMove={event => { if ((event.buttons & 1) === 1) seek(event) }}
    />
  )
}
