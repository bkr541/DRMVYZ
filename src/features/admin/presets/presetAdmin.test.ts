import { describe, expect, it } from 'vitest'
import type { PresetManagerRecord } from '../../../components/vyzualz/presetManager/presetManagerCatalog'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import {
  ALL, NO_PACK, buildAdminPresets, editFromPreset, filterAdminPresets, groupByEngine, groupByPack, parseTags, rowFromEdit, sortAdminPresets, validateEdit,
  type CatalogPack, type PackMember, type PresetFilter,
} from './presetAdmin'

const record = (source: PresetManagerRecord['artwork'], sourceId: string, name: string, engineName: string, category = 'Light', tags: string[] = ['a']): PresetManagerRecord => ({
  id: `${source}:${sourceId}`, sourceId, name, description: `${name} description`, engineName, category, tags, artwork: source, activation: 'react',
  hasCamera: false, canIntegrateUserMedia: false, is3dEnvironment: false, sourceData: {},
})
const RECORDS = [record('cinema2', 'x', 'Xenon', 'Cinema 2.0'), record('cinema2', 'a', 'Alpha', 'Cinema 2.0', 'Dark'), record('canvas', 'c', 'Cube', 'CANVAS')]
const row = (engine: string, key: string, patch: Partial<PresetMetadataRow> = {}): PresetMetadataRow => ({
  engine_id: engine, preset_key: key, name: null, description: null, category: null, tags: null, display_order: null, publication_status: null,
  store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null, ...patch,
})
const PACKS: CatalogPack[] = [{ id: 'p2', name: 'Second', description: null, display_order: 2 }, { id: 'p1', name: 'First', description: null, display_order: 1 }, { id: 'p3', name: 'Empty', description: null, display_order: 3 }]
const MEMBERS: PackMember[] = [{ pack_id: 'p1', engine_id: 'cinema2', preset_key: 'x', position: 1 }, { pack_id: 'p2', engine_id: 'cinema2', preset_key: 'x', position: 1 }, { pack_id: 'p2', engine_id: 'canvas', preset_key: 'c', position: 2 }]
const OPEN: PresetFilter = { query: '', engine: ALL, category: ALL, packId: ALL, status: ALL }
const names = (list: { name: string }[]) => list.map(item => item.name)

describe('admin preset catalog', () => {
  const presets = buildAdminPresets(RECORDS, [row('cinema2', 'a', { name: 'Alpha Prime', publication_status: 'draft', display_order: 3 })], MEMBERS)

  it('shows the shipped metadata with the admin\'s changes and the packs each preset is in', () => {
    expect(names(presets)).toEqual(['Xenon', 'Alpha Prime', 'Cube'])
    expect(presets[1]).toMatchObject({ category: 'Dark', status: 'draft', order: 3, packIds: [] })
    expect(presets[0]!.packIds).toEqual(['p1', 'p2'])
  })

  it('filters by search, engine, category, pack, no pack and status', () => {
    const find = (patch: Partial<PresetFilter>) => names(filterAdminPresets(presets, { ...OPEN, ...patch }))
    expect(find({ query: 'prime' })).toEqual(['Alpha Prime'])
    expect(find({ query: 'cinema2:x' })).toEqual(['Xenon'])
    expect(find({ engine: 'CANVAS' })).toEqual(['Cube'])
    expect(find({ category: 'Dark' })).toEqual(['Alpha Prime'])
    expect(find({ packId: 'p2' })).toEqual(['Xenon', 'Cube'])
    expect(find({ packId: NO_PACK })).toEqual(['Alpha Prime'])
    expect(find({ status: 'draft' })).toEqual(['Alpha Prime'])
    expect(find({ status: 'unset' })).toEqual(['Xenon', 'Cube'])
  })

  it('sorts by name, engine, category and the order the app uses', () => {
    expect(names(sortAdminPresets(presets, 'name'))).toEqual(['Alpha Prime', 'Cube', 'Xenon'])
    expect(names(sortAdminPresets(presets, 'engine'))).toEqual(['Cube', 'Alpha Prime', 'Xenon'])
    expect(names(sortAdminPresets(presets, 'category'))).toEqual(['Alpha Prime', 'Cube', 'Xenon'])
    expect(names(sortAdminPresets(presets, 'order'))).toEqual(['Xenon', 'Cube', 'Alpha Prime'])
  })

  it('groups by engine, and by pack with empty packs kept and unpacked presets last', () => {
    expect(groupByEngine(presets).map(group => [group.label, names(group.presets)])).toEqual([['Cinema 2.0', ['Xenon', 'Alpha Prime']], ['CANVAS', ['Cube']]])
    expect(groupByPack(presets, PACKS).map(group => [group.label, names(group.presets)])).toEqual([
      ['First', ['Xenon']], ['Second', ['Xenon', 'Cube']], ['Empty', []], ['No pack', ['Alpha Prime']],
    ])
  })

  it('parses tags: trimmed, de-duplicated, empties dropped', () => {
    expect(parseTags(' neon, , Glow,neon ,')).toEqual(['neon', 'Glow'])
  })

  it('stores only what differs from the shipped metadata, and nothing at all when nothing does', () => {
    const edit = editFromPreset(buildAdminPresets(RECORDS, [], [])[0]!)
    expect(rowFromEdit(RECORDS[0]!, edit)).toBeNull()
    expect(rowFromEdit(RECORDS[0]!, { ...edit, name: 'Renamed', tagsText: 'a, b', orderText: '-2', status: 'published', storeTitle: 'Store' })).toMatchObject({
      engine_id: 'cinema2', preset_key: 'x', name: 'Renamed', description: null, category: null, tags: ['a', 'b'], display_order: -2, publication_status: 'published', store_title: 'Store',
    })
    // Clearing every tag is a change, because the shipped preset has one.
    expect(rowFromEdit(RECORDS[0]!, { ...edit, tagsText: '' })?.tags).toEqual([])
  })

  it('rejects an empty name, a bad order and too many or too long tags', () => {
    const edit = editFromPreset(presets[0]!)
    expect(validateEdit(edit)).toEqual({})
    expect(validateEdit({ ...edit, name: ' ' }).name).toBeTruthy()
    expect(validateEdit({ ...edit, orderText: '1.5' }).order).toBeTruthy()
    expect(validateEdit({ ...edit, orderText: '999999' }).order).toBeTruthy()
    expect(validateEdit({ ...edit, tagsText: Array.from({ length: 33 }, (_, index) => `t${index}`).join(',') }).tags).toBeTruthy()
    expect(validateEdit({ ...edit, tagsText: 'x'.repeat(41) }).tags).toBeTruthy()
  })
})
