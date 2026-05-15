import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { calcRMS, calcTruePeak, linToDb } from '../utils/dsp'
import { LevelMode, VUMode } from '../types'

// Combined Peak / RMS / True Peak / VU meter in one component.
// Mode is selected via the module's settings.levelMode prop.
// VU meter supports needle mode (analog-style) and bar mode.

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
  levelMode: LevelMode
  vuMode: VUMode
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
  accentIntensity: number
  showPeakHold: boolean
  peakDecay: number
  label: string
}

export function LevelMeterModule({
  analyser, isActive, levelMode, vuMode,
  primaryColor, secondaryColor, showGlow, accentIntensity,
  showPeakHold, peakDecay, label,
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const freqRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeRef    = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const floatRef   = useRef<Float32Array<ArrayBuffer> | null>(null)
  const levelRef   = useRef(0)
  const peakRef    = useRef(0)
  const needleRef  = useRef(0) // VU needle angle smoothing
  const phaseRef   = useRef(0)

  useAnimationFrame(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width, H = canvas.height
    phaseRef.current += 0.05

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(0, 0, W, H)

    let rawLevel = 0

    if (analyser && isActive) {
      const binCount = analyser.frequencyBinCount
      const fftSz    = analyser.fftSize

      if (levelMode === 'rms') {
        if (!floatRef.current || floatRef.current.length !== fftSz)
          floatRef.current = new Float32Array(fftSz) as Float32Array<ArrayBuffer>
        analyser.getFloatTimeDomainData(floatRef.current)
        rawLevel = calcRMS(floatRef.current)
      } else if (levelMode === 'truepeak') {
        if (!timeRef.current || timeRef.current.length !== fftSz)
          timeRef.current = new Uint8Array(fftSz) as Uint8Array<ArrayBuffer>
        analyser.getByteTimeDomainData(timeRef.current)
        rawLevel = calcTruePeak(timeRef.current)
      } else if (levelMode === 'peak') {
        if (!freqRef.current || freqRef.current.length !== binCount)
          freqRef.current = new Uint8Array(binCount) as Uint8Array<ArrayBuffer>
        analyser.getByteFrequencyData(freqRef.current)
        let max = 0
        for (let i = 0; i < freqRef.current.length; i++)
          if (freqRef.current[i] > max) max = freqRef.current[i]
        rawLevel = max / 255
      } else { // vu
        if (!floatRef.current || floatRef.current.length !== fftSz)
          floatRef.current = new Float32Array(fftSz) as Float32Array<ArrayBuffer>
        analyser.getFloatTimeDomainData(floatRef.current)
        // VU standard: ~300ms integration time
        rawLevel = calcRMS(floatRef.current)
      }
    } else {
      rawLevel = Math.max(0, Math.sin(phaseRef.current * 1.2) * 0.15 + 0.07)
    }

    const smoothFactor = levelMode === 'peak' ? 0.5 : levelMode === 'vu' ? 0.12 : 0.3
    levelRef.current += (rawLevel - levelRef.current) * smoothFactor
    if (showPeakHold) peakRef.current = Math.max(peakRef.current * peakDecay, levelRef.current)

    const lvl  = levelRef.current
    const peak = peakRef.current

    if (levelMode === 'vu' && vuMode === 'needle') {
      drawNeedle(ctx, W, H, lvl, peak, primaryColor, secondaryColor, showGlow, accentIntensity, label)
    } else {
      drawBar(ctx, W, H, lvl, peak, primaryColor, showGlow, accentIntensity, showPeakHold, peakDecay, label, levelMode)
    }
    void peakDecay
  })

  return (
    <canvas ref={canvasRef} width={200} height={120}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}

function drawBar(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  lvl: number, peak: number,
  color: string, showGlow: boolean, accentIntensity: number,
  showPeakHold: boolean, _peakDecay: number,
  label: string, mode: LevelMode
) {
  const meterH = H - 30
  const barH   = lvl * meterH
  const barX = 20, barW = W - 40

  // Track
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(barX, H - 20 - meterH, barW, meterH)

  // Fill
  if (showGlow && lvl > 0.05) { ctx.shadowColor = color; ctx.shadowBlur = accentIntensity * 8 * lvl }
  const grad = ctx.createLinearGradient(0, H, 0, H - meterH)
  grad.addColorStop(0, color + '88')
  grad.addColorStop(0.7, color)
  grad.addColorStop(0.9, '#ffaa00')
  grad.addColorStop(1,   '#ff3333')
  ctx.fillStyle = grad
  ctx.fillRect(barX, H - 20 - barH, barW, barH)
  ctx.shadowBlur = 0

  if (showPeakHold && peak > 0.01) {
    const py = H - 20 - peak * meterH
    ctx.fillStyle = color
    ctx.fillRect(barX, py - 2, barW, 2)
  }

  // dB scale
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '8px monospace'; ctx.textAlign = 'right'
  for (const db of [0, -6, -12, -18, -30, -48]) {
    const y = H - 20 - (Math.pow(10, db / 20)) * meterH
    ctx.fillText(String(db), barX - 2, y + 3)
  }
  ctx.textAlign = 'left'

  const db = linToDb(lvl)
  ctx.fillStyle = lvl > 0.9 ? '#ff3333' : color
  ctx.font = '10px monospace'; ctx.textAlign = 'center'
  ctx.fillText(db > -60 ? `${Math.round(db)} dB` : '-∞', W / 2, H - 4)
  ctx.font = '8px monospace'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillText(label, W / 2, H - 14)
  ctx.textAlign = 'left'
  void mode
}

function drawNeedle(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  lvl: number, _peak: number,
  primaryColor: string, _secondary: string,
  showGlow: boolean, accentIntensity: number, label: string
) {
  const cx = W / 2, cy = H * 0.75
  const r  = Math.min(W, H) * 0.6

  // Arc background
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 0.25, false)
  ctx.stroke()

  // Colored arc (green → yellow → red)
  const arcStart  = Math.PI * 0.75
  const arcEnd    = Math.PI * 0.25
  const arcRange  = (Math.PI * 2 - (arcStart - arcEnd)) % (Math.PI * 2)
  const arcPos    = arcStart + lvl * arcRange

  ctx.strokeStyle = lvl > 0.9 ? '#ff3333' : lvl > 0.7 ? '#ffaa00' : primaryColor
  ctx.lineWidth   = 5
  if (showGlow) { ctx.shadowColor = primaryColor; ctx.shadowBlur = accentIntensity * 8 }
  ctx.beginPath()
  ctx.arc(cx, cy, r, arcStart, arcPos, false)
  ctx.stroke()
  ctx.shadowBlur = 0

  // Scale ticks & labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '8px monospace'; ctx.textAlign = 'center'
  const dbMarks = [-20, -10, -7, -5, -3, 0, 3]
  dbMarks.forEach(db => {
    const norm = Math.max(0, Math.min(1, (db + 20) / 23))
    const angle = arcStart + norm * arcRange
    const tx = cx + (r + 10) * Math.cos(angle)
    const ty = cy + (r + 10) * Math.sin(angle)
    ctx.fillText(String(db), tx, ty)
  })

  // Needle
  const angle = arcStart + lvl * arcRange
  const nx = cx + r * 0.88 * Math.cos(angle)
  const ny = cy + r * 0.88 * Math.sin(angle)
  if (showGlow) { ctx.shadowColor = '#fff'; ctx.shadowBlur = accentIntensity * 6 }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny); ctx.stroke()
  ctx.shadowBlur = 0

  // Center dot
  ctx.fillStyle = primaryColor
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill()

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '8px monospace'
  ctx.fillText(label, cx, cy + r * 0.3)
  ctx.textAlign = 'left'
}
