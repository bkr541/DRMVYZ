import { describe, expect, it } from 'vitest'
import { buildVisualPresetRecords } from './visualPresetSearchModel'
import { getStudyMatchingValues, getStudyMatchParts, searchStudyPresets } from '../layoutLab/presetFilterStudyData'
import { indexPresetMetadata, type PresetMetadataRow } from '../../../../features/presetCatalog/presetMetadata'
import { createPresetScopeFilter } from '../../../../features/presetCatalog/presetScope'

const sources = [
  { id: 'shared', name: 'First', category: 'Lighting', tags: ['night'] },
  { id: 'private', name: 'Second', category: 'Architecture', tags: ['motion'] },
]
const metadata: PresetMetadataRow = {
  engine_id: 'canvas', preset_key: 'shared', name: 'First Renamed', description: null,
  category: 'Cinematic', tags: ['cinematic'], display_order: null, publication_status: null,
  store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null,
}
const organizations = {
  'canvas:shared': { tags: ['Neon'], collectionIds: ['club', 'missing'] },
  'laserDmx:shared': { tags: ['WrongEngine'], collectionIds: ['other'] },
}
const collections = [{ id: 'club', name: 'Club Night' }, { id: 'other', name: 'Other Engine' }]

describe('engine-scoped Visual Search records', () => {
  it('merges real metadata and personal organization without importing another engine or unknown preset', () => {
    const records = buildVisualPresetRecords('canvas', sources, indexPresetMetadata([metadata, { ...metadata, preset_key: 'not-in-engine' }]), organizations, collections)
    expect(records.map(record => record.id)).toEqual(['shared', 'private'])
    expect(searchStudyPresets(records, 'cin neo club').map(record => record.id)).toEqual(['shared'])
    expect(getStudyMatchingValues(records[0], 'cin neo club')).toEqual(['Cinematic', 'Neon', 'Club Night'])
    expect(getStudyMatchParts('Cinematic', 'CIN')).toEqual([{ text: 'Cin', matched: true }, { text: 'ematic', matched: false }])
    expect(searchStudyPresets(records, 'WrongEngine')).toEqual([])
    expect(searchStudyPresets(records, 'First Renamed')[0].artworkId).toBe('shared')
    expect(records[0].collections).toEqual([{ id: 'club', name: 'Club Night' }])
  })
  it('respects system/user ownership and never leaks hidden presets into search', () => {
    const snapshot = { entries: [{ id: 'owned', engine_id: 'canvas', preset_key: 'private', scope: 'user' as const }], heldPresetIds: ['owned'] }
    const ids = (scope: 'system' | 'user', heldPresetIds = snapshot.heldPresetIds) => buildVisualPresetRecords('canvas', sources.filter(source => createPresetScopeFilter({ ...snapshot, heldPresetIds }, 'canvas', scope)(source.id)), new Map(), {}, []).map(record => record.id)
    expect(ids('system')).toEqual(['shared'])
    expect(ids('user')).toEqual(['private'])
    expect(ids('user', [])).toEqual([])
  })
  it('uses the Preset Manager organization key for the Sound Drawing engine', () => {
    const records = buildVisualPresetRecords('oscilloscope', sources, new Map(), { 'soundDrawing:shared': { tags: ['Personal'], collectionIds: [] } }, [])
    expect(searchStudyPresets(records, 'Personal').map(record => record.id)).toEqual(['shared'])
  })
})
