import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import {
  SHIFTGRID_TRIGGER_IDS,
  ShiftgridPatternController,
  ShiftgridPerformanceController,
  createShiftgridPerformancePatternCycle,
  nextShiftgridPerformancePattern,
  resolveShiftgridBpmDurationScale,
  resolveShiftgridTriggerEventIdentity,
} from './ShiftgridPerformanceController'
import {
  CANVAS_SHIFTGRID_PATTERN_OPTIONS,
  CANVAS_SHIFTGRID_TRIGGER_OPTIONS,
  DEFAULT_CANVAS_SHIFTGRID_SETTINGS,
  applyShiftgridAutoPerformance,
  applyShiftgridManualPattern,
  applyShiftgridPatternChange,
  normalizeCanvasShiftgridSettings,
  type CanvasShiftgridPattern,
  type CanvasShiftgridSettings,
} from './ShiftgridSettings'

function context(overrides: Partial<SharedPerformanceContext> = {}, previous: SharedPerformanceContext | null = null): SharedPerformanceContext {
  const fallback = createSharedPerformanceFallbackContext(overrides.audioTimeSec ?? 8, previous)
  return {
    ...fallback,
    runtimeIdentity: 'track-a::runtime',
    trackIdentity: 'track-a',
    capabilities: { ...fallback.capabilities, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...fallback.confidence, grid: 1, downbeat: 1, phrase: 1, semantics: 1 },
    boundaries: { ...fallback.boundaries, beatBoundary: false, barBoundary: false, sectionEntry: false, timingDiscontinuity: false },
    ...overrides,
  }
}

function settings(patch: Partial<CanvasShiftgridSettings> = {}): CanvasShiftgridSettings {
  return { ...DEFAULT_CANVAS_SHIFTGRID_SETTINGS, patternChange: false, autoPerformance: false, ...patch }
}

