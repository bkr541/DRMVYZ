import { useState } from 'react'
import { UnderlineDropdownControl } from './layoutLabWinningControls'

// ── DropdownStyleGallery ───────────────────────────────────────────────────
//
// Layout Lab / Template engine only. A dropdown treatment shown here so
// restyling the app's real dropdowns (Dropdown, rv-engine-dropdown,
// ReactControlRows' SelectRow, etc.) can be judged against a real
// alternative instead of an imagined one. Renders the same
// UnderlineDropdownControl reused by the Dual Rail collapsible group demo —
// styled in the app's existing cyan/dark palette.

const SAMPLE_OPTIONS = ['Classic Scope', 'Radial Scope', 'Spiral Scope', 'Pro Scope']

function UnderlineDropdown() {
  const [value, setValue] = useState(SAMPLE_OPTIONS[1])
  return (
    <UnderlineDropdownControl eyebrow="Mode" value={value} onChange={setValue} options={SAMPLE_OPTIONS} ariaLabel="Mode" />
  )
}

export function DropdownStyleGallery() {
  return (
    <div className="lldd-gallery">
      <div className="lldd-gallery-row">
        <div className="lldd-gallery-copy">
          <span className="lldd-gallery-title">02 · Underline</span>
          <span className="lldd-gallery-blurb">Borderless trigger, animated underline, accent-bar option rows.</span>
        </div>
        <div className="lldd-gallery-sample">
          <UnderlineDropdown />
        </div>
      </div>
    </div>
  )
}
