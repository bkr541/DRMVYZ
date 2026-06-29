export const FIVE_MINUTES_MS = 5 * 60 * 1000
export const DEFAULT_LONG_UNIT_MS = 4 * 60 * 1000
export const DEFAULT_OVERLAP_MS = 4_000

export interface TranscriptionUnitPlan {
  index: number
  startMs: number
  endMs: number
  overlapBeforeMs: number
  overlapAfterMs: number
  /** Provider timestamps are normally relative to startMs; absolute providers set this to 0. */
  timestampOffsetMs?: number
}

export interface ProviderWord {
  text: string
  start: number
  end: number
  confidence?: number | null
}

export interface ProviderSegment {
  text: string
  start: number
  end: number
  confidence?: number | null
  words?: ProviderWord[]
}

export interface ProviderTranscript {
  text?: string
  language?: string | null
  duration?: number | null
  words?: ProviderWord[]
  segments?: ProviderSegment[]
  confidence?: number | null
}

export interface CanonicalWord {
  id: string
  text: string
  startMs: number
  endMs: number
  confidence?: number
  source: 'transcription'
  reviewStatus: 'unreviewed'
  normalizedText: string
  originalTranscriptionText: string
  warnings?: string[]
}

export interface CanonicalCue {
  id: string
  startMs: number
  endMs: number
  text: string
  words?: CanonicalWord[]
  confidence?: number
  source: 'transcription'
  reviewStatus: 'unreviewed'
  warnings?: string[]
  analysisMetadata?: Record<string, unknown>
  originalTranscriptionText: string
}

export interface NormalizedTranscriptUnit {
  unit: TranscriptionUnitPlan
  language: string | null
  durationMs: number | null
  rawText: string
  words: CanonicalWord[]
  segments: CanonicalCue[]
  confidence?: number
  warnings: string[]
}

export interface ReconciledTranscript {
  language: string | null
  durationMs: number | null
  rawText: string
  words: CanonicalWord[]
  segments: CanonicalCue[]
  confidence?: number
  warnings: string[]
}

export interface CueGroupingOptions {
  pauseMs?: number
  maxDurationMs?: number
  maxTextLength?: number
  minWordsBeforePunctuationBreak?: number
}

function clamp01(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.min(1, Math.max(0, value))
}

function stableId(prefix: string, index: number, startMs: number, endMs: number): string {
  return `${prefix}-${index}-${startMs}-${endMs}`
}

export function secondsToIntegerMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return Math.max(0, Math.round(value * 1000))
}

export function planTranscriptionUnits(
  durationMs: number,
  options: { maxUnitMs?: number; overlapMs?: number; forceChunking?: boolean } = {},
): TranscriptionUnitPlan[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return []

  const roundedDuration = Math.max(1, Math.round(durationMs))
  const forceChunking = options.forceChunking ?? false
  if (roundedDuration < FIVE_MINUTES_MS || !forceChunking) {
    return [{ index: 0, startMs: 0, endMs: roundedDuration, overlapBeforeMs: 0, overlapAfterMs: 0 }]
  }

  const maxUnitMs = Math.max(30_000, Math.round(options.maxUnitMs ?? DEFAULT_LONG_UNIT_MS))
  const overlapMs = Math.max(0, Math.min(maxUnitMs / 4, Math.round(options.overlapMs ?? DEFAULT_OVERLAP_MS)))
  const stride = Math.max(1, maxUnitMs - overlapMs)
  const units: TranscriptionUnitPlan[] = []

  let startMs = 0
  let index = 0
  while (startMs < roundedDuration) {
    const endMs = Math.min(roundedDuration, startMs + maxUnitMs)
    units.push({
      index,
      startMs,
      endMs,
      overlapBeforeMs: index === 0 ? 0 : overlapMs,
      overlapAfterMs: endMs === roundedDuration ? 0 : overlapMs,
    })
    if (endMs === roundedDuration) break
    startMs += stride
    index += 1
  }

  return units
}

