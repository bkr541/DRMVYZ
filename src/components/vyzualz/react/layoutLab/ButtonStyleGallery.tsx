import { IconChipButton } from '../controls/IconChipButton'

// ── ButtonStyleGallery ────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Icon Chip: the winning treatment for
// the app's generic action button (real examples: Show Manager's header
// New Show / Save / Save + Make Active, engine panel action buttons, etc.)
// — a compact, tone-filled pill with an icon. Uses the real, reusable
// IconChipButton directly so this preview matches production exactly.
// Shows a primary, secondary, and disabled state side by side so the full
// button system — not just one state — is judgeable.

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// Icon Chip: a compact tone-filled pill with an icon, closest to a modern
// chip/badge button.
function IconChipButtons() {
  return (
    <div className="llbt-row">
      <IconChipButton tone="primary" icon={<PlusGlyph />}>New Show</IconChipButton>
      <IconChipButton>Save</IconChipButton>
      <IconChipButton disabled>Save + Make Active</IconChipButton>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'chip', title: '01 · Icon Chip', blurb: 'A compact, tone-filled pill with an icon — closest to a modern chip/badge button.', Buttons: IconChipButtons },
]

export function ButtonStyleGallery() {
  return (
    <div className="llbt-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Buttons />
          </div>
        </div>
      ))}
    </div>
  )
}
