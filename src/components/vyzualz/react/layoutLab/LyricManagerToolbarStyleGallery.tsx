import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  Add01Icon,
  MinusSignIcon,
  MusicNote01Icon,
  PauseIcon,
  PlayIcon,
  VolumeHighIcon,
  ZoomIcon,
} from 'hugeicons-react'

// Layout Lab / Template, middle column. Three local-only replacements for
// Lyric Manager's timeline transport row: play, position, zoom and volume.

interface MockState {
  playing: boolean
  zoom: number
  volume: number
  setPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setVolume: (volume: number) => void
}

function IconButton({ label, className = '', children, onClick }: {
  label: string
  className?: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button type="button" className={`lllt-icon-button${className ? ` ${className}` : ''}`} aria-label={`${label} (mockup)`} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function PlayButton({ state, className = '' }: { state: MockState; className?: string }) {
  return (
    <IconButton label={state.playing ? 'Pause' : 'Play'} className={`lllt-play${className ? ` ${className}` : ''}`} onClick={() => state.setPlaying(!state.playing)}>
      {state.playing ? <PauseIcon /> : <PlayIcon />}
    </IconButton>
  )
}

function Range({ label, value, min, max, step, onChange, className = '' }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  className?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      className={`lllt-range${className ? ` ${className}` : ''}`}
      type="range"
      aria-label={`${label} (mockup)`}
      title={`${label}: ${value}`}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={event => onChange(Number(event.target.value))}
      style={{ '--lllt-pct': `${pct}%` } as CSSProperties}
    />
  )
}

function TimeReadout({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`lllt-time${compact ? ' lllt-time--compact' : ''}`} aria-label="Track position 33.21 seconds of 1 minute 53 seconds">
      <strong>0:33.21</strong>
      <span>/ 1:53</span>
    </div>
  )
}

function StudioStrip({ state }: { state: MockState }) {
  return (
    <div className="lllt-row lllt-row--studio">
      <PlayButton state={state} />
      <TimeReadout />
      <span className="lllt-divider" aria-hidden="true" />
      <label className="lllt-field lllt-field--grow">
        <span><ZoomIcon /> Zoom <b>{state.zoom.toFixed(2)}×</b></span>
        <Range label="Zoom" value={state.zoom} min={1} max={4} step={0.01} onChange={state.setZoom} />
      </label>
      <span className="lllt-divider" aria-hidden="true" />
      <label className="lllt-field lllt-field--volume">
        <span><VolumeHighIcon /> Level <b>{Math.round(state.volume * 100)}%</b></span>
        <Range label="Volume" value={state.volume} min={0} max={1} step={0.01} onChange={state.setVolume} />
      </label>
    </div>
  )
}

function TimelineRail({ state }: { state: MockState }) {
  const zoomStep = (delta: number) => state.setZoom(Math.min(4, Math.max(1, Math.round((state.zoom + delta) * 100) / 100)))
  return (
    <div className="lllt-row lllt-row--rail">
      <div className="lllt-rail-transport">
        <PlayButton state={state} />
        <TimeReadout compact />
      </div>
      <div className="lllt-rail-focus">
        <div className="lllt-rail-caption"><span>Timeline scale</span><strong>{state.zoom.toFixed(2)}×</strong></div>
        <div className="lllt-rail-slider">
          <IconButton label="Zoom out" onClick={() => zoomStep(-0.25)}><MinusSignIcon /></IconButton>
          <Range label="Zoom" value={state.zoom} min={1} max={4} step={0.01} onChange={state.setZoom} />
          <IconButton label="Zoom in" onClick={() => zoomStep(0.25)}><Add01Icon /></IconButton>
        </div>
      </div>
      <label className="lllt-rail-volume">
        <VolumeHighIcon />
        <Range label="Volume" value={state.volume} min={0} max={1} step={0.01} onChange={state.setVolume} />
        <strong>{Math.round(state.volume * 100)}</strong>
      </label>
    </div>
  )
}

function CapsuleCluster({ state }: { state: MockState }) {
  return (
    <div className="lllt-row lllt-row--capsules">
      <div className="lllt-capsule lllt-capsule--transport">
        <PlayButton state={state} />
        <TimeReadout />
        <span className={`lllt-status-dot${state.playing ? ' is-live' : ''}`} title={state.playing ? 'Playing' : 'Paused'} />
      </div>
      <label className="lllt-capsule lllt-capsule--control">
        <span className="lllt-capsule-icon"><ZoomIcon /></span>
        <span className="lllt-capsule-copy"><small>Zoom</small><strong>{state.zoom.toFixed(2)}×</strong></span>
        <Range label="Zoom" value={state.zoom} min={1} max={4} step={0.01} onChange={state.setZoom} />
      </label>
      <label className="lllt-capsule lllt-capsule--control lllt-capsule--level">
        <span className="lllt-capsule-icon"><MusicNote01Icon /></span>
        <span className="lllt-capsule-copy"><small>Level</small><strong>{Math.round(state.volume * 100)}%</strong></span>
        <Range label="Volume" value={state.volume} min={0} max={1} step={0.01} onChange={state.setVolume} />
      </label>
    </div>
  )
}

const CONCEPTS = [
  {
    id: 'studio-strip',
    title: '01 · Studio Strip',
    blurb: 'A precise, evenly spaced control surface. Thin dividers and labeled readouts make transport, timeline scale, and listening level easy to scan without adding height.',
    Concept: StudioStrip,
  },
  {
    id: 'timeline-rail',
    title: '02 · Timeline Rail',
    blurb: 'Makes zoom the center of gravity with explicit step controls and a long scale rail, while transport and volume become compact anchored modules at either end.',
    Concept: TimelineRail,
  },
  {
    id: 'capsule-cluster',
    title: '03 · Capsule Cluster',
    blurb: 'Three luminous, self-contained pods create the clearest grouping. The transport capsule gets priority while zoom and level share the same compact visual grammar.',
    Concept: CapsuleCluster,
  },
]

export function LyricManagerToolbarStyleGallery() {
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1.29)
  const [volume, setVolume] = useState(0.8)
  const state = { playing, zoom, volume, setPlaying, setZoom, setVolume }

  return (
    <div className="llcm-gallery lldd-gallery lllt-gallery" aria-label="Lyric Manager timeline control row concepts">
      {CONCEPTS.map(({ id, title, blurb, Concept }) => (
        <section key={id} className="lldd-gallery-row" data-testid={`lyric-toolbar-concept-${id}`}>
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{title}</span>
            <span className="lldd-gallery-blurb">{blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <Concept state={state} />
          </div>
        </section>
      ))}
    </div>
  )
}
