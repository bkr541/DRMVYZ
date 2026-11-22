// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NavIconStudies, NAV_ICON_KEEP_STORAGE_KEY } from './NavIconStudies'
import { NAV_ICON_DESTINATIONS, NAV_ICON_SYSTEMS } from './navIconSystems'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { window.localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('Layout Lab navigation icon studies', () => {
  it('shows twenty systems with six destinations each, starting the Hairline row with React', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const rows = [...host.querySelectorAll<HTMLElement>('[data-nav-icon-study]')]
    expect(rows.map(row => row.dataset.navIconStudy)).toEqual(NAV_ICON_SYSTEMS.map(system => system.id))
    expect(rows).toHaveLength(20)
    const sharedLabels = NAV_ICON_DESTINATIONS.map(destination => destination.label)
    for (const row of rows) {
      const buttons = [...row.querySelectorAll<HTMLButtonElement>('[data-nav-icon-item]')]
      const labels = row.dataset.navIconStudy === 'hairline' ? ['React', ...sharedLabels.slice(1)] : sharedLabels
      expect(buttons.map(button => button.title)).toEqual(labels)
      for (const button of buttons) {
        const paths = [...button.querySelectorAll('path')]
        expect(paths.length, button.dataset.navIconItem).toBeGreaterThan(0)
        expect(paths.every(path => (path.getAttribute('d') ?? '').length >= 6 && !path.getAttribute('d')!.includes('NaN'))).toBe(true)
      }
    }
  })

  it('shows five Performance Pads options, each inside the production ring and keepable', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const section = host.querySelector('[data-nav-pad-options]')!
    const items = [...section.querySelectorAll('[data-nav-pad-option]')]
    expect(items).toHaveLength(5)
    expect(new Set(items.map(item => [...item.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'))).size).toBe(5)
    expect(items.every(item => item.querySelector('path.ring'))).toBe(true)
    expect(section.querySelectorAll('input[data-nav-pad-option-keep]')).toHaveLength(5)
  })

  it('shows five React options inside the production ring, each keepable', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const section = host.querySelector('[data-nav-react-options]')!
    const items = [...section.querySelectorAll('[data-nav-react-option]')]
    expect(items).toHaveLength(5)
    expect(new Set(items.map(item => [...item.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'))).size).toBe(5)
    expect(items.every(item => item.querySelector('path.ring'))).toBe(true)
    expect(section.querySelectorAll('input[data-nav-react-option-keep]')).toHaveLength(5)
  })

  it('shows four more React rows (live stage, audio reaction, engine marks, engine system) of five ringed options each', async () => {
    await act(async () => root.render(<NavIconStudies />))
    for (const key of ['react-stage', 'react-audio', 'react-engine', 'react-system']) {
      const section = host.querySelector(`[data-nav-${key}-options]`)!
      const items = [...section.querySelectorAll(`[data-nav-${key}-option]`)]
      expect(items, key).toHaveLength(5)
      expect(new Set(items.map(item => [...item.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'))).size, key).toBe(5)
      expect(items.every(item => item.querySelector('path.ring')), key).toBe(true)
      expect(section.querySelectorAll(`input[data-nav-${key}-option-keep]`), key).toHaveLength(5)
    }
  })

  it('draws every system differently for the same destination', async () => {
    await act(async () => root.render(<NavIconStudies />))
    for (const destination of NAV_ICON_DESTINATIONS) {
      const items = [...host.querySelectorAll(`[data-nav-icon-item$="-${destination.id}"]`)]
      const drawings = items.map(item => [...item.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'))
      expect(new Set(drawings).size, destination.label).toBe(items.length)
    }
  })

  it('selects React by default and keeps its review choice separate from the retired pad', async () => {
    window.localStorage.setItem(NAV_ICON_KEEP_STORAGE_KEY, JSON.stringify({ version: 1, kept: ['hairline-pads', 'bold-pads'] }))
    await act(async () => root.render(<NavIconStudies />))

    const reactButton = host.querySelector('[data-nav-icon-item="hairline-react"]')!
    const reactKeep = host.querySelector<HTMLInputElement>('[data-nav-icon-keep="hairline-react"]')!
    expect(reactButton.getAttribute('aria-pressed')).toBe('true')
    expect(reactKeep.checked).toBe(false)
    expect(host.querySelector('[data-nav-icon-summary]')!.textContent).toContain('1 of 120 kept')

    await act(async () => reactKeep.click())
    expect(host.querySelector('[data-nav-icon-count="hairline"]')!.textContent).toBe('1/6 kept')
    expect(JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY)!).kept).toEqual(['bold-pads', 'hairline-react'])
  })

  it('keeps the active item local to a row', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const item = (row: string, id: string) => host.querySelector<HTMLButtonElement>(`[data-nav-icon-item="${row}-${id}"]`)!
    expect(item('bold', 'pads').getAttribute('aria-pressed')).toBe('true')
    await act(async () => item('bold', 'media').click())
    expect(item('bold', 'media').getAttribute('aria-pressed')).toBe('true')
    expect(item('bold', 'pads').getAttribute('aria-pressed')).toBe('false')
    expect(item('solid', 'pads').getAttribute('aria-pressed')).toBe('true')
  })

  it('has a Keep checkbox on every icon, counts and persists the kept ones, and leaves the rest unchecked', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[data-nav-icon-keep]')]
    expect(boxes).toHaveLength(120)
    expect(boxes.every(box => !box.checked)).toBe(true)
    const summary = () => host.querySelector('[data-nav-icon-summary]')!.textContent
    expect(summary()).toContain('0 of 120 kept')
    const box = (id: string) => host.querySelector<HTMLInputElement>(`[data-nav-icon-keep="${id}"]`)!
    await act(async () => box('matrix-notifications').click())
    await act(async () => box('bold-pads').click())
    await act(async () => box('bold-media').click())
    expect(summary()).toContain('3 of 120 kept')
    expect(host.querySelector('[data-nav-icon-count="bold"]')!.textContent).toBe('2/6 kept')
    expect(host.querySelector('[data-nav-icon-item="bold-pads"]')!.closest('.ll-ni-cell')!.classList.contains('is-kept')).toBe(true)
    await act(async () => box('bold-pads').click())
    expect(summary()).toContain('2 of 120 kept')
    expect(JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY)!).kept.sort()).toEqual(['bold-media', 'matrix-notifications'])
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(<NavIconStudies />))
    expect(box('bold-media').checked).toBe(true)
    expect(box('bold-pads').checked).toBe(false)
    expect(summary()).toContain('2 of 120 kept')
  })
})
