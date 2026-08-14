import { forwardRef, type ButtonHTMLAttributes } from 'react'
import './canonicalControls.css'

// ── AudioTrackRow ─────────────────────────────────────────────────────────
//
// Canonical DRMVYZ track-library row from Layout Lab's "Vinyl Row" winner.
// A spinning-record thumbnail (initials as the center label) with a
// DJ-deck-style meta readout — BPM highlighted, dot-separated from key,
// duration, and date.

export interface AudioTrackRowProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string
  artist: string
  duration: string
  bpm: string
  musicalKey: string
  date: string
  active?: boolean
}

function initialsFor(title: string): string {
  const letters = title.match(/[A-Za-z0-9]/g) ?? []
  return (letters[0] ?? '♪').toUpperCase() + (letters[1] ?? '').toUpperCase()
}

export const AudioTrackRow = forwardRef<HTMLButtonElement, AudioTrackRowProps>(function AudioTrackRow({
  title,
  artist,
  duration,
  bpm,
  musicalKey,
  date,
  active = false,
  className = '',
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`dv-track-row${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
    >
      <span className="dv-track-row-disc" aria-hidden="true">
        <span className="dv-track-row-label">{initialsFor(title)}</span>
      </span>
      <span className="dv-track-row-body">
        <span className="dv-track-row-title">{title}</span>
        <span className="dv-track-row-artist">{artist}</span>
        <span className="dv-track-row-meta">
          <span className="dv-track-row-meta-hl">{bpm} BPM</span>
          <span className="dv-track-row-dot" aria-hidden="true" />
          <span>{musicalKey}</span>
          <span className="dv-track-row-dot" aria-hidden="true" />
          <span>{duration}</span>
          <span className="dv-track-row-dot" aria-hidden="true" />
          <span>{date}</span>
        </span>
      </span>
    </button>
  )
})
