import { describe, expect, it } from 'vitest'
import { appliedFilters, getFilterGroups, getStudyMatchingValues, getStudyMatchParts, matchesPreset, searchStudyPresets, toggleValue, type FilterPreset } from './presetFilterStudyData'

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


describe('smart preset search', () => {
  it('matches partial names, category, tags and collection names case-insensitively', () => {
    for (const query of ['AFTER', 'light', 'las', 'CLU']) {
      expect(searchStudyPresets(presets, query)).toEqual([presets[0]])
    }
    expect(searchStudyPresets(presets, 'night')).toEqual(presets)
    expect(searchStudyPresets(presets, ' arch NIGHT ')).toEqual([presets[1]])
    expect(searchStudyPresets(presets, 'night club')).toEqual([presets[0]])
    expect(searchStudyPresets(presets, 'night missing')).toEqual([])
    expect(searchStudyPresets(presets, 'c1')).toEqual([])
    expect(searchStudyPresets(presets, '  ')).toEqual(presets)
  })
  it('ranks name matches above metadata matches, preserving input order otherwise', () => {
    const metadataMatch = { ...presets[1], tags: ['Afterhours'] }
    expect(searchStudyPresets([metadataMatch, presets[0]], 'after')).toEqual([presets[0], metadataMatch])
  })
  it('returns only matching metadata values, deduplicating the same category and tag', () => {
    const cinematic = { ...presets[0], category: 'cinematic', tags: ['cinematic', 'Cinematic', '3d', 'chrome'] }
    expect(getStudyMatchingValues(cinematic, 'CIN')).toEqual(['cinematic'])
    expect(getStudyMatchingValues(cinematic, 'cin club')).toEqual(['cinematic', 'Club'])
    expect(getStudyMatchingValues(cinematic, 'after')).toEqual([])
    expect(getStudyMatchingValues(cinematic, '  ')).toEqual([])
  })
  it('highlights literal, case-insensitive substrings in their original spelling', () => {
    expect(getStudyMatchParts('cinematic', 'CIN')).toEqual([
      { text: 'cin', matched: true }, { text: 'ematic', matched: false },
    ])
    expect(getStudyMatchParts('Cinematic', 'IN mat')).toEqual([
      { text: 'C', matched: false }, { text: 'in', matched: true },
      { text: 'e', matched: false }, { text: 'mat', matched: true }, { text: 'ic', matched: false },
    ])
    expect(getStudyMatchParts('banana', 'ana')).toEqual([
      { text: 'b', matched: false }, { text: 'anana', matched: true },
    ])
    const literal = { ...presets[0], tags: ['C++', 'a.b'] }
    expect(searchStudyPresets([literal], '++')).toEqual([literal])
    expect(getStudyMatchingValues(literal, '+')).toEqual(['C++'])
    expect(getStudyMatchParts('a.b', '.')).toEqual([
      { text: 'a', matched: false }, { text: '.', matched: true }, { text: 'b', matched: false },
    ])
    expect(searchStudyPresets([literal], '[')).toEqual([])
    expect(getStudyMatchParts('Afterhours', ' ')).toEqual([{ text: 'Afterhours', matched: false }])
  })
})


describe('field-targeted alternative search', () => {
  it('restricts matching to the chosen metadata field', () => {
    expect(searchStudyPresets(presets, 'night', 'name')).toEqual([])
    expect(searchStudyPresets(presets, 'night', 'tag')).toEqual(presets)
    expect(searchStudyPresets(presets, 'light', 'category')).toEqual([presets[0]])
    expect(searchStudyPresets(presets, 'club', 'collection')).toEqual([presets[0]])
    expect(searchStudyPresets(presets, 'after', 'name')).toEqual([presets[0]])
    expect(searchStudyPresets(presets, 'night club', 'tag')).toEqual([])
    expect(searchStudyPresets(presets, '', 'collection')).toEqual(presets)
  })
})
