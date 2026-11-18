import { describe, expect, it } from 'vitest'
import { applyPresetMetadata, indexPresetMetadata, presetMetadataKey, type PresetMetadataRow } from './presetMetadata'

const preset = (id: string, name = id) => ({ id, name, description: `${name} description`, category: 'Shipped', tags: ['shipped'] as readonly string[] })
const row = (engine: string, key: string, patch: Partial<PresetMetadataRow> = {}): PresetMetadataRow => ({
  engine_id: engine, preset_key: key, name: null, description: null, category: null, tags: null, display_order: null, publication_status: null,
  store_title: null, store_subtitle: null, store_cover_ref: null, store_preview_ref: null, ...patch,
})
const PRESETS = [preset('cinema2:a'), preset('cinema2:b'), preset('canvas:c')]

describe('applying preset metadata', () => {
  it('keys a row like a Preset Manager record id', () => {
    expect(presetMetadataKey('cinema2', 'drmvyz.cinema2.go-to')).toBe('cinema2:drmvyz.cinema2.go-to')
  })

  it('changes nothing when there are no rows', () => {
    expect(applyPresetMetadata(PRESETS, new Map())).toEqual(PRESETS)
  })

  it('overrides only the columns that are set and leaves the shipped value for the rest', () => {
    const [a, b] = applyPresetMetadata(PRESETS, indexPresetMetadata([row('cinema2', 'a', { name: 'Renamed', tags: ['x', 'y'] })]))
    expect(a).toMatchObject({ id: 'cinema2:a', name: 'Renamed', description: 'cinema2:a description', category: 'Shipped', tags: ['x', 'y'] })
    expect(b).toEqual(PRESETS[1])
  })

  it('lets an admin clear every tag: an empty list is an override, null is not', () => {
    expect(applyPresetMetadata(PRESETS, indexPresetMetadata([row('cinema2', 'a', { tags: [] })]))[0]!.tags).toEqual([])
    expect(applyPresetMetadata(PRESETS, indexPresetMetadata([row('cinema2', 'a', { tags: null })]))[0]!.tags).toEqual(['shipped'])
  })

  it('orders by display order, with an unset order counting as 0 and ties keeping the shipped order', () => {
    const ids = (rows: PresetMetadataRow[]) => applyPresetMetadata(PRESETS, indexPresetMetadata(rows)).map(entry => entry.id)
    expect(ids([row('canvas', 'c', { display_order: -1 })])).toEqual(['canvas:c', 'cinema2:a', 'cinema2:b'])
    expect(ids([row('cinema2', 'a', { display_order: 5 })])).toEqual(['cinema2:b', 'canvas:c', 'cinema2:a'])
    expect(ids([row('cinema2', 'a', { display_order: 0 })])).toEqual(['cinema2:a', 'cinema2:b', 'canvas:c'])
  })

  it('ignores the publication status and the store fields, which belong to the store', () => {
    const [a] = applyPresetMetadata(PRESETS, indexPresetMetadata([row('cinema2', 'a', { publication_status: 'archived', store_title: 'Store title' })]))
    expect(a).toEqual(PRESETS[0])
  })
})
