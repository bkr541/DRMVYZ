import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
}

export function VectorscopeModule({ analyserL, analyserR, isActive, primaryColor, secondaryColor, showGlow, accentIntensity }: Props) {
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
    const cx = W / 2, cy = H / 2
    const r = Math.min(cx, cy) - 8
    phaseRef.current += 0.028

    // Fade trail
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(0, 0, W, H)

    // Scope border
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()

    // Crosshairs
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.beginPath()
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r)
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy)
    // 45-degree guides
    const d = r * 0.707
    ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d)
    ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d)
    ctx.stroke()

    // Corner labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '9px monospace'
    ctx.fillText('L', cx - r - 2, cy + 4)
    ctx.fillText('R', cx + r - 6, cy + 4)
    ctx.fillText('+', cx - 4, cy - r + 10)
    ctx.fillText('-', cx - 3, cy + r)

    let points: [number, number][]

    if (analyserL && analyserR && isActive) {
      // Real stereo Lissajous — L on X axis, R on Y axis
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len) {
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      }
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current!)
      const step = Math.max(1, Math.floor(len / 512))
      points = []
      for (let i = 0; i < len; i += step) {
        points.push([
          cx + bufLRef.current[i] * r * 0.9,
          cy - bufRRef.current![i] * r * 0.9,
        ])
      }
    } else {
      // Idle Lissajous figure
      points = []
      const t = phaseRef.current
      for (let i = 0; i < 400; i++) {
        const a = (i / 400) * Math.PI * 2
        const lv = Math.sin(a * 3 + t * 0.7) * 0.65 + Math.sin(a + t * 0.3) * 0.12
        const rv = Math.cos(a * 2 + t * 0.5) * 0.65 + Math.cos(a + t * 0.4) * 0.12
        points.push([cx + lv * r * 0.8, cy - rv * r * 0.8])
      }
    }

    if (showGlow) { ctx.shadowColor = primaryColor; ctx.shadowBlur = accentIntensity * 10 }

    // Draw Lissajous path
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
    ctx.strokeStyle = primaryColor + 'aa'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Accent dots
    ctx.shadowBlur = showGlow ? accentIntensity * 5 : 0
    ctx.fillStyle = secondaryColor
    const dotStep = Math.max(1, Math.floor(points.length / 48))
    for (let i = 0; i < points.length; i += dotStep) {
      ctx.beginPath(); ctx.arc(points[i][0], points[i][1], 1, 0, Math.PI * 2); ctx.fill()
    }
    ctx.shadowBlur = 0
  })

  return (
    <canvas ref={canvasRef} width={180} height={180}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
