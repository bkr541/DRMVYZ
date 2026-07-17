import { describe, expect, it } from 'vitest'
import { DEFAULT_MI_FRAME } from '../../../../../features/musicIntelligence/constants'
import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import { buildSharedPerformanceContext } from '../../../../../features/performanceCore'
import type { ReactTrackSection } from '../../ReactTypes'
import {
  evaluatePixGridCompiledConditions,
  evaluatePixGridReactionCurve,
  PIX_GRID_ASSIGNMENT_TARGETS,
  PixGridAssignmentCompiler,
} from '../PixGridAssignmentCompiler'
import {
  createPixGridAudioFrame,
  createSilentPixGridAudioFrame,
  PixGridReactionRuntime,
  resolveLegacyPixGridLayerAudioReactivity,
} from '../PixGridAudioRouting'
import {
  PIX_GRID_AUDIO_INTELLIGENCE_SOURCES,
  resolvePixGridAudioIntelligenceInventory,
} from '../PixGridAudioIntelligenceRegistry'
import { createDefaultPixGridState } from '../PixGridDefaults'
import { createDefaultPixGridReactionAssignment } from '../PixGridGroups'
import type { PixGridAudioFrame, PixGridReactionAssignment } from '../PixGridTypes'
import { normalizePixGridReactionAssignment, normalizePixGridState } from '../PixGridValidation'

const SECTIONS: ReactTrackSection[] = [
  { id: 'intro', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.25, source: 'auto', confidence: 0.8 },
  { id: 'build', label: 'Build', type: 'build', startSec: 8, endSec: 16, intensity: 0.7, source: 'auto', confidence: 0.9 },
  { id: 'drop', label: 'Drop', type: 'drop', startSec: 16, endSec: 32, intensity: 1, source: 'auto', confidence: 0.95 },
]

function intelligence(timeSec: number, overrides: Partial<MusicIntelligenceFrame> = {}): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2
  const beatIndex = Math.floor(absoluteBeat)
  return {
    ...DEFAULT_MI_FRAME,
    ...overrides,
    timeSec,
    frameId: beatIndex + 1,
    trackId: 'assignments-track',
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      sub: 0.12, bass: 0.24, lowMid: 0.36, mid: 0.48, high: 0.6, air: 0.72, volume: 0.68,
      normalizedBass: 0.74, normalizedMid: 0.56, normalizedHigh: 0.42,
      ...overrides.bands,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      ...overrides.rhythm,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.72,
      percentile: 0.81,
      spectralFlux: 0.44,
      spectralCentroid: 0.63,
      tension: 0.58,
      complexity: 0.66,
      buildProgress: timeSec >= 8 && timeSec < 16 ? (timeSec - 8) / 8 : 0,
      ...overrides.energy,
    },
    stems: {
      ...DEFAULT_MI_FRAME.stems,
      vocalEnergy: 0.52,
      vocalActivity: 0.6,
      drumEnergy: 0.7,
      bassStemEnergy: 0.8,
      instrumentEnergy: 0.45,
      ...overrides.stems,
    },
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      trackEnergyCurve: true,
      stemCurves: true,
      sections: true,
      ...overrides.capabilities,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.92,
      rhythm: 0.9,
      section: 0.93,
      harmonic: 0.84,
      ...overrides.confidence,
    },
    raw: { ...DEFAULT_MI_FRAME.raw, ...overrides.raw },
  }
}

function context(
  timeSec: number,
  previous: ReturnType<typeof buildSharedPerformanceContext> | null = null,
  overrides: Partial<MusicIntelligenceFrame> = {},
) {
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: intelligence(timeSec, overrides),
    resolvedSections: SECTIONS,
    trackIdentity: 'assignments-track',
    previous,
    durationSec: 32,
  })
}

function assignment(overrides: Partial<PixGridReactionAssignment> = {}): PixGridReactionAssignment {
  return {
    ...createDefaultPixGridReactionAssignment(),
    id: 'assignment-under-test',
    targetScope: 'group',
    targetId: 'group-a',
    curve: 'linear',
    attack: 0,
    hold: 0,
    release: 0,
    smoothing: 0,
    amount: 1,
    clamp: [-4, 4],
    ...overrides,
  }
}

function liveFrame(overrides: Partial<PixGridAudioFrame> = {}): PixGridAudioFrame {
  return createSilentPixGridAudioFrame({
    audioTime: 4,
    isPlaying: true,
    deltaTimeSec: 1 / 60,
    bass: 0.7,
    energy: 0.65,
    trackIdentity: 'assignments-track',
    sectionType: 'drop',
    sectionPhase: 'body',
    sectionOccurrence: 1,
    dropOccurrence: 1,
    phraseSegment: 'middle',
    autoPerformanceEnabled: true,
    ...overrides,
  })
}

