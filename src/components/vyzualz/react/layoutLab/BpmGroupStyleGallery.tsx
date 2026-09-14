import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

// ── BpmGroupStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning BPM group treatment —
// Underline Scrub Track — shown live for the React Audio Dock's BPM group
// (label, value, up/down BPM), now that it shares TAP/SYNC's row-1 grid
// cell instead of spanning the card's full height. Matches production
// exactly (VyzualzAudioDock.tsx / reactView.css's .vz-dock-bpm-block /
// .vz-dock-bpm-track-bar rules): label + value on one line, a drag-to-scrub
// fill bar directly beneath instead of discrete up/down chevrons. Rendered
// inside a row-fit simulator sized to the real constraint — a ~38px-tall
// strip beside a real-proportioned TAP button mockup — so it's judged at
// the actual size it has to fit. Interactive (drag the real value) using
// local sample state, not wired to a real track or engine.

const MIN_BPM = 40
const MAX_BPM = 300

function clampBpm(value: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value))
}

function MetronomeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M16,21c0.3,0,0.6-0.1,0.8-0.4l13-17c0.3-0.4,0.3-1.1-0.2-1.4c-0.4-0.3-1.1-0.3-1.4,0.2l-5.7,7.5l-1-4.8 c-0.4-1.8-2-3.1-3.8-3.1h-3.4c-1.8,0-3.4,1.2-3.8,3L5.8,25.5c-0.3,1.1,0,2.2,0.7,3.1C7.2,29.5,8.2,30,9.3,30h13.3 c1.1,0,2.2-0.5,2.9-1.4c0.7-0.9,0.9-2,0.7-3.1l-2.5-9.7c-0.1-0.5-0.7-0.9-1.2-0.7c-0.5,0.1-0.9,0.7-0.7,1.2l1.5,5.8H8.6l3.8-16.5 c0.2-0.9,1-1.5,1.8-1.5h3.4c0.9,0,1.7,0.6,1.8,1.5l1.4,6.5l-5.6,7.4c-0.3,0.4-0.3,1.1,0.2,1.4C15.6,20.9,15.8,21,16,21z"/>
    </svg>
  )
}

/** Row-fit simulator: the real dock's row-1 cell (~38px tall) beside a
 *  real-proportioned TAP button mockup, so the BPM concept inside is
 *  judged at the actual constrained size it has to share with TAP/SYNC. */
function BpmRowFit({ children }: { children: ReactNode }) {
  return (
    <div className="llbg-row-sim">
      <div className="llbg-row-sim-bpm">{children}</div>
      <div className="llbg-row-sim-tap">
        <MetronomeIcon />
        <span>TAP</span>
      </div>
    </div>
  )
}

// ── Underline Scrub Track (a mini fill bar under the value, drag to adjust) ─
function UnderlineScrubTrack() {
  const [bpm, setBpm] = useState(128)
  const pct = ((bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)) * 100

  const scrubFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    setBpm(clampBpm(Math.round(MIN_BPM + fraction * (MAX_BPM - MIN_BPM))))
  }

  return (
    <div className="llbg-track-group">
      <div className="llbg-track-top">
        <span className="llbg-track-label">BPM</span>
        <span className="llbg-track-value">{bpm.toFixed(2)}</span>
      </div>
      <div
        className="llbg-track-bar"
        onPointerDown={event => {
          scrubFromPointer(event)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => { if (event.buttons === 1) scrubFromPointer(event) }}
      >
        <div className="llbg-track-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'track', title: '01 · BPM Group - VyzualzAudioDock.tsx', blurb: 'A hairline fill bar sits directly under the value like a mini scrubber track (drag it to change BPM) instead of discrete chevrons — the label and value share one compact line above it. In production.', Group: UnderlineScrubTrack },
]

export function BpmGroupStyleGallery() {
  return (
    <div className="llbg-gallery lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <BpmRowFit>
              <entry.Group />
            </BpmRowFit>
          </div>
        </div>
      ))}
    </div>
  )
}
