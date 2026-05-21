// Extended lyric JSON parser — handles cue arrays, {cues:[]} wrappers,
// and full lyric document objects with metadata + style defaults.

import type {
  LyricCue,
  LyricStyle,
  LyricAnimation,
  LyricEffects,
  LyricDocumentSourceType,
  LyricDocumentSourceFormat,
} from '../../../types/lyrics'
import { parseLyricCueJson, LyricParseError } from '../../../lib/lyricsImport'

// ── Result shape ──────────────────────────────────────────────────────────────

export interface LyricDocumentImportResult {
  documentPatch: {
    title?: string
    artist?: string
    sourceType?: LyricDocumentSourceType
    sourceFormat?: LyricDocumentSourceFormat
    rawSourceText?: string
    globalOffsetMs?: number
    metadata?: Record<string, unknown>
    defaultStyle?: Partial<LyricStyle>
    defaultAnimation?: Partial<LyricAnimation>
    defaultEffects?: Partial<LyricEffects>
  }
  cues: LyricCue[]
  detectedFormat: 'cue_array' | 'cue_wrapper' | 'full_document' | 'unknown'
  warnings: string[]
  errors: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a JSON string into a LyricDocumentImportResult.
 *
 * Supports three input shapes:
 *   1. Cue array:       [ { startMs, endMs, text, ... }, ... ]
 *   2. Cue wrapper:     { cues: [...], ...anything-else-ignored... }
 *   3. Full document:   { title, artist, defaultStyle, ..., cues: [...] }
 *
 * Always attempts to extract cues. Document-level fields are extracted when
 * the input is a full document object.
 */
export function parseLyricDocumentJson(input: string): LyricDocumentImportResult {
  const result: LyricDocumentImportResult = {
    documentPatch: {},
    cues: [],
    detectedFormat: 'unknown',
    warnings: [],
    errors: [],
  }

  if (!input.trim()) {
    result.errors.push('Input is empty')
    return result
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    result.errors.push('Invalid JSON — check for missing commas or brackets')
    return result
  }

  // Detect format
  if (Array.isArray(parsed)) {
    result.detectedFormat = 'cue_array'
  } else if (isPlainObject(parsed)) {
    const doc = parsed as Record<string, unknown>
    const hasDocFields = typeof doc.title === 'string' ||
      typeof doc.artist === 'string' ||
      isPlainObject(doc.defaultStyle) ||
      isPlainObject(doc.defaultAnimation) ||
      isPlainObject(doc.defaultEffects)
    result.detectedFormat = hasDocFields ? 'full_document' : 'cue_wrapper'
  }

  // Extract cues via existing parser (handles array and {cues:[]} both)
  try {
    result.cues = parseLyricCueJson(input)
  } catch (err) {
    if (err instanceof LyricParseError) {
      result.errors.push(err.message)
    } else {
      result.errors.push(String(err))
    }
  }

  // Extract document-level fields when present
  if (isPlainObject(parsed) && result.detectedFormat === 'full_document') {
    const doc = parsed as Record<string, unknown>

    if (typeof doc.title === 'string' && doc.title.trim()) {
      result.documentPatch.title = doc.title.trim()
    }
    if (typeof doc.artist === 'string' && doc.artist.trim()) {
      result.documentPatch.artist = doc.artist.trim()
    }
    if (typeof doc.sourceType === 'string') {
      result.documentPatch.sourceType = doc.sourceType as LyricDocumentSourceType
    }
    if (typeof doc.sourceFormat === 'string') {
      result.documentPatch.sourceFormat = doc.sourceFormat as LyricDocumentSourceFormat
    }
    if (typeof doc.rawSourceText === 'string') {
      result.documentPatch.rawSourceText = doc.rawSourceText
    }
    if (typeof doc.globalOffsetMs === 'number' && isFinite(doc.globalOffsetMs)) {
      result.documentPatch.globalOffsetMs = doc.globalOffsetMs
    }
    if (isPlainObject(doc.metadata)) {
      result.documentPatch.metadata = doc.metadata as Record<string, unknown>
    }
    if (isPlainObject(doc.defaultStyle)) {
      result.documentPatch.defaultStyle = doc.defaultStyle as Partial<LyricStyle>
    }
    if (isPlainObject(doc.defaultAnimation)) {
      result.documentPatch.defaultAnimation = doc.defaultAnimation as Partial<LyricAnimation>
    }
    if (isPlainObject(doc.defaultEffects)) {
      result.documentPatch.defaultEffects = doc.defaultEffects as Partial<LyricEffects>
    }
  }

  return result
}
