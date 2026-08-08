// ── NoticeStyleGallery ───────────────────────────────────────────────────────
//
// Layout Lab / Template engine only. Status/warning/info messages like the
// Cinema runtime notice ("Stage 19 Composer authoring wired to canonical
// Cinema state") are scattered throughout the app with inconsistent
// treatments (bordered card, dismissable single line, diagnostic box, plain
// info text). Three candidate styles for the one reusable notice component
// these should all converge on, shown with the same real Cinema copy so they
// can be judged side by side.

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

// 1 — Icon Rail: a colored left rail with an icon badge sitting on it,
// rounded card body to the right. Reads as a distinct "flagged" block
// without the full tinted-border box the app currently leans on everywhere.
function IconRailNotice() {
  return (
    <div className="lln-rail">
      <span className="lln-rail-bar" aria-hidden="true" />
      <span className="lln-rail-icon"><NoticeInfoIcon /></span>
      <div className="lln-rail-body">
        <strong className="lln-rail-title">{SAMPLE_TITLE}</strong>
        <span className="lln-rail-text">{SAMPLE_BODY}</span>
      </div>
    </div>
  )
}

// 2 — Glass Banner: a full bordered card with a soft diagonal gradient and
// glow, icon and title sharing a header row above the body copy. The most
// "elevated" of the three, closest in spirit to the current Cinema box but
// more polished.
function GlassBannerNotice() {
  return (
    <div className="lln-banner">
      <div className="lln-banner-hdr">
        <span className="lln-banner-icon"><NoticeInfoIcon /></span>
        <strong className="lln-banner-title">{SAMPLE_TITLE}</strong>
      </div>
      <span className="lln-banner-text">{SAMPLE_BODY}</span>
    </div>
  )
}

// 3 — Inline Flag: no card chrome at all — just a thin accent line and a
// small flag icon inline with the title, for lower-emphasis contexts where
// a full box would feel heavy.
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
  { id: 'rail', title: '01 · Icon Rail', blurb: 'A colored left rail carries an icon badge; the message sits in a softly rounded card to its right.', Notice: IconRailNotice },
  { id: 'banner', title: '02 · Glass Banner', blurb: 'A bordered, glowing card with the icon and title sharing a header row — the most elevated of the three.', Notice: GlassBannerNotice },
  { id: 'flag', title: '03 · Inline Flag', blurb: 'No card chrome — a thin accent line and small flag icon for lower-emphasis, less intrusive notices.', Notice: InlineFlagNotice },
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
