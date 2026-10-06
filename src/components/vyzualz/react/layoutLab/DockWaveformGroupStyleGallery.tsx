import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Segmented } from './DockLeftGroupStyleGallery'

// ── DockWaveformGroupStyleGallery ────────────────────────────────────────
//
// Layout Lab / Template, middle section. Five concepts for the audio dock's centre card — the waveform group. Each is drawn at
// the production card's height (156px: the 176px dock less its 10px padding) and the full width of the middle section, with
// the dock's own zoom buttons on the right. They show everything the dock's waveform carries (played and unplayed audio, the
// playhead, cue markers, the beat grid, and where the track's sections fall) in five different languages. A control bar drives
// all five at once (track loaded / empty, zoom), and clicking any waveform moves the playhead in all of them. Presentation only —
// the track is a generated one and nothing is wired to the audio engine or a store.

const DURATION_SEC = 228
const BPM = 128
const SAMPLES = 1200
const BEATS_PER_BAR = 4
const ZOOMS = [1, 2, 4, 8] as const

interface Section { id: string; label: string; from: number; to: number; tone: string; energy: [number, number] }

const SECTIONS: readonly Section[] = [
  { id: 'intro', label: 'Intro', from: 0, to: 0.12, tone: '#5aa9ff', energy: [0.22, 0.34] },
  { id: 'build', label: 'Build', from: 0.12, to: 0.3, tone: '#ffd23f', energy: [0.4, 0.82] },
  { id: 'drop', label: 'Drop', from: 0.3, to: 0.52, tone: '#ff4f6d', energy: [0.95, 0.95] },
  { id: 'break', label: 'Breakdown', from: 0.52, to: 0.66, tone: '#7affb0', energy: [0.3, 0.38] },
  { id: 'build2', label: 'Build', from: 0.66, to: 0.76, tone: '#ffd23f', energy: [0.45, 0.88] },
  { id: 'drop2', label: 'Drop', from: 0.76, to: 0.94, tone: '#ff4f6d', energy: [0.97, 0.97] },
  { id: 'outro', label: 'Outro', from: 0.94, to: 1, tone: '#5aa9ff', energy: [0.34, 0.15] },
]

const CUES = [
  { id: 'a', label: 'A', at: 0.12 },
  { id: 'b', label: 'B', at: 0.3 },
  { id: 'c', label: 'C', at: 0.52 },
  { id: 'd', label: 'D', at: 0.76 },
] as const

