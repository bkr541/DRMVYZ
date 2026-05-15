import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcRMS, linToDb } from '../utils/dsp'

// Mid/Side meter: Mid = (L+R)/√2, Side = (L-R)/√2
// High Side vs Mid ratio = wide stereo image
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

export function MidSideModule({ analyserL, analyserR, isActive, primaryColor, secondaryColor, showGlow, accentIntensity, showPeakHold, peakDecay }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const bufLRef    = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef    = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rmsMRef    = useRef(0), rmsSRef    = useRef(0)
  const peakMRef   = useRef(0), peakSRef   = useRef(0)
  const phaseRef   = useRef(0)

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

    let rmsM: number, rmsS: number

    if (analyserL && analyserR && isActive) {
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)

      // Derive M/S from L/R
      const mid  = new Float32Array(len) as Float32Array<ArrayBuffer>
      const side = new Float32Array(len) as Float32Array<ArrayBuffer>
      for (let i = 0; i < len; i++) {
        mid[i]  = (bufLRef.current[i] + bufRRef.current[i]) * 0.7071
        side[i] = (bufLRef.current[i] - bufRRef.current[i]) * 0.7071
      }
      rmsM = calcRMS(mid)
      rmsS = calcRMS(side)
    } else {
      const t = phaseRef.current
      rmsM = Math.max(0, Math.sin(t * 1.2) * 0.15 + 0.1)
      rmsS = Math.max(0, Math.sin(t * 0.8 + 1) * 0.08 + 0.04)
    }

    rmsMRef.current += (rmsM - rmsMRef.current) * 0.25
    rmsSRef.current += (rmsS - rmsSRef.current) * 0.25
    if (showPeakHold) {
      peakMRef.current = Math.max(peakMRef.current * peakDecay, rmsMRef.current)
      peakSRef.current = Math.max(peakSRef.current * peakDecay, rmsSRef.current)
    }

    const drawBar = (x: number, w: number, rms: number, peak: number, label: string, color: string) => {
      const SEG = 28, segH = (H - 28) / SEG, gap = 1
      for (let s = 0; s < SEG; s++) {
        const frac = (SEG - 1 - s) / (SEG - 1)
        const lit  = frac <= rms * 3
        const isPk = showPeakHold && Math.abs(frac - peak * 3) < 1.5 / SEG
        const sy   = 4 + s * (segH + gap)
        let segColor = frac > 0.9 ? '#ff3333' : frac > 0.72 ? '#ffaa00' : color
        ctx.globalAlpha = (lit || isPk) ? 1 : 0.1
        if ((lit || isPk) && showGlow) { ctx.shadowColor = segColor; ctx.shadowBlur = accentIntensity * 5 }
        else ctx.shadowBlur = 0
        ctx.fillStyle = segColor
        ctx.fillRect(x, sy, w, segH)
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      const db = Math.round(linToDb(rms))
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '8px monospace'; ctx.textAlign = 'center'
      ctx.fillText(label, x + w / 2, H - 8)
      ctx.fillText(db > -60 ? `${db}` : '-∞', x + w / 2, H - 1)
      ctx.textAlign = 'left'
    }

    const mw = Math.floor(W / 2) - 4
    drawBar(2,      mw, rmsMRef.current, peakMRef.current, 'M', primaryColor)
    drawBar(mw + 6, mw, rmsSRef.current, peakSRef.current, 'S', secondaryColor)

    // Width indicator
    const width = rmsMRef.current > 0.001 ? Math.min(1, rmsSRef.current / rmsMRef.current) : 0
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    ctx.font = '7px monospace'
    ctx.fillText(`W:${Math.round(width * 100)}%`, 2, H - 16)
  })

  return (
    <canvas ref={canvasRef} width={80} height={220}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
