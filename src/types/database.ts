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
  | 'reference' | 'other' | 'audio_track' | 'svg'

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
  // Added in migration 0011
  artist: string | null
  genre: string | null
  bpm: number | null
  musical_key: string | null
  created_at: string
  updated_at: string
}

export type AudioTrackInsert = Omit<AudioTrack, 'id' | 'created_at' | 'updated_at'>

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

// ── VYZUALZ catalog ───────────────────────────────────────────────────────────

export type EffectChainCategory =
  | 'color'
  | 'distortion'
  | 'audioReactive'
  | 'generative'
  | 'post'
  | 'utility'

export type EffectControlGroup =
  | 'Global'
  | 'Motion'
  | 'Audio Reactive'
  | 'Distortion'
  | 'Lighting / Atmosphere'

export interface EffectChainOptionRow {
  id:            string
  chain_name:    string
  effect_key:    string
  description:   string
  category:      EffectChainCategory
  control_group: EffectControlGroup
  sort_order:    number
  is_available:  boolean
  created_at:    string
  updated_at:    string
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

// ── Font assets (migration 0013) ──────────────────────────────────────────────

export interface FontAssetRow {
  id:               string
  user_id:          string
  name:             string
  file_name:        string
  font_family_name: string | null
  storage_path:     string
  mime_type:        string
  file_size:        number
  created_at:       string
}

export interface FontAssetInsert {
  user_id:           string
  name:              string
  file_name:         string
  font_family_name?: string | null
  storage_path:      string
  mime_type:         string
  file_size:         number
}

// ── Database type map (for createClient<Database>) ────────────────────────────

// TypeScript interface types don't satisfy Record<string, unknown> in conditional
// type checks (they lack an explicit index signature). Wrapping with this intersection
// makes each table entry satisfy postgrest-js's GenericTable constraint, which lets
// supabase-js resolve Schema = Database['public'] instead of never. Export so callers
// can use it when widening insert/update arguments to the indexed form.
export type DBRec<T> = T & { [k: string]: unknown }

export interface Database {
  public: {
    Views:          Record<string, never>
    Functions:      Record<string, never>
    Enums:          Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles:               { Row: DBRec<Profile>;              Insert: DBRec<Omit<Profile, 'created_at'|'updated_at'>>;              Update: DBRec<Partial<Omit<Profile, 'id'>>>; Relationships: [] }
      sessions:               { Row: DBRec<Session>;              Insert: DBRec<Omit<Session, 'id'>>;                                    Update: DBRec<Partial<Omit<Session, 'id'>>>; Relationships: [] }
      user_settings:          { Row: DBRec<UserSettings>;         Insert: DBRec<Pick<UserSettings,'user_id'> & Partial<UserSettings>>;   Update: DBRec<Partial<Omit<UserSettings,'user_id'>>>; Relationships: [] }
      tags:                   { Row: DBRec<Tag>;                  Insert: DBRec<Omit<Tag,'id'>>;                                         Update: DBRec<Partial<Omit<Tag,'id'>>>; Relationships: [] }
      audio_tracks:           { Row: DBRec<AudioTrack>;           Insert: DBRec<AudioTrackInsert>;                                       Update: DBRec<Partial<Omit<AudioTrack,'id'>>>; Relationships: [] }
      track_analyses:         { Row: DBRec<TrackAnalysisRow>;     Insert: DBRec<Omit<TrackAnalysisRow,'id'|'analyzed_at'>>;              Update: DBRec<Partial<Omit<TrackAnalysisRow,'id'>>>; Relationships: [] }
      analyzer_sessions:      { Row: DBRec<AnalyzerSessionRow>;   Insert: DBRec<Omit<AnalyzerSessionRow,'id'|'created_at'|'updated_at'>>;Update: DBRec<Partial<Omit<AnalyzerSessionRow,'id'>>>; Relationships: [] }
      ring_buffer_exports:    { Row: DBRec<RingBufferExport>;     Insert: DBRec<Omit<RingBufferExport,'id'|'exported_at'>>;              Update: DBRec<Partial<Omit<RingBufferExport,'id'>>>; Relationships: [] }
      bpm_detections:         { Row: DBRec<BpmDetection>;         Insert: DBRec<Omit<BpmDetection,'id'|'detected_at'>>;                 Update: DBRec<Partial<Omit<BpmDetection,'id'>>>; Relationships: [] }
      reference_sessions:     { Row: DBRec<ReferenceSessionRow>;  Insert: DBRec<Omit<ReferenceSessionRow,'id'|'created_at'|'updated_at'>>; Update: DBRec<Partial<Omit<ReferenceSessionRow,'id'>>>; Relationships: [] }
      reference_slots:        { Row: DBRec<ReferenceSlot>;        Insert: DBRec<Omit<ReferenceSlot,'id'|'created_at'>>;                 Update: DBRec<Partial<Omit<ReferenceSlot,'id'>>>; Relationships: [] }
      reference_comparisons:  { Row: DBRec<ReferenceComparison>;  Insert: DBRec<Omit<ReferenceComparison,'id'|'computed_at'>>;           Update: DBRec<Partial<Omit<ReferenceComparison,'id'>>>; Relationships: [] }
      media_items:              { Row: DBRec<MediaItemRow>;           Insert: DBRec<MediaItemInsert>;                                                   Update: DBRec<Partial<Omit<MediaItemRow,'id'>>>; Relationships: [] }
      media_tags:               { Row: DBRec<MediaTagRow>;            Insert: DBRec<MediaTagInsert>;                                                    Update: DBRec<Partial<Omit<MediaTagRow,'id'>>>; Relationships: [] }
      media_item_tags:          { Row: DBRec<MediaItemTagRow>;        Insert: DBRec<Omit<MediaItemTagRow,'created_at'>>;                                Update: never; Relationships: [] }
      media_collections:        { Row: DBRec<MediaCollectionRow>;     Insert: DBRec<MediaCollectionInsert>;                                             Update: DBRec<Partial<Omit<MediaCollectionRow,'id'>>>; Relationships: [] }
      media_collection_items:   { Row: DBRec<MediaCollectionItemRow>; Insert: DBRec<Omit<MediaCollectionItemRow,'created_at'>>;                        Update: DBRec<Pick<MediaCollectionItemRow,'sort_order'>>; Relationships: [] }
      effect_chain_options:     { Row: DBRec<EffectChainOptionRow>;    Insert: DBRec<Omit<EffectChainOptionRow,'created_at'|'updated_at'>>;     Update: DBRec<Partial<Omit<EffectChainOptionRow,'id'|'created_at'|'updated_at'>>>; Relationships: [] }
      visual_presets:           { Row: DBRec<VisualPresetRow>;        Insert: DBRec<Omit<VisualPresetRow,'id'|'created_at'|'updated_at'>>;     Update: DBRec<Partial<Omit<VisualPresetRow,'id'>>>; Relationships: [] }
      visual_sessions:          { Row: DBRec<VisualSessionRow>;       Insert: DBRec<Omit<VisualSessionRow,'id'|'created_at'|'updated_at'>>;    Update: DBRec<Partial<Omit<VisualSessionRow,'id'>>>; Relationships: [] }
      canvas_exports:           { Row: DBRec<CanvasExport>;           Insert: DBRec<Omit<CanvasExport,'id'|'exported_at'>>;                    Update: DBRec<Partial<Omit<CanvasExport,'id'>>>; Relationships: [] }
      audio_track_tags:         { Row: DBRec<{ track_id: string; tag_id: string }>; Insert: DBRec<{ track_id: string; tag_id: string }>; Update: never; Relationships: [] }
      lyric_documents:          { Row: DBRec<LyricDocumentRow>; Insert: DBRec<LyricDocumentInsert>; Update: DBRec<LyricDocumentUpdate>; Relationships: [] }
      lyric_cues:               { Row: DBRec<LyricCueRow>;      Insert: DBRec<LyricCueInsert>;      Update: DBRec<LyricCueUpdate>;      Relationships: [] }
      font_assets:              { Row: DBRec<FontAssetRow>;     Insert: DBRec<FontAssetInsert>;     Update: DBRec<Partial<Omit<FontAssetRow, 'id' | 'created_at'>>>; Relationships: [] }
    }
  }
}
