import { SECTION_COLORS, formatReactSectionTypeLabel } from '../ReactTrackMapStrip'
import type { ReactSectionType } from '../ReactTypes'

// ── LyricManagerTimelineStyleGallery ─────────────────────────────────────
//
// Layout Lab / Lyric Manager engine, middle visualizer only. Three
// from-scratch concepts for Lyric Manager's Track Timeline (Track Section /
// Waveform / Beat Grid / Timing rows — see LyricTrackTimelineWindow.tsx)
// combined with its Lyric Cues timeline (3 lanes — see LyricCuesWindow.tsx,
// MAX_LYRIC_CUES_LANES), all built to resemble React View's own Track Map
// (ReactTrackMapStrip.tsx): the same lane-stack convention of a shared time
// ruler over stacked, bordered rows, section color coding reused directly
// from SECTION_COLORS. Real-shaped sample data throughout (a 3:00 track
// with six sections and ten lyric cues across three lanes) — local only,
// nothing wired to real audio, beat analysis, or lyric documents.

const DURATION_SEC = 180

interface SampleSection {
  type: ReactSectionType
  startSec: number
  endSec: number
}

const SAMPLE_SECTIONS: SampleSection[] = [
  { type: 'intro', startSec: 0, endSec: 16 },
  { type: 'verse', startSec: 16, endSec: 48 },
  { type: 'build', startSec: 48, endSec: 64 },
  { type: 'drop', startSec: 64, endSec: 96 },
  { type: 'breakdown', startSec: 96, endSec: 128 },
  { type: 'outro', startSec: 128, endSec: 180 },
]

interface SampleCue {
  lane: 0 | 1 | 2
  startSec: number
  endSec: number
  text: string
}

const SAMPLE_CUES: SampleCue[] = [
  { lane: 0, startSec: 4, endSec: 9, text: 'Feel it in the low end' },
  { lane: 1, startSec: 10, endSec: 15, text: 'Rising with the light' },
  { lane: 0, startSec: 16, endSec: 22, text: 'Hold on to the sound' },
  { lane: 2, startSec: 30, endSec: 35, text: 'Static in the sky' },
  { lane: 0, startSec: 48, endSec: 54, text: 'Here it comes again' },
  { lane: 1, startSec: 56, endSec: 61, text: 'Break the silence now' },
  { lane: 0, startSec: 64, endSec: 70, text: 'Obsessed with the fall' },
  { lane: 2, startSec: 72, endSec: 77, text: 'Chasing every echo' },
  { lane: 1, startSec: 96, endSec: 101, text: 'Fading into blue' },
  { lane: 0, startSec: 128, endSec: 134, text: 'Drifting out again' },
]

const RULER_DIVISIONS = 6

function pct(startSec: number, endSec: number = startSec): { leftPct: number; widthPct: number } {
  const leftPct = (startSec / DURATION_SEC) * 100
  const widthPct = ((endSec - startSec) / DURATION_SEC) * 100
  return { leftPct, widthPct }
}

function formatRulerTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Deterministic pseudo-waveform — organic-looking bar heights without real
// audio data, matching Track Map's waveform lane visual weight.
const WAVEFORM_BARS = Array.from({ length: 140 }, (_, i) => {
  const a = Math.abs(Math.sin(i * 0.31)) * 0.55
  const b = Math.abs(Math.sin(i * 1.74 + 1.2)) * 0.35
  const c = Math.abs(Math.sin(i * 0.07)) * 0.25
  return Math.max(0.08, Math.min(1, a + b + c))
})

function RulerRow() {
  const marks = Array.from({ length: RULER_DIVISIONS + 1 }, (_, i) => (i / RULER_DIVISIONS) * DURATION_SEC)
  return (
    <div className="llym-lane llym-lane--ruler">
      {marks.map((sec, i) => (
        <span
          key={sec}
          className="llym-ruler-mark"
          style={{ left: `${(sec / DURATION_SEC) * 100}%` }}
          data-align={i === 0 ? 'start' : i === RULER_DIVISIONS ? 'end' : 'center'}
        >
          {formatRulerTime(sec)}
        </span>
      ))}
    </div>
  )
}

// Reuses Track Map's own .rv-section-region/.rv-section-color-bar/
// .rv-section-label classes verbatim — the same reuse LyricTrackTimelineWindow.tsx's
// production TrackSectionRow makes — so section visuals need no new CSS here.
function SectionRow() {
  return (
    <div className="llym-lane llym-lane--sections">
      {SAMPLE_SECTIONS.map(section => {
        const { leftPct, widthPct } = pct(section.startSec, section.endSec)
        const color = SECTION_COLORS[section.type]
        return (
          <div
            key={section.type}
            className="rv-section-region"
            style={{ left: `${leftPct}%`, width: `${widthPct}%`, position: 'absolute', top: 0, bottom: 0, '--section-color': color } as React.CSSProperties}
            title={formatReactSectionTypeLabel(section.type)}
          >
            <span className="rv-section-color-bar" />
            <span className="rv-section-label">{formatReactSectionTypeLabel(section.type).toUpperCase()}</span>
          </div>
        )
      })}
    </div>
  )
}

