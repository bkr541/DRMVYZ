import { IconChipButton } from '../controls/IconChipButton'
import { NoticeCard } from '../controls/NoticeCard'

// ── DeleteConfirmDialogStyleGallery ─────────────────────────────────────────
//
// Layout Lab / Template engine only. The winning "Centered Icon Focus"
// treatment for the canonical delete confirmation dialog — an icon badge,
// centered title/message, the standard NoticeCard, and a Cancel/Delete
// pair — now shipping as the real ConfirmDialog.tsx. This sample reuses the
// exact dv-confirm-dialog / dv-confirm-icon / dv-confirm-actions classes
// from controls/canonicalControls.css, plus the real NoticeCard and
// IconChipButton components, so it renders pixel-identical to production
// without the fixed backdrop, using the same "Delete Media Item" scenario
// the Media Manager ships today. The four runner-up concepts (Danger
// Header Band, Side Accent Split, Minimal Inline, and the pre-promotion
// Canonical Card) were removed once this one was promoted.

const TITLE = 'Delete Media Item'
const MESSAGE = "Are you sure you're wanting to delete this media item?"
const NOTICE = 'Deleted media will not be available to use within DRMVYZ.'

// Same glyph as ConfirmDialog's icon badge and NoticeCard's canonical
// warning icon — a circle-and-line exclamation mark, not a triangle.
function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CenteredIconFocusDialog() {
  return (
    <div className="dv-confirm-dialog" role="group" aria-label={TITLE}>
      <span className="dv-confirm-icon" aria-hidden="true"><WarnIcon /></span>
      <h2>{TITLE}</h2>
      <p>{MESSAGE}</p>
      <NoticeCard tone="warning" title="Heads up" role="status">{NOTICE}</NoticeCard>
      <div className="dv-confirm-actions">
        <IconChipButton type="button">Cancel</IconChipButton>
        <IconChipButton type="button" className="dv-icon-chip--danger">Delete</IconChipButton>
      </div>
    </div>
  )
}

const GALLERY_ENTRIES = [
  {
    id: 'centered-icon',
    title: '01 · Centered Icon Focus (production)',
    blurb: 'The winning treatment now shipping in ConfirmDialog.tsx — an icon badge, centered title/message, the standard NoticeCard, and Cancel/Delete actions — built from the real dv-confirm-dialog classes and NoticeCard/IconChipButton components so this sample matches production exactly.',
    Dialog: CenteredIconFocusDialog,
  },
]

export function DeleteConfirmDialogStyleGallery() {
  return (
    <div className="lldcd-gallery lldd-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Dialog />
          </div>
        </div>
      ))}
    </div>
  )
}
