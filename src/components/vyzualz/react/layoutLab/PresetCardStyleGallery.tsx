import type { CSSProperties } from 'react'
import { Badge } from '../controls/Badge'

// ── PresetCardStyleGallery ────────────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab. Four candidate
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

// ── 02 · Preview Tile Grid ───────────────────────────────────────────────────
// A two-column grid of square preview tiles — reads as a visual browser
// rather than a list, trading row density for a bigger thumbnail.

function TileGridRows() {
  return (
    <div className="llpc-tile-grid">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-tile${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-tile-thumb" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true">
            {preset.favorite && <span className="llpc-tile-fav" aria-hidden="true">★</span>}
          </span>
          <span className="llpc-tile-name">{preset.name}</span>
          <span className="llpc-tile-chips"><PresetChips preset={preset} /></span>
        </button>
      ))}
    </div>
  )
}

// ── 03 · Minimal List ────────────────────────────────────────────────────────
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

// ── 04 · Spotlight Card ──────────────────────────────────────────────────────
// A full-bleed glowing thumbnail with the name and chips overlaid on a
// bottom gradient caption bar, like a media poster — the most visually rich
// option, trading density for presence.

function SpotlightRows() {
  return (
    <div className="llpc-spotlight-list">
      {PRESET_SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llpc-spotlight-card${preset.active ? ' is-active' : ''}`}
        >
          <span className="llpc-spotlight-thumb" style={{ '--llpc-tone': preset.tone } as CSSProperties} aria-hidden="true" />
          {preset.favorite && <span className="llpc-spotlight-fav" aria-hidden="true">★</span>}
          <span className="llpc-spotlight-caption">
            <span className="llpc-spotlight-name">{preset.name}</span>
            <span className="llpc-spotlight-chips"><PresetChips preset={preset} /></span>
          </span>
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'filmstrip', title: '01 · Filmstrip Row', blurb: 'The current production shape, refined — a wide thumbnail on the left, name and chips stacked on the right, favorite star pinned to the corner.', Rows: FilmstripRows },
  { id: 'tile', title: '02 · Preview Tile Grid', blurb: 'A two-column grid of square preview tiles — reads as a visual browser rather than a list, trading row density for a bigger thumbnail.', Rows: TileGridRows },
  { id: 'minimal', title: '03 · Minimal List', blurb: 'No thumbnail at all — a color dot stands in for it. The highest-density option, suited to long preset libraries where a thumbnail adds little signal.', Rows: MinimalListRows },
  { id: 'spotlight', title: '04 · Spotlight Card', blurb: 'A full-bleed glowing thumbnail with the name and chips overlaid on a bottom gradient caption bar, like a media poster — the most visually rich option, trading density for presence.', Rows: SpotlightRows },
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
