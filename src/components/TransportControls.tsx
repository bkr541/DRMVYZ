import { formatTime } from '../utils/formatTime'

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (t: number) => void
  onVolume: (v: number) => void
  primaryColor: string
  hasTrack: boolean
}

export function TransportControls({
  isPlaying, currentTime, duration, volume,
  onPlay, onPause, onStop, onPrev, onNext, onSeek, onVolume,
  primaryColor, hasTrack,
}: Props) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="transport">
      <div className="transport-time">
        <span className="time-current">{formatTime(currentTime)}</span>
        <span className="time-sep">/</span>
        <span className="time-total">{formatTime(duration)}</span>
      </div>

      <div className="seek-bar-wrap">
        <input
          type="range"
          className="seek-bar"
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={e => onSeek(parseFloat(e.target.value))}
          style={{ '--pct': `${pct}%`, '--accent': primaryColor } as React.CSSProperties}
        />
      </div>

      <div className="transport-row">
        <div className="transport-btns">
          <button className="btn-icon" onClick={onPrev} disabled={!hasTrack} title="Previous">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </button>

          <button className="btn-icon btn-stop" onClick={onStop} disabled={!hasTrack} title="Stop">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <rect x="6" y="6" width="12" height="12"/>
            </svg>
          </button>

          <button
            className="btn-play"
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasTrack}
            title={isPlaying ? 'Pause' : 'Play'}
            style={{ '--accent': primaryColor } as React.CSSProperties}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button className="btn-icon" onClick={onNext} disabled={!hasTrack} title="Next">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        <div className="volume-wrap">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ opacity: 0.5 }}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
          </svg>
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => onVolume(parseFloat(e.target.value))}
            style={{ '--pct': `${volume * 100}%`, '--accent': primaryColor } as React.CSSProperties}
          />
          <span className="vol-label">{Math.round(volume * 100)}</span>
        </div>
      </div>
    </div>
  )
}
