import { useRef } from 'react'
import type { Track } from '../../types'

interface Props {
  track: Track | null
  onFiles: (files: File[]) => void
}

export function TrackInfoPanel({ track, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (audio.length) onFiles(audio)
  }

  const name = track?.displayName ?? ''
  const title  = name || '—'
  const artist = '—'
  const album  = '—'
  const genre  = '—'
  const dur    = track ? formatDur(track.duration) : '—'

  const initial = name ? name[0].toUpperCase() : '♪'

  return (
    <div className="az-trackinfo-body">
      <div
        className="az-trackinfo-artwork"
        title="Click to upload"
        onClick={() => inputRef.current?.click()}
        style={{ cursor: 'pointer' }}
      >
        <span className="az-trackinfo-artwork-letter">{initial}</span>
      </div>

      <div className="az-trackinfo-rows">
        <Row k="Title"    v={title}  />
        <Row k="Artist"   v={artist} />
        <Row k="Album"    v={album}  />
        <Row k="Genre"    v={genre}  />
        <Row k="Duration" v={dur}    />
      </div>

      <div className="az-trackinfo-upload">
        <div
          className="az-trackinfo-drop-hint"
          onClick={() => inputRef.current?.click()}
        >
          + Add Track
        </div>
      </div>

      <input
        ref={inputRef}
        className="az-upload-input"
        type="file"
        accept="audio/*"
        multiple
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="az-trackinfo-row">
      <span className="az-trackinfo-key">{k}</span>
      <span className="az-trackinfo-val" title={v}>{v}</span>
    </div>
  )
}

function formatDur(s: number): string {
  if (!isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
