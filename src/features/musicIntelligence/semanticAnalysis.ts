// Layer 8: Semantic intelligence.
// Combines energy, rhythm, harmonic, stem, and lyric features to produce
// high-level musical understanding: build/drop/fakeout confidence, mood,
// texture, semantic moment timeline, and visual automation suggestions.

import type {
  MusicIntelligenceFrame,
  MISemantics,
  MoodLabel,
  TextureLabel,
  SemanticMomentMarker,
  TrackIntelligenceAnalysis,
  VisualAutomationSuggestion,
} from './types'
import type { ReactSectionType } from '../../components/vyzualz/react/ReactTypes'
import { EMAFilter } from './featureSmoothing'

// ── Runtime semantic analyzer ─────────────────────────────────────────────────

export class SemanticAnalyzer {
  // Short history for build/drop detection
  private buildEma        = new EMAFilter(0, 0.04)
  private dropEma         = new EMAFilter(0, 0.06)
  private fakeoutEma      = new EMAFilter(0, 0.05)
  private vocalHookEma    = new EMAFilter(0, 0.03)

  private prevEnergy      = 0
  private prevBass        = 0
  private prevFlux        = 0
  private prevBuildConf   = 0

  // Sliding window for build detection (~2 s at 60 fps)
  private energyWindow: number[] = []
  private WINDOW_SIZE = 120

  analyze(frame: MusicIntelligenceFrame): MISemantics {
    const { energy, rhythm, section, harmonic, stems, lyrics } = frame

    // ── Build confidence ────────────────────────────────────────────────────
    // Rising energy + brightness + flux + approaching phrase boundary
    const energyRising = energy.delta > 0.02
    const fluxHigh     = energy.spectralFlux > 0.5
    const buildSection = section.type === 'build' || section.type === 'preDrop'
    const centHigher   = energy.spectralCentroid > 0.55
    const phraseNear   = rhythm.phrase8Progress > 0.85 || rhythm.phrase16Progress > 0.85

    const buildSignal = (
      (energyRising ? 0.30 : 0) +
      (fluxHigh     ? 0.20 : 0) +
      (buildSection ? 0.30 : 0) +
      (centHigher   ? 0.10 : 0) +
      (phraseNear   ? 0.10 : 0)
    )
    const buildConf = this.buildEma.update(buildSignal)

    // ── Drop confidence ─────────────────────────────────────────────────────
    // Sudden energy jump + bass jump + transient + downbeat alignment
    const energyJump   = energy.instant - this.prevEnergy > 0.15
    const bassJump     = frame.bands.bass - this.prevBass > 0.12
    const transient    = rhythm.transient > 0.7
    const dropSection  = section.type === 'drop'
    const downbeatHit  = rhythm.downbeatHit

    const dropSignal = (
      (energyJump   ? 0.25 : 0) +
      (bassJump     ? 0.20 : 0) +
      (transient    ? 0.15 : 0) +
      (dropSection  ? 0.30 : 0) +
      (downbeatHit  ? 0.10 : 0)
    )
    const dropConf = this.dropEma.update(dropSignal)

    // ── Fakeout confidence ──────────────────────────────────────────────────
    // High build → phrase boundary → no drop (energy stays low or drops)
    const highBuildBeforeBoundary = this.prevBuildConf > 0.55 && phraseNear
    const noDropAfterBuild        = highBuildBeforeBoundary && energy.instant < 0.4
    const fakeoutSignal = noDropAfterBuild ? 0.8 : 0
    const fakeoutConf   = this.fakeoutEma.update(fakeoutSignal)

    // ── Vocal hook confidence ────────────────────────────────────────────────
    // Vocal activity + section context + repeated phrase (lyrics if available)
    const hasVocalStem = stems.vocalActivity > 0.4
    const lyricActive  = lyrics.activeLine !== null
    const hookSection  = section.type === 'drop' || section.type === 'verse' || section.type === 'breakdown'

    const hookSignal = (
      (hasVocalStem ? 0.35 : 0) +
      (lyricActive  ? 0.30 : 0) +
      (hookSection  ? 0.20 : 0) +
      (lyrics.phraseConfidence * 0.15)
    )
    const hookConf = this.vocalHookEma.update(hookSignal)

    // ── Mood classification ─────────────────────────────────────────────────
    const mood = classifyMood(frame)

    // ── Texture classification ──────────────────────────────────────────────
    const texture = classifyTexture(frame)

    // ── Update history ──────────────────────────────────────────────────────
    this.prevEnergy    = energy.instant
    this.prevBass      = frame.bands.bass
    this.prevFlux      = energy.spectralFlux
    this.prevBuildConf = buildConf

    this.energyWindow.push(energy.instant)
    if (this.energyWindow.length > this.WINDOW_SIZE) this.energyWindow.shift()

    return {
      buildConfidence:     buildConf,
      dropConfidence:      dropConf,
      fakeoutConfidence:   fakeoutConf,
      vocalHookConfidence: hookConf,
      mood,
      texture,
    }
  }

