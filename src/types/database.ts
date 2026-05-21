// Auto-maintained TypeScript types for the DRMVYZ Supabase schema.
// Keep in sync with supabase/migrations/0001_initial_drmvyz_schema.sql
// Lyric tables added in 0006_lyric_system.sql — see src/types/lyrics.ts for full lyric types.
import type {
  LyricDocumentRow, LyricDocumentInsert, LyricDocumentUpdate,
  LyricCueRow,      LyricCueInsert,      LyricCueUpdate,
} from './lyrics'

export type AudioSource  = 'file' | 'microphone' | 'demo' | 'ring_buffer'
export type MeterMode    = 'vu' | 'rms' | 'peak' | 'ebu'
export type ViewMode     = 'analyzer' | 'reference' | 'vyzualz'
export type Theme        = 'dark' | 'light' | 'system'
export type MediaType    = 'image' | 'video'
export type ExportFormat = 'png' | 'jpeg' | 'webm' | 'gif'
export type MediaRoleDb  =
  | 'background_image' | 'background_video' | 'logo' | 'transparent_element'
  | 'overlay' | 'character_art' | 'texture' | 'loop' | 'transition'
  | 'reference' | 'other'

// Rich per-item metadata stored as JSONB in the media_items.metadata column.
// width/height/duration also live in their own columns for backward compat.
export interface MediaMetadata {
  width?:          number
  height?:         number
  duration?:       number
  fps?:            number
  hasAlpha?:       boolean
  loopable?:       boolean
  bpm?:            number
  key?:            string
  energy?:         'low' | 'medium' | 'high' | 'peak'
  dominantColors?: string[]
  analyzedAt?:     number   // Date.now() of last client-side analysis pass
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  artist_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  user_id: string | null
  started_at: string
  ended_at: string | null
  client_info: Record<string, unknown>
}

export interface UserSettings {
  user_id: string
  theme: Theme
  default_view: ViewMode
  fft_size: 512 | 1024 | 2048 | 4096 | 8192 | 16384
  smoothing: number
  default_volume: number
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string | null
}

// ── Analyzer ──────────────────────────────────────────────────────────────────

export interface AudioTrack {
  id: string
  user_id: string | null
  title: string
  file_name: string
  storage_path: string | null
  duration_sec: number | null
  sample_rate: number | null
  bit_depth: number | null
  channels: number | null
  file_size: number | null
  mime_type: string | null
  source_type: AudioSource | null
  created_at: string
  updated_at: string
}

export interface TrackAnalysisRow {
  id: string
  track_id: string
  lufs_integrated: number | null
  lufs_short: number | null
  lufs_momentary: number | null
  true_peak: number | null
  dynamic_range: number | null
  stereo_width: number | null
  phase_correlation: number | null
  bpm: number | null
  bpm_confidence: number | null
  key_note: string | null
  key_mode: 'major' | 'minor' | null
  waveform_peaks: number[] | null
  spectrum_avg: number[] | null
  band_bass: number | null
  band_low_mid: number | null
  band_mid: number | null
  band_high_mid: number | null
  band_presence: number | null
  band_air: number | null
  analyzed_at: string
}

export interface AnalyzerSessionRow {
  id: string
  user_id: string | null
  track_id: string | null
  fft_size: 512 | 1024 | 2048 | 4096 | 8192 | 16384
  smoothing: number
  source: 'file' | 'microphone' | 'demo'
  volume: number
  meter_mode: MeterMode
  created_at: string
  updated_at: string
}

export interface RingBufferExport {
  id: string
  user_id: string | null
  storage_path: string
  duration_sec: 10 | 30 | 60
  file_size: number | null
  exported_at: string
}

export interface BpmDetection {
  id: string
  track_id: string
  bpm: number
  confidence: number | null
  method: string
  detected_at: string
}

// ── Reference ─────────────────────────────────────────────────────────────────

export interface ReferenceSessionRow {
  id: string
  user_id: string | null
  name: string | null
  main_track_id: string | null
  view_mode: 'grid' | 'overlay' | 'ab'
  loudness_match: boolean
  linked_playback: boolean
  created_at: string
  updated_at: string
}

export interface ReferenceSlot {
  id: string
  session_id: string
  slot_index: 0 | 1 | 2
  track_id: string | null
  accent_color: string | null
  created_at: string
}

export interface ReferenceComparison {
  id: string
  session_id: string
  main_track_id: string | null
  ref_track_id: string | null
  overall_score: number | null
  loudness_diff: number | null
  dynamic_diff: number | null
  stereo_diff: number | null
  spectrum_diff: number | null
  band_diffs: Record<string, number> | null
  computed_at: string
}

// ── VYZUALZ ───────────────────────────────────────────────────────────────────

export interface MediaItemRow {
  id: string
  user_id: string | null
  name: string
  type: MediaType
  storage_path: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  duration_sec: number | null
  file_size: number | null
  mime_type: string | null
  favorite: boolean
  // Organization fields (migration 0005)
  media_role:  MediaRoleDb
  title:       string | null
  description: string | null
  metadata:    MediaMetadata   // JSONB column
  created_at: string
  updated_at: string
}

export interface MediaItemInsert {
  user_id?: string | null
  name: string
  type: MediaType
  storage_path: string
  thumbnail_path?: string | null
  width?: number | null
  height?: number | null
  duration_sec?: number | null
  file_size?: number | null
  mime_type?: string | null
  favorite?: boolean
  media_role?: MediaRoleDb
  title?: string | null
  description?: string | null
  metadata?: MediaMetadata
}

export interface MediaTagRow {
  id: string
  user_id: string
  name: string
  color: string | null
  created_at: string
  updated_at: string
}

