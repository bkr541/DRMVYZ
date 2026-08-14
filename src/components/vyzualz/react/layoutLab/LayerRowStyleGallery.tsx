import type { CSSProperties } from 'react'

// ── LayerRowStyleGallery ──────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Three candidate treatments for a
// "record" row in a layer list (the Canvas Layers tab's shape: index,
// label, status). Grounded in a real bug: the production Canvas Layers
// tab's status column has no max-width/truncation, so a long locked-media
// filename overflows and squeezes the label out of the row. Each candidate
// includes that exact scenario (a long filename on the Transition row) but
// solves it with its own distinct visual language rather than reusing the
// current tree-row look.

interface LayerRowSample {
  label: string
  status: string
  active?: boolean
}

const LAYER_SAMPLES: LayerRowSample[] = [
  { label: 'Background', status: 'Auto' },
  { label: 'Hero', status: 'Auto', active: true },
  { label: 'Texture', status: 'Auto' },
  { label: 'Foreground Accent', status: 'Auto' },
  { label: 'Mask', status: 'Auto' },
  { label: 'Transition', status: 'TheKodyRobinson_The_cat_aggressively_defends_959e-49de-8548-d446f97e31ed.mp4' },
  { label: 'Feedback', status: 'Auto' },
]

const ROLE_TONES = ['#4ac7db', '#67f7ff', '#6b4cff', '#b84fc9', '#d8b95a', '#61d6aa', '#ff6b6b']

// ── 01 · Channel Strip ───────────────────────────────────────────────────────
// A mixing-console channel per layer: a colored accent rail with a huge faint
// ghost index behind it, label up top, status faded out with a mask-image
// gradient instead of an ellipsis — so overflow dissolves rather than clips.

function ChannelStripRows() {
  return (
    <div className="lllr-strip-list">
      {LAYER_SAMPLES.map((row, index) => (
        <div
          key={row.label}
          className={`lllr-strip-row${row.active ? ' is-active' : ''}`}
          style={{ '--strip-tone': ROLE_TONES[index % ROLE_TONES.length] } as CSSProperties}
        >
          <span className="lllr-strip-ghost" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="lllr-strip-accent" aria-hidden="true" />
          <span className="lllr-strip-body">
            <strong className="lllr-strip-label">{row.label}</strong>
            <small className="lllr-strip-status" title={row.status}>{row.status}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 02 · Depth Stack ─────────────────────────────────────────────────────────
// Cards step forward/back in a shallow physical stack (alternating offset +
// shadow depth). Status rides as a rotated stamp pinned to the card's corner,
// clipped with an ellipsis, reading as metadata rather than body text.

function DepthStackRows() {
  return (
    <div className="lllr-stack-list">
      {LAYER_SAMPLES.map((row, index) => (
        <div key={row.label} className={`lllr-stack-card${row.active ? ' is-active' : ''}`}>
          <span className="lllr-stack-index" aria-hidden="true">{index + 1}</span>
          <strong className="lllr-stack-label">{row.label}</strong>
          <small className="lllr-stack-stamp" title={row.status}>{row.status}</small>
        </div>
      ))}
    </div>
  )
}

// ── 03 · Icon Rail ───────────────────────────────────────────────────────────
// A colored initial chip replaces the numeral. Label and status stack inside
// a fixed-width text column, status fading via mask-image so a long filename
// dissolves at the edge instead of being cut off with "…".

function IconRailRows() {
  return (
    <div className="lllr-rail-list">
      {LAYER_SAMPLES.map((row, index) => (
        <div
          key={row.label}
          className={`lllr-rail-row${row.active ? ' is-active' : ''}`}
          style={{ '--rail-tone': ROLE_TONES[index % ROLE_TONES.length] } as CSSProperties}
        >
          <span className="lllr-rail-glyph" aria-hidden="true">{row.label.charAt(0)}</span>
          <span className="lllr-rail-text">
            <strong className="lllr-rail-label">{row.label}</strong>
            <small className="lllr-rail-status" title={row.status}>{row.status}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'strip', title: '01 · Channel Strip', blurb: 'Each layer reads like a mixer channel — a colored accent rail, a huge faint index watermark behind it, label up top. The status line fades out with a mask-image gradient instead of an ellipsis, so the long locked-media filename on Transition dissolves at the edge rather than clipping.', Rows: ChannelStripRows },
  { id: 'stack', title: '02 · Depth Stack', blurb: 'Cards step forward and back in a shallow physical stack — alternating offset and shadow depth suggest real layering. Status rides as a small rotated stamp pinned to the corner, so the Transition filename reads as a tag, not as row text fighting for space.', Rows: DepthStackRows },
  { id: 'rail', title: '03 · Icon Rail', blurb: 'A colored initial chip stands in for the numeral, echoing per-layer role color. Label and status stack in a fixed text column; status fades via mask-image on overflow, so the long filename dissolves rather than getting cut off.', Rows: IconRailRows },
]

export function LayerRowStyleGallery() {
  return (
    <div className="lllr-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Rows />
          </div>
        </div>
      ))}
    </div>
  )
}
