import type { LyricCue } from '../../../types/lyrics'
import {
  getSafeLyricGroupWordIds,
  hasUsableLyricWordTiming,
  isValidLyricConfidence,
} from '../../../types/lyrics'

export type LyricValidationSeverity = 'error' | 'warning'

export interface LyricValidationIssue {
  id: string
  severity: LyricValidationSeverity
  code:
    | 'empty_text'
    | 'invalid_start'
    | 'invalid_end'
    | 'invalid_bounds'
    | 'invalid_confidence'
    | 'cue_overlap'
    | 'invalid_word_bounds'
    | 'missing_word_timing'
    | 'invalid_word_confidence'
    | 'word_outside_cue'
    | 'unknown_group_word'
    | 'empty_document'
  message: string
  cueId: string | null
  cueIndex: number | null
  wordId: string | null
  wordIndex: number | null
}

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
  issues: LyricValidationIssue[]
}

// ── Formatter (shared with display) ──────────────────────────────────────────

export function formatMsCompact(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0
  const s = Math.floor(safe / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}.${String(safe % 1000).padStart(3, '0')}`
}

function makeIssue(
  severity: LyricValidationSeverity,
  code: LyricValidationIssue['code'],
  message: string,
  cue: LyricCue | null,
  cueIndex: number | null,
  wordId: string | null = null,
  wordIndex: number | null = null,
): LyricValidationIssue {
  return {
    id: `${severity}:${code}:${cue?.id ?? 'document'}:${wordId ?? 'cue'}:${cueIndex ?? -1}:${wordIndex ?? -1}`,
    severity,
    code,
    message,
    cueId: cue?.id ?? null,
    cueIndex,
    wordId,
    wordIndex,
  }
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateLyricCues(cues: LyricCue[]): LyricValidationResult {
  const issues: LyricValidationIssue[] = []

  if (cues.length === 0) {
    const issue = makeIssue('error', 'empty_document', 'No cues in document', null, null)
    return {
      valid: false,
      cueCount: 0, wordCount: 0, groupCount: 0,
      earliestStartMs: null, latestEndMs: null, totalDurationMs: null,
      errors: [issue.message], warnings: [], issues: [issue],
    }
  }

  let wordCount = 0
  let groupCount = 0

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    const idx = i + 1

    if (!cue.text || !cue.text.trim()) {
      issues.push(makeIssue('error', 'empty_text', `Cue ${idx}: text is empty`, cue, i))
    }
    if (!Number.isFinite(cue.startMs) || cue.startMs < 0) {
      issues.push(makeIssue('error', 'invalid_start', `Cue ${idx}: startMs is invalid (${cue.startMs})`, cue, i))
    }
    if (!Number.isFinite(cue.endMs) || cue.endMs <= 0) {
      issues.push(makeIssue('error', 'invalid_end', `Cue ${idx}: endMs is invalid (${cue.endMs})`, cue, i))
    }
    if (Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs) && cue.endMs <= cue.startMs) {
      issues.push(makeIssue('error', 'invalid_bounds', `Cue ${idx}: endMs (${cue.endMs}) must be > startMs (${cue.startMs})`, cue, i))
    }
    if (cue.confidence !== undefined && !isValidLyricConfidence(cue.confidence)) {
      issues.push(makeIssue('error', 'invalid_confidence', `Cue ${idx}: confidence must be between 0 and 1`, cue, i))
    }

    if (i > 0) {
      const prev = cues[i - 1]
      if (Number.isFinite(prev.endMs) && Number.isFinite(cue.startMs) && cue.startMs < prev.endMs) {
        issues.push(makeIssue(
          'warning',
          'cue_overlap',
          `Cue ${idx} overlaps cue ${i} (starts ${cue.startMs}ms, prev ends ${prev.endMs}ms)`,
          cue,
          i,
        ))
      }
    }

    if (cue.words) {
      wordCount += cue.words.length
      for (let wi = 0; wi < cue.words.length; wi++) {
        const word = cue.words[wi]
        const explicitlyUntimed = word.startMs === undefined && word.endMs === undefined
        const hasUsableTiming = hasUsableLyricWordTiming(word)
        if (explicitlyUntimed) {
          // A canonical document must carry no untimed words — normalization
          // repairs them at every ingestion boundary, so any that survive
          // here mean the invariant was bypassed.
          issues.push(makeIssue('error', 'missing_word_timing', `Cue ${idx}, word ${wi + 1}: timing is missing`, cue, i, word.id, wi))
        } else if (!hasUsableTiming) {
          issues.push(makeIssue('error', 'invalid_word_bounds', `Cue ${idx}, word ${wi + 1}: timing is invalid`, cue, i, word.id, wi))
        }
        if (word.confidence !== undefined && !isValidLyricConfidence(word.confidence)) {
          issues.push(makeIssue('error', 'invalid_word_confidence', `Cue ${idx}, word ${wi + 1}: confidence must be between 0 and 1`, cue, i, word.id, wi))
        }
        if (hasUsableTiming && Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs)) {
          if (word.startMs < cue.startMs || word.endMs > cue.endMs) {
            issues.push(makeIssue('warning', 'word_outside_cue', `Cue ${idx}, word ${wi + 1} timing outside cue range`, cue, i, word.id, wi))
          }
        }
      }
    }

    if (cue.groups) {
      groupCount += cue.groups.length
      const wordIds = new Set((cue.words ?? []).map(w => w.id))
      for (const grp of cue.groups) {
        if (typeof grp !== 'object' || grp === null || Array.isArray(grp)) continue
        if (wordIds.size > 0) {
          for (const wid of getSafeLyricGroupWordIds(grp)) {
            if (!wordIds.has(wid)) {
              issues.push(makeIssue('warning', 'unknown_group_word', `Cue ${idx}, group "${grp.id}" references unknown word "${wid}"`, cue, i, wid))
            }
          }
        }
      }
    }
  }

  const validCues = cues.filter(c => Number.isFinite(c.startMs) && Number.isFinite(c.endMs))
  const earliestStartMs = validCues.length > 0 ? Math.min(...validCues.map(c => c.startMs)) : null
  const latestEndMs = validCues.length > 0 ? Math.max(...validCues.map(c => c.endMs)) : null
  const errors = issues.filter(issue => issue.severity === 'error').map(issue => issue.message)
  const warnings = issues.filter(issue => issue.severity === 'warning').map(issue => issue.message)

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
    issues,
  }
}
