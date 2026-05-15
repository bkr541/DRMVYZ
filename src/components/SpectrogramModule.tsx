import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { getColorMap, ColorMapName } from '../utils/colorMaps'

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  colorMap: ColorMapName
  scrollSpeed: number
  sensitivity: number
}

export function SpectrogramModule({ analyser, isActive, colorMap, scrollSpeed, sensitivity }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const offRef     = useRef<HTMLCanvasElement | null>(null) // offscreen accumulation canvas
  const dataRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const phaseRef   = useRef(0)
  const frameCount = useRef(0)
  const cmap       = getColorMap(colorMap)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    phaseRef.current += 0.02
    frameCount.current++

    // Create or resize offscreen canvas to match
    if (!offRef.current || offRef.current.width !== W || offRef.current.height !== H) {
      const off = document.createElement('canvas')
      off.width = W; off.height = H
      offRef.current = off
    }
    const off = offRef.current
    const offCtx = off.getContext('2d')!

    const step = Math.max(1, Math.round(3 / scrollSpeed))

    if (frameCount.current % step !== 0) {
      // Just blit the offscreen canvas — no new column yet
      ctx.drawImage(off, 0, 0)
      return
    }

    let freq: Uint8Array<ArrayBuffer>

    if (analyser && isActive) {
      // Real frequency-domain data — each column = one FFT snapshot in time
      if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount) {
        dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
      }
      analyser.getByteFrequencyData(dataRef.current)
      freq = dataRef.current
    } else {
      // Idle sweep animation
      const bins = 256
      if (!dataRef.current || dataRef.current.length !== bins) {
        dataRef.current = new Uint8Array(bins) as Uint8Array<ArrayBuffer>
      }
      for (let i = 0; i < bins; i++) {
        const t = phaseRef.current
        dataRef.current[i] = Math.max(0, Math.round(
          (Math.sin(t * 1.5 + i * 0.12) * 0.4 +
           Math.sin(t * 0.5 + i * 0.05) * 0.3 + 0.1) * 100
        ))
      }
      freq = dataRef.current
    }

    // Scroll the existing image left by 1 pixel
    offCtx.drawImage(off, -1, 0)

    // Draw new column on the rightmost pixel
    const colW = 1
    const binCount = freq.length
    for (let i = 0; i < H; i++) {
      // Map vertical position to frequency bin (log scale feels more natural)
      const t = 1 - i / H
      const binIdx = Math.floor(Math.pow(t, 1.5) * (binCount - 1))
      const v = Math.min(1, (freq[binIdx] / 255) * sensitivity)
      const ci = Math.floor(v * 255)
      const r = cmap[ci * 3], g = cmap[ci * 3 + 1], b = cmap[ci * 3 + 2]
      offCtx.fillStyle = `rgb(${r},${g},${b})`
      offCtx.fillRect(W - colW, i, colW, 1)
    }

    // Blit offscreen to main canvas
    ctx.drawImage(off, 0, 0)

    // Frequency axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '9px monospace'
    const labels = ['20k', '10k', '4k', '1k', '500', '100', '20']
    labels.forEach((lbl, li) => {
      const y = (li / (labels.length - 1)) * H
      ctx.fillText(lbl, 2, y + 4)
    })
  })

  return (
    <canvas ref={canvasRef} width={600} height={180}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
