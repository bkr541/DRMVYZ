import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcApproxLUFS } from '../utils/dsp'
import { linToDb } from '../utils/dsp'

// Displays approximate LUFS-style loudness: Momentary (400ms), Short-term (3s), Integrated.
// Uses a simplified K-weighted RMS approximation — NOT ITU-R BS.1770 compliant.
// Labeled clearly as approximate in the UI.

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  sampleRate: number
}

export function LoudnessModule({ analyser, isActive, primaryColor, secondaryColor, showGlow, accentIntensity, sampleRate }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const freqRef        = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const momentaryRef   = useRef(0)   // smoothed fast
  const shortTermRef   = useRef(0)   // smoothed slow
  const integratedRef  = useRef(0)   // long-term average
  const intCountRef    = useRef(0)
  const phaseRef       = useRef(0)

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

    let rawLUFS: number

    if (analyser && isActive) {
      if (!freqRef.current || freqRef.current.length !== analyser.frequencyBinCount)
        freqRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      analyser.getByteFrequencyData(freqRef.current)
      rawLUFS = calcApproxLUFS(freqRef.current, sampleRate)
    } else {
      // Idle: gentle fluctuation
      rawLUFS = -24 + Math.sin(phaseRef.current * 0.7) * 6 + Math.sin(phaseRef.current * 1.9) * 3
    }

    // Momentary (fast ~400ms)
    momentaryRef.current += (rawLUFS - momentaryRef.current) * 0.12

    // Short-term (slow ~3s)
    shortTermRef.current += (rawLUFS - shortTermRef.current) * 0.02

    // Integrated (running average since start)
    intCountRef.current++
    integratedRef.current += (rawLUFS - integratedRef.current) / intCountRef.current

    const M = momentaryRef.current
    const S = shortTermRef.current
    const I = integratedRef.current

    // dB range: -60 to 0
    const toY = (db: number) => H - ((db + 60) / 60) * H

    const drawBar = (x: number, w: number, db: number, label: string, color: string) => {
      const y    = toY(db)
      const barH = H - y

      const grad = ctx.createLinearGradient(x, H, x, 0)
      grad.addColorStop(0, color + '44')
      grad.addColorStop(0.6, color + 'aa')
      grad.addColorStop(1, color)

      if (showGlow) { ctx.shadowColor = color; ctx.shadowBlur = accentIntensity * 8 * Math.max(0, (db + 12) / 12) }
      ctx.fillStyle = grad
      ctx.fillRect(x, y, w, barH)
      ctx.shadowBlur = 0

      // Clip zone (above -6 LUFS)
      if (db > -6) {
        ctx.fillStyle = '#ff3333'
        ctx.fillRect(x, Math.max(0, toY(-6)), w, Math.min(barH, H - Math.max(0, toY(-6))))
      }

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + w / 2, H - 2)
      ctx.fillText(`${Math.round(db)}`, x + w / 2, Math.max(14, y - 2))
      ctx.textAlign = 'left'
    }

    const bw = Math.floor(W / 3) - 4
    drawBar(2,          bw, M, 'M', primaryColor)
    drawBar(bw + 6,     bw, S, 'S', secondaryColor)
    drawBar(bw * 2 + 10, bw, I, 'I', primaryColor + 'cc')

    // dB scale
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.font = '8px monospace'
    for (let db = 0; db >= -60; db -= 6) {
      const y = toY(db)
      ctx.fillText(db === 0 ? '0' : String(db), W - 20, y + 4)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 22, y); ctx.stroke()
    }

    // Header note
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '7px monospace'
    ctx.fillText('APPROX LUFS', 2, 10)
    void linToDb
  })

  return (
    <canvas ref={canvasRef} width={200} height={180}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
