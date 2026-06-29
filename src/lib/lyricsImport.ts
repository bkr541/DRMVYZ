// Lyric import helpers — JSON parsing, timestamp formatting, and validation.
// Does not call Supabase. Pure data transformation only.

import type {
  LyricCue,
  LyricWord,
  LyricGroup,
  LyricStyle,
  LyricAnimation,
  LyricEffects,
  LyricWarning,
  LyricSource,
} from '../types/lyrics'
import {
  calculateLyricCueConfidence,
  normalizeLyricConfidence,
  normalizeLyricReviewStatus,
  normalizeLyricSectionType,
  normalizeLyricSource,
  normalizeLyricWarnings,
  toCanonicalLyricMs,
} from '../types/lyrics'

// ── Formatting ────────────────────────────────────────────────────────────────

/** Format milliseconds as MM:SS.mmm  e.g. 65000 → "01:05.000" */
export function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const millis   = ms % 1000
  const minutes  = Math.floor(totalSec / 60)
  const seconds  = totalSec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
}

/** Parse an "MM:SS.mmm" or "HH:MM:SS.mmm" timestamp string to milliseconds. */
export function parseTimestampToMs(value: string): number {
  const trimmed = value.trim()
  // Try numeric first
  const numeric = Number(trimmed)
  if (!isNaN(numeric)) return Math.round(numeric)

  // MM:SS.mmm or HH:MM:SS.mmm
  const parts = trimmed.split(':').map(Number)
  if (parts.some(isNaN)) throw new Error(`Cannot parse timestamp: "${value}"`)

  if (parts.length === 2) {
    const [m, s] = parts
    return Math.round((m * 60 + s) * 1000)
  }
  if (parts.length === 3) {
    const [h, m, s] = parts
    return Math.round((h * 3600 + m * 60 + s) * 1000)
  }
  throw new Error(`Cannot parse timestamp: "${value}"`)
}

// ── Validation error ──────────────────────────────────────────────────────────

export class LyricParseError extends Error {
  constructor(message: string, public readonly cueIndex?: number) {
    super(message)
    this.name = 'LyricParseError'
  }
}

// ── Internal raw shape ────────────────────────────────────────────────────────

