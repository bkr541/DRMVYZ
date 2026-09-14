import type { CSSProperties } from 'react'
import { Badge } from '../controls/Badge'

// ── PresetCardStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab. Candidate
// treatments for a preset card (the shape ReactPresetCard actually renders
// today: a 76×52 thumbnail, a name, up to two chips, a "Modified" badge, and
// a favorite star — no description or palette swatch, since the production
// component never renders those props despite declaring them).

interface PresetSample {
  name: string
  chips: string[]
  tone: string
  modified?: boolean
  active?: boolean
  favorite?: boolean
}

const PRESET_SAMPLES: PresetSample[] = [
  { name: 'Clean Playback', chips: ['Source'], tone: '#e8f4f8', active: true, favorite: true },
  { name: 'Particle Aura', chips: ['Particles'], tone: '#4ac7db', modified: true },
  { name: 'Fractures', chips: ['Fragments'], tone: '#8de7ff' },
  { name: 'Laser Image FX', chips: ['Laser'], tone: '#72fff0', favorite: true },
]

function PresetChips({ preset }: { preset: PresetSample }) {
  return (
    <>
      {preset.chips.map(chip => <Badge key={chip} label={chip} tone={preset.tone} />)}
      {preset.modified && <Badge label="Modified" tone="#ffb347" />}
    </>
  )
}

// ── 01 · Filmstrip Row ───────────────────────────────────────────────────────
// The current production shape, refined: a wide thumbnail on the left, name
// and chips stacked on the right, favorite star pinned to the corner.

function FilmstripRows() {
  return (
    <div className="llpc-filmstrip-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-filmstrip-card${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-filmstrip-thumb" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          <span className="llpc-filmstrip-body">
            <span className="llpc-filmstrip-name">{preset.name}</span>
            <span className="llpc-filmstrip-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-filmstrip-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

// ── 02 · Minimal List ────────────────────────────────────────────────────────
// No thumbnail at all — a color dot stands in for it. Highest density,
// suited to long preset libraries where a thumbnail adds little signal.

function MinimalListRows() {
  return (
    <div className="llpc-minimal-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-minimal-row${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-minimal-dot" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          <span className="llpc-minimal-name">{preset.name}</span>
          <span className="llpc-minimal-chips"><PresetChips preset={preset} /></span>
          {preset.favorite && <span className="llpc-minimal-fav" aria-hidden="true">★</span>}
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'filmstrip', title: '01 · Filmstrip Row', blurb: 'The current production shape, refined — a wide thumbnail on the left, name and chips stacked on the right, favorite star pinned to the corner.', Rows: FilmstripRows },
  { id: 'minimal', title: '02 · Minimal List', blurb: 'No thumbnail at all — a color dot stands in for it. The highest-density option, suited to long preset libraries where a thumbnail adds little signal.', Rows: MinimalListRows },
]

export function PresetCardStyleGallery() {
  return (
    <div className="llpc-gallery">
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
