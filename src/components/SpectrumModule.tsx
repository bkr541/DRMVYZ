import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { getColorMap, ColorMapName } from '../utils/colorMaps'
import { SpectrumMode } from '../types'

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  mode: SpectrumMode
  colorMap: ColorMapName
  showGlow: boolean
  accentIntensity: number
  showPeakHold: boolean
  peakDecay: number
  showTargetCurve: boolean
  sensitivity: number
  freqScale?: 'Linear' | 'Log'
  refAnalyser?: AnalyserNode | null
}

export function SpectrumModule({
  analyser, isActive, mode, colorMap,
  showGlow, accentIntensity, showPeakHold, peakDecay,
  showTargetCurve, sensitivity, freqScale = 'Log', refAnalyser,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const dataRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const peaksRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const phaseRef   = useRef(0)
  const cmap       = getColorMap(colorMap)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    phaseRef.current += 0.018

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, W, H)

    let freq: Uint8Array<ArrayBuffer>

    if (analyser && isActive) {
      // Read real FFT frequency-domain data
      if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
        dataRef.current  = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        peaksRef.current = new Float32Array(analyser.frequencyBinCount) as Float32Array<ArrayBuffer>
      }
      analyser.getByteFrequencyData(dataRef.current)
      freq = dataRef.current
    } else {
      // Idle demo animation
      const bins = 128
      if (!dataRef.current || dataRef.current.length !== bins) {
        dataRef.current  = new Uint8Array(bins) as Uint8Array<ArrayBuffer>
        peaksRef.current = new Float32Array(bins) as Float32Array<ArrayBuffer>
      }
      for (let i = 0; i < bins; i++) {
        const t = phaseRef.current
        dataRef.current[i] = Math.max(0, Math.round(
          (Math.sin(t * 1.1 + i * 0.16) * 0.35 +
           Math.sin(t * 0.6 + i * 0.08) * 0.2 + 0.12) * 80 * sensitivity
        ))
      }
      freq = dataRef.current
    }

    if (!peaksRef.current || peaksRef.current.length !== freq.length) {
      peaksRef.current = new Float32Array(freq.length) as Float32Array<ArrayBuffer>
    }
    const peaks = peaksRef.current
    const barCount = Math.min(freq.length, 120)
    const glow = showGlow ? accentIntensity * 10 : 0

    // Map bar index 0..barCount-1 → x position 0..W using linear or log scale
    const barX = (i: number) => {
      if (freqScale === 'Log') {
        const minLog = Math.log10(1)
        const maxLog = Math.log10(barCount)
        return ((Math.log10(i + 1) - minLog) / (maxLog - minLog)) * W
      }
      return (i / barCount) * W
    }

    if (mode === 'bars') {
      for (let i = 0; i < barCount; i++) {
        const val = (freq[i] / 255) * sensitivity
        const bh = Math.min(H, val * H)
        peaks[i] = showPeakHold ? Math.max(peaks[i] * peakDecay, bh) : 0
        const x = barX(i)
        const bw = Math.max(1, barX(i + 1) - x - 1)
        const colorIdx = Math.floor((freq[i] / 255) * 255)
        const cr = cmap[colorIdx * 3], cg = cmap[colorIdx * 3 + 1], cb = cmap[colorIdx * 3 + 2]
        if (showGlow && bh > H * 0.1) { ctx.shadowColor = `rgb(${cr},${cg},${cb})`; ctx.shadowBlur = glow * val }
        else ctx.shadowBlur = 0
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`
        ctx.fillRect(x, H - bh, bw, bh)
        if (showPeakHold && peaks[i] > 2) {
          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.9)`
          ctx.fillRect(x, H - peaks[i] - 2, bw, 2)
        }
      }
    } else if (mode === 'line' || mode === 'filled') {
      ctx.beginPath()
      ctx.shadowColor = `rgb(${cmap[200 * 3]},${cmap[200 * 3 + 1]},${cmap[200 * 3 + 2]})`
      ctx.shadowBlur = glow
      ctx.strokeStyle = `rgb(${cmap[200 * 3]},${cmap[200 * 3 + 1]},${cmap[200 * 3 + 2]})`
      ctx.lineWidth = 2
      for (let i = 0; i <= barCount; i++) {
        const val = Math.min(1, (freq[Math.min(i, freq.length - 1)] / 255) * sensitivity)
        const x = barX(i)
        const y = H - val * H
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      if (mode === 'filled') {
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, `rgba(${cmap[200 * 3]},${cmap[200 * 3 + 1]},${cmap[200 * 3 + 2]},0.5)`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fill()
      }
    } else { // curve — smoothed with bezier
      ctx.beginPath()
      ctx.shadowColor = `rgb(${cmap[200 * 3]},${cmap[200 * 3 + 1]},${cmap[200 * 3 + 2]})`
      ctx.shadowBlur = glow
      ctx.strokeStyle = `rgb(${cmap[180 * 3]},${cmap[180 * 3 + 1]},${cmap[180 * 3 + 2]})`
      ctx.lineWidth = 2
      for (let i = 0; i <= barCount; i++) {
        const val = Math.min(1, (freq[Math.min(i, freq.length - 1)] / 255) * sensitivity)
        const x = barX(i)
        const y = H - val * H
        if (i === 0) { ctx.moveTo(x, y); continue }
        const prevVal = Math.min(1, (freq[Math.min(i - 1, freq.length - 1)] / 255) * sensitivity)
        const prevX = barX(i - 1)
        const prevY = H - prevVal * H
        const cpX = (prevX + x) / 2
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y)
      }
      ctx.stroke()
    }

    // Target curve (rough ITU 1770-style equal loudness contour)
    if (showTargetCurve) {
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      for (let i = 0; i <= barCount; i++) {
        const x = barX(i)
        // Rough ISO 226 equal loudness curve (normalized)
        const freq_hz = (i / barCount) * (analyser?.context?.sampleRate ?? 44100) / 2
        let level = 0.5
        if (freq_hz > 20 && freq_hz < 20000) {
          level = 0.5
          if (freq_hz < 200) level = 0.5 - 0.25 * (1 - freq_hz / 200)
          if (freq_hz > 3000 && freq_hz < 6000) level = 0.5 + 0.15 * Math.sin((freq_hz - 3000) / 3000 * Math.PI)
          if (freq_hz > 10000) level = Math.max(0.2, 0.5 - (freq_hz - 10000) / 10000 * 0.3)
        }
        const y = H - level * H
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.shadowBlur = 0

    // dB grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let db = -6; db >= -48; db -= 6) {
      const y = H * (1 - Math.pow(10, db / 20))
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Reference spectrum overlay (A/B comparison)
    if (refAnalyser && isActive) {
      const refBins = refAnalyser.frequencyBinCount
      const refData = new Uint8Array(refBins) as Uint8Array<ArrayBuffer>
      refAnalyser.getByteFrequencyData(refData)
      const refCount = Math.min(refBins, 120)
      ctx.strokeStyle = 'rgba(255,204,68,0.55)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      for (let i = 0; i < refCount; i++) {
        const x = barX(i)
        const v = (refData[i] / 255) * sensitivity
        const y = H - v * H
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      // Label
      ctx.fillStyle = 'rgba(255,204,68,0.7)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'right'
      ctx.fillText('REF', W - 4, 14)
    }
  })

  return (
    <canvas ref={canvasRef} width={600} height={180}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
