import React, { useRef, useEffect } from 'react'
import type { TonalBalance } from '../../types/meters'
import { TONAL_BAND_LABELS, TONAL_TARGETS } from '../../analysis/tonalBalance'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'

const BAND_KEYS: (keyof TonalBalance)[] = ['sub', 'bass', 'lowMid', 'mid', 'highMid', 'presence', 'air']

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  sampleRate: number
  primaryColor: string
  secondaryColor: string
}

export function TonalBalanceDisplay({ analyser, isActive, sampleRate, primaryColor, secondaryColor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const levelsRef = useRef<number[]>(BAND_KEYS.map(() => 0))
  const smoothedRef = useRef<number[]>(BAND_KEYS.map(() => 0))

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const W = canvas.width = canvas.offsetWidth * devicePixelRatio
    const H = canvas.height = canvas.offsetHeight * devicePixelRatio

    ctx.clearRect(0, 0, W, H)

    if (analyser && isActive) {
      const freqData = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      analyser.getByteFrequencyData(freqData)
      const nyq = sampleRate / 2
      const bins = freqData.length

      const ranges: [number, number][] = [
        [20, 60], [60, 250], [250, 500], [500, 2000], [2000, 6000], [6000, 12000], [12000, 20000]
      ]

      ranges.forEach(([lo, hi], i) => {
        let sum = 0, count = 0
        for (let b = 0; b < bins; b++) {
          const freq = (b / bins) * nyq
          if (freq >= lo && freq <= hi) { sum += freqData[b] / 255; count++ }
        }
        levelsRef.current[i] = count > 0 ? sum / count : 0
      })
    } else {
      levelsRef.current = levelsRef.current.map((v, i) => {
        const t = Date.now() / 1000
        return 0.1 + 0.05 * Math.sin(t * 0.7 + i)
      })
    }

    // Smooth
    smoothedRef.current = smoothedRef.current.map((s, i) =>
      s + (levelsRef.current[i] - s) * 0.15
    )

    const n = BAND_KEYS.length
    const barW = W / (n * 1.4)
    const gap = (W - barW * n) / (n + 1)

    BAND_KEYS.forEach((key, i) => {
      const x = gap + i * (barW + gap)
      const v = smoothedRef.current[i]
      const [lo, hi] = TONAL_TARGETS[key]

      // Target zone background
      const targetY1 = H * (1 - hi)
      const targetY2 = H * (1 - lo)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(x, targetY1, barW, targetY2 - targetY1)

      // Bar color: green if in target, amber if slightly off, red if way off
      const inTarget = v >= lo && v <= hi
      const slightlyOff = v >= lo * 0.7 && v <= hi * 1.4
      const barColor = inTarget ? primaryColor : slightlyOff ? '#ffcc44' : '#ff4466'

      const barH = v * H
      const barY = H - barH
      const grad = ctx.createLinearGradient(0, barY, 0, H)
      grad.addColorStop(0, barColor + 'cc')
      grad.addColorStop(1, barColor + '33')
      ctx.fillStyle = grad
      ctx.fillRect(x, barY, barW, barH)

      // Target range tick marks
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, H * (1 - lo)); ctx.lineTo(x + barW, H * (1 - lo))
      ctx.moveTo(x, H * (1 - hi)); ctx.lineTo(x + barW, H * (1 - hi))
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${Math.max(9, 10 * (W / 400))}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(TONAL_BAND_LABELS[i], x + barW / 2, H - 4)

      // dB value above bar
      const db = v > 0.001 ? (20 * Math.log10(v)).toFixed(0) : '—'
      ctx.fillStyle = barColor
      ctx.fillText(db, x + barW / 2, Math.max(barY - 3, 14))
    })

    // Legend
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('TARGET ZONES', 4, 12)

  }, isActive || !analyser)

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
