import type { LyricCue } from '../../../types/lyrics'

// ── Legacy extraction types (preserved for existing JSON import flow) ─────────

export interface LyricExtractionOptions {
  language?:           string
  timingDetail?:       'line' | 'word' | 'line+word'
  stylePreset?:        string
  confidenceThreshold?: number
  globalOffsetMs?:     number
}

export interface ExtractedCue extends LyricCue {
  /** @deprecated Legacy provider payloads should migrate to reviewStatus. */
  reviewed?: boolean
}

export interface LyricExtractionResult {
  title?:         string
  artist?:        string
  sourceType:     'ai_transcription'
  sourceFormat:   'json'
  globalOffsetMs: number
  metadata: {
    model?:            string
    language?:         string
    confidence?:       number
    originalFileName?: string
  }
  cues: ExtractedCue[]
}

// ── Provider-based transcription architecture ─────────────────────────────────

export interface LyricTranscriptionOptions {
  language?:            string
  timingDetail?:        'line' | 'word' | 'line+word'
  confidenceThreshold?: number
}

export interface LyricWordResult {
  text:       string
  startSec:   number
  endSec:     number
  confidence: number
}

export interface LyricLineResult {
  text:       string
  startSec:   number
  endSec:     number
  words:      LyricWordResult[]
  confidence: number
  source:     string
}

export interface LyricTranscriptionResult {
  lines:      LyricLineResult[]
  language:   string | null
  confidence: number
  source:     string
  model?:     string
}

export interface LyricTranscriptionProvider {
  readonly name:        string
  readonly description: string
  isConfigured():       boolean
  transcribe(audioFile: File, options?: LyricTranscriptionOptions): Promise<LyricTranscriptionResult>
}

// ── Provider stubs ────────────────────────────────────────────────────────────

function notConfiguredError(name: string): never {
  throw new Error(
    `${name} provider is not configured. ` +
    'Set the required API key/endpoint in your environment or provider config before calling transcribe().'
  )
}

/** OpenAI Whisper via the openai SDK or a proxy Edge Function. */
export const openAIWhisperProvider: LyricTranscriptionProvider = {
  name:        'OpenAI Whisper',
  description: 'Transcription via OpenAI Whisper API (requires VITE_OPENAI_API_KEY).',
  isConfigured() {
    return !!(import.meta.env?.VITE_OPENAI_API_KEY)
  },
  async transcribe(_file, _options) {
    if (!this.isConfigured()) notConfiguredError(this.name)
    // TODO: POST to https://api.openai.com/v1/audio/transcriptions with model=whisper-1
    // Body: FormData { file, model, response_format: 'verbose_json', timestamp_granularities: ['word'] }
    throw new Error('OpenAI Whisper transcription is not yet implemented.')
  },
}

/** Local or server-hosted Whisper (e.g. Supabase Edge Function wrapping a Python server). */
export const whisperBackendProvider: LyricTranscriptionProvider = {
  name:        'Whisper Backend',
  description: 'Transcription via a self-hosted Whisper endpoint (set VITE_WHISPER_ENDPOINT).',
  isConfigured() {
    return !!(import.meta.env?.VITE_WHISPER_ENDPOINT)
  },
  async transcribe(_file, _options) {
    if (!this.isConfigured()) notConfiguredError(this.name)
    // TODO: POST to VITE_WHISPER_ENDPOINT with audio file
    // Expected JSON response: { segments: [{ text, start, end, words?: [{word, start, end}] }] }
    throw new Error('Whisper backend transcription is not yet implemented.')
  },
}

/** WhisperX (word-level aligned Whisper) — typically served on the same backend. */
export const whisperXProvider: LyricTranscriptionProvider = {
  name:        'WhisperX',
  description: 'Word-level aligned Whisper via WhisperX backend (set VITE_WHISPERX_ENDPOINT).',
  isConfigured() {
    return !!(import.meta.env?.VITE_WHISPERX_ENDPOINT)
  },
  async transcribe(_file, _options) {
    if (!this.isConfigured()) notConfiguredError(this.name)
    throw new Error('WhisperX transcription is not yet implemented.')
  },
}

/** Deepgram speech-to-text API. */
export const deepgramProvider: LyricTranscriptionProvider = {
  name:        'Deepgram',
  description: 'Transcription via Deepgram API (requires VITE_DEEPGRAM_API_KEY).',
  isConfigured() {
    return !!(import.meta.env?.VITE_DEEPGRAM_API_KEY)
  },
  async transcribe(_file, _options) {
    if (!this.isConfigured()) notConfiguredError(this.name)
    // TODO: POST to https://api.deepgram.com/v1/listen?model=nova-2&words=true
    throw new Error('Deepgram transcription is not yet implemented.')
  },
}

