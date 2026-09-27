import { useState, type CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'

// ── PresetTwoColumnStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → REACT tab (below the Media Library thumbnails).
// The presets in every engine's PRESETS tab are one long single-column list of wide rows, so finding
// one without the search box means scrolling. Three candidate treatments put them in TWO columns
// (~175px each) while keeping the preset name fully visible - it wraps instead of being cut off with
// an ellipsis. The same six presets appear in each, including two long names to prove it:
//
//   01 · Stacked Card      thumbnail above, the name in full underneath, chips below it.
//   02 · Corner Caption    the thumbnail fills the card and the name sits in its bottom-left corner on a scrim that grows with the name.
//   03 · Split Tile        a small square thumbnail on the left, the name and chips on the right.

type Motif = 'rings' | 'grid' | 'dots' | 'bars' | 'wave' | 'plain'

interface PresetSample {
  name: string
  chips: string[]
  tone: string
  motif: Motif
  modified?: boolean
  favorite?: boolean
}

const SAMPLES: PresetSample[] = [
  { name: 'Clean Playback', chips: ['Source'], tone: '#e8f4f8', motif: 'plain', favorite: true },
  { name: 'Particle Aura', chips: ['Particles'], tone: '#4ac7db', motif: 'dots', modified: true },
  { name: 'Fractures', chips: ['Fragments'], tone: '#8de7ff', motif: 'grid' },
  { name: 'Laser Image FX', chips: ['Laser'], tone: '#72fff0', motif: 'bars', favorite: true },
  { name: 'Kaleidoscope Bloom Tunnel', chips: ['Tunnel', 'Bloom'], tone: '#b84fc9', motif: 'rings' },
  { name: 'Audio Reactive Ripple Grid', chips: ['Waves'], tone: '#d8b95a', motif: 'wave', modified: true },
]

interface ListProps {
  selected: string
  onSelect: (name: string) => void
}

const toneStyle = (tone: string) => ({ '--llp2-tone': tone }) as CSSProperties

/** The preview picture: a tone-tinted dark plate with a simple motif standing in for the real preview. */
function Thumb({ preset, className }: { preset: PresetSample; className: string }) {
  return <span className={`llp2-thumb llp2-thumb--${preset.motif} ${className}`} aria-hidden="true" />
}

function Heart({ on }: { on?: boolean }) {
  return <span className={`llp2-heart${on ? ' is-on' : ''}`} aria-hidden="true"><FavouriteIcon size={12} color="currentColor" /></span>
}

function Chips({ preset }: { preset: PresetSample }) {
  return (
    <>
      {preset.chips.map(chip => <Badge key={chip} label={chip} tone={preset.tone} />)}
      {preset.modified && <Badge label="Modified" tone="#ffb347" />}
    </>
  )
}

// ── 01 · Stacked Card ────────────────────────────────────────────────────────
function StackedCards({ selected, onSelect }: ListProps) {
  return (
    <div className="llp2-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp2-stacked${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <span className="llp2-stacked-picture">
            <Thumb preset={preset} className="llp2-fill" />
            <Heart on={preset.favorite} />
          </span>
          <span className="llp2-stacked-name">{preset.name}</span>
          <span className="llp2-chips"><Chips preset={preset} /></span>
        </button>
      ))}
    </div>
  )
}

// ── 02 · Corner Caption ──────────────────────────────────────────────────────
function CornerCaptions({ selected, onSelect }: ListProps) {
  return (
    <div className="llp2-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp2-corner${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <Thumb preset={preset} className="llp2-fill" />
          <span className="llp2-corner-chips"><Chips preset={preset} /></span>
          <Heart on={preset.favorite} />
          <span className="llp2-corner-scrim">
            <span className="llp2-corner-name">{preset.name}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 03 · Split Tile ──────────────────────────────────────────────────────────
function SplitTiles({ selected, onSelect }: ListProps) {
  return (
    <div className="llp2-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp2-split${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <span className="llp2-split-rail" aria-hidden="true" />
          <Thumb preset={preset} className="llp2-split-thumb" />
          <span className="llp2-split-body">
            <span className="llp2-split-name">
              {preset.name}
              {preset.modified && <span className="llp2-modified-dot" title="Modified" aria-label="Modified" />}
            </span>
            {/* Only the first chip: the row is narrow, and Modified is the dot beside the name. */}
            <span className="llp2-chips"><Badge label={preset.chips[0]!} tone={preset.tone} /></span>
          </span>
          {preset.favorite && <span className="llp2-split-fav" aria-hidden="true"><FavouriteIcon size={12} color="currentColor" /></span>}
        </button>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'stacked', title: '01 · Stacked Card - ReactPresetCard.tsx', blurb: 'Two columns. The preview sits on top with the heart in its corner; the full name is underneath on up to three lines, then the chips. Nothing is covered, so the name is always easy to read.', List: StackedCards },
  { id: 'corner', title: '02 · Corner Caption - ReactPresetCard.tsx', blurb: 'Your bottom-left idea: the preview fills the whole card and the name sits in its bottom-left corner on a fade that grows with the name, so long names wrap to a second line instead of being cut. The most picture per card.', List: CornerCaptions },
  { id: 'split', title: '03 · Split Tile - ReactPresetCard.tsx', blurb: 'The current row shape, shrunk to fit two columns: a small square preview on the left, the name (wrapping) and its first chip on the right, an orange dot marking a modified preset, and the selection rail on the edge. The shortest card, so the most presets per screen.', List: SplitTiles },
]

export function PresetTwoColumnStyleGallery() {
  const [selected, setSelected] = useState('Clean Playback')
  return (
    <div className="llp2-gallery">
      <div className="llp2-section">
        <span className="llp2-section-title">Preset lists · two columns</span>
        <span className="llp2-section-blurb">Three ways to lay the PRESETS list out in two columns with the full name always visible.</span>
      </div>
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.List selected={selected} onSelect={setSelected} />
          </div>
        </div>
      ))}
    </div>
  )
}
