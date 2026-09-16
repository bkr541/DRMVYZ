import { useState } from 'react'
import { RailWindowHeader } from '../../layout/RailWindowHeader'
import { StatusBadge } from '../controls/StatusBadge'
import { IconChipButton } from '../controls/IconChipButton'

// ── LyricTrackMetaWindowStyleGallery ─────────────────────────────────────────
//
// Layout Lab / Template engine only. Candidate layouts for relocating the
// loaded-track summary (today: LyricTrackMetaHeader.tsx, living inline at the
// top of Live Preview's body) into its own dedicated window in the right
// rail, above Document Workspace. Live Preview's "Split Rail" treatment
// (accent rail + artwork + identity column + 2×2 stat grid + actions, all
// laid out horizontally) was built for the wide center column — none of
// these five assume that width; each is a genuinely different way to fit
// the same fields (title, artist, Selected/Loaded/Playing state, open/active
// version, Key/BPM/Genre/Duration, Load + Preview actions) into a narrow
// rail column. Each owns its own mock state so judging one doesn't disturb
// the others.

const MOCK_TRACK = {
  title: 'Afterglow (Extended Mix)',
  artist: 'Nova Ridge',
  initials: 'NR',
  openVersion: 'Radio Edit v3',
  activeVersion: 'Radio Edit v3',
  key: 'A Minor',
  bpm: 128,
  genre: 'Progressive House',
  duration: '5:42',
}

function TrackWindowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  )
}

function TrackAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`lltm-avatar lltm-avatar--${size}`} aria-hidden="true">{MOCK_TRACK.initials}</span>
}

function TrackBadges() {
  return (
    <span className="lltm-badges">
      <StatusBadge tone="selected">Selected</StatusBadge>
      <StatusBadge tone="loaded">Loaded</StatusBadge>
    </span>
  )
}

// ── 01 · Compact Identity Card ───────────────────────────────────────────────
// A condensed, vertically-stacked version of Live Preview's own Split Rail:
// avatar + identity on one line, a 2×2 chip grid, a two-line version summary,
// and stacked actions — same information architecture, just narrow.

function CompactIdentityCard() {
  return (
    <div className="lltm-window">
      <RailWindowHeader side="right" icon={<TrackWindowIcon />} label="Loaded Track" />
      <div className="lltm-body lltm-body--compact">
        <div className="lltm-compact-top">
          <TrackAvatar />
          <div className="lltm-compact-identity">
            <span className="lltm-title">{MOCK_TRACK.title}</span>
            <span className="lltm-artist">{MOCK_TRACK.artist}</span>
          </div>
        </div>
        <TrackBadges />
        <div className="lltm-chip-grid">
          <span className="lltm-chip"><span className="lltm-chip-label">Key</span><span className="lltm-chip-value">{MOCK_TRACK.key}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">BPM</span><span className="lltm-chip-value">{MOCK_TRACK.bpm}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">Genre</span><span className="lltm-chip-value">{MOCK_TRACK.genre}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">Duration</span><span className="lltm-chip-value">{MOCK_TRACK.duration}</span></span>
        </div>
        <dl className="lltm-versions">
          <div><dt>Open version</dt><dd>{MOCK_TRACK.openVersion}</dd></div>
          <div><dt>Active version</dt><dd className="lltm-status-good">{MOCK_TRACK.activeVersion}</dd></div>
        </dl>
        <div className="lltm-actions lltm-actions--row">
          <IconChipButton>Reload deck</IconChipButton>
          <IconChipButton tone="primary">Preview</IconChipButton>
        </div>
      </div>
    </div>
  )
}

// ── 02 · Hero Banner ──────────────────────────────────────────────────────
// The artwork placeholder becomes a full-width gradient banner with the
// title/artist overlaid at its base, corner-anchored icon actions, and
// chips as a wrapped flex row underneath instead of a grid.