/** AssemblyAI speech-to-text API. */
export const assemblyAIProvider: LyricTranscriptionProvider = {
  name:        'AssemblyAI',
  description: 'Transcription via AssemblyAI API (requires VITE_ASSEMBLYAI_API_KEY).',
  isConfigured() {
    return !!(import.meta.env?.VITE_ASSEMBLYAI_API_KEY)
  },
  async transcribe(_file, _options) {
    if (!this.isConfigured()) notConfiguredError(this.name)
    throw new Error('AssemblyAI transcription is not yet implemented.')
  },
}

export const ALL_LYRIC_PROVIDERS: LyricTranscriptionProvider[] = [
  openAIWhisperProvider,
  whisperBackendProvider,
  whisperXProvider,
  deepgramProvider,
  assemblyAIProvider,
]

/** Returns the first configured provider, or null if none are set up. */
export function getConfiguredLyricProvider(): LyricTranscriptionProvider | null {
  return ALL_LYRIC_PROVIDERS.find(p => p.isConfigured()) ?? null
}

// ── Legacy placeholder (preserved for backwards compatibility) ────────────────

/**
 * @deprecated Use a specific LyricTranscriptionProvider instead.
 * Kept to avoid breaking existing callers.
 */
export async function extractLyricsFromAudio(
  _file: File,
  _options: LyricExtractionOptions,
): Promise<LyricExtractionResult> {
  const provider = getConfiguredLyricProvider()
  if (provider) {
    throw new Error(
      `Use provider.transcribe() instead. Configured provider: ${provider.name}. ` +
      'extractLyricsFromAudio() is deprecated.'
    )
  }
  throw new Error(
    'AI lyric extraction is not yet implemented. ' +
    'Connect a backend transcription service (e.g. Whisper via Supabase Edge Function) to enable this feature.'
  )
}

// ── Active lyric tracker (runtime interpolation) ──────────────────────────────

export interface ActiveLyricState {
  activeLine:        string | null
  activeWord:        string | null
  vocalActivity:     number   // 0–1 sustained presence indicator
  phraseConfidence:  number   // 0–1
  lyricLineProgress: number   // 0–1 position within active line
  wordHit:           boolean  // true on the frame a new word starts
}

export class ActiveLyricTracker {
  private lines:             LyricLineResult[] = []
  private prevWordIdx        = -1
  private vocalActivityEma   = 0
  private lastLineIdx        = -1

  setLines(lines: LyricLineResult[]): void {
    this.lines         = [...lines].sort((a, b) => a.startSec - b.startSec)
    this.prevWordIdx   = -1
    this.lastLineIdx   = -1
    this.vocalActivityEma = 0
  }

  update(audioTimeSec: number): ActiveLyricState {
    let activeLine:        string | null = null
    let activeWord:        string | null = null
    let lyricLineProgress  = 0
    let phraseConfidence   = 0
    let wordHit            = false

    const lineIdx = this.findLineAt(audioTimeSec)

    if (lineIdx >= 0) {
      const line         = this.lines[lineIdx]
      activeLine         = line.text
      phraseConfidence   = line.confidence
      lyricLineProgress  = Math.max(0, Math.min(1,
        (audioTimeSec - line.startSec) / (line.endSec - line.startSec + 1e-10),
      ))

      // Find active word
      if (line.words.length > 0) {
        const wordIdx = line.words.findIndex(
          w => audioTimeSec >= w.startSec && audioTimeSec < w.endSec,
        )
        if (wordIdx >= 0) {
          activeWord = line.words[wordIdx].text
          wordHit    = wordIdx !== this.prevWordIdx && wordIdx > this.prevWordIdx
          this.prevWordIdx = wordIdx
        }
      }
    } else {
      this.prevWordIdx = -1
    }

    // Vocal activity EMA: 1 when a line is active, decays otherwise
    const inLine = lineIdx >= 0 ? 1 : 0
    this.vocalActivityEma = 0.05 * inLine + 0.95 * this.vocalActivityEma

    return {
      activeLine,
      activeWord,
      vocalActivity:    Math.min(1, this.vocalActivityEma * 1.5),
      phraseConfidence,
      lyricLineProgress,
      wordHit,
    }
  }

  reset(): void {
    this.prevWordIdx      = -1
    this.lastLineIdx      = -1
    this.vocalActivityEma = 0
  }

  // ── Binary search for active line ─────────────────────────────────────────

  private findLineAt(timeSec: number): number {
    const n = this.lines.length
    if (n === 0) return -1

    let lo = 0, hi = n - 1
    while (lo <= hi) {
      const mid  = (lo + hi) >> 1
      const line = this.lines[mid]
      if (timeSec >= line.startSec && timeSec < line.endSec) return mid
      if (timeSec < line.startSec) hi = mid - 1
      else lo = mid + 1
    }
    return -1
  }
}
