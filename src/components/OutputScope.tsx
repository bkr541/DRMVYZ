import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  active: boolean
}

export function OutputScope({ analyserL, analyserR, primaryColor, secondaryColor, showGlow, accentIntensity, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bufLRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const timeRef = useRef(0)
  const trailRef = useRef<{ x: number; y: number; a: number }[]>([])

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const r = Math.min(cx, cy) - 8
    timeRef.current += 0.03

    // Fade trail
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 0, W, H)

    // Draw scope circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    // Crosshairs
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.lineTo(cx, cy + r)
    ctx.moveTo(cx - r, cy)
    ctx.lineTo(cx + r, cy)
    ctx.stroke()

    let points: { x: number; y: number }[] = []

    if (analyserL && analyserR && active) {
      // Real stereo Lissajous: L on X axis, R on Y axis
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len) {
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      }
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current!)

      const step = Math.max(1, Math.floor(len / 512))
      for (let i = 0; i < len; i += step) {
        const lv = bufLRef.current[i]
        const rv = bufRRef.current![i]
        points.push({
          x: cx + lv * r * 0.95,
          y: cy - rv * r * 0.95,
        })
      }
    } else {
      // Idle Lissajous figure
      const t = timeRef.current
      const count = 300
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const lv = Math.sin(a * 3 + t * 0.8) * 0.6 + Math.sin(a * 1 + t * 0.3) * 0.15
        const rv = Math.cos(a * 2 + t * 0.6) * 0.6 + Math.cos(a * 1 + t * 0.4) * 0.15
        points.push({
          x: cx + lv * r * 0.75,
          y: cy - rv * r * 0.75,
        })
      }
    }

    if (points.length === 0) return

    if (showGlow) {
      ctx.shadowColor = primaryColor
      ctx.shadowBlur = accentIntensity * 8
    }

    // Draw points as gradient path
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.strokeStyle = primaryColor + 'bb'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Bright dots at intervals
    ctx.shadowBlur = showGlow ? accentIntensity * 4 : 0
    ctx.fillStyle = secondaryColor
    const step2 = Math.max(1, Math.floor(points.length / 40))
    for (let i = 0; i < points.length; i += step2) {
      ctx.beginPath()
      ctx.arc(points[i].x, points[i].y, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0
  })

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={160}
      style={{ width: '100%', height: '100%', display: 'block', borderRadius: '50%' }}
    />
  )
}
