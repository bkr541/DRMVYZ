import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

// ── BpmGroupStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Six candidate redesigns for the React
// Audio Dock's BPM group (label, value, up/down BPM), now that it shares
// TAP/SYNC's row-1 grid cell instead of spanning the card's full height —
// see VyzualzAudioDock.tsx / reactView.css's .vz-dock-bpm-block rules.
// Each concept renders inside a row-fit simulator sized to the real
// constraint: a ~38px-tall strip beside a real-proportioned TAP button
// mockup, so every concept is judged at the actual size it has to fit,
// not an idealized one. All six are interactive (drag/click the real
// value) using local sample state, not wired to a real track or engine.

const MIN_BPM = 40
const MAX_BPM = 300

function clampBpm(value: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value))
}

function useBpmSample(initial: number) {
  const [bpm, setBpm] = useState(initial)
  const step = (delta: number) => setBpm(current => clampBpm(current + delta))
  return { bpm, step }
}

function ChevronUpIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 15l5-5 5 5z"/></svg>
}
function ChevronDownIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 9l5 5 5-5z"/></svg>
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

function Chevrons({ onUp, onDown }: { onUp: () => void, onDown: () => void }) {
  return (
    <div className="llbg-chevrons">
      <button type="button" className="llbg-chevron" onClick={onUp} title="BPM +1" aria-label="BPM +1"><ChevronUpIcon /></button>
      <button type="button" className="llbg-chevron" onClick={onDown} title="BPM -1" aria-label="BPM -1"><ChevronDownIcon /></button>
    </div>
  )
}

// ── Concept 1: Inline Row (current production shape) ───────────────────
function InlineRow() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-inline">
      <span className="llbg-inline-label">BPM</span>
      <span className="llbg-inline-value">{bpm.toFixed(2)}</span>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

// ── Concept 2: Bordered Chip (matches TAP/SYNC's button treatment) ─────
function BorderedChip() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-chip">
      <span className="llbg-inline-label">BPM</span>
      <span className="llbg-inline-value">{bpm.toFixed(2)}</span>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

// ── Concept 3: Watermark Overlay (giant ghosted "BPM" behind the number) ─
function WatermarkOverlay() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-watermark">
      <span className="llbg-watermark-bg" aria-hidden="true">BPM</span>
      <span className="llbg-watermark-value">{bpm.toFixed(2)}</span>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

// ── Concept 4: Flanking Stepper (− value + side by side, like a quantity picker) ─
function FlankingStepper() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-flank-stepper">
      <button type="button" className="llbg-flank-btn" onClick={() => step(-1)} title="BPM -1" aria-label="BPM -1">−</button>
      <span className="llbg-flank-value">
        {bpm.toFixed(2)}
        <span className="llbg-flank-unit">bpm</span>
      </span>
      <button type="button" className="llbg-flank-btn" onClick={() => step(1)} title="BPM +1" aria-label="BPM +1">+</button>
    </div>
  )
}

// ── Concept 5: Rotary Dial (a circular ring showing position in the BPM range) ─
function RotaryDial() {
  const { bpm, step } = useBpmSample(128)
  const radius = 15
  const circumference = 2 * Math.PI * radius
  const pct = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)
  const dashoffset = circumference * (1 - pct)
  return (
    <div className="llbg-dial-row">
      <div className="llbg-dial">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="llbg-dial-track" cx={18} cy={18} r={radius} />
          <circle
            className="llbg-dial-fill"
            cx={18} cy={18} r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <span className="llbg-dial-label">BPM</span>
      </div>
      <span className="llbg-dial-value">{bpm.toFixed(2)}</span>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

// ── Concept 6: Underline Scrub Track (a mini fill bar under the value, drag to adjust) ─
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
  { id: 'inline', title: '01 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Current production shape: label, value, and chevrons all on one line, no border. Baseline for comparison against the other five.', Group: InlineRow },
  { id: 'chip', title: '02 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Same inline content wrapped in a bordered, rounded chip — matches TAP/SYNC’s own button treatment so all three read as one family of controls.', Group: BorderedChip },
  { id: 'watermark', title: '03 · BPM Group - VyzualzAudioDock.tsx', blurb: 'The word “BPM” blown up huge, faded to a near-invisible ghost, and layered behind the value instead of sitting beside it as its own label — a stat-card treatment rather than a form field.', Group: WatermarkOverlay },
  { id: 'flankStepper', title: '04 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Drops the stacked up/down chevrons for a side-by-side − / + quantity-picker pair flanking the value, the way a cart or counter control works — a more modern gesture than a vertical arrow stack.', Group: FlankingStepper },
  { id: 'dial', title: '05 · BPM Group - VyzualzAudioDock.tsx', blurb: 'A small circular progress ring — position around the ring reflects where the BPM sits in its 40–300 range — replaces the text label entirely with a shape the rest of the dock doesn’t otherwise use.', Group: RotaryDial },
  { id: 'track', title: '06 · BPM Group - VyzualzAudioDock.tsx', blurb: 'A hairline fill bar sits directly under the value like a mini scrubber track (drag it to change BPM) instead of discrete chevrons — the label and value share one compact line above it.', Group: UnderlineScrubTrack },
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
