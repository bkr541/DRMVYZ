// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { PresetManagerView } from './PresetManagerView'
import { PRESET_MANAGER_PRESETS } from './presetManagerCatalog'
import { useReactStore } from '../../../stores/reactStore'
import { cinema2NativePresetRegistry } from '../cinema2'
import { DEFAULT_REACT_PRESETS } from '../react/ReactTypes'

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
  it('excludes retired Cinema presets while retaining public Cinema 2.0 presets', () => {
    const legacyCinemaPresetIds = new Set(DEFAULT_REACT_PRESETS
      .filter(preset => preset.engine === 'cinema' || preset.engine === 'cinematicPortal')
      .map(preset => preset.id))
    const publicCinema2PresetIds = cinema2NativePresetRegistry.list()
      .filter(manifest => !manifest.metadata.tags?.includes('internal'))
      .map(manifest => manifest.id)

    expect(PRESET_MANAGER_PRESETS.some(preset => legacyCinemaPresetIds.has(preset.sourceId))).toBe(false)
    expect(PRESET_MANAGER_PRESETS
      .filter(preset => preset.activation === 'cinema2')
      .map(preset => preset.sourceId))
      .toEqual(publicCinema2PresetIds)
  })

  it('uses concise public names for the renamed Cinema 2.0 presets', () => {
    const cinema2Names = new Set(PRESET_MANAGER_PRESETS
      .filter(preset => preset.activation === 'cinema2')
      .map(preset => preset.name))

    for (const name of [
      'Afterhours',
      'Ancient Machine',
      'Cathedral',
      'Constellation',
      'Electric Storm',
      'Event Horizon',
      'Reactor',
    ]) {
      expect(cinema2Names.has(name)).toBe(true)
      expect(cinema2Names.has(`${name} 2.0`)).toBe(false)
    }
  })

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
    expect(container?.querySelector('.pmv-card .dv-badge')).toBeNull()

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

  it('loads a selected preset into the matching React inspector configuration', () => {
    renderView()
    const inspectorTabs = [...(container?.querySelectorAll<HTMLButtonElement>('[aria-label="Preset Manager inspector panels"] [role="tab"]') ?? [])]
    expect(inspectorTabs.map(tab => tab.textContent)).toEqual(['INFO', 'DESIGN', 'REACT', 'OUTPUT'])

    const preset = PRESET_MANAGER_PRESETS.find(candidate => candidate.artwork === 'soundDrawing')
    expect(preset).toBeDefined()
    const card = container?.querySelector<HTMLElement>(`.pmv-card[data-preset-id="${preset?.sourceId}"]`)
    act(() => card?.querySelector<HTMLButtonElement>('.pmv-card-main')?.click())

    expect(useReactStore.getState().activeReactEngineId).toBe('oscilloscope')
    expect(useReactStore.getState().activeReactPresetId).toBe(preset?.sourceId)
    expect(card?.classList.contains('is-active')).toBe(true)
    expect(container?.querySelector('.pmv-inspector-body')?.getAttribute('data-selected-preset')).toBe(preset?.sourceId)
    expect(container?.querySelector('.pmv-info-panel')?.getAttribute('aria-label')).toBe(`${preset?.name} preset information`)
    expect(container?.querySelectorAll('.pmv-inspector-body .rv-ctrl-group').length).toBeGreaterThan(0)
    expect(container?.querySelectorAll('.pmv-info-panel .rv-ctrl-group > .drc-group')).toHaveLength(1)
    expect(container?.querySelector('.pmv-info-panel .rv-ctrl-group > .drc-group > .drc-header')?.textContent).toContain('Preset Info')
    expect(container?.querySelector('.pmv-info-panel .rv-ctrl-section-label')).toBeNull()
    expect([...(container?.querySelectorAll('.pmv-info-panel .rv-insp-key') ?? [])].map(row => row.textContent)).toEqual([
      'Name',
      'Description',
      'Engine',
      'Category',
      'Tags',
      'Custom',
    ])

    act(() => inspectorTabs.find(tab => tab.textContent === 'DESIGN')?.click())
    expect(container?.querySelector('.pmv-inspector-body .rv-workspace-panel')).not.toBeNull()

    act(() => inspectorTabs.find(tab => tab.textContent === 'REACT')?.click())
    expect(container?.querySelector('[aria-label="Reactivity surfaces"]')).not.toBeNull()
    expect(container?.textContent).toContain('ROUTING')
    expect(container?.textContent).toContain('ANALYSIS')
  })
})
