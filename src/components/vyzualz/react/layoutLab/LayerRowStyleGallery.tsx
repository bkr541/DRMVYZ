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
  { label: 'Glow', status: 'Auto' },
  { label: 'Vignette', status: 'Auto' },
  { label: 'Grain', status: 'Auto' },
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
// Same accent-rail-and-body skeleton as Channel Strip, but the ghost index is
// outlined instead of filled, and rows step forward in a shallow physical
// stack — alternating offset, shadow depth, and a cooler gradient wash —
// while status still dissolves via the same mask-image fade.

function DepthStackRows() {
  return (
    <div className="lllr-stack-list">
      {LAYER_SAMPLES.map((row, index) => (
        <div key={row.label} className={`lllr-stack-row${row.active ? ' is-active' : ''}`}>
          <span className="lllr-stack-ghost" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <span className="lllr-stack-accent" aria-hidden="true" />
          <span className="lllr-stack-body">
            <strong className="lllr-stack-label">{row.label}</strong>
            <small className="lllr-stack-status" title={row.status}>{row.status}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 03 · Icon Rail ───────────────────────────────────────────────────────────
// Same accent-rail-and-body skeleton as Channel Strip, but the ghost index is
// replaced with a small solid numeral chip in the role color, and each row's
// background carries a faint wash of that same tone instead of flat neutral.

function IconRailRows() {
  return (
    <div className="lllr-rail-list">
      {LAYER_SAMPLES.map((row, index) => (
        <div
          key={row.label}
          className={`lllr-rail-row${row.active ? ' is-active' : ''}`}
          style={{ '--rail-tone': ROLE_TONES[index % ROLE_TONES.length] } as CSSProperties}
        >
          <span className="lllr-rail-accent" aria-hidden="true" />
          <span className="lllr-rail-chip" aria-hidden="true">{index + 1}</span>
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
  { id: 'stack', title: '02 · Depth Stack', blurb: 'The same accent-rail body as Channel Strip, but the ghost index is outlined instead of filled, rows step forward in a shallow physical stack, and the background carries a cooler diagonal gradient — depth without changing how status dissolves at the edge.', Rows: DepthStackRows },
  { id: 'rail', title: '03 · Icon Rail', blurb: 'The same accent-rail body again, but the ghost index becomes a small solid numeral chip in the role color, and the row background picks up a faint wash of that same tone — a warmer, more color-coded read of the same family.', Rows: IconRailRows },
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
