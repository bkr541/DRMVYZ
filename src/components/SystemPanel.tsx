import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  trackCount: number
  primaryColor: string
}

export function SystemPanel({ isPlaying, currentTime, duration, trackCount, primaryColor }: Props) {
  const timeRef = useRef(new Date())
  const clockRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef(0)

  useAnimationFrame(() => {
    frameRef.current++
    if (frameRef.current % 30 === 0) {
      timeRef.current = new Date()
      if (clockRef.current) {
        clockRef.current.textContent = timeRef.current.toLocaleTimeString('en-US', { hour12: false })
      }
    }
  })

  const pct = duration > 0 ? Math.round((currentTime / duration) * 100) : 0

  return (
    <div className="system-panel">
      <div className="sys-row">
        <span className="sys-key">SYS</span>
        <span className="sys-val" style={{ color: primaryColor }}>ONLINE</span>
      </div>
      <div className="sys-row">
        <span className="sys-key">TRACKS</span>
        <span className="sys-val">{trackCount}</span>
      </div>
      <div className="sys-row">
        <span className="sys-key">STATUS</span>
        <span className="sys-val" style={{ color: isPlaying ? primaryColor : 'rgba(255,255,255,0.3)' }}>
          {isPlaying ? 'PLAY' : 'IDLE'}
        </span>
      </div>
      <div className="sys-row">
        <span className="sys-key">PROGRESS</span>
        <span className="sys-val">{pct}%</span>
      </div>
      <div className="sys-row">
        <span className="sys-key">CLOCK</span>
        <span className="sys-val sys-clock" ref={clockRef}>
          {new Date().toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
    </div>
  )
}
