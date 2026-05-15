import { AudioSource } from '../types'

interface Props {
  source: AudioSource
  onChange: (s: AudioSource) => void
  micError: string | null
  primaryColor: string
}

const SOURCES: { id: AudioSource; label: string; icon: string }[] = [
  { id: 'file',        label: 'File',  icon: '♫' },
  { id: 'microphone',  label: 'Mic',   icon: '⊙' },
  { id: 'demo',        label: 'Demo',  icon: '▶' },
]

export function SourceSelector({ source, onChange, micError, primaryColor }: Props) {
  return (
    <div className="source-selector">
      <span className="source-label">SOURCE</span>
      <div className="source-btns">
        {SOURCES.map(s => (
          <button
            key={s.id}
            className={`source-btn ${source === s.id ? 'active' : ''}`}
            onClick={() => onChange(s.id)}
            title={s.id === 'microphone' && micError ? micError : s.label}
            style={source === s.id ? { '--accent': primaryColor, color: primaryColor, borderColor: primaryColor } as React.CSSProperties : undefined}
          >
            <span className="source-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      {micError && <div className="source-error">{micError}</div>}
    </div>
  )
}