  reset(): void {
    this.buildEma.reset();    this.dropEma.reset()
    this.fakeoutEma.reset();  this.vocalHookEma.reset()
    this.prevEnergy    = 0;   this.prevBass  = 0
    this.prevFlux      = 0;   this.prevBuildConf = 0
    this.energyWindow  = []
  }
}

// ── Mood classification ────────────────────────────────────────────────────────

function classifyMood(frame: MusicIntelligenceFrame): MoodLabel | null {
  const { energy, harmonic, stems } = frame
  const e = energy.instant
  const centroid  = energy.spectralCentroid
  const flatness  = energy.spectralFlatness
  const mode      = harmonic.mode

  if (e < 0.05) return null  // silence / no signal

  // High energy + dark mode + lots of bass
  if (e > 0.75 && mode === 'minor' && frame.bands.bass > 0.65) return 'aggressive'
  // High energy + bright (high centroid)
  if (e > 0.65 && centroid > 0.6) return 'energetic'
  // High energy, major mode, bright
  if (e > 0.55 && mode === 'major' && centroid > 0.55) return 'euphoric'
  // Chaotic: high flatness + high flux + high centroid
  if (flatness > 0.5 && energy.spectralFlux > 0.65 && centroid > 0.55) return 'chaotic'
  // Dark: minor, low centroid, moderate energy
  if (mode === 'minor' && centroid < 0.45 && e > 0.2) return 'dark'
  // Atmospheric: low flatness, moderate centroid, mid energy
  if (flatness < 0.3 && centroid > 0.4 && centroid < 0.65 && e > 0.15 && e < 0.55) return 'atmospheric'
  // Emotional: minor + vocal activity + moderate energy
  if (mode === 'minor' && stems.vocalActivity > 0.3 && e > 0.2) return 'emotional'
  // Minimal: very low energy and sparse
  if (e < 0.2 && flatness < 0.2) return 'minimal'
  // Calm: low energy, low flatness, any mode
  if (e < 0.35) return 'calm'
  // Bright: major, high centroid
  if (mode === 'major' && centroid > 0.5) return 'bright'
  // Melancholic: minor, slow, moderate vocal
  if (mode === 'minor' && frame.rhythm.bpm < 100) return 'melancholic'

  return 'neutral'
}

// ── Texture classification ────────────────────────────────────────────────────

function classifyTexture(frame: MusicIntelligenceFrame): TextureLabel | null {
  const { energy } = frame
  if (energy.instant < 0.05) return null

  const slope    = energy.delta
  const flatness = energy.spectralFlatness
  const flux     = energy.spectralFlux

  if (slope >  0.03) return 'building'
  if (slope < -0.03) return 'falling'
  if (flatness < 0.2 && flux < 0.2) return 'sparse'
  if (flatness > 0.5 || flux > 0.6)  return 'dense'
  return 'sustained'
}

// ── Offline semantic moment detection ────────────────────────────────────────

