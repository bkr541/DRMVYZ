import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  filterReactPresetLibrary,
  readReactPresetFavorites,
  writeReactPresetFavorites,
} from '../reactPresetLibraryState'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('React preset library state', () => {
  it('filters the default view to the selected engine only', () => {
    const filtered = filterReactPresetLibrary(
      DEFAULT_REACT_PRESETS,
      'laserDmx',
      'current',
      new Set(),
    )

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every(preset => preset.engine === 'laserDmx')).toBe(true)
  })

  it('keeps all-engine browsing explicit and favorites engine-agnostic', () => {
    const cinematic = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'cinematicPortal')!
    const neon = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'neonLattice')!
    const favorites = new Set([cinematic.id, neon.id])

    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'all', favorites))
      .toHaveLength(DEFAULT_REACT_PRESETS.length)
    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'favorites', favorites).map(preset => preset.id))
      .toEqual([cinematic.id, neon.id])
  })

  it('persists unique favorite ids and tolerates malformed storage', () => {
    const storage = createMemoryStorage()
    writeReactPresetFavorites(['one', 'two', 'one'], storage)
    expect(readReactPresetFavorites(storage)).toEqual(['one', 'two'])

    storage.setItem('drmvyz.reactPresetFavorites.v1', '{not-json')
    expect(readReactPresetFavorites(storage)).toEqual([])
  })
})
