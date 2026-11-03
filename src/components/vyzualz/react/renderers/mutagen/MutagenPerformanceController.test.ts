import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { TrackIntelligenceAnalysis } from '../../../../../features/musicIntelligence/types'
import { mutagenAnalyzedFixtureContext } from '../../../../../test/support/MutagenMusicFixture'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { CANVAS_SHIFTGRID_TRIGGER_OPTIONS } from '../shiftgrid/ShiftgridSettings'
import { CANVAS_PRESET_BY_ID } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { mergeReactStoreState, normalizeCanvasPresetSettings, reactStorePartialize, useReactStore } from '../../../../../stores/reactStore'
import { applyMutagenAutoPerformance, applyMutagenManualPattern, applyMutagenPatternChange, DEFAULT_CANVAS_MUTAGEN_SETTINGS as defaults, MUTAGEN_PATTERNS, MUTAGEN_TRIGGER_OPTIONS, normalizeCanvasMutagenSettings, type CanvasMutagenSettings } from './MutagenSettings'
import { createMutagenPerformancePatternCycle, MutagenPerformanceController, MUTAGEN_NEUTRAL_ROUTING, nextMutagenPerformancePattern, resolveMutagenAutoPattern, resolveMutagenMotionPosition, resolveMutagenReactiveSettings, resolveMutagenTriggerEventIdentity } from './MutagenPerformanceController'

function context(patch: Partial<SharedPerformanceContext> = {}): SharedPerformanceContext {
  const base = createSharedPerformanceFallbackContext(patch.audioTimeSec ?? 0)
  return { ...base, runtimeIdentity: 'track-a:analysis-1', trackIdentity: 'track-a',
    capabilities: { ...base.capabilities, liveBands: true, rhythmEvents: true, beatGrid: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, phrase: 1, downbeat: 1, section: 1, semantics: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false, beatBoundary: false, barBoundary: false, sectionEntry: false }, ...patch }
}
const settings = (patch: Partial<CanvasMutagenSettings> = {}): CanvasMutagenSettings => ({ ...defaults, audioReactivity: 1, ...patch })
const update = (controller: MutagenPerformanceController, c: SharedPerformanceContext | null, s = settings(), extra: { paused?: boolean; audioActive?: boolean } = {}) => controller.update({ settings: s, context: c, audioActive: true, paused: false, deltaSec: 0.05, timeSec: c?.audioTimeSec ?? 0, ...extra })
function boundary(beat: number, previous = context()): SharedPerformanceContext {
  return context({ audioTimeSec: beat / 2, absoluteBeat: beat, absoluteBar: beat / 4, phraseIndex: Math.floor(beat / 32), downbeat: beat % 4 === 0,
    boundaries: { ...previous.boundaries, beatBoundary: true, barBoundary: beat % 4 === 0 } })
}

