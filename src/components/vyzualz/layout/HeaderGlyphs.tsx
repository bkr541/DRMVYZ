/** Header-key glyphs shared by every page's control group (stroke styling comes from HeaderControlGroup.css). */

export function SaveGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3.5h12l2 2v15H5z" />
      <path d="M8 3.5v6h8v-6M8 20.5v-7h8v7" />
    </svg>
  )
}

/** Save with a small sparkle: "Save + Make Active". */
export function SaveActiveGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3.5h12l2 2v15H5z" />
      <path d="M8 3.5v6h8v-6M8 20.5v-7h8v7" />
      <path className="vz-header-glyph-mark" d="M18.5 11l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" />
    </svg>
  )
}
