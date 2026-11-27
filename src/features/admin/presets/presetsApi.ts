import { supabase } from '../../../lib/supabase'
import type { PresetMetadataRow } from '../../presetCatalog/presetMetadata'
import { usePresetMetadataStore } from '../../presetCatalog/presetMetadataStore'
import { adminDb, adminRequest, AdminApiError } from '../adminApi'
import type { CatalogPack, CatalogPackEdit, PackMember } from './presetAdmin'

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

export const updatePack = (id: string, patch: CatalogPackEdit) =>
  adminRequest<CatalogPack>(() => adminDb.from('catalog_packs').update(patch).eq('id', id).select('*').single())

export async function deletePack(id: string): Promise<void> {
  const deleted = await adminRequest<{ thumbnail_path: string | null } | null>(() => adminDb.from('catalog_packs').delete().eq('id', id).select('thumbnail_path').maybeSingle())
  if (deleted?.thumbnail_path) await supabase.storage.from(PACK_ARTWORK_BUCKET).remove([deleted.thumbnail_path]).catch(() => undefined)
}

export const addPackMember = (member: PackMember) =>
  adminRequest<PackMember>(() => adminDb.from('catalog_pack_members').insert(member).select('pack_id, engine_id, preset_key, position').single())

export const removePackMember = (packId: string, engineId: string, presetKey: string) =>
  adminRequest<null>(() => adminDb.from('catalog_pack_members').delete().eq('pack_id', packId).eq('engine_id', engineId).eq('preset_key', presetKey)).then(() => undefined)

export const movePackMember = (packId: string, engineId: string, presetKey: string, position: number) =>
  adminRequest<null>(() => adminDb.from('catalog_pack_members').update({ position }).eq('pack_id', packId).eq('engine_id', engineId).eq('preset_key', presetKey)).then(() => undefined)

const PACK_ARTWORK_BUCKET = 'catalog-pack-artwork'
const PACK_IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const PACK_IMAGE_ACCEPT = Object.keys(PACK_IMAGE_EXTENSIONS).join(',')

/** Private artwork is fetched using the signed-in admin session, never a public URL. */
export async function loadPackArtwork(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(PACK_ARTWORK_BUCKET).download(path)
  if (error || !data) throw new AdminApiError(error?.message ?? 'Artwork could not be loaded.')
  return data
}

/** Unique object names prevent stale browser/CDN images. Commit the catalog pointer only after upload succeeds. */
export async function uploadPackArtwork(pack: CatalogPack, file: File): Promise<CatalogPack> {
  const extension = PACK_IMAGE_EXTENSIONS[file.type]
  if (!extension) throw new AdminApiError('Choose a JPEG, PNG or WebP image.')
  if (!file.size || file.size > 5 * 1024 * 1024) throw new AdminApiError('Choose a non-empty image up to 5 MB.')
  const path = `${pack.id}/${crypto.randomUUID()}.${extension}`
  const bucket = supabase.storage.from(PACK_ARTWORK_BUCKET)
  const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new AdminApiError(error.message)
  try {
    // Compare the previous pointer so a simultaneous replacement cannot overwrite another admin's upload.
    const saved = await adminRequest<CatalogPack>(() => {
      const request = adminDb.from('catalog_packs').update({ thumbnail_path: path }).eq('id', pack.id)
      return (pack.thumbnail_path ? request.eq('thumbnail_path', pack.thumbnail_path) : request.is('thumbnail_path', null)).select('*').single()
    })
    if (pack.thumbnail_path) await bucket.remove([pack.thumbnail_path]).catch(() => undefined)
    return saved
  } catch (reason) {
    await bucket.remove([path]).catch(() => undefined)
    throw reason
  }
}
