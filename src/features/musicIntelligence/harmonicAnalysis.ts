// Real-time harmonic analysis: chroma extraction, key/mode detection,
// chord detection, pitch tracking, melody contour.
//
// Key detection: Krumhansl-Schmuckler correlation against major/minor profiles.
// Chord detection: chroma thresholding → note names → tonal Chord.detect().
// Pitch detection: pitchy autocorrelation on time-domain buffer.

import { PitchDetector } from 'pitchy'
import { Note, Chord as TonalChord } from 'tonal'
import type { MIHarmonic, MelodyContourLabel } from './types'
import { EMAFilter } from './featureSmoothing'

// ── Constants ─────────────────────────────────────────────────────────────────

// Krumhansl-Schmuckler key-finding profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Key update cadence — update key every N analyze() calls (~30 fps: 90 = ~3s)
const KEY_UPDATE_INTERVAL  = 90
// Chord update cadence — update chord every N calls (~30fps: 6 = ~200ms)
const CHORD_UPDATE_INTERVAL = 6

// Minimum absolute chroma energy to attempt chord/key detection
const MIN_CHROMA_ENERGY = 0.05

// ── Output type ───────────────────────────────────────────────────────────────

export interface HarmonicAnalysisResult extends MIHarmonic {}

// ── Pitch class histogram (for key detection) ────────────────────────────────

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = a.length
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0
  for (let i = 0; i < n; i++) {
    sumA  += a[i]
    sumB  += b[i]
    sumAB += a[i] * b[i]
    sumA2 += a[i] * a[i]
    sumB2 += b[i] * b[i]
  }
  const num = n * sumAB - sumA * sumB
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB))
  return den < 1e-10 ? 0 : num / den
}

function rotateProfile(profile: number[], shift: number): number[] {
  return profile.map((_, i) => profile[(i + 12 - shift) % 12])
}

function estimateKey(
  chromaHistogram: Float32Array,
): { key: string | null; mode: 'major' | 'minor' | null; confidence: number } {
  const vec = Array.from(chromaHistogram)
  const totalEnergy = vec.reduce((s, v) => s + v, 0)
  if (totalEnergy < MIN_CHROMA_ENERGY) return { key: null, mode: null, confidence: 0 }

  let bestScore = -Infinity, bestKey = 0, bestMode: 'major' | 'minor' = 'major'

  for (let k = 0; k < 12; k++) {
    const majScore = pearsonCorrelation(vec, rotateProfile(MAJOR_PROFILE, k))
    const minScore = pearsonCorrelation(vec, rotateProfile(MINOR_PROFILE, k))
    if (majScore > bestScore) { bestScore = majScore; bestKey = k; bestMode = 'major' }
    if (minScore > bestScore) { bestScore = minScore; bestKey = k; bestMode = 'minor' }
  }

  // Confidence: normalize score (Pearson range -1..1) to 0..1
  const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2))
  return {
    key:        confidence > 0.4 ? NOTE_NAMES_SHARP[bestKey] : null,
    mode:       confidence > 0.4 ? bestMode                  : null,
    confidence,
  }
}

// ── Chroma from byte frequency buffer ────────────────────────────────────────

