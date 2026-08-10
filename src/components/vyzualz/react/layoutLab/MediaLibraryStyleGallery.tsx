import { useState, type CSSProperties } from 'react'

// ── MediaLibraryStyleGallery ─────────────────────────────────────────────
//
// Layout Lab / Template engine only. Three candidate treatments for the
// Media Library browser (real component: MediaLibraryBrowser.tsx, its
// .vz-media-card grid) shown throughout React's left rails and Show
// Manager. Static local sample data modeled on real library items, no
// upload/select/favorite wiring — chrome and card layout only.

const MEDIA_TONES: Record<string, string> = {
  svg: '#b84fc9',
  video: '#4ac7db',
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

function LinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <path d="M8 18h8M12 14v4" />
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

// 1 — Gallery Wall: tight, rounded thumbnail grid, glowing hover, heart and
// link badges floating on the thumbnail — closest to the current real card.
function GalleryWallLibrary() {
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
      <div className="llml-wall-grid">
        {SAMPLE_MEDIA.map(item => (
          <button
            key={item.id}
            type="button"
            className={`llml-wall-card${active === item.id ? ' is-active' : ''}`}
            style={{ '--llml-tone': MEDIA_TONES[item.kind] } as CSSProperties}
            onClick={() => setActive(item.id)}
          >
            <span className="llml-wall-thumb">
              <MediaThumb kind={item.kind} />
              <span className="llml-wall-badge">{item.badge}</span>
              <span className="llml-wall-heart" aria-hidden="true"><HeartGlyph /></span>
              <span className="llml-wall-link" aria-hidden="true"><LinkGlyph /></span>
            </span>
            <span className="llml-wall-name">{item.name}</span>
            <span className="llml-wall-meta">{item.meta}</span>
            <span className="llml-wall-tag">{item.tag}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 2 — List Deck: a compact horizontal list, thumbnail left, info right —
// faster to scan than a grid when the library is long.
function ListDeckLibrary() {
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
      <div className="llml-list">
        {SAMPLE_MEDIA.map(item => (
          <button
            key={item.id}
            type="button"
            className={`llml-list-row${active === item.id ? ' is-active' : ''}`}
            style={{ '--llml-tone': MEDIA_TONES[item.kind] } as CSSProperties}
            onClick={() => setActive(item.id)}
          >
            <span className="llml-list-thumb"><MediaThumb kind={item.kind} /></span>
            <span className="llml-list-copy">
              <span className="llml-list-name">{item.name}</span>
              <span className="llml-list-meta">{item.meta} · {item.tag}</span>
            </span>
            <span className="llml-list-badge">{item.badge}</span>
            <span className="llml-list-heart" aria-hidden="true"><HeartGlyph /></span>
          </button>
        ))}
      </div>
    </div>
  )
}

// 3 — Masonry Frame: bold, tone-per-kind framed cards with a corner-ribbon
// badge and a large preview area — the most visually confident of the three.
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
  { id: 'wall', title: '01 · Gallery Wall', blurb: 'A tight, rounded thumbnail grid with heart/link badges floating on the thumbnail — closest to the current real card, more polished.', Library: GalleryWallLibrary },
  { id: 'list', title: '02 · List Deck', blurb: 'A compact horizontal list — thumbnail left, info right — faster to scan than a grid when the library is long.', Library: ListDeckLibrary },
  { id: 'frame', title: '03 · Masonry Frame', blurb: 'Bold, tone-per-kind framed cards with a corner-ribbon badge and a large preview area — the most visually confident of the three.', Library: MasonryFrameLibrary },
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
