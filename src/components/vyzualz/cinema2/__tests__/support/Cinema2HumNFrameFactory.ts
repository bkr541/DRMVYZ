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
      type: (input.buildConfidence ?? 0) > 0.5 ? 'build' : 'verse',
      label: 'section',
      startSec: Math.max(0, input.timeSec - 0.1),
      endSec: input.timeSec + 4,
      progress: 0.1,
      intensity: 0.6,
      confidence: 0.96,
      source: 'analysis',
    },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalActivity: input.vocal ?? 0 },
    semantics: {
      ...DEFAULT_MI_FRAME.semantics,
      buildConfidence: input.buildConfidence ?? 0,
      dropConfidence: 0.02,
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
      legacyFallbackOnly: false,
    },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.96, rhythm: 0.96, section: 0.96 },
  }
}

