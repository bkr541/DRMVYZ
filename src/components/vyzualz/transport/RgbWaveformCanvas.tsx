import { useRef, useEffect, useCallback } from 'react'
import type { VzCueMarker } from '../../../types/cue'
import type { RgbWaveformAnalysis } from '../../../features/waveform/rgbWaveformTypes'
import { resolveRgbWaveformColor } from '../../../features/waveform/rgbWaveformColor'

interface RgbWaveformCanvasProps {
  analysis?:      RgbWaveformAnalysis | null
  fallbackPeaks?: number[] | null
  duration:       number
  currentTime:    number
  markers?:       VzCueMarker[]
  onSeek?:        (t: number) => void
  zoom?:          number
}

const PLAYHEAD_COLOR = '#4ac7db'
const PAD            = 12
const N_GRAD_STOPS   = 48  // horizontal gradient color samples

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

// Per-frame draw buffers — allocated once per canvas size change to avoid GC pressure.
interface DrawBuffers {
  len:    number
  xCoord: Float32Array
  rmsTop: Float32Array
  rmsBot: Float32Array
  pkTop:  Float32Array
  pkBot:  Float32Array
}

function ensureBuffers(existing: DrawBuffers | null, len: number): DrawBuffers {
  if (existing && existing.len === len) return existing
  return {
    len,
    xCoord: new Float32Array(len),
    rmsTop: new Float32Array(len),
    rmsBot: new Float32Array(len),
    pkTop:  new Float32Array(len),
    pkBot:  new Float32Array(len),
  }
}

