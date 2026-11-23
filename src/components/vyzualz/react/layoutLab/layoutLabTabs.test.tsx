// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayoutLabMockup } from '../LayoutLabMockup'
import { LAYOUT_LAB_STORAGE_KEY } from './layoutLabTabs'

const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver')
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  // Production blueprint artwork uses SVG layout APIs absent from jsdom.
  Object.defineProperty(SVGElement.prototype, 'getScreenCTM', { configurable: true, value: () => null })
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: class { observe() {} disconnect() {} } })
  // The Auth mockups draw their animations on canvases, which jsdom cannot draw on.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  window.localStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  window.localStorage.clear()
  vi.restoreAllMocks()
  Reflect.deleteProperty(SVGElement.prototype, 'getScreenCTM')
  if (resizeObserverDescriptor) Object.defineProperty(window, 'ResizeObserver', resizeObserverDescriptor)
  else Reflect.deleteProperty(window, 'ResizeObserver')
})
const render = async () => { await act(async () => root.render(<LayoutLabMockup />)) }
const tab = (index: number) => host.querySelector<HTMLButtonElement>(`#layout-lab-tab-${String(index).padStart(2, '0')}`)!
const input = () => host.querySelector<HTMLInputElement>('.ll-tab-name-input')!
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function key(value: string) {
  await act(async () => input().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true })))
}

