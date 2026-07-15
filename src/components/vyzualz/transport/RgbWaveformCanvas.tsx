import { useRef, useEffect, useCallback } from 'react'
import type { VzCueMarker } from '../../../types/cue'
import type { RgbWaveformAnalysis } from '../../../features/waveform/rgbWaveformTypes'
import { resolveRgbWaveformColor } from '../../../features/waveform/rgbWaveformColor'
import { clientXToTimelineTime, computeWaveformViewport } from '../../../features/timeline/timelineViewport'

interface RgbWaveformCanvasProps {
  analysis?:      RgbWaveformAnalysis | null
  fallbackPeaks?: number[] | null
  duration:       number
  currentTime:    number
  markers?:       VzCueMarker[]
  onSeek?:        (t: number) => void
  zoom?:          number
  /** Render a cyan, bar-based deck waveform instead of the RGB energy fill. */
  monochrome?:    boolean
  /** Draw a full-height stem beneath each cue flag. Track Map markers are unaffected. */
  showCueMarkerLines?: boolean
}

const PLAYHEAD_COLOR = '#4ac7db'
const PAD            = 12
const N_GRAD_STOPS   = 48  // horizontal gradient color samples

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
  monochrome = false,
  showCueMarkerLines = true,
}: RgbWaveformCanvasProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const sizeRef    = useRef({ cssW: 0, cssH: 0, dpr: 1 })
  const buffersRef = useRef<DrawBuffers | null>(null)

  const propsRef = useRef({ analysis, fallbackPeaks, duration, currentTime, markers, zoom, monochrome, showCueMarkerLines })
  propsRef.current = { analysis, fallbackPeaks, duration, currentTime, markers, zoom, monochrome, showCueMarkerLines }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { cssW, cssH, dpr } = sizeRef.current
    if (cssW <= 0 || cssH <= 0) return

    // Work in CSS-pixel coordinates; DPR scaling is handled by the canvas transform.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const {
      analysis: ana,
      fallbackPeaks: pk,
      duration: dur,
      currentTime: ct,
      markers: mks,
      zoom: zm,
      monochrome: mono,
      showCueMarkerLines: cueMarkerLinesVisible,
    } = propsRef.current
    const safe = dur > 0 ? dur : 1
    const { startSec: winStart, endSec: winEnd } = computeWaveformViewport(safe, ct, zm)
    const winLen = Math.max(0.001, winEnd - winStart)

    ctx.fillStyle = 'rgba(10,13,18,0.96)'
    ctx.fillRect(0, 0, cssW, cssH)

    if (mono) {
      ctx.save()
      ctx.strokeStyle = 'rgba(51, 209, 235, 0.08)'
      ctx.lineWidth = 1
      for (let i = 1; i < 24; i++) {
        const x = Math.round((i / 24) * cssW) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, cssH)
        ctx.stroke()
      }
      ctx.strokeStyle = 'rgba(51, 209, 235, 0.13)'
      for (let i = 1; i < 6; i++) {
        const x = Math.round((i / 6) * cssW) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, cssH)
        ctx.stroke()
      }
      const mid = Math.round(cssH / 2) + 0.5
      ctx.strokeStyle = 'rgba(51, 209, 235, 0.09)'
      ctx.beginPath()
      ctx.moveTo(0, mid)
      ctx.lineTo(cssW, mid)
      ctx.stroke()
      ctx.restore()
    }

    const availH  = cssH - PAD * 2
    const centerY = PAD + availH / 2
    const halfH   = availH / 2
    const timeToX = (t: number) => ((t - winStart) / winLen) * cssW
    const progressX = timeToX(ct)

    if (ana && mono) {
      const { binCount, positivePeaks, negativePeaks, rms } = ana
      const startFrac = winStart / safe
      const endFrac   = winEnd / safe
      const bi0 = Math.max(0, Math.floor(startFrac * binCount))
      const bi1 = Math.min(binCount - 1, Math.ceil(endFrac * binCount))
      const visibleBins = Math.max(1, bi1 - bi0 + 1)
      const pitch = 4
      const barWidth = 2
      const barCount = Math.max(1, Math.floor(cssW / pitch))

      ctx.save()
      ctx.shadowColor = 'rgba(58, 219, 247, 0.45)'
      ctx.shadowBlur = 4
      for (let i = 0; i < barCount; i++) {
        const frac0 = i / barCount
        const frac1 = (i + 1) / barCount
        const b0 = Math.min(binCount - 1, bi0 + Math.floor(frac0 * visibleBins))
        const b1 = Math.min(binCount - 1, bi0 + Math.max(0, Math.floor(frac1 * visibleBins)))
        let amp = 0
        for (let b = b0; b <= Math.max(b0, b1); b++) {
          amp = Math.max(amp, rms[b], positivePeaks[b] * 0.78, negativePeaks[b] * 0.78)
        }
        const barH = Math.max(2, Math.min(availH, amp * availH * 0.96))
        const x = i * pitch + Math.max(0, (pitch - barWidth) / 2)
        const y = centerY - barH / 2
        const barTime = winStart + ((i + 0.5) / barCount) * winLen
        ctx.fillStyle = barTime <= ct
          ? 'rgba(72, 230, 255, 0.98)'
          : 'rgba(48, 198, 225, 0.74)'
        ctx.fillRect(x, y, barWidth, barH)
      }
      ctx.restore()
    } else if (ana) {
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
        ctx.fillStyle = mono
          ? (peakT < ct ? 'rgba(72,230,255,0.96)' : 'rgba(48,198,225,0.66)')
          : (peakT < ct ? 'rgba(74,199,219,0.75)' : 'rgba(255,255,255,0.16)')
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
      const bars  = mono ? Math.max(80, Math.floor(cssW / 4)) : 80
      const barW  = cssW / bars
      for (let i = 0; i < bars; i++) {
        const h = (Math.sin(i * 0.38) * 0.26 + 0.13) * availH
        const y = PAD + (availH - h) / 2
        ctx.fillStyle = mono ? 'rgba(48,198,225,0.18)' : 'rgba(255,255,255,0.05)'
        ctx.fillRect(i * barW + 0.5, y, Math.max(1, barW - (mono ? 2 : 1)), h)
      }
    }

    // Rekordbox-inspired cue markers: a compact top flag with a precise line.
    for (const m of mks) {
      if (m.time < winStart || m.time > winEnd) continue
      const mx = timeToX(m.time)
      const markerColor = m.color ?? '#e2364f'
      ctx.save()
      ctx.fillStyle = markerColor
      ctx.shadowColor = markerColor
      ctx.shadowBlur = 5
      if (cueMarkerLinesVisible) ctx.fillRect(mx - 1, 0, 2, cssH)
      ctx.beginPath()
      ctx.moveTo(mx - 6, 0)
      ctx.lineTo(mx + 6, 0)
      ctx.lineTo(mx, 8)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
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

  useEffect(() => { draw() }, [draw, analysis, currentTime, duration, zoom, markers, fallbackPeaks, monochrome, showCueMarkerLines])

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
    const viewport = computeWaveformViewport(dur, ct, zm)
    onSeek(clientXToTimelineTime(e.clientX, rect, viewport, dur))
  }, [onSeek])

  return (
    <canvas
      ref={canvasRef}
      className="vz-mini-waveform"
      onPointerDown={e => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        seekAtPointer(e)
      }}
      onPointerMove={e => { if ((e.buttons & 1) === 1) seekAtPointer(e) }}
      title={duration > 0 ? 'Click or drag to seek · Right-click to add or manage cue points' : undefined}
      style={{ cursor: onSeek && duration > 0 ? 'pointer' : 'default' }}
    />
  )
}