const hash = (value: number) => {
  const x = Math.sin(value * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

interface TrackData {
  peaks: Float32Array
  low: Float32Array
  mid: Float32Array
  high: Float32Array
}

/** A generated track: loud drops, quiet breakdowns, a kick-like pulse every beat, and a different mix of bass, mids and highs per section. */
function buildTrack(): TrackData {
  const peaks = new Float32Array(SAMPLES)
  const low = new Float32Array(SAMPLES)
  const mid = new Float32Array(SAMPLES)
  const high = new Float32Array(SAMPLES)
  const beatsPerSample = (DURATION_SEC / 60 * BPM) / SAMPLES
  for (let index = 0; index < SAMPLES; index += 1) {
    const f = index / SAMPLES
    const section = SECTIONS.find(candidate => f >= candidate.from && f < candidate.to) ?? SECTIONS[SECTIONS.length - 1]
    const along = (f - section.from) / (section.to - section.from)
    const base = section.energy[0] + (section.energy[1] - section.energy[0]) * along
    const beatPhase = (index * beatsPerSample) % 1
    const kick = Math.exp(-beatPhase * 5)
    const texture = 0.62 + 0.38 * hash(index * 0.37)
    const peak = Math.min(1, base * (0.55 + 0.3 * kick) * texture + 0.06)
    const dropLike = section.id.startsWith('drop')
    peaks[index] = peak
    low[index] = Math.min(1, peak * (dropLike ? 0.95 : 0.55) * (0.6 + 0.4 * kick))
    mid[index] = Math.min(1, peak * (0.55 + 0.25 * hash(index * 0.11 + 4)))
    high[index] = Math.min(1, peak * (dropLike ? 0.7 : 0.35) * (0.4 + 0.6 * hash(index * 0.53 + 9)))
  }
  return { peaks, low, mid, high }
}

interface Bar { peak: number; low: number; mid: number; high: number; f: number }

/** `count` bars covering [start, end) of the track, each taking the loudest and the average bands of the samples under it. */
function barsForRange(track: TrackData, start: number, end: number, count: number): Bar[] {
  const bars: Bar[] = []
  const from = start * SAMPLES
  const span = (end - start) * SAMPLES
  for (let index = 0; index < count; index += 1) {
    const a = Math.floor(from + (index / count) * span)
    const b = Math.max(a + 1, Math.floor(from + ((index + 1) / count) * span))
    let peak = 0
    let low = 0
    let mid = 0
    let high = 0
    let taken = 0
    for (let sample = Math.max(0, a); sample < Math.min(SAMPLES, b); sample += 1) {
      peak = Math.max(peak, track.peaks[sample])
      low += track.low[sample]
      mid += track.mid[sample]
      high += track.high[sample]
      taken += 1
    }
    bars.push({ peak, low: taken ? low / taken : 0, mid: taken ? mid / taken : 0, high: taken ? high / taken : 0, f: start + ((index + 0.5) / count) * (end - start) })
  }
  return bars
}

/** The three bands as one colour: bass pushes red, mids green, highs blue, like an RGB waveform. */
function bandColor(bar: Bar): string {
  const total = Math.max(0.001, bar.low + bar.mid + bar.high)
  const channel = (value: number) => Math.round(70 + 185 * Math.min(1, (value / total) * 1.7))
  return `rgb(${channel(bar.low)}, ${channel(bar.mid)}, ${channel(bar.high)})`
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

interface Range { start: number; end: number }

interface View extends Range {
  loaded: boolean
  progress: number
  zoom: number
  track: TrackData
  seek: (fraction: number) => void
  setZoom: (zoom: number) => void
}

/** The visible window: the whole track at 1×, otherwise a window centred on the playhead and clamped to the track's ends. */
function visibleRange(progress: number, zoom: number): Range {
  const width = 1 / zoom
  const start = Math.min(1 - width, Math.max(0, progress - width / 2))
  return { start, end: start + width }
}

const pct = (value: number) => `${(value * 100).toFixed(3)}%`
const within = (f: number, range: Range) => f >= range.start && f <= range.end
const place = (f: number, range: Range) => (f - range.start) / (range.end - range.start)

/** Bar (and optionally beat) positions in the visible window. */
function gridLines(range: Range, includeBeats: boolean): { f: number; bar: boolean; index: number }[] {
  const beatSec = 60 / BPM
  const first = Math.max(0, Math.floor((range.start * DURATION_SEC) / beatSec))
  const last = Math.ceil((range.end * DURATION_SEC) / beatSec)
  const lines: { f: number; bar: boolean; index: number }[] = []
  for (let beat = first; beat <= last; beat += 1) {
    const bar = beat % BEATS_PER_BAR === 0
    if (!bar && !includeBeats) continue
    lines.push({ f: (beat * beatSec) / DURATION_SEC, bar, index: Math.floor(beat / BEATS_PER_BAR) + 1 })
  }
  return lines.filter(line => within(line.f, range))
}

function Cues({ range, labels = false }: { range: Range; labels?: boolean }) {
  return (
    <>
      {CUES.filter(cue => within(cue.at, range)).map(cue => (
        <span key={cue.id} className="llwf-cue" style={{ left: pct(place(cue.at, range)) }} title={`Cue ${cue.label}`}>
          {labels && <b>{cue.label}</b>}
        </span>
      ))}
    </>
  )
}

function Playhead({ view, range, bubble = false }: { view: View; range: Range; bubble?: boolean }) {
  if (!view.loaded) return null
  return (
    <span className="llwf-playhead" style={{ left: pct(place(view.progress, range)) }}>
      {bubble && <em>{clock(view.progress * DURATION_SEC)}</em>}
    </span>
  )
}

/** The wave area of a concept: click-to-seek within `range`, and the empty message when no track is loaded. */
function Surface({ view, range, className = '', children }: { view: View; range: Range; className?: string; children: ReactNode }) {
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view.loaded) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0) return
    view.seek(range.start + ((event.clientX - rect.left) / rect.width) * (range.end - range.start))
  }
  return (
    <div className={`llwf-surface ${className}`} onPointerDown={onPointerDown}>
      {children}
      {!view.loaded && <span className="llwf-empty">Load a track to see its waveform</span>}
    </div>
  )
}

