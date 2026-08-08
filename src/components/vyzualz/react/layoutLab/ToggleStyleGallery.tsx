import { useState } from 'react'
import { IconMorphToggleControl } from './layoutLabWinningControls'

// ── ToggleStyleGallery ──────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. A toggle treatment shown here so
// restyling the app's real toggles (ReactControlRows' ToggleRow) can be
// judged against a real alternative instead of the current On/Off text
// button. Renders the same IconMorphToggleControl reused by the Dual Rail
// collapsible group demo.

function IconMorphToggle() {
  const [on, setOn] = useState(true)
  return (
    <div className="llt-row">
      <span className="llt-row-label">Auto Rotate</span>
      <IconMorphToggleControl value={on} onChange={setOn} ariaLabel="Auto Rotate" />
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'morph', title: '01 · Icon Morph', blurb: 'A circular ring fades into a drawn-in checkmark when switched on.', Toggle: IconMorphToggle },
]

export function ToggleStyleGallery() {
  return (
    <div className="llt-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Toggle />
          </div>
        </div>
      ))}
    </div>
  )
}