function BeatGridRow() {
  return <div className="llym-lane llym-lane--beatgrid" aria-hidden="true" />
}

function WaveformRow() {
  return (
    <div className="llym-lane llym-lane--waveform" aria-hidden="true">
      <div className="llym-waveform-bars">
        {WAVEFORM_BARS.map((h, i) => <span key={i} style={{ '--h': h } as React.CSSProperties} />)}
      </div>
    </div>
  )
}

function CueLane({ lane, tall = false }: { lane: 0 | 1 | 2; tall?: boolean }) {
  const cues = SAMPLE_CUES.filter(cue => cue.lane === lane)
  return (
    <div className={`llym-lane llym-lane--cue${tall ? ' llym-lane--cue-tall' : ''}`}>
      {cues.map(cue => {
        const { leftPct, widthPct } = pct(cue.startSec, cue.endSec)
        return (
          <span key={cue.text} className="llym-cue-block" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} title={cue.text}>
            {cue.text}
          </span>
        )
      })}
    </div>
  )
}

// ── Concept 1: Stacked Lanes ──────────────────────────────────────────────
// Track Timeline's four rows and Lyric Cues' three lanes merge into one
// continuous bordered lane stack — the same box Track Map itself uses,
// just with three more rows appended, so there's only ever one timeline
// surface instead of two separately-collapsible windows.

function StackedLanesTimeline() {
  return (
    <div className="llym-stack">
      <RulerRow />
      <SectionRow />
      <BeatGridRow />
      <WaveformRow />
      <CueLane lane={0} />
      <CueLane lane={1} />
      <CueLane lane={2} />
    </div>
  )
}

// ── Concept 2: Split Stack ────────────────────────────────────────────────
// Track Timeline keeps its own bordered lane stack exactly as production
// builds it today, and Lyric Cues keeps its own separate bordered stack
// directly below — closer to the current two-window split — with a thin
// sync divider between them making explicit that both share one timeline.

function SplitStackTimeline() {
  return (
    <div className="llym-split">
      <div className="llym-stack">
        <RulerRow />
        <SectionRow />
        <BeatGridRow />
        <WaveformRow />
      </div>
      <div className="llym-sync-divider"><span>Synced to same timeline</span></div>
      <div className="llym-stack llym-stack--cues">
        <CueLane lane={0} />
        <CueLane lane={1} />
        <CueLane lane={2} />
      </div>
    </div>
  )
}

// ── Concept 3: Cue-Forward ────────────────────────────────────────────────
// Inverts the current hierarchy — the three lyric cue lanes lead, taller
// and more prominent since they're the primary editing surface, while
// Track Map's own reference lanes (section/beat/waveform) condense into one
// slim overview strip underneath instead of dominating the top of the
// window.

function CueForwardTimeline() {
  return (
    <div className="llym-stack llym-stack--cue-forward">
      <RulerRow />
      <CueLane lane={0} tall />
      <CueLane lane={1} tall />
      <CueLane lane={2} tall />
      <div className="llym-reference-strip">
        <span className="llym-reference-strip-label">Track Map reference</span>
        <div className="llym-reference-strip-lanes">
          <SectionRow />
          <BeatGridRow />
          <WaveformRow />
        </div>
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  {
    id: 'stacked-lanes',
    title: '01 · Stacked Lanes',
    blurb: "Track Timeline's four rows and Lyric Cues' three lanes merge into one continuous bordered lane stack — Track Map's own box, just with three more rows appended — instead of two separately-collapsible windows.",
    Timeline: StackedLanesTimeline,
  },
  {
    id: 'split-stack',
    title: '02 · Split Stack',
    blurb: 'Track Timeline keeps its own bordered lane stack exactly as production builds it today, and Lyric Cues keeps a separate bordered stack directly below — closer to the current two-window split — joined by a thin sync divider.',
    Timeline: SplitStackTimeline,
  },
  {
    id: 'cue-forward',
    title: '03 · Cue-Forward',
    blurb: "Inverts the hierarchy — the three lyric cue lanes lead, taller and more prominent since they're the primary editing surface, while Track Map's section/beat/waveform lanes condense into one slim reference strip underneath.",
    Timeline: CueForwardTimeline,
  },
]

export function LyricManagerTimelineStyleGallery() {
  return (
    <div className="llcm-gallery lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Timeline />
          </div>
        </div>
      ))}
    </div>
  )
}
