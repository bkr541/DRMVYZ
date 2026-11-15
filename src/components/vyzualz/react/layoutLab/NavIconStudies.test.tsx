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
  it('shows fifteen systems, each with the six destinations drawn as SVG paths', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const rows = [...host.querySelectorAll<HTMLElement>('[data-nav-icon-study]')]
    expect(rows.map(row => row.dataset.navIconStudy)).toEqual(NAV_ICON_SYSTEMS.map(system => system.id))
    expect(rows).toHaveLength(15)
    for (const row of rows) {
      const buttons = [...row.querySelectorAll<HTMLButtonElement>('[data-nav-icon-item]')]
      expect(buttons.map(button => button.title)).toEqual(NAV_ICON_DESTINATIONS.map(destination => destination.label))
      for (const button of buttons) {
        const paths = [...button.querySelectorAll('path')]
        expect(paths.length, button.dataset.navIconItem).toBeGreaterThan(0)
        expect(paths.every(path => (path.getAttribute('d') ?? '').length >= 6 && !path.getAttribute('d')!.includes('NaN'))).toBe(true)
      }
    }
  })

  it('draws every system differently for the same destination', async () => {
    await act(async () => root.render(<NavIconStudies />))
    for (const destination of NAV_ICON_DESTINATIONS) {
      const drawings = NAV_ICON_SYSTEMS.map(system => [...host.querySelectorAll(`[data-nav-icon-item="${system.id}-${destination.id}"] path`)].map(path => path.getAttribute('d')).join('|'))
      expect(new Set(drawings).size, destination.label).toBe(NAV_ICON_SYSTEMS.length)
    }
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
    expect(boxes).toHaveLength(90)
    expect(boxes.every(box => !box.checked)).toBe(true)
    const summary = () => host.querySelector('[data-nav-icon-summary]')!.textContent
    expect(summary()).toContain('0 of 90 kept')
    const box = (id: string) => host.querySelector<HTMLInputElement>(`[data-nav-icon-keep="${id}"]`)!
    await act(async () => box('matrix-notifications').click())
    await act(async () => box('bold-pads').click())
    await act(async () => box('bold-media').click())
    expect(summary()).toContain('3 of 90 kept')
    expect(host.querySelector('[data-nav-icon-count="bold"]')!.textContent).toBe('2/6 kept')
    expect(host.querySelector('[data-nav-icon-item="bold-pads"]')!.closest('.ll-ni-cell')!.classList.contains('is-kept')).toBe(true)
    await act(async () => box('bold-pads').click())
    expect(summary()).toContain('2 of 90 kept')
    expect(JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY)!).kept.sort()).toEqual(['bold-media', 'matrix-notifications'])
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(<NavIconStudies />))
    expect(box('bold-media').checked).toBe(true)
    expect(box('bold-pads').checked).toBe(false)
    expect(summary()).toContain('2 of 90 kept')
  })
})
