import { useState } from 'react'
import { StatusBadge } from '../controls/StatusBadge'
import { IconChipButton } from '../controls/IconChipButton'

// ── TrackHeaderStyleGallery ──────────────────────────────────────────────
//
// Layout Lab / Template engine, middle visualizer only. Five from-scratch
// redesign concepts for Lyric Manager's always-visible track meta header
// (LyricTrackMetaHeader.tsx — artwork, title/artist, Selected badge, Key/
// BPM/Genre/Duration chips, Open/Active version lines, Load Deck/Preview
// actions), each restyled around a different metaphor instead of one flat
// wrapping flex row. Real sample data throughout, matching the production
// row exactly. Reuses StatusBadge and IconChipButton directly so the
// "Selected" pill and action buttons stay pixel-identical to production;
// everything else here is new layout only, nothing wired to a real track,
// store, or deck.

const SAMPLE = {
  initials: 'TB',
  title: 'Tape B x Levity - Obsessed remix',
  artist: 'Levity, Tape B',
  musicalKey: '—',
  bpm: 173,
  genre: 'UK Dubstep',
  duration: '2:41',
  openVersionTitle: 'Tape B x Levity - Obsessed remix (original mix) AI Draft',
  activeVersionTitle: 'Tape B x Levity - Obsessed remix (original mix) AI Draft',
  loaded: false,
}

function LoadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ── Concept 1: Vinyl Deck Header ─────────────────────────────────────────
// The thumbnail becomes the same spinning-record disc as the Vinyl Row
// track-library winner (dv-track-row-disc), tying this header to that
// already-adopted visual language. Key/BPM/Genre/Duration collapse into one
// dot-separated DJ-deck readout line instead of four separate label+value
// columns, and the version pair shrinks to a single "Active" line — Open
// only shown when it differs from Active.

function VinylDeckHeaderRow() {
  return (
    <div className="lltm-row lltm-row--vinyl">
      <span className="lltm-vinyl-disc" aria-hidden="true">
        <span className="lltm-vinyl-label">{SAMPLE.initials}</span>
      </span>
      <div className="lltm-vinyl-body">
        <div className="lltm-vinyl-topline">
          <span className="lltm-vinyl-title">{SAMPLE.title}</span>
          <StatusBadge tone="selected">Selected</StatusBadge>
        </div>
        <span className="lltm-vinyl-artist">{SAMPLE.artist}</span>
        <div className="lltm-vinyl-readout">
          <span className="lltm-vinyl-readout-hl">{SAMPLE.bpm} BPM</span>
          <span className="lltm-vinyl-dot" aria-hidden="true" />
          <span>{SAMPLE.musicalKey}</span>
          <span className="lltm-vinyl-dot" aria-hidden="true" />
          <span>{SAMPLE.genre}</span>
          <span className="lltm-vinyl-dot" aria-hidden="true" />
          <span>{SAMPLE.duration}</span>
        </div>
        <span className="lltm-vinyl-active">Active · <span className="lltm-status-good">{SAMPLE.activeVersionTitle}</span></span>
      </div>
      <div className="lltm-vinyl-actions">
        <IconChipButton disabled={SAMPLE.loaded}>Load deck</IconChipButton>
        <IconChipButton tone="primary" disabled={!SAMPLE.loaded}>Preview</IconChipButton>
      </div>
    </div>
  )
}

// ── Concept 2: Ticket Stub ────────────────────────────────────────────────
// A boarding-pass split: identity on the left "stub", a die-cut dashed
// perforation, then Key/BPM/Genre/Duration as a vertical manifest list on
// the right stub instead of a horizontal chip row — the way a ticket lists
// gate/seat/zone top to bottom, not side by side.

function TicketStubRow() {
  return (
    <div className="lltm-row lltm-row--ticket">
      <div className="lltm-ticket-stub lltm-ticket-stub--main">
        <span className="lltm-ticket-art" aria-hidden="true">{SAMPLE.initials}</span>
        <div className="lltm-ticket-identity">
          <div className="lltm-ticket-topline">
            <span className="lltm-ticket-title">{SAMPLE.title}</span>
            <StatusBadge tone="selected">Selected</StatusBadge>
          </div>
          <span className="lltm-ticket-artist">{SAMPLE.artist}</span>
          <dl className="lltm-ticket-versions">
            <div><dt>Open</dt><dd>{SAMPLE.openVersionTitle}</dd></div>
            <div><dt>Active</dt><dd className="lltm-status-good">{SAMPLE.activeVersionTitle}</dd></div>
          </dl>
        </div>
      </div>
      <div className="lltm-ticket-perforation" aria-hidden="true" />
      <div className="lltm-ticket-stub lltm-ticket-stub--manifest">
        <dl className="lltm-ticket-manifest">
          <div><dt>Key</dt><dd>{SAMPLE.musicalKey}</dd></div>
          <div><dt>BPM</dt><dd>{SAMPLE.bpm}</dd></div>
          <div><dt>Genre</dt><dd>{SAMPLE.genre}</dd></div>
          <div><dt>Duration</dt><dd>{SAMPLE.duration}</dd></div>
        </dl>
        <div className="lltm-ticket-actions">
          <IconChipButton disabled={SAMPLE.loaded}>Load deck</IconChipButton>
          <IconChipButton tone="primary" disabled={!SAMPLE.loaded}>Preview</IconChipButton>
        </div>
      </div>
    </div>
  )
}

