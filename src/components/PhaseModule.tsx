import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcPhaseCorrelation } from '../utils/dsp'

// Phase Correlation Meter (Goniometer-style correlation number)
// +1 = mono-compatible, 0 = uncorrelated, -1 = polarity-inverted (poor mono compatibility)

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
}

export function PhaseModule({ analyserL, analyserR, isActive, primaryColor, secondaryColor, showGlow, accentIntensity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufLRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const corrRef   = useRef(0)
  const phaseRef  = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    phaseRef.current += 0.05

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, W, H)

    let corr: number

    if (analyserL && analyserR && isActive) {
      // Compute Pearson correlation between L and R time-domain signals
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)
      corr = calcPhaseCorrelation(bufLRef.current, bufRRef.current)
    } else {
      corr = 0.85 + Math.sin(phaseRef.current * 0.3) * 0.12
    }

    // Smooth the correlation reading
    corrRef.current += (corr - corrRef.current) * 0.08
    const c = corrRef.current

    // Draw horizontal bar from -1 to +1
    const barY   = H * 0.38
    const barH   = H * 0.22
    const barX   = 20
    const barW   = W - 40
    const center = barX + barW / 2
    const meterX = barX + ((c + 1) / 2) * barW

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(barX, barY, barW, barH)

    // Colored fill from center to needle
    const color = c > 0.2 ? primaryColor : c > -0.2 ? '#ffaa00' : '#ff3333'
    const fillX = Math.min(center, meterX)
    const fillW = Math.abs(meterX - center)
    if (showGlow) { ctx.shadowColor = color; ctx.shadowBlur = accentIntensity * 8 }
    ctx.fillStyle = color + '88'
    ctx.fillRect(fillX, barY, fillW, barH)
    ctx.shadowBlur = 0

    // Needle
    if (showGlow) { ctx.shadowColor = color; ctx.shadowBlur = accentIntensity * 12 }
    ctx.fillStyle = color
    ctx.fillRect(meterX - 2, barY - 3, 4, barH + 6)
    ctx.shadowBlur = 0

    // Scale labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('-1', barX, barY - 4)
    ctx.fillText('0',  center, barY - 4)
    ctx.fillText('+1', barX + barW, barY - 4)

    // Readout
    ctx.font = '13px monospace'
    ctx.fillStyle = color
    ctx.fillText(c.toFixed(2), W / 2, barY + barH + 18)

    // Status text
    const status = c > 0.5 ? 'IN PHASE' : c > 0 ? 'PARTIAL' : c > -0.2 ? 'MONO OK' : 'OUT OF PHASE'
    ctx.font = '8px monospace'
    ctx.fillStyle = color
    ctx.fillText(status, W / 2, H - 4)

    ctx.textAlign = 'left'
    void secondaryColor
  })

  return (
    <canvas ref={canvasRef} width={200} height={80}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
