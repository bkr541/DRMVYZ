import type { LyricCue } from '../../../types/lyrics'

// ── Options / result types ────────────────────────────────────────────────────

export interface LyricExtractionOptions {
  language?: string
  timingDetail?: 'line' | 'word' | 'line+word'
  stylePreset?: string
  confidenceThreshold?: number
  globalOffsetMs?: number
}

export interface ExtractedCue extends LyricCue {
  confidence?: number
  reviewed?: boolean
}

export interface LyricExtractionResult {
  title?: string
  artist?: string
  sourceType: 'ai_transcription'
  sourceFormat: 'json'
  globalOffsetMs: number
  metadata: {
    model?: string
    language?: string
    confidence?: number
    originalFileName?: string
  }
  cues: ExtractedCue[]
}

// ── Placeholder service ───────────────────────────────────────────────────────

/**
 * Extract lyrics from an audio file using AI transcription.
 *
 * TODO: Implement by calling a Supabase Edge Function or external AI API.
 * Expected endpoint: POST /functions/v1/lyric-extract
 * Body: multipart/form-data with audio file + options JSON
 */
export async function extractLyricsFromAudio(
  _file: File,
  _options: LyricExtractionOptions,
): Promise<LyricExtractionResult> {
  throw new Error(
    'AI lyric extraction is not yet implemented. ' +
    'Connect a backend transcription service (e.g. Whisper via Supabase Edge Function) to enable this feature.'
  )
}
