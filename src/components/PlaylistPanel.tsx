import { Track } from '../types'
import { formatTime } from '../utils/formatTime'

interface Props {
  tracks: Track[]
  currentIndex: number
  isPlaying: boolean
  onSelect: (i: number) => void
  onRemove: (id: string) => void
  primaryColor: string
}

export function PlaylistPanel({ tracks, currentIndex, isPlaying, onSelect, onRemove, primaryColor }: Props) {
  if (tracks.length === 0)
    return <div className="playlist-empty">No tracks loaded</div>

  return (
    <ul className="playlist">
      {tracks.map((t, i) => {
        const active = i === currentIndex
        return (
          <li key={t.id}
            className={`playlist-item ${active ? 'active' : ''}`}
            onClick={() => onSelect(i)}
            style={active ? { borderColor: primaryColor + '55' } as React.CSSProperties : undefined}
          >
            <span className="pl-index" style={active ? { color: primaryColor } : undefined}>
              {active && isPlaying ? '▶' : String(i + 1).padStart(2, '0')}
            </span>
            <span className="pl-name" style={active ? { color: primaryColor } : undefined}>{t.displayName}</span>
            <span className="pl-dur">{t.duration > 0 ? formatTime(t.duration) : '--:--'}</span>
            <button className="pl-remove" onClick={e => { e.stopPropagation(); onRemove(t.id) }}>×</button>
          </li>
        )
      })}
    </ul>
  )
}
