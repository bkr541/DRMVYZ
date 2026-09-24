import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'

/**
 * Shared upstream Music Intelligence frame factory for the HUM:N reactivity
 * suites (vitest production-path tests and the real-browser acceptance page).
 */
export interface HumFrameInput {
  frameId: number
  timeSec: number
  trackId?: string
  energy?: number
  complexity?: number
  trackCurve?: number | null
  tension?: number
  buildProgress?: number
  buildConfidence?: number
  vocal?: number
  high?: number
  air?: number
  beat?: boolean
  downbeat?: boolean
  kick?: number
  snare?: number
  live?: boolean
  structural?: boolean
  stems?: boolean
  rhythm?: boolean
  /** Persistent drop markers; an event fires when playback time crosses one. */
  dropMoments?: readonly { id: string; timeSec: number }[]
  dropConfidence?: number
  /** Persistent phrase markers; an event fires when playback time crosses one. */
  phrases?: readonly { id: string; timeSec: number }[]
  sectionType?: string
  /** Changing these mid-play is a section-change (new section identity). */
  sectionStartSec?: number
  sectionEndSec?: number
}

export const HUM_BPM = 120 // 0.5s per beat

export function humMusicFrame(input: HumFrameInput): MusicIntelligenceFrame {
  const live = input.live ?? true
  const structural = input.structural ?? true
  const rhythm = input.rhythm ?? true
  const beatIndex = Math.floor(input.timeSec * 2)
  return {
    ...DEFAULT_MI_FRAME,
    frameId: input.frameId,
    sourceId: 'hum-n-reactivity-source',
    // Structural semantics (tension/build) are only published for an identified track.
    trackId: structural ? (input.trackId ?? 'hum-n-reactivity-track') : null,
    timeSec: input.timeSec,
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      normalizedHigh: input.high ?? 0,
      normalizedAir: input.air ?? 0,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: HUM_BPM,
      bpmConfidence: 0.96,
      bpmSource: 'offline_analysis',
      beatIndex,
      beatPhase: 0,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: Boolean(input.beat),
      downbeatHit: Boolean(input.downbeat),
      beatEventTimeSec: input.timeSec,
      kickHit: (input.kick ?? 0) > 0,
      kickStrength: input.kick ?? 0,
      snareHit: (input.snare ?? 0) > 0,
      snareStrength: input.snare ?? 0,
      transient: 0.2,
      transientConfidence: 0.96,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: input.energy ?? 0.5,
      rms: input.energy ?? 0.5,
      complexity: input.complexity ?? 0.5,
      tension: input.tension ?? 0,
      buildProgress: input.buildProgress ?? 0,
      trackCurve: input.trackCurve ?? undefined,
    },
    section: {
      ...DEFAULT_MI_FRAME.section,
      type: (input.sectionType ?? ((input.buildConfidence ?? 0) > 0.5 ? 'build' : 'verse')) as MusicIntelligenceFrame['section']['type'],
      label: 'section',
      startSec: input.sectionStartSec ?? 0,
      endSec: input.sectionEndSec ?? 600,
      progress: 0.1,
      intensity: 0.6,
      confidence: 0.96,
      source: 'analysis',
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalActivity: input.vocal ?? 0 },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: input.buildConfidence ?? 0,
      dropConfidence: input.dropConfidence ?? ((input.dropMoments?.length ?? 0) > 0 ? 0.9 : 0.02),
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: live,
      rhythmEvents: rhythm,
      beatGrid: rhythm,
      sections: structural,
      stemCurves: input.stems ?? true,
      trackEnergyCurve: input.trackCurve != null,
    },
    analysisCapabilities: {
      ...DEFAULT_MI_FRAME.analysisCapabilities!,
      reliableBeatGrid: rhythm,
      reliableDownbeatGrid: rhythm,
      barAwareSections: structural,
      selfSimilarityAnalysis: structural,
      semanticClassification: structural,
      semanticMoments: (input.dropMoments?.length ?? 0) > 0,
      phraseHierarchy: (input.phrases?.length ?? 0) > 0,
      legacyFallbackOnly: false,
    },
    semanticMoments: (input.dropMoments ?? []).map(moment => ({
      id: moment.id,
      timeSec: moment.timeSec,
      type: 'drop_impact' as const,
      confidence: 0.95,
      source: 'structural_analysis' as const,
    })),
    phraseMarkers: (input.phrases ?? []).map(phrase => ({
      id: phrase.id,
      timeSec: phrase.timeSec,
      lengthBars: 4,
      phraseLength: 4,
      confidence: 0.9,
      source: 'structural_boundary' as const,
    })),
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 0.96, section: 0.96 },
  }
}

