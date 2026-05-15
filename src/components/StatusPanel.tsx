import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'

interface Props {
  isPlaying: boolean
  trackName: string
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
}

export function StatusPanel({ isPlaying, trackName, primaryColor, secondaryColor, showGlow }: Props) {
  const dotRef = useRef<HTMLSpanElement>(null)
  const phaseRef = useRef(0)

  useAnimationFrame(() => {
    phaseRef.current += 0.05
    const dot = dotRef.current
    if (!dot) return
    const pulse = isPlaying
      ? 0.6 + Math.abs(Math.sin(phaseRef.current)) * 0.4
      : 0.25 + Math.abs(Math.sin(phaseRef.current * 0.3)) * 0.15
    dot.style.opacity = String(pulse)
  })

  const statusText = isPlaying ? 'TRANSMITTING' : trackName ? 'STANDBY' : 'AWAITING SIGNAL'

  return (
    <div className="status-panel">
      <div className="status-row">
        <span
          ref={dotRef}
          className="status-dot"
          style={{ background: isPlaying ? primaryColor : secondaryColor, boxShadow: showGlow && isPlaying ? `0 0 8px ${primaryColor}` : 'none' }}
        />
        <span className="status-label" style={{ color: isPlaying ? primaryColor : 'rgba(255,255,255,0.4)' }}>
          {statusText}
        </span>
      </div>
      <div className="status-track">
        {trackName || 'NO TRACK SELECTED'}
      </div>
      <div className="status-sub">DVYDRM // DRMWLD SIGNAL</div>
    </div>
  )
}
