import { useMemo } from 'react'
import type { VzCueMarker } from '../../../types/cue'

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface VzCueMarkerStripProps {
  markers:     VzCueMarker[]
  currentTime: number
  onSeek:      (t: number) => void
}

export function VzCueMarkerStrip({ markers, currentTime, onSeek }: VzCueMarkerStripProps) {
  const activeId = useMemo(() => {
    let active: VzCueMarker | null = null
    for (const m of markers) {
      if (m.time <= currentTime) active = m
    }
    return active?.id ?? null
  }, [markers, currentTime])

  if (!markers.length) return null

  return (
    <div className="vz-cue-strip">
      {markers.map(m => (
        <button
          key={m.id}
          className={`vz-cue-marker-btn${m.id === activeId ? ' vz-cue-marker-btn--active' : ''}`}
          onClick={() => onSeek(m.time)}
          title={`${m.label} — ${fmtTime(m.time)}`}
          style={m.color && m.id === activeId ? { borderColor: m.color, color: m.color } : undefined}
        >
          <span className="vz-cue-marker-label">{m.label}</span>
          <span className="vz-cue-marker-time">{fmtTime(m.time)}</span>
        </button>
      ))}
    </div>
  )
}
