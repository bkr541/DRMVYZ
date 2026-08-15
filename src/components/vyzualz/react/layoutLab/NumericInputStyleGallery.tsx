import { useState } from 'react'
import { NumericScrubField } from '../controls/NumericScrubField'

// ── NumericInputStyleGallery ──────────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning numeric input treatment —
// Drag Scrubber — shown live using the real, reusable NumericScrubField
// component directly so this preview matches production exactly.

interface NumericFieldSample {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
}

const NUMERIC_SAMPLES: NumericFieldSample[] = [
  { label: 'Opacity', value: 72, unit: '%', min: 0, max: 100, step: 1 },
  { label: 'BPM', value: 128, unit: 'BPM', min: 40, max: 300, step: 1 },
  { label: 'Duration', value: 450, unit: 'ms', min: 0, max: 2000, step: 10 },
]

function DragScrubberFields() {
  const [fields, setFields] = useState(NUMERIC_SAMPLES)
  const setValue = (label: string, value: number) => {
    setFields(current => current.map(field => (field.label === label ? { ...field, value } : field)))
  }

  return (
    <div className="llni-scrubber-list">
      {fields.map(field => (
        <NumericScrubField
          key={field.label}
          label={field.label}
          value={field.value}
          onChange={value => setValue(field.label, value)}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
        />
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'scrubber', title: '01 · Drag Scrubber', blurb: 'A DAW-style scrub field — drag horizontally for fast, approximate adjustment with a live fill bar, or double-click the number (or press Enter) to type an exact value instead.', Fields: DragScrubberFields },
]

export function NumericInputStyleGallery() {
  return (
    <div className="llni-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Fields />
          </div>
        </div>
      ))}
    </div>
  )
}