describe('MUTAGEN musical authority and persistence', () => {
  it('reconstructs a paused seek once without inventing a drop or advancing on repeated paused polling', () => {
    const controller = new MutagenPerformanceController(), s = settings({ autoPerformance: true })
    update(controller, context({ audioTimeSec: 5 }), s)
    const seek = context({ audioTimeSec: 40, sectionType: 'breakdown', sectionProgress: 0.9 })
    seek.seekDetected = true
    seek.boundaries = { ...seek.boundaries, timingDiscontinuity: true }
    const decision = update(controller, seek, s, { paused: true })
    expect(decision.positionReset).toBe(true)
    expect(decision.routing.kickImpulse).toBe(0)
    const still = { ...seek, seekDetected: false, boundaries: { ...seek.boundaries, timingDiscontinuity: false } }
    const repeated = update(controller, still, s, { paused: true })
    expect(repeated.positionReset).toBe(false)
    expect(repeated.activePattern).toBe(decision.activePattern)
    expect(repeated.motionTimeSec).toBe(decision.motionTimeSec)
  })
  it('uses exactly the canonical trigger vocabulary, independent of video timing', () => {
    expect(MUTAGEN_TRIGGER_OPTIONS).toEqual(CANVAS_SHIFTGRID_TRIGGER_OPTIONS)
    expect(normalizeCanvasMutagenSettings({ trigger: 'restartOnDrop', audioReactivity: 20, deterministicSeed: -1, patternChange: true, autoPerformance: true, bpmSync: 'yes' })).toMatchObject({ trigger: 'bar4', audioReactivity: 1, deterministicSeed: 0, patternChange: true, autoPerformance: false, bpmSync: false })
    expect(normalizeCanvasMutagenSettings({ version: 2 })).toEqual(defaults)
  })

  it('matches manual, Pattern Change, and Auto toggle interactions and retains authored Pattern', () => {
    const auto = applyMutagenAutoPerformance(settings({ patternChange: true }), true)
    expect(auto).toMatchObject({ patternChange: false, autoPerformance: true })
    expect(applyMutagenManualPattern(auto, 'fracture')).toMatchObject({ pattern: 'fracture', autoPerformance: false })
    expect(applyMutagenPatternChange(auto, true)).toMatchObject({ patternChange: true, autoPerformance: false })
    expect(applyMutagenManualPattern(settings({ patternChange: true }), 'morph')).toMatchObject({ patternChange: true, pattern: 'morph', autoPerformance: false })
  })

  it('round-trips the nested v3 recipe and includes every performance field in provenance', () => {
    useReactStore.getState().selectCanvasPreset('canvas-mutagen')
    const authored = settings({ pattern: 'vortex', patternChange: true, trigger: 'snare', deterministicSeed: 701, bpmSync: true })
    useReactStore.getState().setCanvasPresetSettings({ mutagen: authored })
    const saved = JSON.parse(JSON.stringify(reactStorePartialize(useReactStore.getState())))
    const hydrated = mergeReactStoreState(saved, useReactStore.getState())
    expect(hydrated.canvasPresetSettings.mutagen).toEqual(authored)
    const preset = CANVAS_PRESET_BY_ID['canvas-mutagen'], exact = normalizeCanvasPresetSettings(preset.settings)
    for (const patch of [{ patternChange: true }, { trigger: 'drop' as const }, { autoPerformance: true }, { bpmSync: true }, { audioReactivity: 0 }, { deterministicSeed: 2 }]) {
      expect(resolveCanvasPresetProvenance(preset, { ...exact, mutagen: { ...exact.mutagen, ...patch } }).status).toBe('modified')
    }
  })

  it('locks manual Pattern through every section and gives Pattern Change precedence even for ambiguous callers', () => {
    const controller = new MutagenPerformanceController(), s = settings({ pattern: 'particulate' })
    for (const sectionType of ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'outro'] as const) {
      expect(update(controller, context({ sectionType }), s)).toMatchObject({ authority: 'manual', activePattern: 'particulate' })
    }
    expect(update(controller, context(), { ...s, patternChange: true, autoPerformance: true }).authority).toBe('patternChange')
  })

  it('makes a deterministic full seeded cycle with no immediate repeat across wraps', () => {
    const cycle = createMutagenPerformancePatternCycle(71)
    expect(createMutagenPerformancePatternCycle(71)).toEqual(cycle)
    expect(new Set(cycle)).toEqual(new Set(MUTAGEN_PATTERNS))
    let previous = cycle[0]
    for (let i = 0; i < 40; i++) { const next = nextMutagenPerformancePattern(cycle, previous); expect(next).not.toBe(previous); previous = next }
    expect(createMutagenPerformancePatternCycle(72)).not.toEqual(cycle)
  })
})

