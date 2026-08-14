import { useState } from 'react'

// ── BadgeStyleGallery ─────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Five candidate treatments for a small
// tone-coded label — tags, genres, roles, categories — shown as a strip of
// real examples per style so the full set is judgeable at once, not just
// one swatch.

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

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`
}

// ── 01 · Solid Fill Pill ──────────────────────────────────────────────────

function SolidPillBadges() {
  return (
    <div className="llbd-row">
      {GENRE_SAMPLES.map(sample => (
        <span
          key={sample.label}
          className="llbd-solid"
          style={{ background: sample.tone }}
        >
          {sample.label}
        </span>
      ))}
    </div>
  )
}

// ── 02 · Soft Tint Outline ────────────────────────────────────────────────

function SoftTintBadges() {
  return (
    <div className="llbd-row">
      {GENRE_SAMPLES.map(sample => (
        <span
          key={sample.label}
          className="llbd-soft"
          style={{
            background: withAlpha(sample.tone, '29'),
            borderColor: withAlpha(sample.tone, '66'),
            color: sample.tone,
          }}
        >
          {sample.label}
        </span>
      ))}
    </div>
  )
}

// ── 03 · Dot + Label ──────────────────────────────────────────────────────

function DotLabelBadges() {
  return (
    <div className="llbd-row">
      {GENRE_SAMPLES.map(sample => (
        <span key={sample.label} className="llbd-dot-badge">
          <span
            className="llbd-dot"
            style={{ background: sample.tone, boxShadow: `0 0 4px ${withAlpha(sample.tone, '99')}` }}
            aria-hidden="true"
          />
          {sample.label}
        </span>
      ))}
    </div>
  )
}

// ── 04 · Underline Tag ────────────────────────────────────────────────────

function UnderlineBadges() {
  return (
    <div className="llbd-row">
      {GENRE_SAMPLES.map(sample => (
        <span
          key={sample.label}
          className="llbd-underline"
          style={{ borderBottomColor: sample.tone, color: sample.tone }}
        >
          {sample.label}
        </span>
      ))}
    </div>
  )
}

// ── 05 · Removable Capsule ────────────────────────────────────────────────

function RemovableCapsuleBadges() {
  const [samples, setSamples] = useState(GENRE_SAMPLES)
  const remove = (label: string) => setSamples(current => current.filter(sample => sample.label !== label))
  const reset = () => setSamples(GENRE_SAMPLES)

  return (
    <div className="llbd-row">
      {samples.map(sample => (
        <span
          key={sample.label}
          className="llbd-capsule"
          style={{ borderColor: withAlpha(sample.tone, '4d'), color: sample.tone }}
        >
          <span className="llbd-dot" style={{ background: sample.tone }} aria-hidden="true" />
          {sample.label}
          <button
            type="button"
            className="llbd-capsule-remove"
            style={{ color: sample.tone }}
            aria-label={`Remove ${sample.label} tag (mockup)`}
            onClick={() => remove(sample.label)}
          >
            ×
          </button>
        </span>
      ))}
      {samples.length < GENRE_SAMPLES.length && (
        <button type="button" className="llbd-capsule-reset" onClick={reset}>Reset</button>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'solid', title: '01 · Solid Fill Pill', blurb: 'A fully tone-filled pill with dark text — the highest-contrast, most attention-grabbing option. Best for a small number of prominent tags.', Badges: SolidPillBadges },
  { id: 'soft', title: '02 · Soft Tint Outline', blurb: 'A low-opacity tint of the tone with a matching thin border and tone-colored text. Reads calmer than a solid fill; scales well when many tags sit together.', Badges: SoftTintBadges },
  { id: 'dot', title: '03 · Dot + Label', blurb: 'No background or border — just a small color dot beside plain text. The most minimal option, closest to the existing media-library tag treatment.', Badges: DotLabelBadges },
  { id: 'underline', title: '04 · Underline Tag', blurb: 'Text with a colored underline instead of a pill shape — a lightweight, hashtag-like feel that stays legible in dense lists.', Badges: UnderlineBadges },
  { id: 'capsule', title: '05 · Removable Capsule', blurb: 'A bordered capsule with a color dot and a dismiss (×) button — the shape needed for editable tag/genre entry, not just display. Click × to try removing one.', Badges: RemovableCapsuleBadges },
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
