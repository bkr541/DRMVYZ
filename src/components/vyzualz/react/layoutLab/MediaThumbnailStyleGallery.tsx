import { useState, type CSSProperties, type ReactNode } from 'react'
import { FavouriteIcon } from 'hugeicons-react'

// ── MediaThumbnailStyleGallery ────────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → REACT tab. Three candidate
// treatments for the Media Library thumbnails, each showing the same six media
// items so they can be compared directly. The library today is two columns of
// large cards, so a long upload history means a long scroll; all three of these
// pack more of the library into the same 370px-wide rail:
//
//   01 · Poster Grid      3 across  - a compact card: thumbnail, one-line title, one-line detail.
//   02 · Contact Sheet    4 across  - square tiles, the picture first, a slim name strip on the tile.
//   03 · Justified Mosaic 3 columns - tiles keep their real shape (wide, tall, square) and are packed so the columns end together.
//
// The pictures are drawn with CSS and a little inline SVG (no images), standing in for
// real media thumbnails; the click, hover and favourite states are live.

type MediaKind = 'video' | 'image' | 'svg'

interface MediaSample {
  id: string
  title: string
  kind: MediaKind
  /** "0:05" for a video, "1983×793" for an image. */
  detail: string
  /** Width / height of the real media, used by the mosaic. */
  ratio: number
  tone: string
  favorite?: boolean
  art: 'dragon' | 'samurai' | 'logo' | 'chrome' | 'neon' | 'demon'
}

const KIND_LABEL: Record<MediaKind, string> = { video: 'VID', image: 'IMG', svg: 'SVG' }

const SAMPLES: MediaSample[] = [
  { id: 'dragon', title: 'Dragon flying', kind: 'video', detail: '0:05', ratio: 16 / 9, tone: '#4ac7db', favorite: true, art: 'dragon' },
  { id: 'samurai', title: 'Cyber Samurai', kind: 'video', detail: '0:05', ratio: 9 / 16, tone: '#3c8dff', art: 'samurai' },
  { id: 'logo', title: 'DVYDRM Logo', kind: 'svg', detail: '1448×1086', ratio: 4 / 3, tone: '#e8f4f8', art: 'logo' },
  { id: 'chrome', title: 'Iridescent Chrome Emblem', kind: 'image', detail: '1983×793', ratio: 5 / 2, tone: '#d8b95a', art: 'chrome' },
  { id: 'neon', title: 'DVYDRM wm2', kind: 'image', detail: '1522×501', ratio: 3 / 1, tone: '#61d6aa', favorite: true, art: 'neon' },
  { id: 'demon', title: 'Red Demon', kind: 'video', detail: '0:05', ratio: 1, tone: '#ff5a5a', art: 'demon' },
]

/** A stand-in picture for one media item. */
function Art({ art }: { art: MediaSample['art'] }) {
  return (
    <span className={`llmt-art llmt-art--${art}`} aria-hidden="true">
      {art === 'logo' && (
        <svg viewBox="0 0 100 62" className="llmt-art-mark">
          <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round">
            <circle cx="50" cy="20" r="14" />
            <circle cx="30" cy="38" r="15" />
            <circle cx="70" cy="38" r="15" />
          </g>
          <path d="M50 46 L54 54 L50 60 L46 54 Z" fill="#fff" />
        </svg>
      )}
      {art === 'chrome' && <span className="llmt-art-word llmt-art-word--chrome">DVYDRM</span>}
      {art === 'neon' && <span className="llmt-art-word llmt-art-word--neon">DVYDRM</span>}
    </span>
  )
}

function KindChip({ kind }: { kind: MediaKind }) {
  return <span className={`llmt-chip llmt-chip--${kind}`}>{KIND_LABEL[kind]}</span>
}

function Heart({ on }: { on?: boolean }) {
  return <span className={`llmt-heart${on ? ' is-on' : ''}`} aria-hidden="true"><FavouriteIcon size={12} color="currentColor" /></span>
}

interface GridProps {
  selected: string
  onSelect: (id: string) => void
}