describe('MUTAGEN canonical events', () => {
  it('resolves all eleven triggers from the published shared boundary/rising edges', () => {
    const previous = context({ absoluteBeat: 31, absoluteBar: 7, phraseIndex: 0 })
    const c = boundary(32, previous)
    Object.assign(c, { kick: true, kickStrength: 1, snare: true, snareStrength: 0.8, sectionType: 'drop', sectionId: 'drop-1', dropOccurrence: 1, dropImpact: 1 })
    c.boundaries.sectionEntry = true
    for (const { value } of MUTAGEN_TRIGGER_OPTIONS) expect(resolveMutagenTriggerEventIdentity(c, previous, value, true), value).not.toBeNull()
    expect(resolveMutagenTriggerEventIdentity(c, previous, 'beat', false)).toBeNull()
    expect(resolveMutagenTriggerEventIdentity({ ...c, confidence: { ...c.confidence, rhythm: 0 } }, previous, 'kick', true)).toBeNull()
  })

  it('restricts 4/8-bar cadence and phrases to qualified shared bar boundaries', () => {
    for (const bar of [1, 3, 4, 7, 8, 12, 16]) {
      const previous = boundary(bar * 4 - 1), c = boundary(bar * 4, previous)
      expect(Boolean(resolveMutagenTriggerEventIdentity(c, previous, 'bar4', true))).toBe(bar % 4 === 0)
      expect(Boolean(resolveMutagenTriggerEventIdentity(c, previous, 'bar8', true))).toBe(bar % 8 === 0)
      const noGrid = { ...c, capabilities: { ...c.capabilities, beatGrid: false } }
      expect(resolveMutagenTriggerEventIdentity(noGrid, previous, 'phrase', true)).toBeNull()
    }
    expect(resolveMutagenTriggerEventIdentity(boundary(32), boundary(31), 'phrase', true)).not.toBeNull()
    expect(resolveMutagenTriggerEventIdentity(boundary(33), boundary(32), 'phrase', true)).toBeNull()
  })

  it('holds the authored/current Pattern until a new selected event and deduplicates polling', () => {
    const controller = new MutagenPerformanceController(), s = settings({ patternChange: true, trigger: 'beat' })
    expect(update(controller, boundary(0), s).activePattern).toBe(s.pattern)
    const first = update(controller, boundary(1), s)
    expect(first.activePattern).not.toBe(s.pattern)
    expect(update(controller, boundary(1), s)).toMatchObject({ activePattern: first.activePattern, patternChanged: false, triggerEventId: null })
    expect(update(controller, boundary(2), s).activePattern).not.toBe(first.activePattern)
  })

  it('consumes existing events on toggle, manual Pattern edits, and Trigger changes', () => {
    const controller = new MutagenPerformanceController()
    update(controller, boundary(0))
    const on = settings({ patternChange: true, trigger: 'beat' })
    expect(update(controller, boundary(1), on).activePattern).toBe('liquify')
    const changed = update(controller, boundary(2), on).activePattern
    const trigger = { ...on, trigger: 'bar4' as const }
    expect(update(controller, boundary(16), trigger).activePattern).toBe(changed)
    expect(update(controller, boundary(16), trigger).activePattern).toBe(changed)
    expect(update(controller, boundary(32), trigger).activePattern).not.toBe(changed)
    expect(update(controller, boundary(48), { ...trigger, pattern: 'recursion' }).activePattern).toBe('recursion')
  })
})

