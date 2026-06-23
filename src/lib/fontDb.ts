// Narrow typed helpers for font_assets DB and storage operations.
// Avoids the `supabase as any` pattern by isolating the controlled cast here.

import { supabase, supabaseConfigured } from './supabase'
import type { FontAssetRow, FontAssetInsert } from '../types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DbListResult, DbCreateResult, DbMutateResult } from './mediaDb'

const db = supabase as unknown as SupabaseClient

export interface BlobResult { data: Blob | null; error: string | null }

// ── font_assets table ─────────────────────────────────────────────────────────

export async function listFontAssets(userId: string): Promise<DbListResult<FontAssetRow>> {
  const { data, error } = await db
    .from('font_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { rows: (data as FontAssetRow[] | null) ?? [], error: error?.message ?? null }
}

export async function createFontAsset(insert: FontAssetInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('font_assets')
    .insert(insert)
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}

export async function deleteFontAsset(id: string): Promise<DbMutateResult> {
  const { error } = await db.from('font_assets').delete().eq('id', id)
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
