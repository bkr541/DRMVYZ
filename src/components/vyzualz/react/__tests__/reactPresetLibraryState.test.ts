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
  it('hides legacy Spatial Fixtures presets from the locked LaserDMX default view', () => {
    const filtered = filterReactPresetLibrary(
      DEFAULT_REACT_PRESETS,
      'laserDmx',
      'beamMatrix',
      'current',
      new Set(),
    )

    expect(filtered).toHaveLength(0)
  })

  it('keeps Beam Matrix presets visible while hiding legacy Spatial Fixtures presets', () => {
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

    const visibleDefaultPresets = DEFAULT_REACT_PRESETS.filter(preset => preset.engine !== 'laserDmx')
    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'beamMatrix', 'all', favorites))
      .toHaveLength(visibleDefaultPresets.length)
    expect(filterReactPresetLibrary(DEFAULT_REACT_PRESETS, 'laserDmx', 'beamMatrix', 'favorites', favorites).map(preset => preset.id))
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