export interface MediaTagInsert {
  user_id: string
  name: string
  color?: string | null
}

export interface MediaItemTagRow {
  media_item_id: string
  tag_id: string
  created_at: string
}

export interface MediaCollectionRow {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface MediaCollectionInsert {
  user_id: string
  name: string
  description?: string | null
}

export interface MediaCollectionItemRow {
  collection_id: string
  media_item_id: string
  sort_order: number
  created_at: string
}

export interface VisualPresetRow {
  id: string
  user_id: string | null
  name: string
  color: string
  gradient: string | null
  is_default: boolean
  effects: Record<string, unknown>
  enabled_fx: string[]
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VisualSessionRow {
  id: string
  user_id: string | null
  name: string | null
  active_preset_id: string | null
  active_media_id: string | null
  bpm: number
  bpm_sync: boolean
  effects: Record<string, unknown>
  enabled_fx: string[]
  media_order: string[]
  quality: 'High' | 'Medium' | 'Low'
  audio_source: 'file' | 'microphone' | 'demo'
  state: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CanvasExport {
  id: string
  user_id: string | null
  preset_id: string | null
  media_id: string | null
  storage_path: string
  format: ExportFormat
  width: number | null
  height: number | null
  file_size: number | null
  exported_at: string
}

// ── Database type map (for createClient<Database>) ────────────────────────────

export interface Database {
  public: {
    Views:          Record<string, never>
    Functions:      Record<string, never>
    Enums:          Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles:               { Row: Profile;              Insert: Omit<Profile, 'created_at'|'updated_at'>;              Update: Partial<Omit<Profile, 'id'>> }
      sessions:               { Row: Session;              Insert: Omit<Session, 'id'>;                                    Update: Partial<Omit<Session, 'id'>> }
      user_settings:          { Row: UserSettings;         Insert: Pick<UserSettings,'user_id'> & Partial<UserSettings>;   Update: Partial<Omit<UserSettings,'user_id'>> }
      tags:                   { Row: Tag;                  Insert: Omit<Tag,'id'>;                                         Update: Partial<Omit<Tag,'id'>> }
      audio_tracks:           { Row: AudioTrack;           Insert: Omit<AudioTrack,'id'|'created_at'|'updated_at'>;        Update: Partial<Omit<AudioTrack,'id'>> }
      track_analyses:         { Row: TrackAnalysisRow;     Insert: Omit<TrackAnalysisRow,'id'|'analyzed_at'>;              Update: Partial<Omit<TrackAnalysisRow,'id'>> }
      analyzer_sessions:      { Row: AnalyzerSessionRow;   Insert: Omit<AnalyzerSessionRow,'id'|'created_at'|'updated_at'>;Update: Partial<Omit<AnalyzerSessionRow,'id'>> }
      ring_buffer_exports:    { Row: RingBufferExport;     Insert: Omit<RingBufferExport,'id'|'exported_at'>;              Update: Partial<Omit<RingBufferExport,'id'>> }
      bpm_detections:         { Row: BpmDetection;         Insert: Omit<BpmDetection,'id'|'detected_at'>;                 Update: Partial<Omit<BpmDetection,'id'>> }
      reference_sessions:     { Row: ReferenceSessionRow;  Insert: Omit<ReferenceSessionRow,'id'|'created_at'|'updated_at'>; Update: Partial<Omit<ReferenceSessionRow,'id'>> }
      reference_slots:        { Row: ReferenceSlot;        Insert: Omit<ReferenceSlot,'id'|'created_at'>;                 Update: Partial<Omit<ReferenceSlot,'id'>> }
      reference_comparisons:  { Row: ReferenceComparison;  Insert: Omit<ReferenceComparison,'id'|'computed_at'>;           Update: Partial<Omit<ReferenceComparison,'id'>> }
      media_items:              { Row: MediaItemRow;           Insert: MediaItemInsert;                                                   Update: Partial<Omit<MediaItemRow,'id'>> }
      media_tags:               { Row: MediaTagRow;            Insert: MediaTagInsert;                                                    Update: Partial<Omit<MediaTagRow,'id'>> }
      media_item_tags:          { Row: MediaItemTagRow;        Insert: Omit<MediaItemTagRow,'created_at'>;                                Update: never }
      media_collections:        { Row: MediaCollectionRow;     Insert: MediaCollectionInsert;                                             Update: Partial<Omit<MediaCollectionRow,'id'>> }
      media_collection_items:   { Row: MediaCollectionItemRow; Insert: Omit<MediaCollectionItemRow,'created_at'>;                        Update: Pick<MediaCollectionItemRow,'sort_order'> }
      visual_presets:           { Row: VisualPresetRow;        Insert: Omit<VisualPresetRow,'id'|'created_at'|'updated_at'>;     Update: Partial<Omit<VisualPresetRow,'id'>> }
      visual_sessions:          { Row: VisualSessionRow;       Insert: Omit<VisualSessionRow,'id'|'created_at'|'updated_at'>;    Update: Partial<Omit<VisualSessionRow,'id'>> }
      canvas_exports:           { Row: CanvasExport;           Insert: Omit<CanvasExport,'id'|'exported_at'>;                    Update: Partial<Omit<CanvasExport,'id'>> }
      audio_track_tags:         { Row: { track_id: string; tag_id: string }; Insert: { track_id: string; tag_id: string }; Update: never }
      lyric_documents:          { Row: LyricDocumentRow; Insert: LyricDocumentInsert; Update: LyricDocumentUpdate }
      lyric_cues:               { Row: LyricCueRow;      Insert: LyricCueInsert;      Update: LyricCueUpdate      }
    }
  }
}
