import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { OscMode } from '../types'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  mode: OscMode
  primaryColor: string
  showGlow: boolean
  accentIntensity: number
}

export function OscilloscopeModule({ analyserL, analyserR, isActive, mode, primaryColor, showGlow, accentIntensity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufLRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const phaseRef  = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    const midY = H / 2
    phaseRef.current += 0.04

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, W, H)

    let signal: number[]

    if (analyserL && analyserR && isActive) {
      // Derive the requested channel
      const lenL = analyserL.fftSize, lenR = analyserR.fftSize
      if (!bufLRef.current || bufLRef.current.length !== lenL)
        bufLRef.current = new Float32Array(lenL) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== lenR)
        bufRRef.current = new Float32Array(lenR) as Float32Array<ArrayBuffer>

      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)
      const len = Math.min(lenL, lenR)

      signal = []
      for (let i = 0; i < len; i++) {
        const l = bufLRef.current[i], r = bufRRef.current[i]
        if (mode === 'L')    signal.push(l)
        else if (mode === 'R')    signal.push(r)
        else if (mode === 'Mid')  signal.push((l + r) / 2)
        else                      signal.push((l - r) / 2) // Side
      }
    } else {
      // Idle: synthesize appropriate waveform shape per mode
      const t = phaseRef.current
      const len = 512
      signal = Array.from({ length: len }, (_, i) => {
        const x = i / len
        if (mode === 'L' || mode === 'Mid') return Math.sin(x * Math.PI * 6 + t * 2.5) * 0.5
        if (mode === 'R') return Math.sin(x * Math.PI * 8 + t * 2.8 + 0.5) * 0.45
        return Math.sin(x * Math.PI * 3 + t) * 0.2 // Side — quieter
      })
    }

    // Trigger: find a zero-crossing to stabilize the display
    let triggerIdx = 0
    for (let i = 1; i < signal.length - 1; i++) {
      if (signal[i - 1] <= 0 && signal[i] > 0) { triggerIdx = i; break }
    }
    const displayLen = Math.min(signal.length - triggerIdx, W)

    if (showGlow) { ctx.shadowColor = primaryColor; ctx.shadowBlur = accentIntensity * 6 }

    ctx.beginPath()
    ctx.strokeStyle = primaryColor
    ctx.lineWidth = 1.5
    for (let x = 0; x < displayLen; x++) {
      const v = signal[triggerIdx + x] ?? 0
      const y = midY - v * midY * 0.88
      if (x === 0) ctx.moveTo(0, y); else ctx.lineTo(x / displayLen * W, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    // Center axis
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()

    // Mode label
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '9px monospace'
    ctx.fillText(mode, W - 22, 12)
  })

  return (
    <canvas ref={canvasRef} width={400} height={120}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
