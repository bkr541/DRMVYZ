// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppIconGallery } from '../AppIconGallery'
import { APP_ICON_INVENTORY } from '../appIconInventory'
import { LayoutLabMockup } from '../../LayoutLabMockup'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('application icon review sheet', () => {
  it('renders the complete source inventory with current labels above every SVG', async () => {
    await act(async () => root.render(<AppIconGallery />))
    const items = [...container.querySelectorAll('[data-icon-id]')]
    expect(items).toHaveLength(APP_ICON_INVENTORY.length)
    expect(new Set(APP_ICON_INVENTORY.map(icon => icon.id)).size).toBe(items.length)
    for (const [index, item] of items.entries()) {
      const icon = APP_ICON_INVENTORY[index]
      expect(item.firstElementChild?.tagName).toBe('FIGCAPTION')
      expect(item.firstElementChild?.textContent).toBe(icon.label)
      expect(item.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 32 32')
      expect(item.querySelector('path.llai-signal')?.getAttribute('d')).toBeTruthy()
      expect(icon.sources.length).toBeGreaterThan(0)
    }
    for (const source of new Set(APP_ICON_INVENTORY.flatMap(icon => icon.sources))) {
      expect(existsSync(resolve(source)), source).toBe(true)
    }
    for (const label of ['Preset Manager', 'Save + Make Active', 'CO₂ Jet', 'PAR Wash', 'Set start to playhead', 'Stop & Save']) {
      expect(items.some(item => item.firstElementChild?.textContent === label), label).toBe(true)
    }
  })

  it('filters by screen or label without changing production labels', async () => {
    await act(async () => root.render(<AppIconGallery />))
    const search = container.querySelector('input')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setValue.call(search, 'Lighting fixtures')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('[data-icon-id]')).toHaveLength(10)
    expect(container.textContent).toContain('CO₂ Jet')
    await act(async () => {
      setValue.call(search, 'no matching label')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelectorAll('[data-icon-id]')).toHaveLength(0)
    expect(container.textContent).toContain('No icons match')
  })

  it('opens in Cinema 2.0’s middle visualizer and preserves the concept preview', async () => {
    await act(async () => root.render(<LayoutLabMockup />))
    const center = container.querySelector('.rv-canvas-wrap')!
    expect(center.querySelector('[aria-label="Application icon gallery"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="Layout Lab left rail"] [aria-label="Application icon gallery"]')).toBeNull()
    const preview = [...center.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(tab => tab.textContent === 'Concept preview')!
    await act(async () => preview.click())
    expect(center.querySelector('.rv-layout-lab-cinema2-canvas')).not.toBeNull()
    expect(center.querySelector('[aria-label="Application icon gallery"]')).toBeNull()
    const icons = [...center.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(tab => tab.textContent === 'Icons')!
    await act(async () => icons.click())
    expect(center.querySelectorAll('[data-icon-id]')).toHaveLength(APP_ICON_INVENTORY.length)
  })
})