describe('MUTAGEN musical arrangement and continuous routing', () => {
  it('reconstructs gradually in a breakdown and releases reconstruction promptly for the next drop', () => {
    const controller = new MutagenPerformanceController(), s = settings({ autoPerformance: true })
    update(controller, context({ sectionType: 'verse' }), s)
    const entry = update(controller, context({ audioTimeSec: 0.05, sectionType: 'breakdown', sectionProgress: 0.9 }), s)
    expect(entry.routing.reconstruction).toBeLessThan(0.2)
    for (let i = 2; i <= 50; i++) update(controller, context({ audioTimeSec: i / 20, sectionType: 'breakdown', sectionProgress: 0.9 }), s)
    let reconstruction = 1
    for (let i = 51; i <= 53; i++) reconstruction = update(controller, context({ audioTimeSec: i / 20, sectionType: 'drop', dropOccurrence: 2 }), s).routing.reconstruction
    expect(reconstruction).toBeLessThan(0.2)
  })

  it('replays the real browser-analyzed music fixture repeatably through Performance Core', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../../../test/fixtures/audio-intelligence/aint-no-other-man-social-club-remix.chromium.json', import.meta.url), 'utf8'))
    const analysis = fixture.payload.trackAnalysis as TrackIntelligenceAnalysis
    const run = () => {
      const controller = new MutagenPerformanceController(), trace: unknown[] = []
      let previous: SharedPerformanceContext | null = null
      for (let time = 0; time < analysis.durationMs / 1000; time += 0.25) {
        const c = mutagenAnalyzedFixtureContext(analysis, time, previous)
        const decision = update(controller, c, settings({ autoPerformance: true }))
        trace.push([c.sectionType, decision.activePattern, decision.routing.mutationGain, decision.routing.expansion])
        previous = c
      }
      return trace
    }
    const trace = run()
    expect(run()).toEqual(trace)
    expect(new Set(trace.map(row => (row as unknown[])[1])).size).toBeGreaterThan(1)
    expect(new Set(trace.map(row => (row as unknown[])[2])).size).toBeGreaterThan(30)
  })

  it('routes one genuine drop impulse, distinguishes Drop 2, and never re-fires a sticky section entry', () => {
    const controller = new MutagenPerformanceController(), s = settings({ autoPerformance: true })
    update(controller, context({ sectionType: 'build' }), s)
    const drop = context({ audioTimeSec: 0.5, sectionType: 'drop', sectionId: 'd1', dropOccurrence: 1, dropImpact: 1 })
    drop.boundaries.sectionEntry = true
    const hit = update(controller, drop, s)
    expect(hit.events.drop).not.toBeNull()
    expect(hit.routing.kickImpulse).toBeGreaterThan(0)
    const after = update(controller, { ...drop, audioTimeSec: 0.7 }, s)
    expect(after.events.drop).toBeNull()
    expect(after.routing.kickImpulse).toBeLessThan(hit.routing.kickImpulse)
    const second = context({ ...drop, dropOccurrence: 2, sectionId: 'd2' })
    const firstGain = update(new MutagenPerformanceController(), drop, s).routing.mutationGain
    const secondDecision = update(new MutagenPerformanceController(), second, s)
    expect(secondDecision.routing.mutationGain).toBeGreaterThan(firstGain)
    expect(secondDecision.activePattern).not.toBe(hit.activePattern)
    const saturated = { ...drop, bass: 1, buildProgress: 1 }
    const firstPeak = update(new MutagenPerformanceController(), saturated, s).routing.mutationGain
    const secondPeak = update(new MutagenPerformanceController(), { ...saturated, dropOccurrence: 2 }, s).routing.mutationGain
    expect(secondPeak).toBeGreaterThan(firstPeak)
  })
  it('directs intro/build/drop occurrences/breakdown deterministically without changing authored state', () => {
    const s = settings({ autoPerformance: true }), controller = new MutagenPerformanceController()
    const serialized = JSON.stringify(s)
    const intro = update(controller, context({ sectionType: 'intro' }), s)
    expect(intro).toMatchObject({ activePattern: 'morph', routing: { reconstruction: 0.72 } })
    expect(intro.routing.mutationGain).toBeCloseTo(0.45)
    expect(resolveMutagenAutoPattern(context({ sectionType: 'build', buildProgress: 0.1 }), s.deterministicSeed)).toBe('morph')
    expect(resolveMutagenAutoPattern(context({ sectionType: 'build', buildProgress: 0.5 }), s.deterministicSeed)).toBe('liquify')
    expect(resolveMutagenAutoPattern(context({ sectionType: 'build', buildProgress: 0.9 }), s.deterministicSeed)).toBe('vortex')
    const drop1 = context({ sectionType: 'drop', dropOccurrence: 1 }), drop2 = context({ sectionType: 'drop', dropOccurrence: 2 })
    expect(resolveMutagenAutoPattern(drop1, s.deterministicSeed)).not.toBe(resolveMutagenAutoPattern(drop2, s.deterministicSeed))
    let reconstruction = 0
    for (let i = 0; i < 80; i++) reconstruction = update(controller, context({ audioTimeSec: i / 20, sectionType: 'breakdown', sectionProgress: i / 80 }), s).routing.reconstruction
    expect(reconstruction).toBeGreaterThan(0.8)
    expect(JSON.stringify(s)).toBe(serialized)
  })

  it('routes bands, build, punch and tear independently with clamps, decay and smoothing', () => {
    const controller = new MutagenPerformanceController(), s = settings()
    update(controller, context(), s)
    const loud = context({ audioTimeSec: 0.1, bass: 1, mid: 1, high: 1, sectionType: 'build', buildProgress: 0.9, kick: true, kickStrength: 1, snare: true, snareStrength: 1 })
    const onset = update(controller, loud, s)
    expect(onset.routing.kickImpulse).toBe(1)
    expect(onset.routing.tearAccent).toBe(1)
    expect(onset.routing.velocity).toBeGreaterThan(1)
    expect(onset.routing.density).toBeGreaterThan(0)
    expect(onset.routing.edgeDetail).toBeLessThanOrEqual(0.25)
    expect(onset.routing.mutationGain).toBeLessThanOrEqual(2.2)
    const later = update(controller, { ...loud, audioTimeSec: 0.8 }, s)
    expect(later.routing.kickImpulse).toBe(0)
    expect(later.routing.tearAccent).toBe(0)
    const quiet = update(controller, context({ audioTimeSec: 0.85 }), s)
    expect(quiet.routing.density).toBeGreaterThan(0)
    expect(update(controller, loud, { ...s, audioReactivity: 0 }).routing).toEqual(MUTAGEN_NEUTRAL_ROUTING)
    for (const clean of [{ mutation: 0 }, { sourceMix: 1 }]) {
      const recipe = resolveMutagenReactiveSettings({ ...s, ...clean }, onset)
      if ('mutation' in clean) expect(recipe.mutation).toBe(0)
      else expect(recipe.sourceMix).toBe(1)
    }
  })

  it('gates unavailable/low-confidence inputs and falls back to controllable manual animation', () => {
    const c = createSharedPerformanceFallbackContext(3)
    const controller = new MutagenPerformanceController(), s = settings({ autoPerformance: true, pattern: 'recursion' })
    const decision = update(controller, c, s)
    expect(decision.activePattern).toBe('recursion')
    expect(decision.routing).toEqual(MUTAGEN_NEUTRAL_ROUTING)
    const later = update(controller, { ...c, audioTimeSec: 3.1 }, s)
    expect(later.motionTimeSec).toBeGreaterThan(decision.motionTimeSec)
    const unqualified = context({ sectionType: 'drop', bass: 1, confidence: { ...c.confidence, overall: 0, section: 0 }, sectionConfidence: 0 })
    expect(update(new MutagenPerformanceController(), unqualified, s).activePattern).toBe('recursion')
  })

  it('keeps BPM Sync independent of Pattern and Audio Reactivity and supports pre-drop hold', () => {
    const c = context({ bpm: 240, absoluteBeat: 8, audioTimeSec: 2 })
    expect(resolveMutagenMotionPosition(c, true, 2.05)).toBeCloseTo(4.1)
    expect(resolveMutagenMotionPosition(c, false, 2.05)).toBe(2.05)
    expect(resolveMutagenMotionPosition({ ...c, capabilities: { ...c.capabilities, beatGrid: false } }, true, 2.05)).toBe(2.05)
    const decision = update(new MutagenPerformanceController(), context({ sectionType: 'preDrop', sectionProgress: 0.8 }), settings())
    expect(decision).toMatchObject({ activePattern: 'liquify', routing: { preDropHold: true, velocity: 0.2 } })
  })
})

