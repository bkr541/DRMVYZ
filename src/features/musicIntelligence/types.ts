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
}

export type SectionSource = 'manual' | 'analysis' | 'inferred'

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
  rootNote:       string | null   // e.g. 'C4'
  pitchHz:        number | null   // dominant pitch in Hz
  note:           string | null   // nearest note name, e.g. 'A4'
  melodyContour:  MelodyContourLabel | null
}

export interface MIStems {
  vocals:      number  // 0–1 estimated energy
  drums:       number
  bass:        number
  instruments: number
  other:       number
}

export interface MILyrics {
  activeLine:       string | null
  activeWord:       string | null
  vocalActivity:    number  // 0–1
  phraseConfidence: number  // 0–1
}

export type MoodLabel    = 'energetic' | 'dark' | 'euphoric' | 'melancholic' | 'tension' | 'release' | 'neutral'
export type TextureLabel = 'sparse' | 'dense' | 'building' | 'falling' | 'sustained'

export interface MISemantics {
  buildConfidence:      number  // 0–1 confidence this is a build section
  dropConfidence:       number  // 0–1 confidence this is a drop moment
  fakeoutConfidence:    number  // 0–1 confidence this is a false-drop
  vocalHookConfidence:  number  // 0–1 confidence there is a vocal hook
  mood:                 MoodLabel | null
  texture:              TextureLabel | null
}

// ── Core runtime frame ────────────────────────────────────────────────────────

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
  vocals:      FeatureCurve
  drums:       FeatureCurve
  bass:        FeatureCurve
  instruments: FeatureCurve
  other:       FeatureCurve
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
  timeSec:    number
  type:       'build_start' | 'drop' | 'fakeout' | 'vocal_hook' | 'breakdown' | 'release'
  confidence: number
  label?:     string
}

export interface TrackIntelligenceAnalysis {
  analysisVersion: string
  createdAt:       string  // ISO 8601
  durationMs:      number
  bpm:             number
  bpmConfidence:   number
  timeSignature:   number  // beats per bar, typically 4
  beatGrid:        BeatMarkerMI[]
  downbeats:       BeatMarkerMI[]
  phrases:         PhraseMarker[]
  sections:        TrackSectionMI[]
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
  }
  lyrics: {
    lines:      LyricLineMI[]
    language:   string | null
    confidence: number
  } | null
  semanticMoments: SemanticMomentMarker[]
  warnings:        string[]
  errors:          string[]
}

export type AnalysisStatus = 'idle' | 'pending' | 'running' | 'complete' | 'error'
