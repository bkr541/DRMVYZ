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

// Build an ImageData buffer for the full static waveform (zoom-independent).
function buildStaticImageData(
  analysis: RgbWaveformAnalysis,
  W: number,
  H: number,
): ImageData {
  const { binCount, positivePeaks, negativePeaks, rms, lowEnergy, midEnergy, highEnergy } = analysis
  const data = new Uint8ClampedArray(W * H * 4)
  const drawableHalf = Math.max(1, (H - 4) / 2)
  const centerY      = H / 2

  for (let x = 0; x < W; x++) {
    // Map pixel column to bin range
    const fracStart = x / W
    const fracEnd   = (x + 1) / W
    const bi0 = Math.max(0,           Math.floor(fracStart * binCount))
    const bi1 = Math.min(binCount - 1, Math.floor(fracEnd   * binCount))

    // Aggregate bins for this pixel column
    let posMax = 0, negMax = 0
    let rmsSum = 0, lowSum = 0, midSum = 0, highSum = 0
    let count = 0

    for (let b = bi0; b <= bi1; b++) {
      const p = positivePeaks[b]
      const n = negativePeaks[b]
      if (p > posMax) posMax = p
      if (n > negMax) negMax = n
      rmsSum  += rms[b]
      lowSum  += lowEnergy[b]
      midSum  += midEnergy[b]
      highSum += highEnergy[b]
      count++
    }

    const n = Math.max(1, count)
    const rmsVal  = rmsSum  / n
    const lowVal  = lowSum  / n
    const midVal  = midSum  / n
    const highVal = highSum / n

    const color = resolveRgbWaveformColor({ low: lowVal, mid: midVal, high: highVal, rms: rmsVal })

    const topY    = Math.round(centerY - posMax * drawableHalf)
    const bottomY = Math.round(centerY + negMax * drawableHalf)
    const rmsTop  = Math.round(centerY - rmsVal * drawableHalf)
    const rmsBot  = Math.round(centerY + rmsVal * drawableHalf)

    // Fill pixel column: outer peak at reduced alpha, RMS core fully opaque
    for (let y = topY; y <= bottomY; y++) {
      if (y < 0 || y >= H) continue
      const inRms = y >= rmsTop && y <= rmsBot
      const idx   = (y * W + x) * 4
      data[idx]     = color.r
      data[idx + 1] = color.g
      data[idx + 2] = color.b
      data[idx + 3] = inRms ? 230 : 140
    }
  }

  return new ImageData(data, W, H)
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
  const staticRef  = useRef<ImageData | null>(null)
  const sizeRef    = useRef({ W: 0, H: 0 })

  // Keep latest props available in draw without recreating the callback
  const propsRef = useRef({ analysis, fallbackPeaks, duration, currentTime, markers, zoom })
  propsRef.current = { analysis, fallbackPeaks, duration, currentTime, markers, zoom }

  const buildStatic = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width
    const H = canvas.height
    sizeRef.current = { W, H }
    const ana = propsRef.current.analysis
    if (!ana || W === 0 || H === 0) { staticRef.current = null; return }
    staticRef.current = buildStaticImageData(ana, W, H)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    if (W === 0 || H === 0) return

    const { analysis: ana, fallbackPeaks: pk, duration: dur, currentTime: ct, markers: mks, zoom: zm } = propsRef.current
    const safe = dur > 0 ? dur : 1
    const { start: winStart, end: winEnd } = getWindow(safe, ct, zm)
    const winLen = Math.max(0.001, winEnd - winStart)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(10,13,18,0.96)'
    ctx.fillRect(0, 0, W, H)

    const timeToX = (t: number) => ((t - winStart) / winLen) * W
    const progressX = timeToX(ct)

    if (ana) {
      // ── RGB mode ──────────────────────────────────────────────────────────
      if (zm <= 1) {
        // Use pre-built static layer
        const img = staticRef.current
        if (img && img.width === W && img.height === H) {
          ctx.putImageData(img, 0, 0)
        } else {
          // Rebuild if mismatched (e.g. after resize)
          const fresh = buildStaticImageData(ana, W, H)
          staticRef.current = fresh
          ctx.putImageData(fresh, 0, 0)
        }
      } else {
        // Zoomed: draw only visible bin range directly each frame
        const { binCount, positivePeaks, negativePeaks, rms, lowEnergy, midEnergy, highEnergy } = ana
        const startFrac = winStart / safe
        const endFrac   = winEnd   / safe
        const bi0Total  = Math.floor(startFrac * binCount)
        const bi1Total  = Math.ceil (endFrac   * binCount)
        const visibleBins = Math.max(1, bi1Total - bi0Total)

        const imageData = ctx.createImageData(W, H)
        const data      = imageData.data
        const drawableHalf = Math.max(1, (H - 4) / 2)
        const centerY      = H / 2

        for (let x = 0; x < W; x++) {
          const bStart = bi0Total + Math.floor((x / W) * visibleBins)
          const bEnd   = bi0Total + Math.floor(((x + 1) / W) * visibleBins)
          const bi0 = Math.max(0, Math.min(binCount - 1, bStart))
          const bi1 = Math.max(0, Math.min(binCount - 1, bEnd))

          let posMax = 0, negMax = 0
          let rmsSum = 0, lowSum = 0, midSum = 0, highSum = 0, n = 0
          for (let b = bi0; b <= bi1; b++) {
            const p = positivePeaks[b]
            const ng = negativePeaks[b]
            if (p > posMax) posMax = p
            if (ng > negMax) negMax = ng
            rmsSum += rms[b]; lowSum += lowEnergy[b]
            midSum += midEnergy[b]; highSum += highEnergy[b]
            n++
          }
          const nc = Math.max(1, n)
          const color = resolveRgbWaveformColor({
            low: lowSum / nc, mid: midSum / nc, high: highSum / nc, rms: rmsSum / nc,
          })
          const topY   = Math.round(centerY - posMax * drawableHalf)
          const botY   = Math.round(centerY + negMax * drawableHalf)
          const rmsTop = Math.round(centerY - (rmsSum / nc) * drawableHalf)
          const rmsBot = Math.round(centerY + (rmsSum / nc) * drawableHalf)
          for (let y = topY; y <= botY; y++) {
            if (y < 0 || y >= H) continue
            const idx = (y * W + x) * 4
            data[idx] = color.r; data[idx + 1] = color.g; data[idx + 2] = color.b
            data[idx + 3] = (y >= rmsTop && y <= rmsBot) ? 230 : 140
          }
        }
        ctx.putImageData(imageData, 0, 0)
      }

      // Played-region brightening overlay
      if (progressX > 0) {
        ctx.save()
        ctx.globalAlpha = 0.10
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, progressX, H)
        ctx.restore()
      }

    } else if (pk && pk.length > 0) {
      // ── Fallback monochrome mode ───────────────────────────────────────────
      const startFrac = winStart / safe
      const endFrac   = winEnd   / safe
      const si  = Math.max(0, Math.floor(startFrac * pk.length))
      const ei  = Math.min(pk.length, Math.ceil(endFrac * pk.length))
      const vis = pk.slice(si, ei)
      const bw  = vis.length > 0 ? W / vis.length : 1

      for (let i = 0; i < vis.length; i++) {
        const peakT = winStart + ((si + i) / pk.length) * safe
        const barH  = Math.max(1, vis[i] * (H - 4))
        const y     = (H - barH) / 2
        ctx.fillStyle = peakT < ct ? 'rgba(74,199,219,0.75)' : 'rgba(255,255,255,0.16)'
        ctx.fillRect(i * bw, y, Math.max(1, bw - 0.5), barH)
      }

      if (progressX > 1) {
        const g = ctx.createLinearGradient(0, 0, progressX, 0)
        g.addColorStop(0, 'rgba(74,199,219,0.07)')
        g.addColorStop(1, 'rgba(74,199,219,0.02)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, progressX, H)
      }

    } else {
      // ── Placeholder ───────────────────────────────────────────────────────
      const bars = 80
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.38) * 0.26 + 0.13) * H
        const y = (H - h) / 2
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect((i / bars) * W + 0.5, y, W / bars - 1, h)
      }
    }

    // Cue markers
    for (const m of mks) {
      if (m.time < winStart || m.time > winEnd) continue
      const mx = timeToX(m.time)
      ctx.fillStyle = m.color ?? 'rgba(184,79,201,0.88)'
      ctx.fillRect(mx - 0.75, 0, 1.5, H)
    }

    // Playhead
    if (progressX >= 0 && progressX <= W) {
      ctx.fillStyle = PLAYHEAD_COLOR
      ctx.fillRect(progressX - 1, 0, 2, H)
      ctx.beginPath()
      ctx.moveTo(progressX - 5, 0)
      ctx.lineTo(progressX + 5, 0)
      ctx.lineTo(progressX, 7)
      ctx.closePath()
      ctx.fillStyle = PLAYHEAD_COLOR
      ctx.fill()
    }
  }, [])

  // Rebuild static layer when analysis or canvas size changes
  useEffect(() => {
    buildStatic()
    draw()
  }, [buildStatic, draw, analysis])

  // Redraw on time/zoom/marker changes (no static rebuild needed)
  useEffect(() => { draw() }, [draw, currentTime, duration, zoom, markers, fallbackPeaks])

  // Sync canvas pixel dimensions to CSS layout size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        canvas.width  = Math.round(width)
        canvas.height = Math.round(height)
        buildStatic()
        draw()
      }
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [buildStatic, draw])

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
