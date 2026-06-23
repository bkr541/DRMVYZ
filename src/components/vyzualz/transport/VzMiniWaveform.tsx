import { useRef, useEffect, useCallback } from 'react'
import type { VzCueMarker } from '../../../types/cue'

interface VzMiniWaveformProps {
  duration:    number
  currentTime: number
  peaks:       number[] | null
  markers?:    VzCueMarker[]
  onSeek?:     (t: number) => void
  zoom?:       number
}

const CYAN_ELAPSED  = 'rgba(74,199,219,0.75)'
const CYAN_PLAYHEAD = '#4ac7db'
const UPCOMING      = 'rgba(255,255,255,0.16)'
const PAD           = 12

function getWindow(duration: number, currentTime: number, zoom: number) {
  const safe = duration > 0 ? duration : 1
  const win  = safe / zoom
  if (zoom <= 1) return { start: 0, end: safe }
  let start = currentTime - win / 2
  let end   = start + win
  if (start < 0)    { start = 0;    end = win }
  if (end   > safe) { end   = safe; start = safe - win }
  return { start, end }
}

export function VzMiniWaveform({
  duration,
  currentTime,
  peaks,
  markers = [],
  onSeek,
  zoom = 1,
}: VzMiniWaveformProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  // Keep latest props in a ref so draw() is always fresh without recreating callbacks
  const propsRef   = useRef({ duration, currentTime, peaks, markers, zoom })
  propsRef.current = { duration, currentTime, peaks, markers, zoom }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use CSS pixel dimensions — canvas.width/height are set without DPR scaling
    const W = canvas.width
    const H = canvas.height
    if (W === 0 || H === 0) return

    const { duration: dur, currentTime: ct, peaks: pk, markers: mks, zoom: zm } = propsRef.current
    const safe = dur > 0 ? dur : 1
    const { start: winStart, end: winEnd } = getWindow(safe, ct, zm)
    const winLen = Math.max(0.001, winEnd - winStart)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(10,13,18,0.96)'
    ctx.fillRect(0, 0, W, H)

    const timeToX = (t: number) => ((t - winStart) / winLen) * W

    if (pk && pk.length > 0) {
      const startFrac = winStart / safe
      const endFrac   = winEnd   / safe
      const si  = Math.max(0, Math.floor(startFrac * pk.length))
      const ei  = Math.min(pk.length, Math.ceil(endFrac * pk.length))
      const vis = pk.slice(si, ei)
      const bw  = vis.length > 0 ? W / vis.length : 1

      const availH = H - PAD * 2
      for (let i = 0; i < vis.length; i++) {
        const peakT = winStart + ((si + i) / pk.length) * safe
        const barH  = Math.max(1, vis[i] * availH)
        const y     = PAD + (availH - barH) / 2
        ctx.fillStyle = peakT < ct ? CYAN_ELAPSED : UPCOMING
        ctx.fillRect(i * bw, y, Math.max(1, bw - 0.5), barH)
      }

      // Soft tint over elapsed portion
      const phx = timeToX(ct)
      if (phx > 1) {
        const g = ctx.createLinearGradient(0, 0, phx, 0)
        g.addColorStop(0, 'rgba(74,199,219,0.07)')
        g.addColorStop(1, 'rgba(74,199,219,0.02)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, phx, H)
      }
    } else {
      // Placeholder waveform shape
      const bars    = 80
      const availH  = H - PAD * 2
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.38) * 0.26 + 0.13) * availH
        const y = PAD + (availH - h) / 2
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect((i / bars) * W + 0.5, y, W / bars - 1, h)
      }
    }

    // Marker ticks
    for (const m of mks) {
      if (m.time < winStart || m.time > winEnd) continue
      const mx = timeToX(m.time)
      ctx.fillStyle = m.color ?? 'rgba(184,79,201,0.88)'
      ctx.fillRect(mx - 0.75, 0, 1.5, H)
    }

    // Playhead
    const phx = timeToX(ct)
    if (phx >= 0 && phx <= W) {
      ctx.fillStyle = CYAN_PLAYHEAD
      ctx.fillRect(phx - 1, 0, 2, H)
      // Triangle cap
      ctx.beginPath()
      ctx.moveTo(phx - 5, 0)
      ctx.lineTo(phx + 5, 0)
      ctx.lineTo(phx, 7)
      ctx.closePath()
      ctx.fillStyle = CYAN_PLAYHEAD
      ctx.fill()
    }
  }, [])

  // Redraw when props change
  useEffect(() => { draw() }, [draw, duration, currentTime, peaks, markers, zoom])

  // Keep canvas pixel size in sync with CSS layout size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        canvas.width  = Math.round(width)
        canvas.height = Math.round(height)
        draw()
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [draw])

  const seekAtPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { duration: dur, currentTime: ct, zoom: zm } = propsRef.current
    if (!onSeek || dur <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const { start, end } = getWindow(dur, ct, zm)
    onSeek(Math.max(0, Math.min(dur, start + frac * (end - start))))
  }, [onSeek])

  return (
    <canvas
      ref={canvasRef}
      className="vz-mini-waveform"
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seekAtPointer(e) }}
      onPointerMove={e => { if (e.buttons > 0) seekAtPointer(e) }}
      title={propsRef.current.duration > 0 ? 'Click or drag to seek' : undefined}
      style={{ cursor: onSeek && propsRef.current.duration > 0 ? 'pointer' : 'default' }}
    />
  )
}
