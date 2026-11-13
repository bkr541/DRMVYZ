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
const input = () => host.querySelector<HTMLInputElement>('input')!
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
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(7)
    expect(host.querySelectorAll('[role="tabpanel"]')).toHaveLength(7)
    const panel = host.querySelector<HTMLElement>('#layout-lab-tab-01-panel')!
    const studies = panel.querySelector('.ll-pad-studies')
    const rows = [...panel.querySelectorAll('[data-pad-study]')]
    expect(rows).toHaveLength(5)
    for (const row of rows) {
      expect(row.querySelectorAll('button')).toHaveLength(4)
      expect(row.querySelectorAll('button:disabled')).toHaveLength(0)
    }
    await act(async () => panel.querySelector<HTMLButtonElement>('[data-pad-study-item="signal-drop-cage"]')!.click())
    expect(panel.querySelector('[data-pad-study-item="signal-drop-cage"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(panel.querySelector('[data-pad-study-item="edge-reactor"]')?.getAttribute('aria-pressed')).toBe('true')
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
    expect(tab(7).getAttribute('aria-selected')).toBe('true')
    await act(async () => tab(7).dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })))
    await type('Geometry')
    await act(async () => input().blur())
    expect(tab(7).textContent).toBe('Geometry')
  })

  it('recovers invalid saved state and reports unavailable persistence', async () => {
    window.localStorage.setItem(LAYOUT_LAB_STORAGE_KEY, 'broken json')
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    await render()
    expect(host.querySelectorAll('[role="tab"]')).toHaveLength(7)
    expect(host.querySelector('[role="status"]')?.textContent).toContain('could not be saved')
    await act(async () => tab(2).click())
    expect(tab(2).getAttribute('aria-selected')).toBe('true')
  })
})
