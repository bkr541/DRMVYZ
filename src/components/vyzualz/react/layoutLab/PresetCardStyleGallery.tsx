import type { CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'

// ── PresetCardStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab. The 01 preset
// card (the shape ReactPresetCard renders: a 76×52 thumbnail, a name, up to two
// chips, a "Modified" badge and a favourite heart — no description or palette
// swatch, since the production component never renders those props).

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
// and chips stacked on the right, favorite heart pinned to the corner.

function FilmstripRows() {
  return (
    <div className="llpc-filmstrip-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-filmstrip-card${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-filmstrip-accent" aria-hidden="true" />
          <span className="llpc-filmstrip-thumb" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          <span className="llpc-filmstrip-body">
            <span className="llpc-filmstrip-name">{preset.name}</span>
            <span className="llpc-filmstrip-meta"><PresetChips preset={preset} /></span>
          </span>
          {preset.favorite && <span className="llpc-filmstrip-fav" aria-hidden="true"><FavouriteIcon size={15} color="currentColor" /></span>}
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'filmstrip', title: '01 · Preset Card - ReactPresetCard.tsx', blurb: 'The current production shape, refined — a wide thumbnail on the left, name and chips stacked on the right, favorite heart pinned to the corner.', Rows: FilmstripRows },
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