export function detectSemanticMoments(
  analysis: TrackIntelligenceAnalysis,
): SemanticMomentMarker[] {
  const moments: SemanticMomentMarker[] = []
  const { sections, energyCurves, spectralCurves } = analysis
  const durationSec = analysis.durationMs / 1000

  // ── Build starts ──────────────────────────────────────────────────────────
  for (const sec of sections) {
    if (sec.type === 'build' || sec.type === 'preDrop') {
      moments.push({
        timeSec:    sec.startSec,
        durationSec: sec.endSec - sec.startSec,
        type:       'build_start',
        confidence: sec.confidence,
        label:      sec.label,
        source:     'heuristic',
      })
    }
  }

  // ── Drops ─────────────────────────────────────────────────────────────────
  for (const sec of sections) {
    if (sec.type === 'drop') {
      moments.push({
        timeSec:    sec.startSec,
        durationSec: sec.endSec - sec.startSec,
        type:       'drop',
        confidence: sec.confidence * (0.7 + sec.intensity * 0.3),
        label:      sec.label,
        source:     'heuristic',
      })
    }
  }

  // ── Breakdowns ────────────────────────────────────────────────────────────
  for (const sec of sections) {
    if (sec.type === 'breakdown') {
      moments.push({
        timeSec:    sec.startSec,
        durationSec: sec.endSec - sec.startSec,
        type:       'breakdown',
        confidence: sec.confidence,
        label:      sec.label,
        source:     'heuristic',
      })
    }
  }

  // ── Fakeouts: build → non-drop ─────────────────────────────────────────────
  for (let i = 1; i < sections.length; i++) {
    const prev = sections[i - 1]
    const curr = sections[i]
    if ((prev.type === 'build' || prev.type === 'preDrop') &&
        curr.type !== 'drop') {
      moments.push({
        timeSec:    curr.startSec,
        type:       'fakeout',
        confidence: 0.55,
        label:      'Fakeout',
        source:     'heuristic',
      })
    }
  }

  // ── High-impact moments: energy curve spikes ──────────────────────────────
  const energyCurve = energyCurves.instant
  if (energyCurve.length > 4) {
    const vals   = energyCurve.map(p => p.value)
    const mean   = vals.reduce((s, v) => s + v, 0) / vals.length
    const thresh = mean * 1.5

    let lastHiImpact = -30
    for (let i = 1; i < energyCurve.length - 1; i++) {
      const pt = energyCurve[i]
      if (pt.value > thresh && pt.timeSec - lastHiImpact > 10) {
        const isLocalPeak =
          pt.value >= (energyCurve[i - 1]?.value ?? 0) &&
          pt.value >= (energyCurve[i + 1]?.value ?? 0)
        if (isLocalPeak) {
          moments.push({
            timeSec:    pt.timeSec,
            type:       'high_impact',
            confidence: Math.min(1, pt.value / thresh - 0.5),
            label:      'High Impact',
            source:     'heuristic',
          })
          lastHiImpact = pt.timeSec
        }
      }
    }
  }

  // ── Calm moments: sustained low energy ───────────────────────────────────
  let calmStart: number | null = null
  const CALM_THRESH = 0.25, MIN_CALM_DUR = 8
  for (let i = 0; i < energyCurve.length; i++) {
    const pt = energyCurve[i]
    if (pt.value < CALM_THRESH) {
      if (calmStart === null) calmStart = pt.timeSec
    } else {
      if (calmStart !== null) {
        const dur = (energyCurve[i - 1]?.timeSec ?? calmStart) - calmStart
        if (dur > MIN_CALM_DUR) {
          moments.push({
            timeSec:    calmStart,
            durationSec: dur,
            type:       'calm_moment',
            confidence: 0.6,
            label:      'Calm Moment',
            source:     'heuristic',
          })
        }
        calmStart = null
      }
    }
  }

  return moments.sort((a, b) => a.timeSec - b.timeSec)
}

// ── Visual automation suggestions ────────────────────────────────────────────

