// Data-access helpers for public.lyric_documents and public.lyric_cues.
// Runtime objects use camelCase; database payloads remain snake_case.

import { supabase } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ActivateLyricDocumentResult,
  CreateLyricCueInput,
  CreateLyricDocumentInput,
  LyricCue,
  LyricCueRow,
  LyricDocument,
  LyricDocumentRow,
  LyricPersistenceFailure,
  SaveLyricDocumentAtomicInput,
  SaveLyricDocumentResult,
  UpdateLyricCueInput,
  UpdateLyricDocumentInput,
} from '../types/lyrics'
import {
  createLyricCueInputFromCue,
  mapLyricCueRowToCue,
  mapLyricCueToInsert,
  mapLyricDocumentRowToDocument,
  normalizeLyricConfidence,
  normalizeLyricSectionType,
  normalizeLyricSource,
  normalizeLyricWarnings,
  normalizeLyricWordMetadata,
} from '../types/lyrics'

// supabase-js v2 createClient<Database> can infer `never` for tables that don't
// have generated relationship metadata. Keep the escape hatch local to this file.
const db = supabase as unknown as SupabaseClient

function throwSupabaseError(error: unknown, fallbackMessage: string): never {
  if (error && typeof error === 'object' && 'message' in error) {
    throw new Error(`lyricsDb: ${(error as { message: string }).message}`)
  }
  throw new Error(`lyricsDb: ${fallbackMessage}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unexpectedFailure(message: string, code?: string): LyricPersistenceFailure {
  return { ok: false, kind: 'unexpected', message, ...(code ? { code } : {}) }
}

function parseFailureEnvelope(data: Record<string, unknown>): LyricPersistenceFailure {
  const message = typeof data.message === 'string' ? data.message : 'Lyric persistence failed.'
  const code = typeof data.error_code === 'string' ? data.error_code : undefined

  switch (data.status) {
    case 'validation_failure':
      return { ok: false, kind: 'validation', message, ...(code ? { code } : {}) }
    case 'conflict':
      return {
        ok: false,
        kind: 'conflict',
        message,
        ...(typeof data.current_revision === 'number'
          ? { currentRevision: data.current_revision }
          : {}),
      }
    case 'authorization_failure':
      return { ok: false, kind: 'authorization', message }
    case 'unexpected_failure':
      return unexpectedFailure(message, code)
    default:
      return unexpectedFailure('The lyric persistence RPC returned an unknown status.')
  }
}

function documentToCreateInput(document: LyricDocument): CreateLyricDocumentInput {
  return {
    title: document.title,
    artist: document.artist,
    audioTrackId: document.audioTrackId ?? null,
    visualSessionId: document.visualSessionId ?? null,
    sourceType: document.sourceType,
    sourceFormat: document.sourceFormat,
    rawSourceText: document.rawSourceText ?? null,
    defaultStyle: document.defaultStyle,
    defaultAnimation: document.defaultAnimation,
    defaultEffects: document.defaultEffects,
    globalOffsetMs: document.globalOffsetMs,
    metadata: document.metadata,
  }
}

function persistenceFailureToError(action: string, failure: LyricPersistenceFailure): Error {
  const suffix = failure.kind === 'conflict' && failure.currentRevision !== undefined
    ? ` (current revision ${failure.currentRevision})`
    : ''
  return new Error(`lyricsDb: ${action}: ${failure.message}${suffix}`)
}

// ── lyric_documents reads ─────────────────────────────────────────────────────

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

/** Single lyric document by id, or null if not found or hidden by RLS. */
export async function getLyricDocumentById(documentId: string): Promise<LyricDocument | null> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle()

  if (error) throwSupabaseError(error, `Failed to fetch lyric document ${documentId}`)
  return data ? mapLyricDocumentRowToDocument(data as LyricDocumentRow) : null
}

/** Resolve the canonical row assigned to one stable client-side draft identity. */
export async function getLyricDocumentByClientLogicalId(
  logicalDocumentId: string,
): Promise<LyricDocument | null> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*')
    .eq('metadata->>_drmvyzLogicalDocumentId', logicalDocumentId)
    .maybeSingle()

  if (error) throwSupabaseError(error, 'Failed to reconcile the saved lyric draft')
  return data ? mapLyricDocumentRowToDocument(data as LyricDocumentRow) : null
}

// ── Transactional document persistence ───────────────────────────────────────

/**
 * Create or update a lyric document and replace its complete cue set in one
 * PostgreSQL transaction. The server returns typed failures instead of forcing
 * UI code to inspect PostgREST error strings.
 */
export async function saveLyricDocumentAtomic(
  input: SaveLyricDocumentAtomicInput,
): Promise<SaveLyricDocumentResult> {
  if (input.documentId && input.expectedRevision == null) {
    return {
      ok: false,
      kind: 'validation',
      message: 'An expected revision is required when updating a lyric document.',
    }
  }

  const documentPayload = {
    audio_track_id: input.document.audioTrackId ?? null,
    visual_session_id: input.document.visualSessionId ?? null,
    title: input.document.title,
    artist: input.document.artist ?? '',
    source_type: input.document.sourceType ?? 'manual',
    source_format: input.document.sourceFormat ?? 'json',
    raw_source_text: input.document.rawSourceText ?? null,
    default_style: input.document.defaultStyle ?? {},
    default_animation: input.document.defaultAnimation ?? {},
    default_effects: input.document.defaultEffects ?? {},
    global_offset_ms: input.document.globalOffsetMs ?? 0,
    metadata: input.document.metadata ?? {},
  }

  const cuePayload = input.cues.map((cue, index) => {
    const insert = mapLyricCueToInsert({
      ...cue,
      lyricDocumentId: input.documentId ?? cue.lyricDocumentId ?? '',
      sortOrder: cue.sortOrder ?? index,
    })
    const { lyric_document_id: _documentId, ...payload } = insert
    void _documentId
    return payload
  })

  try {
    const { data, error } = await db.rpc('save_lyric_document_atomic', {
      p_document_id: input.documentId ?? null,
      p_expected_revision: input.expectedRevision ?? null,
      p_document: documentPayload,
      p_cues: cuePayload,
      p_activate: input.activate ?? false,
    })

    if (error) {
      return unexpectedFailure(
        'The lyric document could not be saved because the persistence request failed.',
        typeof error.code === 'string' ? error.code : undefined,
      )
    }
    if (!isRecord(data)) return unexpectedFailure('The lyric persistence RPC returned malformed data.')
    if (data.status !== 'success') return parseFailureEnvelope(data)
    if (!isRecord(data.document) || !Array.isArray(data.cues)) {
      return unexpectedFailure('The lyric persistence RPC returned an incomplete success payload.')
    }

    return {
      ok: true,
      kind: 'success',
      document: mapLyricDocumentRowToDocument(data.document as unknown as LyricDocumentRow),
      cues: data.cues.map(row => mapLyricCueRowToCue(row as LyricCueRow)),
    }
  } catch (error) {
    return unexpectedFailure(error instanceof Error ? error.message : 'Unexpected lyric persistence failure.')
  }
}

/** Activate one version and deactivate its persisted-track siblings transactionally. */
export async function activateLyricDocument(
  documentId: string,
  expectedRevision?: number | null,
): Promise<ActivateLyricDocumentResult> {
  try {
    const { data, error } = await db.rpc('activate_lyric_document', {
      p_document_id: documentId,
      p_expected_revision: expectedRevision ?? null,
    })

    if (error) {
      return unexpectedFailure(
        'The lyric document could not be activated because the persistence request failed.',
        typeof error.code === 'string' ? error.code : undefined,
      )
    }
    if (!isRecord(data)) return unexpectedFailure('The lyric activation RPC returned malformed data.')
    if (data.status !== 'success') return parseFailureEnvelope(data)
    if (!isRecord(data.document)) {
      return unexpectedFailure('The lyric activation RPC returned an incomplete success payload.')
    }

    return {
      ok: true,
      kind: 'success',
      document: mapLyricDocumentRowToDocument(data.document as unknown as LyricDocumentRow),
    }
  } catch (error) {
    return unexpectedFailure(error instanceof Error ? error.message : 'Unexpected lyric activation failure.')
  }
}

/** Backward-compatible create helper, now implemented through the atomic RPC. */
export async function createLyricDocument(input: CreateLyricDocumentInput): Promise<LyricDocument> {
  const result = await saveLyricDocumentAtomic({ document: input, cues: [], activate: true })
  if (!result.ok) throw persistenceFailureToError('Failed to create lyric document', result)
  return result.document
}

/** Backward-compatible update helper that preserves cues and uses revision checks. */
export async function updateLyricDocument(
  documentId: string,
  input: UpdateLyricDocumentInput,
): Promise<LyricDocument> {
  const full = await getFullLyricDocument(documentId)
  const current = full.document
  const result = await saveLyricDocumentAtomic({
    documentId,
    expectedRevision: current.revision,
    activate: input.isActive ?? current.isActive,
    document: {
      title: input.title ?? current.title,
      artist: input.artist ?? current.artist,
      audioTrackId: input.audioTrackId !== undefined ? input.audioTrackId : current.audioTrackId,
      visualSessionId: input.visualSessionId !== undefined ? input.visualSessionId : current.visualSessionId,
      sourceType: input.sourceType ?? current.sourceType,
      sourceFormat: input.sourceFormat ?? current.sourceFormat,
      rawSourceText: input.rawSourceText !== undefined ? input.rawSourceText : current.rawSourceText,
      defaultStyle: input.defaultStyle ?? current.defaultStyle,
      defaultAnimation: input.defaultAnimation ?? current.defaultAnimation,
      defaultEffects: input.defaultEffects ?? current.defaultEffects,
      globalOffsetMs: input.globalOffsetMs ?? current.globalOffsetMs,
      metadata: input.metadata ?? current.metadata,
    },
    cues: full.cues.map((cue, index) => createLyricCueInputFromCue(cue, documentId, index)),
  })

  if (!result.ok) throw persistenceFailureToError(`Failed to update lyric document ${documentId}`, result)
  return result.document
}

/** Delete a lyric document. lyric_cues are removed by ON DELETE CASCADE. */
export async function deleteLyricDocument(documentId: string): Promise<void> {
  const { error } = await db.from('lyric_documents').delete().eq('id', documentId)
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

/** Cues that overlap [startMs, endMs). */
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
  const { data, error } = await db.from('lyric_cues').insert(insert).select('*').single()
  if (error) throwSupabaseError(error, 'Failed to create lyric cue')
  return mapLyricCueRowToCue(data as LyricCueRow)
}

/** Bulk-insert many cues. sort_order defaults to array index when not set. */
export async function createLyricCues(
  documentId: string,
  inputs: CreateLyricCueInput[],
): Promise<LyricCue[]> {
  if (inputs.length === 0) return []

  const inserts = inputs.map((input, index) => mapLyricCueToInsert({
    ...input,
    lyricDocumentId: documentId,
    sortOrder: input.sortOrder ?? index,
  }))

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
  if (input.startMs !== undefined) patch.start_ms = input.startMs
  if (input.endMs !== undefined) patch.end_ms = input.endMs
  if (input.text !== undefined) patch.text = input.text
  if (input.style !== undefined) patch.style = input.style
  if (input.animation !== undefined) patch.animation = input.animation
  if (input.effects !== undefined) patch.effects = input.effects
  if (input.words !== undefined) {
    patch.words = input.words.map(word => normalizeLyricWordMetadata(word, input.source ?? undefined))
  }
  if (input.groups !== undefined) patch.groups = input.groups
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder
  if (input.confidence !== undefined) {
    patch.confidence = input.confidence === null ? null : normalizeLyricConfidence(input.confidence)
  }
  if (input.source !== undefined) {
    patch.source = input.source === null ? null : normalizeLyricSource(input.source)
  }
  if (input.reviewStatus !== undefined) patch.review_status = input.reviewStatus
  if (input.sectionId !== undefined) patch.section_id = input.sectionId
  if (input.sectionType !== undefined) {
    patch.section_type = input.sectionType === null ? null : normalizeLyricSectionType(input.sectionType)
  }
  if (input.warnings !== undefined) patch.warnings = normalizeLyricWarnings(input.warnings) ?? []
  if (input.analysisMetadata !== undefined) patch.analysis_metadata = input.analysisMetadata
  if (input.originalTranscriptionText !== undefined) {
    patch.original_transcription_text = input.originalTranscriptionText
  }

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
  const { error } = await db.from('lyric_cues').delete().eq('id', cueId)
  if (error) throwSupabaseError(error, `Failed to delete lyric cue ${cueId}`)
}

/** Delete all cues for a document. Prefer replaceLyricCuesForDocument for saves. */
export async function deleteLyricCuesForDocument(documentId: string): Promise<void> {
  const { error } = await db.from('lyric_cues').delete().eq('lyric_document_id', documentId)
  if (error) throwSupabaseError(error, `Failed to delete cues for document ${documentId}`)
}

/**
 * Backward-compatible full replacement helper. The old delete-then-insert client
 * sequence has been replaced with one transactional save RPC, including [] saves.
 */
export async function replaceLyricCuesForDocument(
  documentId: string,
  inputs: CreateLyricCueInput[],
): Promise<LyricCue[]> {
  const full = await getFullLyricDocument(documentId)
  const result = await saveLyricDocumentAtomic({
    documentId,
    expectedRevision: full.document.revision,
    document: documentToCreateInput(full.document),
    cues: inputs,
    activate: full.document.isActive,
  })

  if (!result.ok) throw persistenceFailureToError(`Failed to replace cues for document ${documentId}`, result)
  return result.cues
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
