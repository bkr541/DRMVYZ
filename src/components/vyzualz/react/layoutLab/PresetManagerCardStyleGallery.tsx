import type { CSSProperties } from 'react'
import { FavouriteIcon } from 'hugeicons-react'
import { Badge } from '../controls/Badge'
import { StatusBadge } from '../controls/StatusBadge'

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

// ── 06–10 · Flat rows ─────────────────────────────────────────────────────────
// The Lyric Manager's audio track card, reduced to what it really is: no card background or border, a hairline between rows, a small art tile,
// the title with a bare dot for "selected", a cyan secondary line, muted details and bare action icons. These studies use that card's own
// classes (`vz-track-row vz-track-row--list` and its children) so the look is the production one, then add what a preset needs: engine,
// SYSTEM/USER and badges.

const initials = (sample: CardSample) => sample.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
const toneVars = (sample: CardSample) => ({ '--vz-track-tone': sample.tone, '--llpm-tone': sample.tone } as CSSProperties)
const rowClass = (sample: CardSample) => `vz-track-row vz-track-row--list${sample.active ? ' vz-track-row--active' : ''}`

function SelectedDot({ sample }: { sample: CardSample }) {
  return sample.active ? (
    <span className="vz-track-row-selected-dot" title="Selected">
      <StatusBadge tone="selected"><span className="sr-only">Selected</span></StatusBadge>
    </span>
  ) : null
}

function FavoriteAction({ sample }: { sample: CardSample }) {
  return (
    <span className="vz-track-row-actions">
      <span className={`vz-track-action-btn llpm-flat-fav${sample.favorite ? ' is-on' : ''}`} aria-hidden="true"><FavouriteIcon size={14} color="currentColor" /></span>
    </span>
  )
}

function Art({ sample }: { sample: CardSample }) {
  return <div className="vz-track-row-art vz-track-row-art--list" aria-hidden="true"><span>{initials(sample)}</span></div>
}

// 06 · Track Row: the production row as is. Engine takes the cyan artist line, scope and category the muted details line, badges a line below.
function TrackRowCards() {
  return (
    <div className="llpm-flat-list">
      {SAMPLES.map(sample => (
        <div key={sample.name} className={rowClass(sample)} style={toneVars(sample)} data-scope={sample.scope} data-preset-card="track-row">
          <Art sample={sample} />
          <div className="vz-track-row-info">
            <div className="vz-track-row-title-line"><span className="vz-track-row-title">{sample.name}</span><SelectedDot sample={sample} /></div>
            <div className="vz-track-row-artist">{sample.engine}</div>
            <div className="vz-track-row-details"><span className="llpm-scope-text" data-scope={sample.scope}>{sample.scope}</span> · {sample.badges[0]?.label}</div>
            <div className="llpm-flat-badges"><Badges sample={sample} limit={3} /></div>
          </div>
          <FavoriteAction sample={sample} />
        </div>
      ))}
    </div>
  )
}

// 07 · Inline Meta: no art tile. Engine and scope share the one secondary line, badges sit bare at the end of the title line.
function InlineMetaCards() {
  return (
    <div className="llpm-flat-list">
      {SAMPLES.map(sample => (
        <div key={sample.name} className={rowClass(sample)} style={toneVars(sample)} data-scope={sample.scope} data-preset-card="inline-meta">
          <div className="vz-track-row-info">
            <div className="vz-track-row-title-line">
              <span className="vz-track-row-title">{sample.name}</span>
              <SelectedDot sample={sample} />
              <span className="llpm-flat-badges llpm-flat-badges--bare llpm-flat-badges--end"><Badges sample={sample} limit={2} /></span>
            </div>
            <div className="vz-track-row-artist">{sample.engine} · <span className="llpm-scope-text" data-scope={sample.scope}>{sample.scope}</span></div>
          </div>
          <FavoriteAction sample={sample} />
        </div>
      ))}
    </div>
  )
}

