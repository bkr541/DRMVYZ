// Lyric types for the VYZUALZ timed-lyrics system.
// Runtime model uses camelCase; DB row model uses snake_case to match Supabase.
// Keep in sync with supabase/migrations/0006_lyric_system.sql and later lyric migrations.

// ── Enum / union types ────────────────────────────────────────────────────────

export type LyricDocumentSourceType =
  | 'manual'
  | 'json_import'
  | 'lrc_import'
  | 'enhanced_lrc_import'
  | 'vtt_import'
  | 'ai_transcription'
  | 'api_lookup'

export type LyricDocumentSourceFormat =
  | 'json'
  | 'lrc'
  | 'enhanced_lrc'
  | 'vtt'
  | 'text'

/** Origin of an individual cue or word, independent of document wire format. */
export type LyricSource =
  | 'manual'
  | 'import'
  | 'transcription'
  | 'corrected'
  | 'generated'
  | 'unknown'

export type LyricReviewStatus =
  | 'unreviewed'
  | 'reviewed'
  | 'corrected'
  | 'rejected'

export type LyricWarning =
  | 'low_confidence'
  | 'confidence_clamped'
  | 'invalid_confidence'
  | 'timing_overlap'
  | 'timing_outside_cue'
  | 'missing_word_timing'
  | 'unknown_source'
  | 'unknown_review_status'
  | 'unknown_section_type'
  | 'needs_review'
  | 'provider_warning'
  | 'chunk_boundary_uncertain'
  | 'unknown'

export type LyricSectionType =
  | 'intro'
  | 'verse'
  | 'pre_chorus'
  | 'chorus'
  | 'post_chorus'
  | 'refrain'
  | 'bridge'
  | 'breakdown'
  | 'build'
  | 'drop'
  | 'outro'
  | 'instrumental'
  | 'spoken'
  | 'unknown'

export type LyricAnalysisMetadata = Record<string, unknown>
export type LyricConfidenceStrategy = 'clamp' | 'reject'

/** Canonical persisted lyric timing uses finite integer milliseconds. */
export function toCanonicalLyricMs(value: number, fallback = 0): number {
  const safeFallback = Number.isFinite(fallback) ? Math.round(fallback) : 0
  return Number.isFinite(value) ? Math.round(value) : safeFallback
}

const LYRIC_SOURCES: readonly LyricSource[] = [
  'manual', 'import', 'transcription', 'corrected', 'generated', 'unknown',
]
const LYRIC_REVIEW_STATUSES: readonly LyricReviewStatus[] = [
  'unreviewed', 'reviewed', 'corrected', 'rejected',
]
const LYRIC_WARNINGS: readonly LyricWarning[] = [
  'low_confidence',
  'confidence_clamped',
  'invalid_confidence',
  'timing_overlap',
  'timing_outside_cue',
  'missing_word_timing',
  'unknown_source',
  'unknown_review_status',
  'unknown_section_type',
  'needs_review',
  'provider_warning',
  'chunk_boundary_uncertain',
  'unknown',
]
const LYRIC_SECTION_TYPES: readonly LyricSectionType[] = [
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'post_chorus',
  'refrain',
  'bridge',
  'breakdown',
  'build',
  'drop',
  'outro',
  'instrumental',
  'spoken',
  'unknown',
]
const LYRIC_DOCUMENT_SOURCE_TYPES: readonly LyricDocumentSourceType[] = [
  'manual', 'json_import', 'lrc_import', 'enhanced_lrc_import', 'vtt_import', 'ai_transcription', 'api_lookup',
]
const LYRIC_DOCUMENT_SOURCE_FORMATS: readonly LyricDocumentSourceFormat[] = [
  'json', 'lrc', 'enhanced_lrc', 'vtt', 'text',
]

export function isLyricSource(value: unknown): value is LyricSource {
  return typeof value === 'string' && LYRIC_SOURCES.includes(value as LyricSource)
}

export function isLyricReviewStatus(value: unknown): value is LyricReviewStatus {
  return typeof value === 'string' && LYRIC_REVIEW_STATUSES.includes(value as LyricReviewStatus)
}

export function isLyricWarning(value: unknown): value is LyricWarning {
  return typeof value === 'string' && LYRIC_WARNINGS.includes(value as LyricWarning)
}

