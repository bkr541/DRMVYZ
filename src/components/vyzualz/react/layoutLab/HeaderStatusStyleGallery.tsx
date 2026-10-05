import { useState, type ReactNode } from 'react'
import { TrackTimelineIcon } from '../trackTimeline/TrackTimelineIcon'

// ── HeaderStatusStyleGallery ─────────────────────────────────────────────
//
// Layout Lab / Cinema engine, middle visualizer. Three concepts for the cluster that
// sits at the right of every page header (React, Media Manager, Lyric Manager, Show
// Manager): the Track Timeline Visualizer button, the save state ("Saved"), the app's
// CPU readout, the loading indicator and the profile icon. Each concept draws all of
// them in a different visual language — separate chips, one segmented strip, and open
// "telemetry" readouts — with a different loading treatment (ring, dots, sweep line),
// so the styles can be compared like for like in the same mock header (page heading
// at the left). A control bar above drives every concept at once (save state, idle /
// loading, CPU level, timeline button state) so each state can be judged.
// Presentation only — nothing is wired to a store or page.

type SaveState = 'saved' | 'saving' | 'unsaved'
type CpuLevel = 'low' | 'medium' | 'high'
type TimelineState = 'ready' | 'analyzing' | 'empty'

const TIMELINE_LABEL = 'Track Timeline Visualizer'

const SAVE_LABEL: Record<SaveState, string> = { saved: 'Saved 10:44 AM', saving: 'Saving…', unsaved: 'Unsaved' }
const CPU_PERCENT: Record<CpuLevel, number> = { low: 4, medium: 38, high: 86 }

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

interface StatusState {
  save: SaveState
  busy: boolean
  cpu: CpuLevel
  timeline: TimelineState
}

interface ControlBarProps extends StatusState {
  setSave: (value: SaveState) => void
  setBusy: (value: boolean) => void
  setCpu: (value: CpuLevel) => void
  setTimeline: (value: TimelineState) => void
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

function ControlBar({ save, busy, cpu, timeline, setSave, setBusy, setCpu, setTimeline }: ControlBarProps) {
  return (
    <div className="llhs-controls" aria-label="Status states">
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

/** A 60px mock page header: the page heading at the left, the status cluster at the right, then the profile icon. */
function HeaderFrame({ state, children }: { state: StatusState; children: ReactNode }) {
  return (
    <div className="llhs-frame" data-save={state.save} data-busy={state.busy ? 'true' : 'false'} data-cpu={state.cpu} data-timeline={state.timeline}>
      <span className="llhs-title" aria-hidden="true">PAGE HEADING</span>
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
      <span className="llhs-chip llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TrackTimelineIcon /></span>
      <span className="llhs-chip llhs-chip--saved" role="status"><SaveDot />{SAVE_LABEL[state.save]}</span>
      <span className="llhs-chip llhs-chip--cpu" aria-label={`CPU ${CPU_PERCENT[state.cpu]} percent`}>
        <small>CPU</small><b>{CPU_PERCENT[state.cpu]}%</b>
      </span>
      <span className="llhs-chip llhs-chip--square" role="status" aria-label={state.busy ? 'Loading' : 'Nothing loading'}>
        <svg {...svgProps} className={`llhs-ring${state.busy ? ' is-spinning' : ''}`} width="18" height="18">
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
      <span className="llhs-strip-cell llhs-strip-cell--icon llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TrackTimelineIcon /></span>
      <span className="llhs-strip-cell llhs-strip-cell--saved" role="status">
        <svg {...svgProps} width="13" height="13"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
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
      <span className="llhs-tele-key llhs-tl" data-state={state.timeline} role="img" aria-label={timelineLabel(state.timeline)}><TrackTimelineIcon /></span>
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
  const state: StatusState = { save, busy, cpu, timeline }
  return (
    <div className="llcm-gallery lldd-gallery llhs-gallery" aria-label="Header status concepts">
      <ControlBar {...state} setSave={setSave} setBusy={setBusy} setCpu={setCpu} setTimeline={setTimeline} />
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