// ── Concept 3: Session Console ────────────────────────────────────────────
// BPM gets its own inset LCD-style readout — large monospace digits on a
// recessed screen, the way a hardware deck reads tempo — with Key, Genre,
// and Duration as smaller secondary readouts beside it. Title/artist/badge
// sit above the console as a header strip; versions and actions share a
// footer row below it.

function SessionConsoleRow() {
  return (
    <div className="lltm-row lltm-row--console">
      <div className="lltm-console-hdr">
        <span className="lltm-console-art" aria-hidden="true">{SAMPLE.initials}</span>
        <div className="lltm-console-identity">
          <div className="lltm-console-topline">
            <span className="lltm-console-title">{SAMPLE.title}</span>
            <StatusBadge tone="selected">Selected</StatusBadge>
          </div>
          <span className="lltm-console-artist">{SAMPLE.artist}</span>
        </div>
      </div>
      <div className="lltm-console-screens">
        <div className="lltm-console-screen lltm-console-screen--bpm">
          <span className="lltm-console-screen-label">BPM</span>
          <span className="lltm-console-screen-value">{SAMPLE.bpm}</span>
        </div>
        <div className="lltm-console-screen">
          <span className="lltm-console-screen-label">Key</span>
          <span className="lltm-console-screen-value">{SAMPLE.musicalKey}</span>
        </div>
        <div className="lltm-console-screen">
          <span className="lltm-console-screen-label">Genre</span>
          <span className="lltm-console-screen-value">{SAMPLE.genre}</span>
        </div>
        <div className="lltm-console-screen">
          <span className="lltm-console-screen-label">Duration</span>
          <span className="lltm-console-screen-value">{SAMPLE.duration}</span>
        </div>
      </div>
      <div className="lltm-console-footer">
        <dl className="lltm-ticket-versions lltm-console-versions">
          <div><dt>Open</dt><dd>{SAMPLE.openVersionTitle}</dd></div>
          <div><dt>Active</dt><dd className="lltm-status-good">{SAMPLE.activeVersionTitle}</dd></div>
        </dl>
        <div className="lltm-console-actions">
          <IconChipButton disabled={SAMPLE.loaded}>Load deck</IconChipButton>
          <IconChipButton tone="primary" disabled={!SAMPLE.loaded}>Preview</IconChipButton>
        </div>
      </div>
    </div>
  )
}

// ── Concept 4: Split Rail ─────────────────────────────────────────────────
// A colored accent rail along the left edge (cyan — would follow genre or
// selection state in production) with a larger square thumbnail beside it,
// then two even columns: identity + versions on the left, a 2×2 stat grid
// with actions stacked along the far right edge instead of trailing inline.

function SplitRailRow() {
  return (
    <div className="lltm-row lltm-row--rail">
      <span className="lltm-rail-accent" aria-hidden="true" />
      <span className="lltm-rail-art" aria-hidden="true">{SAMPLE.initials}</span>
      <div className="lltm-rail-col lltm-rail-col--identity">
        <div className="lltm-rail-topline">
          <span className="lltm-rail-title">{SAMPLE.title}</span>
          <StatusBadge tone="selected">Selected</StatusBadge>
        </div>
        <span className="lltm-rail-artist">{SAMPLE.artist}</span>
        <dl className="lltm-ticket-versions">
          <div><dt>Open</dt><dd>{SAMPLE.openVersionTitle}</dd></div>
          <div><dt>Active</dt><dd className="lltm-status-good">{SAMPLE.activeVersionTitle}</dd></div>
        </dl>
      </div>
      <div className="lltm-rail-stats">
        <span className="lltm-rail-stat"><span className="lltm-rail-stat-label">Key</span><span className="lltm-rail-stat-value">{SAMPLE.musicalKey}</span></span>
        <span className="lltm-rail-stat"><span className="lltm-rail-stat-label">BPM</span><span className="lltm-rail-stat-value">{SAMPLE.bpm}</span></span>
        <span className="lltm-rail-stat"><span className="lltm-rail-stat-label">Genre</span><span className="lltm-rail-stat-value">{SAMPLE.genre}</span></span>
        <span className="lltm-rail-stat"><span className="lltm-rail-stat-label">Duration</span><span className="lltm-rail-stat-value">{SAMPLE.duration}</span></span>
      </div>
      <div className="lltm-rail-actions">
        <IconChipButton disabled={SAMPLE.loaded}>Load deck</IconChipButton>
        <IconChipButton tone="primary" disabled={!SAMPLE.loaded}>Preview</IconChipButton>
      </div>
    </div>
  )
}

