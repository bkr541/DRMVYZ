import { useRef } from 'react'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import { calcRMS, linToDb } from '../../utils/dsp'

interface Props {
  analyserL: AnalyserNode | null
  analyserR: AnalyserNode | null
  isActive: boolean
}

const DB_MARKS = [0, -6, -12, -18, -24, -30, -36, -42, -48, -60]
const DB_MIN = -60
const DB_MAX = 0

function dbToFrac(db: number) {
  return Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)))
}

function segColor(frac: number): string {
  if (frac > 0.9) return '#e04b44'
  if (frac > 0.72) return '#e8d74a'
  return '#58d15b'
}

export function LevelMetersPanel({ analyserL, analyserR, isActive }: Props) {
  const bufLRef  = useRef<Float32Array<ArrayBuffer> | null>(null)
  const bufRRef  = useRef<Float32Array<ArrayBuffer> | null>(null)
  const rmsL     = useRef(0); const rmsR  = useRef(0)
  const rmsM     = useRef(0); const rmsS  = useRef(0)
  const peakL    = useRef(0); const peakR = useRef(0)
  const peakM    = useRef(0); const peakS = useRef(0)
  const phaseRef = useRef(0)

  const canvasL = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>
  const canvasR = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>
  const canvasM = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>
  const canvasS = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>

  const readL = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const readR = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const readM = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>
  const readS = useRef<HTMLSpanElement>(null) as React.RefObject<HTMLSpanElement>

  useAnimationFrame(() => {
    phaseRef.current += 0.04

    let rl: number, rr: number, rm: number, rs: number

    if (analyserL && analyserR && isActive) {
      const len = analyserL.fftSize
      if (!bufLRef.current || bufLRef.current.length !== len)
        bufLRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>
      if (!bufRRef.current || bufRRef.current.length !== len)
        bufRRef.current = new Float32Array(len) as Float32Array<ArrayBuffer>

      analyserL.getFloatTimeDomainData(bufLRef.current)
      analyserR.getFloatTimeDomainData(bufRRef.current)

      rl = calcRMS(bufLRef.current)
      rr = calcRMS(bufRRef.current)

      const mid  = new Float32Array(len) as Float32Array<ArrayBuffer>
      const side = new Float32Array(len) as Float32Array<ArrayBuffer>
      for (let i = 0; i < len; i++) {
        mid[i]  = (bufLRef.current[i] + bufRRef.current[i]) * 0.7071
        side[i] = (bufLRef.current[i] - bufRRef.current[i]) * 0.7071
      }
      rm = calcRMS(mid)
      rs = calcRMS(side)
    } else {
      const t = phaseRef.current
      rl = Math.max(0, Math.sin(t * 1.3) * 0.13 + 0.06)
      rr = Math.max(0, Math.sin(t * 1.1 + 0.5) * 0.13 + 0.06)
      rm = Math.max(0, Math.sin(t * 1.2) * 0.13 + 0.09)
      rs = Math.max(0, Math.sin(t * 0.8 + 1) * 0.06 + 0.03)
    }

    const SMOOTH = 0.22
    const DECAY  = 0.9975
    rmsL.current += (rl - rmsL.current) * SMOOTH
    rmsR.current += (rr - rmsR.current) * SMOOTH
    rmsM.current += (rm - rmsM.current) * SMOOTH
    rmsS.current += (rs - rmsS.current) * SMOOTH
    peakL.current = Math.max(peakL.current * DECAY, rmsL.current)
    peakR.current = Math.max(peakR.current * DECAY, rmsR.current)
    peakM.current = Math.max(peakM.current * DECAY, rmsM.current)
    peakS.current = Math.max(peakS.current * DECAY, rmsS.current)

    drawBar(canvasL.current, rmsL.current, peakL.current)
    drawBar(canvasR.current, rmsR.current, peakR.current)
    drawBar(canvasM.current, rmsM.current, peakM.current)
    drawBar(canvasS.current, rmsS.current, peakS.current)

    const fmt = (v: number) => {
      const db = linToDb(v)
      return db < -59 ? '-∞' : db.toFixed(1)
    }
    if (readL.current) readL.current.textContent = fmt(rmsL.current)
    if (readR.current) readR.current.textContent = fmt(rmsR.current)
    if (readM.current) readM.current.textContent = fmt(rmsM.current)
    if (readS.current) readS.current.textContent = fmt(rmsS.current)
  })

  return (
    <div className="az-level-body">
      <div className="az-level-meters-row">
        <Scale />
        <div className="az-level-channels">
          <Channel label="L" canvasRef={canvasL} readRef={readL} />
          <Channel label="R" canvasRef={canvasR} readRef={readR} />
          <Channel label="M" canvasRef={canvasM} readRef={readM} />
          <Channel label="S" canvasRef={canvasS} readRef={readS} />
        </div>
        <Scale right />
      </div>
      <div className="az-level-lufs-row">
        <span className="az-level-lufs-label">LUFS</span>
      </div>
    </div>
  )
}

function drawBar(canvas: HTMLCanvasElement | null, rms: number, peak: number) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width
  const H = canvas.height
  const SEG = 34
  const segH = (H - 2) / SEG
  const gap = 1

  ctx.clearRect(0, 0, W, H)

  const rmsDb  = linToDb(rms)
  const peakDb = linToDb(peak)

  for (let s = 0; s < SEG; s++) {
    const frac   = (SEG - 1 - s) / (SEG - 1) // 0=bottom, 1=top
    const segDb  = DB_MIN + frac * (DB_MAX - DB_MIN)
    const lit    = segDb <= rmsDb
    const isPk   = Math.abs(segDb - peakDb) < (DB_MAX - DB_MIN) / SEG * 1.4
    const color  = segColor(dbToFrac(segDb))
    const sy     = s * (segH + gap)

    ctx.globalAlpha = (lit || isPk) ? 1 : 0.1
    ctx.fillStyle   = color
    ctx.fillRect(0, sy, W, segH - 1)
  }
  ctx.globalAlpha = 1
}

function Scale({ right }: { right?: boolean }) {
  return (
    <div className={`az-level-scale ${right ? 'az-level-scale-right' : ''}`}>
      {DB_MARKS.map(db => (
        <span key={db} className="az-level-scale-label">
          {db === 0 ? '0' : db}
        </span>
      ))}
    </div>
  )
}

function Channel({ label, canvasRef, readRef }: {
  label: string
  canvasRef: React.RefObject<HTMLCanvasElement>
  readRef: React.RefObject<HTMLSpanElement>
}) {
  return (
    <div className="az-level-channel">
      <div className="az-level-bar-wrap">
        <canvas
          ref={canvasRef}
          width={24}
          height={200}
          className="az-level-bar-canvas"
        />
      </div>
      <span className="az-level-ch-label">{label}</span>
      <span ref={readRef} className="az-level-readout">—</span>
    </div>
  )
}
