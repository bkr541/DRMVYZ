import { useRef, useState, useCallback } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  primaryColor: string
}

export function AudioUploader({ onFiles, primaryColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a|ogg|flac)$/i.test(f.name)
    )
    if (audio.length) onFiles(audio)
  }, [onFiles])

  return (
    <div
      className={`uploader ${dragOver ? 'drag-over' : ''}`}
      style={{ '--accent': primaryColor } as React.CSSProperties}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
    >
      <input ref={inputRef} type="file" accept="audio/*" multiple style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)} />
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ opacity: 0.4 }}>
        <path d="M12 3l-4 4h3v4h2V7h3L12 3zm-6 9H4v7h16v-7h-2v5H6v-5z"/>
      </svg>
      <span className="uploader-text">Drop audio files here</span>
      <button className="btn-add" onClick={() => inputRef.current?.click()}
        style={{ '--accent': primaryColor } as React.CSSProperties}>
        + Add Track
      </button>
    </div>
  )
}
