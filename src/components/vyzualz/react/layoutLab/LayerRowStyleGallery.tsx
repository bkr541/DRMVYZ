// ── LayerRowStyleGallery ──────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Three candidate treatments for a
// "record" row in a layer list (the Canvas Layers tab's shape: index,
// label, status). Grounded in a real bug: the production Canvas Layers
// tab's status column has no max-width/truncation, so a long locked-media
// filename overflows and squeezes the label out of the row. Each candidate
// includes that exact scenario (a long filename on one row) to show how it
// handles the overflow.

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

// ── 01 · Truncated Status ───────────────────────────────────────────────────

function TruncatedStatusRows() {
  return (
    <div className="lllr-tree lllr-tree--truncate">
      {LAYER_SAMPLES.map((row, index) => (
        <div className="lllr-branch" key={row.label}>
          <button type="button" className={row.active ? 'is-active' : ''}>
            <span>{index + 1}</span>
            <strong>{row.label}</strong>
            <small title={row.status}>{row.status}</small>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── 02 · Two-Line Layout ─────────────────────────────────────────────────────

function TwoLineRows() {
  return (
    <div className="lllr-tree lllr-tree--twoLine">
      {LAYER_SAMPLES.map((row, index) => (
        <div className="lllr-branch" key={row.label}>
          <button type="button" className={row.active ? 'is-active' : ''}>
            <span className="lllr-twoLine-top">
              <span>{index + 1}</span>
              <strong>{row.label}</strong>
            </span>
            <small>{row.status}</small>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── 03 · Status Chip ─────────────────────────────────────────────────────────

function StatusChipRows() {
  return (
    <div className="lllr-tree lllr-tree--chip">
      {LAYER_SAMPLES.map((row, index) => (
        <div className="lllr-branch" key={row.label}>
          <button type="button" className={row.active ? 'is-active' : ''}>
            <span>{index + 1}</span>
            <strong>{row.label}</strong>
            <small><span className="lllr-chip" title={row.status}>{row.status}</span></small>
          </button>
        </div>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'truncate', title: '01 · Truncated Status', blurb: 'Same three-column grid as production, but the status column gets a fixed max-width and text-overflow ellipsis — a long locked-media filename truncates cleanly on one line instead of overflowing the row.', Rows: TruncatedStatusRows },
  { id: 'twoLine', title: '02 · Two-Line Layout', blurb: 'Index and label share a full-width top line; status drops to its own full-width line below and wraps naturally. Nothing gets clipped, at the cost of a taller row.', Rows: TwoLineRows },
  { id: 'chip', title: '03 · Status Chip', blurb: 'Status renders as a small bordered chip with its own max-width and ellipsis, reading as metadata rather than inline text — visually separates "what" from "state."', Rows: StatusChipRows },
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
