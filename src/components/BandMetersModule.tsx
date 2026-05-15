import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcBandEnergy, linToDb } from '../utils/dsp'

// Three-band energy meters: Bass (<250 Hz), Mid (250–4000 Hz), High (>4 kHz)
interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  showPeakHold: boolean
  peakDecay: number
  sampleRate: number
}

export function BandMetersModule({ analyser, isActive, primaryColor, secondaryColor, showGlow, accentIntensity, showPeakHold, peakDecay, sampleRate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const freqRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const bassRef   = useRef(0), midRef    = useRef(0), highRef   = useRef(0)
  const peakBRef  = useRef(0), peakMRef  = useRef(0), peakHRef  = useRef(0)
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

    let bass: number, mid: number, high: number

    if (analyser && isActive) {
      if (!freqRef.current || freqRef.current.length !== analyser.frequencyBinCount)
        freqRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      analyser.getByteFrequencyData(freqRef.current)
      ;[bass, mid, high] = calcBandEnergy(freqRef.current, sampleRate)
    } else {
      const t = phaseRef.current
      bass = Math.max(0, Math.sin(t * 1.5) * 0.2 + 0.12)
      mid  = Math.max(0, Math.sin(t * 1.1 + 1) * 0.15 + 0.08)
      high = Math.max(0, Math.sin(t * 0.8 + 2) * 0.1 + 0.05)
    }

    bassRef.current += (bass - bassRef.current) * 0.25
    midRef.current  += (mid  - midRef.current)  * 0.2
    highRef.current += (high - highRef.current) * 0.18

    if (showPeakHold) {
      peakBRef.current = Math.max(peakBRef.current * peakDecay, bassRef.current)
      peakMRef.current = Math.max(peakMRef.current * peakDecay, midRef.current)
      peakHRef.current = Math.max(peakHRef.current * peakDecay, highRef.current)
    }

    const bands = [
      { val: bassRef.current, peak: peakBRef.current, label: 'BASS', color: secondaryColor },
      { val: midRef.current,  peak: peakMRef.current, label: 'MID',  color: primaryColor },
      { val: highRef.current, peak: peakHRef.current, label: 'HIGH', color: primaryColor + 'cc' },
    ]
    const bw = Math.floor((W - 16) / 3)

    bands.forEach(({ val, peak, label, color }, i) => {
      const x = 4 + i * (bw + 4)
      const barH = val * (H - 28)
      const y = H - 18 - barH

      if (showGlow && barH > 4) { ctx.shadowColor = color; ctx.shadowBlur = accentIntensity * 10 * val }
      else ctx.shadowBlur = 0

      const grad = ctx.createLinearGradient(x, H, x, 0)
      grad.addColorStop(0, color + '66')
      grad.addColorStop(1, color)
      ctx.fillStyle = grad
      ctx.fillRect(x, y, bw, barH)
      ctx.shadowBlur = 0

      if (showPeakHold && peak > 0.01) {
        const py = H - 18 - peak * (H - 28)
        ctx.fillStyle = color
        ctx.fillRect(x, py - 2, bw, 2)
      }

      const db = linToDb(val)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = '8px monospace'; ctx.textAlign = 'center'
      ctx.fillText(label, x + bw / 2, H - 6)
      ctx.fillText(db > -60 ? `${Math.round(db)}` : '-∞', x + bw / 2, H - 14)
    })

    ctx.textAlign = 'left'
  })

  return (
    <canvas ref={canvasRef} width={200} height={120}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
