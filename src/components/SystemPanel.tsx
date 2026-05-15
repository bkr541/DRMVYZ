import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  trackCount: number
  moduleCount: number
  primaryColor: string
}

export function SystemPanel({ isPlaying, currentTime, duration, trackCount, moduleCount, primaryColor }: Props) {
  const clockRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef(0)

  useAnimationFrame(() => {
    frameRef.current++
    if (frameRef.current % 30 === 0 && clockRef.current) {
      clockRef.current.textContent = new Date().toLocaleTimeString('en-US', { hour12: false })
    }
  })

  const pct = duration > 0 ? Math.round((currentTime / duration) * 100) : 0

  return (
    <div className="system-panel">
      {[
        ['SYS',      'ONLINE',                primaryColor],
        ['TRACKS',   String(trackCount),       undefined],
        ['MODULES',  String(moduleCount),      undefined],
        ['STATUS',   isPlaying ? 'PLAY' : 'IDLE', isPlaying ? primaryColor : 'rgba(255,255,255,0.3)'],
        ['PROGRESS', `${pct}%`,               undefined],
      ].map(([k, v, c]) => (
        <div key={k} className="sys-row">
          <span className="sys-key">{k}</span>
          <span className="sys-val" style={c ? { color: c } : undefined}>{v}</span>
        </div>
      ))}
      <div className="sys-row">
        <span className="sys-key">CLOCK</span>
        <span className="sys-val sys-clock" ref={clockRef}>
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
    </div>
  )
}