function HeroBanner() {
  return (
    <div className="lltm-window">
      <RailWindowHeader side="right" icon={<TrackWindowIcon />} label="Loaded Track" />
      <div className="lltm-body lltm-body--hero">
        <div className="lltm-hero-banner">
          <span className="lltm-hero-avatar" aria-hidden="true">{MOCK_TRACK.initials}</span>
          <div className="lltm-hero-actions">
            <IconChipButton title="Reload deck" aria-label="Reload deck">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 1 3 6.7M3 12V6m0 6h6" /></svg>
            </IconChipButton>
            <IconChipButton tone="primary" title="Preview" aria-label="Preview">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </IconChipButton>
          </div>
          <div className="lltm-hero-caption">
            <span className="lltm-title">{MOCK_TRACK.title}</span>
            <span className="lltm-artist">{MOCK_TRACK.artist}</span>
          </div>
        </div>
        <TrackBadges />
        <div className="lltm-chip-wrap">
          <span className="lltm-chip"><span className="lltm-chip-label">Key</span><span className="lltm-chip-value">{MOCK_TRACK.key}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">BPM</span><span className="lltm-chip-value">{MOCK_TRACK.bpm}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">Genre</span><span className="lltm-chip-value">{MOCK_TRACK.genre}</span></span>
          <span className="lltm-chip"><span className="lltm-chip-label">Duration</span><span className="lltm-chip-value">{MOCK_TRACK.duration}</span></span>
        </div>
      </div>
    </div>
  )
}

// ── 03 · Diagnostic List ──────────────────────────────────────────────────
// No avatar at all — every field (including title/artist) reads as one
// dense label/value list, the same "quiet data" treatment as the Output
// tab's Cinema2RuntimeDiagnostics rows. The densest, most text-forward of
// the five.

function DiagnosticListRow({ label, value, tone }: { label: string; value: string; tone?: 'good' }) {
  return (
    <div className="lltm-diag-row">
      <span className="lltm-diag-label">{label}</span>
      <span className={`lltm-diag-value${tone === 'good' ? ' lltm-status-good' : ''}`}>{value}</span>
    </div>
  )
}

function DiagnosticList() {
  return (
    <div className="lltm-window">
      <RailWindowHeader side="right" icon={<TrackWindowIcon />} label="Loaded Track" />
      <div className="lltm-body lltm-body--diagnostic">
        <div className="lltm-diag-top">
          <span className="lltm-title">{MOCK_TRACK.title}</span>
          <TrackBadges />
        </div>
        <DiagnosticListRow label="Artist" value={MOCK_TRACK.artist} />
        <DiagnosticListRow label="Open version" value={MOCK_TRACK.openVersion} />
        <DiagnosticListRow label="Active version" value={MOCK_TRACK.activeVersion} tone="good" />
        <DiagnosticListRow label="Key" value={MOCK_TRACK.key} />
        <DiagnosticListRow label="BPM" value={String(MOCK_TRACK.bpm)} />
        <DiagnosticListRow label="Genre" value={MOCK_TRACK.genre} />
        <DiagnosticListRow label="Duration" value={MOCK_TRACK.duration} />
        <div className="lltm-actions lltm-actions--row">
          <IconChipButton>Reload deck</IconChipButton>
          <IconChipButton tone="primary">Preview</IconChipButton>
        </div>
      </div>
    </div>
  )
}

// ── 04 · Chip Rail Sidebar ────────────────────────────────────────────────
// A small compact header line (avatar + identity), then every field —
// including the two version fields — unified into one full-width vertical
// rail of label/value rows instead of a grid, closing with stacked
// full-width actions built for a narrow column.

function ChipRailSidebar() {
  return (
    <div className="lltm-window">
      <RailWindowHeader side="right" icon={<TrackWindowIcon />} label="Loaded Track" />
      <div className="lltm-body lltm-body--rail">
        <div className="lltm-rail-top">
          <TrackAvatar size="sm" />
          <div className="lltm-compact-identity">
            <span className="lltm-title">{MOCK_TRACK.title}</span>
            <span className="lltm-artist">{MOCK_TRACK.artist}</span>
          </div>
        </div>
        <TrackBadges />
        <div className="lltm-chip-rail">
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">Key</span><span className="lltm-chip-value">{MOCK_TRACK.key}</span></span>
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">BPM</span><span className="lltm-chip-value">{MOCK_TRACK.bpm}</span></span>
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">Genre</span><span className="lltm-chip-value">{MOCK_TRACK.genre}</span></span>
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">Duration</span><span className="lltm-chip-value">{MOCK_TRACK.duration}</span></span>
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">Open version</span><span className="lltm-chip-value">{MOCK_TRACK.openVersion}</span></span>
          <span className="lltm-chip-rail-row"><span className="lltm-chip-label">Active version</span><span className="lltm-chip-value lltm-status-good">{MOCK_TRACK.activeVersion}</span></span>
        </div>
        <div className="lltm-actions lltm-actions--stack">
          <IconChipButton>Reload deck</IconChipButton>
          <IconChipButton tone="primary">Preview</IconChipButton>
        </div>
      </div>
    </div>
  )
}

