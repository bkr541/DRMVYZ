import { describe, expect, it } from 'vitest'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  filterReactPresetLibrary,
  readReactPresetFavorites,
  sanitizeReactPresetFavorites,
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
      'spatialFixtures',
      'current',
      new Set(),
    )

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every(preset => preset.engine === 'laserDmx')).toBe(true)
    expect(filtered.every(preset => preset.laserDmxWorkspace === 'spatialFixtures')).toBe(true)
  })

  it('filters LaserDMX presets by the active sub-workspace', () => {
    const spatial = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'laserDmx')!
    const beamMatrix = {
      ...spatial,
      id: 'test-beam-matrix-react-preset',
      name: 'Beam Matrix Test',
      laserDmxWorkspace: 'beamMatrix' as const,
      laserDmxSettings: undefined,
    }

    expect(filterReactPresetLibrary(
      [...DEFAULT_REACT_PRESETS, beamMatrix],
      'laserDmx',
      'beamMatrix',
      'current',
      new Set(),
    ).map(preset => preset.id)).toEqual([beamMatrix.id])
  })

  it('keeps all-engine browsing explicit and favorites engine-agnostic', () => {
    const cinematic = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'cinematicPortal')!
    const oscilloscope = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'oscilloscope')!
    const favorites = new Set([cinematic.id, oscilloscope.id])

    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'spatialFixtures', 'all', favorites))
      .toHaveLength(DEFAULT_REACT_PRESETS.length)
    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'spatialFixtures', 'favorites', favorites).map(preset => preset.id))
      .toEqual([cinematic.id, oscilloscope.id])
  })

  it('persists unique favorite ids and tolerates malformed storage', () => {
    const storage = createMemoryStorage()
    writeReactPresetFavorites(['one', 'two', 'one'], storage)
    expect(readReactPresetFavorites(storage)).toEqual(['one', 'two'])

    storage.setItem('drmvyz.reactPresetFavorites.v1', '{not-json')
    expect(readReactPresetFavorites(storage)).toEqual([])
  })

  it('removes retired and ghost favorites without disturbing valid order', () => {
    const storage = createMemoryStorage()
    const valid = DEFAULT_REACT_PRESETS.slice(0, 2).map(preset => preset.id)
    writeReactPresetFavorites([
      valid[1],
      'preset-nl-acid-magenta',
      'missing-preset',
      valid[0],
      valid[1],
    ], storage)

    expect(sanitizeReactPresetFavorites(valid, storage)).toEqual([valid[1], valid[0]])
    expect(readReactPresetFavorites(storage)).toEqual([valid[1], valid[0]])
  })
})
