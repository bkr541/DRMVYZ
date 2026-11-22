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
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(8)
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(8)
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
    expect(tab(11).getAttribute('aria-selected')).toBe('true')
    await act(async () => tab(11).dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })))
    await type('Geometry')
    await act(async () => input().blur())
    expect(tab(11).textContent).toBe('Geometry')
  })

  it('has no PixGrid Deck tab, and a saved selection of it falls back to the first tab', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({ version: 1, activeTabId: 'layout-lab-tab-10', tabs: [{ id: 'layout-lab-tab-10', name: 'PixGrid Deck' }] }))
    await render()
    expect([...host.querySelectorAll('[role="tab"]')].map(item => item.textContent)).not.toContain('PixGrid Deck')
    expect(host.querySelector('#layout-lab-tab-10')).toBeNull()
    expect(host.querySelector('[aria-label="PixGrid Deck popover studies"]')).toBeNull()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(8)
    expect(tab(1).getAttribute('aria-selected')).toBe('true')
  })

  it('adds the Brand Kit tab last, with its own permanent id, and also shows it in an empty slot someone has renamed Brand Kit', async () => {
    await render()
    expect(tab(11).textContent).toBe('Brand Kit')
    expect(host.querySelector('#layout-lab-tab-11-panel [data-brand-kit]')).not.toBeNull()
    // Slots 6 and 7 are empty until they are renamed; a slot named Brand Kit (any capitals or spaces) gets the same page.
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
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(8)
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

  it('adds AUTH to saved workspaces and shows four mockups, each with Sign in and Create account', async () => {
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
    const studies = [...host.querySelectorAll('#layout-lab-tab-08-panel [data-auth-study]')]
    expect(studies.map(study => (study as HTMLElement).dataset.authStudy)).toEqual(['aperture', 'afterglow', 'broadsheet', 'rack'])
    for (const study of studies) {
      // Every mockup shows both groups at once: Sign in (email, password) and Create account (name, artist name, email, password, confirmation).
      expect(study.querySelectorAll('[data-auth-state="signin"] input.dv-text-input')).toHaveLength(2)
      expect(study.querySelectorAll('[data-auth-state="signup"] input.dv-text-input')).toHaveLength(5)
      expect(study.querySelectorAll('[data-auth-state] canvas')).toHaveLength(2)
      // The production controls, unchanged: the shared input, the primary action, links and the switch line.
      expect(study.querySelectorAll('[data-auth-state] .auth-submit')).toHaveLength(2)
      expect(study.querySelectorAll('[data-auth-state] .auth-switch .auth-link')).toHaveLength(2)
      expect(study.querySelectorAll('[data-auth-state] .ll-am-input, [data-auth-state] .ll-am-submit')).toHaveLength(0)
      // The brand's mark or wordmark, never an invented logo.
      expect(study.querySelector('img[src$="stageless_logo.png"], img[src$="stageless_wordmark.png"]')).not.toBeNull()
    }
    // The production form's stylesheet travels with the studies (inline, like every other study's CSS), so the form is styled however the page was loaded.
    expect(host.querySelectorAll('#layout-lab-tab-08-panel style').length).toBeGreaterThanOrEqual(2)
    // Four different animation languages and four different layouts.
    expect(new Set(studies.map(study => study.querySelector('[data-auth-animation]')!.getAttribute('data-auth-animation'))).size).toBe(4)
    const password = studies[0].querySelector<HTMLInputElement>('[data-auth-state="signin"] input[type="password"]')!
    await act(async () => studies[0].querySelector<HTMLButtonElement>('[data-auth-state="signin"] [aria-label="Show password"]')!.click())
    expect(password.type).toBe('text')
    expect(studies[1].querySelector<HTMLInputElement>('[data-auth-state="signin"] input[type="password"]')!.type).toBe('password')
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
    await act(async () => tab(4).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(tab(6).getAttribute('aria-selected')).toBe('true')
    const saved = JSON.parse(window.localStorage.getItem(LAYOUT_LAB_STORAGE_KEY)!)
    expect(saved.tabs.some((item: { id: string }) => item.id === 'layout-lab-tab-05')).toBe(false)
    expect(saved.activeTabId).toBe('layout-lab-tab-06')
  })
})
