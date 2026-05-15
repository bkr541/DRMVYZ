import { useRef } from 'react'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { AudioSource } from '../types'

interface Props {
  isPlaying: boolean
  trackName: string
  source: AudioSource
  primaryColor: string
  secondaryColor: string
  showGlow: boolean
}

const SOURCE_LABELS: Record<AudioSource, string> = {
  file: 'FILE INPUT',
  microphone: 'MIC INPUT',
  demo: 'DEMO MODE',
}

export function StatusPanel({ isPlaying, trackName, source, primaryColor, secondaryColor, showGlow }: Props) {
  const dotRef   = useRef<HTMLSpanElement>(null)
  const phaseRef = useRef(0)

  useAnimationFrame(() => {
    phaseRef.current += 0.05
    const dot = dotRef.current
    if (!dot) return
    const pulse = isPlaying
      ? 0.5 + Math.abs(Math.sin(phaseRef.current)) * 0.5
      : 0.2 + Math.abs(Math.sin(phaseRef.current * 0.3)) * 0.15
    dot.style.opacity = String(pulse)
  })

  const status = isPlaying ? 'TRANSMITTING' : trackName ? 'STANDBY' : 'AWAITING SIGNAL'

  return (
    <div className="status-panel">
      <div className="status-row">
        <span ref={dotRef} className="status-dot"
          style={{ background: isPlaying ? primaryColor : 'rgba(255,255,255,0.3)',
                   boxShadow: showGlow && isPlaying ? `0 0 8px ${primaryColor}` : 'none' }} />
        <span className="status-label" style={{ color: isPlaying ? primaryColor : 'rgba(255,255,255,0.35)' }}>
          {status}
        </span>
        <span className="source-badge" style={{ color: secondaryColor }}>{SOURCE_LABELS[source]}</span>
      </div>
      <div className="status-track">{trackName || 'NO TRACK SELECTED'}</div>
      <div className="status-sub">DVYDRM // DRMWLD SIGNAL</div>
    </div>
  )
}
