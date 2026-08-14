import { LayerRow } from '../controls/LayerRow'

// ── LayerRowStyleGallery ──────────────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning layer-list row treatment —
// Channel Strip — shown live using the real, reusable LayerRow component
// directly so this preview matches production exactly. Grounded in a real
// bug: the production Canvas Layers tab's status column has no
// max-width/truncation, so a long locked-media filename overflows and
// squeezes the label out of the row (the Transition row below reproduces
// that exact filename to show the fix).

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

function ChannelStripRows() {
  return (
    <div className="lllr-strip-list">
      {LAYER_SAMPLES.map((row, index) => (
        <LayerRow
          key={row.label}
          index={index + 1}
          label={row.label}
          status={row.status}
          tone={ROLE_TONES[index % ROLE_TONES.length]}
          active={row.active}
        />
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'strip', title: '01 · Channel Strip', blurb: 'Each layer reads like a mixer channel — a colored accent rail, a huge faint index watermark behind it, label up top. The status line fades out with a mask-image gradient instead of an ellipsis, so the long locked-media filename on Transition dissolves at the edge rather than clipping.', Rows: ChannelStripRows },
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
