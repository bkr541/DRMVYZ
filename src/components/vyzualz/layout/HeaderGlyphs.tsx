import { HeaderActionIcon } from './HeaderActionIcon'
/** Approved save artwork shared by every page's header control group. */

export function SaveGlyph() {
  return <HeaderActionIcon action="save" />
}

/** Save with an activation mark: "Save + Make Active". */
export function SaveActiveGlyph() {
  return <HeaderActionIcon action="saveActive" />
}

/** Save As: the save disk with an add mark, for saving the item as a new copy. */
export function SaveAsGlyph() {
  return <HeaderActionIcon action="saveAs" />
}
