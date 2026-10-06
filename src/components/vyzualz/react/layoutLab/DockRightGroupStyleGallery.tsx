import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'

// ── DockRightGroupStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template, middle section, under the left-group concepts. Six concepts for the audio dock's rightmost card: the BPM
// readout with its drag-to-scrub bar, and the four action keys (Tap tempo, BPM Sync, Cue, Audio source & Rekordbox). The production
// card also keeps two empty keys reserved for future dock actions; concept 01 shows them as dashed slots, the other five leave
// them out. Every concept is drawn at the production card's footprint (314 × 96) with a 12px inset, on the same 4px grid and
// 8–12px gutters as the left-group concepts, so what fits here fits in the dock. A control bar drives all six at once (track
// loaded / empty, BPM Sync on / off, analyzed / overridden tempo); the BPM bar, Sync and Tap keys are live in each. Presentation
// only — nothing is wired to the audio engine or a store.

const ANALYZED_BPM = 126
const OVERRIDE_BPM = 128.5
const BPM_MIN = 40
const BPM_MAX = 300

interface DockRightState {
  loaded: boolean
  bpm: number
  sync: boolean
  tapped: boolean
  setBpm: (value: number) => void
  setSync: (value: boolean) => void
  tap: () => void
}

type KeyKind = 'tap' | 'sync' | 'cue' | 'source'

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

/** The metronome glyph the production Tap key uses. */
const TapGlyph = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M16,21c0.3,0,0.6-0.1,0.8-0.4l13-17c0.3-0.4,0.3-1.1-0.2-1.4c-0.4-0.3-1.1-0.3-1.4,0.2l-5.7,7.5l-1-4.8 c-0.4-1.8-2-3.1-3.8-3.1h-3.4c-1.8,0-3.4,1.2-3.8,3L5.8,25.5c-0.3,1.1,0,2.2,0.7,3.1C7.2,29.5,8.2,30,9.3,30h13.3 c1.1,0,2.2-0.5,2.9-1.4c0.7-0.9,0.9-2,0.7-3.1l-2.5-9.7c-0.1-0.5-0.7-0.9-1.2-0.7c-0.5,0.1-0.9,0.7-0.7,1.2l1.5,5.8H8.6l3.8-16.5 c0.2-0.9,1-1.5,1.8-1.5h3.4c0.9,0,1.7,0.6,1.8,1.5l1.4,6.5l-5.6,7.4c-0.3,0.4-0.3,1.1,0.2,1.4C15.6,20.9,15.8,21,16,21z" />
    <path d="M15,8h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,8,15,8z" />
    <path d="M15,11h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,11,15,11z" />
    <path d="M15,14h2c0.6,0,1-0.4,1-1s-0.4-1-1-1h-2c-0.6,0-1,0.4-1,1S14.4,14,15,14z" />
  </svg>
)
const SyncGlyph = ({ size = 16 }: { size?: number }) => (
  <svg {...svgProps} width={size} height={size}>
    <path d="M10.5 13.5l3-3M7.2 16.8l-1 1a3.4 3.4 0 0 1-4.8-4.8l3.2-3.2a3.4 3.4 0 0 1 4.8 0M16.8 7.2l1-1a3.4 3.4 0 0 1 4.8 4.8l-3.2 3.2a3.4 3.4 0 0 1-4.8 0" />
  </svg>
)
const CueGlyph = ({ size = 16 }: { size?: number }) => (
  <svg {...svgProps} width={size} height={size}><path d="M5 21V4m0 1h11l-2.5 3L16 11H5" /></svg>
)
const SourceGlyph = ({ size = 16 }: { size?: number }) => (
  <svg {...svgProps} width={size} height={size}>
    <path d="M4 7h10M4 17h6M18 17h2M14 7h6" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="12" cy="17" r="2" />
  </svg>
)

