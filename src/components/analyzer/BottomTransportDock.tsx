import { useId, useState } from 'react'
import type { Track, AudioSource } from '../../types'

interface Props {
  track: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  source: AudioSource
  sampleRate: number
  hasTrack: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (t: number) => void
  onVolume: (v: number) => void
  onSourceChange: (s: AudioSource) => void
  onOpenSettings: () => void
  onFiles: (files: File[]) => void
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '00:00.000'
  const m    = Math.floor(s / 60)
  const sec  = Math.floor(s % 60)
  const ms   = Math.round((s % 1) * 1000)
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function fmtDur(s: number): string {
  if (!isFinite(s) || s <= 0) return '00:00.000'
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.000`
}

export function BottomTransportDock({
  track, isPlaying, currentTime, duration, volume, source, sampleRate,
  hasTrack, onPlay, onPause, onStop, onPrev, onNext, onSeek, onVolume,
  onSourceChange, onOpenSettings, onFiles,
}: Props) {
  const fileInputId = useId()
  const [dragging, setDragging] = useState(false)
  void dragging; void setDragging

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (audio.length) onFiles(audio)
  }

  const volPct = `${Math.round(volume * 100)}%`
  const volDb  = volume < 0.001
    ? '-∞ dB'
    : `${(20 * Math.log10(volume)).toFixed(1)} dB`

  const initial = track?.displayName?.[0]?.toUpperCase() ?? '♪'
  const title   = track?.displayName ?? 'No track loaded'
  const srLabel = `${(sampleRate / 1000).toFixed(1)} kHz`

  return (
    <div className="az-dock">
      {/* Track info + upload */}
      <div className="az-dock-track">
        <label
          className="az-dock-thumb"
          htmlFor={fileInputId}
          title="Click to load audio file"
          style={{ cursor: 'pointer' }}
        >
          <span className="az-dock-thumb-letter">{initial}</span>
        </label>
        <div className="az-dock-info">
          <span className="az-dock-title">{title}</span>
          {track && <span className="az-dock-artist">—</span>}
          <div className="az-dock-format">
            <span className="az-dock-format-tag">{srLabel}</span>
            <span className="az-dock-format-tag">Stereo</span>
          </div>
        </div>
        <label
          className="az-dock-upload-btn"
          htmlFor={fileInputId}
          title="Upload audio file"
          style={{ cursor: 'pointer' }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
          Add Track
        </label>
      </div>

      {/* Transport */}
      <div className="az-dock-transport">
        <TransBtn title="Previous" disabled={!hasTrack} onClick={onPrev}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
          </svg>
        </TransBtn>

        <TransBtn title="Stop" disabled={!hasTrack} onClick={onStop}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <rect x="6" y="6" width="12" height="12"/>
          </svg>
        </TransBtn>

        <button
          className="az-play-btn"
          disabled={!hasTrack}
          title={isPlaying ? 'Pause' : 'Play'}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying
            ? <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            : <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
          }
        </button>

        <TransBtn title="Next" disabled={!hasTrack} onClick={onNext}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </TransBtn>
      </div>

      {/* Time */}
      <div className="az-dock-time">
        <span className="az-dock-time-current">{fmtTime(currentTime)}</span>
        <span className="az-dock-time-total">{fmtDur(duration)}</span>
      </div>

      {/* Volume */}
      <div className="az-dock-volume">
        <span className="az-dock-vol-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="rgba(245,248,250,0.4)">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </span>
        <span className="az-dock-vol-db">{volDb}</span>
        <input
          type="range"
          className="az-dock-vol-slider"
          min={0} max={1} step={0.005}
          value={volume}
          onChange={e => onVolume(parseFloat(e.target.value))}
          style={{ '--pct': volPct } as React.CSSProperties}
        />
      </div>

      {/* Source + Upload + Gear */}
      <div className="az-dock-right">
        <select
          className="az-dock-source-select"
          value={source}
          onChange={e => onSourceChange(e.target.value as AudioSource)}
        >
          <option value="file">Internal</option>
          <option value="microphone">Microphone</option>
          <option value="demo">Demo</option>
        </select>

        <button
          className="az-dock-gear-btn"
          title="Settings"
          onClick={onOpenSettings}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ opacity: 0.55 }}>
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>

      <input
        id={fileInputId}
        type="file"
        accept="audio/*"
        multiple
        className="az-upload-input"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

function TransBtn({ title, disabled, onClick, children }: {
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className="az-transport-btn"
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
