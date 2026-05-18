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
  mode?: 'Lissajous' | 'Polar'
}

export function VectorscopeModule({ analyserL, analyserR, isActive, primaryColor, secondaryColor, showGlow, accentIntensity, mode = 'Lissajous' }: Props) {
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

    let bufL: Float32Array<ArrayBuffer> | null = null
    let bufR: Float32Array<ArrayBuffer> | null = null

    if (analyserL && analyserR && isActive) {
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len) {
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      }
      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current!)
      bufL = bufLRef.current
      bufR = bufRRef.current
    }

    if (showGlow) { ctx.shadowColor = primaryColor; ctx.shadowBlur = accentIntensity * 10 }

    if (mode === 'Polar') {
      // Polar (mid-side): angle = pan position, radius = amplitude
      // mid = L+R (center), side = L-R (width)
      ctx.strokeStyle = primaryColor + 'aa'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      if (bufL && bufR) {
        const step = Math.max(1, Math.floor(bufL.length / 512))
        for (let i = 0; i < bufL.length; i += step) {
          const mid  = (bufL[i] + bufR[i]) * 0.7071
          const side = (bufL[i] - bufR[i]) * 0.7071
          const amp   = Math.sqrt(mid * mid + side * side)
          const angle = Math.atan2(side, mid) // -π/4 (L) to +π/4 (R)
          const px = cx + Math.sin(angle) * amp * r * 1.2
          const py = cy - Math.cos(angle) * amp * r * 1.2
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
      } else {
        // Idle polar demo
        const t = phaseRef.current
        for (let i = 0; i < 360; i++) {
          const a = (i / 360) * Math.PI * 2
          const amp = 0.45 + Math.sin(a * 3 + t) * 0.25 + Math.sin(a * 5 + t * 0.7) * 0.1
          const px = cx + Math.sin(a) * amp * r
          const py = cy - Math.cos(a) * amp * r
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
      }
      ctx.stroke()

      // Dot accents
      ctx.shadowBlur = showGlow ? accentIntensity * 5 : 0
      ctx.fillStyle = secondaryColor
      if (bufL && bufR) {
        const dotStep = Math.max(1, Math.floor(bufL.length / 48))
        for (let i = 0; i < bufL.length; i += dotStep) {
          const mid  = (bufL[i] + bufR[i]) * 0.7071
          const side = (bufL[i] - bufR[i]) * 0.7071
          const amp   = Math.sqrt(mid * mid + side * side)
          const angle = Math.atan2(side, mid)
          const px = cx + Math.sin(angle) * amp * r * 1.2
          const py = cy - Math.cos(angle) * amp * r * 1.2
          ctx.beginPath(); ctx.arc(px, py, 1, 0, Math.PI * 2); ctx.fill()
        }
      }
    } else {
      // Lissajous: L on X axis, R on Y axis
      const points: [number, number][] = []
      if (bufL && bufR) {
        const step = Math.max(1, Math.floor(bufL.length / 512))
        for (let i = 0; i < bufL.length; i += step) {
          points.push([cx + bufL[i] * r * 0.9, cy - bufR![i] * r * 0.9])
        }
      } else {
        const t = phaseRef.current
        for (let i = 0; i < 400; i++) {
          const a  = (i / 400) * Math.PI * 2
          const lv = Math.sin(a * 3 + t * 0.7) * 0.65 + Math.sin(a + t * 0.3) * 0.12
          const rv = Math.cos(a * 2 + t * 0.5) * 0.65 + Math.cos(a + t * 0.4) * 0.12
          points.push([cx + lv * r * 0.8, cy - rv * r * 0.8])
        }
      }
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
      ctx.strokeStyle = primaryColor + 'aa'
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.shadowBlur = showGlow ? accentIntensity * 5 : 0
      ctx.fillStyle = secondaryColor
      const dotStep = Math.max(1, Math.floor(points.length / 48))
      for (let i = 0; i < points.length; i += dotStep) {
        ctx.beginPath(); ctx.arc(points[i][0], points[i][1], 1, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.shadowBlur = 0
  })

  return (
    <canvas ref={canvasRef} width={180} height={180}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}
