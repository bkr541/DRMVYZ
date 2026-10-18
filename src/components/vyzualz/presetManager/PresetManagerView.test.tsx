// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { PresetManagerView } from './PresetManagerView'
import { PRESET_MANAGER_PRESETS } from './presetManagerCatalog'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function renderView() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(<PresetManagerView />))
}

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Preset Manager view', () => {
  it('renders the reference library structure and searchable preset metadata', () => {
    renderView()
    expect(container?.querySelector('[aria-label="Preset Library"]')).not.toBeNull()
    expect(container?.querySelector('.pmv-content.vz-content')).not.toBeNull()
    expect(container?.querySelector('.vz-inspector.vz-inspector--left.rw-frame--left')).not.toBeNull()
    expect(container?.querySelector('.rw-window-header.rw-window-header--left')).not.toBeNull()
    expect(container?.querySelector('[aria-label="Create preset"].dv-icon-chip--primary')).not.toBeNull()
    expect(container?.querySelector('.pmv-tabs.dv-underline-tabs')).not.toBeNull()
    expect(container?.querySelector('.pmv-search.rv-preset-search-row')).not.toBeNull()
    expect(container?.querySelector('.pmv-category.dv-underline-dropdown')).not.toBeNull()
    expect(container?.querySelectorAll('.pmv-card')).toHaveLength(PRESET_MANAGER_PRESETS.length)
    expect(container?.textContent).toContain('Cinema 2.0')
    expect(container?.textContent).toContain('Sound Drawing')
    expect(container?.textContent).toContain('CANVAS')
    expect(container?.textContent).toContain('LaserDMX')
    expect(container?.textContent).toContain('PixGrid')
    expect(container?.textContent).toContain('HEADLINER')
    expect(container?.textContent).not.toMatch(/\d+ BPM|Reactivity/)

    const search = container?.querySelector<HTMLInputElement>('[placeholder="Search presets…"]')
    act(() => {
      if (!search) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(search, 'Bass Beacon')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container?.querySelectorAll('.pmv-card')).toHaveLength(1)
    expect(container?.textContent).toContain('Bass Beacon')
  })

  it('supports favorite and custom tabs', () => {
    renderView()
    const tabs = [...(container?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])]
    act(() => tabs.find(tab => tab.textContent?.toLowerCase() === 'favorites')?.click())
    expect(container?.querySelectorAll('.pmv-card')).toHaveLength(1)
    expect(container?.textContent).toContain(PRESET_MANAGER_PRESETS[0]?.name)

    act(() => tabs.find(tab => tab.textContent?.toLowerCase() === 'custom')?.click())
    expect(container?.querySelectorAll('.pmv-card')).toHaveLength(0)
    expect(container?.textContent).toContain('No presets match this view.')
  })
})
