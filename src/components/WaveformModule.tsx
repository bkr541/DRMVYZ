import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { WaveformMode, ColorMapName } from '../types'
import { getColorMap } from '../utils/colorMaps'

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  mode: WaveformMode
  colorMap: ColorMapName
  showGlow: boolean
  accentIntensity: number
  currentTime: number
  duration: number
}

export function WaveformModule({ analyser, isActive, mode, colorMap, showGlow, accentIntensity, currentTime, duration }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef   = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const scrollRef = useRef(0) // for scroll mode
  const phaseRef  = useRef(0)
  const cmap = getColorMap(colorMap)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    phaseRef.current += 0.022

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, W, H)

    let wave: Uint8Array<ArrayBuffer>

    if (analyser && isActive) {
      // Real time-domain waveform data
      if (!dataRef.current || dataRef.current.length !== analyser.fftSize) {
        dataRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>
      }
      analyser.getByteTimeDomainData(dataRef.current)
      wave = dataRef.current
    } else {
      const len = 1024
      if (!dataRef.current || dataRef.current.length !== len) {
        dataRef.current = new Uint8Array(len) as Uint8Array<ArrayBuffer>
      }
      for (let i = 0; i < len; i++) {
        const t = phaseRef.current
        dataRef.current[i] = Math.round(
          ((Math.sin(i / len * Math.PI * 6 + t * 2.5) * 0.3 +
            Math.sin(i / len * Math.PI * 2 + t) * 0.2) * 0.5 + 0.5) * 255
        )
      }
      wave = dataRef.current
    }

    const midY = H / 2
    const primaryC = `rgb(${cmap[200 * 3]},${cmap[200 * 3 + 1]},${cmap[200 * 3 + 2]})`
    const secondaryC = `rgb(${cmap[100 * 3]},${cmap[100 * 3 + 1]},${cmap[100 * 3 + 2]})`

    if (mode === 'centered') {
      // Centered mirror waveform
      if (showGlow) { ctx.shadowColor = primaryC; ctx.shadowBlur = accentIntensity * 5 }
      ctx.beginPath()
      ctx.strokeStyle = primaryC
      ctx.lineWidth = 1.5
      const step = Math.max(1, Math.floor(wave.length / W))
      for (let x = 0; x < W; x++) {
        const idx = Math.floor((x / W) * wave.length)
        const v = (wave[Math.min(idx, wave.length - 1)] / 128) - 1
        const y = midY + v * (H * 0.44)
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        void step
      }
      ctx.stroke()

      // Mirror below
      ctx.beginPath()
      ctx.strokeStyle = secondaryC
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.4
      for (let x = 0; x < W; x++) {
        const idx = Math.floor((x / W) * wave.length)
        const v = (wave[Math.min(idx, wave.length - 1)] / 128) - 1
        const y = midY - v * (H * 0.44)
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    } else {
      // Scroll mode — waveform scrolls left over time
      scrollRef.current = (scrollRef.current + 1) % W
      const offset = scrollRef.current

      if (showGlow) { ctx.shadowColor = primaryC; ctx.shadowBlur = accentIntensity * 4 }
      ctx.beginPath()
      ctx.strokeStyle = primaryC
      ctx.lineWidth = 1.5
      for (let x = 0; x < W; x++) {
        const idx = ((x + offset) % W / W) * wave.length
        const v = (wave[Math.floor(idx) % wave.length] / 128) - 1
        const y = midY + v * (H * 0.44)
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    ctx.shadowBlur = 0

    // Playhead (only for file source with duration)
    if (duration > 0 && mode === 'centered') {
      const px = (currentTime / duration) * W
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, 0, px, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke()
    }

    // Center axis
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke()
  })

  return (
    <canvas ref={canvasRef} width={600} height={80}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