function ZoomButtons({ view }: { view: View }) {
  const index = ZOOMS.indexOf(view.zoom as typeof ZOOMS[number])
  return (
    <div className="vz-dock-zoom-btns">
      <button type="button" className="vz-dock-zoom-btn" title="Zoom in" aria-label="Zoom in" disabled={!view.loaded || index >= ZOOMS.length - 1} onClick={() => view.setZoom(ZOOMS[index + 1])}>+</button>
      <button type="button" className="vz-dock-zoom-btn" title="Zoom out" aria-label="Zoom out" disabled={!view.loaded || index <= 0} onClick={() => view.setZoom(ZOOMS[index - 1])}>−</button>
    </div>
  )
}

function Card({ view, children }: { view: View; children: ReactNode }) {
  return (
    <div className="vz-dock-card llwf-card">
      <div className="llwf-wave">{children}</div>
      <ZoomButtons view={view} />
    </div>
  )
}

const level = (loaded: boolean, peak: number) => (loaded ? peak : 0.05)

// ── Concepts ──────────────────────────────────────────────────────────────

/** 01 — mirrored RGB bands: bass red, mids green, highs blue, bright where played and dim ahead, with the bar grid underneath. */
function RgbBands({ view }: { view: View }) {
  const COUNT = 220
  const bars = useMemo(() => barsForRange(view.track, view.start, view.end, COUNT), [view.track, view.start, view.end])
  return (
    <Card view={view}>
      <Surface view={view} range={view} className="llwf-c1">
        <svg viewBox={`0 0 ${COUNT} 100`} preserveAspectRatio="none" aria-hidden="true">
          {bars.map((bar, index) => {
            const half = level(view.loaded, bar.peak) * 46
            return (
              <rect
                key={index}
                x={index + 0.1}
                y={50 - half}
                width={0.8}
                height={half * 2}
                rx={0.3}
                fill={view.loaded ? bandColor(bar) : '#3a4a52'}
                opacity={bar.f <= view.progress && view.loaded ? 1 : 0.38}
              />
            )
          })}
        </svg>
        <div className="llwf-grid-strip" aria-hidden="true">
          {gridLines(view, view.zoom >= 4).map(line => (
            <i key={line.f} className={line.bar ? 'is-bar' : ''} style={{ left: pct(place(line.f, view)) }} />
          ))}
        </div>
        <Cues range={view} />
        <Playhead view={view} range={view} />
        <span className="llwf-chip llwf-chip--tl">{clock(view.progress * DURATION_SEC)} <small>/ {clock(DURATION_SEC)}</small></span>
        <span className="llwf-legend" aria-hidden="true"><b style={{ background: '#ff7a7a' }} />Low<b style={{ background: '#7aff9a' }} />Mid<b style={{ background: '#7aa9ff' }} />High</span>
      </Surface>
    </Card>
  )
}

const sectionAt = (f: number) => SECTIONS.find(section => f >= section.from && f < section.to) ?? SECTIONS[SECTIONS.length - 1]

