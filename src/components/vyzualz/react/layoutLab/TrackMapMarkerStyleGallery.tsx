import { useState, type CSSProperties } from 'react'

// ── TrackMapMarkerStyleGallery ───────────────────────────────────────────
//
// Layout Lab / Template, middle section. Six ways to draw the Track Map's four marker rows — Cues, Phrases, Moments and Actions —
// so they stay readable on a dense track. Every concept draws the same generated data (clustered hot cues, a run of 8-bar phrases,
// moments bunched around the drop, a few actions) at full width, in the production Track Map's four rows with a count per row on the
// right. Concepts 01, 02, 04 and 05 clamp each label to the space before the next marker in its row, so labels never overlap;
// 03 shows labels only for the selected marker; 06 staggers neighbours onto two levels. Presentation only — nothing is wired
// to a track, the audio engine or a store.

type Kind = 'cue' | 'phrase' | 'moment' | 'action'

interface Marker { id: string; kind: Kind; at: number; label: string; code: string; color: string }

const ROWS: ReadonlyArray<{ kind: Kind; label: string }> = [
  { kind: 'cue', label: 'Cues' },
  { kind: 'phrase', label: 'Phrases' },
  { kind: 'moment', label: 'Moments' },
  { kind: 'action', label: 'Actions' },
]

const PHRASE_BLUE = '#5b8def'
const MOMENT_GOLD = '#d8b95a'
const MOMENT_RED = '#e0566e'
const ACTION_CYAN = '#4ac7db'

function make(kind: Kind, entries: ReadonlyArray<[number, string, string, string]>): Marker[] {
  return entries.map(([at, label, code, color], index) => ({ id: `${kind}-${index}`, kind, at, label, code, color }))
}

const MARKERS: readonly Marker[] = [
  ...make('cue', [
    [0.05, 'Memory Cue', 'MEM', '#9aa7ad'],
    [0.31, 'Hot Cue B', 'HC B', '#4ac7db'],
    [0.36, 'Hot Cue C', 'HC C', '#61d6aa'],
    [0.41, 'Hot Cue D', 'HC D', '#e0b95a'],
  ]),
  ...make('phrase', Array.from({ length: 12 }, (_, i): [number, string, string, string] => {
    const bars = i === 4 || i === 8 ? 16 : 8
    return [0.035 + i * 0.0785, `${bars}-bar phrase`, `${bars}B`, PHRASE_BLUE]
  })),
  ...make('moment', [
    [0.19, 'Energy release', 'REL', MOMENT_GOLD],
    [0.255, 'Build start', 'BUILD', MOMENT_GOLD],
    [0.31, 'Drop impact', 'DROP', MOMENT_RED],
    [0.345, 'Fakeout candidate', 'FAKE', MOMENT_GOLD],
    [0.41, 'Drop impact', 'DROP', MOMENT_RED],
    [0.56, 'Breakdown', 'BRK', MOMENT_GOLD],
    [0.74, 'Energy release', 'REL', MOMENT_GOLD],
    [0.775, 'Build start', 'BUILD', MOMENT_GOLD],
    [0.83, 'Drop impact', 'DROP', MOMENT_RED],
  ]),
  ...make('action', [
    [0.31, 'Strobe burst', 'STRB', ACTION_CYAN],
    [0.41, 'Palette → Warm', 'PAL', ACTION_CYAN],
    [0.6, 'Camera cut', 'CUT', ACTION_CYAN],
  ]),
]

const rowOf = (kind: Kind) => MARKERS.filter(marker => marker.kind === kind).sort((a, b) => a.at - b.at)

/** Percent of the lane width available to a marker before the next one in its row (or the lane's end), less a small gap. */
function gapPct(items: readonly Marker[], index: number, skip = 1): number {
  const next = items[index + skip]
  const end = next ? next.at : 1
  return Math.max(0, (end - items[index]!.at) * 100 - 0.25)
}

