import { useState, type ReactNode } from 'react'
import { NumericScrubField } from '../controls/NumericScrubField'

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

// ── Concept 3: Micro Tag (value-dominant, label as a tiny corner badge) ─
function MicroTag() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-microtag">
      <span className="llbg-microtag-badge">BPM</span>
      <span className="llbg-microtag-value">{bpm.toFixed(2)}</span>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

// ── Concept 4: Drag Scrubber (reuses the real NumericScrubField) ───────
function DragScrubber() {
  const [bpm, setBpm] = useState(128)
  return (
    <div className="llbg-scrub-row">
      <span className="llbg-scrub-row-label">BPM</span>
      <NumericScrubField
        label="BPM"
        value={bpm}
        onChange={setBpm}
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
      />
    </div>
  )
}

// ── Concept 5: Icon Label + Merged Stepper ──────────────────────────────
function IconLabelMergedStepper() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-icon-stepper">
      <span className="llbg-icon-stepper-icon"><MetronomeIcon /></span>
      <span className="llbg-icon-stepper-value">{bpm.toFixed(2)}</span>
      <div className="llbg-merged-stepper">
        <button type="button" onClick={() => step(1)} title="BPM +1" aria-label="BPM +1"><ChevronUpIcon /></button>
        <button type="button" onClick={() => step(-1)} title="BPM -1" aria-label="BPM -1"><ChevronDownIcon /></button>
      </div>
    </div>
  )
}

// ── Concept 6: Value First (caption folded under the number, not beside it) ─
function ValueFirst() {
  const { bpm, step } = useBpmSample(128)
  return (
    <div className="llbg-value-first">
      <div className="llbg-value-first-stack">
        <div className="llbg-value-first-value">{bpm.toFixed(2)}</div>
        <div className="llbg-value-first-caption">BPM</div>
      </div>
      <Chevrons onUp={() => step(1)} onDown={() => step(-1)} />
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'inline', title: '01 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Current production shape: label, value, and chevrons all on one line, no border. Baseline for comparison against the other five.', Group: InlineRow },
  { id: 'chip', title: '02 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Same inline content wrapped in a bordered, rounded chip — matches TAP/SYNC’s own button treatment so all three read as one family of controls.', Group: BorderedChip },
  { id: 'microtag', title: '03 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Value-first hierarchy: a large BPM number with “BPM” shrunk to a small corner tag instead of a full-size label, freeing width for the number itself.', Group: MicroTag },
  { id: 'scrubber', title: '04 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Drops the chevrons entirely and reuses the real, reusable NumericScrubField (the app’s canonical “Drag Scrubber”) — drag to adjust, double-click to type an exact value.', Group: DragScrubber },
  { id: 'iconStepper', title: '05 · BPM Group - VyzualzAudioDock.tsx', blurb: 'Swaps the “BPM” text label for TAP’s own metronome glyph, and merges the two chevron buttons into one compact split stepper to save width.', Group: IconLabelMergedStepper },
  { id: 'valueFirst', title: '06 · BPM Group - VyzualzAudioDock.tsx', blurb: 'The number leads at full size with “BPM” folded underneath it as a tiny caption, rather than beside it — reads like a speedometer more than a labeled field.', Group: ValueFirst },
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
