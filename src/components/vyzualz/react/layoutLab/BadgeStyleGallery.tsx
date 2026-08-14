import { useState } from 'react'
import { Badge } from '../controls/Badge'

// ── BadgeStyleGallery ─────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning tag/genre treatment —
// Removable Capsule — shown live using the real, reusable Badge component
// directly so this preview matches production exactly.

interface BadgeSample {
  label: string
  tone: string
}

const GENRE_SAMPLES: BadgeSample[] = [
  { label: 'Techno', tone: '#4ac7db' },
  { label: 'House', tone: '#61d6aa' },
  { label: 'Trance', tone: '#b84fc9' },
  { label: 'D&B', tone: '#ff6b6b' },
  { label: 'Ambient', tone: '#d8b95a' },
]

function RemovableCapsuleBadges() {
  const [samples, setSamples] = useState(GENRE_SAMPLES)
  const remove = (label: string) => setSamples(current => current.filter(sample => sample.label !== label))
  const reset = () => setSamples(GENRE_SAMPLES)

  return (
    <div className="llbd-row">
      {samples.map(sample => (
        <Badge
          key={sample.label}
          label={sample.label}
          tone={sample.tone}
          onRemove={() => remove(sample.label)}
        />
      ))}
      {samples.length < GENRE_SAMPLES.length && (
        <button type="button" className="llbd-capsule-reset" onClick={reset}>Reset</button>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'capsule', title: '01 · Removable Capsule', blurb: 'A bordered capsule with a color dot and a dismiss (×) button — the shape needed for editable tag/genre entry, not just display. Click × to try removing one.', Badges: RemovableCapsuleBadges },
]

export function BadgeStyleGallery() {
  return (
    <div className="llbd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Badges />
          </div>
        </div>
      ))}
    </div>
  )
}
