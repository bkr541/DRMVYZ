import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'
import type { ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'

export type { ReactSectionType, ReactTrackSection }

// ── Sub-object types ──────────────────────────────────────────────────────────

export interface MIBands {
  sub:    number  // 20–60 Hz,    0–1
  bass:   number  // 60–250 Hz,   0–1
  lowMid: number  // 250–1000 Hz, 0–1
  mid:    number  // 1000–4000 Hz,0–1
  high:   number  // 4000–8000 Hz,0–1
  air:    number  // 8000–20 kHz, 0–1
  volume: number  // weighted RMS,0–1
  normalizedSub:    number  // 0–1, band / running max
  normalizedBass:   number
  normalizedLowMid: number
  normalizedMid:    number
  normalizedHigh:   number
  normalizedAir:    number
}

export interface MIRhythm {
  bpm:              number   // detected or set BPM
  bpmConfidence:    number   // 0–1
  beatPhase:        number   // 0–1 within current beat
  beatHit:          boolean  // true on beat boundary this frame
  beatIndex:        number   // monotonically increasing beat count
  beatInBar:        number   // 0–3 (for 4/4 time)
  barIndex:         number   // monotonically increasing bar count
  downbeatHit:      boolean  // beatHit && beatInBar === 0
  phrase4Progress:  number   // 0–1 through 4-beat phrase
  phrase8Progress:  number   // 0–1 through 8-beat phrase
  phrase16Progress: number   // 0–1 through 16-beat phrase
  phrase32Progress: number   // 0–1 through 32-beat phrase
  phrase4Hit:       boolean  // true at phrase-4 boundary
  phrase8Hit:       boolean  // true at phrase-8 boundary
  phrase16Hit:      boolean  // true at phrase-16 boundary
  phrase32Hit:      boolean  // true at phrase-32 boundary
  kickHit:          boolean  // sub-band transient onset
  kickStrength:     number   // 0–1
  snareHit:         boolean  // mid-band transient onset
  snareStrength:    number   // 0–1
  hatHit:           boolean  // high-band transient onset
  hatStrength:      number   // 0–1
  transient:        number   // 0–1 combined onset strength
  transientConfidence: number
}

export interface MIEnergy {
  instant:      number  // current volume
  shortTerm:    number  // ~100 ms EMA
  longTerm:     number  // ~3 s EMA
  peak:         number  // running peak with slow decay
  rms:          number  // root-mean-square from time-domain buffer
  crestFactor:  number  // peak / rms
  spectralFlux: number  // frame-to-frame positive spectral change
  delta:        number  // instant - shortTerm
  percentile:   number  // 0–1, where instant sits in energy history
  buildProgress: number // 0–1, how far energy has risen above long-term avg
  dropImpact:   number  // 0–1, burst magnitude when energy drops below average
  tension:      number  // 0–1, combined spectral flux + energy delta
  complexity:   number  // 0–1, spectral spread measure
  /** Current sample from the offline track energy curve; absent when no curve exists. */
  trackCurve?:   number
  // Meyda spectral features (0–1 normalized; 0 when Meyda is not running)
  spectralCentroid:  number
  spectralSpread:    number
  spectralRolloff:   number
  spectralFlatness:  number
}

export type SectionSource = 'manual' | 'analysis' | 'inferred' | 'rekordbox'

export interface MISection {
  type:       ReactSectionType | null
  label:      string
  startSec:   number
  endSec:     number
  progress:   number   // 0–1 through the section
  intensity:  number   // 0–1
  confidence: number   // 0–1
  source:     SectionSource
}

export type MelodyContourLabel = 'ascending' | 'descending' | 'arch' | 'inverted-arch' | 'flat' | 'jagged'

export interface MIHarmonic {
  key:            string | null   // e.g. 'C', 'F#'
  mode:           'major' | 'minor' | null
  keyConfidence:  number          // 0–1
  chord:          string | null   // e.g. 'Cmaj7', 'Am'
  chordConfidence: number         // 0–1
  chordChanged:   boolean         // true on the frame when chord changes
  rootNote:       string | null   // e.g. 'C4'
  pitchHz:        number | null   // dominant pitch in Hz
  note:           string | null   // nearest note name, e.g. 'A4'
  melodyContour:  MelodyContourLabel | null
}

export interface MIStems {
  // Raw energy (from stem curves when available, else 0)
  vocals:      number  // 0–1
  drums:       number
  bass:        number
  instruments: number
  other:       number
  // Derived runtime values
  vocalEnergy:      number  // alias for vocals, explicit naming
  drumEnergy:       number
  bassStemEnergy:   number
  instrumentEnergy: number
  otherStemEnergy:  number
  vocalActivity:    number  // 0–1 sustained vocal presence indicator
  drumTransient:    boolean // transient detected in drum stem
  bassStemTransient: boolean
}

export interface MILyrics {
  activeLine:        string | null
  activeLineId?:      string | null
  previousLine?:      string | null
  nextLine?:          string | null
  activeWord:        string | null
  activeWordId?:      string | null
  vocalActivity:     number  // 0–1
  phraseConfidence:  number  // 0–1
  lyricLineProgress: number  // 0–1 position within active line
  wordProgress?:      number  // 0–1 position within active word
  wordHit:           boolean // backward-compatible alias for wordEnter
  lineEnter?:         boolean
  lineExit?:          boolean
  isGap?:             boolean
}

export type MoodLabel =
  | 'energetic' | 'aggressive' | 'atmospheric' | 'emotional'
  | 'bright'    | 'dark'       | 'chaotic'     | 'minimal'
  | 'calm'      | 'euphoric'   | 'melancholic'  | 'tension'
  | 'release'   | 'neutral'

export type TextureLabel = 'sparse' | 'dense' | 'building' | 'falling' | 'sustained'

export interface MISemantics {
  buildConfidence:      number  // 0–1 confidence this is a build section
  dropConfidence:       number  // 0–1 confidence this is a drop moment
  fakeoutConfidence:    number  // 0–1 confidence this is a false-drop
  vocalHookConfidence:  number  // 0–1 confidence there is a vocal hook
  mood:                 MoodLabel | null
  texture:              TextureLabel | null
}

// ── Stem curves ───────────────────────────────────────────────────────────────

export interface StemTrackCurves {
  energy:    FeatureCurve
  rms:       FeatureCurve
  transient: FeatureCurve
}

// ── Visual automation suggestion ─────────────────────────────────────────────

export interface VisualAutomationSuggestion {
  sectionType:        ReactSectionType
  suggestedPresetId?: string
  paramHints: {
    intensity?:      number
    motion?:         number
    glow?:           number
    bassReactivity?: number
    colorShift?:     number
    complexity?:     number
  }
  rationale:  string
  confidence: number
}

// ── Core runtime frame ────────────────────────────────────────────────────────


export interface MusicIntelligenceCapabilities {
  /** Live FFT-derived detailed bands are populated for this frame. */
  liveBands: boolean
  /** Live transient/kick/snare detectors are running for this frame. */
  rhythmEvents: boolean
  /** BPM or stored beat markers provide beat/bar/phrase timing. */
  beatGrid: boolean
  /** Manual or analyzed sections exist for the active track. */
  sections: boolean
  /** Offline track energy curves exist for the active track. */
  trackEnergyCurve: boolean
  /** Separated-stem curves exist for the active track. */
  stemCurves: boolean
  /** Timed lyric analysis exists for the active track. */
  lyrics: boolean
}

export interface MusicIntelligenceFrame {
  timeSec:    number        // current audio time in seconds
  frameId:    number        // monotonically increasing; 0 = not yet populated
  sampleRate: number
  sourceId:   string | null // e.g. track file name hash
  trackId:    string | null // e.g. Supabase track ID
  bands:      MIBands
  rhythm:     MIRhythm
  energy:     MIEnergy
  section:    MISection
  harmonic:   MIHarmonic
  stems:      MIStems
  lyrics:     MILyrics
  semantics:  MISemantics
  /** Optional for analyses created before Patch 5; consumers must default false. */
  capabilities?: MusicIntelligenceCapabilities
  raw: {
    freqData:       Uint8Array<ArrayBuffer> | null
    timeDomainData: Uint8Array<ArrayBuffer> | null
  }
  confidence: {
    overall:  number  // 0–1
    rhythm:   number  // 0–1
    harmonic: number  // 0–1
    section:  number  // 0–1
  }
}

// ── Offline / persistent analysis types ──────────────────────────────────────

export interface FeatureCurvePoint {
  timeSec: number
  value:   number
}

export type FeatureCurve = FeatureCurvePoint[]

export interface StemFeatureCurve {
  vocals:      StemTrackCurves
  drums:       StemTrackCurves
  bass:        StemTrackCurves
  instruments: StemTrackCurves
  other:       StemTrackCurves
}

export interface BeatMarkerMI {
  timeSec:    number
  confidence: number
  isDownbeat: boolean
}

export interface PhraseMarker {
  timeSec:      number
  phraseLength: 4 | 8 | 16 | 32
  confidence:   number
}

export interface TrackSectionMI {
  id:         string
  label:      string
  type:       ReactSectionType
  startSec:   number
  endSec:     number
  intensity:  number
  confidence: number
  /** Origin of this section. Optional for backward compat; absent implies 'analysis'. */
  source?: SectionSource
  /** When true this section must not be overwritten by grid rebuilds or auto-reanalysis. */
  locked?: boolean
}

export interface ChordMarker {
  timeSec:     number
  chord:       string
  confidence:  number
  durationSec: number
}

export interface LyricWordMI {
  text:       string
  startMs:    number
  endMs:      number
  confidence: number
}

export interface LyricLineMI {
  text:       string
  startMs:    number
  endMs:      number
  words:      LyricWordMI[]
  confidence: number
}

export interface SemanticMomentMarker {
  timeSec:     number
  durationSec?: number
  type:        'build_start' | 'drop' | 'fakeout' | 'vocal_hook' | 'breakdown' | 'release' | 'high_impact' | 'calm_moment'
  confidence:  number
  label?:      string
  source?:     'heuristic' | 'model' | 'manual'
}

export interface TrackIntelligenceAnalysis {
  analysisVersion:  string
  createdAt:        string  // ISO 8601
  durationMs:       number
  /** null when BPM detection failed; other analysis fields remain valid. */
  bpm:              number | null
  /** null when BPM detection failed. */
  bpmConfidence:    number | null
  /** null when BPM detection failed (offset cannot be determined without BPM). */
  beatGridOffsetSec: number | null
  timeSignature:    number  // beats per bar, typically 4
  beatGrid:         BeatMarkerMI[]
  downbeats:        BeatMarkerMI[]
  phrases:          PhraseMarker[]
  sections:         TrackSectionMI[]
  energyCurves: {
    instant:   FeatureCurve
    shortTerm: FeatureCurve
    bass:      FeatureCurve
    mid:       FeatureCurve
    high:      FeatureCurve
  }
  spectralCurves: {
    centroid:   FeatureCurve
    flux:       FeatureCurve
    complexity: FeatureCurve
  }
  stemCurves:       StemFeatureCurve | null
  harmonic: {
    keyChanges:      Array<{ timeSec: number; key: string; mode: 'major' | 'minor'; confidence: number }>
    chordProgression: ChordMarker[]
    dominantKey:     string | null
    dominantMode:    'major' | 'minor' | null
    keyConfidence:   number  // 0–1, overall key detection confidence
    pitchCurve:      FeatureCurve
    melodyContourCurve: FeatureCurve  // encoded: 0=descending, 0.5=flat, 1=ascending
  }
  lyrics: {
    lines:      LyricLineMI[]
    language:   string | null
    confidence: number
  } | null
  semanticMoments: SemanticMomentMarker[]
  warnings:        string[]
  errors:          string[]

  // ── BPM tracking metadata (optional; absent in analyses created before this field) ──

  /**
   * The BPM as originally detected by the offline analyzer.
   * Equal to `bpm` at analysis time and preserved unchanged when the grid is
   * rebuilt with a manual override BPM.
   */
  detectedBpm?: number | null
  /**
   * Which BPM was used to compute the current beatGrid / downbeats / phrases.
   * Absent on analyses created before this field; treat absence as equal to `bpm`.
   */
  bpmUsedForGrid?: number | null
  /**
   * True when bpmUsedForGrid differs from the currently active effective BPM,
   * meaning beat-indexed data (sections, phrases, energy summaries) may not
   * align with the live grid. Cleared to false after a successful grid rebuild.
   */
  gridStale?: boolean
  /** ISO 8601 timestamp of the last grid-only rebuild. Null on original analyses. */
  lastGridRebuiltAt?: string | null
  /** Distinguishes a full analysis pass from a BPM-triggered grid-only rebuild. */
  lastReanalysisMode?: 'full' | 'grid_only' | null
}

// Status for persistent analysis storage (can be stale)
export type AnalysisStatus = 'not_analyzed' | 'queued' | 'analyzing' | 'complete' | 'failed' | 'stale'

// Status for in-memory track runtime (has 'decoding' step, no 'stale')
export type TrackAnalysisStatus =
  | 'not_analyzed'
  | 'queued'
  | 'decoding'
  | 'analyzing'
  | 'complete'
  | 'failed'

// Mode for a BPM-override reanalysis request
export type BpmReanalysisMode = 'resnap' | 'reanalyze'

// In-flight / last-result status for a BPM-override reanalysis
export type BpmReanalysisStatus = 'idle' | 'reanalyzing' | 'complete' | 'failed' | 'cancelled'
