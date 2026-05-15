import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcRMS, linToDb } from '../utils/dsp'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  showPeakHold: boolean
  peakDecay: number
}

export function LRMeterModule({ analyserL, analyserR, isActive, primaryColor, secondaryColor, showGlow, accentIntensity, showPeakHold, peakDecay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufLRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rmsLRef   = useRef(0), rmsRRef   = useRef(0)
  const peakLRef  = useRef(0), peakRRef  = useRef(0)
  const phaseRef  = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    phaseRef.current += 0.04

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, W, H)

    let rmsL: number, rmsR: number

    if (analyserL && analyserR && isActive) {
      // Real L/R RMS from time-domain data
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)
      rmsL = calcRMS(bufLRef.current)
      rmsR = calcRMS(bufRRef.current)
    } else {
      const t = phaseRef.current
      rmsL = Math.max(0, Math.sin(t * 1.3) * 0.15 + Math.sin(t * 2.1) * 0.08 + 0.06)
      rmsR = Math.max(0, Math.sin(t * 1.1 + 0.5) * 0.15 + Math.sin(t * 1.8) * 0.08 + 0.06)
    }

    // Smooth toward target
    rmsLRef.current += (rmsL - rmsLRef.current) * 0.25
    rmsRRef.current += (rmsR - rmsRRef.current) * 0.25
    if (showPeakHold) {
      peakLRef.current = Math.max(peakLRef.current * peakDecay, rmsLRef.current)
      peakRRef.current = Math.max(peakRRef.current * peakDecay, rmsRRef.current)
    }

    const drawChannel = (x: number, w: number, rms: number, peak: number, label: string, color: string) => {
      const SEG = 30, segH = (H - 24) / SEG, gap = 1

      for (let s = 0; s < SEG; s++) {
        const frac = (SEG - 1 - s) / (SEG - 1)
        const lit  = frac <= rms * 2.8
        const isPk = showPeakHold && Math.abs(frac - peak * 2.8) < 1.5 / SEG

        const sy = 4 + s * (segH + gap)
        const sh = segH

        let segColor: string
        if (frac > 0.88) segColor = '#ff3333'
        else if (frac > 0.7) segColor = '#ffaa00'
        else segColor = color

        ctx.globalAlpha = (lit || isPk) ? 1 : 0.1
        if ((lit || isPk) && showGlow) { ctx.shadowColor = segColor; ctx.shadowBlur = accentIntensity * 5 }
        else ctx.shadowBlur = 0

        ctx.fillStyle = segColor
        ctx.fillRect(x, sy, w, sh)
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur  = 0

      // dB readout
      const db = Math.round(linToDb(rms))
      ctx.fillStyle = rms > 0.9 ? '#ff3333' : 'rgba(255,255,255,0.5)'
      ctx.font = '8px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + w / 2, H - 8)
      ctx.fillText(db > -60 ? `${db}` : '-∞', x + w / 2, H - 1)
      ctx.textAlign = 'left'
    }

    const mw = Math.floor(W / 2) - 4
    drawChannel(2,      mw, rmsLRef.current, peakLRef.current, 'L', primaryColor)
    drawChannel(mw + 6, mw, rmsRRef.current, peakRRef.current, 'R', secondaryColor)
  })

  return (
    <canvas ref={canvasRef} width={80} height={220}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
