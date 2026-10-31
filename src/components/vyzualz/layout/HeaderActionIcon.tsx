import { AppIcon } from '../../shared/icons/AppIcon'

/**
 * The one icon per header action, used by every page's control group. Each action maps to a single
 * glyph and a single set of artwork bounds, so a given action never looks different between pages.
 */
const HEADER_ACTIONS = {
  create: { kind: 'plus', bounds: '8 8 16 16' },
  createCollection: { kind: 'folderAdd', bounds: '2 2 28 28' },
  open: { kind: 'folder', bounds: '2 2 28 28' },
  save: { kind: 'save', bounds: '4 4 24 24' },
  saveActive: { kind: 'saveActive', bounds: '5 2 25 28' },
  duplicate: { kind: 'copy', bounds: '2 2 28 28' },
  delete: { kind: 'delete', bounds: '4 2 24 28' },
  lyrics: { kind: 'lyrics', bounds: '2 6 28 20' },
  undo: { kind: 'undo', bounds: '4 5 24 21' },
  redo: { kind: 'redo', bounds: '4 5 24 21' },
  list: { kind: 'list', bounds: '4 6 24 20' },
} as const

export type HeaderAction = keyof typeof HEADER_ACTIONS

/** Outputs only the SVG, drawn at the shared 12px header size. */
export function HeaderActionIcon({ action }: { action: HeaderAction }) {
  const { kind, bounds } = HEADER_ACTIONS[action]
  return <AppIcon kind={kind} size={12} viewBox={bounds} color="currentColor" />
}
