import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'
import { ReactPresetCard } from '../ReactPresetCard'
import { drawPosterArt, POSTER_ART_HEIGHT, POSTER_ART_SCALE, POSTER_ART_WIDTH, type PosterArtKind } from './presetPosterArt'

// ── PresetTwoColumnConceptsGallery ─────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → PRESETS tab (below the one-column card). The PRESETS list is one long column of wide
// rows, so finding a preset without the search box means scrolling. Four candidate treatments put the cards in TWO columns (~175px each) with
// the full name always visible (it wraps instead of being cut off with an ellipsis). They are deliberately different ideas from the
// thumbnail-plus-name layouts in the REACT tab's gallery (PresetTwoColumnStyleGallery):
//
//   01 · Poster Tile    a wide preview with the name centred at its foot; the most picture per card. Each preview is a still generated for
//                       that preset (presetPosterArt.ts), in the style of the login screen's engine scenes, and does not animate.
//   02 · Info Card      text first: a small preview beside the name, then the description, then the chips.
//   03 · Colour Block   no separate preview: the name set in large type over a block that is itself the preset's generated still, darkened
//                       for legibility; the densest list.
//   04 · Staggered      two independent columns of previews with alternating heights, the name under each (a masonry wall).
//
// The same eight presets appear in each, including two long names to prove the wrapping. Choosing one selects it in all four.

type Motif = 'rings' | 'grid' | 'dots' | 'bars' | 'wave' | 'plain'

interface PresetSample {
  name: string
  description: string
  chips: string[]
  tone: string
  motif: Motif
  /** Which generated still the Poster Tile paints for this preset. */
  art: PosterArtKind
  modified?: boolean
  favorite?: boolean
}

const SAMPLES: PresetSample[] = [
  { name: 'Clean Playback', description: 'The source video, untouched, with no effects on top.', chips: ['Source'], tone: '#e8f4f8', motif: 'plain', art: 'clean', favorite: true },
  { name: 'Particle Aura', description: 'A soft halo of particles that swells with the low end.', chips: ['Particles'], tone: '#4ac7db', motif: 'dots', art: 'particleAura', modified: true },
  { name: 'Fractures', description: 'The picture splits into glass shards on every beat.', chips: ['Fragments'], tone: '#8de7ff', motif: 'grid', art: 'fractures' },
  { name: 'Laser Image FX', description: 'Scanning laser lines drawn across the image.', chips: ['Laser'], tone: '#72fff0', motif: 'bars', art: 'laserImage', favorite: true },
  { name: 'Kaleidoscope Bloom Tunnel', description: 'Mirrored rings rush toward the camera and bloom.', chips: ['Tunnel', 'Bloom'], tone: '#b84fc9', motif: 'rings', art: 'tunnel' },
  { name: 'Audio Reactive Ripple Grid', description: 'A grid of ripples that follow the track\'s energy.', chips: ['Waves'], tone: '#d8b95a', motif: 'wave', art: 'rippleGrid', modified: true },
  { name: 'Afterhours 2.0', description: 'A laser-lit DJ floor: beam fans cut through haze over the booth.', chips: ['Lasers'], tone: '#b84fc9', motif: 'bars', art: 'afterhours', favorite: true },
  { name: 'RELIQUARY', description: 'A crystal cloud with a golden tree threading through it, in a dark wood.', chips: ['3D', 'Crystal'], tone: '#e8c36a', motif: 'rings', art: 'reliquary' },
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

/**
 * The still generated for a preset (Poster Tile preview, Colour Block background), painted once when the card mounts. It is a plain 3:2 canvas
 * that fills its card with object-fit: cover, so it needs no resize handling, and it never animates.
 */
function PosterArt({ kind }: { kind: PosterArtKind }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let context: CanvasRenderingContext2D | null = null
    try { context = canvas.getContext('2d') } catch { /* no 2D canvas (headless): the card falls back to its dark plate */ }
    if (context) drawPosterArt(context, kind)
  }, [kind])
  return <canvas ref={canvasRef} className="llp4-art" width={POSTER_ART_WIDTH * POSTER_ART_SCALE} height={POSTER_ART_HEIGHT * POSTER_ART_SCALE} aria-hidden="true" />
}

// ── 01 · Poster Tile ─────────────────────────────────────────────────────────
// This is the real, standard card (ReactPresetCard, poster layout): the same component every engine's PRESETS tab renders, here with a
// generated still as its backdrop. Only the favourites are local to the mockup.
function PosterTiles({ selected, onSelect }: ListProps) {
  const [favorites, setFavorites] = useState(() => new Set(SAMPLES.filter(preset => preset.favorite).map(preset => preset.name)))
  const toggleFavorite = (name: string) => setFavorites(current => {
    const next = new Set(current)
    if (!next.delete(name)) next.add(name)
    return next
  })
  return (
    <div className="rv-preset-group-cards rv-preset-group-cards--poster" data-preset-grid data-preset-columns="2">
      {SAMPLES.map(preset => (
        <ReactPresetCard
          key={preset.name}
          id={preset.name}
          title={preset.name}
          description={preset.description}
          backdrop={<PosterArt kind={preset.art} />}
          chips={preset.chips.map(label => ({ label }))}
          palette={[{ color: preset.tone }]}
          isActive={selected === preset.name}
          isModified={preset.modified}
          isFavorite={favorites.has(preset.name)}
          activateLabel={`Load ${preset.name}`}
          onActivate={() => onSelect(preset.name)}
          onToggleFavorite={() => toggleFavorite(preset.name)}
        />
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
          <PosterArt kind={preset.art} />
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
  { id: 'poster', title: '01 · Poster Tile - ReactPresetCard.tsx', blurb: 'Two columns of compact landscape cards (half the height of a portrait poster). The preview fills the card with a still generated for that preset in the login-screen style, and it stays still: Afterhours 2.0 is a laser-lit DJ floor, Fractures a picture broken into shards that slide and glitch apart, Particle Aura a hologram of particles. The name is centred at its foot on a fade (long names wrap to more lines instead of being cut), and the chip and any "Modified" badge sit on the picture. The most picture per card.', List: PosterTiles },
  { id: 'info', title: '02 · Info Card - ReactPresetCard.tsx', blurb: 'Text first. A small preview sits beside the full name, with the preset\'s one-line description under it (two lines at most) and the chips at the foot. The only option that says what a preset does before you pick it.', List: InfoCards },
  { id: 'block', title: '03 · Colour Block - ReactPresetCard.tsx', blurb: 'No separate preview. Each card is a short block whose whole background is the preset\'s own generated still, darkened so the name stays readable, with the name set in large type, its first chip and the heart along the bottom, and an orange dot marking a modified preset. The shortest cards, so the most presets per screen.', List: ColourBlocks },
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
