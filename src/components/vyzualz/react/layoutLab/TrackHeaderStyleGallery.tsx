import { StatusBadge } from '../controls/StatusBadge'
import { IconChipButton } from '../controls/IconChipButton'

// ── TrackHeaderStyleGallery ──────────────────────────────────────────────
//
// Layout Lab / Template engine, middle visualizer only. A from-scratch
// redesign concept for Lyric Manager's always-visible track meta header
// (LyricTrackMetaHeader.tsx — artwork, title/artist, Selected badge, Key/
// BPM/Genre/Duration chips, Open/Active version lines, Load Deck/Preview
// actions), restyled around a different metaphor than the original flat
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

// ── Concept 1: Split Rail ─────────────────────────────────────────────────
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

const GALLERY_ENTRIES = [
  {
    id: 'rail',
    title: '01 · Track Header - LyricTrackMetaHeader.tsx',
    blurb: 'A colored accent rail along the left edge with a larger square thumbnail, then two even columns — identity + versions on the left, a 2×2 stat grid with actions stacked along the far right edge instead of trailing inline.',
    Row: SplitRailRow,
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
