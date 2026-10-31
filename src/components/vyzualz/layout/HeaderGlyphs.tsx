import { HeaderActionIcon } from './HeaderActionIcon'
/** Approved save artwork shared by every page's header control group. */

export function SaveGlyph() {
  return <HeaderActionIcon action="save" />
}

/** Save with an activation mark: "Save + Make Active". */
export function SaveActiveGlyph() {
  return <HeaderActionIcon action="saveActive" />
}
