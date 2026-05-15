import { useRef, useEffect } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  analyser: AnalyserNode | null
  accentIntensity: number
  showGlow: boolean
  primaryColor: string
  secondaryColor: string
  active: boolean
}

export function SpectrumAnalyzer({ analyser, accentIntensity, showGlow, primaryColor, secondaryColor, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const peaksRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const timeRef = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    timeRef.current += 0.02

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, W, H)

    let freqData: Uint8Array

    if (analyser && active) {
      // Real FFT data from AnalyserNode
      if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
        dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
        peaksRef.current = new Float32Array(analyser.frequencyBinCount).fill(0) as Float32Array<ArrayBuffer>
      }
      analyser.getByteFrequencyData(dataRef.current)
      freqData = dataRef.current
    } else {
      // Idle fake animation
      const bins = 128
      if (!dataRef.current || dataRef.current.length !== bins) {
        dataRef.current = new Uint8Array(bins) as Uint8Array<ArrayBuffer>
        peaksRef.current = new Float32Array(bins).fill(0) as Float32Array<ArrayBuffer>
      }
      for (let i = 0; i < bins; i++) {
        // gentle idle ripple
        const v = Math.sin(timeRef.current * 1.2 + i * 0.18) * 0.3 +
          Math.sin(timeRef.current * 0.7 + i * 0.09) * 0.2 +
          0.08
        dataRef.current[i] = Math.max(0, Math.min(255, v * 80))
      }
      freqData = dataRef.current
    }

    if (!peaksRef.current || peaksRef.current.length !== freqData.length) {
      peaksRef.current = new Float32Array(freqData.length).fill(0) as Float32Array<ArrayBuffer>
    }
    const peaks = peaksRef.current

    const barCount = Math.min(freqData.length, 96)
    const gap = 2
    const barW = (W - gap * (barCount - 1)) / barCount
    const glowAmount = showGlow ? accentIntensity * 12 : 0

    for (let i = 0; i < barCount; i++) {
      const val = freqData[i] / 255
      const barH = val * H * 0.92

      // Decay peaks
      peaks[i] = Math.max(peaks[i] * 0.97, val * H * 0.92)

      const x = i * (barW + gap)
      const y = H - barH

      // Color gradient: secondary at bottom, primary at top
      const grad = ctx.createLinearGradient(x, H, x, 0)
      grad.addColorStop(0, secondaryColor + 'cc')
      grad.addColorStop(0.6, primaryColor + 'dd')
      grad.addColorStop(1, primaryColor)

      if (showGlow && glowAmount > 0) {
        ctx.shadowColor = primaryColor
        ctx.shadowBlur = glowAmount * val
      } else {
        ctx.shadowBlur = 0
      }

      ctx.fillStyle = grad
      ctx.fillRect(x, y, barW, barH)

      // Peak dot
      ctx.shadowBlur = 0
      ctx.fillStyle = primaryColor
      ctx.fillRect(x, H - peaks[i] - 2, barW, 2)
    }

    ctx.shadowBlur = 0

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    for (let g = 0.25; g < 1; g += 0.25) {
      const gy = H * (1 - g)
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(W, gy)
      ctx.stroke()
    }
  })

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={160}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
