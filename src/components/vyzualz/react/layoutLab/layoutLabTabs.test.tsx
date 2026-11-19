// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayoutLabMockup } from '../LayoutLabMockup'
import { LAYOUT_LAB_STORAGE_KEY } from './layoutLabTabs'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
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
})
const render = async () => { await act(async () => root.render(<LayoutLabMockup />)) }
const tab = (index: number) => host.querySelector<HTMLButtonElement>(`#layout-lab-tab-0${index}`)!
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
  it('keeps content identity through renaming, switching tabs and reopening', async () => {
    await render()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(8)
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(8)
    const panel = host.querySelector<HTMLElement>('#layout-lab-tab-01-panel')!
    const studies = panel.querySelector('.ll-pad-studies')
    const rows = [...panel.querySelectorAll('[data-pad-study]')]
    expect(rows).toHaveLength(5)
    expect(rows[0].getAttribute('data-pad-study')).toBe('signal')
    expect(rows.map(row => row.querySelector('h2')?.textContent)).toEqual(['Full', 'Compact', 'Underline', 'Accent Rail', 'Glow'])
    for (const row of rows) {
      expect(row.querySelectorAll('button')).toHaveLength(4)
      expect(row.querySelectorAll('button:disabled')).toHaveLength(0)
    }
    await act(async () => panel.querySelector<HTMLButtonElement>('[data-pad-study-item="signal-drop-cage"]')!.click())
    expect(panel.querySelector('[data-pad-study-item="signal-drop-cage"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(panel.querySelector('[data-pad-study-item="signal-reactor"]')?.getAttribute('aria-pressed')).toBe('false')
    expect(panel.querySelector('[data-pad-study-item="compact-reactor"]')?.getAttribute('aria-pressed')).toBe('true')
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
    expect(tab(8).getAttribute('aria-selected')).toBe('true')
    await act(async () => tab(8).dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })))
    await type('Geometry')
    await act(async () => input().blur())
    expect(tab(8).textContent).toBe('Geometry')
  })

  it('recovers invalid saved state and reports unavailable persistence', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, 'broken json')
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    await render()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(8)
    expect(host.querySelector('[role="status"]')?.textContent).toContain('could not be saved')
    await act(async () => tab(2).click())
    expect(tab(2).getAttribute('aria-selected')).toBe('true')
  })

  it('adds AUTH to saved workspaces and previews both forms independently', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeTabId: 'layout-lab-tab-05',
      tabs: [{ id: 'layout-lab-tab-05', name: 'My navigation' }],
    }))
    await render()
    expect(tab(5).textContent).toBe('My navigation')
    expect(tab(5).getAttribute('aria-selected')).toBe('true')
    expect(tab(8).textContent).toBe('AUTH')
    await act(async () => tab(8).click())
    const studies = [...host.querySelectorAll('#layout-lab-tab-08-panel [data-auth-study]')]
    expect(studies).toHaveLength(4)
    for (const study of studies) expect(study.querySelectorAll('input.dv-text-input')).toHaveLength(2)
    await act(async () => studies[0].querySelector<HTMLButtonElement>('.ll-auth-mode')!.click())
    expect(studies[0].querySelectorAll('input.dv-text-input')).toHaveLength(5)
    expect(studies[1].querySelectorAll('input.dv-text-input')).toHaveLength(2)
    const password = studies[0].querySelector<HTMLInputElement>('input[type="password"]')!
    await act(async () => studies[0].querySelector<HTMLButtonElement>('[aria-label="Show password"]')!.click())
    expect(password.type).toBe('text')
    await act(async () => studies[0].querySelector<HTMLButtonElement>('.ll-auth-mode')!.click())
    expect(studies[0].querySelectorAll('input.dv-text-input')).toHaveLength(2)
  })

  it('moves the first sidebar cutout with selection and switches all five preview widths', async () => {
    await render()
    await act(async () => tab(5).click())
    const panel = host.querySelector('#layout-lab-tab-05-panel')!
    const studies = [...panel.querySelectorAll('[data-left-nav-study]')]
    expect(studies.map(study => study.querySelector('h2')?.textContent)).toEqual([
      'Preview 1 · Notch', 'Preview 2 · Track', 'Preview 3 · Shutter', 'Preview 4 · Signal', 'Preview 5 · Brackets',
    ])
    expect(studies.every(study => study.querySelector('.az-sidebar--floating .az-nav-item--active'))).toBe(true)
    const notched = studies[0].querySelector<HTMLElement>('.ll-ln-notched')!
    const selectedIndex = () => notched.style.getPropertyValue('--ll-ln-selected-index')
    expect(panel.querySelectorAll('.ll-ln-notched')).toHaveLength(1)
    expect(selectedIndex()).toBe('0')
    const bulk = (label: string) => [...panel.querySelectorAll<HTMLButtonElement>('.ll-ln-actions button')].find(button => button.textContent === label)!
    const collapsed = () => panel.querySelectorAll('.az-sidebar--collapsed').length
    const media = studies[0].querySelector<HTMLButtonElement>('[aria-label="Media Manager"]')!
    await act(async () => media.click())
    expect(selectedIndex()).toBe('5')
    await act(async () => bulk('Collapse All').click())
    expect(collapsed()).toBe(5)
    expect(selectedIndex()).toBe('5')
    const presets = studies[0].querySelector<HTMLButtonElement>('[aria-label="Preset Manager"]')!
    await act(async () => presets.click())
    expect(selectedIndex()).toBe('2')
    await act(async () => studies[2].querySelector<HTMLButtonElement>('[aria-label="Expand sidebar"]')!.click())
    expect(collapsed()).toBe(4)
    await act(async () => bulk('Expand All').click())
    expect(collapsed()).toBe(0)
    expect(presets.getAttribute('aria-current')).toBe('page')
    expect(selectedIndex()).toBe('2')
    expect(studies[2].querySelector('[aria-label="React"]')?.getAttribute('aria-current')).toBe('page')
    for (const [index, style] of ['track', 'shutter', 'signal', 'brackets'].entries()) {
      const variant = studies[index + 1].querySelector<HTMLElement>(`.ll-ln-${style}`)!
      const show = variant.querySelector<HTMLButtonElement>('[aria-label="Show Manager"]')!
      expect(variant.style.getPropertyValue('--ll-ln-selected-index')).toBe('0')
      await act(async () => show.click())
      expect(show.getAttribute('aria-current')).toBe('page')
      expect(variant.style.getPropertyValue('--ll-ln-selected-index')).toBe('3')
    }
    expect(presets.getAttribute('aria-current')).toBe('page')
  })
})
