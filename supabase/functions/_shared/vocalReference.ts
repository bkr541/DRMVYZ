import type {
  CanonicalCue,
  CanonicalWord,
  ReconciledTranscript,
} from './lyricTranscriptionCore.ts'

export type LyricExtractionSourceMode = 'full_mix' | 'vocal_reference'
export type VocalReferenceCompatibilityStatus =
  | 'compatible'
  | 'minor_difference'
  | 'significant_mismatch'
  | 'duration_unknown'

export interface VocalReferenceCompatibility {
  status: VocalReferenceCompatibilityStatus
  label: 'Compatible duration' | 'Minor duration difference' | 'Significant mismatch' | 'Duration unknown'
  ownerDurationMs: number | null
  sourceDurationMs: number | null
  alignedSourceEndMs: number | null
  durationDifferenceMs: number | null
  requiresConfirmation: boolean
  blocked: boolean
  reason: string
}

export interface ShiftedTranscriptResult {
  transcript: ReconciledTranscript
  offsetMs: number
  sourceDurationMs: number | null
  ownerDurationMs: number | null
  clampedWordCount: number
  clampedSegmentCount: number
  rejectedWordCount: number
  rejectedSegmentCount: number
}

const MAX_ABSOLUTE_OFFSET_MS = 60 * 60 * 1000

function finiteDurationMs(seconds: unknown): number | null {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? Math.round(seconds * 1000)
    : null
}

export function normalizeVocalReferenceOffsetMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(-MAX_ABSOLUTE_OFFSET_MS, Math.min(MAX_ABSOLUTE_OFFSET_MS, Math.round(value)))
}

export function assessVocalReferenceCompatibility(
  ownerDurationSec: unknown,
  sourceDurationSec: unknown,
  timingOffsetMs: unknown,
): VocalReferenceCompatibility {
  const ownerDurationMs = finiteDurationMs(ownerDurationSec)
  const sourceDurationMs = finiteDurationMs(sourceDurationSec)
  const offsetMs = normalizeVocalReferenceOffsetMs(timingOffsetMs)

  if (ownerDurationMs === null || sourceDurationMs === null) {
    return {
      status: 'duration_unknown',
      label: 'Duration unknown',
      ownerDurationMs,
      sourceDurationMs,
      alignedSourceEndMs: sourceDurationMs === null ? null : sourceDurationMs + offsetMs,
      durationDifferenceMs: null,
      requiresConfirmation: false,
      blocked: false,
      reason: 'DRMVYZ cannot verify arrangement length from the available metadata. Review the selected tracks and timing offset before extraction.',
    }
  }

  const alignedSourceEndMs = sourceDurationMs + offsetMs
  const durationDifferenceMs = alignedSourceEndMs - ownerDurationMs
  const absoluteDifferenceMs = Math.abs(durationDifferenceMs)
  const compatibleToleranceMs = Math.max(2_000, Math.round(ownerDurationMs * 0.015))
  const minorToleranceMs = Math.max(10_000, Math.round(ownerDurationMs * 0.05))
  const sourceRatio = sourceDurationMs / ownerDurationMs
  const clearlyDifferent = absoluteDifferenceMs > Math.max(120_000, Math.round(ownerDurationMs * 0.4))
    || sourceRatio < 0.35
    || sourceRatio > 1.75

  if (absoluteDifferenceMs <= compatibleToleranceMs) {
    return {
      status: 'compatible',
      label: 'Compatible duration',
      ownerDurationMs,
      sourceDurationMs,
      alignedSourceEndMs,
      durationDifferenceMs,
      requiresConfirmation: false,
      blocked: false,
      reason: 'The durations are close after applying the vocal-reference offset. Duration alone does not guarantee sample-accurate alignment.',
    }
  }

  if (absoluteDifferenceMs <= minorToleranceMs) {
    return {
      status: 'minor_difference',
      label: 'Minor duration difference',
      ownerDurationMs,
      sourceDurationMs,
      alignedSourceEndMs,
      durationDifferenceMs,
      requiresConfirmation: false,
      blocked: false,
      reason: 'The tracks differ slightly in length. Verify the arrangement and offset before relying on word-level alignment.',
    }
  }

  return {
    status: 'significant_mismatch',
    label: 'Significant mismatch',
    ownerDurationMs,
    sourceDurationMs,
    alignedSourceEndMs,
    durationDifferenceMs,
    requiresConfirmation: !clearlyDifferent,
    blocked: clearlyDifferent,
    reason: clearlyDifferent
      ? 'The selected vocal reference appears to be a substantially different arrangement or edit and cannot be used for this extraction.'
      : 'The durations differ enough that explicit confirmation is required before extraction.',
  }
}