const KEY_META: Record<KeyKind, { glyph: (size: number) => ReactNode; text: string }> = {
  tap: { glyph: size => <TapGlyph size={size} />, text: 'Tap' },
  sync: { glyph: size => <SyncGlyph size={size} />, text: 'Sync' },
  cue: { glyph: size => <CueGlyph size={size} />, text: 'Cue' },
  source: { glyph: size => <SourceGlyph size={size} />, text: 'Source' },
}

const bpmText = (state: DockRightState) => (state.loaded ? state.bpm.toFixed(2) : '--')
const isOverride = (state: DockRightState) => state.loaded && Math.abs(state.bpm - ANALYZED_BPM) > 0.004
const fillPct = (state: DockRightState) => (state.loaded ? ((state.bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100 : 0)

/** One of the four action keys. `labelled` adds the key's short name beside the icon. */
function Key({ kind, state, className = '', labelled = false, size = 16 }: {
  kind: KeyKind
  state: DockRightState
  className?: string
  labelled?: boolean
  size?: number
}) {
  const meta = KEY_META[kind]
  const common = `lldr-key lldr-key--${kind} ${className}`
  const body = (
    <>
      {meta.glyph(size)}
      {labelled && <span className="lldr-key-text">{meta.text}</span>}
    </>
  )
  if (kind === 'sync') {
    return (
      <button
        type="button"
        className={`${common}${state.sync ? ' is-on' : ''}`}
        aria-label={`BPM Sync: ${state.sync ? 'ON' : 'OFF'}`}
        aria-pressed={state.sync}
        title={`BPM Sync: ${state.sync ? 'ON' : 'OFF'}`}
        onClick={() => state.setSync(!state.sync)}
      >
        {body}
        {state.sync && <span className="lldr-dot" aria-hidden="true" />}
      </button>
    )
  }
  if (kind === 'tap') {
    return (
      <button
        type="button"
        className={`${common}${state.tapped ? ' is-pulse' : ''}`}
        aria-label="Tap tempo"
        title="Tap tempo"
        disabled={!state.loaded}
        onClick={state.tap}
      >
        {body}
      </button>
    )
  }
  if (kind === 'cue') {
    return (
      <button type="button" className={common} aria-label="Set cue point here" title="Set cue point here" disabled={!state.loaded}>
        {body}
      </button>
    )
  }
  return (
    <button type="button" className={common} aria-label="Audio source & Rekordbox" title="Audio source & Rekordbox">
      {body}
    </button>
  )
}

/** The empty keys the production dock keeps reserved for future actions. */
const GhostKey = () => <span className="lldr-ghost" aria-hidden="true" />

/** `BPM` label and value on one line, with the reset arrow when the tempo is overridden. */
function Readout({ state, className = '' }: { state: DockRightState; className?: string }) {
  return (
    <div className={`lldr-readout ${className}`}>
      <span className="lldr-label">BPM</span>
      <span className="lldr-value" aria-label="Current BPM">{bpmText(state)}</span>
      {isOverride(state) && (
        <button type="button" className="lldr-reset" aria-label="Reset to analyzed BPM" title={`Reset to analyzed BPM (${ANALYZED_BPM.toFixed(2)})`} onClick={() => state.setBpm(ANALYZED_BPM)}>
          ↺
        </button>
      )}
    </div>
  )
}

/** The drag-to-scrub BPM bar over the 40–300 range. */
function Scrub({ state, className = '' }: { state: DockRightState; className?: string }) {
  return (
    <BubbleRevealSlider
      type="range"
      className={`lldr-scrub ${className}`}
      aria-label="BPM"
      title={state.loaded ? `BPM ${state.bpm.toFixed(2)}` : 'No track loaded'}
      min={BPM_MIN}
      max={BPM_MAX}
      step={0.01}
      value={state.loaded ? state.bpm : BPM_MIN}
      disabled={!state.loaded}
      onChange={event => state.setBpm(parseFloat(event.target.value))}
      style={{ '--pct': `${fillPct(state)}%` } as CSSProperties}
    />
  )
}

// ── Concepts ──────────────────────────────────────────────────────────────

/** 01 — the production arrangement, tidied: BPM block on the left, a 3 × 2 key matrix on the right with the two reserved slots shown as dashed cells. */
function KeyMatrix({ state }: { state: DockRightState }) {
  return (
    <div className="lldl-card lldr-c1">
      <div className="lldr-c1-bpm">
        <Readout state={state} />
        <Scrub state={state} />
      </div>
      <GhostKey />
      <Key kind="tap" state={state} />
      <Key kind="sync" state={state} />
      <GhostKey />
      <Key kind="cue" state={state} />
      <Key kind="source" state={state} />
    </div>
  )
}

/** 02 — one row of readout and four keys, then a full-width scrub bar with its 40 and 300 end marks. */
function ScrubRail({ state }: { state: DockRightState }) {
  return (
    <div className="lldl-card lldr-c2">
      <div className="lldr-c2-top">
        <Readout state={state} />
        <Key kind="tap" state={state} />
        <Key kind="sync" state={state} />
        <Key kind="cue" state={state} />
        <Key kind="source" state={state} />
      </div>
      <div className="lldr-c2-rail">
        <Scrub state={state} />
        <div className="lldr-ends" aria-hidden="true"><span>{BPM_MIN}</span><span>{BPM_MAX}</span></div>
      </div>
    </div>
  )
}

/** 03 — the readout and bar on the left; a 2 × 2 block of labelled keys on the right so each action names itself. */
function LabelledKeys({ state }: { state: DockRightState }) {
  return (
    <div className="lldl-card lldr-c3">
      <div className="lldr-c3-bpm">
        <Readout state={state} className="lldr-readout--large" />
        <Scrub state={state} />
      </div>
      <Key kind="tap" state={state} labelled size={14} />
      <Key kind="sync" state={state} labelled size={14} />
      <Key kind="cue" state={state} labelled size={14} />
      <Key kind="source" state={state} labelled size={14} />
    </div>
  )
}

/** 04 — readout with an analyzed / override chip, the scrub bar, and the four keys fused into one segmented toolbar. */
function SegmentedToolbar({ state }: { state: DockRightState }) {
  const override = isOverride(state)
  return (
    <div className="lldl-card lldr-c4">
      <div className="lldr-c4-top">
        <Readout state={state} />
        <span className={`lldr-chip${override ? ' is-override' : ''}`} title={override ? `Analyzed ${ANALYZED_BPM.toFixed(2)} BPM` : undefined}>
          {state.loaded ? (override ? 'Override' : 'Analyzed') : 'No track'}
        </span>
      </div>
      <Scrub state={state} />
      <div className="lldr-c4-bar" role="group" aria-label="Dock actions">
        <Key kind="tap" state={state} />
        <Key kind="sync" state={state} />
        <Key kind="cue" state={state} />
        <Key kind="source" state={state} />
      </div>
    </div>
  )
}

/** 05 — BPM Sync is the hero: a wide labelled toggle beside the readout, with the scrub bar and the three other keys on the second row. */
function SyncHero({ state }: { state: DockRightState }) {
  return (
    <div className="lldl-card lldr-c5">
      <Readout state={state} />
      <button
        type="button"
        className={`lldr-hero${state.sync ? ' is-on' : ''}`}
        aria-label={`BPM Sync: ${state.sync ? 'ON' : 'OFF'}`}
        aria-pressed={state.sync}
        title={`BPM Sync: ${state.sync ? 'ON' : 'OFF'}`}
        onClick={() => state.setSync(!state.sync)}
      >
        <SyncGlyph size={15} />
        <span className="lldr-hero-text"><strong>Sync</strong><em>{state.sync ? 'On' : 'Off'}</em></span>
        {state.sync && <span className="lldr-dot" aria-hidden="true" />}
      </button>
      <Scrub state={state} />
      <div className="lldr-c5-keys">
        <Key kind="tap" state={state} />
        <Key kind="cue" state={state} />
        <Key kind="source" state={state} />
      </div>
    </div>
  )
}

/** 06 — centred readout over its scrub bar, then four evenly spaced keys centred beneath. */
function CenteredReadout({ state }: { state: DockRightState }) {
  return (
    <div className="lldl-card lldr-c6">
      <Readout state={state} className="lldr-readout--center" />
      <Scrub state={state} />
      <div className="lldr-c6-strip">
        <Key kind="tap" state={state} />
        <Key kind="sync" state={state} />
        <Key kind="cue" state={state} />
        <Key kind="source" state={state} />
      </div>
    </div>
  )
}

const CONCEPTS = [
  { id: 'key-matrix', title: '01 · Key Matrix', blurb: 'The production layout, tidied: BPM on the left and a 3 × 2 key matrix, with the two reserved slots shown dashed.', Concept: KeyMatrix },
  { id: 'scrub-rail', title: '02 · Scrub Rail', blurb: 'Readout and all four keys on one row; a full-width scrub bar with its 40 and 300 end marks underneath.', Concept: ScrubRail },
  { id: 'labelled-keys', title: '03 · Labelled Keys', blurb: 'Readout and bar on the left; a 2 × 2 block of keys that each carry their name beside the icon.', Concept: LabelledKeys },
  { id: 'segmented-toolbar', title: '04 · Segmented Toolbar', blurb: 'Readout with an analyzed / override chip, the scrub bar, and the four keys fused into one toolbar.', Concept: SegmentedToolbar },
  { id: 'sync-hero', title: '05 · Sync Hero', blurb: 'BPM Sync as a wide labelled toggle beside the readout; scrub bar and the other three keys below.', Concept: SyncHero },
  { id: 'centered-readout', title: '06 · Centered Readout', blurb: 'Centred readout over its scrub bar, then four evenly spaced keys centred beneath.', Concept: CenteredReadout },
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

export function DockRightGroupStyleGallery() {
  const [loaded, setLoaded] = useState(true)
  const [bpm, setBpm] = useState(ANALYZED_BPM)
  const [sync, setSync] = useState(true)
  const [tapped, setTapped] = useState(false)
  const tapTimer = useRef<number | null>(null)
  useEffect(() => () => { if (tapTimer.current !== null) window.clearTimeout(tapTimer.current) }, [])

  const tap = () => {
    setTapped(true)
    if (tapTimer.current !== null) window.clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => setTapped(false), 160)
  }
  const state: DockRightState = { loaded, bpm, sync, tapped, setBpm, setSync, tap }

  return (
    <div className="llcm-gallery lldd-gallery lldl-gallery lldr-gallery" aria-label="Audio dock right group concepts">
      <div className="llhs-controls" aria-label="Dock right group states">
        <Segmented
          label="Track"
          value={loaded ? 'loaded' : 'empty'}
          onChange={id => setLoaded(id === 'loaded')}
          options={[{ id: 'loaded', label: 'Loaded' }, { id: 'empty', label: 'Empty' }]}
        />
        <Segmented
          label="BPM Sync"
          value={sync ? 'on' : 'off'}
          onChange={id => setSync(id === 'on')}
          options={[{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }]}
        />
        <Segmented
          label="Tempo"
          value={Math.abs(bpm - ANALYZED_BPM) > 0.004 ? 'override' : 'analyzed'}
          onChange={id => setBpm(id === 'override' ? OVERRIDE_BPM : ANALYZED_BPM)}
          options={[{ id: 'analyzed', label: 'Analyzed' }, { id: 'override', label: 'Override' }]}
        />
      </div>
      <div className="lldl-grid">
        {CONCEPTS.map(({ id, title, blurb, Concept }) => (
          <section key={id} className="lldd-gallery-row" data-testid={`dock-right-concept-${id}`}>
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
