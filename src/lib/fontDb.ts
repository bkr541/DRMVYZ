// Narrow typed helpers for font_assets DB and storage operations.
// supabase is created with createClient<Database> so all table queries are
// statically typed — no cast to an untyped SupabaseClient is needed here.

import { supabase, supabaseConfigured } from './supabase'
import type { FontAssetRow, FontAssetInsert, DBRec } from '../types/database'
import type { DbListResult, DbCreateResult, DbMutateResult } from './mediaDb'

export interface BlobResult { data: Blob | null; error: string | null }

// ── font_assets table ─────────────────────────────────────────────────────────

export async function listFontAssets(userId: string): Promise<DbListResult<FontAssetRow>> {
  const { data, error } = await supabase
    .from('font_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { rows: data ?? [], error: error?.message ?? null }
}

export async function createFontAsset(insert: FontAssetInsert): Promise<DbCreateResult> {
  const { data, error } = await supabase
    .from('font_assets')
    .insert(insert as DBRec<FontAssetInsert>)
    .select('id')
    .single()
  return { id: data?.id ?? null, error: error?.message ?? null }
}

export async function deleteFontAsset(id: string): Promise<DbMutateResult> {
  const { error } = await supabase.from('font_assets').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── font-assets storage bucket ────────────────────────────────────────────────

export async function uploadFontFile(
  storagePath: string,
  file: File | Blob,
  contentType: string,
): Promise<DbMutateResult> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await supabase.storage
    .from('font-assets')
    .upload(storagePath, file, { upsert: false, contentType })
  return { error: error?.message ?? null }
}

export async function downloadFontFile(storagePath: string): Promise<BlobResult> {
  if (!supabaseConfigured) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase.storage
    .from('font-assets')
    .download(storagePath)
  return { data: data ?? null, error: error?.message ?? null }
}

export async function removeFontFile(storagePath: string): Promise<DbMutateResult> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await supabase.storage.from('font-assets').remove([storagePath])
  return { error: error?.message ?? null }
}
