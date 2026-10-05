import { useState, type ReactNode } from 'react'
import { Delete02Icon, SubtitleIcon } from 'hugeicons-react'
import { HeaderControlGroup } from '../../layout/HeaderControlGroup'
import { HeaderIconKey } from '../../layout/HeaderIconKey'
import { SaveActiveGlyph, SaveGlyph } from '../../layout/HeaderGlyphs'
import { BlackoutIcon, OutputArmIcon, RevealIcon } from '../ReactGlobalOutputControls'

// ── HeaderStatusStyleGallery ─────────────────────────────────────────────
//
// Layout Lab / Cinema engine, middle visualizer. Three concepts for the cluster that
// sits at the right of every page header (React, Media Manager, Lyric Manager, Show
// Manager): the Track Timeline Visualizer button, the save state ("Saved"), the app's
// CPU readout, the loading indicator and the profile icon. Each concept draws all of
// them in a different visual language — separate chips, one segmented strip, and open
// "telemetry" readouts — with a different loading treatment (ring, dots, sweep line),
// so the styles can be compared like for like in the same mock header. The mock header
// also carries the page's real centred control group (the production HeaderControlGroup
// with that page's keys), so the cluster can be judged next to the buttons it sits beside.
// A control bar above drives every concept at once (page, save state, idle / loading,
// CPU level, timeline button state) so each state can be judged.
// Presentation only — nothing is wired to a store or page.

type SaveState = 'saved' | 'saving' | 'unsaved'
type CpuLevel = 'low' | 'medium' | 'high'
type TimelineState = 'ready' | 'analyzing' | 'empty'
type HeaderPage = 'react' | 'media' | 'lyric' | 'show'

/** The Track Timeline glyph (two lanes with a dash row between) redrawn as a 1.7px line so it matches the rest of the set. */
const TimelineGlyph = () => (
  <svg {...svgProps} width="16" height="16">
    <rect x="3.5" y="3.5" width="17" height="5" rx="1.5" /><path d="M7 6h10" />
    <path d="M3.5 12h3.5M10.25 12h3.5M17 12h3.5" />
    <rect x="3.5" y="15.5" width="17" height="5" rx="1.5" /><path d="M7 18h10" />
  </svg>
)

const TIMELINE_LABEL = 'Track Timeline Visualizer'

const SAVE_LABEL: Record<SaveState, string> = { saved: 'Saved 10:44 AM', saving: 'Saving…', unsaved: 'Unsaved' }
const CPU_PERCENT: Record<CpuLevel, number> = { low: 4, medium: 38, high: 86 }

// Every icon in the mock headers — the page's control group and the whole status cluster — is one family: a 16px glyph drawn
// as a 1.7px rounded line in the surrounding ink (the control group's HeaderIconKey style), so they read as one set.
const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

interface StatusState {
  save: SaveState
  busy: boolean
  cpu: CpuLevel
  timeline: TimelineState
  page: HeaderPage
}

