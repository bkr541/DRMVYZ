// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NavIconStudies, NAV_ICON_KEEP_STORAGE_KEY } from './NavIconStudies'
import { NAV_ICON_DESTINATIONS } from './navIconSystems'
import { NOTIFICATION_BELL_BODY, NOTIFICATION_BELL_CLASP } from '../../shared/notificationBellArt'

let host: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => { window.localStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

describe('Layout Lab navigation icon studies', () => {
  it('shows 01 Hairline duotone and 02 Production bell style, six destinations each starting with React, and nothing else', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const rows = [...host.querySelectorAll<HTMLElement>('[data-nav-icon-study]')]
    expect(rows.map(row => row.dataset.navIconStudy)).toEqual(['hairline', 'production'])
    expect(host.querySelectorAll('.ll-ni-row')).toHaveLength(2)
    expect(rows.map(row => row.querySelector('h2')!.textContent)).toEqual(['01Hairline duotone', '02Production bell style'])
    for (const row of rows) {
      const buttons = [...row.querySelectorAll<HTMLButtonElement>('[data-nav-icon-item]')]
      expect(buttons.map(button => button.title)).toEqual(['React', ...NAV_ICON_DESTINATIONS.slice(1).map(destination => destination.label)])
      for (const button of buttons) {
        const paths = [...button.querySelectorAll('path')]
        expect(paths.length, button.dataset.navIconItem).toBeGreaterThan(0)
        expect(paths.every(path => (path.getAttribute('d') ?? '').length >= 6 && !path.getAttribute('d')!.includes('NaN'))).toBe(true)
      }
    }
  })

  it('draws the production-style row as the production bell does: plain 24-grid strokes with no accent parts', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const row = host.querySelector('[data-nav-icon-study="production"]')!
    expect(row.querySelectorAll('path.a, path.fa, path.fs, path.ts, path.ta')).toHaveLength(0)
    const bell = row.querySelector('[data-nav-icon-item="production-notifications"]')!
    expect([...bell.querySelectorAll('path')].map(path => path.getAttribute('d'))).toEqual([NOTIFICATION_BELL_CLASP, NOTIFICATION_BELL_BODY])
  })

  it('selects React by default and keeps its review choice separate from the retired pad', async () => {
    window.localStorage.setItem(NAV_ICON_KEEP_STORAGE_KEY, JSON.stringify({ version: 1, kept: ['hairline-pads', 'bold-pads'] }))
    await act(async () => root.render(<NavIconStudies />))

    const reactButton = host.querySelector('[data-nav-icon-item="hairline-react"]')!
    const reactKeep = host.querySelector<HTMLInputElement>('[data-nav-icon-keep="hairline-react"]')!
    expect(reactButton.getAttribute('aria-pressed')).toBe('true')
    expect(reactKeep.checked).toBe(false)
    expect(host.querySelector('[data-nav-icon-summary]')!.textContent).toContain('0 of 12 kept')

    await act(async () => reactKeep.click())
    expect(host.querySelector('[data-nav-icon-count="hairline"]')!.textContent).toBe('1/6 kept')
    expect(JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY)!).kept).toEqual(['bold-pads', 'hairline-react'])
  })

  it('selects another destination in the row when it is clicked', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const item = (id: string) => host.querySelector<HTMLButtonElement>(`[data-nav-icon-item="hairline-${id}"]`)!
    await act(async () => item('media').click())
    expect(item('media').getAttribute('aria-pressed')).toBe('true')
    expect(item('react').getAttribute('aria-pressed')).toBe('false')
  })

  it('has a Keep checkbox on every icon, counts and persists the kept ones, and leaves the rest unchecked', async () => {
    await act(async () => root.render(<NavIconStudies />))
    const boxes = [...host.querySelectorAll<HTMLInputElement>('input[data-nav-icon-keep]')]
    expect(boxes).toHaveLength(12)
    expect(boxes.every(box => !box.checked)).toBe(true)
    const summary = () => host.querySelector('[data-nav-icon-summary]')!.textContent
    expect(summary()).toContain('0 of 12 kept')
    const box = (id: string) => host.querySelector<HTMLInputElement>(`[data-nav-icon-keep="${id}"]`)!
    await act(async () => box('hairline-media').click())
    await act(async () => box('hairline-lyrics').click())
    expect(summary()).toContain('2 of 12 kept')
    expect(host.querySelector('[data-nav-icon-count="hairline"]')!.textContent).toBe('2/6 kept')
    expect(host.querySelector('[data-nav-icon-item="hairline-media"]')!.closest('.ll-ni-cell')!.classList.contains('is-kept')).toBe(true)
    await act(async () => box('hairline-lyrics').click())
    expect(summary()).toContain('1 of 12 kept')
    expect(JSON.parse(window.localStorage.getItem(NAV_ICON_KEEP_STORAGE_KEY)!).kept).toEqual(['hairline-media'])
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(<NavIconStudies />))
    expect(box('hairline-media').checked).toBe(true)
    expect(summary()).toContain('1 of 12 kept')
  })
})
