// Typed helpers for audio_tracks storage and DB operations.
// Mirrors the pattern in mediaDb.ts.

import { supabase, supabaseConfigured } from './supabase'
import type { AudioTrack, AudioTrackInsert, TrackAnalysisRow, Json } from '../types/database'
import type { TrackIntelligenceAnalysis } from '../features/musicIntelligence/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteAudioTrackCanonical } from './audioTrackDeletion'

const db = supabase as unknown as SupabaseClient

// ── Shared result types (re-used from mediaDb pattern) ────────────────────────

export interface DbListResult<T> { rows: T[]; error: string | null }
export interface DbCreateResult  { id: string | null; error: string | null }
export interface DbPageResult<T> { rows: T[]; count: number; error: string | null }
export interface DbMutateResult  { error: string | null }
export interface SignedUrlResult { url: string | null; error: string | null }

export type AudioTrackMetadataUpdate = Pick<AudioTrack, 'title' | 'artist' | 'genre' | 'bpm' | 'musical_key'>

// ── audio_tracks ──────────────────────────────────────────────────────────────

export async function listAudioTracks(userId: string): Promise<DbListResult<AudioTrack>> {
  const { data, error } = await db
    .from('audio_tracks')
    .select('*')
    .eq('user_id', userId)
    .eq('lifecycle_status', 'complete')
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
    .eq('lifecycle_status', 'complete')
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
  update: AudioTrackMetadataUpdate,
): Promise<DbMutateResult> {
  const { error } = await db.from('audio_tracks').update(update).eq('id', id)
  return { error: error?.message ?? null }
}

/** @deprecated Persisted audio deletion must use the canonical server-owned cleanup operation. */
export async function deleteAudioTrack(id: string): Promise<DbMutateResult> {
  const result = await deleteAudioTrackCanonical(id)
  return { error: result.ok ? null : result.message ?? 'Audio track deletion failed.' }
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

export type TrackAnalysisInsert = Omit<TrackAnalysisRow, 'id' | 'analyzed_at' | 'analysis_payload'> & {
  analysis_payload?: Json | null
}

export async function createTrackAnalysis(insert: TrackAnalysisInsert): Promise<DbCreateResult> {
  const { data, error } = await db
    .from('track_analyses')
    .insert(insert)
    .select('id')
    .single()
  return { id: (data as { id: string } | null)?.id ?? null, error: error?.message ?? null }
}


export async function upsertTrackAnalysisPayload(
  trackId: string,
  analysis: TrackIntelligenceAnalysis,
): Promise<DbMutateResult> {
  if (!supabaseConfigured) return { error: 'Supabase not configured' }
  const { error } = await db
    .from('track_analyses')
    .upsert({
      track_id:          trackId,
      bpm:               analysis.bpm,
      bpm_confidence:    analysis.bpmConfidence,
      key_note:          analysis.harmonic.dominantKey,
      key_mode:          analysis.harmonic.dominantMode,
      lufs_integrated:   null,
      lufs_short:        null,
      lufs_momentary:    null,
      true_peak:         null,
      dynamic_range:     null,
      stereo_width:      null,
      phase_correlation: null,
      waveform_peaks:    null,
      spectrum_avg:      null,
      band_bass:         null,
      band_low_mid:      null,
      band_mid:          null,
      band_high_mid:     null,
      band_presence:     null,
      band_air:          null,
      analysis_payload:  analysis as unknown as Json,
      analyzed_at:       new Date().toISOString(),
    }, { onConflict: 'track_id' })
  return { error: error?.message ?? null }
}

export async function listTrackAnalysisPayloads(
  trackIds: string[],
): Promise<DbListResult<Pick<TrackAnalysisRow, 'track_id' | 'analysis_payload' | 'bpm' | 'bpm_confidence'>>> {
  const ids = Array.from(new Set(trackIds.filter(Boolean)))
  if (!ids.length) return { rows: [], error: null }
  const { data, error } = await db
    .from('track_analyses')
    .select('track_id,analysis_payload,bpm,bpm_confidence')
    .in('track_id', ids)
  return {
    rows: (data as Pick<TrackAnalysisRow, 'track_id' | 'analysis_payload' | 'bpm' | 'bpm_confidence'>[] | null) ?? [],
    error: error?.message ?? null,
  }
}