/** 02 — a labelled section ribbon over the wave: each section has its own colour, the current one lights up and cue flags sit on the ribbon. */
function SectionStrip({ view }: { view: View }) {
  const COUNT = 200
  const bars = useMemo(() => barsForRange(view.track, view.start, view.end, COUNT), [view.track, view.start, view.end])
  const current = sectionAt(view.progress)
  return (
    <Card view={view}>
      <Surface view={view} range={view} className="llwf-c2">
        <div className="llwf-ribbon" aria-hidden="true">
          {SECTIONS.filter(section => section.to > view.start && section.from < view.end).map(section => {
            const left = Math.max(0, place(section.from, view))
            const right = Math.min(1, place(section.to, view))
            return (
              <span
                key={section.id}
                className={`llwf-ribbon-seg${view.loaded && section.id === current.id ? ' is-current' : ''}`}
                style={{ left: pct(left), width: pct(right - left), '--tone': section.tone } as CSSProperties}
              >
                <b>{section.label}</b>
              </span>
            )
          })}
        </div>
        <svg className="llwf-c2-wave" viewBox={`0 0 ${COUNT} 100`} preserveAspectRatio="none" aria-hidden="true">
          {bars.map((bar, index) => {
            const half = level(view.loaded, bar.peak) * 48
            return (
              <rect
                key={index}
                x={index + 0.12}
                y={50 - half}
                width={0.76}
                height={half * 2}
                rx={0.3}
                fill={view.loaded ? sectionAt(bar.f).tone : '#3a4a52'}
                opacity={bar.f <= view.progress && view.loaded ? 0.95 : 0.34}
              />
            )
          })}
        </svg>
        <Cues range={view} labels />
        <Playhead view={view} range={view} />
      </Surface>
    </Card>
  )
}

/** 03 — a CDJ-style pair: a slim overview of the whole track with its window, over a zoomed, beat-gridded wave centred on the playhead. */
function OverviewWindow({ view }: { view: View }) {
  const COUNT = 200
  const detail = visibleRange(view.progress, Math.max(view.zoom, 2))
  const overview = useMemo(() => barsForRange(view.track, 0, 1, 180), [view.track])
  const bars = useMemo(() => barsForRange(view.track, detail.start, detail.end, COUNT), [view.track, detail.start, detail.end])
  const seekOverview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!view.loaded) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width > 0) view.seek((event.clientX - rect.left) / rect.width)
  }
  return (
    <Card view={view}>
      <div className="llwf-c3">
        <div className="llwf-c3-overview" onPointerDown={seekOverview}>
          <svg viewBox="0 0 180 100" preserveAspectRatio="none" aria-hidden="true">
            {overview.map((bar, index) => {
              const half = level(view.loaded, bar.peak) * 46
              const played = view.loaded && bar.f <= view.progress
              return <rect key={index} x={index + 0.15} y={50 - half} width={0.7} height={half * 2} fill={played ? '#67f7ff' : '#4a6a73'} opacity={played ? 0.9 : 0.6} />
            })}
          </svg>
          {view.loaded && <span className="llwf-c3-window" style={{ left: pct(detail.start), width: pct(detail.end - detail.start) }} />}
          {view.loaded && <span className="llwf-c3-needle" style={{ left: pct(view.progress) }} />}
        </div>
        <Surface view={view} range={detail} className="llwf-c3-detail">
          <svg viewBox={`0 0 ${COUNT} 100`} preserveAspectRatio="none" aria-hidden="true">
            {bars.map((bar, index) => {
              const half = level(view.loaded, bar.peak) * 46
              const played = bar.f <= view.progress && view.loaded
              return <rect key={index} x={index + 0.08} y={50 - half} width={0.84} height={half * 2} fill={played ? '#67f7ff' : '#2f8a9a'} opacity={view.loaded ? (played ? 0.95 : 0.55) : 0.5} />
            })}
          </svg>
          <div className="llwf-grid-lines" aria-hidden="true">
            {gridLines(detail, true).map(line => (
              <i key={line.f} className={line.bar ? 'is-bar' : ''} style={{ left: pct(place(line.f, detail)) }}>{line.bar && <b>{line.index}</b>}</i>
            ))}
          </div>
          <Cues range={detail} labels />
          <Playhead view={view} range={detail} bubble />
        </Surface>
      </div>
    </Card>
  )
}