export function suggestVisualAutomation(
  analysis: TrackIntelligenceAnalysis,
): VisualAutomationSuggestion[] {
  const suggestions: VisualAutomationSuggestion[] = []

  // Build a suggestion per section type found in the analysis
  const seenTypes = new Set<ReactSectionType>()
  for (const sec of analysis.sections) {
    if (seenTypes.has(sec.type)) continue
    seenTypes.add(sec.type)
    suggestions.push(suggestionForSection(sec.type, sec.intensity, analysis))
  }

  return suggestions
}

function suggestionForSection(
  type: ReactSectionType,
  intensity: number,
  analysis: TrackIntelligenceAnalysis,
): VisualAutomationSuggestion {
  const mode       = analysis.harmonic.dominantMode
  const isMajor    = mode === 'major'

  switch (type) {
    case 'intro':
      return {
        sectionType: 'intro',
        paramHints:  { intensity: 0.25, motion: 0.2, glow: 0.35, bassReactivity: 0.4, colorShift: 0.2, complexity: 0.3 },
        rationale:   'Soft intro: low intensity and motion with gentle glow to establish mood.',
        confidence:  0.75,
      }
    case 'verse':
      return {
        sectionType: 'verse',
        paramHints:  { intensity: 0.5, motion: 0.4, glow: 0.5, bassReactivity: 0.6, colorShift: isMajor ? 0.3 : 0.5, complexity: 0.5 },
        rationale:   `Verse: moderate energy. ${isMajor ? 'Warm' : 'Cool'} color shift for ${mode ?? 'detected'} key.`,
        confidence:  0.70,
      }
    case 'build':
      return {
        sectionType: 'build',
        paramHints:  { intensity: 0.72, motion: 0.65, glow: 0.7, bassReactivity: 0.75, colorShift: 0.5, complexity: 0.65 },
        rationale:   'Build: progressive intensity increase, rising motion and glow to create anticipation.',
        confidence:  0.80,
      }
    case 'preDrop':
      return {
        sectionType: 'preDrop',
        paramHints:  { intensity: 0.88, motion: 0.80, glow: 0.9, bassReactivity: 0.9, colorShift: 0.6, complexity: 0.75 },
        rationale:   'Pre-drop: near-peak tension, high glow and bass reactivity for maximum build-up.',
        confidence:  0.82,
      }
    case 'drop':
      return {
        sectionType: 'drop',
        paramHints:  { intensity: Math.min(1, intensity * 1.1), motion: 0.95, glow: 1.0, bassReactivity: 1.0, colorShift: 0.75, complexity: 0.85 },
        rationale:   'Drop: maximum intensity and reactivity. Full glow and high bass response.',
        confidence:  0.90,
      }
    case 'breakdown':
      return {
        sectionType: 'breakdown',
        paramHints:  { intensity: 0.45, motion: 0.35, glow: 0.55, bassReactivity: 0.55, colorShift: 0.45, complexity: 0.5 },
        rationale:   'Breakdown: reduced energy, slower motion, atmospheric glow to contrast the drop.',
        confidence:  0.72,
      }
    case 'bridge':
      return {
        sectionType: 'bridge',
        paramHints:  { intensity: 0.52, motion: 0.45, glow: 0.6, bassReactivity: 0.6, colorShift: 0.65, complexity: 0.55 },
        rationale:   'Bridge: distinct color shift and moderate complexity to set it apart from verse/chorus.',
        confidence:  0.65,
      }
    case 'outro':
      return {
        sectionType: 'outro',
        paramHints:  { intensity: 0.25, motion: 0.2, glow: 0.3, bassReactivity: 0.35, colorShift: 0.15, complexity: 0.25 },
        rationale:   'Outro: fade-down intensity and motion, gentle exit.',
        confidence:  0.75,
      }
    default:
      return {
        sectionType: type,
        paramHints:  { intensity: 0.5, motion: 0.5, glow: 0.5, bassReactivity: 0.5, complexity: 0.5 },
        rationale:   'Unknown section type: using neutral defaults.',
        confidence:  0.4,
      }
  }
}

