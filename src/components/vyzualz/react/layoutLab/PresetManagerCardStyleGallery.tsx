import type { CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'

// ── PresetManagerCardStyleGallery ─────────────────────────────────────────
//
// Layout Lab / Template engine only, right rail → DESIGN tab. Five studies of the card the Preset Manager's
// preset list renders (today: an 80 px thumbnail, a name and the engine name). Each study also has to say whether
// the preset is SYSTEM or USER and carry badges. Badges use the real, reusable Badge component; the badge set is
// what a Preset Manager record already knows: its category and its three capability flags (camera, user media, 3D).

type Scope = 'SYSTEM' | 'USER'

interface CardSample {
  name: string
  engine: string
  scope: Scope
  tone: string
  badges: { label: string; tone: string }[]
  active?: boolean
  favorite?: boolean
}

const CAMERA = { label: 'Camera', tone: '#67f7ff' }
const MEDIA = { label: 'User Media', tone: '#61d6aa' }
const WORLD = { label: '3D', tone: '#b49bff' }

const SAMPLES: CardSample[] = [
  { name: 'CONDUIT', engine: 'Cinema 2.0', scope: 'USER', tone: '#4ac7db', badges: [{ label: 'Logo', tone: '#d8b95a' }, CAMERA, WORLD], active: true, favorite: true },
  { name: 'Afterhours', engine: 'Cinema 2.0', scope: 'SYSTEM', tone: '#b84fc9', badges: [{ label: 'Lasers', tone: '#d8b95a' }, CAMERA, WORLD, MEDIA] },
  { name: 'Fractures', engine: 'Canvas', scope: 'SYSTEM', tone: '#8de7ff', badges: [{ label: 'Fragments', tone: '#d8b95a' }, MEDIA] },
  { name: 'Spectrum Bloom', engine: 'Headliner', scope: 'USER', tone: '#ff8aa0', badges: [{ label: 'Camera FX', tone: '#d8b95a' }], favorite: true },
]

const toneStyle = (sample: CardSample) => ({ '--llpm-tone': sample.tone } as CSSProperties)

function Badges({ sample, limit = 3 }: { sample: CardSample; limit?: number }) {
  return (
    <>
      {sample.badges.slice(0, limit).map(badge => <Badge key={badge.label} label={badge.label} tone={badge.tone} />)}
      {sample.badges.length > limit && <span className="llpm-more">+{sample.badges.length - limit}</span>}
    </>
  )
}

function Heart({ sample }: { sample: CardSample }) {
  return sample.favorite ? <span className="llpm-heart" aria-hidden="true"><FavouriteIcon size={13} color="currentColor" /></span> : null
}

// ── 01 · Header Strip ─────────────────────────────────────────────────────────
// A strip across the top carries the engine on the left and the scope on the right; thumbnail, name and badges sit below.

function HeaderStripCards() {
  return (
    <div className="llpm-list">
      {SAMPLES.map(sample => (
        <article key={sample.name} className={`llpm-card llpm-strip${sample.active ? ' is-active' : ''}`} data-scope={sample.scope} style={toneStyle(sample)} data-preset-card="header-strip">
          <header className="llpm-strip-head">
            <span className="llpm-engine">{sample.engine}</span>
            <span className="llpm-scope" data-scope={sample.scope}>{sample.scope}</span>
          </header>
          <div className="llpm-strip-body">
            <span className="llpm-thumb" aria-hidden="true" />
            <span className="llpm-copy">
              <strong className="llpm-name">{sample.name}</strong>
              <span className="llpm-badges"><Badges sample={sample} /></span>
            </span>
            <Heart sample={sample} />
          </div>
        </article>
      ))}
    </div>
  )
}

// ── 02 · Scope Spine ──────────────────────────────────────────────────────────
// A vertical spine on the left edge reads the scope (cyan for USER, slate for SYSTEM) with the word set sideways.

function ScopeSpineCards() {
  return (
    <div className="llpm-list">
      {SAMPLES.map(sample => (
        <article key={sample.name} className={`llpm-card llpm-spine${sample.active ? ' is-active' : ''}`} data-scope={sample.scope} style={toneStyle(sample)} data-preset-card="scope-spine">
          <span className="llpm-spine-rail" data-scope={sample.scope}><span>{sample.scope}</span></span>
          <span className="llpm-thumb" aria-hidden="true" />
          <span className="llpm-copy">
            <strong className="llpm-name">{sample.name}</strong>
            <span className="llpm-engine">{sample.engine}</span>
            <span className="llpm-badges"><Badges sample={sample} limit={2} /></span>
          </span>
          <Heart sample={sample} />
        </article>
      ))}
    </div>
  )
}

// ── 03 · Poster ───────────────────────────────────────────────────────────────
// A wide thumbnail leads; the engine and scope float on it as labels, and the name and badges sit underneath.

function PosterCards() {
  return (
    <div className="llpm-poster-grid">
      {SAMPLES.map(sample => (
        <article key={sample.name} className={`llpm-card llpm-poster${sample.active ? ' is-active' : ''}`} data-scope={sample.scope} style={toneStyle(sample)} data-preset-card="poster">
          <span className="llpm-poster-art" aria-hidden="true">
            <span className="llpm-engine llpm-engine--float">{sample.engine}</span>
            <span className="llpm-scope llpm-scope--float" data-scope={sample.scope}>{sample.scope}</span>
          </span>
          <span className="llpm-poster-copy">
            <strong className="llpm-name">{sample.name}<Heart sample={sample} /></strong>
            <span className="llpm-badges"><Badges sample={sample} limit={2} /></span>
          </span>
        </article>
      ))}
    </div>
  )
}

// ── 04 · Footer Meta ──────────────────────────────────────────────────────────
// The production layout kept as is (thumbnail, then name); a footer under a hairline holds the engine, badges and scope.

function FooterMetaCards() {
  return (
    <div className="llpm-list">
      {SAMPLES.map(sample => (
        <article key={sample.name} className={`llpm-card llpm-footer${sample.active ? ' is-active' : ''}`} data-scope={sample.scope} style={toneStyle(sample)} data-preset-card="footer-meta">
          <div className="llpm-footer-main">
            <span className="llpm-thumb" aria-hidden="true" />
            <span className="llpm-copy">
              <strong className="llpm-name">{sample.name}</strong>
              <span className="llpm-badges"><Badges sample={sample} limit={2} /></span>
            </span>
            <Heart sample={sample} />
          </div>
          <footer className="llpm-footer-bar">
            <span className="llpm-engine">{sample.engine}</span>
            <span className="llpm-scope llpm-scope--text" data-scope={sample.scope}>{sample.scope}</span>
          </footer>
        </article>
      ))}
    </div>
  )
}

// ── 05 · Spec Sheet ───────────────────────────────────────────────────────────
// Engine and owner as labelled key/value lines (the same label-above-value reading as the Info tab), badges along the foot.

function SpecSheetCards() {
  return (
    <div className="llpm-list">
      {SAMPLES.map(sample => (
        <article key={sample.name} className={`llpm-card llpm-spec${sample.active ? ' is-active' : ''}`} data-scope={sample.scope} style={toneStyle(sample)} data-preset-card="spec-sheet">
          <span className="llpm-thumb" aria-hidden="true" />
          <span className="llpm-copy">
            <strong className="llpm-name">{sample.name}</strong>
            <span className="llpm-kv">
              <span className="llpm-kv-cell"><small>Engine</small><b>{sample.engine}</b></span>
              <span className="llpm-kv-cell"><small>Owner</small><b className="llpm-owner" data-scope={sample.scope}>{sample.scope}</b></span>
            </span>
            <span className="llpm-badges"><Badges sample={sample} limit={3} /></span>
          </span>
          <Heart sample={sample} />
        </article>
      ))}
    </div>
  )
}

export const PRESET_MANAGER_CARD_CONCEPTS = [
  { id: 'header-strip', title: '01 · Header Strip', blurb: 'Engine on the left and scope on the right in a strip across the top; thumbnail, name and badges below.', Cards: HeaderStripCards },
  { id: 'scope-spine', title: '02 · Scope Spine', blurb: 'A vertical spine on the left edge reads the scope; engine sits under the name, badges below it.', Cards: ScopeSpineCards },
  { id: 'poster', title: '03 · Poster', blurb: 'A wide thumbnail with the engine and scope floating on it; name and badges underneath. Two to a row.', Cards: PosterCards },
  { id: 'footer-meta', title: '04 · Footer Meta', blurb: 'The current thumbnail-and-name card with a footer under a hairline: engine on the left, scope on the right.', Cards: FooterMetaCards },
  { id: 'spec-sheet', title: '05 · Spec Sheet', blurb: 'Engine and owner as labelled key/value cells, the same reading as the Info tab, with badges along the foot.', Cards: SpecSheetCards },
] as const

export function PresetManagerCardStyleGallery() {
  return (
    <div className="llpm-gallery" aria-label="Preset Manager card mockups">
      {PRESET_MANAGER_CARD_CONCEPTS.map(concept => (
        <div key={concept.id} className="lldd-gallery-row" data-preset-card-concept={concept.id}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{concept.title}</span>
            <span className="lldd-gallery-blurb">{concept.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <concept.Cards />
          </div>
        </div>
      ))}
    </div>
  )
}
