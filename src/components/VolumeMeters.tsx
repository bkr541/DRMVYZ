import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcRMS } from '../utils/audioUtils'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  active: boolean
}

export function VolumeMeters({ analyserL, analyserR, primaryColor, secondaryColor, showGlow, accentIntensity, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufLRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rmsLRef = useRef(0)
  const rmsRRef = useRef(0)
  const peakLRef = useRef(0)
  const peakRRef = useRef(0)
  const timeRef = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    timeRef.current += 0.04

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, W, H)

    let rmsL: number, rmsR: number

    if (analyserL && analyserR && active) {
      // Real L/R level data
      if (!bufLRef.current || bufLRef.current.length !== analyserL.fftSize) {
        bufLRef.current = new Float32Array(analyserL.fftSize) as Float32Array<ArrayBuffer>
        bufRRef.current = new Float32Array(analyserR.fftSize) as Float32Array<ArrayBuffer>
      }
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current!)
      rmsL = calcRMS(bufLRef.current)
      rmsR = calcRMS(bufRRef.current!)
    } else {
      // Idle animation
      rmsL = (Math.sin(timeRef.current * 1.3) * 0.3 + Math.sin(timeRef.current * 2.1) * 0.15 + 0.08) * 0.4
      rmsR = (Math.sin(timeRef.current * 1.1 + 0.5) * 0.3 + Math.sin(timeRef.current * 1.8) * 0.15 + 0.08) * 0.4
      rmsL = Math.max(0, rmsL)
      rmsR = Math.max(0, rmsR)
    }

    // Smooth meter response
    rmsLRef.current += (rmsL - rmsLRef.current) * 0.3
    rmsRRef.current += (rmsR - rmsRRef.current) * 0.3

    // Peak hold with slow decay
    peakLRef.current = Math.max(peakLRef.current * 0.985, rmsLRef.current)
    peakRRef.current = Math.max(peakRRef.current * 0.985, rmsRRef.current)

    const drawMeter = (x: number, w: number, rms: number, peak: number, label: string) => {
      const segCount = 24
      const segH = (H - 30) / segCount
      const segGap = 2

      for (let s = 0; s < segCount; s++) {
        const frac = (segCount - 1 - s) / (segCount - 1)
        const lit = frac <= rms * 3.2
        const isPeak = Math.abs(frac - peak * 3.2) < 1.5 / segCount

        const sy = 8 + s * segH
        const sh = segH - segGap

        let color: string
        if (frac > 0.85) color = '#ff4444'
        else if (frac > 0.65) color = '#ffaa00'
        else color = primaryColor

        ctx.globalAlpha = lit || isPeak ? 1 : 0.12

        if ((lit || isPeak) && showGlow) {
          ctx.shadowColor = color
          ctx.shadowBlur = accentIntensity * 6
        } else {
          ctx.shadowBlur = 0
        }

        ctx.fillStyle = color
        ctx.fillRect(x, sy, w, sh)
      }

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + w / 2, H - 4)
    }

    const mw = Math.floor(W / 2) - 4
    drawMeter(2, mw, rmsLRef.current, peakLRef.current, 'L')
    drawMeter(mw + 6, mw, rmsRRef.current, peakRRef.current, 'R')
  })

  return (
    <canvas
      ref={canvasRef}
      width={60}
      height={220}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
