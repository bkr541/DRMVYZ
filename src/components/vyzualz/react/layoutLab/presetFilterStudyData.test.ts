import { describe, expect, it } from 'vitest'
import { appliedFilters, getFilterGroups, matchesPreset, toggleValue, type FilterPreset } from './presetFilterStudyData'

const presets: FilterPreset[] = [
  { id: 'a', artworkId: 'a', name: 'Afterhours', description: 'Laser scene', category: 'Lighting', tags: ['Laser', 'Night'], favorite: true, collections: [{ id: 'c1', name: 'Club' }] },
  { id: 'b', artworkId: 'b', name: 'Blockshift', description: 'Afterhours variation', category: 'Architecture', tags: ['Night'], favorite: false, collections: [] },
]

describe('inline preset filter data', () => {
  it('derives exactly five groups from the supplied engine records', () => {
    const groups = getFilterGroups(presets)
    expect(groups.map(group => group.id)).toEqual(['name', 'category', 'favorite', 'tag', 'collection'])
    expect(groups[0].options).toEqual([{ value: 'a', label: 'Afterhours' }, { value: 'b', label: 'Blockshift' }])
    expect(groups[3].options.map(option => option.label)).toEqual(['Laser', 'Night'])
    expect(groups[4].options).toEqual([{ value: 'c1', label: 'Club' }])
  })
  it('matches names only, combines groups with AND and values with OR', () => {
    expect(presets.filter(preset => matchesPreset(preset, 'afterhours', {}))).toEqual([presets[0]])
    expect(presets.filter(preset => matchesPreset(preset, '', { tag: ['Night', 'Laser'], favorite: ['no'] }))).toEqual([presets[1]])
    expect(presets.filter(preset => matchesPreset(preset, '', { name: ['a', 'b'], category: ['Lighting'], collection: ['c1'] }))).toEqual([presets[0]])
    expect(presets.filter(preset => matchesPreset(preset, '', { favorite: ['no'], collection: ['c1'] }))).toEqual([])
  })
  it('uses stable IDs for selected names and collections and removes selections independently', () => {
    const groups = getFilterGroups(presets)
    expect(appliedFilters(groups, { name: ['a'], collection: ['c1'] })).toEqual([
      { id: 'name', value: 'a', label: 'Afterhours' }, { id: 'collection', value: 'c1', label: 'Club' },
    ])
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b'])
  })
})
