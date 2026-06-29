import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateLyricCueInput, LyricCueRow, LyricDocumentRow } from '../types/lyrics'
import { mapLyricDocumentRowToDocument } from '../types/lyrics'

const supabaseMocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  auth: { getUser: vi.fn() },
}))

vi.mock('./supabase', () => ({
  supabase: supabaseMocks,
  supabaseConfigured: true,
}))

import { activateLyricDocument, saveLyricDocumentAtomic } from './lyricsDb'

const DOCUMENT_ID = '11111111-1111-4111-8111-111111111111'
const TRACK_ID = '22222222-2222-4222-8222-222222222222'

function documentRow(overrides: Partial<LyricDocumentRow> = {}): LyricDocumentRow {
  return {
    id: DOCUMENT_ID,
    user_id: '33333333-3333-4333-8333-333333333333',
    audio_track_id: TRACK_ID,
    visual_session_id: null,
    title: 'Atomic Lyrics',
    artist: 'DRMVYZ',
    source_type: 'manual',
    source_format: 'json',
    raw_source_text: null,
    default_style: {},
    default_animation: {},
    default_effects: {},
    global_offset_ms: 0,
    is_active: true,
    metadata: {},
    revision: 1,
    created_at: '2026-06-29T12:00:00.000Z',
    updated_at: '2026-06-29T12:00:00.000Z',
    ...overrides,
  }
}

function cueRow(overrides: Partial<LyricCueRow> = {}): LyricCueRow {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    lyric_document_id: DOCUMENT_ID,
    start_ms: 0,
    end_ms: 1_000,
    text: 'Safe and sound',
    style: {},
    animation: {},
    effects: {},
    words: [],
    groups: [],
    sort_order: 0,
    confidence: null,
    source: 'manual',
    review_status: null,
    section_id: null,
    section_type: null,
    warnings: [],
    analysis_metadata: {},
    original_transcription_text: null,
    created_at: '2026-06-29T12:00:00.000Z',
    updated_at: '2026-06-29T12:00:00.000Z',
    ...overrides,
  }
}

function cueInput(): CreateLyricCueInput {
  return {
    lyricDocumentId: '',
    startMs: 0,
    endMs: 1_000,
    text: 'Safe and sound',
    source: 'manual',
  }
}

function documentInput() {
  return {
    title: 'Atomic Lyrics',
    artist: 'DRMVYZ',
    audioTrackId: TRACK_ID,
    sourceType: 'manual' as const,
    sourceFormat: 'json' as const,
  }
}

describe('transactional lyric persistence helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a document and its cues with one atomic RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { status: 'success', document: documentRow(), cues: [cueRow()] },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      document: documentInput(),
      cues: [cueInput()],
      activate: true,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(result.document.revision).toBe(1)
    expect(result.cues).toHaveLength(1)
    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'save_lyric_document_atomic',
      expect.objectContaining({
        p_document_id: null,
        p_expected_revision: null,
        p_activate: true,
        p_cues: [expect.objectContaining({ start_ms: 0, end_ms: 1_000 })],
      }),
    )
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('updates a document and replaces cues using the expected revision', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        status: 'success',
        document: documentRow({ revision: 8 }),
        cues: [cueRow({ text: 'Updated' })],
      },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      documentId: DOCUMENT_ID,
      expectedRevision: 7,
      document: documentInput(),
      cues: [{ ...cueInput(), text: 'Updated' }],
    })

    expect(result.ok).toBe(true)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'save_lyric_document_atomic',
      expect.objectContaining({
        p_document_id: DOCUMENT_ID,
        p_expected_revision: 7,
      }),
    )
  })

  it('sends an empty cue array so every existing cue can be intentionally removed', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { status: 'success', document: documentRow({ revision: 2 }), cues: [] },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      documentId: DOCUMENT_ID,
      expectedRevision: 1,
      document: documentInput(),
      cues: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.cues).toEqual([])
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'save_lyric_document_atomic',
      expect.objectContaining({ p_cues: [] }),
    )
  })

  it('returns a typed validation failure without issuing client-side delete or insert requests', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        status: 'validation_failure',
        message: 'One cue failed validation.',
        error_code: '23514',
      },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      documentId: DOCUMENT_ID,
      expectedRevision: 1,
      document: documentInput(),
      cues: [{ ...cueInput(), endMs: 0 }],
    })

    expect(result).toEqual({
      ok: false,
      kind: 'validation',
      message: 'One cue failed validation.',
      code: '23514',
    })
    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('maps optimistic-concurrency conflicts to a typed result', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        status: 'conflict',
        message: 'The lyric document changed in another editor session.',
        current_revision: 12,
      },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      documentId: DOCUMENT_ID,
      expectedRevision: 11,
      document: documentInput(),
      cues: [],
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'The lyric document changed in another editor session.',
      currentRevision: 12,
    })
  })

  it('maps ownership rejection to a typed authorization failure', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        status: 'authorization_failure',
        message: 'Lyrics cannot be attached to an audio track owned by another user.',
      },
      error: null,
    })

    const result = await saveLyricDocumentAtomic({
      document: documentInput(),
      cues: [],
    })

    expect(result).toEqual({
      ok: false,
      kind: 'authorization',
      message: 'Lyrics cannot be attached to an audio track owned by another user.',
    })
  })

  it('requires an expected revision for updates before issuing the RPC', async () => {
    const result = await saveLyricDocumentAtomic({
      documentId: DOCUMENT_ID,
      document: documentInput(),
      cues: [],
    })

    expect(result).toEqual({
      ok: false,
      kind: 'validation',
      message: 'An expected revision is required when updating a lyric document.',
    })
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('maps legacy document rows without a revision to revision 1', () => {
    const legacyRow = documentRow() as LyricDocumentRow & { revision?: number }
    delete legacyRow.revision

    expect(mapLyricDocumentRowToDocument(legacyRow).revision).toBe(1)
  })

  it('activates a document through the transactional activation RPC', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { status: 'success', document: documentRow({ revision: 4 }) },
      error: null,
    })

    const result = await activateLyricDocument(DOCUMENT_ID, 3)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.document.revision).toBe(4)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('activate_lyric_document', {
      p_document_id: DOCUMENT_ID,
      p_expected_revision: 3,
    })
  })
})