export function RgbWaveformCanvas({
  analysis,
  fallbackPeaks,
  duration,
  currentTime,
  markers = [],
  onSeek,
  zoom = 1,
}: RgbWaveformCanvasProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sizeRef    = useRef({ cssW: 0, cssH: 0, dpr: 1 })
  const buffersRef = useRef<DrawBuffers | null>(null)

  const propsRef = useRef({ analysis, fallbackPeaks, duration, currentTime, markers, zoom })
  propsRef.current = { analysis, fallbackPeaks, duration, currentTime, markers, zoom }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { cssW, cssH, dpr } = sizeRef.current
    if (cssW <= 0 || cssH <= 0) return

    // Work in CSS-pixel coordinates; DPR scaling is handled by the canvas transform.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const { analysis: ana, fallbackPeaks: pk, duration: dur, currentTime: ct, markers: mks, zoom: zm } = propsRef.current
    const safe = dur > 0 ? dur : 1
    const { start: winStart, end: winEnd } = getWindow(safe, ct, zm)
    const winLen = Math.max(0.001, winEnd - winStart)

    ctx.fillStyle = 'rgba(10,13,18,0.96)'
    ctx.fillRect(0, 0, cssW, cssH)

    const availH  = cssH - PAD * 2
    const centerY = PAD + availH / 2
    const halfH   = availH / 2
    const timeToX = (t: number) => ((t - winStart) / winLen) * cssW
    const progressX = timeToX(ct)

    if (ana) {
      const { binCount, positivePeaks, negativePeaks, rms, lowEnergy, midEnergy, highEnergy } = ana
      const startFrac = winStart / safe
      const endFrac   = winEnd   / safe
      const bi0     = Math.max(0,           Math.floor(startFrac * binCount))
      const bi1     = Math.min(binCount - 1, Math.ceil(endFrac   * binCount))
      const visBins = Math.max(1, bi1 - bi0)

      // One point per CSS pixel across the canvas width.
      const N = Math.ceil(cssW) + 1
      buffersRef.current = ensureBuffers(buffersRef.current, N)
      const { xCoord, rmsTop, rmsBot, pkTop, pkBot } = buffersRef.current

      for (let col = 0; col < N; col++) {
        const frac = col / (N - 1)
        xCoord[col] = frac * cssW

        const bStart = bi0 + Math.floor(frac * visBins)
        const bEnd   = bi0 + Math.floor(((col + 1) / (N - 1)) * visBins)
        const b0 = Math.max(0,           Math.min(binCount - 1, bStart))
        const b1 = Math.max(b0,          Math.min(binCount - 1, bEnd))

        let rmsMax = 0, posMax = 0, negMax = 0
        for (let b = b0; b <= b1; b++) {
          if (rms[b]           > rmsMax) rmsMax = rms[b]
          if (positivePeaks[b] > posMax) posMax = positivePeaks[b]
          if (negativePeaks[b] > negMax) negMax = negativePeaks[b]
        }

        rmsTop[col] = centerY - rmsMax * halfH
        rmsBot[col] = centerY + rmsMax * halfH
        pkTop[col]  = centerY - posMax * halfH
        pkBot[col]  = centerY + negMax * halfH
      }

      // Build a horizontal gradient with N_GRAD_STOPS color samples.
      const buildGrad = (alpha: number): CanvasGradient => {
        const g = ctx.createLinearGradient(0, 0, cssW, 0)
        for (let si = 0; si <= N_GRAD_STOPS; si++) {
          const frac = si / N_GRAD_STOPS
          const bi   = Math.min(binCount - 1, bi0 + Math.floor(frac * visBins))
          const c    = resolveRgbWaveformColor({
            low: lowEnergy[bi], mid: midEnergy[bi], high: highEnergy[bi], rms: rms[bi],
          })
          g.addColorStop(frac, `rgba(${c.r},${c.g},${c.b},${alpha})`)
        }
        return g
      }

      // ── Peak envelope (outer shape, low-alpha accent) ─────────────────────
      ctx.beginPath()
      ctx.moveTo(xCoord[0], pkTop[0])
      for (let col = 1; col < N; col++) ctx.lineTo(xCoord[col], pkTop[col])
      for (let col = N - 1; col >= 0; col--) ctx.lineTo(xCoord[col], pkBot[col])
      ctx.closePath()
      ctx.fillStyle = buildGrad(0.20)
      ctx.fill()

      // ── RMS body (main filled shape, fully opaque) ────────────────────────
      ctx.beginPath()
      ctx.moveTo(xCoord[0], rmsTop[0])
      for (let col = 1; col < N; col++) ctx.lineTo(xCoord[col], rmsTop[col])
      for (let col = N - 1; col >= 0; col--) ctx.lineTo(xCoord[col], rmsBot[col])
      ctx.closePath()
      ctx.fillStyle = buildGrad(0.92)
      ctx.fill()

      // Soft brightness overlay on the elapsed region.
      if (progressX > 0) {
        ctx.save()
        ctx.globalAlpha = 0.10
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, progressX, cssH)
        ctx.restore()
      }

    } else if (pk && pk.length > 0) {
      // ── Fallback monochrome ───────────────────────────────────────────────
      const sfrac = winStart / safe
      const efrac = winEnd   / safe
      const si  = Math.max(0,       Math.floor(sfrac * pk.length))
      const ei  = Math.min(pk.length, Math.ceil(efrac * pk.length))
      const vis = pk.slice(si, ei)
      const bw  = vis.length > 0 ? cssW / vis.length : 1

      for (let i = 0; i < vis.length; i++) {
        const peakT = winStart + ((si + i) / pk.length) * safe
        const barH  = Math.max(1, vis[i] * availH)
        const y     = PAD + (availH - barH) / 2
        ctx.fillStyle = peakT < ct ? 'rgba(74,199,219,0.75)' : 'rgba(255,255,255,0.16)'
        ctx.fillRect(i * bw, y, Math.max(1, bw - 0.5), barH)
      }

      if (progressX > 1) {
        const g = ctx.createLinearGradient(0, 0, progressX, 0)
        g.addColorStop(0, 'rgba(74,199,219,0.07)')
        g.addColorStop(1, 'rgba(74,199,219,0.02)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, progressX, cssH)
      }

    } else {
      // ── Placeholder ───────────────────────────────────────────────────────
      const bars  = 80
      const barW  = cssW / bars
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.38) * 0.26 + 0.13) * availH
        const y = PAD + (availH - h) / 2
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(i * barW + 0.5, y, barW - 1, h)
      }
    }

    // Cue markers
    for (const m of mks) {
      if (m.time < winStart || m.time > winEnd) continue
      const mx = timeToX(m.time)
      ctx.fillStyle = m.color ?? 'rgba(184,79,201,0.88)'
      ctx.fillRect(mx - 0.75, 0, 1.5, cssH)
    }

    // Playhead
    if (progressX >= 0 && progressX <= cssW) {
      ctx.fillStyle = PLAYHEAD_COLOR
      ctx.fillRect(progressX - 1, 0, 2, cssH)
      ctx.beginPath()
      ctx.moveTo(progressX - 5, 0)
      ctx.lineTo(progressX + 5, 0)
      ctx.lineTo(progressX,     7)
      ctx.closePath()
      ctx.fillStyle = PLAYHEAD_COLOR
      ctx.fill()
    }
  }, [])

  useEffect(() => { draw() }, [draw, analysis, currentTime, duration, zoom, markers, fallbackPeaks])

  // Sync canvas physical resolution to CSS layout size, accounting for DPR.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        const dpr = Math.min(2, window.devicePixelRatio ?? 1)
        sizeRef.current = { cssW: width, cssH: height, dpr }
        canvas.width  = Math.round(width  * dpr)
        canvas.height = Math.round(height * dpr)
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
      title={duration > 0 ? 'Click or drag to seek' : undefined}
      style={{ cursor: onSeek && duration > 0 ? 'pointer' : 'default' }}
    />
  )
}
