import { AppIcon } from '../../shared/icons/AppIcon'
/** Approved save artwork shared by every page's header control group. */

export function SaveGlyph() {
  return <AppIcon kind="save" />
}

/** Save with an activation mark: "Save + Make Active". */
export function SaveActiveGlyph() {
  return <AppIcon kind="saveActive" />
}
