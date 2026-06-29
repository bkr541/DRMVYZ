import { create } from 'zustand'
import { supabase, supabaseConfigured } from '../lib/supabase'
import {
  listAudioTracks,
  uploadAudioFile,
  createAudioTrack,
  createSignedAudioUrl,
  deleteAudioTrack,
  deleteAudioFiles,
  createTrackAnalysis,
} from '../lib/audioDb'
import type { AudioTrack } from '../types/database'
import { getFilenameWithoutExtension } from '../utils/audioUtils'
import type { AudioFileAnalysis } from '../utils/analyzeAudioFile'
import { runtimeIdForAudioTrack } from '../audio/runtimeTrack'

// ── Public types ───────────────────────────────────────────────────────────────

export interface SavedAudioTrack {
  id: string           // prefixed stable id ("audio-<uuid>")
  dbId: string         // raw UUID in audio_tracks table
  title: string
  fileName: string
  storagePath: string | null
  durationSec: number | null
  sampleRate: number | null
  channels: number | null
  fileSizeByte: number | null
  mimeType: string | null
  artist: string | null
  genre: string | null
  bpm: number | null
  musicalKey: string | null
  createdAt: string
}

export interface AudioUploadParams {
  file: File
  title: string
  artist: string
  genre: string
  bpmInput: string     // raw string from the BPM number input
  musicalKey: string
  userId: string
  analysis: AudioFileAnalysis | null
}

function rowToSaved(row: AudioTrack): SavedAudioTrack {
  return {
    id:           runtimeIdForAudioTrack(row.id),
    dbId:         row.id,
    title:        row.title,
    fileName:     row.file_name,
    storagePath:  row.storage_path,
    durationSec:  row.duration_sec,
    sampleRate:   row.sample_rate,
    channels:     row.channels,
    fileSizeByte: row.file_size,
    mimeType:     row.mime_type,
    artist:       row.artist ?? null,
    genre:        row.genre ?? null,
    bpm:          row.bpm ?? null,
    musicalKey:   row.musical_key ?? null,
    createdAt:    row.created_at,
  }
}

function interpretError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('jwt') || lower.includes('unauthorized')) return 'Session expired — sign in again'
  if (lower.includes('row-level security') || lower.includes('policy')) return 'Permission denied — check RLS policies'
  if (lower.includes('bucket') && lower.includes('not found')) return 'Storage bucket not found — check Supabase config'
  if (lower.includes('network') || lower.includes('fetch')) return 'Network error — check connection'
  return msg.length > 80 ? msg.slice(0, 80) + '…' : msg
}

// ── Store interface ────────────────────────────────────────────────────────────

interface AudioStoreState {
  savedTracks: SavedAudioTrack[]
  loading: boolean
  loadError: string | null

  loadSavedTracks(): Promise<void>
  uploadAndSaveTrack(params: AudioUploadParams): Promise<SavedAudioTrack | null>
  getSignedUrl(storagePath: string): Promise<string | null>
  removeSavedTrack(id: string): void
}

// ── Store ──────────────────────────────────────────────────────────────────────

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  savedTracks: [],
  loading: false,
  loadError: null,

  async loadSavedTracks() {
    if (!supabaseConfigured) return
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) return

    set({ loading: true, loadError: null })
    try {
      const { rows, error } = await listAudioTracks(userId)
      if (error) { set({ loadError: interpretError(error) }); return }
      set({ savedTracks: rows.map(rowToSaved) })
    } catch (e) {
      const msg = e instanceof Error ? interpretError(e.message) : 'Unexpected error loading tracks'
      set({ loadError: msg })
    } finally {
      set({ loading: false })
    }
  },

  async uploadAndSaveTrack(params) {
    const { file, title, artist, genre, bpmInput, musicalKey, userId, analysis } = params
    try {
      // Derive final title: prefer user input, fall back to filename
      const finalTitle = title.trim() || getFilenameWithoutExtension(file.name)

      // Build a unique storage path matching the media-items pattern
      const tempId   = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
      const storagePath = `${userId}/${tempId}/${file.name}`

      const { error: uploadErr } = await uploadAudioFile(storagePath, file, file.type)
      if (uploadErr) {
        console.error('[audioStore] storage upload:', uploadErr)
        return null
      }

      const bpmValue = bpmInput ? (parseFloat(bpmInput) || null) : (analysis?.bpm ?? null)

      const { id: dbId, error: dbErr } = await createAudioTrack({
        user_id:     userId,
        title:       finalTitle,
        file_name:   file.name,
        storage_path: storagePath,
        duration_sec: analysis?.durationSec ?? null,
        sample_rate:  analysis?.sampleRate  ?? null,
        bit_depth:    null,
        channels:     analysis?.channels    ?? null,
        file_size:    file.size,
        mime_type:    file.type || null,
        source_type:  'file',
        artist:       artist.trim()   || null,
        genre:        genre.trim()    || null,
        bpm:          bpmValue,
        musical_key:  musicalKey.trim() || null,
      })

      if (dbErr || !dbId) {
        console.error('[audioStore] db insert:', dbErr)
        return null
      }

      // Persist analysis data to track_analyses when available
      if (analysis) {
        createTrackAnalysis({
          track_id:         dbId,
          bpm:              analysis.bpm,
          bpm_confidence:   null,
          key_note:         null,
          key_mode:         null,
          lufs_integrated:  null,
          lufs_short:       null,
          lufs_momentary:   null,
          true_peak:        null,
          dynamic_range:    null,
          stereo_width:     null,
          phase_correlation: null,
          waveform_peaks:   null,
          spectrum_avg:     null,
          band_bass:        null,
          band_low_mid:     null,
          band_mid:         null,
          band_high_mid:    null,
          band_presence:    null,
          band_air:         null,
        }).catch(e => console.warn('[audioStore] track_analyses insert:', e))
      }

      const saved: SavedAudioTrack = {
        id:           runtimeIdForAudioTrack(dbId),
        dbId,
        title:        finalTitle,
        fileName:     file.name,
        storagePath,
        durationSec:  analysis?.durationSec ?? null,
        sampleRate:   analysis?.sampleRate  ?? null,
        channels:     analysis?.channels    ?? null,
        fileSizeByte: file.size,
        mimeType:     file.type || null,
        artist:       artist.trim()   || null,
        genre:        genre.trim()    || null,
        bpm:          bpmValue,
        musicalKey:   musicalKey.trim() || null,
        createdAt:    new Date().toISOString(),
      }

      set(s => ({ savedTracks: [saved, ...s.savedTracks] }))
      return saved
    } catch (e) {
      console.error('[audioStore] uploadAndSaveTrack:', e)
      return null
    }
  },

  async getSignedUrl(storagePath) {
    const { url, error } = await createSignedAudioUrl(storagePath)
    if (error) console.warn('[audioStore] signed URL:', error)
    return url
  },

  removeSavedTrack(id) {
    const track = get().savedTracks.find(t => t.id === id)
    if (!track) return
    set(s => ({ savedTracks: s.savedTracks.filter(t => t.id !== id) }))
    if (track.storagePath && supabaseConfigured) {
      Promise.all([
        deleteAudioTrack(track.dbId),
        deleteAudioFiles([track.storagePath]),
      ]).catch(e => console.error('[audioStore] delete:', e))
    }
  },
}))
