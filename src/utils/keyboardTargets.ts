const KEYBOARD_INPUT_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '.drm-dropdown',
  '.drm-dropdown__menu',
].join(', ')

/**
 * Returns true when a global keyboard shortcut should yield to text entry,
 * native form controls, or the shared dropdown interaction surface.
 */
export function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  return target.closest(KEYBOARD_INPUT_SELECTOR) !== null
}
