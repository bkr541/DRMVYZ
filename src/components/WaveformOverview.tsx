import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  analyser: AnalyserNode | null
  primaryColor: string
  showGlow: boolean
  accentIntensity: number
  active: boolean
  currentTime: number
  duration: number
}

export function WaveformOverview({ analyser, primaryColor, showGlow, accentIntensity, active, currentTime, duration }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeRef = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    timeRef.current += 0.025

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, W, H)

    let waveData: Uint8Array

    if (analyser && active) {
      // Real time-domain waveform
      if (!dataRef.current || dataRef.current.length !== analyser.fftSize) {
        dataRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
      }
      analyser.getByteTimeDomainData(dataRef.current)
      waveData = dataRef.current
    } else {
      // Idle sine wave
      const len = 512
      if (!dataRef.current || dataRef.current.length !== len) {
        dataRef.current = new Uint8Array(len) as Uint8Array<ArrayBuffer>
      }
      for (let i = 0; i < len; i++) {
        const t = timeRef.current
        const x = i / len
        const v = Math.sin(x * Math.PI * 8 + t * 2) * 0.15 +
          Math.sin(x * Math.PI * 3 + t) * 0.1 +
          0.5
        dataRef.current[i] = Math.round(v * 255)
      }
      waveData = dataRef.current
    }

    const sliceW = W / waveData.length
    const midY = H / 2

    if (showGlow) {
      ctx.shadowColor = primaryColor
      ctx.shadowBlur = accentIntensity * 4
    }

    ctx.beginPath()
    ctx.strokeStyle = primaryColor
    ctx.lineWidth = 1.5

    for (let i = 0; i < waveData.length; i++) {
      const v = (waveData[i] / 128) - 1
      const y = midY + v * (H * 0.42)
      const x = i * sliceW
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    // Playhead
    if (duration > 0) {
      const px = (currentTime / duration) * W
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, H)
      ctx.stroke()

      // Played region tint
      ctx.fillStyle = primaryColor + '18'
      ctx.fillRect(0, 0, px, H)
    }

    // Center axis
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(W, midY)
    ctx.stroke()
  })

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={56}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
