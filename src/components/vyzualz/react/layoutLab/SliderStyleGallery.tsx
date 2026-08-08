import { useState } from 'react'
import { BubbleRevealSliderControl } from './layoutLabWinningControls'

// ── SliderStyleGallery ──────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. A slider treatment built to mimic
// dropdown_v2's visual language — the #4ac7db cyan accent, the dark
// floating-menu popover treatment, and its fade-scale reveal animation —
// so a winner can be judged the same way the dropdown styles were. Renders
// the same BubbleRevealSliderControl reused by the Dual Rail collapsible
// group demo.

function BubbleRevealSlider() {
  const [value, setValue] = useState(38)
  return (
    <BubbleRevealSliderControl eyebrow="Motion" value={value} onChange={setValue} ariaLabel="Motion" />
  )
}

const GALLERY_ENTRIES = [
  { id: 'bubble', title: '01 · Bubble Reveal', blurb: 'Dragging pops a dropdown-menu-styled value bubble above the thumb.', Slider: BubbleRevealSlider },
]

export function SliderStyleGallery() {
  return (
    <div className="lls-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Slider />
          </div>
        </div>
      ))}
    </div>
  )
}
