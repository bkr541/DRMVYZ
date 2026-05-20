// Lyric import helpers — JSON parsing, timestamp formatting, and validation.
// Does not call Supabase. Pure data transformation only.

import type { LyricCue, LyricWord, LyricGroup, LyricStyle, LyricAnimation, LyricEffects } from '../types/lyrics'

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
  id?:        unknown
  startMs?:   unknown
  endMs?:     unknown
  text?:      unknown
  style?:     unknown
  animation?: unknown
  effects?:   unknown
  words?:     unknown
  groups?:    unknown
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseRawCue(raw: RawCue, fallbackIndex: number): LyricCue {
  const idx = fallbackIndex + 1

  if (typeof raw.text !== 'string' || !raw.text.trim()) {
    throw new LyricParseError(`Cue ${idx}: "text" must be a non-empty string`, fallbackIndex)
  }
  if (typeof raw.startMs !== 'number') {
    throw new LyricParseError(`Cue ${idx}: "startMs" must be a number`, fallbackIndex)
  }
  if (typeof raw.endMs !== 'number') {
    throw new LyricParseError(`Cue ${idx}: "endMs" must be a number`, fallbackIndex)
  }
  if (raw.endMs <= raw.startMs) {
    throw new LyricParseError(`Cue ${idx}: "endMs" (${raw.endMs}) must be greater than "startMs" (${raw.startMs})`, fallbackIndex)
  }

  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `cue_${String(fallbackIndex + 1).padStart(3, '0')}`

  return {
    id,
    startMs:   raw.startMs,
    endMs:     raw.endMs,
    text:      raw.text.trim(),
    style:     isPlainObject(raw.style)     ? (raw.style     as Partial<LyricStyle>)    : undefined,
    animation: isPlainObject(raw.animation) ? (raw.animation as Partial<LyricAnimation>) : undefined,
    effects:   isPlainObject(raw.effects)   ? (raw.effects   as Partial<LyricEffects>)  : undefined,
    words:     Array.isArray(raw.words)     ? (raw.words     as LyricWord[])             : undefined,
    groups:    Array.isArray(raw.groups)    ? (raw.groups    as LyricGroup[])            : undefined,
  }
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Parse a JSON string into an array of LyricCue objects.
 *
 * Accepts two shapes:
 *   1. Array of cues:         [ { startMs, endMs, text, ... }, ... ]
 *   2. Document-like object:  { cues: [ ... ], ... }
 *
 * Cues are sorted by startMs. Missing ids are auto-generated.
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
  } else if (isPlainObject(parsed) && Array.isArray((parsed as Record<string, unknown>).cues)) {
    rawArray = (parsed as { cues: RawCue[] }).cues
  } else {
    throw new LyricParseError('JSON must be an array of cues or an object with a "cues" array')
  }

  if (rawArray.length === 0) throw new LyricParseError('No cues found in input')

  const cues = rawArray.map((raw, i) => parseRawCue(raw, i))

  // Sort by startMs, assign sort_order based on sorted position
  cues.sort((a, b) => a.startMs - b.startMs)

  return cues
}