/** 04 — a smooth glowing ribbon: the wave as one filled shape with a neon edge, lit up to the playhead where a glowing dot rides the crest. */
function PulseRibbon({ view }: { view: View }) {
  const COUNT = 160
  const bars = useMemo(() => barsForRange(view.track, view.start, view.end, COUNT), [view.track, view.start, view.end])
  const heights = useMemo(() => bars.map((bar, index) => {
    const before = bars[Math.max(0, index - 1)].peak
    const after = bars[Math.min(bars.length - 1, index + 1)].peak
    return level(view.loaded, (before + bar.peak * 2 + after) / 4) * 46
  }), [bars, view.loaded])
  const shape = (to: number) => {
    const top = heights.slice(0, to).map((half, index) => `${index},${50 - half}`)
    const bottom = heights.slice(0, to).map((_, index, all) => `${all.length - 1 - index},${50 + all[all.length - 1 - index]}`)
    return top.length < 2 ? '' : `M${top.join(' L')} L${bottom.join(' L')} Z`
  }
  const edge = (to: number) => heights.slice(0, to).map((half, index) => `${index},${50 - half}`).join(' ')
  const playedIndex = Math.max(0, Math.min(COUNT - 1, Math.round(place(view.progress, view) * (COUNT - 1))))
  const crest = 50 - (heights[playedIndex] ?? 0)
  return (
    <Card view={view}>
      <Surface view={view} range={view} className="llwf-c4">
        <svg viewBox={`0 0 ${COUNT - 1} 100`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="llwf-c4-fill" x1="0" x2="1">
              <stop offset="0" stopColor="#4ac7db" />
              <stop offset="0.55" stopColor="#7a6bff" />
              <stop offset="1" stopColor="#ff4fd8" />
            </linearGradient>
          </defs>
          <path d={shape(COUNT)} fill="rgba(120, 150, 165, 0.16)" />
          <polyline points={edge(COUNT)} fill="none" stroke="rgba(150, 180, 195, 0.3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {view.loaded && (
            <>
              <path className="llwf-c4-lit" d={shape(playedIndex + 1)} fill="url(#llwf-c4-fill)" opacity="0.85" />
              <polyline className="llwf-c4-edge" points={edge(playedIndex + 1)} fill="none" stroke="#bff9ff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            </>
          )}
          <line x1="0" x2={COUNT - 1} y1="50" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <Cues range={view} />
        {view.loaded && <span className="llwf-c4-dot" style={{ left: pct(place(view.progress, view)), top: `${crest}%` }} />}
        <Playhead view={view} range={view} />
        <span className="llwf-chip llwf-chip--br">-{clock(DURATION_SEC - view.progress * DURATION_SEC)}</span>
      </Surface>
    </Card>
  )
}

