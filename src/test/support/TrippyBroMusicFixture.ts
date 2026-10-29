/** Deterministic test-only upstream publications. No production detector/clock. */
import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'

export interface TrippyBroFixtureOptions {
  timeSec: number; frameId: number; bpm?: number; sectionStart?: number; revision?: string; trackId?: string; energy?: number; bass?: number
  high?: number; vocal?: number; build?: number; beatIndex?: number; eventId?: number
  sectionIntensity?: number; sectionBuild?: boolean; sectionProgress?: number; spectralFlux?: number; tension?: number
  event?: 'beat' | 'kick' | 'snare' | 'downbeat' | 'bar' | 'phrase' | 'drop' | 'impact' | null
  eventTime?: number; featuresAvailable?: boolean
  advanceBeatGrid?: boolean
}
export function trippyBroMusicFixture(o: TrippyBroFixtureOptions): MusicIntelligenceFrame {
  const enabled = o.featuresAvailable !== false
  const energy = o.energy ?? .5, beat = o.beatIndex ?? (o.advanceBeatGrid ? Math.floor(o.timeSec * 2) : 8), eventTime = o.eventTime ?? o.timeSec
  const eventNow = Math.abs(o.timeSec - eventTime) < .0001
  const hit = (kind: TrippyBroFixtureOptions['event']) => eventNow && o.event === kind
  const beatHit = hit('beat') || hit('downbeat') || hit('bar')
  return {
    ...DEFAULT_MI_FRAME, frameId: o.frameId, timeSec: o.timeSec,
    sourceId: 'trippyBro-deterministic-fixture', trackId: o.trackId ?? 'trippyBro-audio-fixture',
    analysisSource: 'bar_self_similarity', analysisRevision: o.revision ?? 'trippyBro-audio-v1', timelineRevision: 'trippyBro-timeline-v1',
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedBass: o.bass ?? 0, normalizedHigh: o.high ?? 0 },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: energy, rms: energy, buildProgress: o.build ?? 0, spectralFlux: o.spectralFlux ?? 0, tension: o.tension ?? 0 },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: o.bpm ?? 120, bpmConfidence: .95, bpmSource: 'offline_analysis',
      beatIndex: beat, beatPhase: o.advanceBeatGrid ? (o.timeSec * 2) % 1 : 0, beatInBar: beat % 4, barIndex: Math.floor(beat / 4), beatHit,
      beatEventId: o.eventId ?? beat, beatEventTimeSec: eventTime, downbeatHit: hit('downbeat') || hit('bar'),
      phrase4Hit: hit('bar'), phrase8Hit: false, phrase16Hit: false, phrase32Hit: false,
      kickHit: hit('kick'), kickStrength: hit('kick') ? 1 : 0,
      snareHit: hit('snare'), snareStrength: hit('snare') ? 1 : 0, transientConfidence: .95,
    },
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: enabled, rhythmEvents: enabled,
      beatGrid: enabled, sections: enabled, stemCurves: enabled },
    analysisCapabilities: { ...DEFAULT_MI_FRAME.analysisCapabilities!, phraseHierarchy: enabled, semanticMoments: enabled },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalActivity: o.vocal ?? 0 },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: (o.build ?? 0) > 0 ? .95 : 0 },
    section: { ...DEFAULT_MI_FRAME.section, type: (o.build ?? 0) > 0 || o.sectionBuild ? 'build' : 'verse', label: 'Trippy, Bro fixture',
      startSec: o.sectionStart ?? 0, endSec: (o.sectionStart ?? 0) + 1000, progress: o.sectionProgress ?? o.build ?? 0, intensity: o.sectionIntensity ?? DEFAULT_MI_FRAME.section.intensity, confidence: .95, source: 'analysis' },
    phraseMarkers: o.event === 'phrase' ? [{ id: `fixture-phrase-${o.eventId ?? beat}`, timeSec: eventTime,
      phraseLength: 8, confidence: .95, source: 'structural_boundary', structurallyDetected: true }] : [],
    semanticMoments: o.event === 'drop' || o.event === 'impact' ? [{ id: `fixture-${o.event}-${o.eventId ?? beat}`, timeSec: eventTime,
      type: o.event === 'impact' ? 'major_impact' : 'drop_impact', confidence: .95, source: 'manual' }] : [],
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: .95, rhythm: .95, section: .95 },
  }
}