// ── 05 · Collapsible Summary ──────────────────────────────────────────────
// The only entry with a genuinely different interaction, not just a
// different arrangement: collapsed by default to a single compact row
// (avatar, title, Key · BPM inline, chevron) so the window can sit above
// Document Workspace without costing much vertical space; expands in place
// to reveal artist, both versions, remaining chips, and actions.

function CollapsibleSummary() {
  const [open, setOpen] = useState(false)
  return (
    <div className="lltm-window">
      <RailWindowHeader side="right" icon={<TrackWindowIcon />} label="Loaded Track" />
      <div className="lltm-body lltm-body--collapsible">
        <button type="button" className="lltm-collapse-summary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <TrackAvatar size="sm" />
          <span className="lltm-collapse-title">{MOCK_TRACK.title}</span>
          <span className="lltm-collapse-inline">{MOCK_TRACK.key} · {MOCK_TRACK.bpm} BPM</span>
          <span className={`lltm-collapse-chevron${open ? ' is-open' : ''}`} aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="lltm-collapse-detail">
            <span className="lltm-artist">{MOCK_TRACK.artist}</span>
            <TrackBadges />
            <div className="lltm-chip-grid">
              <span className="lltm-chip"><span className="lltm-chip-label">Genre</span><span className="lltm-chip-value">{MOCK_TRACK.genre}</span></span>
              <span className="lltm-chip"><span className="lltm-chip-label">Duration</span><span className="lltm-chip-value">{MOCK_TRACK.duration}</span></span>
            </div>
            <dl className="lltm-versions">
              <div><dt>Open version</dt><dd>{MOCK_TRACK.openVersion}</dd></div>
              <div><dt>Active version</dt><dd className="lltm-status-good">{MOCK_TRACK.activeVersion}</dd></div>
            </dl>
            <div className="lltm-actions lltm-actions--row">
              <IconChipButton>Reload deck</IconChipButton>
              <IconChipButton tone="primary">Preview</IconChipButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'compact', title: '01 · Loaded Track Window - LyricTrackMetaHeader.tsx', blurb: 'A condensed, vertically-stacked version of Live Preview’s own Split Rail treatment: avatar + identity, badges, a 2×2 chip grid, a two-line version summary, and stacked actions.', Layout: CompactIdentityCard },
  { id: 'hero', title: '02 · Loaded Track Window - LyricTrackMetaHeader.tsx', blurb: 'The artwork placeholder becomes a full-width gradient banner with the title/artist overlaid at its base and corner icon actions; chips wrap in a flex row underneath instead of a grid.', Layout: HeroBanner },
  { id: 'diagnostic', title: '03 · Loaded Track Window - LyricTrackMetaHeader.tsx', blurb: 'No avatar — every field, including title and artist, reads as one dense label/value list, the same quiet-data treatment as Output’s Cinema2RuntimeDiagnostics rows.', Layout: DiagnosticList },
  { id: 'rail', title: '04 · Loaded Track Window - LyricTrackMetaHeader.tsx', blurb: 'A compact avatar + identity header, then every field — including both versions — unified into one full-width vertical rail of rows, closing with stacked full-width actions.', Layout: ChipRailSidebar },
  { id: 'collapsible', title: '05 · Loaded Track Window - LyricTrackMetaHeader.tsx', blurb: 'Collapsed by default to one compact row (avatar, title, Key · BPM); expands in place to reveal artist, both versions, remaining chips, and actions — the only entry with a different interaction, not just a different arrangement.', Layout: CollapsibleSummary },
]

export function LyricTrackMetaWindowStyleGallery() {
  return (
    <div className="lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Layout />
          </div>
        </div>
      ))}
    </div>
  )
}
