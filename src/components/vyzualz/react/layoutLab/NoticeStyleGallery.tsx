// ── NoticeStyleGallery ───────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Inline Flag: no card chrome at all —
// just a thin accent line and a small icon inline with the title, for
// lower-emphasis contexts where a full box would feel heavy. This is the
// winning treatment status/warning/info messages (like the Cinema runtime
// notice) converge on, shown with the same real Cinema copy the app uses.

const SAMPLE_TITLE = 'Stage 19 Composer authoring wired to canonical Cinema state'
const SAMPLE_BODY = 'Structured visuals now share one authored model with modulation routes, performance rules, cameras, and authoritative musical/lyric timeline context. Runtime previews remain transient.'

function NoticeInfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Inline Flag: no card chrome at all — just a thin accent line and a small
// flag icon inline with the title, for lower-emphasis contexts where a full
// box would feel heavy.
function InlineFlagNotice() {
  return (
    <div className="lln-flag">
      <div className="lln-flag-hdr">
        <span className="lln-flag-icon"><NoticeInfoIcon /></span>
        <strong className="lln-flag-title">{SAMPLE_TITLE}</strong>
      </div>
      <span className="lln-flag-text">{SAMPLE_BODY}</span>
    </div>
  )
}

const GALLERY_ENTRIES = [
  { id: 'flag', title: '01 · Inline Flag', blurb: 'No card chrome — a thin accent line and small flag icon for lower-emphasis, less intrusive notices.', Notice: InlineFlagNotice },
]

export function NoticeStyleGallery() {
  return (
    <div className="lln-gallery">
      {GALLERY_ENTRIES.map(entry => (
        <div key={entry.id} className="lldd-gallery-row">
          <div className="lldd-gallery-copy">
            <span className="lldd-gallery-title">{entry.title}</span>
            <span className="lldd-gallery-blurb">{entry.blurb}</span>
          </div>
          <div className="lldd-gallery-sample">
            <entry.Notice />
          </div>
        </div>
      ))}
    </div>
  )
}
