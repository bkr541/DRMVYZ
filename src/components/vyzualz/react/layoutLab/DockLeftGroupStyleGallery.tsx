import { useState, type CSSProperties, type ReactNode } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'

// ── DockLeftGroupStyleGallery ────────────────────────────────────────────
//
// Layout Lab / Template, middle section. Six concepts for the audio dock's leftmost card: play / pause, Add or Replace Track,
// the track's title and artist, and the volume control. Every concept is drawn at the production card's footprint (314 × 96)
// with a 12px inset, so what fits here fits in the dock, and every one lays its parts on a shared 4px grid with one gutter
// (12px between columns, 8–12px between rows) so the spacing is even. A control bar drives all six at once (track loaded /
// empty, playing / paused); the volume slider and play button are live in each. Presentation only — nothing is wired to the
// audio engine or a store.

interface DockState {
  loaded: boolean
  playing: boolean
  volume: number
  setPlaying: (value: boolean) => void
  setVolume: (value: number) => void
}

const TRACK_TITLE = 'Midnight Run'
const TRACK_ARTIST = 'DVYDRM'
const EMPTY_TITLE = 'No track loaded'
const EMPTY_ARTIST = 'Load a track to begin'
const PROGRESS = 0.38

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

const PlayGlyph = ({ size }: { size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
)
const PauseGlyph = ({ size }: { size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
)
const PlusGlyph = ({ size = 14 }: { size?: number }) => (
  <svg {...svgProps} width={size} height={size}><path d="M12 5v14M5 12h14" /></svg>
)
const VolumeGlyph = ({ size = 14 }: { size?: number }) => (
  <svg {...svgProps} width={size} height={size}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" fill="currentColor" stroke="none" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)

const dbLabel = (volume: number) => (volume < 0.001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`)
const addLabel = (loaded: boolean) => (loaded ? 'Replace Track' : 'Add Track')

function PlayButton({ state, className = '', size = 22 }: { state: DockState; className?: string; size?: number }) {
  const label = state.playing ? 'Pause' : 'Play'
  return (
    <button
      type="button"
      className={`lldl-play ${className}`}
      aria-label={label}
      title={label}
      disabled={!state.loaded}
      onClick={() => state.setPlaying(!state.playing)}
    >
      {state.playing ? <PauseGlyph size={size} /> : <PlayGlyph size={size} />}
    </button>
  )
}

function AddButton({ state, className = '', children }: { state: DockState; className?: string; children?: ReactNode }) {
  const label = addLabel(state.loaded)
  return (
    <button type="button" className={`lldl-key ${className}`} aria-label={label} title={label}>
      <PlusGlyph />
      {children}
    </button>
  )
}

function TrackInfo({ state, className = '' }: { state: DockState; className?: string }) {
  return (
    <div className={`lldl-info ${className}`}>
      <span className="lldl-title">{state.loaded ? TRACK_TITLE : EMPTY_TITLE}</span>
      <span className="lldl-artist">{state.loaded ? TRACK_ARTIST : EMPTY_ARTIST}</span>
    </div>
  )
}

function Volume({ state, className = '', showDb = true, showIcon = true }: {
  state: DockState
  className?: string
  showDb?: boolean
  showIcon?: boolean
}) {
  return (
    <div className={`lldl-volume ${className}`}>
      {showIcon && <span className="lldl-vol-icon"><VolumeGlyph /></span>}
      <BubbleRevealSlider
        type="range"
        className="lldl-vol-slider"
        aria-label="Track volume"
        title={`Track volume: ${Math.round(state.volume * 100)}%`}
        min={0}
        max={1}
        step={0.005}
        value={state.volume}
        onChange={event => state.setVolume(parseFloat(event.target.value))}
        style={{ '--pct': `${Math.round(state.volume * 100)}%` } as CSSProperties}
      />
      {showDb && <span className="lldl-db">{dbLabel(state.volume)}</span>}
    </div>
  )
}

/** The elapsed / total readout with a thin progress line, used by the concepts that have the room for it. */
function Progress({ state }: { state: DockState }) {
  return (
    <div className="lldl-progress" aria-label="Track position">
      <span>{state.loaded ? '1:26' : '0:00'}</span>
      <span className="lldl-progress-bar" style={{ '--pct': `${state.loaded ? PROGRESS * 100 : 0}%` } as CSSProperties} />
      <span>{state.loaded ? '3:48' : '0:00'}</span>
    </div>
  )
}

/** A progress ring drawn around the play tile in concept 03. */
function ProgressRing({ loaded }: { loaded: boolean }) {
  const radius = 29
  const circumference = 2 * Math.PI * radius
  return (
    <svg className="lldl-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="lldl-ring-track" cx="32" cy="32" r={radius} />
      <circle
        className="lldl-ring-fill"
        cx="32"
        cy="32"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (loaded ? PROGRESS : 0))}
      />
    </svg>
  )
}

// ── Concepts ──────────────────────────────────────────────────────────────

/** 01 — the production arrangement, tidied: round play on the left, info over volume on the right, Add as a corner key. */
function CoverSlot({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c1">
      <PlayButton state={state} className="lldl-play--ring" size={24} />
      <div className="lldl-c1-body">
        <TrackInfo state={state} />
        <Volume state={state} />
      </div>
      <AddButton state={state} className="lldl-c1-add" />
    </div>
  )
}

/** 02 — two full-width rows: transport + info + add above, volume below, all on one left edge. */
function TransportRail({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c2">
      <div className="lldl-c2-top">
        <PlayButton state={state} className="lldl-play--solid" size={18} />
        <TrackInfo state={state} />
        <AddButton state={state} />
      </div>
      <Volume state={state} />
    </div>
  )
}

/** 03 — a large rounded play tile wrapped in a progress ring; info and volume to its right, a labelled Add pill at the end. */
function ProgressTile({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c3">
      <div className="lldl-c3-tile">
        <ProgressRing loaded={state.loaded} />
        <PlayButton state={state} className="lldl-play--tile" size={22} />
      </div>
      <div className="lldl-c3-body">
        <TrackInfo state={state} />
        <div className="lldl-c3-row">
          <Volume state={state} showDb={false} />
          <AddButton state={state} className="lldl-pill">
            <span>{state.loaded ? 'Replace' : 'Add'}</span>
          </AddButton>
        </div>
      </div>
    </div>
  )
}

/** 04 — a strict 2 × 2 grid: play and Add are matching square keys in the first column, info and volume align to their rows. */
function SplitKeys({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c4">
      <PlayButton state={state} className="lldl-play--key" size={16} />
      <TrackInfo state={state} />
      <AddButton state={state} />
      <Volume state={state} />
    </div>
  )
}

/** 05 — one compact transport line with a divider, plus a position line underneath. */
function CompactLine({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c5">
      <div className="lldl-c5-line">
        <PlayButton state={state} className="lldl-play--solid" size={18} />
        <TrackInfo state={state} />
        <span className="lldl-divider" aria-hidden="true" />
        <Volume state={state} showDb={false} />
        <AddButton state={state} />
      </div>
      <Progress state={state} />
    </div>
  )
}

/** 06 — centred title above an evenly spaced control strip: Add key, play, volume. */
function CenteredStrip({ state }: { state: DockState }) {
  return (
    <div className="lldl-card lldl-c6">
      <TrackInfo state={state} className="lldl-info--center" />
      <div className="lldl-c6-strip">
        <AddButton state={state} />
        <PlayButton state={state} className="lldl-play--solid" size={18} />
        <Volume state={state} showDb={false} />
      </div>
    </div>
  )
}

const CONCEPTS = [
  { id: 'cover-slot', title: '01 · Cover Slot', blurb: 'Round play ring on the left, title over volume on the right, Add as a corner key.', Concept: CoverSlot },
  { id: 'transport-rail', title: '02 · Transport Rail', blurb: 'Two full-width rows: play, track info and Add above; volume with its dB readout below.', Concept: TransportRail },
  { id: 'progress-tile', title: '03 · Progress Tile', blurb: 'A rounded play tile wrapped in a progress ring, with a labelled Add pill beside the volume.', Concept: ProgressTile },
  { id: 'split-keys', title: '04 · Split Keys', blurb: 'A strict 2 × 2 grid: play and Add are matching keys, info and volume align to their rows.', Concept: SplitKeys },
  { id: 'compact-line', title: '05 · Compact Line', blurb: 'One transport line with a divider, and a position line with elapsed and total time beneath.', Concept: CompactLine },
  { id: 'centered-strip', title: '06 · Centered Strip', blurb: 'Centred title over an evenly spaced strip: Add key, play, volume.', Concept: CenteredStrip },
] as const

function Segmented({ label, value, options, onChange }: {
  label: string
  value: string
  options: ReadonlyArray<{ id: string; label: string }>
  onChange: (id: string) => void
}) {
  return (
    <div className="llhs-ctl" role="group" aria-label={label}>
      <span className="llhs-ctl-label">{label}</span>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          className={`llhs-ctl-btn${value === option.id ? ' is-on' : ''}`}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function DockLeftGroupStyleGallery() {
  const [loaded, setLoaded] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(0.82)
  const state: DockState = { loaded, playing: loaded && playing, volume, setPlaying, setVolume }

  return (
    <div className="llcm-gallery lldd-gallery lldl-gallery" aria-label="Audio dock left group concepts">
      <div className="llhs-controls" aria-label="Dock states">
        <Segmented
          label="Track"
          value={loaded ? 'loaded' : 'empty'}
          onChange={id => setLoaded(id === 'loaded')}
          options={[{ id: 'loaded', label: 'Loaded' }, { id: 'empty', label: 'Empty' }]}
        />
        <Segmented
          label="Playback"
          value={playing ? 'playing' : 'paused'}
          onChange={id => setPlaying(id === 'playing')}
          options={[{ id: 'playing', label: 'Playing' }, { id: 'paused', label: 'Paused' }]}
        />
      </div>
      <div className="lldl-grid">
        {CONCEPTS.map(({ id, title, blurb, Concept }) => (
          <section key={id} className="lldd-gallery-row" data-testid={`dock-left-concept-${id}`}>
            <div className="lldd-gallery-copy">
              <span className="lldd-gallery-title">{title}</span>
              <span className="lldd-gallery-blurb">{blurb}</span>
            </div>
            <div className="lldl-stage">
              <Concept state={state} />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
