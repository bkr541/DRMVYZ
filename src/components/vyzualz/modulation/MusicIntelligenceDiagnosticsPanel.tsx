import { AppIcon } from '../../shared/icons/AppIcon'
// Live Music Intelligence diagnostics panel.
// Uses requestAnimationFrame + direct DOM writes (refs) — zero React re-renders
// after mount so it never pollutes the render budget during playback.

import { useEffect, useRef, useState } from 'react'

import { AudioFeatureBus } from '../../../features/musicIntelligence/AudioFeatureBus'
import type { MusicIntelligenceFrame, TrackIntelligenceAnalysis } from '../../../features/musicIntelligence/types'
import { Collapsible } from '../react/ReactControlRows'

// ── Mini display helpers ──────────────────────────────────────────────────────

interface BarRow {
  label: string
  barEl:  HTMLDivElement | null
  valEl:  HTMLSpanElement | null
  color?: string
}

interface DotRow {
  label: string
  dotEl: HTMLSpanElement | null
  valEl: HTMLSpanElement | null
}

interface TextRow {
  label: string
  valEl: HTMLSpanElement | null
}

const EVENT_MARKER_TYPES = [
  ['build_start', 'Build Start'],
  ['pre_drop_start', 'Pre-drop'],
  ['drop_impact', 'Drop Impact'],
  ['major_impact', 'Major Impact'],
  ['breakdown_entry', 'Breakdown Entry'],
  ['energy_release', 'Energy Release'],
  ['fakeout_candidate', 'Fakeout Candidate'],
  ['silence_or_stop', 'Silence / Stop'],
  ['section_entry', 'Section Entry'],
  ['section_exit', 'Section Exit'],
] as const
const EVENT_MARKER_TYPE_SET = new Set<string>(EVENT_MARKER_TYPES.map(([type]) => type))

// ── Component ─────────────────────────────────────────────────────────────────

export interface MusicIntelligenceDiagnosticsPanelProps {
  liveInputActive?: boolean
  /** Optional content rendered in a collapsible section above Audio Bands. */
  headerRow?: React.ReactNode
  headerRowLabel?: string
  /** Render sections directly without the parent Audio Intelligence disclosure group. */
  ungrouped?: boolean
  /** Offline analysis metadata used by the Beat Grid and Musical Phrases groups. */
  beatGridAnalysis?: TrackIntelligenceAnalysis | null
  /** Whether a BPM override has invalidated the active analyzed grid. */
  beatGridStale?: boolean
}

