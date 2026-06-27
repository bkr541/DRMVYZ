export const REACT_RIGHT_PANEL_IDS = [
  'presets',
  'fx',
  'mod',
  'audio',
  'rec',
  'insp',
] as const

export type ReactRightPanel = (typeof REACT_RIGHT_PANEL_IDS)[number]

const VALID_RIGHT_PANELS = new Set<string>(REACT_RIGHT_PANEL_IDS)
export const DEFAULT_REACT_RIGHT_PANEL: ReactRightPanel = 'presets'

export function isReactRightPanel(value: unknown): value is ReactRightPanel {
  return typeof value === 'string' && VALID_RIGHT_PANELS.has(value)
}

export function readReactRightPanel(
  storage: Pick<Storage, 'getItem'> = localStorage,
): ReactRightPanel {
  try {
    const raw = storage.getItem('drmvyz:react:rightPanel')
    if (raw == null) return DEFAULT_REACT_RIGHT_PANEL
    const parsed: unknown = JSON.parse(raw)
    return isReactRightPanel(parsed) ? parsed : DEFAULT_REACT_RIGHT_PANEL
  } catch {
    return DEFAULT_REACT_RIGHT_PANEL
  }
}

export function writeReactRightPanel(
  panel: ReactRightPanel,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem('drmvyz:react:rightPanel', JSON.stringify(panel))
  } catch (error) {
    console.warn('[ReactView] Unable to persist the active right panel', error)
  }
}