function extractChroma(
  freqBuf: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  fftSize: number,
): Float32Array {
  const chroma = new Float32Array(12)
  const numBins = freqBuf.length

  for (let i = 1; i < numBins; i++) {
    if (freqBuf[i] === 0) continue
    const hz = i * sampleRate / fftSize
    // Limit to musically useful range (50–4000 Hz for chroma)
    if (hz < 50 || hz > 4000) continue
    const midi = 69 + 12 * Math.log2(hz / 440)
    const pc   = ((Math.round(midi) % 12) + 12) % 12
    chroma[pc] += freqBuf[i] / 255
  }

  // Normalize to max
  let maxC = 0
  for (let i = 0; i < 12; i++) if (chroma[i] > maxC) maxC = chroma[i]
  if (maxC > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxC

  return chroma
}

// ── Chord detection from chroma ───────────────────────────────────────────────

function detectChordFromChroma(
  chroma: Float32Array,
): { chord: string | null; confidence: number } {
  const totalEnergy = Array.from(chroma).reduce((s, v) => s + v, 0)
  if (totalEnergy < MIN_CHROMA_ENERGY * 12) return { chord: null, confidence: 0 }

  // Active notes: chroma bins above 60% of max
  const maxC = Math.max(...chroma)
  const threshold = maxC * 0.55
  const activeNotes = NOTE_NAMES_SHARP.filter((_, i) => chroma[i] >= threshold)

  if (activeNotes.length < 2) return { chord: null, confidence: 0 }

  // Use tonal chord detection
  try {
    const detected = TonalChord.detect(activeNotes)
    if (detected.length === 0) return { chord: null, confidence: 0 }
    // First result is typically the best match
    const chord    = detected[0]
    const noteCount = activeNotes.length
    // Confidence heuristic: more notes matched in a recognizable chord → higher confidence
    const confidence = Math.min(0.95, 0.45 + noteCount * 0.12)
    return { chord, confidence }
  } catch {
    return { chord: null, confidence: 0 }
  }
}

// ── Melody contour from pitch history ────────────────────────────────────────

function computeContour(pitchHistory: number[]): MelodyContourLabel {
  const valid = pitchHistory.filter(h => h > 0)
  if (valid.length < 4) return 'flat'

  const half  = Math.floor(valid.length / 2)
  const first = valid.slice(0, half)
  const last  = valid.slice(half)
  const avgFirst = first.reduce((s, v) => s + v, 0) / first.length
  const avgLast  = last.reduce((s, v)  => s + v, 0) / last.length

  const slope  = avgLast - avgFirst
  const spread = Math.max(...valid) - Math.min(...valid)

  if (spread < 30) return 'flat'   // < 30 cents of movement
  if (slope > 50)  return 'ascending'
  if (slope < -50) return 'descending'

  // Check arch shape: middle higher than both ends
  const mid = valid[Math.floor(valid.length / 2)]
  if (mid > avgFirst + 30 && mid > avgLast + 30) return 'arch'
  if (mid < avgFirst - 30 && mid < avgLast  - 30) return 'inverted-arch'

  return spread > 200 ? 'jagged' : 'flat'
}

// ── Main analyzer class ───────────────────────────────────────────────────────

export class HarmonicAnalyzer {
  private detector:        PitchDetector<Float32Array> | null = null
  private detectorBufSize  = 0

  // Rolling chroma for key accumulation
  private chromaHistogram  = new Float32Array(12)
  private chromaDecay      = 0.95   // slow decay of histogram for key context

  // Current smoothed chroma for chord detection
  private smoothedChroma   = new Float32Array(12)
  private readonly CHROMA_ALPHA = 0.3

  private frameCount     = 0
  private lastKey:       string | null = null
  private lastMode:      'major' | 'minor' | null = null
  private lastKeyConf    = 0
  private lastChord:     string | null = null
  private lastChordConf  = 0
  private prevChord:     string | null = null

  // Pitch tracking
  private pitchHistory: number[] = []    // rolling window in Hz (converted to cents)
  private lastPitchHz:  number | null = null
  private lastNote:     string | null = null
  private pitchEma      = new EMAFilter(0, 0.3)
  private lastContour:  MelodyContourLabel | null = null

  analyze(
    freqBuf: Uint8Array<ArrayBuffer>,
    timeBuf: Uint8Array<ArrayBuffer> | null,
    sampleRate: number,
    fftSize:    number,
  ): HarmonicAnalysisResult {
    this.frameCount++

    // ── Chroma extraction ───────────────────────────────────────────────────
    const rawChroma = extractChroma(freqBuf, sampleRate, fftSize)

    // Smooth chroma for chord detection
    for (let i = 0; i < 12; i++) {
      this.smoothedChroma[i] =
        this.CHROMA_ALPHA * rawChroma[i] + (1 - this.CHROMA_ALPHA) * this.smoothedChroma[i]
    }

    // Accumulate into histogram for key detection (with decay)
    for (let i = 0; i < 12; i++) {
      this.chromaHistogram[i] =
        this.chromaDecay * this.chromaHistogram[i] + (1 - this.chromaDecay) * rawChroma[i]
    }

    // ── Key detection (slow update) ─────────────────────────────────────────
    if (this.frameCount % KEY_UPDATE_INTERVAL === 0) {
      const est = estimateKey(this.chromaHistogram)
      if (est.key !== null) {
        this.lastKey    = est.key
        this.lastMode   = est.mode
        this.lastKeyConf = est.confidence
      }
    }

    // ── Chord detection (medium update) ─────────────────────────────────────
    if (this.frameCount % CHORD_UPDATE_INTERVAL === 0) {
      const det       = detectChordFromChroma(this.smoothedChroma)
      this.prevChord  = this.lastChord
      this.lastChord  = det.chord
      this.lastChordConf = det.confidence
    }

    // ── Pitch detection (every frame, from time-domain buffer) ──────────────
    let pitchHz: number | null = null
    let note:    string | null = null

    if (timeBuf !== null) {
      pitchHz = this.detectPitch(timeBuf, sampleRate)
      if (pitchHz !== null) {
        this.lastPitchHz = this.pitchEma.update(pitchHz)
        note             = Note.fromFreq(this.lastPitchHz)
        this.lastNote    = note
        // Track pitch in cents (relative to A4=440) for contour
        const cents = 1200 * Math.log2(this.lastPitchHz / 440)
        this.pitchHistory.push(cents)
        if (this.pitchHistory.length > 60) this.pitchHistory.shift()
      }
    }

    // ── Melody contour ──────────────────────────────────────────────────────
    if (this.frameCount % 10 === 0 && this.pitchHistory.length > 4) {
      this.lastContour = computeContour(this.pitchHistory)
    }

    const chordChanged = this.lastChord !== this.prevChord && this.lastChord !== null

    return {
      key:             this.lastKey,
      mode:            this.lastMode,
      keyConfidence:   this.lastKeyConf,
      chord:           this.lastChord,
      chordConfidence: this.lastChordConf,
      chordChanged,
      rootNote:        this.lastNote,
      pitchHz:         this.lastPitchHz,
      note:            this.lastNote,
      melodyContour:   this.lastContour,
    }
  }

  reset(): void {
    this.chromaHistogram.fill(0)
    this.smoothedChroma.fill(0)
    this.frameCount    = 0
    this.lastKey       = null
    this.lastMode      = null
    this.lastKeyConf   = 0
    this.lastChord     = null
    this.prevChord     = null
    this.lastChordConf = 0
    this.lastPitchHz   = null
    this.lastNote      = null
    this.pitchHistory  = []
    this.lastContour   = null
    this.pitchEma.reset()
  }

  // ── Private: pitch detection from time-domain byte buffer ──────────────────

  private detectPitch(timeBuf: Uint8Array<ArrayBuffer>, sampleRate: number): number | null {
    const N = timeBuf.length
    // Lazy-create or re-create detector if buffer size changed
    if (this.detector === null || this.detectorBufSize !== N) {
      this.detector       = PitchDetector.forFloat32Array(N)
      this.detector.minVolumeDecibels = -40
      this.detectorBufSize = N
    }
    // Convert Uint8Array time domain (0-255, 128=zero) to Float32Array (-1..1)
    const floats = new Float32Array(N)
    for (let i = 0; i < N; i++) floats[i] = (timeBuf[i] - 128) / 128
    const [pitch, clarity] = this.detector.findPitch(floats, sampleRate)
    // Discard low-clarity results and sub-bass / super-treble
    if (clarity < 0.85 || pitch < 50 || pitch > 2000) return null
    return pitch
  }
}
