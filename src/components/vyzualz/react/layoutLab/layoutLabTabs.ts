export const LAYOUT_LAB_STORAGE_KEY = 'drmvyz.layoutLab.tabs.v1'
export const LAYOUT_LAB_AUTH_TAB_ID = 'layout-lab-tab-08'
export const LAYOUT_LAB_RECORD_LISTING_TAB_ID = 'layout-lab-tab-09'
export const LAYOUT_LAB_UI_PREVIEW_TAB_ID = 'layout-lab-tab-12'
export const LAYOUT_LAB_MOBILE_TAB_ID = 'layout-lab-tab-13'
export const LAYOUT_LAB_LIVE_INPUT_TAB_ID = 'layout-lab-tab-15'
export const LAYOUT_LAB_PRESET_FILTER_TAB_ID = 'layout-lab-tab-16'
export const LAYOUT_LAB_OUTPUT_TAB_ID = 'layout-lab-tab-17'
/** The dedicated Brand Kit tab (layout-lab-tab-11) and the PixGrid Deck tab (layout-lab-tab-10) were removed; their ids are not reused. Brand Kit is slot 7 by default. */
/** The empty slots a person may rename "Brand Kit" themselves; a slot with that name shows the Brand Kit too. */
export const LAYOUT_LAB_BRAND_KIT_PLACEHOLDER_IDS: readonly string[] = ['layout-lab-tab-06', 'layout-lab-tab-07']
export const isBrandKitTabName = (name: string) => name.trim().toLowerCase() === 'brand kit'

const DEFAULT_TABS = [
  { id: 'layout-lab-tab-01', name: 'Tab 1' },
  { id: 'layout-lab-tab-03', name: 'Engine dropdown' },
  { id: 'layout-lab-tab-06', name: 'Tab 6' },
  { id: 'layout-lab-tab-07', name: 'Brand Kit' },
  { id: LAYOUT_LAB_AUTH_TAB_ID, name: 'AUTH' },
  { id: LAYOUT_LAB_RECORD_LISTING_TAB_ID, name: 'Record Listing' },
  { id: LAYOUT_LAB_UI_PREVIEW_TAB_ID, name: 'UI Preview' },
  { id: LAYOUT_LAB_MOBILE_TAB_ID, name: 'Mobile' },
  { id: LAYOUT_LAB_LIVE_INPUT_TAB_ID, name: 'Live Input' },
  { id: LAYOUT_LAB_PRESET_FILTER_TAB_ID, name: 'Preset Filter' },
  { id: LAYOUT_LAB_OUTPUT_TAB_ID, name: 'Output' },
]

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
  const tabs = DEFAULT_TABS.map(({ id, name: defaultName }) => {
    const name = Array.isArray(saved.tabs) ? saved.tabs.find(tab => tab?.id === id)?.name : undefined
    return { id, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : defaultName }
  })
  return { tabs, activeTabId: tabs.some(tab => tab.id === saved.activeTabId) ? saved.activeTabId! : tabs[0].id }
}