interface ControlBarProps extends StatusState {
  setSave: (value: SaveState) => void
  setBusy: (value: boolean) => void
  setCpu: (value: CpuLevel) => void
  setTimeline: (value: TimelineState) => void
  setPage: (value: HeaderPage) => void
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: ReadonlyArray<{ id: T; label: string }>
  onChange: (value: T) => void
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

function ControlBar({ save, busy, cpu, timeline, page, setSave, setBusy, setCpu, setTimeline, setPage }: ControlBarProps) {
  return (
    <div className="llhs-controls" aria-label="Status states">
      <Segmented<HeaderPage>
        label="Page"
        value={page}
        onChange={setPage}
        options={[{ id: 'react', label: 'React' }, { id: 'media', label: 'Media' }, { id: 'lyric', label: 'Lyric' }, { id: 'show', label: 'Show' }]}
      />
      <Segmented<SaveState>
        label="Save"
        value={save}
        onChange={setSave}
        options={[{ id: 'saved', label: 'Saved' }, { id: 'saving', label: 'Saving' }, { id: 'unsaved', label: 'Unsaved' }]}
      />
      <Segmented<'idle' | 'loading'>
        label="Loading"
        value={busy ? 'loading' : 'idle'}
        onChange={value => setBusy(value === 'loading')}
        options={[{ id: 'idle', label: 'Idle' }, { id: 'loading', label: 'Loading' }]}
      />
      <Segmented<CpuLevel>
        label="CPU"
        value={cpu}
        onChange={setCpu}
        options={[{ id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }]}
      />
      <Segmented<TimelineState>
        label="Timeline"
        value={timeline}
        onChange={setTimeline}
        options={[{ id: 'ready', label: 'Ready' }, { id: 'analyzing', label: 'Analyzing' }, { id: 'empty', label: 'Empty' }]}
      />
    </div>
  )
}

const noop = () => {}

/**
 * The page's own centred control group, built from the production header components (HeaderControlGroup,
 * HeaderIconKey) so the keys look exactly as they do in that page's header. Static: nothing is wired.
 */
function PageControlGroup({ page }: { page: HeaderPage }) {
  if (page === 'react') {
    // The React header's Production Output controls (ReactGlobalOutputControls, in its non-LaserDMX "preview" state).
    return (
      <HeaderControlGroup label="React controls">
        <div className="rv-global-output" aria-label="Global performance output">
          <button type="button" className="rv-global-output-status" disabled aria-label="OUTPUT PREVIEW">
            <span className="rv-global-output-dot" aria-hidden="true" />
            <OutputArmIcon />
            <span className="rv-global-output-label">OUTPUT PREVIEW</span>
          </button>
          <button type="button" className="rv-global-output-reveal" disabled aria-label="Reveal output">
            <RevealIcon />
            <span className="rv-global-output-label">Reveal</span>
          </button>
          <button type="button" className="rv-global-output-blackout" disabled aria-label="Blackout output">
            <BlackoutIcon />
            <span className="rv-global-output-label">Blackout</span>
          </button>
        </div>
      </HeaderControlGroup>
    )
  }
  if (page === 'media') {
    return (
      <HeaderControlGroup label="Media Manager controls">
        <HeaderIconKey label="Save Changes" icon={<SaveGlyph />} onClick={noop} />
        <HeaderIconKey label="Delete Media" icon={<Delete02Icon size={16} color="currentColor" />} danger onClick={noop} />
      </HeaderControlGroup>
    )
  }
  if (page === 'lyric') {
    return (
      <HeaderControlGroup label="Lyric Manager controls">
        <HeaderIconKey label="Show Lyrics" icon={<SubtitleIcon size={16} color="currentColor" />} pressed onClick={noop} />
        <HeaderIconKey label="Save" icon={<SaveGlyph />} onClick={noop} />
        <HeaderIconKey label="Save + Make Active" icon={<SaveActiveGlyph />} onClick={noop} />
      </HeaderControlGroup>
    )
  }
  return (
    <HeaderControlGroup label="Show Manager controls">
      <HeaderIconKey label="New Show" icon={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h9l5 5v12H5z" /><path d="M14 3.5v5h5M12 11v6M9 14h6" /></svg>} onClick={noop} />
      <HeaderIconKey label="Open Show" icon={<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h6l2 2h9l-2 10h-15z" /></svg>} onClick={noop} />
      <HeaderIconKey label="Save + Make Active" icon={<SaveActiveGlyph />} onClick={noop} />
      <HeaderIconKey label="Show Lyrics" icon={<SubtitleIcon size={16} color="currentColor" />} onClick={noop} />
    </HeaderControlGroup>
  )
}

/** A 60px mock page header: the page's control group in the middle, the status cluster at the right, then the profile icon. */
function HeaderFrame({ state, children }: { state: StatusState; children: ReactNode }) {
  return (
    <div className="llhs-frame" data-save={state.save} data-busy={state.busy ? 'true' : 'false'} data-cpu={state.cpu} data-timeline={state.timeline}>
      <div className="llhs-mid"><PageControlGroup page={state.page} /></div>
      <div className="llhs-cluster">{children}</div>
      <span className="llhs-avatar" role="img" aria-label="Profile">
        <svg {...svgProps} width="16" height="16"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>
      </span>
    </div>
  )
}

const timelineLabel = (timeline: TimelineState) => (timeline === 'analyzing' ? `${TIMELINE_LABEL} (analyzing)` : TIMELINE_LABEL)

const SaveDot = () => <i className="llhs-save-dot" aria-hidden="true" />

// ── 01 · Separate Chips ──────────────────────────────────────────────────
// Three independent rounded chips, each in its own box; Loading is a ring.
function SeparateChips({ state }: { state: StatusState }) {
  return (
    <>
      <span className="llhs-chip llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TimelineGlyph /></span>
      <span className="llhs-chip llhs-chip--saved" role="status"><SaveDot />{SAVE_LABEL[state.save]}</span>
      <span className="llhs-chip llhs-chip--cpu" aria-label={`CPU ${CPU_PERCENT[state.cpu]} percent`}>
        <small>CPU</small><b>{CPU_PERCENT[state.cpu]}%</b>
      </span>
      <span className="llhs-chip llhs-chip--square" role="status" aria-label={state.busy ? 'Loading' : 'Nothing loading'}>
        <svg {...svgProps} className={`llhs-ring${state.busy ? ' is-spinning' : ''}`} width="16" height="16">
          <circle cx="12" cy="12" r="9" opacity="0.28" />
          <path d="M12 3a9 9 0 0 1 9 9" />
        </svg>
      </span>
    </>
  )
}

// ── 02 · Status Strip ────────────────────────────────────────────────────
// One bordered strip split by hairlines; CPU gets a five-bar meter, Loading is three dots.
function StatusStrip({ state }: { state: StatusState }) {
  const lit = Math.max(1, Math.ceil((CPU_PERCENT[state.cpu] / 100) * 5))
  return (
    <div className="llhs-strip">
      <span className="llhs-strip-cell llhs-strip-cell--icon llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TimelineGlyph /></span>
      <span className="llhs-strip-cell llhs-strip-cell--saved" role="status">
        <svg {...svgProps} width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        {SAVE_LABEL[state.save]}
      </span>
      <span className="llhs-strip-cell" aria-label={`CPU ${CPU_PERCENT[state.cpu]} percent`}>
        <small>CPU</small>
        <span className="llhs-bars" aria-hidden="true">
          {[0, 1, 2, 3, 4].map(index => <i key={index} className={index < lit ? 'is-lit' : ''} style={{ height: 5 + index * 2.5 }} />)}
        </span>
        <b>{CPU_PERCENT[state.cpu]}%</b>
      </span>
      <span className="llhs-strip-cell llhs-strip-cell--icon" role="status" aria-label={state.busy ? 'Loading' : 'Nothing loading'}>
        <span className={`llhs-dots${state.busy ? ' is-busy' : ''}`} aria-hidden="true"><i /><i /><i /></span>
      </span>
    </div>
  )
}

// ── 03 · Open Telemetry ──────────────────────────────────────────────────
// No boxes: glowing-dot text, a thin CPU meter under its value, and a sweep line for Loading.
function OpenTelemetry({ state }: { state: StatusState }) {
  return (
    <>
      <span className="llhs-tele-key llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TimelineGlyph /></span>
      <span className="llhs-tele llhs-tele--saved" role="status"><SaveDot />{SAVE_LABEL[state.save]}</span>
      <span className="llhs-tele llhs-tele--cpu" aria-label={`CPU ${CPU_PERCENT[state.cpu]} percent`}>
        <span className="llhs-tele-row"><small>CPU</small><b>{CPU_PERCENT[state.cpu]}%</b></span>
        <span className="llhs-meter" aria-hidden="true"><i style={{ width: `${CPU_PERCENT[state.cpu]}%` }} /></span>
      </span>
      <span className="llhs-tele llhs-tele--loading" role="status" aria-label={state.busy ? 'Loading' : 'Nothing loading'}>
        <span className="llhs-tele-row"><small>{state.busy ? 'LOADING' : 'IDLE'}</small></span>
        <span className={`llhs-sweep${state.busy ? ' is-busy' : ''}`} aria-hidden="true"><i /></span>
      </span>
    </>
  )
}

const CONCEPTS = [
  { id: 'separate-chips', title: '01 · Separate Chips', blurb: 'Independent rounded chips, one box each: the Track Timeline button (cyan when ready), a Saved pill with a status dot, a CPU label + value chip whose number warms from green to amber to red, and a square chip holding a spinning ring. Reads as the header\'s other icon buttons.', Concept: SeparateChips },
  { id: 'status-strip', title: '02 · Status Strip', blurb: 'One bordered strip divided by hairlines, like the control deck: a Track Timeline cell, a check + Saved cell, a CPU cell with a five-bar level meter, and a Loading cell of three dots that wave while work is running.', Concept: StatusStrip },
  { id: 'open-telemetry', title: '03 · Open Telemetry', blurb: 'No boxes at all: the Track Timeline icon with a cyan underline when ready, Saved with a glowing dot, CPU with a thin gauge line under its value, and Loading as a labelled sweep line that runs a cyan highlight across while busy. The lightest of the three.', Concept: OpenTelemetry },
] as const

export function HeaderStatusStyleGallery() {
  const [save, setSave] = useState<SaveState>('saved')
  const [busy, setBusy] = useState(true)
  const [cpu, setCpu] = useState<CpuLevel>('low')
  const [timeline, setTimeline] = useState<TimelineState>('ready')
  const [page, setPage] = useState<HeaderPage>('lyric')
  const state: StatusState = { save, busy, cpu, timeline, page }
  return (
    <div className="llcm-gallery lldd-gallery llhs-gallery" aria-label="Header status concepts">
      <ControlBar {...state} setSave={setSave} setBusy={setBusy} setCpu={setCpu} setTimeline={setTimeline} setPage={setPage} />
      {CONCEPTS.map(({ id, title, blurb, Concept }) => (
        <section key={id} className="lldd-gallery-row" data-testid={`header-status-concept-${id}`}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{title}</span>
            <span className="lldd-gallery-blurb">{blurb}</span>
          </div>
          <HeaderFrame state={state}><Concept state={state} /></HeaderFrame>
        </section>
      ))}
    </div>
  )
}
