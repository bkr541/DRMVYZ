import type { LyricCue } from '../../../types/lyrics'
import { isValidLyricConfidence } from '../../../types/lyrics'

// ── Result shape ──────────────────────────────────────────────────────────────

export interface LyricValidationResult {
  valid: boolean
  cueCount: number
  wordCount: number
  groupCount: number
  earliestStartMs: number | null
  latestEndMs: number | null
  totalDurationMs: number | null
  errors: string[]
  warnings: string[]
}

// ── Formatter (shared with display) ──────────────────────────────────────────

export function formatMsCompact(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateLyricCues(cues: LyricCue[]): LyricValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (cues.length === 0) {
    return {
      valid: true,
      cueCount: 0, wordCount: 0, groupCount: 0,
      earliestStartMs: null, latestEndMs: null, totalDurationMs: null,
      errors: [], warnings: ['No cues in document'],
    }
  }

  let wordCount = 0
  let groupCount = 0

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    const idx = i + 1

    if (!cue.text || !cue.text.trim()) {
      errors.push(`Cue ${idx}: text is empty`)
    }
    if (!isFinite(cue.startMs) || cue.startMs < 0) {
      errors.push(`Cue ${idx}: startMs is invalid (${cue.startMs})`)
    }
    if (!isFinite(cue.endMs) || cue.endMs <= 0) {
      errors.push(`Cue ${idx}: endMs is invalid (${cue.endMs})`)
    }
    if (isFinite(cue.startMs) && isFinite(cue.endMs) && cue.endMs <= cue.startMs) {
      errors.push(`Cue ${idx}: endMs (${cue.endMs}) must be > startMs (${cue.startMs})`)
    }
    if (cue.confidence !== undefined && !isValidLyricConfidence(cue.confidence)) {
      errors.push(`Cue ${idx}: confidence must be between 0 and 1`)
    }

    if (i > 0) {
      const prev = cues[i - 1]
      if (isFinite(prev.endMs) && isFinite(cue.startMs) && cue.startMs < prev.endMs) {
        warnings.push(`Cue ${idx} overlaps cue ${i} (starts ${cue.startMs}ms, prev ends ${prev.endMs}ms)`)
      }
    }

    if (cue.words) {
      wordCount += cue.words.length
      for (let wi = 0; wi < cue.words.length; wi++) {
        const word = cue.words[wi]
        if (word.endMs <= word.startMs) {
          errors.push(`Cue ${idx}, word ${wi + 1}: endMs <= startMs`)
        }
        if (word.confidence !== undefined && !isValidLyricConfidence(word.confidence)) {
          errors.push(`Cue ${idx}, word ${wi + 1}: confidence must be between 0 and 1`)
        }
        if (isFinite(cue.startMs) && isFinite(cue.endMs)) {
          if (word.startMs < cue.startMs || word.endMs > cue.endMs) {
            warnings.push(`Cue ${idx}, word ${wi + 1} timing outside cue range`)
          }
        }
      }
    }

    if (cue.groups) {
      groupCount += cue.groups.length
      const wordIds = new Set((cue.words ?? []).map(w => w.id))
      for (const grp of cue.groups) {
        if (wordIds.size > 0) {
          for (const wid of grp.wordIds) {
            if (!wordIds.has(wid)) {
              warnings.push(`Cue ${idx}, group "${grp.id}" references unknown word "${wid}"`)
            }
          }
        }
      }
    }
  }

  const valid = cues.filter(c => isFinite(c.startMs) && isFinite(c.endMs))
  const earliestStartMs = valid.length > 0 ? Math.min(...valid.map(c => c.startMs)) : null
  const latestEndMs     = valid.length > 0 ? Math.max(...valid.map(c => c.endMs))   : null

  return {
    valid: errors.length === 0,
    cueCount: cues.length,
    wordCount,
    groupCount,
    earliestStartMs,
    latestEndMs,
    totalDurationMs:
      earliestStartMs !== null && latestEndMs !== null
        ? latestEndMs - earliestStartMs
        : null,
    errors,
    warnings,
  }
}
