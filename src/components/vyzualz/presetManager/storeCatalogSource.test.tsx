// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LivePresetStore } from './LivePresetStore'
import { buildStoreCatalog, loadStoreCatalogRows, storeArtFor, type StoreCatalogRows, type StoreCatalogSource } from './storeCatalogSource'
import { MOCK_STORE_CATALOG } from './storeCatalog'

let source: StoreCatalogSource = { status: 'loading' }
vi.mock('./storeCatalogSource', async importOriginal => {
  const original = await importOriginal<typeof import('./storeCatalogSource')>()
  return { ...original, useStoreCatalogSource: () => source }
})

// Rows shaped like what supabase/test-data/preset_store_test_products.sql creates.
const ROWS: StoreCatalogRows = {
  products: [
    { id: 'p-ghost', kind: 'preset', preset_id: 'pr-ghost', pack_id: null, current_release_id: 'rel-ghost', slug: 'test-ghost-frequency', title: 'Ghost Frequency (Test)', subtitle: 'Preset', description: 'Haunting textures.', tags: ['test', 'cinema2'], sort_order: 20, published_at: '2026-10-29T12:00:00+00:00' },
    { id: 'p-pack', kind: 'pack', preset_id: null, pack_id: 'pack-1', current_release_id: null, slug: 'test-midnight-signals', title: 'Midnight Signals (Test)', subtitle: 'Expansion Pack', description: 'Late hours.', tags: ['test'], sort_order: 5, published_at: '2026-10-29T12:00:00+00:00' },
    { id: 'p-empty', kind: 'pack', preset_id: null, pack_id: 'pack-empty', current_release_id: null, slug: 'test-empty', title: 'Empty', subtitle: null, description: null, tags: null, sort_order: 1, published_at: null },
  ],
  packItems: [
    { pack_id: 'pack-1', preset_id: 'pr-b', release_id: 'rel-b', position: 2 },
    { pack_id: 'pack-1', preset_id: 'pr-a', release_id: 'rel-a', position: 1 },
  ],
  presets: [
    { id: 'pr-ghost', engine_id: 'cinema2', preset_key: 'test.store.ghost-frequency', name: 'Ghost Frequency' },
    { id: 'pr-a', engine_id: 'cinema2', preset_key: 'test.store.moonlit-static', name: 'Moonlit Static' },
    { id: 'pr-b', engine_id: 'pixGrid', preset_key: 'test.store.harbor-lights', name: 'Harbor Lights' },
  ],
  releases: [{ id: 'rel-ghost', preset_id: 'pr-ghost', version: '1.0.0' }],
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null
function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(<LivePresetStore />))
}
afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('buildStoreCatalog', () => {
  const catalog = buildStoreCatalog(ROWS)
  const pack = catalog.items.find(item => item.id === 'p-pack')
  const preset = catalog.items.find(item => item.id === 'p-ghost')

  it('turns a pack row into a pack with its presets in order, and skips a pack with none', () => {
    expect(catalog.items.map(item => item.id)).toEqual(['p-pack', 'p-ghost'])
    expect(pack).toMatchObject({ kind: 'pack', name: 'Midnight Signals (Test)', subtitle: 'Expansion Pack', presetCount: 2, priceCents: 0 })
    expect(pack?.contents?.map(member => member.name)).toEqual(['Moonlit Static', 'Harbor Lights'])
    expect(pack?.engines).toEqual(['Cinema 2.0', 'PixGrid'])
  })

  it('turns a preset row into a free preset with its release version and engine', () => {
    expect(preset).toMatchObject({ kind: 'preset', subtitle: 'Preset', priceCents: 0, engines: ['Cinema 2.0'], releasedAt: '2026-10-29' })
    expect(preset?.details).toEqual({ tags: ['test', 'cinema2'], version: '1.0.0' })
  })

  it('lists packs as featured and leaves popularity unset, so only real data drives the sections', () => {
    expect(pack).toMatchObject({ bannerRank: 5, featuredRank: 5 })
    expect(preset?.popularRank).toBeUndefined()
    expect(preset?.featuredRank).toBeUndefined()
  })

  it('makes the same placeholder art for the same key every time', () => {
    expect(storeArtFor('test-ghost-frequency')).toEqual(storeArtFor('test-ghost-frequency'))
    expect(storeArtFor('a')).not.toEqual(storeArtFor('b'))
  })
})

describe('loadStoreCatalogRows', () => {
  it('reads only published products and skips follow-up reads that have nothing to ask for', async () => {
    const calls: string[] = []
    const result = (data: unknown[]) => Promise.resolve({ data, error: null })
    const builder = (table: string, data: unknown[]) => {
      const chain: Record<string, unknown> = {}
      chain['select'] = () => chain
      chain['eq'] = (column: string, value: string) => { calls.push(`${table}.eq(${column},${value})`); return chain }
      chain['in'] = () => chain
      chain['then'] = (resolve: (value: unknown) => unknown) => result(data).then(resolve)
      return chain
    }
    const client = { from: (table: string) => { calls.push(table); return builder(table, []) } }
    const rows = await loadStoreCatalogRows(client as never)
    expect(rows.products).toEqual([])
    expect(calls).toEqual(['store_products', 'store_products.eq(status,published)'])
  })

  it('throws when a read fails', async () => {
    const chain: Record<string, unknown> = {}
    chain['select'] = () => chain
    chain['eq'] = () => chain
    chain['then'] = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: new Error('denied') }).then(resolve)
    await expect(loadStoreCatalogRows({ from: () => chain } as never)).rejects.toThrow('denied')
  })
})

describe('LivePresetStore', () => {
  it('shows a loading state, then the database catalog without a notice', () => {
    source = { status: 'loading' }
    render()
    expect(container?.textContent).toContain('Loading the store')

    act(() => root?.unmount())
    container?.remove()
    source = { status: 'database', catalog: buildStoreCatalog(ROWS) }
    render()
    expect(container?.querySelector('.pms-notice')).toBeNull()
    expect(container?.textContent).toContain('Midnight Signals (Test)')
    expect(container?.textContent).toContain('Ghost Frequency (Test)')
    expect(container?.textContent).not.toContain('Prism Drift')
  })

  it('falls back to the sample catalog and says why', () => {
    source = { status: 'sample', reason: 'No published products yet.' }
    render()
    expect(container?.querySelector('.pms-notice')?.textContent).toBe('Showing sample data. No published products yet.')
    expect(container?.textContent).toContain(MOCK_STORE_CATALOG.items[0]?.name)
  })

  it('opens a database pack with its preset records and no empty detail rows', () => {
    source = { status: 'database', catalog: buildStoreCatalog(ROWS) }
    render()
    act(() => container?.querySelector<HTMLElement>('.pms-pack[data-store-item="p-pack"]')?.click())
    expect([...(container?.querySelectorAll('.pms-content-row strong') ?? [])].map(name => name.textContent)).toEqual(['Moonlit Static', 'Harbor Lights'])
    expect(container?.querySelector('.pms-content-desc')).toBeNull()
    const labels = [...(container?.querySelectorAll('.pms-detail-row dt') ?? [])].map(row => row.textContent)
    expect(labels).toEqual(['Type', 'Presets', 'Engines', 'Released', 'Tags'])
  })
})
