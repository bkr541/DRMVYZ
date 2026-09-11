import { AudioWave02Icon, Add01Icon } from 'hugeicons-react'
import { IconChipButton } from '../controls/IconChipButton'

// ── TrackWorkspaceHeaderStyleGallery ─────────────────────────────────────
//
// Layout Lab / Template engine only. Four surface-finish variations on the
// winning "Solid Bar" restyle for the Lyric Manager left rail's "Track
// Workspace" title row (.lmv-rail-title) — 01 · Flat is shown live in
// production (.lmv-track-workspace > .lmv-rail-title in lyricManager.css);
// 02–04 keep the exact same light silver-to-steel base but layer a
// different surface treatment (diagonal sheen, drop shadow, beveled edge)
// on top, so only the finish is being judged. Every variant is pinned to
// the row's exact content — the AudioWave02Icon, the "Track Workspace"
// label, and the single non-functioning "Add tracks" icon button — and its
// exact height (42px) and square corners.

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
    title: '01 · Solid Bar — Flat',
    blurb: 'The plain vertical silver-to-steel gradient with near-black text, no extra surface treatment. Shipped to production.',
  },
  {
    id: 'solid-sheen',
    title: '02 · Solid Bar — Diagonal Sheen',
    blurb: 'Same silver base, but with a brighter diagonal highlight streak crossing it — a brushed/polished metal reflection rather than a flat top-to-bottom fade.',
  },
  {
    id: 'solid-shadow',
    title: '03 · Solid Bar — Drop Shadow',
    blurb: 'Same silver base, lifted off the row beneath it with a soft outer drop shadow and a crisp hairline edge — reads as a raised, physically separate plate.',
  },
  {
    id: 'solid-bevel',
    title: '04 · Solid Bar — Beveled Edge',
    blurb: 'Same silver base, with a light inset highlight along the top edge and a soft inset shadow along the bottom — a subtle metallic bevel instead of a flat fill.',
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