/** 05 — an LED matrix: each column is a stack of small lit cells that climbs with the level, with bar numbers on the downbeats. */
function LedMatrix({ view }: { view: View }) {
  const COLUMNS = 96
  const LEVELS = 14
  const bars = useMemo(() => barsForRange(view.track, view.start, view.end, COLUMNS), [view.track, view.start, view.end])
  const tint = (fraction: number) => (fraction < 0.55 ? '#4ac7db' : fraction < 0.82 ? '#ffd23f' : '#ff4f6d')
  const playedColumn = Math.floor(place(view.progress, view) * COLUMNS)
  return (
    <Card view={view}>
      <Surface view={view} range={view} className="llwf-c5">
        <svg viewBox={`0 0 ${COLUMNS * 4} ${LEVELS * 4}`} preserveAspectRatio="none" aria-hidden="true">
          {bars.map((bar, column) => {
            const lit = Math.round(level(view.loaded, bar.peak) * LEVELS)
            const played = view.loaded && column <= playedColumn
            return Array.from({ length: LEVELS }, (_, row) => {
              const on = row < lit
              return (
                <rect
                  key={`${column}-${row}`}
                  x={column * 4 + 0.6}
                  y={(LEVELS - 1 - row) * 4 + 0.6}
                  width={2.8}
                  height={2.8}
                  rx={0.7}
                  fill={on ? tint(row / LEVELS) : '#2a363c'}
                  opacity={on ? (column === playedColumn && view.loaded ? 1 : played ? 0.95 : 0.34) : 0.35}
                />
              )
            })
          })}
        </svg>
        <div className="llwf-c5-bars" aria-hidden="true">
          {gridLines(view, false).filter((_, index, all) => all.length < 14 || index % 2 === 0).map(line => (
            <span key={line.f} style={{ left: pct(place(line.f, view)) }}><b>{line.index}</b></span>
          ))}
        </div>
        <Cues range={view} labels />
        <Playhead view={view} range={view} />
        <span className="llwf-chip llwf-chip--tr">{BPM} BPM</span>
      </Surface>
    </Card>
  )
}

const CONCEPTS = [
  { id: 'rgb-bands', title: '01 · RGB Bands', blurb: 'Mirrored wave coloured by bass, mids and highs — bright where played, dim ahead — with the bar grid along the bottom.', Concept: RgbBands },
  { id: 'section-strip', title: '02 · Section Strip', blurb: 'A labelled ribbon of sections over a wave coloured to match; the current section lights up and cue flags sit on the ribbon.', Concept: SectionStrip },
  { id: 'overview-window', title: '03 · Overview + Window', blurb: 'A slim whole-track overview with its zoom window, over a beat-gridded wave centred on the playhead with a time bubble. Zoom is at least 2× here.', Concept: OverviewWindow },
  { id: 'pulse-ribbon', title: '04 · Pulse Ribbon', blurb: 'One smooth, glowing ribbon that fills with colour up to the playhead, where a bright dot rides the crest.', Concept: PulseRibbon },
  { id: 'led-matrix', title: '05 · LED Matrix', blurb: 'Columns of small lit cells that climb cyan, amber and red with the level, bar numbers on the downbeats.', Concept: LedMatrix },
] as const

export function DockWaveformGroupStyleGallery() {
  const [loaded, setLoaded] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [progress, setProgress] = useState(0.38)
  const track = useMemo(buildTrack, [])
  const { start, end } = visibleRange(progress, zoom)
  const view: View = { loaded, progress, zoom, start, end, track, seek: fraction => setProgress(Math.min(1, Math.max(0, fraction))), setZoom }

  return (
    <div className="llcm-gallery lldd-gallery llwf-gallery" aria-label="Audio dock waveform group concepts">
      <div className="llhs-controls" aria-label="Dock waveform states">
        <Segmented
          label="Track"
          value={loaded ? 'loaded' : 'empty'}
          onChange={id => setLoaded(id === 'loaded')}
          options={[{ id: 'loaded', label: 'Loaded' }, { id: 'empty', label: 'Empty' }]}
        />
        <Segmented
          label="Zoom"
          value={String(zoom)}
          onChange={id => setZoom(Number(id))}
          options={ZOOMS.map(value => ({ id: String(value), label: `${value}×` }))}
        />
      </div>
      <div className="llwf-list">
        {CONCEPTS.map(({ id, title, blurb, Concept }) => (
          <section key={id} className="lldd-gallery-row" data-testid={`dock-waveform-concept-${id}`}>
            <div className="lldd-gallery-copy">
              <span className="lldd-gallery-title">{title}</span>
              <span className="lldd-gallery-blurb">{blurb}</span>
            </div>
            <Concept view={view} />
          </section>
        ))}
      </div>
    </div>
  )
}
