// Data-access helpers for public.lyric_documents and public.lyric_cues.
// Returns camelCase runtime objects — DB snake_case is an internal detail.
// Throws on Supabase errors rather than returning { error } objects,
// making call sites cleaner and failures impossible to ignore silently.

import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  LyricDocument,
  LyricCue,
  LyricDocumentRow,
  LyricCueRow,
  CreateLyricDocumentInput,
  CreateLyricCueInput,
  UpdateLyricDocumentInput,
  UpdateLyricCueInput,
  LyricDocumentInsert,
} from '../types/lyrics'
import {
  mapLyricDocumentRowToDocument,
  mapLyricCueRowToCue,
  mapLyricCueToInsert,
} from '../types/lyrics'

// supabase-js v2 createClient<Database> can infer `never` for tables
// that don't have Relationships arrays. Isolate the cast here.
const db = supabase as unknown as SupabaseClient

// ── Error helper ──────────────────────────────────────────────────────────────

function throwSupabaseError(error: unknown, fallbackMessage: string): never {
  if (error && typeof error === 'object' && 'message' in error) {
    throw new Error(`lyricsDb: ${(error as { message: string }).message}`)
  }
  throw new Error(`lyricsDb: ${fallbackMessage}`)
}

// ── lyric_documents ───────────────────────────────────────────────────────────

/** All lyric documents for a user, newest first. */
export async function getLyricDocumentsForUser(userId: string): Promise<LyricDocument[]> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throwSupabaseError(error, 'Failed to fetch lyric documents')
  return ((data as LyricDocumentRow[]) ?? []).map(mapLyricDocumentRowToDocument)
}

/** Active lyric document tied to a specific audio track, or null. */
export async function getActiveLyricDocumentForAudioTrack(
  audioTrackId: string,
): Promise<LyricDocument | null> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('audio_track_id', audioTrackId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throwSupabaseError(error, 'Failed to fetch lyric document for audio track')
  return data ? mapLyricDocumentRowToDocument(data as LyricDocumentRow) : null
}

/** Active lyric document tied to a specific visual session, or null. */
export async function getActiveLyricDocumentForVisualSession(
  visualSessionId: string,
): Promise<LyricDocument | null> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('visual_session_id', visualSessionId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throwSupabaseError(error, 'Failed to fetch lyric document for visual session')
  return data ? mapLyricDocumentRowToDocument(data as LyricDocumentRow) : null
}

/** Single lyric document by id, or null if not found. */
export async function getLyricDocumentById(documentId: string): Promise<LyricDocument | null> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle()

  if (error) throwSupabaseError(error, `Failed to fetch lyric document ${documentId}`)
  return data ? mapLyricDocumentRowToDocument(data as LyricDocumentRow) : null
}

/** Create a new lyric document. Returns the inserted document. */
export async function createLyricDocument(
  input: CreateLyricDocumentInput,
): Promise<LyricDocument> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('lyricsDb: must be authenticated to create a lyric document')

  const insert: LyricDocumentInsert = {
    user_id:           user.id,
    audio_track_id:    input.audioTrackId    ?? null,
    visual_session_id: input.visualSessionId ?? null,
    title:             input.title,
    artist:            input.artist           ?? '',
    source_type:       input.sourceType       ?? 'manual',
    source_format:     input.sourceFormat     ?? 'json',
    raw_source_text:   input.rawSourceText    ?? null,
    default_style:     input.defaultStyle     ?? {},
    default_animation: input.defaultAnimation ?? {},
    default_effects:   input.defaultEffects   ?? {},
    global_offset_ms:  input.globalOffsetMs   ?? 0,
    is_active:         true,
    metadata:          input.metadata         ?? {},
  }

  const { data, error } = await db
    .from('lyric_documents')
    .insert(insert)
    .select('*')
    .single()

  if (error) throwSupabaseError(error, 'Failed to create lyric document')
  return mapLyricDocumentRowToDocument(data as LyricDocumentRow)
}