// ── Concept 5: Compact Strip ──────────────────────────────────────────────
// The whole header collapses to one ~40px line — small art, title and
// artist joined inline by a middot instead of stacked, the Selected badge
// reduced to a colored dot, and stats condensed to one small inline string.
// Open/Active versions move behind a disclosure chevron so they cost zero
// height until asked for; actions become icon-only chips.

function CompactStripRow() {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="lltm-row lltm-row--strip">
      <div className="lltm-strip-bar">
        <span className="lltm-strip-art" aria-hidden="true">{SAMPLE.initials}</span>
        <span className="lltm-strip-dot" title="Selected" aria-label="Selected" />
        <span className="lltm-strip-title">{SAMPLE.title}</span>
        <span className="lltm-strip-sep" aria-hidden="true">·</span>
        <span className="lltm-strip-artist">{SAMPLE.artist}</span>
        <span className="lltm-strip-stats">{SAMPLE.bpm} BPM · {SAMPLE.musicalKey} · {SAMPLE.genre} · {SAMPLE.duration}</span>
        <button
          type="button"
          className="lltm-strip-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide versions' : 'Show versions'}
          onClick={() => setExpanded(value => !value)}
        >
          <ChevronIcon open={expanded} />
        </button>
        <IconChipButton icon={<LoadIcon />} aria-label="Load deck" disabled={SAMPLE.loaded} />
        <IconChipButton tone="primary" icon={<PlayIcon />} aria-label="Preview" disabled={!SAMPLE.loaded} />
      </div>
      {expanded && (
        <dl className="lltm-ticket-versions lltm-strip-versions">
          <div><dt>Open</dt><dd>{SAMPLE.openVersionTitle}</dd></div>
          <div><dt>Active</dt><dd className="lltm-status-good">{SAMPLE.activeVersionTitle}</dd></div>
        </dl>
      )}
    </div>
  )
}

const GALLERY_ENTRIES = [
  {
    id: 'vinyl',
    title: '01 · Vinyl Deck Header',
    blurb: 'The thumbnail becomes the same spinning-record disc as the Vinyl Row track-library winner. Key/BPM/Genre/Duration collapse into one dot-separated DJ-deck readout line instead of four label+value columns, and only the Active version shows.',
    Row: VinylDeckHeaderRow,
  },
  {
    id: 'ticket',
    title: '02 · Ticket Stub',
    blurb: 'A boarding-pass split — identity on the left stub, a die-cut dashed perforation, then Key/BPM/Genre/Duration as a vertical manifest list on the right stub instead of a horizontal chip row.',
    Row: TicketStubRow,
  },
  {
    id: 'console',
    title: '03 · Session Console',
    blurb: 'BPM gets its own inset LCD-style readout with large monospace digits, Key/Genre/Duration as smaller secondary screens beside it. Title/artist/badge sit above as a header strip; versions and actions share a footer row below.',
    Row: SessionConsoleRow,
  },
  {
    id: 'rail',
    title: '04 · Split Rail',
    blurb: 'A colored accent rail along the left edge with a larger square thumbnail, then two even columns — identity + versions on the left, a 2×2 stat grid with actions stacked along the far right edge instead of trailing inline.',
    Row: SplitRailRow,
  },
  {
    id: 'strip',
    title: '05 · Compact Strip',
    blurb: 'The whole header collapses to one ~40px line — title and artist joined inline, the Selected badge reduced to a colored dot, stats condensed to one string, and Open/Active versions moved behind a disclosure chevron so they cost zero height until asked for.',
    Row: CompactStripRow,
  },
]

export function TrackHeaderStyleGallery() {
  return (
    <div className="llcm-gallery lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Row />
          </div>
        </div>
      ))}
    </div>
  )
}
