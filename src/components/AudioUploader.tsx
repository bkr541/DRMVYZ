import { useRef, useState, useCallback } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  primaryColor: string
}

const ACCEPTED = '.mp3,.wav,.aiff,.aif,.m4a,audio/*'

export function AudioUploader({ onFiles, primaryColor }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const audio = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|m4a)$/i.test(f.name))
    if (audio.length) onFiles(audio)
  }, [onFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div
      className={`uploader ${dragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      style={{ '--accent': primaryColor } as React.CSSProperties}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        style={{ display: 'none' }}
        onChange={e => handleFiles(e.target.files)}
      />
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style={{ opacity: 0.5 }}>
        <path d="M12 3l-4 4h3v4h2V7h3L12 3zm-6 9H4v7h16v-7h-2v5H6v-5z"/>
      </svg>
      <span className="uploader-text">Drop audio files here</span>
      <button
        className="btn-add"
        onClick={() => inputRef.current?.click()}
        style={{ '--accent': primaryColor } as React.CSSProperties}
      >
        + Add Track
      </button>
    </div>
  )
}