function shiftWord(
  word: CanonicalWord,
  offsetMs: number,
  ownerDurationMs: number | null,
): { value: CanonicalWord | null; clamped: boolean } {
  const shiftedStart = word.startMs + offsetMs
  const shiftedEnd = word.endMs + offsetMs
  if (ownerDurationMs !== null && (shiftedEnd <= 0 || shiftedStart >= ownerDurationMs)) return { value: null, clamped: false }

  const startMs = ownerDurationMs === null ? Math.max(0, shiftedStart) : Math.max(0, Math.min(ownerDurationMs, shiftedStart))
  const endMs = ownerDurationMs === null ? Math.max(0, shiftedEnd) : Math.max(0, Math.min(ownerDurationMs, shiftedEnd))
  if (endMs <= startMs) return { value: null, clamped: false }
  const clamped = startMs !== shiftedStart || endMs !== shiftedEnd

  return {
    value: {
      ...word,
      id: `${word.id}-owner-${startMs}-${endMs}`,
      startMs,
      endMs,
      ...(clamped ? { warnings: [...new Set([...(word.warnings ?? []), 'provider_warning'])] } : {}),
      analysisMetadata: {
        ...(word.analysisMetadata ?? {}),
        vocalReferenceSourceStartMs: word.startMs,
        vocalReferenceSourceEndMs: word.endMs,
        vocalReferenceOffsetAppliedMs: offsetMs,
      },
    },
    clamped,
  }
}

function shiftCue(
  cue: CanonicalCue,
  offsetMs: number,
  ownerDurationMs: number | null,
): { value: CanonicalCue | null; clamped: boolean } {
  const shiftedStart = cue.startMs + offsetMs
  const shiftedEnd = cue.endMs + offsetMs
  if (ownerDurationMs !== null && (shiftedEnd <= 0 || shiftedStart >= ownerDurationMs)) return { value: null, clamped: false }

  const startMs = ownerDurationMs === null ? Math.max(0, shiftedStart) : Math.max(0, Math.min(ownerDurationMs, shiftedStart))
  const endMs = ownerDurationMs === null ? Math.max(0, shiftedEnd) : Math.max(0, Math.min(ownerDurationMs, shiftedEnd))
  if (endMs <= startMs) return { value: null, clamped: false }

  const shiftedWords = (cue.words ?? [])
    .map(word => shiftWord(word, offsetMs, ownerDurationMs).value)
    .filter((word): word is CanonicalWord => word !== null)
  const clamped = startMs !== shiftedStart || endMs !== shiftedEnd

  return {
    value: {
      ...cue,
      id: `${cue.id}-owner-${startMs}-${endMs}`,
      startMs,
      endMs,
      ...(shiftedWords.length > 0 ? { words: shiftedWords } : { words: undefined }),
      ...(clamped ? { warnings: [...new Set([...(cue.warnings ?? []), 'provider_warning'])] } : {}),
      analysisMetadata: {
        ...(cue.analysisMetadata ?? {}),
        vocalReferenceSourceStartMs: cue.startMs,
        vocalReferenceSourceEndMs: cue.endMs,
        vocalReferenceOffsetAppliedMs: offsetMs,
      },
    },
    clamped,
  }
}

/**
 * Converts authoritative provider timestamps from the vocal-reference timeline
 * into the canonical full-mix timeline exactly once. Persisted lyrics and later
 * cue reformatting operate only on the returned owner-timeline values.
 */
export function shiftReconciledTranscriptToOwnerTimeline(
  transcript: ReconciledTranscript,
  timingOffsetMs: unknown,
  ownerDurationMsValue: unknown,
): ShiftedTranscriptResult {
  const offsetMs = normalizeVocalReferenceOffsetMs(timingOffsetMs)
  const ownerDurationMs = typeof ownerDurationMsValue === 'number' && Number.isFinite(ownerDurationMsValue) && ownerDurationMsValue > 0
    ? Math.round(ownerDurationMsValue)
    : null
  let clampedWordCount = 0
  let clampedSegmentCount = 0
  let rejectedWordCount = 0
  let rejectedSegmentCount = 0

  const words = transcript.words.flatMap(word => {
    const shifted = shiftWord(word, offsetMs, ownerDurationMs)
    if (!shifted.value) {
      rejectedWordCount += 1
      return []
    }
    if (shifted.clamped) clampedWordCount += 1
    return [shifted.value]
  })

  const segments = transcript.segments.flatMap(segment => {
    const shifted = shiftCue(segment, offsetMs, ownerDurationMs)
    if (!shifted.value) {
      rejectedSegmentCount += 1
      return []
    }
    if (shifted.clamped) clampedSegmentCount += 1
    return [shifted.value]
  })

  const shiftedDuration = transcript.durationMs === null ? null : transcript.durationMs + offsetMs
  const durationMs = shiftedDuration === null
    ? null
    : ownerDurationMs === null
      ? Math.max(0, shiftedDuration)
      : Math.max(0, Math.min(ownerDurationMs, shiftedDuration))
  const warnings = [...new Set([
    ...transcript.warnings,
    ...(clampedWordCount || clampedSegmentCount || rejectedWordCount || rejectedSegmentCount ? ['provider_warning'] : []),
  ])]

  return {
    transcript: {
      ...transcript,
      durationMs,
      words,
      segments,
      warnings,
    },
    offsetMs,
    sourceDurationMs: transcript.durationMs,
    ownerDurationMs,
    clampedWordCount,
    clampedSegmentCount,
    rejectedWordCount,
    rejectedSegmentCount,
  }
}