describe('PixGrid Audio Intelligence registry and assignment compiler', () => {
  it('1. keeps source IDs unique and metadata valid', () => {
    const ids = PIX_GRID_AUDIO_INTELLIGENCE_SOURCES.map(source => source.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const source of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
      expect(source.label.length).toBeGreaterThan(0)
      expect(source.valueRange[0]).toBeLessThan(source.valueRange[1])
      expect(source.recommendedTargets.length).toBeGreaterThan(0)
    }
  })

  it('2. resolves every authoritative source or marks it optional', () => {
    const current = context(12)
    const inventory = resolvePixGridAudioIntelligenceInventory(current)
    for (const source of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
      expect(Number.isFinite(inventory.values[source.id])).toBe(true)
      if (!inventory.capabilities[source.id]) expect(source.optional).toBe(true)
    }
  })

  it('3. introduces no duplicate audio analyser loop', () => {
    const implementation = `${createPixGridAudioFrame}${resolvePixGridAudioIntelligenceInventory}`
    expect(implementation).not.toMatch(/AudioContext|AnalyserNode|getByteFrequencyData|getFloatFrequencyData/)
  })

  it('4. normalizes continuous source values into bounded ranges', () => {
    const frame = createPixGridAudioFrame(context(12), { isPlaying: true, deltaTimeSec: 1 / 60 })
    for (const source of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
      const value = frame.sourceValues![source.id]
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('5. detects kick, snare, hat, and transient independently', () => {
    const frame = createPixGridAudioFrame(context(4, null, {
      rhythm: { ...DEFAULT_MI_FRAME.rhythm, bpm: 120, kickHit: true, snareHit: false, hatHit: true, transient: 0.9 },
    }), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect([frame.kickHit, frame.snareHit, frame.hatHit, frame.transientHit]).toEqual([true, false, true, true])
  })

  it('6. detects four, eight, and sixteen bar boundaries', () => {
    const longSection: ReactTrackSection[] = [{
      id: 'long-drop', label: 'Long Drop', type: 'drop', startSec: 0, endSec: 64,
      intensity: 0.9, source: 'auto', confidence: 0.9,
    }]
    const boundaryContext = (timeSec: number, previous: ReturnType<typeof buildSharedPerformanceContext> | null = null) => buildSharedPerformanceContext({
      audioTimeSec: timeSec,
      frame: intelligence(timeSec),
      resolvedSections: longSection,
      trackIdentity: 'assignments-track',
      previous,
      durationSec: 64,
    })
    let previous = boundaryContext(7.99)
    let current = boundaryContext(8, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).fourBarBoundary).toBe(true)
    previous = boundaryContext(15.99, current)
    current = boundaryContext(16, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).eightBarBoundary).toBe(true)
    previous = boundaryContext(31.99, current)
    current = boundaryContext(32, previous)
    expect(createPixGridAudioFrame(current, { isPlaying: true, deltaTimeSec: 0.01 }).sixteenBarBoundary).toBe(true)
  })

  it('7. publishes bounded section and phrase progress', () => {
    const frame = createPixGridAudioFrame(context(12), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect(frame.sectionProgress).toBeCloseTo(0.5)
    expect(frame.phraseProgress).toBeGreaterThanOrEqual(0)
    expect(frame.phraseProgress).toBeLessThanOrEqual(1)
  })

  it('8. publishes track-relative energy from the authoritative percentile', () => {
    const frame = createPixGridAudioFrame(context(12), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect(frame.trackRelativeEnergy).toBeCloseTo(0.81)
  })

  it('9. publishes tension and complexity from Music Intelligence', () => {
    const frame = createPixGridAudioFrame(context(12), { isPlaying: true, deltaTimeSec: 1 / 60 })
    expect(frame.tension).toBeCloseTo(0.58)
    expect(frame.complexity).toBeCloseTo(0.66)
  })

  it('10. applies vocal capability fallback without fabricating vocals', () => {
    const runtime = new PixGridReactionRuntime()
    const result = runtime.resolve(assignment({ source: 'vocalEnergy', capabilityFallback: 'energy', minimumConfidence: 0.8 }), liveFrame({
      energy: 0.61,
      vocalEnergy: 0.99,
      capabilities: { vocalEnergy: false },
      confidence: { vocalEnergy: 0.1 },
    }))
    expect(result.usingFallback).toBe(true)
    expect(result.value).toBeCloseTo(0.61)
  })

  it('11. blocks assignments below confidence when fallback is disabled', () => {
    const runtime = new PixGridReactionRuntime()
    const result = runtime.resolve(assignment({ source: 'semanticMoment', minimumConfidence: 0.8, capabilityFallback: 'disable' }), liveFrame({
      semanticMomentHit: true,
      capabilities: { semanticMoment: true },
      confidence: { semanticMoment: 0.2 },
    }))
    expect(result.blockedByConfidence).toBe(true)
    expect(result.active).toBe(false)
  })

  it('12. evaluates include, exclude, and phase section conditions', () => {
    const compiler = new PixGridAssignmentCompiler()
    const compiled = compiler.compile(assignment({ conditions: { includeSectionTypes: ['drop'], excludeSectionTypes: ['intro'], sectionPhases: ['body'] } }), {}, 'group')
    expect(evaluatePixGridCompiledConditions(compiled, liveFrame())).toBe(true)
    expect(evaluatePixGridCompiledConditions(compiled, liveFrame({ sectionType: 'intro' }))).toBe(false)
  })

  it('13. evaluates section and drop occurrence conditions', () => {
    const compiler = new PixGridAssignmentCompiler()
    const compiled = compiler.compile(assignment({ conditions: { sectionOccurrences: [2], dropOccurrences: [3] } }), {}, 'group')
    expect(evaluatePixGridCompiledConditions(compiled, liveFrame({ sectionOccurrence: 2, dropOccurrence: 3 }))).toBe(true)
    expect(evaluatePixGridCompiledConditions(compiled, liveFrame({ sectionOccurrence: 1, dropOccurrence: 3 }))).toBe(false)
  })

  it('14. keeps all curves deterministic and bounded', () => {
    const curves = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'exponential', 'logarithmic', 'smoothstep', 'stepped', 'gate', 'inverse'] as const
    for (const curve of curves) {
      const first = evaluatePixGridReactionCurve(curve, 0.63)
      const second = evaluatePixGridReactionCurve(curve, 0.63)
      expect(first).toBe(second)
      expect(first).toBeGreaterThanOrEqual(0)
      expect(first).toBeLessThanOrEqual(1)
    }
  })

  it('15. applies threshold and hysteresis without gate chatter', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment({ threshold: 0.5, hysteresis: 0.2 })
    expect(runtime.resolve(route, liveFrame({ bass: 0.7 })).value).toBeGreaterThan(0)
    expect(runtime.resolve(route, liveFrame({ audioTime: 4.1, bass: 0.4 })).value).toBeGreaterThan(0)
    expect(runtime.resolve(route, liveFrame({ audioTime: 4.2, bass: 0.2 })).value).toBe(0)
  })

  it('16. holds quantized values until the configured boundary', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment({ quantization: 'bar' })
    const captured = runtime.resolve(route, liveFrame({ bass: 0.8, barEntry: true })).value
    const held = runtime.resolve(route, liveFrame({ audioTime: 4.1, bass: 0.2, barEntry: false })).value
    expect(held).toBeCloseTo(captured)
  })

  it('17. honors restart and ignore-while-active retrigger behavior', () => {
    const trigger = liveFrame({ audioTime: 1, kickHit: true, beatIndex: 1 })
    const route = assignment({ source: 'kick', attack: 0, hold: 0.05, release: 0.5, retrigger: 'ignoreWhileActive' })
    const ignored = new PixGridReactionRuntime()
    ignored.resolve(route, trigger)
    const ignoredValue = ignored.resolve(route, liveFrame({ audioTime: 1.2, kickHit: true, beatIndex: 2 })).value
    const restarted = new PixGridReactionRuntime()
    const restartRoute = { ...route, retrigger: 'restart' as const }
    restarted.resolve(restartRoute, trigger)
    const restartedValue = restarted.resolve(restartRoute, liveFrame({ audioTime: 1.2, kickHit: true, beatIndex: 2 })).value
    expect(restartedValue).toBeGreaterThan(ignoredValue)
  })

  it('18. rejects incompatible source-target-scope combinations', () => {
    const compiler = new PixGridAssignmentCompiler()
    const valid = compiler.compile(assignment({ target: 'scale', targetScope: 'group' }), {}, 'group')
    const invalid = compiler.compile(assignment({ id: 'invalid', target: 'transitionStrength', targetScope: 'group' }), {}, 'group')
    expect(valid.compatible).toBe(true)
    expect(invalid.compatible).toBe(false)
    expect(invalid.warnings.length).toBeGreaterThan(0)
  })

  it('19. compiles once and reuses the same bounded representation', () => {
    const compiler = new PixGridAssignmentCompiler()
    const route = assignment()
    const first = compiler.compile(route, {}, 'group', 'group-a:route')
    const second = compiler.compile(route, {}, 'group', 'group-a:route')
    expect(second).toBe(first)
    expect(compiler.compilationCount).toBe(1)
  })

  it('20. normalizes invalid authored assignments and bounds persistence', () => {
    const normalized = normalizePixGridReactionAssignment({
      id: '', source: 'imaginary', target: 'nonsense', amount: 999, threshold: -4,
      inputRange: [4, -4], outputRange: [99, -99], conditions: { sectionOccurrences: [-3, 2.2] },
    }, 0, 'group')
    expect(normalized).toMatchObject({ source: 'bass', target: 'brightness', amount: 4, threshold: 0 })
    expect(normalized?.inputRange?.[0]).toBeLessThanOrEqual(normalized!.inputRange![1])
    expect(normalized?.conditions?.sectionOccurrences).toEqual([0, 2])
  })

  it('21. preserves legacy layer audioReactivity through one compatibility path', () => {
    expect(resolveLegacyPixGridLayerAudioReactivity(liveFrame({ bass: 0.5 }), 'bass', 0.4)).toBeCloseTo(0.2)
    const state = createDefaultPixGridState()
    const normalized = normalizePixGridState({
      ...state,
      layers: state.layers.map((layer, index) => index === 0 ? { ...layer, audioReactivity: { brightnessSource: 'bass', brightnessAmount: 0.4, beatImpact: 0.2 } } : layer),
    })
    expect(normalized.layers[0].audioReactivity).toMatchObject({ brightnessSource: 'bass', brightnessAmount: 0.4, beatImpact: 0.2 })
  })

  it('22. reconstructs deterministic output after seek', () => {
    const route = assignment({ source: 'kick', attack: 0, hold: 0.1, release: 0.4 })
    const run = () => {
      const runtime = new PixGridReactionRuntime()
      runtime.resolve(route, liveFrame({ audioTime: 1, kickHit: true, beatIndex: 2 }))
      return runtime.resolve(route, liveFrame({ audioTime: 1.2, kickHit: false, beatIndex: 2, timingDiscontinuity: true })).value
    }
    expect(run()).toBe(run())
  })

  it('23. performs no compiler allocation on unchanged per-frame resolves', () => {
    const runtime = new PixGridReactionRuntime()
    const route = assignment()
    for (let index = 0; index < 100; index += 1) runtime.resolve(route, liveFrame({ audioTime: 4 + index / 60 }))
    expect(runtime.compilationCount).toBe(1)
    expect(runtime.cachedAssignmentCount).toBe(1)
  })

  it('24. reports real availability, fallbacks, triggers, envelopes, and warnings', () => {
    const runtime = new PixGridReactionRuntime()
    const frame = liveFrame({
      kickHit: true,
      beatIndex: 8,
      capabilities: { vocalEnergy: false, kick: true },
      confidence: { vocalEnergy: 0.1, kick: 1 },
    })
    runtime.beginFrame(frame)
    runtime.resolve(assignment({ id: 'fallback-route', source: 'vocalEnergy', capabilityFallback: 'energy', minimumConfidence: 0.8 }), frame)
    runtime.resolve(assignment({ id: 'kick-route', source: 'kick', attack: 0, hold: 0.1, release: 0.2 }), frame)
    const diagnostics = runtime.getDiagnostics()
    expect(diagnostics.unavailableSources).toContain('vocalEnergy')
    expect(diagnostics.assignmentsUsingFallback).toContain('fallback-route')
    expect(diagnostics.recentDiscreteTriggers).toContain('kick')
    expect(diagnostics.activeEnvelopes).toContain('kick-route')
  })

  it('runs multiple simultaneous music routes through one compiler/runtime', () => {
    const runtime = new PixGridReactionRuntime()
    const frame = liveFrame({
      bass: 0.8, tension: 0.7, buildProgress: 0.6,
      kickHit: true, snareHit: true, hatHit: true, beatIndex: 12,
    })
    runtime.beginFrame(frame)
    const routes = [
      assignment({ id: 'bass-brightness', source: 'bass', target: 'brightness' }),
      assignment({ id: 'kick-scale', source: 'kick', target: 'scale', attack: 0, hold: 0.1, release: 0.2 }),
      assignment({ id: 'snare-outline', source: 'snare', target: 'outlineFlash', attack: 0, hold: 0.1, release: 0.2 }),
      assignment({ id: 'hat-sparkle', source: 'hat', target: 'sparkleDensity', attack: 0, hold: 0.05, release: 0.1 }),
      assignment({ id: 'tension-tightening', source: 'tension', target: 'maskContraction' }),
      assignment({ id: 'build-rows', source: 'buildProgress', target: 'rowRecruitment' }),
    ]
    const values = routes.map(route => runtime.resolve(route, frame).value)
    expect(values.every(value => value > 0)).toBe(true)
    expect(runtime.cachedAssignmentCount).toBe(6)
    expect(PIX_GRID_ASSIGNMENT_TARGETS.some(target => target.id === 'rowRecruitment')).toBe(true)
  })
})
