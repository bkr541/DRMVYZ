import { useState, type CSSProperties } from 'react'

// ── MediaLibraryStyleGallery ─────────────────────────────────────────────
//
// Layout Lab / Template engine only. Masonry Frame: bold, tone-per-kind
// framed cards with a corner-ribbon badge and a large preview area — the
// winning treatment for the Media Library browser (real component:
// MediaLibraryBrowser.tsx, its .vz-media-card grid) shown throughout
// React's left rails and Show Manager. Static local sample data modeled on
// real library items, no upload/select/favorite wiring — chrome and card
// layout only.
//
// One neutral tone for every media kind for now — color-per-kind styling
// is deferred to a later pass.

const MEDIA_TONES: Record<string, string> = {
  svg: '#9ab2bc',
  video: '#9ab2bc',
}

const SAMPLE_MEDIA = [
  { id: 'wordmark', name: 'DVYDRM Wordmark', kind: 'svg', badge: 'SVG', meta: 'SVG · 1536×864', tag: 'wordmark' },
  { id: 'logo', name: 'DVYDRM Logo', kind: 'svg', badge: 'SVG', meta: 'SVG · 1448×1086', tag: 'logo' },
  { id: 'dragon', name: 'Dragon flying', kind: 'video', badge: 'BG VIDEO', meta: 'MP4 · 0:05', tag: 'dragon' },
  { id: 'lightning', name: 'TheKodyRobinson_dragon_lightning', kind: 'video', badge: 'VID', meta: 'MP4 · 0:05', tag: 'dragon' },
]

const TABS = ['All', 'Collections', 'Favorites', 'Images', 'Videos']

function SvgGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8c2-3 5-3 7 0s5 3 7 0" />
      <path d="M4 14c2 3 5 3 7 0s5-3 7 0" />
    </svg>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="none">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  )
}

function HeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.6-9.7-9C.7 8 2 4.8 5.2 4.1c2-.4 3.9.5 4.8 2.1.4.7 1.6.7 2 0 .9-1.6 2.8-2.5 4.8-2.1C20 4.8 21.3 8 19.7 11.5c-2.2 4.4-9.7 9-9.7 9Z" />
    </svg>
  )
}

function RefreshGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M17 3v4h-4M7 21v-4h4" />
    </svg>
  )
}

function MediaThumb({ kind }: { kind: string }) {
  return (
    <span className="llml-thumb-glyph" aria-hidden="true">
      {kind === 'video' ? <PlayGlyph /> : <SvgGlyph />}
    </span>
  )
}

// Masonry Frame: bold, tone-per-kind framed cards with a corner-ribbon
// badge and a large preview area.
function MasonryFrameLibrary() {
  const [active, setActive] = useState('wordmark')
  return (
    <div className="llml-panel">
      <div className="llml-hdr">
        <span className="llml-hdr-icon" aria-hidden="true"><SvgGlyph /></span>
        <strong>Media Library</strong>
        <button type="button" className="llml-refresh" aria-label="Refresh" title="Refresh"><RefreshGlyph /></button>
      </div>
      <div className="llml-tabs" role="tablist" aria-label="Media Library filter">
        {TABS.map((tab, index) => (
          <button key={tab} type="button" role="tab" aria-selected={index === 0} className={index === 0 ? 'is-active' : ''}>{tab}</button>
        ))}
      </div>
      <input className="llml-search" placeholder="Search media…" disabled />
      <div className="llml-frame-grid">
        {SAMPLE_MEDIA.map(item => (
          <button
            key={item.id}
            type="button"
            className={`llml-frame-card${active === item.id ? ' is-active' : ''}`}
            style={{ '--llml-tone': MEDIA_TONES[item.kind] } as CSSProperties}
            onClick={() => setActive(item.id)}
          >
            <span className="llml-frame-ribbon">{item.badge}</span>
            <span className="llml-frame-thumb"><MediaThumb kind={item.kind} /></span>
            <span className="llml-frame-heart" aria-hidden="true"><HeartGlyph /></span>
            <span className="llml-frame-name">{item.name}</span>
            <span className="llml-frame-footer">
              <span className="llml-frame-meta">{item.meta}</span>
              <span className="llml-frame-tag">{item.tag}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'frame', title: '01 · Masonry Frame', blurb: 'Bold, tone-per-kind framed cards with a corner-ribbon badge and a large preview area — the most visually confident of the three.', Library: MasonryFrameLibrary },
]

export function MediaLibraryStyleGallery() {
  return (
    <div className="llml-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Library />
          </div>
        </div>
      ))}
    </div>
  )
}
