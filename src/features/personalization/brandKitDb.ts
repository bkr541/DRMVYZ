import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import type {
  BrandKitAssetInsert,
  BrandKitAssetUpdate,
  BrandKitInsert,
  BrandKitRow,
  BrandKitUpdate,
  Json,
} from '../../types/database'
import type {
  ActiveBrandKitData,
  BrandKit,
  BrandKitAssetWithMedia,
} from './BrandKitTypes'
import {
  normalizeBrandKitAssetRow,
  normalizeBrandKitEngineRules,
  normalizeBrandKitRow,
} from './brandKitNormalization'

const db = supabase as unknown as SupabaseClient

export interface BrandKitListResult<T> { rows: T[]; error: string | null }
export interface BrandKitValueResult<T> { value: T | null; error: string | null }
export interface BrandKitMutationResult { error: string | null }

function unavailable(): string | null {
  return supabaseConfigured ? null : 'Supabase not configured'
}

function asJson(value: unknown): Json {
  return value as Json
}

export async function listBrandKits(userId: string): Promise<BrandKitListResult<BrandKit>> {
  const configError = unavailable()
  if (configError) return { rows: [], error: configError }
  const { data, error } = await db.from('brand_kits').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  return {
    rows: ((data as BrandKitRow[] | null) ?? []).map(normalizeBrandKitRow),
    error: error?.message ?? null,
  }
}

export async function readBrandKit(id: string, userId: string): Promise<BrandKitValueResult<BrandKit>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const { data, error } = await db.from('brand_kits').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  return {
    value: data ? normalizeBrandKitRow(data as BrandKitRow) : null,
    error: error?.message ?? null,
  }
}

export async function createBrandKit(
  userId: string,
  input: Omit<BrandKitInsert, 'user_id'>,
): Promise<BrandKitValueResult<BrandKit>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const insert: BrandKitInsert = { ...input, user_id: userId }
  const { data, error } = await db.from('brand_kits').insert(insert).select('*').single()
  return {
    value: data ? normalizeBrandKitRow(data as BrandKitRow) : null,
    error: error?.message ?? null,
  }
}

export async function updateBrandKit(
  id: string,
  userId: string,
  update: BrandKitUpdate,
): Promise<BrandKitValueResult<BrandKit>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const { data, error } = await db.from('brand_kits').update(update).eq('id', id).eq('user_id', userId).select('*').maybeSingle()
  return {
    value: data ? normalizeBrandKitRow(data as BrandKitRow) : null,
    error: error?.message ?? null,
  }
}

export async function deleteBrandKit(id: string, userId: string): Promise<BrandKitMutationResult> {
  const configError = unavailable()
  if (configError) return { error: configError }
  const { error } = await db.from('brand_kits').delete().eq('id', id).eq('user_id', userId)
  return { error: error?.message ?? null }
}

export async function setActiveBrandKit(userId: string, brandKitId: string | null): Promise<BrandKitMutationResult> {
  const configError = unavailable()
  if (configError) return { error: configError }
  const { error } = await db.from('user_settings').upsert(
    { user_id: userId, active_brand_kit_id: brandKitId },
    { onConflict: 'user_id' },
  )
  return { error: error?.message ?? null }
}

export async function clearActiveBrandKit(userId: string): Promise<BrandKitMutationResult> {
  return setActiveBrandKit(userId, null)
}

export async function listBrandKitAssets(brandKitId: string): Promise<BrandKitListResult<BrandKitAssetWithMedia>> {
  const configError = unavailable()
  if (configError) return { rows: [], error: configError }
  const { data, error } = await db
    .from('brand_kit_assets')
    .select('*, media_items(id,user_id,name,storage_path,thumbnail_path,mime_type,media_role,metadata)')
    .eq('brand_kit_id', brandKitId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  const rows = ((data as Record<string, unknown>[] | null) ?? [])
    .map(normalizeBrandKitAssetRow)
    .filter((row): row is BrandKitAssetWithMedia => row !== null)
  return { rows, error: error?.message ?? null }
}

export async function addBrandKitAsset(input: BrandKitAssetInsert): Promise<BrandKitValueResult<BrandKitAssetWithMedia>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const { data, error } = await db
    .from('brand_kit_assets')
    .insert(input)
    .select('*, media_items(id,user_id,name,storage_path,thumbnail_path,mime_type,media_role,metadata)')
    .single()
  return {
    value: data ? normalizeBrandKitAssetRow(data as Record<string, unknown>) : null,
    error: error?.message ?? null,
  }
}

export async function updateBrandKitAsset(
  id: string,
  update: BrandKitAssetUpdate,
): Promise<BrandKitValueResult<BrandKitAssetWithMedia>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const { data, error } = await db
    .from('brand_kit_assets')
    .update(update)
    .eq('id', id)
    .select('*, media_items(id,user_id,name,storage_path,thumbnail_path,mime_type,media_role,metadata)')
    .maybeSingle()
  return {
    value: data ? normalizeBrandKitAssetRow(data as Record<string, unknown>) : null,
    error: error?.message ?? null,
  }
}

export async function removeBrandKitAsset(id: string): Promise<BrandKitMutationResult> {
  const configError = unavailable()
  if (configError) return { error: configError }
  const { error } = await db.from('brand_kit_assets').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function loadActiveBrandKitData(userId: string): Promise<BrandKitValueResult<ActiveBrandKitData>> {
  const configError = unavailable()
  if (configError) return { value: null, error: configError }
  const { data: settings, error: settingsError } = await db
    .from('user_settings')
    .select('active_brand_kit_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (settingsError) return { value: null, error: settingsError.message }
  const activeId = (settings as { active_brand_kit_id?: string | null } | null)?.active_brand_kit_id ?? null
  if (!activeId) return { value: null, error: null }

  const [kitResult, assetsResult] = await Promise.all([
    readBrandKit(activeId, userId),
    listBrandKitAssets(activeId),
  ])
  if (kitResult.error) return { value: null, error: kitResult.error }
  if (assetsResult.error) return { value: null, error: assetsResult.error }
  if (!kitResult.value) return { value: null, error: 'Active Brand Kit was not found' }
  return { value: { kit: kitResult.value, assets: assetsResult.rows }, error: null }
}

export function brandKitToDbUpdate(kit: Partial<BrandKit>): BrandKitUpdate {
  const update: BrandKitUpdate = {}
  if (kit.name !== undefined) update.name = kit.name
  if (kit.palette !== undefined) update.palette = asJson(kit.palette)
  if (kit.extractedPalette !== undefined) update.extracted_palette = asJson(kit.extractedPalette ?? {})
  if (kit.extractionMetadata !== undefined) update.extraction_metadata = asJson(kit.extractionMetadata ?? {})
  if (kit.defaultStrength !== undefined) update.default_strength = kit.defaultStrength
  if (kit.engineRules !== undefined) update.engine_rules = asJson(normalizeBrandKitEngineRules(kit.engineRules))
  if (kit.presetRules !== undefined) update.preset_rules = asJson(kit.presetRules)
  if (kit.useForAppAccent !== undefined) update.use_for_app_accent = kit.useForAppAccent
  if (kit.autoApply !== undefined) update.auto_apply = kit.autoApply
  return update
}
