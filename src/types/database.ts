// Auto-maintained TypeScript types for the DRMVYZ Supabase schema.
// Keep in sync with the cumulative schema in supabase/migrations/.
// Lyric tables added in 0006_lyric_system.sql — see src/types/lyrics.ts for full lyric types.
import type {
  LyricDocumentRow, LyricDocumentInsert, LyricDocumentUpdate,
  LyricCueRow,      LyricCueInsert,      LyricCueUpdate,
  LyricTranscriptionJobRow, LyricTranscriptionJobInsert, LyricTranscriptionJobUpdate,
} from './lyrics'
import type { BrandAssetRole, BrandPaletteAnalysis } from '../features/personalization/BrandKitTypes'
import type { PreparedTranscriptionAudioManifest } from './audio'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AudioSource  = 'file' | 'microphone' | 'demo' | 'ring_buffer' | 'rekordbox_xml' | 'rekordbox_usb'
export type MeterMode    = 'vu' | 'rms' | 'peak' | 'ebu'
export type ViewMode     = 'analyzer' | 'reference' | 'vyzualz'
export type Theme        = 'dark' | 'light' | 'cdj'
export type MediaType    = 'image' | 'video'
export type ExportFormat = 'png' | 'jpeg' | 'webm' | 'gif'

export type MediaLifecycleStatus = 'complete' | 'deletion_pending' | 'deletion_failed'
export type MediaDerivativeStatus = 'ready' | 'failed' | 'pending'
export interface MediaDerivativePath {
  kind: string
  path: string
  required: boolean
  status: MediaDerivativeStatus
  error?: string
}
export type MediaUploadOperationStatus = 'preparing' | 'uploading' | 'saving' | 'cleanup_pending' | 'failed' | 'complete'
export type MediaUploadPhase = 'preparing' | 'uploading_original' | 'preparing_derivative' | 'saving_record' | 'applying_organization' | 'finalizing' | 'cleanup_pending' | 'complete' | 'failed'
export type MediaCleanupKind = 'upload_rollback' | 'media_deletion' | 'derivative_cleanup'
export type MediaCleanupStatus = 'pending' | 'failed' | 'complete'

export type MediaRoleDb  =
  | 'background_image' | 'background_video' | 'logo' | 'transparent_element'
  | 'overlay' | 'character_art' | 'texture' | 'loop' | 'transition'
  | 'reference' | 'other' | 'audio_track' | 'svg'

// Rich per-item metadata stored as JSONB in the media_items.metadata column.
// width/height/duration also live in their own columns for backward compat.
export interface SvgMediaValidationMetadata {
  isValidSvg:             boolean
  hasVectorGeometry:      boolean
  hasEmbeddedRaster:      boolean
  hasExternalRaster:      boolean
  reactivePathCompatible: boolean
}

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
  /** Deterministic client-side image palette analysis. */
  paletteAnalysis?: BrandPaletteAnalysis
  /** Non-fatal palette-analysis diagnostic; uploads continue when present. */
  paletteAnalysisError?: {
    algorithmVersion: string
    attemptedAt: string
    message: string
  }
  /** Content-inspected SVG classification. Filename alone is never authoritative. */
  svgValidation?:  SvgMediaValidationMetadata
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
  active_brand_kit_id: string | null
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
  // Added in migration 0018
  transcription_assets: PreparedTranscriptionAudioManifest | null
  // Added in migration 0022
  external_source: string | null
  external_track_id: string | null
  external_metadata: Json | null
  // Added in migration 0027
  lifecycle_status: 'complete' | 'deletion_pending'
  deletion_requested_at: string | null
  created_at: string
  updated_at: string
}

export type AudioTrackInsert = Omit<AudioTrack, 'id' | 'created_at' | 'updated_at' | 'transcription_assets' | 'external_source' | 'external_track_id' | 'external_metadata' | 'lifecycle_status' | 'deletion_requested_at'> & {
  transcription_assets?: PreparedTranscriptionAudioManifest | null
  external_source?: string | null
  external_track_id?: string | null
  external_metadata?: Json | null
  lifecycle_status?: 'complete' | 'deletion_pending'
  deletion_requested_at?: string | null
}

export interface AudioAnalysisSourceRow {
  id: string
  user_id: string
  owner_audio_track_id: string
  source_audio_track_id: string
  source_type: 'vocal_reference'
  timing_offset_ms: number
  owner_duration_ms: number | null
  source_duration_ms: number | null
  source_metadata: Json
  preparation_operation_id: string | null
  preparation_metadata: Json
  created_at: string
  updated_at: string
}