describe('persistent Layout Lab tabs', () => {
  it('adds Record Listing with independent production grid/list cards and local selection', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1, activeTabId: 'layout-lab-tab-03', tabs: [{ id: 'layout-lab-tab-03', name: 'My engine menu' }],
    }))
    await render()
    expect(tab(3).textContent).toBe('My engine menu')
    expect(tab(9).textContent).toBe('Record Listing')
    await act(async () => tab(9).click())
    const panel = host.querySelector('#layout-lab-tab-09-panel')!
    const presets = panel.querySelector('[data-record-section="presets"]')!
    const audio = panel.querySelector('[data-record-section="audio"]')!
    const models = panel.querySelector('[data-record-section="models"]')!
    expect(presets.querySelectorAll('.pmv-card')).toHaveLength(4)
    expect(audio.querySelectorAll('.vz-track-row')).toHaveLength(4)
    expect(models.querySelectorAll('.mm-model-card')).toHaveLength(4)
    await act(async () => presets.querySelector<HTMLButtonElement>('[aria-label="Grid view"]')!.click())
    expect(presets.getAttribute('data-view')).toBe('grid')
    expect(presets.querySelectorAll('.pmv-thumbnail.rv-preset-spotlight-thumb--blueprint')).toHaveLength(4)
    expect(presets.querySelector('.rv-preset-card')).toBeNull()
    expect(presets.querySelector('.pmv-card-copy strong')?.textContent).toBe('Afterhours')
    expect(presets.querySelector('[aria-label="3D Environment"]')).not.toBeNull()
    expect(audio.getAttribute('data-view')).toBe('list')
    expect(models.getAttribute('data-view')).toBe('grid')
    await act(async () => audio.querySelector<HTMLButtonElement>('[aria-label="Grid view"]')!.click())
    expect(audio.getAttribute('data-view')).toBe('grid')
    await act(async () => models.querySelector<HTMLButtonElement>('[aria-label="List view"]')!.click())
    expect(models.querySelectorAll('.mm-model-card--list')).toHaveLength(4)
    const model = models.querySelectorAll<HTMLButtonElement>('.mm-model-card-select')[1]
    await act(async () => model.click())
    expect(model.getAttribute('aria-pressed')).toBe('true')
    await act(async () => models.querySelector<HTMLButtonElement>('[aria-label="Grid view"]')!.click())
    expect(models.querySelectorAll('.mm-model-card-select')[1].getAttribute('aria-pressed')).toBe('true')

  })

  it('keeps content identity through renaming, switching tabs and reopening', async () => {
    await render()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(10)
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(10)
    const panel = host.querySelector<HTMLElement>('#layout-lab-tab-01-panel')!
    const studies = panel.querySelector('.ll-pad-studies')
    const rows = [...panel.querySelectorAll('[data-pad-study]')]
    expect(rows.map(row => row.querySelector('h2')?.textContent)).toEqual(['Full', 'Compact'])
    for (const row of rows) expect(row.querySelectorAll('button.performance-pad')).toHaveLength(5)
    await act(async () => panel.querySelector<HTMLButtonElement>('[data-pad-study-item="full-pad-2"]')!.click())
    expect(panel.querySelector('[data-pad-study-item="full-pad-2"]')?.getAttribute('data-selected')).toBe('true')
    expect(panel.querySelector('[data-pad-study-item="compact-pad-1"]')?.getAttribute('data-selected')).toBe('true')
    const child = document.createElement('div')
    child.dataset.study = 'retained-element'
    panel.append(child)
    await act(async () => tab(1).click())
    await type('Casting studies')
    await key('Enter')
    expect(tab(1).textContent).toBe('Casting studies')
    expect(tab(1).getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.querySelector('[data-study]')).toBe(child)
    expect(panel.querySelector('.ll-pad-studies')).toBe(studies)
    await act(async () => tab(7).click())
    expect(panel.hidden).toBe(true)
    await act(async () => tab(1).click())
    expect(panel.hidden).toBe(false)
    expect(panel.querySelector('[data-study]')).toBe(child)
    await act(async () => root.unmount())
    root = createRoot(host)
    await render()
    expect(tab(1).textContent).toBe('Casting studies')
    expect(tab(1).getAttribute('aria-controls')).toBe('layout-lab-tab-01-panel')
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)!).tabs[0]).toEqual({ id: 'layout-lab-tab-01', name: 'Casting studies' })
  })

  it('cancels edits with Escape, rejects blank names and supports keyboard selection', async () => {
    await render()
    await act(async () => tab(1).click())
    await type('Discard this')
    await key('Escape')
    expect(tab(1).textContent).toBe('Tab 1')
    await act(async () => tab(1).click())
    await type('   ')
    await key('Enter')
    expect(tab(1).textContent).toBe('Tab 1')
    await act(async () => tab(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
    expect(tab(16).getAttribute('aria-selected')).toBe('true')
    await act(async () => tab(16).dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })))
    await type('Geometry')
    await act(async () => input().blur())
    expect(tab(16).textContent).toBe('Geometry')
  })

  it('adds the UI Preview tab, with its own permanent id and one window frame', async () => {
    await render()
    expect(tab(12).textContent).toBe('UI Preview')
    expect(host.querySelectorAll('#layout-lab-tab-12-panel iframe.ll-ui-preview-frame')).toHaveLength(1)
  })

  it('keeps the Mobile tab and its three layout studies of a DJ set and a party', async () => {
    await render()
    expect(tab(13).textContent).toBe('Mobile')
    const panel = host.querySelector('#layout-lab-tab-13-panel')!
    expect([...panel.querySelectorAll('[data-mobile-study]')].map(study => (study as HTMLElement).dataset.mobileStudy)).toEqual(['a', 'b', 'c'])
    // The controller-mode studies come first: pairing, connected and connection lost, then the Design tab and the laptop side.
    expect([...panel.querySelectorAll('[data-mobile-controller]')].map(study => (study as HTMLElement).dataset.mobileController)).toEqual(['flow', 'design'])
    expect(panel.querySelectorAll('iframe.ll-mobile-frame')).toHaveLength(5)
  })

  it('drops the retired Audio Dock tab from saved workspaces and selects Tab 1', async () => {
    const retiredId = 'layout-lab-tab-14'
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1, activeTabId: retiredId, tabs: [{ id: retiredId, name: 'My dock' }],
    }))
    await render()
    expect(tab(14)).toBeNull()
    expect(host.querySelector(`#${retiredId}-panel`)).toBeNull()
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)!).tabs)
      .not.toContainEqual(expect.objectContaining({ id: retiredId }))
  })

  it('opens Preset Filter with five independent Inspector previews', async () => {
    await render()
    expect(tab(16).textContent).toBe('Preset Filter')
    await act(async () => tab(16).click())
    const panel = host.querySelector<HTMLElement>('#layout-lab-tab-16-panel')!
    expect(panel.hidden).toBe(false)
    const studies = [...panel.querySelectorAll('[data-preset-filter-study]')]
    expect(studies.map(study => study.getAttribute('data-preset-filter-study'))).toEqual(['chips', 'dropdowns', 'popover', 'facets', 'tokens'])
    const laser = [...studies[0]!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Laser')!
    await act(async () => laser.click())
    expect(studies[0]!.querySelector('[role="status"]')?.textContent).toBe('2 presets')
    expect(studies[1]!.querySelector('[role="status"]')?.textContent).toBe('10 presets')

    const [dropdownTrigger, popoverTrigger] = studies.slice(1, 3).map(study =>
      study.querySelector<HTMLButtonElement>('button.ll-pf-filter-trigger')!,
    )
    expect(dropdownTrigger.className).toBe(popoverTrigger.className)
    expect(dropdownTrigger.innerHTML).toBe(popoverTrigger.innerHTML)
    await act(async () => dropdownTrigger.click())
    const menu = document.getElementById(dropdownTrigger.getAttribute('aria-controls')!)
    expect(menu?.classList.contains('drm-dropdown__menu')).toBe(true)
    const option = [...menu!.querySelectorAll<HTMLElement>('[role="option"]')].find(row => row.textContent === 'Architecture')!
    await act(async () => option.click())
    expect(studies[1]!.querySelector('[role="status"]')?.textContent).toBe('4 presets')
  })

  it('shows four static Live Input mockups, including both spectrum disclosure states', async () => {
    await render()
    expect(tab(15).textContent).toBe('Live Input')
    await act(async () => tab(15).click())
    const panel = host.querySelector('#layout-lab-tab-15-panel')!
    const rows = [...panel.querySelectorAll('[data-live-input-study]')]
    expect(rows.map(row => row.querySelector('h2')?.textContent)).toEqual([
      'Level Meter', 'Frequency Bars', 'Live Scope', 'Meter with Expandable Detail',
    ])
    const [meter, spectrum, scope, expandable] = rows
    expect(meter.querySelector('.ll-li-meter')).not.toBeNull()
    expect(spectrum.querySelector('.ll-li-spectrum')).not.toBeNull()
    expect(scope.querySelector('.ll-li-scope')).not.toBeNull()
    const [collapsed, expanded] = expandable.querySelectorAll('.ll-li-detail-state')
    expect(collapsed.textContent).toContain('Collapsed')
    expect(collapsed.querySelector('.ll-li-expanded')).toBeNull()
    expect(expanded.textContent).toContain('Expanded')
    expect(expanded.querySelector('.ll-li-expanded .ll-li-spectrum')).not.toBeNull()
    expect(panel.querySelector('button, input, select, canvas, audio')).toBeNull()
  })

  it('has no Nav Bar Icons tab, and a saved selection of it falls back to the first tab', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({ version: 1, activeTabId: 'layout-lab-tab-04', tabs: [{ id: 'layout-lab-tab-04', name: 'Nav bar icons' }] }))
    await render()
    expect([...host.querySelectorAll('[role="tab"]')].map(item => item.textContent)).not.toContain('Nav bar icons')
    expect(host.querySelector('#layout-lab-tab-04')).toBeNull()
    expect(host.querySelector('[aria-label="Navigation icon studies"]')).toBeNull()
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
  })

  it('has no PixGrid Deck tab, and a saved selection of it falls back to the first tab', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({ version: 1, activeTabId: 'layout-lab-tab-10', tabs: [{ id: 'layout-lab-tab-10', name: 'PixGrid Deck' }] }))
    await render()
    expect([...host.querySelectorAll('[role="tab"]')].map(item => item.textContent)).not.toContain('PixGrid Deck')
    expect(host.querySelector('#layout-lab-tab-10')).toBeNull()
    expect(host.querySelector('[aria-label="PixGrid Deck popover studies"]')).toBeNull()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(10)
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
  })

  it('has exactly one Brand Kit tab (slot 7), and also shows it in an empty slot someone has renamed Brand Kit', async () => {
    await render()
    expect([...host.querySelectorAll('[role="tab"]')].filter(item => item.textContent === 'Brand Kit')).toHaveLength(1)
    expect(tab(7).textContent).toBe('Brand Kit')
    expect(host.querySelector('#layout-lab-tab-07-panel [data-brand-kit]')).not.toBeNull()
    expect(host.querySelector('#layout-lab-tab-11')).toBeNull()
    // Slot 6 is empty until it is renamed; a slot named Brand Kit (any capitals or spaces) gets the same page.
    expect(host.querySelector('#layout-lab-tab-06-panel [data-brand-kit]')).toBeNull()
    await act(async () => root.unmount())
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({ version: 1, tabs: [{ id: 'layout-lab-tab-07', name: '  brand KIT ' }, { id: 'layout-lab-tab-03', name: 'brand kit' }], activeTabId: 'layout-lab-tab-07' }))
    root = createRoot(host)
    await render()
    expect(tab(7).textContent).toBe('brand KIT')
    expect(host.querySelector('#layout-lab-tab-07-panel [data-brand-kit]')).not.toBeNull()
    // Only the empty slots do this: a tab that has its own content keeps it.
    expect(host.querySelector('#layout-lab-tab-03-panel [data-brand-kit]')).toBeNull()
  })

  it('recovers invalid saved state and reports unavailable persistence', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, 'broken json')
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    await render()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(10)
    expect(host.querySelector('[role="status"]')?.textContent).toContain('could not be saved')
    await act(async () => tab(3).click())
    expect(tab(3).getAttribute('aria-selected')).toBe('true')
  })

  it('removes the retired preset card slot from a saved workspace', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeTabId: 'layout-lab-tab-02',
      tabs: [
        { id: 'layout-lab-tab-02', name: 'My card studies' },
        { id: 'layout-lab-tab-03', name: 'My engine menu' },
      ],
    }))
    await render()
    expect(host.querySelector('[data-layout-lab-tab-id="layout-lab-tab-02"]')).toBeNull()
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
    await act(async () => tab(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(tab(3).textContent).toBe('My engine menu')
    expect(tab(3).getAttribute('aria-selected')).toBe('true')
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)!)
    expect(saved.activeTabId).toBe('layout-lab-tab-03')
    expect(saved.tabs).not.toContainEqual({ id: 'layout-lab-tab-02', name: 'My card studies' })
  })

  it('adds AUTH to saved workspaces and shows the production page on desktop and mobile, each with log in and sign up', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeTabId: 'layout-lab-tab-03',
      tabs: [{ id: 'layout-lab-tab-03', name: 'My engine menu' }],
    }))
    await render()
    expect(tab(3).textContent).toBe('My engine menu')
    expect(tab(3).getAttribute('aria-selected')).toBe('true')
    expect(tab(8).textContent).toBe('AUTH')
    await act(async () => tab(8).click())
    const panel = host.querySelector('#layout-lab-tab-08-panel')!
    // One page, the production one, on two devices; each device shows log in and sign up.
    expect([...panel.querySelectorAll('[data-auth-section]')].map(section => (section as HTMLElement).dataset.authSection)).toEqual(['desktop', 'mobile'])
    expect([...panel.querySelectorAll('[data-auth-device]')].map(frame => `${(frame as HTMLElement).dataset.authDevice}:${(frame as HTMLElement).dataset.authInitial}`)).toEqual(['desktop:login', 'desktop:signup', 'mobile:login', 'mobile:signup'])
    expect(panel.querySelectorAll('iframe.ll-auth-frame')).toHaveLength(4)
    expect(panel.querySelectorAll('[data-auth-study]')).toHaveLength(0)
    // The mobile frames are phone-width, so the production CSS's max-width: 640px rules apply inside them.
    expect([...panel.querySelectorAll<HTMLIFrameElement>('[data-auth-device="mobile"] iframe')].map(frame => frame.style.width)).toEqual(['390px', '390px'])
  })

  it('removes the retired left nav tab from saved workspaces without renumbering other tabs', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeTabId: 'layout-lab-tab-05',
      tabs: [
        { id: 'layout-lab-tab-05', name: 'My navigation' },
        { id: 'layout-lab-tab-06', name: 'My geometry' },
      ],
    }))
    await render()
    expect(host.querySelector('[data-layout-lab-tab-id="layout-lab-tab-05"]')).toBeNull()
    expect(host.querySelector('[data-left-nav-study], .az-sidebar')).toBeNull()
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
    expect(tab(6).textContent).toBe('My geometry')
    await act(async () => tab(3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(tab(6).getAttribute('aria-selected')).toBe('true')
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)!)
    expect(saved.tabs.some((item: { id: string }) => item.id === 'layout-lab-tab-05')).toBe(false)
    expect(saved.activeTabId).toBe('layout-lab-tab-06')
  })
})