// 08 · Scope Rail: the production "selected" bar, reused as the scope marker on every row (cyan for USER, slate for SYSTEM).
function ScopeRailCards() {
  return (
    <div className="llpm-flat-list">
      {SAMPLES.map(sample => (
        <div key={sample.name} className={`${rowClass(sample)} llpm-flat-rail`} style={toneVars(sample)} data-scope={sample.scope} data-preset-card="scope-rail">
          <Art sample={sample} />
          <div className="vz-track-row-info">
            <div className="vz-track-row-title-line"><span className="vz-track-row-title">{sample.name}</span><SelectedDot sample={sample} /></div>
            <div className="vz-track-row-artist">{sample.engine}</div>
            <div className="vz-track-row-details"><span className="llpm-scope-text" data-scope={sample.scope}>{sample.scope}</span> preset</div>
            <div className="llpm-flat-badges"><Badges sample={sample} limit={2} /></div>
          </div>
          <FavoriteAction sample={sample} />
        </div>
      ))}
    </div>
  )
}

// 09 · Split Line: the scope reads as a bare right-aligned word on the title line; badges are plain coloured text, no capsule.
function SplitLineCards() {
  return (
    <div className="llpm-flat-list">
      {SAMPLES.map(sample => (
        <div key={sample.name} className={rowClass(sample)} style={toneVars(sample)} data-scope={sample.scope} data-preset-card="split-line">
          <Art sample={sample} />
          <div className="vz-track-row-info">
            <div className="vz-track-row-title-line llpm-flat-split">
              <span className="vz-track-row-title">{sample.name}</span>
              <SelectedDot sample={sample} />
              <span className="llpm-scope-text llpm-flat-split-scope" data-scope={sample.scope}>{sample.scope}</span>
            </div>
            <div className="vz-track-row-artist">{sample.engine}</div>
            <div className="llpm-flat-badges llpm-flat-badges--bare"><Badges sample={sample} limit={3} /></div>
          </div>
          <FavoriteAction sample={sample} />
        </div>
      ))}
    </div>
  )
}

// 10 · Key Value: the Info tab's reading in a row. Engine and owner are label-above-value pairs with no underline or box; bare badges below.
function KeyValueRowCards() {
  return (
    <div className="llpm-flat-list">
      {SAMPLES.map(sample => (
        <div key={sample.name} className={rowClass(sample)} style={toneVars(sample)} data-scope={sample.scope} data-preset-card="key-value-row">
          <Art sample={sample} />
          <div className="vz-track-row-info">
            <div className="vz-track-row-title-line"><span className="vz-track-row-title">{sample.name}</span><SelectedDot sample={sample} /></div>
            <div className="llpm-flat-kv">
              <span><small>Engine</small><b>{sample.engine}</b></span>
              <span><small>Owner</small><b className="llpm-scope-text" data-scope={sample.scope}>{sample.scope}</b></span>
            </div>
            <div className="llpm-flat-badges llpm-flat-badges--bare"><Badges sample={sample} limit={3} /></div>
          </div>
          <FavoriteAction sample={sample} />
        </div>
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
  { id: 'track-row', title: '06 · Track Row', blurb: 'The Lyric Manager audio track card as is: no background or border, a hairline between rows. Engine on the cyan line, scope and category on the muted line, badges below.', Cards: TrackRowCards },
  { id: 'inline-meta', title: '07 · Inline Meta', blurb: 'No art tile. Engine and scope share one secondary line, and the badges sit bare at the end of the title line.', Cards: InlineMetaCards },
  { id: 'scope-rail', title: '08 · Scope Rail', blurb: 'The track card\'s selected bar reused as a scope marker on every row: cyan for USER, slate for SYSTEM.', Cards: ScopeRailCards },
  { id: 'split-line', title: '09 · Split Line', blurb: 'The scope as a bare word at the right of the title line; badges are plain coloured text with no capsule.', Cards: SplitLineCards },
  { id: 'key-value-row', title: '10 · Key Value Row', blurb: 'Engine and owner as label-above-value pairs with no underline or box, the Info tab\'s reading inside a flat row.', Cards: KeyValueRowCards },
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