const pct = (at: number) => `${(at * 100).toFixed(3)}%`
const tint = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, transparent)`

function RowTools({ kind }: { kind: Kind }) {
  const row = ROWS.find(item => item.kind === kind)!
  return (
    <div className="lltm-tools">
      <span>{row.label}</span>
      <strong>{rowOf(kind).length}</strong>
    </div>
  )
}

/** The four production rows around whatever the concept draws inside each lane. */
function Board({ children, rowHeight = 32 }: { children: (kind: Kind, items: Marker[]) => React.ReactNode; rowHeight?: number }) {
  return (
    <div className="lltm-board" style={{ '--lltm-row': `${rowHeight}px` } as CSSProperties}>
      {ROWS.map(({ kind }) => (
        <div key={kind} className="lltm-row">
          <div className="lltm-lane" data-kind={kind}>{children(kind, rowOf(kind))}</div>
          <RowTools kind={kind} />
        </div>
      ))}
    </div>
  )
}

const style = (vars: Record<string, string | number>) => vars as CSSProperties

// ── Concepts ──────────────────────────────────────────────────────────────

/** 01 — opaque coloured tags with dark bold text; every tag is clamped to the space before the next marker, so none overlap. */
function SolidTags() {
  return (
    <Board>
      {(_, items) => items.map((marker, index) => (
        <span key={marker.id} className="lltm-c1-tag" title={marker.label} style={style({ left: pct(marker.at), width: `${gapPct(items, index)}%`, '--c': marker.color })}>
          {marker.label}
        </span>
      ))}
    </Board>
  )
}

/** 02 — a thin stem with a head dot, the label beside it in plain light text; a label drops out when its gap is too narrow to read. */
function StemFlags() {
  return (
    <Board>
      {(_, items) => items.map((marker, index) => {
        const room = gapPct(items, index)
        return (
          <span key={marker.id} className="lltm-c2-flag" title={marker.label} style={style({ left: pct(marker.at), width: `${room}%`, '--c': marker.color })}>
            <i aria-hidden="true" />
            {room > 5 && <span>{marker.label}</span>}
          </span>
        )
      })}
    </Board>
  )
}

/** 03 — just a small glyph per marker; the selected one shows its full label on a card above. Click any glyph to read it. */
function DotsOnSelect() {
  const [selected, setSelected] = useState<string>('moment-2')
  return (
    <Board>
      {(_, items) => items.map(marker => {
        const active = marker.id === selected
        return (
          <button
            key={marker.id}
            type="button"
            className={`lltm-c3-dot${active ? ' is-active' : ''}`}
            title={marker.label}
            aria-pressed={active}
            style={style({ left: pct(marker.at), '--c': marker.color })}
            onClick={() => setSelected(marker.id)}
          >
            <span aria-hidden="true" />
            {active && <em className="lltm-c3-card" style={marker.at > 0.8 ? { right: 14, left: 'auto' } : undefined}>{marker.label}</em>}
          </button>
        )
      })}
    </Board>
  )
}

/** 04 — phrases become one continuous run of bars (each phrase from its start to the next) with the bar count inside; the other rows use clamped pills. */
function RangeBars() {
  return (
    <Board>
      {(kind, items) => items.map((marker, index) => (
        kind === 'phrase' ? (
          <span key={marker.id} className={`lltm-c4-span${index % 2 ? ' is-alt' : ''}`} title={marker.label} style={style({ left: pct(marker.at), width: `${(((items[index + 1]?.at ?? 1) - marker.at) * 100).toFixed(3)}%` })}>
            {marker.code}
          </span>
        ) : (
          <span key={marker.id} className="lltm-c4-pill" title={marker.label} style={style({ left: pct(marker.at), width: `${gapPct(items, index)}%`, '--c': marker.color })}>
            <i aria-hidden="true" />{marker.label}
          </span>
        )
      ))}
    </Board>
  )
}

const GLYPHS: Record<Kind, string> = {
  cue: 'M2 1h8l-4 8z',
  phrase: 'M2 1h3M2 1v8M2 9h3M10 1H7M10 1v8M10 9H7',
  moment: 'M7 0 2 6h3l-1 5 6-7H7z',
  action: 'M2 2h8v8H2z',
}

/** 05 — a distinct shape per kind (flag, bracket, bolt, square) with a short monospace code; compact enough to stay legible when crowded. */
function GlyphCodes() {
  return (
    <Board>
      {(kind, items) => items.map((marker, index) => (
        <span key={marker.id} className="lltm-c5-mark" title={marker.label} style={style({ left: pct(marker.at), width: `${gapPct(items, index)}%`, '--c': marker.color })}>
          <svg viewBox="0 0 12 11" aria-hidden="true">
            <path d={GLYPHS[kind]} fill={kind === 'cue' || kind === 'moment' || kind === 'action' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <b>{marker.code}</b>
        </span>
      ))}
    </Board>
  )
}

/** 06 — neighbours alternate between two levels, with a strong color-coded left edge marking each label's start. */
function Staggered() {
  return (
    <Board rowHeight={46}>
      {(_, items) => items.map((marker, index) => (
        <span
          key={marker.id}
          className={`lltm-c6-tag ${index % 2 ? 'is-low' : 'is-high'}`}
          title={marker.label}
          style={style({ left: pct(marker.at), width: `${gapPct(items, index, 2)}%`, '--c': marker.color })}
        >
          <span>{marker.label}</span>
        </span>
      ))}
    </Board>
  )
}

const CONCEPTS = [
  { id: 'solid-tags', title: '01 · Solid Tags', blurb: 'Opaque coloured tags with dark bold text, each clamped to the space before the next marker so labels never overlap.', Concept: SolidTags },
  { id: 'stem-flags', title: '02 · Stem Flags', blurb: 'A thin stem and head dot per marker with plain light text beside it; a label drops out when its gap is too narrow, leaving just the stem.', Concept: StemFlags },
  { id: 'dots-on-select', title: '03 · Dots on Select', blurb: 'Only a small glyph per marker. The selected marker shows its full label on a card; click any glyph to read it.', Concept: DotsOnSelect },
  { id: 'range-bars', title: '04 · Range Bars', blurb: 'Phrases become one continuous run of bars with the bar count inside; cues, moments and actions are clamped pills.', Concept: RangeBars },
  { id: 'glyph-codes', title: '05 · Glyph Codes', blurb: 'A distinct shape per kind (flag, bracket, bolt, square) with a short monospace code such as HC B, 8B, DROP.', Concept: GlyphCodes },
  { id: 'staggered', title: '06 · Staggered Levels', blurb: 'Neighbours alternate between an upper and a lower level, so each label gets twice the room, in taller rows.', Concept: Staggered },
] as const

export function TrackMapMarkerStyleGallery() {
  return (
    <div className="llcm-gallery lldd-gallery lltm-gallery" aria-label="Track Map marker row concepts">
      <div className="lltm-list">
        {CONCEPTS.map(({ id, title, blurb, Concept }) => (
          <section key={id} className="lldd-gallery-row" data-testid={`track-map-marker-concept-${id}`}>
            <div className="lldd-gallery-copy">
              <span className="lldd-gallery-title">{title}</span>
              <span className="lldd-gallery-blurb">{blurb}</span>
            </div>
            <Concept />
          </section>
        ))}
      </div>
    </div>
  )
}
