// Typed helpers for audio_tracks storage and DB operations.
// Mirrors the pattern in mediaDb.ts.

import { supabase, supabaseConfigured } from './supabase'
import type { AudioTrack, AudioTrackInsert, TrackAnalysisRow } from '../types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

const db = supabase as unknown as SupabaseClient

// ── Shared result types (re-used from mediaDb pattern) ────────────────────────

export interface DbListResult<T> { rows: T[]; error: string | null }
export interface DbCreateResult  { id: string | null; error: string | null }
export interface DbPageResult<T> { rows: T[]; count: number; error: string | null }
export interface DbMutateResult  { error: string | null }
export interface SignedUrlResult { url: string | null; error: string | null }

// ── audio_tracks ──────────────────────────────────────────────────────────────

export async function listAudioTracks(userId: string): Promise<DbListResult<AudioTrack>> {
  const { data, error } = await db
    .from('audio_tracks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { rows: (data as AudioTrack[] | null) ?? [], error: error?.message ?? null }
}



export interface ListAudioTracksPageOptions {
  offset?: number
  limit?: number
  search?: string
}

/** Server-paged, newest-first audio track listing used by track-first workflows. */
export async function listAudioTracksPage(
  userId: string,
  options: ListAudioTracksPageOptions = {},
): Promise<DbPageResult<AudioTrack>> {
  const offset = Math.max(0, options.offset ?? 0)
  const limit = Math.max(1, Math.min(100, options.limit ?? 24))
  const search = options.search?.trim().replace(/[,%_]/g, ' ') ?? ''

  let query = db
    .from('audio_tracks')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`title.ilike.%${search}%,artist.ilike.%${search}%`)
  }

  const { data, count, error } = await query
  return {
    rows: (data as AudioTrack[] | null) ?? [],
    count: count ?? 0,
    error: error?.message ?? null,
  }
}

export async function createAudioTrack(insert: AudioTrackInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('audio_tracks')
    .insert(insert)
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}

export async function updateAudioTrack(
  id: string,
  update: Partial<Omit<AudioTrack, 'id' | 'created_at' | 'updated_at'>>,
): Promise<DbMutateResult> {
  const { error } = await db.from('audio_tracks').update(update).eq('id', id)
  return { error: error?.message ?? null }
}

export async function deleteAudioTrack(id: string): Promise<DbMutateResult> {
  const { error } = await db.from('audio_tracks').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ── Storage (audio-tracks bucket) ─────────────────────────────────────────────

export async function createSignedAudioUrl(
  storagePath: string,
  expiresIn = 604800,
): Promise<SignedUrlResult> {
  const { data, error } = await supabase.storage
    .from('audio-tracks')
    .createSignedUrl(storagePath, expiresIn)
  return { url: data?.signedUrl ?? null, error: error?.message ?? null }
}

export async function uploadAudioFile(
  storagePath: string,
  file: File | Blob,
  contentType: string,
): Promise<DbMutateResult> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await supabase.storage
    .from('audio-tracks')
    .upload(storagePath, file, { upsert: false, contentType })
  return { error: error?.message ?? null }
}

export async function deleteAudioFiles(paths: string[]): Promise<DbMutateResult> {
  if (!paths.length) return { error: null }
  const { error } = await supabase.storage.from('audio-tracks').remove(paths)
  return { error: error?.message ?? null }
}

// ── track_analyses ─────────────────────────────────────────────────────────────

export type TrackAnalysisInsert = Omit<TrackAnalysisRow, 'id' | 'analyzed_at'>

export async function createTrackAnalysis(insert: TrackAnalysisInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('track_analyses')
    .insert(insert)
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}
