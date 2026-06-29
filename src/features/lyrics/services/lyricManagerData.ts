import type { SupabaseClient } from '@supabase/supabase-js'
import { listAudioTracksPage } from '../../../lib/audioDb'
import { supabase } from '../../../lib/supabase'
import { mapLyricDocumentRowToDocument } from '../../../types/lyrics'
import type { AudioTrack } from '../../../types/database'
import type { LyricDocumentRow } from '../../../types/lyrics'
import { runtimeIdForAudioTrack } from '../../../audio/runtimeTrack'
import type {
  LyricDocumentVersion,
  LyricManagerTrack,
  LyricManagerTrackPage,
} from '../lyricManagerTypes'

const db = supabase as unknown as SupabaseClient

interface LyricDocumentSummaryRow extends LyricDocumentRow {
  lyric_cues?: Array<{ count?: number | null }> | { count?: number | null } | null
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nestedCount(value: LyricDocumentSummaryRow['lyric_cues']): number {
  if (Array.isArray(value)) return Number(value[0]?.count ?? 0) || 0
  if (value && typeof value === 'object') return Number(value.count ?? 0) || 0
  return 0
}

export function mapAudioTrackForLyricManager(row: AudioTrack): LyricManagerTrack {
  return {
    id: runtimeIdForAudioTrack(row.id),
    dbId: row.id,
    title: row.title,
    fileName: row.file_name,
    storagePath: row.storage_path,
    durationSec: row.duration_sec,
    sampleRate: row.sample_rate,
    channels: row.channels,
    fileSizeByte: row.file_size,
    mimeType: row.mime_type,
    artist: row.artist ?? null,
    genre: row.genre ?? null,
    bpm: row.bpm ?? null,
    musicalKey: row.musical_key ?? null,
    createdAt: row.created_at,
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  }
}

export function mapLyricDocumentVersion(row: LyricDocumentSummaryRow): LyricDocumentVersion {
  const document = mapLyricDocumentRowToDocument(row)
  return {
    ...document,
    cueCount: nestedCount(row.lyric_cues),
    language: metadataString(document.metadata, 'language'),
    documentReviewStatus:
      metadataString(document.metadata, 'reviewStatus')
      ?? metadataString(document.metadata, 'review_status'),
  }
}

/** One batched document query for all visible tracks, never one request per card. */
export async function getLyricDocumentVersionsForTracks(
  audioTrackIds: readonly string[],
): Promise<LyricDocumentVersion[]> {
  if (audioTrackIds.length === 0) return []

  const { data, error } = await db
    .from('lyric_documents')
    .select('*, lyric_cues(count)')
    .in('audio_track_id', [...audioTrackIds])
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch lyric versions: ${error.message}`)
  return ((data as LyricDocumentSummaryRow[] | null) ?? []).map(mapLyricDocumentVersion)
}

export async function getLegacyLyricDocumentVersions(userId: string): Promise<LyricDocumentVersion[]> {
  const { data, error } = await db
    .from('lyric_documents')
    .select('*, lyric_cues(count)')
    .eq('user_id', userId)
    .is('audio_track_id', null)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch legacy lyric documents: ${error.message}`)
  return ((data as LyricDocumentSummaryRow[] | null) ?? []).map(mapLyricDocumentVersion)
}

export async function loadLyricManagerTrackPage(
  userId: string,
  options: { offset?: number; limit?: number; search?: string } = {},
): Promise<LyricManagerTrackPage> {
  const page = await listAudioTracksPage(userId, options)
  if (page.error) throw new Error(page.error)

  const tracks = page.rows.map(mapAudioTrackForLyricManager)
  const versions = await getLyricDocumentVersionsForTracks(tracks.map(track => track.dbId))
  const versionsByTrack = new Map<string, LyricDocumentVersion[]>()

  for (const version of versions) {
    if (!version.audioTrackId) continue
    const bucket = versionsByTrack.get(version.audioTrackId) ?? []
    bucket.push(version)
    versionsByTrack.set(version.audioTrackId, bucket)
  }

  return {
    total: page.count,
    tracks: tracks.map(track => {
      const trackVersions = versionsByTrack.get(track.dbId) ?? []
      const active = trackVersions.find(version => version.isActive) ?? null
      return {
        ...track,
        lyricVersionCount: trackVersions.length,
        activeLyricDocumentId: active?.id ?? null,
        activeLyricDocumentName: active?.title ?? null,
      }
    }),
  }
}