function tile(sample: MediaSample, selected: string, onSelect: (id: string) => void, className: string, children: ReactNode, style?: CSSProperties) {
  return (
    <button
      type="button"
      key={sample.id}
      className={`${className}${selected === sample.id ? ' is-active' : ''}`}
      style={{ '--llmt-tone': sample.tone, ...style } as CSSProperties}
      aria-pressed={selected === sample.id}
      aria-label={sample.title}
      onClick={() => onSelect(sample.id)}
    >
      {children}
    </button>
  )
}

// ── 01 · Poster Grid ─────────────────────────────────────────────────────────
function PosterGrid({ selected, onSelect }: GridProps) {
  return (
    <div className="llmt-poster-grid">
      {SAMPLES.map(sample => tile(sample, selected, onSelect, 'llmt-poster', (
        <>
          <span className="llmt-poster-thumb">
            <Art art={sample.art} />
            <KindChip kind={sample.kind} />
            {sample.kind === 'video' && <span className="llmt-duration">{sample.detail}</span>}
            <Heart on={sample.favorite} />
          </span>
          <span className="llmt-poster-title">{sample.title}</span>
          <span className="llmt-poster-detail">{sample.kind === 'video' ? 'MP4' : sample.kind === 'svg' ? 'SVG' : 'PNG'} · {sample.detail}</span>
        </>
      )))}
    </div>
  )
}

// ── 02 · Contact Sheet ───────────────────────────────────────────────────────
function ContactSheet({ selected, onSelect }: GridProps) {
  return (
    <div className="llmt-sheet-grid">
      {SAMPLES.map(sample => tile(sample, selected, onSelect, 'llmt-sheet-tile', (
        <>
          <Art art={sample.art} />
          <KindChip kind={sample.kind} />
          <Heart on={sample.favorite} />
          <span className="llmt-sheet-name">{sample.title}</span>
        </>
      )))}
    </div>
  )
}

// ── 03 · Justified Mosaic ────────────────────────────────────────────────────
/** Which items go in which column, packed so the three columns end at nearly the same height. */
const MOSAIC_COLUMNS: readonly (readonly string[])[] = [['samurai'], ['dragon', 'demon'], ['logo', 'chrome', 'neon']]

function Mosaic({ selected, onSelect }: GridProps) {
  return (
    <div className="llmt-mosaic">
      {MOSAIC_COLUMNS.map((ids, column) => (
        <div key={column} className="llmt-mosaic-col">
          {ids.map(id => {
            const sample = SAMPLES.find(candidate => candidate.id === id)!
            return tile(sample, selected, onSelect, 'llmt-mosaic-tile', (
              <>
                <Art art={sample.art} />
                <KindChip kind={sample.kind} />
                {sample.kind === 'video' && <span className="llmt-duration">{sample.detail}</span>}
                <Heart on={sample.favorite} />
                <span className="llmt-mosaic-name">{sample.title}</span>
              </>
            ), { aspectRatio: String(Math.min(2.2, Math.max(0.6, sample.ratio))) })
          })}
        </div>
      ))}
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'poster', title: '01 · Poster Grid - MediaLibraryBrowser.tsx', blurb: 'Three across. A compact card: the thumbnail with a type chip and duration on it, a one-line title and one line of detail under it. Roughly twice as many items fit in the same space as the current two-column cards, and titles are still readable.', Grid: PosterGrid },
  { id: 'sheet', title: '02 · Contact Sheet - MediaLibraryBrowser.tsx', blurb: 'Four across, square tiles like a photo contact sheet. The picture leads; a slim name strip sits on the tile itself. The densest of the three: roughly three times as many items as the current cards in the same space.', Grid: ContactSheet },
  { id: 'mosaic', title: '03 · Justified Mosaic - MediaLibraryBrowser.tsx', blurb: 'Three columns that pack tiles by their real shape: wide videos, tall portrait clips and square images each keep their proportions instead of being cropped to one size, so nothing is cut off. Roughly three times as many items as the current cards in the same space.', Grid: Mosaic },
]

export function MediaThumbnailStyleGallery() {
  const [selected, setSelected] = useState('dragon')
  return (
    <div className="llmt-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Grid selected={selected} onSelect={setSelected} />
          </div>
        </div>
      ))}
    </div>
  )
}
