import { useEffect, useRef } from 'react'
import './workspaceLoader.css'

/**
 * Full-workspace loading state shown while a lazy view's code loads. Same
 * vocabulary as the login / signup emblem panel: dark field, ice/cyan additive
 * glow, orbital rings, and a synthetic 124 BPM pulse — here a ring-shaped
 * waveform inside orbiting arcs. No audio, no engine runtime.
 */

const ICE = '142, 244, 255'
const CYAN = '74, 199, 219'
const DEEP = '6, 120, 160'

const BPM = 124
const SIZE = 280
const BARS = 48
const TAU = Math.PI * 2

function drawFrame(ctx: CanvasRenderingContext2D, t: number, beat: number) {
  const c = SIZE / 2
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  // Soft core glow, breathing on the kick.
  const glowR = SIZE * (0.28 + beat * 0.04)
  const glow = ctx.createRadialGradient(c, c, 0, c, c, glowR)
  glow.addColorStop(0, `rgba(${CYAN}, ${0.16 + beat * 0.12})`)
  glow.addColorStop(1, `rgba(${DEEP}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(c, c, glowR, 0, TAU)
  ctx.fill()

  // One orbital ring.
  const ringR = SIZE * 0.4
  ctx.lineWidth = 1
  ctx.strokeStyle = `rgba(${CYAN}, ${0.22 + beat * 0.08})`
  ctx.beginPath()
  ctx.arc(c, c, ringR, 0, TAU)
  ctx.stroke()

  // Ring waveform: bars radiate from an inner radius, swelling on the beat.
  const inner = SIZE * 0.2
  ctx.lineCap = 'round'
  ctx.lineWidth = 2
  ctx.strokeStyle = `rgba(${ICE}, 0.8)`
  ctx.shadowBlur = 8
  ctx.shadowColor = `rgba(${CYAN}, 0.7)`
  for (let i = 0; i < BARS; i++) {
    const a = (i / BARS) * TAU - Math.PI / 2
    const lobe = 0.2 + Math.abs(Math.sin(i * 0.45 + t * 2.2)) * 0.8
    const len = SIZE * (0.015 + lobe * 0.05 + beat * 0.02 * lobe)
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner)
    ctx.lineTo(c + Math.cos(a) * (inner + len), c + Math.sin(a) * (inner + len))
    ctx.stroke()
  }

  // A single orbiting arc with a bright head.
  const head = t * 1.2
  const span = 1.4
  const steps = 16
  ctx.lineWidth = 2
  for (let k = 0; k < steps; k++) {
    const f = (k + 1) / steps
    ctx.strokeStyle = `rgba(${ICE}, ${f * f})`
    ctx.beginPath()
    ctx.arc(c, c, ringR, head - span + (span * k) / steps, head - span + (span * (k + 1)) / steps)
    ctx.stroke()
  }
  ctx.shadowBlur = 0
  const hx = c + Math.cos(head) * ringR
  const hy = c + Math.sin(head) * ringR
  const dot = ctx.createRadialGradient(hx, hy, 0, hx, hy, 7)
  dot.addColorStop(0, `rgba(${ICE}, 0.95)`)
  dot.addColorStop(1, `rgba(${ICE}, 0)`)
  ctx.fillStyle = dot
  ctx.beginPath()
  ctx.arc(hx, hy, 7, 0, TAU)
  ctx.fill()

  ctx.restore()
}

export function WorkspaceLoader({ label }: { label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const reduce = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      drawFrame(ctx, 0.6, 0)
      return
    }

    let raf = 0
    let prev = performance.now()
    const started = prev
    let beatEnv = 0
    const frame = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.05)
      prev = now
      const t = (now - started) / 1000
      const bps = BPM / 60
      if (Math.floor(t * bps) !== Math.floor((t - dt) * bps)) beatEnv = 1
      beatEnv = Math.max(beatEnv - dt * 3.1, 0)
      drawFrame(ctx, t, beatEnv * beatEnv)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="wl-root" role="status" aria-live="polite" aria-label={`Loading ${label}`}>
      <div className="wl-stack">
        <canvas ref={canvasRef} className="wl-canvas" aria-hidden="true" />
        <div className="wl-caption" aria-hidden="true">
          <span className="wl-caption-kicker">Loading</span>
          <span className="wl-caption-name">{label}</span>
        </div>
      </div>
    </div>
  )
}