export function isLyricSectionType(value: unknown): value is LyricSectionType {
  return typeof value === 'string' && LYRIC_SECTION_TYPES.includes(value as LyricSectionType)
}

export function isLyricDocumentSourceType(value: unknown): value is LyricDocumentSourceType {
  return typeof value === 'string' && LYRIC_DOCUMENT_SOURCE_TYPES.includes(value as LyricDocumentSourceType)
}

export function isLyricDocumentSourceFormat(value: unknown): value is LyricDocumentSourceFormat {
  return typeof value === 'string' && LYRIC_DOCUMENT_SOURCE_FORMATS.includes(value as LyricDocumentSourceFormat)
}

/** Missing confidence remains unknown. Provider values can be clamped or rejected through one shared policy. */
export function normalizeLyricConfidence(
  value: unknown,
  strategy: LyricConfidenceStrategy = 'clamp',
): number | undefined {
  if (value === undefined || value === null) return undefined

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    if (strategy === 'reject') throw new RangeError('Lyric confidence must be a finite number between 0 and 1')
    return undefined
  }

  if (value < 0 || value > 1) {
    if (strategy === 'reject') throw new RangeError(`Lyric confidence ${value} is outside the 0 to 1 range`)
    return Math.min(1, Math.max(0, value))
  }

  return value
}

export function isValidLyricConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export function normalizeLyricSource(value: unknown): LyricSource | undefined {
  if (value === undefined || value === null) return undefined
  return isLyricSource(value) ? value : 'unknown'
}

export function normalizeLyricReviewStatus(value: unknown): LyricReviewStatus | undefined {
  return isLyricReviewStatus(value) ? value : undefined
}

export function normalizeLyricSectionType(value: unknown): LyricSectionType | undefined {
  if (value === undefined || value === null) return undefined
  return isLyricSectionType(value) ? value : 'unknown'
}

export function normalizeLyricWarnings(value: unknown): LyricWarning[] | undefined {
  if (!Array.isArray(value)) return undefined
  const normalized = value.map(warning => isLyricWarning(warning) ? warning : 'unknown')
  const unique = [...new Set(normalized)]
  return unique.length > 0 ? unique : undefined
}

// ── Visual property interfaces ─────────────────────────────────────────────────

export type LyricAnimationName =
  | 'none'
  | 'fade'
  | 'fadeUp'
  | 'fadeDown'
  | 'scale'
  | 'scalePop'
  | 'typewriter'
  | 'glitch'
  | 'glitchOut'
  | 'waveReveal'
  | 'slide'
  | 'blurIn'
  | 'blurOut'

export type LyricEasingName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutCubic'
  | 'easeInCubic'
  | 'easeInOutCubic'

export interface LyricStyle {
  fontFamily:    string
  fontSize:      number
  fontWeight:    number | string
  color:         string
  opacity:       number
  strokeColor:   string
  strokeWidth:   number
  shadowColor:   string
  shadowBlur:    number
  shadowOffsetX: number
  shadowOffsetY: number
  x:             number
  y:             number
  align:         'left' | 'center' | 'right'
  baseline:      CanvasTextBaseline
  maxWidth:      number
  letterSpacing: number
  lineHeight:    number
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  blendMode:     GlobalCompositeOperation
}

export interface LyricAnimation {
  in:        LyricAnimationName
  out:       LyricAnimationName
  inMs:      number
  outMs:     number
  easing:    LyricEasingName
  delayMs:   number
  staggerMs: number
  direction: 'up' | 'down' | 'left' | 'right' | 'center'
  intensity: number
}

export interface LyricEffects {
  glow:          number
  glitch:        number
  rgbSplit:      number
  blur:          number
  noise:         number
  shake:         number
  bassScale:     number
  beatPunch:     number
  opacityPulse:  number
  hueRotate:     number
  chroma:        number
  bloom:         number
  scanlineReact: number
}

// ── Runtime model (camelCase) ─────────────────────────────────────────────────

export interface LyricWord {
  id:         string
  text:       string
  startMs:    number
  endMs:      number
  style?:     Partial<LyricStyle>
  animation?: Partial<LyricAnimation>
  effects?:   Partial<LyricEffects>

  confidence?:                 number
  source?:                     LyricSource
  reviewStatus?:               LyricReviewStatus
  normalizedText?:             string
  originalTranscriptionText?:  string
  warnings?:                   LyricWarning[]
}