describe('MUTAGEN deterministic lifecycle', () => {
  it('freezes pattern/phase/envelopes while paused and consumes resume-frame events', () => {
    const controller = new MutagenPerformanceController(), s = settings({ patternChange: true, trigger: 'beat' })
    update(controller, boundary(0), s)
    const running = update(controller, boundary(1), s)
    const paused = update(controller, boundary(2), s, { paused: true })
    expect(paused).toMatchObject({ activePattern: running.activePattern, motionTimeSec: running.motionTimeSec, routing: running.routing, triggerEventId: null })
    expect(update(controller, boundary(2), s, { paused: false })).toMatchObject({ activePattern: running.activePattern, triggerEventId: null })
    expect(update(controller, boundary(3), s).activePattern).not.toBe(running.activePattern)
  })

  it.each(['seek', 'loop', 'track', 'timing'] as const)('cold-resets %s without inventing a drop and makes repeatable decisions after reset', kind => {
    const controller = new MutagenPerformanceController(), s = settings({ patternChange: true, trigger: 'beat' })
    update(controller, boundary(0), s); update(controller, boundary(1), s)
    const reset = boundary(32)
    reset.runtimeIdentity = `track-a:${kind}`
    reset.sectionType = 'drop'; reset.dropImpact = 1; reset.boundaries.sectionEntry = true
    if (kind === 'seek') reset.seekDetected = true
    if (kind === 'loop') reset.loopWrapDetected = true
    if (kind === 'track') reset.trackReplacementDetected = true
    if (kind === 'timing') reset.boundaries.timingDiscontinuity = true
    const decision = update(controller, reset, s)
    expect(decision).toMatchObject({ reset: true, activePattern: s.pattern, triggerEventId: null, events: { drop: null }, routing: { kickImpulse: 0, tearAccent: 0 } })
    const next = boundary(33); next.runtimeIdentity = reset.runtimeIdentity
    const expected = update(controller, next, s).activePattern
    controller.reset(); update(controller, reset, s)
    expect(update(controller, next, s).activePattern).toBe(expected)
    const auto = settings({ autoPerformance: true })
    expect(update(new MutagenPerformanceController(), reset, auto).activePattern).toBe(resolveMutagenAutoPattern(reset, auto.deterministicSeed))
  })
})