/** Update fields on an existing lyric document. Returns the updated document. */
export async function updateLyricDocument(
  documentId: string,
  input: UpdateLyricDocumentInput,
): Promise<LyricDocument> {
  const patch: Record<string, unknown> = {}
  if (input.title             !== undefined) patch.title             = input.title
  if (input.artist            !== undefined) patch.artist            = input.artist
  if (input.audioTrackId      !== undefined) patch.audio_track_id    = input.audioTrackId
  if (input.visualSessionId   !== undefined) patch.visual_session_id = input.visualSessionId
  if (input.sourceType        !== undefined) patch.source_type       = input.sourceType
  if (input.sourceFormat      !== undefined) patch.source_format     = input.sourceFormat
  if (input.rawSourceText     !== undefined) patch.raw_source_text   = input.rawSourceText
  if (input.defaultStyle      !== undefined) patch.default_style     = input.defaultStyle
  if (input.defaultAnimation  !== undefined) patch.default_animation = input.defaultAnimation
  if (input.defaultEffects    !== undefined) patch.default_effects   = input.defaultEffects
  if (input.globalOffsetMs    !== undefined) patch.global_offset_ms  = input.globalOffsetMs
  if (input.isActive          !== undefined) patch.is_active         = input.isActive
  if (input.metadata          !== undefined) patch.metadata          = input.metadata

  const { data, error } = await db
    .from('lyric_documents')
    .update(patch)
    .eq('id', documentId)
    .select('*')
    .single()

  if (error) throwSupabaseError(error, `Failed to update lyric document ${documentId}`)
  return mapLyricDocumentRowToDocument(data as LyricDocumentRow)
}

/**
 * Delete a lyric document.
 * lyric_cues are deleted automatically via ON DELETE CASCADE.
 */
export async function deleteLyricDocument(documentId: string): Promise<void> {
  const { error } = await db
    .from('lyric_documents')
    .delete()
    .eq('id', documentId)

  if (error) throwSupabaseError(error, `Failed to delete lyric document ${documentId}`)
}

// ── lyric_cues ────────────────────────────────────────────────────────────────

