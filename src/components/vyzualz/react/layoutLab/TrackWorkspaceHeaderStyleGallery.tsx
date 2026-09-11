import { AudioWave02Icon, Add01Icon } from 'hugeicons-react'
import { IconChipButton } from '../controls/IconChipButton'

// ── TrackWorkspaceHeaderStyleGallery ─────────────────────────────────────
//
// Layout Lab / Template engine only. Restyle candidates for the Lyric
// Manager left rail's "Track Workspace" title row (.lmv-rail-title),
// explored from a reference moodboard of solid/gradient/angled/split bar
// treatments. Every variant is pinned to the current row's exact content —
// the AudioWave02Icon, the "Track Workspace" label, and the single
// non-functioning "Add tracks" icon button — and its exact height (42px),
// so only the frame around that content is being judged, not new content.

function AddTracksButton({ className }: { className: string }) {
  return (
    <IconChipButton
      className={`lltwh-plus-btn ${className}`}
      icon={<Add01Icon size={14} color="currentColor" />}
      onClick={() => {}}
      title="Add tracks"
      aria-label="Add tracks"
    />
  )
}

function TitleRow({ variant }: { variant: string }) {
  return (
    <div className={`lltwh-row lltwh-row--${variant}`}>
      <AudioWave02Icon size={15} color="currentColor" aria-hidden="true" />
      <span>Track Workspace</span>
      <AddTracksButton className={`lltwh-plus-btn--${variant}`} />
    </div>
  )
}

const GALLERY_ENTRIES = [
  {
    id: 'solid',
    title: '01 · Solid Bar (Clean & Modern)',
    blurb: 'A flat, light silver-to-steel gradient bar with near-black text — the highest-contrast, most "pressed button" reading of the row.',
  },
  {
    id: 'gradient',
    title: '02 · Gradient Bar (Premium)',
    blurb: 'A dark diagonal gradient with a soft inner sheen along the top edge — the current dark theme kept, but with more depth than a flat fill.',
  },
  {
    id: 'angled',
    title: '03 · Angled Tab (Tech)',
    blurb: 'The top-left corner is clipped into an angled tab, with a short cyan accent bar tracing the cut — a HUD/console read.',
  },
  {
    id: 'split',
    title: '04 · Split Bar (Functional)',
    blurb: 'The bar is divided into a light identity zone (icon + label) and a dark action zone (the button), with a hard seam between them.',
  },
  {
    id: 'outline',
    title: '05 · Outline Frame (Minimal)',
    blurb: 'No fill at all — just a thin cyan hairline border on a transparent bar, so the row reads as a frame rather than a panel.',
  },
  {
    id: 'underline',
    title: '06 · Underline Accent (Editorial)',
    blurb: 'No box whatsoever — a bold cyan underline is the only separator, closest to a magazine section header.',
  },
  {
    id: 'bevel',
    title: '07 · Beveled Panel (Hardware)',
    blurb: 'A skeuomorphic inset/outset bevel (light top edge, dark bottom edge) — reads like a physical console panel rather than a flat UI bar.',
  },
  {
    id: 'glass',
    title: '08 · Glass Panel (Frosted)',
    blurb: 'A translucent, blurred glass bar with a faint cyan glow — the lightest-weight, most "floating" treatment of the set.',
  },
]

export function TrackWorkspaceHeaderStyleGallery() {
  return (
    <div className="lltwh-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <TitleRow variant={entry.id} />
          </div>
        </div>
      ))}
    </div>
  )
}
