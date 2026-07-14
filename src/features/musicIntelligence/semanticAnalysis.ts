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
  const sections = [...analysis.sections].sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec)
  const bars = [...(analysis.barFeatures ?? [])].sort((a, b) => a.barIndex - b.barIndex)
  const durationSec = analysis.durationMs / 1000

  const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const sample = (curve: Array<{ timeSec: number; value: number }>, timeSec: number): number => {
    if (curve.length === 0) return 0
    if (timeSec <= curve[0]!.timeSec) return curve[0]!.value
    if (timeSec >= curve[curve.length - 1]!.timeSec) return curve[curve.length - 1]!.value
    let low = 0
    let high = curve.length - 1
    while (high - low > 1) {
      const middle = (low + high) >> 1
      if (curve[middle]!.timeSec <= timeSec) low = middle
      else high = middle
    }
    const a = curve[low]!
    const b = curve[high]!
    const ratio = (timeSec - a.timeSec) / Math.max(1e-6, b.timeSec - a.timeSec)
    return a.value + ratio * (b.value - a.value)
  }
  const barAt = (timeSec: number): number | null => {
    const feature = bars.find(bar => timeSec >= bar.startSec - 0.01 && timeSec < bar.endSec - 0.01)
    if (feature) return feature.barIndex
    let resolved: number | null = null
    for (const marker of analysis.downbeats) {
      if (marker.timeSec <= timeSec + 0.05) resolved = marker.barIndex ?? resolved
      else break
    }
    return resolved
  }
  const add = (moment: SemanticMomentMarker) => {
    if (!Number.isFinite(moment.timeSec) || moment.timeSec < 0 || moment.timeSec > durationSec + 0.05) return
    moments.push({
      ...moment,
      id: moment.id ?? `moment-${moment.type}-${moment.relatedSectionId ?? 'track'}-${Math.round(moment.timeSec * 1000)}`,
      barIndex: moment.barIndex ?? barAt(moment.timeSec),
      confidence: Math.round(clamp01(moment.confidence) * 1000) / 1000,
      supportingSignals: (moment.supportingSignals ?? []).filter(Boolean).slice(0, 6),
    })
  }

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index]!
    const previous = sections[index - 1]
    const boundaryConfidence = section.boundaryConfidence ?? section.confidence
    const labelConfidence = section.labelConfidence ?? section.confidence
    const energyBefore = sample(analysis.energyCurves.shortTerm, Math.max(0, section.startSec - 1.5))
    const energyAfter = sample(analysis.energyCurves.shortTerm, Math.min(durationSec, section.startSec + 1.5))
    const bassBefore = sample(analysis.energyCurves.bass, Math.max(0, section.startSec - 1.5))
    const bassAfter = sample(analysis.energyCurves.bass, Math.min(durationSec, section.startSec + 1.5))
    const impactDelta = Math.max(0, energyAfter - energyBefore)
    const bassDelta = Math.max(0, bassAfter - bassBefore)

    add({
      timeSec: section.startSec,
      type: 'section_entry',
      confidence: boundaryConfidence * 0.78 + labelConfidence * 0.22,
      label: `${section.label} entry`,
      source: 'section_context',
      relatedSectionId: section.id,
      supportingSignals: ['section boundary', section.interpretation?.startBoundaryReason ?? 'contextual classification'],
    })

    if (section.endSec < durationSec - 0.02) {
      add({
        timeSec: section.endSec,
        type: 'section_exit',
        confidence: boundaryConfidence,
        label: `${section.label} exit`,
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: ['section boundary', section.interpretation?.endBoundaryReason ?? 'contextual classification'],
      })
    }

    if (section.type === 'build') {
      add({
        timeSec: section.startSec,
        durationSec: section.endSec - section.startSec,
        type: 'build_start',
        confidence: labelConfidence * 0.7 + boundaryConfidence * 0.3,
        label: 'Build start',
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: ['build classification', 'rising transition context'],
      })
    }

    if (section.type === 'preDrop') {
      add({
        timeSec: section.startSec,
        durationSec: section.endSec - section.startSec,
        type: 'pre_drop_start',
        confidence: labelConfidence * 0.72 + boundaryConfidence * 0.28,
        label: 'Pre-Drop start',
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: ['pre-drop classification', 'drop proximity'],
      })
    }

    if (section.type === 'drop') {
      add({
        timeSec: section.startSec,
        durationSec: section.endSec - section.startSec,
        type: 'drop_impact',
        confidence: labelConfidence * 0.48 + boundaryConfidence * 0.22 + impactDelta * 0.17 + bassDelta * 0.13,
        label: 'Drop impact',
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: [
          'drop classification',
          impactDelta >= 0.1 ? 'energy jump' : '',
          bassDelta >= 0.08 ? 'bass jump' : '',
          section.dropConfidence != null ? 'contextual drop anchor' : '',
        ],
      })
    }

    if (section.type === 'breakdown') {
      add({
        timeSec: section.startSec,
        durationSec: section.endSec - section.startSec,
        type: 'breakdown_entry',
        confidence: labelConfidence * 0.7 + boundaryConfidence * 0.3,
        label: 'Breakdown entry',
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: ['breakdown classification', energyAfter < energyBefore ? 'energy reduction' : 'contextual release'],
      })
      if (energyBefore - energyAfter >= 0.08 || previous?.type === 'drop') {
        add({
          timeSec: section.startSec,
          type: 'energy_release',
          confidence: boundaryConfidence * 0.42 + labelConfidence * 0.28 + Math.max(0, energyBefore - energyAfter) * 0.3,
          label: 'Energy release',
          source: 'energy_curve',
          relatedSectionId: section.id,
          supportingSignals: ['sustained energy reduction', previous?.type === 'drop' ? 'drop-to-breakdown transition' : 'section transition'],
        })
      }
    }

    if (previous && (previous.type === 'build' || previous.type === 'preDrop') && section.type !== 'drop') {
      add({
        timeSec: section.startSec,
        type: 'fakeout_candidate',
        confidence: (previous.labelConfidence ?? previous.confidence) * 0.46 + boundaryConfidence * 0.24 + Math.max(0, energyBefore - energyAfter) * 0.3,
        label: 'Fakeout candidate',
        source: 'section_context',
        relatedSectionId: section.id,
        supportingSignals: ['build or pre-drop resolves without a drop', energyAfter <= energyBefore ? 'withheld impact' : 'unexpected continuation'],
      })
    }
  }

  // Silence/stop clusters are derived from bar-level evidence and collapsed to one moment.
  let silenceStart: typeof bars[number] | null = null
  let silenceEnd: typeof bars[number] | null = null
  const flushSilence = () => {
    if (!silenceStart || !silenceEnd) return
    const duration = silenceEnd.endSec - silenceStart.startSec
    add({
      timeSec: silenceStart.startSec,
      durationSec: duration,
      type: 'silence_or_stop',
      confidence: Math.max(silenceStart.silenceRatio, silenceEnd.silenceRatio),
      label: 'Silence or stop',
      source: 'bar_features',
      relatedSectionId: sections.find(section => silenceStart!.startSec >= section.startSec && silenceStart!.startSec < section.endSec)?.id ?? null,
      supportingSignals: ['high silence ratio', duration >= 1 ? 'sustained stop' : 'brief stop'],
    })
    silenceStart = null
    silenceEnd = null
  }
  for (const bar of bars) {
    if (bar.silenceRatio >= 0.72) {
      silenceStart ??= bar
      silenceEnd = bar
    } else {
      flushSilence()
    }
  }
  flushSilence()

  const energyCurve = analysis.energyCurves.instant
  if (energyCurve.length > 4) {
    const values = energyCurve.map(point => point.value)
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const threshold = Math.max(0.45, mean * 1.45)
    let lastImpact = -30
    for (let index = 1; index < energyCurve.length - 1; index++) {
      const point = energyCurve[index]!
      if (point.value < threshold || point.timeSec - lastImpact < 8) continue
      if (point.value < energyCurve[index - 1]!.value || point.value < energyCurve[index + 1]!.value) continue
      add({
        timeSec: point.timeSec,
        type: 'major_impact',
        confidence: clamp01(0.45 + (point.value - threshold) / Math.max(0.2, threshold)),
        label: 'Major impact',
        source: 'energy_curve',
        relatedSectionId: sections.find(section => point.timeSec >= section.startSec && point.timeSec < section.endSec)?.id ?? null,
        supportingSignals: ['local energy peak', 'global impact threshold'],
      })
      lastImpact = point.timeSec
    }
  }

  const group = (type: SemanticMomentMarker['type']) => (
    type === 'drop_impact' || type === 'major_impact' ? 'impact' : type
  )
  const deduped: SemanticMomentMarker[] = []
  for (const moment of moments.sort((a, b) => a.timeSec - b.timeSec || b.confidence - a.confidence)) {
    const duplicateIndex = deduped.findIndex(existing => (
      group(existing.type) === group(moment.type)
      && Math.abs(existing.timeSec - moment.timeSec) <= 0.75
      && (existing.relatedSectionId === moment.relatedSectionId || group(moment.type) === 'impact')
    ))
    if (duplicateIndex < 0) {
      deduped.push(moment)
      continue
    }
    const existing = deduped[duplicateIndex]!
    if (group(moment.type) === 'impact' && (existing.type === 'drop_impact' || moment.type === 'drop_impact')) {
      const preferred = existing.type === 'drop_impact' ? existing : moment
      const secondary = existing.type === 'drop_impact' ? moment : existing
      deduped[duplicateIndex] = {
        ...preferred,
        confidence: Math.max(preferred.confidence, secondary.confidence),
        supportingSignals: [...new Set([
          ...(preferred.supportingSignals ?? []),
          ...(secondary.supportingSignals ?? []),
        ])].slice(0, 6),
      }
    } else if (moment.confidence > existing.confidence) {
      deduped[duplicateIndex] = moment
    }
  }

  return deduped.sort((a, b) => a.timeSec - b.timeSec).slice(0, 128)
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

