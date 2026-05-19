// Narrow typed helpers for media_items DB and storage operations.
// Avoids the `supabase as any` pattern by isolating the controlled cast here
// and returning explicitly typed results.

import { supabase, supabaseConfigured } from './supabase'
import type { MediaItemRow, MediaItemInsert } from '../types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// supabase-js v2 createClient<Database> causes `never` inference when the
// Database type lacks `Relationships` arrays on each table definition.
// We isolate the cast here so the rest of the app gets proper return types.
const db = supabase as unknown as SupabaseClient

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DbListResult {
  rows: MediaItemRow[]
  error: string | null
}

export interface DbCreateResult {
  id: string | null
  error: string | null
}

export interface DbMutateResult {
  error: string | null
}

export interface SignedUrlResult {
  url: string | null
  error: string | null
}

// ── DB helpers ─────────────────────────────────────────────────────────────────

export async function listMediaItems(userId: string): Promise<DbListResult> {
  const { data, error } = await db
    .from('media_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return {
    rows: (data as MediaItemRow[] | null) ?? [],
    error: error?.message ?? null,
  }
}

export async function createMediaItem(insert: MediaItemInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('media_items')
    .insert(insert)
    .select('id')
    .single()
  return {
    id: (data as { id: string } | null)?.id ?? null,
    error: error?.message ?? null,
  }
}

export async function updateMediaItem(
  id: string,
  update: Partial<Omit<MediaItemRow, 'id' | 'created_at' | 'updated_at'>>,
): Promise<DbMutateResult> {
  const { error } = await db
    .from('media_items')
    .update(update)
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteMediaItem(id: string): Promise<DbMutateResult> {
  const { error } = await db
    .from('media_items')
    .delete()
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ── Storage helpers ────────────────────────────────────────────────────────────

export async function createSignedMediaUrl(
  storagePath: string,
  expiresIn = 604800,
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage
    .from('media-items')
    .createSignedUrl(storagePath, expiresIn)
  return { url: data?.signedUrl ?? null, error: error?.message ?? null }
}

export async function uploadMediaFile(
  storagePath: string,
  file: File | Blob,
  contentType: string,
): Promise<DbMutateResult> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await supabase.storage
    .from('media-items')
    .upload(storagePath, file, { upsert: false, contentType })
  return { error: error?.message ?? null }
}

export async function deleteMediaFiles(paths: string[]): Promise<DbMutateResult> {
  if (!paths.length) return { error: null }
  const { error } = await supabase.storage.from('media-items').remove(paths)
  return { error: error?.message ?? null }
}