describe('SHIFTGRID P4 performance controller', () => {
  it('publishes the exact canonical Cinema 2.0 trigger values and labels', () => {
    expect(SHIFTGRID_TRIGGER_IDS).toEqual(['beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop'])
    expect(CANVAS_SHIFTGRID_TRIGGER_OPTIONS).toEqual([
      { value: 'beat', label: 'Beat' },
      { value: 'kick', label: 'Kick' },
      { value: 'snare', label: 'Snare' },
      { value: 'downbeat', label: 'Downbeat' },
      { value: 'beat2', label: 'Every 2 Beats' },
      { value: 'beat4', label: 'Every 4 Beats' },
      { value: 'bar', label: 'Bar' },
      { value: 'bar4', label: 'Every 4 Bars' },
      { value: 'bar8', label: 'Every 8 Bars' },
      { value: 'phrase', label: 'Phrase' },
      { value: 'drop', label: 'Drop' },
    ])
  })

  it('uses the shared BPM only when BPM Sync has a qualified grid', () => {
    const slow = context({ bpm: 60 })
    expect(resolveShiftgridBpmDurationScale(slow, true)).toBe(2)
    expect(resolveShiftgridBpmDurationScale(context({ bpm: 240 }), true)).toBe(0.5)
    expect(resolveShiftgridBpmDurationScale(slow, false)).toBe(1)
    expect(resolveShiftgridBpmDurationScale(context({ bpm: 60, capabilities: { ...slow.capabilities, beatGrid: false } }), true)).toBe(1)
  })

  it('resolves all eleven triggers only from qualified shared events', () => {
    const previous = context({ absoluteBeat: 31, absoluteBar: 7, phraseIndex: 1, kick: false, snare: false, dropImpact: 0 })
    const current = context({
      audioTimeSec: 8.25,
      absoluteBeat: 32,
      beatIndex: 32,
      absoluteBar: 8,
      barIndex: 8,
      downbeat: true,
      phraseIndex: 2,
      kick: true,
      kickStrength: 0.8,
      snare: true,
      snareStrength: 0.7,
      dropImpact: 0.9,
      sectionType: 'drop',
      sectionId: 'drop-a',
      sectionOccurrence: 1,
      dropOccurrence: 1,
      boundaries: { ...previous.boundaries, beatBoundary: true, barBoundary: true, sectionEntry: true, timingDiscontinuity: false },
    }, previous)
    for (const trigger of SHIFTGRID_TRIGGER_IDS) {
      expect(resolveShiftgridTriggerEventIdentity(current, previous, trigger, true), trigger).not.toBeNull()
    }
    expect(resolveShiftgridTriggerEventIdentity(current, previous, 'beat', false)).toBeNull()
    const noGrid = context({ capabilities: { ...current.capabilities, beatGrid: false }, boundaries: current.boundaries })
    expect(resolveShiftgridTriggerEventIdentity(noGrid, previous, 'beat4', true)).toBeNull()
    expect(resolveShiftgridTriggerEventIdentity(noGrid, previous, 'bar8', true)).toBeNull()
  })

  it('uses a deterministic shuffled cycle and advances once per event for every trigger', () => {
    const cycle = createShiftgridPerformancePatternCycle(73421)
    expect(createShiftgridPerformancePatternCycle(73421)).toEqual(cycle)
    expect(new Set(cycle)).toEqual(new Set(CANVAS_SHIFTGRID_PATTERN_OPTIONS.map(option => option.value)))
    const controller = new ShiftgridPatternController(cycle)
    controller.update({ authoredPattern: 'rowRunner', patternChange: false, trigger: 'bar4', triggerEventId: null, absoluteBeat: 0 })
    controller.update({ authoredPattern: 'rowRunner', patternChange: true, trigger: 'bar4', triggerEventId: 'present-on-toggle', absoluteBeat: 1 })
    let active: CanvasShiftgridPattern = 'rowRunner'
    SHIFTGRID_TRIGGER_IDS.forEach((trigger, index) => {
      controller.update({ authoredPattern: 'rowRunner', patternChange: true, trigger, triggerEventId: null, absoluteBeat: index + 2 })
      const eventId = `${trigger}:${index}`
      const advanced = controller.update({ authoredPattern: 'rowRunner', patternChange: true, trigger, triggerEventId: eventId, absoluteBeat: index + 2.25 })
      expect(advanced.activePattern).toBe(nextShiftgridPerformancePattern(cycle, active))
      expect(controller.update({ authoredPattern: 'rowRunner', patternChange: true, trigger, triggerEventId: eventId, absoluteBeat: index + 2.5 }).changed).toBe(false)
      active = advanced.activePattern
    })
  })

  it('enforces real inspector authority interactions and migrates ambiguous P3 state', () => {
    const auto = applyShiftgridAutoPerformance(settings(), true)
    expect(auto).toMatchObject({ autoPerformance: true, patternChange: false })
    const manual = applyShiftgridManualPattern(auto, 'waveRelay')
    expect(manual).toMatchObject({ choreographyPattern: 'waveRelay', autoPerformance: false })
    const patternChange = applyShiftgridPatternChange(applyShiftgridAutoPerformance(settings(), true), true)
    expect(patternChange).toMatchObject({ patternChange: true, autoPerformance: false })
    expect(applyShiftgridPatternChange(patternChange, false)).toMatchObject({ patternChange: false, choreographyPattern: patternChange.choreographyPattern })
    expect(normalizeCanvasShiftgridSettings({ version: 4, patternChange: true, autoPerformance: true })).toMatchObject({
      version: 6, patternChange: true, autoPerformance: false,
    })
  })

  it('makes manual edits immediate, consumes toggle/trigger-frame events, and preserves the selected pattern', () => {
    const cycle = createShiftgridPerformancePatternCycle(5)
    const controller = new ShiftgridPatternController(cycle)
    const base = { authoredPattern: 'rowRunner' as const, patternChange: false, trigger: 'beat' as const, triggerEventId: null, absoluteBeat: 0 }
    controller.update(base)
    expect(controller.update({ ...base, patternChange: true, triggerEventId: 'beat:toggle', absoluteBeat: 4 }).activePattern).toBe('rowRunner')
    const advanced = controller.update({ ...base, patternChange: true, triggerEventId: 'beat:next', absoluteBeat: 5 })
    expect(advanced.activePattern).not.toBe('rowRunner')
    expect(controller.update({ ...base, patternChange: true, trigger: 'drop', triggerEventId: 'drop:current', absoluteBeat: 6 }).activePattern).toBe(advanced.activePattern)
    expect(controller.update({ ...base, authoredPattern: 'centerCollapse', patternChange: true, trigger: 'drop', triggerEventId: 'drop:current', absoluteBeat: 7 })).toMatchObject({
      activePattern: 'centerCollapse', changed: true,
    })
    expect(controller.update({ ...base, authoredPattern: 'centerCollapse', patternChange: false, trigger: 'drop', triggerEventId: 'drop:new', absoluteBeat: 8 }).activePattern).toBe('centerCollapse')
  })

  it('applies one authority per frame, routes independent signals, and resets safely on seek', () => {
    const controller = new ShiftgridPerformanceController(99)
    const quiet = context({ absoluteBeat: 15, absoluteBar: 3, sectionType: 'verse', mid: 0.25, bass: 0.2, high: 0.1 })
    controller.update({ settings: settings(), context: quiet, audioActive: true, paused: false })
    const event = context({
      audioTimeSec: 8.5,
      absoluteBeat: 16,
      absoluteBar: 4,
      kick: true,
      kickStrength: 0.9,
      snare: true,
      snareStrength: 0.75,
      bass: 0.8,
      mid: 0.6,
      high: 0.7,
      buildProgress: 0.5,
      boundaries: { ...quiet.boundaries, beatBoundary: true, barBoundary: true },
    }, quiet)
    const routed = controller.update({ settings: settings(), context: event, audioActive: true, paused: false })
    expect(routed.authority).toBe('manual')
    expect(routed.routing).toMatchObject({ horizontalImpulse: 0.9, verticalImpulse: 0.75, movementAmplitude: 0.8, movementDensity: 0.6 })
    expect(routed.routing.edgeShimmer).toBeCloseTo(0.245)

    const autoDecision = controller.update({ settings: settings({ autoPerformance: true }), context: event, audioActive: true, paused: false })
    expect(autoDecision.authority).toBe('autoPerformance')
    const manualDecision = controller.update({ settings: applyShiftgridManualPattern(settings({ autoPerformance: true }), 'dominoChain'), context: event, audioActive: true, paused: false })
    expect(manualDecision).toMatchObject({ authority: 'manual', activePattern: 'dominoChain' })

    const seek = context({ ...event, seekDetected: true, runtimeIdentity: 'track-a::seek-2', boundaries: { ...event.boundaries, timingDiscontinuity: true } }, event)
    const reset = controller.update({ settings: settings({ reconstructionMode: 'dropResolve' }), context: seek, audioActive: true, paused: false })
    expect(reset.reset).toBe(true)
    expect(reset.triggerEventId).toBeNull()
    expect(reset.reconstructNow).toBe(false)
  })

  it('interrupts an in-progress performance decision on an authoritative drop but never while paused', () => {
    const controller = new ShiftgridPerformanceController(17)
    const before = context({ sectionType: 'build', buildProgress: 0.9, dropImpact: 0 })
    controller.update({ settings: settings({ autoPerformance: true, reconstructionMode: 'dropResolve' }), context: before, audioActive: true, paused: false })
    const drop = context({
      audioTimeSec: 9,
      sectionType: 'drop',
      sectionId: 'drop-1',
      dropImpact: 1,
      boundaries: { ...before.boundaries, sectionEntry: true },
    }, before)
    const decision = controller.update({ settings: settings({ autoPerformance: true, reconstructionMode: 'dropResolve', mosaicType: 'imageTakeover' }), context: drop, audioActive: true, paused: false })
    expect(decision).toMatchObject({ authority: 'autoPerformance', reconstructNow: true, advanceMosaic: true })

    const pausedController = new ShiftgridPerformanceController(17)
    pausedController.update({ settings: settings({ patternChange: true, trigger: 'drop' }), context: before, audioActive: true, paused: false })
    const paused = pausedController.update({ settings: settings({ patternChange: true, trigger: 'drop' }), context: drop, audioActive: true, paused: true })
    expect(paused.triggerEventId).toBeNull()
    expect(paused.patternChanged).toBe(false)
    expect(paused.reconstructNow).toBe(false)
  })
})

