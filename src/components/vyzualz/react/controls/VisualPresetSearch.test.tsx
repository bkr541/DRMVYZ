// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { VisualPresetSearch } from './VisualPresetSearch'
import type { FilterPreset } from '../layoutLab/presetFilterStudyData'
import type { PresetScopeTab } from '../../../../features/presetCatalog/presetScope'

vi.mock('../ReactPresetCard', () => ({ ReactPresetArtwork: ({ id }: { id: string }) => <span data-artwork-id={id} /> }))
const system: FilterPreset = { id: 'a', artworkId: 'a', name: 'First', description: '', category: 'Cinematic', tags: ['Night'], favorite: false, collections: [] }
const personal: FilterPreset = { ...system, id: 'b', artworkId: 'b', name: 'Second', category: 'Personal' }

it('opens on empty focus, highlights matching metadata, selects by keyboard, and switches scopes', async () => {
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const choose = vi.fn()
  function Harness() {
    const [scope, setScope] = useState<PresetScopeTab>('system')
    const [query, setQuery] = useState('')
    return <VisualPresetSearch query={query} onQueryChange={setQuery} scope={scope} onScopeChange={next => { setScope(next); setQuery('') }}
      records={scope === 'system' ? [system] : [personal]} onSelect={preset => { choose(preset.id); setQuery(preset.name) }} />
  }
  try {
    await act(async () => root.render(<Harness />))
    const input = host.querySelector<HTMLInputElement>('[role="combobox"]')!
    await act(async () => input.focus())
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(1)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'CIN')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.querySelector('mark')?.textContent).toBe('Cin')
    expect(host.querySelector('[data-artwork-id="a"]')).not.toBeNull()
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(choose).toHaveBeenCalledWith('a')
    expect(input.value).toBe('First')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="User presets"]')!.click())
    expect(input.value).toBe('')
    expect(host.querySelector('[data-app-icon="grid"]')).not.toBeNull()
    await act(async () => input.click())
    expect(host.querySelector('[data-artwork-id="a"]')).toBeNull()
    expect(host.querySelector('[data-artwork-id="b"]')).not.toBeNull()
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(input.getAttribute('aria-expanded')).toBe('false')
  } finally { await act(async () => root.unmount()); host.remove() }
})