function normalizedToken(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

function cleanText(text: unknown): string {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

function normalizeWord(
  word: ProviderWord,
  offsetMs: number,
  index: number,
  confidenceThreshold: number,
): CanonicalWord | null {
  const text = cleanText(word.text)
  const relativeStartMs = secondsToIntegerMs(word.start)
  const relativeEndMs = secondsToIntegerMs(word.end)
  if (!text || relativeStartMs === null || relativeEndMs === null || relativeEndMs <= relativeStartMs) return null

  const startMs = offsetMs + relativeStartMs
  const endMs = offsetMs + relativeEndMs
  const confidence = clamp01(word.confidence)
  const warnings: string[] = []
  if (confidence !== undefined && confidence < confidenceThreshold) warnings.push('low_confidence')

  return {
    id: stableId('word', index, startMs, endMs),
    text,
    startMs,
    endMs,
    ...(confidence !== undefined ? { confidence } : {}),
    source: 'transcription',
    reviewStatus: 'unreviewed',
    normalizedText: normalizedToken(text),
    originalTranscriptionText: text,
    ...(warnings.length ? { warnings } : {}),
  }
}

function averageConfidence(values: Array<number | undefined>): number | undefined {
  const known = values.filter((value): value is number => value !== undefined)
  if (!known.length) return undefined
  return known.reduce((sum, value) => sum + value, 0) / known.length
}

export function normalizeProviderTranscript(
  transcript: ProviderTranscript,
  unit: TranscriptionUnitPlan,
  confidenceThreshold = 0.6,
): NormalizedTranscriptUnit {
  const safeThreshold = clamp01(confidenceThreshold) ?? 0.6
  const warnings: string[] = []
  const topLevelWords = Array.isArray(transcript.words) ? transcript.words : []
  const segmentWords = Array.isArray(transcript.segments)
    ? transcript.segments.flatMap(segment => Array.isArray(segment.words) ? segment.words : [])
    : []
  const sourceWords = topLevelWords.length > 0 ? topLevelWords : segmentWords
  const timestampOffsetMs = unit.timestampOffsetMs ?? unit.startMs
  const words = sourceWords
    .map((word, index) => normalizeWord(word, timestampOffsetMs, index, safeThreshold))
    .filter((word): word is CanonicalWord => word !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  const segments = (Array.isArray(transcript.segments) ? transcript.segments : [])
    .map((segment, index): CanonicalCue | null => {
      const text = cleanText(segment.text)
      const relativeStartMs = secondsToIntegerMs(segment.start)
      const relativeEndMs = secondsToIntegerMs(segment.end)
      if (!text || relativeStartMs === null || relativeEndMs === null || relativeEndMs <= relativeStartMs) return null
      const startMs = timestampOffsetMs + relativeStartMs
      const endMs = timestampOffsetMs + relativeEndMs
      const segmentWordsInRange = words.filter(word => word.startMs >= startMs - 5 && word.endMs <= endMs + 5)
      const confidence = clamp01(segment.confidence) ?? averageConfidence(segmentWordsInRange.map(word => word.confidence))
      const cueWarnings: string[] = []
      if (confidence !== undefined && confidence < safeThreshold) cueWarnings.push('low_confidence')
      if (segmentWordsInRange.length === 0 && words.length > 0) cueWarnings.push('missing_word_timing')
      return {
        id: stableId('segment', index, startMs, endMs),
        startMs,
        endMs,
        text,
        ...(segmentWordsInRange.length ? { words: segmentWordsInRange } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
        source: 'transcription',
        reviewStatus: 'unreviewed',
        ...(cueWarnings.length ? { warnings: cueWarnings } : {}),
        analysisMetadata: { providerSegment: true, unitIndex: unit.index },
        originalTranscriptionText: text,
      }
    })
    .filter((segment): segment is CanonicalCue => segment !== null)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  if (!words.length && !segments.length) warnings.push('provider_warning')
  const durationMs = secondsToIntegerMs(transcript.duration)
  const confidence = clamp01(transcript.confidence) ?? averageConfidence([
    ...words.map(word => word.confidence),
    ...segments.map(segment => segment.confidence),
  ])

  return {
    unit,
    language: cleanText(transcript.language) || null,
    durationMs,
    rawText: cleanText(transcript.text),
    words,
    segments,
    ...(confidence !== undefined ? { confidence } : {}),
    warnings,
  }
}

function isLikelyDuplicateWord(a: CanonicalWord, b: CanonicalWord, toleranceMs: number): boolean {
  if (!a.normalizedText || a.normalizedText !== b.normalizedText) return false
  const aDuration = Math.max(1, a.endMs - a.startMs)
  const bDuration = Math.max(1, b.endMs - b.startMs)
  const midpointTolerance = Math.min(toleranceMs, Math.max(250, Math.max(aDuration, bDuration) * 1.5))
  const aMidpoint = (a.startMs + a.endMs) / 2
  const bMidpoint = (b.startMs + b.endMs) / 2
  return Math.abs(aMidpoint - bMidpoint) <= midpointTolerance &&
    Math.abs(a.startMs - b.startMs) <= toleranceMs &&
    Math.abs(a.endMs - b.endMs) <= toleranceMs
}

function preferWord(a: CanonicalWord, b: CanonicalWord): CanonicalWord {
  const aConfidence = a.confidence ?? -1
  const bConfidence = b.confidence ?? -1
  return bConfidence > aConfidence ? b : a
}

function isLikelyDuplicateCue(a: CanonicalCue, b: CanonicalCue, toleranceMs: number): boolean {
  return normalizedToken(a.text) === normalizedToken(b.text) &&
    Math.abs(a.startMs - b.startMs) <= toleranceMs &&
    Math.abs(a.endMs - b.endMs) <= toleranceMs
}

export function reconcileTranscriptUnits(
  units: readonly NormalizedTranscriptUnit[],
  toleranceMs = 1_500,
): ReconciledTranscript {
  const sortedUnits = [...units].sort((a, b) => a.unit.index - b.unit.index)
  const words: CanonicalWord[] = []
  const segments: CanonicalCue[] = []
  const warnings = new Set<string>()

  for (const unit of sortedUnits) {
    unit.warnings.forEach(warning => warnings.add(warning))
    const priorWordCount = words.length
    const priorSegmentCount = segments.length
    const canReconcileOverlap = unit.unit.index > 0 && unit.unit.overlapBeforeMs > 0
    const overlapStartMs = unit.unit.startMs - toleranceMs
    const overlapEndMs = unit.unit.startMs + unit.unit.overlapBeforeMs + toleranceMs
    const priorBoundaryWords = canReconcileOverlap
      ? words.slice(0, priorWordCount).filter(word => word.endMs >= overlapStartMs && word.startMs <= overlapEndMs)
      : []
    const currentBoundaryWords = canReconcileOverlap
      ? unit.words.filter(word => word.endMs >= overlapStartMs && word.startMs <= overlapEndMs)
      : []
    let duplicateWordCount = 0
    let duplicateSegmentCount = 0

    for (const word of unit.words) {
      const duplicateIndex = canReconcileOverlap && word.startMs <= overlapEndMs
        ? words.findIndex((existing, index) => index < priorWordCount && isLikelyDuplicateWord(existing, word, toleranceMs))
        : -1
      if (duplicateIndex >= 0) {
        duplicateWordCount += 1
        words[duplicateIndex] = preferWord(words[duplicateIndex], word)
      } else words.push(word)
    }
    for (const segment of unit.segments) {
      const duplicateIndex = canReconcileOverlap && segment.startMs <= overlapEndMs
        ? segments.findIndex((existing, index) => index < priorSegmentCount && isLikelyDuplicateCue(existing, segment, toleranceMs))
        : -1
      if (duplicateIndex >= 0) {
        duplicateSegmentCount += 1
        const current = segments[duplicateIndex]
        if ((segment.confidence ?? -1) > (current.confidence ?? -1)) segments[duplicateIndex] = segment
      } else {
        segments.push(segment)
      }
    }

    const priorBoundarySegments = canReconcileOverlap
      ? segments.slice(0, priorSegmentCount).filter(segment => segment.endMs >= overlapStartMs && segment.startMs <= overlapEndMs)
      : []
    const currentBoundarySegments = canReconcileOverlap
      ? unit.segments.filter(segment => segment.endMs >= overlapStartMs && segment.startMs <= overlapEndMs)
      : []
    const uncertainWords = priorBoundaryWords.length > 0 && currentBoundaryWords.length > 0 && duplicateWordCount === 0
    const uncertainSegments = priorBoundarySegments.length > 0 && currentBoundarySegments.length > 0 && duplicateSegmentCount === 0
    if (uncertainWords || uncertainSegments) warnings.add('chunk_boundary_uncertain')
  }

  words.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  segments.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)

  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1]
    const current = words[index]
    if (current.startMs < previous.endMs - toleranceMs && previous.normalizedText !== current.normalizedText) {
      warnings.add('chunk_boundary_uncertain')
      current.warnings = [...new Set([...(current.warnings ?? []), 'timing_overlap', 'provider_warning'])]
    }
  }

  const language = sortedUnits.map(unit => unit.language).find(Boolean) ?? null
  const durationMs = sortedUnits.reduce<number | null>((max, unit) => {
    const candidate = unit.durationMs === null ? unit.unit.endMs : unit.unit.startMs + unit.durationMs
    return max === null ? candidate : Math.max(max, candidate)
  }, null)
  const confidence = averageConfidence(sortedUnits.map(unit => unit.confidence))

  return {
    language,
    durationMs,
    rawText: sortedUnits.map(unit => unit.rawText).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    words,
    segments,
    ...(confidence !== undefined ? { confidence } : {}),
    warnings: [...warnings],
  }
}

function shouldBreakAtPunctuation(text: string): boolean {
  return /[.!?;:]$/.test(text.trim())
}

function cueFromWords(words: CanonicalWord[], index: number): CanonicalCue {
  const text = words.map(word => word.text).join(' ').replace(/\s+([,.;!?])/g, '$1').trim()
  const warnings = [...new Set(words.flatMap(word => word.warnings ?? []))]
  const confidence = averageConfidence(words.map(word => word.confidence))
  return {
    id: stableId('cue', index, words[0].startMs, words[words.length - 1].endMs),
    startMs: words[0].startMs,
    endMs: words[words.length - 1].endMs,
    text,
    words,
    ...(confidence !== undefined ? { confidence } : {}),
    source: 'transcription',
    reviewStatus: 'unreviewed',
    ...(warnings.length ? { warnings } : {}),
    analysisMetadata: { groupedFromWords: true },
    originalTranscriptionText: text,
  }
}

export function groupWordsIntoReadableCues(
  words: readonly CanonicalWord[],
  options: CueGroupingOptions = {},
): CanonicalCue[] {
  const pauseMs = Math.max(100, options.pauseMs ?? 850)
  const maxDurationMs = Math.max(1_000, options.maxDurationMs ?? 7_000)
  const maxTextLength = Math.max(20, options.maxTextLength ?? 84)
  const minWordsBeforePunctuationBreak = Math.max(1, options.minWordsBeforePunctuationBreak ?? 3)
  const sortedWords = [...words]
    .filter(word => word.endMs > word.startMs && cleanText(word.text))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  if (!sortedWords.length) return []

  const groups: CanonicalWord[][] = []
  let current: CanonicalWord[] = []

  const flush = () => {
    if (current.length) groups.push(current)
    current = []
  }

  for (const word of sortedWords) {
    if (!current.length) {
      current = [word]
      continue
    }

    const previous = current[current.length - 1]
    const candidateText = [...current, word].map(item => item.text).join(' ')
    const longPause = word.startMs - previous.endMs >= pauseMs
    const tooLong = word.endMs - current[0].startMs > maxDurationMs
    const tooMuchText = candidateText.length > maxTextLength
    const punctuationBoundary = current.length >= minWordsBeforePunctuationBreak && shouldBreakAtPunctuation(previous.text)

    if (longPause || tooLong || tooMuchText || punctuationBoundary) flush()
    current.push(word)
  }
  flush()

  return groups.map((group, index) => cueFromWords(group, index))
}

export function selectUsefulCues(transcript: ReconciledTranscript): CanonicalCue[] {
  if (transcript.segments.length > 0) {
    const valid = transcript.segments.filter(segment => segment.endMs > segment.startMs && cleanText(segment.text))
    const monotonic = valid.every((segment, index) => index === 0 || segment.startMs >= valid[index - 1].startMs)
    const readable = valid.every(segment => segment.endMs - segment.startMs <= 12_000 && segment.text.length <= 160)
    const boundariesAreCertain = !transcript.warnings.includes('chunk_boundary_uncertain')
    if (valid.length > 0 && monotonic && readable && boundariesAreCertain) return valid
    if (transcript.words.length === 0 && valid.length > 0) {
      return valid.map(segment => ({
        ...segment,
        warnings: [...new Set([...(segment.warnings ?? []), 'provider_warning'])],
      }))
    }
  }
  return groupWordsIntoReadableCues(transcript.words)
}
