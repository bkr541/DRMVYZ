import { supabase } from '../../../lib/supabase'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import { usePresetMetadataStore } from '../../presetCatalog/presetMetadataStore'
import { adminDb, adminRequest } from '../adminApi'
import type { CatalogPack, PackMember } from './presetAdmin'

export const loadPresetMetadata = () => adminRequest<PresetMetadataRow[]>(() => adminDb.from('preset_catalog_metadata').select('*')).then(rows => rows ?? [])
export const loadPacks = () => adminRequest<CatalogPack[]>(() => adminDb.from('catalog_packs').select('*').order('display_order').order('name')).then(rows => rows ?? [])
export const loadPackMembers = () => adminRequest<PackMember[]>(() => adminDb.from('catalog_pack_members').select('pack_id, engine_id, preset_key, position').order('position')).then(rows => rows ?? [])

/** Saves a preset's metadata and hands the result to the app's own store, so the Preset Manager shows it at once. A null row means nothing is overridden any more. */
export async function savePresetMetadata(engineId: string, presetKey: string, row: PresetMetadataRow | null, current: readonly PresetMetadataRow[]): Promise<PresetMetadataRow[]> {
  const others = current.filter(entry => !(entry.engine_id === engineId && entry.preset_key === presetKey))
  if (!row) {
    await adminRequest<null>(() => adminDb.from('preset_catalog_metadata').delete().eq('engine_id', engineId).eq('preset_key', presetKey))
    usePresetMetadataStore.getState().setRows(others)
    return others
  }
  const { data } = await supabase.auth.getUser()
  const { updated_at: _at, ...columns } = row
  void _at
  const saved = await adminRequest<PresetMetadataRow>(() => adminDb.from('preset_catalog_metadata').upsert({ ...columns, updated_by: data.user?.id ?? null }, { onConflict: 'engine_id,preset_key' }).select('*').single())
  const next = [...others, saved]
  usePresetMetadataStore.getState().setRows(next)
  return next
}

export const createPack = (name: string, displayOrder: number) =>
  adminRequest<CatalogPack>(() => adminDb.from('catalog_packs').insert({ name: name.trim(), display_order: displayOrder }).select('*').single())

export const updatePack = (id: string, patch: Partial<Pick<CatalogPack, 'name' | 'description' | 'display_order'>>) =>
  adminRequest<CatalogPack>(() => adminDb.from('catalog_packs').update(patch).eq('id', id).select('*').single())

export const deletePack = (id: string) => adminRequest<null>(() => adminDb.from('catalog_packs').delete().eq('id', id)).then(() => undefined)

export const addPackMember = (member: PackMember) =>
  adminRequest<PackMember>(() => adminDb.from('catalog_pack_members').insert(member).select('pack_id, engine_id, preset_key, position').single())

export const removePackMember = (packId: string, engineId: string, presetKey: string) =>
  adminRequest<null>(() => adminDb.from('catalog_pack_members').delete().eq('pack_id', packId).eq('engine_id', engineId).eq('preset_key', presetKey)).then(() => undefined)

export const movePackMember = (packId: string, engineId: string, presetKey: string, position: number) =>
  adminRequest<null>(() => adminDb.from('catalog_pack_members').update({ position }).eq('pack_id', packId).eq('engine_id', engineId).eq('preset_key', presetKey)).then(() => undefined)
