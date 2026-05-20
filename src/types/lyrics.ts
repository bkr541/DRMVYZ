// Lyric types for the VYZUALZ timed-lyrics system.
// Runtime model uses camelCase; DB row model uses snake_case to match Supabase.
// Keep in sync with supabase/migrations/0006_lyric_system.sql

// ── Enum / union types ────────────────────────────────────────────────────────

export type LyricDocumentSourceType =
  | 'manual'
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

// ── Visual property interfaces ─────────────────────────────────────────────────

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
  createdAt:        string
  updatedAt:        string
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
}

// ── Insert / Update DB types ──────────────────────────────────────────────────

export type LyricDocumentInsert = Omit<LyricDocumentRow, 'id' | 'created_at' | 'updated_at'>
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
}

// ── Mapper functions ──────────────────────────────────────────────────────────

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
    globalOffsetMs:   row.global_offset_ms,
    isActive:         row.is_active,
    metadata:         row.metadata,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

export function mapLyricCueRowToCue(row: LyricCueRow): LyricCue {
  return {
    id:        row.id,
    startMs:   row.start_ms,
    endMs:     row.end_ms,
    text:      row.text,
    style:     Object.keys(row.style).length    > 0 ? row.style    : undefined,
    animation: Object.keys(row.animation).length > 0 ? row.animation : undefined,
    effects:   Object.keys(row.effects).length  > 0 ? row.effects  : undefined,
    words:     row.words.length  > 0 ? row.words  : undefined,
    groups:    row.groups.length > 0 ? row.groups : undefined,
  }
}

export function mapLyricCueToInsert(cue: CreateLyricCueInput): LyricCueInsert {
  return {
    lyric_document_id: cue.lyricDocumentId,
    start_ms:          cue.startMs,
    end_ms:            cue.endMs,
    text:              cue.text,
    style:             cue.style      ?? {},
    animation:         cue.animation  ?? {},
    effects:           cue.effects    ?? {},
    words:             cue.words      ?? [],
    groups:            cue.groups     ?? [],
    sort_order:        cue.sortOrder  ?? 0,
  }
}
