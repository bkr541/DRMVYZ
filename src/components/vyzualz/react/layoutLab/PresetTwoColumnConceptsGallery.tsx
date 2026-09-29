import { useState, type CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'

// ── PresetTwoColumnConceptsGallery ─────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab (below the one-column card). The PRESETS list is one long column of wide
// rows, so finding a preset without the search box means scrolling. Four candidate treatments put the cards in TWO columns (~175px each) with
// the full name always visible (it wraps instead of being cut off with an ellipsis). They are deliberately different ideas from the
// thumbnail-plus-name layouts in the REACT tab's gallery (PresetTwoColumnStyleGallery):
//
//   01 · Poster Tile    a wide preview with the name centred at its foot; the most picture per card.
//   02 · Info Card      text first: a small preview beside the name, then the description, then the chips.
//   03 · Colour Block   no preview image: a tinted block set in large type, with a tiny motif in the corner; the densest list.
//   04 · Staggered      two independent columns of previews with alternating heights, the name under each (a masonry wall).
//
// The same six presets appear in each, including two long names to prove the wrapping. Choosing one selects it in all four.

type Motif = 'rings' | 'grid' | 'dots' | 'bars' | 'wave' | 'plain'

interface PresetSample {
  name: string
  description: string
  chips: string[]
  tone: string
  motif: Motif
  modified?: boolean
  favorite?: boolean
}

const SAMPLES: PresetSample[] = [
  { name: 'Clean Playback', description: 'The source video, untouched, with no effects on top.', chips: ['Source'], tone: '#e8f4f8', motif: 'plain', favorite: true },
  { name: 'Particle Aura', description: 'A soft halo of particles that swells with the low end.', chips: ['Particles'], tone: '#4ac7db', motif: 'dots', modified: true },
  { name: 'Fractures', description: 'The picture splits into glass shards on every beat.', chips: ['Fragments'], tone: '#8de7ff', motif: 'grid' },
  { name: 'Laser Image FX', description: 'Scanning laser lines drawn across the image.', chips: ['Laser'], tone: '#72fff0', motif: 'bars', favorite: true },
  { name: 'Kaleidoscope Bloom Tunnel', description: 'Mirrored rings rush toward the camera and bloom.', chips: ['Tunnel', 'Bloom'], tone: '#b84fc9', motif: 'rings' },
  { name: 'Audio Reactive Ripple Grid', description: 'A grid of ripples that follow the track\'s energy.', chips: ['Waves'], tone: '#d8b95a', motif: 'wave', modified: true },
]

interface ListProps {
  selected: string
  onSelect: (name: string) => void
}

const toneStyle = (tone: string) => ({ '--llp4-tone': tone }) as CSSProperties

/** The stand-in preview: a dark plate tinted by the preset's colour with a simple motif. */
function Thumb({ preset, className = '' }: { preset: PresetSample; className?: string }) {
  return <span className={`llp4-thumb llp4-thumb--${preset.motif} ${className}`} aria-hidden="true" />
}

function Heart({ on, className = '' }: { on?: boolean; className?: string }) {
  return <span className={`llp4-heart${on ? ' is-on' : ''} ${className}`} aria-hidden="true"><FavouriteIcon size={12} color="currentColor" /></span>
}

function Chips({ preset }: { preset: PresetSample }) {
  return (
    <span className="llp4-chips">
      {preset.chips.map(chip => <Badge key={chip} label={chip} tone={preset.tone} />)}
      {preset.modified && <Badge label="Modified" tone="#ffb347" />}
    </span>
  )
}

// ── 01 · Poster Tile ─────────────────────────────────────────────────────────
function PosterTiles({ selected, onSelect }: ListProps) {
  return (
    <div className="llp4-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp4-card llp4-poster${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <Thumb preset={preset} className="llp4-fill" />
          <Heart on={preset.favorite} />
          {preset.modified && <span className="llp4-poster-modified"><Badge label="Modified" tone="#ffb347" /></span>}
          <span className="llp4-poster-foot">
            <span className="llp4-poster-name">{preset.name}</span>
            <span className="llp4-poster-chip">{preset.chips.join(' · ')}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 02 · Info Card ───────────────────────────────────────────────────────────
function InfoCards({ selected, onSelect }: ListProps) {
  return (
    <div className="llp4-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp4-card llp4-info${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <span className="llp4-info-head">
            <Thumb preset={preset} className="llp4-info-thumb" />
            <span className="llp4-info-name">{preset.name}</span>
            {preset.favorite && <span className="llp4-info-fav" aria-hidden="true"><FavouriteIcon size={12} color="currentColor" /></span>}
          </span>
          <span className="llp4-info-desc">{preset.description}</span>
          <Chips preset={preset} />
        </button>
      ))}
    </div>
  )
}

