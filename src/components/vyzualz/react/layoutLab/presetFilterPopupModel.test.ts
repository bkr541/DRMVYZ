import { describe, expect, it } from 'vitest'
import { getPopupSections } from './presetFilterPopupModel'
import type { FilterPreset } from './presetFilterStudyData'

const records: FilterPreset[] = [
  { id: 'a', artworkId: 'a', name: 'Reactor', description: '', category: 'Architecture', tags: ['reactor'], favorite: false, collections: [] },
  { id: 'b', artworkId: 'b', name: 'Corridor', description: '', category: 'Architecture', tags: ['audio-reactive'], favorite: false, collections: [{ id: 'c', name: 'Live Set' }] },
  { id: 'd', artworkId: 'd', name: 'Pulse', description: '', category: 'Lighting', tags: ['audio-reactive'], favorite: false, collections: [{ id: 'c', name: 'Live Set' }] },
]

describe('anchored preset search popovers', () => {
  it('separates title and metadata hits without duplicate presets', () => {
    const groups = getPopupSections('grouped-search', records, 'rea')
    expect(groups.map(group => [group.label, group.choices.map(choice => choice.key)])).toEqual([
      ['Preset names', ['preset:a']], ['Metadata matches', ['preset:b', 'preset:d']],
    ])
  })
  it('suggests real metadata values and exact scoped counts, not synthetic tags', () => {
    const groups = getPopupSections('metadata-suggestions', records, 'rea')
    expect(groups[0].label).toBe('Tags')
    expect(groups[0].choices).toContainEqual({ kind: 'facet', key: 'tag:audio-reactive', facet: 'tag', value: 'audio-reactive', label: 'audio-reactive', count: 2 })
    const collection = getPopupSections('metadata-suggestions', records, 'live set')[0]
    expect(collection.choices).toEqual([{ kind: 'facet', key: 'collection:c', facet: 'collection', value: 'c', label: 'Live Set', count: 2 }])
    expect(getPopupSections('metadata-suggestions', records, 'rea missing')).toEqual([])
    expect(getPopupSections('metadata-suggestions', records, ' ')).toEqual([])
  })
  it('visual autocomplete uses real records and retains catalog order on empty input', () => {
    expect(getPopupSections('visual-search', records, '')[0].choices.map(choice => choice.key)).toEqual(['preset:a', 'preset:b', 'preset:d'])
    expect(getPopupSections('visual-search', records, 'lighting')[0].choices.map(choice => choice.key)).toEqual(['preset:d'])
    expect(getPopupSections('visual-search', records, 'missing')).toEqual([])
  })
})
