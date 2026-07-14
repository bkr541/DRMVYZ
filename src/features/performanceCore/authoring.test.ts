import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../musicIntelligence/constants'
import type { ReactTrackSection } from '../musicIntelligence/types'
import {
  buildSharedPerformanceContext,
  createSharedPerformanceDiagnostics,
  resolveSharedPerformanceProgram,
  SHARED_PERFORMANCE_PRECEDENCE,
  validateSharedPerformanceProgram,
  validateSharedPerformanceProgramCollection,
  type SharedPerformanceProgram,
} from '.'

const sections: ReactTrackSection[] = [
  { id: 'build', label: 'Build', type: 'build', startSec: 0, endSec: 8, intensity: 0.7, source: 'auto', confidence: 0.9 },
  { id: 'drop', label: 'Drop 1', type: 'drop', startSec: 8, endSec: 24, intensity: 1, source: 'auto', confidence: 0.9, interpretation: { familyId: 'drop-family', occurrenceIndex: 1 } },
]

function context(timeSec: number, sectionConfidence = 0.9) {
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: {
      ...DEFAULT_MI_FRAME,
      timeSec,
      frameId: 1,
      trackId: 'track-a',
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, beatIndex: Math.floor(timeSec * 2), beatInBar: Math.floor(timeSec * 2) % 4, barIndex: Math.floor(timeSec / 2) },
      capabilities: { ...DEFAULT_MI_FRAME.capabilities!, beatGrid: true, sections: true },
      confidence: { ...DEFAULT_MI_FRAME.confidence, overall: sectionConfidence, section: sectionConfidence, rhythm: 0.9 },
    },
    resolvedSections: sections,
    trackIdentity: 'track-a',
  })
}

describe('shared performance authoring and diagnostics', () => {
  it('validates duplicate IDs, invalid ranges, missing fallbacks, and duplicate programs without crashing playback', () => {
    const invalid: SharedPerformanceProgram<{ type: 'noop' }> = {
      id: 'invalid',
      fallbackSceneId: 'missing',
      scenes: [
        { id: 'same', sectionTypes: ['drop'], barRange: { startBar: 4, endBar: 2 }, actions: [{ type: 'noop' }] },
        { id: 'same', sectionTypes: [], minConfidence: 2, actions: [{ type: 'noop' }] },
      ],
    }
    const issues = validateSharedPerformanceProgram(invalid, { requireFallbackScene: true })
    expect(issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-scene-id',
      'invalid-bar-range',
      'missing-section-match',
      'invalid-min-confidence',
      'missing-fallback-scene',
    ]))
    expect(validateSharedPerformanceProgramCollection([invalid, invalid]).some(issue => issue.code === 'duplicate-program-id')).toBe(true)
  })


  it('documents the tested precedence order and flags incompatible state replacements in one action group', () => {
    expect(SHARED_PERFORMANCE_PRECEDENCE).toEqual([
      'safetyAndResourceClamps',
      'explicitUserLocks',
      'requiredFallbackCorrections',
      'authoredSceneState',
      'phraseAndBarProgression',
      'discreteEventActions',
      'continuousModulation',
      'engineDefaults',
    ])
    const program: SharedPerformanceProgram<{ type: 'replace' | 'pulse'; target: string }> = {
      id: 'conflicts',
      scenes: [{
        id: 'drop',
        sectionTypes: ['drop'],
        actions: [
          { type: 'replace', target: 'scene' },
          { type: 'pulse', target: 'brightness' },
          { type: 'replace', target: 'scene' },
        ],
      }],
    }
    const issues = validateSharedPerformanceProgram(program, {
      adapter: {
        validate: () => [],
        exclusiveTargetKey: action => action.type === 'replace' ? action.target : null,
      },
    })
    expect(issues.some(issue => issue.code === 'overlapping-incompatible-actions')).toBe(true)
  })

  it('matches bar, phase, capability, and confidence gates and falls back deterministically', () => {
    const program: SharedPerformanceProgram<{ id: string }> = {
      id: 'gated',
      fallbackSceneId: 'fallback',
      scenes: [
        {
          id: 'late-drop',
          sectionTypes: ['drop'],
          barRange: { startBar: 2 },
          confidenceRequirements: [{ confidence: 'section', min: 0.75 }],
          capabilityRequirements: [{ capability: 'sections' }],
          actions: [{ id: 'late' }],
        },
        { id: 'fallback', sectionTypes: ['unknown'], actions: [{ id: 'safe' }] },
      ],
    }
    expect(resolveSharedPerformanceProgram(program, context(9)).scene?.id).toBe('fallback')
    expect(resolveSharedPerformanceProgram(program, context(13)).scene?.id).toBe('late-drop')
    expect(resolveSharedPerformanceProgram(program, context(13, 0.4)).scene?.id).toBe('fallback')
  })

  it('creates a compact diagnostics snapshot from the authoritative context', () => {
    const snapshot = createSharedPerformanceDiagnostics(context(13), {
      engine: 'canvas',
      performanceShow: 'Show',
      scene: 'Scene',
      motifOrComposition: 'Video Wall',
      activeLayers: ['hero', 'texture'],
      activeEventEnvelopes: ['kick'],
      recentActions: ['hardCut'],
      continuousRoutes: ['bass-scale'],
      lockedParameters: ['media'],
      resourceLimitDecisions: ['Decoder cap applied'],
    })
    expect(snapshot).toMatchObject({
      engine: 'canvas',
      performanceShow: 'Show',
      scene: 'Scene',
      section: 'drop',
      sectionFamily: 'drop-family',
      motifOrComposition: 'Video Wall',
    })
    expect(snapshot.activeLayers).toEqual(['hero', 'texture'])
  })
})
