import { useState, useEffect, useRef } from 'react'
import { getBandAvg } from '../../../lib/audioModulation'
import { useSharedAudio } from '../../../context/AudioEngineContext'
import { LyricManagerModal } from '../LyricManagerModal'
import { SettingsModal } from '../settings/SettingsModal'

function BeatCanvas({ bass }: { bass: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number>(0)
  const bassRef   = useRef(bass)

  useEffect(() => { bassRef.current = bass }, [bass])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = 70, H = 22
    canvas.width  = W * devicePixelRatio
    canvas.height = H * devicePixelRatio
    canvas.style.width  = `${W}px`
    canvas.style.height = `${H}px`
    const dpr = devicePixelRatio

    const shape = [0,0,0.08,0.15,0.9,1,0.7,0.4,0.22,0.14,0.1,0.08,0.06,0.05,0.04,0.03,0.02,0.01,0,0]

    let t = 0
    function frame() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cW = canvas.width, cH = canvas.height
      const mid = cH / 2
      const beatPulse = Math.min(1, bassRef.current * 1.4)

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
      })
      ;[...shape].reverse().forEach((v, i) => {
        const x = ((shape.length - 1 - i) / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        ctx.lineTo(x, mid + amp)
      })
      ctx.closePath()

      const alpha = 0.35 + beatPulse * 0.6
      const grad = ctx.createLinearGradient(0, 0, cW, 0)
      grad.addColorStop(0, `rgba(74,199,219,0)`)
      grad.addColorStop(0.25, `rgba(74,199,219,${alpha})`)
      grad.addColorStop(0.75, `rgba(74,199,219,${alpha})`)
      grad.addColorStop(1, `rgba(74,199,219,0)`)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      shape.forEach((v, i) => {
        const x = (i / (shape.length - 1)) * cW
        const amp = (0.25 + beatPulse * 0.75) * v * mid * 0.85
        if (i === 0) ctx.moveTo(x, mid - amp); else ctx.lineTo(x, mid - amp)
      })
      ctx.strokeStyle = `rgba(74,199,219,${0.55 + beatPulse * 0.4})`
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, mid); ctx.lineTo(cW, mid)
      ctx.strokeStyle = 'rgba(74,199,219,0.1)'
      ctx.lineWidth = dpr
      ctx.stroke()

      t++
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  return <canvas ref={canvasRef} />
}

type VyzualzTopBarProps = {
  analyser: AnalyserNode | null
  bassLive: number
  onSaveSession: () => void
}

export function VyzualzTopBar({ analyser, bassLive, onSaveSession }: VyzualzTopBarProps) {
  const engine = useSharedAudio()
  const barRefs     = useRef<Array<HTMLDivElement | null>>(Array.from({ length: 5 }, () => null))
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBufRef  = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const animRef     = useRef<number>(0)
  const [settingsOpen,     setSettingsOpen]     = useState(false)
  const [lyricManagerOpen, setLyricManagerOpen] = useState(false)

  useEffect(() => {
    analyserRef.current = analyser
    freqBufRef.current  = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
  }, [analyser])

  useEffect(() => {
    function frame() {
      const an  = analyserRef.current
      const buf = freqBufRef.current
      let bands = [0.05, 0.05, 0.05, 0.05, 0.05]

      if (an && buf) {
        an.getByteFrequencyData(buf)
        const sr = an.context.sampleRate
        const b  = getBandAvg(buf, sr, 20,   250)
        const lm = getBandAvg(buf, sr, 250,  1000)
        const m  = getBandAvg(buf, sr, 1000, 4000)
        const h  = getBandAvg(buf, sr, 4000, 16000)
        bands = [b, lm, m, h, Math.min(1, (b + m + h) / 2.5)]
      }

      barRefs.current.forEach((el, i) => {
        if (el) el.style.height = `${Math.max(4, bands[i] * 100)}%`
      })
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const sourceLabel = engine.source === 'microphone' ? 'Microphone'
    : engine.source === 'demo' ? 'Demo Signal'
    : 'File Input'

  const BAND_COLORS = ['#4ac7db', '#61d6aa', '#b84fc9', '#d8b95a', '#4ac7db']
  const BAND_LABELS = ['Bass', 'LMid', 'Mid', 'High', 'Vol']

  return (
    <>
      <div className="vz-header">
        <div className="vz-header-title-group">
          <div className="vz-header-title">VYZUALZ</div>
          <div className="vz-header-sub">Visual Audio Synthesizer</div>
        </div>

        <div className="vz-header-sep" />

        <button
          className="vz-session-save-btn"
          onClick={() => setLyricManagerOpen(true)}
          title="Open Lyric Manager"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm-1 14H9V7h2v10zm4 0h-2V7h2v10z"/>
          </svg>
          Lyric Manager
        </button>

        <div className="vz-header-sep" />

        <div className="vz-input-group">
          <span className="vz-input-label">Audio In</span>
          <select className="az-select" value={engine.source} onChange={e => engine.setSource(e.target.value as typeof engine.source)}>
            <option value="file">File Input</option>
            <option value="microphone">Microphone</option>
            <option value="demo">Demo Signal</option>
          </select>
          <span className="vz-active-pill">{sourceLabel.toUpperCase()}</span>
        </div>

        <div className="vz-header-sep" />

        <div className="vz-freq-meters">
          {BAND_LABELS.map((label, i) => (
            <div key={label} className="vz-freq-meter">
              <div className="vz-freq-bar-track">
                <div
                  ref={el => { barRefs.current[i] = el }}
                  className="vz-freq-bar-fill"
                  style={{ height: '5%', background: BAND_COLORS[i] }}
                />
              </div>
              <span className="vz-freq-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="vz-header-sep" />

        <div className="vz-beat-wrap">
          <BeatCanvas bass={bassLive} />
          <span className="vz-beat-label">KICK</span>
        </div>

        <span className="az-spacer" />
        <button className="vz-session-save-btn" onClick={onSaveSession} title="Save current state as a session">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Save Session
        </button>
        <button
          className="vsm-settings-btn"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
        <button className="az-overflow-btn">···</button>
      </div>
      {settingsOpen     && <SettingsModal      onClose={() => setSettingsOpen(false)} />}
      {lyricManagerOpen && <LyricManagerModal  onClose={() => setLyricManagerOpen(false)} />}
    </>
  )
}