export function MusicIntelligenceDiagnosticsPanel({ liveInputActive = false, headerRow, headerRowLabel = 'Track', ungrouped = false, beatGridAnalysis = null, beatGridStale = false }: MusicIntelligenceDiagnosticsPanelProps = {}) {
  const animRef = useRef<number>(0)

  // Live Input: compact operator view. Values update through DOM refs so the
  // Analysis surface observes the bus without analyser-rate React renders.
  const liveStatusRef = useRef<HTMLSpanElement | null>(null)
  const liveFrameRef = useRef<HTMLSpanElement | null>(null)
  const liveBpmRef = useRef<HTMLSpanElement | null>(null)
  const liveBpmConfidenceRef = useRef<HTMLSpanElement | null>(null)
  const liveTempoStatusRef = useRef<HTMLSpanElement | null>(null)
  const liveKickCountRef = useRef<HTMLSpanElement | null>(null)
  const liveSnareCountRef = useRef<HTMLSpanElement | null>(null)
  const liveEventDots = useRef<DotRow[]>([
    { label: 'Beat', dotEl: null, valEl: null },
    { label: 'Transient', dotEl: null, valEl: null },
    { label: 'Kick', dotEl: null, valEl: null },
    { label: 'Snare', dotEl: null, valEl: null },
  ])
  const liveMetricBars = useRef<BarRow[]>([
    { label: 'Volume', barEl: null, valEl: null },
    { label: 'Bass', barEl: null, valEl: null },
    { label: 'Mids', barEl: null, valEl: null },
    { label: 'Highs', barEl: null, valEl: null },
    { label: 'Energy', barEl: null, valEl: null },
    { label: 'Spectral Move', barEl: null, valEl: null },
    { label: 'Transient', barEl: null, valEl: null },
    { label: 'Kick', barEl: null, valEl: null },
    { label: 'Snare', barEl: null, valEl: null },
  ])
  const lastLiveEventFrameRef = useRef(0)
  const lastLiveSourceRef = useRef<string | null>(null)
  const liveKickCount = useRef(0)
  const liveSnareCount = useRef(0)

  // Bands
  const bandBars = useRef<BarRow[]>([
    { label: 'Sub',   barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Bass',  barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'LMid',  barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Mid',   barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'High',  barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Air',   barEl: null, valEl: null, color: '#80dfc0' },
  ])
  const normalizedBandBars = useRef<BarRow[]>([
    { label: 'Sub',   barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Bass',  barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'LMid',  barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Mid',   barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'High',  barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Air',   barEl: null, valEl: null, color: '#80dfc0' },
  ])

  // Rhythm
  const bpmRef   = useRef<HTMLSpanElement | null>(null)
  const bpmSourceRef = useRef<HTMLSpanElement | null>(null)
  const beatIndexRef = useRef<HTMLSpanElement | null>(null)
  const beatEventIdRef = useRef<HTMLSpanElement | null>(null)
  const beatEventTimeRef = useRef<HTMLSpanElement | null>(null)
  const rhythmBars = useRef<BarRow[]>([
    { label: 'BPM Confidence',      barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Beat Phase',          barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Phrase 4 Progress',   barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Phrase 8 Progress',   barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Phrase 16 Progress',  barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Phrase 32 Progress',  barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Transient',           barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Kick Strength',       barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Snare Strength',      barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Hat Strength',        barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Transient Confidence',barEl: null, valEl: null, color: '#ffa07a' },
  ])
  const rhythmDots = useRef<DotRow[]>([
    { label: 'Beat',      dotEl: null, valEl: null },
    { label: 'Kick',      dotEl: null, valEl: null },
    { label: 'Snare',     dotEl: null, valEl: null },
    { label: 'Hat',       dotEl: null, valEl: null },
    { label: 'Downbeat',  dotEl: null, valEl: null },
    { label: 'Phrase 4',  dotEl: null, valEl: null },
    { label: 'Phrase 8',  dotEl: null, valEl: null },
    { label: 'Phrase 16', dotEl: null, valEl: null },
    { label: 'Phrase 32', dotEl: null, valEl: null },
  ])
  const beatInBarRef = useRef<HTMLSpanElement | null>(null)
  const barIdxRef    = useRef<HTMLSpanElement | null>(null)

  // Beat Grid
  const beatGridOffsetRef = useRef<HTMLSpanElement | null>(null)
  const beatGridSourceRef = useRef<HTMLSpanElement | null>(null)
  const beatGridAuthorityRef = useRef<HTMLSpanElement | null>(null)
  const downbeatPhaseRef = useRef<HTMLSpanElement | null>(null)
  const beatPeriodRef = useRef<HTMLSpanElement | null>(null)
  const gridFallbackRef = useRef<HTMLSpanElement | null>(null)
  const beatGridStaleRef = useRef<HTMLSpanElement | null>(null)
  const beatGridBars = useRef<BarRow[]>([
    { label: 'Beat Phase Confidence', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Downbeat Phase Confidence', barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Bar Grid Confidence', barEl: null, valEl: null, color: '#7c6fcd' },
  ])

  // Musical Phrases
  const phraseLengthRef = useRef<HTMLSpanElement | null>(null)
  const phraseTimestampRef = useRef<HTMLSpanElement | null>(null)
  const phraseBarIndexRef = useRef<HTMLSpanElement | null>(null)
  const phraseSourceRef = useRef<HTMLSpanElement | null>(null)
  const phraseStructuralRef = useRef<HTMLSpanElement | null>(null)
  const phraseSectionRef = useRef<HTMLSpanElement | null>(null)
  const phraseEvidenceRef = useRef<HTMLSpanElement | null>(null)
  const phraseHierarchyRef = useRef<HTMLSpanElement | null>(null)
  const phraseConfidenceBar = useRef<BarRow>({ label: 'Phrase Confidence', barEl: null, valEl: null, color: '#b84fc9' })

  // Energy
  const energyBars = useRef<BarRow[]>([
    { label: 'Instant',barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Short Term',barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Long Term',barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'RMS',    barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Peak',   barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Crest',  barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Flux',   barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Delta',  barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Percentile',barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Build',  barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Drop',   barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Tension',barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Complexity',barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Track Curve',barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Spectral Centroid',barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Spectral Spread',barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Spectral Rolloff',barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Spectral Flatness',barEl: null, valEl: null, color: '#7c6fcd' },
  ])

  // Measurements
  const measurementBars = useRef<BarRow[]>([
    { label: 'Mean Energy', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Peak Energy', barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Energy Slope', barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Dynamic Range', barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Average Bass', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Average Mid', barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Average High', barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Spectral Flux', barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Spectral Centroid', barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Spectral Complexity', barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Overall Transient Density', barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Low-frequency Onset Density', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Mid-frequency Onset Density', barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'High-frequency Onset Density', barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Silence Ratio', barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Harmonic Change', barEl: null, valEl: null, color: '#ffa07a' },
  ])
  const chromaBars = useRef<BarRow[]>([
    ['C', '#4ac7db'], ['C♯', '#61d6aa'], ['D', '#80dfc0'], ['D♯', '#d8b95a'],
    ['E', '#ffa07a'], ['F', '#b84fc9'], ['F♯', '#7c6fcd'], ['G', '#4ac7db'],
    ['G♯', '#61d6aa'], ['A', '#80dfc0'], ['A♯', '#d8b95a'], ['B', '#b84fc9'],
  ].map(([label, color]) => ({ label, color, barEl: null, valEl: null })))

  // Section
  const sectionTypeRef  = useRef<HTMLSpanElement | null>(null)
  const sectionLabelRef = useRef<HTMLSpanElement | null>(null)
  const sectionStartRef = useRef<HTMLSpanElement | null>(null)
  const sectionEndRef   = useRef<HTMLSpanElement | null>(null)
  const sectionSourceRef = useRef<HTMLSpanElement | null>(null)
  const sectionProgBar  = useRef<BarRow>({ label: 'Progress', barEl: null, valEl: null, color: '#4ac7db' })
  const sectionIntBar   = useRef<BarRow>({ label: 'Intensity', barEl: null, valEl: null, color: '#61d6aa' })
  const sectionConfBar  = useRef<BarRow>({ label: 'Confidence', barEl: null, valEl: null, color: '#b84fc9' })

  // Section & Structure
  const structureFamilyRef = useRef<HTMLSpanElement | null>(null)
  const structureRecurrenceRef = useRef<HTMLSpanElement | null>(null)
  const structureVariationRef = useRef<HTMLSpanElement | null>(null)
  const structureRelationRef = useRef<HTMLSpanElement | null>(null)
  const boundaryCandidateRef = useRef<HTMLSpanElement | null>(null)
  const alternateCandidateRef = useRef<HTMLSpanElement | null>(null)
  const structureBars = useRef<BarRow[]>([
    { label: 'Boundary Confidence', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Label Confidence', barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Drop Confidence', barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Internal Cohesion', barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Region Similarity', barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Candidate Confidence', barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Acoustic Novelty', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Rhythmic Novelty', barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Harmonic Novelty', barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Self-similarity Novelty', barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Energy Transition', barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Silence / Impact', barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Ranked Alternate Confidence', barEl: null, valEl: null, color: '#ff6b6b' },
  ])

  // Event Markers
  const eventMarkerRows = useRef<TextRow[]>(EVENT_MARKER_TYPES.map(([, label]) => ({ label, valEl: null })))
  const focusedEventTypeRef = useRef<HTMLSpanElement | null>(null)
  const focusedEventSourceRef = useRef<HTMLSpanElement | null>(null)
  const focusedEventDurationRef = useRef<HTMLSpanElement | null>(null)
  const focusedEventSectionRef = useRef<HTMLSpanElement | null>(null)
  const focusedEventConfidenceBar = useRef<BarRow>({ label: 'Event Confidence', barEl: null, valEl: null, color: '#ff6b6b' })

  // Harmonic
  const keyModeRef  = useRef<HTMLSpanElement | null>(null)
  const chordRef    = useRef<HTMLSpanElement | null>(null)
  const rootNoteRef = useRef<HTMLSpanElement | null>(null)
  const noteRef     = useRef<HTMLSpanElement | null>(null)
  const pitchRef    = useRef<HTMLSpanElement | null>(null)
  const contourRef  = useRef<HTMLSpanElement | null>(null)
  const keyConfBar  = useRef<BarRow>({ label: 'Key Conf', barEl: null, valEl: null, color: '#7c6fcd' })
  const chordConfBar = useRef<BarRow>({ label: 'Chord Confidence', barEl: null, valEl: null, color: '#61d6aa' })
  const chordChangedDot = useRef<DotRow>({ label: 'Chord Changed', dotEl: null, valEl: null })

  // Stems
  const stemBars = useRef<BarRow[]>([
    { label: 'Vocal',  barEl: null, valEl: null, color: '#b84fc9' },
    { label: 'Drum',   barEl: null, valEl: null, color: '#d8b95a' },
    { label: 'Bass',   barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Instr',  barEl: null, valEl: null, color: '#61d6aa' },
    { label: 'Other',  barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Vocal Act', barEl: null, valEl: null, color: '#ffa07a' },
  ])
  const stemDots = useRef<DotRow[]>([
    { label: 'Drum Transient', dotEl: null, valEl: null },
    { label: 'Bass Transient', dotEl: null, valEl: null },
  ])

  // Lyrics
  const activeLineRef = useRef<HTMLSpanElement | null>(null)
  const activeLineIdRef = useRef<HTMLSpanElement | null>(null)
  const previousLineRef = useRef<HTMLSpanElement | null>(null)
  const nextLineRef = useRef<HTMLSpanElement | null>(null)
  const activeWordRef = useRef<HTMLSpanElement | null>(null)
  const activeWordIdRef = useRef<HTMLSpanElement | null>(null)
  const vocalActBar   = useRef<BarRow>({ label: 'Vocal Act', barEl: null, valEl: null, color: '#b84fc9' })
  const lyricBars = useRef<BarRow[]>([
    { label: 'Phrase Confidence', barEl: null, valEl: null, color: '#7c6fcd' },
    { label: 'Line Progress', barEl: null, valEl: null, color: '#4ac7db' },
    { label: 'Word Progress', barEl: null, valEl: null, color: '#61d6aa' },
  ])
  const lyricDots = useRef<DotRow[]>([
    { label: 'Word Hit', dotEl: null, valEl: null },
    { label: 'Line Enter', dotEl: null, valEl: null },
    { label: 'Line Exit', dotEl: null, valEl: null },
    { label: 'Gap', dotEl: null, valEl: null },
  ])

  // Semantic
  const semanticBars = useRef<BarRow[]>([
    { label: 'Build',  barEl: null, valEl: null, color: '#80dfc0' },
    { label: 'Drop',   barEl: null, valEl: null, color: '#ff6b6b' },
    { label: 'Fakeout',barEl: null, valEl: null, color: '#ffa07a' },
    { label: 'Hook',   barEl: null, valEl: null, color: '#b84fc9' },
  ])
  const moodRef    = useRef<HTMLSpanElement | null>(null)
  const textureRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    function updateBar(row: BarRow, v: number) {
      if (row.barEl) {
        row.barEl.style.width     = `${Math.max(0, Math.min(1, v)) * 100}%`
        row.barEl.style.background = row.color ?? '#4ac7db'
      }
      if (row.valEl) row.valEl.textContent = v.toFixed(2)
    }

    function updateOptionalBar(row: BarRow, v: number | undefined) {
      if (v === undefined || !Number.isFinite(v)) {
        if (row.barEl) {
          row.barEl.style.width = '0%'
          row.barEl.style.background = row.color ?? '#4ac7db'
        }
        if (row.valEl) row.valEl.textContent = '—'
        return
      }
      updateBar(row, v)
    }

    function updateDot(row: DotRow, active: boolean, label?: string) {
      if (row.dotEl) row.dotEl.className = `vz-mi-dot${active ? ' vz-mi-dot--on' : ''}`
      if (row.valEl && label !== undefined) row.valEl.textContent = label
    }

    function tick() {
      const f: MusicIntelligenceFrame = AudioFeatureBus.getFrame()
      const b  = f.bands
      const r  = f.rhythm
      const e  = f.energy
      const sc = f.section
      const h  = f.harmonic
      const st = f.stems
      const ly = f.lyrics
      const sm = f.semantics

      if (liveInputActive) {
        if (lastLiveSourceRef.current !== f.sourceId) {
          lastLiveSourceRef.current = f.sourceId
          lastLiveEventFrameRef.current = 0
          liveKickCount.current = 0
          liveSnareCount.current = 0
        }
        if (f.frameId !== lastLiveEventFrameRef.current) {
          lastLiveEventFrameRef.current = f.frameId
          if (r.kickHit) liveKickCount.current += 1
          if (r.snareHit) liveSnareCount.current += 1
        }
        if (liveStatusRef.current) liveStatusRef.current.textContent = f.frameId > 0 ? 'LIVE' : 'WAITING'
        if (liveFrameRef.current) liveFrameRef.current.textContent = String(f.frameId)
        if (liveBpmRef.current) liveBpmRef.current.textContent = r.bpm > 0 ? r.bpm.toFixed(1) : '—'
        if (liveBpmConfidenceRef.current) liveBpmConfidenceRef.current.textContent = `${Math.round(r.bpmConfidence * 100)}%`
        if (liveTempoStatusRef.current) {
          liveTempoStatusRef.current.textContent = r.bpm <= 0
            ? 'LISTENING'
            : f.capabilities?.beatGrid
              ? 'LOCKED'
              : 'LOW CONF'
        }
        if (liveKickCountRef.current) liveKickCountRef.current.textContent = String(liveKickCount.current)
        if (liveSnareCountRef.current) liveSnareCountRef.current.textContent = String(liveSnareCount.current)
        const mids = (b.lowMid + b.mid) * 0.5
        const highs = (b.high + b.air) * 0.5
        const liveValues = [
          b.volume,
          b.bass,
          mids,
          highs,
          e.instant,
          Math.min(1, e.spectralFlux * 8),
          r.transient,
          r.kickStrength,
          r.snareStrength,
        ]
        liveMetricBars.current.forEach((row, i) => updateBar(row, liveValues[i] ?? 0))
        const liveEvents = [r.beatHit, r.transient > 0.15, r.kickHit, r.snareHit]
        liveEventDots.current.forEach((row, i) => updateDot(row, liveEvents[i] ?? false))
      }

      // Bands
      const bandVals = [b.sub, b.bass, b.lowMid, b.mid, b.high, b.air]
      bandBars.current.forEach((row, i) => updateBar(row, bandVals[i] ?? 0))
      const normalizedBandVals = [
        b.normalizedSub,
        b.normalizedBass,
        b.normalizedLowMid,
        b.normalizedMid,
        b.normalizedHigh,
        b.normalizedAir,
      ]
      normalizedBandBars.current.forEach((row, i) => updateBar(row, normalizedBandVals[i] ?? 0))

      // Rhythm
      if (bpmRef.current)    bpmRef.current.textContent    = r.bpm.toFixed(1)
      if (beatInBarRef.current) beatInBarRef.current.textContent = String(r.beatInBar + 1)
      if (barIdxRef.current)    barIdxRef.current.textContent    = String(r.barIndex)
      if (bpmSourceRef.current) bpmSourceRef.current.textContent = r.bpmSource
        ? r.bpmSource.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : '—'
      if (beatIndexRef.current) beatIndexRef.current.textContent = String(r.beatIndex)
      if (beatEventIdRef.current) beatEventIdRef.current.textContent = r.beatEventId == null ? '—' : String(r.beatEventId)
      if (beatEventTimeRef.current) beatEventTimeRef.current.textContent = r.beatEventTimeSec == null ? '—' : `${r.beatEventTimeSec.toFixed(3)} s`
      const rhythmValues = [
        r.bpmConfidence,
        r.beatPhase,
        r.phrase4Progress,
        r.phrase8Progress,
        r.phrase16Progress,
        r.phrase32Progress,
        r.transient,
        r.kickStrength,
        r.snareStrength,
        r.hatStrength,
        r.transientConfidence,
      ]
      rhythmBars.current.forEach((row, i) => updateBar(row, rhythmValues[i] ?? 0))
      const dotActives = [
        r.beatHit,
        r.kickHit,
        r.snareHit,
        r.hatHit,
        r.downbeatHit,
        r.phrase4Hit,
        r.phrase8Hit,
        r.phrase16Hit,
        r.phrase32Hit,
      ]
      rhythmDots.current.forEach((row, i) => updateDot(row, dotActives[i] ?? false))

      // Beat Grid
      const musicalGrid = beatGridAnalysis?.musicalGrid
      const gridConfidence = musicalGrid?.confidence ?? f.gridConfidence
      if (beatGridOffsetRef.current) {
        const offset = beatGridAnalysis?.beatGridOffsetSec
        beatGridOffsetRef.current.textContent = offset != null ? `${offset.toFixed(3)} s` : '—'
      }
      if (beatGridSourceRef.current) beatGridSourceRef.current.textContent = musicalGrid?.source
        ? musicalGrid.source.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : '—'
      if (beatGridAuthorityRef.current) beatGridAuthorityRef.current.textContent = musicalGrid
        ? musicalGrid.authoritative ? 'Authoritative' : 'Non-authoritative'
        : '—'
      if (downbeatPhaseRef.current) downbeatPhaseRef.current.textContent = musicalGrid?.downbeatPhase != null
        ? String(musicalGrid.downbeatPhase)
        : '—'
      if (beatPeriodRef.current) beatPeriodRef.current.textContent = musicalGrid?.beatPeriodSec != null
        ? `${musicalGrid.beatPeriodSec.toFixed(3)} s`
        : '—'
      if (gridFallbackRef.current) gridFallbackRef.current.textContent = musicalGrid?.fallbackReason
        ? musicalGrid.fallbackReason.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : 'None'
      if (beatGridStaleRef.current) beatGridStaleRef.current.textContent = beatGridStale ? 'Yes' : 'No'
      const beatGridVals = [gridConfidence?.beatPhase, gridConfidence?.downbeatPhase, gridConfidence?.barGrid]
      beatGridBars.current.forEach((row, i) => updateOptionalBar(row, beatGridVals[i]))

      // Musical Phrases
      const phrases = beatGridAnalysis?.phrases ?? f.phraseMarkers ?? []
      let activePhrase: (typeof phrases)[number] | undefined
      for (const phrase of phrases) {
        if (phrase.timeSec <= f.timeSec && (!activePhrase || phrase.timeSec > activePhrase.timeSec)) activePhrase = phrase
      }
      const phraseLength = activePhrase?.lengthBars ?? activePhrase?.phraseLength
      if (phraseLengthRef.current) phraseLengthRef.current.textContent = phraseLength != null ? `${phraseLength} bars` : '—'
      if (phraseTimestampRef.current) phraseTimestampRef.current.textContent = activePhrase ? `${activePhrase.timeSec.toFixed(3)} s` : '—'
      if (phraseBarIndexRef.current) phraseBarIndexRef.current.textContent = activePhrase?.barIndex != null ? String(activePhrase.barIndex) : '—'
      if (phraseSourceRef.current) {
        const source = activePhrase?.source
        phraseSourceRef.current.textContent = source === 'imported'
          ? 'Imported'
          : source === 'repeated_material'
            ? 'Repeated Material'
            : source === 'grid_derived'
              ? 'Grid-derived'
              : source
                ? 'Structural'
                : '—'
      }
      if (phraseStructuralRef.current) phraseStructuralRef.current.textContent = activePhrase
        ? activePhrase.structurallyDetected ? 'Yes' : 'No'
        : '—'
      if (phraseSectionRef.current) phraseSectionRef.current.textContent = activePhrase?.relatedSectionId ?? '—'
      if (phraseEvidenceRef.current) phraseEvidenceRef.current.textContent = activePhrase
        ? activePhrase.supportingSignals?.join(' · ') || activePhrase.reason || '—'
        : '—'
      if (phraseHierarchyRef.current) phraseHierarchyRef.current.textContent = phraseLength != null ? `${phraseLength}-bar` : '—'
      updateOptionalBar(phraseConfidenceBar.current, activePhrase?.confidence)

      // Energy
      const eVals = [
        e.instant,
        e.shortTerm,
        e.longTerm,
        e.rms,
        e.peak,
        Math.min(1, e.crestFactor / 20),
        e.spectralFlux,
        e.delta,
        e.percentile,
        e.buildProgress,
        e.dropImpact,
        e.tension,
        e.complexity,
        e.trackCurve,
        e.spectralCentroid,
        e.spectralSpread,
        e.spectralRolloff,
        e.spectralFlatness,
      ]
      energyBars.current.forEach((row, i) => updateOptionalBar(row, eVals[i]))

      // Measurements
      const barFeatures = beatGridAnalysis?.barFeatures ?? []
      let currentBar = barFeatures.find(bar => f.timeSec >= bar.startSec && f.timeSec < bar.endSec)
      if (!currentBar) {
        for (const bar of barFeatures) {
          if (bar.startSec <= f.timeSec && (!currentBar || bar.startSec > currentBar.startSec)) currentBar = bar
        }
      }
      const measurementVals = currentBar ? [
        currentBar.meanEnergy,
        currentBar.peakEnergy,
        currentBar.energySlope,
        currentBar.dynamicRange,
        currentBar.bassAverage,
        currentBar.midAverage,
        currentBar.highAverage,
        currentBar.spectralFlux,
        currentBar.spectralCentroid,
        currentBar.spectralComplexity,
        currentBar.overallTransientDensity,
        currentBar.lowFrequencyOnsetDensity,
        currentBar.midFrequencyOnsetDensity,
        currentBar.highFrequencyOnsetDensity,
        currentBar.silenceRatio,
        currentBar.harmonicChange,
      ] : []
      measurementBars.current.forEach((row, i) => updateOptionalBar(row, measurementVals[i]))
      chromaBars.current.forEach((row, i) => updateOptionalBar(row, currentBar?.chromaSummary[i]))

      // Section
      if (sectionTypeRef.current) sectionTypeRef.current.textContent = sc.type ?? '—'
      if (sectionLabelRef.current) sectionLabelRef.current.textContent = sc.label || '—'
      if (sectionStartRef.current) sectionStartRef.current.textContent = `${sc.startSec.toFixed(3)} s`
      if (sectionEndRef.current) sectionEndRef.current.textContent = `${sc.endSec.toFixed(3)} s`
      if (sectionSourceRef.current) sectionSourceRef.current.textContent = sc.source
        ? sc.source.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : '—'
      updateBar(sectionProgBar.current, sc.progress)
      updateBar(sectionIntBar.current,  sc.intensity)
      updateBar(sectionConfBar.current, sc.confidence)

      // Section & Structure
      const activeSection = beatGridAnalysis?.sections.find(section => (
        f.timeSec >= section.startSec && f.timeSec < section.endSec
      ))
      const structural = beatGridAnalysis?.structuralSegmentation
      const activeRegion = structural?.regions.find(region => (
        f.timeSec >= region.startSec && f.timeSec < region.endSec
      ))
      const familyId = activeSection?.interpretation?.familyId
      const family = familyId
        ? beatGridAnalysis?.phraseHierarchy?.sectionFamilies.find(item => item.familyId === familyId)
        : undefined
      if (structureFamilyRef.current) structureFamilyRef.current.textContent = familyId ?? '—'
      if (structureRecurrenceRef.current) {
        const occurrence = activeSection?.interpretation?.occurrenceIndex
        const total = family?.occurrenceSectionIds.length
        structureRecurrenceRef.current.textContent = occurrence != null
          ? total != null ? `${occurrence} of ${total}` : String(occurrence)
          : '—'
      }
      if (structureVariationRef.current) structureVariationRef.current.textContent = activeSection
        ? activeSection.interpretation?.isVariation ? 'Yes' : 'No'
        : '—'
      const strongestRelation = activeRegion?.relatedRegions.reduce((best, relation) => (
        !best || relation.similarity > best.similarity ? relation : best
      ), undefined as (typeof activeRegion.relatedRegions)[number] | undefined)
      if (structureRelationRef.current) structureRelationRef.current.textContent = strongestRelation
        ? `${strongestRelation.regionId} · ${strongestRelation.similarity.toFixed(2)}`
        : '—'
      const boundaryTime = activeSection?.startSec ?? f.timeSec
      const boundaryCandidate = structural?.boundaryCandidates.reduce((nearest, candidate) => (
        !nearest || Math.abs(candidate.timeSec - boundaryTime) < Math.abs(nearest.timeSec - boundaryTime)
          ? candidate
          : nearest
      ), undefined as (typeof structural.boundaryCandidates)[number] | undefined)
      const alternateCandidate = beatGridAnalysis?.boundaryAlternatives?.reduce((nearest, candidate) => (
        !nearest || Math.abs(candidate.timeSec - boundaryTime) < Math.abs(nearest.timeSec - boundaryTime)
          ? candidate
          : nearest
      ), undefined as NonNullable<typeof beatGridAnalysis.boundaryAlternatives>[number] | undefined)
      if (boundaryCandidateRef.current) boundaryCandidateRef.current.textContent = boundaryCandidate
        ? `${boundaryCandidate.selected ? 'Selected' : 'Candidate'} · ${boundaryCandidate.timeSec.toFixed(3)} s · Bar ${boundaryCandidate.barIndex ?? '—'}`
        : '—'
      if (alternateCandidateRef.current) alternateCandidateRef.current.textContent = alternateCandidate
        ? `Rank ${alternateCandidate.rank} · ${alternateCandidate.timeSec.toFixed(3)} s · Bar ${alternateCandidate.barIndex ?? '—'}`
        : '—'
      const strongestSimilarity = strongestRelation?.similarity
      const structureVals = [
        activeSection?.boundaryConfidence,
        activeSection?.labelConfidence,
        activeSection?.dropConfidence,
        activeRegion?.internalCohesion,
        strongestSimilarity,
        boundaryCandidate?.candidateConfidence,
        boundaryCandidate?.acousticNovelty,
        boundaryCandidate?.rhythmicNovelty,
        boundaryCandidate?.harmonicNovelty,
        boundaryCandidate?.selfSimilarityNovelty,
        boundaryCandidate?.energyTransitionEvidence,
        boundaryCandidate?.silenceOrImpactEvidence,
        alternateCandidate?.confidence,
      ]
      structureBars.current.forEach((row, i) => updateOptionalBar(row, structureVals[i]))

      // Event Markers
      const semanticMoments = beatGridAnalysis?.semanticMoments ?? f.semanticMoments ?? []
      eventMarkerRows.current.forEach((row, index) => {
        const eventType = EVENT_MARKER_TYPES[index]?.[0]
        const timestamps = eventType
          ? semanticMoments.filter(moment => moment.type === eventType).map(moment => `${moment.timeSec.toFixed(3)} s`)
          : []
        if (row.valEl) row.valEl.textContent = timestamps.length > 0 ? timestamps.join(' · ') : '—'
      })
      const focusedEvent = semanticMoments.reduce((nearest, moment) => (
        EVENT_MARKER_TYPE_SET.has(moment.type)
        && (!nearest || Math.abs(moment.timeSec - f.timeSec) < Math.abs(nearest.timeSec - f.timeSec))
          ? moment
          : nearest
      ), undefined as (typeof semanticMoments)[number] | undefined)
      if (focusedEventTypeRef.current) focusedEventTypeRef.current.textContent = focusedEvent
        ? focusedEvent.type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : '—'
      if (focusedEventSourceRef.current) focusedEventSourceRef.current.textContent = focusedEvent?.source
        ? focusedEvent.source.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
        : '—'
      if (focusedEventDurationRef.current) focusedEventDurationRef.current.textContent = focusedEvent?.durationSec != null
        ? `${focusedEvent.durationSec.toFixed(3)} s`
        : '—'
      if (focusedEventSectionRef.current) focusedEventSectionRef.current.textContent = focusedEvent?.relatedSectionId ?? '—'
      updateOptionalBar(focusedEventConfidenceBar.current, focusedEvent?.confidence)

      // Harmonic
      if (keyModeRef.current) keyModeRef.current.textContent = [h.key, h.mode].filter(Boolean).join(' ') || '—'
      if (chordRef.current)   chordRef.current.textContent   = h.chord  ?? '—'
      if (rootNoteRef.current) rootNoteRef.current.textContent = h.rootNote ?? '—'
      if (noteRef.current) noteRef.current.textContent = h.note ?? '—'
      if (pitchRef.current)   pitchRef.current.textContent   = h.pitchHz != null ? `${h.pitchHz.toFixed(0)} Hz` : '—'
      if (contourRef.current) contourRef.current.textContent = h.melodyContour ?? '—'
      updateBar(keyConfBar.current, h.keyConfidence)
      updateBar(chordConfBar.current, h.chordConfidence)
      updateDot(chordChangedDot.current, h.chordChanged)

      // Stems
      const stemVals = [st.vocalEnergy, st.drumEnergy, st.bassStemEnergy, st.instrumentEnergy, st.otherStemEnergy, st.vocalActivity]
      stemBars.current.forEach((row, i) => updateBar(row, stemVals[i] ?? 0))
      const stemDotActives = [st.drumTransient, st.bassStemTransient]
      stemDots.current.forEach((row, i) => updateDot(row, stemDotActives[i] ?? false))

      // Lyrics
      if (activeLineRef.current) activeLineRef.current.textContent = ly.activeLine ?? '—'
      if (activeLineIdRef.current) activeLineIdRef.current.textContent = ly.activeLineId ?? '—'
      if (previousLineRef.current) previousLineRef.current.textContent = ly.previousLine ?? '—'
      if (nextLineRef.current) nextLineRef.current.textContent = ly.nextLine ?? '—'
      if (activeWordRef.current) activeWordRef.current.textContent = ly.activeWord  ?? '—'
      if (activeWordIdRef.current) activeWordIdRef.current.textContent = ly.activeWordId ?? '—'
      updateBar(vocalActBar.current, ly.vocalActivity)
      const lyricVals = [ly.phraseConfidence, ly.lyricLineProgress, ly.wordProgress]
      lyricBars.current.forEach((row, i) => updateOptionalBar(row, lyricVals[i]))
      const lyricDotActives = [ly.wordHit, ly.lineEnter, ly.lineExit, ly.isGap]
      lyricDots.current.forEach((row, i) => updateDot(row, lyricDotActives[i] ?? false))

      // Semantic
      const smVals = [sm.buildConfidence, sm.dropConfidence, sm.fakeoutConfidence, sm.vocalHookConfidence]
      semanticBars.current.forEach((row, i) => updateBar(row, smVals[i] ?? 0))
      if (moodRef.current)    moodRef.current.textContent    = sm.mood    ?? '—'
      if (textureRef.current) textureRef.current.textContent = sm.texture ?? '—'

      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [beatGridAnalysis, beatGridStale, liveInputActive])

  // ── Ref setters ─────────────────────────────────────────────────────────────

  function barRowRefs(row: BarRow) {
    return {
      barRef: (el: HTMLDivElement | null) => { row.barEl = el },
      valRef: (el: HTMLSpanElement | null) => { row.valEl = el },
    }
  }
  function dotRowRefs(row: DotRow) {
    return {
      dotRef: (el: HTMLSpanElement | null) => { row.dotEl = el },
      valRef: (el: HTMLSpanElement | null) => { row.valEl = el },
    }
  }

  const content = (
    <>
        {headerRow && <MiSection title={headerRowLabel}>{headerRow}</MiSection>}
        {liveInputActive && (
          <MiSection title="Live Input">
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">Capture</span>
              <span ref={liveStatusRef} className="vz-mi-kv-val vz-mi-kv-val--tag">WAITING</span>
              <span className="vz-mi-kv-label">Frame</span>
              <span ref={liveFrameRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">BPM</span>
              <span ref={liveBpmRef} className="vz-mi-kv-val">—</span>
              <span className="vz-mi-kv-label">Confidence</span>
              <span ref={liveBpmConfidenceRef} className="vz-mi-kv-val">0%</span>
              <span className="vz-mi-kv-label">Tempo</span>
              <span ref={liveTempoStatusRef} className="vz-mi-kv-val vz-mi-kv-val--tag">LISTENING</span>
            </div>
            {liveMetricBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
            <div className="vz-mi-dots-row">
              {liveEventDots.current.map(row => {
                const refs = dotRowRefs(row)
                return (
                  <div key={row.label} className="vz-mi-dot-item">
                    <span ref={refs.dotRef} className="vz-mi-dot" />
                    <span className="vz-mi-dot-label">{row.label}</span>
                  </div>
                )
              })}
            </div>
            <div className="vz-mi-kv-row">
              <span className="vz-mi-kv-label">Kick events</span>
              <span ref={liveKickCountRef} className="vz-mi-kv-val">0</span>
              <span className="vz-mi-kv-label">Snare events</span>
              <span ref={liveSnareCountRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-kv-row" data-live-input-structural-status="unavailable">
              <span className="vz-mi-kv-label">Track structure</span>
              <span className="vz-mi-kv-val vz-mi-kv-val--tag">UNAVAILABLE</span>
            </div>
            <p className="vz-mi-note">Sections, builds, drops, phrases, lyrics, and loaded-track timeline intelligence are not fabricated for Live Input.</p>
          </MiSection>
        )}
        {!liveInputActive && <>
        {/* ── Bands ────────────────────────────────────────────────────────── */}
        <MiSection title="Audio Bands">
          <div className="vz-mi-bar-group">
            {bandBars.current.map(row => {
              const r = barRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-bar-col">
                  <span ref={r.valRef} className="vz-mi-bar-val">0.00</span>
                  <div className="vz-mi-bar-track">
                    <div ref={r.barRef} className="vz-mi-bar-fill" />
                  </div>
                  <span className="vz-mi-bar-lbl">{row.label}</span>
                </div>
              )
            })}
          </div>
          <div className="vz-mi-band-subtitle">Normalized</div>
          <div className="vz-mi-bar-group">
            {normalizedBandBars.current.map(row => {
              const r = barRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-bar-col">
                  <span ref={r.valRef} className="vz-mi-bar-val">0.00</span>
                  <div className="vz-mi-bar-track">
                    <div ref={r.barRef} className="vz-mi-bar-fill" />
                  </div>
                  <span className="vz-mi-bar-lbl">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Rhythm ───────────────────────────────────────────────────────── */}
        <MiSection title="Rhythm">
          <div className="vz-mi-rhythm-grid">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">BPM</span>
              <span ref={bpmRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Beat</span>
              <span ref={beatInBarRef} className="vz-mi-kv-val">1</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Bar</span>
              <span ref={barIdxRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">BPM Source</span>
              <span ref={bpmSourceRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Beat Index</span>
              <span ref={beatIndexRef} className="vz-mi-kv-val">0</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Beat Event ID</span>
              <span ref={beatEventIdRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Beat Event Time</span>
              <span ref={beatEventTimeRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <div className="vz-mi-rhythm-bars">
            {rhythmBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
          <div className="vz-mi-dots-row vz-mi-rhythm-events">
            {rhythmDots.current.map(row => {
              const r = dotRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-dot-item">
                  <span ref={r.dotRef} className="vz-mi-dot" />
                  <span className="vz-mi-dot-label">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Beat Grid ─────────────────────────────────────────────────────── */}
        <MiSection title="Beat Grid">
          <div className="vz-mi-beat-grid-summary">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Offset</span>
              <span ref={beatGridOffsetRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Source</span>
              <span ref={beatGridSourceRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Authority</span>
              <span ref={beatGridAuthorityRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Downbeat Phase</span>
              <span ref={downbeatPhaseRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Beat Period</span>
              <span ref={beatPeriodRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Fallback Reason</span>
              <span ref={gridFallbackRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Stale After BPM Override</span>
              <span ref={beatGridStaleRef} className="vz-mi-kv-val">No</span>
            </div>
          </div>
          <div className="vz-mi-beat-grid-bars">
            {beatGridBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
        </MiSection>

        {/* ── Musical Phrases ───────────────────────────────────────────────── */}
        <MiSection title="Musical Phrases">
          <div className="vz-mi-phrase-summary">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Length</span>
              <span ref={phraseLengthRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Timestamp</span>
              <span ref={phraseTimestampRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Bar Index</span>
              <span ref={phraseBarIndexRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Source</span>
              <span ref={phraseSourceRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Structurally Detected</span>
              <span ref={phraseStructuralRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Related Section</span>
              <span ref={phraseSectionRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Hierarchy Level</span>
              <span ref={phraseHierarchyRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric vz-mi-phrase-evidence">
              <span className="vz-mi-kv-label">Supporting Evidence</span>
              <span ref={phraseEvidenceRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <div className="vz-mi-phrase-bars">
            <MiBar row={phraseConfidenceBar.current} barRowRefs={barRowRefs} />
          </div>
        </MiSection>

        {/* ── Energy ───────────────────────────────────────────────────────── */}
        <MiSection title="Energy">
          <div className="vz-mi-energy-bars">
            {energyBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
        </MiSection>

        {/* ── Measurements ──────────────────────────────────────────────────── */}
        <MiSection title="Measurements">
          <div className="vz-mi-measurement-bars">
            {measurementBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
          <div className="vz-mi-band-subtitle vz-mi-chroma-title">Chroma Summary</div>
          {[chromaBars.current.slice(0, 6), chromaBars.current.slice(6)].map((rows, groupIndex) => (
            <div key={groupIndex} className="vz-mi-bar-group vz-mi-chroma-row">
              {rows.map(row => {
                const refs = barRowRefs(row)
                return (
                  <div key={row.label} className="vz-mi-bar-col">
                    <span ref={refs.valRef} className="vz-mi-bar-val">—</span>
                    <div className="vz-mi-bar-track">
                      <div ref={refs.barRef} className="vz-mi-bar-fill" />
                    </div>
                    <span className="vz-mi-bar-lbl">{row.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </MiSection>

        {/* ── Section ──────────────────────────────────────────────────────── */}
        <MiSection title="Section">
          <div className="vz-mi-section-summary">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Type</span>
              <span ref={sectionTypeRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Label</span>
              <span ref={sectionLabelRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Start</span>
              <span ref={sectionStartRef} className="vz-mi-kv-val">0.000 s</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">End</span>
              <span ref={sectionEndRef} className="vz-mi-kv-val">0.000 s</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Source</span>
              <span ref={sectionSourceRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <MiBar row={sectionProgBar.current}  barRowRefs={barRowRefs} />
          <MiBar row={sectionIntBar.current}   barRowRefs={barRowRefs} />
          <MiBar row={sectionConfBar.current}  barRowRefs={barRowRefs} />
        </MiSection>

        {/* ── Section & Structure ───────────────────────────────────────────── */}
        <MiSection title="Section & Structure">
          <div className="vz-mi-structure-summary">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Section Family</span>
              <span ref={structureFamilyRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Recurrence</span>
              <span ref={structureRecurrenceRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Variation</span>
              <span ref={structureVariationRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Most Similar Region</span>
              <span ref={structureRelationRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric vz-mi-structure-wide">
              <span className="vz-mi-kv-label">Boundary Candidate</span>
              <span ref={boundaryCandidateRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric vz-mi-structure-wide">
              <span className="vz-mi-kv-label">Alternate Candidate</span>
              <span ref={alternateCandidateRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <div className="vz-mi-structure-bars">
            {structureBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
        </MiSection>

        {/* ── Event Markers ─────────────────────────────────────────────────── */}
        <MiSection title="Event Markers">
          <div className="vz-mi-event-marker-list">
            {eventMarkerRows.current.map(row => (
              <div key={row.label} className="vz-mi-summary-metric">
                <span className="vz-mi-kv-label">{row.label}</span>
                <span ref={el => { row.valEl = el }} className="vz-mi-kv-val">—</span>
              </div>
            ))}
          </div>
          <div className="vz-mi-event-focus">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Nearest Event</span>
              <span ref={focusedEventTypeRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Source</span>
              <span ref={focusedEventSourceRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Duration</span>
              <span ref={focusedEventDurationRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Related Section</span>
              <span ref={focusedEventSectionRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <div className="vz-mi-event-confidence">
            <MiBar row={focusedEventConfidenceBar.current} barRowRefs={barRowRefs} />
          </div>
        </MiSection>

        {/* ── Harmonic ─────────────────────────────────────────────────────── */}
        <MiSection title="Harmonic">
          <div className="vz-mi-harmonic-grid">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Key</span>
              <span ref={keyModeRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Chord</span>
              <span ref={chordRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Root Note</span>
              <span ref={rootNoteRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Note</span>
              <span ref={noteRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Pitch</span>
              <span ref={pitchRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Contour</span>
              <span ref={contourRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
          <div className="vz-mi-harmonic-bar">
            <MiBar row={keyConfBar.current} barRowRefs={barRowRefs} />
            <MiBar row={chordConfBar.current} barRowRefs={barRowRefs} />
          </div>
          <div className="vz-mi-dots-row vz-mi-harmonic-events">
            <div className="vz-mi-dot-item">
              <span ref={dotRowRefs(chordChangedDot.current).dotRef} className="vz-mi-dot" />
              <span className="vz-mi-dot-label">Chord Changed</span>
            </div>
          </div>
        </MiSection>

        {/* ── Stems ────────────────────────────────────────────────────────── */}
        <MiSection title="Stems">
          <div className="vz-mi-bar-group">
            {stemBars.current.map(row => {
              const r = barRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-bar-col">
                  <span ref={r.valRef} className="vz-mi-bar-val">0.00</span>
                  <div className="vz-mi-bar-track">
                    <div ref={r.barRef} className="vz-mi-bar-fill" />
                  </div>
                  <span className="vz-mi-bar-lbl">{row.label}</span>
                </div>
              )
            })}
          </div>
          <div className="vz-mi-dots-row vz-mi-stem-events">
            {stemDots.current.map(row => {
              const r = dotRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-dot-item">
                  <span ref={r.dotRef} className="vz-mi-dot" />
                  <span className="vz-mi-dot-label">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Lyrics ───────────────────────────────────────────────────────── */}
        <MiSection title="Lyrics">
          <MiBar row={vocalActBar.current} barRowRefs={barRowRefs} />
          <div className="vz-mi-lyrics-grid">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Line</span>
              <span ref={activeLineRef} className="vz-mi-lyric-text">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Line ID</span>
              <span ref={activeLineIdRef} className="vz-mi-lyric-text">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Previous Line</span>
              <span ref={previousLineRef} className="vz-mi-lyric-text">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Next Line</span>
              <span ref={nextLineRef} className="vz-mi-lyric-text">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Word</span>
              <span ref={activeWordRef} className="vz-mi-lyric-text">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Word ID</span>
              <span ref={activeWordIdRef} className="vz-mi-lyric-text">—</span>
            </div>
          </div>
          <div className="vz-mi-lyrics-bars">
            {lyricBars.current.map(row => (
              <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
            ))}
          </div>
          <div className="vz-mi-dots-row vz-mi-lyrics-events">
            {lyricDots.current.map(row => {
              const r = dotRowRefs(row)
              return (
                <div key={row.label} className="vz-mi-dot-item">
                  <span ref={r.dotRef} className="vz-mi-dot" />
                  <span className="vz-mi-dot-label">{row.label}</span>
                </div>
              )
            })}
          </div>
        </MiSection>

        {/* ── Semantic ─────────────────────────────────────────────────────── */}
        <MiSection title="Semantic">
          {semanticBars.current.map(row => (
            <MiBar key={row.label} row={row} barRowRefs={barRowRefs} />
          ))}
          <div className="vz-mi-semantic-grid">
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Mood</span>
              <span ref={moodRef} className="vz-mi-kv-val">—</span>
            </div>
            <div className="vz-mi-summary-metric">
              <span className="vz-mi-kv-label">Texture</span>
              <span ref={textureRef} className="vz-mi-kv-val">—</span>
            </div>
          </div>
        </MiSection>
        </>}
    </>
  )

  return (
    <div className={`vz-mi-panel${ungrouped ? ' vz-mi-panel--ungrouped' : ''}`}>
      {ungrouped ? content : (
        <Collapsible label="Audio Intelligence" defaultOpen>
          {content}
        </Collapsible>
      )}
    </div>
  )
}

// ── Local sub-components ──────────────────────────────────────────────────────

function MiSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    <section className={`vz-mi-section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="vz-mi-section-title vz-mi-section-title--toggle"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className="vz-mi-section-label">
          <MiSectionIcon title={title} />
          <span>{title}</span>
        </span>
        <span className="vz-mi-section-arrow" aria-hidden="true"><AppIcon kind="chevronDown" size={14} /></span>
      </button>
      {open && <div className="vz-mi-section-body">{children}</div>}
    </section>
  )
}

function MiSectionIcon({ title }: { title: string }) {
  const props = { size: 16, className: 'vz-mi-section-icon', 'aria-hidden': true } as const

  switch (title) {
    case 'Track': return <AppIcon kind="music" {...props} />
    case 'Live Input': return <AppIcon kind="mic" {...props} />
    case 'Audio Bands': return <AppIcon kind="bars" {...props} />
    case 'Rhythm': return <AppIcon kind="rhythm" {...props} />
    case 'Beat Grid': return <AppIcon kind="gridSnap" {...props} />
    case 'Musical Phrases': return <AppIcon kind="tree" {...props} />
    case 'Energy': return <AppIcon kind="energy" {...props} />
    case 'Measurements': return <AppIcon kind="sliders" {...props} />
    case 'Section': return <AppIcon kind="layers" {...props} />
    case 'Section & Structure': return <AppIcon kind="tree" {...props} />
    case 'Event Markers': return <AppIcon kind="timeline" {...props} />
    case 'Harmonic': return <AppIcon kind="waveform" {...props} />
    case 'Stems': return <AppIcon kind="split" {...props} />
    case 'Lyrics': return <AppIcon kind="lyrics" {...props} />
    case 'Semantic': return <AppIcon kind="tag" {...props} />
    default: return <AppIcon kind="layers" {...props} />
  }
}

function MiBar({
  row,
  barRowRefs,
}: {
  row: BarRow
  barRowRefs: (row: BarRow) => { barRef: (el: HTMLDivElement | null) => void; valRef: (el: HTMLSpanElement | null) => void }
}) {
  const refs = barRowRefs(row)
  return (
    <div className="vz-mi-row">
      <span className="vz-mi-row-label">{row.label}</span>
      <div className="vz-mi-row-track">
        <div ref={refs.barRef} className="vz-mi-row-fill" />
      </div>
      <span ref={refs.valRef} className="vz-mi-row-val">0.00</span>
    </div>
  )
}