/** All cues for a document, ordered by start_ms then sort_order. */
export async function getLyricCuesForDocument(documentId: string): Promise<LyricCue[]> {
  const { data, error } = await db
    .from('lyric_cues')
    .select('*')
    .eq('lyric_document_id', documentId)
    .order('start_ms', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throwSupabaseError(error, `Failed to fetch cues for document ${documentId}`)
  return ((data as LyricCueRow[]) ?? []).map(mapLyricCueRowToCue)
}

/**
 * Cues that overlap [startMs, endMs).
 * A cue overlaps when: cue.start_ms < endMs AND cue.end_ms > startMs
 */
export async function getLyricCuesInRange(
  documentId: string,
  startMs: number,
  endMs: number,
): Promise<LyricCue[]> {
  const { data, error } = await db
    .from('lyric_cues')
    .select('*')
    .eq('lyric_document_id', documentId)
    .lt('start_ms', endMs)
    .gt('end_ms', startMs)
    .order('start_ms', { ascending: true })

  if (error) throwSupabaseError(error, 'Failed to fetch lyric cues in range')
  return ((data as LyricCueRow[]) ?? []).map(mapLyricCueRowToCue)
}

/** Insert a single lyric cue. Returns the inserted cue. */
export async function createLyricCue(
  documentId: string,
  input: CreateLyricCueInput,
): Promise<LyricCue> {
  const insert = mapLyricCueToInsert({ ...input, lyricDocumentId: documentId })

  const { data, error } = await db
    .from('lyric_cues')
    .insert(insert)
    .select('*')
    .single()

  if (error) throwSupabaseError(error, 'Failed to create lyric cue')
  return mapLyricCueRowToCue(data as LyricCueRow)
}

/** Bulk-insert many cues. sort_order defaults to array index when not set. */
export async function createLyricCues(
  documentId: string,
  inputs: CreateLyricCueInput[],
): Promise<LyricCue[]> {
  if (inputs.length === 0) return []

  const inserts = inputs.map((input, i) =>
    mapLyricCueToInsert({
      ...input,
      lyricDocumentId: documentId,
      sortOrder: input.sortOrder ?? i,
    }),
  )

  const { data, error } = await db
    .from('lyric_cues')
    .insert(inserts)
    .select('*')
    .order('start_ms', { ascending: true })

  if (error) throwSupabaseError(error, 'Failed to bulk-insert lyric cues')
  return ((data as LyricCueRow[]) ?? []).map(mapLyricCueRowToCue)
}

/** Update a single cue. Returns the updated cue. */
export async function updateLyricCue(
  cueId: string,
  input: UpdateLyricCueInput,
): Promise<LyricCue> {
  const patch: Record<string, unknown> = {}
  if (input.startMs   !== undefined) patch.start_ms  = input.startMs
  if (input.endMs     !== undefined) patch.end_ms     = input.endMs
  if (input.text      !== undefined) patch.text       = input.text
  if (input.style     !== undefined) patch.style      = input.style
  if (input.animation !== undefined) patch.animation  = input.animation
  if (input.effects   !== undefined) patch.effects    = input.effects
  if (input.words     !== undefined) patch.words      = input.words
  if (input.groups    !== undefined) patch.groups     = input.groups
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder

  const { data, error } = await db
    .from('lyric_cues')
    .update(patch)
    .eq('id', cueId)
    .select('*')
    .single()

  if (error) throwSupabaseError(error, `Failed to update lyric cue ${cueId}`)
  return mapLyricCueRowToCue(data as LyricCueRow)
}

/** Delete a single cue by id. */
export async function deleteLyricCue(cueId: string): Promise<void> {
  const { error } = await db
    .from('lyric_cues')
    .delete()
    .eq('id', cueId)

  if (error) throwSupabaseError(error, `Failed to delete lyric cue ${cueId}`)
}

/** Delete all cues for a document. */
export async function deleteLyricCuesForDocument(documentId: string): Promise<void> {
  const { error } = await db
    .from('lyric_cues')
    .delete()
    .eq('lyric_document_id', documentId)

  if (error) throwSupabaseError(error, `Failed to delete cues for document ${documentId}`)
}

/**
 * Atomically replace all cues for a document.
 * Useful for full imports from LRC, VTT, JSON, or AI transcription.
 */
export async function replaceLyricCuesForDocument(
  documentId: string,
  inputs: CreateLyricCueInput[],
): Promise<LyricCue[]> {
  await deleteLyricCuesForDocument(documentId)
  return createLyricCues(documentId, inputs)
}

// ── Convenience aggregates ────────────────────────────────────────────────────

/** Fetch a document and all its cues in two parallel queries. */
export async function getFullLyricDocument(
  documentId: string,
): Promise<{ document: LyricDocument; cues: LyricCue[] }> {
  const [document, cues] = await Promise.all([
    getLyricDocumentById(documentId),
    getLyricCuesForDocument(documentId),
  ])

  if (!document) throw new Error(`lyricsDb: lyric document ${documentId} not found`)
  return { document, cues }
}

/** Active document + cues for an audio track, or null if none exists. */
export async function getFullActiveLyricsForAudioTrack(
  audioTrackId: string,
): Promise<{ document: LyricDocument; cues: LyricCue[] } | null> {
  const document = await getActiveLyricDocumentForAudioTrack(audioTrackId)
  if (!document) return null
  const cues = await getLyricCuesForDocument(document.id)
  return { document, cues }
}

/** Active document + cues for a visual session, or null if none exists. */
export async function getFullActiveLyricsForVisualSession(
  visualSessionId: string,
): Promise<{ document: LyricDocument; cues: LyricCue[] } | null> {
  const document = await getActiveLyricDocumentForVisualSession(visualSessionId)
  if (!document) return null
  const cues = await getLyricCuesForDocument(document.id)
  return { document, cues }
}
