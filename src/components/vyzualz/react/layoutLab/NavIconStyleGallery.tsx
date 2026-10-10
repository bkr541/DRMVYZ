import type { ReactNode } from 'react'
import {
  CloudMarkGlyph,
  DeckHardwareGlyph,
  HexSealGlyph,
  IsometricStackGlyph,
  NavIconSvg,
  SignalStarGlyph,
  type GlyphProps,
  type NavIconKind,
} from '../../navIcons'

/** The four destinations of the left navigation bar, in the order the sidebar lists them. */
const NAV_ICONS: ReadonlyArray<{ kind: NavIconKind; label: string }> = [
  { kind: 'react', label: 'React' },
  { kind: 'show', label: 'Show Manager' },
  { kind: 'lyrics', label: 'Lyric Manager' },
  { kind: 'media', label: 'Media Manager' },
]

interface Concept {
  id: string
  title: string
  blurb: string
  glyph: (props: GlyphProps) => ReactNode
}

const CONCEPTS: readonly Concept[] = [
  { id: 'signal-star', title: '01 · Signal Star', blurb: 'Clean line icons with one accent: the DVYDRM logo’s four-point star, set where each destination does its work (the live peak, a cue caret, the playhead, the viewfinder).', glyph: SignalStarGlyph },
  { id: 'cloud-mark', title: '02 · Cloud Mark', blurb: 'The cloud from the logo as the container for all four, so the set reads as one family and as DRMVYZ before any symbol is read.', glyph: CloudMarkGlyph },
  { id: 'deck-hardware', title: '03 · Deck Hardware', blurb: 'Each destination drawn as the DJ gear it behaves like: a jog wheel with a cue notch, a deck screen, a pad grid with one pad lit, a moving-head fixture throwing a beam.', glyph: DeckHardwareGlyph },
  { id: 'isometric-stack', title: '04 · Isometric Stack', blurb: 'Everything sits on one tilted plane: layered planes under a waveform, a rig with beams, cue lines laid on the plane, a cascade of frames.', glyph: IsometricStackGlyph },
  { id: 'hex-seal', title: '05 · Hex Seal', blurb: 'The hexagon of the Rekordbox and DRMVYZ marks with a solid symbol inside and a single lit vertex; the whole seal can fill when active.', glyph: HexSealGlyph },
]

/** Layout Lab · Template · Design: five concepts for the left navigation icons, one row each, shown idle and with React active. */
export function NavIconStyleGallery() {
  return (
    <div className="llni-gallery" aria-label="Left navigation icon concepts">
      {CONCEPTS.map(concept => (
        <section key={concept.id} className="llni-concept" data-testid={`nav-icon-concept-${concept.id}`}>
          <div className="llni-copy"><span>{concept.title}</span><p>{concept.blurb}</p></div>
          <div className={`llni-stage llni-stage--${concept.id}`}>
            {NAV_ICONS.map((icon, index) => (
              <div key={icon.kind} className={`llni-item${index === 0 ? ' is-active' : ''}`} data-nav-icon={icon.kind}>
                <span className="llni-icon"><NavIconSvg size={32}>{concept.glyph({ kind: icon.kind })}</NavIconSvg></span>
                <span className="llni-label">{icon.label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
