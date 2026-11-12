// @vitest-environment jsdom
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn(), sign: vi.fn() }))
vi.mock('../../../features/models/data/modelAssetRepository', () => ({ modelAssetRepository: { list: mocks.list, update: mocks.update, signedUrl: mocks.sign } }))
vi.mock('../../../stores/mediaStore', () => ({ useMediaStore: (select: (s: { accountId: string }) => unknown) => select({ accountId: 'owner' }) }))
import { ModelLibraryCards } from './ModelLibraryCards'
import { useModelEditorStore } from '../../../features/models/state/modelEditorStore'
const asset = (id: string, favorite = false) => ({ id, name: `Model ${id}`, currentVersion: 1, favorite })
let host: HTMLDivElement, root: ReturnType<typeof createRoot>
const props = { search: '', favorites: false, viewMode: 'grid' as const, activeId: null, onSelect: vi.fn() }
async function render(overrides: Partial<React.ComponentProps<typeof ModelLibraryCards>> = {}) { await act(async () => root.render(<ModelLibraryCards {...props} {...overrides} />)) }
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue({ items: [asset('shared-id')], nextCursor: null }); mocks.sign.mockRejectedValue(new Error('No thumbnail')); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); useModelEditorStore.getState().reset() })
describe('model card paging and interactions', () => {
  it('selects a typed model identity and persists favorites with no image adapter', async () => {
    await render()
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Select 3D model Model shared-id"]')!.click())
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'shared-id' }))
    mocks.update.mockResolvedValue(asset('shared-id', true))
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Favorite model Model shared-id"]')!.click())
    expect(mocks.update).toHaveBeenCalledWith('shared-id', { favorite: true })
    expect(host.querySelector('[aria-label="Favorite model Model shared-id"]')?.getAttribute('aria-pressed')).toBe('true')
  })
  it('virtualizes loaded rows and requests the next server page without mixing identities', async () => {
    const cursor = { createdAt: '2026-11-12T00:00:00Z', id: '49' }
    mocks.list.mockResolvedValueOnce({ items: Array.from({ length: 50 }, (_, i) => asset(String(i))), nextCursor: cursor }).mockResolvedValueOnce({ items: [asset('50')], nextCursor: null })
    await render()
    expect(host.querySelectorAll('.mm-model-card').length).toBeLessThan(50)
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Load more models')!.click())
    expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor, limit: 50 }))
    expect(host.textContent).toContain('51 loaded')
  })
  it('ignores a stale search response, and supports list/favorites query state', async () => {
    let resolve!: (v: unknown) => void
    mocks.list.mockReturnValueOnce(new Promise(done => { resolve = done })).mockResolvedValueOnce({ items: [asset('filtered', true)], nextCursor: null })
    await render(); await render({ search: 'filtered', favorites: true, viewMode: 'list' })
    await act(async () => resolve({ items: [asset('old')], nextCursor: null }))
    expect(mocks.list).toHaveBeenLastCalledWith({ search: 'filtered', includeDeletionPending: true, favorite: true, limit: 50 })
    expect(host.textContent).toContain('Model filtered'); expect(host.textContent).not.toContain('Model old')
    expect(host.querySelector('.mm-model-card--list')).not.toBeNull()
  })
  it('uses the shared group header and preserves the model page across collapse/reopen', async () => {
    await render()
    const header = host.querySelector<HTMLButtonElement>('.drc-header')!
    expect(header.getAttribute('aria-expanded')).toBe('true')
    expect(header.querySelector('.drc-header-icon')).not.toBeNull()
    expect(header.querySelector('.drc-arrow')).not.toBeNull()
    await act(async () => header.click())
    expect(host.querySelector('.mm-model-card')).toBeNull()
    await act(async () => header.click())
    expect(host.textContent).toContain('Model shared-id')
    expect(mocks.list).toHaveBeenCalledTimes(1)
  })
  it('renders and retries explicit repository errors', async () => {
    mocks.list.mockRejectedValueOnce(new Error('Sign in to access model assets.'))
    await render(); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Sign in')
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Retry models')!.click())
    expect(host.textContent).toContain('Model shared-id')
  })
})
