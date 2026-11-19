export const LAYOUT_LAB_STORAGE_KEY = 'drmvyz.layoutLab.tabs.v1'
const DEFAULT_TAB_NAMES = ['Tab 1', 'Preset cards', 'Engine dropdown', 'Nav bar icons', 'Left nav bar', 'Tab 6', 'Tab 7', 'AUTH']
export const LAYOUT_LAB_TAB_IDS = DEFAULT_TAB_NAMES.map((_, index) => `layout-lab-tab-${String(index + 1).padStart(2, '0')}`)
export const LAYOUT_LAB_AUTH_TAB_ID = LAYOUT_LAB_TAB_IDS[7]

export interface LayoutLabTabsState {
  tabs: { id: string; name: string }[]
  activeTabId: string
}

export function readLayoutLabTabs(): LayoutLabTabsState {
  let saved: Partial<LayoutLabTabsState> = {}
  try {
    const value = JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY) ?? 'null')
    if (value?.version === 1) saved = value
  } catch { /* Unavailable or invalid storage starts with the default slots. */ }
  const tabs = LAYOUT_LAB_TAB_IDS.map((id, index) => {
    const name = Array.isArray(saved.tabs) ? saved.tabs.find(tab => tab?.id === id)?.name : undefined
    return { id, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : DEFAULT_TAB_NAMES[index] }
  })
  return { tabs, activeTabId: tabs.some(tab => tab.id === saved.activeTabId) ? saved.activeTabId! : tabs[0].id }
}