export interface LyricGroup {
  id:         string
  wordIds:    string[]
  style?:     Partial<LyricStyle>
  animation?: Partial<LyricAnimation>
  effects?:   Partial<LyricEffects>
}

export interface LyricCue {
  id:         string
  startMs:    number
  endMs:      number
  text:       string
  style?:     Partial<LyricStyle>
  animation?: Partial<LyricAnimation>
  effects?:   Partial<LyricEffects>
  words?:     LyricWord[]
  groups?:    LyricGroup[]

  confidence?:                number
  source?:                    LyricSource
  reviewStatus?:              LyricReviewStatus
  sectionId?:                 string
  sectionType?:               LyricSectionType
  warnings?:                  LyricWarning[]
  analysisMetadata?:          LyricAnalysisMetadata
  originalTranscriptionText?: string
}

export interface LyricDocument {
  id:               string
  userId:           string
  audioTrackId?:    string | null
  visualSessionId?: string | null
  title:            string
  artist:           string
  sourceType:       LyricDocumentSourceType
  sourceFormat:     LyricDocumentSourceFormat
  rawSourceText?:   string | null
  defaultStyle:     Partial<LyricStyle>
  defaultAnimation: Partial<LyricAnimation>
  defaultEffects:   Partial<LyricEffects>
  globalOffsetMs:   number
  isActive:         boolean
  metadata:         Record<string, unknown>
  revision:         number
  createdAt:        string
  updatedAt:        string
}