export type AudioAnalysisSourceInsert = Pick<
  AudioAnalysisSourceRow,
  'user_id' | 'owner_audio_track_id' | 'source_audio_track_id'
> & Partial<Omit<
  AudioAnalysisSourceRow,
  'id' | 'user_id' | 'owner_audio_track_id' | 'source_audio_track_id' | 'created_at' | 'updated_at'
>>
export type AudioAnalysisSourceUpdate = Partial<Omit<AudioAnalysisSourceRow, 'id' | 'user_id' | 'created_at'>>



export interface AudioPreparationOperationRow {
  id: string
  user_id: string
  audio_track_id: string
  operation_id: string
  version: string
  source_file_size: number
  duration_ms: number
  source_sample_rate: number
  source_channels: number
  target_sample_rate: number
  intended_chunk_count: number
  intended_paths: string[]
  uploaded_chunks: Array<{ index: number; path: string; byteSize: number }>
  cleanup_completed_indices: number[]
  superseded_paths: string[]
  superseded_completed_paths: string[]
  manifest_saved: boolean
  job_id: string | null
  status: 'preparing' | 'uploading' | 'manifest_saved' | 'job_created' | 'cleanup_pending' | 'cancelled' | 'failed' | 'complete'
  phase: 'planning' | 'encoding' | 'uploading' | 'saving_manifest' | 'creating_job' | 'cleanup' | 'complete' | 'failed' | 'cancelled'
  last_error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface AudioCleanupJobRow {
  id: string
  user_id: string
  audio_track_id: string | null
  track_id_snapshot: string
  kind: 'track_deletion'
  status: 'pending' | 'failed' | 'complete'
  storage_paths: string[]
  completed_paths: string[]
  last_error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface TrackCueRow {
  id: string
  track_id: string
  source: 'manual' | 'rekordbox' | 'analysis'
  source_cue_id: string | null
  label: string
  cue_kind: 'hot_cue' | 'memory_cue' | 'loop' | 'marker' | 'automation'
  time_sec: number
  end_time_sec: number | null
  color: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export type TrackCueInsert = Omit<TrackCueRow, 'id' | 'created_at' | 'updated_at'>

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
  /** Full Music Intelligence analysis used to hydrate beat grids, downbeats, sections, and phrases. */
  analysis_payload: Json | null
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
  revision:    number          // optimistic concurrency token (migration 0023)
  upload_operation_id: string | null
  lifecycle_status: MediaLifecycleStatus
  derivative_paths: MediaDerivativePath[]
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
  revision?: number
  upload_operation_id?: string | null
  lifecycle_status?: MediaLifecycleStatus
  derivative_paths?: MediaDerivativePath[]
}


export interface MediaUploadOperationRow {
  id: string
  user_id: string
  operation_id: string
  original_path: string
  derivative_paths: MediaDerivativePath[]
  status: MediaUploadOperationStatus
  phase: MediaUploadPhase
  media_item_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface MediaCleanupJobRow {
  id: string
  user_id: string
  media_item_id: string | null
  upload_operation_id: string | null
  kind: MediaCleanupKind
  status: MediaCleanupStatus
  storage_paths: string[]
  completed_paths: string[]
  last_error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
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

export interface BrandKitRow {
  id: string
  user_id: string
  name: string
  palette: Json
  extracted_palette: Json
  extraction_metadata: Json
  default_strength: number
  engine_rules: Json
  preset_rules: Json
  use_for_app_accent: boolean
  auto_apply: boolean
  created_at: string
  updated_at: string
}

export interface BrandKitInsert {
  user_id: string
  name: string
  palette?: Json
  extracted_palette?: Json
  extraction_metadata?: Json
  default_strength?: number
  engine_rules?: Json
  preset_rules?: Json
  use_for_app_accent?: boolean
  auto_apply?: boolean
}

export type BrandKitUpdate = Partial<Omit<BrandKitInsert, 'user_id'>>

export interface BrandKitAssetRow {
  id: string
  brand_kit_id: string
  media_item_id: string
  asset_role: BrandAssetRole
  sort_order: number
  is_palette_source: boolean
  presentation: Json | null
  created_at: string
  updated_at: string
}

export interface BrandKitAssetInsert {
  brand_kit_id: string
  media_item_id: string
  asset_role: BrandAssetRole
  sort_order?: number
  is_palette_source?: boolean
  presentation?: Json | null
}

export type BrandKitAssetUpdate = Partial<Pick<BrandKitAssetRow,
  'asset_role' | 'sort_order' | 'is_palette_source' | 'presentation'
>>

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
    Functions: {
      activate_lyric_document: {
        Args: {
          p_document_id: string
          p_expected_revision: number | null
        }
        Returns: Json
      }
      save_lyric_document_atomic: {
        Args: {
          p_document_id: string | null
          p_expected_revision: number | null
          p_document: Json
          p_cues: Json
          p_activate: boolean
        }
        Returns: Json
      }
      complete_lyric_transcription_job: {
        Args: {
          p_job_id: string
          p_document: Json
          p_cues: Json
          p_provider_metadata: Json
        }
        Returns: Json
      }

      begin_audio_preparation: {
        Args: {
          p_audio_track_id: string
          p_operation_id: string
          p_source_file_size: number
          p_duration_ms: number
          p_source_sample_rate: number
          p_source_channels: number
          p_chunk_count: number
        }
        Returns: Json
      }
      mark_audio_preparation_chunk_uploaded: {
        Args: { p_operation_id: string; p_chunk_index: number; p_byte_size: number }
        Returns: Json
      }
      finalize_audio_preparation_manifest: {
        Args: { p_operation_id: string; p_manifest: Json }
        Returns: Json
      }
      record_audio_preparation_cleanup: {
        Args: { p_operation_id: string; p_completed_indices: Json; p_status: string; p_error?: string | null }
        Returns: Json
      }
      record_audio_preparation_superseded_cleanup: {
        Args: { p_operation_id: string; p_completed_paths: Json; p_error?: string | null }
        Returns: Json
      }
      request_audio_track_deletion: {
        Args: { p_audio_track_id: string }
        Returns: Json
      }
      update_audio_cleanup_job: {
        Args: { p_cleanup_job_id: string; p_completed_paths: Json; p_status: string; p_error?: string | null }
        Returns: Json
      }
      finalize_audio_track_deletion: {
        Args: { p_cleanup_job_id: string }
        Returns: Json
      }
      list_pending_audio_cleanup: {
        Args: Record<string, never>
        Returns: Json
      }
      begin_media_upload: {
        Args: { p_operation_id: string; p_original_path: string; p_derivative_paths: Json }
        Returns: Json
      }
      finalize_media_upload_atomic: {
        Args: { p_operation_id: string; p_media: Json; p_tag_names: Json; p_collection_ids: Json; p_derivative_paths: Json }
        Returns: Json
      }
      mark_media_upload_cleanup_pending: {
        Args: { p_operation_id: string; p_storage_paths: Json; p_error: string }
        Returns: Json
      }
      update_media_cleanup_job: {
        Args: { p_job_id: string; p_completed_paths: Json; p_status: string; p_error?: string | null }
        Returns: Json
      }
      request_media_deletion: {
        Args: { p_media_item_id: string }
        Returns: Json
      }
      finalize_media_deletion: {
        Args: { p_cleanup_job_id: string }
        Returns: Json
      }
      list_pending_media_cleanup: {
        Args: Record<string, never>
        Returns: Json
      }
      save_media_item_atomic: {
        Args: {
          p_media_item_id: string
          p_expected_revision: number
          p_patch: Json
          p_tag_names: Json
          p_collection_ids: Json
        }
        Returns: Json
      }
      reorder_media_collection_atomic: {
        Args: {
          p_collection_id: string
          p_ordered_media_ids: Json
        }
        Returns: Json
      }
    }
    Enums:          Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles:               { Row: DBRec<Profile>;              Insert: DBRec<Omit<Profile, 'created_at'|'updated_at'>>;              Update: DBRec<Partial<Omit<Profile, 'id'>>>; Relationships: [] }
      sessions:               { Row: DBRec<Session>;              Insert: DBRec<Omit<Session, 'id'>>;                                    Update: DBRec<Partial<Omit<Session, 'id'>>>; Relationships: [] }
      user_settings: {
        Row: DBRec<UserSettings>
        Insert: DBRec<Pick<UserSettings,'user_id'> & Partial<UserSettings>>
        Update: DBRec<Partial<Omit<UserSettings,'user_id'>>>
        Relationships: [
          { foreignKeyName: 'user_settings_active_brand_kit_id_fkey'; columns: ['active_brand_kit_id']; isOneToOne: false; referencedRelation: 'brand_kits'; referencedColumns: ['id'] },
        ]
      }
      tags:                   { Row: DBRec<Tag>;                  Insert: DBRec<Omit<Tag,'id'>>;                                         Update: DBRec<Partial<Omit<Tag,'id'>>>; Relationships: [] }
      audio_preparation_operations: { Row: DBRec<AudioPreparationOperationRow>; Insert: never; Update: never; Relationships: [] }
      audio_cleanup_jobs: { Row: DBRec<AudioCleanupJobRow>; Insert: never; Update: never; Relationships: [] }
      audio_tracks:           { Row: DBRec<AudioTrack>;           Insert: DBRec<AudioTrackInsert>;                                       Update: DBRec<Partial<Omit<AudioTrack,'id'>>>; Relationships: [] }
      track_analyses:         { Row: DBRec<TrackAnalysisRow>;     Insert: DBRec<Omit<TrackAnalysisRow,'id'|'analyzed_at'|'analysis_payload'> & { analysis_payload?: Json | null }>;              Update: DBRec<Partial<Omit<TrackAnalysisRow,'id'>>>; Relationships: [] }
      analyzer_sessions:      { Row: DBRec<AnalyzerSessionRow>;   Insert: DBRec<Omit<AnalyzerSessionRow,'id'|'created_at'|'updated_at'>>;Update: DBRec<Partial<Omit<AnalyzerSessionRow,'id'>>>; Relationships: [] }
      ring_buffer_exports:    { Row: DBRec<RingBufferExport>;     Insert: DBRec<Omit<RingBufferExport,'id'|'exported_at'>>;              Update: DBRec<Partial<Omit<RingBufferExport,'id'>>>; Relationships: [] }
      bpm_detections:         { Row: DBRec<BpmDetection>;         Insert: DBRec<Omit<BpmDetection,'id'|'detected_at'>>;                 Update: DBRec<Partial<Omit<BpmDetection,'id'>>>; Relationships: [] }
      reference_sessions:     { Row: DBRec<ReferenceSessionRow>;  Insert: DBRec<Omit<ReferenceSessionRow,'id'|'created_at'|'updated_at'>>; Update: DBRec<Partial<Omit<ReferenceSessionRow,'id'>>>; Relationships: [] }
      reference_slots:        { Row: DBRec<ReferenceSlot>;        Insert: DBRec<Omit<ReferenceSlot,'id'|'created_at'>>;                 Update: DBRec<Partial<Omit<ReferenceSlot,'id'>>>; Relationships: [] }
      reference_comparisons:  { Row: DBRec<ReferenceComparison>;  Insert: DBRec<Omit<ReferenceComparison,'id'|'computed_at'>>;           Update: DBRec<Partial<Omit<ReferenceComparison,'id'>>>; Relationships: [] }
      media_upload_operations: { Row: DBRec<MediaUploadOperationRow>; Insert: never; Update: never; Relationships: [] }
      media_cleanup_jobs:       { Row: DBRec<MediaCleanupJobRow>; Insert: never; Update: never; Relationships: [] }
      media_items:              { Row: DBRec<MediaItemRow>;           Insert: DBRec<MediaItemInsert>;                                                   Update: DBRec<Partial<Omit<MediaItemRow,'id'>>>; Relationships: [] }
      media_tags:               { Row: DBRec<MediaTagRow>;            Insert: DBRec<MediaTagInsert>;                                                    Update: DBRec<Partial<Omit<MediaTagRow,'id'>>>; Relationships: [] }
      media_item_tags:          { Row: DBRec<MediaItemTagRow>;        Insert: DBRec<Omit<MediaItemTagRow,'created_at'>>;                                Update: never; Relationships: [] }
      media_collections:        { Row: DBRec<MediaCollectionRow>;     Insert: DBRec<MediaCollectionInsert>;                                             Update: DBRec<Partial<Omit<MediaCollectionRow,'id'>>>; Relationships: [] }
      media_collection_items:   { Row: DBRec<MediaCollectionItemRow>; Insert: DBRec<Omit<MediaCollectionItemRow,'created_at'>>;                        Update: DBRec<Pick<MediaCollectionItemRow,'sort_order'>>; Relationships: [] }
      brand_kits: {
        Row: DBRec<BrandKitRow>
        Insert: DBRec<BrandKitInsert>
        Update: DBRec<BrandKitUpdate>
        Relationships: [
          { foreignKeyName: 'brand_kits_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      brand_kit_assets: {
        Row: DBRec<BrandKitAssetRow>
        Insert: DBRec<BrandKitAssetInsert>
        Update: DBRec<BrandKitAssetUpdate>
        Relationships: [
          { foreignKeyName: 'brand_kit_assets_brand_kit_id_fkey'; columns: ['brand_kit_id']; isOneToOne: false; referencedRelation: 'brand_kits'; referencedColumns: ['id'] },
          { foreignKeyName: 'brand_kit_assets_media_item_id_fkey'; columns: ['media_item_id']; isOneToOne: false; referencedRelation: 'media_items'; referencedColumns: ['id'] },
        ]
      }
      effect_chain_options:     { Row: DBRec<EffectChainOptionRow>;    Insert: DBRec<Omit<EffectChainOptionRow,'created_at'|'updated_at'>>;     Update: DBRec<Partial<Omit<EffectChainOptionRow,'id'|'created_at'|'updated_at'>>>; Relationships: [] }
      visual_presets:           { Row: DBRec<VisualPresetRow>;        Insert: DBRec<Omit<VisualPresetRow,'id'|'created_at'|'updated_at'>>;     Update: DBRec<Partial<Omit<VisualPresetRow,'id'>>>; Relationships: [] }
      visual_sessions:          { Row: DBRec<VisualSessionRow>;       Insert: DBRec<Omit<VisualSessionRow,'id'|'created_at'|'updated_at'>>;    Update: DBRec<Partial<Omit<VisualSessionRow,'id'>>>; Relationships: [] }
      canvas_exports:           { Row: DBRec<CanvasExport>;           Insert: DBRec<Omit<CanvasExport,'id'|'exported_at'>>;                    Update: DBRec<Partial<Omit<CanvasExport,'id'>>>; Relationships: [] }
      audio_track_tags:         { Row: DBRec<{ track_id: string; tag_id: string }>; Insert: DBRec<{ track_id: string; tag_id: string }>; Update: never; Relationships: [] }
      lyric_documents: {
        Row: DBRec<LyricDocumentRow>
        Insert: DBRec<LyricDocumentInsert>
        Update: DBRec<LyricDocumentUpdate>
        Relationships: [
          { foreignKeyName: 'lyric_documents_audio_track_id_fkey'; columns: ['audio_track_id']; isOneToOne: false; referencedRelation: 'audio_tracks'; referencedColumns: ['id'] },
          { foreignKeyName: 'lyric_documents_visual_session_id_fkey'; columns: ['visual_session_id']; isOneToOne: false; referencedRelation: 'visual_sessions'; referencedColumns: ['id'] },
        ]
      }
      lyric_cues: {
        Row: DBRec<LyricCueRow>
        Insert: DBRec<LyricCueInsert>
        Update: DBRec<LyricCueUpdate>
        Relationships: [
          { foreignKeyName: 'lyric_cues_lyric_document_id_fkey'; columns: ['lyric_document_id']; isOneToOne: false; referencedRelation: 'lyric_documents'; referencedColumns: ['id'] },
        ]
      }
      audio_analysis_sources: {
        Row: DBRec<AudioAnalysisSourceRow>
        Insert: DBRec<AudioAnalysisSourceInsert>
        Update: DBRec<AudioAnalysisSourceUpdate>
        Relationships: [
          { foreignKeyName: 'audio_analysis_sources_owner_audio_track_id_fkey'; columns: ['owner_audio_track_id']; isOneToOne: false; referencedRelation: 'audio_tracks'; referencedColumns: ['id'] },
          { foreignKeyName: 'audio_analysis_sources_source_audio_track_id_fkey'; columns: ['source_audio_track_id']; isOneToOne: false; referencedRelation: 'audio_tracks'; referencedColumns: ['id'] },
        ]
      }
      lyric_transcription_jobs: {
        Row: DBRec<LyricTranscriptionJobRow>
        Insert: DBRec<LyricTranscriptionJobInsert>
        Update: DBRec<LyricTranscriptionJobUpdate>
        Relationships: [
          { foreignKeyName: 'lyric_transcription_jobs_audio_track_id_fkey'; columns: ['audio_track_id']; isOneToOne: false; referencedRelation: 'audio_tracks'; referencedColumns: ['id'] },
          { foreignKeyName: 'lyric_transcription_jobs_analysis_source_id_fkey'; columns: ['analysis_source_id']; isOneToOne: false; referencedRelation: 'audio_analysis_sources'; referencedColumns: ['id'] },
          { foreignKeyName: 'lyric_transcription_jobs_lyric_document_id_fkey'; columns: ['lyric_document_id']; isOneToOne: false; referencedRelation: 'lyric_documents'; referencedColumns: ['id'] },
        ]
      }
      font_assets:              { Row: DBRec<FontAssetRow>;     Insert: DBRec<FontAssetInsert>;     Update: DBRec<Partial<Omit<FontAssetRow, 'id' | 'created_at'>>>; Relationships: [] }
    }
  }
}
