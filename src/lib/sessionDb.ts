// Narrow typed helpers for visual_sessions DB operations.
// Same pattern as mediaDb.ts — isolates the controlled cast, returns typed results.

import { supabase, supabaseConfigured } from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VzSession, VzEffects, Quality } from '../stores/visualStore'

const db = supabase as unknown as SupabaseClient

// ── Internal row shape (what we select from the DB) ───────────────────────────

interface SessionDbRow {
  id: string
  name: string | null
  bpm: number
  bpm_sync: boolean
  effects: Record<string, unknown>
  enabled_fx: string[]
  media_order: string[]
  quality: string
  audio_source: string
  state: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Row <-> VzSession conversion ──────────────────────────────────────────────

function rowToSession(row: SessionDbRow): VzSession {
  // state is the authoritative source for all fields; top-level columns are
  // supplementary metadata for DB-side filtering.
  const s = row.state as Partial<VzSession>
  return {
    id:            row.id,
    name:          row.name ?? 'Unnamed Session',
    createdAt:     new Date(row.created_at).getTime(),
    updatedAt:     new Date(row.updated_at).getTime(),
    source:        'cloud',
    dbId:          row.id,
    activeMediaId: s.activeMediaId ?? null,
    mediaOrder:    (row.media_order?.length ? row.media_order : s.mediaOrder) ?? [],
    activePresetId:s.activePresetId ?? 'dream-theft',
    effects:       (s.effects ?? {}) as VzEffects,
    enabledFx:     s.enabledFx ?? [],
    bpm:           row.bpm ?? s.bpm ?? 120,
    bpmSync:       row.bpm_sync ?? s.bpmSync ?? false,
    quality:       (row.quality as Quality) ?? s.quality ?? 'High',
    audioSource:   (row.audio_source as VzSession['audioSource']) ?? s.audioSource ?? 'file',
  }
}

function sessionToInsert(userId: string, session: VzSession) {
  // Strip non-restorable fields from state blob
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, name, createdAt, updatedAt, source, dbId, ...restState } = session
  return {
    user_id:      userId,
    name:         session.name,
    bpm:          session.bpm,
    bpm_sync:     session.bpmSync,
    effects:      session.effects as unknown as Record<string, unknown>,
    enabled_fx:   session.enabledFx,
    media_order:  session.mediaOrder,
    quality:      session.quality,
    audio_source: session.audioSource,
    state:        restState as Record<string, unknown>,
  }
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string | null> {
  if (!supabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// ── Public helpers ────────────────────────────────────────────────────────────

export async function dbListSessions(userId: string): Promise<{
  sessions: VzSession[]
  error: string | null
}> {
  const { data, error } = await db
    .from('visual_sessions')
    .select('id, name, bpm, bpm_sync, effects, enabled_fx, media_order, quality, audio_source, state, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return { sessions: [], error: error.message }
  const rows = (data as SessionDbRow[] | null) ?? []
  return { sessions: rows.map(rowToSession), error: null }
}

export async function dbCreateSession(session: VzSession): Promise<{
  dbId: string | null
  error: string | null
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { dbId: null, error: 'Not signed in' }

  const { data, error } = await db
    .from('visual_sessions')
    .insert(sessionToInsert(userId, session))
    .select('id')
    .single()

  return {
    dbId:  (data as { id: string } | null)?.id ?? null,
    error: error?.message ?? null,
  }
}

export async function dbUpdateSession(dbId: string, session: VzSession): Promise<{
  error: string | null
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { error: 'Not signed in' }

  const insert = sessionToInsert(userId, session)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id, ...updatePayload } = insert

  const { error } = await db
    .from('visual_sessions')
    .update(updatePayload)
    .eq('id', dbId)

  return { error: error?.message ?? null }
}

export async function dbDeleteSession(dbId: string): Promise<{ error: string | null }> {
  const { error } = await db.from('visual_sessions').delete().eq('id', dbId)
  return { error: error?.message ?? null }
}

export async function loadCloudSessions(): Promise<{
  sessions: VzSession[]
  error: string | null
}> {
  const userId = await getCurrentUserId()
  if (!userId) return { sessions: [], error: null }
  return dbListSessions(userId)
}
