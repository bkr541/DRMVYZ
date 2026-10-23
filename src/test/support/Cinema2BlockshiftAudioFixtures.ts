import { DEFAULT_MI_FRAME } from '../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../features/musicIntelligence/types'

export const BLOCKSHIFT_AUDIO_PROFILES = ['silence', 'verse', 'bass', 'mids', 'highs', 'vocals', 'build', 'kick', 'snare', 'beat', 'downbeat', 'bar', 'phrase', 'section', 'drop'] as const
export type BlockshiftAudioProfile = typeof BLOCKSHIFT_AUDIO_PROFILES[number]
/** Explicit synthetic upstream test publications, never a detector or a production signal source. */
export function blockshiftAudioFixture(profile: BlockshiftAudioProfile, timeSec: number, frameId: number, trackId = 'blockshift-p5-fixture'): MusicIntelligenceFrame {
  const vocal = profile === 'vocals', bass = profile === 'bass', build = profile === 'build'
  const rhythm = ['beat', 'downbeat', 'bar'].includes(profile)
  return {
    ...DEFAULT_MI_FRAME, sourceId: trackId, trackId, timeSec, frameId,
    bands: { ...DEFAULT_MI_FRAME.bands, normalizedSub: bass ? 0.95 : 0, normalizedBass: bass ? 0.9 : 0, normalizedMid: profile === 'mids' ? 0.9 : 0, normalizedHigh: profile === 'highs' ? 0.9 : 0 },
    energy: { ...DEFAULT_MI_FRAME.energy, instant: profile === 'verse' ? 0.25 : bass ? 0.8 : 0, spectralFlux: profile === 'highs' ? 0.8 : 0, buildProgress: build ? 0.9 : 0 },
    rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, bpmConfidence: 0.95, bpmSource: 'offline_analysis', transientConfidence: 0.95,
      beatIndex: rhythm ? frameId * 32 : Math.floor(timeSec * 2), beatPhase: rhythm ? 0 : (timeSec * 2) % 1, beatInBar: rhythm ? 0 : Math.floor(timeSec * 2) % 4, barIndex: rhythm ? frameId * 8 : Math.floor(timeSec / 2), beatEventId: rhythm ? frameId : null, beatEventTimeSec: timeSec,
      beatHit: rhythm, downbeatHit: profile === 'downbeat', phrase4Hit: profile === 'bar', phrase16Hit: profile === 'phrase', kickHit: profile === 'kick', kickStrength: profile === 'kick' ? 0.95 : 0, snareHit: profile === 'snare', snareStrength: profile === 'snare' ? 0.9 : 0 },
    section: { ...DEFAULT_MI_FRAME.section, type: build ? 'build' : profile === 'drop' ? 'drop' : profile === 'section' ? 'breakdown' : 'verse', label: profile === 'section' ? 'Breakdown' : 'Verse', startSec: profile === 'section' ? timeSec : 0, endSec: 120, confidence: 0.95, source: 'analysis' },
    stems: { ...DEFAULT_MI_FRAME.stems, vocalActivity: vocal ? 0.9 : 0, vocals: vocal ? 0.9 : 0 },
    semantics: { ...DEFAULT_MI_FRAME.semantics, buildConfidence: build ? 0.95 : 0, dropConfidence: profile === 'drop' ? 0.95 : 0 },
    phraseMarkers: profile === 'phrase' ? [{ id: `phrase-${frameId}`, timeSec, phraseLength: 16, confidence: 0.95, source: 'structural_boundary' }] : [],
    semanticMoments: profile === 'drop' ? [{ id: `drop-${frameId}`, timeSec, type: 'drop', confidence: 0.95, source: 'structural_analysis' }] : [],
    capabilities: { ...DEFAULT_MI_FRAME.capabilities!, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true, stemCurves: true },
    confidence: { ...DEFAULT_MI_FRAME.confidence, overall: 0.95, rhythm: 0.95, section: 0.95 },
  }
}