export type LyricTranscriptionProviderName = 'groq' | 'openai' | 'custom'
export type LyricTranscriptionJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface LyricTranscriptionJob {
  id: string
  userId: string
  audioTrackId: string
  lyricDocumentId: string | null
  provider: LyricTranscriptionProviderName
  status: LyricTranscriptionJobStatus
  progress: number
  errorCode: string | null
  errorMessage: string | null
  providerMetadata: Record<string, unknown>
  requestOptions: Record<string, unknown>
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface LyricTranscriptionJobRow {
  id: string
  user_id: string
  audio_track_id: string
  lyric_document_id: string | null
  provider: LyricTranscriptionProviderName
  status: LyricTranscriptionJobStatus
  progress: number
  error_code: string | null
  error_message: string | null
  provider_metadata: Record<string, unknown>
  request_options: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export type LyricTranscriptionJobInsert = Omit<
  LyricTranscriptionJobRow,
  'id' | 'created_at' | 'updated_at' | 'started_at' | 'completed_at' | 'lyric_document_id' | 'error_code' | 'error_message'
> & Partial<Pick<
  LyricTranscriptionJobRow,
  'lyric_document_id' | 'error_code' | 'error_message' | 'started_at' | 'completed_at'
>>
export type LyricTranscriptionJobUpdate = Partial<Omit<LyricTranscriptionJobRow, 'id' | 'user_id' | 'audio_track_id' | 'created_at'>>

/** Average only known word confidence values. Missing values do not count as zero. */
export function calculateLyricCueConfidence(words?: readonly LyricWord[]): number | undefined {
  if (!words || words.length === 0) return undefined
  const known = words
    .map(word => normalizeLyricConfidence(word.confidence))
    .filter((confidence): confidence is number => confidence !== undefined)
  if (known.length === 0) return undefined
  return known.reduce((sum, confidence) => sum + confidence, 0) / known.length
}

/** Prefer an explicit cue value, otherwise derive it from known word confidence values. */
export function resolveLyricCueConfidence(cue: Pick<LyricCue, 'confidence' | 'words'>): number | undefined {
  return normalizeLyricConfidence(cue.confidence) ?? calculateLyricCueConfidence(cue.words)
}

export function normalizeLyricWordMetadata(
  word: LyricWord,
  inferredSource?: LyricSource,
): LyricWord {
  const {
    confidence: rawConfidence,
    source: rawSource,
    reviewStatus: rawReviewStatus,
    warnings: rawWarnings,
    ...base
  } = word
  const confidence = normalizeLyricConfidence(rawConfidence)
  const source = normalizeLyricSource(rawSource) ?? inferredSource
  const reviewStatus = normalizeLyricReviewStatus(rawReviewStatus)
  const derivedWarnings: LyricWarning[] = []

  if (rawConfidence !== undefined && rawConfidence !== null) {
    if (confidence === undefined) derivedWarnings.push('invalid_confidence')
    else if (confidence !== rawConfidence) derivedWarnings.push('confidence_clamped')
  }
  if (rawSource !== undefined && rawSource !== null && source === 'unknown' && rawSource !== 'unknown') {
    derivedWarnings.push('unknown_source')
  }
  if (rawReviewStatus !== undefined && rawReviewStatus !== null && reviewStatus === undefined) {
    derivedWarnings.push('unknown_review_status')
  }

  const warnings = normalizeLyricWarnings([
    ...(normalizeLyricWarnings(rawWarnings) ?? []),
    ...derivedWarnings,
  ])

  return {
    ...base,
    startMs: toCanonicalLyricMs(base.startMs),
    endMs: toCanonicalLyricMs(base.endMs),
    ...(confidence !== undefined ? { confidence } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(reviewStatus !== undefined ? { reviewStatus } : {}),
    ...(warnings !== undefined ? { warnings } : {}),
  }
}

// ── DB row types (snake_case) ─────────────────────────────────────────────────

export interface LyricDocumentRow {
  id:                string
  user_id:           string
  audio_track_id:    string | null
  visual_session_id: string | null
  title:             string
  artist:            string
  source_type:       LyricDocumentSourceType
  source_format:     LyricDocumentSourceFormat
  raw_source_text:   string | null
  default_style:     Partial<LyricStyle>
  default_animation: Partial<LyricAnimation>
  default_effects:   Partial<LyricEffects>
  global_offset_ms:  number
  is_active:         boolean
  metadata:          Record<string, unknown>
  /** Optional for legacy exports created before migration 0015. */
  revision?:         number
  created_at:        string
  updated_at:        string
}

export interface LyricCueRow {
  id:                string
  lyric_document_id: string
  start_ms:          number
  end_ms:            number
  text:              string
  style:             Partial<LyricStyle>
  animation:         Partial<LyricAnimation>
  effects:           Partial<LyricEffects>
  words:             LyricWord[]
  groups:            LyricGroup[]
  sort_order:        number
  created_at:        string
  updated_at:        string

  // Optional in the TS row shape so legacy fixtures and pre-migration exports still parse.
  confidence?:                 number | null
  source?:                     LyricSource | string | null
  review_status?:              LyricReviewStatus | string | null
  section_id?:                 string | null
  section_type?:               LyricSectionType | string | null
  warnings?:                   LyricWarning[] | string[] | null
  analysis_metadata?:          LyricAnalysisMetadata | null
  original_transcription_text?: string | null
}

// ── Insert / Update DB types ──────────────────────────────────────────────────

export type LyricDocumentInsert = Omit<LyricDocumentRow, 'id' | 'created_at' | 'updated_at' | 'revision'> & {
  revision?: number
}
export type LyricCueInsert      = Omit<LyricCueRow,      'id' | 'created_at' | 'updated_at'>
export type LyricDocumentUpdate = Partial<Omit<LyricDocumentRow, 'id'>>
export type LyricCueUpdate      = Partial<Omit<LyricCueRow,      'id'>>

// ── Application-layer input types ─────────────────────────────────────────────

export interface CreateLyricDocumentInput {
  title:             string
  artist?:           string
  audioTrackId?:     string | null
  visualSessionId?:  string | null
  sourceType?:       LyricDocumentSourceType
  sourceFormat?:     LyricDocumentSourceFormat
  rawSourceText?:    string | null
  defaultStyle?:     Partial<LyricStyle>
  defaultAnimation?: Partial<LyricAnimation>
  defaultEffects?:   Partial<LyricEffects>
  globalOffsetMs?:   number
  metadata?:         Record<string, unknown>
}

export interface CreateLyricCueInput {
  lyricDocumentId: string
  startMs:         number
  endMs:           number
  text:            string
  style?:          Partial<LyricStyle>
  animation?:      Partial<LyricAnimation>
  effects?:        Partial<LyricEffects>
  words?:          LyricWord[]
  groups?:         LyricGroup[]
  sortOrder?:      number

  confidence?:                number
  source?:                    LyricSource
  reviewStatus?:              LyricReviewStatus
  sectionId?:                 string
  sectionType?:               LyricSectionType
  warnings?:                  LyricWarning[]
  analysisMetadata?:          LyricAnalysisMetadata
  originalTranscriptionText?: string
}

export interface UpdateLyricDocumentInput {
  title?:            string
  artist?:           string
  audioTrackId?:     string | null
  visualSessionId?:  string | null
  sourceType?:       LyricDocumentSourceType
  sourceFormat?:     LyricDocumentSourceFormat
  rawSourceText?:    string | null
  defaultStyle?:     Partial<LyricStyle>
  defaultAnimation?: Partial<LyricAnimation>
  defaultEffects?:   Partial<LyricEffects>
  globalOffsetMs?:   number
  isActive?:         boolean
  metadata?:         Record<string, unknown>
}

export interface UpdateLyricCueInput {
  startMs?:   number
  endMs?:     number
  text?:      string
  style?:     Partial<LyricStyle>
  animation?: Partial<LyricAnimation>
  effects?:   Partial<LyricEffects>
  words?:     LyricWord[]
  groups?:    LyricGroup[]
  sortOrder?: number

  confidence?:                number | null
  source?:                    LyricSource | null
  reviewStatus?:              LyricReviewStatus | null
  sectionId?:                 string | null
  sectionType?:               LyricSectionType | null
  warnings?:                  LyricWarning[]
  analysisMetadata?:          LyricAnalysisMetadata
  originalTranscriptionText?: string | null
}

// ── Transactional persistence contracts ──────────────────────────────────────

export interface SaveLyricDocumentAtomicInput {
  documentId?:       string | null
  expectedRevision?: number | null
  document:          CreateLyricDocumentInput
  cues:              CreateLyricCueInput[]
  activate?:          boolean
}

export interface LyricPersistenceSuccess {
  ok:       true
  kind:     'success'
  document: LyricDocument
  cues:     LyricCue[]
}

export interface LyricActivationSuccess {
  ok:       true
  kind:     'success'
  document: LyricDocument
}

export interface LyricValidationFailure {
  ok:      false
  kind:    'validation'
  message: string
  code?:   string
}

export interface LyricConflictFailure {
  ok:               false
  kind:             'conflict'
  message:          string
  currentRevision?: number
}

export interface LyricAuthorizationFailure {
  ok:      false
  kind:    'authorization'
  message: string
}

export interface LyricUnexpectedFailure {
  ok:      false
  kind:    'unexpected'
  message: string
  code?:   string
}

export type LyricPersistenceFailure =
  | LyricValidationFailure
  | LyricConflictFailure
  | LyricAuthorizationFailure
  | LyricUnexpectedFailure

export type SaveLyricDocumentResult = LyricPersistenceSuccess | LyricPersistenceFailure
export type ActivateLyricDocumentResult = LyricActivationSuccess | LyricPersistenceFailure

// ── Mapper functions ──────────────────────────────────────────────────────────

function nonEmptyObject<T extends object>(value: unknown): T | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return Object.keys(value).length > 0 ? value as T : undefined
}

export function mapLyricDocumentRowToDocument(row: LyricDocumentRow): LyricDocument {
  return {
    id:               row.id,
    userId:           row.user_id,
    audioTrackId:     row.audio_track_id,
    visualSessionId:  row.visual_session_id,
    title:            row.title,
    artist:           row.artist,
    sourceType:       row.source_type,
    sourceFormat:     row.source_format,
    rawSourceText:    row.raw_source_text,
    defaultStyle:     row.default_style,
    defaultAnimation: row.default_animation,
    defaultEffects:   row.default_effects,
    globalOffsetMs:   toCanonicalLyricMs(row.global_offset_ms),
    isActive:         row.is_active,
    metadata:         row.metadata,
    revision:         typeof row.revision === 'number' ? row.revision : 1,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

export function mapLyricCueRowToCue(row: LyricCueRow): LyricCue {
  const source = normalizeLyricSource(row.source)
  const reviewStatus = normalizeLyricReviewStatus(row.review_status)
  const sectionType = normalizeLyricSectionType(row.section_type)
  const words = Array.isArray(row.words)
    ? row.words.map(word => normalizeLyricWordMetadata(word, source))
    : []
  const normalizedRowConfidence = normalizeLyricConfidence(row.confidence)
  const confidence = normalizedRowConfidence ?? calculateLyricCueConfidence(words)
  const derivedWarnings: LyricWarning[] = []

  if (row.confidence !== undefined && row.confidence !== null) {
    if (normalizedRowConfidence === undefined) derivedWarnings.push('invalid_confidence')
    else if (normalizedRowConfidence !== row.confidence) derivedWarnings.push('confidence_clamped')
  }
  if (row.source !== undefined && row.source !== null && source === 'unknown' && row.source !== 'unknown') {
    derivedWarnings.push('unknown_source')
  }
  if (row.review_status !== undefined && row.review_status !== null && reviewStatus === undefined) {
    derivedWarnings.push('unknown_review_status')
  }
  if (row.section_type !== undefined && row.section_type !== null && sectionType === 'unknown' && row.section_type !== 'unknown') {
    derivedWarnings.push('unknown_section_type')
  }

  const warnings = normalizeLyricWarnings([
    ...(normalizeLyricWarnings(row.warnings) ?? []),
    ...derivedWarnings,
  ])

  return {
    id:        row.id,
    startMs:   toCanonicalLyricMs(row.start_ms),
    endMs:     toCanonicalLyricMs(row.end_ms),
    text:      row.text,
    style:     nonEmptyObject<Partial<LyricStyle>>(row.style),
    animation: nonEmptyObject<Partial<LyricAnimation>>(row.animation),
    effects:   nonEmptyObject<Partial<LyricEffects>>(row.effects),
    words:     words.length > 0 ? words : undefined,
    groups:    Array.isArray(row.groups) && row.groups.length > 0 ? row.groups : undefined,
    confidence,
    source,
    reviewStatus,
    sectionId: typeof row.section_id === 'string' && row.section_id.length > 0 ? row.section_id : undefined,
    sectionType,
    warnings,
    analysisMetadata: nonEmptyObject<LyricAnalysisMetadata>(row.analysis_metadata),
    originalTranscriptionText:
      typeof row.original_transcription_text === 'string'
        ? row.original_transcription_text
        : undefined,
  }
}

export function createLyricCueInputFromCue(
  cue: LyricCue,
  lyricDocumentId: string,
  sortOrder?: number,
): CreateLyricCueInput {
  return {
    lyricDocumentId,
    startMs: toCanonicalLyricMs(cue.startMs),
    endMs: toCanonicalLyricMs(cue.endMs),
    text: cue.text,
    style: cue.style,
    animation: cue.animation,
    effects: cue.effects,
    words: cue.words?.map(word => normalizeLyricWordMetadata(word, cue.source)),
    groups: cue.groups,
    sortOrder,
    confidence: cue.confidence,
    source: cue.source,
    reviewStatus: cue.reviewStatus,
    sectionId: cue.sectionId,
    sectionType: cue.sectionType,
    warnings: cue.warnings,
    analysisMetadata: cue.analysisMetadata,
    originalTranscriptionText: cue.originalTranscriptionText,
  }
}

export function mapLyricCueToInsert(cue: CreateLyricCueInput): LyricCueInsert {
  const source = normalizeLyricSource(cue.source)
  const words = (cue.words ?? []).map(word => normalizeLyricWordMetadata(word, source))
  const confidence = normalizeLyricConfidence(cue.confidence) ?? calculateLyricCueConfidence(words)

  return {
    lyric_document_id: cue.lyricDocumentId,
    start_ms:          toCanonicalLyricMs(cue.startMs),
    end_ms:            toCanonicalLyricMs(cue.endMs),
    text:              cue.text,
    style:             cue.style      ?? {},
    animation:         cue.animation  ?? {},
    effects:           cue.effects    ?? {},
    words,
    groups:            cue.groups     ?? [],
    sort_order:        cue.sortOrder  ?? 0,
    confidence:        confidence ?? null,
    source:            source ?? null,
    review_status:     normalizeLyricReviewStatus(cue.reviewStatus) ?? null,
    section_id:        cue.sectionId ?? null,
    section_type:      normalizeLyricSectionType(cue.sectionType) ?? null,
    warnings:          normalizeLyricWarnings(cue.warnings) ?? [],
    analysis_metadata: cue.analysisMetadata ?? {},
    original_transcription_text: cue.originalTranscriptionText ?? null,
  }
}