interface RawCue {
  id?:                        unknown
  startMs?:                   unknown
  endMs?:                     unknown
  text?:                      unknown
  style?:                     unknown
  animation?:                 unknown
  effects?:                   unknown
  words?:                     unknown
  groups?:                    unknown
  confidence?:                unknown
  source?:                    unknown
  reviewStatus?:              unknown
  reviewed?:                  unknown
  sectionId?:                 unknown
  sectionType?:               unknown
  warnings?:                  unknown
  analysisMetadata?:          unknown
  originalTranscriptionText?: unknown
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function mergeWarnings(...sets: Array<LyricWarning[] | undefined>): LyricWarning[] | undefined {
  const warnings = [...new Set(sets.flatMap(set => set ?? []))]
  return warnings.length > 0 ? warnings : undefined
}

function normalizeImportedConfidence(
  value: unknown,
): { confidence?: number; warnings?: LyricWarning[] } {
  if (value === undefined || value === null) return {}
  const confidence = normalizeLyricConfidence(value)
  if (confidence === undefined) return { warnings: ['invalid_confidence'] }
  if (confidence !== value) return { confidence, warnings: ['confidence_clamped'] }
  return { confidence }
}

function normalizeImportedSource(
  value: unknown,
  fallback?: LyricSource,
): { source?: LyricSource; warnings?: LyricWarning[] } {
  if (value === undefined || value === null) return { source: fallback }
  const source = normalizeLyricSource(value)
  return source === 'unknown' && value !== 'unknown'
    ? { source, warnings: ['unknown_source'] }
    : { source }
}

function normalizeImportedReviewStatus(
  value: unknown,
  legacyReviewed: unknown,
): { reviewStatus?: LyricCue['reviewStatus']; warnings?: LyricWarning[] } {
  const candidate = value === undefined && typeof legacyReviewed === 'boolean'
    ? (legacyReviewed ? 'reviewed' : 'unreviewed')
    : value

  if (candidate === undefined || candidate === null) return {}
  const reviewStatus = normalizeLyricReviewStatus(candidate)
  return reviewStatus
    ? { reviewStatus }
    : { warnings: ['unknown_review_status'] }
}

function normalizeImportedSectionType(
  value: unknown,
): { sectionType?: LyricCue['sectionType']; warnings?: LyricWarning[] } {
  if (value === undefined || value === null) return {}
  const sectionType = normalizeLyricSectionType(value)
  return sectionType === 'unknown' && value !== 'unknown'
    ? { sectionType, warnings: ['unknown_section_type'] }
    : { sectionType }
}

function parseImportedWord(
  raw: unknown,
  inferredSource: LyricSource,
  fallbackIndex: number,
): LyricWord | null {
  if (!isPlainObject(raw)) return null

  const text = typeof raw.text === 'string' ? raw.text.trim() : ''
  if (!text || typeof raw.startMs !== 'number' || typeof raw.endMs !== 'number') return null
  if (!Number.isFinite(raw.startMs) || !Number.isFinite(raw.endMs)) return null

  const startMs = toCanonicalLyricMs(raw.startMs)
  const endMs = toCanonicalLyricMs(raw.endMs)
  if (startMs < 0 || endMs <= startMs) return null

  const confidenceResult = normalizeImportedConfidence(raw.confidence)
  const sourceResult = normalizeImportedSource(raw.source, inferredSource)
  const reviewResult = normalizeImportedReviewStatus(raw.reviewStatus, raw.reviewed)
  const warnings = mergeWarnings(
    normalizeLyricWarnings(raw.warnings),
    confidenceResult.warnings,
    sourceResult.warnings,
    reviewResult.warnings,
  )

  return {
    id: typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `word_${String(fallbackIndex + 1).padStart(3, '0')}`,
    text,
    startMs,
    endMs,
    style: isPlainObject(raw.style) ? raw.style as Partial<LyricStyle> : undefined,
    animation: isPlainObject(raw.animation) ? raw.animation as Partial<LyricAnimation> : undefined,
    effects: isPlainObject(raw.effects) ? raw.effects as Partial<LyricEffects> : undefined,
    ...(confidenceResult.confidence !== undefined ? { confidence: confidenceResult.confidence } : {}),
    ...(sourceResult.source !== undefined ? { source: sourceResult.source } : {}),
    ...(reviewResult.reviewStatus !== undefined ? { reviewStatus: reviewResult.reviewStatus } : {}),
    ...(typeof raw.normalizedText === 'string' ? { normalizedText: raw.normalizedText } : {}),
    ...(typeof raw.originalTranscriptionText === 'string'
      ? { originalTranscriptionText: raw.originalTranscriptionText }
      : {}),
    ...(warnings ? { warnings } : {}),
  }
}

function parseRawCue(raw: RawCue, fallbackIndex: number): LyricCue {
  const idx = fallbackIndex + 1

  if (typeof raw.text !== 'string' || !raw.text.trim()) {
    throw new LyricParseError(`Cue ${idx}: "text" must be a non-empty string`, fallbackIndex)
  }
  if (typeof raw.startMs !== 'number' || !Number.isFinite(raw.startMs)) {
    throw new LyricParseError(`Cue ${idx}: "startMs" must be a finite number`, fallbackIndex)
  }
  if (typeof raw.endMs !== 'number' || !Number.isFinite(raw.endMs)) {
    throw new LyricParseError(`Cue ${idx}: "endMs" must be a finite number`, fallbackIndex)
  }

  const startMs = toCanonicalLyricMs(raw.startMs)
  const endMs = toCanonicalLyricMs(raw.endMs)
  if (startMs < 0) {
    throw new LyricParseError(`Cue ${idx}: "startMs" must be zero or greater`, fallbackIndex)
  }
  if (endMs <= startMs) {
    throw new LyricParseError(`Cue ${idx}: canonical "endMs" (${endMs}) must be greater than "startMs" (${startMs})`, fallbackIndex)
  }

  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `cue_${String(fallbackIndex + 1).padStart(3, '0')}`

  const sourceResult = normalizeImportedSource(raw.source, 'import')
  const inferredSource = sourceResult.source ?? 'import'
  const rawWords = Array.isArray(raw.words) ? raw.words : []
  const words = rawWords
    .map((word, wordIndex) => parseImportedWord(word, inferredSource, wordIndex))
    .filter((word): word is LyricWord => word !== null)
  const invalidWordWarnings: LyricWarning[] = words.length < rawWords.length
    ? ['missing_word_timing']
    : []
  const confidenceResult = normalizeImportedConfidence(raw.confidence)
  const confidence = confidenceResult.confidence ?? calculateLyricCueConfidence(words)
  const reviewResult = normalizeImportedReviewStatus(raw.reviewStatus, raw.reviewed)
  const sectionResult = normalizeImportedSectionType(raw.sectionType)
  const warnings = mergeWarnings(
    normalizeLyricWarnings(raw.warnings),
    confidenceResult.warnings,
    sourceResult.warnings,
    reviewResult.warnings,
    sectionResult.warnings,
    invalidWordWarnings,
  )

  return {
    id,
    startMs,
    endMs,
    text:      raw.text.trim(),
    style:     isPlainObject(raw.style)     ? (raw.style     as Partial<LyricStyle>)       : undefined,
    animation: isPlainObject(raw.animation) ? (raw.animation as Partial<LyricAnimation>) : undefined,
    effects:   isPlainObject(raw.effects)   ? (raw.effects   as Partial<LyricEffects>)    : undefined,
    words:     words.length > 0 ? words : undefined,
    groups:    Array.isArray(raw.groups) ? (raw.groups as LyricGroup[]) : undefined,
    confidence,
    source: inferredSource,
    reviewStatus: reviewResult.reviewStatus,
    sectionId: typeof raw.sectionId === 'string' && raw.sectionId.trim()
      ? raw.sectionId.trim()
      : undefined,
    sectionType: sectionResult.sectionType,
    warnings,
    analysisMetadata: isPlainObject(raw.analysisMetadata)
      ? raw.analysisMetadata
      : undefined,
    originalTranscriptionText: typeof raw.originalTranscriptionText === 'string'
      ? raw.originalTranscriptionText
      : undefined,
  }
}

/**
 * Parse a JSON string into an array of LyricCue objects.
 *
 * Accepts two shapes:
 *   1. Array of cues:         [ { startMs, endMs, text, ... }, ... ]
 *   2. Document-like object:  { cues: [ ... ], ... }
 *
 * Cues are sorted by startMs. Missing ids are auto-generated. Because the
 * payload entered through an importer, missing cue/word source is safely
 * inferred as "import". Missing confidence remains unknown.
 * Throws LyricParseError for invalid input.
 */
export function parseLyricCueJson(input: string): LyricCue[] {
  if (!input.trim()) throw new LyricParseError('Input is empty')

  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new LyricParseError('Invalid JSON — check for missing commas or brackets')
  }

  let rawArray: RawCue[]

  if (Array.isArray(parsed)) {
    rawArray = parsed as RawCue[]
  } else if (isPlainObject(parsed) && Array.isArray(parsed.cues)) {
    rawArray = parsed.cues as RawCue[]
  } else {
    throw new LyricParseError('JSON must be an array of cues or an object with a "cues" array')
  }

  if (rawArray.length === 0) throw new LyricParseError('No cues found in input')

  const cues = rawArray.map((raw, i) => parseRawCue(raw, i))

  // Sort by startMs; DB sort_order is assigned by the persistence layer.
  cues.sort((a, b) => a.startMs - b.startMs)

  return cues
}
