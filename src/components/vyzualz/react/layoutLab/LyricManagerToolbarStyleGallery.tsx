import { useEffect, useState } from 'react'
import { BubbleRevealSlider } from '../controls/BubbleRevealSlider'

// Layout Lab / Template, middle column. Three redraws of Lyric Manager's transport row (the row under the Track Timeline): play, position, zoom,
// volume. Each is ONE continuous surface built from the production pieces themselves (the `lmv-transport-icon` play button, the `lmv-transport-time`
// readout and the shared BubbleRevealSlider), so spacing, type and colour are the app's own rather than a second dialect.

/** The mock track is 1:53 long. */
const TRACK_SECONDS = 113

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

interface MockState {
  playing: boolean
  position: number
  setPosition: (seconds: number) => void
  zoom: number
  volume: number
  setPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setVolume: (volume: number) => void
}

function Play({ state }: { state: MockState }) {
  return (
    <button
      type="button"
      className="lmv-transport-icon lltr-play"
      aria-label={`${state.playing ? 'Pause' : 'Play'} (mockup)`}
      title={state.playing ? 'Pause' : 'Play'}
      onClick={() => state.setPlaying(!state.playing)}
    >
      {state.playing ? 'Ⅱ' : '▶'}
    </button>
  )
}

/** The track scrubber: elapsed time on the left (0:00 at the start, counting up), the track's total length on the right. */
function Scrubber({ state }: { state: MockState }) {
  return (
    <label className="lltr-scrubber">
      <span className="lltr-stamp lltr-stamp--elapsed" aria-label={`Elapsed ${clock(state.position)}`}>{clock(state.position)}</span>
      <BubbleRevealSlider
        type="range"
        min={0}
        max={TRACK_SECONDS}
        step={0.01}
        value={state.position}
        bubbleLabel={clock(state.position)}
        aria-label="Track position (mockup)"
        onChange={event => state.setPosition(Number(event.target.value))}
      />
      <span className="lltr-stamp lltr-stamp--total" aria-label={`Track length ${clock(TRACK_SECONDS)}`}>{clock(TRACK_SECONDS)}</span>
    </label>
  )
}

/** Zoom and volume share one group at the right end of the row. */
function Levels({ state }: { state: MockState }) {
  return (
    <div className="lltr-levels">
      <Zoom state={state} />
      <Volume state={state} />
    </div>
  )
}

function Zoom({ state }: { state: MockState }) {
  return (
    <label className="lltr-field lltr-field--zoom">
      <span className="lltr-label">Zoom <b>{state.zoom.toFixed(2)}×</b></span>
      <BubbleRevealSlider type="range" min={1} max={4} step={0.01} value={state.zoom} aria-label="Zoom (mockup)" onChange={event => state.setZoom(Number(event.target.value))} />
    </label>
  )
}

function Volume({ state }: { state: MockState }) {
  return (
    <label className="lltr-field lltr-field--volume">
      <span className="lltr-label lltr-label--icon" aria-hidden="true">♬</span>
      <BubbleRevealSlider type="range" min={0} max={1} step={0.01} value={state.volume} aria-label="Volume (mockup)" onChange={event => state.setVolume(Number(event.target.value))} />
      <b className="lltr-value">{Math.round(state.volume * 100)}</b>
    </label>
  )
}

/** One bar, one hairline between each section, every control centred on the same line. */
function DockStrip({ state }: { state: MockState }) {
  return (
    <div className="lltr-bar lltr-bar--strip">
      <div className="lltr-section lltr-section--transport"><Play state={state} /></div>
      <div className="lltr-section lltr-section--grow"><Scrubber state={state} /></div>
      <div className="lltr-section"><Levels state={state} /></div>
    </div>
  )
}

/** The play button is the bar's cap; everything else sits on one recessed track, like a dock card. */
function InsetConsole({ state }: { state: MockState }) {
  return (
    <div className="lltr-bar lltr-bar--console">
      <div className="lltr-cap"><Play state={state} /></div>
      <div className="lltr-well">
        <Scrubber state={state} />
        <Levels state={state} />
      </div>
    </div>
  )
}

/** No container: the same controls on the panel itself, held together by one hairline above and an even rhythm. */
function QuietRow({ state }: { state: MockState }) {
  return (
    <div className="lltr-bar lltr-bar--quiet">
      <Play state={state} />
      <Scrubber state={state} />
      <Levels state={state} />
    </div>
  )
}

const CONCEPTS = [
  {
    id: 'studio-strip',
    title: '01 · Dock Strip',
    blurb: 'One rounded bar in the dock’s own dark surface. The play button, the track scrubber (elapsed on its left, total length on its right) and the shared zoom and volume group are separated by single hairlines on one centre line.',
    Concept: DockStrip,
  },
  {
    id: 'timeline-rail',
    title: '02 · Inset Console',
    blurb: 'The play button caps the bar and the rest runs on one recessed track, the way the dock’s cards are set into the dock. Nothing floats or reads as a separate piece.',
    Concept: InsetConsole,
  },
  {
    id: 'capsule-cluster',
    title: '03 · Quiet Row',
    blurb: 'No container at all: play, the track scrubber and the zoom and volume group straight on the panel under one hairline, held together by even spacing and shared type. The lightest option.',
    Concept: QuietRow,
  },
]

export function LyricManagerToolbarStyleGallery() {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [zoom, setZoom] = useState(1.29)
  const [volume, setVolume] = useState(0.8)
  const state = { playing, position, setPosition, zoom, volume, setPlaying, setZoom, setVolume }

  // While "playing" the scrubber advances in real time, and stops at the end of the track.
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setPosition(current => {
        const next = current + 0.1
        if (next >= TRACK_SECONDS) { setPlaying(false); return TRACK_SECONDS }
        return next
      })
    }, 100)
    return () => clearInterval(timer)
  }, [playing])

  return (
    <div className="llcm-gallery lldd-gallery lltr-gallery" aria-label="Lyric Manager timeline control row concepts">
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