// ── 03 · Colour Block ────────────────────────────────────────────────────────
function ColourBlocks({ selected, onSelect }: ListProps) {
  return (
    <div className="llp4-grid">
      {SAMPLES.map(preset => (
        <button
          type="button"
          key={preset.name}
          className={`llp4-card llp4-block${selected === preset.name ? ' is-active' : ''}`}
          style={toneStyle(preset.tone)}
          aria-pressed={selected === preset.name}
          onClick={() => onSelect(preset.name)}
        >
          <Thumb preset={preset} className="llp4-block-motif" />
          <span className="llp4-block-name">
            {preset.name}
            {preset.modified && <span className="llp4-modified-dot" title="Modified" aria-label="Modified" />}
          </span>
          <span className="llp4-block-meta">
            <span className="llp4-block-chip">{preset.chips[0]}</span>
            {preset.favorite && <span className="llp4-block-fav" aria-hidden="true"><FavouriteIcon size={11} color="currentColor" /></span>}
          </span>
        </button>
      ))}
    </div>
  )
}

// ── 04 · Staggered ───────────────────────────────────────────────────────────
// Two independent columns (odd presets left, even right); the previews alternate between tall and short, so the columns interlock like a
// masonry wall instead of ending on a straight line.
function StaggeredWall({ selected, onSelect }: ListProps) {
  const column = (offset: number) => SAMPLES.filter((_, index) => index % 2 === offset).map((preset, row) => {
    const tall = (row + offset) % 2 === 0
    return (
      <button
        type="button"
        key={preset.name}
        className={`llp4-card llp4-wall${selected === preset.name ? ' is-active' : ''}`}
        style={toneStyle(preset.tone)}
        aria-pressed={selected === preset.name}
        onClick={() => onSelect(preset.name)}
      >
        <span className={`llp4-wall-picture ${tall ? 'is-tall' : 'is-short'}`}>
          <Thumb preset={preset} className="llp4-fill" />
          <Heart on={preset.favorite} />
        </span>
        <span className="llp4-wall-name">{preset.name}</span>
        <Chips preset={preset} />
      </button>
    )
  })
  return (
    <div className="llp4-wall-grid">
      <div className="llp4-wall-col">{column(0)}</div>
      <div className="llp4-wall-col">{column(1)}</div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'poster', title: '01 · Poster Tile - ReactPresetCard.tsx', blurb: 'Two columns of compact landscape cards (half the height of a portrait poster). The preview fills the card, the name is centred at its foot on a fade (long names wrap to more lines instead of being cut), and the chip and any "Modified" badge sit on the picture. The most picture per card.', List: PosterTiles },
  { id: 'info', title: '02 · Info Card - ReactPresetCard.tsx', blurb: 'Text first. A small preview sits beside the full name, with the preset\'s one-line description under it (two lines at most) and the chips at the foot. The only option that says what a preset does before you pick it.', List: InfoCards },
  { id: 'block', title: '03 · Colour Block - ReactPresetCard.tsx', blurb: 'No preview image. Each card is a block tinted with the preset\'s colour, the name set in large type, its first chip and the heart along the bottom, an orange dot marking a modified preset, and a faint motif in the corner. The shortest cards, so the most presets per screen.', List: ColourBlocks },
  { id: 'wall', title: '04 · Staggered - ReactPresetCard.tsx', blurb: 'Two independent columns whose previews alternate between tall and short, so the cards interlock like a masonry wall instead of lining up in rows. The name and chips sit under each preview. Reads by column: the left column and the right column are two separate scrolls of the same list.', List: StaggeredWall },
]

export function PresetTwoColumnConceptsGallery() {
  const [selected, setSelected] = useState('Clean Playback')
  return (
    <div className="llp4-gallery">
      <div className="llp4-section">
        <span className="llp4-section-title">Preset cards · two columns</span>
        <span className="llp4-section-blurb">Four ways to lay the PRESETS cards out in two columns, each with the full name always visible.</span>
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
