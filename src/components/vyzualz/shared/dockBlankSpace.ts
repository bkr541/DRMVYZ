/**
 * Structural wrappers of the bottom audio dock. A click that lands directly on one of these (not on a control, label,
 * waveform or any other element inside them) hit empty dock space, which toggles the dock between expanded and collapsed.
 */
const BLANK_SPACE_CLASSES = [
  'vz-dock-region',
  'vz-dock-card',
  'vz-dock-left-body',
  'vz-dock-right-main',
  'vz-dock-right-btns',
]

export function isDockBlankSpace(target: EventTarget | null, dock: HTMLElement): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target === dock) return true
  if (!dock.contains(target)) return false
  return BLANK_SPACE_CLASSES.some(className => target.classList.contains(className))
}
