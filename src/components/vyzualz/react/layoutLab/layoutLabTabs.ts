export const LAYOUT_LAB_STORAGE_KEY = 'drmvyz.layoutLab.tabs.v1'
export const LAYOUT_LAB_TAB_IDS = Array.from({ length: 7 }, (_, index) => `layout-lab-tab-${String(index + 1).padStart(2, '0')}`)

export interface LayoutLabTabsState {
  tabs: { id: string; name: string }[]
  activeTabId: string
}

export function readLayoutLabTabs(): LayoutLabTabsState {
  let saved: Partial<LayoutLabTabsState> = {}
  try {
    const value = JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY) ?? 'null')
    if (value?.version === 1) saved = value
  } catch { /* Unavailable or invalid storage starts with the seven default slots. */ }
  const tabs = LAYOUT_LAB_TAB_IDS.map((id, index) => {
    const name = Array.isArray(saved.tabs) ? saved.tabs.find(tab => tab?.id === id)?.name : undefined
    return { id, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : (index === 1 ? 'Preset cards' : `Tab ${index + 1}`) }
  })
  return { tabs, activeTabId: tabs.some(tab => tab.id === saved.activeTabId) ? saved.activeTabId! : tabs[0].id }
}
