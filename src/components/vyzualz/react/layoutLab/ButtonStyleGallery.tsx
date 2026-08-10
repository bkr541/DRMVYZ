// ── ButtonStyleGallery ────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Five candidate treatments for the
// app's generic action button (real examples: Show Manager's header
// New Show / Save / Save + Make Active, engine panel action buttons, etc.).
// Each shows a primary, secondary, and disabled state side by side so the
// full button system — not just one state — is judgeable. Static, no wiring.

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// 1 — Solid Glow: filled cyan background with a glowing shadow, bold caps —
// a strong, confident primary CTA.
function SolidGlowButtons() {
  return (
    <div className="llbt-row">
      <button type="button" className="llbt-solid llbt-solid--primary"><PlusGlyph /> New Show</button>
      <button type="button" className="llbt-solid">Save</button>
      <button type="button" className="llbt-solid" disabled>Save + Make Active</button>
    </div>
  )
}

// 2 — Outline Ghost: transparent with a colored border, fills in on hover —
// a quieter, secondary-action look.
function OutlineGhostButtons() {
  return (
    <div className="llbt-row">
      <button type="button" className="llbt-ghost llbt-ghost--primary"><PlusGlyph /> New Show</button>
      <button type="button" className="llbt-ghost">Save</button>
      <button type="button" className="llbt-ghost" disabled>Save + Make Active</button>
    </div>
  )
}

// 3 — Gradient Edge: a diagonal gradient fill with a bright top-edge
// highlight — a premium, elevated look.
function GradientEdgeButtons() {
  return (
    <div className="llbt-row">
      <button type="button" className="llbt-edge llbt-edge--primary"><PlusGlyph /> New Show</button>
      <button type="button" className="llbt-edge">Save</button>
      <button type="button" className="llbt-edge" disabled>Save + Make Active</button>
    </div>
  )
}

// 4 — Underline Text: no box or border at all — just label text with a
// sliding underline on hover, for the lightest-weight action slot.
function UnderlineTextButtons() {
  return (
    <div className="llbt-row">
      <button type="button" className="llbt-underline llbt-underline--primary"><PlusGlyph /> New Show</button>
      <button type="button" className="llbt-underline">Save</button>
      <button type="button" className="llbt-underline" disabled>Save + Make Active</button>
    </div>
  )
}

// 5 — Icon Chip: a compact tone-filled pill with an icon, closest to a
// modern chip/badge button.
function IconChipButtons() {
  return (
    <div className="llbt-row">
      <button type="button" className="llbt-chip llbt-chip--primary"><PlusGlyph /> New Show</button>
      <button type="button" className="llbt-chip">Save</button>
      <button type="button" className="llbt-chip" disabled>Save + Make Active</button>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'solid', title: '01 · Solid Glow', blurb: 'A filled cyan background with a glowing shadow and bold caps — a strong, confident primary CTA.', Buttons: SolidGlowButtons },
  { id: 'ghost', title: '02 · Outline Ghost', blurb: 'Transparent with a colored border that fills in on hover — a quieter, secondary-action look.', Buttons: OutlineGhostButtons },
  { id: 'edge', title: '03 · Gradient Edge', blurb: 'A diagonal gradient fill with a bright top-edge highlight — a premium, elevated look.', Buttons: GradientEdgeButtons },
  { id: 'underline', title: '04 · Underline Text', blurb: 'No box or border at all — just label text with a sliding underline on hover, for the lightest-weight action slot.', Buttons: UnderlineTextButtons },
  { id: 'chip', title: '05 · Icon Chip', blurb: 'A compact, tone-filled pill with an icon — closest to a modern chip/badge button.', Buttons: IconChipButtons },
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
