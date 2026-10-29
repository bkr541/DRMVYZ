// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PresetManagerView } from './PresetManagerView'
import { usePresetOrganizationStore } from '../../../features/presetOrganization/presetOrganizationStore'
import {
  DEFAULT_STORE_QUERY,
  MOCK_STORE_CATALOG,
  formatStorePrice,
  matchStoreItems,
  storeSectionItems,
} from './storeCatalog'

// The Store reads the database; these tests run against the sample catalog instead.
vi.mock('./storeCatalogSource', async importOriginal => {
  const original = await importOriginal<typeof import('./storeCatalogSource')>()
  const { MOCK_STORE_CATALOG: catalog } = await import('./storeCatalog')
  return { ...original, useStoreCatalogSource: () => ({ status: 'database' as const, catalog }) }
})

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

beforeEach(() => {
  usePresetOrganizationStore.setState({ records: {}, status: 'ready', error: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(<PresetManagerView />))
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

const stageTab = (label: string) => [...(container?.querySelectorAll<HTMLButtonElement>('[aria-label="Preset Manager workspace views"] [role="tab"]') ?? [])]
  .find(tab => tab.textContent === label)

function openStore() {
  act(() => stageTab('Store')?.click())
}

function typeInto(input: HTMLInputElement | null | undefined, value: string) {
  act(() => {
    if (!input) return
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('Preset Manager stage tabs', () => {
  it('nests the visualizer, Store and My Downloads in the middle window and leaves both rails alone', () => {
    expect([...(container?.querySelectorAll('[aria-label="Preset Manager workspace views"] [role="tab"]') ?? [])].map(tab => tab.textContent))
      .toEqual(['Visualizer', 'Store', 'My Downloads'])
    expect(stageTab('Visualizer')?.getAttribute('aria-selected')).toBe('true')
    expect(container?.querySelector('.pmv-stage .pmv-selection-summary, .pmv-stage .rv-cinema2-stage')).not.toBeNull()

    openStore()
    expect(container?.querySelector('.pmv-stage .pms-root')).not.toBeNull()
    expect(container?.querySelector('.pmv-stage .pmv-selection-summary')).toBeNull()
    expect(container?.querySelector('[aria-label="Preset Library"]')).not.toBeNull()
    expect(container?.querySelector('[aria-label="Preset Manager inspector panels"]')).not.toBeNull()
    expect(container?.querySelectorAll('.pmv-content > .fw-surface')).toHaveLength(3)

    act(() => stageTab('My Downloads')?.click())
    expect(container?.querySelector('.pms-downloads')?.textContent).toContain('Coming soon')

    act(() => stageTab('Visualizer')?.click())
    expect(container?.querySelector('.pms-root')).toBeNull()
  })
})

describe('Preset Store', () => {
  it('lays out the banner and the Featured Packs, Popular Presets and Free Presets sections', () => {
    openStore()
    expect(container?.querySelector('.pms-banner-title')?.textContent).toBe('MIDNIGHTSIGNALS')
    expect(container?.querySelector('.pms-banner-price')?.textContent).toBe('$24.00')
    expect([...(container?.querySelectorAll('.pms-section-head h3') ?? [])].map(heading => heading.textContent))
      .toEqual(['Featured Packs', 'Popular Presets', 'Free Presets'])
    expect(container?.querySelectorAll('.pms-pack')).toHaveLength(2)
    expect([...(container?.querySelectorAll('.pms-section[aria-label="Free Presets"] .pms-preset .pms-open') ?? [])].map(name => name.textContent))
      .toEqual(['Surface Noise', 'Neon Flats', 'Echo Field'])
    expect(container?.querySelector('.pms-new')?.textContent).toBe('NEW')
    expect(container?.querySelectorAll('.pms-free').length).toBeGreaterThan(0)
  })

  it('gives every pack as many preset records as it advertises', () => {
    for (const pack of MOCK_STORE_CATALOG.items.filter(item => item.kind === 'pack')) {
      expect(pack.contents?.length).toBe(pack.presetCount)
      expect(new Set(pack.contents?.map(preset => preset.id)).size).toBe(pack.contents?.length)
      const engines = new Set(pack.contents?.map(preset => preset.engine))
      expect([...engines].sort()).toEqual([...pack.engines].sort())
    }
  })

  it('switches banner slides from the dots', () => {
    openStore()
    const dots = container?.querySelectorAll<HTMLButtonElement>('.pms-dot')
    expect(dots).toHaveLength(4)
    act(() => dots?.[1]?.click())
    expect(container?.querySelector('.pms-banner')?.getAttribute('data-store-item')).toBe('pack-lumen-vault')
  })

  it('searches the catalog and shows an empty state', () => {
    openStore()
    typeInto(container?.querySelector<HTMLInputElement>('[aria-label="Search the store"]'), 'ghost')
    expect(container?.querySelector('.pms-banner')).toBeNull()
    expect([...(container?.querySelectorAll('.pms-preset .pms-open') ?? [])].map(name => name.textContent)).toEqual(['Ghost Frequency'])

    typeInto(container?.querySelector<HTMLInputElement>('[aria-label="Search the store"]'), 'zzzz')
    expect(container?.querySelector('.pms-empty')?.textContent).toContain('No store items match')
  })

  it('opens View All for a section and returns to the store home', () => {
    openStore()
    const viewAll = container?.querySelector<HTMLButtonElement>('.pms-section[aria-label="Featured Packs"] .pms-view-all')
    act(() => viewAll?.click())
    expect(container?.querySelectorAll('.pms-pack')).toHaveLength(4)
    expect(container?.querySelector('.pms-banner')).toBeNull()

    act(() => container?.querySelector<HTMLButtonElement>('.pms-back')?.click())
    expect(container?.querySelector('.pms-banner')).not.toBeNull()
  })

  it('opens a pack detail from the banner, a pack card or a preset Preview button, and goes back', () => {
    openStore()
    act(() => container?.querySelector<HTMLButtonElement>('.pms-cta')?.click())
    expect(container?.querySelector('.pms-detail')?.getAttribute('data-detail-kind')).toBe('pack')
    expect(container?.querySelector('.pms-banner')).toBeNull()
    act(() => container?.querySelector<HTMLButtonElement>('.pms-back')?.click())
    expect(container?.querySelector('.pms-banner')).not.toBeNull()

    act(() => container?.querySelector<HTMLElement>('.pms-pack[data-store-item="pack-lumen-vault"]')?.click())
    expect(container?.querySelector('.pms-detail-title')?.textContent).toBe('Lumen Vault')
    act(() => container?.querySelector<HTMLButtonElement>('.pms-back')?.click())

    act(() => container?.querySelector<HTMLButtonElement>('.pms-preset[data-store-item="preset-prism-drift"] .pms-preview')?.click())
    expect(container?.querySelector('.pms-detail')?.getAttribute('data-detail-kind')).toBe('preset')
    expect(container?.querySelector('.pms-detail-title')?.textContent).toBe('Prism Drift')
  })

  it('shows a preview, every preset record and the details for a pack', () => {
    openStore()
    act(() => container?.querySelector<HTMLElement>('.pms-pack[data-store-item="pack-midnight-signals"]')?.click())
    expect(container?.querySelector('.pms-detail-preview .pms-preview-stage')).not.toBeNull()
    expect(container?.querySelector('.pms-preview-caption strong')?.textContent).toBe('Moonlit Static')
    const rows = container?.querySelectorAll('.pms-content-row')
    expect(rows).toHaveLength(8)
    expect(container?.querySelector('.pms-section[aria-label="Presets in this pack"] h3')?.textContent).toBe('Presets in this pack (8)')
    expect([...(container?.querySelectorAll('.pms-detail-row dt') ?? [])].map(row => row.textContent))
      .toEqual(['Type', 'Presets', 'Engines', 'Category', 'Author', 'Version', 'Download Size', 'Released', 'License', 'Tags'])
    expect(container?.querySelector('.pms-detail-meta')?.textContent).toBe('8 Presets • Cinema 2.0 + PixGrid')

    act(() => rows?.[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container?.querySelector('.pms-preview-caption strong')?.textContent).toBe('Sleepless Grid')
    expect(container?.querySelector('.pms-preview-caption span')?.textContent).toBe('Cinema 2.0 • 3 of 8')
    expect(container?.querySelector('.pms-content-row.is-active')?.getAttribute('data-pack-preset')).toBe('pack-midnight-signals:3')
  })

  it('shows only the single preset, with the same layout, for a preset', () => {
    openStore()
    act(() => container?.querySelector<HTMLElement>('.pms-preset[data-store-item="preset-ghost-frequency"]')?.click())
    expect(container?.querySelector('.pms-detail-top .pms-detail-preview .pms-preview-stage')).not.toBeNull()
    expect(container?.querySelector('.pms-detail-top .pms-detail-summary')).not.toBeNull()
    expect(container?.querySelector('.pms-preview-caption strong')?.textContent).toBe('Ghost Frequency')
    expect(container?.querySelectorAll('.pms-content-row')).toHaveLength(0)
    expect(container?.querySelector('.pms-section[aria-label="Presets in this pack"]')).toBeNull()
    expect([...(container?.querySelectorAll('.pms-detail-row dt') ?? [])].map(row => row.textContent))
      .toEqual(['Type', 'Engine', 'Category', 'Author', 'Version', 'Download Size', 'Released', 'License', 'Tags'])
  })

  it('keeps buying inert and leaves the store view intact when pressed', () => {
    openStore()
    act(() => container?.querySelector<HTMLElement>('.pms-pack[data-store-item="pack-midnight-signals"]')?.click())
    const buy = container?.querySelector<HTMLButtonElement>('.pms-detail-buy .pms-cta')
    expect(buy?.getAttribute('aria-disabled')).toBe('true')
    const before = container?.innerHTML
    act(() => buy?.click())
    expect(container?.innerHTML).toBe(before)
  })

  it('closes a detail view when the search changes', () => {
    openStore()
    act(() => container?.querySelector<HTMLElement>('.pms-pack[data-store-item="pack-midnight-signals"]')?.click())
    typeInto(container?.querySelector<HTMLInputElement>('[aria-label="Search the store"]'), 'echo')
    expect(container?.querySelector('.pms-detail')).toBeNull()
    expect([...(container?.querySelectorAll('.pms-preset .pms-open') ?? [])].map(name => name.textContent)).toEqual(['Echo Field'])
  })

  it('toggles a store favorite without touching the preset library favorites', () => {
    openStore()
    const star = container?.querySelector<HTMLButtonElement>('.pms-star')
    expect(star?.getAttribute('aria-pressed')).toBe('false')
    act(() => star?.click())
    expect(container?.querySelector<HTMLButtonElement>('.pms-star')?.getAttribute('aria-pressed')).toBe('true')
    expect(container?.querySelector('.pms-detail')).toBeNull()
  })
})

describe('store catalog queries', () => {
  it('filters by type, price and engine and sorts', () => {
    const catalog = MOCK_STORE_CATALOG
    expect(matchStoreItems(catalog, { ...DEFAULT_STORE_QUERY, type: 'pack' }).every(item => item.kind === 'pack')).toBe(true)
    expect(matchStoreItems(catalog, { ...DEFAULT_STORE_QUERY, price: 'free' }).every(item => item.priceCents === 0)).toBe(true)
    expect(matchStoreItems(catalog, { ...DEFAULT_STORE_QUERY, engine: 'PixGrid' }).every(item => item.engines.includes('PixGrid'))).toBe(true)
    const cheapestFirst = matchStoreItems(catalog, { ...DEFAULT_STORE_QUERY, sort: 'priceLow' }).map(item => item.priceCents)
    expect(cheapestFirst).toEqual([...cheapestFirst].sort((a, b) => a - b))
    expect(storeSectionItems(catalog, 'free', 'featured').some(item => item.id === 'preset-monochrome-pulse')).toBe(false)
  })

  it('formats prices', () => {
    expect(formatStorePrice(2400)).toBe('$24.00')
    expect(formatStorePrice(0)).toBe('FREE')
  })
})
